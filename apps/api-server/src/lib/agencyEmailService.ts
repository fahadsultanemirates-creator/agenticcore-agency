import { Resend } from "resend";

const ADMIN_EMAIL = "admin@agenticcore.agency";
const SUPPORT_EMAIL = "support@agenticcore.agency";
const SITE_URL =
  process.env.AGENCY_SITE_URL || "https://agenticcore.agency/agenticcore-agency";

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[Agency Email] RESEND_API_KEY not set — emails will be skipped");
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
    body{margin:0;padding:0;background:#080c14;color:#e2e8f0;font-family:Arial,sans-serif;font-size:15px;line-height:1.6}
    .wrap{max-width:580px;margin:0 auto;padding:40px 24px}
    .brand{text-align:center;margin-bottom:28px}
    .brand-name{font-size:22px;font-weight:900;background:linear-gradient(135deg,#6366f1,#8b5cf6,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-0.5px}
    .brand-sub{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:2px;margin-top:4px}
    .card{background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:24px;margin:20px 0}
    .section-title{font-size:22px;font-weight:700;color:#6366f1;margin:0 0 16px}
    .lbl{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin:0 0 2px}
    .val{font-size:14px;color:#e2e8f0;margin:0 0 14px;word-break:break-all}
    .btn{display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;margin-top:16px}
    .footer{text-align:center;margin-top:28px;font-size:12px;color:#334155}
    a{color:#6366f1}
    hr{border:none;border-top:1px solid #1e293b;margin:20px 0}
  </style>
</head>
<body>
<div class="wrap">
  <div class="brand">
    <div class="brand-name">AGENTICCORE</div>
    <div class="brand-sub">AI Business Agency</div>
  </div>
  ${body}
  <div class="footer">
    <hr/>
    <p>© ${new Date().getFullYear()} AgenticCore. All rights reserved.</p>
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
      console.error("[Agency Email] Resend error:", error.message ?? JSON.stringify(error));
    }
  } catch (err) {
    console.error("[Agency Email] Failed to send:", (err as Error).message);
  }
}

const FROM = "AgenticCore <support@agenticcore.agency>";
const FROM_SYSTEM = "AgenticCore System <support@agenticcore.agency>";

export async function sendAgencyWelcomeEmail(params: {
  toEmail: string;
  fullName: string;
}): Promise<void> {
  await send({
    from: FROM,
    to: params.toEmail,
    subject: "Welcome to AgenticCore — Your AI Agency Account is Ready",
    html: wrap(`
      <div class="section-title">Welcome to AgenticCore 🚀</div>
      <p>Hi ${params.fullName},</p>
      <p>Your AgenticCore account has been created. You can now log in and start submitting AI-powered tasks to our 15-agent multi-agent system.</p>
      <div class="card">
        <div class="lbl">What you can do</div>
        <div class="val">
          ✦ Submit tasks: website builds, SEO audits, marketing campaigns, legal docs & more<br/>
          ✦ Track real-time progress as AI agents handle your brief<br/>
          ✦ Download deliverables directly from your dashboard
        </div>
      </div>
      <a href="${SITE_URL}/dashboard" class="btn">Go to Dashboard →</a>
    `),
  });
}

export async function sendAgencyPasswordResetEmail(params: {
  toEmail: string;
  fullName: string;
  token: string;
}): Promise<void> {
  const resetUrl = `${SITE_URL}/reset-password?token=${params.token}`;
  await send({
    from: FROM,
    to: params.toEmail,
    subject: "[AgenticCore] Reset your password",
    html: wrap(`
      <div class="section-title">Password Reset Request</div>
      <div class="card">
        <p>Hi <strong>${params.fullName}</strong>,</p>
        <p>We received a request to reset your password. Click below to set a new one.</p>
        <p>This link expires in <strong>1 hour</strong> and can only be used once.</p>
      </div>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}" class="btn">Reset My Password →</a>
      </div>
      <p style="color:#64748b;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
    `),
  });
}

export async function sendAgencyTaskSubmittedAlert(params: {
  customerName: string;
  customerEmail: string;
  serviceType: string;
  taskId: number;
}): Promise<void> {
  await send({
    from: FROM_SYSTEM,
    to: ADMIN_EMAIL,
    subject: `[AgenticCore] New Task #${params.taskId} — ${params.customerName}`,
    html: wrap(`
      <div class="section-title">New Task Submitted</div>
      <div class="card">
        <div class="lbl">Customer</div><div class="val">${params.customerName} (${params.customerEmail})</div>
        <div class="lbl">Service</div><div class="val">${params.serviceType}</div>
        <div class="lbl">Task ID</div><div class="val">#${params.taskId}</div>
      </div>
    `),
  });
}
