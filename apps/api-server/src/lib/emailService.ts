import { Resend } from "resend";

const ADMIN_EMAIL = "nexuswealthpartner@gmail.com";
const SUPPORT_EMAIL = "support@nexuswealthpartners.group";
const SITE_URL = "https://nexuswealthpartners.group/nexus-wealth-partners";

const FROM_INVESTOR = "Nexus Wealth Partners <support@nexuswealthpartners.group>";
const FROM_SYSTEM = "NWP System <support@nexuswealthpartners.group>";

const FIELD_LABELS: Record<string, string> = {
  mobile: "Mobile Number",
  address: "Address",
  email: "Email Address",
  bnb_wallet: "BNB Wallet Address",
};

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[NWP Email] RESEND_API_KEY not set — emails will be skipped");
    return null;
  }
  return new Resend(key);
}

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body{margin:0;padding:0;background:#0d1526;color:#e8ecf4;font-family:Arial,sans-serif;font-size:15px;line-height:1.6}
    .wrap{max-width:580px;margin:0 auto;padding:40px 24px}
    .brand{text-align:center;margin-bottom:28px}
    .brand-name{font-size:20px;font-weight:900;color:#7c7cff;letter-spacing:-0.3px}
    .brand-sub{font-size:11px;color:#5a6a8a;text-transform:uppercase;letter-spacing:2px}
    .card{background:#1a2540;border:1px solid #2a3a5c;border-radius:8px;padding:24px;margin:20px 0}
    .section-title{font-size:22px;font-weight:700;color:#7c7cff;margin:0 0 16px}
    .lbl{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8b9ab5;margin:0 0 2px}
    .val{font-size:14px;color:#e8ecf4;margin:0 0 14px;word-break:break-all}
    .btn{display:inline-block;background:#7c7cff;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:700;font-size:15px;margin-top:16px}
    .footer{text-align:center;margin-top:28px;font-size:12px;color:#4a5a7a}
    a{color:#7c7cff}
    hr{border:none;border-top:1px solid #2a3a5c;margin:20px 0}
  </style>
</head>
<body>
<div class="wrap">
  <div class="brand">
    <div class="brand-name">NEXUS WEALTH PARTNERS</div>
    <div class="brand-sub">Private Investment Platform</div>
  </div>
  ${body}
  <div class="footer">
    <hr/>
    <p>© ${new Date().getFullYear()} Nexus Wealth Partners</p>
    <p><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
  </div>
</div>
</body>
</html>`;
}

async function send(params: {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
}): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    const { error } = await client.emails.send(params);
    if (error) {
      console.error("[NWP Email] Resend error:", error.message ?? JSON.stringify(error));
    }
  } catch (err) {
    console.error("[NWP Email] Failed to send:", (err as Error).message);
  }
}

export async function sendWelcomeEmail(params: {
  toEmail: string;
  fullName: string;
}): Promise<void> {
  await send({
    from: FROM_INVESTOR,
    to: params.toEmail,
    subject: "Your Application Has Been Received — Nexus Wealth Partners",
    html: wrap(`
      <div class="section-title">Application Received</div>
      <p>Dear ${params.fullName},</p>
      <p>Thank you for applying to join Nexus Wealth Partners. We have received your registration and our compliance team will review your application within <strong>24–48 hours</strong>.</p>
      <div class="card">
        <div class="lbl">What happens next</div>
        <div class="val">
          1. Our team reviews your application<br/>
          2. You receive an approval email<br/>
          3. Log in, choose your package, and deposit USDT to activate your account
        </div>
      </div>
      <p>Questions? Reach us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
    `),
  });
}

export async function sendNewApplicationAlert(params: {
  fullName: string;
  email: string;
  mobile: string;
  country: string;
  address: string;
  bnbWallet: string;
  referredByCode: string;
  userId: number;
}): Promise<void> {
  await send({
    from: FROM_SYSTEM,
    to: ADMIN_EMAIL,
    subject: `[NWP Admin] New Application — ${params.fullName}`,
    html: wrap(`
      <div class="section-title">New Registration Pending Approval</div>
      <div class="card">
        <div class="lbl">Full Name</div><div class="val">${params.fullName}</div>
        <div class="lbl">Email</div><div class="val">${params.email}</div>
        <div class="lbl">Mobile</div><div class="val">${params.mobile}</div>
        <div class="lbl">Country</div><div class="val">${params.country}</div>
        <div class="lbl">Address</div><div class="val">${params.address}</div>
        <div class="lbl">BNB Wallet</div><div class="val" style="font-family:monospace;font-size:12px">${params.bnbWallet}</div>
        <div class="lbl">Referred Via Code</div><div class="val">${params.referredByCode}</div>
        <div class="lbl">User ID</div><div class="val">#${params.userId}</div>
      </div>
      <p>Log in to the admin panel to approve or reject this application.</p>
    `),
  });
}

export async function sendApprovalEmail(params: {
  toEmail: string;
  fullName: string;
}): Promise<void> {
  await send({
    from: FROM_INVESTOR,
    to: params.toEmail,
    subject: "Account Approved — Nexus Wealth Partners",
    html: wrap(`
      <div class="section-title">Account Approved ✓</div>
      <p>Dear ${params.fullName},</p>
      <p>Your account has been approved. You can now log in, select your investment package, and make your first deposit to activate your earnings.</p>
      <div class="card">
        <div class="lbl">Investment Packages Available</div>
        <div class="val">Silver (20%) · Gold (22%) · Platinum (24%) · Emerald (26%) · VIP Pool (28%+)</div>
        <div class="lbl">Deposit Method</div>
        <div class="val">USDT via BNB Smart Chain (BEP-20)</div>
      </div>
      <a href="${SITE_URL}/login" class="btn">Sign In to Your Account</a>
    `),
  });
}

export async function sendRejectionEmail(params: {
  toEmail: string;
  fullName: string;
  reason?: string;
}): Promise<void> {
  await send({
    from: FROM_INVESTOR,
    to: params.toEmail,
    subject: "Application Status Update — Nexus Wealth Partners",
    html: wrap(`
      <div class="section-title">Application Update</div>
      <p>Dear ${params.fullName},</p>
      <p>After reviewing your application, we are unable to approve your account at this time.</p>
      ${params.reason ? `<div class="card"><div class="lbl">Reason</div><div class="val">${params.reason}</div></div>` : ""}
      <p>If you believe this is an error or have questions, please contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
    `),
  });
}

export async function sendProfileRequestApprovedEmail(params: {
  toEmail: string;
  fullName: string;
  field: string;
  newValue: string;
}): Promise<void> {
  const label = FIELD_LABELS[params.field] ?? params.field;
  await send({
    from: FROM_INVESTOR,
    to: params.toEmail,
    subject: `Profile Update Approved — ${label}`,
    html: wrap(`
      <div class="section-title">Profile Update Approved</div>
      <p>Dear ${params.fullName},</p>
      <p>Your request to update your <strong>${label}</strong> has been approved and applied to your account.</p>
      <div class="card">
        <div class="lbl">Updated Field</div><div class="val">${label}</div>
        <div class="lbl">New Value</div><div class="val">${params.newValue}</div>
      </div>
    `),
  });
}

export async function sendProfileRequestRejectedEmail(params: {
  toEmail: string;
  fullName: string;
  field: string;
}): Promise<void> {
  const label = FIELD_LABELS[params.field] ?? params.field;
  await send({
    from: FROM_INVESTOR,
    to: params.toEmail,
    subject: `Profile Update Request — ${label} Not Approved`,
    html: wrap(`
      <div class="section-title">Profile Update Not Approved</div>
      <p>Dear ${params.fullName},</p>
      <p>Your request to update your <strong>${label}</strong> could not be approved at this time.</p>
      <p>For assistance, contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
    `),
  });
}

export async function sendWithdrawalRequestAlert(params: {
  fullName: string;
  email: string;
  type: string;
  amountUsd: string;
  bnbWallet: string;
  withdrawalId: number;
}): Promise<void> {
  const typeLabel = params.type === "principal" ? "Principal (Early)" : "Profit";
  await send({
    from: FROM_SYSTEM,
    to: ADMIN_EMAIL,
    subject: `[NWP Admin] ${typeLabel} Withdrawal Request — ${params.fullName}`,
    html: wrap(`
      <div class="section-title">${typeLabel} Withdrawal Request</div>
      <div class="card">
        <div class="lbl">Customer</div><div class="val">${params.fullName} (${params.email})</div>
        <div class="lbl">Type</div><div class="val">${typeLabel}</div>
        <div class="lbl">Amount</div><div class="val">$${params.amountUsd} USDT</div>
        <div class="lbl">Send To (BNB Wallet)</div><div class="val" style="font-family:monospace;font-size:12px">${params.bnbWallet}</div>
        <div class="lbl">Request ID</div><div class="val">#${params.withdrawalId}</div>
      </div>
      <p>Review in the admin panel under <strong>Withdrawals</strong>.</p>
    `),
  });
}

export async function sendWithdrawalStatusEmail(params: {
  toEmail: string;
  fullName: string;
  type: string;
  amountUsd: string;
  status: string;
}): Promise<void> {
  const typeLabel = params.type === "principal" ? "principal" : "profit";
  const statusMessages: Record<string, { subject: string; body: string }> = {
    approved: {
      subject: `Withdrawal Approved — Nexus Wealth Partners`,
      body: `Your ${typeLabel} withdrawal of <strong>$${params.amountUsd} USDT</strong> has been approved and is being processed.`,
    },
    processing: {
      subject: `Principal Withdrawal Under Review — Nexus Wealth Partners`,
      body: `Your principal withdrawal request of <strong>$${params.amountUsd} USDT</strong> is now in the 2-week processing period. Funds will be sent to your registered BNB wallet upon completion.`,
    },
    completed: {
      subject: `Withdrawal Completed — Nexus Wealth Partners`,
      body: `Your ${typeLabel} withdrawal of <strong>$${params.amountUsd} USDT</strong> has been sent to your registered BNB Smart Chain wallet.`,
    },
    rejected: {
      subject: `Withdrawal Request Not Approved — Nexus Wealth Partners`,
      body: `Your ${typeLabel} withdrawal request of <strong>$${params.amountUsd} USDT</strong> could not be processed at this time. Please contact support for assistance.`,
    },
  };

  const msg = statusMessages[params.status];
  if (!msg) return;

  await send({
    from: FROM_INVESTOR,
    to: params.toEmail,
    subject: msg.subject,
    html: wrap(`
      <div class="section-title">Withdrawal Update</div>
      <p>Dear ${params.fullName},</p>
      <p>${msg.body}</p>
      ${params.status === "rejected" ? `<p>Contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> for assistance.</p>` : ""}
    `),
  });
}

export async function sendBonusCodeDepositAlert(params: {
  user: { email: string; fullName: string };
  deposit: { amountUsd: string; package: string };
}): Promise<void> {
  // Only admin gets this — no email to investor (they see it on screen)
  await send({
    from: FROM_SYSTEM,
    to: ADMIN_EMAIL,
    subject: `[NWP Admin] ⚡ Bonus Code Deposit — ${params.user.fullName} (NO blockchain wait)`,
    html: wrap(`
      <div class="section-title" style="background:#b45309;color:#fff;padding:12px 16px;border-radius:8px;margin-bottom:16px;">
        ⚡ Bonus Code (NWPMASTER) Used — Manual Activation Required
      </div>
      <div class="card">
        <div class="lbl">Customer</div><div class="val">${params.user.fullName} (${params.user.email})</div>
        <div class="lbl">Package</div><div class="val">${params.deposit.package.toUpperCase()}</div>
        <div class="lbl">Amount</div><div class="val">$${params.deposit.amountUsd} USDT</div>
      </div>
      <p><strong>⚠️ This deposit used the company Bonus Code.</strong> There is NO on-chain USDT transfer to detect — the investor has been granted access without sending funds to the wallet.</p>
      <p>Go to the <strong>Deposits</strong> tab and approve this deposit to activate their investment account.</p>
      <a href="${SITE_URL}/admin" class="btn">Approve in Admin Panel</a>
    `),
  });
}

export async function sendDepositDetectedEmails(params: {
  user: { email: string; fullName: string };
  deposit: { amountUsd: string; package: string; txHash: string };
}): Promise<void> {
  const bscscanUrl = `https://bscscan.com/tx/${params.deposit.txHash}`;
  // Email to customer
  await send({
    from: FROM_SYSTEM,
    to: params.user.email,
    subject: "[NWP] Your USDT deposit has been detected",
    html: wrap(`
      <div class="section-title">Deposit Detected ✅</div>
      <div class="card">
        <div class="lbl">Amount</div><div class="val">$${params.deposit.amountUsd} USDT</div>
        <div class="lbl">Package</div><div class="val">${params.deposit.package.toUpperCase()}</div>
        <div class="lbl">Transaction</div><div class="val"><a href="${bscscanUrl}">${params.deposit.txHash}</a></div>
      </div>
      <p>Your deposit has been detected on BNB Smart Chain. An admin will review and activate your investment within 24 hours.</p>
    `),
  });
  // Alert to admin
  await send({
    from: FROM_SYSTEM,
    to: ADMIN_EMAIL,
    subject: `[NWP Admin] Deposit detected — ${params.user.fullName}`,
    html: wrap(`
      <div class="section-title">New Deposit Detected</div>
      <div class="card">
        <div class="lbl">Customer</div><div class="val">${params.user.fullName} (${params.user.email})</div>
        <div class="lbl">Amount</div><div class="val">$${params.deposit.amountUsd} USDT</div>
        <div class="lbl">Package</div><div class="val">${params.deposit.package.toUpperCase()}</div>
        <div class="lbl">Transaction</div><div class="val"><a href="${bscscanUrl}">${params.deposit.txHash}</a></div>
      </div>
      <p>Approve this deposit in the admin panel under <strong>Deposits</strong> to activate the investment.</p>
      <a href="${SITE_URL}/admin" class="btn">Go to Admin Panel</a>
    `),
  });
}

export async function sendInvestmentActivatedEmail(params: {
  user: { email: string; fullName: string };
  deposit: { amountUsd: string; package: string; txHash: string | null };
}): Promise<void> {
  await send({
    from: FROM_SYSTEM,
    to: params.user.email,
    subject: "[NWP] Your investment is now ACTIVE 🎉",
    html: wrap(`
      <div class="section-title">Investment Activated!</div>
      <div class="card">
        <div class="lbl">Amount</div><div class="val">$${params.deposit.amountUsd} USDT</div>
        <div class="lbl">Package</div><div class="val">${params.deposit.package.toUpperCase()}</div>
        ${params.deposit.txHash ? `<div class="lbl">Transaction</div><div class="val"><a href="https://bscscan.com/tx/${params.deposit.txHash}">${params.deposit.txHash}</a></div>` : ""}
      </div>
      <p>Congratulations! Your investment is now active and you will begin earning daily profits on the next working day (Monday–Friday).</p>
      <a href="${SITE_URL}/dashboard" class="btn">View Dashboard</a>
    `),
  });
}

export async function sendDepositRejectedEmail(params: {
  user: { email: string; fullName: string };
  reason?: string;
}): Promise<void> {
  await send({
    from: FROM_SYSTEM,
    to: params.user.email,
    subject: "[NWP] Deposit could not be verified",
    html: wrap(`
      <div class="section-title">Deposit Not Verified</div>
      <div class="card">
        <p>We were unable to verify your deposit${params.reason ? `: ${params.reason}` : "."}</p>
      </div>
      <p>Please contact support for assistance: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
      <p>If you believe this is an error, please provide your transaction hash from BSCScan.</p>
    `),
  });
}

export async function sendPasswordResetEmail(params: {
  toEmail: string;
  fullName: string;
  token: string;
}): Promise<void> {
  const resetUrl = `${SITE_URL}/reset-password?token=${params.token}`;
  await send({
    from: FROM_INVESTOR,
    to: params.toEmail,
    subject: "[NWP] Reset your password",
    html: wrap(`
      <div class="section-title">Password Reset Request</div>
      <div class="card">
        <p>Hello <strong>${params.fullName}</strong>,</p>
        <p>We received a request to reset your password. Click the button below to set a new password.</p>
        <p>This link expires in <strong>1 hour</strong> and can only be used once.</p>
      </div>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}" style="background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">
          Reset My Password
        </a>
      </div>
      <p style="color:#888;font-size:13px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      <p style="color:#888;font-size:13px;">Or copy this link: <a href="${resetUrl}">${resetUrl}</a></p>
    `),
  });
}

export async function sendDepositNotifyEmail(params: {
  fullName: string;
  email: string;
  amountUsd: string;
  pkg: string;
}): Promise<void> {
  await send({
    from: FROM_SYSTEM,
    to: ADMIN_EMAIL,
    subject: `[NWP Admin] Deposit Sent Confirmation — ${params.fullName}`,
    html: wrap(`
      <div class="section-title">Client Has Sent Deposit</div>
      <div class="card">
        <div class="lbl">Customer</div><div class="val">${params.fullName} (${params.email})</div>
        <div class="lbl">Package</div><div class="val">${params.pkg.toUpperCase()}</div>
        <div class="lbl">Amount</div><div class="val">$${params.amountUsd} USDT</div>
      </div>
      <p>The client has confirmed they have sent their USDT deposit. Please check the <strong>Deposits</strong> section in the admin panel — the blockchain scanner will auto-detect the transaction shortly, or you can manually verify it if needed.</p>
      <a href="${SITE_URL}/admin" class="btn">Go to Admin Panel</a>
    `),
  });
}

export async function sendProfileRequestAlert(params: {
  fullName: string;
  email: string;
  field: string;
  newValue: string;
  requestId: number;
}): Promise<void> {
  const label = FIELD_LABELS[params.field] ?? params.field;
  await send({
    from: FROM_SYSTEM,
    to: ADMIN_EMAIL,
    subject: `[NWP Admin] Profile Update Request — ${params.fullName}`,
    html: wrap(`
      <div class="section-title">Profile Update Request</div>
      <div class="card">
        <div class="lbl">Customer</div><div class="val">${params.fullName} (${params.email})</div>
        <div class="lbl">Field Requested</div><div class="val">${label}</div>
        <div class="lbl">New Value</div><div class="val">${params.newValue}</div>
        <div class="lbl">Request ID</div><div class="val">#${params.requestId}</div>
      </div>
      <p>Review in the admin panel under <strong>Profile Requests</strong>.</p>
    `),
  });
}
