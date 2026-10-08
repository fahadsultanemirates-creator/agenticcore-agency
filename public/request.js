// AgenticCore Agency — New request wizard (full price). Reached from the
// dashboard's services grid or sidebar with ?service=<category>, which
// preselects that category and jumps straight to the task step.

function formatMoney(amount) {
  return '$' + Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const UPFRONT_FRACTION = 0.3;
const USDT_BEP20_ADDRESS = '0x62Ad7D55fbc8A8591109D72b67Ec63aa1EE196bC';
const AC_TOKEN_CONTRACT_ADDRESS = '0xe9568888a0bc317519957047cf736e134B097768';
const AC_TOKEN_DISCOUNT_PCT = 15;

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
    <p class="dash-card-note" style="margin:0.4rem 0 0;">AC token contract: <a href="https://bscscan.com/token/${AC_TOKEN_CONTRACT_ADDRESS}" target="_blank" rel="noopener"><code style="font-size:0.75rem;">${AC_TOKEN_CONTRACT_ADDRESS}</code></a></p>
  `;
  wrap.appendChild(acCol);

  const noteEl = document.createElement('p');
  noteEl.className = 'dash-card-note';
  noteEl.style.cssText = 'margin:0.4rem 0 0;width:100%;';
  noteEl.innerHTML = `After sending, message us on <a href="https://t.me/agenticcore_support" target="_blank" rel="noopener">Telegram</a> with your request ID (<code>${requestId}</code>) and transaction hash so we can confirm it — both USDT and AC token payments are verified manually. Track it on <a href="projects.html">your projects page</a>.`;
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

function initRequestWizard(profile) {
  const el = (id) => document.getElementById(id);
  const preselected = new URLSearchParams(window.location.search).get('service');

  const state = { category: null, taskType: null };
  let currentStep = 1;

  const stepEls = document.querySelectorAll('#requestWizard .wizard-step');
  const indicatorEls = document.querySelectorAll('#wizardStepsIndicator li');
  const backBtn = el('wizardBackBtn');
  const nextBtn = el('wizardNextBtn');

  function goToStep(n) {
    currentStep = n;
    stepEls.forEach((stepEl) => stepEl.classList.toggle('active', Number(stepEl.dataset.step) === n));
    indicatorEls.forEach((indEl) => indEl.classList.toggle('active', Number(indEl.dataset.step) === n));
    backBtn.style.display = n > 1 ? 'inline-block' : 'none';
    nextBtn.style.display = n === 3 ? 'inline-block' : 'none';
    if (n === 4) renderSummary();
  }

  function renderServiceOptions() {
    const optsEl = el('wizardServiceOptions');
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
    const optsEl = el('wizardTaskOptions');
    optsEl.innerHTML = '';
    const cat = getCatalogCategory(state.category);
    if (!cat) return;
    document.getElementById('requestPageTitle').textContent = `New request — ${cat.label || cat.category}`;
    cat.items.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wizard-option-card';
      if (item.name === state.taskType) btn.classList.add('selected');
      btn.innerHTML = `<span>${escapeHtml(item.name)}</span><span class="wizard-option-price">${formatMoney(item.price)}</span>`;
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
    const price = item ? item.price : 0;
    const description = el('reqDescription').value.trim();
    const file = el('reqAttachment').files[0];
    el('wizardSummary').innerHTML = `
      <dt>Service</dt><dd>${escapeHtml(state.category)}</dd>
      <dt>Task</dt><dd>${escapeHtml(state.taskType)}</dd>
      <dt>Price</dt><dd>${formatMoney(price)}</dd>
      <dt>Description</dt><dd>${escapeHtml(description) || '<em>None provided</em>'}</dd>
      ${file ? `<dt>Attachment</dt><dd>${escapeHtml(file.name)}</dd>` : ''}
    `;
  }

  backBtn.addEventListener('click', () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  });

  nextBtn.addEventListener('click', () => {
    const description = el('reqDescription').value.trim();
    const errorEl = el('requestError');
    if (!description) {
      errorEl.textContent = 'Please describe what you need before continuing.';
      errorEl.style.display = 'block';
      return;
    }
    errorEl.style.display = 'none';
    goToStep(4);
  });

  el('submitRequestBtn').addEventListener('click', async () => {
    const errorEl = el('requestError');
    const successEl = el('requestSuccess');
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    const item = getCatalogItem(state.category, state.taskType);
    const description = el('reqDescription').value.trim();
    const attachmentInput = el('reqAttachment');
    const attachmentStatus = el('attachmentStatus');
    const file = attachmentInput.files[0];

    const btn = el('submitRequestBtn');
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
        service_category: state.category,
        task_type: state.taskType,
        tier: LEGACY_TIER_DB_VALUE,
        description,
        agreed_price: item.price,
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

    successEl.innerHTML = '';
    const successMsg = document.createElement('p');
    successMsg.textContent = "Request submitted — we'll follow up shortly. You can track it under Projects.";
    successEl.appendChild(successMsg);
    successEl.style.display = 'block';
    renderPaymentCTA(successEl, { requestId: insertedRequest.id, amountDue: upfrontAmountDue(item.price) });
  });

  renderServiceOptions();

  if (preselected && getCatalogCategory(preselected)) {
    state.category = preselected;
    renderServiceOptions();
    renderTaskOptions();
    goToStep(2);
  } else {
    goToStep(1);
  }
}

// -------- Init --------
(async () => {
  const profile = await loadDashProfile();
  if (!profile) return;

  renderDashSidebar(null);
  renderDashTopbar('Dashboard', 'New request');
  initRequestWizard(profile);
})();
