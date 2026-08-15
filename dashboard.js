// AgenticCore Agency — Dashboard logic

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
}

// -------- Business Pool section --------
const BUSINESS_POOL_THRESHOLD = 5000;

function renderBusinessPoolSection(profile) {
  const progressWrap = document.getElementById('bpProgressWrap');
  const progressFill = document.getElementById('bpProgressFill');
  const progressText = document.getElementById('bpProgressText');
  const unlockedText = document.getElementById('bpUnlockedText');
  const managerBtn = document.getElementById('bpManagerBtn');

  if (profile.is_business_pool) {
    progressWrap.style.display = 'none';
    unlockedText.style.display = 'block';
    managerBtn.style.display = 'inline-block';
  } else {
    progressWrap.style.display = 'block';
    unlockedText.style.display = 'none';
    managerBtn.style.display = 'none';
    const spend = Number(profile.total_spend) || 0;
    const pct = Math.max(0, Math.min(100, (spend / BUSINESS_POOL_THRESHOLD) * 100));
    progressFill.style.width = pct + '%';
    progressText.textContent = `${formatMoney(spend)} / ${formatMoney(BUSINESS_POOL_THRESHOLD)}`;
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

// -------- New Request wizard --------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function initNewRequestWizard(profile) {
  const pointsRow = document.getElementById('pointsToggleRow');
  const pointsNote = document.getElementById('pointsToggleNote');
  if (Number(profile.points_balance) > 0) {
    pointsRow.style.display = 'block';
    pointsNote.textContent = `You have ${formatMoney(profile.points_balance)} in Points. Check this box and we'll apply up to that amount when your price is finalized.`;
  }

  const state = { category: null, taskType: null, tier: null };
  let currentStep = 1;

  const stepEls = document.querySelectorAll('#requestWizard .wizard-step');
  const indicatorEls = document.querySelectorAll('#wizardStepsIndicator li');
  const backBtn = document.getElementById('wizardBackBtn');
  const nextBtn = document.getElementById('wizardNextBtn');

  function goToStep(n) {
    currentStep = n;
    stepEls.forEach((el) => el.classList.toggle('active', Number(el.dataset.step) === n));
    indicatorEls.forEach((el) => el.classList.toggle('active', Number(el.dataset.step) === n));
    backBtn.style.display = n > 1 ? 'inline-block' : 'none';
    nextBtn.style.display = n === 4 ? 'inline-block' : 'none';
    if (n === 5) renderSummary();
  }

  function renderServiceOptions() {
    const el = document.getElementById('wizardServiceOptions');
    el.innerHTML = '';
    PRICING_CATALOG.forEach((cat) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wizard-option-card';
      if (cat.category === state.category) btn.classList.add('selected');
      btn.innerHTML = `<span>${escapeHtml(cat.label || cat.category)}</span>`;
      btn.addEventListener('click', () => {
        state.category = cat.category;
        state.taskType = null;
        state.tier = null;
        renderServiceOptions();
        renderTaskOptions();
        goToStep(2);
      });
      el.appendChild(btn);
    });
  }

  function renderTaskOptions() {
    const el = document.getElementById('wizardTaskOptions');
    el.innerHTML = '';
    const cat = getCatalogCategory(state.category);
    if (!cat) return;
    cat.items.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wizard-option-card';
      if (item.name === state.taskType) btn.classList.add('selected');
      btn.innerHTML = `<span>${escapeHtml(item.name)}</span><span class="wizard-option-price">${formatMoney(item.low)} – ${formatMoney(item.high)}</span>`;
      btn.addEventListener('click', () => {
        state.taskType = item.name;
        state.tier = null;
        renderTaskOptions();
        renderTierOptions();
        goToStep(3);
      });
      el.appendChild(btn);
    });
  }

  function renderTierOptions() {
    const el = document.getElementById('wizardTierOptions');
    el.innerHTML = '';
    const item = getCatalogItem(state.category, state.taskType);
    if (!item) return;
    ['low', 'mid', 'high'].forEach((tier) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wizard-option-card';
      if (tier === state.tier) btn.classList.add('selected');
      btn.innerHTML = `<span>${escapeHtml(TIER_LABELS[tier])}</span><span class="wizard-option-price">${formatMoney(item[tier])}</span>`;
      btn.addEventListener('click', () => {
        state.tier = tier;
        renderTierOptions();
        goToStep(4);
      });
      el.appendChild(btn);
    });
  }

  function renderSummary() {
    const item = getCatalogItem(state.category, state.taskType);
    const price = item ? item[state.tier] : 0;
    const description = document.getElementById('reqDescription').value.trim();
    const file = document.getElementById('reqAttachment').files[0];
    const el = document.getElementById('wizardSummary');
    el.innerHTML = `
      <dt>Service</dt><dd>${escapeHtml(state.category)}</dd>
      <dt>Task</dt><dd>${escapeHtml(state.taskType)}</dd>
      <dt>Tier</dt><dd>${escapeHtml(TIER_LABELS[state.tier])}</dd>
      <dt>Price</dt><dd>${formatMoney(price)}</dd>
      <dt>Description</dt><dd>${escapeHtml(description) || '<em>None provided</em>'}</dd>
      ${file ? `<dt>Attachment</dt><dd>${escapeHtml(file.name)}</dd>` : ''}
    `;
  }

  backBtn.addEventListener('click', () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  });

  nextBtn.addEventListener('click', () => {
    const description = document.getElementById('reqDescription').value.trim();
    const errorEl = document.getElementById('requestError');
    if (!description) {
      errorEl.textContent = 'Please describe what you need before continuing.';
      errorEl.style.display = 'block';
      return;
    }
    errorEl.style.display = 'none';
    goToStep(5);
  });

  document.getElementById('submitRequestBtn').addEventListener('click', async () => {
    const errorEl = document.getElementById('requestError');
    const successEl = document.getElementById('requestSuccess');
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    const item = getCatalogItem(state.category, state.taskType);
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
      service_category: state.category,
      task_type: state.taskType,
      tier: tierDbValue(state.tier),
      description,
      agreed_price: item[state.tier],
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

    state.category = null;
    state.taskType = null;
    state.tier = null;
    document.getElementById('reqDescription').value = '';
    attachmentInput.value = '';
    document.getElementById('applyPointsToggle').checked = false;
    renderServiceOptions();
    goToStep(1);

    successEl.textContent = 'Request submitted — we\'ll follow up shortly. You can track it under My Projects.';
    successEl.style.display = 'block';
    renderProjectsPanel(profile.id);
  });

  renderServiceOptions();
  goToStep(1);
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
  renderBusinessPoolSection(profile);
  initTabs();
  initNewRequestWizard(profile);
  renderProjectsPanel(userId);
  renderBillingPanel(userId);

  document.getElementById('logoutBtn').addEventListener('click', logOut);
})();
