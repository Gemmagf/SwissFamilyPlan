import { FinancialData, ProjectionPoint, ScenarioResult, ScenarioType } from '../types';

/**
 * Finance engine modularitzat.
 * Funcions:
 *  - calculateProjections(data, scenarioModifiers)
 *  - computeChildrenSchedule
 *  - calculateViableEarlyRetirement
 */

type ScenarioModifiers = {
  salaryGrowthModPct: number;
  returnModPct: number;
  inflationModPct: number;
  expenseMultiplier?: number;
};

const DEFAULT_MAX_AGE = 90;

// Swiss Pension Constants
const AHV_COUPLE_MAX_ANNUAL_2025 = 44100; // Approx 3675 * 12
const LPP_CONVERSION_RATE = 0.058; // 5.8% (Conservative average between 5.0 and 6.8)
const LPP_INTEREST_RATE = 0.02; // Conservative return on LPP assets (usually lower than market)
const MAX_3A_CONTRIBUTION_PER_PERSON = 7056; // 2025 max

const taxFactorByCanton: Record<string, number> = {
  Zürich: 0.78,
  Zurich: 0.78,
  Zug: 0.82,
  Geneva: 0.70,
  Vaud: 0.73,
  default: 0.75
};

function getTaxFactor(canton?: string) {
  if (!canton) return taxFactorByCanton.default;
  return taxFactorByCanton[canton as keyof typeof taxFactorByCanton] ?? taxFactorByCanton.default;
}

function computeChildrenSchedule(data: FinancialData): number[] {
  const schedule: number[] = [];
  for (let i = 0; i < data.currentChildren; i++) {
    schedule.push(2 + i * 2);
  }
  const firstOffset = data.firstChildBirthYearOffset ?? 1;
  const spacing = data.childSpacingYears ?? 2;
  for (let j = 0; j < data.futureChildren; j++) {
    const ageAtStart = -(firstOffset + j * spacing);
    schedule.push(ageAtStart);
  }
  return schedule;
}

