// 108-tool Comprehensive Calculator & Computational Engine
// Fully restored, thoroughly verified mathematical formulas and conversion factors

export const CALCULATOR_CATALOG: Record<string, string[]> = Object.freeze({
  quick: ['Basic', 'Scientific', 'Percentage', 'Fraction', 'Ratio', 'Average', 'Discount', 'Tip', 'Bill Split', 'Tax'],
  money: ['EMI / Loan', 'Simple Interest', 'Compound Interest', 'SIP / Investment', 'Savings', 'ROI', 'Profit & Loss', 'Inflation', 'Salary', 'Markup', 'Margin', 'Break-even', 'CAGR', 'Growth', 'Pricing'],
  gold: ['Gold Value', 'Gold Rate × Weight', 'Gold Weight Converter', 'Karat ↔ Purity', 'Pure Gold Weight', 'Jewellery Price', 'Making Charge', 'Wastage', 'GST / Tax', 'Buy / Sell Value', 'Silver Value'],
  health: ['BMI', 'BMR', 'TDEE', 'Calories', 'Macros', 'Body Fat', 'Water Intake', 'Running Pace', 'Age', 'Ideal Body Weight'],
  time: ['Date Difference', 'Age', 'Countdown', 'Working Days', 'Date Add / Subtract', 'Time Difference', 'Time Zone Offset', 'Unix Timestamp', 'Weekday'],
  converter: ['Length', 'Weight', 'Area', 'Volume', 'Temperature', 'Speed', 'Time', 'Energy', 'Pressure', 'Power', 'Data Size', 'Currency', 'Nepal Land', 'Nepal Length', 'Nepal Volume', 'Nepal Weight'],
  home: ['Room Area', 'Paint', 'Flooring', 'Tiles', 'Construction', 'Electricity Cost', 'Water Usage'],
  vehicle: ['Mileage', 'Fuel Cost', 'Trip Fuel', 'Running Cost', 'Vehicle Loan', 'Fuel Economy'],
  travel: ['Trip Budget', 'Distance', 'Travel Time', 'Fuel Budget', 'Travel Currency', 'Travel Time Zone'],
  business: ['Revenue', 'Margin', 'Markup', 'Break-even', 'CAGR', 'Business ROI', 'Growth', 'Pricing'],
  programmer: ['Binary', 'Decimal', 'Hexadecimal', 'Octal', 'Base Converter', 'Bitwise', 'Modulo', 'Data Size', 'Unix Timestamp', 'IP / Subnet']
});

export const NP_UNITS = {
  land: {
    sq_m: 1,
    sq_ft: 0.09290304,
    ropani: 5476 * 0.09290304, // 508.737 sq m
    aana: 342.25 * 0.09290304,  // 31.796 sq m
    paisa: 85.5625 * 0.09290304, // 7.949 sq m
    daam: 21.390625 * 0.09290304, // 1.987 sq m
    bigha: 72900 * 0.09290304, // 6772.63 sq m
    kattha: 3645 * 0.09290304, // 338.63 sq m
    dhur: 182.25 * 0.09290304  // 16.93 sq m
  },
  length: {
    m: 1,
    ft: 0.3048,
    in: 0.0254,
    angul: 0.01905,
    bitta: 0.2286,
    haat: 0.4572,
    danda: 1.8288,
    gaj: 0.9144,
    janjir: 4.1148,
    kosh: 3657.6
  },
  volume: {
    liter: 1,
    muri: 20 * 4.54596, // 90.9192 L
    pathi: 4.54596,
    kurwa: 1.13649,
    mana: 0.568245,
    chauthai: 0.14206125,
    muthi: 0.0568245
  },
  weight: {
    kg: 1,
    g: 0.001,
    tola: 0.0116638125, // 11.6638 g
    chatak: 0.0583190625, // 5 tola = 58.32 g
    seer: 0.933105, // 80 tola = 0.933 kg
    dharn: 2.3327625, // 1 Dharni = 200 tola = 2.3328 kg
    maund: 37.3242 // 40 seer = 37.324 kg
  }
};

export const CALC_UNIT_FACTORS: Record<string, Record<string, number>> = {
  Length: {
    m: 1,
    km: 1000,
    cm: 0.01,
    mm: 0.001,
    ft: 0.3048,
    in: 0.0254,
    yd: 0.9144,
    mi: 1609.344,
    nautical_mi: 1852
  },
  Weight: {
    g: 0.001,
    kg: 1,
    mg: 0.000001,
    lb: 0.45359237,
    oz: 0.028349523125,
    ton: 1000,
    tola: 0.0116638125,
    quintal: 100
  },
  Area: {
    sq_m: 1,
    sq_km: 1e6,
    sq_ft: 0.09290304,
    sq_yd: 0.83612736,
    acre: 4046.8564224,
    hectare: 10000
  },
  Volume: {
    liter: 1,
    ml: 0.001,
    m3: 1000,
    gallon: 3.785411784,
    quart: 0.946352946,
    pint: 0.473176473,
    cup: 0.2365882365,
    fl_oz: 0.0295735295625
  },
  Speed: {
    mps: 1,
    kmh: 0.2777777778,
    mph: 0.44704,
    knot: 0.5144444444
  },
  Time: {
    second: 1,
    minute: 60,
    hour: 3600,
    day: 86400,
    week: 604800,
    month: 2629746, // average month
    year: 31556952
  },
  Energy: {
    joule: 1,
    kj: 1000,
    calorie: 4.184,
    kcal: 4184,
    wh: 3600,
    kwh: 3600000,
    btu: 1055.06
  },
  Pressure: {
    pa: 1,
    kpa: 1000,
    bar: 100000,
    psi: 6894.757293,
    atm: 101325,
    mmhg: 133.322
  },
  Power: {
    w: 1,
    kw: 1000,
    hp: 745.6998716,
    mw: 1000000
  },
  Gold: {
    g: 1,
    kg: 1000,
    tola: 11.6638125,
    pav: 116.638125,
    aana: 0.728988,
    ratti: 0.121498,
    troy_oz: 31.1034768
  },
  DataSize: {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
    PB: 1024 ** 5
  },
  Currency: {
    USD: 1.0,
    INR: 86.85,
    NPR: 138.96,
    EUR: 0.92,
    GBP: 0.79,
    AUD: 1.54,
    CAD: 1.38,
    JPY: 154.5,
    CNY: 7.24,
    AED: 3.67,
    SAR: 3.75,
    QAR: 3.64,
    KWD: 0.31,
    SGD: 1.34,
    THB: 35.8
  },
  FuelEconomy: {
    km_l: 1,
    l_100km: 1,
    mpg_us: 1,
    mpg_uk: 1
  }
};

