import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';

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
  const isDate = type === 'date';
  const currentValue = String(value ?? defaultValue ?? '');
  const parsedDate = isDate ? parseDate(currentValue) : null;
  const [isOpen, setIsOpen] = useState(false);
  const [opensAbove, setOpensAbove] = useState(false);
  const [popoverOffsetX, setPopoverOffsetX] = useState(0);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = parsedDate || new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [selectedHour, setSelectedHour] = useState(Number(currentValue.slice(0, 2)) || 0);
  const [selectedMinute, setSelectedMinute] = useState(Number(currentValue.slice(3, 5)) || 0);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node) || !wrapperRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

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

  const togglePicker = (event?: React.MouseEvent | React.KeyboardEvent) => {
    event?.preventDefault();
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    const bounds = wrapperRef.current?.getBoundingClientRect();
    const popupHeight = isDate ? 350 : 340;
    setOpensAbove(Boolean(bounds && window.innerHeight - bounds.bottom < popupHeight && bounds.top > popupHeight));
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
            const bounds = wrapperRef.current?.getBoundingClientRect();
            const popupHeight = isDate ? 350 : 340;
            setOpensAbove(Boolean(bounds && window.innerHeight - bounds.bottom < popupHeight && bounds.top > popupHeight));
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
          className={`om-datetime-popover ${isDate ? 'om-datetime-calendar' : 'om-datetime-time'}${opensAbove ? ' is-above' : ''}`}
          role="dialog"
          aria-label={isDate ? 'Choose a date' : 'Choose a time'}
          style={{ left: `${popoverOffsetX}px` }}
        >
          {isDate ? (
            <>
              <div className="om-datetime-header">
                <strong>
                  {visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </strong>
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
