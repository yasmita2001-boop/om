import { describe, expect, it, vi } from 'vitest';

vi.mock('../storage', () => ({ storage: {} }));

import { DB_VERSION } from '../db';
import { calculateChecksum, universalDataManager } from '../universalDataManager';

describe('universal backup validation', () => {
  it('validates a checksummed backup without changing stored monetary values', async () => {
    const data = {
      finance: [{
        id: 'transaction-1',
        type: 'expense',
        amount: 1250.75,
        date: '2026-11-03',
        profileId: 'source-profile'
      }],
      financeAccounts: [{
        id: 'account-1',
        name: 'Cash',
        balance: 9876.5,
        openingBalance: 9876.5,
        profileId: 'source-profile'
      }]
    };
    const backup = {
      app: 'Om-LifeOS',
      version: '5.0.0',
      schemaVersion: DB_VERSION,
      format: 'om-lifeos-universal-v1',
      exportedAt: '2026-11-03T00:00:00.000Z',
      workspaceId: 'source-profile',
      workspaceName: 'Test',
      checksum: calculateChecksum(JSON.stringify(data)),
      recordCount: 2,
      storesCount: 2,
      purgedGhostCount: 0,
      includesAttachments: true,
      summary: { finance: 1, financeAccounts: 1 },
      data
    };

    const validation = await universalDataManager.validateImport(JSON.stringify(backup));

    expect(validation.valid).toBe(true);
    expect(validation.checksumStatus).toBe('verified');
    expect(validation.cleanData.finance[0].amount).toBe(1250.75);
    expect(validation.cleanData.financeAccounts[0].balance).toBe(9876.5);
  });

  it('reports a checksum mismatch instead of treating altered backup data as verified', async () => {
    const data = { finance: [{ id: 'transaction-1', amount: 100 }] };
    const backup = {
      app: 'Om-LifeOS',
      version: '5.0.0',
      format: 'om-lifeos-universal-v1',
      checksum: calculateChecksum(JSON.stringify(data)),
      data: { finance: [{ id: 'transaction-1', amount: 200 }] }
    };

    const validation = await universalDataManager.validateImport(JSON.stringify(backup));

    expect(validation.valid).toBe(true);
    expect(validation.checksumStatus).toBe('mismatch');
    expect(validation.isRestorable).toBe(false);
    expect(validation.warnings).toContain(
      'Checksum verification warning: payload content hash differed from header.'
    );
    expect(validation.cleanData.finance[0].amount).toBe(200);
    await expect(universalDataManager.restoreValidatedData(validation, {
      mode: 'replace_workspace',
      targetProfileId: 'target-profile',
      targetProfileName: 'Test'
    })).rejects.toThrow('checksum does not match');
  });

  it('preserves original attachment data in a full backup validation', async () => {
    const data = {
      documents: [{
        id: 'document-1',
        fileName: 'contract.pdf',
        fileData: 'data:application/pdf;base64,JVBERi0=',
        profileId: 'source-profile'
      }],
      attachments: [{
        id: 'attachment-1',
        name: 'photo.png',
        dataUrl: 'data:image/png;base64,aGVsbG8=',
        hasOriginal: true,
        profileId: 'source-profile'
      }]
    };
    const backup = {
      app: 'Om-LifeOS',
      format: 'om-lifeos-universal-v1',
      checksum: calculateChecksum(JSON.stringify(data)),
      includesAttachments: true,
      data
    };

    const validation = await universalDataManager.validateImport(JSON.stringify(backup));

    expect(validation.valid).toBe(true);
    expect(validation.isRestorable).toBe(true);
    expect(validation.checksumStatus).toBe('verified');
    expect(validation.cleanData.documents[0].fileData).toBe(data.documents[0].fileData);
    expect(validation.cleanData.attachments[0].dataUrl).toBe(data.attachments[0].dataUrl);
  });
});
