import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

// No account or financial mutation: only the create form's input controls.
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  chromiumSandbox: true,
});

async function compose(input, text, finish = true) {
  await input.focus();
  await input.evaluate(
    (el, { text, finish }) => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, text);
      el.setSelectionRange(text.length, text.length);
      el.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertCompositionText',
          data: text,
          isComposing: true,
        }),
      );
      if (finish)
        el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: text }));
    },
    { text, finish },
  );
}
try {
  for (const port of process.argv.slice(2).length ? process.argv.slice(2) : ['8082', '8083']) {
    assert.match(port, /^808[123]$/);
    const page = await browser.newPage({ locale: 'en-US' });
    await page.goto(`http://127.0.0.1:${port}/create`);
    const input = page.getByLabel('Amount', { exact: true });
    for (const digits of ['10000000', '12345678', '1000000000']) {
      await input.fill('');
      await input.pressSequentially(digits);
      // Let React settle so a transient DOM value cannot mask a rollback.
      await page.waitForTimeout(150);
      assert.equal(await input.inputValue(), digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
      assert.equal(
        await input.evaluate((el) => el.selectionStart),
        (await input.inputValue()).length,
      );
    }
    await input.fill('');
    await input.pressSequentially('10000000', { delay: 70 });
    assert.equal(await input.inputValue(), '10.000.000');
    await input.press('Backspace');
    assert.equal(await input.inputValue(), '1.000.000');
    await input.pressSequentially('0');
    assert.equal(await input.inputValue(), '10.000.000');
    await input.fill('12345678');
    await input.evaluate((el) => el.setSelectionRange(4, 4));
    await input.pressSequentially('9');
    assert.equal(await input.inputValue(), '123.945.678');
    await input.press('Backspace');
    assert.equal(await input.inputValue(), '12.345.678');
    await input.evaluate((el) => el.setSelectionRange(3, 6));
    await input.pressSequentially('9');
    assert.equal(await input.inputValue(), '129.678');
    await input.fill('10000000');
    assert.equal(await input.inputValue(), '10.000.000');
    await page.getByLabel('Currency', { exact: true }).fill('USD');
    await input.fill('');
    await input.pressSequentially('1234567,89');
    assert.equal(await input.inputValue(), '1.234.567,89');
    await input.press('ControlOrMeta+A');
    assert.deepEqual(
      await input.evaluate((el) => [el.selectionStart, el.selectionEnd]),
      [0, '1.234.567,89'.length],
      'select-all must cover the complete amount',
    );
    await input.press('Backspace');
    assert.equal(await input.inputValue(), '');
    await compose(input, '100000');
    await page.waitForTimeout(100);
    assert.equal(await input.inputValue(), '100.000', 'IME commit without a final input event');
    await compose(input, '10000000', false);
    await page.getByLabel('Currency', { exact: true }).click();
    assert.equal(await input.inputValue(), '10.000.000', 'blur must finalize pending IME text');

    for (const label of ['Loan date (DD/MM/YYYY)', 'Due date (DD/MM/YYYY)']) {
      const date = page.getByLabel(label, { exact: true });
      for (const delay of [0, 40]) {
        await date.fill('');
        await date.pressSequentially('22012027', { delay });
        await page.waitForTimeout(100);
        assert.equal(await date.inputValue(), '22/01/2027');
      }
      await date.press('Backspace');
      assert.equal(await date.inputValue(), '22/01/202');
      await date.pressSequentially('8');
      assert.equal(await date.inputValue(), '22/01/2028');
      await date.evaluate((el) => el.setSelectionRange(3, 5));
      await date.pressSequentially('12');
      assert.equal(await date.inputValue(), '22/12/2028');
      await date.fill('2026-09-16');
      assert.equal(await date.inputValue(), '16/09/2026');
      await compose(date, '22012027');
      assert.equal(await date.inputValue(), '22/01/2027');
      await compose(date, '16092026', false);
      await input.click();
      assert.equal(await date.inputValue(), '16/09/2026');
    }
    console.log(
      `PASS ${port}: money/date fast and slow typing, edits, paste, decimals, IME commit and blur`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
