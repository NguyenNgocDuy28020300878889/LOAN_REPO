import assert from 'node:assert/strict';

// Test tooling only. Never import this mailbox reader into application code.
export async function waitForLocalEmailCode(mailOrigin, email, seen = new Set()) {
  const origin = new URL(mailOrigin);
  assert.ok(['localhost', '127.0.0.1'].includes(origin.hostname) && origin.port === '54324');
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const inbox = await (await fetch(`${origin.origin}/api/v1/messages`)).json();
    const message = inbox.messages.find(
      (item) => !seen.has(item.ID) && item.To?.some((recipient) => recipient.Address === email),
    );
    if (message) {
      seen.add(message.ID);
      const body = await (await fetch(`${origin.origin}/api/v1/message/${message.ID}`)).json();
      const code = body.HTML.match(/data-loan-otp[^>]*>\s*(\d{8})\s*</)?.[1];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('LOCAL_OTP_EMAIL_TIMEOUT');
}
