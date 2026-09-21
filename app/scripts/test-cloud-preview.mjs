import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  chromiumSandbox: true,
});
try {
  for (const [environment, port, otherRef] of [
    ['development', 8082, 'kircmwdkcdcozckrwfid'],
    ['staging', 8083, 'rwfmqthrpbkizcofullh'],
  ]) {
    const context = await browser.newContext({
      locale: 'en-US',
      viewport: { width: 412, height: 915 },
    });
    const page = await context.newPage();
    const requests = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto(`http://127.0.0.1:${port}/auth`);
    const publicConfig = JSON.parse(readFileSync('.local/cloud-public.json', 'utf8'))[environment];
    const google = page.getByRole('button', { name: 'Continue with Google', exact: true });
    await google.waitFor();
    assert.equal(await google.isDisabled(), !publicConfig.googleAuthReady);
    assert.equal(await page.locator('input[type="password"]').count(), 0);
    await page.getByRole('button', { name: 'Recover your Google account', exact: true }).waitFor();
    await page
      .getByText(
        'Email delivery is being set up. This version cannot send verification codes or sign in by email yet.',
        { exact: true },
      )
      .waitFor();
    const send = page.getByRole('button', { name: 'Send verification code', exact: true });
    assert.ok(await send.isDisabled());
    await page.getByLabel('Email address', { exact: true }).fill('not-sent@example.invalid');
    await page.getByLabel('Email address', { exact: true }).press('Enter');
    assert.ok(!requests.some((url) => url.includes('/auth/v1/otp')));
    assert.ok(!requests.some((url) => url.includes(otherRef) || url.includes(':54321')));
    const directory = `.local/browser-${environment}/_expo/static/js/web`;
    for (const file of readdirSync(directory).filter((file) => file.endsWith('.js'))) {
      assert.ok(
        !readFileSync(path.join(directory, file), 'utf8').includes(
          `https://${otherRef}.supabase.co`,
        ),
      );
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `.local/ui-review/cloud-${environment}-email-pending.png` });
    if (publicConfig.googleAuthReady) {
      // Real app -> real Supabase -> Google, without entering any Google credentials.
      const authorizeRequest = page.waitForRequest((request) =>
        request.url().startsWith(`${publicConfig.url}/auth/v1/authorize?`),
      );
      const googleRequest = page.waitForRequest(
        (request) => new URL(request.url()).origin === 'https://accounts.google.com',
      );
      await google.click();
      const authorize = new URL((await authorizeRequest).url());
      assert.equal(authorize.searchParams.get('provider'), 'google');
      assert.equal(
        authorize.searchParams.get('redirect_to'),
        `http://127.0.0.1:${port}/auth/callback`,
      );
      assert.ok(authorize.searchParams.get('code_challenge'));
      assert.equal(authorize.searchParams.get('code_challenge_method'), 's256');
      const destination = new URL((await googleRequest).url());
      assert.equal(
        destination.searchParams.get('redirect_uri'),
        `${publicConfig.url}/auth/v1/callback`,
      );
      console.log(`PASS ${environment}: Google button starts real PKCE flow and reaches Google`);
    }
    await context.close();
    console.log(
      `PASS ${environment}: Google readiness, recovery entry, no password field, SMTP pending and no send, isolated backend, mobile layout`,
    );
  }
} finally {
  await browser.close();
}
