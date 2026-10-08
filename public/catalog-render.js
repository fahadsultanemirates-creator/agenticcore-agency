// AgenticCore Agency — renders public-facing price info straight from
// pricing-catalog.js (single source of truth), so services.html and the
// landing page can never drift out of sync with what the dashboard charges.

function formatMoney(amount) {
  return '$' + Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// A "from" price should point at a real, standalone deliverable, not a
// monthly add-on or a setup-only line, so it never reads as misleading.
function catalogFromPrice(items) {
  const standalone = items.filter((i) => !/\(monthly\)/i.test(i.name) && !/setup \(one-time\)/i.test(i.name));
  const pool = standalone.length ? standalone : items;
  return Math.min(...pool.map((i) => i.price));
}

function renderCatalogExpandable(container, category) {
  const cat = getCatalogCategory(category);
  if (!cat || !container) return;
  const from = catalogFromPrice(cat.items);
  const listId = container.id + '-list';
  container.innerHTML =
    '<p class="catalog-from">From ' + formatMoney(from) + '</p>' +
    '<button type="button" class="catalog-toggle" aria-expanded="false" aria-controls="' + listId + '">See all ' + cat.items.length + ' services in this category →</button>' +
    '<ul class="catalog-item-list" id="' + listId + '" hidden>' +
    cat.items.map((i) => '<li><span>' + escapeHtml(i.name) + '</span><span class="catalog-item-price">' + formatMoney(i.price) + '</span></li>').join('') +
    '</ul>';
  const toggle = container.querySelector('.catalog-toggle');
  const list = container.querySelector('.catalog-item-list');
  toggle.addEventListener('click', function () {
    const open = list.hidden;
    list.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Show fewer ↑' : 'See all ' + cat.items.length + ' services in this category →';
  });
}

function renderAllCatalogExpandables() {
  document.querySelectorAll('[data-catalog-category]').forEach((el) => {
    renderCatalogExpandable(el, el.getAttribute('data-catalog-category'));
  });
}

// Lightweight "from $X" line for compact cards (the landing page bento),
// as opposed to the full expandable list used on services.html.
function renderAllCatalogFromPrices() {
  document.querySelectorAll('[data-catalog-from-price]').forEach((el) => {
    const cat = getCatalogCategory(el.getAttribute('data-catalog-from-price'));
    if (cat) el.textContent = 'From ' + formatMoney(catalogFromPrice(cat.items));
  });
}

document.addEventListener('DOMContentLoaded', function () {
  renderAllCatalogExpandables();
  renderAllCatalogFromPrices();
});
