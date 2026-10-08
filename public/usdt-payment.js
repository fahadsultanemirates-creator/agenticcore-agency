// Paying for a job in USDT, for real this time.
//
// What was here before was not a payment system: the page printed one
// wallet address and the plain deposit figure, then asked the client to
// message Telegram with their transaction hash so somebody could match it
// up by hand. Same address and same amount for every client is exactly why
// that had to be manual -- there was nothing in the payment to say who
// sent it.
//
// Now the server opens an invoice and quotes an amount whose last four
// decimal places carry a nonce: 300.000007 identifies one invoice and
// nothing else. So THE EXACT AMOUNT is the thing that matters, more than
// the address, which is why it is the biggest thing in the panel and has
// its own copy button. Rounding it is the one mistake the chain watcher
// cannot recover from, and the panel says so where somebody will read it.
//
// This file is the only copy. renderPaymentCTA lived twice, in
// dashboard.js and request.js, and the two had already drifted -- one
// linked to the projects page, the other had a buy-token link the first
// did not. A payment screen is the last place to keep two of something.

const USDT_BEP20_ADDRESS = '0x62Ad7D55fbc8A8591109D72b67Ec63aa1EE196bC';
const AC_TOKEN_CONTRACT_ADDRESS = '0xe9568888a0bc317519957047cf736e134B097768';
const AC_TOKEN_DISCOUNT_PCT = 15;
const AC_TOKEN_BUY_URL = null;
const SUPPORT_TELEGRAM_URL = 'https://t.me/agenticcore_support';

// Five seconds, like .click. The selling point of watching the chain
// ourselves is that confirmation takes under a minute; a lazy poll would
// throw that away at the only moment the client is actually watching.
const POLL_INTERVAL_MS = 5000;

function usdtMoney(amount) {
  return '$' + Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function usdtEscape(str) {
  const div = document.createElement('div');
  div.textContent = String(str == null ? '' : str);
  return div.innerHTML;
}

// One stylesheet, injected once, so this file can be dropped into any page
// that already has the design tokens without touching its <head>.
function ensurePaymentStyles() {
  if (document.getElementById('usdtPaymentStyles')) return;
  const style = document.createElement('style');
  style.id = 'usdtPaymentStyles';
  style.textContent = `
    .usdt-pay { margin-top: var(--space-sm); display: flex; flex-direction: column; gap: var(--space-sm); }
    .usdt-pay-amount {
      border: 2px solid var(--accent-cyan); border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--accent-cyan) 7%, transparent);
      padding: var(--space-sm);
    }
    .usdt-pay-label {
      margin: 0; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.06em;
      text-transform: uppercase; color: var(--text-secondary);
    }
    .usdt-pay-figure {
      display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-top: 0.35rem;
    }
    .usdt-pay-figure strong {
      font-family: var(--font-display); font-size: 1.9rem; font-weight: 600;
      color: var(--text-primary); font-variant-numeric: tabular-nums; line-height: 1.1;
    }
    .usdt-pay-figure .usdt-pay-unit { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); }
    .usdt-pay-copy { margin-left: auto; }
    .usdt-pay-address { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.35rem; }
    .usdt-pay-address code {
      flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere;
      background: var(--bg-primary); border-radius: var(--radius-sm);
      padding: 0.5rem 0.65rem; font-family: var(--font-mono); font-size: 0.8rem;
      color: var(--text-primary);
    }
    .usdt-pay-warn {
      display: flex; gap: 0.5rem; align-items: flex-start;
      border: 1px solid #c2410c66; border-radius: var(--radius-md);
      background: #c2410c14; padding: 0.6rem 0.7rem;
      font-size: 0.78rem; color: var(--text-secondary); margin: 0;
    }
    .usdt-pay-status { margin: 0; font-size: 0.85rem; color: var(--text-secondary); }
    .usdt-pay-status[data-state="paid"] { color: var(--accent-cyan); font-weight: 600; }
    .usdt-pay-status[data-state="problem"] { color: #fbbf24; }
    .usdt-pay-manual {
      border-top: 1px solid var(--border-subtle); padding-top: var(--space-sm);
      display: flex; flex-direction: column; gap: 0.4rem;
    }
    .usdt-pay-row { display: flex; gap: var(--space-sm); flex-wrap: wrap; align-items: flex-start; }
  `;
  document.head.appendChild(style);
}

function copyButton(label, getText) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-secondary btn-sm';
  btn.textContent = label;
  btn.addEventListener('click', () => {
    const text = getText();
    const done = () => {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = label; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      // Some in-app browsers refuse the clipboard outright. Both the
      // amount and the address are selectable text on the page, so a
      // refusal costs the shortcut, not the payment.
      navigator.clipboard.writeText(text).then(done, () => { btn.textContent = 'Copy failed'; });
    } else {
      btn.textContent = 'Copy failed';
    }
  });
  return btn;
}

