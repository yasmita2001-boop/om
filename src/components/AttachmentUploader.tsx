import React, { useRef, useState, useEffect } from 'react';
import { Paperclip, X, Download, FileText, HardDrive, Upload, AlertCircle } from 'lucide-react';
import { generateImageThumbnail } from '../lib/thumbnailService';
import { generateVideoThumbnail } from '../lib/attachmentService';
import { storage } from '../lib/storage';

export interface StoredAttachmentMeta {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string; // base64 or blob URL for images & downloads
  thumbnailUrl?: string; // lightweight compressed thumbnail for zero-cloud preview
  isOriginOnly?: boolean; // true if full media remained on originating device
  originDevice?: string; // name or id of originating device
}

export const isAttachmentSizeAllowed = (file: Pick<File, 'size'>, maxSizeMB: number): boolean =>
  file.size <= maxSizeMB * 1024 * 1024;

export const isLegacyDataUrl = (val?: string): boolean => !!val && val.startsWith('data:');
export const isBlobRef = (val?: string): boolean => !!val && !val.startsWith('data:') && /^[0-9a-f-]{36}$/i.test(val);

export function useBlobUrl(ref?: string): string {
  const [url, setUrl] = useState<string>(ref && isLegacyDataUrl(ref) ? ref : '');
  useEffect(() => {
    if (!ref) { setUrl(''); return; }
    if (isLegacyDataUrl(ref)) { setUrl(ref); return; }
    if (isBlobRef(ref)) {
      let revoked = false;
      let createdUrl: string | null = null;
      storage.getBlob(ref).then(blob => {
        if (revoked || !blob) return;
        createdUrl = URL.createObjectURL(blob.data);
        setUrl(createdUrl);
      }).catch(error => {
        if (!revoked) console.error('Could not load attachment preview.', error);
      });
      return () => {
        revoked = true;
        if (createdUrl) URL.revokeObjectURL(createdUrl);
      };
    }
    setUrl(ref);
  }, [ref]);
  return url;
}

const BlobDownloadLink: React.FC<{
  dataUrl?: string; fileName: string; children: React.ReactNode; className?: string; title?: string;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ dataUrl, fileName, children, className, title, onClick }) => {
  const handleClick = async (e: React.MouseEvent) => {
    if (onClick) onClick(e);
    if (!dataUrl) return;
    if (isLegacyDataUrl(dataUrl)) return; // let the native <a> handle it
    if (isBlobRef(dataUrl)) {
      e.preventDefault();
      const blob = await storage.getBlob(dataUrl);
      if (!blob) return;
      const url = URL.createObjectURL(blob.data);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    }
  };
  const href = dataUrl && isLegacyDataUrl(dataUrl) ? dataUrl : '#';
  return (
    <a href={href} download={fileName} onClick={handleClick} className={className} title={title}>
      {children}
    </a>
  );
};

