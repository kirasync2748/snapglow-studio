export const THEMES = [
  'tokyo-night',
  'dracula',
  'github-dark',
  'github-light',
  'nord',
  'rose-pine',
  'catppuccin-mocha',
] as const;
export { LANGUAGES, resolveLanguage } from './languages.ts';
export const BACKGROUNDS = {
  aurora: 'linear-gradient(135deg, #f2b8cf 0%, #b5a4eb 50%, #8caef0 100%)',
  midnight: 'linear-gradient(135deg, #151a38, #5a3885 55%, #c278a1)',
  ocean: 'linear-gradient(135deg, #86efd5, #61b3e8 55%, #697edc)',
  ember: 'linear-gradient(135deg, #ffd69b, #f2a3a8 55%, #be80c6)',
  forest: 'linear-gradient(135deg, #173b35, #508174 55%, #c4dcb5)',
  mono: '#272a35',
  transparent: 'transparent',
} as const;
export interface Settings {
  theme: (typeof THEMES)[number];
  background: keyof typeof BACKGROUNDS;
  customColor: string;
  useCustomColor: boolean;
  padding: number;
  fontSize: number;
  lineHeight: number;
  radius: number;
  shadow: number;
  width: number;
  scale: number;
  windowStyle: 'mac' | 'minimal' | 'none';
  lineNumbers: boolean;
  startLine: number;
  trimIndent: boolean;
  title: string;
  highlightedLines: string;
}
export const DEFAULT_SETTINGS: Settings = {
  theme: 'tokyo-night',
  background: 'aurora',
  customColor: '#c6a5f7',
  useCustomColor: false,
  padding: 56,
  fontSize: 15,
  lineHeight: 1.8,
  radius: 14,
  shadow: 35,
  width: 760,
  scale: 2,
  windowStyle: 'mac',
  lineNumbers: true,
  startLine: 1,
  trimIndent: true,
  title: 'hello.ts',
  highlightedLines: '',
};
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const inRange = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
export function parseSettings(v: unknown): Settings | undefined {
  if (!record(v)) return;
  if (
    !THEMES.includes(v.theme as Settings['theme']) ||
    !Object.hasOwn(BACKGROUNDS, String(v.background))
  )
    return;
  if (
    typeof v.customColor !== 'string' ||
    !/^#[\da-f]{6}$/i.test(v.customColor)
  )
    return;
  for (const [k, min, max] of [
    ['padding', 0, 120],
    ['fontSize', 10, 28],
    ['lineHeight', 1.2, 2.4],
    ['radius', 0, 32],
    ['shadow', 0, 60],
    ['width', 400, 1400],
    ['scale', 1, 4],
    ['startLine', 1, 1000000],
  ] as const) {
    if (!inRange(v[k], min, max)) return;
  }
  if (![1, 2, 3, 4].includes(Number(v.scale)) || !Number.isInteger(v.startLine))
    return;
  if (!['mac', 'minimal', 'none'].includes(String(v.windowStyle))) return;
  if (
    ['useCustomColor', 'lineNumbers', 'trimIndent'].some(
      (k) => typeof v[k] !== 'boolean',
    )
  )
    return;
  if (
    typeof v.title !== 'string' ||
    v.title.length > 120 ||
    typeof v.highlightedLines !== 'string' ||
    !/^[\d,\s-]{0,100}$/.test(v.highlightedLines)
  )
    return;
  const result = {} as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS)) result[key] = v[key];
  return result as unknown as Settings;
}
export interface Preset {
  name: string;
  settings: Settings;
}
export function parsePresets(v: unknown): Preset[] | undefined {
  if (!Array.isArray(v) || v.length > 12) return;
  const out: Preset[] = [];
  for (const item of v) {
    if (
      !record(item) ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      item.name.length > 32
    )
      return;
    const settings = parseSettings(item.settings);
    if (!settings) return;
    out.push({ name: item.name.trim(), settings });
  }
  return out;
}
export interface Snippet {
  code: string;
  language: string;
  title: string;
  startLine: number;
}
export const MAX_CODE_LENGTH = 30000;
export const SAMPLE: Snippet = {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: literal sample source, never interpolate it.
  code: '// A little code. A lot of possibility.\nconst greet = (name: string) => {\n  return `Hello, ${name}!`;\n};\n\ngreet("developer");',
  language: 'typescript',
  title: 'hello.ts',
  startLine: 1,
};
export function normalizeCode(code: string, trim: boolean): string {
  const lines = code.replace(/\r\n?/g, '\n').split('\n');
  if (!trim) return lines.join('\n');
  const nonempty = lines.filter((l) => l.trim());
  const indent = Math.min(
    ...nonempty.map((l) => l.match(/^\s*/)?.[0].length ?? 0),
  );
  return lines
    .map((l) => l.slice(Number.isFinite(indent) ? indent : 0))
    .join('\n');
}
export function highlightedLines(
  value: string,
  lineCount: number,
): Set<number> {
  const result = new Set<number>();
  for (const part of value.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) continue;
    const from = Number(match[1]),
      to = Number(match[2] ?? match[1]);
    for (let n = Math.max(1, from); n <= Math.min(to, lineCount); n++)
      result.add(n);
  }
  return result;
}
export function safeFilename(title: string, format: 'png' | 'svg'): string {
  const stem = Array.from(
    title.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]/gu, '-'),
  )
    .slice(0, 60)
    .join('');
  return `${stem || 'snippet'}.${format}`;
}
export function isExportMessage(value: unknown): value is {
  type: 'export';
  format: 'png' | 'svg';
  data: string;
  filename: string;
} {
  if (
    !record(value) ||
    value.type !== 'export' ||
    !['png', 'svg'].includes(String(value.format))
  )
    return false;
  if (
    typeof value.filename !== 'string' ||
    !/^[\p{L}\p{N}_-]{1,60}\.(png|svg)$/u.test(value.filename) ||
    !value.filename.endsWith(`.${value.format}`)
  )
    return false;
  if (typeof value.data !== 'string' || value.data.length > 28_000_000)
    return false;
  const prefix =
    value.format === 'png'
      ? 'data:image/png;base64,'
      : 'data:image/svg+xml;base64,';
  return (
    value.data.startsWith(prefix) &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value.data.slice(prefix.length))
  );
}
