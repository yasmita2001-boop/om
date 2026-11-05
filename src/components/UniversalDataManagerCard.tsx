import { ThemedDateTimeInput } from './ThemedDateTimeInput';
import React, { useState, useEffect, useRef } from 'react';
import {
  Download, Upload, RefreshCw, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp,
  FileText, FileCode, Globe, ShieldCheck, FolderOpen,
  ArrowRight, Database, Calendar, Check
} from 'lucide-react';
import {
  universalDataManager,
  SUPPORTED_EXPORT_FORMATS,
  UniversalExportFormat,
  UniversalValidationResult
} from '../lib/universalDataManager';
import { storage } from '../lib/storage';
import { formatBytes } from '../lib/thumbnailService';
import { ConfirmModal } from './ConfirmModal';
import {
  abortBackupWritable,
  BackupDirectoryHandle,
  chooseBackupDirectory,
  createBackupWritable,
  getSavedBackupDirectory,
  isBackupFolderSelectionSupported,
  saveBackupDirectory,
  writeBackupToWritable
} from '../lib/backupDestination';

interface UniversalDataManagerCardProps {
  profileId: string;
  profileName: string;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  onRefreshData?: () => void;
}

export const UniversalDataManagerCard: React.FC<UniversalDataManagerCardProps> = ({
  profileId,
  profileName,
  onSuccess,
  onError,
  onRefreshData
}) => {
  // Export State
  const [includeFullMedia, setIncludeFullMedia] = useState<boolean>(true);
  const [exportingFormat, setExportingFormat] = useState<UniversalExportFormat | null>(null);
  const [backupDirectory, setBackupDirectory] = useState<BackupDirectoryHandle | null>(null);
  const [isLoadingBackupDirectory, setIsLoadingBackupDirectory] = useState(true);
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'this_month' | 'last_30_days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState<boolean>(false);
  const dateFilterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    getSavedBackupDirectory()
      .then(directory => {
        if (active) setBackupDirectory(directory);
      })
      .catch(error => {
        console.warn('[Backup destination]', error);
        onError?.(`Could not load the saved backup folder: ${error.message || 'Unknown error'}`);
      })
      .finally(() => {
        if (active) setIsLoadingBackupDirectory(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dateFilterDropdownRef.current && !dateFilterDropdownRef.current.contains(event.target as Node)) {
        setIsDateDropdownOpen(false);
      }
    }
    if (isDateDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDateDropdownOpen]);

  // Storage Stats
  const [activeRecordsCount, setActiveRecordsCount] = useState<number>(0);
  const [attachmentCount, setAttachmentCount] = useState<number>(0);
  const [mediaBytes, setMediaBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Import & Validation State
  const [validating, setValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<UniversalValidationResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [conflictStrategy, setConflictStrategy] = useState<'keep_both' | 'keep_local' | 'accept_remote'>('keep_both');
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [showStoreBreakdown, setShowStoreBreakdown] = useState<boolean>(false);
  const [showConfirmRestoreModal, setShowConfirmRestoreModal] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Load storage stats
  const loadStats = async () => {
    try {
      const stats = await storage.calculateProfileStorageStats(profileId);
      setAttachmentCount(stats.attachmentCount || 0);
      setMediaBytes(stats.mediaBytes || 0);
      setTotalBytes(stats.totalBytes || 0);

      const canonical = await universalDataManager.extractCanonicalWorkspaceData({
        profileId,
        includeFullMedia: false
      });
      setActiveRecordsCount(canonical.totalActiveCount);
    } catch (err: any) {
      console.warn('[UniversalDataManager Stats]', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
    const unsub = storage.subscribe(() => {
      loadStats();
    });
    return () => unsub();
  }, [profileId]);

  // Execute Export
  const handleExport = async (format: UniversalExportFormat, saveToFolder = false) => {
    setExportingFormat(format);
    let writable: Awaited<ReturnType<typeof createBackupWritable>> | null = null;
    try {
      let destination = format === 'omlifeos' && saveToFolder ? backupDirectory : null;
      if (format === 'omlifeos' && saveToFolder) {
        if (!isBackupFolderSelectionSupported()) {
          throw new Error('This PWA browser does not support saving to a selected folder. Use “Download .omlifeos” instead.');
        }
        if (!destination) {
          destination = await chooseBackupDirectory();
          if (!destination) return;
          setBackupDirectory(destination);
        }
        writable = await createBackupWritable(destination);
        await saveBackupDirectory(destination);
      }

      const formatDef = SUPPORTED_EXPORT_FORMATS.find(f => f.id === format);
      const res = await universalDataManager.exportUniversalData(format, {
        profileId,
        profileName,
        includeFullMedia,
        customTitle: `${profileName} LifeOS`,
        autoDownload: !saveToFolder,
        dateRangeFilter: {
          mode: dateFilterMode,
          startDate: customStartDate,
          endDate: customEndDate
        }
      });
      if (writable) {
        await writeBackupToWritable(writable, res.blob);
        writable = null;
      }

      const mediaNotice = format === 'omlifeos' && !includeFullMedia ? ' (Without media)' : '';
      const scopeNotice = dateFilterMode !== 'all'
        ? ` [${dateFilterMode === 'this_month' ? 'This Month' : dateFilterMode === 'last_30_days' ? 'Last 30 Days' : 'Custom Range'}]`
        : '';
      const destinationNotice = destination
        ? ` saved to ${destination.name}/Om-LifeOS-Backup.omlifeos`
        : ' downloaded successfully';
      onSuccess?.(`✓ ${formatDef?.name || format}${destinationNotice}${mediaNotice}${scopeNotice}! (${formatBytes(res.sizeBytes)})`);
      await loadStats();
    } catch (err: any) {
      if (writable) await abortBackupWritable(writable);
      if (err?.name === 'AbortError') return;
      onError?.(`Export failed: ${err.message || 'Unknown export error'}`);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleChooseBackupDirectory = async () => {
    try {
      const directory = await chooseBackupDirectory();
      if (!directory) {
        onError?.('No folder was selected. Choose a folder to save backups there.');
        return;
      }
      setBackupDirectory(directory);
      await saveBackupDirectory(directory);
      onSuccess?.(`Backup folder set to "${directory.name}". Future backups update Om-LifeOS-Backup.omlifeos in this folder.`);
    } catch (error: any) {
      const message = error?.name === 'AbortError'
        ? 'Folder selection was cancelled or blocked; no backup folder was selected.'
        : error?.message || 'Unknown error';
      onError?.(`Could not select backup folder: ${message}`);
    }
  };

  // Process selected or dropped file
  const processSelectedFile = async (file: File) => {
    setValidating(true);
    setSelectedFileName(file.name);
    try {
      const result = await universalDataManager.validateImport(file, profileId);
      if (!result.valid) {
        throw new Error(result.error || 'The selected file is not a valid Om-LifeOS format.');
      }
      setValidationResult(result);
    } catch (err: any) {
      onError?.(`Validation failed: ${err.message}`);
      setValidationResult(null);
      setSelectedFileName('');
    } finally {
      setValidating(false);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = '';
      }
    }
  };

  // Handle File Input Change
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processSelectedFile(file);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processSelectedFile(file);
    }
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!validationResult) return;
    setShowConfirmRestoreModal(false);
    setIsRestoring(true);

    try {
      await universalDataManager.exportUniversalData('omlifeos', {
        profileId,
        profileName,
        includeFullMedia: true,
        customTitle: `${profileName}-before-restore`,
        autoDownload: true
      });
      const mode = validationResult.isIncrementalBundle ? 'merge_workspace' : 'replace_workspace';
      const result = await universalDataManager.restoreValidatedData(validationResult, {
        mode,
        conflictStrategy,
        targetProfileId: profileId,
        targetProfileName: profileName
      });

      const ghostInfo = result.blockedGhostCount > 0 ? ` (${result.blockedGhostCount} deleted items blocked)` : '';
      onSuccess?.(`✓ Restored ${result.restoredRecordCount} record(s) into "${profileName}"!${ghostInfo}`);

      setValidationResult(null);
      setSelectedFileName('');
      await loadStats();
      onRefreshData?.();
    } catch (err: any) {
      onError?.(`Restore failed: ${err.message || 'Error writing database records'}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Document & Export Formats list (Word, CSV, HTML)
  const documentFormats = [
    {
      id: 'docx' as UniversalExportFormat,
      name: 'Word Document',
      ext: '.docx',
      icon: FileText,
      iconColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/40'
    },
    {
      id: 'csv' as UniversalExportFormat,
      name: 'Spreadsheet',
      ext: '.csv',
      icon: FileCode,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40'
    },
    {
      id: 'html' as UniversalExportFormat,
      name: 'Web Page',
      ext: '.html',
      icon: Globe,
      iconColor: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/40'
    }
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 space-y-4 min-w-0">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 shrink-0">
            <Database className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Data & Sovereign Backups
              </h2>
              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                100% Offline
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {profileName} • {activeRecordsCount} data records • {formatBytes(totalBytes)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadStats}
          title="Refresh storage statistics"
          className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200 cursor-pointer px-2 py-1 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          <span className="hidden sm:inline">Refresh Stats</span>
        </button>
      </div>

      {/* Hidden File Input for Import */}
      <input
        ref={importFileInputRef}
        type="file"
        accept=".omlifeos,.omupdate,.json"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Section 1: Full Backup & Restore (Balanced Side-by-Side Symmetrical Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {/* Left: Export Full Backup */}
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  Full System Snapshot
                </span>
                <span className="rounded bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-mono shrink-0">
                  .omlifeos
                </span>
              </div>
              {isBackupFolderSelectionSupported() ? (
                <button
                  type="button"
                  onClick={() => handleExport('omlifeos', true)}
                  disabled={exportingFormat !== null || isLoadingBackupDirectory || isLoadingStats}
                  title="Save or update the backup file in your selected folder"
                  className="text-[10px] text-slate-400 font-medium shrink-0 hover:text-amber-700 dark:hover:text-amber-300 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {exportingFormat === 'omlifeos' ? 'Backing up...' : 'Backup'}
                </button>
              ) : (
                <span className="text-[10px] text-slate-400 font-medium shrink-0">Backup</span>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-amber-200/70 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeFullMedia}
                onChange={(e) => setIncludeFullMedia(e.target.checked)}
                className="rounded border-amber-300 text-amber-700 focus:ring-amber-500 dark:border-amber-800 dark:text-amber-400 dark:focus:ring-amber-400 h-3.5 w-3.5"
              />
              <span className="truncate">
                Include media ({attachmentCount} files, {formatBytes(mediaBytes)})
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-end gap-1">
              {isBackupFolderSelectionSupported() && (
                <button
                  type="button"
                  onClick={handleChooseBackupDirectory}
                  disabled={exportingFormat !== null || isLoadingBackupDirectory}
                  title={backupDirectory ? `Selected folder: ${backupDirectory.name}. Click to change.` : 'Choose where backup files are saved'}
                  aria-label={backupDirectory ? `Backup folder: ${backupDirectory.name}. Click to change folder.` : 'Choose backup folder'}
                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <FolderOpen className="h-3 w-3" />
                  <span className="max-w-40 truncate">{backupDirectory ? backupDirectory.name : 'Choose folder'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleExport('omlifeos')}
                disabled={exportingFormat !== null}
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200 disabled:opacity-50 cursor-pointer shrink-0 transition-colors"
              >
                <Download className="h-3 w-3" />
                <span>Download .omlifeos</span>
              </button>
            </div>
          </div>
          {backupDirectory && (
            <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md border border-amber-300/60 bg-amber-50/70 px-2.5 py-1.5 text-xs dark:border-amber-800/60 dark:bg-amber-950/20">
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
              <span className="font-semibold text-slate-700 dark:text-slate-200">Selected folder:</span>
              <span className="min-w-0 break-all font-medium text-amber-800 dark:text-amber-200">{backupDirectory.name}</span>
              <span className="text-slate-500 dark:text-slate-400">· Backup updates Om-LifeOS-Backup.omlifeos here.</span>
            </div>
          )}
        </div>

        {/* Right: Import & Restore Backup */}
        {!validationResult ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !validating && !isRestoring && importFileInputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-4 transition-all cursor-pointer flex flex-col justify-between ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/30 dark:border-indigo-400 dark:bg-indigo-950/30'
                : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:border-indigo-500/60 dark:hover:bg-slate-800/30'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Upload className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    Restore Backup
                  </span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-mono shrink-0">
                    Import
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium shrink-0">.omlifeos / .json</span>
              </div>
              {validating && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  Verifying file checksum & integrity...
                </p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Target: {profileName}
              </span>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200 cursor-pointer shrink-0 transition-colors"
              >
                {validating ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin text-indigo-600" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3" />
                    <span>Choose Backup File</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-indigo-200 bg-white p-4 dark:border-indigo-800/80 dark:bg-slate-900 shadow-xs flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">
                      {selectedFileName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {validationResult.formatDetected.toUpperCase()} • {
                        validationResult.checksumStatus === 'verified'
                          ? 'Checksum verified'
                          : validationResult.checksumStatus === 'mismatch'
                            ? 'Checksum mismatch'
                            : 'No checksum provided'
                      }
                    </span>
                  </div>
                </div>

                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 shrink-0">
                  {validationResult.totalActiveRecords} records
                </span>
              </div>

              {validationResult.warnings && validationResult.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2 text-[10px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300 space-y-0.5">
                  {validationResult.warnings.map((w, idx) => (
                    <div key={idx} className="flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {validationResult.isIncrementalBundle && (
                <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg space-y-1 border border-slate-200/80 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block">
                    Conflict Strategy:
                  </span>
                  <div className="flex gap-3">
                    {[
                      { id: 'keep_both', label: 'Keep Both' },
                      { id: 'accept_remote', label: 'Overwrite Local' },
                      { id: 'keep_local', label: 'Keep Local' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setConflictStrategy(opt.id as any)}
                        className={`border-b-0 border-transparent px-2 py-0.5 text-[11px] cursor-pointer transition-colors ${
                          conflictStrategy === opt.id
                            ? 'border-amber-500 text-amber-700 font-bold dark:text-amber-400'
                            : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!validationResult.isIncrementalBundle && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[10px] text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
                  Full backup restore replaces workspace records not included in the backup. A before-restore backup is downloaded automatically, but confirm the target profile carefully.
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setShowStoreBreakdown(!showStoreBreakdown)}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {showStoreBreakdown ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span>{showStoreBreakdown ? 'Hide details' : 'Show breakdown'}</span>
                </button>

                {showStoreBreakdown && (
                  <div className="mt-1.5 grid grid-cols-2 gap-1 text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/60 max-h-28 overflow-y-auto">
                    {Object.entries(validationResult.storeBreakdown).map(([store, count]) => (
                      <div key={store} className="flex justify-between items-center px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-[10px]">
                        <span className="text-slate-600 dark:text-slate-300 truncate">{store}</span>
                        <span className="font-bold text-slate-900 dark:text-white shrink-0 ml-1">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Target: {profileName}
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setValidationResult(null);
                    setSelectedFileName('');
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmRestoreModal(true)}
                  disabled={isRestoring || !validationResult.isRestorable}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200 disabled:opacity-50 cursor-pointer"
                  title={!validationResult.isRestorable ? 'Restore is blocked because the checksum does not match.' : undefined}
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>Restoring...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-3 w-3" />
                      <span>Restore Backup</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Document & Table Exports */}
      <div className="space-y-2.5 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
              Document & Table Exports
            </span>
            {dateFilterMode !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                <span>Scope:</span>
                <span>
                  {dateFilterMode === 'this_month'
                    ? 'This Month'
                    : dateFilterMode === 'last_30_days'
                    ? 'Last 30 Days'
                    : customStartDate || customEndDate
                    ? `${customStartDate || 'Start'} to ${customEndDate || 'Now'}`
                    : 'Custom Range'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDateFilterMode('all');
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="hover:text-rose-500 cursor-pointer ml-0.5 text-xs"
                  title="Reset scope to All Time"
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          {/* Date Filter Dropdown Menu (Suitable & clean placement) */}
          <div className="relative" ref={dateFilterDropdownRef}>
            <button
              type="button"
              onClick={() => setIsDateDropdownOpen(prev => !prev)}
              className={`flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium cursor-pointer transition-colors ${
                isDateDropdownOpen || dateFilterMode !== 'all'
                  ? 'font-semibold text-amber-700 dark:text-amber-300'
                  : 'text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
              }`}
              title="Filter export data by date range"
            >
              <Calendar className="h-3 w-3 shrink-0" />
              <span className="text-[11px]">Date Filter:</span>
              <span className="text-[11px] font-semibold">
                {dateFilterMode === 'all'
                  ? 'All Time'
                  : dateFilterMode === 'this_month'
                  ? 'This Month'
                  : dateFilterMode === 'last_30_days'
                  ? 'Last 30 Days'
                  : 'Custom Range'}
              </span>
              <ChevronDown className={`h-3 w-3 transition-transform ${isDateDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDateDropdownOpen && (
              <div className="sanctuary-menu-surface absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-60 max-w-[calc(100vw-2.5rem)] z-30 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in duration-100">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Export Date Scope
                </div>
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => { setDateFilterMode('all'); setIsDateDropdownOpen(false); }}
                    className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      dateFilterMode === 'all'
                        ? 'text-amber-700 dark:text-amber-300 font-semibold'
                        : 'text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                    }`}
                  >
                    <span>All Time (Complete Data)</span>
                    {dateFilterMode === 'all' && <Check className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDateFilterMode('this_month'); setIsDateDropdownOpen(false); }}
                    className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      dateFilterMode === 'this_month'
                        ? 'text-amber-700 dark:text-amber-300 font-semibold'
                        : 'text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                    }`}
                  >
                    <span>This Month</span>
                    {dateFilterMode === 'this_month' && <Check className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDateFilterMode('last_30_days'); setIsDateDropdownOpen(false); }}
                    className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      dateFilterMode === 'last_30_days'
                        ? 'text-amber-700 dark:text-amber-300 font-semibold'
                        : 'text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                    }`}
                  >
                    <span>Last 30 Days</span>
                    {dateFilterMode === 'last_30_days' && <Check className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDateFilterMode('custom'); }}
                    className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      dateFilterMode === 'custom'
                        ? 'text-amber-700 dark:text-amber-300 font-semibold'
                        : 'text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
                    }`}
                  >
                    <span>Custom Range</span>
                    {dateFilterMode === 'custom' && <Check className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />}
                  </button>
                </div>

                {/* Custom Range Inputs */}
                {dateFilterMode === 'custom' && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 px-1">
                      Custom Date Span:
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="w-10 text-slate-400 shrink-0">From:</span>
                        <ThemedDateTimeInput
                          type="date"
                          value={customStartDate}
                          onChange={e => setCustomStartDate(e.target.value)}
                          className="flex-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="w-10 text-slate-400 shrink-0">To:</span>
                        <ThemedDateTimeInput
                          type="date"
                          value={customEndDate}
                          onChange={e => setCustomEndDate(e.target.value)}
                          className="flex-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    {(customStartDate || customEndDate) && (
                      <div className="flex justify-end pt-0.5">
                        <button
                          type="button"
                          onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                          className="text-[10px] font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 cursor-pointer"
                        >
                          Clear Dates
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {documentFormats.map((fmt) => {
            const IconComponent = fmt.icon;
            const isCurrentExporting = exportingFormat === fmt.id;
            return (
              <div
                key={fmt.id}
                className="rounded-xl border-2 border-dashed border-slate-200 p-3.5 dark:border-slate-800 flex flex-col justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${fmt.bgColor} ${fmt.iconColor} shrink-0`}>
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {fmt.name}
                      </span>
                      <span className="font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                        {fmt.ext}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleExport(fmt.id)}
                  disabled={exportingFormat !== null}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200 cursor-pointer transition-colors disabled:opacity-40"
                >
                  {isCurrentExporting ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin text-indigo-600 dark:text-indigo-400" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3 w-3" />
                      <span>Export {fmt.ext}</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal for Restore */}
      <ConfirmModal
        isOpen={showConfirmRestoreModal}
        title="Restore Backup"
        message={`Restore ${validationResult?.totalActiveRecords} records into "${profileName}"? Om-LifeOS will download a before-restore safety backup automatically.`}
        confirmText="Restore Now"
        cancelText="Cancel"
        isDanger={false}
        onConfirm={handleExecuteRestore}
        onCancel={() => setShowConfirmRestoreModal(false)}
      />
    </div>
  );
};
