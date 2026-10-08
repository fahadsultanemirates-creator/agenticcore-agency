// AgenticCore Agency — read-only shared-project view.
// Standalone (not dashboard.js): this page is reached by anyone with the
// link, logged in or not, so it only ever calls the public get_shared_project
// RPC with the anon key -- no session, no profile lookup.

const STATUS_LABELS = {
  draft: 'Draft',
  awaiting_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  awaiting_review: 'Awaiting client review',
  revision_requested: 'Revision requested',
  delivered: 'Delivered',
  approved: 'Approved — awaiting final payment'
};

function statusPill(status) {
  const label = STATUS_LABELS[status] || status;
  return `<span class="status-pill status-${status}">${label}</span>`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

(async () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  const titleEl = document.getElementById('projectViewTitle');
  const subEl = document.getElementById('projectViewSub');
  const cardEl = document.getElementById('projectViewCard');
  const errorEl = document.getElementById('projectViewError');

  if (!token) {
    titleEl.textContent = 'No project specified';
    subEl.textContent = 'This link is missing its share token.';
    errorEl.style.display = 'block';
    return;
  }

  const { data, error } = await supabaseClient.rpc('get_shared_project', { p_share_token: token });
  const project = Array.isArray(data) ? data[0] : data;

  if (error || !project) {
    titleEl.textContent = 'Project not found';
    subEl.textContent = '';
    errorEl.style.display = 'block';
    return;
  }

  titleEl.textContent = project.project_name || 'Untitled project';
  subEl.textContent = `Shared from AgenticCore Agency — last updated ${formatDate(project.updated_at || project.created_at)}.`;

  document.getElementById('projectViewGroup').textContent = project.project_group || 'Unsorted';
  document.getElementById('projectViewStarted').textContent = `Started ${formatDate(project.created_at)}`;
  document.getElementById('projectViewRevisions').textContent = `${project.revisions_used} / 2 free revisions used`;
  document.getElementById('projectViewStatus').innerHTML = statusPill(project.status);
  cardEl.style.display = 'block';
})();
