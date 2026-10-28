import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Delete, Check, Copy } from 'lucide-react';
import { calculatorEngine } from '../lib/calculatorEngine';
import { soundEngine } from '../lib/soundEngine';

interface InteractiveKeypadProps {
  onComputeResult?: (expr: string, res: string) => void;
  isScientific?: boolean;
  initialExpression?: string;
}

export const InteractiveKeypad: React.FC<InteractiveKeypadProps> = ({
  onComputeResult,
  isScientific = false,
  initialExpression
}) => {
  const [expression, setExpression] = useState(initialExpression || '');
  const [livePreview, setLivePreview] = useState<string>('');
  const [memory, setMemory] = useState<number | null>(null);
  const [angleMode, setAngleMode] = useState<'deg' | 'rad'>('deg');
  const [isSecondMode, setIsSecondMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastAnswer, setLastAnswer] = useState<string>('');

  const inputRef = useRef<HTMLInputElement>(null);

  // Sync initial expression if provided
  useEffect(() => {
    if (initialExpression !== undefined && initialExpression !== null) {
      setExpression(initialExpression);
    }
  }, [initialExpression]);

  // Real-time live preview calculation as user types or presses keys
  useEffect(() => {
    const trimmed = expression.trim();
    if (!trimmed) {
      setLivePreview('');
      setErrorMsg(null);
      return;
    }

    // Don't evaluate if trailing with unclosed operator or single parenthesis
    const endsWithOperator = /[+\-*/^×÷−]$/.test(trimmed);
    if (endsWithOperator) {
      return;
    }

    try {
      const res = calculatorEngine.scientific(trimmed, angleMode);
      if (typeof res === 'number' && Number.isFinite(res)) {
        setLivePreview(res.toLocaleString(undefined, { maximumFractionDigits: 10 }));
        setErrorMsg(null);
      } else if (typeof res === 'string' && res !== 'Undefined / NaN' && res !== 'Infinity') {
        setLivePreview(res);
        setErrorMsg(null);
      } else {
        setLivePreview('');
      }
    } catch {
      // Don't show error while still typing incomplete expression
      setLivePreview('');
    }
  }, [expression, angleMode]);

  // Insert token at current cursor position or append
  const insertToken = useCallback((token: string) => {
    soundEngine.play('calcKey');
    setExpression(prev => {
      // If previous was an error or empty
      if (prev === 'Error') return token;
      return prev + token;
    });
    setErrorMsg(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleClear = () => {
    soundEngine.play('tap');
    setExpression('');
    setLivePreview('');
    setErrorMsg(null);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleBackspace = () => {
    soundEngine.play('calcKey');
    setExpression(prev => {
      if (!prev || prev === 'Error') return '';
      // Check for multi-char function tokens like 'sqrt(', 'sin(', 'cbrt('
      const fnMatches = ['sqrt(', 'cbrt(', 'asin(', 'acos(', 'atan(', 'sin(', 'cos(', 'tan(', 'log(', 'ln(', 'abs('];
      for (const fn of fnMatches) {
        if (prev.endsWith(fn)) {
          return prev.slice(0, -fn.length);
        }
      }
      return prev.slice(0, -1);
    });
    setErrorMsg(null);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleEquals = () => {
    if (!expression.trim()) return;
    try {
      const calcResult = calculatorEngine.scientific(expression, angleMode);
      const resStr = String(calcResult);
      if (resStr.includes('Invalid') || resStr === 'Undefined / NaN') {
        soundEngine.play('taskUncheck');
        setErrorMsg('Invalid mathematical expression');
        return;
      }
      soundEngine.play('calcEquals');
      setLastAnswer(resStr);
      setExpression(resStr);
      setLivePreview('');
      setErrorMsg(null);

      if (onComputeResult) {
        onComputeResult(expression, resStr);
      }
    } catch (err: any) {
      soundEngine.play('taskUncheck');
      setErrorMsg(err.message || 'Invalid syntax');
    }
    if (inputRef.current) inputRef.current.focus();
  };

  const handleToggleSign = () => {
    soundEngine.play('calcKey');
    setExpression(prev => {
      if (!prev) return '-';
      // Find the last number in expression
      const match = prev.match(/(-?\d+(?:\.\d+)?)$/);
      if (match) {
        const numStr = match[1];
        const index = match.index!;
        const prefix = prev.slice(0, index);
        if (numStr.startsWith('-')) {
          return prefix + numStr.slice(1);
        } else {
          return prefix + '-' + numStr;
        }
      }
      return prev + '-';
    });
  };

  const handleMemoryAdd = () => {
    soundEngine.play('calcKey');
    try {
      const val = parseFloat(livePreview || expression);
      if (!Number.isNaN(val)) {
        setMemory(prev => (prev === null ? val : prev + val));
      }
    } catch {}
  };

  const handleMemorySub = () => {
    soundEngine.play('calcKey');
    try {
      const val = parseFloat(livePreview || expression);
      if (!Number.isNaN(val)) {
        setMemory(prev => (prev === null ? -val : prev - val));
      }
    } catch {}
  };

  const handleMemoryRecall = () => {
    soundEngine.play('calcKey');
    if (memory !== null) {
      insertToken(String(memory));
    }
  };

  const handleMemoryStore = () => {
    soundEngine.play('calcKey');
    try {
      const val = parseFloat(livePreview || expression);
      if (!Number.isNaN(val)) {
        setMemory(val);
      }
    } catch {}
  };

  const handleCopy = () => {
    const textToCopy = livePreview || expression || '0';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Keyboard navigation support
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEquals();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClear();
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 sm:gap-4">
      {/* Top Controls & Status Bar */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {/* Deg / Rad Toggle */}
          <div className="flex items-center gap-2" role="group" aria-label="Angle unit">
            <button
              type="button"
              aria-pressed={angleMode === 'deg'}
              onClick={() => setAngleMode('deg')}
              className={`border-b-0 border-transparent px-1.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                angleMode === 'deg'
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
              }`}
              title="Degrees"
            >
              DEG
            </button>
            <button
              type="button"
              aria-pressed={angleMode === 'rad'}
              onClick={() => setAngleMode('rad')}
              className={`border-b-0 border-transparent px-1.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                angleMode === 'rad'
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-amber-800 hover:border-amber-500 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200'
              }`}
              title="Radians"
            >
              RAD
            </button>
          </div>

          {/* Memory Status Badge */}
          {memory !== null && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
              M = {memory}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 cursor-pointer"
            title="Copy current expression or result"
          >
            {copied ? (
              <span className="text-emerald-500 font-bold flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Copied
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Copy className="h-3.5 w-3.5" /> Copy
              </span>
            )}
          </button>

          {lastAnswer && (
            <button
              type="button"
              onClick={() => insertToken(lastAnswer)}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              title="Insert last evaluated answer (Ans)"
            >
              Ans ({lastAnswer})
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Formula Display & Live Output */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 shadow-xs flex flex-col justify-between min-h-[72px] cursor-text transition-all focus-within:border-indigo-500 dark:focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/10"
      >
        {/* Top auxiliary line: Shows uppercase tool name and live preview or error */}
        <div className="flex items-center justify-between text-xs font-mono h-4">
          <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
            {isScientific ? 'SCIENTIFIC' : 'BASIC'}
          </span>
          {errorMsg ? (
            <span className="text-rose-500 font-semibold text-xs">{errorMsg}</span>
          ) : livePreview ? (
            <span className="text-indigo-600 dark:text-indigo-400 font-bold text-xs bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
              = {livePreview}
            </span>
          ) : null}
        </div>

        {/* Primary Input / Expression line */}
        <input
          ref={inputRef}
          type="text"
          value={expression}
          onChange={e => {
            setExpression(e.target.value);
            setErrorMsg(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="0"
          className="calc-display-input w-full bg-transparent border-0 p-0 text-right font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-0 leading-normal"
        />
      </div>

      {/* Memory Action Ribbon */}
      <div className="grid grid-cols-5 gap-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setMemory(null)}
          disabled={memory === null}
          className="h-9 sm:h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300 transition-all cursor-pointer disabled:cursor-not-allowed text-xs flex items-center justify-center font-bold"
          title="Memory Clear"
        >
          MC
        </button>
        <button
          type="button"
          onClick={handleMemoryRecall}
          disabled={memory === null}
          className="h-9 sm:h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300 transition-all cursor-pointer disabled:cursor-not-allowed text-xs flex items-center justify-center font-bold"
          title="Memory Recall"
        >
          MR
        </button>
        <button
          type="button"
          onClick={handleMemoryAdd}
          className="h-9 sm:h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-all cursor-pointer text-xs flex items-center justify-center font-bold"
          title="Memory Add"
        >
          M+
        </button>
        <button
          type="button"
          onClick={handleMemorySub}
          className="h-9 sm:h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-all cursor-pointer text-xs flex items-center justify-center font-bold"
          title="Memory Subtract"
        >
          M-
        </button>
        <button
          type="button"
          onClick={handleMemoryStore}
          className="h-9 sm:h-10 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 transition-all cursor-pointer text-xs flex items-center justify-center font-bold"
          title="Memory Store"
        >
          MS
        </button>
      </div>

      {/* Scientific Functions Grid */}
      {isScientific && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              FUNCTIONS
            </span>
            <button
              type="button"
              onClick={() => setIsSecondMode(prev => !prev)}
              className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold transition-all cursor-pointer ${
                isSecondMode
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              2nd
            </button>
          </div>

          <div className="grid grid-cols-6 gap-1.5 sm:gap-2 text-xs font-mono font-medium">
            {/* Row 1: Trig & Logs */}
            <button
              type="button"
              onClick={() => insertToken(isSecondMode ? 'asin(' : 'sin(')}
              className="h-9.5 rounded-xl bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 cursor-pointer flex items-center justify-center"
              title={isSecondMode ? 'Arcsine' : 'Sine'}
            >
              {isSecondMode ? 'sin⁻¹' : 'sin'}
            </button>
            <button
              type="button"
              onClick={() => insertToken(isSecondMode ? 'acos(' : 'cos(')}
              className="h-9.5 rounded-xl bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 cursor-pointer flex items-center justify-center"
              title={isSecondMode ? 'Arccosine' : 'Cosine'}
            >
              {isSecondMode ? 'cos⁻¹' : 'cos'}
            </button>
            <button
              type="button"
              onClick={() => insertToken(isSecondMode ? 'atan(' : 'tan(')}
              className="h-9.5 rounded-xl bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 cursor-pointer flex items-center justify-center"
              title={isSecondMode ? 'Arctangent' : 'Tangent'}
            >
              {isSecondMode ? 'tan⁻¹' : 'tan'}
            </button>
            <button
              type="button"
              onClick={() => insertToken(isSecondMode ? '10^(' : 'log(')}
              className="h-9.5 rounded-xl bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 cursor-pointer flex items-center justify-center"
              title={isSecondMode ? '10 to the power of x' : 'Log base 10'}
            >
              {isSecondMode ? '10ˣ' : 'log'}
            </button>
            <button
              type="button"
              onClick={() => insertToken(isSecondMode ? 'exp(' : 'ln(')}
              className="h-9.5 rounded-xl bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 cursor-pointer flex items-center justify-center"
              title={isSecondMode ? 'e to the power of x' : 'Natural logarithm'}
            >
              {isSecondMode ? 'eˣ' : 'ln'}
            </button>
            <button
              type="button"
              onClick={() => insertToken('!')}
              className="h-9.5 rounded-xl bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 cursor-pointer font-bold flex items-center justify-center"
              title="Factorial (x!)"
            >
              x!
            </button>

            {/* Row 2: Powers, Roots, Inverses */}
            <button
              type="button"
              onClick={() => insertToken('^2')}
              className="h-9.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 cursor-pointer flex items-center justify-center"
              title="Square (x²)"
            >
              x²
            </button>
            <button
              type="button"
              onClick={() => insertToken('^3')}
              className="h-9.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 cursor-pointer flex items-center justify-center"
              title="Cube (x³)"
            >
              x³
            </button>
            <button
              type="button"
              onClick={() => insertToken('^')}
              className="h-9.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 cursor-pointer flex items-center justify-center"
              title="Power (xʸ)"
            >
              xʸ
            </button>
            <button
              type="button"
              onClick={() => insertToken('sqrt(')}
              className="h-9.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 cursor-pointer flex items-center justify-center"
              title="Square root (√)"
            >
              √x
            </button>
            <button
              type="button"
              onClick={() => insertToken('cbrt(')}
              className="h-9.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 cursor-pointer flex items-center justify-center"
              title="Cube root (∛)"
            >
              ∛x
            </button>
            <button
              type="button"
              onClick={() => insertToken('1/(')}
              className="h-9.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 cursor-pointer flex items-center justify-center"
              title="Reciprocal (1/x)"
            >
              1/x
            </button>

            {/* Row 3: Constants & Parentheses */}
            <button
              type="button"
              onClick={() => insertToken('abs(')}
              className="h-9.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 cursor-pointer flex items-center justify-center"
              title="Absolute value |x|"
            >
              |x|
            </button>
            <button
              type="button"
              onClick={() => insertToken('pi')}
              className="h-9.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 cursor-pointer flex items-center justify-center"
              title="Pi (π ≈ 3.14159)"
            >
              π
            </button>
            <button
              type="button"
              onClick={() => insertToken('e')}
              className="h-9.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 cursor-pointer flex items-center justify-center"
              title="Euler's number (e ≈ 2.71828)"
            >
              e
            </button>
            <button
              type="button"
              onClick={() => insertToken('(')}
              className="h-9.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 cursor-pointer font-bold flex items-center justify-center"
            >
              (
            </button>
            <button
              type="button"
              onClick={() => insertToken(')')}
              className="h-9.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 cursor-pointer font-bold flex items-center justify-center"
            >
              )
            </button>
            <button
              type="button"
              onClick={() => insertToken('%')}
              className="h-9.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 cursor-pointer font-bold flex items-center justify-center"
              title="Percentage / Modulo"
            >
              %
            </button>
          </div>
        </div>
      )}

      {/* Primary Keypad Grid */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {/* Row 1 */}
        <button
          type="button"
          onClick={handleClear}
          className="h-13 sm:h-15 rounded-2xl bg-rose-50 text-rose-600 font-extrabold hover:bg-rose-100 active:scale-98 dark:bg-rose-950/40 dark:text-rose-400 transition-all cursor-pointer text-base sm:text-lg flex items-center justify-center shadow-2xs"
          title="All Clear (AC)"
        >
          AC
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          className="h-13 sm:h-15 rounded-2xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 active:scale-98 dark:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer flex items-center justify-center shadow-2xs"
          title="Backspace / Delete"
        >
          <Delete className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => insertToken('%')}
          className="h-13 sm:h-15 rounded-2xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 active:scale-98 dark:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer text-base sm:text-lg flex items-center justify-center shadow-2xs"
          title="Percentage"
        >
          %
        </button>
        <button
          type="button"
          onClick={() => insertToken(' / ')}
          className="h-13 sm:h-15 rounded-2xl bg-orange-50 text-orange-600 font-black hover:bg-orange-100 active:scale-98 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950/60 transition-all cursor-pointer text-xl sm:text-2xl flex items-center justify-center shadow-2xs"
          title="Divide"
        >
          ÷
        </button>

        {/* Row 2: 7, 8, 9, Multiply */}
        <button
          type="button"
          onClick={() => insertToken('7')}
          className="h-13 sm:h-15 rounded-2xl border border-slate-200/90 bg-white text-lg sm:text-xl font-bold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-98 dark:border-slate-750 dark:bg-slate-800 dark:text-white transition-all cursor-pointer flex items-center justify-center"
        >
          7
        </button>
        <button
          type="button"
          onClick={() => insertToken('8')}
          className="h-13 sm:h-15 rounded-2xl border border-slate-200/90 bg-white text-lg sm:text-xl font-bold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-98 dark:border-slate-750 dark:bg-slate-800 dark:text-white transition-all cursor-pointer flex items-center justify-center"
        >
          8
        </button>
        <button
          type="button"
          onClick={() => insertToken('9')}
          className="h-13 sm:h-15 rounded-2xl border border-slate-200/90 bg-white text-lg sm:text-xl font-bold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-98 dark:border-slate-750 dark:bg-slate-800 dark:text-white transition-all cursor-pointer flex items-center justify-center"
        >
          9
        </button>
        <button
          type="button"
          onClick={() => insertToken(' * ')}
          className="h-13 sm:h-15 rounded-2xl bg-orange-50 text-orange-600 font-black hover:bg-orange-100 active:scale-98 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950/60 transition-all cursor-pointer text-xl sm:text-2xl flex items-center justify-center shadow-2xs"
          title="Multiply"
        >
          ×
        </button>

        {/* Row 3: 4, 5, 6, Subtract */}
        <button
          type="button"
          onClick={() => insertToken('4')}
          className="h-13 sm:h-15 rounded-2xl border border-slate-200/90 bg-white text-lg sm:text-xl font-bold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-98 dark:border-slate-750 dark:bg-slate-800 dark:text-white transition-all cursor-pointer flex items-center justify-center"
        >
          4
        </button>
        <button
          type="button"
          onClick={() => insertToken('5')}
          className="h-13 sm:h-15 rounded-2xl border border-slate-200/90 bg-white text-lg sm:text-xl font-bold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-98 dark:border-slate-750 dark:bg-slate-800 dark:text-white transition-all cursor-pointer flex items-center justify-center"
        >
          5
        </button>
        <button
          type="button"
          onClick={() => insertToken('6')}
          className="h-13 sm:h-15 rounded-2xl border border-slate-200/90 bg-white text-lg sm:text-xl font-bold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-98 dark:border-slate-750 dark:bg-slate-800 dark:text-white transition-all cursor-pointer flex items-center justify-center"
        >
          6
        </button>
        <button
          type="button"
          onClick={() => insertToken(' - ')}
          className="h-13 sm:h-15 rounded-2xl bg-orange-50 text-orange-600 font-black hover:bg-orange-100 active:scale-98 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950/60 transition-all cursor-pointer text-xl sm:text-2xl flex items-center justify-center shadow-2xs"
          title="Subtract"
        >
          −
        </button>

        {/* Row 4: 1, 2, 3, Add */}
        <button
          type="button"
          onClick={() => insertToken('1')}
          className="h-13 sm:h-15 rounded-2xl border border-slate-200/90 bg-white text-lg sm:text-xl font-bold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-98 dark:border-slate-750 dark:bg-slate-800 dark:text-white transition-all cursor-pointer flex items-center justify-center"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => insertToken('2')}
          className="h-13 sm:h-15 rounded-2xl border border-slate-200/90 bg-white text-lg sm:text-xl font-bold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-98 dark:border-slate-750 dark:bg-slate-800 dark:text-white transition-all cursor-pointer flex items-center justify-center"
        >
          2
        </button>
        <button
          type="button"
          onClick={() => insertToken('3')}
          className="h-13 sm:h-15 rounded-2xl border border-slate-200/90 bg-white text-lg sm:text-xl font-bold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-98 dark:border-slate-750 dark:bg-slate-800 dark:text-white transition-all cursor-pointer flex items-center justify-center"
        >
          3
        </button>
        <button
          type="button"
          onClick={() => insertToken(' + ')}
          className="h-13 sm:h-15 rounded-2xl bg-orange-50 text-orange-600 font-black hover:bg-orange-100 active:scale-98 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950/60 transition-all cursor-pointer text-xl sm:text-2xl flex items-center justify-center shadow-2xs"
          title="Add"
        >
          +
        </button>

        {/* Row 5: Sign Toggle, 0, Decimal, Equals */}
        <button
          type="button"
          onClick={handleToggleSign}
          className="h-13 sm:h-15 rounded-2xl border border-slate-200/90 bg-white text-base sm:text-lg font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-98 dark:border-slate-750 dark:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer flex items-center justify-center"
          title="Toggle positive/negative (±)"
        >
          ±
        </button>
        <button
          type="button"
          onClick={() => insertToken('0')}
          className="h-13 sm:h-15 rounded-2xl border border-slate-200/90 bg-white text-lg sm:text-xl font-bold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-98 dark:border-slate-750 dark:bg-slate-800 dark:text-white transition-all cursor-pointer flex items-center justify-center"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => insertToken('.')}
          className="h-13 sm:h-15 rounded-2xl border border-slate-200/90 bg-white text-lg sm:text-xl font-bold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-98 dark:border-slate-750 dark:bg-slate-800 dark:text-white transition-all cursor-pointer flex items-center justify-center"
        >
          .
        </button>
        <button
          type="button"
          onClick={handleEquals}
          className="h-13 sm:h-15 rounded-2xl bg-indigo-600 text-2xl sm:text-3xl font-black text-white shadow-md hover:bg-indigo-500 active:scale-98 transition-all cursor-pointer flex items-center justify-center"
          title="Calculate result (=)"
        >
          =
        </button>
      </div>
    </div>
  );
};
