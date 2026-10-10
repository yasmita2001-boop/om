/**
 * Om-LifeOS Attachment & Thumbnail Service
 * Compact client-side thumbnail generation, file metadata extraction,
 * and offline file status management without heavy full-resolution duplication.
 */

export type AttachmentTransferStatus =
  | 'thumbnail_available'
  | 'original_available'
  | 'original_not_transferred'
  | 'ready_for_transfer'
  | 'transfer_in_progress'
  | 'transfer_failed'
  | 'original_unavailable';

export interface StoredAttachmentMeta {
  id: string;
  name: string;
  type: string;
  size: number;
  thumbnailUrl?: string; // Compact base64 image/preview (< 45KB)
  dataUrl?: string;      // Full original dataURL (only stored locally when available)
  status: AttachmentTransferStatus;
  hasOriginal: boolean;
  originDeviceId?: string;
  checksum?: string;
  createdAt: number;
}

// Generate compact thumbnail for images using Canvas
export async function generateImageThumbnail(
  file: File | Blob,
  maxWidth = 160,
  maxHeight = 160,
  quality = 0.75
): Promise<string | undefined> {
  try {
    if (typeof window === 'undefined') return undefined;

    return await new Promise<string | undefined>((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
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
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(undefined);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(img, 0, 0, width, height);

        // Export as compressed WebP or JPEG thumbnail
        let thumbUrl = '';
        try {
          thumbUrl = canvas.toDataURL('image/webp', quality);
        } catch {
          thumbUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(thumbUrl);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(undefined);
      };

      img.src = objectUrl;
    });
  } catch {
    return undefined;
  }
}

// Generate compact thumbnail for video files using HTML5 Video + Canvas
export async function generateVideoThumbnail(
  file: File | Blob,
  maxWidth = 160,
  maxHeight = 160
): Promise<string | undefined> {
  try {
    if (typeof window === 'undefined') return undefined;

    return await new Promise<string | undefined>((resolve) => {
      const video = document.createElement('video');
      const objectUrl = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          URL.revokeObjectURL(objectUrl);
          resolve(undefined);
        }
      }, 4000);

      video.onloadeddata = () => {
        video.currentTime = Math.min(1.0, video.duration ? video.duration / 2 : 1.0);
      };

      video.onseeked = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);

        try {
          let width = video.videoWidth || 160;
          let height = video.videoHeight || 120;

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
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const thumbUrl = canvas.toDataURL('image/jpeg', 0.7);
            URL.revokeObjectURL(objectUrl);
            resolve(thumbUrl);
            return;
          }
        } catch {}
        URL.revokeObjectURL(objectUrl);
        resolve(undefined);
      };

      video.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          URL.revokeObjectURL(objectUrl);
          resolve(undefined);
        }
      };

      video.src = objectUrl;
    });
  } catch {
    return undefined;
  }
}

// Universal thumbnail generator
export async function generateThumbnail(file: File | Blob, type: string): Promise<string | undefined> {
  if (type.startsWith('image/')) {
    return generateImageThumbnail(file);
  }
  if (type.startsWith('video/')) {
    return generateVideoThumbnail(file);
  }
  return undefined;
}

// Convert a File to a complete StoredAttachmentMeta with thumbnail and original
export async function processFileForAttachment(
  file: File,
  originDeviceId: string
): Promise<StoredAttachmentMeta> {
  const thumbnail = await generateThumbnail(file, file.type);

  // Read full original dataURL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    thumbnailUrl: thumbnail,
    dataUrl,
    status: 'original_available',
    hasOriginal: true,
    originDeviceId,
    createdAt: Date.now()
  };
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
