import { readFile, access } from 'node:fs/promises';
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const tag = process.env.RELEASE_TAG;
if (!tag || tag !== `v${manifest.version}` || !/^v\d+\.\d+\.\d+$/.test(tag))
  throw new Error(
    'Release tag must be v<package.json version>, for example v0.1.0.',
  );
if (
  manifest.publisher !== 'kirasync2748' ||
  manifest.name !== 'snapglow-studio'
)
  throw new Error('Unexpected publishing identity.');
if (process.env.GITHUB_REPOSITORY !== 'kirasync2748/snapglow-studio')
  throw new Error(
    'Publishing is only enabled from kirasync2748/snapglow-studio.',
  );
if (manifest.icon !== 'assets/icon.png')
  throw new Error(
    'Add the final anime artwork as assets/icon.png and set package.json icon before releasing.',
  );
await access(manifest.icon);
console.log(
  `Validated ${manifest.publisher}.${manifest.name}@${manifest.version}`,
);
