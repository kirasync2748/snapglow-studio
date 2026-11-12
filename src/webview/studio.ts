import { createHighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import { bundledLanguages } from 'shiki/langs';
import { toPng, toSvg, toBlob } from 'html-to-image';
import {
  BACKGROUNDS,
  DEFAULT_SETTINGS,
  LANGUAGES,
  resolveLanguage,
  MAX_CODE_LENGTH,
  SAMPLE,
  THEMES,
  highlightedLines,
  normalizeCode,
  parseSettings,
  parsePresets,
  safeFilename,
  type Settings,
  type Snippet,
  type Preset,
} from '../shared/model';

declare const acquireVsCodeApi:
  undefined | (() => { postMessage: (message: unknown) => void });
const api =
  typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;
let settings = { ...DEFAULT_SETTINGS };
let snippet: Snippet = { ...SAMPLE };
let presets: Preset[] = [];
let busy = false;
let pendingSnippet: Snippet | undefined;
let initialized = false;
let renderVersion = 0;
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Studio root missing');
const download =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>';
const options = (values: readonly string[]) =>
  values
    .map((v) => `<option value="${v}">${v.replaceAll('-', ' ')}</option>`)
    .join('');
function range(
  key: keyof Settings,
  label: string,
  min: number,
  max: number,
  step = 1,
): string {
  return `<label class="range-label" for="${key}">${label}<output id="${key}-value"></output></label><input id="${key}" data-setting="${key}" type="range" min="${min}" max="${max}" step="${step}">`;
}
app.innerHTML = `
<header class="topbar"><div class="brand"><span class="brand-icon"><img id="studioIcon" alt="Snapglow anime icon"></span><div><h1>snapglow<span class="brand-dot">.</span></h1><p>CODE SNAP STUDIO</p></div></div><div class="privacy"><span></span>Made here. Stays here.</div><div class="export-actions"><button id="copy" class="button ghost" title="Copy PNG to clipboard">Copy image</button><button id="svg" class="button secondary">SVG</button><button id="export" class="button primary">${download} Export PNG</button></div></header>
<div class="layout"><aside class="sidebar"><div class="sidebar-heading"><span class="eyebrow">THE DETAILS</span><h2>Make it yours<span>.</span></h2></div>
<fieldset id="controls"><section class="control-section"><h3>01 <span>Background</span></h3><div id="backgrounds" class="swatches"></div><div class="color-row"><label class="toggle-label"><input type="checkbox" data-setting="useCustomColor">Custom color</label><input type="color" aria-label="Custom background color" data-setting="customColor"></div></section>
<section class="control-section"><h3>02 <span>Code window</span></h3><label for="theme">Syntax theme</label><select id="theme" data-setting="theme">${options(THEMES)}</select><label for="windowStyle">Window style</label><select id="windowStyle" data-setting="windowStyle"><option value="mac">macOS dots</option><option value="minimal">Minimal title</option><option value="none">No header</option></select><div class="two-col"><div><label for="fontSize">Font size</label><input id="fontSize" data-setting="fontSize" type="number" min="10" max="28"></div><div><label for="scale">Export scale</label><select id="scale" data-setting="scale"><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option></select></div></div>
${range('padding', 'Canvas padding', 0, 120)}${range('width', 'Window width', 400, 1400, 20)}${range('radius', 'Corner radius', 0, 32)}${range('shadow', 'Shadow', 0, 60)}${range('lineHeight', 'Line spacing', 1.2, 2.4, 0.1)}</section>
<section class="control-section"><h3>03 <span>Finishing touches</span></h3><label class="toggle-label"><input type="checkbox" data-setting="lineNumbers">Line numbers</label><label class="toggle-label"><input type="checkbox" data-setting="trimIndent">Remove common indentation</label><label for="startLine">First line number</label><input id="startLine" data-setting="startLine" type="number" min="1" max="1000000"><label for="highlightedLines">Highlight lines</label><input id="highlightedLines" data-setting="highlightedLines" maxlength="100" placeholder="e.g. 2, 4-6"><p class="hint">Relative to this snippet, starting at 1.</p></section>
<section class="control-section presets"><h3>04 <span>Your presets</span></h3><label for="presetName">Preset name</label><div class="preset-create"><input id="presetName" maxlength="32" placeholder="My signature look"><button id="savePreset" class="button secondary" title="Save preset">+</button></div><div id="presetList"></div><button id="reset" class="reset">Reset appearance</button></section></fieldset><footer class="sidebar-footer">NO ACCOUNTS. NO UPLOADS. JUST CODE.</footer></aside>
<main><div class="workspace-bar"><div><span class="live-dot"></span><span class="eyebrow">LIVE CANVAS</span></div><span id="dimensions">Preparing preview…</span></div><div class="preview-area" id="previewArea"><div id="previewSizer"><div id="previewZoom"><div id="capture"><div id="codeWindow"><div id="windowHeader"><div class="window-dots"><i></i><i></i><i></i></div><span id="windowTitle"></span><span class="window-spacer"></span></div><div id="codeLines"></div></div></div></div></div></div><div class="canvas-footer"><span>Every line deserves a good frame.</span><span id="zoomLabel">FIT TO VIEW</span></div>
<section class="editor-section"><div class="editor-toolbar"><div class="editor-heading"><span class="code-icon">&lt;/&gt;</span><h2>Your snippet</h2></div><div class="editor-fields"><input id="title" data-setting="title" aria-label="Window title" maxlength="120" spellcheck="false"><select id="language" aria-label="Code language">${options(LANGUAGES)}</select></div></div><textarea id="source" aria-label="Code to capture" maxlength="${MAX_CODE_LENGTH}" spellcheck="false"></textarea><div class="editor-footer"><span>Tab indents · Shift+Tab leaves the editor.</span><span id="charCount"></span></div></section><div id="status" role="status" aria-live="polite">Ready to make something beautiful.</div></main></div>`;
const scriptSource =
  document.querySelector<HTMLScriptElement>('script[src]')?.src;
const studioIcon = document.getElementById('studioIcon') as HTMLImageElement;
if (scriptSource) studioIcon.src = new URL('icon.png', scriptSource).href;
function element<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing ${id}`);
  return e as T;
}
const capture = element<HTMLDivElement>('capture');
const source = element<HTMLTextAreaElement>('source');
const language = element<HTMLSelectElement>('language');
const status = (message: string, error = false) => {
  element('status').textContent = message;
  element('status').classList.toggle('error', error);
};
const highlighter = createHighlighterCore({
  themes: [
    import('shiki/themes/tokyo-night.mjs'),
    import('shiki/themes/dracula.mjs'),
    import('shiki/themes/github-dark.mjs'),
    import('shiki/themes/github-light.mjs'),
    import('shiki/themes/nord.mjs'),
    import('shiki/themes/rose-pine.mjs'),
    import('shiki/themes/catppuccin-mocha.mjs'),
  ],
  langs: [],
  engine: createOnigurumaEngine(import('shiki/wasm')),
});
for (const [name, color] of Object.entries(BACKGROUNDS)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch';
  b.dataset.background = name;
  if (name !== 'transparent') b.style.background = color;
  b.setAttribute('aria-label', `${name} background`);
  b.title = name;
  b.addEventListener('click', () => {
    settings.background = name as Settings['background'];
    settings.useCustomColor = false;
    syncControls();
    void render();
    persist();
  });
  element('backgrounds').append(b);
}
function syncControls(): void {
  for (const input of document.querySelectorAll<
    HTMLInputElement | HTMLSelectElement
  >('[data-setting]')) {
    const key = input.dataset.setting as keyof Settings;
    if (input instanceof HTMLInputElement && input.type === 'checkbox')
      input.checked = Boolean(settings[key]);
    else input.value = String(settings[key]);
  }
  for (const button of document.querySelectorAll<HTMLElement>(
    '[data-background]',
  ))
    button.setAttribute(
      'aria-pressed',
      String(
        !settings.useCustomColor &&
          button.dataset.background === settings.background,
      ),
    );
  source.value = snippet.code;
  language.value = resolveLanguage(snippet.language);
}
let persistTimer: ReturnType<typeof setTimeout> | undefined;
function persist(): void {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    if (initialized) api?.postMessage({ type: 'persist', settings, presets });
  }, 200);
}
function fit(): void {
  const area = element('previewArea'),
    zoom = element('previewZoom'),
    sizer = element('previewSizer');
  const scale = Math.min(
    1,
    (area.clientWidth - 64) / capture.offsetWidth,
    (area.clientHeight - 56) / capture.offsetHeight,
  );
  const safeScale = Math.max(0.05, scale);
  zoom.style.transform = `scale(${safeScale})`;
  sizer.style.width = `${capture.offsetWidth * safeScale}px`;
  sizer.style.height = `${capture.offsetHeight * safeScale}px`;
  element('zoomLabel').textContent =
    `${Math.round(safeScale * 100)}% · FIT TO VIEW`;
  element('dimensions').textContent =
    `${capture.offsetWidth * settings.scale} × ${capture.offsetHeight * settings.scale} px`;
}
async function render(): Promise<boolean> {
  const version = ++renderVersion;
  try {
    const h = await highlighter;
    if (version !== renderVersion) return false;
    const lang = resolveLanguage(snippet.language);
    if (lang !== 'text' && !h.getLoadedLanguages().includes(lang)) {
      await h.loadLanguage(
        bundledLanguages[lang as keyof typeof bundledLanguages],
      );
      if (version !== renderVersion) return false;
    }
    const result = h.codeToTokens(
      normalizeCode(snippet.code, settings.trimIndent),
      {
        lang,
        theme: settings.theme,
      },
    );
    capture.style.cssText = `padding:${settings.padding}px;background:${settings.useCustomColor ? settings.customColor : BACKGROUNDS[settings.background]};`;
    const win = element('codeWindow');
    win.style.cssText = `width:${settings.width}px;border-radius:${settings.radius}px;background:${result.bg};color:${result.fg};box-shadow:0 ${settings.shadow / 2}px ${settings.shadow * 2}px -10px #0007;font-size:${settings.fontSize}px;line-height:${settings.lineHeight};`;
    const header = element('windowHeader');
    header.hidden = settings.windowStyle === 'none';
    header.dataset.style = settings.windowStyle;
    element('windowTitle').textContent = settings.title;
    const lines = element('codeLines');
    lines.replaceChildren();
    const highlights = highlightedLines(
      settings.highlightedLines,
      result.tokens.length,
    );
    result.tokens.forEach((line, i) => {
      const row = document.createElement('div');
      row.className = `code-line${highlights.has(i + 1) ? ' highlighted' : ''}`;
      if (settings.lineNumbers) {
        const num = document.createElement('span');
        num.className = 'line-number';
        num.textContent = String(settings.startLine + i);
        row.append(num);
      }
      const text = document.createElement('span');
      text.className = 'line-content';
      for (const token of line) {
        const span = document.createElement('span');
        span.textContent = token.content;
        span.style.color = token.color ?? result.fg ?? 'inherit';
        if (token.fontStyle) {
          if (token.fontStyle & 1) span.style.fontStyle = 'italic';
          if (token.fontStyle & 2) span.style.fontWeight = 'bold';
          if (token.fontStyle & 4) span.style.textDecoration = 'underline';
        }
        text.append(span);
      }
      if (!line.length) text.textContent = ' ';
      row.append(text);
      lines.append(row);
    });
    for (const key of [
      'padding',
      'width',
      'radius',
      'shadow',
      'lineHeight',
    ] as const)
      element(`${key}-value`).textContent =
        `${settings[key]}${key === 'lineHeight' ? '×' : 'px'}`;
    element('charCount').textContent =
      `${snippet.code.length.toLocaleString()} / 30,000`;
    fit();
    return true;
  } catch {
    status(
      'Syntax preview failed. Change the language or reopen the studio.',
      true,
    );
    return false;
  }
}
for (const input of document.querySelectorAll<
  HTMLInputElement | HTMLSelectElement
>('[data-setting]'))
  input.addEventListener('input', () => {
    const key = input.dataset.setting as keyof Settings;
    const value =
      input instanceof HTMLInputElement && input.type === 'checkbox'
        ? input.checked
        : typeof DEFAULT_SETTINGS[key] === 'number'
          ? Number(input.value)
          : input.value;
    const next = parseSettings({ ...settings, [key]: value });
    if (!next) return;
    settings = next;
    void render();
    persist();
  });
