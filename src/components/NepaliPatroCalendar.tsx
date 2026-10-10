import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ArrowLeftRight,
  Sparkles,
  X,
  ListFilter,
  LayoutGrid,
  Info
} from 'lucide-react';
import {
  adToBs,
  bsToAd,
  getTodayIso,
  omNepaliDigits,
  omPad,
  OM_BS_DATA,
  OM_BS_MONTHS_NE,
  OM_BS_MONTHS_EN,
  OM_BS_MIN_YEAR,
  OM_BS_MAX_YEAR,
  BsDateResult,
  AdDateResult
} from '../lib/nepaliDate';
import {
  NEPALI_DAYS_NE,
  NEPALI_DAYS_EN,
  NEPALI_DAYS_SHORT,
  getNepaliEvent,
  getTithiForBsDate,
  getFullTithiForBsDate,
  NepaliCalendarEvent
} from '../lib/nepaliPatroData';

export interface DayCellData {
  bsYear: number;
  bsMonth: number;
  bsDay: number;
  bsDayDevanagari: string;
  adDate: {
    year: number;
    month: number;
    day: number;
    dayOfMonthStr: string;
    iso: string;
    weekdayName: string;
    dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  };
  event: NepaliCalendarEvent | null;
  tithi: string;
  fullTithi: string;
  isSaturday: boolean;
  isHoliday: boolean;
  isToday: boolean;
  isSelected: boolean;
}

export interface NepaliPatroCalendarProps {
  onClose?: () => void;
  initialTab?: 'patro' | 'converter';
}

