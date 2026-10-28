import { describe, it, expect } from 'vitest';
import {
  adToBs,
  bsToAd,
  omNepaliDigits,
  omPad,
  omIsoDate,
  OM_BS_START_AD,
} from '../nepaliDate';

describe('BS <-> AD conversion', () => {
  it('maps the BS epoch start to OM_BS_START_AD', () => {
    expect(bsToAd('1978-01-01').iso).toBe(OM_BS_START_AD);
    expect(adToBs(OM_BS_START_AD).year).toBe(1978);
    expect(adToBs(OM_BS_START_AD).month).toBe(1);
    expect(adToBs(OM_BS_START_AD).day).toBe(1);
  });

  it('maps Nepali New Year 2082 to 2025-04-14', () => {
    const bs = adToBs('2025-04-14');
    expect(bs.year).toBe(2082);
    expect(bs.month).toBe(1);
    expect(bs.day).toBe(1);
  });

  it.each([
    '2025-04-14',
    '2026-10-28',
    '2000-01-01',
    '1990-06-15',
    '2035-12-31',
  ])('roundtrips %s through adToBs -> bsToAd', iso => {
    const bs = adToBs(iso);
    const back = bsToAd(bs.iso);
    expect(back.iso).toBe(iso);
  });
});

describe('formatting helpers', () => {
  it('omPad pads to two digits', () => {
    expect(omPad(5)).toBe('05');
    expect(omPad(12)).toBe('12');
  });

  it('omNepaliDigits converts arabic digits', () => {
    expect(omNepaliDigits('2079-01-01')).toBe('२०७९-०१-०१');
    expect(omNepaliDigits(42)).toBe('४२');
  });

  it('omIsoDate zero-pads components', () => {
    expect(omIsoDate(2082, 1, 1)).toBe('2082-01-01');
  });
});