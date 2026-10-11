import React, { useState, useEffect, useRef } from 'react';
import {
  Download, Upload, RefreshCw, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp,
  FileText, FileCode, Globe, ShieldCheck,
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
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'this_month' | 'last_30_days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState<boolean>(false);
  const dateFilterDropdownRef = useRef<HTMLDivElement>(null);

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
  const [activeStoresCount, setActiveStoresCount] = useState<number>(0);
  const [attachmentCount, setAttachmentCount] = useState<number>(0);
  const [mediaBytes, setMediaBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);

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
      setActiveStoresCount(canonical.activeStoresCount);
    } catch (err: any) {
      console.warn('[UniversalDataManager Stats]', err);
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
  const handleExport = async (format: UniversalExportFormat) => {
    setExportingFormat(format);
    try {
      const formatDef = SUPPORTED_EXPORT_FORMATS.find(f => f.id === format);
      const res = await universalDataManager.exportUniversalData(format, {
        profileId,
        profileName,
        includeFullMedia,
        customTitle: `${profileName} LifeOS`,
        dateRangeFilter: {
          mode: dateFilterMode,
          startDate: customStartDate,
          endDate: customEndDate
        }
      });

      const mediaNotice = format === 'omlifeos' && !includeFullMedia ? ' (Without media)' : '';
      const scopeNotice = dateFilterMode !== 'all'
        ? ` [${dateFilterMode === 'this_month' ? 'This Month' : dateFilterMode === 'last_30_days' ? 'Last 30 Days' : 'Custom Range'}]`
        : '';
      onSuccess?.(`✓ ${formatDef?.name || format} downloaded successfully${mediaNotice}${scopeNotice}! (${formatBytes(res.sizeBytes)})`);
      await loadStats();
    } catch (err: any) {
      onError?.(`Export failed: ${err.message || 'Unknown export error'}`);
    } finally {
      setExportingFormat(null);
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
      const mode = validationResult.isIncrementalBundle ? 'merge_workspace' : 'replace_workspace';
      const result = await universalDataManager.restoreValidatedData(validationResult, {
        mode,
        conflictStrategy,
        targetProfileId: profileId,
        targetProfileName: profileName
      });

      try {
        sessionStorage.setItem('om_session_unlocked', profileId);
        localStorage.setItem('om_unlocked_profile', profileId);
      } catch {}

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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4 min-w-0">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 shrink-0">
            <Database className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Workspace Data & Backups
              </h2>
              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                100% Offline
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {profileName} • {activeRecordsCount} records • {formatBytes(totalBytes)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadStats}
          title="Refresh storage statistics"
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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

      {/* Section 1: Full Workspace Backup & Restore (Balanced Side-by-Side Symmetrical Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {/* Left: Export Full Backup */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  Full Workspace Snapshot
                </span>
                <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-mono shrink-0">
                  .omlifeos
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium shrink-0">Backup</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeFullMedia}
                onChange={(e) => setIncludeFullMedia(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 h-3.5 w-3.5"
              />
              <span className="truncate">
                Include media ({attachmentCount} files, {formatBytes(mediaBytes)})
              </span>
            </label>

            <button
              type="button"
              onClick={() => handleExport('omlifeos')}
              disabled={exportingFormat !== null}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500 disabled:opacity-50 cursor-pointer shrink-0 transition-all active:scale-98"
            >
              {exportingFormat === 'omlifeos' ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Backing up...</span>
                </>
              ) : (
                <>
                  <Download className="h-3 w-3" />
                  <span>Download .omlifeos</span>
                </>
              )}
            </button>
          </div>
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
                    Restore Workspace
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
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer shrink-0 transition-all"
              >
                {validating ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin text-indigo-600" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3 text-slate-500" />
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
                      {validationResult.formatDetected.toUpperCase()} • Checksum verified
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
                  <div className="flex gap-1.5">
                    {[
                      { id: 'keep_both', label: 'Keep Both' },
                      { id: 'accept_remote', label: 'Overwrite Local' },
                      { id: 'keep_local', label: 'Keep Local' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setConflictStrategy(opt.id as any)}
                        className={`px-2 py-0.5 rounded text-[11px] cursor-pointer transition-colors ${
                          conflictStrategy === opt.id
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'bg-white border border-slate-200 dark:bg-slate-700 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
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
                  disabled={isRestoring}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>Restoring...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-3 w-3" />
                      <span>Restore Workspace</span>
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
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
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
              className={`flex items-center gap-1.5 h-7 rounded-lg border px-2.5 text-xs font-medium cursor-pointer transition-colors ${
                isDateDropdownOpen || dateFilterMode !== 'all'
                  ? 'border-indigo-300 bg-indigo-50/80 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
              title="Filter export data by date range"
            >
              <Calendar className="h-3 w-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Date Filter:</span>
              <span className="text-[11px] font-semibold">
                {dateFilterMode === 'all'
                  ? 'All Time'
                  : dateFilterMode === 'this_month'
                  ? 'This Month'
                  : dateFilterMode === 'last_30_days'
                  ? 'Last 30 Days'
                  : 'Custom Range'}
              </span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isDateDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDateDropdownOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-60 max-w-[calc(100vw-2.5rem)] z-30 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in duration-100">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Export Date Scope
                </div>
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => { setDateFilterMode('all'); setIsDateDropdownOpen(false); }}
                    className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      dateFilterMode === 'all'
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>All Time (Full Workspace)</span>
                    {dateFilterMode === 'all' && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDateFilterMode('this_month'); setIsDateDropdownOpen(false); }}
                    className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      dateFilterMode === 'this_month'
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>This Month</span>
                    {dateFilterMode === 'this_month' && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDateFilterMode('last_30_days'); setIsDateDropdownOpen(false); }}
                    className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      dateFilterMode === 'last_30_days'
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>Last 30 Days</span>
                    {dateFilterMode === 'last_30_days' && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDateFilterMode('custom'); }}
                    className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      dateFilterMode === 'custom'
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>Custom Range</span>
                    {dateFilterMode === 'custom' && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
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
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={e => setCustomStartDate(e.target.value)}
                          className="flex-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="w-10 text-slate-400 shrink-0">To:</span>
                        <input
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
                className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between gap-3 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
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
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-40"
                >
                  {isCurrentExporting ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin text-indigo-600 dark:text-indigo-400" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3 w-3 text-slate-500 dark:text-slate-400" />
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
        title="Restore Workspace"
        message={`Are you sure you want to restore ${validationResult?.totalActiveRecords} records into "${profileName}"?`}
        confirmText="Restore Now"
        cancelText="Cancel"
        isDanger={false}
        onConfirm={handleExecuteRestore}
        onCancel={() => setShowConfirmRestoreModal(false)}
      />
    </div>
  );
};
