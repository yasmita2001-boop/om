import { describe, expect, it } from 'vitest';
import { createLightweightEntities } from '../thumbnailService';

describe('lightweight attachment export', () => {
  it('removes direct file payloads while retaining file metadata', () => {
    const fileData = 'data:application/pdf;base64,' + 'a'.repeat(2048);
    const result = createLightweightEntities({
      documents: [{
        id: 'document-1',
        fileName: 'contract.pdf',
        fileType: 'application/pdf',
        fileSize: '2 KB',
        fileData
      }]
    }, 'device-1');

    expect(result.entities.documents[0]).toMatchObject({
      id: 'document-1',
      fileName: 'contract.pdf',
      fileType: 'application/pdf',
      fileSize: '2 KB',
      fileData: undefined
    });
    expect(result.strippedCount).toBe(1);
    expect(result.savedBytes).toBe(fileData.length);
  });

  it('keeps records unchanged when no media payload is attached', () => {
    const record = { id: 'document-1', fileName: 'contract.pdf' };
    const result = createLightweightEntities({ documents: [record] }, 'device-1');

    expect(result.entities.documents[0]).toEqual(record);
    expect(result.strippedCount).toBe(0);
    expect(result.savedBytes).toBe(0);
  });
});