let editorTimer: ReturnType<typeof setTimeout> | undefined;
source.addEventListener('input', () => {
  snippet.code = source.value;
  clearTimeout(editorTimer);
  editorTimer = setTimeout(() => void render(), 120);
});
language.addEventListener('change', () => {
  snippet.language = language.value;
  void render();
});
source.addEventListener('keydown', (event) => {
  if (event.key === 'Tab' && !event.shiftKey) {
    event.preventDefault();
    source.setRangeText(
      '  ',
      source.selectionStart,
      source.selectionEnd,
      'end',
    );
    source.dispatchEvent(new Event('input'));
  }
});
function showPresets(): void {
  element('presetList').replaceChildren();
  for (const [index, preset] of presets.entries()) {
    const row = document.createElement('div');
    row.className = 'preset-row';
    const load = document.createElement('button');
    load.className = 'preset-load';
    load.textContent = preset.name;
    load.addEventListener('click', () => {
      settings = { ...preset.settings };
      syncControls();
      void render();
      persist();
    });
    const remove = document.createElement('button');
    remove.className = 'preset-delete';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Delete ${preset.name}`);
    remove.addEventListener('click', () => {
      presets.splice(index, 1);
      showPresets();
      persist();
    });
    row.append(load, remove);
    element('presetList').append(row);
  }
}
element('savePreset').addEventListener('click', () => {
  const input = element<HTMLInputElement>('presetName'),
    name = input.value.trim();
  if (!name) {
    status('Give your preset a name first.', true);
    input.focus();
    return;
  }
  const existing = presets.findIndex((p) => p.name === name);
  if (existing < 0 && presets.length >= 12) {
    status('You can save up to 12 presets. Delete one to add another.', true);
    return;
  }
  const preset = { name, settings: { ...settings } };
  if (existing >= 0) presets[existing] = preset;
  else presets.push(preset);
  input.value = '';
  showPresets();
  persist();
  status('Preset saved.');
});
element('reset').addEventListener('click', () => {
  settings = {
    ...DEFAULT_SETTINGS,
    title: settings.title,
    startLine: settings.startLine,
  };
  syncControls();
  void render();
  persist();
  status('Appearance reset.');
});
function setBusy(value: boolean): void {
  busy = value;
  element<HTMLFieldSetElement>('controls').disabled = value;
  for (const id of ['copy', 'svg', 'export', 'title', 'language', 'source'])
    (element(id) as HTMLInputElement | HTMLButtonElement).disabled = value;
  element('export').innerHTML = value ? 'Exporting…' : `${download} Export PNG`;
  if (!value && pendingSnippet) {
    applySnippet(pendingSnippet);
    pendingSnippet = undefined;
  }
}
function asBase64(uri: string): string {
  const comma = uri.indexOf(',');
  const header = uri.slice(0, comma),
    body = uri.slice(comma + 1);
  if (header.endsWith(';base64')) return uri;
  const bytes = new TextEncoder().encode(decodeURIComponent(body));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
async function exportImage(format: 'png' | 'svg', copy = false): Promise<void> {
  if (busy) return;
  setBusy(true);
  status('Rendering your image…');
  try {
    if (!(await render()))
      throw new Error('Preview is not ready. Please try again.');
    await document.fonts.ready;
    const width = capture.offsetWidth,
      height = capture.offsetHeight;
    if (
      width * height * settings.scale ** 2 > 40_000_000 ||
      width * settings.scale > 16000 ||
      height * settings.scale > 16000
    )
      throw new Error(
        'Image is too large. Reduce the snippet, font size, or export scale.',
      );
    const opts = {
      pixelRatio: settings.scale,
      cacheBust: false,
      skipAutoScale: true,
    };
    if (copy) {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined')
        throw new Error(
          'Image clipboard is unavailable here. Use Export PNG instead.',
        );
      const blob = toBlob(capture, opts).then((value) => {
        if (!value) throw new Error('Image could not be rendered.');
        return value;
      });
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      status('Image copied to clipboard.');
      setBusy(false);
      return;
    }
    const raw =
      format === 'png'
        ? await toPng(capture, opts)
        : await toSvg(capture, opts);
    const data = asBase64(raw),
      filename = safeFilename(settings.title, format);
    if (data.length > 28_000_000)
      throw new Error('Image exceeds the 20 MB limit. Lower the export scale.');
    if (api) api.postMessage({ type: 'export', format, data, filename });
    else {
      const link = document.createElement('a');
      link.href = data;
      link.download = filename;
      link.click();
      status(`${format.toUpperCase()} exported.`);
      setBusy(false);
    }
  } catch (error) {
    status(
      error instanceof Error
        ? error.message
        : 'Export failed. Please try again.',
      true,
    );
    setBusy(false);
  }
}
element('export').addEventListener('click', () => void exportImage('png'));
element('svg').addEventListener('click', () => void exportImage('svg'));
element('copy').addEventListener('click', () => void exportImage('png', true));
function applySnippet(value: Snippet): void {
  snippet = value;
  settings.title = snippet.title.slice(0, 120);
  settings.startLine = Math.max(1, Math.min(1000000, snippet.startLine));
  initialized = true;
  syncControls();
  showPresets();
  void render();
}
window.addEventListener('message', (event: MessageEvent) => {
  if (!api) return;
  const m = event.data;
  if (!m || typeof m !== 'object') return;
  if (m.type === 'init' || m.type === 'snippet') {
    if (
      m.snippet &&
      typeof m.snippet.code === 'string' &&
      m.snippet.code.length <= MAX_CODE_LENGTH &&
      typeof m.snippet.language === 'string' &&
      typeof m.snippet.title === 'string' &&
      Number.isInteger(m.snippet.startLine)
    ) {
      if (m.type === 'init') {
        settings = parseSettings(m.settings) ?? { ...DEFAULT_SETTINGS };
        presets = parsePresets(m.presets) ?? [];
      }
      if (busy) pendingSnippet = m.snippet;
      else applySnippet(m.snippet);
    }
  } else if (m.type === 'exportResult') {
    setBusy(false);
    status(
      m.status === 'saved'
        ? 'Your image is saved.'
        : m.status === 'cancelled'
          ? 'Export cancelled.'
          : String(m.message || 'Export failed.'),
      m.status === 'error',
    );
  }
});
new ResizeObserver(fit).observe(element('previewArea'));
syncControls();
showPresets();
void render();
if (api) api.postMessage({ type: 'ready' });
else {
  initialized = true;
  status('Preview mode · exports stay in your browser.');
}
