import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  Star,
  History,
  Copy,
  Check,
  Search,
  ArrowRightLeft,
  Trash2,
  Sparkles,
  Info,
  Sliders
} from 'lucide-react';
import {
  CALCULATOR_CATALOG,
  CALC_UNIT_FACTORS,
  NP_UNITS
} from '../lib/calculatorEngine';
import { getToolConfig } from '../lib/calculatorConfig';
import { InteractiveKeypad } from '../components/InteractiveKeypad';
import { SlideTabs } from '../components/SlideTabs';
import { CalcHistoryItem } from '../types';
import { storage, generateUUID } from '../lib/storage';

interface CalculatorViewProps {
  history: CalcHistoryItem[];
  favorites: string[];
  onRefresh: () => void;
  onSuccess: (msg: string) => void;
}

export const CalculatorView: React.FC<CalculatorViewProps> = ({
  history,
  favorites,
  onRefresh,
  onSuccess
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('quick');
  const [selectedTool, setSelectedTool] = useState<string>('Basic');
  const [searchQuery, setSearchQuery] = useState('');
  const [useKeypad, setUseKeypad] = useState(true);

  // Dynamic input values
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [unitFrom, setUnitFrom] = useState<string>('');
  const [unitTo, setUnitTo] = useState<string>('');
  const [result, setResult] = useState<string>('—');
  const [copied, setCopied] = useState(false);

  const currentConfig = useMemo(() => getToolConfig(selectedTool), [selectedTool]);

  // Set default units and inputs when tool changes
  useEffect(() => {
    const config = getToolConfig(selectedTool);
    const newInputs: Record<string, string> = {};
    config.fields.forEach((f, idx) => {
      newInputs[`f${idx + 1}`] = f.default;
    });
    setInputs(newInputs);

    // Default units for converters
    if (config.isConverter) {
      setUnitFrom(config.defaultUnitFrom || 'm');
      setUnitTo(config.defaultUnitTo || 'ft');
    } else {
      setUnitFrom('');
      setUnitTo('');
    }

    setResult('—');
  }, [selectedTool]);

  // Auto-run calculation when inputs change or tool is selected
  const handleCalculate = async () => {
    try {
      const config = getToolConfig(selectedTool);
      const f1 = inputs.f1 ?? config.fields[0]?.default ?? '';
      const f2 = inputs.f2 ?? config.fields[1]?.default ?? '';
      const f3 = inputs.f3 ?? config.fields[2]?.default ?? '';
      const f4 = inputs.f4 ?? config.fields[3]?.default ?? '';

      const output = config.calculate(f1, f2, f3, f4, unitFrom, unitTo);
      const resString = String(output);
      setResult(resString);

      // Save to calculation history
      const historyItem: CalcHistoryItem = {
        id: generateUUID(),
        tool: selectedTool,
        args: [f1, f2, f3, f4, unitFrom, unitTo].filter(Boolean),
        result: resString,
        createdAt: Date.now()
      };
      await storage.put('calcHistory', historyItem);
      onRefresh();
    } catch (err: any) {
      setResult(`Error: ${err.message || 'Calculation failed'}`);
    }
  };

  const handleKeypadResult = async (expr: string, res: string) => {
    setResult(res);
    const historyItem: CalcHistoryItem = {
      id: generateUUID(),
      tool: selectedTool,
      args: [expr],
      result: `${expr} = ${res}`,
      createdAt: Date.now()
    };
    await storage.put('calcHistory', historyItem);
    onRefresh();
  };

  const handleToggleFavorite = async () => {
    const appSettings = (await storage.getSingleton<any>('appSettings')) || {};
    const favs: string[] = appSettings.calcFavorites || [];
    const isFav = favs.includes(selectedTool);
    const updated = isFav ? favs.filter(f => f !== selectedTool) : [...favs, selectedTool];

    appSettings.calcFavorites = updated;
    await storage.setSingleton('appSettings', appSettings);
    onSuccess(isFav ? `Removed ${selectedTool} from favorites` : `★ Added ${selectedTool} to favorites`);
    onRefresh();
  };

  const handleClearHistory = async () => {
    const all = await storage.getAll<CalcHistoryItem>('calcHistory');
    for (const h of all) {
      await storage.delete('calcHistory', h.id);
    }
    onSuccess('Calculation history cleared');
    onRefresh();
  };

  const handleCopyResult = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    onSuccess('Result copied to clipboard');
  };

  const handleSwapUnits = () => {
    const temp = unitFrom;
    setUnitFrom(unitTo);
    setUnitTo(temp);
  };

  const isFavorite = favorites.includes(selectedTool);

  // Filter tools by search query across all categories or current category
  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) {
      return CALCULATOR_CATALOG[selectedCategory] || [];
    }
    const q = searchQuery.toLowerCase().trim();
    const matches: string[] = [];
    Object.entries(CALCULATOR_CATALOG).forEach(([cat, list]) => {
      list.forEach(t => {
        if (t.toLowerCase().includes(q) || cat.toLowerCase().includes(q)) {
          if (!matches.includes(t)) matches.push(t);
        }
      });
    });
    return matches;
  }, [searchQuery, selectedCategory]);

  // Unit options generator for converter tools
  const renderUnitOptions = () => {
    const cfg = currentConfig;
    if (!cfg.isConverter) return null;

    if (cfg.unitType === 'nepal_land') {
      return Object.keys(NP_UNITS.land).map(u => (
        <option key={u} value={u}>
          {u.replace('_', ' ').toUpperCase()}
        </option>
      ));
    }
    if (cfg.unitType === 'nepal_length') {
      return Object.keys(NP_UNITS.length).map(u => (
        <option key={u} value={u}>
          {u.toUpperCase()}
        </option>
      ));
    }
    if (cfg.unitType === 'nepal_volume') {
      return Object.keys(NP_UNITS.volume).map(u => (
        <option key={u} value={u}>
          {u.toUpperCase()}
        </option>
      ));
    }
    if (cfg.unitType === 'nepal_weight') {
      return Object.keys(NP_UNITS.weight).map(u => (
        <option key={u} value={u}>
          {u.toUpperCase()}
        </option>
      ));
    }
    if (cfg.unitType === 'temp') {
      return [
        <option key="C" value="C">Celsius (°C)</option>,
        <option key="F" value="F">Fahrenheit (°F)</option>,
        <option key="K" value="K">Kelvin (K)</option>
      ];
    }
    if (cfg.unitType === 'currency') {
      return Object.keys(CALC_UNIT_FACTORS.Currency).map(c => (
        <option key={c} value={c}>
          {c}
        </option>
      ));
    }
    if (cfg.unitGroup === 'FuelEconomy' || cfg.name === 'Fuel Economy') {
      return [
        <option key="km_l" value="km_l">Kilometers per Liter (km/L)</option>,
        <option key="l_100km" value="l_100km">Liters per 100 km (L/100km)</option>,
        <option key="mpg_us" value="mpg_us">US Miles per Gallon (US MPG)</option>,
        <option key="mpg_uk" value="mpg_uk">UK Miles per Gallon (UK MPG)</option>
      ];
    }
    if (cfg.unitGroup && CALC_UNIT_FACTORS[cfg.unitGroup]) {
      return Object.keys(CALC_UNIT_FACTORS[cfg.unitGroup]).map(u => (
        <option key={u} value={u}>
          {u.replace('_', ' ')}
        </option>
      ));
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header and Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl flex items-center gap-2">
            <Calculator className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Computational & Multi-Domain Calculator
          </h1>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search 108 calculators..."
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs (Full Width Responsive Slide Tab) */}
      <div className="w-full pb-2 border-b border-slate-200 dark:border-slate-800">
        <SlideTabs
          activeId={selectedCategory}
          onChange={(catKey) => {
            setSelectedCategory(catKey);
            setSearchQuery('');
            const first = CALCULATOR_CATALOG[catKey]?.[0] || 'Basic';
            setSelectedTool(first);
          }}
          tabs={Object.keys(CALCULATOR_CATALOG).map(catKey => ({
            id: catKey,
            label: `${catKey} (${CALCULATOR_CATALOG[catKey]?.length || 0})`,
            shortLabel: catKey
          }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Tool Selector + Calculator Engine (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Tool Pills */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {searchQuery ? `Search Results (${filteredTools.length})` : `${selectedCategory} Tools (${filteredTools.length})`}
              </span>
              <button
                type="button"
                onClick={handleToggleFavorite}
                className={`flex items-center gap-1.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  isFavorite ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                <span>{isFavorite ? 'Favorited' : 'Favorite'}</span>
              </button>
            </div>

            <SlideTabs
              activeId={selectedTool}
              onChange={tool => setSelectedTool(tool)}
              size="sm"
              tabs={filteredTools.map(tool => ({
                id: tool,
                label: tool,
                icon: favorites.includes(tool)
                  ? <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                  : undefined
              }))}
            />
          </div>

          {/* Calculator Workstation Box */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <Calculator className="h-4.5 w-4.5" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {selectedTool} Engine
                </h2>
              </div>
              {(selectedTool === 'Basic' || selectedTool === 'Scientific') && (
                <button
                  type="button"
                  onClick={() => setUseKeypad(!useKeypad)}
                  className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  <Sliders className="h-3 w-3" />
                  <span>{useKeypad ? 'Switch to Form Fields' : 'Switch to Interactive Keypad'}</span>
                </button>
              )}
            </div>

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {currentConfig.description}
            </p>

            {currentConfig.formula && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                <Info className="h-3 w-3" />
                <span>{currentConfig.formula}</span>
              </div>
            )}

            <div className="mt-5 space-y-4">
              {/* If Basic or Scientific and user wants on-screen Keypad */}
              {(selectedTool === 'Basic' || selectedTool === 'Scientific') && useKeypad ? (
                <InteractiveKeypad
                  onComputeResult={handleKeypadResult}
                  isScientific={selectedTool === 'Scientific'}
                />
              ) : (
                /* Dynamic Input Forms for All Tools */
                <div className="space-y-4">
                  <div className={`grid gap-3 ${currentConfig.fields.length >= 3 ? 'grid-cols-1 sm:grid-cols-3' : currentConfig.fields.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                    {currentConfig.fields.map((field, idx) => {
                      const fieldKey = `f${idx + 1}`;
                      const val = inputs[fieldKey] ?? field.default;

                      return (
                        <div key={fieldKey}>
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            {field.label}
                          </label>

                          {field.type === 'select' && field.options ? (
                            <select
                              value={val}
                              onChange={e => setInputs({ ...inputs, [fieldKey]: e.target.value })}
                              className="mt-1 h-9.5 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                              {field.options.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type || 'text'}
                              step={field.step || 'any'}
                              value={val}
                              placeholder={field.placeholder}
                              onChange={e => setInputs({ ...inputs, [fieldKey]: e.target.value })}
                              className="mt-1 h-9.5 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Converter Unit Selector */}
                  {currentConfig.isConverter && (
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center rounded-xl bg-slate-50 p-3 border border-slate-200 dark:bg-slate-800/40 dark:border-slate-800">
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Convert From
                        </label>
                        <select
                          value={unitFrom}
                          onChange={e => setUnitFrom(e.target.value)}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          {renderUnitOptions()}
                        </select>
                      </div>

                      <div className="flex justify-center pt-3 sm:pt-4">
                        <button
                          type="button"
                          onClick={handleSwapUnits}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Swap Units"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Convert To
                        </label>
                        <select
                          value={unitTo}
                          onChange={e => setUnitTo(e.target.value)}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          {renderUnitOptions()}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Calculate Action Button */}
                  <button
                    type="button"
                    onClick={handleCalculate}
                    className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 active:scale-98 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Calculate {selectedTool}</span>
                  </button>
                </div>
              )}

              {/* Formatted Output Container */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                    Computed Output
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyResult}
                    disabled={result === '—'}
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 disabled:opacity-30 dark:text-slate-300 dark:hover:text-indigo-400"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Result</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-2 font-mono text-base font-bold text-slate-900 dark:text-white break-words">
                  {result}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calculation History & Favorites (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Calculation History
                </h2>
              </div>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-700 dark:hover:text-red-400"
                  title="Clear history"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <div className="mt-3 space-y-2.5 max-h-96 overflow-y-auto">
              {history.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No calculations recorded yet.
                </div>
              ) : (
                history
                  .slice()
                  .reverse()
                  .slice(0, 15)
                  .map(h => (
                    <div
                      key={h.id}
                      onClick={() => {
                        setSelectedTool(h.tool);
                        setResult(h.result);
                      }}
                      className="cursor-pointer rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs transition-colors hover:border-indigo-200 hover:bg-indigo-50/30 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-indigo-800"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                        <span>{h.tool}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 break-words font-medium">
                        {h.result}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
