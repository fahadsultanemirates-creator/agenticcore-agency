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

// -------- Header: profile, support --------
function renderHeader(profile) {
  document.getElementById('welcomeHeading').textContent = profile.full_name
    ? `Welcome back, ${profile.full_name.split(' ')[0]}`
    : 'Welcome back';
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
          <h4>${r.service_category}</h4>
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

  const link = `${window.location.origin}${window.location.pathname.replace('dashboard.html', '')}project-view.html?token=${shareToken}`;
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

// -------- Checkout --------
// 30% due upfront, same split shown to visitors on services.html/terms.html.
const UPFRONT_FRACTION = 0.3;

// Confirmed company wallet (BEP20 / BNB Smart Chain) -- receives both USDT
// and AC token, same address, same chain.
const USDT_BEP20_ADDRESS = '0x62Ad7D55fbc8A8591109D72b67Ec63aa1EE196bC';
// AgenticCore (AC) token, BEP-20, BSC mainnet -- from the agenticcore-token-
// repo's deployed tokenConfig.ts (isContractLive: true).
const AC_TOKEN_CONTRACT_ADDRESS = '0xe9568888a0bc317519957047cf736e134B097768';
const AC_TOKEN_DISCOUNT_PCT = 15;
// Fahad will supply the AC token buy-page URL later -- swap it in here once given.
const AC_TOKEN_BUY_URL = null;

function upfrontAmountDue(agreedPrice) {
  return Math.round(agreedPrice * UPFRONT_FRACTION * 100) / 100;
}

// Renders the payment CTA into an already-visible success banner: pay in
// USDT (BEP20) at full price, or in AC token for a 15% discount -- same
// wallet address receives both. Neither is automatically confirmed (no
// webhook watches this address), so both ask the client to notify support
// with their request id + transaction hash for manual review.
function renderPaymentCTA(container, { requestId, amountDue }) {
  const wrap = document.createElement('div');
  wrap.style.marginTop = 'var(--space-sm, 0.75rem)';
  wrap.style.display = 'flex';
  wrap.style.flexWrap = 'wrap';
  wrap.style.gap = 'var(--space-md, 1rem)';

  const usdtCol = document.createElement('div');
  usdtCol.innerHTML = `
    <p class="dash-card-note" style="margin:0 0 0.4rem;">Pay ${formatMoney(amountDue)} in USDT (BEP20 / BNB Smart Chain):</p>
    <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;">
      <img src="usdt-bep20-qr.png" alt="USDT BEP20 address QR code" style="width:80px;height:80px;border-radius:6px;">
      <div>
        <code style="font-size:0.8rem;word-break:break-all;">${USDT_BEP20_ADDRESS}</code><br>
        <button type="button" class="btn btn-secondary btn-sm copy-usdt-address-btn" style="margin-top:0.3rem;">Copy address</button>
      </div>
    </div>
  `;
  wrap.appendChild(usdtCol);

  const acAmountDue = Math.round(amountDue * (1 - AC_TOKEN_DISCOUNT_PCT / 100) * 100) / 100;
  const acCol = document.createElement('div');
  acCol.innerHTML = `
    <p class="dash-card-note" style="margin:0 0 0.4rem;">Or pay ${formatMoney(acAmountDue)} in AC token (${AC_TOKEN_DISCOUNT_PCT}% off for paying in AC) — same wallet address as USDT:</p>
    <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;">
      <div>
        <code style="font-size:0.8rem;word-break:break-all;">${USDT_BEP20_ADDRESS}</code><br>
        <button type="button" class="btn btn-secondary btn-sm copy-ac-address-btn" style="margin-top:0.3rem;">Copy address</button>
      </div>
    </div>
    <p class="dash-card-note" style="margin:0.4rem 0 0;">AC token contract: <a href="https://bscscan.com/token/${AC_TOKEN_CONTRACT_ADDRESS}" target="_blank" rel="noopener"><code style="font-size:0.75rem;">${AC_TOKEN_CONTRACT_ADDRESS}</code></a>${AC_TOKEN_BUY_URL ? ` — <a href="${AC_TOKEN_BUY_URL}" target="_blank" rel="noopener">Buy AC token</a>` : ''}</p>
  `;
  wrap.appendChild(acCol);

  const noteEl = document.createElement('p');
  noteEl.className = 'dash-card-note';
  noteEl.style.cssText = 'margin:0.4rem 0 0;width:100%;';
  noteEl.innerHTML = `After sending, message us on <a href="https://t.me/agenticcore_support" target="_blank" rel="noopener">Telegram</a> with your request ID (<code>${requestId}</code>) and transaction hash so we can confirm it — both USDT and AC token payments are verified manually.`;
  wrap.appendChild(noteEl);

  wrap.querySelector('.copy-usdt-address-btn').addEventListener('click', (e) => {
    navigator.clipboard.writeText(USDT_BEP20_ADDRESS).then(() => {
      e.target.textContent = 'Copied!';
      setTimeout(() => { e.target.textContent = 'Copy address'; }, 1500);
    });
  });
  wrap.querySelector('.copy-ac-address-btn').addEventListener('click', (e) => {
    navigator.clipboard.writeText(USDT_BEP20_ADDRESS).then(() => {
      e.target.textContent = 'Copied!';
      setTimeout(() => { e.target.textContent = 'Copy address'; }, 1500);
    });
  });

  container.appendChild(wrap);
}

// Generic service->task->details->submit catalog wizard, shared by
// the New Request tab (full price) and the Packages tab's 50%-off add-on
// flow (same steps, discounted price + a note on the order).
function initCatalogWizard(cfg) {
  const el = (id) => document.getElementById(id);

  const state = { category: null, taskType: null };
  let currentStep = 1;

  const stepEls = document.querySelectorAll(cfg.stepsSelector);
  const indicatorEls = document.querySelectorAll(cfg.indicatorSelector);
  const backBtn = el(cfg.backBtnId);
  const nextBtn = el(cfg.nextBtnId);

  function priceFor(item) {
    return Math.round(item.price * cfg.priceMultiplier * 100) / 100;
  }

  function goToStep(n) {
    currentStep = n;
    stepEls.forEach((stepEl) => stepEl.classList.toggle('active', Number(stepEl.dataset.step) === n));
    indicatorEls.forEach((indEl) => indEl.classList.toggle('active', Number(indEl.dataset.step) === n));
    backBtn.style.display = (n > 1 || (n === 1 && cfg.onExitStep1)) ? 'inline-block' : 'none';
    backBtn.textContent = n === 1 ? '← Back to chat' : '← Back';
    nextBtn.style.display = n === 3 ? 'inline-block' : 'none';
    if (n === 4) renderSummary();
  }

  function renderServiceOptions() {
    const optsEl = el(cfg.serviceOptionsId);
    optsEl.innerHTML = '';
    PRICING_CATALOG.forEach((cat) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wizard-option-card';
      if (cat.category === state.category) btn.classList.add('selected');
      btn.innerHTML = `<span>${escapeHtml(cat.label || cat.category)}</span>`;
      btn.addEventListener('click', () => {
        state.category = cat.category;
        state.taskType = null;
        renderServiceOptions();
        renderTaskOptions();
        goToStep(2);
      });
      optsEl.appendChild(btn);
    });
  }

  function renderTaskOptions() {
    const optsEl = el(cfg.taskOptionsId);
    optsEl.innerHTML = '';
    const cat = getCatalogCategory(state.category);
    if (!cat) return;
    cat.items.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wizard-option-card';
      if (item.name === state.taskType) btn.classList.add('selected');
      btn.innerHTML = `<span>${escapeHtml(item.name)}</span><span class="wizard-option-price">${formatMoney(priceFor(item))}</span>`;
      btn.addEventListener('click', () => {
        state.taskType = item.name;
        renderTaskOptions();
        goToStep(3);
      });
      optsEl.appendChild(btn);
    });
  }

  function renderSummary() {
    const item = getCatalogItem(state.category, state.taskType);
    const price = item ? priceFor(item) : 0;
    const description = el(cfg.descriptionId).value.trim();
    const file = el(cfg.attachmentId).files[0];
    const summaryEl = el(cfg.summaryId);
    summaryEl.innerHTML = `
      <dt>Service</dt><dd>${escapeHtml(state.category)}</dd>
      <dt>Task</dt><dd>${escapeHtml(state.taskType)}</dd>
      <dt>Price</dt><dd>${formatMoney(price)}${cfg.discountNote ? ' <span style="color:var(--text-tertiary);font-size:0.8rem;">(50% off applied)</span>' : ''}</dd>
      <dt>Description</dt><dd>${escapeHtml(description) || '<em>None provided</em>'}</dd>
      ${file ? `<dt>Attachment</dt><dd>${escapeHtml(file.name)}</dd>` : ''}
    `;
  }

  backBtn.addEventListener('click', () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    } else if (cfg.onExitStep1) {
      cfg.onExitStep1();
    }
  });

  nextBtn.addEventListener('click', () => {
    const description = el(cfg.descriptionId).value.trim();
    const errorEl = el(cfg.errorId);
    if (!description) {
      errorEl.textContent = 'Please describe what you need before continuing.';
      errorEl.style.display = 'block';
      return;
    }
    errorEl.style.display = 'none';
    goToStep(4);
  });

  el(cfg.submitBtnId).addEventListener('click', async () => {
    const errorEl = el(cfg.errorId);
    const successEl = el(cfg.successId);
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    const item = getCatalogItem(state.category, state.taskType);
    let description = el(cfg.descriptionId).value.trim();
    const attachmentInput = el(cfg.attachmentId);
    const attachmentStatus = el(cfg.attachmentStatusId);
    const file = attachmentInput.files[0];

    if (cfg.discountNote) {
      description += `\n\n[${cfg.discountNote}]`;
    }

    const btn = el(cfg.submitBtnId);
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    let attachmentPath = null;
    if (file) {
      attachmentStatus.textContent = 'Uploading attachment…';
      const path = `${cfg.profile.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabaseClient.storage
        .from('request-attachments')
        .upload(path, file);

      if (uploadError) {
        btn.disabled = false;
        btn.textContent = originalLabel;
        attachmentStatus.textContent = '';
        errorEl.textContent = 'Attachment failed to upload: ' + uploadError.message;
        errorEl.style.display = 'block';
        return;
      }
      attachmentPath = path;
      attachmentStatus.textContent = '';
    }

    const agreedPrice = priceFor(item);

    const { data: insertedRequest, error } = await supabaseClient
      .from('requests')
      .insert({
        user_id: cfg.profile.id,
        service_category: state.category,
        task_type: state.taskType,
        tier: LEGACY_TIER_DB_VALUE,
        description,
        agreed_price: agreedPrice,
        status: 'awaiting_payment',
        attachment_path: attachmentPath
      })
      .select('id')
      .single();

    if (error) {
      btn.disabled = false;
      btn.textContent = originalLabel;
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
      return;
    }

    btn.disabled = false;
    btn.textContent = originalLabel;

    state.category = null;
    state.taskType = null;
    el(cfg.descriptionId).value = '';
    attachmentInput.value = '';
    renderServiceOptions();
    goToStep(1);

    successEl.textContent = cfg.successMessage;
    successEl.style.display = 'block';
    renderPaymentCTA(successEl, { requestId: insertedRequest.id, amountDue: upfrontAmountDue(agreedPrice) });
    if (cfg.onSuccess) cfg.onSuccess();
  });

  renderServiceOptions();
  goToStep(1);
}

// -------- Forge: New Request's dashboard chat assistant --------
// Same brain as the Telegram manager bot (forge-chat -> bot-core.ts's
// handleIncomingMessage on the 'forge' channel) -- a completed
// conversation files a manager_tasks row for the team, same as
// Telegram, rather than auto-filling this tab's own submit form.
function appendForgeMessage(container, role, text) {
  const el = document.createElement('div');
  el.className = `forge-chat-message forge-chat-message-${role}`;
  el.textContent = text;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}

function appendForgeTyping(container) {
  const el = document.createElement('div');
  el.className = 'forge-chat-typing';
  el.id = 'forgeChatTyping';
  el.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function removeForgeTyping() {
  const el = document.getElementById('forgeChatTyping');
  if (el) el.remove();
}

async function callForgeChat(action, message) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/forge-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify(action === 'history' ? { action: 'history' } : { action: 'message', message })
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${resp.status})`);
  }
  return resp.json();
}

