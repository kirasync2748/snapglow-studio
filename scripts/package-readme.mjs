import { readFile } from 'node:fs/promises';
const root =
  'https://raw.githubusercontent.com/kirasync2748/snapglow-studio/main/';
export async function packageReadme(
  readme,
  readAsset = (path) => readFile(path),
) {
  let result = readme;
  for (const name of ['icon.png', 'example-snippet.png', 'studio.png']) {
    const bytes = await readAsset(`assets/${name}`);
    if (
      !bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      throw new Error(`Invalid PNG asset: ${name}`);
    result = result.replaceAll(
      `${root}assets/${name}`,
      `data:image/png;base64,${bytes.toString('base64')}`,
    );
  }
  // VS Code's extension details renderer does not resolve relative document links.
  return result.replace(
    /\]\((LICENSE|[A-Z]+\.md)\)/g,
    '](https://github.com/kirasync2748/snapglow-studio/blob/main/$1)',
  );
}
