const ALLOWED_TAGS = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CAPTION', 'CODE', 'COL', 'COLGROUP', 'DD', 'DEL',
  'DIV', 'DL', 'DT', 'EM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'I', 'IMG',
  'LI', 'OL', 'P', 'PRE', 'S', 'SPAN', 'STRIKE', 'STRONG', 'SUB', 'SUP', 'TABLE',
  'TBODY', 'TD', 'TH', 'THEAD', 'TR', 'U', 'UL'
]);

const DROP_CONTENT_TAGS = new Set([
  'EMBED', 'FORM', 'IFRAME', 'MATH', 'OBJECT', 'SCRIPT', 'STYLE', 'SVG', 'TEMPLATE'
]);

const ALLOWED_STYLE_PROPERTIES = new Set([
  'background-color', 'border', 'border-collapse', 'border-color', 'border-style',
  'border-width', 'color', 'font-family', 'font-size', 'font-style', 'font-weight',
  'height', 'list-style-type', 'margin-left', 'margin-right', 'padding', 'text-align',
  'text-decoration', 'vertical-align', 'width'
]);

function sanitizeStyle(styleText: string): string {
  const style = document.createElement('span').style;
  style.cssText = styleText;
  const safe: string[] = [];

  for (const property of Array.from(style)) {
    const value = style.getPropertyValue(property).trim();
    if (
      ALLOWED_STYLE_PROPERTIES.has(property) &&
      value &&
      !/(?:url|expression|javascript|vbscript|@import|behavior|-moz-binding|var\s*\()/i.test(value)
    ) {
      safe.push(`${property}: ${value}`);
    }
  }

  return safe.join('; ');
}

function isSafeLink(value: string): boolean {
  const compact = value.trim().replace(/[\u0000-\u0020]/g, '');
  if (!compact || /^(?:javascript|vbscript|data):/i.test(compact)) return false;
  return !/^[a-z][a-z0-9+.-]*:/i.test(compact) || /^(?:https?:|mailto:|tel:)/i.test(compact);
}

function isSafeImageSource(value: string): boolean {
  const compact = value.trim().replace(/[\u0000-\u0020]/g, '');
  return /^https?:\/\//i.test(compact) ||
    /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/]+=*$/i.test(compact);
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('head,script,style,iframe,object,embed,link,meta,base,form,svg,math,template').forEach(el => el.remove());
    Array.from(doc.body.querySelectorAll('*')).forEach(el => {
      if (!el.isConnected) return;
      if (DROP_CONTENT_TAGS.has(el.tagName)) {
        el.remove();
        return;
      }
      if (!ALLOWED_TAGS.has(el.tagName)) {
        el.replaceWith(...Array.from(el.childNodes));
        return;
      }

      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (name === 'style') {
          const safeStyle = sanitizeStyle(attr.value);
          if (safeStyle) el.setAttribute('style', safeStyle);
          else el.removeAttribute(attr.name);
          continue;
        }

        const isLink = el.tagName === 'A' && name === 'href' && isSafeLink(attr.value);
        const isLinkTarget = el.tagName === 'A' && name === 'target' &&
          (attr.value === '_blank' || attr.value === '_self');
        const isImageSource = el.tagName === 'IMG' && name === 'src' && isSafeImageSource(attr.value);
        const isAlt = el.tagName === 'IMG' && name === 'alt';
        const isDimension = (el.tagName === 'IMG' || el.tagName === 'TD' || el.tagName === 'TH' || el.tagName === 'COL') &&
          (name === 'width' || name === 'height' || name === 'colspan' || name === 'rowspan') &&
          /^\d{1,4}$/.test(attr.value);
        const isListType = (el.tagName === 'OL' || el.tagName === 'UL') &&
          (name === 'type' || name === 'start') && /^[1-9a-zA-Z]{1,3}$/.test(attr.value);

        if (!(isLink || isLinkTarget || isImageSource || isAlt || isDimension || isListType)) {
          el.removeAttribute(attr.name);
        }
      }

      if (el.tagName === 'A' && el.hasAttribute('href') && el.getAttribute('target') === '_blank') {
        el.setAttribute('rel', 'noopener noreferrer');
      }
    });
    return doc.body.innerHTML;
  } catch {
    return '';
  }
}

export function plainTextToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\r?\n/g, '<br/>');
}

export function htmlToPlainText(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(sanitizeHtml(html), 'text/html');
  return (doc.body.innerText || doc.body.textContent || '').trimEnd();
}
