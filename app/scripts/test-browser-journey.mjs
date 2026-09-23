import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { browserSourceDigest } from './browser-source-digest.mjs';
import { waitForLocalEmailCode } from './local-email-code.mjs';

const bytes = readFileSync(new URL('../.local/local-status.json', import.meta.url));
const config = JSON.parse(
  bytes.toString(bytes[0] === 0xff ? 'utf16le' : 'utf8').replace(/^\uFEFF/, ''),
);
const apiUrl = new URL(config.API_URL);
assert.ok(
  apiUrl.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(apiUrl.hostname) &&
    Boolean(apiUrl.port),
  'local API endpoint only',
);
const realtimeOrigin = config.API_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
const dist = path.resolve('.local/browser-dist');
assert.ok(existsSync(path.join(dist, 'index.html')), 'Run npm run export:browser:local first');
const manifest = JSON.parse(readFileSync(path.join(dist, 'acceptance-build.json'), 'utf8'));
assert.equal(manifest.apiOrigin, config.API_URL);
assert.equal(
  manifest.sourceDigest,
  browserSourceDigest(),
  'Source changed; run npm run export:browser:local again',
);
const server = createServer((req, res) => {
  let route;
  try {
    route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (/^\/invite\/[a-f0-9]{64}$/.test(route)) route = '/invite/[token].html';
  else if (/^\/pending-invite\/[a-f0-9-]{36}$/.test(route)) route = '/pending-invite/[id].html';
  else if (/^\/loan\/[a-f0-9-]{36}\/repayment$/.test(route)) route = '/loan/[id]/repayment.html';
  else if (/^\/loan\/[a-f0-9-]{36}$/.test(route)) route = '/loan/[id].html';
  else if (route === '/') route = '/index.html';
  else if (route === '/auth') route = '/auth/index.html';
  let file = path.resolve(dist, '.' + route);
  if (!file.startsWith(dist + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) && existsSync(file + '.html')) file += '.html';
  if (!existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  const type = file.endsWith('.js')
    ? 'application/javascript'
    : file.endsWith('.css')
      ? 'text/css'
      : file.endsWith('.html')
        ? 'text/html'
        : 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const users = [];
const externalRequests = [];
let loanId;
let browser;
const password = randomUUID() + '-Synthetic!';
const purpose = 'Synthetic private loan journey';
const failureMessage = 'Could not complete this action. Please try again.';
const settleNote = 'Full payment with lost response';
const pendingNote = 'Proposal automatically cancelled at settlement';
const disputedNote = 'Proposal disputed after review';
const cancelledNote = 'Proposal cancelled by its author';
const lifecyclePurpose = 'Invitation lifecycle journey';
const reviewUI = process.env.LOAN_UI_REVIEW === '1';
if (reviewUI) mkdirSync('.local/ui-review', { recursive: true });
async function reviewLayout(page, name) {
  if (!reviewUI) return;
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const width of [320, 412, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 915 });
      // Give React Native's responsive layout/theme hooks a frame to settle.
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${name}: horizontal overflow at ${width}px / ${colorScheme}`,
      );
      await page.screenshot({ path: `.local/ui-review/${name}-${colorScheme}-${width}.png` });
    }
  }
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 412, height: 915 });
}

// The app intentionally does not grant service_role SELECT on finance tables.
// Inspect only this run's fixtures through the explicitly local Docker database.
function rows(table, column, id) {
  assert.ok(['loans', 'repayments'].includes(table));
  assert.ok(['created_by', 'loan_id'].includes(column));
  assert.match(id, /^[a-f0-9-]{36}$/);
  const output = execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_loan-local',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      input: `select coalesce(json_agg(t), '[]'::json) from (select id,status${table === 'loans' ? ',principal_minor,loan_date,due_date' : ''} from public.${table} where ${column}='${id}') t;`,
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  return JSON.parse(output.trim());
}

function expireCurrentInvite(id) {
  assert.match(id, /^[a-f0-9-]{36}$/);
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_loan-local',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      input: `update public.loan_invites set created_at=now()-interval '2 minutes',expires_at=now()-interval '1 minute' where loan_id='${id}' and used_at is null and revoked_at is null;`,
      stdio: ['pipe', 'ignore', 'pipe'],
      windowsHide: true,
    },
  );
}

async function eventually(check, description, timeout = 15000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${description}`);
}
async function login(page, email) {
  assert.equal(await page.getByLabel('Password', { exact: true }).count(), 0);
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send verification code', exact: true }).click();
  const token = await waitForLocalEmailCode(config.MAILPIT_URL, email);
  const codeInput = page.getByLabel('8-digit verification code', { exact: true });
  await codeInput.waitFor();
  assert.ok(await page.getByRole('button', { name: 'Resend code', exact: true }).isDisabled());
  if (email === users[0].email) {
    await codeInput.fill((token[0] === '0' ? '1' : '0') + token.slice(1));
    await page.getByRole('button', { name: 'Verify and sign in', exact: true }).click();
    await page
      .getByText(
        'The code is invalid or has expired. Check your latest email or request a new code.',
        { exact: true },
      )
      .waitFor();
    assert.equal(new URL(page.url()).pathname, '/auth');
  }
  await page.getByLabel('8-digit verification code', { exact: true }).fill(token);
  await page.getByRole('button', { name: 'Verify and sign in', exact: true }).click();
}
async function newSession() {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    locale: 'en-US',
  });
  // A safety boundary, not a mock: HTTP and WebSocket both reach local services.
  await context.route('**/*', async (route) => {
    if (![origin, config.API_URL].includes(new URL(route.request().url()).origin)) {
      externalRequests.push('http');
      await route.abort();
    } else await route.continue();
  });
  return context;
}
async function trackPage(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const state = { subscriptions: 0, changes: [], prompts: [], alerts: [], cancelNext: false };
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'prompt') state.prompts.push(dialog.defaultValue());
    else if (dialog.type() === 'alert') state.alerts.push(dialog.message());
    if (dialog.type() === 'confirm' && state.cancelNext) {
      state.cancelNext = false;
      await dialog.dismiss();
    } else await dialog.accept();
  });
  await page.routeWebSocket(/.*/, (socket) => {
    if (new URL(socket.url()).origin !== realtimeOrigin) {
      externalRequests.push('websocket');
      socket.close();
      return;
    }
    const serverSocket = socket.connectToServer();
    serverSocket.onMessage((payload) => {
      const raw = JSON.parse(String(payload));
      const frame = Array.isArray(raw) ? { event: raw[3], payload: raw[4] } : raw;
      if (frame.event === 'phx_reply' && frame.payload?.response?.postgres_changes?.length)
        state.subscriptions++;
      if (frame.event === 'postgres_changes') state.changes.push(frame.payload);
      socket.send(payload);
    });
  });
  return { page, state };
}