function initForgeChat() {
  const messagesEl = document.getElementById('forgeChatMessages');
  const form = document.getElementById('forgeChatForm');
  const input = document.getElementById('forgeChatInput');

  let historyLoaded = false;
  let sending = false;

  async function loadHistory() {
    if (historyLoaded) return;
    historyLoaded = true;
    try {
      const { messages } = await callForgeChat('history');
      if (messages && messages.length) {
        messages.forEach((m) => appendForgeMessage(messagesEl, m.role, m.content));
      } else {
        appendForgeMessage(messagesEl, 'assistant', "👋 Welcome! I'm Forge — let's make a project. Tell me a bit about what you need and I'll help you scope it out.");
      }
    } catch (err) {
      console.error('Forge history load failed:', err);
      appendForgeMessage(messagesEl, 'assistant', "👋 Welcome! I'm Forge — let's make a project. Tell me a bit about what you need and I'll help you scope it out.");
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || sending) return;

    appendForgeMessage(messagesEl, 'user', text);
    input.value = '';
    sending = true;
    input.disabled = true;
    appendForgeTyping(messagesEl);

    try {
      const { reply } = await callForgeChat('message', text);
      removeForgeTyping();
      appendForgeMessage(messagesEl, 'assistant', reply);
    } catch (err) {
      console.error('Forge message failed:', err);
      removeForgeTyping();
      appendForgeMessage(messagesEl, 'assistant', 'Something went wrong on our end. Please try again in a moment.');
    } finally {
      sending = false;
      input.disabled = false;
      input.focus();
    }
  });

  loadHistory();
}

