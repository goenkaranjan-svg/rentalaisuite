type MailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type MailSendResult = {
  provider: "resend";
  id?: string;
};

function getAppBaseUrl(): string {
  const fromEnv =
    process.env.PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "http://localhost:5001";
}

function getFromAddress(): string {
  return process.env.AUTH_EMAIL_FROM || "PropMan Security <security@propman.local>";
}

async function sendWithResend(payload: MailPayload): Promise<MailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const body = await response.json().catch(() => ({} as any));
  return { provider: "resend", id: body?.id };
}

export async function sendAuthEmail(payload: MailPayload): Promise<MailSendResult> {
  const provider = (process.env.AUTH_EMAIL_PROVIDER || "resend").toLowerCase();

  if (provider === "resend") {
    return sendWithResend(payload);
  }

  throw new Error(`Unsupported AUTH_EMAIL_PROVIDER: ${provider}`);
}

export async function sendVerificationEmail(input: { to: string; token: string }): Promise<void> {
  const base = getAppBaseUrl();
  const verifyLink = `${base}/api/auth/verify-email?token=${encodeURIComponent(input.token)}`;
  await sendAuthEmail({
    to: input.to,
    subject: "Verify your email",
    html: `<p>Verify your email to activate your account:</p><p><a href="${verifyLink}">Verify Email</a></p><p>If you did not create this account, ignore this email.</p>`,
    text: `Verify your email to activate your account: ${verifyLink}`,
  });
}

export async function sendPasswordResetEmail(input: { to: string; token: string }): Promise<void> {
  const base = getAppBaseUrl();
  const resetLink = `${base}/login?mode=forgot&token=${encodeURIComponent(input.token)}`;
  await sendAuthEmail({
    to: input.to,
    subject: "Reset your password",
    html: `<p>Use the link below to reset your password:</p><p><a href="${resetLink}">Reset Password</a></p><p>This link expires in 1 hour.</p>`,
    text: `Reset your password: ${resetLink}`,
  });
}

export async function sendMagicLinkEmail(input: { to: string; token: string; role?: "manager" | "tenant" | "investor" }): Promise<void> {
  const base = getAppBaseUrl();
  const rolePart = input.role ? `&role=${encodeURIComponent(input.role)}` : "";
  const link = `${base}/api/auth/magic-link/consume?token=${encodeURIComponent(input.token)}${rolePart}`;
  await sendAuthEmail({
    to: input.to,
    subject: "Your secure sign-in link",
    html: `<p>Use this one-time link to sign in:</p><p><a href="${link}">Sign in to PropMan</a></p><p>This link expires in 15 minutes.</p>`,
    text: `Use this one-time sign-in link (expires in 15 minutes): ${link}`,
  });
}

export async function sendRecoveryEmail(input: { to: string; token: string }): Promise<void> {
  const base = getAppBaseUrl();
  const link = `${base}/login?mode=recovery&recoveryToken=${encodeURIComponent(input.token)}`;
  await sendAuthEmail({
    to: input.to,
    subject: "Account recovery request",
    html: `<p>An account recovery was requested for your account.</p><p><a href="${link}">Continue recovery</a></p><p>For security, recovery has a short cooldown before completion.</p>`,
    text: `Account recovery link: ${link}`,
  });
}
