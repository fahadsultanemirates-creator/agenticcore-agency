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

// 30% due upfront, the split services.html and terms.html promise
// visitors. The server computes the same figure from the request's own
// agreed_price -- see supabase/functions/_shared/pricing.ts -- and its
// figure is the one quoted. This copy only decides what the page says
// while the invoice opens.
const UPFRONT_FRACTION = 0.3;

function upfrontAmountDue(agreedPrice) {
  return Math.round(agreedPrice * UPFRONT_FRACTION * 100) / 100;
}

// renderPaymentCTA lives in usdt-payment.js, loaded before this file. It
// used to live here AND in dashboard.js, and the two copies had already
// drifted apart.

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
    renderPaymentCTA(successEl, { requestId: insertedRequest.id, amountDue: upfrontAmountDue(item.price), projectsLink: true });
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