export const NepaliPatroCalendar: React.FC<NepaliPatroCalendarProps> = ({
  onClose,
  initialTab = 'patro'
}) => {
  // Tab switcher: Tab 1 = "Full Patro", Tab 2 = "AD ↔ BS Converter"
  const [activeTab, setActiveTab] = useState<'patro' | 'converter'>(initialTab);

  // View Mode for Mobile: 'grid' vs 'agenda' (compact list of festivals)
  const [viewMode, setViewMode] = useState<'grid' | 'agenda'>('grid');

  // Today state
  const todayIso = useMemo(() => getTodayIso(), []);
  const todayBs = useMemo(() => {
    try {
      return adToBs(todayIso);
    } catch {
      return { year: 2082, month: 6, day: 16, iso: '2082-06-16' } as BsDateResult;
    }
  }, [todayIso]);

  // Current viewed Month & Year in Patro
  const [viewYear, setViewYear] = useState<number>(todayBs.year);
  const [viewMonth, setViewMonth] = useState<number>(todayBs.month); // 1-12

  // Currently selected date for detailed card popup
  const [selectedDayData, setSelectedDayData] = useState<DayCellData | null>(null);

  // Converter state (preserving existing converter logic)
  const [adDateInput, setAdDateInput] = useState<string>(todayIso);
  const [bsDateInput, setBsDateInput] = useState<string>(todayBs.iso);
  const [convertedBsResult, setConvertedBsResult] = useState<BsDateResult | null>(todayBs);
  const [convertedAdResult, setConvertedAdResult] = useState<AdDateResult | null>(null);
  const [converterError, setConverterError] = useState<string | null>(null);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      if (viewYear > OM_BS_MIN_YEAR) {
        setViewYear(viewYear - 1);
        setViewMonth(12);
      }
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      if (viewYear < OM_BS_MAX_YEAR) {
        setViewYear(viewYear + 1);
        setViewMonth(1);
      }
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleJumpToToday = () => {
    setViewYear(todayBs.year);
    setViewMonth(todayBs.month);
    // Select today
    const foundToday = monthCells.find(c => c.isToday);
    if (foundToday) {
      setSelectedDayData(foundToday);
    }
  };

  // Compute month cell days and padding
  const { monthCells, leadingEmptySlots, englishMonthSpan, daysInMonth, monthEvents } = useMemo(() => {
    const daysCount = OM_BS_DATA[viewYear]?.[viewMonth - 1] || 30;

    // Determine the day-of-week for Day 1 of this BS month by converting to AD
    const firstDayBsIso = `${viewYear}-${omPad(viewMonth)}-01`;
    let firstDayAd: AdDateResult;
    try {
      firstDayAd = bsToAd(firstDayBsIso);
    } catch {
      firstDayAd = { year: 2025, month: 9, day: 17, iso: '2025-09-17', formatted: '' };
    }

    const firstDateObj = new Date(`${firstDayAd.iso}T00:00:00Z`);
    // getUTCDay: 0 = Sun, 1 = Mon, ..., 6 = Sat
    const startWeekday = firstDateObj.getUTCDay();

    // Determine the AD date span for the month header (e.g. "Sep / Oct 2025")
    const lastDayBsIso = `${viewYear}-${omPad(viewMonth)}-${omPad(daysCount)}`;
    let lastDayAd: AdDateResult;
    try {
      lastDayAd = bsToAd(lastDayBsIso);
    } catch {
      lastDayAd = firstDayAd;
    }

    const startAdMonthName = new Date(`${firstDayAd.iso}T00:00:00Z`).toLocaleString('en-US', {
      month: 'short',
      timeZone: 'UTC'
    });
    const endAdMonthName = new Date(`${lastDayAd.iso}T00:00:00Z`).toLocaleString('en-US', {
      month: 'short',
      timeZone: 'UTC'
    });

    const monthSpanStr =
      startAdMonthName === endAdMonthName
        ? `${startAdMonthName} ${firstDayAd.year}`
        : `${startAdMonthName} / ${endAdMonthName} ${
            firstDayAd.year === lastDayAd.year
              ? firstDayAd.year
              : `${firstDayAd.year}/${lastDayAd.year}`
          }`;

    // Build the day cells
    const cells: DayCellData[] = [];
    const eventsList: DayCellData[] = [];

    for (let d = 1; d <= daysCount; d++) {
      const dayIso = `${viewYear}-${omPad(viewMonth)}-${omPad(d)}`;
      let adResult: AdDateResult;
      try {
        adResult = bsToAd(dayIso);
      } catch {
        adResult = {
          year: firstDayAd.year,
          month: firstDayAd.month,
          day: d,
          iso: `${firstDayAd.year}-${omPad(firstDayAd.month)}-${omPad(d)}`,
          formatted: ''
        };
      }

      const dayOfWeek = (startWeekday + (d - 1)) % 7;
      const isSaturday = dayOfWeek === 6;

      const event = getNepaliEvent(viewYear, viewMonth, d);
      const isHoliday = isSaturday || (event?.isHoliday ?? false);
      const tithi = getTithiForBsDate(viewYear, viewMonth, d);
      const fullTithi = getFullTithiForBsDate(viewYear, viewMonth, d);

      const isToday =
        viewYear === todayBs.year &&
        viewMonth === todayBs.month &&
        d === todayBs.day;

      const isSelected =
        selectedDayData !== null &&
        selectedDayData.bsYear === viewYear &&
        selectedDayData.bsMonth === viewMonth &&
        selectedDayData.bsDay === d;

      const cellObj: DayCellData = {
        bsYear: viewYear,
        bsMonth: viewMonth,
        bsDay: d,
        bsDayDevanagari: omNepaliDigits(d),
        adDate: {
          year: adResult.year,
          month: adResult.month,
          day: adResult.day,
          dayOfMonthStr: String(adResult.day),
          iso: adResult.iso,
          weekdayName: NEPALI_DAYS_EN[dayOfWeek],
          dayOfWeek
        },
        event,
        tithi,
        fullTithi,
        isSaturday,
        isHoliday,
        isToday,
        isSelected
      };

      cells.push(cellObj);
      if (cellObj.event || cellObj.isHoliday) {
        eventsList.push(cellObj);
      }
    }

    return {
      monthCells: cells,
      leadingEmptySlots: startWeekday,
      englishMonthSpan: monthSpanStr,
      daysInMonth: daysCount,
      monthEvents: eventsList
    };
  }, [viewYear, viewMonth, todayBs, selectedDayData]);

  // Converter Handlers
  const handleConvertAdToBs = () => {
    setConverterError(null);
    try {
      const res = adToBs(adDateInput);
      setConvertedBsResult(res);
      setConvertedAdResult(null);
      setBsDateInput(res.iso);
    } catch (e: any) {
      setConverterError(e.message || 'Error converting AD to BS date');
    }
  };

  const handleConvertBsToAd = () => {
    setConverterError(null);
    try {
      const res = bsToAd(bsDateInput);
      setConvertedAdResult(res);
      setConvertedBsResult(null);
      setAdDateInput(res.iso);
    } catch (e: any) {
      setConverterError(e.message || 'Error converting BS to AD date');
    }
  };

  const handleResetConverterToToday = () => {
    setConverterError(null);
    const today = getTodayIso();
    setAdDateInput(today);
    try {
      const res = adToBs(today);
      setConvertedBsResult(res);
      setConvertedAdResult(null);
      setBsDateInput(res.iso);
    } catch (e: any) {
      setConverterError(e.message);
    }
  };

  const monthIdx = viewMonth - 1;
  const currentMonthNe = OM_BS_MONTHS_NE[monthIdx];
  const currentMonthEn = OM_BS_MONTHS_EN[monthIdx];
  const currentYearNe = omNepaliDigits(viewYear);
  const activeDay = selectedDayData || monthCells.find(c => c.isToday) || monthCells[0];

  return (
    <div className="w-full flex flex-col">
      {/* Clean Modern Card Container (Fully Responsive for All Devices) */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/80 shadow-2xl overflow-hidden flex flex-col flex-1 dark:bg-slate-900 dark:border-slate-800">
        
        {/* ============================================================== */}
        {/* 1. TOP HEADER & NAVIGATION TAB SWITCHER */}
        {/* ============================================================== */}
        <div className="px-3 py-2.5 sm:px-5 sm:py-3 border-b border-gray-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            
            {/* Title & Badge */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400 flex items-center justify-center font-bold text-sm sm:text-base shrink-0">
                🇳🇵
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white truncate">
                    नेपाली पात्रो
                  </h1>
                  <span className="text-[10px] sm:text-xs font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 shrink-0">
                    B.S.
                  </span>
                </div>
              </div>
            </div>

            {/* Top Navigation Tabs & Close Button */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200/60 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveTab('patro')}
                  className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'patro'
                      ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span>पात्रो</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('converter')}
                  className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'converter'
                      ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>रूपान्तरण (AD↔BS)</span>
                </button>
              </div>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 sm:p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:text-gray-200 rounded-xl transition-colors ml-0.5"
                  title="Close"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. TAB 1: FULL PATRO CALENDAR GRID VIEW */}
        {/* ============================================================== */}
        {activeTab === 'patro' && (
          <div className="flex-1 overflow-y-auto px-2.5 py-2 sm:px-4 sm:py-3 space-y-2 sm:space-y-2.5 flex flex-col">
            
            {/* Calendar Controls & Month Header Ribbon */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-gray-50/90 dark:bg-slate-800/50 p-2 sm:px-3 sm:py-2 rounded-xl border border-gray-100 dark:border-slate-800 shrink-0">
              
              {/* Row 1 / Left: Month Navigator & Title & "आज" */}
              <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2">
                <div className="flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    disabled={viewYear <= OM_BS_MIN_YEAR && viewMonth <= 1}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:text-amber-600 hover:bg-amber-50/60 dark:text-gray-300 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Previous Month"
                    aria-label="Previous Month"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    disabled={viewYear >= OM_BS_MAX_YEAR && viewMonth >= 12}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:text-amber-600 hover:bg-amber-50/60 dark:text-gray-300 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Next Month"
                    aria-label="Next Month"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                    {currentMonthNe} {currentYearNe}
                  </span>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 truncate">
                    {currentMonthEn}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium hidden md:inline">
                    • {englishMonthSpan}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleJumpToToday}
                  className="h-7 px-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold rounded-lg shadow-xs shadow-amber-500/20 transition-all flex items-center gap-1 shrink-0 ml-auto sm:ml-0"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>आज</span>
                </button>
              </div>

              {/* Row 2 on mobile / Right on desktop: Selectors & View Mode */}
              <div className="flex items-center justify-between sm:justify-end gap-1.5">
                {/* Mobile View Toggle: Grid vs Agenda */}
                <div className="sm:hidden flex items-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-1 rounded text-xs transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                    title="Grid View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('agenda')}
                    className={`p-1 rounded text-xs transition-colors ${
                      viewMode === 'agenda'
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                    title="Agenda/List View"
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1 sm:gap-1.5 flex-1 sm:flex-initial justify-end">
                  {/* Year Selector */}
                  <select
                    value={viewYear}
                    onChange={e => setViewYear(Number(e.target.value))}
                    aria-label="Select BS Year"
                    className="h-7 px-1.5 sm:px-2 text-xs font-bold rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-amber-400 focus:outline-none focus:border-amber-500 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200"
                  >
                    {Array.from({ length: OM_BS_MAX_YEAR - OM_BS_MIN_YEAR + 1 }).map((_, idx) => {
                      const y = OM_BS_MIN_YEAR + idx;
                      return (
                        <option key={y} value={y}>
                          {omNepaliDigits(y)} ({y})
                        </option>
                      );
                    })}
                  </select>

                  {/* Month Selector */}
                  <select
                    value={viewMonth}
                    onChange={e => setViewMonth(Number(e.target.value))}
                    aria-label="Select BS Month"
                    className="h-7 px-1.5 sm:px-2 text-xs font-bold rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-amber-400 focus:outline-none focus:border-amber-500 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200"
                  >
                    {OM_BS_MONTHS_NE.map((mNe, idx) => (
                      <option key={mNe} value={idx + 1}>
                        {mNe}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Active / Selected Date Summary Card (Always shows rich details of today or clicked day) */}
            {activeDay && (
              <div className="p-2 sm:p-2.5 rounded-xl bg-linear-to-r from-amber-50/90 via-orange-50/40 to-amber-50/90 border border-amber-200/80 dark:from-amber-950/40 dark:via-slate-900 dark:to-amber-950/40 dark:border-amber-900/50 shadow-xs shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-base sm:text-xl shadow-xs shadow-amber-500/20 shrink-0">
                      {activeDay.bsDayDevanagari}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                          {activeDay.bsDayDevanagari} {OM_BS_MONTHS_NE[activeDay.bsMonth - 1]} {omNepaliDigits(activeDay.bsYear)}
                        </span>
                        <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                          ({activeDay.adDate.weekdayName}, {activeDay.adDate.iso})
                        </span>
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2 flex-wrap">
                        <span className="text-amber-800 dark:text-amber-300 font-semibold">
                          तिथि: <strong>{activeDay.fullTithi || activeDay.tithi}</strong>
                        </span>
                        {activeDay.event && (
                          <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                            activeDay.event.isHoliday
                              ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}>
                            {activeDay.event.title}
                          </span>
                        )}
                        {activeDay.isSaturday && !activeDay.event?.isHoliday && (
                          <span className="font-bold px-1.5 py-0.2 rounded bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 text-[10px]">
                            शनिवार (सार्वजनिक बिदा)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {activeDay.isToday && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold shrink-0">
                      आज
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Calendar Grid Container (Device Auto-Responsive) */}
            {viewMode === 'grid' ? (
              <div className="w-full flex-1 flex flex-col">
                {/* 7-Day Column Headers (आइतवार to शनिवार, Saturday highlighted in red) */}
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1 shrink-0">
                  {NEPALI_DAYS_NE.map((dayName, idx) => {
                    const isSaturday = idx === 6;
                    return (
                      <div
                        key={dayName}
                        className={`text-center py-1 px-0.5 rounded-lg text-xs font-bold tracking-tight transition-colors ${
                          isSaturday
                            ? 'text-red-600 bg-red-50/80 dark:bg-red-950/40 dark:text-red-400'
                            : 'text-gray-700 bg-gray-50 dark:bg-slate-800/60 dark:text-gray-300'
                        }`}
                      >
                        <div className="text-[11px] sm:text-xs">
                          <span className="hidden sm:inline">{dayName}</span>
                          <span className="sm:hidden">{NEPALI_DAYS_SHORT[idx]}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Calendar Days Matrix (Zero Overlap Guaranteed) */}
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5 flex-1 content-start">
                  {/* Leading Empty Slots */}
                  {Array.from({ length: leadingEmptySlots }).map((_, index) => (
                    <div
                      key={`empty-${index}`}
                      className="h-12 sm:h-14 md:h-15 rounded-xl border border-dashed border-gray-100 bg-gray-50/20 dark:border-slate-800/30 dark:bg-slate-900/10"
                    />
                  ))}

                  {/* Day Cells: 100% Collision-Proof & Device-Compatible */}
                  {monthCells.map(cell => {
                    const isSelected = activeDay?.bsDay === cell.bsDay;

                    return (
                      <div
                        key={`day-${cell.bsDay}`}
                        onClick={() => setSelectedDayData(cell)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedDayData(cell);
                          }
                        }}
                        className={`group relative h-12 sm:h-14 md:h-15 p-0.5 sm:p-1 rounded-xl transition-all cursor-pointer flex flex-col justify-between items-center select-none overflow-hidden ${
                          cell.isToday
                            ? 'ring-2 ring-amber-500 bg-amber-500/10 dark:bg-amber-400/15 dark:ring-amber-400 shadow-xs'
                            : isSelected
                            ? 'ring-2 ring-amber-400 bg-amber-50/80 dark:bg-amber-950/40'
                            : 'border border-gray-100 bg-white hover:border-amber-200 hover:shadow-2xs dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-slate-700'
                        }`}
                      >
                        {/* Top-Left Corner: "आज" tag or Event dot */}
                        <div className="absolute top-1 left-1 flex items-center gap-0.5 leading-none pointer-events-none z-10">
                          {cell.isToday ? (
                            <span className="px-1 py-0.2 rounded-xs bg-amber-500 text-[6.5px] sm:text-[7.5px] font-black text-white leading-none">
                              आज
                            </span>
                          ) : cell.event ? (
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                cell.event.isHoliday ? 'bg-red-500' : 'bg-amber-500'
                              }`}
                              title={cell.event.title}
                            />
                          ) : null}
                        </div>

                        {/* Top-Right Corner: Gregorian AD date numeral */}
                        <div className="absolute top-1 right-1 leading-none pointer-events-none z-10">
                          <span className="text-[8px] sm:text-[9.5px] font-bold font-mono text-gray-400 dark:text-gray-500">
                            {cell.adDate.dayOfMonthStr}
                          </span>
                        </div>

                        {/* Center: Main Nepali Devanagari BS date numeral */}
                        <div className="flex-1 flex items-center justify-center my-auto leading-none w-full">
                          <span
                            className={`text-sm sm:text-base md:text-lg font-black tracking-tight inline-block transition-transform group-hover:scale-110 ${
                              cell.isHoliday
                                ? 'text-red-600 dark:text-red-400'
                                : cell.isToday
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {cell.bsDayDevanagari}
                          </span>
                        </div>

                        {/* Bottom: Tithi Name */}
                        <div className="w-full text-center leading-none px-0.5 pb-0.5 shrink-0">
                          <span className="block truncate text-[7px] sm:text-[8px] md:text-[8.5px] text-gray-500 dark:text-gray-400 font-medium leading-tight">
                            {cell.tithi}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Mobile Agenda / List View */
              <div className="space-y-1.5 flex-1">
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 px-1">
                  {currentMonthNe} {currentYearNe} का मुख्य पर्व र तिथिहरू:
                </div>
                {monthEvents.map(evCell => (
                  <div
                    key={`agenda-${evCell.bsDay}`}
                    onClick={() => setSelectedDayData(evCell)}
                    className="p-2.5 rounded-xl border border-gray-100 bg-white hover:border-amber-300 dark:border-slate-800 dark:bg-slate-900/90 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400 flex items-center justify-center font-bold text-base">
                        {evCell.bsDayDevanagari}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">
                          {evCell.event?.title || (evCell.isSaturday ? 'शनिवार (सार्वजनिक बिदा)' : 'पर्व')}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                          {evCell.fullTithi || evCell.tithi} • {evCell.adDate.iso} ({evCell.adDate.weekdayName})
                        </div>
                      </div>
                    </div>
                    {evCell.isHoliday && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300 shrink-0">
                        बिदा
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Legend Bar */}
            <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded border-2 border-amber-500 bg-amber-50/40" />
                  <span>आज (Today)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-red-100 border border-red-300" />
                  <span className="text-red-600 font-semibold">शनिवार / सार्वजनिक बिदा</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>पर्व / उत्सव</span>
                </span>
              </div>
              <div className="text-gray-400 text-[10px] hidden sm:block">
                कुनै पनि मितिमा ट्याप गरी विस्तृत जानकारी हेर्नुहोस्
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. TAB 2: AD ↔ BS CONVERTER (PRESERVED INTACT) */}
        {/* ============================================================== */}
        {activeTab === 'converter' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            <div className="max-w-2xl mx-auto space-y-6">
              
              {/* Header Description */}
              <div className="text-center space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  ईस्वी संवत् (AD) ↔ विक्रम संवत् (BS) मिति रूपान्तरण
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  नेपाली पात्रो (१९७८ देखि २०९९ वि.सं सम्म) को आधिकारिक गणना
                </p>
              </div>

              {converterError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">
                  {converterError}
                </div>
              )}

              {/* Conversion Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Box 1: AD to BS */}
                <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      अंग्रेजी मिति (AD) बाट नेपाली (BS)
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">YYYY-MM-DD</span>
                  </div>

                  <input
                    type="date"
                    value={adDateInput}
                    onChange={e => setAdDateInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white font-medium focus:border-amber-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  />

                  <button
                    type="button"
                    onClick={handleConvertAdToBs}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>BS मा परिवर्तन गर्नुहोस्</span>
                  </button>

                  {convertedBsResult && (
                    <div className="p-3 rounded-xl bg-white border border-amber-200/80 dark:bg-slate-900 dark:border-amber-900/50 shadow-2xs space-y-1">
                      <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                        नेपाली मिति (B.S.):
                      </div>
                      <div className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                        {convertedBsResult.formattedNe}
                      </div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {convertedBsResult.formattedEn} ({convertedBsResult.iso})
                      </div>
                    </div>
                  )}
                </div>

                {/* Box 2: BS to AD */}
                <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      नेपाली मिति (BS) बाट अंग्रेजी (AD)
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">YYYY-MM-DD</span>
                  </div>

                  <input
                    type="text"
                    placeholder="2082-06-16"
                    value={bsDateInput}
                    onChange={e => setBsDateInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white font-medium focus:border-amber-500 focus:outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  />

                  <button
                    type="button"
                    onClick={handleConvertBsToAd}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    <span>AD मा परिवर्तन गर्नुहोस्</span>
                  </button>

                  {convertedAdResult && (
                    <div className="p-3 rounded-xl bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 shadow-2xs space-y-1">
                      <div className="text-[10px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">
                        अंग्रेजी मिति (A.D.):
                      </div>
                      <div className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                        {convertedAdResult.formatted || convertedAdResult.iso}
                      </div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        ISO: {convertedAdResult.iso}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Reset to Today Action */}
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={handleResetConverterToToday}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50 transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>आजको मिति रिसेट गर्नुहोस् (Reset to Today)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
