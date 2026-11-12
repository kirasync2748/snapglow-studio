import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundledLanguages, bundledLanguagesInfo } from 'shiki/langs';
import { createHighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import { LANGUAGES, resolveLanguage } from '../src/shared/languages.ts';
test('complete bundled catalog loads and tokenizes with the production engine', async () => {
  assert.deepEqual(
    [...LANGUAGES].filter((l) => l !== 'text'),
    bundledLanguagesInfo.map((l) => l.id),
  );
  const h = await createHighlighterCore({
    themes: [import('shiki/themes/tokyo-night.mjs')],
    langs: [],
    engine: createOnigurumaEngine(import('shiki/wasm')),
  });
  try {
    for (const lang of bundledLanguagesInfo) {
      await h.loadLanguage(
        bundledLanguages[lang.id as keyof typeof bundledLanguages],
      );
      const result = h.codeToTokens('hello = "world"; // example', {
        lang: lang.id,
        theme: 'tokyo-night',
      });
      assert.ok(result.tokens.length, lang.id);
      for (const alias of lang.aliases ?? [])
        assert.equal(resolveLanguage(alias), lang.id);
    }
  } finally {
    h.dispose();
  }
  assert.equal(resolveLanguage('shellscript'), 'shellscript');
  assert.equal(resolveLanguage('typescriptreact'), 'tsx');
  assert.equal(resolveLanguage('javascriptreact'), 'jsx');
  assert.equal(resolveLanguage('unknown-custom-grammar'), 'text');
});
