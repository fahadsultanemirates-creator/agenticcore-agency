// AgenticCore Agency — Authentication logic

function showAuthError(el, message) {
  el.textContent = message;
  el.style.display = 'block';
}

function hideAuthError(el) {
  el.style.display = 'none';
}

function setLoading(btn, loading, defaultText) {
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait…' : defaultText;
}

// -------- SIGN UP --------
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('authError');
    const btn = document.getElementById('signupBtn');
    hideAuthError(errorEl);

    const name = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const referralCode = new URLSearchParams(window.location.search).get('ref') || null;

    if (password.length < 8) {
      showAuthError(errorEl, 'Password must be at least 8 characters.');
      return;
    }

    setLoading(btn, true, 'Create account');

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          referred_by: referralCode
        }
      }
    });

    setLoading(btn, false, 'Create account');

    if (error) {
      showAuthError(errorEl, error.message);
      return;
    }

    if (data.user && !data.session) {
      // Email confirmation required
      window.location.href = 'check-email.html';
    } else {
      window.location.href = 'dashboard.html';
    }
  });
}

// -------- LOG IN --------
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('authError');
    const btn = document.getElementById('loginBtn');
    hideAuthError(errorEl);

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    setLoading(btn, true, 'Log in');

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    setLoading(btn, false, 'Log in');

    if (error) {
      showAuthError(errorEl, 'Incorrect email or password.');
      return;
    }

    window.location.href = 'dashboard.html';
  });
}

// -------- LOG OUT (used on dashboard pages) --------
async function logOut() {
  await supabaseClient.auth.signOut();
  window.location.href = '../pages/login.html';
}

// -------- ROUTE PROTECTION (used on dashboard pages) --------
async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = '../pages/login.html';
    return null;
  }
  return session;
}
