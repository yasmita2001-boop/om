import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyAccent,
  rememberAccentChoice,
  resolveSavedAccent,
  restoreSavedAccent,
  DEFAULT_ACCENT_HEX
} from '../accentTheme';

const readStyle = (prop: string) =>
  document.documentElement.style.getPropertyValue(prop);

describe('applyAccent', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('style');
  });

  it('applies the brand variable and stores it', () => {
    expect(applyAccent('#f97316')).toBe('#f97316');
    expect(readStyle('--color-brand')).toBe('#f97316');
    expect(localStorage.getItem('om_accent')).toBe('#f97316');
  });

  it('picks dark text for light accents (lime)', () => {
    applyAccent('#84cc16');
    expect(readStyle('--om-on-accent')).toBe('#1e293b');
  });

  it('picks white text for dark accents (indigo)', () => {
    applyAccent('#6366f1');
    expect(readStyle('--om-on-accent')).toBe('#ffffff');
  });

  it('normalizes 3-digit hex', () => {
    expect(applyAccent('#abc')).toBe('#aabbcc');
  });

  it('falls back to the default accent for invalid input', () => {
    expect(applyAccent('not-a-color')).toBe(DEFAULT_ACCENT_HEX);
    expect(readStyle('--color-brand')).toBe(DEFAULT_ACCENT_HEX);
  });

  it('restoreSavedAccent reads the persisted value', () => {
    localStorage.setItem('om_accent', '#e11d48');
    restoreSavedAccent();
    expect(readStyle('--color-brand')).toBe('#e11d48');
  });

  it('migrates the former default accent to the sanctuary theme', () => {
    localStorage.setItem('om_accent', '#6366f1');
    restoreSavedAccent();
    expect(readStyle('--color-brand')).toBe(DEFAULT_ACCENT_HEX);
  });

  it('preserves an explicitly selected legacy accent', () => {
    rememberAccentChoice(true);
    expect(resolveSavedAccent('#6366f1')).toBe('#6366f1');
  });
});