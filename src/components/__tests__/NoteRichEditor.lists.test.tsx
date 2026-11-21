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
  let button = [...container.querySelectorAll('button')].find(node => node.getAttribute('title') === title);
  if (!button && (title.startsWith('Undo ') || title.startsWith('Redo '))) {
    const formatToggle = [...container.querySelectorAll('button')].find(node => node.getAttribute('title') === 'Text formatting tools');
    if (formatToggle) await act(async () => formatToggle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    button = [...container.querySelectorAll('button')].find(node => node.getAttribute('title') === title);
  }
  expect(button, `button with title "${title}"`).toBeDefined();
  await act(async () => {
    button!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    button!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return button as HTMLElement;
};

const clickByText = async (container: HTMLElement, text: string) => {
  const button = [...container.querySelectorAll('button')].find(node => (node.textContent || '').includes(text));
  expect(button, `button with text "${text}"`).toBeDefined();
  await act(async () => {
    button!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    button!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return button as HTMLElement;
};

const placeCaretAtEnd = (element: HTMLElement) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

const pressEnter = async (editor: HTMLElement) => {
  await act(async () => {
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
};

const listItems = (editor: HTMLElement, kind: string) =>
  Array.from(editor.querySelectorAll(`[data-om-list="${kind}"]`)) as HTMLElement[];

describe('NoteRichEditor bullet & numbering lists', () => {
  it('undoes and redoes editor content changes from the toolbar', async () => {
    const { container, editor } = await renderEditor('<p>Original</p>');

    await act(async () => {
      editor.innerHTML = '<p>Original with an edit</p>';
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    });

    await act(async () => {
      const textNode = editor.querySelector('p')!.firstChild!;
      const range = document.createRange();
      range.setStart(textNode, 9);
      range.setEnd(textNode, textNode.textContent!.length);
      range.deleteContents();
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContent' }));
    });

    await clickByTitle(container, 'Undo (Ctrl+Z)');
    expect(editor.innerHTML).toBe('<p>Original with an edit</p>');

    await clickByTitle(container, 'Redo (Ctrl+Y)');
    expect(editor.innerHTML).toBe('<p>Original </p>');
  });

  it('handles keyboard undo and redo shortcuts for selected text deletion', async () => {
    const { editor } = await renderEditor('<p>Keep this selected text</p>');
    await act(async () => {
      const textNode = editor.querySelector('p')!.firstChild!;
      const range = document.createRange();
      range.setStart(textNode, 5);
      range.setEnd(textNode, textNode.textContent!.length);
      range.deleteContents();
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContent' }));
    });
    expect(editor.innerHTML).toBe('<p>Keep </p>');

    await act(async () => {
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    });
    expect(editor.innerHTML).toBe('<p>Keep this selected text</p>');

    await act(async () => {
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }));
    });
    expect(editor.innerHTML).toBe('<p>Keep </p>');
  });

  it('deletes a selected text range with Backspace and restores it with Undo', async () => {
    const { container, editor } = await renderEditor('<p>Delete this selection</p>');
    await act(async () => {
      const textNode = editor.querySelector('p')!.firstChild!;
      const range = document.createRange();
      range.setStart(textNode, 7);
      range.setEnd(textNode, textNode.textContent!.length);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
      editor.dispatchEvent(event);
      // The browser owns the deletion now, so jsdom has to play its part.
      expect(event.defaultPrevented).toBe(false);
      range.deleteContents();
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    expect(editor.innerHTML).toBe('<p>Delete </p>');

    await clickByTitle(container, 'Undo (Ctrl+Z)');
    expect(editor.innerHTML).toBe('<p>Delete this selection</p>');
  });

  it('inserts the chosen bullet marker and continues it on Enter', async () => {
    const { container, editor } = await renderEditor();

    await clickByTitle(container, 'Bullet & Numbering Studio');
    await clickByTitle(container, 'Insert Ring');

    let items = listItems(editor, 'bullet');
    expect(items).toHaveLength(1);
    expect(items[0].getAttribute('data-om-marker')).toBe('○');
    expect(items[0].firstElementChild?.textContent).toBe('○');

    placeCaretAtEnd(items[0].lastElementChild as HTMLElement);
    await pressEnter(editor);

    items = listItems(editor, 'bullet');
    expect(items).toHaveLength(2);
    expect(items[1].getAttribute('data-om-marker')).toBe('○');
    expect(items[1].firstElementChild?.textContent).toBe('○');
  });

  it('keeps circular numbering increasing on Enter', async () => {
    const { container, editor } = await renderEditor();

    await clickByTitle(container, 'Bullet & Numbering Studio');
    await clickByText(container, 'Numbered Sequences');
    await clickByTitle(container, 'Circled Numbers');

    let items = listItems(editor, 'number');
    expect(items).toHaveLength(1);
    expect(items[0].firstElementChild?.textContent).toBe('①');

    placeCaretAtEnd(items[0].lastElementChild as HTMLElement);
    await pressEnter(editor);

    items = listItems(editor, 'number');
    expect(items).toHaveLength(2);
    expect(items[1].firstElementChild?.textContent).toBe('②');
  });

  it('continues a saved list item after reload (sanitizer keeps list metadata)', async () => {
    // Exact markup Chrome produces after insertHTML: keep the shape verbatim.
    const saved = '<div data-om-list="bullet" data-om-marker="★" style="display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;"><span contenteditable="false" style="color: #b88648; font-weight: bold; flex-shrink: 0;">★</span><span data-om-text="1">Saved item</span></div>';
    const { editor } = await renderEditor(saved);

    let items = listItems(editor, 'bullet');
    expect(items).toHaveLength(1);
    expect(items[0].getAttribute('data-om-marker')).toBe('★');

    placeCaretAtEnd(items[0].lastElementChild as HTMLElement);
    await pressEnter(editor);

    items = listItems(editor, 'bullet');
    expect(items).toHaveLength(2);
    expect(items[1].getAttribute('data-om-marker')).toBe('★');
  });
});
describe('NoteRichEditor list items damaged by browser HTML normalisation', () => {
  // Chrome's document.execCommand('insertHTML') unwraps inline elements that have
  // no attributes, so the item text can become a bare child node of the block.
  const chromeShapedItem =
    '<div data-om-list="bullet" data-om-marker="○" style="display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;">' +
    '<span contenteditable="false" style="color: #b88648; font-weight: bold; flex-shrink: 0;">○</span>ashok</div>';

  it('still continues the marker when the text span was unwrapped', async () => {
    const { editor } = await renderEditor(chromeShapedItem);

    let items = listItems(editor, 'bullet');
    expect(items).toHaveLength(1);

    placeCaretAtEnd(items[0]);
    await pressEnter(editor);

    items = listItems(editor, 'bullet');
    expect(items).toHaveLength(2);
    // the marker span must survive on both items - the bug erased it
    expect(items[0].firstElementChild?.textContent).toBe('○');
    expect(items[1].firstElementChild?.textContent).toBe('○');
    expect((items[0].textContent || '').replace('○', '').trim()).toBe('ashok');
    // and the repaired item owns a dedicated text element again
    expect(items[1].querySelector('[data-om-text]')).not.toBeNull();
  });

  it('ends the list when Enter is pressed on an empty item', async () => {
    const { container, editor } = await renderEditor();

    await clickByTitle(container, 'Bullet & Numbering Studio');
    await clickByTitle(container, 'Insert Ring');

    let items = listItems(editor, 'bullet');
    expect(items).toHaveLength(1);
    expect(items[0].getAttribute('data-om-marker')).toBe('○');

    // placeholder is selected on insert; Enter on the empty item leaves the list
    const empty = items[0];
    const textEl = empty.querySelector('[data-om-text]') as HTMLElement;
    textEl.innerHTML = '<br>';
    placeCaretAtEnd(textEl);
    await pressEnter(editor);

    items = listItems(editor, 'bullet');
    expect(items).toHaveLength(0);
    expect(editor.querySelector('p')).not.toBeNull();
  });

  it('inserts a custom emoji bullet from the compact custom field', async () => {
    const { container, editor } = await renderEditor('<p>Custom bullet text</p>');
    const textNode = editor.querySelector('p')!.firstChild!;
    const range = document.createRange();
    range.selectNodeContents(textNode);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    await clickByTitle(container, 'Bullet & Numbering Studio');

    const input = container.querySelector('input[aria-label="Custom bullet or emoji"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    await act(async () => {
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, '🔥');
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: '🔥' }));
    });

    const insert = [...container.querySelectorAll('button')].find(node => node.textContent?.trim() === 'Insert');
    expect(insert?.getAttribute('aria-disabled')).toBe('false');
    await clickByText(container, 'Insert');

    expect(listItems(editor, 'bullet')).toHaveLength(1);
    expect(listItems(editor, 'bullet')[0].getAttribute('data-om-marker')).toBe('🔥');
    expect(listItems(editor, 'bullet')[0].textContent).toContain('Custom bullet text');
  });

  it('accepts a compound emoji through Enter without truncating it', async () => {
    const { container, editor } = await renderEditor();
    placeCaretAtEnd(editor);
    await clickByTitle(container, 'Bullet & Numbering Studio');
    const input = container.querySelector('input[aria-label="Custom bullet or emoji"]') as HTMLInputElement;
    const emoji = '👨‍👩‍👧‍👦';

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, emoji);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: emoji }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });

    expect(listItems(editor, 'bullet')).toHaveLength(1);
    expect(listItems(editor, 'bullet')[0].getAttribute('data-om-marker')).toBe(emoji);
  });

  it('uses a computer image as a custom bullet marker', async () => {
    const { container, editor } = await renderEditor();
    placeCaretAtEnd(editor);
    await clickByTitle(container, 'Bullet & Numbering Studio');
    const fileInput = container.querySelector('input[aria-label="Choose custom bullet image"]') as HTMLInputElement;
    const file = new File(['small-image'], 'bullet.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    await clickByText(container, 'Insert');

    const item = listItems(editor, 'bullet')[0];
    expect(item).toBeDefined();
    expect(item.getAttribute('data-om-marker')).toBe('custom-image');
    expect(item.querySelector('img')?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  });
});
