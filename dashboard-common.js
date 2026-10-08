// AgenticCore Agency — shared chrome for the dashboard area (dashboard.html,
// projects.html, request.html): the left sidebar + top bar. Injected via JS
// into a `<div id="dashSidebarMount">`/`<div id="dashTopbarMount">` pair
// rather than duplicated as raw markup in every page, so the service list
// only lives in one place. forge.html doesn't use this -- it has its own
// full-viewport chrome instead.

const DASH_SERVICE_NAV = [
  { category: 'Websites', icon: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18"/><circle cx="6.5" cy="6.5" r="0.5"/>' },
  { category: 'Design & Media', icon: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h4M8 12h8M8 16h6"/>' },
  { category: 'Marketing', icon: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>' },
  { category: 'Bookkeeping & Reports', icon: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>' },
  { category: 'Audits & Feasibility Reports', icon: '<path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2-6.3-4.6L5.7 20.8 8 13.6 2 9.2h7.6z"/>' },
  { category: 'Custom AI Agents', icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>' }
];

function renderDashSidebar(activePage) {
  const mount = document.getElementById('dashSidebarMount');
  if (!mount) return;

  const serviceLinks = DASH_SERVICE_NAV.map((s) => `
    <a href="request.html?service=${encodeURIComponent(s.category)}" class="dash-sidebar-link" title="${s.category}">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${s.icon}</svg>
      <span>${s.category}</span>
    </a>
  `).join('');

  mount.innerHTML = `
    <aside class="dash-sidebar">
      <a href="dashboard.html" class="dash-sidebar-logo">
        <img src="logo-mark.png" alt="AgenticCore">
      </a>
      <nav class="dash-sidebar-nav">
        <a href="dashboard.html" class="dash-sidebar-link ${activePage === 'home' ? 'active' : ''}" title="Dashboard">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          <span>Dashboard</span>
        </a>
        <a href="projects.html" class="dash-sidebar-link ${activePage === 'projects' ? 'active' : ''}" title="Your projects">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
          <span>Projects</span>
        </a>
        <p class="dash-sidebar-label">Services</p>
        ${serviceLinks}
      </nav>
      <div class="dash-sidebar-forge">
        <a href="forge.html" class="dash-sidebar-link" title="Chat with Forge">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/></svg>
          <span>Forge</span>
        </a>
      </div>
    </aside>
  `;
}

function renderDashTopbar(crumb, title) {
  const mount = document.getElementById('dashTopbarMount');
  if (!mount) return;
  mount.innerHTML = `
    <header class="dash-topbar">
      <div class="dash-topbar-crumb">
        <p>${crumb}</p>
        <h1 id="dashTopbarTitle">${title}</h1>
      </div>
      <div class="dash-topbar-actions">
        <a href="index.html" class="btn btn-secondary btn-sm dash-topbar-exit">Exit</a>
        <button type="button" class="btn btn-secondary btn-sm" id="dashLogoutBtn">Log out</button>
      </div>
    </header>
  `;
  document.getElementById('dashLogoutBtn').addEventListener('click', logOut);
}

// Loads and returns the signed-in user's profile row, redirecting to
// login (via requireAuth, from auth.js) if there's no session. Shared by
// every dashboard-area page so each one isn't re-querying this itself.
async function loadDashProfile() {
  const session = await requireAuth();
  if (!session) return null;

  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    console.error('Failed to load profile', error);
    return null;
  }
  return profile;
}
