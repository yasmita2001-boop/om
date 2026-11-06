import { describe, expect, it } from 'vitest';
import { isAttachmentSizeAllowed } from '../AttachmentUploader';

describe('isAttachmentSizeAllowed', () => {
  it('enforces the configured limit for replacement files', () => {
    expect(isAttachmentSizeAllowed({ size: 7 }, 0.000001)).toBe(false);
    expect(isAttachmentSizeAllowed({ size: 1 }, 0.000001)).toBe(true);
  });
});