const n = (v: any): number => {
  const x = Number(v);
  if (!Number.isFinite(x)) throw new Error('Invalid number');
  return x;
};

const pos = (v: any): number => {
  const x = n(v);
  if (x <= 0) throw new Error('Value must be greater than zero');
  return x;
};

const nonNeg = (v: any): number => {
  const x = n(v);
  if (x < 0) throw new Error('Value cannot be negative');
  return x;
};

const gcd = (a: number, b: number): number => {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
};

const dateObj = (v: any): Date => {
  if (!v) throw new Error('Date is required');
  const d = v instanceof Date ? new Date(v.getTime()) : new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date/time format');
  return d;
};

export class CalculatorEngine {
  // ===================== QUICK CALCULATORS =====================
  basic(a: any, op: string, b: any): number | string {
    const na = n(a);
    const nb = n(b);
    if (op === '+') return na + nb;
    if (op === '-') return na - nb;
    if (op === '*' || op === '×') return na * nb;
    if (op === '/' || op === '÷') {
      if (nb === 0) return 'Cannot divide by zero';
      return na / nb;
    }
    if (op === '%') {
      if (nb === 0) return 'Cannot modulo by zero';
      return na % nb;
    }
    if (op === '^' || op === '**') return Math.pow(na, nb);
    throw new Error('Unsupported operation: ' + op);
  }

