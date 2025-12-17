import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { ProjectionPoint, ScenarioResult } from '../types';

const COLORS = {
  primary: '#0eb1d2', // Turquoise Surf
  secondary: '#8ab9b5', // Muted Teal
  dark: '#2b4141', // Dark Slate Grey
  accent: '#34e4ea', // Neon Ice
  bg: '#f8fafc',
  income1: '#0eb1d2',
  income2: '#34e4ea',
  bonus: '#8ab9b5',
  housing: '#2b4141',
  living: '#8ab9b5',
  children: '#0eb1d2',
  travel: '#eab308',
  wealth: '#0eb1d2',
  cash: '#10b981',
  invested: '#3b82f6',
  pension: '#6366f1',
  
  // Pension Breakdown Specifics
  p_ahv: '#94a3b8', // Grey/Blue (Slate 400)
  p_lpp: '#8b5cf6', // Violet (Violet 500)
  p_3a:  '#86efac', // Light Green (Green 300)

  pessimistic: '#ef4444',
  neutral: '#8ab9b5',
  optimistic: '#0eb1d2'
};

const formatCurrency = (val: number) => {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
  return val.toString();
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-[#8ab9b5] rounded-lg shadow-lg z-50">
        <p className="font-bold text-[#2b4141] mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const IncomeChart: React.FC<{ data: ProjectionPoint[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={300}>
    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
      <XAxis dataKey="age" tick={{ fill: COLORS.dark }} />
      <YAxis tickFormatter={formatCurrency} tick={{ fill: COLORS.dark }} />
      <Tooltip content={<CustomTooltip />} />
      <Legend wrapperStyle={{ color: COLORS.dark }} />
      
      {/* Pension Pillars (Stacked Bottom-Up: AHV -> LPP -> 3a) */}
      <Area type="monotone" dataKey="pensionAHV" stackId="1" stroke={COLORS.p_ahv} fill={COLORS.p_ahv} name="1. AHV (Pública)" />
      <Area type="monotone" dataKey="pensionLPP" stackId="1" stroke={COLORS.p_lpp} fill={COLORS.p_lpp} name="2. LPP (Renda)" />
      <Area type="monotone" dataKey="pension3a" stackId="1" stroke={COLORS.p_3a} fill={COLORS.p_3a} name="3. Pilar 3a (Renda)" />

      {/* Salary (Stacked) */}
      <Area type="monotone" dataKey="salary1" stackId="1" stroke={COLORS.income1} fill={COLORS.income1} name="Salari 1 (Net)" />
      <Area type="monotone" dataKey="salary2" stackId="1" stroke={COLORS.income2} fill={COLORS.income2} name="Salari 2 (Net)" />
      <Area type="monotone" dataKey="bonus" stackId="1" stroke={COLORS.bonus} fill={COLORS.bonus} name="Bonus" />
    </AreaChart>
  </ResponsiveContainer>
);

export const ExpensesChart: React.FC<{ data: ProjectionPoint[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
      <XAxis dataKey="age" tick={{ fill: COLORS.dark }} />
      <YAxis tickFormatter={formatCurrency} tick={{ fill: COLORS.dark }} />
      <Tooltip content={<CustomTooltip />} />
      <Legend wrapperStyle={{ color: COLORS.dark }} />
      <Bar dataKey="housingExpenses" stackId="a" fill={COLORS.housing} name="Habitatge" />
      <Bar dataKey="livingExpenses" stackId="a" fill={COLORS.living} name="Vida Diària" />
      <Bar dataKey="childrenExpenses" stackId="a" fill={COLORS.children} name="Fills & Educació" />
      <Bar dataKey="travelExpenses" stackId="a" fill={COLORS.travel} name="Viatges" />
    </BarChart>
  </ResponsiveContainer>
);

export const ChildrenCostChart: React.FC<{ data: ProjectionPoint[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={300}>
    <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
      <XAxis dataKey="age" tick={{ fill: COLORS.dark }} />
      <YAxis tickFormatter={formatCurrency} tick={{ fill: COLORS.dark }} />
      <Tooltip content={<CustomTooltip />} />
      <Legend wrapperStyle={{ color: COLORS.dark }} />
      <Bar dataKey="childrenExpenses" fill={COLORS.children} name="Cost Anual Fills" barSize={40} />
      <Line type="monotone" dataKey="totalExpenses" stroke={COLORS.housing} strokeDasharray="5 5" name="Pressupost Total" dot={false} />
    </ComposedChart>
  </ResponsiveContainer>
);

export const WealthChart: React.FC<{ data: ProjectionPoint[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={300}>
    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
      <XAxis dataKey="age" tick={{ fill: COLORS.dark }} />
      <YAxis tickFormatter={formatCurrency} tick={{ fill: COLORS.dark }} />
      <Tooltip content={<CustomTooltip />} />
      <Legend wrapperStyle={{ color: COLORS.dark }} />
      <Area type="monotone" dataKey="pillar2Wealth" stackId="1" stroke={COLORS.p_lpp} fill={COLORS.p_lpp} name="2n Pilar (LPP)" />
      <Area type="monotone" dataKey="pillar3Wealth" stackId="1" stroke={COLORS.p_3a} fill={COLORS.p_3a} name="3r Pilar (3a)" />
      <Area type="monotone" dataKey="investedAssets" stackId="1" stroke={COLORS.invested} fill={COLORS.invested} name="Inversions (Free)" />
      <Area type="monotone" dataKey="cashSavings" stackId="1" stroke={COLORS.cash} fill={COLORS.cash} name="Estalvi Líquid" />
    </AreaChart>
  </ResponsiveContainer>
);

export const CashFlowChart: React.FC<{ data: ProjectionPoint[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={300}>
    <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
      <XAxis dataKey="age" tick={{ fill: COLORS.dark }} />
      <YAxis tickFormatter={formatCurrency} tick={{ fill: COLORS.dark }} />
      <Tooltip content={<CustomTooltip />} />
      <Legend wrapperStyle={{ color: COLORS.dark }} />
      <ReferenceLine y={0} stroke="#000" />
      <Bar dataKey="yearlySavings" name="Cash Flow (Estalvi)">
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={entry.yearlySavings >= 0 ? '#10b981' : '#ef4444'} />
        ))}
      </Bar>
      <Line type="monotone" dataKey="totalIncome" stroke={COLORS.income1} name="Ingressos Totals" dot={false} />
      <Line type="monotone" dataKey="totalExpenses" stroke={COLORS.housing} name="Despeses Totals" dot={false} />
    </ComposedChart>
  </ResponsiveContainer>
);

export const ScenariosComparisonChart: React.FC<{ scenarios: ScenarioResult[] }> = ({ scenarios }) => {
  // Merge data for comparison
  const neutral = scenarios.find(s => s.type === 'neutral')?.data || [];
  const pessimistic = scenarios.find(s => s.type === 'pessimistic')?.data || [];
  const optimistic = scenarios.find(s => s.type === 'optimistic')?.data || [];

  const mergedData = neutral.map((point, i) => ({
    age: point.age,
    neutral: point.totalWealth,
    pessimistic: pessimistic[i]?.totalWealth,
    optimistic: optimistic[i]?.totalWealth
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={mergedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="age" tick={{ fill: COLORS.dark }} />
        <YAxis tickFormatter={formatCurrency} tick={{ fill: COLORS.dark }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ color: COLORS.dark }} />
        <Line type="monotone" dataKey="optimistic" stroke={COLORS.optimistic} name="Optimista" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="neutral" stroke={COLORS.neutral} name="Neutre" strokeWidth={3} dot={false} />
        <Line type="monotone" dataKey="pessimistic" stroke={COLORS.pessimistic} name="Pessimista" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};