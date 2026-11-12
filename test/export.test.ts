import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveExport } from '../src/shared/export.ts';
const message = {
  type: 'export',
  format: 'png',
  filename: 'hello.png',
  data: 'data:image/png;base64,iVBORw0KGgo=',
};
test('save uses the exact user-chosen destination and propagates write failures', async () => {
  const writes: { destination: string; bytes: Uint8Array }[] = [];
  assert.equal(
    await saveExport(
      message,
      async () => '/chosen/folder/renamed.png',
      async (destination, bytes) => {
        writes.push({ destination, bytes });
      },
    ),
    'saved',
  );
  assert.equal(writes[0]?.destination, '/chosen/folder/renamed.png');
  assert.equal(writes[0]?.bytes.length, 8);
  await assert.rejects(
    saveExport(
      message,
      async () => '/read-only/file.png',
      async () => {
        throw new Error('Permission denied');
      },
    ),
    /Permission denied/,
  );
});
test('cancelling never writes and malformed PNG is rejected before opening dialog', async () => {
  let writes = 0,
    dialogs = 0;
  assert.equal(
    await saveExport(
      message,
      async () => undefined,
      async () => {
        writes++;
      },
    ),
    'cancelled',
  );
  assert.equal(writes, 0);
  await assert.rejects(
    saveExport(
      { ...message, data: 'data:image/png;base64,YWJj' },
      async () => {
        dialogs++;
        return 'x';
      },
      async () => {
        writes++;
      },
    ),
    /Invalid PNG/,
  );
  assert.equal(dialogs, 0);
  assert.equal(writes, 0);
});
