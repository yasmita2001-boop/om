import React, { useState, useEffect, useMemo } from 'react';
import {
  Trash2, RotateCcw, Search, ShieldCheck, AlertTriangle,
  ArchiveRestore, CheckCircle2, Filter, Layers, Eye, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';
import { storage, cleanOrphanedCacheAndTrash } from '../lib/storage';
import { RecycleBinItem } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

interface RecycleBinViewProps {
  profileId?: string;
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
  onError?: (msg: string) => void;
  isEmbedded?: boolean;
}

export const RecycleBinView: React.FC<RecycleBinViewProps> = ({
  profileId,
  onRefresh,
  onSuccess,
  onError,
  isEmbedded = false,
}) => {
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [guardedCount, setGuardedCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Confirmation modal states
  const [itemToPurge, setItemToPurge] = useState<RecycleBinItem | null>(null);
  const [isConfirmEmptyOpen, setIsConfirmEmptyOpen] = useState<boolean>(false);
  const [isConfirmBulkPurgeOpen, setIsConfirmBulkPurgeOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const loadRecycleBin = async () => {
    setLoading(true);
    try {
      const activeProf = profileId || storage.getActiveProfileId();
      const binItems = await storage.getRecycleBinItems(activeProf);
      setItems(binItems);
      setGuardedCount(0);
      setSelectedIds(prev => {
        const validIds = new Set(binItems.map(i => i.id));
        const next = new Set<string>();
        prev.forEach(id => {
          if (validIds.has(id)) next.add(id);
        });
        return next;
      });
    } catch (err: any) {
      onError?.(`Failed to load Recycle Bin: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecycleBin();
    const unsubStorage = storage.subscribe(() => {
      loadRecycleBin();
    });
    return () => {
      unsubStorage();
    };
  }, [profileId]);

  const modulesList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const mod = item.moduleLabel || 'Other';
      counts.set(mod, (counts.get(mod) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const mod = item.moduleLabel || 'Other';
      if (selectedModule !== 'ALL' && mod !== selectedModule) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const sLabel = item.storeLabel || '';
      return (
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        mod.toLowerCase().includes(q) ||
        sLabel.toLowerCase().includes(q)
      );
    });
  }, [items, selectedModule, searchQuery]);

  const handleRestoreItem = async (item: RecycleBinItem) => {
    setIsProcessing(true);
    try {
      const ok = await storage.restoreFromRecycleBin(item.id);
      if (ok) {
        onSuccess(`✓ Restored "${item.title}" back to ${item.moduleLabel || 'original module'}`);
        await loadRecycleBin();
        onRefresh();
      } else {
        onError?.('Could not restore item.');
      }
    } catch (err: any) {
      onError?.(`Restore failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      let restored = 0;
      for (const id of Array.from(selectedIds)) {
        const ok = await storage.restoreFromRecycleBin(id);
        if (ok) restored++;
      }
      setSelectedIds(new Set());
      onSuccess(`✓ Restored ${restored} item(s) to their original modules`);
      await loadRecycleBin();
      onRefresh();
    } catch (err: any) {
      onError?.(`Bulk restore failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmPermanentDeleteSingle = async () => {
    if (!itemToPurge) return;
    const target = itemToPurge;
    setItemToPurge(null);
    setIsProcessing(true);
    try {
      await storage.permanentlyDeleteFromRecycleBin(target.id);
      onSuccess(`✓ Permanently deleted "${target.title}". It is blocked from future backup imports.`);
      await loadRecycleBin();
      onRefresh();
    } catch (err: any) {
      onError?.(`Permanent delete failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmBulkPurge = async () => {
    setIsConfirmBulkPurgeOpen(false);
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      let purged = 0;
      for (const id of Array.from(selectedIds)) {
        await storage.permanentlyDeleteFromRecycleBin(id);
        purged++;
      }
      setSelectedIds(new Set());
      onSuccess(`✓ Permanently purged ${purged} item(s). They will never reappear.`);
      await loadRecycleBin();
      onRefresh();
    } catch (err: any) {
      onError?.(`Bulk permanent delete failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmEmptyBin = async () => {
    setIsConfirmEmptyOpen(false);
    if (items.length === 0) return;
    setIsProcessing(true);
    try {
      const activeProf = profileId || storage.getActiveProfileId();
      const count = await storage.emptyRecycleBin(activeProf);
      // Also clean up any lingering media cache or orphaned blobs
      try {
        await cleanOrphanedCacheAndTrash({ emptyRecycleBinFirst: false, profileId: activeProf });
      } catch {}
      setSelectedIds(new Set());
      onSuccess(`✓ Recycle Bin emptied (${count} item(s) permanently destroyed and cache freed).`);
      await loadRecycleBin();
      onRefresh();
    } catch (err: any) {
      onError?.(`Failed to empty Recycle Bin: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (filteredItems.length === 0) return;
    const allSelected = filteredItems.every(i => selectedIds.has(i.id));
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredItems.forEach(i => next.delete(i.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredItems.forEach(i => next.add(i.id));
        return next;
      });
    }
  };

  const formatDeletedDate = (ts: number) => {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Standalone page header (only when not embedded in Settings tabs) */}
      {!isEmbedded && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                Recycle Bin & Deletion Guard
              </h1>
            </div>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setIsConfirmEmptyOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-500 active:scale-98 cursor-pointer disabled:opacity-50 transition-all"
            >
              <Trash2 className="h-4 w-4" />
              <span>Empty Recycle Bin ({items.length})</span>
            </button>
          )}
        </div>
      )}

      {/* Unified Compact Main Recycle Bin Card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Card Header & Telemetry */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
              <Trash2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Recycle Bin
              </h2>
            </div>
          </div>

          {/* Quick Metrics & Actions Bar */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 px-2.5 py-1 text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 font-medium">In Bin</span>
              <span className="font-bold text-slate-900 dark:text-white tabular-nums">{items.length}</span>
            </div>

            {items.length > 0 && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setIsConfirmEmptyOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/60 cursor-pointer transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                <span>Empty Bin</span>
              </button>
            )}
          </div>
        </div>


        {/* Search, Filter & Bulk Controls (Shown when items exist, or when search was entered) */}
        {(items.length > 0 || searchQuery) && (
          <div className="px-4 py-2.5 sm:px-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search deleted records by title, category, or module..."
                  className="h-8.5 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleRestoreSelected}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer transition-all"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Restore ({selectedIds.size})</span>
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setIsConfirmBulkPurgeOpen(true)}
                    className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 cursor-pointer transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete Forever ({selectedIds.size})</span>
                  </button>
                </div>
              )}
            </div>

            {/* Module Filter Chips */}
            {modulesList.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedModule('ALL')}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedModule === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  All ({items.length})
                </button>
                {modulesList.map(([modLabel, count]) => (
                  <button
                    key={modLabel}
                    type="button"
                    onClick={() => setSelectedModule(modLabel)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedModule === modLabel
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {modLabel} ({count})
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content Body: Records List or Compact Empty State */}
        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="py-6 text-center text-xs text-slate-400">Loading Recycle Bin...</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-5 sm:py-6 px-4 text-center space-y-1.5 max-w-sm mx-auto">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <Trash2 className="h-4.5 w-4.5 stroke-[1.75]" />
              </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {items.length === 0 ? 'Recycle Bin is Empty' : 'No matching deleted items found'}
              </div>
              {searchQuery && (
                <div className="text-[11px] text-slate-400">
                  Try clearing your search query or switching filters.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filteredItems.length > 0 && filteredItems.every(i => selectedIds.has(i.id))}
                    onChange={toggleSelectAllFiltered}
                    className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                  />
                  <span>Select All ({filteredItems.length})</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  Showing {filteredItems.length} of {items.length} item(s)
                </span>
              </div>

              <div className="space-y-2.5">
                {filteredItems.map(item => {
                  const isSelected = selectedIds.has(item.id);
                  const isExpanded = expandedItemId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border p-3.5 sm:p-4 transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/30 dark:border-indigo-500/60 dark:bg-indigo-950/30'
                          : 'border-slate-200/80 bg-slate-50/50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectItem(item.id)}
                            className="mt-1 h-4 w-4 rounded accent-indigo-600 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                                {item.moduleLabel}
                              </span>
                              <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                {item.storeLabel}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Deleted {formatDeletedDate(item.deletedAt)}
                              </span>
                            </div>

                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white break-words">
                              {item.title}
                            </div>

                            {item.subtitle && (
                              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0 sm:self-center pl-7 sm:pl-0">
                          <button
                            type="button"
                            onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                            title="Inspect raw record details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Details</span>
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleRestoreItem(item)}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-500 active:scale-98 cursor-pointer disabled:opacity-50 transition-all"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Restore</span>
                          </button>

                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => setItemToPurge(item)}
                            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-rose-500 active:scale-98 cursor-pointer disabled:opacity-50 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete Forever</span>
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-700/70 pl-7">
                          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-1">
                            Record ID: {item.recordId} · Store: {item.storeName}{item.contentSignature ? ` · Guard Signature: ${item.contentSignature}` : ''}
                          </div>
                          <pre className="max-h-48 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] font-mono text-slate-200">
                            {JSON.stringify(item.data || item.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Single Item Permanent Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(itemToPurge)}
        title="Permanently Delete Item Forever?"
        message={`Are you sure you want to permanently delete "${itemToPurge?.title}" from the Recycle Bin?\n\nOnce deleted, this record cannot be recovered and will never reappear even if older backup snapshots are imported.`}
        confirmText="Yes, Delete Forever"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmPermanentDeleteSingle}
        onCancel={() => setItemToPurge(null)}
      />

      {/* Bulk Permanent Delete Confirmation */}
      <ConfirmModal
        isOpen={isConfirmBulkPurgeOpen}
        title={`Permanently Delete ${selectedIds.size} Selected Item(s)?`}
        message={`This will permanently erase ${selectedIds.size} selected item(s) from the Recycle Bin.\n\nThey will be locked from ever reappearing.`}
        confirmText="Yes, Delete Selected Forever"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmBulkPurge}
        onCancel={() => setIsConfirmBulkPurgeOpen(false)}
      />

      {/* Empty Entire Recycle Bin Confirmation */}
      <ConfirmModal
        isOpen={isConfirmEmptyOpen}
        title="Empty Entire Recycle Bin?"
        message={`DANGER: This will permanently destroy all ${items.length} item(s) currently in your Recycle Bin.\n\nThey will be permanently blocked from ever returning.`}
        confirmText="Yes, Empty Recycle Bin Forever"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmEmptyBin}
        onCancel={() => setIsConfirmEmptyOpen(false)}
      />
    </div>
  );
};