/**
 * The AC token option, which stays manual -- honestly.
 *
 * The chain watcher matches transfers of the USDT contract and nothing
 * else, so an AC token payment genuinely does need a human to look at it.
 * Saying "verified manually" about the USDT path too, now that it is
 * automatic, would be the sort of stale sentence nobody notices is a lie.
 */
function renderAcTokenOption(container, { requestId, amountDue }) {
  const acAmountDue = Math.round(amountDue * (1 - AC_TOKEN_DISCOUNT_PCT / 100) * 100) / 100;
  const block = document.createElement('div');
  block.className = 'usdt-pay-manual';
  block.innerHTML = `
    <p class="usdt-pay-label">Or pay in AC token — ${AC_TOKEN_DISCOUNT_PCT}% off</p>
    <p class="dash-card-note" style="margin:0;">
      ${usdtEscape(usdtMoney(acAmountDue))} of AC token, to the same address.
      AC payments are still checked by hand: send it, then message us on
      <a href="${SUPPORT_TELEGRAM_URL}" target="_blank" rel="noopener">Telegram</a>
      with request <code>${usdtEscape(requestId)}</code> and your transaction hash.
    </p>
    <div class="usdt-pay-address">
      <code>${USDT_BEP20_ADDRESS}</code>
    </div>
    <p class="dash-card-note" style="margin:0;">
      AC token contract:
      <a href="https://bscscan.com/token/${AC_TOKEN_CONTRACT_ADDRESS}" target="_blank" rel="noopener"><code style="font-size:0.75rem;">${AC_TOKEN_CONTRACT_ADDRESS}</code></a>${AC_TOKEN_BUY_URL ? ` — <a href="${AC_TOKEN_BUY_URL}" target="_blank" rel="noopener">Buy AC token</a>` : ''}
    </p>
  `;
  block.querySelector('.usdt-pay-address').appendChild(copyButton('Copy address', () => USDT_BEP20_ADDRESS));
  container.appendChild(block);
}

/**
 * What the page shows if no invoice could be opened.
 *
 * The chain watcher needs an explorer API key and a reachable explorer. If
 * either is missing, a client who has just agreed to a price must still
 * have a way to pay -- so this is the old manual block, kept deliberately
 * rather than left as the happy path.
 */
function renderManualFallback(container, { requestId, amountDue, reason }) {
  const block = document.createElement('div');
  block.className = 'usdt-pay-manual';
  block.innerHTML = `
    <p class="usdt-pay-label">Pay ${usdtEscape(usdtMoney(amountDue))} in USDT — BEP-20 / BNB Smart Chain</p>
    <div class="usdt-pay-row" style="align-items:center;">
      <img src="usdt-bep20-qr.png" alt="QR code for the USDT BEP-20 receiving address" style="width:80px;height:80px;border-radius:6px;">
      <div style="flex:1 1 14rem;min-width:0;">
        <div class="usdt-pay-address"><code>${USDT_BEP20_ADDRESS}</code></div>
      </div>
    </div>
    <p class="dash-card-note" style="margin:0;">
      Automatic confirmation isn't available right now${reason ? ` (${usdtEscape(reason)})` : ''}, so this
      one is checked by hand. Send the amount, then message us on
      <a href="${SUPPORT_TELEGRAM_URL}" target="_blank" rel="noopener">Telegram</a>
      with request <code>${usdtEscape(requestId)}</code> and your transaction hash.
    </p>
  `;
  block.querySelector('.usdt-pay-address').appendChild(copyButton('Copy address', () => USDT_BEP20_ADDRESS));
  container.appendChild(block);
}

