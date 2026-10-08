// The two auth helpers admin.html still needs.
//
// They used to live in auth.js alongside the login, signup and reset form
// handlers. Those forms are React pages now and auth.js went with them,
// but the admin page is owner-only and not worth porting yet -- so it
// keeps the pieces it actually uses, pointed at the React routes.
async function logOut() {
  await supabaseClient.auth.signOut();
  window.location.href = '/login';
}

async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = '/login';
    return null;
  }
  return session;
}