// Exposed on window so both the mode-toggle buttons and the wizard's own
// step-1 "back" button (which exits the wizard rather than stepping back
// through it) can switch modes the same way.
function setNewRequestMode(mode) {
  const forgeBtn = document.getElementById('forgeModeBtn');
  const wizardBtn = document.getElementById('wizardModeBtn');
  const forgeChat = document.getElementById('forgeChat');
  const wizard = document.getElementById('requestWizard');

  const toForge = mode === 'forge';
  forgeBtn.classList.toggle('active', toForge);
  wizardBtn.classList.toggle('active', !toForge);
  forgeChat.style.display = toForge ? 'flex' : 'none';
  wizard.style.display = toForge ? 'none' : 'block';
}
window.setNewRequestMode = setNewRequestMode;

function initNewRequestModeToggle() {
  document.getElementById('forgeModeBtn').addEventListener('click', () => setNewRequestMode('forge'));
  document.getElementById('wizardModeBtn').addEventListener('click', () => setNewRequestMode('wizard'));
}

function initNewRequestWizard(profile) {
  initCatalogWizard({
    profile,
    stepsSelector: '#requestWizard .wizard-step',
    indicatorSelector: '#wizardStepsIndicator li',
    serviceOptionsId: 'wizardServiceOptions',
    taskOptionsId: 'wizardTaskOptions',
    descriptionId: 'reqDescription',
    attachmentId: 'reqAttachment',
    attachmentStatusId: 'attachmentStatus',
    summaryId: 'wizardSummary',
    backBtnId: 'wizardBackBtn',
    nextBtnId: 'wizardNextBtn',
    submitBtnId: 'submitRequestBtn',
    errorId: 'requestError',
    successId: 'requestSuccess',
    priceMultiplier: 1,
    discountNote: null,
    successMessage: 'Request submitted — we\'ll follow up shortly. You can track it under My Projects.',
    onSuccess: () => renderProjectsPanel(profile.id),
    onExitStep1: () => setNewRequestMode('forge')
  });
}

