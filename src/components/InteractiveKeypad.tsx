import React, { useState } from 'react';
import { Delete, Check } from 'lucide-react';
import { calculatorEngine } from '../lib/calculatorEngine';

interface InteractiveKeypadProps {
  onComputeResult?: (expr: string, res: string) => void;
  isScientific?: boolean;
}

export const InteractiveKeypad: React.FC<InteractiveKeypadProps> = ({
  onComputeResult,
  isScientific = false
}) => {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [memory, setMemory] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const handleDigit = (d: string) => {
    setDisplay(prev => {
      if (prev === '0' || prev === 'Error') return d;
      return prev + d;
    });
  };

  const handleDecimal = () => {
    setDisplay(prev => {
      if (prev.includes('.')) return prev;
      return prev + '.';
    });
  };

  const handleClear = () => {
    setDisplay('0');
    setExpression('');
  };

  const handleBackspace = () => {
    setDisplay(prev => {
      if (prev.length <= 1 || prev === 'Error') return '0';
      return prev.slice(0, -1);
    });
  };

  const handleOperator = (op: string) => {
    setExpression(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const handleScientificFunction = (fn: string) => {
    setDisplay(prev => `${fn}(${prev === '0' ? '' : prev}`);
  };

  const handleEquals = () => {
    try {
      const fullExpr = expression ? `${expression}${display}` : display;
      const cleanExpr = fullExpr.replace(/×/g, '*').replace(/÷/g, '/');
      const calcResult = calculatorEngine.scientific(cleanExpr);
      const resStr = String(calcResult);
      setDisplay(resStr);
      setExpression('');
      if (onComputeResult) {
        onComputeResult(fullExpr, resStr);
      }
    } catch {
      setDisplay('Error');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
      {/* Display Screen */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-right font-mono dark:border-slate-800 dark:bg-slate-950/80">
        <div className="min-h-5 text-xs text-slate-400 overflow-x-auto truncate">
          {expression || '\u00A0'}
        </div>
        <div className="flex items-center justify-between mt-1">
          <button
            type="button"
            onClick={handleCopy}
            className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            title="Copy Display"
          >
            {copied ? <span className="text-emerald-500 font-bold flex items-center gap-0.5"><Check className="h-3 w-3" /> Copied</span> : 'Copy'}
          </button>
          <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white overflow-x-auto">
            {display}
          </div>
        </div>
      </div>

      {/* Memory & Quick Action Buttons */}
      <div className="grid grid-cols-4 gap-1.5 mt-3 text-xs font-semibold">
        <button
          type="button"
          onClick={() => {
            const val = parseFloat(display);
            if (!Number.isNaN(val)) setMemory(val);
          }}
          className="rounded-lg bg-slate-100 py-1.5 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
        >
          M+
        </button>
        <button
          type="button"
          onClick={() => {
            if (memory !== null) setDisplay(String(memory));
          }}
          disabled={memory === null}
          className="rounded-lg bg-slate-100 py-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300"
        >
          MR
        </button>
        <button
          type="button"
          onClick={() => setMemory(null)}
          disabled={memory === null}
          className="rounded-lg bg-slate-100 py-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300"
        >
          MC
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-lg bg-red-50 text-red-600 font-bold py-1.5 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400"
        >
          AC
        </button>
      </div>

      {/* Scientific Row if enabled */}
      {isScientific && (
        <div className="grid grid-cols-5 gap-1.5 mt-2 text-[11px] font-mono font-semibold">
          <button
            type="button"
            onClick={() => handleScientificFunction('sin')}
            className="rounded-lg bg-indigo-50 py-1.5 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
          >
            sin
          </button>
          <button
            type="button"
            onClick={() => handleScientificFunction('cos')}
            className="rounded-lg bg-indigo-50 py-1.5 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
          >
            cos
          </button>
          <button
            type="button"
            onClick={() => handleScientificFunction('tan')}
            className="rounded-lg bg-indigo-50 py-1.5 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
          >
            tan
          </button>
          <button
            type="button"
            onClick={() => handleScientificFunction('sqrt')}
            className="rounded-lg bg-indigo-50 py-1.5 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
          >
            √
          </button>
          <button
            type="button"
            onClick={() => handleDigit('^')}
            className="rounded-lg bg-indigo-50 py-1.5 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
          >
            xʸ
          </button>
          <button
            type="button"
            onClick={() => handleScientificFunction('log')}
            className="rounded-lg bg-indigo-50 py-1.5 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
          >
            log
          </button>
          <button
            type="button"
            onClick={() => handleScientificFunction('ln')}
            className="rounded-lg bg-indigo-50 py-1.5 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
          >
            ln
          </button>
          <button
            type="button"
            onClick={() => handleDigit('pi')}
            className="rounded-lg bg-indigo-50 py-1.5 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
          >
            π
          </button>
          <button
            type="button"
            onClick={() => handleDigit('(')}
            className="rounded-lg bg-indigo-50 py-1.5 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
          >
            (
          </button>
          <button
            type="button"
            onClick={() => handleDigit(')')}
            className="rounded-lg bg-indigo-50 py-1.5 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
          >
            )
          </button>
        </div>
      )}

      {/* Main Standard Keypad */}
      <div className="grid grid-cols-4 gap-2 mt-2">
        <button
          type="button"
          onClick={() => handleDigit('(')}
          className="rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
        >
          (
        </button>
        <button
          type="button"
          onClick={() => handleDigit(')')}
          className="rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
        >
          )
        </button>
        <button
          type="button"
          onClick={() => handleOperator('%')}
          className="rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
        >
          %
        </button>
        <button
          type="button"
          onClick={() => handleOperator('÷')}
          className="rounded-xl bg-amber-500/10 py-3 text-sm font-bold text-amber-600 hover:bg-amber-500/20 dark:bg-amber-950/50 dark:text-amber-400"
        >
          ÷
        </button>

        <button
          type="button"
          onClick={() => handleDigit('7')}
          className="rounded-xl bg-white border border-slate-200 py-3 text-base font-semibold text-slate-900 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          7
        </button>
        <button
          type="button"
          onClick={() => handleDigit('8')}
          className="rounded-xl bg-white border border-slate-200 py-3 text-base font-semibold text-slate-900 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          8
        </button>
        <button
          type="button"
          onClick={() => handleDigit('9')}
          className="rounded-xl bg-white border border-slate-200 py-3 text-base font-semibold text-slate-900 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          9
        </button>
        <button
          type="button"
          onClick={() => handleOperator('×')}
          className="rounded-xl bg-amber-500/10 py-3 text-sm font-bold text-amber-600 hover:bg-amber-500/20 dark:bg-amber-950/50 dark:text-amber-400"
        >
          ×
        </button>

        <button
          type="button"
          onClick={() => handleDigit('4')}
          className="rounded-xl bg-white border border-slate-200 py-3 text-base font-semibold text-slate-900 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          4
        </button>
        <button
          type="button"
          onClick={() => handleDigit('5')}
          className="rounded-xl bg-white border border-slate-200 py-3 text-base font-semibold text-slate-900 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          5
        </button>
        <button
          type="button"
          onClick={() => handleDigit('6')}
          className="rounded-xl bg-white border border-slate-200 py-3 text-base font-semibold text-slate-900 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          6
        </button>
        <button
          type="button"
          onClick={() => handleOperator('-')}
          className="rounded-xl bg-amber-500/10 py-3 text-sm font-bold text-amber-600 hover:bg-amber-500/20 dark:bg-amber-950/50 dark:text-amber-400"
        >
          -
        </button>

        <button
          type="button"
          onClick={() => handleDigit('1')}
          className="rounded-xl bg-white border border-slate-200 py-3 text-base font-semibold text-slate-900 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => handleDigit('2')}
          className="rounded-xl bg-white border border-slate-200 py-3 text-base font-semibold text-slate-900 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          2
        </button>
        <button
          type="button"
          onClick={() => handleDigit('3')}
          className="rounded-xl bg-white border border-slate-200 py-3 text-base font-semibold text-slate-900 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          3
        </button>
        <button
          type="button"
          onClick={() => handleOperator('+')}
          className="rounded-xl bg-amber-500/10 py-3 text-sm font-bold text-amber-600 hover:bg-amber-500/20 dark:bg-amber-950/50 dark:text-amber-400"
        >
          +
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          className="rounded-xl bg-slate-100 py-3 text-slate-600 hover:bg-slate-200 flex items-center justify-center dark:bg-slate-800 dark:text-slate-300"
          title="Backspace"
        >
          <Delete className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="rounded-xl bg-white border border-slate-200 py-3 text-base font-semibold text-slate-900 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleDecimal}
          className="rounded-xl bg-white border border-slate-200 py-3 text-base font-semibold text-slate-900 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          .
        </button>
        <button
          type="button"
          onClick={handleEquals}
          className="rounded-xl bg-indigo-600 py-3 text-base font-bold text-white shadow-sm hover:bg-indigo-500 active:scale-98"
        >
          =
        </button>
      </div>
    </div>
  );
};
