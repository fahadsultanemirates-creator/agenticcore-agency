// Nav scroll state
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}, { passive: true });

// Email support FAB: mailto: does nothing visible when the visitor has no
// default mail client configured, so also copy the address and show a
// "Copied" state -- guarantees some feedback either way.
const emailFab = document.getElementById('emailSupportFab');
if (emailFab) {
  emailFab.addEventListener('click', () => {
    const email = 'hello@agenticcore.agency';
    if (navigator.clipboard) navigator.clipboard.writeText(email).catch(() => {});

    const label = emailFab.querySelector('span');
    const mailIcon = emailFab.querySelector('.support-email-icon-mail');
    const checkIcon = emailFab.querySelector('.support-email-icon-check');
    const originalLabel = label.textContent;

    label.textContent = 'Copied!';
    mailIcon.hidden = true;
    checkIcon.hidden = false;

    setTimeout(() => {
      label.textContent = originalLabel;
      mailIcon.hidden = false;
      checkIcon.hidden = true;
    }, 2000);
  });
}
