import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  List, Palette, Highlighter,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Indent, Outdent, RemoveFormatting, Table as TableIcon,
  ChevronDown, Plus, Minus, Trash2, Hash,
  Volume2, X, Columns,
  Undo2, Redo2,
  Sigma, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, PaintBucket, Eraser, Rows3, ImagePlus
} from 'lucide-react';
import { sanitizeHtml } from '../lib/sanitizeHtml';
import { generateUUID, storage } from '../lib/storage';
import {
  evaluateTableFormula,
  formatCellNumber,
  columnLabel,
  shiftFormulaReferences,
  toNumber,
  numbersFromGrid,
  statsForValues,
  type RangeStats
} from '../lib/tableFormulas';
import { TextReaderController, VoiceLanguage, isSpeechSynthesisSupported } from '../lib/voiceService';

export interface NoteRichEditorProps {
  initialHtml?: string;
  onChange: (html: string, plainText: string) => void;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
}

// Curated Color Palettes
const COLOR_PALETTES = [
  {
    category: 'Neutrals',
    colors: [
      { name: 'Default Text', value: 'inherit', hex: '#0f172a' },
      { name: 'Pure Black', value: '#000000', hex: '#000000' },
      { name: 'Dark Slate', value: '#334155', hex: '#334155' },
      { name: 'Cool Gray', value: '#64748b', hex: '#64748b' }
    ]
  },
  {
    category: 'Blues & Indigo',
    colors: [
      { name: 'Royal Blue', value: '#1d4ed8', hex: '#1d4ed8' },
      { name: 'Vivid Cobalt', value: '#2563eb', hex: '#2563eb' },
      { name: 'Indigo Core', value: '#4f46e5', hex: '#4f46e5' },
      { name: 'Sky Cerulean', value: '#0284c7', hex: '#0284c7' }
    ]
  },
  {
    category: 'Emerald & Teal',
    colors: [
      { name: 'Deep Forest', value: '#15803d', hex: '#15803d' },
      { name: 'Emerald Velvet', value: '#059669', hex: '#059669' },
      { name: 'Mint Jade', value: '#10b981', hex: '#10b981' },
      { name: 'Teal Lagoon', value: '#0d9488', hex: '#0d9488' }
    ]
  },
  {
    category: 'Warm Sunset',
    colors: [
      { name: 'Ruby Crimson', value: '#dc2626', hex: '#dc2626' },
      { name: 'Rose Coral', value: '#e11d48', hex: '#e11d48' },
      { name: 'Sunset Orange', value: '#ea580c', hex: '#ea580c' },
      { name: 'Warm Amber', value: '#d97706', hex: '#d97706' }
    ]
  },
  {
    category: 'Violet & Purple',
    colors: [
      { name: 'Electric Violet', value: '#7c3aed', hex: '#7c3aed' },
      { name: 'Deep Plum', value: '#9333ea', hex: '#9333ea' },
      { name: 'Orchid Purple', value: '#a855f7', hex: '#a855f7' },
      { name: 'Bright Fuchsia', value: '#c026d3', hex: '#c026d3' }
    ]
  }
];

// Flat Unified Color Spectrum
const FLAT_TEXT_COLORS = COLOR_PALETTES.flatMap(group => group.colors);

// Curated Soft Highlighter Markers
const HIGHLIGHT_COLORS = [
  { name: 'Sunlight Yellow', value: '#fef08a', label: 'Yellow', bg: '#fef08a', border: '#facc15' },
  { name: 'Mint Meadow', value: '#bbf7d0', label: 'Mint', bg: '#bbf7d0', border: '#86efac' },
  { name: 'Sky Breeze', value: '#bae6fd', label: 'Sky', bg: '#bae6fd', border: '#7dd3fc' },
  { name: 'Petal Rose', value: '#fbcfe8', label: 'Rose', bg: '#fbcfe8', border: '#f472b6' },
  { name: 'Lavender Mist', value: '#e9d5ff', label: 'Lavender', bg: '#e9d5ff', border: '#c084fc' },
  { name: 'Warm Peach', value: '#fed7aa', label: 'Peach', bg: '#fed7aa', border: '#fb923c' },
  { name: 'Neon Lemon', value: '#fef9c3', label: 'Lemon', bg: '#fef9c3', border: '#fde047' },
  { name: 'Golden Sand', value: '#fde68a', label: 'Sand', bg: '#fde68a', border: '#fcd34d' },
  { name: 'Silver Ash', value: '#e2e8f0', label: 'Silver', bg: '#e2e8f0', border: '#cbd5e1' }
];

// Preset Bullet Markers
const BULLET_STYLES = [
  { id: 'disc', symbol: '•', label: 'Classic Dot' },
  { id: 'circle', symbol: '○', label: 'Ring' },
  { id: 'square', symbol: '■', label: 'Square' },
  { id: 'arrow', symbol: '➤', label: 'Arrow' },
  { id: 'check', symbol: '✓', label: 'Checkmark' },
  { id: 'star', symbol: '★', label: 'Star' },
  { id: 'diamond', symbol: '◆', label: 'Diamond' },
  { id: 'target', symbol: '◉', label: 'Target' },
  { id: 'spark', symbol: '✦', label: 'Sparkle' },
  { id: 'box', symbol: '☐', label: 'Checkbox' }
];

// Preset Numbering Formats
const NUMBER_STYLES = [
  { id: 'decimal', label: '1. 2. 3.', desc: 'Standard Numbers', type: '1' },
  { id: 'circled', label: '① ② ③', desc: 'Circled Numbers', type: 'circled' },
  { id: 'lower-alpha', label: 'a. b. c.', desc: 'Lowercase Alpha', type: 'a' },
  { id: 'upper-alpha', label: 'A. B. C.', desc: 'Uppercase Alpha', type: 'A' },
  { id: 'lower-roman', label: 'i. ii. iii.', desc: 'Roman Numerals', type: 'i' },
  { id: 'upper-roman', label: 'I. II. III.', desc: 'Capital Roman', type: 'I' }
];

const FONT_FAMILIES = [
  { label: 'Arial', value: 'Arial', css: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia', css: 'Georgia, serif' },
  { label: 'Times New Roman', value: 'Times New Roman', css: '"Times New Roman", serif' },
  { label: 'Verdana', value: 'Verdana', css: 'Verdana, sans-serif' },
  { label: 'Courier New', value: 'Courier New', css: '"Courier New", monospace' }
];

interface CustomFontRecord {
  id: string;
  profileId?: string;
  familyName: string;
  fileName: string;
  dataUrl: string;
  createdAt: number;
}

const isValidFontFamilyName = (value: string): boolean =>
  /^[\p{L}\p{N}][\p{L}\p{N} _.-]{0,63}$/u.test(value.trim());

const fontFamilyCss = (familyName: string): string => `"${familyName.trim()}"`;

// Helper: Escape HTML special characters
const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};