// -------- AgenticCore Packages tab --------
function initPackagesTab(profile) {
  const state = { selected: false };
  let currentStep = 1;

  const stepEls = document.querySelectorAll('#packageWizard .wizard-step');
  const indicatorEls = document.querySelectorAll('#packageStepsIndicator li');
  const backBtn = document.getElementById('packageBackBtn');
  const nextBtn = document.getElementById('packageNextBtn');

  function goToStep(n) {
    currentStep = n;
    stepEls.forEach((el) => el.classList.toggle('active', Number(el.dataset.step) === n));
    indicatorEls.forEach((el) => el.classList.toggle('active', Number(el.dataset.step) === n));
    backBtn.style.display = n > 1 ? 'inline-block' : 'none';
    nextBtn.style.display = n === 2 ? 'inline-block' : 'none';
    if (n === 3) renderSummary();
  }

  function renderPackageOptions() {
    const optsEl = document.getElementById('packageOptions');
    optsEl.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wizard-option-card';
    if (state.selected) btn.classList.add('selected');
    btn.innerHTML = `<span>${escapeHtml(AGENTICCORE_PACKAGE.label)}</span><span class="wizard-option-price">${formatMoney(AGENTICCORE_PACKAGE.price)}</span>`;
    btn.addEventListener('click', () => {
      state.selected = true;
      renderPackageOptions();
      goToStep(2);
    });
    optsEl.appendChild(btn);
  }

  function renderSummary() {
    const description = document.getElementById('pkgDescription').value.trim();
    const file = document.getElementById('pkgAttachment').files[0];
    document.getElementById('packageSummary').innerHTML = `
      <dt>Package</dt><dd>${escapeHtml(AGENTICCORE_PACKAGE.label)}</dd>
      <dt>Price</dt><dd>${formatMoney(AGENTICCORE_PACKAGE.price)}</dd>
      <dt>Description</dt><dd>${escapeHtml(description) || '<em>None provided</em>'}</dd>
      ${file ? `<dt>Attachment</dt><dd>${escapeHtml(file.name)}</dd>` : ''}
    `;
  }

  backBtn.addEventListener('click', () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  });

  nextBtn.addEventListener('click', () => goToStep(3));

  document.getElementById('submitPackageBtn').addEventListener('click', async () => {
    const errorEl = document.getElementById('packageError');
    const successEl = document.getElementById('packageSuccess');
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    const description = document.getElementById('pkgDescription').value.trim();
    const attachmentInput = document.getElementById('pkgAttachment');
    const attachmentStatus = document.getElementById('pkgAttachmentStatus');
    const file = attachmentInput.files[0];

    const btn = document.getElementById('submitPackageBtn');
    const originalLabel = btn.textContent;
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
        btn.textContent = originalLabel;
        attachmentStatus.textContent = '';
        errorEl.textContent = 'Attachment failed to upload: ' + uploadError.message;
        errorEl.style.display = 'block';
        return;
      }
      attachmentPath = path;
      attachmentStatus.textContent = '';
    }

    const { data: insertedRequest, error } = await supabaseClient
      .from('requests')
      .insert({
        user_id: profile.id,
        service_category: 'AgenticCore Package',
        tier: LEGACY_TIER_DB_VALUE,
        description: `${AGENTICCORE_PACKAGE.label} package order — priority handling, no additional scoping needed.${description ? ' ' + description : ''}`,
        agreed_price: AGENTICCORE_PACKAGE.price,
        status: 'awaiting_payment',
        attachment_path: attachmentPath
      })
      .select('id')
      .single();

    if (error) {
      btn.disabled = false;
      btn.textContent = originalLabel;
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
      return;
    }

    btn.disabled = false;
    btn.textContent = originalLabel;

    state.selected = false;
    document.getElementById('pkgDescription').value = '';
    attachmentInput.value = '';
    renderPackageOptions();
    goToStep(1);

    successEl.textContent = 'Package order submitted — you can now add extra services at 50% off below, and track your order under My Projects.';
    successEl.style.display = 'block';
    renderPaymentCTA(successEl, { requestId: insertedRequest.id, amountDue: upfrontAmountDue(AGENTICCORE_PACKAGE.price) });
    unlockAddonSection(profile);
    renderProjectsPanel(profile.id);
  });

  renderPackageOptions();
  goToStep(1);
}