/** The invoice panel: an exact amount, an address, and a live status. */
function renderInvoicePanel(container, invoice, statusEl) {
  const panel = document.createElement('div');
  panel.className = 'usdt-pay';

  // The amount first and biggest. The address is shared by every invoice;
  // the amount is the only thing that says which one this is.
  const amountBox = document.createElement('div');
  amountBox.className = 'usdt-pay-amount';
  amountBox.innerHTML = `
    <p class="usdt-pay-label">Send exactly this amount</p>
    <div class="usdt-pay-figure">
      <strong>${usdtEscape(invoice.amount)}</strong>
      <span class="usdt-pay-unit">USDT</span>
    </div>
    <p class="dash-card-note" style="margin:0.4rem 0 0;">
      The last digits identify your payment. Rounding the amount means we
      can't match it to your request.
    </p>
  `;
  const amountCopy = copyButton('Copy amount', () => invoice.amount);
  amountCopy.classList.add('usdt-pay-copy');
  amountBox.querySelector('.usdt-pay-figure').appendChild(amountCopy);
  panel.appendChild(amountBox);

  const addressBox = document.createElement('div');
  addressBox.innerHTML = `
    <p class="usdt-pay-label">To this address — ${usdtEscape(invoice.network)}</p>
    <div class="usdt-pay-row" style="align-items:center;">
      <img src="usdt-bep20-qr.png" alt="QR code for the USDT BEP-20 receiving address" style="width:72px;height:72px;border-radius:6px;">
      <div style="flex:1 1 14rem;min-width:0;">
        <div class="usdt-pay-address"><code>${usdtEscape(invoice.address)}</code></div>
        <p class="dash-card-note" style="margin:0.3rem 0 0;">
          The QR holds the address only — it can't carry the amount, so type
          or paste that yourself.
        </p>
      </div>
    </div>
  `;
  addressBox.querySelector('.usdt-pay-address').appendChild(copyButton('Copy address', () => invoice.address));
  panel.appendChild(addressBox);

  const warn = document.createElement('p');
  warn.className = 'usdt-pay-warn';
  warn.innerHTML = `
    <span aria-hidden="true">⚠</span>
    <span>Only send USDT on BNB Smart Chain to this address. Another coin,
    or USDT on another network, cannot be recovered.</span>
  `;
  panel.appendChild(warn);

  panel.appendChild(statusEl);

  const closeable = document.createElement('p');
  closeable.className = 'dash-card-note';
  closeable.style.margin = '0';
  closeable.textContent = 'You can close this page. Your request is confirmed as soon as the payment confirms, either way.';
  panel.appendChild(closeable);

  container.appendChild(panel);
  return panel;
}

async function accessToken() {
  const { data } = await supabaseClient.auth.getSession();
  return (data && data.session && data.session.access_token) || null;
}

/**
 * Polls one invoice until it settles.
 *
 * The cron sweep confirms the request anyway if the tab is closed; this
 * exists so somebody watching the screen sees it happen rather than
 * reloading and wondering.
 */
