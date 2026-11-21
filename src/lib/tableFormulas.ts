// Excel-style helpers for the note tables: cell references (A1, B2), ranges
// (A1:B10), aggregate functions (SUM, AVERAGE, MIN, MAX, COUNT, ...) and
// number formatting. Kept free of DOM access so it can be unit tested.

export type CellGrid = string[][];

export interface CellPosition {
  /** 1-based, like Excel (A1 = row 1, column 1). */
  row: number;
  col: number;
}

export interface FormulaOptions {
  grid: CellGrid;
  /** Formulas of other cells, keyed `${row}:${col}` (1-based). */
  formulas?: Map<string, string>;
  /** Position of the cell that owns this formula. */
  at?: CellPosition;
}

export interface FormulaResult {
  value: number | null;
  error?: string;
}

export const FORMULA_ERRORS = {
  div: '#DIV/0!',
  ref: '#REF!',
  name: '#NAME?',
  value: '#VALUE!',
  cycle: '#CYCLE!'
} as const;

class FormulaError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const cellText = (grid: CellGrid, row: number, col: number): string => {
  const line = grid[row - 1];
  if (!line) return '';
  const raw = line[col - 1];
  return typeof raw === 'string' ? raw : '';
};

/** Turns "1,250.50" or "₹ 250" into 1250.5. Returns null for anything else. */
export function toNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw)
    .replace(/\u00a0/g, ' ')
    .replace(/[,\s₹$€£¥]/g, '')
    .replace(/%$/, '')
    .trim();
  if (!cleaned) return null;
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function columnLabel(index: number): string {
  let value = Math.max(1, index);
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

export function columnIndex(label: string): number | null {
  const upper = label.trim().toUpperCase();
  if (!/^[A-Z]{1,2}$/.test(upper)) return null;
  let total = 0;
  for (const char of upper) total = total * 26 + (char.charCodeAt(0) - 64);
  return total;
}

const REF_PATTERN = /^\$?([A-Za-z]{1,2})\$?(\d{1,3})$/;

export function parseCellReference(reference: string): CellPosition | null {
  const match = REF_PATTERN.exec(reference.trim());
  if (!match) return null;
  const col = columnIndex(match[1]);
  const row = Number(match[2]);
  if (!col || !row) return null;
  return { row, col };
}

const RANGE_PATTERN = /^\$?([A-Za-z]{1,2})\$?(\d{1,3})\s*:\s*\$?([A-Za-z]{1,2})\$?(\d{1,3})$/;

export interface CellRange {
  start: CellPosition;
  end: CellPosition;
}

export function parseRange(reference: string): CellRange | null {
  const match = RANGE_PATTERN.exec(reference.trim());
  if (!match) return null;
  const startCol = columnIndex(match[1]);
  const endCol = columnIndex(match[3]);
  const startRow = Number(match[2]);
  const endRow = Number(match[4]);
  if (!startCol || !endCol || !startRow || !endRow) return null;
  return {
    start: { row: Math.min(startRow, endRow), col: Math.min(startCol, endCol) },
    end: { row: Math.max(startRow, endRow), col: Math.max(startCol, endCol) }
  };
}

export function formatCellNumber(value: number, format?: string): string {
  if (!Number.isFinite(value)) return '';
  switch ((format || '').trim()) {
    case '0':
      return String(Math.round(value));
    case '0.0':
      return value.toFixed(1);
    case '0.00':
      return value.toFixed(2);
    case '#,##0':
      return Math.round(value).toLocaleString('en-IN');
    case '#,##0.00':
      return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case '0%':
      return `${Number((value * 100).toFixed(2))}%`;
    case '₹#,##0':
    case '₹#,##0.00': {
      const digits = (format || '').includes('.') ? 2 : 0;
      const amount = Math.abs(value).toLocaleString('en-IN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
      return `${value < 0 ? '-' : ''}₹${amount}`;
    }
    default: {
      const rounded = Number(value.toFixed(4));
      return String(rounded);
    }
  }
}

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'name'; value: string }
  | { kind: 'ref'; value: string }
  | { kind: 'range'; value: string }
  | { kind: 'op'; value: string }
  | { kind: 'paren'; value: '(' | ')' }
  | { kind: 'comma'; value: ',' | ';' };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let raw = '';
      while (index < input.length && /[0-9.]/.test(input[index])) raw += input[index++];
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new FormulaError(FORMULA_ERRORS.value);
      tokens.push({ kind: 'number', value });
      continue;
    }
    if (/[A-Za-z$]/.test(char)) {
      let raw = '';
      while (index < input.length && /[A-Za-z0-9$:]/.test(input[index])) raw += input[index++];
      if (raw.includes(':')) tokens.push({ kind: 'range', value: raw });
      else if (parseCellReference(raw)) tokens.push({ kind: 'ref', value: raw });
      else tokens.push({ kind: 'name', value: raw.toUpperCase() });
      continue;
    }
    if ('+-*/^'.includes(char)) {
      tokens.push({ kind: 'op', value: char });
      index += 1;
      continue;
    }
    if (char === '(' || char === ')') {
      tokens.push({ kind: 'paren', value: char as '(' | ')' });
      index += 1;
      continue;
    }
    if (char === ',' || char === ';') {
      tokens.push({ kind: 'comma', value: char as ',' | ';' });
      index += 1;
      continue;
    }
    throw new FormulaError(FORMULA_ERRORS.name);
  }
  return tokens;
}

