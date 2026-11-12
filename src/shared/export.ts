import { Buffer } from 'node:buffer';
import { isExportMessage } from './model.ts';
export async function saveExport<T>(
  message: unknown,
  choose: () => Promise<T | undefined>,
  write: (destination: T, bytes: Uint8Array) => Promise<void>,
): Promise<'saved' | 'cancelled'> {
  if (!isExportMessage(message)) throw new Error('Invalid image export.');
  const bytes = Buffer.from(
    message.data.slice(message.data.indexOf(',') + 1),
    'base64',
  );
  if (
    message.format === 'png' &&
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error('Invalid PNG image.');
  const destination = await choose();
  if (destination === undefined) return 'cancelled';
  await write(destination, bytes);
  return 'saved';
}
