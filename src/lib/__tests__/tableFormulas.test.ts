import { describe, expect, it } from 'vitest';
import {
  columnLabel,
  columnIndex,
  evaluateTableFormula,
  formatCellNumber,
  numbersFromGrid,
  parseCellReference,
  parseRange,
  shiftFormulaReferences,
  statsForValues,
  toNumber
} from '../tableFormulas';

const grid = (rows: string[][]) => rows;

describe('table formulas', () => {
  it('reads A1 style references', () => {
    expect(parseCellReference('A1')).toEqual({ row: 1, col: 1 });
    expect(parseCellReference('b12')).toEqual({ row: 12, col: 2 });
    expect(parseCellReference('AA3')).toEqual({ row: 3, col: 27 });
    expect(parseCellReference('1A')).toBeNull();
    expect(columnLabel(27)).toBe('AA');
    expect(columnIndex('aa')).toBe(27);
    expect(parseRange('A1:B3')).toEqual({ start: { row: 1, col: 1 }, end: { row: 3, col: 2 } });
  });

  it('parses money-ish cell text', () => {
    expect(toNumber('1,250.50')).toBe(1250.5);
    expect(toNumber('₹ 250')).toBe(250);
    expect(toNumber('12%')).toBe(12);
    expect(toNumber('abc')).toBeNull();
    expect(toNumber('')).toBeNull();
  });

  it('sums a range and skips text', () => {
    const data = grid([
      ['10', 'x'],
      ['20', '5'],
      ['30', '']
    ]);
    expect(evaluateTableFormula('=SUM(A1:A3)', { grid: data }).value).toBe(60);
    expect(evaluateTableFormula('=SUM(B1:B3)', { grid: data }).value).toBe(5);
  });

  it('supports aggregates and arithmetic', () => {
    const data = grid([
      ['1', '10'],
      ['2', '20'],
      ['3', '30']
    ]);
    expect(evaluateTableFormula('=AVERAGE(B1:B3)', { grid: data }).value).toBe(20);
    expect(evaluateTableFormula('=MIN(B1:B3)', { grid: data }).value).toBe(10);
    expect(evaluateTableFormula('=MAX(B1:B3)', { grid: data }).value).toBe(30);
    expect(evaluateTableFormula('=COUNT(A1:B3)', { grid: data }).value).toBe(6);
    expect(evaluateTableFormula('=A1*2+B3', { grid: data }).value).toBe(32);
    expect(evaluateTableFormula('=(2+3)*4', { grid: data }).value).toBe(20);
    expect(evaluateTableFormula('=ROUND(10/3, 2)', { grid: data }).value).toBe(3.33);
  });

  it('resolves cell references that hold formulas', () => {
    const data = grid([['4', '', '']]);
    const formulas = new Map([
      ['1:2', '=A1*2'],
      ['1:3', '=SUM(A1:B1)']
    ]);
    expect(evaluateTableFormula('=B1', { grid: data, formulas }).value).toBe(8);
    expect(evaluateTableFormula('=C1', { grid: data, formulas }).value).toBe(12);
  });

  it('reports cycles and errors instead of hanging', () => {
    const data = grid([['', '']]);
    const formulas = new Map([
      ['1:1', '=B1'],
      ['1:2', '=A1']
    ]);
    expect(evaluateTableFormula('=A1', { grid: data, formulas }).error).toBe('#CYCLE!');
    expect(evaluateTableFormula('=1/0', { grid: data }).error).toBe('#DIV/0!');
    expect(evaluateTableFormula('=NOPE(2)', { grid: data }).error).toBe('#NAME?');
  });

  it('supports ABOVE and LEFT keywords from the owning cell', () => {
    const data = grid([
      ['100', '5'],
      ['200', '7'],
      ['', '']
    ]);
    const at = { row: 3, col: 1 };
    expect(evaluateTableFormula('=SUM(ABOVE)', { grid: data, at }).value).toBe(300);
    expect(evaluateTableFormula('=AVERAGE(ABOVE)', { grid: data, at }).value).toBe(150);
    const rowAt = { row: 2, col: 3 };
    expect(evaluateTableFormula('=SUM(LEFT)', { grid: data, at: rowAt }).value).toBe(207);
  });

  it('evaluates a nested formula from its own cell position', () => {
    const data = grid([['h'], ['5'], [''], ['']]);
    const formulas = new Map([
      ['3:1', '=SUM(ABOVE)'],
      ['4:1', '=SUM(A2:A3)']
    ]);
    const at = { row: 4, col: 1 };
    expect(evaluateTableFormula('=SUM(ABOVE)', { grid: data, formulas, at }).value).toBe(10);
    expect(evaluateTableFormula('=A3+A2', { grid: data, formulas, at }).value).toBe(10);
  });

  it('propagates an error that is already displayed in a cell', () => {
    const data = grid([['1'], ['#DIV/0!'], ['']]);
    expect(evaluateTableFormula('=SUM(A1:A2)', { grid: data }).error).toBe('#DIV/0!');
  });
  it('shifts references when rows and columns move', () => {
    expect(shiftFormulaReferences('=SUM(B2:B3)', 'row', 3, 1)).toBe('=SUM(B2:B4)');
    expect(shiftFormulaReferences('=A1+A5', 'row', 2, 1)).toBe('=A1+A6');
    expect(shiftFormulaReferences('=SUM(B2:B3)', 'col', 2, 1)).toBe('=SUM(C2:C3)');
    expect(shiftFormulaReferences('=A1+B5', 'row', 3, -1)).toBe('=A1+B4');
    expect(shiftFormulaReferences('=SUM(B2:B3)', 'row', 3, -1)).toBe('=SUM(B2:B2)');
    expect(shiftFormulaReferences('=SUM(B2:B3)', 'row', 2, -1)).toBe('=SUM(B2:B2)');
    expect(shiftFormulaReferences('=B2', 'row', 2, -1)).toBe('#REF!');
    expect(shiftFormulaReferences('=A1', 'col', 1, -1)).toBe('#REF!');
    expect(evaluateTableFormula('#REF!', { grid: grid([['1']]) }).error).toBe('#REF!');
    expect(shiftFormulaReferences('=SUM(ABOVE)', 'row', 2, 1)).toBe('=SUM(ABOVE)');
  });
  it('formats numbers for display', () => {
    expect(formatCellNumber(1250.5)).toBe('1250.5');
    expect(formatCellNumber(1250.5, '0')).toBe('1251');
    expect(formatCellNumber(1250.5, '0.00')).toBe('1250.50');
    expect(formatCellNumber(1250.5, '#,##0')).toBe('1,251');
    expect(formatCellNumber(0.25, '0%')).toBe('25%');
    expect(formatCellNumber(1234.5, '₹#,##0')).toBe('₹1,235');
    expect(formatCellNumber(1234.5, '₹#,##0.00')).toBe('₹1,234.50');
    expect(formatCellNumber(-1234.5, '₹#,##0.00')).toBe('-₹1,234.50');
  });

  it('collects numbers and stats for the status bar', () => {
    const data = grid([['1', 'a'], ['2', '3']]);
    expect(numbersFromGrid(data)).toEqual([1, 2, 3]);
    const stats = statsForValues([1, 2, 3]);
    expect(stats.count).toBe(3);
    expect(stats.sum).toBe(6);
    expect(stats.average).toBe(2);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(3);
    expect(statsForValues([]).average).toBeNull();
  });
});