const AGGREGATES = new Set(['SUM', 'AVERAGE', 'AVG', 'MEAN', 'MIN', 'MAX', 'COUNT', 'PRODUCT', 'MEDIAN']);

class Evaluator {
  private tokens: Token[];
  private cursor = 0;

  constructor(
    formula: string,
    private options: FormulaOptions,
    private seen: Set<string>
  ) {
    this.tokens = tokenize(formula);
  }

  private peek(): Token | undefined {
    return this.tokens[this.cursor];
  }

  private next(): Token | undefined {
    return this.tokens[this.cursor++];
  }

  private expectClosing(): void {
    const token = this.next();
    if (!token || token.kind !== 'paren' || token.value !== ')') {
      throw new FormulaError(FORMULA_ERRORS.value);
    }
  }

  /** Resolves a single cell to a number (following its own formula if any). */
  private cellNumber(position: CellPosition): number | null {
    const key = `${position.row}:${position.col}`;
    if (this.seen.has(key)) throw new FormulaError(FORMULA_ERRORS.cycle);
    const formula = this.options.formulas?.get(key);
    if (formula) {
      // The nested formula must be evaluated from its OWN position, otherwise
      // ABOVE/BELOW inside it would resolve against the caller's cell.
      const result = evaluateTableFormula(
        formula,
        { ...this.options, at: position },
        new Set(this.seen).add(key)
      );
      if (result.error) throw new FormulaError(result.error);
      return result.value;
    }
    const raw = cellText(this.options.grid, position.row, position.col).trim();
    // An error that is already displayed propagates like it does in Excel.
    const shownError = Object.values(FORMULA_ERRORS).find(code => code === raw);
    if (shownError) throw new FormulaError(shownError);
    return toNumber(raw);
  }

  private rangeNumbers(range: CellRange): number[] {
    const numbers: number[] = [];
    for (let row = range.start.row; row <= range.end.row; row += 1) {
      for (let col = range.start.col; col <= range.end.col; col += 1) {
        const value = this.cellNumber({ row, col });
        if (value !== null) numbers.push(value);
      }
    }
    return numbers;
  }

