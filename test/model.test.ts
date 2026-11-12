import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  parseSettings,
  parsePresets,
  normalizeCode,
  highlightedLines,
  safeFilename,
  isExportMessage,
} from '../src/shared/model.ts';
test('settings round-trip, reject unsafe values and strip unexpected keys', () => {
  assert.deepEqual(parseSettings(DEFAULT_SETTINGS), DEFAULT_SETTINGS);
  for (const patch of [
    { theme: 'injected' },
    { background: '__proto__' },
    { customColor: 'url(https://evil)' },
    { padding: NaN },
    { width: 90000 },
    { scale: 1.5 },
    { startLine: 1.2 },
    { lineNumbers: 'true' },
    { highlightedLines: 'url(x)' },
    { title: 'x'.repeat(121) },
  ])
    assert.equal(parseSettings({ ...DEFAULT_SETTINGS, ...patch }), undefined);
  assert.deepEqual(
    parseSettings({ ...DEFAULT_SETTINGS, extra: 'evil' }),
    DEFAULT_SETTINGS,
  );
});
test('preset limits, validation and canonicalization', () => {
  assert.deepEqual(
    parsePresets([{ name: '  Work  ', settings: DEFAULT_SETTINGS }]),
    [{ name: 'Work', settings: DEFAULT_SETTINGS }],
  );
  for (const value of [
    null,
    {},
    Array(13).fill({ name: 'x', settings: DEFAULT_SETTINGS }),
    [{ name: '', settings: DEFAULT_SETTINGS }],
    [{ name: 'X', settings: {} }],
  ])
    assert.equal(parsePresets(value), undefined);
});
test('indentation handles CRLF, blank lines, tabs and untrimmed code', () => {
  assert.equal(normalizeCode('    a\r\n      b\r\n', true), 'a\n  b\n');
  assert.equal(normalizeCode('\t\ta\n\t\t  b', true), 'a\n  b');
  assert.equal(normalizeCode('  a\r\n', false), '  a\n');
  assert.equal(normalizeCode('\n\n', true), '\n\n');
});
test('highlights are bounded, relative and accept ranges', () => {
  assert.deepEqual(
    [...highlightedLines('2,4-6,0,-2,nonsense,8-7', 10)],
    [2, 4, 5, 6],
  );
  assert.equal(highlightedLines('1-999999999', 1200).size, 1200);
  assert.deepEqual(
    [...highlightedLines('1001-2000', 1200)],
    Array.from({ length: 200 }, (_, i) => 1001 + i),
  );
  assert.equal(highlightedLines('1-999999999', 0).size, 0);
});
test('file names cannot traverse paths and preserve Unicode names', () => {
  assert.equal(safeFilename('../../secret.ts', 'png'), '------secret.png');
  assert.equal(safeFilename('hello.ts', 'svg'), 'hello.svg');
  assert.equal(safeFilename('日本.ts', 'png'), '日本.png');
  assert.equal(safeFilename('', 'png'), 'snippet.png');
});
test('export envelope rejects arbitrary writes, mismatched formats and malformed base64', () => {
  const valid = {
    type: 'export',
    format: 'png',
    data: 'data:image/png;base64,iVBORw0KGgo=',
    filename: 'hello.png',
  };
  assert.equal(isExportMessage(valid), true);
  for (const patch of [
    { filename: '../secret.png' },
    { filename: 'hello.svg' },
    { format: 'exe' },
    { data: 'file:///etc/passwd' },
    { data: 'data:image/png;base64,???' },
    { data: 'data:image/png;base64,' },
    { type: 'write' },
  ])
    assert.equal(isExportMessage({ ...valid, ...patch }), false);
  assert.equal(
    isExportMessage({
      ...valid,
      format: 'svg',
      filename: 'hello.svg',
      data: 'data:image/svg+xml;base64,PHN2Zz4=',
    }),
    true,
  );
});
