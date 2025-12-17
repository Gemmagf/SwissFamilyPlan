export type ScenarioType = 'pessimistic' | 'neutral' | 'optimistic';

export interface FinancialData {
  currentAge: number;
  retirementAge: number;
  currentChildren: number;
  futureChildren: number;
  // optional more precise birth plan:
  firstChildBirthYearOffset?: number; // 0 = next year, 2 = in 2 years, etc.
  childSpacingYears?: number; // default 2
  annualGrossSalary1: number;
  annualGrossSalary2: number;
  annualBonus: number;
  expectedSalaryIncrease: number; // percent
  currentSavings: number;
  monthlyContribution: number;
  investmentReturn: number; // percent baseline
  pillar2Value: number;
  pillar3Value: number;
  housingStatus: 'rent' | 'own';
  currentHousingCost: number; // CHF/month
  housingCostIncrease: number; // percent annual
  monthlyLivingCost: number; // CHF/month
  monthlyDaycareCost: number; // CHF/month
  monthlySchoolActivityCost: number; // CHF/month
  yearlyTravelBudget: number;
  universitySupport: number;
  canton: string;
  luxuryLevel?: 'basic' | 'comfortable' | 'premium';
}

export interface ProjectionPoint {
  age: number;
  year: number;
  totalGrossIncome: number; // Gross Income
  totalIncome: number; // Net Income
  salary1: number;
  salary2: number;
  bonus: number;
  // Pension breakdown
  pensionAHV: number;
  pensionLPP: number;
  pension3a: number;
  pension: number; // Sum of above
  
  activeChildren: number; // Number of dependent children in this year
  housingExpenses: number;
  livingExpenses: number;
  childrenExpenses: number;
  travelExpenses: number;
  totalExpenses: number;
  yearlyContribution: number;
  yearlySavings: number; // net cash flow
  cashSavings: number; // liquid cash
  investedAssets: number; // investable assets (Free savings)
  pillar2Wealth: number; // LPP Capital
  pillar3Wealth: number; // 3a Capital
  pensionWealth: number; // LPP + 3a (for backward compatibility/total)
  investmentGrowth: number;
  totalWealth: number; // Free + P2 + P3
  isDeficit: boolean;
}

export interface ScenarioResult {
  type: ScenarioType;
  label: string;
  data: ProjectionPoint[];
  finalWealth: number;
  maxWealth: number;
  isViable: boolean;
  savingsDepletedAge: number | null;
}