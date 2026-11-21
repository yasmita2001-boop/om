import { translations as en } from '../locales/en';

export type Locale = 'en' | 'hi' | 'ne';
const LOCALES: Locale[] = ['en', 'hi', 'ne'];

const dicts: Partial<Record<Locale, Record<string, string>>> = { en };
const localeLoads: Partial<Record<Locale, Promise<void>>> = {};

// Read locale from localStorage at module init — synchronous, no React needed
const stored = localStorage.getItem('om_locale') as Locale | null;
let _locale: Locale = stored && LOCALES.includes(stored) ? stored : 'en';
document.documentElement.lang = _locale;

export function getLocale(): Locale {
  return _locale;
}

export async function ensureLocaleLoaded(locale: Locale): Promise<void> {
  if (dicts[locale]) return;
  localeLoads[locale] ??= (async () => {
    const module = locale === 'hi'
      ? await import('../locales/hi')
      : await import('../locales/ne');
    dicts[locale] = module.translations;
  })();
  await localeLoads[locale];
}

export async function changeLocale(locale: Locale): Promise<void> {
  await setLocale(locale);
  window.location.reload();
}

export function t(key: string, params?: Record<string, string>): string {
  const dict = dicts[_locale] ?? dicts.en!;
  let str = dict[key] ?? dicts.en![key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
  }
  return str;
}

// Kept for backward compat
export async function setLocale(locale: Locale): Promise<void> {
  await ensureLocaleLoaded(locale);
  _locale = locale;
  try { localStorage.setItem('om_locale', locale); } catch { /* Locale remains available for this session. */ }
  document.documentElement.lang = locale;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('om-locale-change', { detail: { locale } }));
}
export function translate(locale: Locale, key: string, params?: Record<string, string>): string {
  const dict = dicts[locale] ?? dicts.en!;
  let str = dict[key] ?? dicts.en![key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
  }
  return str;
}

const translatableAttributes = ['placeholder', 'aria-label', 'title', 'alt'] as const;
const sourceText = new WeakMap<Text, string>();
const appliedText = new WeakMap<Text, string>();
const sourceAttributes = new WeakMap<Element, Map<string, string>>();
const appliedAttributes = new WeakMap<Element, Map<string, string>>();

type TranslationTable = {
  exact: Map<string, string>;
  templates: Array<{ pattern: RegExp; replacement: string; names: string[] }>;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function translationMap(locale: Locale): TranslationTable {
  const exact = new Map<string, string>();
  const templates: TranslationTable['templates'] = [];
  const templatePrefixes: Array<{ original: string; translated: string }> = [];
  const localeDict = dicts[locale] ?? dicts.en!;
  for (const key of Object.keys(en)) {
    const original = en[key].trim();
    const translated = localeDict[key]?.trim();
    if (!original || !translated || translated === original || exact.has(original)) continue;
    exact.set(original, translated);
    if (original.includes('{{')) {
      const names = [...original.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]);
      const parts = original.split(/\{\{\w+\}\}/g).map(escapeRegExp);
      const pattern = new RegExp(`^\\s*${parts.map((part, index) => index < names.length ? `${part}(.+?)` : part).join('')}\\s*$`, 'i');
      templates.push({ pattern, replacement: translated, names });
      const originalPrefix = original.slice(0, original.indexOf('{{')).trimEnd();
      const translatedPrefix = translated.slice(0, translated.indexOf('{{')).trimEnd();
      if (originalPrefix && translatedPrefix) templatePrefixes.push({ original: originalPrefix, translated: translatedPrefix });
    }
  }
  // JSX often renders a count label and its number as separate text nodes,
  // so the full template cannot match. Translate only its exact static prefix.
  for (const { original, translated } of templatePrefixes) {
    if (!exact.has(original)) exact.set(original, translated);
  }
  return { exact, templates };
}

function translateContent(original: string, table: TranslationTable, locale: Locale): string {
  if (locale === 'en') return original;
  const trimmed = original.trim();
  const exact = table.exact.get(trimmed);
  if (exact) return original.replace(trimmed, exact);
  for (const template of table.templates) {
    const match = template.pattern.exec(trimmed);
    if (!match) continue;
    let result = template.replacement;
    template.names.forEach((name, index) => {
      result = result.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), match[index + 1]);
    });
    return original.replace(trimmed, result);
  }
  return original;
}

function canTranslateText(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent || !node.nodeValue?.trim()) return false;
  return !parent.closest('script, style, noscript, code, pre, [contenteditable="true"], .ProseMirror, .note-rich-editor');
}

function localizeText(node: Text, map: TranslationTable, locale: Locale): void {
  if (!canTranslateText(node)) return;
  const current = node.nodeValue || '';
  const previousApplied = appliedText.get(node);
  let original = sourceText.get(node) ?? current;
  if (previousApplied !== undefined && current !== previousApplied) {
    original = current;
    sourceText.set(node, original);
  }
  if (previousApplied === undefined) sourceText.set(node, original);
  const next = translateContent(original, map, locale);
  appliedText.set(node, next);
  if (current !== next) node.nodeValue = next;
}

function localizeAttributes(element: Element, map: TranslationTable, locale: Locale): void {
  let originals = sourceAttributes.get(element);
  if (!originals) { originals = new Map(); sourceAttributes.set(element, originals); }
  let applied = appliedAttributes.get(element);
  if (!applied) { applied = new Map(); appliedAttributes.set(element, applied); }
  for (const attribute of translatableAttributes) {
    const current = element.getAttribute(attribute);
    if (current === null || !current.trim()) continue;
    const previousApplied = applied.get(attribute);
    let original = originals.get(attribute) ?? current;
    if (previousApplied !== undefined && current !== previousApplied) {
      original = current;
      originals.set(attribute, original);
    } else if (!originals.has(attribute)) originals.set(attribute, original);
    const translated = translateContent(original, map, locale);
    applied.set(attribute, translated);
    if (current !== translated) element.setAttribute(attribute, translated);
  }
}

export function installDOMLocalization(root: ParentNode = document): () => void {
  let locale = getLocale();
  let map = translationMap(locale);
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      localizeText(node as Text, map, locale);
      return;
    }
    if (node.nodeType === Node.DOCUMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      node.childNodes.forEach(visit);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    localizeAttributes(element, map, locale);
    element.childNodes.forEach(visit);
  };
  visit(root as Node);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') localizeText(record.target as Text, map, locale);
      else if (record.type === 'attributes') localizeAttributes(record.target as Element, map, locale);
      else record.addedNodes.forEach(visit);
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...translatableAttributes] });
  const handleLocaleChange = (event: Event) => {
    locale = (event as CustomEvent<{ locale: Locale }>).detail.locale;
    map = translationMap(locale);
    visit(root as Node);
  };
  window.addEventListener('om-locale-change', handleLocaleChange);
  return () => {
    observer.disconnect();
    window.removeEventListener('om-locale-change', handleLocaleChange);
  };
}
