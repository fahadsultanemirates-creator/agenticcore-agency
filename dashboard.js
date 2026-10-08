// AgenticCore Agency — Dashboard home: welcome header, quick actions,
// Business Pool, the services grid (New request), Packages, and Billing.
// Projects lives on projects.html, the structured per-service request
// wizard on request.html, and Forge chat on forge.html -- all reached via
// the shared sidebar (dashboard-common.js), not tabs.

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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// -------- Header --------
function renderHeader(profile) {
  document.getElementById('welcomeHeading').textContent = profile.full_name
    ? `Welcome back, ${profile.full_name.split(' ')[0]}`
    : 'Welcome back';
}

// -------- Services grid --------
function renderServicesGrid() {
  const grid = document.getElementById('dashServicesGrid');
  grid.innerHTML = DASH_SERVICE_NAV.map((s) => {
    const cat = getCatalogCategory(s.category);
    const from = cat ? Math.min(...cat.items.map((i) => i.price)) : null;
    return `
      <a href="request.html?service=${encodeURIComponent(s.category)}" class="dash-service-card">
        <span class="dash-service-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${s.icon}</svg>
        </span>
        <div>
          <h3>${escapeHtml(cat ? cat.label || cat.category : s.category)}</h3>
          ${from !== null ? `<p>From $${from}</p>` : ''}
        </div>
      </a>
    `;
  }).join('');
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

// -------- Checkout --------
// 30% due upfront, same split shown to visitors on services.html/terms.html.
const UPFRONT_FRACTION = 0.3;

const USDT_BEP20_ADDRESS = '0x62Ad7D55fbc8A8591109D72b67Ec63aa1EE196bC';
const AC_TOKEN_CONTRACT_ADDRESS = '0xe9568888a0bc317519957047cf736e134B097768';
const AC_TOKEN_DISCOUNT_PCT = 15;
const AC_TOKEN_BUY_URL = null;

function upfrontAmountDue(agreedPrice) {
  return Math.round(agreedPrice * UPFRONT_FRACTION * 100) / 100;
}

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

// -------- AgenticCore Packages --------
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

    successEl.textContent = 'Package order submitted — you can now add extra services at 50% off below, and track your order under Projects.';
    successEl.style.display = 'block';
    renderPaymentCTA(successEl, { requestId: insertedRequest.id, amountDue: upfrontAmountDue(AGENTICCORE_PACKAGE.price) });
    unlockAddonSection(profile);
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
    successMessage: 'Add-on request submitted at 50% off — you can track it under Projects.'
  });
}

// Shared service->task->details->submit wizard, used here only by the
// Packages tab's 50%-off add-on flow (the full-price version lives on
// request.html now).
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
    backBtn.style.display = n > 1 ? 'inline-block' : 'none';
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
    if (currentStep > 1) goToStep(currentStep - 1);
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

// -------- Init --------
(async () => {
  const profile = await loadDashProfile();
  if (!profile) return;

  renderDashSidebar('home');
  renderDashTopbar('Dashboard', 'Welcome back');
  renderHeader(profile);
  renderServicesGrid();
  renderBusinessPoolSection(profile);
  initPackagesPanel(profile);
  renderBillingPanel(profile.id);
})();
