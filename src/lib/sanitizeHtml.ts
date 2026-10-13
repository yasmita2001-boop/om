/** Lightweight HTML sanitizer for rendering stored rich text (strips scripts, event handlers, javascript: URLs). */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,iframe,object,embed,link,meta,base,form').forEach(el => el.remove());
    doc.body.querySelectorAll('*').forEach(el => {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const val = attr.value.trim().toLowerCase();
        if (name.startsWith('on')) el.removeAttribute(attr.name);
        else if ((name === 'href' || name === 'src' || name === 'xlink:href' || name === 'action') && /^(javascript|vbscript):/.test(val.replace(/[\s\u0000-\u001f]/g, ''))) el.removeAttribute(attr.name);
        else if (name === 'src' && val.startsWith('data:text/html')) el.removeAttribute(attr.name);
      }
    });
    return doc.body.innerHTML;
  } catch {
    return '';
  }
}
