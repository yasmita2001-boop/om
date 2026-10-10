/**
 * Om-LifeOS Zero-Cost Local Thumbnail & Heavy Media Management
 * Generates lightweight canvas thumbnails locally in the browser.
 * Ensures zero reliance on paid cloud object storage.
 */

export interface StorageBreakdown {
  recordCount: number;
  textBytes: number;
  mediaBytes: number;
  totalBytes: number;
  attachmentCount: number;
  lightweightBytesEstimate: number;
  savingsPercentage: number;
}

/**
 * Generate a lightweight thumbnail from an image File or Base64 DataURL
 * Uses browser HTMLCanvasElement to compress to ~3-10 KB.
 */
export async function generateImageThumbnail(
  source: File | string,
  maxWidth = 160,
  maxHeight = 160,
  quality = 0.65
): Promise<string | undefined> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return undefined;
  }

  return new Promise((resolve) => {
    try {
      let dataUrl: string;

      const processDataUrl = (url: string) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = Math.max(width, 1);
            canvas.height = Math.max(height, 1);
            const ctx = canvas.getContext('2d');

            if (!ctx) {
              resolve(undefined);
              return;
            }

            // Image smoothing for clean crisp thumbnails
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'medium';
            ctx.drawImage(img, 0, 0, width, height);

            const thumb = canvas.toDataURL('image/jpeg', quality);
            resolve(thumb);
          } catch {
            resolve(undefined);
          }
        };

        img.onerror = () => resolve(undefined);
        img.src = url;
      };

      if (typeof source === 'string') {
        if (!source.startsWith('data:image/')) {
          resolve(undefined);
          return;
        }
        processDataUrl(source);
      } else if (source instanceof File) {
        if (!source.type.startsWith('image/')) {
          resolve(undefined);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            processDataUrl(reader.result);
          } else {
            resolve(undefined);
          }
        };
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(source);
      } else {
        resolve(undefined);
      }
    } catch {
      resolve(undefined);
    }
  });
}

/**
 * Format bytes into human readable format (KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Calculate detailed size breakdown across entity records
 */
export function calculatePayloadBreakdown(entities: Record<string, any[]>): StorageBreakdown {
  let recordCount = 0;
  let textBytes = 0;
  let mediaBytes = 0;
  let attachmentCount = 0;

  for (const [storeName, rows] of Object.entries(entities)) {
    if (!Array.isArray(rows)) continue;
    recordCount += rows.length;

    for (const row of rows) {
      if (!row) continue;

      // Check for standalone attachment store records
      if (storeName === 'attachments') {
        attachmentCount++;
        const base64 = row.blobBase64 || '';
        const mediaLen = base64.length;
        mediaBytes += mediaLen;
        // Text part is row without heavy base64
        const textRow = { ...row, blobBase64: undefined };
        textBytes += JSON.stringify(textRow).length;
        continue;
      }

      // Check embedded attachments in notes, journal, things, receipts
      if (Array.isArray(row.attachments)) {
        let rowMediaLen = 0;
        for (const att of row.attachments) {
          if (att && typeof att === 'object') {
            attachmentCount++;
            if (att.dataUrl && typeof att.dataUrl === 'string') {
              rowMediaLen += att.dataUrl.length;
            }
          }
        }
        mediaBytes += rowMediaLen;
        textBytes += Math.max(0, JSON.stringify(row).length - rowMediaLen);
      } else {
        textBytes += JSON.stringify(row).length;
      }
    }
  }

  const totalBytes = textBytes + mediaBytes;
  // Lightweight estimate: all text + small thumbnails (~4KB each for attachments)
  const lightweightBytesEstimate = textBytes + attachmentCount * 4096;
  const savings = totalBytes > 0 ? Math.max(0, Math.round(((totalBytes - lightweightBytesEstimate) / totalBytes) * 100)) : 0;

  return {
    recordCount,
    textBytes,
    mediaBytes,
    totalBytes,
    attachmentCount,
    lightweightBytesEstimate,
    savingsPercentage: savings
  };
}

/**
 * Strict allowlist check for compact preview thumbnails
 * Must be a data URL image (JPEG, WebP, PNG) and strictly <= 45 KB (46,080 chars)
 */
export function isValidCompactThumbnail(thumb: unknown): boolean {
  if (typeof thumb !== 'string') return false;
  if (!thumb.startsWith('data:image/')) return false;
  if (thumb.length > 46080) return false;
  return true;
}

/**
 * Sanitizes entity records for lightweight transfer (thumbnails & metadata only)
 * Original heavy files (dataUrl, blob, blobBase64) are strictly omitted by default.
 * Only verified compact thumbnails and attachment metadata are preserved.
 */
export function createLightweightEntities(
  entities: Record<string, any[]>,
  originDeviceId: string
): { entities: Record<string, any[]>; strippedCount: number; savedBytes: number } {
  const result: Record<string, any[]> = {};
  let strippedCount = 0;
  let savedBytes = 0;

  for (const [storeName, rows] of Object.entries(entities)) {
    if (!Array.isArray(rows)) {
      result[storeName] = [];
      continue;
    }

    if (storeName === 'attachments') {
      result[storeName] = rows.map((row) => {
        const hasMediaPayload = Boolean(row.blobBase64 || row.dataUrl || row.blob);
        const payloadLength = (row.blobBase64?.length || 0) + (row.dataUrl?.length || 0);

        if (hasMediaPayload) {
          strippedCount++;
          savedBytes += payloadLength;
        }

        // Verify and allow only compliant compact thumbnails
        const validThumb = isValidCompactThumbnail(row.thumbnailBase64)
          ? row.thumbnailBase64
          : isValidCompactThumbnail(row.thumbnailUrl)
            ? row.thumbnailUrl
            : undefined;

        return {
          ...row,
          blobBase64: undefined,
          blob: undefined,
          dataUrl: undefined,
          thumbnailBase64: validThumb,
          thumbnailUrl: validThumb,
          hasOriginal: false,
          status: validThumb ? 'thumbnail_available' : 'original_not_transferred',
          isOriginOnly: true,
          originDeviceId,
          originDevice: originDeviceId
        };
      });
      continue;
    }

    result[storeName] = rows.map((row) => {
      if (Array.isArray(row.attachments) && row.attachments.length > 0) {
        const sanitizedAttachments = row.attachments.map((att: any) => {
          if (!att || typeof att !== 'object') return att;

          const hasOriginalData = Boolean(att.dataUrl || att.blobBase64 || att.blob);
          const dataLength = (att.dataUrl?.length || 0) + (att.blobBase64?.length || 0);

          if (hasOriginalData) {
            strippedCount++;
            savedBytes += dataLength;
          }

          const validThumb = isValidCompactThumbnail(att.thumbnailUrl)
            ? att.thumbnailUrl
            : isValidCompactThumbnail(att.thumbnailBase64)
              ? att.thumbnailBase64
              : undefined;

          return {
            ...att,
            dataUrl: undefined,
            blobBase64: undefined,
            blob: undefined,
            thumbnailUrl: validThumb,
            hasOriginal: false,
            status: validThumb ? 'thumbnail_available' : 'original_not_transferred',
            isOriginOnly: true,
            originDeviceId,
            originDevice: originDeviceId
          };
        });
        return {
          ...row,
          attachments: sanitizedAttachments
        };
      }
      return row;
    });
  }

  return { entities: result, strippedCount, savedBytes };
}
