import { useState, useEffect } from 'react';
import { RecurrenceConfig, RecurrenceFrequency, RecurrenceEndType } from '../types';
import { Repeat, Calendar, AlertCircle } from 'lucide-react';
import { getRecurrenceDescription, getUpcomingOccurrences, isValidRecurrenceConfig, createDefaultRecurrenceConfig } from '../lib/recurrenceEngine';

interface RecurrenceSelectorProps {
  value: RecurrenceConfig | undefined;
  onChange: (config: RecurrenceConfig | undefined) => void;
  startDate?: string;
}

export function RecurrenceSelector({ value, onChange, startDate }: RecurrenceSelectorProps) {
  const [isEnabled, setIsEnabled] = useState(!!value);
  const [config, setConfig] = useState<RecurrenceConfig>(value || createDefaultRecurrenceConfig());

  useEffect(() => {
    if (isEnabled) {
      onChange(config);
    } else {
      onChange(undefined);
    }
  }, [isEnabled, config]);

  const updateConfig = (updates: Partial<RecurrenceConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const dummyTask = { id: 'preview', recurringConfig: config, date: startDate || new Date().toISOString().split('T')[0] };
  const upcomingDates = isEnabled ? getUpcomingOccurrences(dummyTask as any, 3) : [];
  const isValid = isValidRecurrenceConfig(config);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-slate-600" />
          <Repeat className="h-3.5 w-3.5" />
          Recurring Task
        </label>
      </div>

      {isEnabled && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-600 dark:text-slate-400">Frequency</label>
              <select value={config.frequency} onChange={e => updateConfig({ frequency: e.target.value as RecurrenceFrequency })} className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-600 dark:text-slate-400">Every</label>
              <div className="flex gap-1">
                <input type="number" min="1" max="365" value={config.interval} onChange={e => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  updateConfig({ interval: Number.isFinite(parsed) ? Math.min(365, Math.max(1, parsed)) : 1 });
                }} className="h-8 w-16 rounded-lg border border-slate-200 bg-white px-2 text-center text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
                <span className="flex h-8 items-center rounded-lg border border-slate-200 bg-slate-100 px-2 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400">
                  {config.frequency === 'daily' ? 'day(s)' : config.frequency === 'weekly' ? 'week(s)' : config.frequency === 'monthly' ? 'month(s)' : 'year(s)'}
                </span>
              </div>
            </div>
          </div>

          {config.frequency === 'weekly' && (
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-slate-600 dark:text-slate-400">Repeat on</label>
              <div className="flex gap-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => {
                  const isSelected = config.weekDays?.includes(idx);
                  return (
                    <button key={idx} type="button" onClick={() => {
                      const current = config.weekDays || [];
                      const updated = isSelected ? current.filter(d => d !== idx) : [...current, idx].sort();
                      updateConfig({ weekDays: updated });
                    }} className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[10px] font-medium text-slate-600 dark:text-slate-400">Ends</label>
            <select value={config.endType} onChange={e => updateConfig({ endType: e.target.value as RecurrenceEndType })} className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white">
              <option value="never">Never</option>
              <option value="after">After occurrences</option>
              <option value="by_date">On date</option>
            </select>
          </div>

          {config.endType === 'after' && (
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-600 dark:text-slate-400">Number of occurrences</label>
              <input type="number" min="1" max="999" value={config.endAfterOccurrences || 10} onChange={e => {
                const parsed = Number.parseInt(e.target.value, 10);
                updateConfig({ endAfterOccurrences: Number.isFinite(parsed) ? Math.min(999, Math.max(1, parsed)) : 10 });
              }} className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
          )}

          {config.endType === 'by_date' && (
            <div>
              <label className="mb-1 block text-[10px] font-medium text-slate-600 dark:text-slate-400">End date</label>
              <input type="date" value={config.endByDate || ''} onChange={e => updateConfig({ endByDate: e.target.value })} className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
          )}

          {!isValid && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 dark:bg-amber-900/20">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-[10px] text-amber-700 dark:text-amber-300">Please complete the recurrence configuration</p>
            </div>
          )}

          <div className="rounded-lg bg-blue-50 p-2.5 dark:bg-blue-900/20">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
              <Calendar className="h-3 w-3" />
              Schedule Preview
            </div>
            <p className="text-[11px] font-medium text-blue-900 dark:text-blue-200">{getRecurrenceDescription(config)}</p>
            {upcomingDates.length > 0 && (
              <div className="mt-2 space-y-0.5">
                <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400">Next occurrences:</p>
                {upcomingDates.map((date, i) => (
                  <p key={i} className="text-[10px] text-blue-700 dark:text-blue-300">
                    {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