let addonInitialized = false;
function unlockAddonSection(profile) {
  document.getElementById('addonSection').style.display = 'block';
  document.getElementById('addonLockedNote').style.display = 'none';
  if (addonInitialized) return;
  addonInitialized = true;
  initCatalogWizard({
    profile,
    stepsSelector: '#addonWizard .wizard-step',
    indicatorSelector: '#addonStepsIndicator li',
    serviceOptionsId: 'addonServiceOptions',
    taskOptionsId: 'addonTaskOptions',
    descriptionId: 'addonDescription',
    attachmentId: 'addonAttachment',
    attachmentStatusId: 'addonAttachmentStatus',
    summaryId: 'addonSummary',
    backBtnId: 'addonBackBtn',
    nextBtnId: 'addonNextBtn',
    submitBtnId: 'submitAddonBtn',
    errorId: 'addonError',
    successId: 'addonSuccess',
    priceMultiplier: 0.5,
    discountNote: 'Active AgenticCore Package client — 50% off applied',
    successMessage: 'Add-on request submitted at 50% off — you can track it under My Projects.',
    onSuccess: () => renderProjectsPanel(profile.id)
  });
}

async function initPackagesPanel(profile) {
  initPackagesTab(profile);

  const { data: pastPackages } = await supabaseClient
    .from('requests')
    .select('id')
    .eq('user_id', profile.id)
    .eq('service_category', 'AgenticCore Package');

  if (pastPackages && pastPackages.length) {
    unlockAddonSection(profile);
  }
}

