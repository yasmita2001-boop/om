import { CALC_UNIT_FACTORS, NP_UNITS, calculatorEngine } from './calculatorEngine';

export interface ToolField {
  label: string;
  type?: 'text' | 'number' | 'date' | 'time' | 'select';
  options?: { value: string; label: string }[];
  default: string;
  step?: string;
  placeholder?: string;
}

export interface ToolConfig {
  name: string;
  category: string;
  description: string;
  formula?: string;
  isConverter?: boolean;
  unitType?: 'generic' | 'nepal_land' | 'nepal_length' | 'nepal_volume' | 'nepal_weight' | 'currency' | 'temp';
  unitGroup?: string;
  defaultUnitFrom?: string;
  defaultUnitTo?: string;
  fields: ToolField[];
  calculate: (f1: string, f2: string, f3: string, f4: string, uFrom?: string, uTo?: string) => string;
}

export const ALL_TOOL_CONFIGS: Record<string, ToolConfig> = {
  // ==========================================
  // QUICK
  // ==========================================
  'Basic': {
    name: 'Basic',
    category: 'quick',
    description: 'Standard arithmetic calculations',
    fields: [
      { label: 'Operand A', type: 'number', default: '100' },
      {
        label: 'Operator',
        type: 'select',
        options: [
          { value: '+', label: '+' },
          { value: '-', label: '-' },
          { value: '*', label: '×' },
          { value: '/', label: '÷' },
          { value: '%', label: '%' },
          { value: '^', label: '^' }
        ],
        default: '+'
      },
      { label: 'Operand B', type: 'number', default: '25' }
    ],
    calculate: (f1, f2, f3) => String(calculatorEngine.basic(f1, f2, f3))
  },
  'Scientific': {
    name: 'Scientific',
    category: 'quick',
    description: 'Advanced math expression evaluator with sin, cos, sqrt, log, pow',
    formula: 'Supports sqrt, sin, cos, tan, log, ln, pi, e, pow(^)',
    fields: [
      { label: 'Expression', type: 'text', default: 'sqrt(144) + sin(30) * 10', placeholder: 'e.g. 5^2 + log(100)' }
    ],
    calculate: (f1) => String(calculatorEngine.scientific(f1))
  },
  'Percentage': {
    name: 'Percentage',
    category: 'quick',
    description: 'Find percentage, percentage of value, or change',
    fields: [
      { label: 'Value A', type: 'number', default: '500' },
      { label: 'Value B (%)', type: 'number', default: '15' },
      {
        label: 'Calculation Mode',
        type: 'select',
        options: [
          { value: 'pctOf', label: 'B% of A' },
          { value: 'whatPct', label: 'What % is A of B' },
          { value: 'increase', label: '% Increase/Decrease from A to B' }
        ],
        default: 'pctOf'
      }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.percentageAdvanced(f1, f2, f3 || 'pctOf')
  },
  'Fraction': {
    name: 'Fraction',
    category: 'quick',
    description: 'Fraction simplification, decimal conversion and GCD',
    fields: [
      { label: 'Numerator', type: 'number', default: '36' },
      { label: 'Denominator', type: 'number', default: '48' }
    ],
    calculate: (f1, f2) => calculatorEngine.simplifyFraction(f1, f2)
  },
  'Ratio': {
    name: 'Ratio',
    category: 'quick',
    description: 'Simplify ratios or divide a total quantity into ratio shares',
    fields: [
      { label: 'Part A', type: 'number', default: '16' },
      { label: 'Part B', type: 'number', default: '9' },
      { label: 'Total Amount to Divide (Optional)', type: 'number', default: '1000' }
    ],
    calculate: (f1, f2, f3) => {
      const simplified = calculatorEngine.ratio(f1, f2);
      if (f3 && Number(f3) > 0) {
        return `Simplified: ${simplified} | ${calculatorEngine.ratioDivide(f3, f1, f2)}`;
      }
      return `Simplified Ratio: ${simplified}`;
    }
  },
  'Average': {
    name: 'Average',
    category: 'quick',
    description: 'Calculate Mean, Median, Sum, Min, and Max from a list of numbers',
    fields: [
      { label: 'Comma-separated numbers', type: 'text', default: '45, 88, 72, 95, 60, 83', placeholder: 'e.g. 10, 20, 30' }
    ],
    calculate: (f1) => {
      const arr = f1.split(/[\s,]+/).map(x => Number(x.trim())).filter(Number.isFinite);
      const res = calculatorEngine.average(arr);
      return `Mean (Avg): ${res.avg.toFixed(2)} | Median: ${res.median} | Sum: ${res.sum} | Range: [${res.min} - ${res.max}] (Count: ${res.count})`;
    }
  },
  'Discount': {
    name: 'Discount',
    category: 'quick',
    description: 'Calculate discount amount and final price after percentage off',
    fields: [
      { label: 'Original Price (₹)', type: 'number', default: '1200' },
      { label: 'Discount Percentage (%)', type: 'number', default: '20' }
    ],
    calculate: (f1, f2) => calculatorEngine.discount(f1, f2)
  },
  'Tip': {
    name: 'Tip',
    category: 'quick',
    description: 'Calculate dining tip and final bill',
    fields: [
      { label: 'Bill Amount (₹)', type: 'number', default: '1500' },
      { label: 'Tip Percentage (%)', type: 'number', default: '10' }
    ],
    calculate: (f1, f2) => calculatorEngine.tip(f1, f2)
  },
  'Bill Split': {
    name: 'Bill Split',
    category: 'quick',
    description: 'Split shared bills among people including tip and tax',
    fields: [
      { label: 'Total Bill (₹)', type: 'number', default: '4800' },
      { label: 'Number of People', type: 'number', default: '4' },
      { label: 'Tip (%)', type: 'number', default: '5' },
      { label: 'Tax (%)', type: 'number', default: '5' }
    ],
    calculate: (f1, f2, f3, f4) => calculatorEngine.billSplit(f1, f2, Number(f3) || 0, Number(f4) || 0)
  },
  'Tax': {
    name: 'Tax',
    category: 'quick',
    description: 'Compute GST / VAT / Sales Tax (Exclusive or Inclusive)',
    fields: [
      { label: 'Amount (₹)', type: 'number', default: '2500' },
      { label: 'Tax Rate (%)', type: 'number', default: '18' },
      {
        label: 'Calculation Type',
        type: 'select',
        options: [
          { value: 'exclusive', label: 'Tax Exclusive (Add Tax on Top)' },
          { value: 'inclusive', label: 'Tax Inclusive (Already Included in Price)' }
        ],
        default: 'exclusive'
      }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.tax(f1, f2, f3 === 'inclusive')
  },

  // ==========================================
  // MONEY & FINANCE
  // ==========================================
  'EMI / Loan': {
    name: 'EMI / Loan',
    category: 'money',
    description: 'Equal Monthly Installment (EMI) for home, personal, or car loans',
    formula: 'E = P × r × (1+r)ⁿ / ((1+r)ⁿ - 1)',
    fields: [
      { label: 'Loan Principal (₹)', type: 'number', default: '500000' },
      { label: 'Annual Interest Rate (%)', type: 'number', default: '9.5', step: '0.1' },
      { label: 'Tenure (Months)', type: 'number', default: '60' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.emi(f1, f2, f3)
  },
  'Simple Interest': {
    name: 'Simple Interest',
    category: 'money',
    description: 'Standard Simple Interest formula (P × R × T / 100)',
    formula: 'SI = (P × R × T) / 100',
    fields: [
      { label: 'Principal (₹)', type: 'number', default: '100000' },
      { label: 'Annual Rate (%)', type: 'number', default: '8.5', step: '0.1' },
      { label: 'Time Period (Years)', type: 'number', default: '3' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.simpleInterest(f1, f2, f3)
  },
  'Compound Interest': {
    name: 'Compound Interest',
    category: 'money',
    description: 'Calculate compounding growth on deposits with different compounding frequencies',
    fields: [
      { label: 'Principal (₹)', type: 'number', default: '100000' },
      { label: 'Annual Rate (%)', type: 'number', default: '8.0', step: '0.1' },
      { label: 'Time (Years)', type: 'number', default: '5' },
      {
        label: 'Compounding Frequency',
        type: 'select',
        options: [
          { value: '1', label: 'Annually (Once a year)' },
          { value: '2', label: 'Semi-Annually (Twice a year)' },
          { value: '4', label: 'Quarterly (4 times a year)' },
          { value: '12', label: 'Monthly (12 times a year)' }
        ],
        default: '4'
      }
    ],
    calculate: (f1, f2, f3, f4) => calculatorEngine.compoundInterest(f1, f2, f3, Number(f4) || 1)
  },
  'SIP / Investment': {
    name: 'SIP / Investment',
    category: 'money',
    description: 'Systematic Investment Plan maturity with compound monthly returns',
    fields: [
      { label: 'Monthly Investment (₹)', type: 'number', default: '5000' },
      { label: 'Expected Annual Return (%)', type: 'number', default: '12.0', step: '0.1' },
      { label: 'Duration (Months)', type: 'number', default: '120' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.sip(f1, f2, f3)
  },
  'Savings': {
    name: 'Savings',
    category: 'money',
    description: 'Target savings goal planner and monthly gap calculator',
    fields: [
      { label: 'Target Savings Goal (₹)', type: 'number', default: '1000000' },
      { label: 'Current Savings (₹)', type: 'number', default: '250000' },
      { label: 'Months Left to Goal', type: 'number', default: '24' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.savings(f1, f2, f3)
  },
  'ROI': {
    name: 'ROI',
    category: 'money',
    description: 'Return on Investment percentage from gross gain and cost',
    fields: [
      { label: 'Final Total Return / Gain (₹)', type: 'number', default: '175000' },
      { label: 'Initial Cost / Investment (₹)', type: 'number', default: '100000' }
    ],
    calculate: (f1, f2) => calculatorEngine.roi(f1, f2)
  },
  'Profit & Loss': {
    name: 'Profit & Loss',
    category: 'money',
    description: 'Determine commercial profit or loss and percentage',
    fields: [
      { label: 'Cost Price (₹)', type: 'number', default: '800' },
      { label: 'Selling Price (₹)', type: 'number', default: '1150' }
    ],
    calculate: (f1, f2) => calculatorEngine.profitLoss(f1, f2)
  },
  'Inflation': {
    name: 'Inflation',
    category: 'money',
    description: 'Project how inflation erodes purchasing power over time',
    fields: [
      { label: 'Current Price / Value (₹)', type: 'number', default: '100000' },
      { label: 'Annual Inflation Rate (%)', type: 'number', default: '6.5', step: '0.1' },
      { label: 'Years Ahead', type: 'number', default: '10' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.inflation(f1, f2, f3)
  },
  'Salary': {
    name: 'Salary',
    category: 'money',
    description: 'Convert annual package to gross monthly and net in-hand salary',
    fields: [
      { label: 'Annual CTC / Salary (₹)', type: 'number', default: '1200000' },
      { label: 'Months per Year', type: 'number', default: '12' },
      { label: 'Estimated Tax & PF Deduction (%)', type: 'number', default: '15' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.salary(f1, Number(f2) || 12, Number(f3) || 0)
  },
  'Markup': {
    name: 'Markup',
    category: 'money',
    description: 'Calculate retail selling price given base cost and markup percentage',
    fields: [
      { label: 'Cost Price (₹)', type: 'number', default: '500' },
      { label: 'Markup Percentage (%)', type: 'number', default: '40' }
    ],
    calculate: (f1, f2) => calculatorEngine.markup(f1, f2)
  },
  'Margin': {
    name: 'Margin',
    category: 'money',
    description: 'Calculate gross profit margin percentage on selling price',
    fields: [
      { label: 'Selling Price (₹)', type: 'number', default: '700' },
      { label: 'Cost Price (₹)', type: 'number', default: '500' }
    ],
    calculate: (f1, f2) => calculatorEngine.margin(f1, f2)
  },
  'Break-even': {
    name: 'Break-even',
    category: 'money',
    description: 'Calculate units required to cover fixed overheads',
    fields: [
      { label: 'Fixed Costs (₹)', type: 'number', default: '200000' },
      { label: 'Price per Unit (₹)', type: 'number', default: '150' },
      { label: 'Variable Cost per Unit (₹)', type: 'number', default: '70' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.breakEven(f1, f2, f3)
  },
  'CAGR': {
    name: 'CAGR',
    category: 'money',
    description: 'Compound Annual Growth Rate of investments',
    fields: [
      { label: 'Initial Value (₹)', type: 'number', default: '100000' },
      { label: 'Final Value (₹)', type: 'number', default: '280000' },
      { label: 'Number of Years', type: 'number', default: '7' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.cagr(f1, f2, f3)
  },
  'Growth': {
    name: 'Growth',
    category: 'money',
    description: 'Percentage growth between two values',
    fields: [
      { label: 'Old / Base Value', type: 'number', default: '1250' },
      { label: 'New / Current Value', type: 'number', default: '1875' }
    ],
    calculate: (f1, f2) => calculatorEngine.growth(f1, f2)
  },
  'Pricing': {
    name: 'Pricing',
    category: 'money',
    description: 'Determine required selling price to achieve target profit margin',
    fields: [
      { label: 'Unit Cost (₹)', type: 'number', default: '450' },
      { label: 'Target Margin (%)', type: 'number', default: '35' }
    ],
    calculate: (f1, f2) => calculatorEngine.pricing(f1, f2)
  },

  // ==========================================
  // GOLD & PRECIOUS METALS
  // ==========================================
  'Gold Value': {
    name: 'Gold Value',
    category: 'gold',
    description: 'Calculate gold value from weight and rate per unit',
    fields: [
      { label: 'Weight', type: 'number', default: '1' },
      { label: 'Rate per Unit (₹)', type: 'number', default: '125000' },
      {
        label: 'Unit',
        type: 'select',
        options: [
          { value: 'tola', label: 'Tola (11.664 g)' },
          { value: 'g', label: 'Grams (1 g)' },
          { value: 'kg', label: 'Kilograms (1 kg)' },
          { value: 'troy_oz', label: 'Troy Ounce (31.103 g)' }
        ],
        default: 'tola'
      }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.goldValue(f1, f2, f3 || 'tola')
  },
  'Gold Rate × Weight': {
    name: 'Gold Rate × Weight',
    category: 'gold',
    description: 'Compute precise gold cost across various weights',
    fields: [
      { label: 'Weight', type: 'number', default: '2.5' },
      { label: 'Current Rate (₹)', type: 'number', default: '125000' },
      {
        label: 'Unit',
        type: 'select',
        options: [
          { value: 'tola', label: 'Tola' },
          { value: 'g', label: 'Grams' },
          { value: 'aana', label: 'Aana' },
          { value: 'pav', label: 'Pav (10 Tola)' }
        ],
        default: 'tola'
      }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.goldValue(f1, f2, f3 || 'tola')
  },
  'Gold Weight Converter': {
    name: 'Gold Weight Converter',
    category: 'gold',
    description: 'Convert between Tola, Gram, Pav, Aana, Ratti, and Troy Oz',
    isConverter: true,
    unitType: 'generic',
    unitGroup: 'Gold',
    defaultUnitFrom: 'tola',
    defaultUnitTo: 'g',
    fields: [{ label: 'Gold Weight', type: 'number', default: '1' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'tola', uTo = 'g') => calculatorEngine.goldWeightConverter(f1, uFrom, uTo)
  },
  'Karat ↔ Purity': {
    name: 'Karat ↔ Purity',
    category: 'gold',
    description: 'Convert between Karats (24K, 22K, 18K) and Gold Purity Percentage',
    fields: [
      { label: 'Value to Convert', type: 'number', default: '22' },
      {
        label: 'Conversion Direction',
        type: 'select',
        options: [
          { value: 'karatToPurity', label: 'Karat to Purity % (e.g. 22K → 91.67%)' },
          { value: 'purityToKarat', label: 'Purity % to Karat (e.g. 91.67% → 22K)' }
        ],
        default: 'karatToPurity'
      }
    ],
    calculate: (f1, f2) => calculatorEngine.karatPurity(f1, f2 || 'karatToPurity')
  },
  'Pure Gold Weight': {
    name: 'Pure Gold Weight',
    category: 'gold',
    description: 'Calculate 24K pure gold net content from alloy weight and karat',
    fields: [
      { label: 'Gross Jewellery Weight (g / tola)', type: 'number', default: '15' },
      { label: 'Karat (e.g. 22, 18, 14)', type: 'number', default: '22' }
    ],
    calculate: (f1, f2) => calculatorEngine.pureGoldWeight(f1, f2)
  },
  'Jewellery Price': {
    name: 'Jewellery Price',
    category: 'gold',
    description: 'Complete jewellery billing with Making Charges, Wastage, and GST',
    fields: [
      { label: 'Gold Value (₹)', type: 'number', default: '85000' },
      { label: 'Making Charge (%)', type: 'number', default: '8' },
      { label: 'Wastage (Jaddi) (%)', type: 'number', default: '2' },
      { label: 'GST / Tax (%)', type: 'number', default: '3' }
    ],
    calculate: (f1, f2, f3, f4) => calculatorEngine.jewelleryPrice(f1, Number(f2) || 0, Number(f3) || 0, Number(f4) || 3)
  },
  'Making Charge': {
    name: 'Making Charge',
    category: 'gold',
    description: 'Calculate craftsmanship making fee on gold jewellery',
    fields: [
      { label: 'Gold Value (₹)', type: 'number', default: '75000' },
      { label: 'Making Charge (%)', type: 'number', default: '10' }
    ],
    calculate: (f1, f2) => calculatorEngine.makingCharge(f1, f2)
  },
  'Wastage': {
    name: 'Wastage',
    category: 'gold',
    description: 'Calculate jewellery melting wastage (Jaddi / Karda) loss',
    fields: [
      { label: 'Jewellery Weight (g)', type: 'number', default: '25' },
      { label: 'Wastage Percentage (%)', type: 'number', default: '3' },
      { label: 'Gold Rate per Gram (₹)', type: 'number', default: '10500' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.wastage(f1, f2, f3)
  },
  'GST / Tax': {
    name: 'GST / Tax',
    category: 'gold',
    description: 'Standard 3% precious metals Goods & Services Tax calculation',
    fields: [
      { label: 'Precious Metal Subtotal (₹)', type: 'number', default: '120000' },
      { label: 'GST Rate (%)', type: 'number', default: '3' }
    ],
    calculate: (f1, f2) => calculatorEngine.tax(f1, f2, false)
  },
  'Buy / Sell Value': {
    name: 'Buy / Sell Value',
    category: 'gold',
    description: 'Compare buy and sell rates with purity deduction to evaluate dealer spread',
    fields: [
      { label: 'Gross Weight (g)', type: 'number', default: '20' },
      { label: 'Dealer Buying Rate /g (₹)', type: 'number', default: '9800' },
      { label: 'Dealer Selling Rate /g (₹)', type: 'number', default: '10500' },
      { label: 'Purity Percentage (%)', type: 'number', default: '91.6' }
    ],
    calculate: (f1, f2, f3, f4) => calculatorEngine.buySellValue(f1, f2, f3, Number(f4) || 91.6)
  },
  'Silver Value': {
    name: 'Silver Value',
    category: 'gold',
    description: 'Calculate silver metal value by weight in grams or kilograms',
    fields: [
      { label: 'Weight', type: 'number', default: '500' },
      { label: 'Rate per Kilogram (₹)', type: 'number', default: '95000' },
      {
        label: 'Weight Unit',
        type: 'select',
        options: [
          { value: 'g', label: 'Grams' },
          { value: 'kg', label: 'Kilograms' }
        ],
        default: 'g'
      }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.silverValue(f1, f2, f3 === 'g')
  },

  // ==========================================
  // HEALTH & WELLNESS
  // ==========================================
  'BMI': {
    name: 'BMI',
    category: 'health',
    description: 'Body Mass Index and healthy weight category',
    formula: 'BMI = weight(kg) / height(m)²',
    fields: [
      { label: 'Weight (kg)', type: 'number', default: '72' },
      { label: 'Height (cm)', type: 'number', default: '175' }
    ],
    calculate: (f1, f2) => calculatorEngine.bmi(f1, f2, true)
  },
  'BMR': {
    name: 'BMR',
    category: 'health',
    description: 'Mifflin-St Jeor Basal Metabolic Rate (calories burned at rest)',
    fields: [
      { label: 'Weight (kg)', type: 'number', default: '70' },
      { label: 'Height (cm)', type: 'number', default: '175' },
      { label: 'Age (Years)', type: 'number', default: '28' },
      {
        label: 'Biological Sex',
        type: 'select',
        options: [
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' }
        ],
        default: 'male'
      }
    ],
    calculate: (f1, f2, f3, f4) => calculatorEngine.bmr(f1, f2, f3, f4 || 'male')
  },
  'TDEE': {
    name: 'TDEE',
    category: 'health',
    description: 'Total Daily Energy Expenditure based on activity multiplier',
    fields: [
      { label: 'Basal Metabolic Rate (BMR kcal)', type: 'number', default: '1650' },
      {
        label: 'Activity Level',
        type: 'select',
        options: [
          { value: 'sedentary', label: 'Sedentary (Desk job, little exercise)' },
          { value: 'light', label: 'Light (Exercise 1-3 days/week)' },
          { value: 'moderate', label: 'Moderate (Exercise 3-5 days/week)' },
          { value: 'heavy', label: 'Heavy (Hard exercise 6-7 days/week)' },
          { value: 'athlete', label: 'Athlete (Physical job or 2x training)' }
        ],
        default: 'moderate'
      }
    ],
    calculate: (f1, f2) => calculatorEngine.tdee(f1, f2 || 'moderate')
  },
  'Calories': {
    name: 'Calories',
    category: 'health',
    description: 'Personalized calorie intake for maintenance, fat loss, or muscle gain',
    fields: [
      { label: 'Weight (kg)', type: 'number', default: '72' },
      { label: 'Height (cm)', type: 'number', default: '175' },
      { label: 'Age (Years)', type: 'number', default: '26' },
      {
        label: 'Activity Level',
        type: 'select',
        options: [
          { value: 'sedentary', label: 'Sedentary' },
          { value: 'light', label: 'Light' },
          { value: 'moderate', label: 'Moderate' },
          { value: 'heavy', label: 'Heavy' }
        ],
        default: 'moderate'
      }
    ],
    calculate: (f1, f2, f3, f4) => calculatorEngine.calories(f1, f2, f3, 'male', f4 || 'moderate')
  },
  'Macros': {
    name: 'Macros',
    category: 'health',
    description: 'Macronutrient breakdown (Protein, Carbs, Fats) in grams',
    fields: [
      { label: 'Target Daily Calories (kcal)', type: 'number', default: '2200' },
      { label: 'Protein Ratio (%)', type: 'number', default: '30' },
      { label: 'Carbs Ratio (%)', type: 'number', default: '40' },
      { label: 'Fats Ratio (%)', type: 'number', default: '30' }
    ],
    calculate: (f1, f2, f3, f4) => calculatorEngine.macros(f1, Number(f2) || 30, Number(f3) || 40, Number(f4) || 30)
  },
  'Body Fat': {
    name: 'Body Fat',
    category: 'health',
    description: 'US Navy Body Fat percentage formula',
    fields: [
      {
        label: 'Gender',
        type: 'select',
        options: [
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' }
        ],
        default: 'male'
      },
      { label: 'Waist Circumference (cm)', type: 'number', default: '84' },
      { label: 'Neck Circumference (cm)', type: 'number', default: '38' },
      { label: 'Height (cm)', type: 'number', default: '175' }
    ],
    calculate: (f1, f2, f3, f4) => calculatorEngine.bodyFat(f1 || 'male', f2, f3, f4)
  },
  'Water Intake': {
    name: 'Water Intake',
    category: 'health',
    description: 'Optimal daily hydration target in millilitres and litres',
    fields: [
      { label: 'Body Weight (kg)', type: 'number', default: '68' },
      { label: 'Intake Multiplier (ml per kg)', type: 'number', default: '35' }
    ],
    calculate: (f1, f2) => calculatorEngine.waterIntake(f1, Number(f2) || 35)
  },
  'Running Pace': {
    name: 'Running Pace',
    category: 'health',
    description: 'Pace per kilometer and average speed for runs or walks',
    fields: [
      { label: 'Distance (km)', type: 'number', default: '5.0', step: '0.1' },
      { label: 'Total Time (Minutes)', type: 'number', default: '28' }
    ],
    calculate: (f1, f2) => calculatorEngine.pace(f1, f2)
  },
  'Age': {
    name: 'Age',
    category: 'health',
    description: 'Chronological age breakdown in years, months, and days',
    fields: [{ label: 'Date of Birth', type: 'date', default: '1998-05-15' }],
    calculate: (f1) => calculatorEngine.age(f1)
  },
  'Ideal Body Weight': {
    name: 'Ideal Body Weight',
    category: 'health',
    description: 'Devine & Robinson clinical ideal weight range for height',
    fields: [
      { label: 'Height (cm)', type: 'number', default: '175' },
      {
        label: 'Gender',
        type: 'select',
        options: [
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' }
        ],
        default: 'male'
      }
    ],
    calculate: (f1, f2) => calculatorEngine.idealBodyWeight(f1, f2 || 'male')
  },

  // ==========================================
  // TIME & DATE
  // ==========================================
  'Date Difference': {
    name: 'Date Difference',
    category: 'time',
    description: 'Calendar span between two dates in days, weeks, and months',
    fields: [
      { label: 'Start Date', type: 'date', default: '2026-01-01' },
      { label: 'End Date', type: 'date', default: '2026-12-31' }
    ],
    calculate: (f1, f2) => calculatorEngine.dateDifference(f1, f2)
  },
  'Countdown': {
    name: 'Countdown',
    category: 'time',
    description: 'Days and hours remaining until an upcoming event or deadline',
    fields: [{ label: 'Target Date / Event', type: 'date', default: '2026-12-31' }],
    calculate: (f1) => calculatorEngine.countdown(f1)
  },
  'Working Days': {
    name: 'Working Days',
    category: 'time',
    description: 'Count business weekdays (Mon-Fri) excluding weekends',
    fields: [
      { label: 'Start Date', type: 'date', default: '2026-01-01' },
      { label: 'End Date', type: 'date', default: '2026-06-30' }
    ],
    calculate: (f1, f2) => calculatorEngine.workingDays(f1, f2)
  },
  'Date Add / Subtract': {
    name: 'Date Add / Subtract',
    category: 'time',
    description: 'Add or subtract a number of days to find future or past dates',
    fields: [
      { label: 'Base Date', type: 'date', default: '2026-03-25' },
      { label: 'Number of Days', type: 'number', default: '45' },
      {
        label: 'Operation',
        type: 'select',
        options: [
          { value: '+', label: 'Add (+) Days' },
          { value: '-', label: 'Subtract (-) Days' }
        ],
        default: '+'
      }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.dateAddSubtract(f1, f2, f3 || '+')
  },
  'Time Difference': {
    name: 'Time Difference',
    category: 'time',
    description: 'Elapsed hours and minutes between two timestamps',
    fields: [
      { label: 'Start Time (HH:MM)', type: 'time', default: '09:15' },
      { label: 'End Time (HH:MM)', type: 'time', default: '17:45' }
    ],
    calculate: (f1, f2) => calculatorEngine.timeDifference(f1, f2)
  },
  'Time Zone Offset': {
    name: 'Time Zone Offset',
    category: 'time',
    description: 'Convert current time to target UTC offset',
    fields: [{ label: 'Target UTC Offset (Hours)', type: 'number', default: '5.75', step: '0.25' }],
    calculate: (f1) => calculatorEngine.timeZoneOffset(f1)
  },
  'Unix Timestamp': {
    name: 'Unix Timestamp',
    category: 'time',
    description: 'Convert between Unix epoch timestamps and human dates',
    fields: [
      { label: 'Input Value', type: 'text', default: '1774435200' },
      {
        label: 'Mode',
        type: 'select',
        options: [
          { value: 'toDate', label: 'Unix Timestamp → Date' },
          { value: 'toTimestamp', label: 'Date String → Unix Timestamp' }
        ],
        default: 'toDate'
      }
    ],
    calculate: (f1, f2) => calculatorEngine.unixTimestamp(f1, f2 || 'toDate')
  },
  'Weekday': {
    name: 'Weekday',
    category: 'time',
    description: 'Find day of the week, leap year status, and calendar details',
    fields: [{ label: 'Select Date', type: 'date', default: '2026-09-25' }],
    calculate: (f1) => calculatorEngine.weekday(f1)
  },

  // ==========================================
  // CONVERTERS
  // ==========================================
  'Length': {
    name: 'Length',
    category: 'converter',
    description: 'Convert meters, feet, kilometers, inches, miles, and yards',
    isConverter: true,
    unitType: 'generic',
    unitGroup: 'Length',
    defaultUnitFrom: 'm',
    defaultUnitTo: 'ft',
    fields: [{ label: 'Length Value', type: 'number', default: '10' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'm', uTo = 'ft') =>
      calculatorEngine.unit(f1, uFrom, uTo, CALC_UNIT_FACTORS.Length)
  },
  'Weight': {
    name: 'Weight',
    category: 'converter',
    description: 'Convert kilograms, grams, pounds, ounces, and tons',
    isConverter: true,
    unitType: 'generic',
    unitGroup: 'Weight',
    defaultUnitFrom: 'kg',
    defaultUnitTo: 'lb',
    fields: [{ label: 'Weight Value', type: 'number', default: '1' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'kg', uTo = 'lb') =>
      calculatorEngine.unit(f1, uFrom, uTo, CALC_UNIT_FACTORS.Weight)
  },
  'Area': {
    name: 'Area',
    category: 'converter',
    description: 'Convert square meters, square feet, acres, and hectares',
    isConverter: true,
    unitType: 'generic',
    unitGroup: 'Area',
    defaultUnitFrom: 'sq_m',
    defaultUnitTo: 'sq_ft',
    fields: [{ label: 'Area Value', type: 'number', default: '100' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'sq_m', uTo = 'sq_ft') =>
      calculatorEngine.unit(f1, uFrom, uTo, CALC_UNIT_FACTORS.Area)
  },
  'Volume': {
    name: 'Volume',
    category: 'converter',
    description: 'Convert litres, millilitres, gallons, and cubic meters',
    isConverter: true,
    unitType: 'generic',
    unitGroup: 'Volume',
    defaultUnitFrom: 'liter',
    defaultUnitTo: 'gallon',
    fields: [{ label: 'Volume Value', type: 'number', default: '10' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'liter', uTo = 'gallon') =>
      calculatorEngine.unit(f1, uFrom, uTo, CALC_UNIT_FACTORS.Volume)
  },
  'Temperature': {
    name: 'Temperature',
    category: 'converter',
    description: 'Convert Celsius, Fahrenheit, and Kelvin',
    isConverter: true,
    unitType: 'temp',
    defaultUnitFrom: 'C',
    defaultUnitTo: 'F',
    fields: [{ label: 'Temperature Value', type: 'number', default: '37' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'C', uTo = 'F') =>
      calculatorEngine.temperature(f1, uFrom, uTo)
  },
  'Speed': {
    name: 'Speed',
    category: 'converter',
    description: 'Convert km/h, mph, m/s, and knots',
    isConverter: true,
    unitType: 'generic',
    unitGroup: 'Speed',
    defaultUnitFrom: 'kmh',
    defaultUnitTo: 'mph',
    fields: [{ label: 'Speed Value', type: 'number', default: '100' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'kmh', uTo = 'mph') =>
      calculatorEngine.unit(f1, uFrom, uTo, CALC_UNIT_FACTORS.Speed)
  },
  'Time': {
    name: 'Time',
    category: 'converter',
    description: 'Convert seconds, minutes, hours, days, weeks, and years',
    isConverter: true,
    unitType: 'generic',
    unitGroup: 'Time',
    defaultUnitFrom: 'hour',
    defaultUnitTo: 'minute',
    fields: [{ label: 'Time Value', type: 'number', default: '2.5' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'hour', uTo = 'minute') =>
      calculatorEngine.unit(f1, uFrom, uTo, CALC_UNIT_FACTORS.Time)
  },
  'Energy': {
    name: 'Energy',
    category: 'converter',
    description: 'Convert Joules, calories, kWh, and BTU',
    isConverter: true,
    unitType: 'generic',
    unitGroup: 'Energy',
    defaultUnitFrom: 'kwh',
    defaultUnitTo: 'joule',
    fields: [{ label: 'Energy Value', type: 'number', default: '1' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'kwh', uTo = 'joule') =>
      calculatorEngine.unit(f1, uFrom, uTo, CALC_UNIT_FACTORS.Energy)
  },
  'Pressure': {
    name: 'Pressure',
    category: 'converter',
    description: 'Convert Pascal, Bar, PSI, and Atmosphere',
    isConverter: true,
    unitType: 'generic',
    unitGroup: 'Pressure',
    defaultUnitFrom: 'psi',
    defaultUnitTo: 'bar',
    fields: [{ label: 'Pressure Value', type: 'number', default: '32' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'psi', uTo = 'bar') =>
      calculatorEngine.unit(f1, uFrom, uTo, CALC_UNIT_FACTORS.Pressure)
  },
  'Power': {
    name: 'Power',
    category: 'converter',
    description: 'Convert Watts, Kilowatts, and Horsepower',
    isConverter: true,
    unitType: 'generic',
    unitGroup: 'Power',
    defaultUnitFrom: 'kw',
    defaultUnitTo: 'hp',
    fields: [{ label: 'Power Value', type: 'number', default: '75' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'kw', uTo = 'hp') =>
      calculatorEngine.unit(f1, uFrom, uTo, CALC_UNIT_FACTORS.Power)
  },
  'Data Size': {
    name: 'Data Size',
    category: 'converter',
    description: 'Convert Bytes, KB, MB, GB, TB, and PB',
    isConverter: true,
    unitType: 'generic',
    unitGroup: 'DataSize',
    defaultUnitFrom: 'GB',
    defaultUnitTo: 'MB',
    fields: [{ label: 'Data Size', type: 'number', default: '8' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'GB', uTo = 'MB') =>
      calculatorEngine.unit(f1, uFrom, uTo, CALC_UNIT_FACTORS.DataSize)
  },
  'Currency': {
    name: 'Currency',
    category: 'converter',
    description: 'Convert between USD, INR, NPR, EUR, GBP, AUD, CAD, AED, and JPY',
    isConverter: true,
    unitType: 'currency',
    defaultUnitFrom: 'USD',
    defaultUnitTo: 'NPR',
    fields: [{ label: 'Amount', type: 'number', default: '100' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'USD', uTo = 'NPR') =>
      calculatorEngine.currency(f1, uFrom, uTo)
  },
  'Nepal Land': {
    name: 'Nepal Land',
    category: 'converter',
    description: 'Convert Ropani, Aana, Paisa, Daam, Bigha, Kattha, Dhur, and Sq. Ft.',
    isConverter: true,
    unitType: 'nepal_land',
    defaultUnitFrom: 'ropani',
    defaultUnitTo: 'sq_ft',
    fields: [{ label: 'Land Quantity', type: 'number', default: '1' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'ropani', uTo = 'sq_ft') =>
      calculatorEngine.unit(f1, uFrom, uTo, NP_UNITS.land)
  },
  'Nepal Length': {
    name: 'Nepal Length',
    category: 'converter',
    description: 'Convert Haat, Bitta, Angul, Danda, Gaj, Kosh, Meter, and Feet',
    isConverter: true,
    unitType: 'nepal_length',
    defaultUnitFrom: 'haat',
    defaultUnitTo: 'ft',
    fields: [{ label: 'Length Quantity', type: 'number', default: '10' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'haat', uTo = 'ft') =>
      calculatorEngine.unit(f1, uFrom, uTo, NP_UNITS.length)
  },
  'Nepal Volume': {
    name: 'Nepal Volume',
    category: 'converter',
    description: 'Convert Muri, Pathi, Mana, Kurwa, Muthi, and Litres',
    isConverter: true,
    unitType: 'nepal_volume',
    defaultUnitFrom: 'muri',
    defaultUnitTo: 'liter',
    fields: [{ label: 'Volume Quantity', type: 'number', default: '1' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'muri', uTo = 'liter') =>
      calculatorEngine.unit(f1, uFrom, uTo, NP_UNITS.volume)
  },
  'Nepal Weight': {
    name: 'Nepal Weight',
    category: 'converter',
    description: 'Convert Dharni, Seer, Chatak, Maund, Tola, and Kilograms',
    isConverter: true,
    unitType: 'nepal_weight',
    defaultUnitFrom: 'dharn',
    defaultUnitTo: 'kg',
    fields: [{ label: 'Weight Quantity', type: 'number', default: '1' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'dharn', uTo = 'kg') =>
      calculatorEngine.unit(f1, uFrom, uTo, NP_UNITS.weight)
  },

  // ==========================================
  // HOME & LIVING
  // ==========================================
  'Room Area': {
    name: 'Room Area',
    category: 'home',
    description: 'Calculate floor area and wall perimeter',
    fields: [
      { label: 'Length (ft)', type: 'number', default: '15' },
      { label: 'Width (ft)', type: 'number', default: '12' }
    ],
    calculate: (f1, f2) => calculatorEngine.roomArea(f1, f2, 'ft')
  },
  'Paint': {
    name: 'Paint',
    category: 'home',
    description: 'Estimate litres of paint required for room walls and coats',
    fields: [
      { label: 'Room Length (ft)', type: 'number', default: '14' },
      { label: 'Room Width (ft)', type: 'number', default: '12' },
      { label: 'Ceiling Height (ft)', type: 'number', default: '10' },
      { label: 'Number of Coats', type: 'number', default: '2' }
    ],
    calculate: (f1, f2, f3, f4) => calculatorEngine.paint(f1, f2, f3, Number(f4) || 2)
  },
  'Flooring': {
    name: 'Flooring',
    category: 'home',
    description: 'Calculate total flooring material needed including wastage',
    fields: [
      { label: 'Room Length (ft)', type: 'number', default: '16' },
      { label: 'Room Width (ft)', type: 'number', default: '14' },
      { label: 'Cutting Wastage (%)', type: 'number', default: '10' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.flooring(f1, f2, Number(f3) || 10)
  },
  'Tiles': {
    name: 'Tiles',
    category: 'home',
    description: 'Calculate number of ceramic or porcelain tiles for a room area',
    fields: [
      { label: 'Room Area (sq ft)', type: 'number', default: '250' },
      { label: 'Tile Width (Inches)', type: 'number', default: '24' },
      { label: 'Tile Height (Inches)', type: 'number', default: '24' },
      { label: 'Wastage (%)', type: 'number', default: '10' }
    ],
    calculate: (f1, f2, f3, f4) => calculatorEngine.tiles(f1, f2, f3, Number(f4) || 10)
  },
  'Construction': {
    name: 'Construction',
    category: 'home',
    description: 'Estimator for building cost, cement, steel, and sand quantities',
    fields: [
      { label: 'Built-up Area (sq ft)', type: 'number', default: '1200' },
      { label: 'Estimated Rate / sq ft (₹)', type: 'number', default: '2500' }
    ],
    calculate: (f1, f2) => calculatorEngine.construction(f1, Number(f2) || 2500)
  },
  'Electricity Cost': {
    name: 'Electricity Cost',
    category: 'home',
    description: 'Calculate monthly electricity bill for heavy appliances',
    fields: [
      { label: 'Appliance Power (Watts)', type: 'number', default: '1500' },
      { label: 'Hours Used per Day', type: 'number', default: '8' },
      { label: 'Cost per Unit / kWh (₹)', type: 'number', default: '9.5', step: '0.1' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.electricityCost(f1, f2, f3, 30)
  },
  'Water Usage': {
    name: 'Water Usage',
    category: 'home',
    description: 'Monthly household water demand and tanker requirement',
    fields: [
      { label: 'Family Members', type: 'number', default: '4' },
      { label: 'Usage per Person / Day (L)', type: 'number', default: '135' }
    ],
    calculate: (f1, f2) => calculatorEngine.waterUsage(f1, Number(f2) || 135, 30)
  },

  // ==========================================
  // VEHICLE & AUTO
  // ==========================================
  'Mileage': {
    name: 'Mileage',
    category: 'vehicle',
    description: 'Calculate fuel economy in km/L and L/100km',
    fields: [
      { label: 'Distance Driven (km)', type: 'number', default: '450' },
      { label: 'Fuel Consumed (Litres)', type: 'number', default: '28' }
    ],
    calculate: (f1, f2) => calculatorEngine.mileage(f1, f2)
  },
  'Fuel Cost': {
    name: 'Fuel Cost',
    category: 'vehicle',
    description: 'Calculate trip fuel volume and monetary cost',
    fields: [
      { label: 'Distance (km)', type: 'number', default: '320' },
      { label: 'Vehicle Mileage (km/L)', type: 'number', default: '16.5', step: '0.1' },
      { label: 'Fuel Price per Litre (₹)', type: 'number', default: '102' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.fuelCost(f1, f2, f3)
  },
  'Trip Fuel': {
    name: 'Trip Fuel',
    category: 'vehicle',
    description: 'Calculate road trip fuel budget and per-passenger share',
    fields: [
      { label: 'Round-Trip Distance (km)', type: 'number', default: '600' },
      { label: 'Mileage (km/L)', type: 'number', default: '15' },
      { label: 'Fuel Price (₹/L)', type: 'number', default: '105' },
      { label: 'Number of Passengers', type: 'number', default: '4' }
    ],
    calculate: (f1, f2, f3, f4) => calculatorEngine.tripFuel(f1, f2, f3, Number(f4) || 1)
  },
  'Running Cost': {
    name: 'Running Cost',
    category: 'vehicle',
    description: 'Estimate monthly car/bike ownership cost per kilometer',
    fields: [
      { label: 'Monthly Driving (km)', type: 'number', default: '1200' },
      { label: 'Mileage (km/L)', type: 'number', default: '16' },
      { label: 'Fuel Price (₹/L)', type: 'number', default: '102' },
      { label: 'Monthly Maintenance & Insurance (₹)', type: 'number', default: '2000' }
    ],
    calculate: (f1, f2, f3, f4) => calculatorEngine.runningCost(f1, f2, f3, Number(f4) || 0)
  },
  'Vehicle Loan': {
    name: 'Vehicle Loan',
    category: 'vehicle',
    description: 'Calculate auto loan EMI and interest after down payment',
    fields: [
      { label: 'On-Road Vehicle Price (₹)', type: 'number', default: '800000' },
      { label: 'Down Payment (₹)', type: 'number', default: '150000' },
      { label: 'Interest Rate (%)', type: 'number', default: '9.0', step: '0.1' },
      { label: 'Tenure (Months)', type: 'number', default: '60' }
    ],
    calculate: (f1, f2, f3, f4) => calculatorEngine.vehicleLoan(f1, f2, f3, Number(f4) || 60)
  },
  'Fuel Economy': {
    name: 'Fuel Economy',
    category: 'vehicle',
    description: 'Convert between km/L, L/100km, US MPG, and UK MPG',
    isConverter: true,
    unitType: 'generic',
    unitGroup: 'FuelEconomy',
    defaultUnitFrom: 'km_l',
    defaultUnitTo: 'mpg_us',
    fields: [{ label: 'Economy Value', type: 'number', default: '18' }],
    calculate: (f1, _f2, _f3, _f4, uFrom = 'km_l', uTo = 'mpg_us') =>
      calculatorEngine.fuelEconomy(f1, uFrom, uTo)
  },

  // ==========================================
  // TRAVEL
  // ==========================================
  'Trip Budget': {
    name: 'Trip Budget',
    category: 'travel',
    description: 'Plan total vacation budget across lodging, food, and transport',
    fields: [
      { label: 'Travelers', type: 'number', default: '2' },
      { label: 'Trip Days', type: 'number', default: '7' },
      { label: 'Hotel / Lodging per Night (₹)', type: 'number', default: '3500' },
      { label: 'Food per Person / Day (₹)', type: 'number', default: '1200' }
    ],
    calculate: (f1, f2, f3, f4) => calculatorEngine.tripBudget(f1, f2, f3, f4, 5000)
  },
  'Distance': {
    name: 'Distance',
    category: 'travel',
    description: 'Calculate distance from average speed and travel time',
    fields: [
      { label: 'Average Speed (km/h)', type: 'number', default: '65' },
      { label: 'Travel Duration (Hours)', type: 'number', default: '4.5', step: '0.1' }
    ],
    calculate: (f1, f2) => calculatorEngine.travelDistance(f1, f2)
  },
  'Travel Time': {
    name: 'Travel Time',
    category: 'travel',
    description: 'Estimate journey duration from distance and speed',
    fields: [
      { label: 'Distance (km)', type: 'number', default: '280' },
      { label: 'Average Speed (km/h)', type: 'number', default: '55' }
    ],
    calculate: (f1, f2) => calculatorEngine.travelTime(f1, f2)
  },
  'Fuel Budget': {
    name: 'Fuel Budget',
    category: 'travel',
    description: 'Estimate required fuel budget for road travel',
    fields: [
      { label: 'Total Trip Distance (km)', type: 'number', default: '850' },
      { label: 'Vehicle Mileage (km/L)', type: 'number', default: '17' },
      { label: 'Fuel Price (₹/L)', type: 'number', default: '102' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.fuelCost(f1, f2, f3)
  },
  'Travel Currency': {
    name: 'Travel Currency',
    category: 'travel',
    description: 'Estimate currency exchange with card markup or conversion fee',
    fields: [
      { label: 'Amount to Convert', type: 'number', default: '50000' },
      {
        label: 'From Currency',
        type: 'select',
        options: [
          { value: 'INR', label: 'INR (₹)' },
          { value: 'NPR', label: 'NPR (Rs)' },
          { value: 'USD', label: 'USD ($)' },
          { value: 'EUR', label: 'EUR (€)' }
        ],
        default: 'INR'
      },
      {
        label: 'To Currency',
        type: 'select',
        options: [
          { value: 'USD', label: 'USD ($)' },
          { value: 'EUR', label: 'EUR (€)' },
          { value: 'AED', label: 'AED (Dirham)' },
          { value: 'THB', label: 'THB (Baht)' }
        ],
        default: 'USD'
      }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.currency(f1, f2 || 'INR', f3 || 'USD')
  },
  'Travel Time Zone': {
    name: 'Travel Time Zone',
    category: 'travel',
    description: 'Calculate destination arrival time across time zones',
    fields: [
      { label: 'Departure UTC Offset (Hours)', type: 'number', default: '5.5' },
      { label: 'Flight Duration (Hours)', type: 'number', default: '8.5' },
      { label: 'Destination UTC Offset (Hours)', type: 'number', default: '0' }
    ],
    calculate: (f1, f2, f3) => {
      const depOffset = Number(f1) || 0;
      const flight = Number(f2) || 0;
      const destOffset = Number(f3) || 0;
      const diff = destOffset - depOffset;
      const effectiveFlightTime = flight + diff;
      return `Destination Time Offset: ${diff >= 0 ? '+' : ''}${diff} hrs | Effective Clock Difference upon landing: ${effectiveFlightTime.toFixed(1)} hrs`;
    }
  },

  // ==========================================
  // BUSINESS
  // ==========================================
  'Revenue': {
    name: 'Revenue',
    category: 'business',
    description: 'Calculate total gross turnover from volume and unit price',
    fields: [
      { label: 'Quantity / Units Sold', type: 'number', default: '2500' },
      { label: 'Selling Price per Unit (₹)', type: 'number', default: '350' }
    ],
    calculate: (f1, f2) => calculatorEngine.revenue(f1, f2)
  },
  'Business ROI': {
    name: 'Business ROI',
    category: 'business',
    description: 'Calculate net profit margin and commercial return on project capital',
    fields: [
      { label: 'Initial Project Capital (₹)', type: 'number', default: '500000' },
      { label: 'Gross Revenue Generated (₹)', type: 'number', default: '920000' },
      { label: 'Operating Costs (₹)', type: 'number', default: '150000' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.businessRoi(f1, f2, Number(f3) || 0)
  },

  // ==========================================
  // PROGRAMMER
  // ==========================================
  'Binary': {
    name: 'Binary',
    category: 'programmer',
    description: 'Convert base-2 binary string to Decimal, Hex, Octal, and ASCII',
    fields: [{ label: 'Binary String (0s and 1s)', type: 'text', default: '10101010' }],
    calculate: (f1) => {
      const res = calculatorEngine.programmerAllBases(f1, 2);
      return `Decimal: ${res.dec} | Hex: 0x${res.hex} | Octal: ${res.oct} | Character: ${res.char}`;
    }
  },
  'Decimal': {
    name: 'Decimal',
    category: 'programmer',
    description: 'Convert base-10 decimal integer to Binary, Hex, and Octal',
    fields: [{ label: 'Decimal Integer', type: 'number', default: '255' }],
    calculate: (f1) => {
      const res = calculatorEngine.programmerAllBases(f1, 10);
      return `Binary: ${res.bin} | Hex: 0x${res.hex} | Octal: ${res.oct} | Character: ${res.char}`;
    }
  },
  'Hexadecimal': {
    name: 'Hexadecimal',
    category: 'programmer',
    description: 'Convert base-16 hexadecimal to Decimal, Binary, and Octal',
    fields: [{ label: 'Hex String (0-9, A-F)', type: 'text', default: 'FF' }],
    calculate: (f1) => {
      const res = calculatorEngine.programmerAllBases(f1, 16);
      return `Decimal: ${res.dec} | Binary: ${res.bin} | Octal: ${res.oct} | Character: ${res.char}`;
    }
  },
  'Octal': {
    name: 'Octal',
    category: 'programmer',
    description: 'Convert base-8 octal to Decimal, Binary, and Hex',
    fields: [{ label: 'Octal String (0-7)', type: 'text', default: '377' }],
    calculate: (f1) => {
      const res = calculatorEngine.programmerAllBases(f1, 8);
      return `Decimal: ${res.dec} | Binary: ${res.bin} | Hex: 0x${res.hex} | Character: ${res.char}`;
    }
  },
  'Base Converter': {
    name: 'Base Converter',
    category: 'programmer',
    description: 'Convert numbers across arbitrary radix bases from 2 to 36',
    fields: [
      { label: 'Input Value', type: 'text', default: '255' },
      { label: 'From Base (2-36)', type: 'number', default: '10' },
      { label: 'To Base (2-36)', type: 'number', default: '16' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.baseConvert(f1, f2, f3)
  },
  'Bitwise': {
    name: 'Bitwise',
    category: 'programmer',
    description: 'Bitwise operations (AND, OR, XOR, NOT, Shift Left, Shift Right)',
    fields: [
      { label: 'Operand A (Integer)', type: 'number', default: '12' },
      {
        label: 'Bitwise Operator',
        type: 'select',
        options: [
          { value: 'AND', label: 'AND (&)' },
          { value: 'OR', label: 'OR (|)' },
          { value: 'XOR', label: 'XOR (^)' },
          { value: 'NOT', label: 'NOT (~A)' },
          { value: '<<', label: 'Shift Left (<<)' },
          { value: '>>', label: 'Shift Right (>>)' }
        ],
        default: 'AND'
      },
      { label: 'Operand B (Integer)', type: 'number', default: '25' }
    ],
    calculate: (f1, f2, f3) => calculatorEngine.bitwise(f1, f2 || 'AND', f3)
  },
  'Modulo': {
    name: 'Modulo',
    category: 'programmer',
    description: 'Integer division quotient, remainder, and modulo formula',
    fields: [
      { label: 'Dividend (A)', type: 'number', default: '47' },
      { label: 'Divisor (B)', type: 'number', default: '5' }
    ],
    calculate: (f1, f2) => calculatorEngine.modulo(f1, f2)
  },
  'IP / Subnet': {
    name: 'IP / Subnet',
    category: 'programmer',
    description: 'IPv4 CIDR network prefix, subnet mask, usable host range, and broadcast',
    fields: [
      { label: 'IPv4 Address', type: 'text', default: '192.168.1.1' },
      { label: 'CIDR Prefix (e.g. 24 for /24)', type: 'number', default: '24' }
    ],
    calculate: (f1, f2) => calculatorEngine.ipSubnet(f1, f2)
  }
};

export const TOOL_CONFIGS = ALL_TOOL_CONFIGS;

export const getToolConfig = (toolName: string): ToolConfig => {
  if (ALL_TOOL_CONFIGS[toolName]) {
    return ALL_TOOL_CONFIGS[toolName];
  }
  // Safe generic fallback
  return {
    name: toolName,
    category: 'quick',
    description: `Computational tool for ${toolName}`,
    fields: [
      { label: 'Input A', type: 'number', default: '100' },
      { label: 'Input B', type: 'number', default: '10' }
    ],
    calculate: (f1, f2) => `Result for ${toolName}: ${Number(f1) + Number(f2)}`
  };
};
