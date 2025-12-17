import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { ProjectionPoint } from '../types';

interface FinancialChartProps {
  data: ProjectionPoint[];
}

export const FinancialChart: React.FC<FinancialChartProps> = ({ data }) => {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-[#8ab9b5]/40 h-96 w-full">
      <h3 className="text-lg font-semibold text-[#2b4141] mb-4">Projecció de Patrimoni Net</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorWealth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0eb1d2" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#0eb1d2" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="age" 
            label={{ value: 'Edat', position: 'insideBottomRight', offset: -5 }} 
            tick={{fontSize: 12, fill: '#2b4141'}}
          />
          <YAxis 
            tickFormatter={formatCurrency} 
            tick={{fontSize: 12, fill: '#2b4141'}}
          />
          <Tooltip 
            formatter={(value: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(value)}
            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #8ab9b5', color: '#2b4141' }}
          />
          <Legend wrapperStyle={{ color: '#2b4141' }} />
          <Area 
            type="monotone" 
            dataKey="totalWealth" 
            stroke="#0eb1d2" 
            fillOpacity={1} 
            fill="url(#colorWealth)" 
            name="Patrimoni Total"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};