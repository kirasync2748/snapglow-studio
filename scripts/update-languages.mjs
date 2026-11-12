import { bundledLanguagesInfo } from 'shiki/langs';
import { writeFile } from 'node:fs/promises';
const aliases = {
  plaintext: 'text',
  shellscript: 'shell',
  javascriptreact: 'jsx',
  typescriptreact: 'tsx',
  bat: 'batch',
  dockerfile: 'docker',
};
for (const lang of bundledLanguagesInfo) {
  aliases[lang.id] = lang.id;
  for (const alias of lang.aliases ?? []) aliases[alias] = lang.id;
}
await writeFile(
  'src/shared/languages.ts',
  `// Generated from the locked Shiki catalog by scripts/update-languages.mjs.\nexport const LANGUAGES: readonly string[] = ${JSON.stringify([...bundledLanguagesInfo.map((l) => l.id), 'text'])};\nconst aliases: Record<string,string> = ${JSON.stringify(aliases)};\nexport function resolveLanguage(id:string):string { return Object.hasOwn(aliases,id.toLowerCase()) ? aliases[id.toLowerCase()] ?? 'text' : 'text'; }\n`,
);