export function calculateProjections(data: FinancialData, scenario: ScenarioType): ScenarioResult {
  let modifiers: ScenarioModifiers = { salaryGrowthModPct: 0, returnModPct: 0, inflationModPct: 0, expenseMultiplier: 1.0 };
  if (scenario === 'pessimistic') {
    modifiers = { salaryGrowthModPct: -1.5, returnModPct: -2.0, inflationModPct: 1.0, expenseMultiplier: 1.10 };
  } else if (scenario === 'optimistic') {
    modifiers = { salaryGrowthModPct: 1.0, returnModPct: 1.5, inflationModPct: -0.5, expenseMultiplier: 0.97 };
  }

  const taxFactor = getTaxFactor(data.canton);
  
  // Initialize Salaries
  let grossSalary1 = data.annualGrossSalary1;
  let grossSalary2 = data.annualGrossSalary2;
  let grossBonus = data.annualBonus;

  const baseInflationPct = 2.0 + modifiers.inflationModPct;
  const effectiveInvestmentReturnPct = Math.max(0, data.investmentReturn + modifiers.returnModPct);

  // Separate Assets Buckets
  let pillar2Wealth = data.pillar2Value;
  let pillar3Wealth = data.pillar3Value;
  let freeSavingsWealth = data.currentSavings; // Cash + Invested combined for simplicity
  
  // Split Free Savings into Cash Buffer (30%) and Investments (70%)
  let cashBuffer = freeSavingsWealth * 0.3;
  let investedWealth = freeSavingsWealth * 0.7;

  // Variables for Retirement Snapshot
  let ahvAnnualPensionSnapshot = 0;
  let lppAnnualPensionSnapshot = 0;
  let pillar3AnnualDrawdownSnapshot = 0;
  let retirementSnapshotTaken = false;

  const childrenSchedule = computeChildrenSchedule(data); 
  const childrenAges = [...childrenSchedule];
  const startYear = new Date().getFullYear();
  const maxAge = DEFAULT_MAX_AGE;
  const points: ProjectionPoint[] = [];
  
  let maxWealth = 0;
  let savingsDepletedAge: number | null = null;

  for (let age = data.currentAge; age <= maxAge; age++) {
    const yearIndex = age - data.currentAge;
    const year = startYear + yearIndex;
    const isRetired = age >= data.retirementAge;

    // --- Inflation Factors ---
    const inflationFactor = Math.pow(1 + baseInflationPct / 100, yearIndex);
    const housingInflationFactor = Math.pow(1 + data.housingCostIncrease / 100, yearIndex);
    
    // --- Expenses Calculation ---
    let annualChildrenExpenses = 0;
    let activeChildrenCount = 0;
    
    for (let i = 0; i < childrenAges.length; i++) {
      let childAge = childrenAges[i];
      if (childAge < 0) { childrenAges[i] = childAge + 1; continue; }
      if (childAge >= 0 && childAge < 25) activeChildrenCount++;

      if (childAge < 5) annualChildrenExpenses += (data.monthlyDaycareCost * 12);
      else if (childAge >= 5 && childAge < 19) annualChildrenExpenses += (data.monthlySchoolActivityCost * 12);
      else if (childAge >= 19 && childAge < 23) annualChildrenExpenses += (data.universitySupport / 4);
      
      childrenAges[i] = childAge + 1;
    }
    annualChildrenExpenses *= (modifiers.expenseMultiplier ?? 1);

    const livingAnnual = data.monthlyLivingCost * 12 * inflationFactor * (modifiers.expenseMultiplier ?? 1);
    const travelAnnual = data.yearlyTravelBudget * inflationFactor * (modifiers.expenseMultiplier ?? 1);

    let baseHousingAnnual = data.currentHousingCost * 12;
    const familySize = 2 + activeChildrenCount;
    if (familySize >= 6 && baseHousingAnnual < 24000) baseHousingAnnual = Math.max(baseHousingAnnual, 26000);
    const housingAnnual = baseHousingAnnual * housingInflationFactor * (modifiers.expenseMultiplier ?? 1);

    const totalExpenses = housingAnnual + livingAnnual + annualChildrenExpenses + travelAnnual;

    // --- Income & Savings Logic ---
    let totalIncomeNet = 0;
    let totalGrossIncome = 0;
    let pensionAHV = 0;
    let pensionLPP = 0;
    let pension3a = 0;

    let annualSavingsCapacity = 0; // Money available to put into P3 or Free Savings

    if (!isRetired) {
      // --- Working Phase ---
      const salaryNet1 = grossSalary1 * taxFactor;
      const salaryNet2 = grossSalary2 * taxFactor;
      const bonusNet = grossBonus * 0.65;
      
      totalGrossIncome = grossSalary1 + grossSalary2 + grossBonus;
      totalIncomeNet = salaryNet1 + salaryNet2 + bonusNet;
      
      annualSavingsCapacity = totalIncomeNet - totalExpenses; // Can be negative

      // 1. Pillar 2 Growth (Mandatory + Extra)
      // Assumption: Total Savings Credit ~12% of Gross Salary
      const lppContribution = (grossSalary1 + grossSalary2) * 0.12; 
      // LPP Growth (Interest + Contribution)
      pillar2Wealth = (pillar2Wealth * (1 + LPP_INTEREST_RATE)) + lppContribution;

      // 2. Pillar 3a & Free Savings Allocation
      // If we have savings capacity, fill P3a first, then Free Savings
      // Target P3a: Max for 2 people
      const maxP3aTarget = MAX_3A_CONTRIBUTION_PER_PERSON * 2;
      
      // Determine how much of the user's "monthlyContribution" input is meant for P3 vs Free.
      // We assume the user's input "monthlyContribution" represents their *planned* savings.
      // However, calculation above (`annualSavingsCapacity`) is the *actual* budget reality.
      
      let amountAvailableToSave = annualSavingsCapacity; 
      
      if (amountAvailableToSave > 0) {
        const p3Contribution = Math.min(amountAvailableToSave, maxP3aTarget);
        pillar3Wealth = (pillar3Wealth * (1 + effectiveInvestmentReturnPct/100)) + p3Contribution;
        
        const remainingForFreeSavings = amountAvailableToSave - p3Contribution;
        
        // Invest remaining based on split
        cashBuffer += remainingForFreeSavings * 0.3;
        investedWealth += remainingForFreeSavings * 0.7;
      } else {
        // Deficit: Deflate assets
        // P3 and LPP are locked. Must burn Free Savings.
        const deficit = -amountAvailableToSave;
        if (cashBuffer >= deficit) {
          cashBuffer -= deficit;
        } else {
          const remaining = deficit - cashBuffer;
          cashBuffer = 0;
          investedWealth = Math.max(0, investedWealth - remaining);
        }
        // Assets still grow
        pillar3Wealth *= (1 + effectiveInvestmentReturnPct/100);
      }
      
      // Grow Free Investments
      investedWealth *= (1 + effectiveInvestmentReturnPct/100);

    } else {
      // --- Retirement Phase ---
      
      if (!retirementSnapshotTaken) {
        // SNAPSHOT: Calculate fixed pension values at the moment of retirement
        
        // 1. AHV: Public Pension (indexed to inflation approx.)
        // We use current max * inflationFactor to set the nominal AHV at retirement year.
        // NOTE: User spec implies AHV is a fixed component. 
        ahvAnnualPensionSnapshot = AHV_COUPLE_MAX_ANNUAL_2025 * inflationFactor;

        // 2. LPP: Conversion Rate on Capital (Fixed Nominal Annuity)
        lppAnnualPensionSnapshot = pillar2Wealth * LPP_CONVERSION_RATE;

        // 3. Pillar 3a: Linear Drawdown (Capital / Years)
        // pillar3_annual_income = pillar3_balance / expected_years_of_retirement
        const yearsInRetirement = DEFAULT_MAX_AGE - data.retirementAge;
        pillar3AnnualDrawdownSnapshot = pillar3Wealth / Math.max(1, yearsInRetirement);

        retirementSnapshotTaken = true;
      }

      // Calculate annual income for this year
      // AHV: We maintain purchasing power (inflate) to follow Swiss indexation rules (simplified)
      pensionAHV = AHV_COUPLE_MAX_ANNUAL_2025 * inflationFactor;

      // LPP: Fixed Nominal
      pensionLPP = lppAnnualPensionSnapshot;

      // Pillar 3a: Fixed Nominal Drawdown (until exhausted)
      if (pillar3Wealth > 0) {
         pension3a = pillar3AnnualDrawdownSnapshot;
         // Ensure we don't draw more than we have
         if (pension3a > pillar3Wealth) pension3a = pillar3Wealth;
      } else {
         pension3a = 0;
      }

      totalGrossIncome = pensionAHV + pensionLPP + pension3a;
      
      // Net Pension (Taxation is usually lower than salary)
      // "L’ingrés “net” es calcula amb un impost simplificat de jubilació."
      const pensionTaxFactor = 0.85; 
      totalIncomeNet = totalGrossIncome * pensionTaxFactor;

      annualSavingsCapacity = totalIncomeNet - totalExpenses;

      // Retirement Asset Logic
      
      // Pillar 2 is converted to Rent -> Wealth is 0 (insurance value)
      pillar2Wealth = 0; 

      // Pillar 3 is drawn down
      pillar3Wealth = Math.max(0, pillar3Wealth - pension3a);
      // Remaining Pillar 3 capital grows slightly (conservative, as it's being paid out)
      pillar3Wealth *= (1 + (effectiveInvestmentReturnPct/100) * 0.3);
      
      // Free Savings Logic (covering deficit or growing surplus)
      if (annualSavingsCapacity >= 0) {
        // Save surplus
        cashBuffer += annualSavingsCapacity; 
      } else {
        // Burn deficit from Free Savings
        const deficit = -annualSavingsCapacity;
        if (cashBuffer >= deficit) {
           cashBuffer -= deficit;
        } else {
           const rem = deficit - cashBuffer;
           cashBuffer = 0;
           investedWealth = Math.max(0, investedWealth - rem);
        }
      }
      
      // Growth on remaining assets
      investedWealth *= (1 + effectiveInvestmentReturnPct/100);
    }

    const totalWealth = cashBuffer + investedWealth + pillar2Wealth + pillar3Wealth;

    if (totalWealth > maxWealth) maxWealth = totalWealth;
    if (totalWealth < 0 && savingsDepletedAge === null) {
       // Strict check for depletion
       if ((cashBuffer + investedWealth) <= 100 && pillar3Wealth <= 100) {
         savingsDepletedAge = age;
       }
    }

    points.push({
      age,
      year,
      totalGrossIncome,
      totalIncome: totalIncomeNet,
      salary1: isRetired ? 0 : grossSalary1 * taxFactor, 
      salary2: isRetired ? 0 : grossSalary2 * taxFactor,
      bonus: isRetired ? 0 : grossBonus * 0.65,
      pensionAHV,
      pensionLPP,
      pension3a,
      pension: pensionAHV + pensionLPP + pension3a,
      activeChildren: activeChildrenCount,
      housingExpenses: housingAnnual,
      livingExpenses: livingAnnual,
      childrenExpenses: annualChildrenExpenses,
      travelExpenses: travelAnnual,
      totalExpenses,
      yearlyContribution: data.monthlyContribution * 12, 
      yearlySavings: annualSavingsCapacity,
      cashSavings: cashBuffer,
      investedAssets: investedWealth,
      pillar2Wealth,
      pillar3Wealth,
      pensionWealth: pillar2Wealth + pillar3Wealth,
      investmentGrowth: 0, 
      totalWealth,
      isDeficit: annualSavingsCapacity < 0
    });

    // Grow Salary for next year (if working)
    if (!isRetired && age < 55) {
       const salaryGrowthFactor = 1 + ((data.expectedSalaryIncrease + modifiers.salaryGrowthModPct) / 100);
       grossSalary1 *= salaryGrowthFactor;
       grossSalary2 *= salaryGrowthFactor;
       grossBonus *= salaryGrowthFactor;
    }
  }

  return {
    type: scenario,
    label: scenario === 'neutral' ? 'Neutre' : scenario === 'pessimistic' ? 'Pessimista' : 'Optimista',
    data: points,
    finalWealth: points[points.length - 1]?.totalWealth ?? 0,
    maxWealth,
    isViable: savingsDepletedAge === null,
    savingsDepletedAge
  };
}

export function runAllScenarios(data: FinancialData): ScenarioResult[] {
  const cloneFor = (d: FinancialData) => JSON.parse(JSON.stringify(d)) as FinancialData;
  return [
    calculateProjections(cloneFor(data), 'pessimistic'),
    calculateProjections(cloneFor(data), 'neutral'),
    calculateProjections(cloneFor(data), 'optimistic')
  ];
}

export function calculateViableEarlyRetirement(data: FinancialData): number | null {
  const maxCheckAge = Math.max(data.retirementAge, 65);
  for (let testAge = 50; testAge <= maxCheckAge; testAge++) {
    const testData = JSON.parse(JSON.stringify(data)) as FinancialData;
    testData.retirementAge = testAge;
    const result = calculateProjections(testData, 'neutral');
    if (result.isViable) {
      return testAge;
    }
  }
  return null;
}