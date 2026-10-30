import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateCompleteStandaloneHtml } from '../exportHtml';

describe('generateCompleteStandaloneHtml', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses inline theme-accent icons instead of emoji decorations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['watermark'])
    }));

    const html = await generateCompleteStandaloneHtml({});

    expect(html).toContain('<svg class="ui-icon"');
    expect(html).toContain('color: var(--accent)');
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});
