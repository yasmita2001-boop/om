import { describe, expect, it } from 'vitest';
import { sanitizeHtml, plainTextToHtml, htmlToPlainText } from '../sanitizeHtml';

/**
 * sanitizeHtml guards every rich-text surface (notes, journal, spreadsheets).
 * These cases pin the allowlist so a future edit cannot silently reopen an XSS hole.
 */
describe('sanitizeHtml', () => {
  it('removes script tags together with their payload', () => {
    const out = sanitizeHtml('<p>safe</p><script>alert("xss")</script>');
    expect(out).toBe('<p>safe</p>');
  });

  it('drops event handler attributes but keeps the element', () => {
    const out = sanitizeHtml('<img src="https://example.com/a.png" onerror="alert(1)" />');
    expect(out).toContain('src="https://example.com/a.png"');
    expect(out).not.toContain('onerror');
  });

  it('rejects javascript: links and keeps http/mailto links', () => {
    const out = sanitizeHtml(
      '<a href="javascript:alert(1)">bad</a><a href="mailto:a@b.co">mail</a><a href="https://ok.dev">ok</a>'
    );
    expect(out).not.toContain('javascript:');
    expect(out).toContain('href="mailto:a@b.co"');
    expect(out).toContain('href="https://ok.dev"');
  });

  it('adds rel=noopener noreferrer to links that open a new tab', () => {
    const out = sanitizeHtml('<a href="https://ok.dev" target="_blank">ok</a>');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('keeps allowlisted inline styles and strips url()/expression() values', () => {
    const kept = sanitizeHtml('<p style="color: red">x</p>');
    expect(kept).toContain('color: red');

    const stripped = sanitizeHtml('<p style="background-color: url(javascript:alert(1))">x</p>');
    expect(stripped).not.toContain('url(');
    expect(stripped).not.toContain('javascript');
  });

  it('allows base64 images but rejects data:text/html sources', () => {
    const allowed = sanitizeHtml('<img src="data:image/png;base64,iVBORw0KGgo=" />');
    expect(allowed).toContain('data:image/png;base64');

    const blocked = sanitizeHtml('<img src="data:text/html;base64,PHNjcmlwdD4=" />');
    expect(blocked).not.toContain('data:text/html');
  });

  it('unwraps unknown tags while keeping their text', () => {
    const out = sanitizeHtml('<article><p>keep me</p></article>');
    expect(out).not.toContain('<article');
    expect(out).toContain('<p>keep me</p>');
  });

  it('removes iframe, form and svg blocks entirely', () => {
    const out = sanitizeHtml('<iframe src="https://evil.dev"></iframe><form><input /></form><p>ok</p>');
    expect(out).not.toContain('iframe');
    expect(out).not.toContain('form');
    expect(out).not.toContain('input');
    expect(out).toContain('<p>ok</p>');
  });

  it('preserves spreadsheet data attributes used by saved cells', () => {
    const out = sanitizeHtml('<table><tbody><tr><td data-om-cell="B2">42</td></tr></tbody></table>');
    expect(out).toContain('data-om-cell="B2"');
    expect(out).toContain('42');
  });

  it('returns an empty string for empty input and never throws on garbage', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(() => sanitizeHtml('<p>unclosed')).not.toThrow();
  });
});

describe('plain text helpers', () => {
  it('escapes markup when converting plain text to html', () => {
    expect(plainTextToHtml('<b>hi</b>')).toBe('&lt;b&gt;hi&lt;/b&gt;');
  });

  it('escapes before turning newlines into line breaks', () => {
    expect(plainTextToHtml('a\nb')).toBe('a<br/>b');
  });

  it('round-trips sanitized html back to text', () => {
    expect(htmlToPlainText('<p>hello <strong>world</strong></p>')).toBe('hello world');
  });
});