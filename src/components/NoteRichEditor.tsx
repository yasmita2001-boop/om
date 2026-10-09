import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  List, Palette, Highlighter,
  AlignLeft, AlignCenter, AlignRight,
  RemoveFormatting, Table as TableIcon,
  Plus, Minus, Trash2, X
} from 'lucide-react';

export interface NoteRichEditorProps {
  initialHtml?: string;
  onChange: (html: string, plainText: string) => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
}

const FLAT_TEXT_COLORS = [
  { name: 'Default Text', value: 'inherit', hex: '#0f172a' },
  { name: 'Dark Slate', value: '#334155', hex: '#334155' },
  { name: 'Royal Blue', value: '#1d4ed8', hex: '#1d4ed8' },
  { name: 'Indigo Core', value: '#4f46e5', hex: '#4f46e5' },
  { name: 'Sky Cerulean', value: '#0284c7', hex: '#0284c7' },
  { name: 'Emerald Velvet', value: '#059669', hex: '#059669' },
  { name: 'Mint Jade', value: '#10b981', hex: '#10b981' },
  { name: 'Ruby Crimson', value: '#dc2626', hex: '#dc2626' },
  { name: 'Warm Amber', value: '#d97706', hex: '#d97706' },
  { name: 'Electric Violet', value: '#7c3aed', hex: '#7c3aed' },
  { name: 'Orchid Purple', value: '#a855f7', hex: '#a855f7' }
];

const HIGHLIGHT_COLORS = [
  { name: 'Sunlight Yellow', value: '#fef08a', label: 'Yellow', bg: '#fef08a' },
  { name: 'Mint Meadow', value: '#bbf7d0', label: 'Mint', bg: '#bbf7d0' },
  { name: 'Sky Breeze', value: '#bae6fd', label: 'Sky', bg: '#bae6fd' },
  { name: 'Petal Rose', value: '#fbcfe8', label: 'Rose', bg: '#fbcfe8' },
  { name: 'Lavender Mist', value: '#e9d5ff', label: 'Lavender', bg: '#e9d5ff' },
  { name: 'Warm Peach', value: '#fed7aa', label: 'Peach', bg: '#fed7aa' }
];

const BULLET_STYLES = [
  { id: 'disc', symbol: '•', label: 'Dot' },
  { id: 'arrow', symbol: '➔', label: 'Arrow' },
  { id: 'check', symbol: '✓', label: 'Check' },
  { id: 'star', symbol: '★', label: 'Star' },
  { id: 'diamond', symbol: '◆', label: 'Diamond' }
];