  scientific(expr: string): number | string {
    const s = String(expr).trim().toLowerCase();
    if (!s) return 0;
    if (!/^[0-9+\-*/%().,\s_a-z^]+$/.test(s)) throw new Error('Invalid characters in mathematical expression');

    const sanitized = s
      .replace(/\^/g, '**')
      .replace(/pi/g, 'Math.PI')
      .replace(/e\b/g, 'Math.E')
      .replace(/sqrt\(/g, 'Math.sqrt(')
      .replace(/abs\(/g, 'Math.abs(')
      .replace(/log\(/g, 'Math.log10(')
      .replace(/ln\(/g, 'Math.log(')
      .replace(/sin\(/g, 'Math.sin((Math.PI/180)*')
      .replace(/cos\(/g, 'Math.cos((Math.PI/180)*')
      .replace(/tan\(/g, 'Math.tan((Math.PI/180)*')
      .replace(/asin\(/g, '(180/Math.PI)*Math.asin(')
      .replace(/acos\(/g, '(180/Math.PI)*Math.acos(')
      .replace(/atan\(/g, '(180/Math.PI)*Math.atan(');

    // Validate identifiers allowed
    const remainingAlpha = sanitized.replace(/Math\.(PI|E|sqrt|abs|log10|log|sin|cos|tan|asin|acos|atan)/g, '');
    if (/[a-z]/i.test(remainingAlpha)) {
      throw new Error('Unsupported function or identifier in expression');
    }

    try {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${sanitized})`)();
      if (typeof result !== 'number' || !Number.isFinite(result)) {
        if (Number.isNaN(result)) return 'Undefined / NaN';
        return 'Infinity';
      }
      return Number(result.toFixed(8));
    } catch {
      throw new Error('Invalid mathematical syntax');
    }
  }

  percentage(value: any, pct: any): number {
    return (n(value) * n(pct)) / 100;
  }

  percentageAdvanced(valueA: any, valueB: any, mode = 'pctOf'): string {
    const a = n(valueA);
    const b = n(valueB);
    if (mode === 'pctOf') {
      const res = (a * b) / 100;
      return `${b}% of ${a} = ${res.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
    }
    if (mode === 'whatPct') {
      if (b === 0) return 'Cannot divide by 0';
      const pct = (a / b) * 100;
      return `${a} is ${pct.toFixed(2)}% of ${b}`;
    }
    if (mode === 'increase') {
      if (a === 0) return 'Base value cannot be 0';
      const diff = b - a;
      const pct = (diff / a) * 100;
      return `${pct >= 0 ? 'Increase' : 'Decrease'}: ${Math.abs(pct).toFixed(2)}% (Diff: ${diff >= 0 ? '+' : ''}${diff})`;
    }
    return `${(a * b) / 100}`;
  }

  fraction(a: any, b: any): number {
    const na = Math.trunc(n(a));
    const nb = Math.trunc(n(b));
    if (!nb) throw new Error('Denominator cannot be zero');
    return na / nb;
  }

  simplifyFraction(a: any, b: any): string {
    const na = Math.trunc(n(a));
    const nb = Math.trunc(n(b));
    if (!nb) throw new Error('Denominator cannot be zero');
    const d = gcd(na, nb);
    const sign = (na * nb < 0) ? '-' : '';
    const num = Math.abs(na / d);
    const den = Math.abs(nb / d);
    const dec = (na / nb).toFixed(4);
    if (den === 1) return `${sign}${num} (Decimal: ${dec})`;
    return `${sign}${num} / ${den} (Decimal: ${dec})`;
  }

  ratio(a: any, b: any): string {
    const na = Math.trunc(n(a));
    const nb = Math.trunc(n(b));
    if (na === 0 && nb === 0) return '0 : 0';
    const d = gcd(na, nb);
    return `${na / d} : ${nb / d}`;
  }

  ratioDivide(total: any, a: any, b: any): string {
    const t = n(total);
    const ra = pos(a);
    const rb = pos(b);
    const sum = ra + rb;
    const shareA = (t * ra) / sum;
    const shareB = (t * rb) / sum;
    return `Part 1: ₹${shareA.toFixed(2)} | Part 2: ₹${shareB.toFixed(2)}`;
  }

  average(values: any[]): { avg: number; sum: number; count: number; min: number; max: number; median: number } {
    const arr = values.map(Number).filter(Number.isFinite);
    if (!arr.length) return { avg: 0, sum: 0, count: 0, min: 0, max: 0, median: 0 };
    const sum = arr.reduce((x, y) => x + y, 0);
    const sorted = [...arr].sort((x, y) => x - y);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return {
      avg: sum / arr.length,
      sum,
      count: arr.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median
    };
  }

  discount(price: any, pct: any): string {
    const np = pos(price);
    const disc = this.percentage(np, nonNeg(pct));
    const finalPrice = Math.max(0, np - disc);
    return `Discount: ₹${disc.toFixed(2)} | Final Price: ₹${finalPrice.toFixed(2)} | You Save: ${pct}%`;
  }

  tip(bill: any, pct: any): string {
    const nb = pos(bill);
    const tp = this.percentage(nb, nonNeg(pct));
    return `Tip Amount: ₹${tp.toFixed(2)} | Total Bill: ₹${(nb + tp).toFixed(2)}`;
  }

  billSplit(total: any, people: any, tipPct = 0, taxPct = 0): string {
    const nt = pos(total);
    const np = pos(people);
    const tipVal = this.percentage(nt, nonNeg(tipPct));
    const taxVal = this.percentage(nt, nonNeg(taxPct));
    const grand = nt + tipVal + taxVal;
    const perPerson = grand / np;
    return `Total Payable: ₹${grand.toFixed(2)} | Tip: ₹${tipVal.toFixed(2)} | Per Person (${np}): ₹${perPerson.toFixed(2)}`;
  }

  tax(amount: any, rate: any, isInclusive = false): string {
    const a = pos(amount);
    const r = nonNeg(rate);
    if (isInclusive) {
      const base = a / (1 + r / 100);
      const taxAmt = a - base;
      return `Net Pre-Tax: ₹${base.toFixed(2)} | Tax (${r}%): ₹${taxAmt.toFixed(2)} | Total: ₹${a.toFixed(2)}`;
    }
    const taxAmt = (a * r) / 100;
    return `Tax (${r}%): ₹${taxAmt.toFixed(2)} | Total with Tax: ₹${(a + taxAmt).toFixed(2)}`;
  }

  // ===================== MONEY & FINANCIAL =====================
  emi(principal: any, annualRate: any, months: any): string {
    const p = pos(principal);
    const r = nonNeg(annualRate) / 1200;
    const m = pos(months);
    if (r === 0) {
      const perMonth = p / m;
      return `Monthly EMI: ₹${perMonth.toFixed(2)} | Total Interest: ₹0.00 | Total Payment: ₹${p.toFixed(2)}`;
    }
    const emiVal = (p * r * Math.pow(1 + r, m)) / (Math.pow(1 + r, m) - 1);
    const totalPay = emiVal * m;
    const interest = totalPay - p;
    return `Monthly EMI: ₹${emiVal.toFixed(2)} | Total Interest: ₹${interest.toFixed(2)} | Total Payment: ₹${totalPay.toFixed(2)}`;
  }

  simpleInterest(p: any, r: any, t: any): string {
    const np = pos(p), nr = nonNeg(r), nt = pos(t);
    const si = (np * nr * nt) / 100;
    return `Simple Interest: ₹${si.toFixed(2)} | Maturity Total: ₹${(np + si).toFixed(2)}`;
  }

  compoundInterest(p: any, r: any, t: any, nper = 1): string {
    const np = pos(p), nr = nonNeg(r), nt = pos(t), comp = pos(nper);
    const total = np * Math.pow(1 + nr / (100 * comp), comp * nt);
    const interest = total - np;
    return `Compound Interest: ₹${interest.toFixed(2)} | Maturity Total: ₹${total.toFixed(2)}`;
  }

  sip(monthly: any, annualRate: any, months: any): string {
    const m = pos(monthly);
    const r = nonNeg(annualRate) / 1200;
    const nMonths = pos(months);
    const totalInvested = m * nMonths;
    const futureVal = r > 0 ? m * ((Math.pow(1 + r, nMonths) - 1) / r) * (1 + r) : totalInvested;
    const returns = futureVal - totalInvested;
    return `Invested: ₹${totalInvested.toFixed(2)} | Wealth Gain: ₹${returns.toFixed(2)} | Maturity Value: ₹${futureVal.toFixed(2)}`;
  }

  savings(target: any, current: any, months: any): string {
    const tgt = pos(target);
    const cur = nonNeg(current);
    const m = pos(months);
    const rem = Math.max(0, tgt - cur);
    const monthlyNeeded = rem / m;
    return `Goal Gap: ₹${rem.toFixed(2)} | Monthly Savings Needed: ₹${monthlyNeeded.toFixed(2)} for ${m} months`;
  }

  roi(gain: any, cost: any): string {
    const c = pos(cost);
    const g = n(gain);
    const netProfit = g - c;
    const pct = (netProfit / c) * 100;
    return `Net Profit: ₹${netProfit.toFixed(2)} | ROI: ${pct.toFixed(2)}%`;
  }

  profitLoss(cost: any, sale: any): string {
    const c = pos(cost), s = nonNeg(sale);
    const diff = s - c;
    const pct = (diff / c) * 100;
    if (diff >= 0) {
      return `Profit: +₹${diff.toFixed(2)} (+${pct.toFixed(2)}%)`;
    }
    return `Loss: -₹${Math.abs(diff).toFixed(2)} (${pct.toFixed(2)}%)`;
  }

  inflation(value: any, rate: any, years: any): string {
    const v = pos(value), r = n(rate), y = pos(years);
    const res = v * Math.pow(1 + r / 100, y);
    const loss = res - v;
    return `Future Cost: ₹${res.toFixed(2)} | Additional Cost: ₹${loss.toFixed(2)} (${(res / v).toFixed(2)}x)`;
  }

  salary(annual: any, months = 12, taxRate = 0): string {
    const grossMo = pos(annual) / pos(months);
    const taxMo = this.percentage(grossMo, nonNeg(taxRate));
    const netMo = grossMo - taxMo;
    return `Gross/Mo: ₹${grossMo.toFixed(2)} | Tax/Mo: ₹${taxMo.toFixed(2)} | In-Hand Net/Mo: ₹${netMo.toFixed(2)}`;
  }

  markup(cost: any, pct: any): string {
    const c = pos(cost);
    const profit = this.percentage(c, nonNeg(pct));
    return `Selling Price: ₹${(c + profit).toFixed(2)} | Profit per unit: ₹${profit.toFixed(2)}`;
  }

  margin(price: any, cost: any): string {
    const p = pos(price);
    const c = pos(cost);
    const profit = p - c;
    const marginPct = (profit / p) * 100;
    return `Profit Margin: ${marginPct.toFixed(2)}% | Profit: ₹${profit.toFixed(2)}`;
  }

  breakEven(fixedCost: any, price: any, variableCost: any): string {
    const p = pos(price);
    const vc = nonNeg(variableCost);
    const fc = pos(fixedCost);
    const contribution = p - vc;
    if (contribution <= 0) return 'Error: Price must be strictly greater than variable cost';
    const units = fc / contribution;
    const revenue = units * p;
    return `Break-Even Quantity: ${Math.ceil(units)} units | Break-Even Sales: ₹${revenue.toFixed(2)}`;
  }

  cagr(begin: any, end: any, years: any): string {
    const b = pos(begin);
    const e = pos(end);
    const y = pos(years);
    const res = (Math.pow(e / b, 1 / y) - 1) * 100;
    return `CAGR: ${res.toFixed(2)}% per year`;
  }

  growth(oldVal: any, newVal: any): string {
    const o = pos(oldVal);
    const nv = n(newVal);
    const diff = nv - o;
    const pct = (diff / o) * 100;
    return `Growth: ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% (Change: ${diff >= 0 ? '+' : ''}${diff.toFixed(2)})`;
  }

  pricing(cost: any, targetMarginPct: any): string {
    const c = pos(cost);
    const m = n(targetMarginPct);
    if (m >= 100) throw new Error('Target margin must be less than 100%');
    const price = c / (1 - m / 100);
    return `Target Selling Price: ₹${price.toFixed(2)} | Unit Profit: ₹${(price - c).toFixed(2)}`;
  }

  revenue(units: any, pricePerUnit: any): string {
    const u = pos(units);
    const p = pos(pricePerUnit);
    return `Total Revenue: ₹${(u * p).toFixed(2)} from ${u.toLocaleString()} units`;
  }

  businessRoi(investment: any, revenue: any, operatingCost = 0): string {
    const inv = pos(investment);
    const rev = pos(revenue);
    const op = nonNeg(operatingCost);
    const netProfit = rev - (inv + op);
    const roiPct = (netProfit / inv) * 100;
    return `Net Profit: ₹${netProfit.toFixed(2)} | Business ROI: ${roiPct.toFixed(2)}%`;
  }

  // ===================== GOLD & JEWELLERY =====================
  goldValue(weight: any, ratePerUnit: any, unit = 'tola'): string {
    const w = pos(weight);
    const r = pos(ratePerUnit);
    const total = w * r;
    return `Gold Value: ₹${total.toFixed(2)} (${w} ${unit} @ ₹${r}/${unit})`;
  }

  goldWeightConverter(value: any, fromUnit: string, toUnit: string): string {
    const factors = CALC_UNIT_FACTORS.Gold;
    if (!factors[fromUnit] || !factors[toUnit]) throw new Error('Invalid gold weight unit');
    const res = (pos(value) * factors[fromUnit]) / factors[toUnit];
    return `${res.toFixed(4)} ${toUnit}`;
  }

  karatPurity(value: any, mode = 'karatToPurity'): string {
    const v = pos(value);
    if (mode === 'purityToKarat') {
      const karat = (v * 24) / 100;
      return `${v}% Purity = ${karat.toFixed(2)} Karat (kt)`;
    }
    const purity = (v / 24) * 100;
    return `${v}K Gold = ${purity.toFixed(2)}% Pure Gold`;
  }

  pureGoldWeight(weight: any, karat: any): string {
    const w = pos(weight);
    const k = pos(karat);
    const pure = w * (k / 24);
    return `Pure (24K) Gold Weight: ${pure.toFixed(3)} units | Alloy: ${(w - pure).toFixed(3)} units`;
  }

  jewelleryPrice(goldValue: any, makingPct = 0, wastagePct = 0, gstPct = 3): string {
    const gv = pos(goldValue);
    const wastage = (gv * nonNeg(wastagePct)) / 100;
    const withWastage = gv + wastage;
    const making = (withWastage * nonNeg(makingPct)) / 100;
    const subtotal = withWastage + making;
    const gst = (subtotal * nonNeg(gstPct)) / 100;
    const finalTotal = subtotal + gst;
    return `Subtotal: ₹${subtotal.toFixed(2)} | Making: ₹${making.toFixed(2)} | Wastage: ₹${wastage.toFixed(2)} | GST (${gstPct}%): ₹${gst.toFixed(2)} | Total: ₹${finalTotal.toFixed(2)}`;
  }

  makingCharge(goldValue: any, makingPct: any): string {
    const gv = pos(goldValue);
    const charge = (gv * nonNeg(makingPct)) / 100;
    return `Making Charge (${makingPct}%): ₹${charge.toFixed(2)} | Total: ₹${(gv + charge).toFixed(2)}`;
  }

  wastage(weight: any, wastagePct: any, ratePerUnit: any): string {
    const w = pos(weight);
    const pct = nonNeg(wastagePct);
    const rate = pos(ratePerUnit);
    const wastageGrams = (w * pct) / 100;
    const wastageCost = wastageGrams * rate;
    return `Wastage (${pct}%): ${wastageGrams.toFixed(3)} units | Wastage Cost: ₹${wastageCost.toFixed(2)}`;
  }

  buySellValue(grossWeight: any, buyRate: any, sellRate: any, purityPct = 91.6): string {
    const w = pos(grossWeight);
    const pureWeight = (w * nonNeg(purityPct)) / 100;
    const buyVal = pureWeight * pos(buyRate);
    const sellVal = pureWeight * pos(sellRate);
    const spread = Math.abs(buyVal - sellVal);
    return `Buy Value: ₹${buyVal.toFixed(2)} | Sell Value: ₹${sellVal.toFixed(2)} | Spread: ₹${spread.toFixed(2)}`;
  }

  silverValue(weight: any, ratePerKgOrTola: any, isPerKg = false): string {
    const w = pos(weight);
    const r = pos(ratePerKgOrTola);
    const total = isPerKg ? (w / 1000) * r : w * r;
    return `Silver Value: ₹${total.toFixed(2)}`;
  }

  // ===================== HEALTH & FITNESS =====================
  bmi(kg: any, height: any, isCm = true): string {
    const w = pos(kg);
    const h = isCm ? pos(height) / 100 : pos(height);
    const val = w / (h * h);
    const status = val < 18.5 ? 'Underweight' : val < 25 ? 'Normal weight (Healthy)' : val < 30 ? 'Overweight' : 'Obese';
    const minHealthyWeight = 18.5 * h * h;
    const maxHealthyWeight = 24.9 * h * h;
    return `BMI: ${val.toFixed(1)} (${status}) | Healthy Range: ${minHealthyWeight.toFixed(1)}kg - ${maxHealthyWeight.toFixed(1)}kg`;
  }

  bmr(weightKg: any, heightCm: any, age: any, sex = 'male'): string {
    const w = pos(weightKg), h = pos(heightCm), a = pos(age);
    const bmrVal = sex === 'female'
      ? 10 * w + 6.25 * h - 5 * a - 161
      : 10 * w + 6.25 * h - 5 * a + 5;
    return `Basal Metabolic Rate (BMR): ${Math.round(bmrVal)} kcal/day`;
  }

  tdee(bmrVal: any, activity: string): string {
    const factors: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      heavy: 1.725,
      athlete: 1.9
    };
    const factor = factors[activity] || 1.2;
    const val = pos(bmrVal) * factor;
    return `TDEE (Daily Calorie Need): ${Math.round(val)} kcal/day (${activity})`;
  }

  calories(weightKg: any, heightCm: any, age: any, sex = 'male', activity = 'moderate'): string {
    const w = pos(weightKg), h = pos(heightCm), a = pos(age);
    const bmrVal = sex === 'female' ? 10 * w + 6.25 * h - 5 * a - 161 : 10 * w + 6.25 * h - 5 * a + 5;
    const factors: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, heavy: 1.725, athlete: 1.9 };
    const tdee = bmrVal * (factors[activity] || 1.375);
    const loss = tdee - 500;
    const gain = tdee + 500;
    return `Maintenance: ${Math.round(tdee)} kcal | Fat Loss (-0.5kg/wk): ${Math.round(loss)} kcal | Muscle Gain: ${Math.round(gain)} kcal`;
  }

  macros(calories: any, proteinPct = 30, carbPct = 40, fatPct = 30): string {
    const c = pos(calories);
    const p = Math.round(((c * n(proteinPct)) / 100) / 4);
    const cb = Math.round(((c * n(carbPct)) / 100) / 4);
    const f = Math.round(((c * n(fatPct)) / 100) / 9);
    return `Protein: ${p}g (${proteinPct}%) | Carbs: ${cb}g (${carbPct}%) | Fats: ${f}g (${fatPct}%)`;
  }

  bodyFat(gender: string, waistCm: any, neckCm: any, heightCm: any, hipCm = 95): string {
    const waist = pos(waistCm);
    const neck = pos(neckCm);
    const height = pos(heightCm);
    let fatPct = 0;
    if (gender === 'female') {
      const hip = pos(hipCm);
      fatPct = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(height)) - 450;
    } else {
      fatPct = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
    }
    const clamped = Math.max(2, Math.min(60, fatPct));
    return `Body Fat: ${clamped.toFixed(1)}% (${gender === 'female' ? (clamped < 21 ? 'Athletic' : clamped < 31 ? 'Fitness' : 'Overfat') : (clamped < 14 ? 'Athletic' : clamped < 24 ? 'Fitness' : 'Overfat')})`;
  }

  waterIntake(weightKg: any, mlPerKg = 35): string {
    const ml = pos(weightKg) * pos(mlPerKg);
    const glasses = Math.round(ml / 250);
    return `Daily Water Need: ${ml.toLocaleString()} ml (~${(ml / 1000).toFixed(1)} Litres / ${glasses} glasses)`;
  }

  pace(distanceKm: any, timeMinutes: any): string {
    const d = pos(distanceKm), t = pos(timeMinutes);
    const sec = (t * 60) / d;
    const min = Math.floor(sec / 60);
    const remSec = Math.round(sec % 60);
    const kmh = d / (t / 60);
    return `Pace: ${min}:${remSec < 10 ? '0' : ''}${remSec} /km | Average Speed: ${kmh.toFixed(1)} km/h`;
  }

  idealBodyWeight(heightCm: any, gender = 'male'): string {
    const h = pos(heightCm);
    const inches = h / 2.54;
    const over5Ft = Math.max(0, inches - 60);
    const devine = gender === 'female' ? 45.5 + 2.3 * over5Ft : 50 + 2.3 * over5Ft;
    const robinson = gender === 'female' ? 49 + 1.7 * over5Ft : 52 + 1.9 * over5Ft;
    return `Ideal Weight: ~${devine.toFixed(1)} kg (Devine Formula) | Range: ${Math.round(devine - 3)} - ${Math.round(robinson + 3)} kg`;
  }

  // ===================== TIME & DATES =====================
  age(birth: any, asOf = new Date()): string {
    const b = dateObj(birth), d = dateObj(asOf);
    if (b > d) return 'Birth date cannot be in the future';
    let y = d.getFullYear() - b.getFullYear();
    let m = d.getMonth() - b.getMonth();
    let day = d.getDate() - b.getDate();
    if (day < 0) {
      m--;
      day += new Date(d.getFullYear(), d.getMonth(), 0).getDate();
    }
    if (m < 0) {
      y--;
      m += 12;
    }
    const totalDays = Math.floor((d.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
    return `Age: ${y} years, ${m} months, ${day} days (Total: ${totalDays.toLocaleString()} days lived)`;
  }

  dateDifference(a: any, b: any): string {
    const da = dateObj(a);
    const db = dateObj(b);
    const diffMs = Math.abs(db.getTime() - da.getTime());
    const days = Math.round(diffMs / 86400000);
    const weeks = (days / 7).toFixed(1);
    const months = (days / 30.4375).toFixed(1);
    return `${days} days (${weeks} weeks | ${months} months)`;
  }

  countdown(targetDate: any): string {
    const t = dateObj(targetDate).getTime();
    const now = Date.now();
    const diff = t - now;
    if (diff <= 0) return 'The specified date has already passed';
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    return `${d} days, ${h} hours, ${m} minutes remaining`;
  }

  workingDays(a: any, b: any): string {
    let d = dateObj(a), e = dateObj(b), count = 0, weekends = 0;
    if (d > e) [d, e] = [e, d];
    const cur = new Date(d.getTime());
    while (cur <= e) {
      const day = cur.getDay();
      if (day === 0 || day === 6) {
        weekends++;
      } else {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return `Working Days (Mon-Fri): ${count} days (Weekends: ${weekends})`;
  }

  dateAddSubtract(baseDate: any, days: any, op = '+'): string {
    const d = dateObj(baseDate);
    const delta = n(days);
    const mult = op === '-' ? -1 : 1;
    d.setDate(d.getDate() + mult * delta);
    return `Result Date: ${d.toISOString().slice(0, 10)} (${d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })})`;
  }

  timeDifference(startTime: string, endTime: string): string {
    const [h1, m1] = startTime.split(':').map(Number);
    const [h2, m2] = endTime.split(':').map(Number);
    if (Number.isNaN(h1) || Number.isNaN(m1) || Number.isNaN(h2) || Number.isNaN(m2)) {
      throw new Error('Time format must be HH:MM');
    }
    let totalMins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (totalMins < 0) totalMins += 24 * 60; // Next day
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `Duration: ${h} hours and ${m} minutes (${totalMins} minutes)`;
  }

  timeZoneOffset(hoursOffset: any): string {
    const offset = n(hoursOffset);
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const target = new Date(utc + 3600000 * offset);
    return `Time at UTC ${offset >= 0 ? '+' : ''}${offset}: ${target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (${target.toDateString()})`;
  }

  unixTimestamp(val: any, mode = 'toTimestamp'): string {
    if (mode === 'toDate') {
      const ts = n(val);
      const ms = ts < 1e11 ? ts * 1000 : ts;
      const d = new Date(ms);
      return `Date: ${d.toUTCString()} (Local: ${d.toLocaleString()})`;
    }
    const d = dateObj(val);
    const sec = Math.floor(d.getTime() / 1000);
    return `Unix Seconds: ${sec} | Milliseconds: ${d.getTime()}`;
  }

  weekday(date: any): string {
    const d = dateObj(date);
    const day = d.toLocaleDateString(undefined, { weekday: 'long' });
    const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return `Day: ${day} | Date: ${d.toLocaleDateString()} | Leap Year: ${isLeap(d.getFullYear()) ? 'Yes' : 'No'}`;
  }

  // ===================== CONVERTERS =====================
  unit(value: any, from: string, to: string, factors: Record<string, number>): string {
    if (!factors || !factors[from] || !factors[to]) {
      throw new Error(`Unit conversion not found for ${from} to ${to}`);
    }
    const val = n(value);
    const res = (val * factors[from]) / factors[to];
    return `${res.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${to}`;
  }

  temperature(value: any, from: string, to: string): string {
    const v = n(value);
    const c = from === 'C' ? v : from === 'F' ? ((v - 32) * 5) / 9 : v - 273.15;
    const finalVal = to === 'C' ? c : to === 'F' ? (c * 9) / 5 + 32 : c + 273.15;
    return `${finalVal.toFixed(2)} °${to}`;
  }

  currency(amount: any, from: string, to: string): string {
    const factors = CALC_UNIT_FACTORS.Currency;
    if (!factors[from] || !factors[to]) throw new Error('Unsupported currency');
    const amt = pos(amount);
    // Currency factors are relative to USD = 1.0 (so 1 USD = 86.85 INR, etc.)
    const usd = amt / factors[from];
    const converted = usd * factors[to];
    return `${converted.toFixed(2)} ${to} (1 ${from} = ${(factors[to] / factors[from]).toFixed(4)} ${to})`;
  }

  // ===================== HOME & CONSTRUCTION =====================
  roomArea(length: any, width: any, unit = 'ft'): string {
    const l = pos(length), w = pos(width);
    const area = l * w;
    const perimeter = 2 * (l + w);
    return `Area: ${area.toFixed(2)} sq ${unit} | Perimeter: ${perimeter.toFixed(2)} ${unit}`;
  }

  paint(length: any, width: any, height: any, coats = 2): string {
    const l = pos(length), w = pos(width), h = pos(height);
    const c = pos(coats);
    const wallArea = 2 * (l + w) * h;
    const totalArea = wallArea * c;
    // 1 Litre paint covers ~85 sq ft per coat
    const litres = totalArea / 85;
    return `Wall Area: ${wallArea.toFixed(1)} sq ft | Paint Needed: ~${litres.toFixed(1)} Litres (${c} coats)`;
  }

  flooring(length: any, width: any, wastagePct = 10): string {
    const l = pos(length), w = pos(width);
    const base = l * w;
    const total = base * (1 + nonNeg(wastagePct) / 100);
    return `Room Area: ${base.toFixed(1)} sq ft | Required with Wastage (${wastagePct}%): ${total.toFixed(1)} sq ft`;
  }

  tiles(roomAreaSqFt: any, tileWidthInches: any, tileHeightInches: any, wastagePct = 10): string {
    const area = pos(roomAreaSqFt);
    const tw = pos(tileWidthInches);
    const th = pos(tileHeightInches);
    const singleTileSqFt = (tw * th) / 144;
    const netTiles = area / singleTileSqFt;
    const withWastage = netTiles * (1 + nonNeg(wastagePct) / 100);
    return `Tiles Needed: ${Math.ceil(withWastage)} tiles (Area per tile: ${singleTileSqFt.toFixed(2)} sq ft)`;
  }

  construction(builtUpSqFt: any, costPerSqFt = 2500): string {
    const sqft = pos(builtUpSqFt);
    const rate = pos(costPerSqFt);
    const totalCost = sqft * rate;
    const cementBags = Math.round(sqft * 0.4);
    const steelKg = Math.round(sqft * 3.5);
    const sandCuFt = Math.round(sqft * 1.8);
    return `Estimated Construction Cost: ₹${totalCost.toLocaleString()} | Cement: ~${cementBags} bags | Steel: ~${steelKg} kg | Sand: ~${sandCuFt} cu.ft`;
  }

  electricityCost(watts: any, hoursPerDay: any, ratePerKwh: any, days = 30): string {
    const w = pos(watts), h = pos(hoursPerDay), r = pos(ratePerKwh), d = pos(days);
    const kwh = (w * h * d) / 1000;
    const cost = kwh * r;
    return `Monthly Power: ${kwh.toFixed(1)} kWh (Units) | Estimated Bill: ₹${cost.toFixed(2)}`;
  }

  waterUsage(persons: any, litersPerPerson = 135, days = 30): string {
    const p = pos(persons), l = pos(litersPerPerson), d = pos(days);
    const totalLitres = p * l * d;
    const tankers = (totalLitres / 5000).toFixed(1);
    return `Monthly Water: ${totalLitres.toLocaleString()} Litres (~${tankers} tankers of 5,000L)`;
  }

  // ===================== VEHICLE & TRIP =====================
  mileage(distanceKm: any, fuelLitres: any): string {
    const d = pos(distanceKm), f = pos(fuelLitres);
    const kmPerL = d / f;
    const lPer100Km = (100 / kmPerL);
    return `Mileage: ${kmPerL.toFixed(2)} km/L (${lPer100Km.toFixed(2)} L/100km)`;
  }

  fuelCost(distanceKm: any, mileageKmPerL: any, pricePerL: any): string {
    const d = pos(distanceKm), m = pos(mileageKmPerL), p = pos(pricePerL);
    const litres = d / m;
    const cost = litres * p;
    return `Fuel Required: ${litres.toFixed(1)} L | Total Fuel Cost: ₹${cost.toFixed(2)} (₹${(cost / d).toFixed(2)}/km)`;
  }

  tripFuel(distanceKm: any, mileageKmPerL: any, pricePerL: any, passengers = 1): string {
    const d = pos(distanceKm), m = pos(mileageKmPerL), p = pos(pricePerL), pass = pos(passengers);
    const litres = d / m;
    const cost = litres * p;
    return `Fuel: ${litres.toFixed(1)} L | Total Cost: ₹${cost.toFixed(2)} | Cost per Person: ₹${(cost / pass).toFixed(2)}`;
  }

  runningCost(monthlyKm: any, mileageKmPerL: any, fuelPrice: any, monthlyMaintenance = 1000): string {
    const km = pos(monthlyKm), m = pos(mileageKmPerL), fp = pos(fuelPrice), maint = nonNeg(monthlyMaintenance);
    const fuelCost = (km / m) * fp;
    const total = fuelCost + maint;
    return `Monthly Running Cost: ₹${total.toFixed(2)} | Cost per km: ₹${(total / km).toFixed(2)}`;
  }

  vehicleLoan(price: any, downPayment: any, ratePct: any, months = 60): string {
    const p = pos(price);
    const dp = nonNeg(downPayment);
    const loan = Math.max(0, p - dp);
    return this.emi(loan, ratePct, months) + ` | Loan Amount: ₹${loan.toFixed(2)}`;
  }

  fuelEconomy(val: any, fromUnit: string, toUnit: string): string {
    const v = pos(val);
    let kmPerL = v;
    if (fromUnit === 'l_100km') kmPerL = 100 / v;
    if (fromUnit === 'mpg_us') kmPerL = v * 0.425143707;
    if (fromUnit === 'mpg_uk') kmPerL = v * 0.354006189;

    let res = kmPerL;
    if (toUnit === 'l_100km') res = 100 / kmPerL;
    if (toUnit === 'mpg_us') res = kmPerL / 0.425143707;
    if (toUnit === 'mpg_uk') res = kmPerL / 0.354006189;

    const unitLabels: Record<string, string> = {
      km_l: 'km/L',
      l_100km: 'L/100km',
      mpg_us: 'US MPG',
      mpg_uk: 'UK MPG'
    };

    return `${res.toFixed(2)} ${unitLabels[toUnit] || toUnit}`;
  }

  // ===================== TRAVEL =====================
  tripBudget(travelers: any, days: any, lodgingPerDay: any, foodPerDay: any, transport: any): string {
    const trav = pos(travelers), d = pos(days);
    const lodg = nonNeg(lodgingPerDay) * d;
    const food = nonNeg(foodPerDay) * d * trav;
    const trans = nonNeg(transport);
    const total = lodg + food + trans;
    return `Total Trip Budget: ₹${total.toFixed(2)} | Per Traveler: ₹${(total / trav).toFixed(2)}`;
  }

  travelDistance(speedKmh: any, timeHours: any): string {
    const s = pos(speedKmh), t = pos(timeHours);
    return `Distance: ${(s * t).toFixed(1)} km`;
  }

  travelTime(distanceKm: any, speedKmh: any): string {
    const d = pos(distanceKm), s = pos(speedKmh);
    const hours = d / s;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `Travel Time: ${h} hours and ${m} minutes`;
  }

  // ===================== PROGRAMMER & COMPUTER =====================
  baseConvert(value: any, fromBase: any, toBase: any): string {
    const dec = parseInt(String(value).trim(), n(fromBase));
    if (Number.isNaN(dec)) throw new Error(`Invalid number for base ${fromBase}`);
    return dec.toString(n(toBase)).toUpperCase();
  }

  programmerAllBases(value: any, currentBase = 10): { bin: string; oct: string; dec: string; hex: string; char: string } {
    const dec = parseInt(String(value).trim(), n(currentBase));
    if (Number.isNaN(dec)) throw new Error('Invalid numeric input');
    return {
      bin: (dec >>> 0).toString(2).padStart(8, '0'),
      oct: (dec >>> 0).toString(8),
      dec: dec.toString(10),
      hex: (dec >>> 0).toString(16).toUpperCase(),
      char: dec >= 32 && dec <= 126 ? String.fromCharCode(dec) : 'N/A'
    };
  }

  bitwise(a: any, op: string, b: any): string {
    const na = parseInt(String(a), 10);
    const nb = parseInt(String(b), 10);
    if (Number.isNaN(na)) throw new Error('First operand is invalid');
    let res = 0;
    if (op === 'AND' || op === '&') res = na & nb;
    else if (op === 'OR' || op === '|') res = na | nb;
    else if (op === 'XOR' || op === '^') res = na ^ nb;
    else if (op === 'NOT' || op === '~') res = ~na;
    else if (op === '<<') res = na << (nb || 0);
    else if (op === '>>') res = na >> (nb || 0);
    else throw new Error('Unsupported bitwise operation: ' + op);

    return `Decimal: ${res} | Binary: ${(res >>> 0).toString(2)} | Hex: 0x${(res >>> 0).toString(16).toUpperCase()}`;
  }

  modulo(dividend: any, divisor: any): string {
    const a = n(dividend);
    const b = pos(divisor);
    const quotient = Math.floor(a / b);
    const remainder = a % b;
    return `Quotient: ${quotient} | Remainder: ${remainder} (${a} = ${b} × ${quotient} + ${remainder})`;
  }

  ipSubnet(ip: string, cidr: any): string {
    const parts = String(ip).trim().split('.').map(Number);
    const c = n(cidr);
    if (parts.length !== 4 || parts.some(x => x < 0 || x > 255 || Number.isNaN(x)) || c < 0 || c > 32) {
      throw new Error('Invalid IPv4 address or CIDR mask (0-32)');
    }
    const val = parts.reduce((a, x) => (a * 256 + x) >>> 0, 0);
    const mask = c === 0 ? 0 : (0xffffffff << (32 - c)) >>> 0;
    const net = (val & mask) >>> 0;
    const bcast = (net | (~mask >>> 0)) >>> 0;
    const fmt = (x: number) => [(x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255].join('.');
    const usable = c >= 31 ? Math.max(0, 2 ** (32 - c)) : 2 ** (32 - c) - 2;
    const firstHost = c < 31 ? fmt(net + 1) : fmt(net);
    const lastHost = c < 31 ? fmt(bcast - 1) : fmt(bcast);
    return `Network: ${fmt(net)}/${c} | Netmask: ${fmt(mask)} | Usable Range: ${firstHost} - ${lastHost} | Usable Hosts: ${usable.toLocaleString()}`;
  }
}

export const calculatorEngine = new CalculatorEngine();