  private keywordNumbers(keyword: string): number[] {
    const at = this.options.at;
    if (!at) throw new FormulaError(FORMULA_ERRORS.ref);
    const rows = this.options.grid.length;
    const cols = Math.max(0, ...this.options.grid.map(line => line.length));
    if (keyword === 'ABOVE') return this.rangeNumbers({ start: { row: 1, col: at.col }, end: { row: at.row - 1, col: at.col } });
    if (keyword === 'BELOW') return this.rangeNumbers({ start: { row: at.row + 1, col: at.col }, end: { row: rows, col: at.col } });
    if (keyword === 'LEFT') return this.rangeNumbers({ start: { row: at.row, col: 1 }, end: { row: at.row, col: at.col - 1 } });
    if (keyword === 'RIGHT') return this.rangeNumbers({ start: { row: at.row, col: at.col + 1 }, end: { row: at.row, col: cols } });
    if (keyword === 'ALL') return this.rangeNumbers({ start: { row: 1, col: 1 }, end: { row: Math.max(1, rows), col: Math.max(1, cols) } });
    throw new FormulaError(FORMULA_ERRORS.name);
  }

  private aggregate(name: string, values: number[]): number {
    switch (name) {
      case 'SUM':
        return values.reduce((total, value) => total + value, 0);
      case 'PRODUCT':
        return values.length === 0 ? 0 : values.reduce((total, value) => total * value, 1);
      case 'AVERAGE':
        if (values.length === 0) throw new FormulaError(FORMULA_ERRORS.div);
        return values.reduce((total, value) => total + value, 0) / values.length;
      case 'MIN':
        if (values.length === 0) throw new FormulaError(FORMULA_ERRORS.value);
        return Math.min(...values);
      case 'MAX':
        if (values.length === 0) throw new FormulaError(FORMULA_ERRORS.value);
        return Math.max(...values);
      case 'COUNT':
        return values.length;
      case 'MEDIAN': {
        if (values.length === 0) throw new FormulaError(FORMULA_ERRORS.value);
        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
      }
      default:
        throw new FormulaError(FORMULA_ERRORS.name);
    }
  }

  /** Flattens everything an argument list produced into plain numbers. */
  private argumentNumbers(values: (number | number[])[]): number[] {
    const flat: number[] = [];
    values.forEach(value => {
      if (Array.isArray(value)) flat.push(...value);
      else flat.push(value);
    });
    return flat;
  }

  parseExpression(): number {
    let total = this.parseTerm();
    for (;;) {
      const token = this.peek();
      if (!token || token.kind !== 'op' || (token.value !== '+' && token.value !== '-')) break;
      this.next();
      const right = this.parseTerm();
      total = token.value === '+' ? total + right : total - right;
    }
    return total;
  }

  private parseTerm(): number {
    let total = this.parseUnary();
    for (;;) {
      const token = this.peek();
      if (!token || token.kind !== 'op' || (token.value !== '*' && token.value !== '/')) break;
      this.next();
      const right = this.parseUnary();
      if (token.value === '*') {
        total *= right;
      } else {
        if (right === 0) throw new FormulaError(FORMULA_ERRORS.div);
        total /= right;
      }
    }
    return total;
  }

  private parseUnary(): number {
    const token = this.peek();
    if (token && token.kind === 'op' && (token.value === '-' || token.value === '+')) {
      this.next();
      const value = this.parseUnary();
      return token.value === '-' ? -value : value;
    }
    return this.parsePower();
  }

  private parsePower(): number {
    const primary = this.parsePrimary();
    if (Array.isArray(primary)) throw new FormulaError(FORMULA_ERRORS.value);
    const base = primary;
    const token = this.peek();
    if (token && token.kind === 'op' && token.value === '^') {
      this.next();
      return base ** this.parseUnary();
    }
    return base;
  }

