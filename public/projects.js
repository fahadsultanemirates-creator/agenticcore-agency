// AgenticCore Agency — Your projects page: pending requests, grouped
// project cards with Save/Move/Share/Delete actions.

const STATUS_LABELS = {
  draft: 'Draft',
  awaiting_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  awaiting_review: 'Awaiting your review',
  revision_requested: 'Revision requested',
  delivered: 'Delivered',
  approved: 'Approved — awaiting final payment',
  pending: 'Pending',
  paid: 'Paid',
  refunded: 'Refunded'
};

function statusPill(status) {
  const label = STATUS_LABELS[status] || status;
  return `<span class="status-pill status-${status}">${label}</span>`;
}

function formatMoney(amount) {
  return '$' + Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function renderProjectsPanel(userId) {
  const { data: requests } = await supabaseClient
    .from('requests')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['draft', 'awaiting_payment'])
    .order('created_at', { ascending: false });

  const requestsList = document.getElementById('requestsList');
  const requestsEmpty = document.getElementById('requestsEmpty');
  requestsList.innerHTML = '';
  if (requests && requests.length) {
    requestsEmpty.style.display = 'none';
    requests.forEach((r) => {
      const el = document.createElement('div');
      el.className = 'request-card';
      el.innerHTML = `
        <div>
          <h4>${escapeHtml(r.service_category)}</h4>
          <p>Submitted ${formatDate(r.created_at)}</p>
        </div>
        ${statusPill(r.status)}
      `;
      requestsList.appendChild(el);
    });
  } else {
    requestsEmpty.style.display = 'block';
  }

  const { data: projects } = await supabaseClient
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const projectsList = document.getElementById('projectsList');
  const projectsEmpty = document.getElementById('projectsEmpty');
  projectsList.innerHTML = '';
  if (projects && projects.length) {
    projectsEmpty.style.display = 'none';

    const groups = new Map();
    projects.forEach((p) => {
      const key = p.project_group || 'Unsorted';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });

    groups.forEach((groupProjects, groupName) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'project-group';
      groupEl.innerHTML = `
        <div class="project-group-header">
          <h3>${escapeHtml(groupName)}</h3>
          <span class="project-group-count">${groupProjects.length} project${groupProjects.length === 1 ? '' : 's'}</span>
        </div>
      `;
      const cardsWrap = document.createElement('div');
      cardsWrap.className = 'project-group-cards';
      groupProjects.forEach((p) => cardsWrap.appendChild(buildProjectCard(p, userId)));
      groupEl.appendChild(cardsWrap);
      projectsList.appendChild(groupEl);
    });
  } else {
    projectsEmpty.style.display = 'block';
  }
}

