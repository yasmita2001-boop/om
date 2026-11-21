import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { NoteRichEditor } from '../NoteRichEditor';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const renderEditor = async (initialHtml = '') => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onChange = vi.fn();
  await act(async () => {
    root.render(<NoteRichEditor initialHtml={initialHtml} onChange={onChange} />);
  });
  const editor = container.querySelector('[contenteditable="true"]') as HTMLElement | null;
  expect(editor).not.toBeNull();
  return { container, root, onChange, editor: editor as HTMLElement };
};

const clickByTitle = async (container: HTMLElement, title: string) => {
  const button = [...container.querySelectorAll('button')].find(node => node.getAttribute('title') === title);
  expect(button, `button with title "${title}"`).toBeDefined();
  await act(async () => {
    button!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    button!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return button as HTMLElement;
};

const placeCaretInside = (element: HTMLElement, offset = 0) => {
  const text = element.firstChild;
  const range = document.createRange();
  if (text && text.nodeType === Node.TEXT_NODE) {
    range.setStart(text, Math.min(offset, text.textContent?.length ?? 0));
  } else {
    range.selectNodeContents(element);
  }
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

describe('NoteRichEditor block structure', () => {
  it('boots a brand new note with a real paragraph block', async () => {
    const { root, editor } = await renderEditor('');
    expect(editor.innerHTML.toLowerCase()).toContain('<p>');
    await act(async () => {
      root.unmount();
    });
  });

  it('wraps stray root text into a paragraph before typing continues', async () => {
    const { root, editor } = await renderEditor('');
    // Simulate a legacy/dirty value where the browser left bare text at the root.
    editor.innerHTML = 'bare line';
    placeCaretInside(editor, 'bare line'.length);
    await act(async () => {
      editor.dispatchEvent(new InputEvent('input', { inputType: 'insertText', bubbles: true }));
    });
    expect(editor.children[0]?.tagName).toBe('P');
    expect(editor.textContent).toContain('bare line');
    await act(async () => {
      root.unmount();
    });
  });

  it('turns the caret line into a bullet instead of appending a placeholder', async () => {
    const { container, root, editor } = await renderEditor('<p>alpha</p><p>beta</p>');
    const second = editor.querySelectorAll('p')[1] as HTMLElement;
    placeCaretInside(second, 4);
    editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    await clickByTitle(container, 'Bullet & Numbering Studio');
    await clickByTitle(container, 'Insert Ring');

    const items = Array.from(editor.querySelectorAll('[data-om-list="bullet"]')) as HTMLElement[];
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('beta');
    expect(editor.textContent).not.toContain('List item');
    expect((editor.querySelectorAll('p')[0] as HTMLElement).textContent).toContain('alpha');

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps list markers out of text selections', async () => {
    const { container, root, editor } = await renderEditor('<p>alpha</p>');
    placeCaretInside(editor.querySelector('p') as HTMLElement, 5);
    editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    await clickByTitle(container, 'Bullet & Numbering Studio');
    await clickByTitle(container, 'Insert Ring');

    const marker = editor.querySelector('[data-om-list] > [contenteditable="false"]') as HTMLElement | null;
    expect(marker, 'list marker').not.toBeNull();
    // A selectable marker makes Chrome collapse every range that touches it,
    // which made Ctrl+A / drag-select + Backspace delete nothing.
    expect(marker!.getAttribute('style') || '').toContain('user-select: none');

    await act(async () => {
      root.unmount();
    });
  });

  it('lets the browser delete a real text selection', async () => {
    const { root, editor } = await renderEditor('<p>alpha beta</p>');
    const text = editor.querySelector('p')!.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 5);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    await act(async () => {
      editor.dispatchEvent(event);
    });
    // Our own deleteContents() used to run here and eat the marker nodes;
    // the browser must own the deletion.
    expect(event.defaultPrevented).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it('maps the 24px size option to an exact pixel size', async () => {
    const { container, root, editor } = await renderEditor('<p>sized</p>');
    const paragraph = editor.querySelector('p') as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    // jsdom has no execCommand; mimic Chrome's keyword span so the px mapping is tested.
    const originalExec = (document as unknown as { execCommand?: unknown }).execCommand;
    (document as unknown as { execCommand: unknown }).execCommand = (cmd: string) => {
      if (cmd === 'fontSize') {
        const live = window.getSelection();
        if (live && live.rangeCount > 0) {
          const liveRange = live.getRangeAt(0);
          const span = document.createElement('span');
          span.style.fontSize = 'xx-large';
          span.appendChild(liveRange.extractContents());
          liveRange.insertNode(span);
        }
      }
      return true;
    };

    await clickByTitle(container, 'Text tools');
    const sizeSelect = [...container.querySelectorAll('select')].find(
      node => node.getAttribute('aria-label') === 'Text size'
    ) as HTMLSelectElement;
    expect(sizeSelect).toBeDefined();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
      setter.call(sizeSelect, '6');
      sizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const sized = [...editor.querySelectorAll('span')].find(
      node => (node as HTMLElement).style.fontSize === '24px'
    );
    expect(sized, 'span with exact 24px font size').toBeDefined();

    (document as unknown as { execCommand?: unknown }).execCommand = originalExec;

    await act(async () => {
      root.unmount();
    });
  });
});