function pollInvoice(invoice, statusEl, onPaid) {
  let timer = null;
  let stopped = false;

  const set = (state, text) => {
    statusEl.dataset.state = state;
    statusEl.textContent = text;
  };

  async function tick() {
    if (stopped) return;
    const token = await accessToken();
    if (!token) return set('problem', 'Your session expired — reload the page to keep watching for the payment.');

    let data = null;
    try {
      const response = await supabaseClient.functions.invoke('usdt-check', {
        body: { invoiceId: invoice.invoiceId },
        headers: { Authorization: 'Bearer ' + token }
      });
      data = response.data;
    } catch (err) {
      console.error('usdt-check threw:', err);
      // A failed poll is not a failed payment, and saying so would send a
      // client who has already paid to support. Keep waiting.
    }

    if (data && data.status === 'paid') {
      stopped = true;
      set('paid', 'Payment confirmed — your request is in. We will be in touch shortly.');
      if (onPaid) onPaid();
      return;
    }
    if (data && data.status === 'wrong_amount') {
      set('problem',
        (data.received || 'A different amount') + ' USDT arrived, but this invoice is for ' +
        invoice.amount + '. It has not been confirmed automatically — we have been notified and will sort it out.');
    } else if (data && data.status === 'confirming') {
      const n = typeof data.confirmations === 'number' ? data.confirmations : 0;
      set('waiting', 'Payment seen — ' + n + ' confirmations, confirming shortly…');
    } else if (data && (data.status === 'expired' || data.status === 'cancelled')) {
      stopped = true;
      return set('problem', 'That invoice expired. Reload the page to get a fresh amount.');
    }

    timer = setTimeout(tick, POLL_INTERVAL_MS);
  }

  timer = setTimeout(tick, POLL_INTERVAL_MS);

  // Stops the poll when the page goes away, so a closed tab does not keep
  // a timer and a token alive.
  window.addEventListener('pagehide', () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  });
}

/**
 * Renders the payment step for a request that has just been placed.
 *
 * `amountDue` is only what the page expects while the invoice opens -- the
 * server recomputes the deposit from the request's own agreed_price and
 * its figure is the one that gets quoted. A client who could name their own
 * amount could pay $1 for a $1,000 build and have the watcher confirm it.
 */
function renderPaymentCTA(container, { requestId, amountDue, projectsLink = false }) {
  ensurePaymentStyles();

  const wrap = document.createElement('div');
  wrap.className = 'usdt-pay';
  container.appendChild(wrap);

  const opening = document.createElement('p');
  opening.className = 'usdt-pay-status';
  opening.dataset.state = 'waiting';
  opening.textContent = 'Opening your payment details for ' + usdtMoney(amountDue) + '…';
  wrap.appendChild(opening);

  const finish = (invoice, failure) => {
    opening.remove();

    if (invoice) {
      const statusEl = document.createElement('p');
      statusEl.className = 'usdt-pay-status';
      statusEl.dataset.state = 'waiting';
      statusEl.textContent = 'Waiting for your payment…';

      const deposit = document.createElement('p');
      deposit.className = 'dash-card-note';
      deposit.style.margin = '0';
      deposit.textContent =
        usdtMoney(invoice.baseUsd) + ' due now to start — ' +
        Math.round((invoice.upfrontFraction || 0.3) * 100) + '% of ' + usdtMoney(invoice.agreedPrice) +
        '. The rest is billed on delivery.';
      wrap.appendChild(deposit);

      renderInvoicePanel(wrap, invoice, statusEl);
      pollInvoice(invoice, statusEl, () => {
        if (typeof window.onUsdtPaymentConfirmed === 'function') window.onUsdtPaymentConfirmed(requestId);
      });
    } else {
      renderManualFallback(wrap, { requestId, amountDue, reason: failure });
    }

    renderAcTokenOption(wrap, { requestId, amountDue: invoice ? invoice.baseUsd : amountDue });

    if (projectsLink) {
      const track = document.createElement('p');
      track.className = 'dash-card-note';
      track.style.margin = '0';
      track.innerHTML = 'Track it on <a href="projects.html">your projects page</a>.';
      wrap.appendChild(track);
    }
  };

  (async () => {
    const token = await accessToken();
    if (!token) return finish(null, 'you are not signed in');

    try {
      const { data, error } = await supabaseClient.functions.invoke('usdt-invoice', {
        body: { requestId },
        headers: { Authorization: 'Bearer ' + token }
      });

      if (data && data.amount) return finish(data);

      // The function's own message where there is one -- "this request has
      // no agreed price yet" is worth reading, and burying it behind a
      // generic failure is what makes a payment page unsupportable.
      const reason = (data && data.error) || (error && error.message) || null;
      console.error('usdt-invoice did not return an invoice:', reason, data);
      finish(null, reason);
    } catch (err) {
      console.error('usdt-invoice threw:', err);
      finish(null, 'the payment service could not be reached');
    }
  })();
}
