import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { packageReadme } from '../scripts/package-readme.mjs';
test('packaged README embeds all artwork and keeps publisher links', async () => {
  const source = await readFile('README.md', 'utf8');
  const result = await packageReadme(source);
  for (const name of ['icon.png', 'example-snippet.png', 'studio.png']) {
    const bytes = await readFile(`assets/${name}`);
    assert.ok(
      result.includes(`data:image/png;base64,${bytes.toString('base64')}`),
      name,
    );
    assert.ok(
      !result.includes(
        `raw.githubusercontent.com/kirasync2748/snapglow-studio/main/assets/${name}`,
      ),
    );
  }
  assert.ok(
    result.includes(
      'https://github.com/kirasync2748/snapglow-studio/blob/main/PRIVACY.md',
    ),
  );
  assert.ok(
    result.includes(
      'marketplace.visualstudio.com/items?itemName=kirasync2748.snapglow-studio',
    ),
  );
  assert.ok(source.includes('raw.githubusercontent.com'));
});
test('non-PNG artwork cannot be embedded', async () => {
  await assert.rejects(
    packageReadme('README', async () => Buffer.from('<svg/>')),
    /Invalid PNG/,
  );
});
