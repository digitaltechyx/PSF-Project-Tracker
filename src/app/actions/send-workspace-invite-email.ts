'use server';

const RESEND_API = 'https://api.resend.com/emails';

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type SendWorkspaceInviteEmailInput = {
  to: string;
  workspaceName: string;
  inviterName: string;
  joinUrl: string;
};

export async function sendWorkspaceInviteEmail(input: SendWorkspaceInviteEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Email is not configured. Add RESEND_API_KEY to your environment (see Resend.com).'
    );
  }

  const to = input.to.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error('Please enter a valid email address.');
  }

  const from =
    process.env.INVITE_FROM_EMAIL?.trim() || 'NexusTrack <onboarding@resend.dev>';

  const subject = `${input.inviterName} invited you to ${input.workspaceName}`;
  const safeWs = escapeHtml(input.workspaceName);
  const safeInviter = escapeHtml(input.inviterName);
  const safeUrl = escapeHtml(input.joinUrl);

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Inter, system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>You've been invited to join <strong>${safeWs}</strong> on NexusTrack.</p>
  <p><strong>${safeInviter}</strong> sent this invitation.</p>
  <p><a href="${safeUrl}" style="display:inline-block;padding:10px 16px;background:#452ED2;color:#fff;text-decoration:none;border-radius:8px;">Accept invitation</a></p>
  <p style="font-size:12px;color:#666;">If the button does not work, copy and paste this link:<br/>${safeUrl}</p>
</body>
</html>`;

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    errors?: { message?: string }[];
  };
  if (!res.ok) {
    const fromErrors = body.errors?.[0]?.message;
    const msg = fromErrors || body.message || res.statusText;
    throw new Error(msg || 'Failed to send invitation email.');
  }
}
