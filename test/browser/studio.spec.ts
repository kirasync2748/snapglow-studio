import { test, expect } from './fixtures';
test('styles, local presets, safe text rendering and PNG/SVG downloads', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('#codeLines')).toContainText('greet');
  await page.getByLabel('ocean background', { exact: true }).click();
  await expect(
    page.getByLabel('ocean background', { exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#theme').selectOption('github-light');
  await page.locator('#title').fill('demo.ts');
  await page.getByLabel('Highlight lines', { exact: true }).fill('2');
  await expect(page.locator('.highlighted')).toHaveCount(1);
  await page.locator('#presetName').fill('Ocean light');
  await page.locator('#savePreset').click();
  await page.getByLabel('midnight background', { exact: true }).click();
  await page.getByRole('button', { name: 'Ocean light', exact: true }).click();
  await expect(
    page.getByLabel('ocean background', { exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByLabel('Code to capture')
    .fill('<img src=x onerror="window.pwned=true">');
  await expect(page.locator('#codeLines')).toContainText('<img');
  expect(await page.locator('#codeLines img').count()).toBe(0);
  const pngPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
  const png = await pngPromise;
  expect(png.suggestedFilename()).toBe('demo.png');
  const path = await png.path();
  expect(path).toBeTruthy();
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile(path as string);
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.readUInt32BE(16)).toBe(1744);
  const svgPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'SVG', exact: true }).click();
  const svg = await svgPromise;
  expect(svg.suggestedFilename()).toBe('demo.svg');
  const svgBytes = await readFile((await svg.path()) as string, 'utf8');
  expect(svgBytes).toContain('<svg');
  expect(svgBytes).toContain('foreignObject');
  await page.getByRole('button', { name: 'Delete Ocean light' }).click();
  await expect(page.locator('.preset-row')).toHaveCount(0);
});
test('handles every theme, window layout and transparent background', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('#codeLines')).toContainText('greet');
  for (const theme of [
    'tokyo-night',
    'dracula',
    'github-dark',
    'github-light',
    'nord',
    'rose-pine',
    'catppuccin-mocha',
  ]) {
    await page.locator('#theme').selectOption(theme);
    await expect(page.locator('#codeLines')).toContainText('greet');
  }
  await page.locator('#windowStyle').selectOption('none');
  await expect(page.locator('#windowHeader')).toBeHidden();
  await page.getByLabel('transparent background', { exact: true }).click();
  await expect(page.locator('#capture')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
});

test('extension bridge validates exports and queues new captures while saving', async ({
  page,
}) => {
  const { DEFAULT_SETTINGS, isExportMessage } =
    await import('../../src/shared/model');
  await page.addInitScript((settings) => {
    const messages: Record<string, unknown>[] = [];
    Object.assign(window, {
      __messages: messages,
      acquireVsCodeApi: () => ({
        postMessage: (message: Record<string, unknown>) => {
          messages.push(message);
          if (message.type === 'ready')
            queueMicrotask(() =>
              window.postMessage(
                {
                  type: 'init',
                  settings,
                  presets: [],
                  snippet: {
                    code: 'const oldCapture = true;',
                    language: 'typescript',
                    title: 'bridge.ts',
                    startLine: 42,
                  },
                },
                '*',
              ),
            );
        },
      }),
    });
  }, DEFAULT_SETTINGS);
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('#codeLines')).toContainText('oldCapture');
  await expect(page.locator('.line-number').first()).toHaveText('42');
  await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
  await page.waitForFunction(() =>
    (Reflect.get(window, '__messages') as { type: string }[]).some(
      (m) => m.type === 'export',
    ),
  );
  const payload = await page.evaluate(() =>
    (Reflect.get(window, '__messages') as { type: string }[]).find(
      (m) => m.type === 'export',
    ),
  );
  expect(isExportMessage(payload)).toBe(true);
  await page.evaluate(() =>
    window.postMessage(
      {
        type: 'snippet',
        snippet: {
          code: 'const newCapture = true;',
          language: 'typescript',
          title: 'new.ts',
          startLine: 1,
        },
      },
      '*',
    ),
  );
  await expect(page.locator('#source')).toHaveValue('const oldCapture = true;');
  await page.evaluate(() =>
    window.postMessage({ type: 'exportResult', status: 'saved' }, '*'),
  );
  await expect(page.locator('#codeLines')).toContainText('newCapture');
  await expect(
    page.getByRole('button', { name: 'Export PNG', exact: true }),
  ).toBeEnabled();
});

test('light host defaults cannot hide headings, buttons or preset names', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:4173/');
  await page.addStyleTag({
    content: 'body,h1,h2,button { color: rgb(34,34,34); }',
  });
  await page.locator('#presetName').fill('Kira');
  await page.locator('#savePreset').click();
  for (const selector of [
    '.brand h1',
    '.sidebar h2',
    '#svg',
    '#savePreset',
    '.preset-load',
  ])
    await expect(page.locator(selector)).toHaveCSS(
      'color',
      'rgb(232, 233, 241)',
    );
  await expect(page.locator('#studioIcon')).toHaveJSProperty(
    'naturalWidth',
    256,
  );
});

test('keyboard exit, resized editor scrolling, and highlights after line 1000', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:4173/');
  const source = page.locator('#source');
  await source.fill('x');
  await source.press('End');
  await source.press('Tab');
  await expect(source).toHaveValue('x  ');
  await source.press('Shift+Tab');
  await expect(page.locator('#language')).toBeFocused();
  await source.evaluate((e) => {
    e.style.height = '1600px';
  });
  await page.locator('main').evaluate((e) => {
    e.scrollTop = e.scrollHeight;
  });
  expect(
    await source.evaluate(
      (e) => e.getBoundingClientRect().bottom <= window.innerHeight,
    ),
  ).toBe(true);
  await expect(page.locator('main')).toHaveCSS('overflow-y', 'auto');
  await source.fill(Array(1002).fill('x').join('\n'));
  await page.locator('#highlightedLines').fill('1001-999999');
  await expect(page.locator('.highlighted')).toHaveCount(2);
});
