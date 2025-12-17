import { FinancialData, ProjectionPoint, ScenarioResult, ScenarioType, CareerStage } from '../types';

type ScenarioModifiers = {
  salaryGrowthModPct: number;
  returnModPct: number;
  inflationModPct: number;
  expenseMultiplier?: number;
};

const DEFAULT_MAX_AGE = 90;

// Swiss Pension Constants
const AHV_COUPLE_MAX_ANNUAL_2025 = 44100;
const LPP_CONVERSION_RATE = 0.058;
const LPP_INTEREST_RATE = 0.02;

const taxFactorByCanton: Record<string, number> = {
  Zürich: 0.78, Zurich: 0.78, Zug: 0.82, Geneva: 0.70, Vaud: 0.73, default: 0.75
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

// Logic: Non-linear salary growth based on career stage and age
function getSalaryGrowthRate(age: number, stage: CareerStage, baseInflation: number): number {
  let careerBoost = 0;
  
  if (age < 35) {
     if (stage === 'junior') careerBoost = 0.035; // Fast growth
     else if (stage === 'mid') careerBoost = 0.025;
     else careerBoost = 0.015;
  } else if (age < 45) {
     if (stage === 'junior') careerBoost = 0.025; // Catching up
     else if (stage === 'mid') careerBoost = 0.020; // Peak earning growth
     else if (stage === 'senior') careerBoost = 0.015;
     else careerBoost = 0.020; // Executive
  } else if (age < 55) {
     careerBoost = 0.01; // Slowing down
  } else {
     careerBoost = 0.00; // Plateau, only inflation
  }

  return baseInflation + careerBoost;
}

export function calculateProjections(data: FinancialData, scenario: ScenarioType): ScenarioResult {
  let modifiers: ScenarioModifiers = { salaryGrowthModPct: 0, returnModPct: 0, inflationModPct: 0, expenseMultiplier: 1.0 };
  if (scenario === 'pessimistic') {
    modifiers = { salaryGrowthModPct: -0.5, returnModPct: -2.0, inflationModPct: 1.0, expenseMultiplier: 1.05 };
  } else if (scenario === 'optimistic') {
    modifiers = { salaryGrowthModPct: 0.5, returnModPct: 1.5, inflationModPct: -0.5, expenseMultiplier: 0.95 };
  }

  const taxFactor = getTaxFactor(data.canton);
  
  let grossSalary1 = data.annualGrossSalary1;
  let grossSalary2 = data.annualGrossSalary2;
  let grossBonus = data.annualBonus;

  const baseInflationPct = (data.expectedSalaryIncrease ?? 1.5) + modifiers.inflationModPct; // Base Swiss inflation
  const effectiveInvestmentReturnPct = Math.max(0, data.investmentReturn + modifiers.returnModPct);

  let pillar2Wealth = data.pillar2Balance1 + data.pillar2Balance2;
  let pillar3Wealth = data.pillar3Balance1 + data.pillar3Balance2;
  let freeSavingsWealth = data.currentSavings; 
  
  let cashBuffer = freeSavingsWealth * 0.3;
  let investedWealth = freeSavingsWealth * 0.7;

  // Snapshot vars
  let ahvAnnualPensionSnapshot = 0;
  let lppAnnualPensionSnapshot = 0;
  let pillar3AnnualDrawdownSnapshot = 0;
  let retirementSnapshotTaken = false;

  const childrenSchedule = computeChildrenSchedule(data); 
  const childrenAges = [...childrenSchedule];
  const startYear = new Date().getFullYear();
  const points: ProjectionPoint[] = [];
  
  let maxWealth = 0;
  let savingsDepletedAge: number | null = null;
  
  // Housing Logic State
  let currentRent = data.currentHousingCost;
  let hasMovedHouse = false;

  for (let age = data.currentAge; age <= DEFAULT_MAX_AGE; age++) {
    const yearIndex = age - data.currentAge;
    const year = startYear + yearIndex;
    const isRetired = age >= data.retirementAge;
    const notes: string[] = [];

    // --- Inflation Factors ---
    const inflationFactor = Math.pow(1 + baseInflationPct / 100, yearIndex);
    // Housing increases by market rate unless we move
    currentRent *= (1 + (data.housingCostIncrease + modifiers.inflationModPct)/100);

    // --- Children & Lifestyle Logic ---
    let annualChildrenExpenses = 0;
    let activeChildrenCount = 0;
    
    for (let i = 0; i < childrenAges.length; i++) {
      let childAge = childrenAges[i];
      if (childAge < 0) { childrenAges[i] = childAge + 1; continue; }
      if (childAge >= 0 && childAge < 25) activeChildrenCount++;

      // Detailed Child Cost Phases
      if (childAge < 5) annualChildrenExpenses += (data.monthlyDaycareCost * 12); // Kita
      else if (childAge >= 5 && childAge < 19) annualChildrenExpenses += (data.monthlySchoolActivityCost * 12); // School
      else if (childAge >= 19 && childAge < 25) {
         // University Phase
         // If humble -> less support (10k), if luxury -> full support (25k)
         let uniCost = data.universitySupport > 0 ? data.universitySupport : 25000;
         if (data.luxuryLevel === 'humble') uniCost = 12000; // Live at home public uni
         annualChildrenExpenses += uniCost;
      }
      
      childrenAges[i] = childAge + 1;
    }
    annualChildrenExpenses *= (modifiers.expenseMultiplier ?? 1);

    // --- Housing Dynamic Logic ---
    // Rule: If family size > rooms + 1, we need to move to a bigger place
    // We assume 1 room for parents, so max capacity = rooms - 1 (kids share 2 per room max?)
    // Let's say strictly: Family Size = 2 + activeChildren.
    // Need approx 1 bedroom per 2 kids + 1 parent room + 1 living.
    // Heuristic: If (2 + activeChildren) > data.currentRooms + 1 (allowing living room sleeping? no, let's be strict).
    // Simple rule: If people > rooms + 1, UPGRADE.
    
    if (!hasMovedHouse && (2 + activeChildrenCount) > (data.currentRooms + 0.5)) {
        // Trigger Move
        hasMovedHouse = true;
        // Upsize cost: +25% per extra room needed roughly, plus moving costs?
        // Let's assume a market jump.
        const marketJump = 1.30; // 30% increase
        currentRent *= marketJump;
        notes.push("Mudança: Pis més gran");
    }

    const livingAnnual = data.monthlyLivingCost * 12 * inflationFactor * (modifiers.expenseMultiplier ?? 1);
    const travelAnnual = data.yearlyTravelBudget * inflationFactor * (modifiers.expenseMultiplier ?? 1);
    const housingAnnual = currentRent * 12;

    const totalExpenses = housingAnnual + livingAnnual + annualChildrenExpenses + travelAnnual;

    // --- Income & Savings Logic ---
    let totalIncomeNet = 0;
    let totalGrossIncome = 0;
    let pensionAHV = 0;
    let pensionLPP = 0;
    let pension3a = 0;
    let annualSavingsCapacity = 0; 

    if (!isRetired) {
      // --- Working Phase ---
      // Apply Career Stage Growth Rates
      const growthRate1 = getSalaryGrowthRate(age, data.careerStage1, baseInflationPct/100);
      const growthRate2 = getSalaryGrowthRate(age, data.careerStage2, baseInflationPct/100);
      
      // Update salaries for NEXT year (at end of loop), but current year uses current
      const salaryNet1 = grossSalary1 * taxFactor;
      const salaryNet2 = grossSalary2 * taxFactor;
      const bonusNet = grossBonus * 0.65;
      
      totalGrossIncome = grossSalary1 + grossSalary2 + grossBonus;
      totalIncomeNet = salaryNet1 + salaryNet2 + bonusNet;
      
      // Mandatory P3
      const plannedP3 = data.pillar3AnnualContribution1 + data.pillar3AnnualContribution2;
      let actualP3 = (totalIncomeNet >= plannedP3) ? plannedP3 : totalIncomeNet;
      
      const incomeAfterP3 = totalIncomeNet - actualP3;
      annualSavingsCapacity = incomeAfterP3 - totalExpenses;

      // Wealth Growth
      const lppContribution = (grossSalary1 + grossSalary2) * 0.12; 
      pillar2Wealth = (pillar2Wealth * (1 + LPP_INTEREST_RATE)) + lppContribution;
      pillar3Wealth = (pillar3Wealth * (1 + effectiveInvestmentReturnPct/100)) + actualP3;
      
      if (annualSavingsCapacity > 0) {
        cashBuffer += annualSavingsCapacity * 0.3;
        investedWealth += annualSavingsCapacity * 0.7;
      } else {
        const deficit = -annualSavingsCapacity;
        if (cashBuffer >= deficit) {
          cashBuffer -= deficit;
        } else {
          const remaining = deficit - cashBuffer;
          cashBuffer = 0;
          investedWealth = Math.max(0, investedWealth - remaining);
        }
      }
      investedWealth *= (1 + effectiveInvestmentReturnPct/100);

      // Increment Salaries for next iteration
      grossSalary1 *= (1 + growthRate1 + modifiers.salaryGrowthModPct/100);
      grossSalary2 *= (1 + growthRate2 + modifiers.salaryGrowthModPct/100);
      grossBonus *= (1 + baseInflationPct/100); // Bonus usually tracks inflation

    } else {
      // --- Retirement Phase ---
      if (!retirementSnapshotTaken) {
        ahvAnnualPensionSnapshot = AHV_COUPLE_MAX_ANNUAL_2025 * inflationFactor;
        lppAnnualPensionSnapshot = pillar2Wealth * LPP_CONVERSION_RATE;
        const yearsInRetirement = DEFAULT_MAX_AGE - data.retirementAge;
        pillar3AnnualDrawdownSnapshot = pillar3Wealth / Math.max(1, yearsInRetirement);
        retirementSnapshotTaken = true;
        notes.push("Jubilació: Inici Rendes");
      }

      pensionAHV = AHV_COUPLE_MAX_ANNUAL_2025 * inflationFactor;
      pensionLPP = lppAnnualPensionSnapshot;
      if (pillar3Wealth > 0) {
         pension3a = pillar3AnnualDrawdownSnapshot;
         if (pension3a > pillar3Wealth) pension3a = pillar3Wealth;
      } else pension3a = 0;

      totalGrossIncome = pensionAHV + pensionLPP + pension3a;
      totalIncomeNet = totalGrossIncome * 0.85; // Tax estimate

      annualSavingsCapacity = totalIncomeNet - totalExpenses;

      pillar2Wealth = 0; 
      pillar3Wealth = Math.max(0, pillar3Wealth - pension3a);
      pillar3Wealth *= (1 + (effectiveInvestmentReturnPct/100) * 0.3);
      
      if (annualSavingsCapacity >= 0) {
        cashBuffer += annualSavingsCapacity; 
      } else {
        const deficit = -annualSavingsCapacity;
        if (cashBuffer >= deficit) cashBuffer -= deficit;
        else {
           const rem = deficit - cashBuffer;
           cashBuffer = 0;
           investedWealth = Math.max(0, investedWealth - rem);
        }
      }
      investedWealth *= (1 + effectiveInvestmentReturnPct/100);
    }

    const totalWealth = cashBuffer + investedWealth + pillar2Wealth + pillar3Wealth;

    if (totalWealth > maxWealth) maxWealth = totalWealth;
    if (totalWealth < 0 && savingsDepletedAge === null) {
       if ((cashBuffer + investedWealth) <= 100 && pillar3Wealth <= 100) {
         savingsDepletedAge = age;
         notes.push("⚠️ Fons Esgotats");
       }
    }

    points.push({
      age, year, totalGrossIncome, totalIncome: totalIncomeNet,
      salary1: isRetired ? 0 : grossSalary1 * taxFactor, 
      salary2: isRetired ? 0 : grossSalary2 * taxFactor,
      bonus: isRetired ? 0 : grossBonus * 0.65,
      pensionAHV, pensionLPP, pension3a, pension: pensionAHV + pensionLPP + pension3a,
      activeChildren: activeChildrenCount,
      housingExpenses: housingAnnual, livingExpenses: livingAnnual, childrenExpenses: annualChildrenExpenses, travelExpenses: travelAnnual,
      totalExpenses, yearlyContribution: 0, yearlySavings: annualSavingsCapacity,
      cashSavings: cashBuffer, investedAssets: investedWealth, pillar2Wealth, pillar3Wealth, pensionWealth: pillar2Wealth + pillar3Wealth,
      investmentGrowth: 0, totalWealth, isDeficit: annualSavingsCapacity < 0, notes: notes.length > 0 ? notes : undefined
    });
  }

  return {
    type: scenario, label: scenario, data: points,
    finalWealth: points[points.length - 1]?.totalWealth ?? 0,
    maxWealth, isViable: savingsDepletedAge === null, savingsDepletedAge
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
    if (result.isViable) return testAge;
  }
  return null;
}