  private parsePrimary(): number | number[] {
    const token = this.next();
    if (!token) throw new FormulaError(FORMULA_ERRORS.value);

    if (token.kind === 'number') return token.value;

    if (token.kind === 'paren' && token.value === '(') {
      const value = this.parseExpression();
      this.expectClosing();
      return value;
    }

    if (token.kind === 'ref') {
      const position = parseCellReference(token.value);
      if (!position) throw new FormulaError(FORMULA_ERRORS.ref);
      const value = this.cellNumber(position);
      return value === null ? 0 : value;
    }

    if (token.kind === 'range') {
      const range = parseRange(token.value);
      if (!range) throw new FormulaError(FORMULA_ERRORS.ref);
      return this.rangeNumbers(range);
    }

    if (token.kind === 'name') {
      const name = token.value;
      const after = this.peek();
      if (after && after.kind === 'paren' && after.value === '(') {
        this.next();
        const args: (number | number[])[] = [];
        const closer = this.peek();
        if (closer && closer.kind === 'paren' && closer.value === ')') {
          this.next();
        } else {
          for (;;) {
            args.push(this.parseArgument());
            const separator = this.next();
            if (!separator) throw new FormulaError(FORMULA_ERRORS.value);
            if (separator.kind === 'paren' && separator.value === ')') break;
            if (separator.kind !== 'comma') throw new FormulaError(FORMULA_ERRORS.value);
          }
        }
        return this.callFunction(name, args);
      }
      if (name === 'TRUE') return 1;
      if (name === 'FALSE') return 0;
      if (name === 'PI') return Math.PI;
      if (name === 'ABOVE' || name === 'BELOW' || name === 'LEFT' || name === 'RIGHT' || name === 'ALL') {
        return this.keywordNumbers(name);
      }
      throw new FormulaError(FORMULA_ERRORS.name);
    }

    throw new FormulaError(FORMULA_ERRORS.value);
  }

  private parseArgument(): number | number[] {
    const token = this.peek();
    if (token && token.kind === 'name') {
      const following = this.tokens[this.cursor + 1];
      const isCall = following && following.kind === 'paren' && following.value === '(';
      if (!isCall) {
        this.next();
        if (token.value === 'ABOVE' || token.value === 'BELOW' || token.value === 'LEFT' || token.value === 'RIGHT' || token.value === 'ALL') {
          return this.keywordNumbers(token.value);
        }
        if (token.value === 'TRUE') return 1;
        if (token.value === 'FALSE') return 0;
        if (token.value === 'PI') return Math.PI;
        throw new FormulaError(FORMULA_ERRORS.name);
      }
    }
    if (token && token.kind === 'range') {
      this.next();
      const range = parseRange(token.value);
      if (!range) throw new FormulaError(FORMULA_ERRORS.ref);
      return this.rangeNumbers(range);
    }
    return this.parseExpression();
  }

  private callFunction(rawName: string, args: (number | number[])[]): number {
    const name = rawName === 'AVG' || rawName === 'MEAN' ? 'AVERAGE' : rawName;
    if (AGGREGATES.has(name)) return this.aggregate(name, this.argumentNumbers(args));
    if (AGGREGATES.has(rawName)) return this.aggregate(rawName, this.argumentNumbers(args));

    const numbers = this.argumentNumbers(args);
    switch (name) {
      case 'ROUND': {
        const decimals = args[1] !== undefined && !Array.isArray(args[1]) ? Math.trunc(args[1]) : 0;
        const factor = 10 ** decimals;
        return Math.round(numbers[0] * factor) / factor;
      }
      case 'ABS':
        return Math.abs(numbers[0]);
      case 'SQRT':
        if (numbers[0] < 0) throw new FormulaError(FORMULA_ERRORS.value);
        return Math.sqrt(numbers[0]);
      case 'POWER':
        return numbers[0] ** (numbers[1] ?? 1);
      case 'MOD':
        if (!numbers[1]) throw new FormulaError(FORMULA_ERRORS.div);
        return numbers[0] % numbers[1];
      default:
        throw new FormulaError(FORMULA_ERRORS.name);
    }
  }
}

