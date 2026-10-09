import React, { useState } from 'react';
import { X, Calendar, ArrowLeftRight, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  adToBs, bsToAd, getTodayIso, omNepaliDigits,
  OM_BS_MONTHS_NE, OM_BS_MONTHS_EN, OM_BS_DAYS_NE, OM_BS_DAYS_EN,
  getDaysInBsMonth, getBsMonthStartDayOfWeek, BsDateResult, AdDateResult
} from '../lib/nepaliDate';

interface BsDateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BsDateModal: React.FC<BsDateModalProps> = ({ isOpen, onClose }) => {
  const todayIso = getTodayIso();
  const todayBs = adToBs(todayIso);
  const [activeTab, setActiveTab] = useState<'calendar' | 'converter'>('calendar');

  // Calendar view state
  const [calYear, setCalYear] = useState(todayBs.year);
  const [calMonth, setCalMonth] = useState(todayBs.month);
  const [selectedDay, setSelectedDay] = useState<number | null>(todayBs.day);

  // Converter state
  const [adInput, setAdInput] = useState(todayIso);
  const [bsInput, setBsInput] = useState(todayBs.iso);
  const [convertedBs, setConvertedBs] = useState<BsDateResult | null>(todayBs);
  const [convertedAd, setConvertedAd] = useState<AdDateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePrevMonth = () => {
    if (calMonth === 1) {
      setCalYear(prev => prev - 1);
      setCalMonth(12);
    } else {
      setCalMonth(prev => prev - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (calMonth === 12) {
      setCalYear(prev => prev + 1);
      setCalMonth(1);
    } else {
      setCalMonth(prev => prev + 1);
    }
    setSelectedDay(null);
  };

  const handleJumpToToday = () => {
    setCalYear(todayBs.year);
    setCalMonth(todayBs.month);
    setSelectedDay(todayBs.day);
  };

  const daysInCalMonth = getDaysInBsMonth(calYear, calMonth);
  const startDayOfWeek = getBsMonthStartDayOfWeek(calYear, calMonth);

  const handleConvertAd = () => {
    setError(null);
    try {
      const res = adToBs(adInput);
      setConvertedBs(res);
      setConvertedAd(null);
      setBsInput(res.iso);
    } catch (e: any) {
      setError(e.message || 'Error converting date');
    }
  };

  const handleConvertBs = () => {
    setError(null);
    try {
      const res = bsToAd(bsInput);
      setConvertedAd(res);
      setConvertedBs(null);
      setAdInput(res.iso);
    } catch (e: any) {
      setError(e.message || 'Error converting date');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 font-bold">
              🇳🇵
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Nepali Patro & Bikram Sambat
              </h3>
              <p className="text-[11px] text-slate-400">
                Official astronomical solar calendar of Nepal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live Today Badge Banner */}
        <div className="mt-3.5 rounded-2xl border border-indigo-100 bg-indigo-50/60 dark:border-indigo-950/60 dark:bg-indigo-950/30 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              Today / आज
            </div>
            <div className="text-sm font-extrabold text-slate-900 dark:text-white">
              {todayBs.formattedNe}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {todayBs.formattedEn}
            </div>
          </div>
          <div className="text-left sm:text-right font-mono text-xs pt-1 sm:pt-0 border-t sm:border-t-0 border-indigo-100 dark:border-indigo-900/40">
            <span className="inline-block bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md font-bold text-indigo-700 dark:text-indigo-300">
              BS: {todayBs.iso}
            </span>
            <div className="text-[10px] text-slate-400 mt-0.5">
              AD: {todayIso}
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-3 flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs dark:border-slate-800 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Monthly Patro Calendar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('converter')}
            className={`flex-1 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'converter'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-900 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            AD ⇄ BS Converter
          </button>
        </div>

        {/* Tab 1: Calendar View */}
        {activeTab === 'calendar' && (
          <div className="mt-3.5 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-2 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer flex items-center gap-1"
                title="Previous Month"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleJumpToToday}
                  className="text-sm font-extrabold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                  title="Click to jump to current month"
                >
                  {OM_BS_MONTHS_NE[calMonth - 1]} {omNepaliDigits(calYear)}
                </button>
                <div className="text-[10px] text-slate-400 font-medium">
                  {OM_BS_MONTHS_EN[calMonth - 1]} {calYear} BS ({daysInCalMonth} days)
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer flex items-center gap-1"
                title="Next Month"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Days header: Sunday (आइत) to Saturday (शनि) */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
              {['आइत', 'सोम', 'मङ्गल', 'बुध', 'बिही', 'शुक्र', 'शनि'].map((d, i) => (
                <div
                  key={d}
                  className={`py-1 rounded-md ${
                    i === 6 ? 'text-rose-500 font-extrabold bg-rose-50/50 dark:bg-rose-950/20' : ''
                  }`}
                  title={OM_BS_DAYS_EN[i]}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Accurate Days Matrix with first-weekday offset */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty leading cells before month starts */}
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-9 rounded-xl" />
              ))}

              {/* Day cells with accurate numbering and weekday matching */}
              {Array.from({ length: daysInCalMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const dayOfWeek = (startDayOfWeek + idx) % 7;
                const isToday =
                  calYear === todayBs.year &&
                  calMonth === todayBs.month &&
                  dayNum === todayBs.day;
                const isSelected = selectedDay === dayNum && !isToday;
                const isSaturday = dayOfWeek === 6;

                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => setSelectedDay(dayNum)}
                    className={`h-9 rounded-xl flex flex-col items-center justify-center font-mono text-xs font-bold transition-all cursor-pointer ${
                      isToday
                        ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400 scale-105 z-10'
                        : isSelected
                        ? 'bg-indigo-100 text-indigo-900 border border-indigo-400 dark:bg-indigo-950 dark:text-indigo-200'
                        : isSaturday
                        ? 'border border-rose-100 bg-rose-50/40 text-rose-600 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400 hover:bg-rose-100'
                        : 'border border-slate-100 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title={`${OM_BS_MONTHS_EN[calMonth - 1]} ${dayNum}, ${calYear} BS (${OM_BS_DAYS_EN[dayOfWeek]})`}
                  >
                    <span>{omNepaliDigits(dayNum)}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Day Info Card */}
            {selectedDay && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-850/60 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {OM_BS_DAYS_NE[(startDayOfWeek + selectedDay - 1) % 7]}, {omNepaliDigits(selectedDay)} {OM_BS_MONTHS_NE[calMonth - 1]} {omNepaliDigits(calYear)}
                  </span>
                  <div className="text-[11px] text-slate-400 font-medium">
                    {OM_BS_DAYS_EN[(startDayOfWeek + selectedDay - 1) % 7]}, {selectedDay} {OM_BS_MONTHS_EN[calMonth - 1]} {calYear} BS
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const iso = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
                    try {
                      const ad = bsToAd(iso);
                      alert(`AD Equivalent: ${ad.formatted} (${ad.iso})`);
                    } catch {}
                  }}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                >
                  View AD Date
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Converter */}
        {activeTab === 'converter' && (
          <div className="mt-4 space-y-4">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* AD to BS */}
              <div className="rounded-2xl border border-slate-200 p-3.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  Gregorian (AD) ➔ BS
                </span>
                <input
                  type="date"
                  value={adInput}
                  onChange={e => setAdInput(e.target.value)}
                  className="h-8.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleConvertAd}
                  className="w-full py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs cursor-pointer transition-all"
                >
                  Convert to BS
                </button>
              </div>

              {/* BS to AD */}
              <div className="rounded-2xl border border-slate-200 p-3.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  Bikram Sambat (BS) ➔ AD
                </span>
                <input
                  type="text"
                  placeholder="e.g. 2083-06-23"
                  value={bsInput}
                  onChange={e => setBsInput(e.target.value)}
                  className="h-8.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleConvertBs}
                  className="w-full py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 text-white font-semibold text-xs cursor-pointer transition-all"
                >
                  Convert to AD
                </button>
              </div>
            </div>

            {/* Results Display */}
            {convertedBs && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3.5 dark:border-indigo-900/60 dark:bg-indigo-950/30 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Nepali Date Result (B.S.)
                </span>
                <div className="text-base font-extrabold text-slate-900 dark:text-white">
                  {convertedBs.formattedNe}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                  {convertedBs.formattedEn} ({convertedBs.iso})
                </div>
              </div>
            )}

            {convertedAd && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Gregorian Date Result (A.D.)
                </span>
                <div className="text-base font-extrabold text-slate-900 dark:text-white">
                  {convertedAd.formatted}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  ISO: {convertedAd.iso} ({convertedAd.dayNameEn})
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