try {
  for (let i = 0; i < 3; i++) {
    const { data, error } = await admin.auth.admin.createUser({
      email: `browser-${randomUUID()}@example.invalid`,
      password,
      email_confirm: true,
    });
    assert.equal(error, null);
    users.push(data.user);
  }
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_BIN ||
      (process.platform === 'win32'
        ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
        : '/usr/bin/google-chrome'),
  });
  const ownerContext = await newSession();
  // Exercise the supported manual-copy path independently of OS share-sheet UI.
  await ownerContext.addInitScript(() =>
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }),
  );
  const { page: owner, state: ownerState } = await trackPage(ownerContext);
  await owner.goto(origin + '/auth');
  await owner.getByLabel('Email address', { exact: true }).waitFor();
  await reviewLayout(owner, 'auth');
  await login(owner, users[0].email);
  await owner.getByRole('button', { name: 'Create a loan', exact: true }).waitFor();
  await eventually(() => ownerState.subscriptions === 1, 'owner Realtime subscribed with no loans');
  const { page: observer, state: observerState } = await trackPage(ownerContext);
  await observer.goto(origin);
  await observer.getByRole('button', { name: 'Create a loan', exact: true }).waitFor();
  await eventually(() => observerState.subscriptions === 1, 'second owner session subscribed');
  const { page: outsider, state: outsiderState } = await trackPage(await newSession());
  await outsider.goto(origin + '/auth');
  await login(outsider, users[2].email);
  await eventually(() => outsiderState.subscriptions === 1, 'unrelated account subscribed');
  await owner.getByRole('button', { name: 'Create a loan', exact: true }).click();
  await owner.getByLabel('Amount', { exact: true }).pressSequentially('10000000');
  assert.equal(await owner.getByLabel('Amount', { exact: true }).inputValue(), '10.000.000');
  await owner.getByLabel('Amount', { exact: true }).fill('');
  await owner.getByLabel('Amount', { exact: true }).pressSequentially('123456');
  assert.equal(await owner.getByLabel('Amount', { exact: true }).inputValue(), '123.456');
  const loanDateInput = owner.getByLabel('Loan date (DD/MM/YYYY)', { exact: true });
  const dueDateInput = owner.getByLabel('Due date (DD/MM/YYYY)', { exact: true });
  await loanDateInput.fill('');
  await loanDateInput.pressSequentially('16092026');
  await dueDateInput.fill('');
  await dueDateInput.pressSequentially('20092026');
  assert.equal(await loanDateInput.inputValue(), '16/09/2026');
  assert.equal(await dueDateInput.inputValue(), '20/09/2026');
  // Commit an IME buffer with no follow-up input event. The submitted payload,
  // not just the DOM, must receive the completed date.
  await dueDateInput.evaluate((el) => {
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '20092026');
    el.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertCompositionText',
        isComposing: true,
        data: '20092026',
      }),
    );
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '20092026' }));
  });
  assert.equal(await dueDateInput.inputValue(), '20/09/2026');
  await owner.getByLabel('Purpose (optional)', { exact: true }).fill(purpose);
  await owner.getByLabel('Recipient email (optional)', { exact: true }).fill(users[1].email);
  await reviewLayout(owner, 'create');
  ownerState.cancelNext = true;
  await owner.getByRole('button', { name: 'Create a loan', exact: true }).click();
  await eventually(() => !ownerState.cancelNext, 'creation confirmation cancelled');
  assert.equal(
    rows('loans', 'created_by', users[0].id).length,
    0,
    'cancel confirmation creates nothing',
  );
  await owner.getByRole('button', { name: 'Create a loan', exact: true }).click();
  await owner.getByText(purpose, { exact: true }).waitFor();
  await eventually(
    () => /\/loan\/[a-f0-9-]{36}$/.test(new URL(owner.url()).pathname),
    'created loan room',
  );
  loanId = new URL(owner.url()).pathname.split('/').pop();
  const createdRow = rows('loans', 'created_by', users[0].id).find((row) => row.id === loanId);
  assert.equal(Number(createdRow.principal_minor), 123456, 'grouping must not alter principal');
  assert.equal(createdRow.loan_date, '2026-09-16', 'date input must reach storage as ISO');
  assert.equal(createdRow.due_date, '2026-09-20', 'due date must reach storage as ISO');
  assert.equal(ownerState.prompts.length, 1, 'browser without Web Share offers copyable message');
  const inviteUrl = ownerState.prompts[0].match(/https?:\/\/\S+\/invite\/[a-f0-9]{64}/)?.[0];
  assert.ok(inviteUrl, 'share fallback includes a complete invitation URL');
  const invitePath = new URL(inviteUrl).pathname;
  assert.match(invitePath, /^\/invite\/[a-f0-9]{64}$/);
  await observer.getByText(purpose, { exact: true }).waitFor();
  await reviewLayout(observer, 'home');
  await observer.getByLabel('Find a loan', { exact: true }).fill('no matching purpose');
  await observer.getByText('No matching loans', { exact: true }).waitFor();
  await observer.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await observer.getByRole('radio', { name: 'Borrowing', exact: true }).press('Space');
  await observer.getByText('No matching loans', { exact: true }).waitFor();
  await observer.getByRole('radio', { name: 'Lending', exact: true }).click();
  await observer.getByText(purpose, { exact: true }).waitFor();
  await reviewLayout(owner, 'room-pending');
  assert.ok(
    observerState.changes.length > 0,
    'empty list updates on a second session without reload',
  );
  assert.equal(ownerState.subscriptions, 1, 'navigation does not duplicate the channel');
  console.log('PASS create via UI, cancel confirmation, share fallback, live empty-list update');

  const borrowerContext = await newSession();
  const { page: borrower, state: borrowerState } = await trackPage(borrowerContext);
  let financialCalls = 0;
  borrower.on('request', (request) => {
    if (request.url().includes('/rest/v1/rpc/')) financialCalls++;
  });
  await borrower.goto(origin + invitePath);
  await borrower.getByText('You are invited to a shared loan', { exact: true }).waitFor();
  await borrower.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  assert.ok(!(await borrower.locator('body').innerText()).includes(purpose));
  assert.equal(financialCalls, 0);
  await borrower.screenshot({ path: '.local/invite-anonymous.png', fullPage: true });
  await reviewLayout(borrower, 'invite');
  await borrower.getByRole('button', { name: 'Sign in', exact: true }).click();
  await login(borrower, users[1].email);
  await borrower.getByText(purpose, { exact: false }).waitFor();
  assert.equal(new URL(borrower.url()).pathname, invitePath);
  await borrower.goto(origin);
  await borrower.getByText('Pending invitations for you (1)', { exact: true }).waitFor();
  await borrower.getByRole('button').filter({ hasText: purpose }).click();
  assert.match(new URL(borrower.url()).pathname, /^\/pending-invite\/[a-f0-9-]{36}$/);
  await borrower.getByText(purpose, { exact: true }).waitFor();
  await borrower.goto(origin + invitePath);
  await borrower.getByRole('button', { name: 'Accept invitation', exact: true }).click();
  await eventually(
    () => new URL(borrower.url()).pathname === `/loan/${loanId}`,
    'in-app invitation opens the accepted loan room',
  );
  await owner.getByRole('button', { name: 'Record repayment', exact: true }).waitFor();
  await borrower.getByRole('button', { name: 'Record repayment', exact: true }).click();
  await borrower.getByLabel('Amount (VND)', { exact: true }).pressSequentially('1000');
  assert.equal(await borrower.getByLabel('Amount (VND)', { exact: true }).inputValue(), '1.000');
  await borrower.getByLabel('Note (optional)', { exact: true }).fill(disputedNote);
  await reviewLayout(borrower, 'repayment');
  await borrower.getByRole('button', { name: 'Record repayment', exact: true }).click();
  await owner.getByText(disputedNote, { exact: false }).waitFor();

  await borrowerContext.setOffline(true);
  const disputedPayment = owner.getByText(disputedNote, { exact: false }).locator('..');
  await disputedPayment.getByRole('button', { name: 'Dispute', exact: true }).click();
  await borrowerContext.setOffline(false);
  await borrower.getByText('Disputed', { exact: true }).waitFor();

  await borrower.getByRole('button', { name: 'Record repayment', exact: true }).click();
  await borrower.getByLabel('Amount (VND)', { exact: true }).fill('500');
  await borrower.getByLabel('Note (optional)', { exact: true }).fill(cancelledNote);
  await borrower.getByRole('button', { name: 'Record repayment', exact: true }).click();
  const cancelledPayment = borrower.getByText(cancelledNote, { exact: false }).locator('..');
  await cancelledPayment.getByRole('button', { name: 'Cancel', exact: true }).click();
  await owner.getByText('Cancelled', { exact: true }).waitFor();

  await borrower.getByRole('button', { name: 'Record repayment', exact: true }).click();
  await borrower.getByLabel('Amount (VND)', { exact: true }).fill('1000');
  await borrower.getByLabel('Note (optional)', { exact: true }).fill(pendingNote);
  await borrower.getByRole('button', { name: 'Record repayment', exact: true }).click();
  await owner.getByText(pendingNote, { exact: false }).waitFor();

  const attempts = [];
  let dropResponse = true;
  await borrowerContext.route('**/rest/v1/rpc/submit_repayment', async (route) => {
    attempts.push(route.request().postDataJSON().idempotency_key_input);
    const response = await route.fetch();
    assert.equal(response.status(), 200, 'the real server committed repayment');
    if (dropResponse) {
      dropResponse = false;
      await route.abort('connectionreset');
    } else await route.fulfill({ response });
  });
  await borrower.getByRole('button', { name: 'Record repayment', exact: true }).click();
  assert.equal(
    await borrower.getByLabel('Amount (VND)', { exact: true }).inputValue(),
    '',
    'a new proposal starts with an empty form',
  );
  await borrower.getByLabel('Amount (VND)', { exact: true }).fill('123456');
  await borrower.getByLabel('Note (optional)', { exact: true }).fill(settleNote);
  await borrower.getByRole('button', { name: 'Record repayment', exact: true }).click();
  await eventually(
    () => borrowerState.alerts.some((message) => message.includes(failureMessage)),
    'lost response gives actionable failure',
  );
  await borrower.reload();
  await borrower.getByLabel('Amount (VND)', { exact: true }).fill('123456');
  await borrower.getByLabel('Note (optional)', { exact: true }).fill(settleNote);
  await borrower.getByRole('button', { name: 'Record repayment', exact: true }).click();
  await borrower.getByText(settleNote, { exact: false }).waitFor();
  assert.equal(attempts.length, 2);
  assert.equal(
    attempts[0],
    attempts[1],
    'retry after full page reload reuses the persisted command key',
  );
  assert.equal(
    rows('repayments', 'loan_id', loanId).length,
    4,
    'lost response did not duplicate repayment',
  );
  console.log(
    'PASS privacy, login return, direct-link join, dispute/cancel, reconnect and lost-response retry',
  );

  const fullPayment = owner.getByText(settleNote, { exact: false }).locator('..');
  ownerState.cancelNext = true;
  await fullPayment.getByRole('button', { name: 'Confirm', exact: true }).click();
  await eventually(() => !ownerState.cancelNext, 'payment confirmation cancelled');
  assert.deepEqual(
    rows('repayments', 'loan_id', loanId)
      .map((row) => row.status)
      .sort(),
    ['CANCELLED', 'DISPUTED', 'PENDING', 'PENDING'],
    'cancelling confirmation leaves both pending proposals unchanged',
  );
  await fullPayment.getByRole('button', { name: 'Confirm', exact: true }).click();
  await borrower.getByText('Remaining · Repaid', { exact: true }).waitFor();
  await borrower
    .getByText('Automatically cancelled because the loan was confirmed fully repaid.', {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await borrower.getByRole('button', { name: 'Record repayment', exact: true }).count(),
    0,
  );
  assert.deepEqual(
    rows('repayments', 'loan_id', loanId)
      .map((row) => row.status)
      .sort(),
    ['CANCELLED', 'CANCELLED', 'CONFIRMED', 'DISPUTED'],
  );
  assert.ok(ownerState.changes.length > 0 && borrowerState.changes.length > 0);
  assert.equal(
    outsiderState.changes.length,
    0,
    'unrelated authenticated subscriber receives no financial rows',
  );
  await outsider.goto(origin + `/loan/${loanId}`);
  await outsider.getByText(failureMessage, { exact: true }).waitFor();
  assert.ok(!(await outsider.locator('body').innerText()).includes(purpose));
  await borrower.screenshot({ path: '.local/loan-settled.png', fullPage: true });
  await reviewLayout(borrower, 'room-settled');
  console.log('PASS live settlement, auto-cancel audit reason, RLS on real WebSocket and room RPC');

  await owner.goto(origin + '/create');
  await owner.getByLabel('Amount', { exact: true }).fill('2000');
  await owner.getByLabel('Purpose (optional)', { exact: true }).fill(lifecyclePurpose);
  await owner.getByLabel('Recipient email (optional)', { exact: true }).fill(users[1].email);
  const lifecyclePromptStart = ownerState.prompts.length;
  await owner.getByRole('button', { name: 'Create a loan', exact: true }).click();
  await owner.getByText(lifecyclePurpose, { exact: true }).waitFor();
  const lifecycleLoanId = new URL(owner.url()).pathname.split('/').pop();
  assert.match(lifecycleLoanId, /^[a-f0-9-]{36}$/);
  assert.equal(ownerState.prompts.length, lifecyclePromptStart + 1);
  const originalLifecycleUrl = ownerState.prompts
    .at(-1)
    .match(/https?:\/\/\S+\/invite\/[a-f0-9]{64}/)?.[0];
  assert.ok(originalLifecycleUrl);

  await owner.getByRole('button', { name: 'Create a replacement link', exact: true }).click();
  await eventually(
    () => ownerState.prompts.length === lifecyclePromptStart + 2,
    'replacement invite shared',
  );
  const replacementUrl = ownerState.prompts
    .at(-1)
    .match(/https?:\/\/\S+\/invite\/[a-f0-9]{64}/)?.[0];
  assert.ok(replacementUrl);
  await borrower.goto(originalLifecycleUrl);
  await borrower
    .getByText('This invitation was revoked. Ask the sender for a new link.', {
      exact: true,
    })
    .waitFor();

  await owner.getByRole('button', { name: 'Revoke invitation link', exact: true }).click();
  await eventually(
    () => ownerState.alerts.some((message) => message.includes('Invitation revoked')),
    'replacement invite revoked',
  );
  await borrower.goto(replacementUrl);
  await borrower
    .getByText('This invitation was revoked. Ask the sender for a new link.', {
      exact: true,
    })
    .waitFor();

  await owner.getByRole('button', { name: 'Create a replacement link', exact: true }).click();
  await eventually(
    () => ownerState.prompts.length === lifecyclePromptStart + 3,
    'fresh invite shared after revocation',
  );
  const expiringUrl = ownerState.prompts.at(-1).match(/https?:\/\/\S+\/invite\/[a-f0-9]{64}/)?.[0];
  assert.ok(expiringUrl);
  expireCurrentInvite(lifecycleLoanId);
  await borrower.goto(expiringUrl);
  await borrower
    .getByText('This invitation has expired. Ask the sender to create a new link.', {
      exact: true,
    })
    .waitFor();

  await owner.getByRole('button', { name: 'Create a replacement link', exact: true }).click();
  await eventually(
    () => ownerState.prompts.length === lifecyclePromptStart + 4,
    'expired invite replaced',
  );
  const finalLifecycleUrl = ownerState.prompts
    .at(-1)
    .match(/https?:\/\/\S+\/invite\/[a-f0-9]{64}/)?.[0];
  assert.ok(finalLifecycleUrl);
  await borrower.goto(finalLifecycleUrl);
  await borrower.getByText(lifecyclePurpose, { exact: true }).waitFor();
  await borrower.getByRole('button', { name: 'Decline invitation', exact: true }).click();
  await borrower.getByRole('button', { name: 'Create a loan', exact: true }).waitFor();
  assert.equal(
    rows('loans', 'created_by', users[0].id).find((row) => row.id === lifecycleLoanId)?.status,
    'DECLINED',
  );
  console.log('PASS invitation replace, revoke, expiry, replacement and decline journey');

  await borrower.goto(origin + '/settings');
  await borrower.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
  const pushSwitch = borrower.getByRole('switch', { name: 'Push notifications', exact: true });
  await pushSwitch.waitFor();
  const initialPush = await pushSwitch.getAttribute('aria-checked');
  await pushSwitch.press('Space');
  await eventually(
    async () => (await pushSwitch.getAttribute('aria-checked')) !== initialPush,
    'notification row toggles its preference',
  );
  await pushSwitch.click();
  await eventually(
    async () => (await pushSwitch.getAttribute('aria-checked')) === initialPush,
    'notification preference restored',
  );
  if (reviewUI) {
    await borrower.getByRole('radio', { name: 'Tiếng Việt', exact: true }).click();
    await borrower.getByRole('button', { name: 'Đăng xuất', exact: true }).waitFor();
    await reviewLayout(borrower, 'settings-vi');
    await borrower.goto(origin);
    await borrower.getByText(purpose, { exact: true }).waitFor();
    await reviewLayout(borrower, 'home-vi');
    await borrower.getByRole('button').filter({ hasText: purpose }).click();
    await borrower.getByText('Còn lại · Đã trả đủ', { exact: true }).waitFor();
    await reviewLayout(borrower, 'room-vi');
    await borrower.goto(origin + '/settings');
    await borrower.getByRole('button', { name: 'Đăng xuất', exact: true }).waitFor();
    await borrower.getByRole('radio', { name: 'English', exact: true }).click();
  }
  await borrower.getByRole('button', { name: 'Sign out', exact: true }).click();
  await borrower.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  financialCalls = 0;
  await borrower.goto(origin + invitePath);
  await borrower.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  assert.ok(!(await borrower.locator('body').innerText()).includes(purpose));
  assert.equal(financialCalls, 0);
  assert.deepEqual(externalRequests, [], 'no cloud HTTP or WebSocket requests');
  console.log('PASS logout hides financial details; all browser traffic stayed local');
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
  // Discover fixtures even if the UI failed before returning the created loan id.
  for (const user of users) {
    for (const row of rows('loans', 'created_by', user.id)) {
      assert.match(row.id, /^[a-f0-9-]{36}$/);
      execFileSync(
        'docker',
        [
          'exec',
          '-i',
          'supabase_db_loan-local',
          'psql',
          '-U',
          'postgres',
          '-d',
          'postgres',
          '-v',
          'ON_ERROR_STOP=1',
        ],
        {
          input: `begin; delete from public.loan_events where loan_id='${row.id}';delete from public.repayments where loan_id='${row.id}';delete from public.loan_invites where loan_id='${row.id}';delete from public.loan_members where loan_id='${row.id}';delete from public.loans where id='${row.id}';commit;`,
          stdio: ['pipe', 'ignore', 'pipe'],
          windowsHide: true,
        },
      );
    }
    assert.equal((await admin.auth.admin.deleteUser(user.id)).error, null);
  }
}
