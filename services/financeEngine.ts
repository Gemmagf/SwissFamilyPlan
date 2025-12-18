
import { FinancialData, ProjectionPoint, ScenarioResult, ScenarioType, CareerStage } from '../types';

type ScenarioModifiers = {
  salaryGrowthModPct: number;
  returnModPct: number;
  inflationModPct: number;
  expenseMultiplier?: number;
};

const DEFAULT_MAX_AGE = 90;
const RETIREMENT_SAFETY_BUFFER = 100000; // Marge de seguretat requerit als 90 anys

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

function getSalaryGrowthRate(age: number, stage: CareerStage, baseInflation: number): number {
  let careerBoost = 0;
  if (age < 35) {
     if (stage === 'junior') careerBoost = 0.035;
     else if (stage === 'mid') careerBoost = 0.025;
     else careerBoost = 0.015;
  } else if (age < 45) {
     if (stage === 'junior') careerBoost = 0.025;
     else if (stage === 'mid') careerBoost = 0.020;
     else if (stage === 'senior') careerBoost = 0.015;
     else careerBoost = 0.020;
  } else if (age < 55) {
     careerBoost = 0.01;
  } else {
     careerBoost = 0.00;
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

  const baseInflationPct = (data.expectedSalaryIncrease ?? 1.5) + modifiers.inflationModPct;
  const effectiveInvestmentReturnPct = Math.max(0, data.investmentReturn + modifiers.returnModPct);

  let pillar2Wealth = data.pillar2Balance1 + data.pillar2Balance2;
  let pillar3Wealth = data.pillar3Balance1 + data.pillar3Balance2;
  let freeSavingsWealth = data.currentSavings; 
  
  let cashBuffer = freeSavingsWealth * 0.3;
  let investedWealth = freeSavingsWealth * 0.7;

  let ahvAnnualPensionSnapshot = 0;
  let lppAnnualPensionSnapshot = 0;
  let pillar3AnnualDrawdownSnapshot = 0;
  let retirementSnapshotTaken = false;

  const childrenAges = computeChildrenSchedule(data);
  const startYear = new Date().getFullYear();
  const points: ProjectionPoint[] = [];
  
  let maxWealth = 0;
  let savingsDepletedAge: number | null = null;
  let currentRent = data.currentHousingCost;
  let hasMovedHouse = false;

  for (let age = data.currentAge; age <= DEFAULT_MAX_AGE; age++) {
    const yearIndex = age - data.currentAge;
    const year = startYear + yearIndex;
    const isRetired = age >= data.retirementAge;
    const notes: string[] = [];
    const inflationFactor = Math.pow(1 + baseInflationPct / 100, yearIndex);
    currentRent *= (1 + (data.housingCostIncrease + modifiers.inflationModPct)/100);

    let annualChildrenExpenses = 0;
    let activeChildrenCount = 0;
    for (let i = 0; i < childrenAges.length; i++) {
      let childAge = childrenAges[i];
      if (childAge < 0) { childrenAges[i] = childAge + 1; continue; }
      if (childAge >= 0 && childAge < 25) activeChildrenCount++;
      if (childAge < 5) annualChildrenExpenses += (data.monthlyDaycareCost * 12);
      else if (childAge >= 5 && childAge < 19) annualChildrenExpenses += (data.monthlySchoolActivityCost * 12);
      else if (childAge >= 19 && childAge < 25) annualChildrenExpenses += data.universitySupport;
      childrenAges[i] = childAge + 1;
    }
    annualChildrenExpenses *= (modifiers.expenseMultiplier ?? 1);

    if (!hasMovedHouse && (2 + activeChildrenCount) > (data.currentRooms + 0.5)) {
        hasMovedHouse = true;
        currentRent *= 1.30;
        notes.push("Mudança: Pis més gran");
    }

    const livingAnnual = data.monthlyLivingCost * 12 * inflationFactor * (modifiers.expenseMultiplier ?? 1);
    const travelAnnual = data.yearlyTravelBudget * inflationFactor * (modifiers.expenseMultiplier ?? 1);
    const housingAnnual = currentRent * 12;
    const totalExpenses = housingAnnual + livingAnnual + annualChildrenExpenses + travelAnnual;

    let totalIncomeNet = 0;
    let totalGrossIncome = 0;
    let pensionAHV = 0;
    let pensionLPP = 0;
    let pension3a = 0;
    let annualSavingsCapacity = 0; 

    if (!isRetired) {
      const growthRate1 = getSalaryGrowthRate(age, data.careerStage1, baseInflationPct/100);
      const growthRate2 = getSalaryGrowthRate(age, data.careerStage2, baseInflationPct/100);
      const salaryNet1 = grossSalary1 * taxFactor;
      const salaryNet2 = grossSalary2 * taxFactor;
      const bonusNet = grossBonus * 0.65;
      totalGrossIncome = grossSalary1 + grossSalary2 + grossBonus;
      totalIncomeNet = salaryNet1 + salaryNet2 + bonusNet;
      const plannedP3 = data.pillar3AnnualContribution1 + data.pillar3AnnualContribution2;
      let actualP3 = (totalIncomeNet >= plannedP3) ? plannedP3 : Math.max(0, totalIncomeNet);
      annualSavingsCapacity = totalIncomeNet - actualP3 - totalExpenses;
      const lppContribution = (grossSalary1 + grossSalary2) * 0.12; 
      pillar2Wealth = (pillar2Wealth * (1 + LPP_INTEREST_RATE)) + lppContribution;
      pillar3Wealth = (pillar3Wealth * (1 + effectiveInvestmentReturnPct/100)) + actualP3;
      if (annualSavingsCapacity > 0) {
        cashBuffer += annualSavingsCapacity * 0.3;
        investedWealth += annualSavingsCapacity * 0.7;
      } else {
        const deficit = -annualSavingsCapacity;
        if (cashBuffer >= deficit) cashBuffer -= deficit;
        else {
          const remaining = deficit - cashBuffer;
          cashBuffer = 0;
          investedWealth = Math.max(0, investedWealth - remaining);
        }
      }
      investedWealth *= (1 + effectiveInvestmentReturnPct/100);
      grossSalary1 *= (1 + growthRate1 + modifiers.salaryGrowthModPct/100);
      grossSalary2 *= (1 + growthRate2 + modifiers.salaryGrowthModPct/100);
      grossBonus *= (1 + baseInflationPct/100);
    } else {
      if (!retirementSnapshotTaken) {
        ahvAnnualPensionSnapshot = AHV_COUPLE_MAX_ANNUAL_2025 * inflationFactor;
        lppAnnualPensionSnapshot = pillar2Wealth * LPP_CONVERSION_RATE;
        pillar3AnnualDrawdownSnapshot = pillar3Wealth / Math.max(1, (DEFAULT_MAX_AGE - data.retirementAge));
        retirementSnapshotTaken = true;
      }
      pensionAHV = AHV_COUPLE_MAX_ANNUAL_2025 * inflationFactor;
      pensionLPP = lppAnnualPensionSnapshot;
      pension3a = Math.min(pillar3Wealth, pillar3AnnualDrawdownSnapshot);
      totalGrossIncome = pensionAHV + pensionLPP + pension3a;
      totalIncomeNet = totalGrossIncome * 0.85; 
      annualSavingsCapacity = totalIncomeNet - totalExpenses;
      pillar2Wealth = 0; 
      pillar3Wealth = Math.max(0, pillar3Wealth - pension3a);
      pillar3Wealth *= (1 + (effectiveInvestmentReturnPct/100) * 0.3);
      if (annualSavingsCapacity >= 0) cashBuffer += annualSavingsCapacity; 
      else {
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
       savingsDepletedAge = age;
       notes.push("⚠️ Fons Esgotats");
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
    maxWealth, isViable: (points[points.length - 1]?.totalWealth ?? 0) >= 0, savingsDepletedAge
  };
}

export function runAllScenarios(data: FinancialData): ScenarioResult[] {
  const clone = (d: FinancialData) => JSON.parse(JSON.stringify(d));
  return [
    calculateProjections(clone(data), 'pessimistic'),
    calculateProjections(clone(data), 'neutral'),
    calculateProjections(clone(data), 'optimistic')
  ];
}

export function calculateViableEarlyRetirement(data: FinancialData): number | null {
  // Cerca des dels 45 fins als 65 anys
  for (let testAge = 45; testAge <= 65; testAge++) {
    const testData = JSON.parse(JSON.stringify(data));
    testData.retirementAge = testAge;
    const result = calculateProjections(testData, 'neutral');
    // Considerem viable si el patrimoni final és > Safety Buffer (evitant anar al límit)
    if (result.finalWealth > RETIREMENT_SAFETY_BUFFER) {
      return testAge;
    }
  }
  return null;
}
