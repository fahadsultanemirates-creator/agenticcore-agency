// AgenticCore Agency — Packages page: "Select & Pay" button for the
// single AgenticCore Package (the former Low/Mid/High package tiers
// collapsed into one). Wired the same way dashboard.js's New Request
// form submits (an insert into requests), but flagged as a Package
// order via service_category so staff can flag it for priority
// handling with no scoping questions -- the deliverables and price are
// already fixed.

const PACKAGE_DELIVERABLES = 'Single landing page website, 5 social media posts, 3 branded documents (client choice of business card, receipt, letterhead, or similar), a 10-page business brochure PDF, and an all-in-one strategy report PDF (feasibility snapshot, marketing roadmap, competitive landscape).';

// requests.tier is a real, not-null DB column from before the tier
// system existed (check constraint: 'low' | 'mid' | 'top'). Nothing
// here lets a client choose a tier anymore -- 'low' is written on every
// insert purely to satisfy that constraint, avoiding a schema migration.
const LEGACY_TIER_DB_VALUE = 'low';

(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const user = session ? session.user : null;

  document.querySelectorAll('.select-package-btn').forEach((btn) => {
    if (!user) {
      btn.textContent = 'Log in to select';
      btn.addEventListener('click', () => {
        window.location.href = 'login.html';
      });
      return;
    }

    const originalLabel = btn.textContent;

    btn.addEventListener('click', async () => {
      const price = Number(btn.dataset.price);
      const label = btn.dataset.label;

      btn.disabled = true;
      btn.textContent = 'Submitting…';

      const { error } = await supabaseClient.from('requests').insert({
        user_id: user.id,
        service_category: 'AgenticCore Package',
        tier: LEGACY_TIER_DB_VALUE,
        description: `${label} package order — priority handling, no additional scoping needed. Includes: ${PACKAGE_DELIVERABLES}`,
        agreed_price: price,
        status: 'awaiting_payment'
      });

      if (error) {
        btn.disabled = false;
        btn.textContent = originalLabel;
        alert('Something went wrong submitting your package order: ' + error.message);
        return;
      }

      btn.textContent = 'Submitted — check your dashboard';
    });
  });
})();
