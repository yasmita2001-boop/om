import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  List, Palette, Highlighter,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Indent, Outdent, RemoveFormatting, Table as TableIcon,
  ChevronDown, Plus, Minus, Trash2, Sparkles,
  Grid, Volume2, X, Columns, Check, RotateCcw
} from 'lucide-react';
import { TextReaderController, VoiceLanguage, isSpeechSynthesisSupported } from '../lib/voiceService';

export interface NoteRichEditorProps {
  initialHtml?: string;
  onChange: (html: string, plainText: string) => void;
  placeholder?: string;
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
  { id: 'target', symbol: '🎯', label: 'Target' },
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

    const newEl = document.createElement(cleanTag);

    // Preserve important styles (color, background-color, text-align, font-weight, font-style, text-decoration)
    const style = el.style;
    if (style) {
      if (style.color && style.color !== 'inherit' && style.color !== 'initial') {
        newEl.style.color = style.color;
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
  let text = markdown;

  // Code blocks first (protect from other replacements)
  const codeBlocks: string[] = [];
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre><code class="language-${lang || 'plaintext'}">${escapeHtml(code.trim())}</code></pre>`);
    return placeholder;
  });

  // Inline code
  const inlineCodes: string[] = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    const placeholder = `__INLINE_CODE_${inlineCodes.length}__`;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return placeholder;
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
  placeholder = '',
  minHeight = 'min-h-[220px]',
  maxHeight = 'max-h-[480px]',
  className = ''
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastRenderedHtmlRef = useRef(initialHtml || '');

  // Selection & Table Tracking
  const savedRangeRef = useRef<Range | null>(null);
  const isExecutingActionRef = useRef(false);
  const lastActiveTableRef = useRef<HTMLTableElement | null>(null);
  const lastActiveCellRef = useRef<HTMLTableCellElement | null>(null);
  const [activeTableLocation, setActiveTableLocation] = useState<{ row: number; col: number; totalRows: number; totalCols: number } | null>(null);

  // Active Studio Drawer: 'color' | 'highlight' | 'bullets' | 'table' | null
  const [activeStudio, setActiveStudio] = useState<'color' | 'highlight' | 'bullets' | 'table' | null>(null);

  // Custom Colors
  const [customTextColor, setCustomTextColor] = useState('#4f46e5');
  const [customHighlightColor, setCustomHighlightColor] = useState('#fef08a');

  // Bullet / Number Tabs
  const [bulletTab, setBulletTab] = useState<'symbols' | 'numbered'>('symbols');
  const [customBulletInput, setCustomBulletInput] = useState('');
  const [customNumberPrefix, setCustomNumberPrefix] = useState('Step');

  // Table Generator Grid
  const [tableGridHover, setTableGridHover] = useState({ rows: 3, cols: 3 });
  const [tableHasHeader, setTableHasHeader] = useState(true);

  // Formatting state
  const [activeStyle, setActiveStyle] = useState('p');
  const [activeSize, setActiveSize] = useState('3');

  // Speech synthesis
  const [isEditorSpeaking, setIsEditorSpeaking] = useState(false);
  const [isEditorPaused, setIsEditorPaused] = useState(false);
  const [editorReaderLang] = useState<VoiceLanguage>('hi-IN');
  const readerRef = useRef<TextReaderController | null>(null);

  useEffect(() => {
    return () => {
      readerRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (editorRef.current && initialHtml !== lastRenderedHtmlRef.current) {
      editorRef.current.innerHTML = initialHtml || '';
      lastRenderedHtmlRef.current = initialHtml || '';
    }
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
    const html = editorRef.current.innerHTML;
    const text = editorRef.current.innerText || '';
    lastRenderedHtmlRef.current = html;
    onChange(html, text);
  }, [onChange]);

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
    el.innerHTML = html;
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

    // If Shift+Ctrl+V / Shift+Cmd+V was pressed, paste as clean formatted plain text
    const isShiftPaste = (e.nativeEvent as any)?.shiftKey;

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
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {}
    document.execCommand(cmd, false, val || undefined);
    isExecutingActionRef.current = false;
    saveSelection();
    handleEditorInput();
  }, [restoreSelection, saveSelection, handleEditorInput]);

  // Tab key navigation inside table cells
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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
      if (e.key === 'b' || e.key === 'B') {
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

  const handleApplySize = (sizeVal: string) => {
    setActiveSize(sizeVal);
    isExecutingActionRef.current = true;
    restoreSelection();
    document.execCommand('fontSize', false, sizeVal);
    isExecutingActionRef.current = false;
    saveSelection();
    handleEditorInput();
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

    const sel = window.getSelection();
    const selectedText = sel ? sel.toString() : '';
    const lines = selectedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    let bulletHtml = '';
    if (lines.length > 0) {
      bulletHtml = lines.map(line =>
        `<div style="display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;"><span style="color: #6366f1; font-weight: bold; user-select: none; flex-shrink: 0;">${symbol}</span><span>${line}</span></div>`
      ).join('') + '<p><br/></p>';
    } else {
      bulletHtml = `<div style="display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;"><span style="color: #6366f1; font-weight: bold; user-select: none; flex-shrink: 0;">${symbol}</span><span>List item</span></div><p><br/></p>`;
    }

    let ok = false;
    try {
      ok = document.execCommand('insertHTML', false, bulletHtml);
    } catch {}
    if (!ok && editorRef.current) {
      editorRef.current.insertAdjacentHTML('beforeend', bulletHtml);
    }

    isExecutingActionRef.current = false;
    saveSelection();
    handleEditorInput();
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

    const sel = window.getSelection();
    const selectedText = sel ? sel.toString() : '';
    const lines = selectedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    let listHtml = '';
    if (customPrefix) {
      const items = lines.length > 0 ? lines : ['First item', 'Second item'];
      listHtml = items.map((line, idx) =>
        `<div style="display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;"><span style="color: #6366f1; font-weight: 700; user-select: none; flex-shrink: 0;">${customPrefix} ${idx + 1}:</span><span>${line}</span></div>`
      ).join('') + '<p><br/></p>';
    } else if (styleType === 'circled') {
      const circledDigits = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
      const items = lines.length > 0 ? lines : ['First item', 'Second item'];
      listHtml = items.map((line, idx) =>
        `<div style="display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;"><span style="color: #6366f1; font-weight: bold; user-select: none; flex-shrink: 0;">${circledDigits[idx] || `(${idx + 1})`}</span><span>${line}</span></div>`
      ).join('') + '<p><br/></p>';
    } else {
      const items = lines.length > 0 ? lines : ['First item'];
      listHtml = `<ol type="${styleType}" style="margin: 6px 0; padding-left: 24px;">${items.map(i => `<li>${i}</li>`).join('')}</ol><p><br/></p>`;
    }

    let ok = false;
    try {
      ok = document.execCommand('insertHTML', false, listHtml);
    } catch {}
    if (!ok && editorRef.current) {
      editorRef.current.insertAdjacentHTML('beforeend', listHtml);
    }

    isExecutingActionRef.current = false;
    saveSelection();
    handleEditorInput();
  };

  // =========================================================================
  // 4. TABLE CREATION & EDITING
  // =========================================================================
  const insertTable = (rows: number, cols: number, withHeader: boolean = true) => {
    isExecutingActionRef.current = true;
    restoreSelection();

    let tableHtml = `<table style="width: 100%; border-collapse: separate; border-spacing: 0; margin: 12px 0; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;" data-om-table="true">`;

    if (withHeader) {
      tableHtml += `<thead><tr>`;
      for (let c = 1; c <= cols; c++) {
        tableHtml += `<th style="border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; padding: 8px 12px; font-weight: 700; text-align: left; background-color: #f1f5f9; color: #1e293b; font-size: 12px;">Header ${c}</th>`;
      }
      tableHtml += `</tr></thead>`;
    }

    tableHtml += `<tbody>`;
    const numRows = withHeader ? Math.max(1, rows - 1) : rows;
    for (let r = 1; r <= numRows; r++) {
      const bg = r % 2 === 0 ? 'background-color: #f8fafc;' : 'background-color: #ffffff;';
      tableHtml += `<tr style="${bg}">`;
      for (let c = 1; c <= cols; c++) {
        tableHtml += `<td style="border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; padding: 7px 12px; min-width: 60px; font-size: 12px;">Cell ${r},${c}</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table><p><br/></p>`;

    let ok = false;
    try {
      ok = document.execCommand('insertHTML', false, tableHtml);
    } catch {}
    if (!ok && editorRef.current) {
      editorRef.current.insertAdjacentHTML('beforeend', tableHtml);
    }

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
    newRow.style.backgroundColor = table.rows.length % 2 === 0 ? '#f8fafc' : '#ffffff';
    for (let i = 0; i < numCols; i++) {
      const newCell = newRow.insertCell(i);
      newCell.style.borderBottom = '1px solid #cbd5e1';
      newCell.style.borderRight = '1px solid #cbd5e1';
      newCell.style.padding = '7px 12px';
      newCell.style.minWidth = '60px';
      newCell.style.fontSize = '12px';
      newCell.innerText = 'New Data';
    }
    lastActiveCellRef.current = newRow.cells[0];
    detectActiveTable();
    handleEditorInput();
  };

  const addTableColumn = () => {
    const table = getTargetTable();
    if (!table) return;

    const targetCell = lastActiveCellRef.current;
    const colIndex = targetCell ? targetCell.cellIndex + 1 : -1;

    for (let r = 0; r < table.rows.length; r++) {
      const row = table.rows[r];
      const isHeader = row.parentElement?.nodeName === 'THEAD' || row.cells[0]?.nodeName === 'TH';
      const cell = isHeader ? document.createElement('th') : row.insertCell(colIndex);
      cell.style.borderBottom = '1px solid #cbd5e1';
      cell.style.borderRight = '1px solid #cbd5e1';
      cell.style.padding = '7px 12px';
      cell.style.minWidth = '60px';
      cell.style.fontSize = '12px';
      if (isHeader) {
        cell.style.fontWeight = '700';
        cell.style.textAlign = 'left';
        cell.style.backgroundColor = '#f1f5f9';
        cell.style.color = '#1e293b';
        cell.innerText = `Header ${row.cells.length + 1}`;
        if (colIndex === -1 || colIndex >= row.children.length) {
          row.appendChild(cell);
        } else {
          row.insertBefore(cell, row.children[colIndex]);
        }
      } else {
        cell.innerText = 'Data';
      }
    }
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

  return (
    <div className={`relative rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/80 overflow-hidden ${className}`}>
      {/* ========================================================================= */}
      {/* 1. PRIMARY DOCKED TOOLBAR                                                */}
      {/* ========================================================================= */}
      <div className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-800/60 backdrop-blur-xs px-2.5 py-1.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
          {/* Paragraph Style */}
          <div className="relative shrink-0">
            <select
              value={activeStyle}
              onChange={(e) => handleApplyStyle(e.target.value)}
              className="h-7.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 pl-2 pr-6 text-[11px] font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs appearance-none"
              title="Typography Style"
            >
              <option value="p">Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="blockquote">Quote Block</option>
              <option value="pre">Code Block</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-2.5 h-3 w-3 text-slate-400" />
          </div>

          {/* Text Size */}
          <div className="relative shrink-0">
            <select
              value={activeSize}
              onChange={(e) => handleApplySize(e.target.value)}
              className="h-7.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 pl-2 pr-5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs appearance-none"
              title="Text Size"
            >
              <option value="2">12px</option>
              <option value="3">14px</option>
              <option value="4">16px</option>
              <option value="5">18px</option>
              <option value="6">24px</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-2.5 h-3 w-3 text-slate-400" />
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

          {/* Inline Formats: Bold, Italic, Underline, Strikethrough */}
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

          {/* =================================================================== */}
          {/* 4 CORE LUXURY STUDIO BUTTONS: COLOR, HIGHLIGHT, BULLETS, TABLE      */}
          {/* =================================================================== */}

          {/* 1. COLOR STUDIO TOGGLE */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
              setActiveStudio(prev => prev === 'color' ? null : 'color');
            }}
            className={`flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold border transition-all cursor-pointer shrink-0 shadow-2xs ${
              activeStudio === 'color'
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400 hover:text-indigo-600'
            }`}
            title="Text Color Palette Studio"
          >
            <Palette className={`h-3.5 w-3.5 ${activeStudio === 'color' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
            <span>Color</span>
            <ChevronDown className={`h-2.5 w-2.5 transition-transform ${activeStudio === 'color' ? 'rotate-180 opacity-90' : 'opacity-60'}`} />
          </button>

          {/* 2. HIGHLIGHT STUDIO TOGGLE */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
              setActiveStudio(prev => prev === 'highlight' ? null : 'highlight');
            }}
            className={`flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold border transition-all cursor-pointer shrink-0 shadow-2xs ${
              activeStudio === 'highlight'
                ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-amber-400 hover:text-amber-600'
            }`}
            title="Pastel Highlighter Studio"
          >
            <Highlighter className={`h-3.5 w-3.5 ${activeStudio === 'highlight' ? 'text-white' : 'text-amber-500'}`} />
            <span>Highlight</span>
            <ChevronDown className={`h-2.5 w-2.5 transition-transform ${activeStudio === 'highlight' ? 'rotate-180 opacity-90' : 'opacity-60'}`} />
          </button>

          {/* 3. BULLETS & NUMBERING TOGGLE */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
              setActiveStudio(prev => prev === 'bullets' ? null : 'bullets');
            }}
            className={`flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold border transition-all cursor-pointer shrink-0 shadow-2xs ${
              activeStudio === 'bullets'
                ? 'bg-violet-600 border-violet-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-violet-400 hover:text-violet-600'
            }`}
            title="Bullet & Numbering Studio"
          >
            <List className={`h-3.5 w-3.5 ${activeStudio === 'bullets' ? 'text-white' : 'text-violet-600 dark:text-violet-400'}`} />
            <span>Bullets</span>
            <ChevronDown className={`h-2.5 w-2.5 transition-transform ${activeStudio === 'bullets' ? 'rotate-180 opacity-90' : 'opacity-60'}`} />
          </button>

          {/* 4. TABLE STUDIO TOGGLE */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveSelection();
              detectActiveTable();
              setActiveStudio(prev => prev === 'table' ? null : 'table');
            }}
            className={`flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold border transition-all cursor-pointer shrink-0 shadow-2xs ${
              activeStudio === 'table'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-400 hover:text-emerald-600'
            }`}
            title="Table Generator & Tools"
          >
            <TableIcon className={`h-3.5 w-3.5 ${activeStudio === 'table' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
            <span>Table</span>
            <ChevronDown className={`h-2.5 w-2.5 transition-transform ${activeStudio === 'table' ? 'rotate-180 opacity-90' : 'opacity-60'}`} />
          </button>

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
        </div>
      </div>

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
            if (!target.closest('input, textarea')) {
              e.preventDefault();
            }
          }}
          className="border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-2.5 sm:px-4 sm:py-3 shadow-md relative z-20 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* ===================================================================== */}
          {/* STUDIO 1: TEXT COLOR PALETTE                                         */}
          {/* ===================================================================== */}
          {activeStudio === 'color' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                    <Palette className="h-3 w-3" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Text Color</span>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">• Click tone or hex</span>
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setActiveStudio(null)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
                  title="Close Color Studio"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

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
              </div>

              {/* Custom Hex Bar - Compact single row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Custom:
                  </span>
                  <label className="relative flex items-center justify-center cursor-pointer">
                    <input
                      type="color"
                      value={customTextColor}
                      onChange={(e) => setCustomTextColor(e.target.value)}
                      className="h-6 w-6 rounded-md border-0 p-0 cursor-pointer overflow-hidden opacity-0 absolute inset-0"
                      title="Pick custom color"
                    />
                    <span
                      className="h-6 w-6 rounded-md border border-slate-300 dark:border-slate-600 shadow-2xs block transition-transform hover:scale-110"
                      style={{ backgroundColor: customTextColor }}
                    />
                  </label>
                  <input
                    type="text"
                    value={customTextColor}
                    onChange={(e) => setCustomTextColor(e.target.value)}
                    placeholder="#4F46E5"
                    className="h-6 w-20 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 font-mono text-[11px] uppercase text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyTextColor(customTextColor)}
                    className="h-6 px-2.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-[11px] font-semibold text-white shadow-2xs transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </div>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyTextColor('inherit')}
                  className="flex items-center gap-1 h-6 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-2xs transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-2.5 w-2.5 text-slate-400" />
                  <span>Reset to Auto</span>
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* STUDIO 2: PASTEL HIGHLIGHTER                                         */}
          {/* ===================================================================== */}
          {activeStudio === 'highlight' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                    <Highlighter className="h-3 w-3" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Text Highlighter</span>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">• Select marker</span>
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setActiveStudio(null)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
                  title="Close Highlighter Studio"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

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
              </div>

              {/* Custom Highlight & Clear Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Custom:
                  </span>
                  <label className="relative flex items-center justify-center cursor-pointer">
                    <input
                      type="color"
                      value={customHighlightColor}
                      onChange={(e) => setCustomHighlightColor(e.target.value)}
                      className="h-6 w-6 rounded-md border-0 p-0 cursor-pointer overflow-hidden opacity-0 absolute inset-0"
                      title="Pick custom highlight color"
                    />
                    <span
                      className="h-6 w-6 rounded-md border border-slate-300 dark:border-slate-600 shadow-2xs block transition-transform hover:scale-110"
                      style={{ backgroundColor: customHighlightColor }}
                    />
                  </label>
                  <input
                    type="text"
                    value={customHighlightColor}
                    onChange={(e) => setCustomHighlightColor(e.target.value)}
                    className="h-6 w-20 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 font-mono text-[11px] uppercase text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyHighlight(customHighlightColor)}
                    className="h-6 px-2.5 rounded-md bg-amber-500 hover:bg-amber-600 text-[11px] font-semibold text-white shadow-2xs transition-colors cursor-pointer"
                  >
                    Highlight
                  </button>
                </div>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyHighlight('transparent')}
                  className="flex items-center gap-1 h-6 px-2 rounded-md border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-slate-800 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 shadow-2xs transition-colors cursor-pointer"
                >
                  <X className="h-3 w-3" />
                  <span>Clear Highlight</span>
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* STUDIO 3: BULLETS & NUMBERING                                        */}
          {/* ===================================================================== */}
          {activeStudio === 'bullets' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
                    <List className="h-3 w-3" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Bullets & Numbering</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Segmented Control */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md text-[10px]">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setBulletTab('symbols')}
                      className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                        bulletTab === 'symbols'
                          ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Bullet Symbols
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setBulletTab('numbered')}
                      className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                        bulletTab === 'numbered'
                          ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
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
                  </div>

                  {/* Custom Bullet Symbol / Emoji Row */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Custom Emoji / Bullet:
                    </span>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 🎯, 🚀, 🔥, ⚡"
                      value={customBulletInput}
                      onChange={(e) => setCustomBulletInput(e.target.value)}
                      className="h-6 w-28 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 text-xs text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={!customBulletInput.trim()}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        insertBulletList(customBulletInput.trim());
                        setCustomBulletInput('');
                      }}
                      className="h-6 px-2 rounded-md bg-violet-600 hover:bg-violet-700 text-[11px] font-semibold text-white shadow-2xs disabled:opacity-40 cursor-pointer"
                    >
                      Insert
                    </button>
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
                      placeholder="e.g. Step, Point"
                      value={customNumberPrefix}
                      onChange={(e) => setCustomNumberPrefix(e.target.value)}
                      className="h-6 w-28 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 text-xs text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertNumberedList('1', customNumberPrefix)}
                      className="h-6 px-2 rounded-md bg-violet-600 hover:bg-violet-700 text-[11px] font-semibold text-white shadow-2xs cursor-pointer"
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
          {activeStudio === 'table' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <TableIcon className="h-3 w-3" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Table Studio</span>
                  {activeTableLocation ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[9px] font-semibold border border-emerald-200/80 dark:border-emerald-800/60">
                      Row {activeTableLocation.row}/{activeTableLocation.totalRows} · Col {activeTableLocation.col}/{activeTableLocation.totalCols}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 hidden sm:inline">
                      • Click cell in table to edit
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 items-start">
                {/* Panel 1: Create & Insert Table */}
                <div className="p-2.5 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Plus className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Create Grid</span>
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.2 rounded border border-indigo-100 dark:border-indigo-900/60">
                      {tableGridHover.rows} × {tableGridHover.cols}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {/* 6x6 Smooth Interactive Grid */}
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

                    {/* Quick Presets */}
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

                  {/* Header Row checkbox & Insert Button */}
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

                {/* Panel 2: Table Modification Controls */}
                <div className="p-2.5 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Columns className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Edit Active Table</span>
                    </span>
                    <span className="text-[9px] text-slate-400">
                      Shortcut: <kbd className="font-mono bg-white dark:bg-slate-800 px-1 py-0.2 rounded border border-slate-200 dark:border-slate-700">Tab</kbd>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={addTableRow}
                      className="flex items-center justify-center gap-1 py-1 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
                      title="Insert row below active cell"
                    >
                      <Plus className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Add Row</span>
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={addTableColumn}
                      className="flex items-center justify-center gap-1 py-1 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer shadow-2xs"
                      title="Insert column to the right"
                    >
                      <Plus className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Add Col</span>
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={deleteTableRow}
                      className="flex items-center justify-center gap-1 py-1 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 transition-colors cursor-pointer shadow-2xs"
                      title="Delete current row"
                    >
                      <Minus className="h-3 w-3 text-rose-500" />
                      <span>Delete Row</span>
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={deleteTableColumn}
                      className="flex items-center justify-center gap-1 py-1 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 transition-colors cursor-pointer shadow-2xs"
                      title="Delete current column"
                    >
                      <Minus className="h-3 w-3 text-rose-500" />
                      <span>Delete Col</span>
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
                      <span>Delete Entire Table</span>
                    </button>
                  </div>
                </div>
              </div>
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
        onInput={handleEditorInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onKeyUp={() => { saveSelection(); detectActiveTable(); }}
        onMouseUp={() => { saveSelection(); detectActiveTable(); }}
        onSelect={() => { saveSelection(); detectActiveTable(); }}
        onTouchEnd={() => { saveSelection(); detectActiveTable(); }}
        onBlur={() => { handleEditorInput(); saveSelection(); }}
        className={`p-4 sm:p-5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none overflow-y-auto leading-relaxed om-rich-rendered ${minHeight} ${maxHeight}
          [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:my-3 [&_h1]:text-slate-950 dark:[&_h1]:text-white
          [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:my-2.5 [&_h2]:text-slate-900 dark:[&_h2]:text-slate-100
          [&_h3]:text-base [&_h3]:font-bold [&_h3]:my-2 [&_h3]:text-slate-800 dark:[&_h3]:text-slate-200
          [&_p]:my-1.5 [&_p]:leading-relaxed
          empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400/80 empty:before:pointer-events-none empty:before:italic`}
        data-placeholder={placeholder}
      />
    </div>
  );
};
