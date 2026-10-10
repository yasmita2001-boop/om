import React, { useRef, useState } from 'react';
import { Paperclip, File, X, Download, FileText, HardDrive, Upload, AlertCircle, Video } from 'lucide-react';
import { generateImageThumbnail } from '../lib/thumbnailService';
import { generateVideoThumbnail } from '../lib/attachmentService';

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
  maxSizeMB = 500,
  className = '',
  label = 'Attach Files (Images, PDF, Docs)'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: StoredAttachmentMeta[] = [...attachments];

    for (let i = 0; i < files.length; i++) {
      if (newItems.length >= maxFiles) break;
      const file = files[i];

      if (file.size > maxSizeMB * 1024 * 1024) {
        alert(`File "${file.name}" exceeds the ${maxSizeMB}MB per-file limit.`);
        continue;
      }

      // Convert to base64 DataURL for offline persistent storage in note/journal
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      // Generate lightweight zero-cost local thumbnail
      let thumbnailUrl: string | undefined;
      if (file.type.startsWith('image/')) {
        try {
          thumbnailUrl = await generateImageThumbnail(dataUrl, 160, 160, 0.65);
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
        dataUrl,
        thumbnailUrl: thumbnailUrl || (file.type.startsWith('image/') ? dataUrl : undefined),
        isOriginOnly: false,
      });
    }

    onChange(newItems);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReplaceOriginFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !replacingId) return;

    const file = files[0];
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    let thumbnailUrl: string | undefined;
    if (file.type.startsWith('image/')) {
      try {
        thumbnailUrl = await generateImageThumbnail(dataUrl, 160, 160, 0.65);
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
              dataUrl,
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

      <div className="mt-1">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={attachments.length >= maxFiles}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer transition-colors disabled:opacity-50"
        >
          <Paperclip className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          <span>{attachments.length > 0 ? `+ Add File (${attachments.length}/${maxFiles})` : 'Choose File'}</span>
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
                        className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
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
                  <a
                    href={att.dataUrl}
                    download={att.name}
                    onClick={e => e.stopPropagation()}
                    title="Download attached file"
                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Download className="h-3 w-3" />
                  </a>
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
                <a
                  href={att.dataUrl}
                  download={att.name}
                  onClick={e => e.stopPropagation()}
                  title={`Download ${att.name}`}
                  className="p-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                >
                  <Download className="h-2.5 w-2.5" />
                </a>
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
                  <a
                    href={att.dataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <img
                      src={displayImg}
                      alt={att.name}
                      className="h-8 w-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 hover:opacity-90 transition-opacity"
                    />
                  </a>
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
                      className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    >
                      <HardDrive className="h-2 w-2" />
                      Origin device
                    </span>
                  )}
                </div>
              </div>

              {att.dataUrl ? (
                <a
                  href={att.dataUrl}
                  download={att.name}
                  onClick={e => e.stopPropagation()}
                  title={`Download ${att.name}`}
                  className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
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