// Helper: Sanitize & Preserve 100% of genuine rich HTML (Headings, bold, italics, lists, tables, colors, links)
const sanitizeAndPreserveRichHtml = (rawHtml: string): string => {
  if (!rawHtml) return '';

  // Extract content between <!--StartFragment--> and <!--EndFragment--> if present (Word/Docs standard)
  let fragment = rawHtml;
  const startMatch = /<!--StartFragment-->/i.exec(fragment);
  const endMatch = /<!--EndFragment-->/i.exec(fragment);
  if (startMatch && endMatch && startMatch.index < endMatch.index) {
    fragment = fragment.substring(startMatch.index + startMatch[0].length, endMatch.index);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(fragment, 'text/html');
  const body = doc.body;

  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    // Reject dangerous or meta elements
    const dangerousTags = [
      'script', 'style', 'meta', 'link', 'xml', 'o:p', 'iframe', 'object',
      'embed', 'form', 'input', 'button', 'noscript', 'title', 'head'
    ];
    if (dangerousTags.includes(tagName) || tagName.startsWith('o:') || tagName.startsWith('w:')) {
      return null;
    }

    let cleanTag = tagName;
    if (cleanTag === 'b') cleanTag = 'strong';
    if (cleanTag === 'i') cleanTag = 'em';
    if (cleanTag === 'strike' || cleanTag === 's') cleanTag = 'del';
    if (cleanTag === 'font') cleanTag = 'span';

    const newEl = document.createElement(cleanTag);

    // Preserve important styles (color, background-color, text-align, font-weight, font-style, text-decoration)
    const style = el.style;
    if (style) {
      if (style.color && style.color !== 'inherit' && style.color !== 'initial') {
        newEl.style.color = style.color;
      }
      const pastedFamilyName = style.fontFamily.replace(/["']/g, '').split(',')[0].trim();
      if (pastedFamilyName && isValidFontFamilyName(pastedFamilyName)) {
      newEl.style.fontFamily = fontFamilyCss(pastedFamilyName);
      }
      if (style.backgroundColor && style.backgroundColor !== 'transparent' && style.backgroundColor !== 'inherit') {
        newEl.style.backgroundColor = style.backgroundColor;
      }
      if (style.textAlign && ['left', 'center', 'right', 'justify'].includes(style.textAlign)) {
        newEl.style.textAlign = style.textAlign;
      }
      if (style.fontWeight && (style.fontWeight === 'bold' || parseInt(style.fontWeight, 10) >= 600)) {
        newEl.style.fontWeight = 'bold';
      }
      if (style.fontStyle === 'italic') {
        newEl.style.fontStyle = 'italic';
      }
      if (style.textDecoration && style.textDecoration.includes('underline')) {
        newEl.style.textDecoration = 'underline';
      }
    }

    if (tagName === 'font') {
      const pastedFace = (el.getAttribute('face') || '').replace(/["']/g, '').split(',')[0].trim();
      if (pastedFace && isValidFontFamilyName(pastedFace)) newEl.style.fontFamily = fontFamilyCss(pastedFace);
    }

    // Preserve attributes for specific tags
    if (cleanTag === 'a') {
      const href = el.getAttribute('href');
      if (href && !href.startsWith('javascript:')) {
        newEl.setAttribute('href', href);
        newEl.setAttribute('target', '_blank');
        newEl.setAttribute('rel', 'noopener noreferrer');
        newEl.className = 'text-indigo-600 dark:text-indigo-400 underline hover:opacity-80 transition-opacity';
      }
    } else if (cleanTag === 'img') {
      const src = el.getAttribute('src');
      if (src && (src.startsWith('data:image/') || src.startsWith('http://') || src.startsWith('https://'))) {
        newEl.setAttribute('src', src);
        if (el.getAttribute('alt')) newEl.setAttribute('alt', el.getAttribute('alt') || '');
        newEl.className = 'max-w-full rounded-xl my-2.5 shadow-xs border border-slate-200 dark:border-slate-800';
      } else {
        return null;
      }
    } else if (cleanTag === 'table') {
      newEl.className = 'border-collapse border border-slate-300 dark:border-slate-700 my-3 w-full rounded-lg overflow-hidden';
    } else if (cleanTag === 'th' || cleanTag === 'td') {
      if (el.getAttribute('colspan')) newEl.setAttribute('colspan', el.getAttribute('colspan') || '1');
      if (el.getAttribute('rowspan')) newEl.setAttribute('rowspan', el.getAttribute('rowspan') || '1');
      newEl.className = cleanTag === 'th'
        ? 'border border-slate-300 dark:border-slate-700 px-3 py-2 bg-slate-100 dark:bg-slate-800/80 font-bold text-left'
        : 'border border-slate-300 dark:border-slate-700 px-3 py-1.5';
    } else if (cleanTag === 'blockquote') {
      newEl.className = 'border-l-4 border-indigo-500 pl-3.5 py-1.5 my-2.5 italic text-slate-700 dark:text-slate-300 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-r-lg';
    } else if (cleanTag === 'pre') {
      newEl.className = 'bg-slate-900 text-slate-100 p-3.5 rounded-xl my-2.5 overflow-x-auto font-mono text-xs';
    } else if (cleanTag === 'code') {
      newEl.className = 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-mono text-xs';
    }

    // Recursively process children
    for (let i = 0; i < el.childNodes.length; i++) {
      const cleanChild = cleanNode(el.childNodes[i]);
      if (cleanChild) {
        newEl.appendChild(cleanChild);
      }
    }

    return newEl;
  };

  const cleanFragment = document.createDocumentFragment();
  for (let i = 0; i < body.childNodes.length; i++) {
    const cleanChild = cleanNode(body.childNodes[i]);
    if (cleanChild) {
      cleanFragment.appendChild(cleanChild);
    }
  }

  const container = document.createElement('div');
  container.appendChild(cleanFragment);
  return container.innerHTML;
};

// Helper: Detect if plain text has markdown or structured layout
const isMarkdownOrFormattedText = (text: string): boolean => {
  if (!text) return false;
  const hasHeading = /^#{1,6}\s+.+$/m.test(text);
  const hasBold = /\*\*[^*]+\*\*|__[^_]+__/.test(text);
  const hasItalic = /(^|[^\*])\*[^*]+\*([^\*]|$)|(^|[^_])_[^_]+_([^_]|$)/.test(text);
  const hasBulletList = /^[\*\-\+]\s+.+$/m.test(text);
  const hasNumberedList = /^\d+\.\s+.+$/m.test(text);
  const hasBlockquote = /^>\s+.+$/m.test(text);
  const hasCodeBlock = /```[\s\S]*?```|`[^`]+`/.test(text);
  const hasTable = /\|.+\|[\r\n]+\|[-:\s|]+\|[\r\n]+\|.+\|/.test(text);
  const hasTaskItem = /^-\s*\[[ xX]\]\s+.+$/m.test(text);

  return hasHeading || hasBold || hasItalic || hasBulletList || hasNumberedList || hasBlockquote || hasCodeBlock || hasTable || hasTaskItem;
};

// Helper: Convert Markdown to luxury Rich HTML
const convertMarkdownToRichHtml = (markdown: string): string => {
  let text = escapeHtml(markdown);

  // Code blocks first (protect from other replacements)
  const codeBlocks: string[] = [];
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const token = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre><code class="language-${lang || 'plaintext'}">${code.trim()}</code></pre>`);
    return token;
  });

  // Inline code
  const inlineCodes: string[] = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    const token = `__INLINE_CODE_${inlineCodes.length}__`;
    inlineCodes.push(`<code>${code}</code>`);
    return token;
  });

  // Tables
  text = text.replace(/(?:^|\n)(\|.+?\|\n\|[-:\s|]+?\|\n(?:\|.+?\|\n?)+)/g, (match, tableText) => {
    const rows = tableText.trim().split('\n').map((r: string) => r.trim());
    if (rows.length < 2) return match;
    const headerCells = rows[0].split('|').slice(1, -1).map((c: string) => c.trim());
    const bodyRows = rows.slice(2);

    let tableHtml = '<table class="border-collapse border border-slate-300 dark:border-slate-700 my-3 w-full rounded-lg overflow-hidden"><thead><tr>';
    headerCells.forEach((cell: string) => {
      tableHtml += `<th class="border border-slate-300 dark:border-slate-700 px-3 py-2 bg-slate-100 dark:bg-slate-800 font-bold text-left">${cell}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';
    bodyRows.forEach((r: string) => {
      const cells = r.split('|').slice(1, -1).map((c: string) => c.trim());
      tableHtml += '<tr>';
      cells.forEach((cell: string) => {
        tableHtml += `<td class="border border-slate-300 dark:border-slate-700 px-3 py-1.5">${cell}</td>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    return '\n' + tableHtml + '\n';
  });

  // Headings
  text = text.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  text = text.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  text = text.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  text = text.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  text = text.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Blockquotes
  text = text.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules
  text = text.replace(/^(\*{3,}|-{3,}|_{3,})$/gm, '<hr/>');

  // Task check items
  text = text.replace(/^-\s*\[x\]\s+(.+)$/gim, '<p>☑ $1</p>');
  text = text.replace(/^-\s*\[\s*\]\s+(.+)$/gim, '<p>☐ $1</p>');

  // Unordered lists (- or *)
  text = text.replace(/((?:^[*-]\s+.+$\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(l => l.replace(/^[*-]\s+/, '').trim());
    return '<ul>' + items.map(it => `<li>${it}</li>`).join('') + '</ul>';
  });

  // Ordered lists (1. 2.)
  text = text.replace(/((?:^\d+\.\s+.+$\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(l => l.replace(/^\d+\.\s+/, '').trim());
    return '<ol>' + items.map(it => `<li>${it}</li>`).join('') + '</ol>';
  });

  // Bold & Italic
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.*?)_/g, '<em>$1</em>');
  text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');

  // Links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 underline">$1</a>');

  // Line breaks for remaining text
  text = text.replace(/\n\n+/g, '</p><p>');
  text = text.replace(/\n/g, '<br/>');

  if (!text.startsWith('<')) {
    text = `<p>${text}</p>`;
  }

  // Restore code blocks & inline code
  codeBlocks.forEach((cb, idx) => {
    text = text.replace(`__CODE_BLOCK_${idx}__`, cb);
  });
  inlineCodes.forEach((ic, idx) => {
    text = text.replace(`__INLINE_CODE_${idx}__`, ic);
  });

  return text;
};

// Helper: Convert plain text with line breaks preserved
const convertPlainTextToHtmlWithLineBreaks = (text: string): string => {
  if (!text) return '';
  const escaped = escapeHtml(text);
  const paragraphs = escaped.split(/\r?\n\r?\n/);
  return paragraphs
    .map(p => `<p>${p.replace(/\r?\n/g, '<br/>')}</p>`)
    .join('');
};

export const NoteRichEditor: React.FC<NoteRichEditorProps> = ({
  initialHtml = '',
  onChange,
  minHeight = 'min-h-[150px]',
  maxHeight = 'max-h-[280px]',
  className = ''
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastRenderedHtmlRef = useRef('');
  const historyRef = useRef<{ entries: string[]; index: number }>({ entries: [''], index: 0 });
  const restoringHistoryRef = useRef(false);

  // Selection & Table Tracking
  const savedRangeRef = useRef<Range | null>(null);
  const isExecutingActionRef = useRef(false);
  const lastActiveTableRef = useRef<HTMLTableElement | null>(null);
  const lastActiveCellRef = useRef<HTMLTableCellElement | null>(null);
  const [activeTableLocation, setActiveTableLocation] = useState<{ row: number; col: number; totalRows: number; totalCols: number } | null>(null);

  // Active Studio Drawer: related editor tools are grouped into one panel.
  const [activeStudio, setActiveStudio] = useState<'text' | 'format' | 'color' | 'bullets' | null>(null);
  const [colorPanelTab, setColorPanelTab] = useState<'text' | 'highlight'>('text');
  const [listTablePanelTab, setListTablePanelTab] = useState<'bullets' | 'table'>('bullets');

  // Word & character count
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  // Custom Colors
  const [customTextColor, setCustomTextColor] = useState('#b88648');
  const [customHighlightColor, setCustomHighlightColor] = useState('#fef08a');

  // Bullet / Number Tabs
  const [bulletTab, setBulletTab] = useState<'symbols' | 'numbered'>('symbols');
  const [customBulletInput, setCustomBulletInput] = useState('');
  const customBulletInputRef = useRef<HTMLInputElement>(null);
  const [customBulletImage, setCustomBulletImage] = useState('');
  const [customBulletImageError, setCustomBulletImageError] = useState('');
  const [customNumberPrefix, setCustomNumberPrefix] = useState('Step');

  // Table Generator Grid
  const [tableGridHover, setTableGridHover] = useState({ rows: 3, cols: 3 });
  const [tableHasHeader, setTableHasHeader] = useState(true);
  // Excel-style table toolbox
  const [tableTab, setTableTab] = useState<'insert' | 'edit' | 'calc' | 'format'>('insert');
  const [formulaDraft, setFormulaDraft] = useState('');
  const [tableStats, setTableStats] = useState<RangeStats | null>(null);
  const [cellNumberFormat, setCellNumberFormat] = useState('');
  // Live size read-outs for the Format tab (column width / row height).
  const [cellColumnWidth, setCellColumnWidth] = useState(0);
  const [cellRowHeight, setCellRowHeight] = useState(0);
  // Last colour picked from the custom swatch in the Format tab.
  const [customFillColour, setCustomFillColour] = useState('#fde68a');
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);

  // Text appearance controls (the controls stay available without visible labels).
  const [activeStyle, setActiveStyle] = useState('p');
  const [activeSize, setActiveSize] = useState('3');
  const [activeFont, setActiveFont] = useState('');
  const [customFonts, setCustomFonts] = useState<CustomFontRecord[]>([]);
  const [installedFontNames, setInstalledFontNames] = useState<string[]>([]);
  const [isFontManagerOpen, setIsFontManagerOpen] = useState(false);
  const [fontFamilyInput, setFontFamilyInput] = useState('');
  const [fontFile, setFontFile] = useState<File | null>(null);
  const [fontError, setFontError] = useState('');
  const plainTextPasteRef = useRef(false);
  const loadedFontFacesRef = useRef<Map<string, FontFace>>(new Map());

  // Speech synthesis
  const [isEditorSpeaking, setIsEditorSpeaking] = useState(false);
  const [isEditorPaused, setIsEditorPaused] = useState(false);
  const [editorReaderLang] = useState<VoiceLanguage>('hi-IN');
  const readerRef = useRef<TextReaderController | null>(null);

  useEffect(() => {
    return () => {
      readerRef.current?.stop();
      loadedFontFacesRef.current.forEach(fontFace => document.fonts.delete(fontFace));
      loadedFontFacesRef.current.clear();
    };
  }, []);

  const loadCustomFonts = useCallback(async () => {
    try {
      const fonts = await storage.getAll<CustomFontRecord>('customFonts');
      loadedFontFacesRef.current.forEach(fontFace => document.fonts.delete(fontFace));
      loadedFontFacesRef.current.clear();

      const loadedFonts: CustomFontRecord[] = [];
      for (const font of fonts) {
        if (!font.familyName || !font.dataUrl) continue;
        try {
          const fontFace = new FontFace(font.familyName, `url("${font.dataUrl}")`);
          await fontFace.load();
          document.fonts.add(fontFace);
          loadedFontFacesRef.current.set(font.id, fontFace);
          loadedFonts.push(font);
        } catch (error) {
          console.error(`Could not load saved font "${font.familyName}".`, error);
        }
      }
      setCustomFonts(loadedFonts);
    } catch (error) {
      console.error('Could not load saved custom fonts.', error);
      setFontError('Saved fonts load nahi ho sake. App storage check karein.');
    }
  }, []);

  useEffect(() => {
    let isActive = true;
    const refreshFonts = () => {
      if (isActive) void loadCustomFonts();
    };
    refreshFonts();
    const unsubscribe = storage.subscribe((store, action) => {
      if (store === 'customFonts' || (store === 'recycleBin' && action === 'restore')) {
        refreshFonts();
      }
    });
    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [loadCustomFonts]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (initialHtml !== lastRenderedHtmlRef.current) {
      const html = sanitizeHtml(initialHtml || '');
      editorRef.current.innerHTML = html;
      lastRenderedHtmlRef.current = html;
      historyRef.current = { entries: [html], index: 0 };
    }
    // A brand new note must start as a real paragraph, otherwise the first
    // keystroke becomes a bare text node and every block tool stops working.
    if (!editorRef.current.firstElementChild || hasStrayRootNodes()) ensureBlockStructure();
    lastRenderedHtmlRef.current = editorRef.current.innerHTML;
  }, [initialHtml]);

  // Robust Selection Storage
  const saveSelection = useCallback(() => {
    if (isExecutingActionRef.current) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      const range = sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  }, []);

  // Guaranteed Selection Restoration - Never leaves selection empty
  const restoreSelection = useCallback((): boolean => {
    if (!editorRef.current) return false;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (!sel) return false;

    if (savedRangeRef.current && editorRef.current.contains(savedRangeRef.current.commonAncestorContainer)) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
        return true;
      } catch {}
    }

    // Fallback: create caret at end of editor
    if (sel.rangeCount === 0 || !editorRef.current.contains(sel.anchorNode)) {
      try {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        savedRangeRef.current = range;
        return true;
      } catch {}
    }
    return true;
  }, []);

  // Detect active table context
  const detectActiveTable = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !editorRef.current) return;

    let node: Node | null = sel.anchorNode;
    let cell: HTMLTableCellElement | null = null;
    let table: HTMLTableElement | null = null;

    while (node && node !== editorRef.current) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') {
        cell = node as HTMLTableCellElement;
      }
      if (node.nodeName === 'TABLE') {
        table = node as HTMLTableElement;
        break;
      }
      node = node.parentNode;
    }

    if (table) {
      lastActiveTableRef.current = table;
      lastActiveCellRef.current = cell;
      const targetRow = cell?.closest('tr');
      const rowIndex = targetRow ? targetRow.rowIndex + 1 : 1;
      const colIndex = cell ? cell.cellIndex + 1 : 1;
      const totalRows = table.rows.length;
      const totalCols = table.rows[0]?.cells.length || 1;
      setActiveTableLocation({ row: rowIndex, col: colIndex, totalRows, totalCols });
    } else {
      setActiveTableLocation(null);
    }
  }, []);

  const handleEditorInput = useCallback(() => {
    if (!editorRef.current) return;
    // Dirty DOM (legacy saved values, browser quirks) can leave bare inline nodes
    // at the root; repair before the value is published to the parent.
    if (hasStrayRootNodes()) ensureBlockStructure();
    // Live totals: a number typed anywhere recalculates every formula in the note.
    recalculateAllTables();
    // A stored raw number is only trusted while the cell still shows its
    // formatted form; typing over the cell discards it.
    editorRef.current.querySelectorAll('td[data-om-numvalue], th[data-om-numvalue]').forEach(element => {
      const cell = element as HTMLTableCellElement;
      const stored = toNumber(cell.getAttribute('data-om-numvalue'));
      const formatted = stored === null ? '' : formatCellNumber(stored, cell.getAttribute('data-om-numfmt') || undefined);
      if (stored === null || (cell.textContent || '').trim() !== formatted) {
        cell.removeAttribute('data-om-numvalue');
      }
    });
    const html = editorRef.current.innerHTML;
    const text = editorRef.current.innerText || '';
    lastRenderedHtmlRef.current = html;
    if (!restoringHistoryRef.current) {
      const history = historyRef.current;
      if (history.entries[history.index] !== html) {
        const entries = history.entries.slice(0, history.index + 1);
        entries.push(html);
        if (entries.length > 100) entries.shift();
        historyRef.current = { entries, index: entries.length - 1 };
      }
    }
    onChange(html, text);
    // Update word & character counts
    const trimmed = text.trim();
    setCharCount(trimmed.length);
    setWordCount(trimmed ? trimmed.split(/\s+/).length : 0);
  }, [onChange]);

  const moveEditorHistory = useCallback((direction: -1 | 1) => {
    const editor = editorRef.current;
    const history = historyRef.current;
    const nextIndex = history.index + direction;
    if (!editor || nextIndex < 0 || nextIndex >= history.entries.length) return;

    history.index = nextIndex;
    restoringHistoryRef.current = true;
    try {
      editor.innerHTML = history.entries[nextIndex];
      lastRenderedHtmlRef.current = history.entries[nextIndex];
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      savedRangeRef.current = range;
      handleEditorInput();
    } finally {
      restoringHistoryRef.current = false;
    }
  }, [handleEditorInput]);

  // Insert rich HTML at caret position with proper range management
  const insertHtmlAtCaret = useCallback((html: string) => {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || !editorRef.current) return;

    let range: Range;
    if (sel.rangeCount > 0 && editorRef.current.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      range = sel.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    range.deleteContents();

    const el = document.createElement('div');
    el.innerHTML = sanitizeHtml(html);
    const frag = document.createDocumentFragment();
    let node: Node | null;
    let lastNode: Node | null = null;
    while ((node = el.firstChild)) {
      lastNode = frag.appendChild(node);
    }

    range.insertNode(frag);

    if (lastNode) {
      const newRange = document.createRange();
      newRange.setStartAfter(lastNode);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
      savedRangeRef.current = newRange;
    }
  }, [restoreSelection]);

  // Intelligent Rich Paste: Preserves original formatting from web, Word, Google Docs, Notion, or Markdown
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const htmlData = clipboardData.getData('text/html');
    const plainText = clipboardData.getData('text/plain');
    const isShiftPaste = plainTextPasteRef.current;
    plainTextPasteRef.current = false;

    let processedHtml = '';

    if (!isShiftPaste && htmlData && htmlData.trim()) {
      // 1. Genuine Rich HTML from Google Docs, Word, Web, Notion, ChatGPT, etc.
      processedHtml = sanitizeAndPreserveRichHtml(htmlData);
    } else if (plainText && plainText.trim()) {
      // 2. Plain text - check if it has markdown formatting
      if (!isShiftPaste && isMarkdownOrFormattedText(plainText)) {
        processedHtml = convertMarkdownToRichHtml(plainText);
      } else {
        processedHtml = convertPlainTextToHtmlWithLineBreaks(plainText);
      }
    }

    if (processedHtml) {
      insertHtmlAtCaret(processedHtml);
      handleEditorInput();
      saveSelection();
    }
  }, [insertHtmlAtCaret, handleEditorInput, saveSelection]);

  const exec = useCallback((cmd: string, val: string | null = null) => {
    isExecutingActionRef.current = true;
    restoreSelection();
    ensureBlockStructure();
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {}
    document.execCommand(cmd, false, val || undefined);
    isExecutingActionRef.current = false;
    saveSelection();
    handleEditorInput();
  }, [restoreSelection, saveSelection, handleEditorInput]);

  // Safety net: mobile keyboards and some IMEs produce a paragraph break
  // without a usable keydown, so continue the list from beforeinput too.
  const handleBeforeInput = (e: React.FormEvent<HTMLDivElement>) => {
    // Safety net for input paths that skip keydown (IME, dictation, paste-as-text).
    ensureEditableCaret();
    // Typing over a calculated cell replaces the result, like Excel does.
    const typedInto = cellFromNode(window.getSelection()?.anchorNode ?? null);
    if (typedInto?.hasAttribute('data-om-formula')) {
      typedInto.removeAttribute('data-om-formula');
      typedInto.removeAttribute('data-om-calc');
      typedInto.removeAttribute('data-om-err');
    }
    if (hasStrayRootNodes()) ensureBlockStructure();
    const native = e.nativeEvent as InputEvent;
    if (native.inputType !== 'insertParagraph' || native.isComposing) return;
    const selection = window.getSelection();
    if (!selection || !selection.isCollapsed) return;
    const item = getBulletItem(selection.anchorNode);
    if (!item) return;
    e.preventDefault();
    continueListItem(item);
    handleEditorInput();
    saveSelection();
  };

  // Tab key navigation inside table cells
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    ensureEditableCaret();
    if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      plainTextPasteRef.current = true;
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const selection = window.getSelection();
      const editingCell = cellFromNode(selection?.anchorNode ?? null);
      const rawCellText = (editingCell?.textContent || '').trim();
      if (editingCell && rawCellText.startsWith('=')) {
        e.preventDefault();
        const table = editingCell.closest('table') as HTMLTableElement | null;
        editingCell.setAttribute('data-om-formula', rawCellText);
        editingCell.setAttribute('data-om-calc', '1');
        editingCell.textContent = '';
        recalculateTable(table, true);
        setFormulaDraft(rawCellText);
        caretTo(editingCell, true);
        handleEditorInput();
        saveSelection();
        detectActiveTable();
        refreshTableStats();
        return;
      }
      if (selection && selection.isCollapsed) {
        const item = getBulletItem(selection.anchorNode);
        if (item) {
          e.preventDefault();
          continueListItem(item);
          handleEditorInput();
          saveSelection();
          return;
        }
      }
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const selection = window.getSelection();
      const editor = editorRef.current;
      if (selection && editor && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) {
          const rows = (Array.from(editor.querySelectorAll('[data-om-list]')) as HTMLElement[]).filter(row => {
            try {
              return range.intersectsNode(row);
            } catch {
              return false;
            }
          });
          const firstRow = rows[0] ?? null;
          const lastRow = rows[rows.length - 1] ?? null;
          const parent = firstRow && lastRow && firstRow.parentElement === lastRow.parentElement
            ? firstRow.parentElement
            : null;
          const before = firstRow && parent ? firstRow.previousElementSibling as HTMLElement | null : null;
          const after = lastRow && parent ? lastRow.nextElementSibling as HTMLElement | null : null;

          // Let the browser delete the selected text itself. Doing it by hand
          // (range.deleteContents) left markers behind, skipped paragraph
          // merging and broke undo; we only tidy rows that end up empty.
          window.setTimeout(() => {
            const root = editorRef.current;
            if (!root) return;
            cleanupEmptiedListRows(parent, before, after);
            // Chrome can leave a row behind when the selection covered the whole
            // note, so sweep any list row that no longer holds text.
            (Array.from(root.querySelectorAll('[data-om-list]')) as HTMLElement[]).forEach(row => {
              if ((itemTextElement(row).textContent || '').replace(/\u200b/g, '').trim() === '') row.remove();
            });
            ensureBlockStructure();
            const live = window.getSelection();
            if (!live || live.rangeCount === 0 || !root.contains(live.anchorNode)) {
              const last = root.lastElementChild as HTMLElement | null;
              if (last) caretTo(last.hasAttribute('data-om-list') ? itemTextElement(last) : last, true);
            }
            handleEditorInput();
            saveSelection();
          }, 0);
          return;
        }
      }
      if (selection && selection.isCollapsed) {
        const item = getBulletItem(selection.anchorNode);
        if (item && caretAtStartOfItem(item)) {
          e.preventDefault();
          const text = (itemTextElement(item).textContent || '').trim();
          const paragraph = document.createElement('p');
          if (text) paragraph.textContent = text;
          else paragraph.innerHTML = '<br>';
          item.replaceWith(paragraph);
          caretTo(paragraph, true);
          handleEditorInput();
          saveSelection();
          return;
        }
      }
    }
    if (e.key === 'Tab') {
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      const cell = (node as HTMLElement)?.closest?.('td, th') || node?.parentElement?.closest?.('td, th');
      if (cell) {
        e.preventDefault();
        const row = cell.closest('tr');
        const table = cell.closest('table');
        if (row && table) {
          if (e.shiftKey) {
            const prevCell = cell.previousElementSibling as HTMLElement || (row.previousElementSibling?.lastElementChild as HTMLElement);
            if (prevCell) {
              const range = document.createRange();
              range.selectNodeContents(prevCell);
              range.collapse(false);
              sel?.removeAllRanges();
              sel?.addRange(range);
            }
          } else {
            const nextCell = cell.nextElementSibling as HTMLElement || (row.nextElementSibling?.firstElementChild as HTMLElement);
            if (nextCell) {
              const range = document.createRange();
              range.selectNodeContents(nextCell);
              range.collapse(false);
              sel?.removeAllRanges();
              sel?.addRange(range);
            } else {
              addTableRow();
            }
          }
          saveSelection();
          detectActiveTable();
          return;
        }
      }
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        moveEditorHistory(e.shiftKey ? 1 : -1);
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        moveEditorHistory(1);
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        exec('bold');
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        exec('italic');
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        exec('underline');
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        exec('justifyFull');
      }
    }
  };

  const handleKeyUp = () => {
    plainTextPasteRef.current = false;
    saveSelection();
    detectActiveTable();
  };

  // =========================================================================
  const handleApplyStyle = (tag: string) => {
    setActiveStyle(tag);
    isExecutingActionRef.current = true;
    restoreSelection();
    try {
      document.execCommand('formatBlock', false, tag);
    } catch {
      document.execCommand('formatBlock', false, `<${tag}>`);
    }
    isExecutingActionRef.current = false;
    saveSelection();
    handleEditorInput();
  };

  // execCommand("fontSize") only understands 1-7 and stores keywords such as
  // "xx-large", so a "24px" option actually rendered 32px. Map every keyword back
  // to the px value the menu promises.
  const FONT_SIZE_PX: Record<string, string> = {
    'xx-small': '9px',
    'x-small': '10px',
    small: '12px',
    medium: '14px',
    large: '16px',
    'x-large': '18px',
    'xx-large': '24px',
    'xxx-large': '24px',
    '-webkit-xxx-large': '24px'
  };

  const normalizeFontSizeSpans = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll('span, font').forEach(node => {
      const element = node as HTMLElement;
      if (element.tagName === 'FONT') {
        const legacy: Record<string, string> = {
          '1': '9px', '2': '12px', '3': '14px', '4': '16px', '5': '18px', '6': '24px', '7': '32px'
        };
        const px = legacy[element.getAttribute('size') || ''];
        if (!px) return;
        const span = document.createElement('span');
        span.style.fontSize = px;
        while (element.firstChild) span.appendChild(element.firstChild);
        element.replaceWith(span);
        return;
      }
      const px = FONT_SIZE_PX[(element.style.fontSize || '').toLowerCase()];
      if (px) element.style.fontSize = px;
    });
  };

  const handleApplySize = (sizeVal: string) => {
    setActiveSize(sizeVal);
    isExecutingActionRef.current = true;
    restoreSelection();
    ensureBlockStructure();
    try {
      document.execCommand('fontSize', false, sizeVal);
    } catch {}
    normalizeFontSizeSpans();
    isExecutingActionRef.current = false;
    saveSelection();
    handleEditorInput();
  };

  const handleApplyFont = (fontValue: string) => {
    const font = FONT_FAMILIES.find(option => option.value === fontValue);
    const familyName = font?.value ||
      customFonts.find(option => option.familyName === fontValue)?.familyName ||
      (isValidFontFamilyName(fontValue) ? fontValue.trim() : '');
    if (!familyName) {
      setFontError('Font name valid nahi hai.');
      return;
    }
    const cssFamily = font?.css || fontFamilyCss(familyName);

    setActiveFont(familyName);
    isExecutingActionRef.current = true;
    restoreSelection();

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontFamily = cssFamily;
      span.appendChild(range.extractContents());
      range.insertNode(span);
      range.selectNodeContents(span);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      try {
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('fontName', false, familyName);
      } catch {}

      editorRef.current?.querySelectorAll('font[face]').forEach(fontElement => {
        const selectedFont = FONT_FAMILIES.find(option =>
          option.value.toLowerCase() === (fontElement.getAttribute('face') || '').toLowerCase()
        );
        const resolvedFamily = selectedFont?.value || customFonts.find(option =>
          option.familyName.toLowerCase() === (fontElement.getAttribute('face') || '').toLowerCase()
        )?.familyName;
        if (!resolvedFamily) return;
        const span = document.createElement('span');
        span.style.fontFamily = selectedFont?.css || fontFamilyCss(resolvedFamily);
        span.replaceChildren(...Array.from(fontElement.childNodes));
        fontElement.replaceWith(span);
      });
    }

    isExecutingActionRef.current = false;
    saveSelection();
    handleEditorInput();
  };

  const applyInstalledFont = () => {
    const familyName = fontFamilyInput.trim();
    if (!isValidFontFamilyName(familyName)) {
      setFontError('Font name me sirf letters, numbers, spaces, dot, hyphen ya underscore use karein.');
      return;
    }
    setInstalledFontNames(previous =>
      previous.some(name => name.toLowerCase() === familyName.toLowerCase())
        ? previous
        : [...previous, familyName]
    );
    setFontError('');
    handleApplyFont(familyName);
  };

  const uploadFont = async () => {
    const familyName = fontFamilyInput.trim();
    if (!isValidFontFamilyName(familyName)) {
      setFontError('Font ka valid naam enter karein.');
      return;
    }
    if (!fontFile) {
      setFontError('Pehle .ttf, .otf, .woff ya .woff2 file choose karein.');
      return;
    }
    if (fontFile.size > 10 * 1024 * 1024) {
      setFontError('Font file 10 MB se chhoti honi chahiye.');
      return;
    }

    const extension = fontFile.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = new Set(['ttf', 'otf', 'woff', 'woff2']);
    if (!extension || !allowedExtensions.has(extension)) {
      setFontError('Sirf .ttf, .otf, .woff ya .woff2 files supported hain.');
      return;
    }

    setFontError('');
    try {
      const fileBuffer = await fontFile.arrayBuffer();
      const header = new Uint8Array(fileBuffer.slice(0, 4));
      const signature = String.fromCharCode(...header);
      const validSignatures: Record<string, string[]> = {
        ttf: ['\u0000\u0001\u0000\u0000', 'true'],
        otf: ['OTTO'],
        woff: ['wOFF'],
        woff2: ['wOF2']
      };
      if (!validSignatures[extension].includes(signature)) {
        setFontError('Yeh file valid font file nahi lagti.');
        return;
      }
      if (FONT_FAMILIES.some(font => font.value.toLowerCase() === familyName.toLowerCase())) {
        setFontError('Built-in font ka naam upload ke liye use nahi kar sakte.');
        return;
      }

      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('Could not read the font file.'));
        reader.onerror = () => reject(reader.error || new Error('Could not read the font file.'));
        reader.readAsDataURL(fontFile);
      });
      const existingFont = customFonts.find(font =>
        font.familyName.toLowerCase() === familyName.toLowerCase()
      );
      const fontRecord: CustomFontRecord = {
        id: existingFont?.id || generateUUID(),
        familyName,
        fileName: fontFile.name,
        dataUrl,
        createdAt: existingFont?.createdAt || Date.now()
      };
      const fontFace = new FontFace(familyName, `url("${dataUrl}")`);
      await fontFace.load();
      await storage.put('customFonts', fontRecord);
      const previousFace = loadedFontFacesRef.current.get(fontRecord.id);
      if (previousFace) document.fonts.delete(previousFace);
      document.fonts.add(fontFace);
      loadedFontFacesRef.current.set(fontRecord.id, fontFace);
      setCustomFonts(previous => [
        ...previous.filter(font => font.id !== fontRecord.id),
        fontRecord
      ]);
      setActiveFont(familyName);
      setFontFamilyInput(familyName);
      setFontFile(null);
      handleApplyFont(familyName);
      setFontError('');
    } catch (error) {
      console.error('Failed to save custom font.', error);
      setFontError(error instanceof Error ? error.message : 'Font upload failed.');
    }
  };

  const removeCustomFont = async (font: CustomFontRecord) => {
    try {
      await storage.delete('customFonts', font.id);
      const loadedFontFace = loadedFontFacesRef.current.get(font.id);
      if (loadedFontFace) {
        document.fonts.delete(loadedFontFace);
        loadedFontFacesRef.current.delete(font.id);
      }
      setCustomFonts(previous => previous.filter(item => item.id !== font.id));
      if (activeFont === font.familyName) setActiveFont('');
      setFontError('');
    } catch (error) {
      console.error(`Failed to remove custom font "${font.familyName}".`, error);
      setFontError('Font remove nahi ho saka. Dobara try karein.');
    }
  };

  // =========================================================================
  // 1. APPLY TEXT COLOR
  // =========================================================================
  const applyTextColor = (colorVal: string) => {
    isExecutingActionRef.current = true;
    restoreSelection();

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        const text = node.textContent;
        const offset = range.startOffset;
        let start = offset;
        while (start > 0 && /\S/.test(text[start - 1])) start--;
        let end = offset;
        while (end < text.length && /\S/.test(text[end])) end++;
        if (end > start) {
          range.setStart(node, start);
          range.setEnd(node, end);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }

    const finalColor = colorVal === 'inherit' ? '#0f172a' : colorVal;
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {}

    let applied = false;
    try {
      applied = document.execCommand('foreColor', false, finalColor);
    } catch {}

    if (!applied && sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      try {
        const range = sel.getRangeAt(0);
        const span = document.createElement('span');
        span.style.color = finalColor;
        span.appendChild(range.extractContents());
        range.insertNode(span);
        range.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (err) {
        console.warn('DOM color error:', err);
      }
    }

    isExecutingActionRef.current = false;
    saveSelection();
    handleEditorInput();
  };

  // =========================================================================
  // 2. APPLY TEXT HIGHLIGHT (Pastel Marker & Custom Clear)
  // =========================================================================
  const applyHighlight = (colorVal: string) => {
    isExecutingActionRef.current = true;
    restoreSelection();

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        const text = node.textContent;
        const offset = range.startOffset;
        let start = offset;
        while (start > 0 && /\S/.test(text[start - 1])) start--;
        let end = offset;
        while (end < text.length && /\S/.test(text[end])) end++;
        if (end > start) {
          range.setStart(node, start);
          range.setEnd(node, end);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }

    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {}

    if (colorVal === 'transparent') {
      try { document.execCommand('removeFormat', false, undefined); } catch {}
      try { document.execCommand('backColor', false, 'transparent'); } catch {}
      try { document.execCommand('hiliteColor', false, 'transparent'); } catch {}
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        const parent = range.commonAncestorContainer.parentElement;
        if (parent && (parent.style.backgroundColor || parent.nodeName === 'MARK')) {
          parent.style.backgroundColor = 'transparent';
        }
      }
    } else {
      let applied = false;
      try { applied = document.execCommand('backColor', false, colorVal); } catch {}
      if (!applied) {
        try { applied = document.execCommand('hiliteColor', false, colorVal); } catch {}
      }
      if (!applied && sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        try {
          const range = sel.getRangeAt(0);
          const mark = document.createElement('mark');
          mark.style.backgroundColor = colorVal;
          mark.style.color = 'inherit';
          mark.style.borderRadius = '4px';
          mark.style.padding = '1px 5px';
          mark.appendChild(range.extractContents());
          range.insertNode(mark);
          range.selectNodeContents(mark);
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (err) {
          console.warn('DOM highlight error:', err);
        }
      }
    }

    isExecutingActionRef.current = false;
    saveSelection();
    handleEditorInput();
  };

  // ---- Bullet / numbered item helpers (marker-span based, browser independent) ----
  const CIRCLED_DIGITS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];

  const caretTo = (el: HTMLElement, toEnd: boolean = true) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(!toEnd);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const listItemMarker = (format: string, prefix: string, index: number): string =>
    format === 'prefix' ? `${prefix} ${index}:` : (CIRCLED_DIGITS[index - 1] || `(${index})`);

  // The item text lives in its own span. Chrome's execCommand('insertHTML')
  // silently unwraps inline elements that carry no attributes, so the text can
  // end up as a bare child node of the block. Never assume the last child is
  // the text span - repair the shape first, otherwise the marker span gets
  // treated as the text and Enter would erase the bullet symbol.
  const itemTextElement = (item: HTMLElement): HTMLElement => {
    const marker = item.firstElementChild as HTMLElement | null;
    const last = item.lastElementChild as HTMLElement | null;
    if (
      last &&
      last !== marker &&
      last.tagName === 'SPAN' &&
      last.getAttribute('contenteditable') !== 'false'
    ) {
      return last;
    }
    const existing = item.querySelector('[data-om-text]') as HTMLElement | null;
    if (existing) return existing;
    const textEl = document.createElement('span');
    textEl.setAttribute('data-om-text', '1');
    Array.from(item.childNodes).forEach(node => {
      if (node !== marker) textEl.appendChild(node);
    });
    item.appendChild(textEl);
    return textEl;
  };

  // Resolve a list item: new marker-span format (data-om-list) or the older legacy shape.
  // Clicking the bullet glyph puts the caret inside the marker span, which is
  // contenteditable="false" - typing there is ignored, so the editor looks dead.
  // Same for a caret that lands directly on the flex item instead of its text
  // span. Pull it back into the editable text before a key is handled.
  const ensureEditableCaret = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0 || !selection.isCollapsed) return;

    const anchor = selection.anchorNode;
    if (!anchor || !editor.contains(anchor)) return;
    const anchorEl = anchor.nodeType === 1 ? (anchor as HTMLElement) : anchor.parentElement;
    if (!anchorEl) return;

    const focusEditable = (host: HTMLElement) => {
      if (!host.firstChild) host.appendChild(document.createElement('br'));
      caretTo(host, true);
    };

    const locked = anchorEl.closest('[contenteditable="false"]') as HTMLElement | null;
    if (locked) {
      const item = locked.closest('[data-om-list]') as HTMLElement | null;
      if (item) {
        focusEditable(itemTextElement(item));
      } else {
        const fallback = editor.lastElementChild as HTMLElement | null;
        if (fallback) focusEditable(fallback);
      }
      return;
    }

    if (anchor.nodeType === 1 && (anchor as HTMLElement).hasAttribute('data-om-list')) {
      focusEditable(itemTextElement(anchor as HTMLElement));
      return;
    }

    // With unselectable markers Chrome sometimes parks the caret on the editor
    // root instead of the row, so the next keystroke went to the end of the note.
    if (anchor === editor) {
      const row = editor.querySelector('[data-om-list]') as HTMLElement | null;
      if (row) focusEditable(itemTextElement(row));
    }
  };

  const getBulletItem = (node: Node | null): HTMLElement | null => {
    if (!node) return null;
    const base: HTMLElement | null = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
    const explicit = base?.closest?.('[data-om-list]') as HTMLElement | null;
    if (explicit) return explicit;
    const legacy = base?.closest?.('div') as HTMLElement | null;
    if (!legacy || legacy.children.length !== 2) return null;
    const marker = legacy.children[0] as HTMLElement;
    if (marker.tagName !== 'SPAN') return null;
    const color = (marker.style.color || '').replace(/\s/g, '').toLowerCase();
    if (!color.includes('#b88648') && !color.includes('rgb(184,134,72')) return null;
    const symbol = (marker.textContent || '').trim();
    return symbol && symbol.length <= 3 ? legacy : null;
  };

  const nextItemMarker = (item: HTMLElement): string | null => {
    if ((item.dataset.omList || '') !== 'number') return null;
    const format = item.dataset.omFormat || 'circled';
    const prefix = item.dataset.omPrefix || '';
    let index = 1;
    let prev = item.previousElementSibling as HTMLElement | null;
    while (
      prev &&
      prev.dataset?.omList === 'number' &&
      (prev.dataset.omFormat || 'circled') === format &&
      (prev.dataset.omPrefix || '') === prefix
    ) {
      index += 1;
      prev = prev.previousElementSibling as HTMLElement | null;
    }
    return listItemMarker(format, prefix, index + 1);
  };

  const caretAtStartOfItem = (item: HTMLElement): boolean => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return false;
    const textEl = itemTextElement(item);
    const range = selection.getRangeAt(0);
    if (!textEl.contains(range.startContainer)) return false;
    const before = range.cloneRange();
    before.selectNodeContents(textEl);
    before.setEnd(range.startContainer, range.startOffset);
    return before.toString() === '';
  };

  const selectFirstInsertedItem = (selectText: boolean) => {
    const editor = editorRef.current;
    if (!editor) return;
    const first = editor.querySelector('[data-om-tmp="1"]') as HTMLElement | null;
    editor.querySelectorAll('[data-om-tmp]').forEach(node => node.removeAttribute('data-om-tmp'));
    if (!first) return;
    const textEl = itemTextElement(first);
    if (!selectText) {
      caretTo(textEl, true);
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(textEl);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  // Enter inside a list item continues the exact same style on the next line.
  // An empty item exits the list (Word / Notion behaviour) so bullets can end.
  const continueListItem = (item: HTMLElement) => {
    const textEl = itemTextElement(item);
    if ((textEl.textContent || '').trim() === '') {
      const paragraph = document.createElement('p');
      paragraph.innerHTML = '<br>';
      item.replaceWith(paragraph);
      caretTo(paragraph, true);
      return;
    }

    const nextMarker = nextItemMarker(item);
    const clone = item.cloneNode(true) as HTMLElement;
    clone.removeAttribute('data-om-tmp');
    if (nextMarker) {
      const markerEl = clone.firstElementChild as HTMLElement | null;
      if (markerEl && markerEl.tagName === 'SPAN') {
        markerEl.textContent = nextMarker;
        if (clone.dataset.omList === 'number') clone.dataset.omMarker = nextMarker;
      }
    }
    const cloneText = itemTextElement(clone);
    cloneText.innerHTML = '<br>';
    item.after(clone);
    caretTo(cloneText, true);
  };

  // A selection covering whole list lines should clear those lines completely.
  // The browser already deletes the selected text; this removes the emptied row
  // shells between the untouched neighbours and keeps a usable caret.
  const cleanupEmptiedListRows = (parent: HTMLElement | null, before: HTMLElement | null, after: HTMLElement | null) => {
    if (!parent || !parent.isConnected) return;
    const children = Array.from(parent.children) as HTMLElement[];
    // The browser also deletes the neighbouring blocks when the selection
    // covers them, so a detached neighbour just means "open ended".
    const beforeAlive = before && before.isConnected ? before : null;
    const afterAlive = after && after.isConnected ? after : null;
    const startIdx = beforeAlive ? children.indexOf(beforeAlive) + 1 : 0;
    const endIdx = afterAlive ? children.indexOf(afterAlive) : children.length;
    if (beforeAlive && startIdx === 0) return; // neighbours were replaced: leave as is
    if (afterAlive && endIdx < 0) return;

    let removed = false;
    for (let i = endIdx - 1; i >= startIdx; i--) {
      const row = children[i];
      if (!row || !row.isConnected) continue;
      if (!row.hasAttribute('data-om-list')) continue;
      if ((itemTextElement(row).textContent || '').trim() !== '') continue;
      row.remove();
      removed = true;
    }
    if (!removed) return;

    const root = editorRef.current;
    if (!root) return;

    // The caret was inside a removed row: put it back inside an editable span.
    // Placing it at a flex container offset makes Chrome drop the selection
    // entirely, which is why typing stopped working after a multi-line delete.
    const putCaret = (el: HTMLElement, atEnd: boolean) => {
      const host = el.hasAttribute('data-om-list') ? itemTextElement(el) : el;
      if (!host.firstChild) host.appendChild(document.createElement('br'));
      caretTo(host, atEnd);
    };

    const anchorEl = after && after.isConnected ? after : before && before.isConnected ? before : null;
    if (anchorEl) {
      putCaret(anchorEl, anchorEl === before);
    } else if (!root.firstElementChild) {
      const paragraph = document.createElement('p');
      paragraph.innerHTML = '<br>';
      root.appendChild(paragraph);
      putCaret(paragraph, true);
    }
    if (document.activeElement !== root) root.focus();

    const liveSelection = window.getSelection();
    if (!liveSelection || liveSelection.rangeCount === 0) {
      const lastChild = root.lastElementChild as HTMLElement | null;
      if (lastChild) putCaret(lastChild, true);
    }
    handleEditorInput();
    saveSelection();
  };  // A new block (list/table) must never be inserted inside an existing item's
  // text span, otherwise it nests inside the bullet. Move the caret to a fresh
  // paragraph right after the current item instead.
  const ensureBlockInsertionPoint = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return;
    const item = getBulletItem(selection.anchorNode);
    if (!item) return;
    const paragraph = document.createElement('p');
    paragraph.innerHTML = '<br>';
    item.after(paragraph);
    caretTo(paragraph, true);
  };

  // Keep the live DOM valid after block insertion: <p><p>..</p></p> can appear
  // when a block list is inserted at a caret inside an empty paragraph.
  const normalizeEditorBlocks = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll('p').forEach(p => {
      if (p.parentElement && p.parentElement.tagName === 'P') {
        p.replaceWith(...Array.from(p.childNodes));
      }
    });
  };

  // An empty contenteditable has no block wrapper, so the first keystroke lands as
  // a bare text node and Chrome then creates <div> lines. In that state every
  // block-level tool (heading, quote, code, bullets, table) silently misfires.
  // This normalises the root into real paragraph blocks and keeps the caret.
  const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'TABLE', 'HR', 'FIGURE']);

  const isRootBlock = (node: Node): boolean => {
    if (node.nodeType !== 1) return false;
    const el = node as HTMLElement;
    if (el.hasAttribute('data-om-list')) return true;
    if (el.tagName === 'DIV' && el.hasAttribute('data-om-table')) return true;
    return BLOCK_TAGS.has(el.tagName);
  };

  const hasStrayRootNodes = (): boolean => {
    const editor = editorRef.current;
    if (!editor) return false;
    return Array.from(editor.childNodes).some(node => {
      if (node.nodeType === 3) return (node.textContent || '').trim() !== '';
      if (node.nodeType === 8) return false;
      return !isRootBlock(node);
    });
  };

  const ensureBlockStructure = (): boolean => {
    const editor = editorRef.current;
    if (!editor) return false;

    const selection = window.getSelection();
    const saved =
      selection && selection.rangeCount > 0 && editor.contains(selection.getRangeAt(0).startContainer)
        ? selection.getRangeAt(0).cloneRange()
        : null;

    let changed = false;
    let pending: Node[] = [];

    const flushPending = () => {
      if (pending.length === 0) return;
      const first = pending[0];
      const paragraph = document.createElement('p');
      editor.insertBefore(paragraph, first);
      pending.forEach(node => paragraph.appendChild(node));
      if (!paragraph.firstChild) paragraph.appendChild(document.createElement('br'));
      pending = [];
      changed = true;
    };

    Array.from(editor.childNodes).forEach(node => {
      if (node.nodeType === 3) {
        if ((node.textContent || '').trim() === '' && editor.childNodes.length > 1) {
          node.parentNode?.removeChild(node);
          changed = true;
          return;
        }
        pending.push(node);
        return;
      }
      if (node.nodeType !== 1) return;

      const el = node as HTMLElement;
      if (el.tagName === 'DIV' && !isRootBlock(el)) {
        flushPending();
        const paragraph = document.createElement('p');
        while (el.firstChild) paragraph.appendChild(el.firstChild);
        if (!paragraph.firstChild) paragraph.appendChild(document.createElement('br'));
        el.replaceWith(paragraph);
        changed = true;
        return;
      }
      if (isRootBlock(el)) {
        flushPending();
        return;
      }
      pending.push(node);
    });
    flushPending();

    if (editor.childNodes.length === 0) {
      const paragraph = document.createElement('p');
      paragraph.innerHTML = '<br>';
      editor.appendChild(paragraph);
      changed = true;
    }

    if (changed && saved) {
      try {
        if (editor.contains(saved.startContainer) && editor.contains(saved.endContainer)) {
          selection?.removeAllRanges();
          selection?.addRange(saved);
          savedRangeRef.current = saved;
        }
      } catch {}
    }
    return changed;
  };

  // The block the caret sits in, at the editor root level.
  const currentRootBlock = (): HTMLElement | null => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    if (!editor || !anchor || !editor.contains(anchor)) return null;
    let node: Node = anchor;
    while (node.parentNode && node.parentNode !== editor) node = node.parentNode;
    return node.nodeType === 1 ? (node as HTMLElement) : null;
  };

  // Clicking a bullet/number style with the caret on a normal line should turn
  // that line into an item (Google Docs / Notion behaviour) instead of leaving
  // the text behind and appending an empty "List item".
  const makeListItem = (kind: 'bullet' | 'number', symbol: string, contentHtml: string): HTMLElement => {
    const item = document.createElement('div');
    item.setAttribute('data-om-list', kind);
    const isImageMarker = /^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(symbol);
    item.setAttribute('data-om-marker', isImageMarker ? 'custom-image' : symbol);
    if (kind === 'number') {
      item.setAttribute('data-om-format', 'circled');
      item.setAttribute('data-om-prefix', '');
    }
    item.setAttribute('style', 'display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;');

    const marker = document.createElement('span');
    marker.setAttribute('contenteditable', 'false');
    // A selectable marker poisons the whole selection: Chrome collapses any
    // range that touches it, so Ctrl+A / drag-select + Backspace deleted
    // nothing. The glyph is decoration, not text.
    marker.setAttribute('style', 'color: #b88648; font-weight: bold; flex-shrink: 0; -webkit-user-select: none; user-select: none;');
    if (isImageMarker) {
      const image = document.createElement('img');
      image.src = symbol;
      image.alt = '';
      image.width = 18;
      image.height = 18;
      image.style.width = '18px';
      image.style.height = '18px';
      marker.appendChild(image);
    } else {
      marker.textContent = symbol;
    }

    const textEl = document.createElement('span');
    textEl.setAttribute('data-om-text', '1');
    if (contentHtml && contentHtml.trim() && contentHtml.trim() !== '<br>') textEl.innerHTML = contentHtml;
    else textEl.appendChild(document.createElement('br'));

    item.appendChild(marker);
    item.appendChild(textEl);
    return item;
  };

  const convertCurrentBlockToList = (kind: 'bullet' | 'number', symbol: string): boolean => {
    const selection = window.getSelection();
    const block = currentRootBlock();
    if (!selection || !selection.isCollapsed || !block) return false;
    if (block.hasAttribute('data-om-list') || block.tagName === 'TABLE' || block.tagName === 'UL' || block.tagName === 'OL') return false;
    if (!/^(P|DIV|H1|H2|H3|BLOCKQUOTE|PRE)$/.test(block.tagName)) return false;

    const item = makeListItem(kind, symbol, block.innerHTML);
    block.replaceWith(item);
    caretTo(itemTextElement(item), true);
    normalizeEditorBlocks();
    ensureBlockStructure();
    return true;
  };

  const bulletItemHtml = (symbol: string, text: string, extraAttrs: string = ''): string => {
    const isImageMarker = /^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(symbol);
    const marker = isImageMarker
      ? `<img src="${escapeHtml(symbol)}" alt="" width="18" height="18"/>`
      : escapeHtml(symbol);
    const markerData = isImageMarker ? 'custom-image' : escapeHtml(symbol);
    return `<div data-om-list="bullet" data-om-marker="${markerData}" data-om-tmp="1"${extraAttrs} style="display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;"><span contenteditable="false" style="color: #b88648; font-weight: bold; flex-shrink: 0; -webkit-user-select: none; user-select: none;">${marker}</span><span data-om-text="1">${escapeHtml(text)}</span></div>`;
  };
  // =========================================================================
  // 3. BULLETS & NUMBERING
  // =========================================================================
  const insertBulletList = (symbol: string) => {
    isExecutingActionRef.current = true;
    restoreSelection();

    if (symbol === '•' || symbol === 'disc') {
      try {
        document.execCommand('insertUnorderedList', false, undefined);
      } catch {}
      isExecutingActionRef.current = false;
      saveSelection();
      handleEditorInput();
      return;
    }

    if (convertCurrentBlockToList('bullet', symbol)) {
      isExecutingActionRef.current = false;
      saveSelection();
      handleEditorInput();
      return;
    }

    ensureBlockInsertionPoint();

    const sel = window.getSelection();
    const selectedText = sel ? sel.toString() : '';
    const lines = selectedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const items = lines.length > 0 ? lines : ['List item'];

    // Marker is real text in its own span (plus data-om-list), so Enter keeps the
    // custom bullet in every browser - CSS string markers are not reliable.
    const listHtml = items.map(line => bulletItemHtml(symbol, line)).join('') + '<p><br/></p>';

    let inserted = false;
    try {
      inserted = document.execCommand('insertHTML', false, listHtml);
    } catch {}
    if (!inserted) insertHtmlAtCaret(listHtml);
    normalizeEditorBlocks();
    ensureBlockStructure();

    selectFirstInsertedItem(lines.length === 0);

    isExecutingActionRef.current = false;
    saveSelection();
    handleEditorInput();
  };

  const applyCustomBullet = (rawSymbol = customBulletInput) => {
    const symbol = customBulletImage || rawSymbol.trim();
    if (!symbol) return;
    insertBulletList(symbol);
    setCustomBulletInput('');
    setCustomBulletImage('');
    setCustomBulletImageError('');
  };

  const insertNumberedList = (styleType: string, customPrefix?: string) => {
    isExecutingActionRef.current = true;
    restoreSelection();

    if (styleType === '1' && !customPrefix) {
      try {
        document.execCommand('insertOrderedList', false, undefined);
      } catch {}
      isExecutingActionRef.current = false;
      saveSelection();
      handleEditorInput();
      return;
    }

    if (convertCurrentBlockToList('number', customPrefix ? `${customPrefix} 1:` : listItemMarker('circled', '', 1))) {
      isExecutingActionRef.current = false;
      saveSelection();
      handleEditorInput();
      return;
    }

    ensureBlockInsertionPoint();

    const sel = window.getSelection();
    const selectedText = sel ? sel.toString() : '';
    const lines = selectedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const items = lines.length > 0 ? lines : ['First item'];

    let listHtml = '';
    if (!customPrefix && (styleType === 'a' || styleType === 'A' || styleType === 'i' || styleType === 'I')) {
      listHtml = `<ol type="${styleType}" style="padding-left: 1.8em;">${items.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ol><p><br/></p>`;
    } else {
      const format = customPrefix ? 'prefix' : 'circled';
      const prefix = customPrefix || '';
      listHtml = items.map((line, idx) => {
        const marker = listItemMarker(format, prefix, idx + 1);
        return `<div data-om-list="number" data-om-format="${format}" data-om-prefix="${escapeHtml(prefix)}" data-om-marker="${escapeHtml(marker)}" data-om-tmp="1" style="display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;"><span contenteditable="false" style="color: #b88648; font-weight: 700; flex-shrink: 0; -webkit-user-select: none; user-select: none;">${escapeHtml(marker)}</span><span data-om-text="1">${escapeHtml(line)}</span></div>`;
      }).join('') + '<p><br/></p>';
    }

    let inserted = false;
    try {
      inserted = document.execCommand('insertHTML', false, listHtml);
    } catch {}
    if (!inserted) insertHtmlAtCaret(listHtml);
    normalizeEditorBlocks();
    ensureBlockStructure();

    selectFirstInsertedItem(lines.length === 0);

    isExecutingActionRef.current = false;
    saveSelection();
    handleEditorInput();
  };  // =========================================================================
  // 4. TABLE CREATION & EDITING
  // =========================================================================
  const insertTable = (rows: number, cols: number, withHeader: boolean = true) => {
    isExecutingActionRef.current = true;
    restoreSelection();
    // A table is a block: never let it land inside a list item's text span.
    ensureBlockStructure();
    ensureBlockInsertionPoint();

    // Grid lines, header fill and zebra rows come from index.css so the table
    // follows the active theme instead of baking in light-only colors.
    let tableHtml = `<table style="width: 100%; border-collapse: separate; border-spacing: 0; margin: 12px 0;" data-om-table="true">`;

    if (withHeader) {
      tableHtml += `<thead><tr>`;
      for (let c = 1; c <= cols; c++) {
        tableHtml += `<th style="padding: 8px 12px; text-align: left; font-size: 12px;">Header ${c}</th>`;
      }
      tableHtml += `</tr></thead>`;
    }

    tableHtml += `<tbody>`;
    const numRows = withHeader ? Math.max(1, rows - 1) : rows;
    for (let r = 1; r <= numRows; r++) {
      tableHtml += `<tr>`;
      for (let c = 1; c <= cols; c++) {
        tableHtml += `<td style="padding: 7px 12px; min-width: 60px; font-size: 12px;">Cell ${r},${c}</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table><p><br/></p>`;

    let inserted = false;
    try {
      inserted = document.execCommand('insertHTML', false, tableHtml);
    } catch {}
    if (!inserted) insertHtmlAtCaret(tableHtml);
    normalizeEditorBlocks();
    ensureBlockStructure();

    isExecutingActionRef.current = false;
    saveSelection();
    detectActiveTable();
    handleEditorInput();
  };

  const getTargetTable = () => {
    if (lastActiveTableRef.current && editorRef.current?.contains(lastActiveTableRef.current)) {
      return lastActiveTableRef.current;
    }
    const tableInEditor = editorRef.current?.querySelector('table');
    return tableInEditor || null;
  };

  const addTableRow = () => {
    const table = getTargetTable();
    if (!table) return;

    const targetCell = lastActiveCellRef.current;
    const targetRow = targetCell?.closest('tr');
    const insertIndex = targetRow ? targetRow.rowIndex + 1 : -1;

    const numCols = table.rows[0]?.cells.length || 2;
    const newRow = table.insertRow(insertIndex);
    for (let i = 0; i < numCols; i++) {
      const newCell = newRow.insertCell(i);
      newCell.style.padding = '7px 12px';
      newCell.style.minWidth = '60px';
      newCell.style.fontSize = '12px';
      newCell.innerText = 'New Data';
    }
    lastActiveCellRef.current = newRow.cells[0];
    detectActiveTable();
    handleEditorInput();
  };

  const deleteTableRow = () => {
    const table = getTargetTable();
    if (!table) return;

    const targetCell = lastActiveCellRef.current;
    const targetRow = targetCell?.closest('tr') || table.rows[table.rows.length - 1];
    if (targetRow) {
      if (table.rows.length <= 1) {
        table.remove();
        lastActiveTableRef.current = null;
        lastActiveCellRef.current = null;
      } else {
        shiftTableReferences(table, 'row', targetRow.rowIndex + 1, -1, targetRow);
        table.deleteRow(targetRow.rowIndex);
      }
      detectActiveTable();
      handleEditorInput();
    }
  };

  const deleteTableColumn = () => {
    const table = getTargetTable();
    if (!table) return;

    const targetCell = lastActiveCellRef.current;
    const colIndex = targetCell ? targetCell.cellIndex : (table.rows[0]?.cells.length ? table.rows[0].cells.length - 1 : 0);

    if (table.rows[0]?.cells.length <= 1) {
      table.remove();
      lastActiveTableRef.current = null;
      lastActiveCellRef.current = null;
    } else {
      shiftTableReferences(table, 'col', colIndex + 1, -1);
      for (let r = 0; r < table.rows.length; r++) {
        const row = table.rows[r];
        if (row.cells[colIndex]) {
          row.deleteCell(colIndex);
        }
      }
    }
    detectActiveTable();
    handleEditorInput();
  };

  const deleteTable = () => {
    const table = getTargetTable();
    if (table) {
      table.remove();
      lastActiveTableRef.current = null;
      lastActiveCellRef.current = null;
      detectActiveTable();
      handleEditorInput();
    }
  };

  // =========================================================================
  // 4b. EXCEL-STYLE TABLE ENGINE (formulas, totals, cell formatting)
  // =========================================================================
  const cellFromNode = (node: Node | null): HTMLTableCellElement | null => {
    if (!node) return null;
    const el = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
    const cell = el?.closest?.('td, th') as HTMLTableCellElement | null;
    return cell && editorRef.current?.contains(cell) ? cell : null;
  };

  const activeCell = (): HTMLTableCellElement | null => {
    const remembered = lastActiveCellRef.current;
    if (remembered && editorRef.current?.contains(remembered)) return remembered;
    const selection = window.getSelection();
    return cellFromNode(selection?.anchorNode ?? null);
  };

  const tableMatrix = (table: HTMLTableElement): HTMLTableCellElement[][] =>
    Array.from(table.rows).map(row => Array.from(row.cells) as HTMLTableCellElement[]);

  const tableGrid = (table: HTMLTableElement): string[][] =>
    tableMatrix(table).map(row => row.map(cell => (cell.textContent || '').trim()));

  const tableFormulaMap = (table: HTMLTableElement): Map<string, string> => {
    const map = new Map<string, string>();
    tableMatrix(table).forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const formula = cell.getAttribute('data-om-formula');
        if (formula) map.set(`${rowIndex + 1}:${colIndex + 1}`, formula);
      });
    });
    return map;
  };

  /** Excel keeps references pointing at the same data after a structural edit. */
  const shiftTableReferences = (
    table: HTMLTableElement,
    axis: 'row' | 'col',
    at: number,
    delta: number,
    skipRow?: HTMLTableRowElement | null
  ) => {
    tableMatrix(table).forEach(row => {
      row.forEach(cell => {
        if (skipRow && cell.closest('tr') === skipRow) return;
        const formula = cell.getAttribute('data-om-formula');
        if (!formula) return;
        const next = shiftFormulaReferences(formula, axis, at, delta);
        cell.setAttribute('data-om-formula', next);
      });
    });
  };

  const recalculateTable = (table: HTMLTableElement | null, force = false): boolean => {
    if (!table) return false;
    const grid = tableGrid(table);
    const formulas = tableFormulaMap(table);
    const selection = window.getSelection();
    const editingCell = selection && selection.rangeCount > 0 ? cellFromNode(selection.anchorNode) : null;
    let changed = false;

    tableMatrix(table).forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const formula = cell.getAttribute('data-om-formula');
        if (!formula) return;
        const result = evaluateTableFormula(formula, {
          grid,
          formulas,
          at: { row: rowIndex + 1, col: colIndex + 1 }
        });
        const text = result.error
          ? result.error
          : formatCellNumber(result.value ?? 0, cell.getAttribute('data-om-numfmt') || undefined);

        cell.setAttribute('data-om-calc', '1');
        if (result.error) cell.setAttribute('data-om-err', result.error);
        else cell.removeAttribute('data-om-err');

        if ((cell.textContent || '') !== text) {
          cell.textContent = text;
          changed = true;
          // Rewriting the cell that holds the caret destroys it, so the caret is
          // put back at the end of the fresh value.
          if (!force && editingCell === cell) {
            const active = document.activeElement;
            if (active === editorRef.current || editorRef.current?.contains(active)) caretTo(cell, true);
          }
        }
      });
    });
    return changed;
  };

  /**
   * Notes saved by earlier builds carry light-only table colors (#ffffff rows,
   * #f1f5f9 headers). Those are stripped so the CSS theme can paint the table
   * again; user shading (any other color) is left untouched.
   */
  const normalizeTableTheme = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const DEFAULTS = new Set(['#ffffff', '#f8fafc', '#eef2ff', 'rgb(255, 255, 255)', 'rgb(248, 250, 252)', 'rgb(238, 242, 255)']);
    editor.querySelectorAll<HTMLTableRowElement>('table[data-om-table] tr').forEach(row => {
      if (DEFAULTS.has(row.style.backgroundColor)) row.style.backgroundColor = '';
    });
    editor.querySelectorAll<HTMLTableCellElement>('table[data-om-table] th').forEach(cell => {
      if (DEFAULTS.has(cell.style.backgroundColor)) cell.style.backgroundColor = '';
      if (cell.style.color === '#1e293b' || cell.style.color === 'rgb(30, 41, 59)') cell.style.color = '';
    });
  };

  const recalculateAllTables = (): boolean => {
    const editor = editorRef.current;
    if (!editor) return false;
    let changed = false;
    editor.querySelectorAll('table').forEach(table => {
      if (recalculateTable(table as HTMLTableElement)) changed = true;
    });
    return changed;
  };

  const cellsInSelection = (fallback: HTMLTableCellElement): HTMLTableCellElement[] => {
    const table = fallback.closest('table');
    if (!table) return [fallback];
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return [fallback];
    const range = selection.getRangeAt(0);
    const cells = Array.from(table.querySelectorAll('td, th')) as HTMLTableCellElement[];
    const touched = cells.filter(cell => {
      try {
        return range.intersectsNode(cell);
      } catch {
        return false;
      }
    });
    return touched.length > 0 ? touched : [fallback];
  };

  const refreshTableStats = () => {
    const cell = activeCell();
    const table = cell?.closest('table') as HTMLTableElement | null;
    if (!cell || !table || !cell.parentElement) {
      setTableStats(null);
      return;
    }
    const rowIndex = (cell.parentElement as HTMLTableRowElement).rowIndex + 1;
    const colIndex = cell.cellIndex + 1;
    const grid = tableGrid(table);
    // Excel's status bar equivalent: the numbers sitting above this cell.
    const above = grid.slice(0, Math.max(0, rowIndex - 1)).map(line => [line[colIndex - 1] ?? '']);
    const values = numbersFromGrid(above);
    setTableStats(values.length > 0 ? statsForValues(values) : null);
  };

  const styleTableCell = (cell: HTMLTableCellElement, header = false) => {
    cell.style.padding = header ? '8px 12px' : '7px 12px';
    cell.style.minWidth = '60px';
    cell.style.fontSize = '12px';
    if (header) {
      cell.style.fontWeight = '700';
      cell.style.textAlign = 'left';
    }
  };

  const commitCellFormula = (raw: string) => {
    const cell = activeCell();
    if (!cell) return;
    const table = cell.closest('table') as HTMLTableElement | null;
    const value = raw.trim();
    if (!value) {
      cell.removeAttribute('data-om-formula');
      cell.removeAttribute('data-om-calc');
      cell.textContent = '';
    } else if (value.startsWith('=')) {
      cell.setAttribute('data-om-formula', value);
      cell.textContent = '';
      recalculateTable(table, true);
    } else {
      cell.removeAttribute('data-om-formula');
      cell.removeAttribute('data-om-calc');
      cell.textContent = value;
      recalculateTable(table, true);
    }
    setFormulaDraft(value);
    detectActiveTable();
    handleEditorInput();
  };

  const insertAggregate = (fn: 'SUM' | 'AVERAGE' | 'COUNT' | 'MIN' | 'MAX') => {
    const cell = activeCell();
    if (!cell) return;
    const table = cell.closest('table') as HTMLTableElement | null;
    cell.setAttribute('data-om-formula', `=${fn}(ABOVE)`);
    cell.setAttribute('data-om-calc', '1');
    cell.textContent = '';
    recalculateTable(table, true);
    setFormulaDraft(`=${fn}(ABOVE)`);
    detectActiveTable();
    handleEditorInput();
    refreshTableStats();
  };

  const insertTableRow = (where: 'above' | 'below') => {
    const table = getTargetTable();
    if (!table) return;
    const cell = activeCell();
    const row = cell?.closest('tr') as HTMLTableRowElement | null;
    const reference = row ? row.rowIndex + (where === 'below' ? 1 : 0) : -1;
    const cols = table.rows[0]?.cells.length || 2;
    shiftTableReferences(table, 'row', (reference < 0 ? table.rows.length : reference) + 1, 1);
    const newRow = table.insertRow(reference);
    for (let index = 0; index < cols; index += 1) {
      const newCell = newRow.insertCell(index);
      styleTableCell(newCell);
      newCell.innerHTML = '<br>';
    }
    recalculateTable(table);
    detectActiveTable();
    handleEditorInput();
  };

  const insertTableColumn = (where: 'left' | 'right') => {
    const table = getTargetTable();
    if (!table) return;
    const cell = activeCell();
    const targetIndex = cell ? cell.cellIndex + (where === 'right' ? 1 : 0) : -1;
    shiftTableReferences(table, 'col', (targetIndex < 0 ? (table.rows[0]?.cells.length || 0) : targetIndex) + 1, 1);
    Array.from(table.rows).forEach(row => {
      const isHeader = row.parentElement?.tagName === 'THEAD' || row.cells[0]?.tagName === 'TH';
      const newCell = document.createElement(isHeader ? 'th' : 'td') as HTMLTableCellElement;
      styleTableCell(newCell, isHeader);
      newCell.innerHTML = '<br>';
      const before = targetIndex < 0 ? null : row.children[targetIndex] ?? null;
      row.insertBefore(newCell, before);
    });
    recalculateTable(table);
    detectActiveTable();
    handleEditorInput();
  };

  const addTableTotalRow = () => {
    const table = getTargetTable();
    if (!table) return;
    const cols = table.rows[0]?.cells.length || 1;
    const totalRow = table.insertRow(-1);
    totalRow.setAttribute('data-om-total', '1');
    for (let index = 0; index < cols; index += 1) {
      const cell = totalRow.insertCell(index);
      styleTableCell(cell);
      if (index === 0) {
        cell.textContent = 'Total';
      } else {
        const letter = columnLabel(index + 1);
        const firstDataRow = table.tHead ? 2 : 1;
        const lastDataRow = table.rows.length - 1;
        if (lastDataRow >= firstDataRow) {
          cell.setAttribute('data-om-formula', `=SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`);
          cell.setAttribute('data-om-calc', '1');
        }
      }
    }
    recalculateTable(table, true);
    detectActiveTable();
    handleEditorInput();
  };

  const applyTableCellAlign = (align: 'left' | 'center' | 'right') => {
    const cell = activeCell();
    if (!cell) return;
    cellsInSelection(cell).forEach(target => {
      target.style.textAlign = align;
    });
    handleEditorInput();
  };

  /** Dark fills get light text (and vice versa), so a hand-picked colour stays readable. */
  const readableTextOnFill = (color: string): string => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = color;
    if (!probe.style.backgroundColor) return '';
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const match = rgb.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!match) return '';
    const luminance = (0.299 * Number(match[1]) + 0.587 * Number(match[2]) + 0.114 * Number(match[3])) / 255;
    return luminance > 0.6 ? '#0f172a' : '#f8fafc';
  };

  const shadeTableCells = (color: string) => {
    const cell = activeCell();
    if (!cell) return;
    const textColor = color ? readableTextOnFill(color) : '';
    cellsInSelection(cell).forEach(target => {
      target.style.backgroundColor = color || '';
      target.style.color = textColor;
    });
    handleEditorInput();
  };

  const toggleTableCellBold = () => {
    const cell = activeCell();
    if (!cell) return;
    const targets = cellsInSelection(cell);
    const shouldBold = cell.style.fontWeight !== '700';
    targets.forEach(target => {
      target.style.fontWeight = shouldBold ? '700' : '400';
    });
    handleEditorInput();
  };

  const clearTableCells = () => {
    const cell = activeCell();
    if (!cell) return;
    cellsInSelection(cell).forEach(target => {
      target.removeAttribute('data-om-formula');
      target.removeAttribute('data-om-calc');
      target.removeAttribute('data-om-err');
      target.innerHTML = '<br>';
    });
    recalculateTable(cell.closest('table') as HTMLTableElement | null);
    handleEditorInput();
    detectActiveTable();
  };

  const TABLE_MIN_COLUMN = 40;
  const TABLE_MAX_COLUMN = 900;
  const TABLE_MIN_ROW = 24;
  const TABLE_MAX_ROW = 600;

  // Excel's number formats, with a sample so the menu says what each one does.
  const TABLE_NUMBER_FORMATS: { value: string; label: string; sample: string }[] = [
    { value: '', label: 'General', sample: '1234.5' },
    { value: '0', label: '0', sample: '1235' },
    { value: '0.0', label: '0.0', sample: '1234.5' },
    { value: '0.00', label: '0.00', sample: '1234.50' },
    { value: '#,##0', label: '#,##0', sample: '1,235' },
    { value: '#,##0.00', label: '#,##0.00', sample: '1,234.50' },
    { value: '₹#,##0', label: '₹#,##0', sample: '₹1,235' },
    { value: '₹#,##0.00', label: '₹#,##0.00', sample: '₹1,234.50' },
    { value: '0%', label: '0%', sample: '1250%' }
  ];
  /** Pointer distance (px) that counts as grabbing a cell border. */
  const TABLE_RESIZE_GRAB = 6;

  const clampColumnWidth = (value: number) =>
    Math.min(TABLE_MAX_COLUMN, Math.max(TABLE_MIN_COLUMN, Math.round(value)));

  const clampRowHeight = (value: number) =>
    Math.min(TABLE_MAX_ROW, Math.max(TABLE_MIN_ROW, Math.round(value)));

  /** `null` hands the column back to the browser (content fit / Auto). */
  const setColumnWidth = (table: HTMLTableElement, index: number, width: number | null) => {
    Array.from(table.rows).forEach(row => {
      const target = row.cells[index];
      if (!target) return;
      target.style.width = width === null ? '' : `${width}px`;
      target.style.minWidth = width === null ? '60px' : `${width}px`;
    });
  };

  const setRowHeight = (row: HTMLTableRowElement, height: number | null) => {
    row.style.height = height === null ? '' : `${height}px`;
    Array.from(row.cells).forEach(cell => {
      cell.style.height = height === null ? '' : `${height}px`;
    });
  };

  /** Columns touched by the caret (or by a multi-cell selection). */
  const scopedColumnIndexes = (cell: HTMLTableCellElement): number[] =>
    Array.from(new Set(cellsInSelection(cell).map(target => target.cellIndex))).sort((a, b) => a - b);

  const resizeActiveColumns = (delta: number) => {
    const cell = activeCell();
    const table = cell?.closest('table') as HTMLTableElement | null;
    if (!cell || !table) return;
    const firstRow = table.rows[0];
    scopedColumnIndexes(cell).forEach(index => {
      const probe = firstRow?.cells[index];
      const current = probe ? (parseFloat(probe.style.width) || probe.offsetWidth || 60) : 60;
      const next = clampColumnWidth(current + delta);
      setColumnWidth(table, index, next);
      setCellColumnWidth(next);
    });
    detectActiveTable();
    handleEditorInput();
  };

  const resetActiveColumnWidth = () => {
    const cell = activeCell();
    const table = cell?.closest('table') as HTMLTableElement | null;
    if (!cell || !table) return;
    scopedColumnIndexes(cell).forEach(index => setColumnWidth(table, index, null));
    setCellColumnWidth(0);
    detectActiveTable();
    handleEditorInput();
  };

  const resizeActiveRows = (delta: number) => {
    const cell = activeCell();
    const table = cell?.closest('table') as HTMLTableElement | null;
    if (!cell || !table) return;
    const rows = Array.from(new Set(
      cellsInSelection(cell).map(target => target.closest('tr') as HTMLTableRowElement | null)
    )).filter((row): row is HTMLTableRowElement => !!row);
    rows.forEach(row => {
      const current = parseFloat(row.style.height) || row.offsetHeight || 28;
      const next = clampRowHeight(current + delta);
      setRowHeight(row, next);
      setCellRowHeight(next);
    });
    detectActiveTable();
    handleEditorInput();
  };

  const resetActiveRowHeight = () => {
    const cell = activeCell();
    if (!cell) return;
    cellsInSelection(cell).forEach(target => {
      const row = target.closest('tr') as HTMLTableRowElement | null;
      if (row) setRowHeight(row, null);
    });
    setCellRowHeight(0);
    detectActiveTable();
    handleEditorInput();
  };

  /* --------------------------- drag to resize --------------------------- */
  // Excel-style sizing: grab the right edge of a column (or the bottom edge of a
  // row) and drag. Double-clicking that same edge fits the column/row back to
  // its content. Both paths write exactly the same inline styles as the Format
  // tab buttons, so sizes survive a save and reload.

  type TableResizeHit =
    | { kind: 'column'; table: HTMLTableElement; index: number; size: number }
    | { kind: 'row'; table: HTMLTableElement; row: HTMLTableRowElement; size: number };

  type TableResizeDrag = {
    kind: 'column' | 'row';
    table: HTMLTableElement;
    index: number;
    row: HTMLTableRowElement | null;
    startPos: number;
    startSize: number;
    lastSize: number;
  };

  const tableResizeRef = useRef<TableResizeDrag | null>(null);

  const tableResizeHitAt = (clientX: number, clientY: number, target: EventTarget | null): TableResizeHit | null => {
    const cell = (target as HTMLElement | null)?.closest?.('td,th') as HTMLTableCellElement | null;
    if (!cell || !editorRef.current?.contains(cell)) return null;
    const table = cell.closest('table') as HTMLTableElement | null;
    if (!table) return null;
    const rect = cell.getBoundingClientRect();
    // Column edges win on the bottom-right corner: widening a column is the
    // more common intent there.
    if (rect.width > 18 && Math.abs(clientX - rect.right) <= TABLE_RESIZE_GRAB) {
      return { kind: 'column', table, index: cell.cellIndex, size: rect.width };
    }
    if (rect.height > 18 && Math.abs(clientY - rect.bottom) <= TABLE_RESIZE_GRAB) {
      const row = cell.closest('tr') as HTMLTableRowElement | null;
      if (!row) return null;
      return { kind: 'row', table, row, size: row.getBoundingClientRect().height };
    }
    return null;
  };

  const handleTableResizeHover = (event: React.MouseEvent<HTMLDivElement>) => {
    if (tableResizeRef.current || !editorRef.current) return;
    const hit = tableResizeHitAt(event.clientX, event.clientY, event.target);
    const cursor = hit ? (hit.kind === 'column' ? 'col-resize' : 'row-resize') : '';
    if (editorRef.current.style.cursor !== cursor) editorRef.current.style.cursor = cursor;
  };

  const handleTableResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const hit = tableResizeHitAt(event.clientX, event.clientY, event.target);
    if (!hit) return;
    // Stop the browser from starting a text selection or moving the caret.
    event.preventDefault();
    event.stopPropagation();
    tableResizeRef.current = {
      kind: hit.kind,
      table: hit.table,
      index: hit.kind === 'column' ? hit.index : hit.row.rowIndex,
      row: hit.kind === 'row' ? hit.row : null,
      startPos: hit.kind === 'column' ? event.clientX : event.clientY,
      startSize: hit.size,
      lastSize: Math.round(hit.size)
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = hit.kind === 'column' ? 'col-resize' : 'row-resize';
  };

  const handleTableResizeDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const hit = tableResizeHitAt(event.clientX, event.clientY, event.target);
    if (!hit) return;
    event.preventDefault();
    event.stopPropagation();
    if (hit.kind === 'column') setColumnWidth(hit.table, hit.index, null);
    else setRowHeight(hit.row, null);
    setCellColumnWidth(0);
    setCellRowHeight(0);
    detectActiveTable();
    handleEditorInput();
  };

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const drag = tableResizeRef.current;
      if (!drag) return;
      event.preventDefault();
      if (drag.kind === 'column') {
        const next = clampColumnWidth(drag.startSize + (event.clientX - drag.startPos));
        if (next === drag.lastSize) return;
        drag.lastSize = next;
        setColumnWidth(drag.table, drag.index, next);
        setCellColumnWidth(next);
        return;
      }
      if (!drag.row) return;
      const next = clampRowHeight(drag.startSize + (event.clientY - drag.startPos));
      if (next === drag.lastSize) return;
      drag.lastSize = next;
      setRowHeight(drag.row, next);
      setCellRowHeight(next);
    };

    const onUp = () => {
      if (!tableResizeRef.current) return;
      tableResizeRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (editorRef.current) editorRef.current.style.cursor = '';
      detectActiveTable();
      handleEditorInput();
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    window.addEventListener('blur', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      window.removeEventListener('blur', onUp);
    };
  }, [detectActiveTable, handleEditorInput]);
  const applyCellNumberFormat = (format: string) => {
    const cell = activeCell();
    if (!cell) return;
    const table = cell.closest('table') as HTMLTableElement | null;
    cellsInSelection(cell).forEach(target => {
      if (format) target.setAttribute('data-om-numfmt', format);
      else target.removeAttribute('data-om-numfmt');
      if (target.getAttribute('data-om-formula')) return;
      // Keep the raw number, so switching 1,234.50 -> 1,235 -> 1,234.50 never
      // loses paise (same trick Excel uses behind the displayed value).
      const stored = toNumber(target.getAttribute('data-om-numvalue'));
      const numeric = stored === null ? toNumber(target.textContent) : stored;
      if (numeric === null) return;
      target.setAttribute('data-om-numvalue', String(numeric));
      target.textContent = formatCellNumber(numeric, format || undefined);
    });
    setCellNumberFormat(format);
    recalculateTable(table, true);
    handleEditorInput();
  };

  const toggleActiveTableHeader = () => {
    const table = getTargetTable();
    if (!table) return;
    const headerRow = table.rows[0];
    if (!headerRow) return;

    if (table.tHead) {
      const row = table.tHead.rows[0];
      table.tHead.remove();
      const body = table.tBodies[0] || table.createTBody();
      body.insertBefore(row, body.firstChild);
      Array.from(row.cells).forEach(cell => {
        const replacement = document.createElement('td');
        replacement.innerHTML = cell.innerHTML;
        Array.from(cell.attributes).forEach(attribute => {
          if (attribute.name !== 'style' && attribute.name !== 'data-om-formula') {
            replacement.setAttribute(attribute.name, attribute.value);
          }
        });
        replacement.style.cssText = cell.style.cssText;
        replacement.style.backgroundColor = '';
        replacement.style.fontWeight = '';
        replacement.style.color = '';
        cell.replaceWith(replacement);
      });
    } else {
      const thead = table.createTHead();
      thead.appendChild(headerRow);
      Array.from(headerRow.cells).forEach(cell => {
        const replacement = document.createElement('th');
        replacement.innerHTML = cell.innerHTML;
        Array.from(cell.attributes).forEach(attribute => {
          if (attribute.name !== 'style' && attribute.name !== 'data-om-formula') {
            replacement.setAttribute(attribute.name, attribute.value);
          }
        });
        replacement.style.cssText = cell.style.cssText;
        replacement.style.backgroundColor = '';
        replacement.style.color = '';
        replacement.style.fontWeight = '700';
        replacement.style.textAlign = 'left';
        cell.replaceWith(replacement);
      });
    }
    recalculateTable(table);
    detectActiveTable();
    handleEditorInput();
  };

  const toggleTableZebra = () => {
    const table = getTargetTable();
    if (!table) return;
    const enabled = table.getAttribute('data-om-zebra') !== '1';
    if (enabled) table.setAttribute('data-om-zebra', '1');
    else table.removeAttribute('data-om-zebra');
    Array.from(table.tBodies).forEach(body => {
      Array.from(body.rows).forEach(row => {
        row.style.backgroundColor = '';
      });
    });
    handleEditorInput();
  };

  const toggleEditorReading = () => {
    if (!isSpeechSynthesisSupported()) {
      console.warn('Text reading is not supported on this browser.');
      return;
    }

    if (!isEditorSpeaking) {
      const text = editorRef.current?.innerText || '';
      if (!text.trim()) return;
      if (!readerRef.current) readerRef.current = new TextReaderController();
      readerRef.current.speak(text, {
        lang: editorReaderLang,
        onStateChange: (st) => {
          setIsEditorSpeaking(st.isSpeaking);
          setIsEditorPaused(st.isPaused);
        }
      });
      setIsEditorSpeaking(true);
    } else {
      readerRef.current?.stop();
      setIsEditorSpeaking(false);
      setIsEditorPaused(false);
    }
  };

  // Saved notes keep their formulas as data-om-formula: recalculate them as soon
  // as the HTML is mounted so the visible numbers are never stale.
  useEffect(() => {
    normalizeTableTheme();
    recalculateAllTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHtml]);

  // The Calc/Format tabs mirror the cell the caret sits in.
  useEffect(() => {
    if (activeStudio !== 'bullets' || listTablePanelTab !== 'table') return;
    const cell = activeCell();
    setFormulaDraft(cell?.getAttribute('data-om-formula') || '');
    setCellNumberFormat(cell?.getAttribute('data-om-numfmt') || '');
    setCellColumnWidth(cell ? Math.round(cell.offsetWidth) : 0);
    setCellRowHeight(cell ? Math.round((cell.closest('tr') as HTMLElement | null)?.offsetHeight || 0) : 0);
    refreshTableStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStudio, listTablePanelTab, activeTableLocation?.row, activeTableLocation?.col, activeTableLocation?.totalRows, activeTableLocation?.totalCols]);
  return (
    <div className={`relative min-w-0 max-w-full rounded-lg border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/80 overflow-hidden ${className}`}>
      {/* ========================================================================= */}
      {/* 1. PRIMARY DOCKED TOOLBAR                                                */}
      {/* ========================================================================= */}
      <div className="journal-reflection-toolbar border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-800/60 backdrop-blur-xs px-1.5 py-0.75">
        <div className="note-toolbar-row flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-hidden overflow-y-hidden whitespace-nowrap py-0.5">
          <button type="button" onMouseDown={(e) => { e.preventDefault(); saveSelection(); setActiveStudio(prev => prev === 'text' ? null : 'text'); }} className={`flex h-7.5 shrink-0 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold ${activeStudio === 'text' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`} title="Text tools" aria-label="Text tools"><Hash className="h-3.5 w-3.5" /><span>Text</span><ChevronDown className="h-2.5 w-2.5" /></button>
          {/* Inline Formats: Bold, Italic, Underline, Strikethrough */}
          <button type="button" onMouseDown={(e) => { e.preventDefault(); saveSelection(); setActiveStudio(prev => prev === 'format' ? null : 'format'); }} className={`flex h-7.5 shrink-0 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold ${activeStudio === 'format' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`} title="Text formatting tools">
            <Bold className="h-3.5 w-3.5" /><span className="hidden sm:inline">Format</span><ChevronDown className="h-2.5 w-2.5" />
          </button>
          {false && <>
          <div className="flex items-center gap-0.5 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 shrink-0 shadow-2xs">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400"
              title="Bold (Ctrl+B)"
            >
              <Bold className="h-3.5 w-3.5 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400"
              title="Italic (Ctrl+I)"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); exec('underline'); }}
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400"
              title="Underline (Ctrl+U)"
            >
              <Underline className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); exec('strikeThrough'); }}
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400"
              title="Strikethrough"
            >
              <Strikethrough className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />
          </>}

          {/* =================================================================== */}
          {/* 4 CORE LUXURY STUDIO BUTTONS: COLOR, HIGHLIGHT, BULLETS, TABLE      */}
          {/* =================================================================== */}

          {/* 1. COLOR STUDIO TOGGLE */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
              if (activeStudio === 'color') setActiveStudio(null);
              else { setColorPanelTab('text'); setActiveStudio('color'); }
            }}
            className={`flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold border transition-all cursor-pointer shrink-0 shadow-2xs ${
              activeStudio === 'color'
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400 hover:text-indigo-600'
            }`}
            title="Text color and highlight palettes"
          >
            <Palette className={`h-3.5 w-3.5 ${activeStudio === 'color' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
            <span className="hidden sm:inline">Color</span>
            <ChevronDown className={`h-2.5 w-2.5 transition-transform ${activeStudio === 'color' ? 'rotate-180 opacity-90' : 'opacity-60'}`} />
          </button>

          {/* 3. BULLETS & NUMBERING TOGGLE */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
              if (activeStudio === 'bullets') setActiveStudio(null);
              else { setListTablePanelTab('bullets'); setActiveStudio('bullets'); }
            }}
            className={`flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold border transition-all cursor-pointer shrink-0 shadow-2xs ${
              activeStudio === 'bullets'
                ? 'bg-violet-600 border-violet-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-violet-400 hover:text-violet-600'
            }`}
            title="Bullet & Numbering Studio"
          >
            <List className={`h-3.5 w-3.5 ${activeStudio === 'bullets' ? 'text-white' : 'text-violet-600 dark:text-violet-400'}`} />
            <span className="hidden sm:inline">Lists &amp; Tables</span>
            <ChevronDown className={`h-2.5 w-2.5 transition-transform ${activeStudio === 'bullets' ? 'rotate-180 opacity-90' : 'opacity-60'}`} />
          </button>

          {false && <>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

          {/* Alignment */}
          <div className="flex items-center gap-0.5 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 shrink-0 shadow-2xs">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); exec('justifyLeft'); }}
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-200 hover:text-indigo-600"
              title="Align Left"
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); exec('justifyCenter'); }}
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-200 hover:text-indigo-600"
              title="Align Center"
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); exec('justifyRight'); }}
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-200 hover:text-indigo-600"
              title="Align Right"
            >
              <AlignRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); exec('justifyFull'); }}
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-200 hover:text-indigo-600"
              title="Justify (Ctrl+J)"
            >
              <AlignJustify className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />
          </>}

          {false && <>
          {/* Indent / Clear Formatting */}
          <div className="flex items-center gap-0.5 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 shrink-0 shadow-2xs">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); exec('outdent'); }}
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-200"
              title="Decrease Indent"
            >
              <Outdent className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); exec('indent'); }}
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-200"
              title="Increase Indent"
            >
              <Indent className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); }}
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              title="Clear Formatting"
            >
              <RemoveFormatting className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />
          </>}

          {false && <>
          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 shrink-0 shadow-2xs">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); moveEditorHistory(-1); }}
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-200"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); moveEditorHistory(1); }}
              className="flex h-6.5 w-6.5 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-slate-700 dark:text-slate-200"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

          {/* Read Aloud button */}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); toggleEditorReading(); }}
            className={`flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition-all cursor-pointer shrink-0 shadow-2xs ${
              isEditorSpeaking
                ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-400/50'
                : 'bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50'
            }`}
            title="Read Note Aloud (Hindi & English)"
          >
            <Volume2 className={`h-3.5 w-3.5 ${isEditorSpeaking ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">
              {isEditorSpeaking ? 'Reading...' : 'Listen'}
            </span>
          </button>
          </>}
        </div>
      </div>

      {isFontManagerOpen && (
        <div
          onMouseDown={(e) => {
            if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
          }}
          className="sanctuary-menu-surface border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-3 py-3 sm:px-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Add or use a typeface</h3>
              <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                Installed fonts use your exact computer font name. Uploaded fonts stay in this workspace.
              </p>
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsFontManagerOpen(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close font manager"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={fontFamilyInput}
              onChange={(e) => setFontFamilyInput(e.target.value)}

              aria-label="Font family name"
              className="h-8 min-w-52 flex-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={applyInstalledFont}
              className="h-8 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-400 hover:text-indigo-600"
            >
              Use installed font
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
              aria-label="Choose typeface file"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0] || null;
                setFontFile(selectedFile);
                setFontError('');
                if (selectedFile && !fontFamilyInput.trim()) {
                  setFontFamilyInput(selectedFile.name.replace(/\.[^.]+$/, ''));
                }
              }}
              className="min-w-52 flex-1 text-[11px] text-slate-600 dark:text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2.5 file:py-1.5 file:text-[11px] file:font-semibold file:text-slate-700 dark:file:bg-slate-800 dark:file:text-slate-200"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void uploadFont()}
              disabled={!fontFile}
              className="h-8 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Upload & use font
            </button>
          </div>

          {fontError && (
            <p role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">{fontError}</p>
          )}

          {customFonts.length > 0 && (
            <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Saved typefaces
              </p>
              {customFonts.map(font => (
                <div key={font.id} className="flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleApplyFont(font.familyName)}
                    className="truncate text-left font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600"
                    style={{ fontFamily: fontFamilyCss(font.familyName) }}
                    title={`Apply ${font.familyName}`}
                  >
                    {font.familyName} <span className="text-[10px] text-slate-400">({font.fileName})</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void removeCustomFont(font)}
                    className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    aria-label={`Remove ${font.familyName}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. EXPANDED LUXURY STUDIO PANELS (Color, Highlight, Bullets, Table)       */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* COMPACT & SLEEK ACTIVE STUDIO DRAWER (COLOR, HIGHLIGHT, BULLETS, TABLE)    */}
      {/* ========================================================================= */}
      {activeStudio && (
        <div
          onMouseDown={(e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('input, textarea, select')) {
              e.preventDefault();
            }
          }}
          className="sanctuary-menu-surface border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-2.5 sm:px-4 sm:py-3 shadow-md relative z-20 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {activeStudio === 'text' && (
            <div className="note-text-controls flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden whitespace-nowrap">
              <select value={activeStyle} onChange={(e) => handleApplyStyle(e.target.value)} className="toolbar-flat-control note-toolbar-compact-control note-text-compact-control note-text-style-control shrink-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm font-semibold text-slate-900 dark:text-slate-100" aria-label="Paragraph format" title="Paragraph format"><option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote Block</option><option value="pre">Code Block</option></select>
              <select value={activeSize} onChange={(e) => handleApplySize(e.target.value)} className="toolbar-flat-control note-toolbar-compact-control note-text-compact-control note-text-size-control shrink-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm font-semibold text-slate-900 dark:text-slate-100" aria-label="Text size" title="Text size"><option value="2">12px</option><option value="3">14px</option><option value="4">16px</option><option value="5">18px</option><option value="6">24px</option></select>
              <select value={activeFont} onChange={(e) => handleApplyFont(e.target.value)} className="toolbar-flat-control note-toolbar-compact-control note-text-compact-control note-text-family-control shrink-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-sm font-semibold text-slate-900 dark:text-slate-100" aria-label="Typeface" title="Typeface"><option value="" disabled>Typeface</option>{FONT_FAMILIES.map(font => <option key={font.value} value={font.value}>{font.label}</option>)}{customFonts.map(font => <option key={font.id} value={font.familyName}>{font.familyName}</option>)}{installedFontNames.filter(name => !FONT_FAMILIES.some(font => font.value.toLowerCase() === name.toLowerCase()) && !customFonts.some(font => font.familyName.toLowerCase() === name.toLowerCase())).map(name => <option key={`installed-${name}`} value={name}>{name}</option>)}</select>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); saveSelection(); setIsFontManagerOpen(v => !v); }} className={`note-text-compact-button flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${isFontManagerOpen ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`} title="Manage typefaces" aria-label="Manage typefaces"><Plus className="h-3.5 w-3.5" /></button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setActiveStudio(null)} className="note-text-compact-button flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Close text tools"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          {activeStudio === 'format' && (
            <div className="flex flex-wrap items-center gap-1.5">
              {([{ label: 'Bold', action: 'bold', icon: <Bold className="h-4 w-4" /> }, { label: 'Italic', action: 'italic', icon: <Italic className="h-4 w-4" /> }, { label: 'Underline', action: 'underline', icon: <Underline className="h-4 w-4" /> }, { label: 'Strike', action: 'strikeThrough', icon: <Strikethrough className="h-4 w-4" /> }]).map(item => (
                <button key={item.action} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { exec(item.action); setActiveStudio(null); }} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" title={item.label}>{item.icon}</button>
              ))}
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { exec('removeFormat'); setActiveStudio(null); }} className="flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-950/30" title="Clear formatting"><RemoveFormatting className="h-3.5 w-3.5" />Clear</button>
              <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
              {([{ label: 'Align left', action: 'justifyLeft', icon: <AlignLeft className="h-4 w-4" /> }, { label: 'Center', action: 'justifyCenter', icon: <AlignCenter className="h-4 w-4" /> }, { label: 'Align right', action: 'justifyRight', icon: <AlignRight className="h-4 w-4" /> }, { label: 'Justify', action: 'justifyFull', icon: <AlignJustify className="h-4 w-4" /> }, { label: 'Decrease indent', action: 'outdent', icon: <Outdent className="h-4 w-4" /> }, { label: 'Increase indent', action: 'indent', icon: <Indent className="h-4 w-4" /> }]).map(item => (
                <button key={item.action} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { exec(item.action); setActiveStudio(null); }} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" title={item.label}>{item.icon}</button>
              ))}
              <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => moveEditorHistory(-1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" title="Undo (Ctrl+Z)"><Undo2 className="h-4 w-4" /></button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => moveEditorHistory(1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" title="Redo (Ctrl+Y)"><Redo2 className="h-4 w-4" /></button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={toggleEditorReading} className={`flex h-8 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold ${isEditorSpeaking ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 text-indigo-600 hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-slate-800'}`} title="Read note aloud"><Volume2 className={`h-3.5 w-3.5 ${isEditorSpeaking ? 'animate-bounce' : ''}`} />{isEditorSpeaking ? 'Reading' : 'Listen'}</button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setActiveStudio(null)} className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Close Format tools"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          {activeStudio === 'bullets' && (
            <div className="flex items-center gap-1 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setListTablePanelTab('bullets')} className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold ${listTablePanelTab === 'bullets' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                <List className="h-3 w-3" />Bullets
              </button>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); detectActiveTable(); }} onClick={() => setListTablePanelTab('table')} className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold ${listTablePanelTab === 'table' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                <TableIcon className="h-3 w-3" />Table
              </button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setActiveStudio(null)} className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Close Lists & Tables"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          {activeStudio === 'color' && (
            <div className="flex items-center gap-1 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setColorPanelTab('text')} className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold ${colorPanelTab === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                <Palette className="h-3 w-3" />Text Color
              </button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setColorPanelTab('highlight')} className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold ${colorPanelTab === 'highlight' ? 'bg-amber-500 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                <Highlighter className="h-3 w-3" />Highlight
              </button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setActiveStudio(null)} className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Close Color tools"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          {/* ===================================================================== */}
          {/* STUDIO 1: TEXT COLOR PALETTE                                         */}
          {/* ===================================================================== */}
          {activeStudio === 'color' && colorPanelTab === 'text' && (
            <div className="space-y-2.5">
              {/* Unified Continuous Color Palette Strip */}
              <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                {FLAT_TEXT_COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyTextColor(c.value)}
                    className={`relative flex items-center justify-center rounded-lg border transition-all hover:scale-115 active:scale-95 cursor-pointer shadow-2xs ${
                      c.value === 'inherit'
                        ? 'h-6.5 px-2 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-[10px] font-bold'
                        : 'h-6.5 w-6.5 border-black/15 dark:border-white/15'
                    }`}
                    style={c.value !== 'inherit' ? { backgroundColor: c.hex } : undefined}
                    title={`${c.name} (${c.value === 'inherit' ? 'Default' : c.hex})`}
                  >
                    {c.value === 'inherit' && 'Auto'}
                  </button>
                ))}
                <label className="relative flex h-6.5 w-6.5 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600 shadow-2xs transition-transform hover:scale-110 cursor-pointer" title="Choose a custom text color">
                  <input
                    type="color"
                    value={customTextColor}
                    onChange={(e) => {
                      const color = e.target.value;
                      setCustomTextColor(color);
                      applyTextColor(color);
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Choose custom text color"
                  />
                  <span className="pointer-events-none absolute inset-0" style={{ background: 'conic-gradient(#f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f87171)' }} />
                  <Palette className="pointer-events-none relative z-10 h-3.5 w-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                </label>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* STUDIO 2: PASTEL HIGHLIGHTER                                         */}
          {/* ===================================================================== */}
          {activeStudio === 'color' && colorPanelTab === 'highlight' && (
            <div className="space-y-2.5">
              {/* Compact Pastel Highlighter Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {HIGHLIGHT_COLORS.map((h) => (
                  <button
                    key={h.name}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyHighlight(h.value)}
                    className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-black/10 dark:border-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xs shrink-0"
                    style={{ backgroundColor: h.bg }}
                    title={`Highlight: ${h.name}`}
                  >
                    <span
                      className="h-2 w-2 rounded-full border border-black/20 shrink-0"
                      style={{ backgroundColor: h.border }}
                    />
                    <span className="text-[11px] font-semibold text-slate-900 whitespace-nowrap">
                      {h.label}
                    </span>
                  </button>
                ))}
                <label className="relative flex h-6.5 w-6.5 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600 shadow-2xs transition-transform hover:scale-110 cursor-pointer" title="Choose a custom highlight color">
                  <input
                    type="color"
                    value={customHighlightColor}
                    onChange={(e) => {
                      const color = e.target.value;
                      setCustomHighlightColor(color);
                      applyHighlight(color);
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Choose custom highlight color"
                  />
                  <span className="pointer-events-none absolute inset-0" style={{ background: 'conic-gradient(#f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f87171)' }} />
                  <Palette className="pointer-events-none relative z-10 h-3.5 w-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                </label>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyHighlight('transparent')}
                  className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg border border-rose-200 dark:border-rose-900/60 bg-white/80 dark:bg-slate-900/80 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  title="Clear highlight"
                  aria-label="Clear highlight"
                >
                  <Eraser className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* STUDIO 3: BULLETS & NUMBERING                                        */}
          {/* ===================================================================== */}
          {activeStudio === 'bullets' && listTablePanelTab === 'bullets' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
                    <List className="h-3 w-3" />
                  </div>
                  
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Segmented Control */}
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setBulletTab('symbols')}
                      className={`border-b-0 border-transparent px-2 py-0.5 font-semibold transition-colors cursor-pointer ${
                        bulletTab === 'symbols'
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                      }`}
                    >
                      Bullet Symbols
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setBulletTab('numbered')}
                      className={`border-b-0 border-transparent px-2 py-0.5 font-semibold transition-colors cursor-pointer ${
                        bulletTab === 'numbered'
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                      }`}
                    >
                      Numbered Sequences
                    </button>
                  </div>

                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setActiveStudio(null)}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
                    title="Close Bullets Studio"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {bulletTab === 'symbols' ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {BULLET_STYLES.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertBulletList(b.symbol)}
                        className="inline-flex items-center gap-1.5 h-6.5 px-2 rounded-md border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-violet-500 hover:scale-105 transition-all cursor-pointer shadow-2xs shrink-0"
                        title={`Insert ${b.label}`}
                      >
                        <span className="text-violet-600 dark:text-violet-400 font-bold text-xs shrink-0">
                          {b.symbol}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {b.label}
                        </span>
                      </button>
                    ))}
                    <span className="ml-1 text-slate-500 dark:text-slate-400 font-medium">Custom</span>
                    <input
                      ref={customBulletInputRef}
                      type="text"
                      aria-label="Custom bullet or emoji"
                      placeholder="Emoji"
                      value={customBulletInput}
                      onChange={(e) => { setCustomBulletInput(e.target.value); setCustomBulletImage(''); setCustomBulletImageError(''); }}
                      onInput={(e) => { setCustomBulletInput(e.currentTarget.value); setCustomBulletImage(''); setCustomBulletImageError(''); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyCustomBullet(e.currentTarget.value);
                        }
                      }}
                      className="note-toolbar-compact-control note-toolbar-mini-control h-6 w-16 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 text-xs text-slate-900 dark:text-white"
                    />
                    <label className="relative flex h-6.5 w-6.5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-violet-600 hover:bg-violet-50 dark:hover:bg-slate-800 cursor-pointer" title="Choose an image from this computer">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        aria-label="Choose custom bullet image"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.currentTarget.files?.[0];
                          if (!file) return;
                          setCustomBulletImageError('');
                          if (!/^image\/(?:png|jpeg|gif|webp)$/i.test(file.type)) {
                            setCustomBulletImageError('Choose PNG, JPG, GIF or WebP.');
                            e.currentTarget.value = '';
                            return;
                          }
                          if (file.size > 1024 * 1024) {
                            setCustomBulletImageError('Image must be 1 MB or smaller.');
                            e.currentTarget.value = '';
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            const result = typeof reader.result === 'string' ? reader.result : '';
                            if (!/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(result)) {
                              setCustomBulletImageError('Could not read that image.');
                              return;
                            }
                            setCustomBulletInput('');
                            setCustomBulletImage(result);
                          };
                          reader.onerror = () => setCustomBulletImageError('Could not read that image.');
                          reader.readAsDataURL(file);
                          e.currentTarget.value = '';
                        }}
                      />
                      {customBulletImage
                        ? <img src={customBulletImage} alt="" className="h-full w-full object-contain" />
                        : <ImagePlus className="h-3.5 w-3.5" />}
                    </label>
                    <button
                      type="button"
                      aria-disabled={!customBulletInput.trim() && !customBulletImage}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyCustomBullet(customBulletInputRef.current?.value || customBulletInput)}
                      className={`h-6 px-2 rounded-md bg-violet-600 hover:bg-violet-700 text-[11px] font-semibold text-white shadow-2xs cursor-pointer ${customBulletInput.trim() || customBulletImage ? '' : 'opacity-40'}`}
                    >
                      Insert
                    </button>
                    {customBulletImageError && <span className="text-[10px] text-rose-600 dark:text-rose-400">{customBulletImageError}</span>}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {NUMBER_STYLES.map((ns) => (
                      <button
                        key={ns.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertNumberedList(ns.type)}
                        className="inline-flex items-center gap-1.5 h-6.5 px-2 rounded-md border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-violet-500 hover:scale-105 transition-all cursor-pointer shadow-2xs shrink-0"
                        title={ns.desc}
                      >
                        <span className="font-mono text-xs font-bold text-violet-600 dark:text-violet-400">
                          {ns.label}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {ns.desc.split(' ')[0]}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Custom Number Prefix */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Prefix:
                    </span>
                    <input
                      type="text"

                      value={customNumberPrefix}
                      onChange={(e) => setCustomNumberPrefix(e.target.value)}
                      className="note-toolbar-compact-control h-8 w-28 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 text-xs text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertNumberedList('1', customNumberPrefix)}
                      className="h-8 px-2 rounded-md bg-violet-600 hover:bg-violet-700 text-[11px] font-semibold text-white shadow-2xs cursor-pointer"
                    >
                      Insert ({customNumberPrefix} 1, 2...)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===================================================================== */}
          {/* STUDIO 4: TABLE STUDIO & ACTIVE GRID                                 */}
          {/* ===================================================================== */}
          {activeStudio === 'bullets' && listTablePanelTab === 'table' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <TableIcon className="h-3 w-3" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Table Studio</span>
                  {activeTableLocation ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold border border-emerald-200/80 dark:border-emerald-800/60 font-mono">
                      {columnLabel(activeTableLocation.col)}{activeTableLocation.row} · {activeTableLocation.totalRows}×{activeTableLocation.totalCols}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 hidden sm:inline">
                      • Click a cell to edit
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setActiveStudio(null)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
                  title="Close Table Studio"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Excel-style tabs */}
              <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/90 dark:bg-slate-800/70 p-0.5">
                {[
                  { id: 'insert' as const, label: 'Insert', icon: Plus },
                  { id: 'edit' as const, label: 'Edit', icon: Columns },
                  { id: 'calc' as const, label: 'Calc', icon: Sigma },
                  { id: 'format' as const, label: 'Format', icon: PaintBucket }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setTableTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                      tableTab === tab.id
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <tab.icon className="h-3 w-3" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* ---------------- INSERT ---------------- */}
              {tableTab === 'insert' && (
                <div className="grid grid-cols-1 gap-2.5 items-start">
                  <div className="p-2.5 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Plus className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                        <span>Create Grid</span>
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/60">
                        {tableGridHover.rows} × {tableGridHover.cols}
                      </span>
                    </div>

                    <div className="flex items-center justify-start gap-6">
                      <div className="flex flex-col gap-0.5 items-start">
                        {[1, 2, 3, 4, 5, 6].map((r) => (
                          <div key={r} className="flex gap-0.5">
                            {[1, 2, 3, 4, 5, 6].map((c) => {
                              const isHovered = r <= tableGridHover.rows && c <= tableGridHover.cols;
                              return (
                                <div
                                  key={c}
                                  onMouseEnter={() => setTableGridHover({ rows: r, cols: c })}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => insertTable(r, c, tableHasHeader)}
                                  className={`h-3.5 w-3.5 rounded-xs transition-all cursor-pointer ${
                                    isHovered
                                      ? 'bg-indigo-600 border border-indigo-700 shadow-2xs'
                                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                  }`}
                                  title={`${r} × ${c} table`}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-400 uppercase font-semibold">Quick:</span>
                        <div className="grid grid-cols-2 gap-1">
                          {[
                            { r: 2, c: 2, label: '2×2' },
                            { r: 3, c: 3, label: '3×3' },
                            { r: 4, c: 4, label: '4×4' },
                            { r: 5, c: 3, label: '5×3' }
                          ].map(p => (
                            <button
                              key={p.label}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setTableGridHover({ rows: p.r, cols: p.c });
                                insertTable(p.r, p.c, tableHasHeader);
                              }}
                              className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-700 text-[10px] font-mono text-slate-700 dark:text-slate-300 transition-colors cursor-pointer text-center"
                              title={`Insert ${p.label} table`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                      <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={tableHasHeader}
                          onChange={(e) => setTableHasHeader(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-3 w-3 cursor-pointer"
                        />
                        <span>Header row</span>
                      </label>

                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTable(tableGridHover.rows, tableGridHover.cols, tableHasHeader)}
                        className="rounded-md bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs transition-colors cursor-pointer"
                      >
                        Insert Table
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* ---------------- EDIT ---------------- */}
              {tableTab === 'edit' && (
                <div className="p-2.5 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-2">
                  {!activeTableLocation && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">Click inside a table cell to enable these actions.</p>
                  )}

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertTableRow('above')}
                      className="flex items-center justify-center gap-1 py-1 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
                      title="Insert a row above the active cell"
                    >
                      <ArrowUp className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Row above</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertTableRow('below')}
                      className="flex items-center justify-center gap-1 py-1 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
                      title="Insert a row below the active cell"
                    >
                      <ArrowDown className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Row below</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertTableColumn('left')}
                      className="flex items-center justify-center gap-1 py-1 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
                      title="Insert a column to the left"
                    >
                      <ArrowLeft className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Col left</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertTableColumn('right')}
                      className="flex items-center justify-center gap-1 py-1 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
                      title="Insert a column to the right"
                    >
                      <ArrowRight className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Col right</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={deleteTableRow}
                      className="flex items-center justify-center gap-1 py-1 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 transition-colors cursor-pointer shadow-2xs"
                      title="Delete current row"
                    >
                      <Minus className="h-3 w-3 text-rose-500" />
                      <span>Delete row</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={deleteTableColumn}
                      className="flex items-center justify-center gap-1 py-1 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 transition-colors cursor-pointer shadow-2xs"
                      title="Delete current column"
                    >
                      <Minus className="h-3 w-3 text-rose-500" />
                      <span>Delete col</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={toggleActiveTableHeader}
                      className="flex items-center justify-center gap-1 py-1 px-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
                      title="Toggle the header row"
                    >
                      <TableIcon className="h-3 w-3 text-slate-500" />
                      <span>Header</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={toggleTableZebra}
                      className="flex items-center justify-center gap-1 py-1 px-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
                      title="Toggle zebra striping"
                    >
                      <Rows3 className="h-3 w-3 text-slate-500" />
                      <span>Zebra</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={clearTableCells}
                      className="flex items-center justify-center gap-1 py-1 px-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors cursor-pointer shadow-2xs"
                      title="Clear contents of the selected cells"
                    >
                      <Eraser className="h-3 w-3 text-slate-500" />
                      <span>Clear</span>
                    </button>
                  </div>

                  <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-end">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={deleteTable}
                      className="flex items-center gap-1 px-2 py-1 rounded-md border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-[11px] font-medium hover:bg-rose-100 transition-colors cursor-pointer"
                      title="Remove entire table"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete entire table</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ---------------- CALC ---------------- */}
              {tableTab === 'calc' && (
                <div className="p-2.5 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-2">
                  <div className="flex items-center gap-1">
                    <span className="shrink-0 font-mono text-[10px] font-bold text-slate-400">fx</span>
                    <input
                      value={formulaDraft}
                      onChange={(e) => setFormulaDraft(e.target.value)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitCellFormula(formulaDraft);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setFormulaDraft(activeCell()?.getAttribute('data-om-formula') || '');
                        }
                      }}
                      placeholder="=SUM(B2:B9) or =B2*C2"
                      spellCheck={false}
                      className="note-toolbar-compact-control min-w-0 flex-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-800 dark:text-slate-100 focus:border-indigo-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => commitCellFormula(formulaDraft)}
                      className="note-toolbar-compact-control shrink-0 rounded-md bg-indigo-600 hover:bg-indigo-700 px-2 py-1 text-[11px] font-semibold text-white transition-colors cursor-pointer"
                      title="Apply to the active cell"
                    >
                      Apply
                    </button>
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    {([
                      { fn: 'SUM' as const, label: 'Σ Sum' },
                      { fn: 'AVERAGE' as const, label: 'Avg' },
                      { fn: 'COUNT' as const, label: 'Count' },
                      { fn: 'MIN' as const, label: 'Min' },
                      { fn: 'MAX' as const, label: 'Max' }
                    ]).map(item => (
                      <button
                        key={item.fn}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertAggregate(item.fn)}
                        className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
                        title={`=${item.fn}(ABOVE) in the active cell`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={addTableTotalRow}
                      className="flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer"
                      title="Append a totals row with SUM formulas"
                    >
                      <Sigma className="h-3 w-3" />
                      <span>Total row</span>
                    </button>
                    <span className="font-mono text-[10px] text-slate-400">
                      {activeTableLocation ? `${columnLabel(activeTableLocation.col)}${activeTableLocation.row}` : '—'}
                    </span>
                  </div>

                  {tableStats ? (
                    <div className="grid grid-cols-5 gap-1 rounded-md border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-1">
                      {[
                        { label: 'Σ', value: formatCellNumber(tableStats.sum) },
                        { label: 'Avg', value: tableStats.average === null ? '—' : formatCellNumber(tableStats.average) },
                        { label: 'Count', value: String(tableStats.count) },
                        { label: 'Min', value: tableStats.min === null ? '—' : formatCellNumber(tableStats.min) },
                        { label: 'Max', value: tableStats.max === null ? '—' : formatCellNumber(tableStats.max) }
                      ].map(chip => (
                        <div key={chip.label} className="flex flex-col items-center leading-tight">
                          <span className="text-[9px] uppercase tracking-wide text-slate-400">{chip.label}</span>
                          <span className="font-mono text-[10px] font-semibold text-slate-800 dark:text-slate-100 truncate max-w-full">{chip.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      Select a cell to see live totals for the numbers above it.
                    </p>
                  )}
                </div>
              )}

              {/* ---------------- FORMAT ---------------- */}
              {tableTab === 'format' && (
                <div className="p-2.5 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-2">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1">
                      {([
                        { align: 'left' as const, label: 'Left' },
                        { align: 'center' as const, label: 'Center' },
                        { align: 'right' as const, label: 'Right' }
                      ]).map(item => (
                        <button
                          key={item.align}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyTableCellAlign(item.align)}
                          className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
                          title={`Align ${item.align}`}
                        >
                          {item.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={toggleTableCellBold}
                        className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
                        title="Bold the selected cells"
                      >
                        B
                      </button>
                    </div>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setFormatMenuOpen(open => !open)}
                        className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
                        title="Number format for the selected cells"
                      >
                        <Hash className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        <span>{TABLE_NUMBER_FORMATS.find(option => option.value === cellNumberFormat)?.label || 'Custom'}</span>
                        <ChevronDown className={`h-2.5 w-2.5 transition-transform ${formatMenuOpen ? 'rotate-180' : 'opacity-60'}`} />
                      </button>
                      {formatMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setFormatMenuOpen(false)} />
                          <div className="absolute right-0 top-full z-40 mt-1 w-40 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 shadow-xl">
                            {TABLE_NUMBER_FORMATS.map(option => (
                              <button
                                key={option.value || 'general'}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  applyCellNumberFormat(option.value);
                                  setFormatMenuOpen(false);
                                }}
                                className={`flex w-full items-center justify-between gap-2 px-2 py-1 text-[10px] transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${
                                  option.value === cellNumberFormat
                                    ? 'font-bold text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-700 dark:text-slate-200'
                                }`}
                                title={`Show numbers like ${option.sample}`}
                              >
                                <span>{option.label}</span>
                                <span className="font-mono text-slate-400 dark:text-slate-500">{option.sample}</span>
                              </button>
                            ))}
                            <div className="mt-1 border-t border-slate-100 dark:border-slate-800 px-2 pt-1 text-[9px] text-slate-400 dark:text-slate-500">
                              Numbers only
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      <Columns className="h-3 w-3" />
                      <span>Column width</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => resizeActiveColumns(-20)}
                        className="h-5 w-5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="Narrower by 20px"
                      >
                        −
                      </button>
                      <span className="w-11 text-center font-mono text-[10px] text-slate-600 dark:text-slate-300">
                        {cellColumnWidth > 0 ? `${cellColumnWidth}px` : 'auto'}
                      </span>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => resizeActiveColumns(20)}
                        className="h-5 w-5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="Wider by 20px"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={resetActiveColumnWidth}
                        className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Fit the column to its content"
                      >
                        Auto
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      <Rows3 className="h-3 w-3" />
                      <span>Row height</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => resizeActiveRows(-8)}
                        className="h-5 w-5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="Shorter by 8px"
                      >
                        −
                      </button>
                      <span className="w-11 text-center font-mono text-[10px] text-slate-600 dark:text-slate-300">
                        {cellRowHeight > 0 ? `${cellRowHeight}px` : 'auto'}
                      </span>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => resizeActiveRows(8)}
                        className="h-5 w-5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="Taller by 8px"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={resetActiveRowHeight}
                        className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Fit the row to its content"
                      >
                        Auto
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      <PaintBucket className="h-3 w-3" />
                      <span>Fill</span>
                    </span>
                    {['#fef9c3', '#dcfce7', '#dbeafe', '#fee2e2', '#ede9fe'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => shadeTableCells(color)}
                        className="h-4 w-4 rounded border border-slate-300 dark:border-slate-600 cursor-pointer hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    <label
                      className="relative h-4 w-4 rounded border border-slate-300 dark:border-slate-600 cursor-pointer hover:scale-110 transition-transform overflow-hidden"
                      title={`Custom fill colour (${customFillColour})`}
                      style={{ background: 'conic-gradient(#f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f87171)' }}
                    >
                      <input
                        type="color"
                        defaultValue={customFillColour}
                        onInput={(e) => {
                          const value = (e.target as HTMLInputElement).value;
                          setCustomFillColour(value);
                          shadeTableCells(value);
                        }}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label="Custom fill colour"
                      />
                    </label>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => shadeTableCells('')}
                      className="ml-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Remove fill"
                    >
                      None
                    </button>
                  </div>


                  {!activeTableLocation && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">Click inside a table cell to format it.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* LIVE TEXT READING BANNER                                                  */}
      {/* ========================================================================= */}
      {isEditorSpeaking && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/50 border-b border-indigo-200/80 dark:border-indigo-900/60 text-xs font-semibold text-indigo-900 dark:text-indigo-200 animate-in fade-in select-none">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-indigo-600 animate-bounce shrink-0" />
            <span>Reading Reflection Aloud (Hindi & English)...</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (isEditorPaused) {
                  readerRef.current?.resume();
                  setIsEditorPaused(false);
                } else {
                  readerRef.current?.pause();
                  setIsEditorPaused(true);
                }
              }}
              className="px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 cursor-pointer"
            >
              {isEditorPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              onClick={() => {
                readerRef.current?.stop();
                setIsEditorSpeaking(false);
                setIsEditorPaused(false);
              }}
              className="px-2.5 py-0.5 rounded-md bg-rose-600 text-[10px] font-semibold text-white hover:bg-rose-500 cursor-pointer shadow-xs"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. WRITING CANVAS (Equipped with .om-rich-rendered for luxury typography) */}
      {/* ========================================================================= */}
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-label="Note content"
        aria-multiline="true"
        onInput={handleEditorInput}
        onPaste={handlePaste}
        onBeforeInput={handleBeforeInput}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onMouseDown={handleTableResizeStart}
        onMouseMove={handleTableResizeHover}
        onDoubleClick={handleTableResizeDoubleClick}
        onMouseLeave={() => {
          if (!tableResizeRef.current && editorRef.current) editorRef.current.style.cursor = '';
        }}
        onMouseUp={(e) => {
          // Markers are not selectable, so Chrome no longer parks the caret in
          // them. Clicking the glyph (or the gap beside it) must still start
          // editing that list row instead of jumping to the end of the note.
          const target = e.target as HTMLElement | null;
          const row = target?.closest?.('[data-om-list]') as HTMLElement | null;
          const selection = window.getSelection();
          const onLockedPart = !!target && (target === row || !!target.closest('[contenteditable="false"]'));
          if (row && onLockedPart && selection && (selection.rangeCount === 0 || selection.isCollapsed)) {
            caretTo(itemTextElement(row), false);
          }
          ensureEditableCaret();
          saveSelection();
          detectActiveTable();
        }}
        onSelect={() => { saveSelection(); detectActiveTable(); }}
        onTouchEnd={() => { saveSelection(); detectActiveTable(); }}
        onBlur={() => { ensureBlockStructure(); handleEditorInput(); saveSelection(); }}
        className={`select-text p-2.5 sm:p-3 text-[12.5px] sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none overflow-y-auto leading-relaxed om-rich-rendered ${minHeight} ${maxHeight}
          [&_h1]:text-xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:my-1.5 [&_h1]:text-slate-950 dark:[&_h1]:text-white
          [&_h2]:text-lg [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:my-1 [&_h2]:text-slate-900 dark:[&_h2]:text-slate-100
          [&_h3]:text-base [&_h3]:font-bold [&_h3]:my-1 [&_h3]:text-slate-800 dark:[&_h3]:text-slate-200
          [&_p]:my-1 [&_p]:leading-relaxed`}

        style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
      />

      {/* Word & Character Count */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800/80 px-3 py-1 text-[10px] text-slate-400 dark:text-slate-500 select-none">
        <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
        <span>{charCount} {charCount === 1 ? 'char' : 'chars'}</span>
      </div>
    </div>
  );
};
