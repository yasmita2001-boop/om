import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';

type DateTimeInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  type: 'date' | 'time';
  min?: string;
  max?: string;
  step?: number | string;
};

const pad = (value: number) => String(value).padStart(2, '0');

const parseDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3]) ? date : null;
};

const formatDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const ThemedDateTimeInput: React.FC<DateTimeInputProps> = ({
  type,
  value,
  defaultValue,
  min,
  max,
  step,
  className = '',
  onChange,
  onClick,
  onKeyDown,
  ...inputProps
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isDate = type === 'date';
  const currentValue = String(value ?? defaultValue ?? '');
  const parsedDate = isDate ? parseDate(currentValue) : null;
  const [isOpen, setIsOpen] = useState(false);
  const [opensAbove, setOpensAbove] = useState(false);
  const [openMenu, setOpenMenu] = useState<'year' | 'month' | null>(null);
  const [popoverOffsetX, setPopoverOffsetX] = useState(0);
  const [popoverMaxHeight, setPopoverMaxHeight] = useState<number | undefined>();
  const yearMenuRef = useRef<HTMLDivElement>(null);
  const monthMenuRef = useRef<HTMLDivElement>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = parsedDate || new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [selectedHour, setSelectedHour] = useState(Number(currentValue.slice(0, 2)) || 0);
  const [selectedMinute, setSelectedMinute] = useState(Number(currentValue.slice(3, 5)) || 0);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!wrapperRef.current?.contains(event.target)) {
        setIsOpen(false);
        setOpenMenu(null);
        return;
      }
      if (!yearMenuRef.current?.contains(event.target) && !monthMenuRef.current?.contains(event.target)) {
        setOpenMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (openMenu) {
        setOpenMenu(null);
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, openMenu]);

  useEffect(() => {
    if (!isOpen) setOpenMenu(null);
  }, [isOpen]);

  useEffect(() => {
    if (!openMenu) return;
    const wrap = openMenu === 'year' ? yearMenuRef.current : monthMenuRef.current;
    wrap?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [openMenu]);

  useEffect(() => {
    if (!isDate || !parsedDate) return;
    setVisibleMonth(new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1));
  }, [isDate, currentValue]);

  useEffect(() => {
    if (isDate || !/^\d{2}:\d{2}$/.test(currentValue)) return;
    setSelectedHour(Number(currentValue.slice(0, 2)));
    setSelectedMinute(Number(currentValue.slice(3, 5)));
  }, [currentValue, isDate]);

  const calendarDays = useMemo(() => {
    if (!isDate) return [];
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const start = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - firstDay.getDay());
    return Array.from({ length: 42 }, (_, index) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    );
  }, [isDate, visibleMonth]);

  const yearOptions = useMemo(
    () => Array.from({ length: 26 }, (_, index) => 2020 + index),
    []
  );

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => new Date(2000, index, 1).toLocaleDateString(undefined, { month: 'long' })),
    []
  );

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = currentIndex === -1
      ? (delta === 1 ? 0 : items.length - 1)
      : Math.min(items.length - 1, Math.max(0, currentIndex + delta));
    items[nextIndex]?.focus();
  };

  const emitValue = (nextValue: string) => {
    const input = inputRef.current;
    if (!input) return;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!valueSetter) {
      throw new Error('Unable to update the themed date/time input value.');
    }
    valueSetter.call(input, nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const isWithinBounds = (date: Date) => {
    const dateValue = formatDate(date);
    return (!min || dateValue >= min) && (!max || dateValue <= max);
  };

  const alignPopoverToViewport = () => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const popoverWidth = Math.min(isDate ? 304 : 256, window.innerWidth - 16);
    const rightEdge = window.innerWidth - 8;
    setPopoverOffsetX(Math.min(0, Math.max(8 - bounds.left, rightEdge - bounds.left - popoverWidth)));
  };

  useEffect(() => {
    if (!isOpen) return;
    alignPopoverToViewport();
    window.addEventListener('resize', alignPopoverToViewport);
    return () => window.removeEventListener('resize', alignPopoverToViewport);
  }, [isOpen, isDate]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const positionPopover = () => {
      if (cancelled) return;
      const bounds = wrapperRef.current?.getBoundingClientRect();
      const popover = popoverRef.current;
      if (!bounds || !popover) return;

      const headerBottom = document.querySelector<HTMLElement>('.command-bar')?.getBoundingClientRect().bottom ?? 0;
      const safeTop = Math.max(8, headerBottom + 8);
      const spaceAbove = Math.max(0, bounds.top - safeTop - 8);
      const spaceBelow = Math.max(0, window.innerHeight - bounds.bottom - 8);
      // The calendar always uses the compact row sizing, so this measurement is
      // stable and does not depend on which trigger opened the popover.
      const requiredHeight = popover.scrollHeight;
      const openAbove = spaceBelow < requiredHeight && spaceAbove > spaceBelow;
      const availableHeight = openAbove ? spaceAbove : spaceBelow;

      setOpensAbove(openAbove);
      setPopoverMaxHeight(Math.max(120, availableHeight));
    };

    positionPopover();
    window.addEventListener('resize', positionPopover);
    window.addEventListener('scroll', positionPopover, true);

    // Re-measure once layout and fonts settle; web fonts can change row heights
    // after the first pass. Repeating the measurement is safe because it is
    // independent of the previously applied state.
    const frame = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame(positionPopover)
      : null;
    const fontSet = typeof document !== 'undefined' ? document.fonts : undefined;
    fontSet?.ready?.then(() => positionPopover()).catch(() => undefined);

    return () => {
      cancelled = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', positionPopover);
      window.removeEventListener('scroll', positionPopover, true);
    };
  }, [isOpen, isDate]);

  const togglePicker = (event?: React.MouseEvent | React.KeyboardEvent) => {
    event?.preventDefault();
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    alignPopoverToViewport();
    setIsOpen(true);
  };

  return (
    <div ref={wrapperRef} className="om-datetime relative w-full">
      <input
        {...inputProps}
        ref={inputRef}
        type="text"
        inputMode={isDate ? 'numeric' : 'text'}
        value={value}
        defaultValue={defaultValue}
        min={undefined}
        max={undefined}
        step={undefined}
        pattern={isDate ? '\\d{4}-\\d{2}-\\d{2}' : '\\d{2}:\\d{2}'}
        onChange={onChange}
        onClick={event => {
          onClick?.(event);
          if (!event.defaultPrevented) {
            setIsOpen(true);
          }
        }}
        onKeyDown={event => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && (event.key === 'Enter' || event.key === 'ArrowDown')) {
            togglePicker(event);
          }
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`${className} pr-9`}
      />
      <button
        type="button"
        className="om-datetime-trigger"
        aria-label={isDate ? 'Open date picker' : 'Open time picker'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={inputProps.disabled}
        onClick={togglePicker}
      >
        {isDate ? <CalendarDays size={16} /> : <Clock3 size={16} />}
      </button>
      {isOpen && (
        <div
          ref={popoverRef}
          className={`om-datetime-popover ${isDate ? 'om-datetime-calendar' : 'om-datetime-time'}${opensAbove ? ' is-above' : ''}${openMenu ? ' is-menu-open' : ''}`}
          role="dialog"
          aria-label={isDate ? 'Choose a date' : 'Choose a time'}
          style={{ left: `${popoverOffsetX}px`, maxHeight: popoverMaxHeight }}
        >
          {isDate ? (
            <>
              <div className="om-datetime-header">
                <div className="om-datetime-year-month">
                  <div className="om-datetime-select-wrap" ref={yearMenuRef}>
                    <button
                      type="button"
                      className="om-datetime-select"
                      aria-label="Select year"
                      aria-haspopup="listbox"
                      aria-expanded={openMenu === 'year'}
                      onClick={() => setOpenMenu(menu => (menu === 'year' ? null : 'year'))}
                    >
                      <span>{visibleMonth.getFullYear()}</span>
                      <ChevronDown size={14} aria-hidden="true" />
                    </button>
                    {openMenu === 'year' && (
                      <div className="om-datetime-select-menu" role="listbox" aria-label="Years" onKeyDown={handleMenuKeyDown}>
                        {yearOptions.map(year => (
                          <button
                            key={year}
                            type="button"
                            role="option"
                            aria-selected={year === visibleMonth.getFullYear()}
                            onClick={() => {
                              setVisibleMonth(month => new Date(year, month.getMonth(), 1));
                              setOpenMenu(null);
                            }}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="om-datetime-select-wrap" ref={monthMenuRef}>
                    <button
                      type="button"
                      className="om-datetime-select"
                      aria-label="Select month"
                      aria-haspopup="listbox"
                      aria-expanded={openMenu === 'month'}
                      onClick={() => setOpenMenu(menu => (menu === 'month' ? null : 'month'))}
                    >
                      <span>{monthOptions[visibleMonth.getMonth()]}</span>
                      <ChevronDown size={14} aria-hidden="true" />
                    </button>
                    {openMenu === 'month' && (
                      <div className="om-datetime-select-menu" role="listbox" aria-label="Months" onKeyDown={handleMenuKeyDown}>
                        {monthOptions.map((monthLabel, index) => (
                          <button
                            key={monthLabel}
                            type="button"
                            role="option"
                            aria-selected={index === visibleMonth.getMonth()}
                            onClick={() => {
                              setVisibleMonth(month => new Date(month.getFullYear(), index, 1));
                              setOpenMenu(null);
                            }}
                          >
                            {monthLabel}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <span className="om-datetime-nav">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => setVisibleMonth(month => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => setVisibleMonth(month => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                  >
                    <ChevronRight size={17} />
                  </button>
                </span>
              </div>
              <div className="om-datetime-calendar-grid" role="grid">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                  <span key={day} className="om-datetime-weekday" role="columnheader">{day}</span>
                ))}
                {calendarDays.map(date => {
                  const dateValue = formatDate(date);
                  const isSelected = dateValue === currentValue;
                  const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
                  const disabled = !isWithinBounds(date);
                  return (
                    <button
                      key={dateValue}
                      type="button"
                      role="gridcell"
                      aria-label={date.toLocaleDateString()}
                      data-date={dateValue}
                      aria-pressed={isSelected}
                      disabled={disabled}
                      className={`om-datetime-day${isSelected ? ' is-selected' : ''}${!isCurrentMonth ? ' is-outside' : ''}`}
                      onClick={() => {
                        emitValue(dateValue);
                        setIsOpen(false);
                      }}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
              <div className="om-datetime-footer">
                <button
                  type="button"
                  onClick={() => {
                    emitValue('');
                    setIsOpen(false);
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    if (isWithinBounds(today)) emitValue(formatDate(today));
                    setIsOpen(false);
                  }}
                >
                  Today
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="om-datetime-header">
                <strong>Choose time</strong>
                <span className="om-datetime-time-value">{pad(selectedHour)}:{pad(selectedMinute)}</span>
              </div>
              <div className="om-datetime-time-columns">
                <div className="om-datetime-time-list" role="listbox" aria-label="Hours">
                  {Array.from({ length: 24 }, (_, hour) => (
                    <button
                      key={hour}
                      type="button"
                      role="option"
                      aria-selected={selectedHour === hour}
                      className={selectedHour === hour ? 'is-selected' : ''}
                      onClick={() => setSelectedHour(hour)}
                    >
                      {pad(hour)}
                    </button>
                  ))}
                </div>
                <div className="om-datetime-time-list" role="listbox" aria-label="Minutes">
                  {Array.from({ length: 60 }, (_, minute) => (
                    <button
                      key={minute}
                      type="button"
                      role="option"
                      aria-selected={selectedMinute === minute}
                      className={selectedMinute === minute ? 'is-selected' : ''}
                      onClick={() => setSelectedMinute(minute)}
                    >
                      {pad(minute)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="om-datetime-footer">
                <button type="button" onClick={() => setIsOpen(false)}>Cancel</button>
                <button
                  type="button"
                  onClick={() => {
                    emitValue(`${pad(selectedHour)}:${pad(selectedMinute)}`);
                    setIsOpen(false);
                  }}
                >
                  Set time
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