function buildProjectCard(p, userId) {
  const el = document.createElement('div');
  el.className = 'project-card';

  const row = document.createElement('div');
  row.className = 'project-card-row';
  row.innerHTML = `
    <div>
      <h4>${escapeHtml(p.project_name || 'Untitled project')}</h4>
      <p>Started ${formatDate(p.created_at)}</p>
      <p class="revisions-note">${p.revisions_used} / 2 free revisions used</p>
    </div>
    ${statusPill(p.status)}
  `;
  el.appendChild(row);

  if (p.status === 'delivered' || p.status === 'awaiting_review') {
    const actions = document.createElement('div');
    actions.className = 'project-actions';

    if (p.revisions_used < 2) {
      const revisionBtn = document.createElement('button');
      revisionBtn.type = 'button';
      revisionBtn.className = 'btn btn-secondary btn-sm';
      revisionBtn.textContent = 'Request Revision';
      revisionBtn.addEventListener('click', () => handleRequestRevision(p.id, userId, revisionBtn));
      actions.appendChild(revisionBtn);
    } else {
      const note = document.createElement('p');
      note.className = 'revisions-note';
      note.textContent = 'No free revisions remaining — further changes are billed separately.';
      actions.appendChild(note);
    }

    const approveBtn = document.createElement('button');
    approveBtn.type = 'button';
    approveBtn.className = 'btn btn-primary btn-sm';
    approveBtn.textContent = 'Approve & Pay Remaining';
    approveBtn.addEventListener('click', () => handleApproveDelivery(p.id, userId, approveBtn));
    actions.appendChild(approveBtn);

    el.appendChild(actions);
  }

  const manageRow = document.createElement('div');
  manageRow.className = 'project-manage-row';

  const renameBtn = document.createElement('button');
  renameBtn.type = 'button';
  renameBtn.className = 'project-manage-btn';
  renameBtn.title = 'Save / rename';
  renameBtn.innerHTML = '<span aria-hidden="true">✎</span> Save';
  renameBtn.addEventListener('click', () => handleRenameProject(p, userId));
  manageRow.appendChild(renameBtn);

  const moveBtn = document.createElement('button');
  moveBtn.type = 'button';
  moveBtn.className = 'project-manage-btn';
  moveBtn.title = 'Move to a different group';
  moveBtn.innerHTML = '<span aria-hidden="true">⇄</span> Move';
  moveBtn.addEventListener('click', () => handleMoveProject(p, userId));
  manageRow.appendChild(moveBtn);

  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'project-manage-btn';
  shareBtn.title = p.is_shared ? 'Copy the share link' : 'Get a shareable link';
  shareBtn.innerHTML = `<span aria-hidden="true">🔗</span> ${p.is_shared ? 'Copy link' : 'Share'}`;
  shareBtn.addEventListener('click', () => handleShareProject(p, userId, shareBtn));
  manageRow.appendChild(shareBtn);

  if (p.is_shared) {
    const unshareBtn = document.createElement('button');
    unshareBtn.type = 'button';
    unshareBtn.className = 'project-manage-btn';
    unshareBtn.title = 'Turn off the share link';
    unshareBtn.innerHTML = '<span aria-hidden="true">🚫</span> Unshare';
    unshareBtn.addEventListener('click', () => handleUnshareProject(p, userId));
    manageRow.appendChild(unshareBtn);
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'project-manage-btn project-manage-btn-danger';
  deleteBtn.title = 'Delete this project';
  deleteBtn.innerHTML = '<span aria-hidden="true">🗑</span> Delete';
  deleteBtn.addEventListener('click', () => handleDeleteProject(p, userId));
  manageRow.appendChild(deleteBtn);

  el.appendChild(manageRow);
  return el;
}

async function handleRequestRevision(projectId, userId, btn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  const { error } = await supabaseClient.rpc('request_project_revision', { p_project_id: projectId });

  if (error) {
    btn.disabled = false;
    btn.textContent = original;
    alert('Could not request a revision: ' + error.message);
    return;
  }

  renderProjectsPanel(userId);
}

async function handleApproveDelivery(projectId, userId, btn) {
  if (!confirm('Approve this delivery? This will start the final payment (70% of the agreed price).')) {
    return;
  }

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  const { error } = await supabaseClient.rpc('approve_project_delivery', { p_project_id: projectId });

  if (error) {
    btn.disabled = false;
    btn.textContent = original;
    alert('Could not approve delivery: ' + error.message);
    return;
  }

  renderProjectsPanel(userId);
}

async function handleRenameProject(project, userId) {
  const name = prompt('Name this project:', project.project_name || '');
  if (name === null) return;
  const { error } = await supabaseClient.rpc('rename_project', { p_project_id: project.id, p_name: name });
  if (error) { alert('Could not save: ' + error.message); return; }
  renderProjectsPanel(userId);
}

async function handleMoveProject(project, userId) {
  const group = prompt('Move to which group? (leave blank to go back to Unsorted)', project.project_group || '');
  if (group === null) return;
  const { error } = await supabaseClient.rpc('move_project_group', { p_project_id: project.id, p_group: group });
  if (error) { alert('Could not move: ' + error.message); return; }
  renderProjectsPanel(userId);
}

async function handleShareProject(project, userId, btn) {
  let shareToken = project.share_token;
  if (!project.is_shared) {
    const { data, error } = await supabaseClient.rpc('set_project_shared', { p_project_id: project.id, p_shared: true });
    if (error) { alert('Could not enable sharing: ' + error.message); return; }
    shareToken = data.share_token;
  }

  const link = `${window.location.origin}${window.location.pathname.replace('projects.html', '')}project-view.html?token=${shareToken}`;
  try {
    await navigator.clipboard.writeText(link);
    const original = btn.innerHTML;
    btn.innerHTML = '<span aria-hidden="true">✓</span> Copied!';
    setTimeout(() => { btn.innerHTML = original; }, 1500);
  } catch (e) {
    prompt('Copy this link:', link);
  }
  renderProjectsPanel(userId);
}

async function handleUnshareProject(project, userId) {
  if (!confirm('Stop sharing this project? The old link will stop working.')) return;
  const { error } = await supabaseClient.rpc('set_project_shared', { p_project_id: project.id, p_shared: false });
  if (error) { alert('Could not disable sharing: ' + error.message); return; }
  renderProjectsPanel(userId);
}

async function handleDeleteProject(project, userId) {
  if (!confirm(`Delete "${project.project_name || 'Untitled project'}"? This can't be undone from here.`)) return;
  const { error } = await supabaseClient.rpc('soft_delete_project', { p_project_id: project.id });
  if (error) { alert('Could not delete: ' + error.message); return; }
  renderProjectsPanel(userId);
}

// -------- Init --------
(async () => {
  const profile = await loadDashProfile();
  if (!profile) return;

  renderDashSidebar('projects');
  renderDashTopbar('Dashboard', 'Your projects');
  renderProjectsPanel(profile.id);
})();
