// AgenticCore Agency — Dashboard logic

const SERVICE_CATEGORIES = ['Websites', 'Marketing', 'Bookkeeping & Reports', 'Audits & Feasibility Reports', 'Custom AI Agents'];

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

// -------- Tabs --------
function initTabs() {
  const tabs = document.querySelectorAll('.dash-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
}

function switchTab(name) {
  document.querySelectorAll('.dash-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.dash-panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${name}`));
}

// -------- Header: profile, referral link, points, support --------
function renderHeader(profile) {
  document.getElementById('welcomeHeading').textContent = profile.full_name
    ? `Welcome back, ${profile.full_name.split(' ')[0]}`
    : 'Welcome back';

  const referralUrl = `${window.location.origin}${window.location.pathname.replace('dashboard.html', '')}signup.html?ref=${profile.referral_code}`;
  document.getElementById('referralLinkInput').value = referralUrl;

  document.getElementById('pointsBalance').textContent = formatMoney(profile.points_balance);

  const supportCard = document.getElementById('supportCard');
  const supportTag = document.getElementById('supportTag');
  const supportText = document.getElementById('supportText');
  const supportLink = document.getElementById('supportLink');
  const bpPerks = document.getElementById('businessPoolPerks');

  if (profile.is_business_pool) {
    supportCard.classList.add('is-business-pool');
    supportTag.textContent = 'Business Pool';
    supportText.textContent = 'You have a dedicated human manager — reach them directly on Telegram.';
    bpPerks.style.display = 'flex';
    supportLink.href = 'https://t.me/agenticcore_managers';
    supportLink.textContent = 'Message your manager';
  } else {
    supportTag.textContent = 'Support';
    const remaining = Math.max(0, 5000 - Number(profile.total_spend));
    supportText.textContent = remaining > 0
      ? `Our AI agent specialist is available on Telegram. $${remaining.toLocaleString()} more in lifetime spend unlocks Business Pool.`
      : 'Our AI agent specialist is available on Telegram.';
    bpPerks.style.display = 'none';
    supportLink.href = 'https://t.me/agenticcore_support';
    supportLink.textContent = 'Message us on Telegram';
  }
}

document.getElementById('copyReferralBtn').addEventListener('click', async () => {
  const input = document.getElementById('referralLinkInput');
  input.select();
  try {
    await navigator.clipboard.writeText(input.value);
    const btn = document.getElementById('copyReferralBtn');
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  } catch (e) {
    // Clipboard API unavailable (e.g. insecure context) -- the input is
    // already selected above, so a manual copy still works.
  }
});

// -------- My Projects: pending requests + projects --------
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
          <h4>${r.service_category} — ${r.tier} tier</h4>
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
    .order('created_at', { ascending: false });

  const projectsList = document.getElementById('projectsList');
  const projectsEmpty = document.getElementById('projectsEmpty');
  projectsList.innerHTML = '';
  if (projects && projects.length) {
    projectsEmpty.style.display = 'none';
    projects.forEach((p) => {
      const el = document.createElement('div');
      el.className = 'project-card';

      const row = document.createElement('div');
      row.className = 'project-card-row';
      row.innerHTML = `
        <div>
          <h4>${p.project_name || 'Untitled project'}</h4>
          <p>Started ${formatDate(p.created_at)}</p>
          <p class="revisions-note">${p.revisions_used} / 2 free revisions used</p>
        </div>
        ${statusPill(p.status)}
      `;
      el.appendChild(row);

      if (p.status === 'delivered') {
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

      projectsList.appendChild(el);
    });
  } else {
    projectsEmpty.style.display = 'block';
  }
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
  renderBillingPanel(userId);
}

// -------- Billing --------
async function renderBillingPanel(userId) {
  const { data: billing } = await supabaseClient
    .from('billing')
    .select('*')
    .eq('user_id', userId)
    .order('id', { ascending: false });

  const billingList = document.getElementById('billingList');
  const billingEmpty = document.getElementById('billingEmpty');
  billingList.innerHTML = '';
  if (billing && billing.length) {
    billingEmpty.style.display = 'none';
    billing.forEach((b) => {
      const el = document.createElement('div');
      el.className = 'billing-row';
      el.innerHTML = `
        <div>
          <h4>${formatMoney(b.amount)} — ${b.payment_type}</h4>
          <p>${b.points_used > 0 ? formatMoney(b.points_used) + ' in Points applied' : 'No Points applied'}</p>
        </div>
        ${statusPill(b.status)}
      `;
      billingList.appendChild(el);
    });
  } else {
    billingEmpty.style.display = 'block';
  }
}

// -------- Services quick list --------
function initServicesPanel() {
  document.querySelectorAll('.start-request-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('reqCategory').value = btn.dataset.category;
      switchTab('new-request');
    });
  });
}

// -------- New Request form --------
function initNewRequestForm(profile) {
  const pointsRow = document.getElementById('pointsToggleRow');
  const pointsNote = document.getElementById('pointsToggleNote');
  if (Number(profile.points_balance) > 0) {
    pointsRow.style.display = 'block';
    pointsNote.textContent = `You have ${formatMoney(profile.points_balance)} in Points. Check this box and we'll apply up to that amount when your price is finalized.`;
  }

  const form = document.getElementById('newRequestForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('requestError');
    const successEl = document.getElementById('requestSuccess');
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    const category = document.getElementById('reqCategory').value;
    const tier = document.getElementById('reqTier').value;
    let description = document.getElementById('reqDescription').value.trim();
    const applyPoints = document.getElementById('applyPointsToggle').checked;
    const attachmentInput = document.getElementById('reqAttachment');
    const attachmentStatus = document.getElementById('attachmentStatus');
    const file = attachmentInput.files[0];

    if (applyPoints) {
      description += `\n\n[Requested: apply up to ${formatMoney(profile.points_balance)} in Points toward this project.]`;
    }

    const btn = document.getElementById('submitRequestBtn');
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    let attachmentPath = null;
    if (file) {
      attachmentStatus.textContent = 'Uploading attachment…';
      const path = `${profile.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabaseClient.storage
        .from('request-attachments')
        .upload(path, file);

      if (uploadError) {
        btn.disabled = false;
        btn.textContent = 'Submit request';
        attachmentStatus.textContent = '';
        errorEl.textContent = 'Attachment failed to upload: ' + uploadError.message;
        errorEl.style.display = 'block';
        return;
      }
      attachmentPath = path;
      attachmentStatus.textContent = '';
    }

    const { error } = await supabaseClient.from('requests').insert({
      user_id: profile.id,
      service_category: category,
      tier,
      description,
      status: 'awaiting_payment',
      attachment_path: attachmentPath
    });

    btn.disabled = false;
    btn.textContent = 'Submit request';

    if (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
      return;
    }

    form.reset();
    successEl.textContent = 'Request submitted — we\'ll follow up with a scoped price shortly. You can track it under My Projects.';
    successEl.style.display = 'block';
    renderProjectsPanel(profile.id);
  });
}

// -------- Init --------
(async () => {
  const session = await requireAuth();
  if (!session) return;

  const userId = session.user.id;
  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    console.error('Failed to load profile', error);
    return;
  }

  renderHeader(profile);
  initTabs();
  initServicesPanel();
  initNewRequestForm(profile);
  renderProjectsPanel(userId);
  renderBillingPanel(userId);

  document.getElementById('logoutBtn').addEventListener('click', logOut);
})();