// -------- Forge FAB: jump to New Request > Chat with Forge from any tab,
// and back again -- toggles like the marketing chat widget's bubble/X. --------
function initForgeFab() {
  const fab = document.getElementById('forgeFab');
  if (!fab) return;
  const chatIcon = document.getElementById('forgeFabIconChat');
  const closeIcon = document.getElementById('forgeFabIconClose');
  const label = document.getElementById('forgeFabLabel');

  let isOpen = false;
  let previousTab = 'projects';

  function setOpen(open) {
    isOpen = open;
    chatIcon.hidden = open;
    closeIcon.hidden = !open;
    label.textContent = open ? 'Close' : 'Chat with Forge';
    fab.setAttribute('aria-label', open ? 'Close Forge chat' : 'Chat with Forge');
  }

  fab.addEventListener('click', () => {
    if (isOpen) {
      switchTab(previousTab);
      setOpen(false);
      return;
    }
    previousTab = document.querySelector('.dash-tab.active')?.dataset.tab || 'projects';
    switchTab('new-request');
    setNewRequestMode('forge');
    document.getElementById('forgeChat').scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('forgeChatInput').focus();
    setOpen(true);
  });

  // Manually switching tabs away from New Request counts as closing it too,
  // so the FAB doesn't show "Close" and jump somewhere stale on next click.
  document.querySelectorAll('.dash-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (isOpen && tab.dataset.tab !== 'new-request') setOpen(false);
    });
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
  renderBusinessPoolSection(profile);
  initTabs();
  initNewRequestModeToggle();
  initForgeChat();
  initForgeFab();
  initNewRequestWizard(profile);
  initPackagesPanel(profile);
  renderProjectsPanel(userId);
  renderBillingPanel(userId);

  document.getElementById('newProjectBtn').addEventListener('click', () => {
    switchTab('new-request');
    setNewRequestMode('forge');
  });

  document.getElementById('quickForgeBtn').addEventListener('click', () => {
    switchTab('new-request');
    setNewRequestMode('forge');
    document.getElementById('forgeChatInput').focus();
  });

  document.getElementById('logoutBtn').addEventListener('click', logOut);
})();