export function evaluateTableFormula(
  formula: string,
  options: FormulaOptions,
  seen: Set<string> = new Set()
): FormulaResult {
  const source = String(formula || '').trim().replace(/^=/, '');
  if (!source) return { value: null };
  // A reference shifted away collapses to a bare error code, which must stay
  // an error instead of being re-parsed as a name.
  const storedError = Object.values(FORMULA_ERRORS).find(code => code === source);
  if (storedError) return { value: null, error: storedError };
  try {
    const evaluator = new Evaluator(source, options, seen);
    const value = evaluator.parseExpression();
    if (!Number.isFinite(value)) return { value: null };
    return { value };
  } catch (error) {
    if (error instanceof FormulaError) return { value: null, error: error.code };
    return { value: null, error: FORMULA_ERRORS.value };
  }
}

/**
 * Keeps every A1/B2 style reference pointing at the same data when rows or
 * columns are inserted or removed, exactly like a spreadsheet does.
 * `at` and `delta` are 1-based / +1 for insert, -1 for delete.
 */
export function shiftFormulaReferences(
  formula: string,
  axis: 'row' | 'col',
  at: number,
  delta: number
): string {
  const source = String(formula || '');
  if (!source || !Number.isFinite(at) || !Number.isFinite(delta) || delta === 0) return source;

  const REF = /\$?([A-Za-z]{1,2})\$?(\d{1,3})(?:\s*:\s*\$?([A-Za-z]{1,2})\$?(\d{1,3}))?/g;
  let broken = false;

  /** Moves a [start, end] span for one axis. Deleting shrinks the span. */
  const adjust = (startValue: number, endValue: number, isAxis: boolean): [number, number] => {
    if (!isAxis) return [startValue, endValue];
    if (delta > 0) {
      return [
        startValue >= at ? startValue + delta : startValue,
        endValue >= at ? endValue + delta : endValue
      ];
    }
    if (endValue < at) return [startValue, endValue];
    if (startValue > at) return [startValue - 1, endValue - 1];
    if (startValue === at && endValue === at) {
      broken = true;
      return [startValue, endValue];
    }
    // The deleted line was a boundary: the span now stops one step earlier.
    return [startValue, endValue - 1];
  };

  const rewritten = source.replace(REF, (match, col1: string, row1: string, col2?: string, row2?: string) => {
    const startCol = columnIndex(col1);
    if (!startCol) return match;
    const endCol = col2 ? columnIndex(col2) : null;
    const startRow = Number(row1);
    const endRow = row2 ? Number(row2) : startRow;
    if (!startRow) return match;

    const [nextStartRow, nextEndRow] = adjust(startRow, endRow, axis === 'row');
    const [nextStartCol, nextEndCol] = adjust(startCol, endCol ?? startCol, axis === 'col');
    if (broken || nextStartRow < 1 || nextStartCol < 1) return match;
    if (!endCol) return `${columnLabel(nextStartCol)}${nextStartRow}`;
    return `${columnLabel(nextStartCol)}${nextStartRow}:${columnLabel(nextEndCol)}${nextEndRow ?? nextStartRow}`;
  });

  return broken ? FORMULA_ERRORS.ref : rewritten;
}
/** Stats shown for a column, like Excel's status bar. */
export interface RangeStats {
  count: number;
  sum: number;
  average: number | null;
  min: number | null;
  max: number | null;
}

export function statsForValues(values: number[]): RangeStats {
  if (values.length === 0) {
    return { count: 0, sum: 0, average: null, min: null, max: null };
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    count: values.length,
    sum,
    average: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values)
  };
}

export function numbersFromGrid(grid: CellGrid, range?: CellRange): number[] {
  if (!range) {
    return grid.flatMap(line => line.map(cell => toNumber(cell)).filter((value): value is number => value !== null));
  }
  const numbers: number[] = [];
  for (let row = range.start.row; row <= range.end.row; row += 1) {
    for (let col = range.start.col; col <= range.end.col; col += 1) {
      const value = toNumber(cellText(grid, row, col));
      if (value !== null) numbers.push(value);
    }
  }
  return numbers;
}
