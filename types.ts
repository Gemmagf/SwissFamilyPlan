export type ScenarioType = 'pessimistic' | 'neutral' | 'optimistic';
export type CareerStage = 'junior' | 'mid' | 'senior' | 'executive';

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
  careerStage1: CareerStage; // New: affects growth curve
  careerStage2: CareerStage; // New: affects growth curve
  annualBonus: number;
  // expectedSalaryIncrease is now derived/base, but we keep it as an override or base inflation
  expectedSalaryIncrease: number;
  currentSavings: number;
  monthlyContribution: number; // General monthly savings into free assets
  investmentReturn: number; // percent baseline
  
  // Individual Assets
  pillar2Balance1: number;
  pillar2Balance2: number;
  pillar3Balance1: number;
  pillar3Balance2: number;
  pillar3AnnualContribution1: number; // Planned annual contribution
  pillar3AnnualContribution2: number; // Planned annual contribution

  housingStatus: 'rent' | 'own';
  currentHousingCost: number; // CHF/month
  currentRooms: number; // New: to calculate overcrowding
  housingCostIncrease: number; // percent annual
  monthlyLivingCost: number; // CHF/month
  monthlyDaycareCost: number; // CHF/month
  monthlySchoolActivityCost: number; // CHF/month
  yearlyTravelBudget: number;
  universitySupport: number;
  canton: string;
  luxuryLevel: 'humble' | 'comfortable' | 'luxury';
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
  notes?: string[]; // New: Events like "Moved House", "Child to Uni"
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

// --- ADVISORY TYPES ---

export type PriorityLevel = 1 | 2 | 3; // 1: Immediate, 2: Optimization, 3: Strategic

export interface Insight {
  type: 'risk' | 'opportunity' | 'warning' | 'info';
  title: string;
  description: string;
  financialImpact?: string;
  severity: 'low' | 'medium' | 'high';
}

export interface Recommendation {
  id: string;
  priority: PriorityLevel;
  category: 'Fiscal' | 'Inversió' | 'Família' | 'Carrera' | 'Risc';
  title: string;
  action: string;
  benefit: string;
  urgencyLabel: 'Ara' | '1-3 anys' | 'Llarg termini';
}