export const NoteRichEditor: React.FC<NoteRichEditorProps> = ({
  initialHtml = '',
  onChange,
  placeholder = 'Write note content...',
  minHeight = 'min-h-[200px]',
  maxHeight = 'max-h-[450px]',
  className = ''
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastRenderedHtmlRef = useRef(initialHtml || '');
  const savedRangeRef = useRef<Range | null>(null);

  const [activeStudio, setActiveStudio] = useState<'color' | 'highlight' | 'bullets' | 'table' | null>(null);
  const [activeStyle, setActiveStyle] = useState('p');
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false
  });

  useEffect(() => {
    if (editorRef.current && initialHtml !== lastRenderedHtmlRef.current) {
      editorRef.current.innerHTML = initialHtml || '';
      lastRenderedHtmlRef.current = initialHtml || '';
    }
  }, [initialHtml]);

  const updateToolbarState = useCallback(() => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();

        // Detect active block tag
        let node: Node | null = range.startContainer;
        let detectedBlock = 'p';
        while (node && node !== editorRef.current) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = (node as HTMLElement).tagName.toLowerCase();
            if (['h1', 'h2', 'h3', 'blockquote', 'pre', 'p'].includes(tag)) {
              detectedBlock = tag;
              break;
            }
          }
          node = node.parentNode;
        }
        setActiveStyle(detectedBlock);
      }
    }

    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight')
      });
    } catch {}
  }, []);

  const restoreSelection = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (!sel) return;

    if (
      savedRangeRef.current &&
      editorRef.current.contains(savedRangeRef.current.commonAncestorContainer)
    ) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
        return;
      } catch {}
    }

    // Fallback: place caret at the end of editor
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    savedRangeRef.current = range.cloneRange();
  }, []);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const text = editorRef.current.innerText || '';
    lastRenderedHtmlRef.current = html;
    updateToolbarState();
    onChange(html, text);
  }, [onChange, updateToolbarState]);

  const exec = useCallback((cmd: string, val: string | null = null, useCss = false) => {
    restoreSelection();
    try {
      document.execCommand('styleWithCSS', false, useCss ? 'true' : 'false');
    } catch {}
    document.execCommand(cmd, false, val ?? undefined);
    updateToolbarState();
    handleInput();
  }, [restoreSelection, updateToolbarState, handleInput]);

  const handleFormatBlock = (tag: string) => {
    setActiveStyle(tag);
    restoreSelection();
    if (!editorRef.current) return;

    const isEmpty = !editorRef.current.innerHTML.trim() || editorRef.current.innerHTML === '<br>';
    if (isEmpty) {
      editorRef.current.innerHTML = `<${tag}><br></${tag}>`;
      const target = editorRef.current.querySelector(tag);
      if (target) {
        const range = document.createRange();
        range.setStart(target, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        savedRangeRef.current = range.cloneRange();
      }
      handleInput();
      return;
    }

    try {
      document.execCommand('styleWithCSS', false, 'false');
      const ok = document.execCommand('formatBlock', false, `<${tag}>`);
      if (!ok) {
        document.execCommand('formatBlock', false, tag);
      }
    } catch {
      document.execCommand('formatBlock', false, tag);
    }
    updateToolbarState();
    handleInput();
  };

  const applyTextColor = (val: string) => {
    restoreSelection();
    try {
      document.execCommand('styleWithCSS', false, 'true');
      if (val === 'inherit') {
        document.execCommand('foreColor', false, 'inherit');
      } else {
        document.execCommand('foreColor', false, val);
      }
    } catch {}
    updateToolbarState();
    handleInput();
    setActiveStudio(null);
  };

  const applyHighlight = (hex: string) => {
    restoreSelection();
    try {
      document.execCommand('styleWithCSS', false, 'true');
      if (hex === 'transparent') {
        document.execCommand('hiliteColor', false, 'transparent');
      } else {
        document.execCommand('hiliteColor', false, hex);
        document.execCommand('foreColor', false, '#0f172a');
      }
    } catch {}
    updateToolbarState();
    handleInput();
    setActiveStudio(null);
  };

  const findParentElement = (tagName: string): HTMLElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return null;
    let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName.toLowerCase() === tagName.toLowerCase()) {
        return node as HTMLElement;
      }
      node = node.parentNode;
    }
    return null;
  };

  const insertBullet = (bulletId: string, symbol: string) => {
    restoreSelection();
    if (!editorRef.current) return;

    try {
      document.execCommand('styleWithCSS', false, 'false');
    } catch {}

    let existingUl = findParentElement('ul');
    if (!existingUl) {
      document.execCommand('insertUnorderedList');
      existingUl = findParentElement('ul');
    }

    if (!existingUl) {
      // Fallback if browser did not create <ul> (e.g., on empty canvas)
      const listStyle = bulletId === 'disc' ? 'disc' : `'${symbol}  '`;
      const dataAttr = bulletId === 'disc' ? '' : ` data-bullet="${bulletId}"`;
      const html = `<ul${dataAttr} style="list-style-type: ${listStyle}; padding-left: 1.5rem;"><li><br></li></ul>`;
      document.execCommand('insertHTML', false, html);
    } else {
      if (bulletId === 'disc') {
        existingUl.removeAttribute('data-bullet');
        existingUl.style.listStyleType = 'disc';
      } else {
        existingUl.setAttribute('data-bullet', bulletId);
        existingUl.style.listStyleType = `'${symbol}  '`;
      }
    }

    updateToolbarState();
    handleInput();
    setActiveStudio(null);
  };

  const insertNumberedList = () => {
    restoreSelection();
    if (!editorRef.current) return;
    try {
      document.execCommand('styleWithCSS', false, 'false');
    } catch {}
    document.execCommand('insertOrderedList');
    const existingOl = findParentElement('ol');
    if (!existingOl) {
      document.execCommand('insertHTML', false, '<ol style="list-style-type: decimal; padding-left: 1.5rem;"><li><br></li></ol>');
    }
    updateToolbarState();
    handleInput();
    setActiveStudio(null);
  };

  const insertTable = (rows = 3, cols = 3) => {
    restoreSelection();
    let html = '<table><thead><tr>';
    for (let c = 1; c <= cols; c++) {
      html += `<th>Header ${c}</th>`;
    }
    html += '</tr></thead><tbody>';
    for (let r = 1; r < rows; r++) {
      html += '<tr>';
      for (let c = 1; c <= cols; c++) {
        html += `<td>Cell ${r},${c}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    document.execCommand('insertHTML', false, html);
    updateToolbarState();
    handleInput();
    setActiveStudio(null);
  };

  const modifyTable = (action: 'addRow' | 'addCol' | 'delRow' | 'delCol' | 'delTable') => {
    restoreSelection();
    const table = findParentElement('table') as HTMLTableElement | null;
    if (!table) return;

    if (action === 'delTable') {
      table.remove();
      handleInput();
      setActiveStudio(null);
      return;
    }

    const currentRow = findParentElement('tr') as HTMLTableRowElement | null;
    const currentCell = (findParentElement('td') || findParentElement('th')) as HTMLTableCellElement | null;

    if (action === 'addRow') {
      const tbody = table.tBodies[0] || table.createTBody();
      const colCount = table.rows[0]?.cells.length || 2;
      const newRow = tbody.insertRow(currentRow && currentRow.parentElement === tbody ? currentRow.sectionRowIndex + 1 : -1);
      for (let c = 0; c < colCount; c++) {
        const td = newRow.insertCell(c);
        td.innerHTML = 'New';
      }
    } else if (action === 'addCol') {
      const colIndex = currentCell ? currentCell.cellIndex + 1 : -1;
      Array.from(table.rows).forEach((row, rIdx) => {
        const isHeader = row.parentElement?.tagName.toLowerCase() === 'thead' || rIdx === 0;
        if (isHeader) {
          const th = document.createElement('th');
          th.innerHTML = `Header ${row.cells.length + 1}`;
          if (colIndex >= 0 && colIndex < row.cells.length) {
            row.insertBefore(th, row.cells[colIndex]);
          } else {
            row.appendChild(th);
          }
        } else {
          const td = row.insertCell(colIndex >= 0 ? colIndex : -1);
          td.innerHTML = 'Cell';
        }
      });
    } else if (action === 'delRow') {
      if (currentRow && table.rows.length > 1) {
        currentRow.remove();
      } else if (table.rows.length > 1) {
        table.deleteRow(-1);
      }
    } else if (action === 'delCol') {
      const firstRow = table.rows[0];
      if (firstRow && firstRow.cells.length > 1) {
        const colIdx = currentCell ? currentCell.cellIndex : firstRow.cells.length - 1;
        Array.from(table.rows).forEach(row => {
          if (row.cells[colIdx]) row.deleteCell(colIdx);
        });
      }
    }

    handleInput();
  };

  const handleClearFormatting = () => {
    restoreSelection();
    try {
      document.execCommand('removeFormat');
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand('hiliteColor', false, 'transparent');
      document.execCommand('styleWithCSS', false, 'false');
      document.execCommand('formatBlock', false, '<p>');
    } catch {}
    setActiveStyle('p');
    updateToolbarState();
    handleInput();
  };

  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden focus-within:border-indigo-500/80 transition-all ${className}`}>
      {/* Primary Formatting Toolbar */}
      <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 px-2.5 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {/* Paragraph / Heading Style */}
        <select
          value={activeStyle}
          onChange={(e) => handleFormatBlock(e.target.value)}
          className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="blockquote">Quote Block</option>
          <option value="pre">Code</option>
        </select>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

        {/* Inline styles */}
        <div className="flex items-center gap-0.5 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}
            className={`h-6 w-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
              activeFormats.bold
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}
            className={`h-6 w-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
              activeFormats.italic
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('underline'); }}
            className={`h-6 w-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
              activeFormats.underline
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
            title="Underline"
          >
            <Underline className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec('strikeThrough'); }}
            className={`h-6 w-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
              activeFormats.strikeThrough
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
            title="Strikethrough"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

        {/* Studio Drawer Buttons */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            updateToolbarState();
            setActiveStudio(prev => prev === 'color' ? null : 'color');
          }}
          className={`flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold border cursor-pointer shrink-0 ${
            activeStudio === 'color' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
          <span>Color</span>
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            updateToolbarState();
            setActiveStudio(prev => prev === 'highlight' ? null : 'highlight');
          }}
          className={`flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold border cursor-pointer shrink-0 ${
            activeStudio === 'highlight' ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
          }`}
        >
          <Highlighter className="h-3.5 w-3.5" />
          <span>Highlight</span>
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            updateToolbarState();
            setActiveStudio(prev => prev === 'bullets' ? null : 'bullets');
          }}
          className={`flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold border cursor-pointer shrink-0 ${
            activeStudio === 'bullets' ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
          }`}
        >
          <List className="h-3.5 w-3.5" />
          <span>Bullets</span>
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            updateToolbarState();
            setActiveStudio(prev => prev === 'table' ? null : 'table');
          }}
          className={`flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold border cursor-pointer shrink-0 ${
            activeStudio === 'table' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
          }`}
        >
          <TableIcon className="h-3.5 w-3.5" />
          <span>Table</span>
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

        {/* Alignment */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); exec('justifyLeft'); }}
          className={`h-6 w-6 flex items-center justify-center rounded transition-colors shrink-0 cursor-pointer ${
            activeFormats.justifyLeft
              ? 'bg-indigo-600 text-white'
              : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}
          title="Align Left"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); exec('justifyCenter'); }}
          className={`h-6 w-6 flex items-center justify-center rounded transition-colors shrink-0 cursor-pointer ${
            activeFormats.justifyCenter
              ? 'bg-indigo-600 text-white'
              : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}
          title="Align Center"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); exec('justifyRight'); }}
          className={`h-6 w-6 flex items-center justify-center rounded transition-colors shrink-0 cursor-pointer ${
            activeFormats.justifyRight
              ? 'bg-indigo-600 text-white'
              : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}
          title="Align Right"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />

        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); handleClearFormatting(); }}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 dark:hover:bg-rose-950/40 shrink-0 cursor-pointer"
          title="Clear Format"
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Popout Drawers */}
      {activeStudio === 'color' && (
        <div className="border-b border-slate-100 dark:border-slate-800 p-2.5 bg-slate-50/90 dark:bg-slate-850 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Text Color:</span>
          {FLAT_TEXT_COLORS.map(c => (
            <button
              key={c.name}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); applyTextColor(c.value); }}
              className="h-6 w-6 rounded-md border border-black/10 dark:border-white/10 hover:scale-110 transition-transform cursor-pointer"
              style={{ backgroundColor: c.hex }}
              title={c.name}
            />
          ))}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setActiveStudio(null); }}
            className="ml-auto p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {activeStudio === 'highlight' && (
        <div className="border-b border-slate-100 dark:border-slate-800 p-2.5 bg-slate-50/90 dark:bg-slate-850 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Highlight:</span>
          {HIGHLIGHT_COLORS.map(h => (
            <button
              key={h.name}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); applyHighlight(h.value); }}
              className="h-6 px-2 rounded-md border border-black/10 text-[11px] font-bold text-slate-900 hover:scale-105 transition-transform cursor-pointer"
              style={{ backgroundColor: h.bg }}
            >
              {h.label}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); applyHighlight('transparent'); }}
            className="h-6 px-2 rounded-md border border-slate-200 bg-white text-[11px] text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            Clear
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setActiveStudio(null); }}
            className="ml-auto p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {activeStudio === 'bullets' && (
        <div className="border-b border-slate-100 dark:border-slate-800 p-2.5 bg-slate-50/90 dark:bg-slate-850 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Bullets:</span>
          {BULLET_STYLES.map(b => (
            <button
              key={b.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertBullet(b.id, b.symbol); }}
              className="flex items-center gap-1.5 h-6 px-2 rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-500 cursor-pointer"
            >
              <span className="text-indigo-600 font-bold">{b.symbol}</span>
              <span>{b.label}</span>
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); insertNumberedList(); }}
            className="h-6 px-2 rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-500 cursor-pointer"
          >
            1. 2. 3. Numbers
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setActiveStudio(null); }}
            className="ml-auto p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {activeStudio === 'table' && (
        <div className="border-b border-slate-100 dark:border-slate-800 p-2.5 bg-slate-50/90 dark:bg-slate-850 flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-[11px] font-semibold text-slate-500 mr-0.5">Insert Grid:</span>
          {[
            { r: 2, c: 2, label: '2×2' },
            { r: 3, c: 3, label: '3×3' },
            { r: 4, c: 4, label: '4×4' },
            { r: 5, c: 3, label: '5×3' }
          ].map(p => (
            <button
              key={p.label}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertTable(p.r, p.c); }}
              className="px-2 py-1 rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 font-mono text-slate-700 dark:text-slate-200 hover:border-indigo-500 cursor-pointer"
            >
              {p.label}
            </button>
          ))}

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); modifyTable('addRow'); }}
            className="flex items-center gap-0.5 px-2 py-1 rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-500 cursor-pointer"
            title="Add Row"
          >
            <Plus className="h-3 w-3" /> Row
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); modifyTable('addCol'); }}
            className="flex items-center gap-0.5 px-2 py-1 rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-500 cursor-pointer"
            title="Add Column"
          >
            <Plus className="h-3 w-3" /> Col
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); modifyTable('delRow'); }}
            className="flex items-center gap-0.5 px-2 py-1 rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-rose-500 cursor-pointer"
            title="Delete Row"
          >
            <Minus className="h-3 w-3" /> Row
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); modifyTable('delCol'); }}
            className="flex items-center gap-0.5 px-2 py-1 rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-rose-500 cursor-pointer"
            title="Delete Column"
          >
            <Minus className="h-3 w-3" /> Col
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); modifyTable('delTable'); }}
            className="flex items-center gap-0.5 px-2 py-1 rounded-md border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 cursor-pointer"
            title="Delete Table"
          >
            <Trash2 className="h-3 w-3" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setActiveStudio(null); }}
            className="ml-auto p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Editable Writing Canvas */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={updateToolbarState}
        onMouseUp={updateToolbarState}
        onFocus={updateToolbarState}
        onBlur={updateToolbarState}
        className={`rich-editor-content p-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none overflow-y-auto leading-relaxed ${minHeight} ${maxHeight}`}
        data-placeholder={placeholder}
      />
    </div>
  );
};