interface AttachmentUploaderProps {
  attachments: StoredAttachmentMeta[];
  onChange: (attachments: StoredAttachmentMeta[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  className?: string;
  label?: string;
}

export const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  attachments,
  onChange,
  maxFiles = 25,
  maxSizeMB = 10,
  className = '',
  label = 'Attach Files (Images, PDF, Docs)'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFiles = async (files: FileList) => {
    const newItems: StoredAttachmentMeta[] = [...attachments];

    for (let i = 0; i < files.length; i++) {
      if (newItems.length >= maxFiles) break;
      const file = files[i];

      if (!isAttachmentSizeAllowed(file, maxSizeMB)) {
        setUploadError(`File "${file.name}" exceeds the ${maxSizeMB}MB per-file limit.`);
        continue;
      }

      let blobId: string;
      try {
        blobId = await storage.saveBlob(file);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : `Could not save "${file.name}".`);
        continue;
      }

      let thumbnailUrl: string | undefined;
      if (file.type.startsWith('image/')) {
        try {
          const tempDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
          thumbnailUrl = await generateImageThumbnail(tempDataUrl, 160, 160, 0.65);
        } catch {}
      } else if (file.type.startsWith('video/')) {
        try {
          thumbnailUrl = await generateVideoThumbnail(file, 160, 160);
        } catch {}
      }

      newItems.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: blobId,
        thumbnailUrl,
        isOriginOnly: false,
      });
    }

    onChange(newItems);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadError(null);
    try {
      await processFiles(files);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    setUploadError(null);
    try {
      await processFiles(files);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not process dropped files.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleReplaceOriginFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !replacingId) return;

    const file = files[0];
    if (!isAttachmentSizeAllowed(file, maxSizeMB)) {
      setUploadError(`File "${file.name}" exceeds the ${maxSizeMB}MB per-file limit.`);
      setReplacingId(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
      return;
    }

    let blobId: string;
    try {
      blobId = await storage.saveBlob(file);
    } catch (error) {
      console.error('Could not read the replacement attachment.', error);
      setUploadError(`Could not read "${file.name}". Please try another file.`);
      setReplacingId(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
      return;
    }

    const oldAtt = attachments.find(a => a.id === replacingId);
    if (oldAtt?.dataUrl && isBlobRef(oldAtt.dataUrl)) {
      storage.deleteBlob(oldAtt.dataUrl).catch(() => {});
    }

    let thumbnailUrl: string | undefined;
    if (file.type.startsWith('image/')) {
      try {
        const tempDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        thumbnailUrl = await generateImageThumbnail(tempDataUrl, 160, 160, 0.65);
      } catch {}
    } else if (file.type.startsWith('video/')) {
      try {
        thumbnailUrl = await generateVideoThumbnail(file, 160, 160);
      } catch {}
    }

    onChange(
      attachments.map(att =>
        att.id === replacingId
          ? {
              ...att,
              name: file.name,
              type: file.type,
              size: file.size,
              dataUrl: blobId,
              thumbnailUrl: thumbnailUrl || att.thumbnailUrl,
              isOriginOnly: false
            }
          : att
      )
    );

    setReplacingId(null);
    if (replaceInputRef.current) replaceInputRef.current.value = '';
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(attachments.filter(a => a.id !== id));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes < 1024 * 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          {label}
        </label>
        {attachments.length > 0 && (
          <span className="text-[10px] text-slate-400 font-mono">
            {attachments.length}/{maxFiles}
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.zip"
      />

      <input
        ref={replaceInputRef}
        type="file"
        onChange={handleReplaceOriginFile}
        className="hidden"
        accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.zip"
      />

      {uploadError && (
        <div className="flex items-start gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="flex-1">{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} className="ml-1 shrink-0 text-rose-400 hover:text-rose-600">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div
        className={`mt-1 relative rounded-xl transition-colors ${isDragging ? 'ring-2 ring-indigo-500 border-indigo-400' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/60">
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Drop files here</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => { setUploadError(null); fileInputRef.current?.click(); }}
          disabled={attachments.length >= maxFiles}
          className="sanctuary-upload-control flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 cursor-pointer transition-colors disabled:opacity-50"
        >
          <Paperclip className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          <span>{attachments.length > 0 ? `+ Add File (${attachments.length}/${maxFiles})` : 'Choose or Drop Files'}</span>
        </button>
      </div>

      {/* Attachment previews / badge pills */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {attachments.map(att => {
            const displayImg = att.thumbnailUrl || (att.type.startsWith('image/') ? att.dataUrl : undefined);
            const isOriginOnly = att.isOriginOnly || (!att.dataUrl && !!att.thumbnailUrl);

            return (
              <div
                key={att.id}
                className="group relative flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-800/90 p-1.5 pr-2 text-xs max-w-xs transition-all shadow-2xs"
              >
                {displayImg ? (
                  <img
                    src={displayImg}
                    alt={att.name}
                    className="h-8 w-8 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] truncate max-w-[130px]">
                    {att.name}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-400 font-mono">
                      {formatFileSize(att.size)}
                    </span>
                    {isOriginOnly && (
                      <span
                        title="Transferred in lightweight mode without heavy media. Media stored on originating device."
                        className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                      >
                        <HardDrive className="h-2 w-2" />
                        Origin device
                      </span>
                    )}
                  </div>
                </div>

                {isOriginOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      setReplacingId(att.id);
                      replaceInputRef.current?.click();
                    }}
                    title="Attach full local file to restore high-resolution media"
                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Upload className="h-3 w-3" />
                  </button>
                )}

                {att.dataUrl && (
                  <BlobDownloadLink
                    dataUrl={att.dataUrl}
                    fileName={att.name}
                    onClick={e => e.stopPropagation()}
                    title="Download attached file"
                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Download className="h-3 w-3" />
                  </BlobDownloadLink>
                )}

                <button
                  type="button"
                  onClick={e => handleRemove(att.id, e)}
                  title="Remove attachment"
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const AttachmentViewer: React.FC<{
  attachments?: (string | StoredAttachmentMeta)[];
  className?: string;
  compact?: boolean;
}> = ({ attachments, className = '', compact = false }) => {
  if (!attachments || attachments.length === 0) return null;

  const parsedAttachments: StoredAttachmentMeta[] = attachments
    .map(att => {
      if (typeof att === 'string') {
        try {
          return JSON.parse(att);
        } catch {
          return { id: att, name: att, type: 'file', size: 0 };
        }
      }
      return att;
    })
    .filter(Boolean);

  if (parsedAttachments.length === 0) return null;

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          <Paperclip className="h-3 w-3 text-indigo-500" />
          <span>{parsedAttachments.length} {parsedAttachments.length === 1 ? 'file' : 'files'}:</span>
        </span>
        {parsedAttachments.map(att => {
          const displayImg = att.thumbnailUrl || (att.type?.startsWith('image/') ? att.dataUrl : undefined);
          const isOriginOnly = att.isOriginOnly || (!att.dataUrl && !!att.thumbnailUrl);

          return (
            <span
              key={att.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-2xs dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200 max-w-[150px]"
            >
              {displayImg ? (
                <img
                  src={displayImg}
                  alt={att.name}
                  className="h-3.5 w-3.5 rounded object-cover shrink-0"
                />
              ) : (
                <FileText className="h-3 w-3 text-indigo-500 shrink-0" />
              )}
              <span className="truncate">{att.name}</span>
              {isOriginOnly && (
                <span
                  title="Media stored on originating device (transferred in lightweight mode)"
                  className="inline-flex items-center text-amber-600 dark:text-amber-400"
                >
                  <HardDrive className="h-2.5 w-2.5" />
                </span>
              )}
              {att.dataUrl && (
                <BlobDownloadLink
                  dataUrl={att.dataUrl}
                  fileName={att.name}
                  onClick={e => e.stopPropagation()}
                  title={`Download ${att.name}`}
                  className="p-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                >
                  <Download className="h-2.5 w-2.5" />
                </BlobDownloadLink>
              )}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
        <Paperclip className="h-3 w-3 text-indigo-500" />
        <span>Attached Files ({parsedAttachments.length})</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {parsedAttachments.map(att => {
          const displayImg = att.thumbnailUrl || (att.type?.startsWith('image/') ? att.dataUrl : undefined);
          const isOriginOnly = att.isOriginOnly || (!att.dataUrl && !!att.thumbnailUrl);

          return (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pr-2.5 text-xs shadow-2xs dark:border-slate-800 dark:bg-slate-800"
            >
              {displayImg ? (
                att.dataUrl ? (
                  <BlobDownloadLink
                    dataUrl={att.dataUrl}
                    fileName={att.name}
                    className="block shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <img
                      src={displayImg}
                      alt={att.name}
                      className="h-8 w-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 hover:opacity-90 transition-opacity"
                    />
                  </BlobDownloadLink>
                ) : (
                  <img
                    src={displayImg}
                    alt={att.name}
                    title="Thumbnail preview (lightweight mode)"
                    className="h-8 w-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                )
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
              )}

              <div className="min-w-0 pr-1">
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] truncate max-w-[130px]">
                  {att.name}
                </div>
                <div className="flex items-center gap-1.5">
                  {att.size > 0 && (
                    <span className="text-[9px] text-slate-400 font-mono">
                      {att.size < 1024 * 1024
                        ? `${(att.size / 1024).toFixed(0)} KB`
                        : `${(att.size / (1024 * 1024)).toFixed(1)} MB`}
                    </span>
                  )}
                  {isOriginOnly && (
                    <span
                      title="Media stored on originating device"
                      className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    >
                      <HardDrive className="h-2 w-2" />
                      Origin device
                    </span>
                  )}
                </div>
              </div>

              {att.dataUrl ? (
                <BlobDownloadLink
                  dataUrl={att.dataUrl}
                  fileName={att.name}
                  onClick={e => e.stopPropagation()}
                  title={`Download ${att.name}`}
                  className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                </BlobDownloadLink>
              ) : isOriginOnly ? (
                <span
                  title="Full media file is stored on the originating device to save local storage & bandwidth"
                  className="p-1 text-amber-500 cursor-help"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
