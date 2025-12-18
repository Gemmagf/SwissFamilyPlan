import React, { useState, useMemo, useEffect } from 'react';
import { FinancialData, ProjectionPoint, ScenarioResult, ScenarioType, CareerStage } from './types';
import { estimateLocationCosts } from './services/geminiService'; 
import { runAllScenarios, calculateViableEarlyRetirement } from './services/financeEngine';
import { generateReportMarkdown } from './services/reportService';
import { FinancialChart } from './components/FinancialChart';
import { 
  IncomeChart, ExpensesChart, ChildrenCostChart, WealthChart, CashFlowChart, ScenariosComparisonChart 
} from './components/ReportCharts';
import { 
  Users, Wallet, Home, TrendingUp, Baby, Plane, FileText, Loader2, ChevronRight, Calculator, MapPin, Wand2,
  AlertTriangle, CheckCircle, TrendingDown, PieChart, Shield, User, Briefcase, Sliders, Zap
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Default Data based on "Escenari de prova"
const initialData: FinancialData = {
  currentAge: 30,
  retirementAge: 65,
  currentChildren: 0,
  futureChildren: 2,
  firstChildBirthYearOffset: 1,
  childSpacingYears: 2,
  annualGrossSalary1: 110000,
  annualGrossSalary2: 90000,
  careerStage1: 'mid',
  careerStage2: 'mid',
  annualBonus: 0,
  expectedSalaryIncrease: 2.0, 
  currentSavings: 150000, 
  monthlyContribution: 2500, 
  investmentReturn: 4.5,
  
  // New Individual Fields
  pillar2Balance1: 50000,
  pillar2Balance2: 20000,
  pillar3Balance1: 14000,
  pillar3Balance2: 0,
  pillar3AnnualContribution1: 7056,
  pillar3AnnualContribution2: 3000,

  housingStatus: 'rent',
  currentHousingCost: 1800, 
  currentRooms: 3.5,
  housingCostIncrease: 2.0, 
  monthlyLivingCost: 6000, 
  monthlyDaycareCost: 2500, 
  monthlySchoolActivityCost: 400, 
  yearlyTravelBudget: 6000, 
  universitySupport: 25000, 
  canton: 'Zürich',
  luxuryLevel: 'comfortable'
};

const ChartExplanation = ({ title, items, interpretation, desc }: { title: string, items?: string[], interpretation: string, desc?: string }) => (
  <div className="mt-4 p-4 bg-[#f8fafc] rounded-lg border border-[#8ab9b5]/20 text-sm text-[#2b4141]">
    <h5 className="font-semibold mb-2">{title}</h5>
    {desc && <p className="mb-2 text-gray-700">{desc}</p>}
    {items && (
      <ul className="list-disc list-inside mb-2 space-y-1 text-gray-700">
        {items.map((item, idx) => <li key={idx}>{item}</li>)}
      </ul>
    )}
    <p className="mt-2 text-[#2b4141]"><strong>Interpretació:</strong> {interpretation}</p>
  </div>
);

const App: React.FC = () => {
  const [formData, setFormData] = useState<FinancialData>(initialData);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('input');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('neutral');

  // "What If" Simulator State
  const [simPartTime, setSimPartTime] = useState(false);
  const [simMarketShock, setSimMarketShock] = useState(false);
  const [simPrivateSchool, setSimPrivateSchool] = useState(false);

  // a) Ajust automàtic del lloguer segons família
  useEffect(() => {
    const totalKids = formData.currentChildren + formData.futureChildren;
    const baseRentMap = { humble: 1500, comfortable: 2000, luxury: 3000 };
    const kidCostMap = { humble: 300, comfortable: 500, luxury: 800 };

    const base = baseRentMap[formData.luxuryLevel] || 2000;
    const extra = (totalKids > 2 ? (totalKids - 2) * (kidCostMap[formData.luxuryLevel] || 500) : 0);
    const estimatedRent = base + extra;
    
    setFormData(prev => {
      if (prev.luxuryLevel !== initialData.luxuryLevel && Math.abs(prev.currentHousingCost - estimatedRent) > 200) {
         return { ...prev, currentHousingCost: estimatedRent };
      }
      return prev;
    });

  }, [formData.luxuryLevel]); 

  // Compute Modified Data for Simulations
  const modifiedFormData = useMemo(() => {
    const data = { ...formData };
    if (simPartTime) {
      data.annualGrossSalary2 = data.annualGrossSalary2 * 0.5; // 50% reduction
    }
    if (simMarketShock) {
      data.investmentReturn = Math.max(0, data.investmentReturn - 2.0);
    }
    if (simPrivateSchool) {
      // Assuming significant increase in educational cost for "Study Abroad" or "Private"
      data.universitySupport = data.universitySupport + 25000; 
      data.monthlySchoolActivityCost = data.monthlySchoolActivityCost * 2;
    }
    return data;
  }, [formData, simPartTime, simMarketShock, simPrivateSchool]);

  // Advanced Simulation Engine
  const scenarios = useMemo((): ScenarioResult[] => {
    return runAllScenarios(modifiedFormData);
  }, [modifiedFormData]);

  const activeScenarioData = useMemo(() => 
    scenarios.find(s => s.type === selectedScenario) || scenarios[1]
  , [scenarios, selectedScenario]);

  // Calculate Early Retirement KPI
  const earlyRetirementAge = useMemo(() => {
    return calculateViableEarlyRetirement(modifiedFormData);
  }, [modifiedFormData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleEstimateCosts = async () => {
    if (!formData.canton) return;
    setLoadingEstimate(true);
    const estimated = await estimateLocationCosts(
      formData.canton,
      formData.currentChildren + formData.futureChildren,
      formData.luxuryLevel || 'comfortable'
    );
    if (estimated) {
      setFormData(prev => ({ ...prev, ...estimated }));
    }
    setLoadingEstimate(false);
  };

  const generateReport = async () => {
    setLoading(true);
    setActiveTab('report');
    // Pass modified data to report so it reflects simulations
    const result = generateReportMarkdown(modifiedFormData, scenarios, earlyRetirementAge);
    setTimeout(() => {
        setReport(result);
        setLoading(false);
    }, 500);
  };

  // UI Components
  const SectionHeader = ({ icon: Icon, title }: any) => (
    <div className="flex items-center gap-2 border-b-2 border-[#8ab9b5]/30 pb-2 mb-6 mt-8">
      <div className="bg-[#0eb1d2]/10 p-2 rounded-lg">
        <Icon className="text-[#0eb1d2]" size={24} />
      </div>
      <h2 className="text-xl font-bold text-[#2b4141]">{title}</h2>
    </div>
  );

  const SummaryCard = ({ label, value, subtext, alert }: any) => (
    <div className={`p-4 rounded-xl border ${alert ? 'border-red-200 bg-red-50' : 'border-[#8ab9b5]/30 bg-white'} shadow-sm`}>
      <p className="text-[#8ab9b5] text-xs font-bold uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${alert ? 'text-red-600' : 'text-[#2b4141]'}`}>{value}</p>
      {subtext && <p className="text-sm text-gray-500 mt-1">{subtext}</p>}
    </div>
  );

  const InputGroup = ({ label, name, type = "number", min, step, icon: Icon, suffix }: any) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-[#2b4141] mb-1 flex items-center gap-2">
        {Icon && <Icon size={16} className="text-[#0eb1d2]" />}
        {label}
      </label>
      <div className="relative rounded-md shadow-sm">
        <input
          type={type}
          name={name}
          id={name}
          min={min}
          step={step}
          value={(formData as any)[name]}
          onChange={handleInputChange}
          className="block w-full rounded-md border-gray-300 pl-3 pr-12 py-2 text-[#2b4141] ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#0eb1d2] sm:text-sm sm:leading-6"
        />
        {suffix && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-gray-500 sm:text-sm">{suffix}</span>
          </div>
        )}
      </div>
    </div>
  );

  const SelectGroup = ({ label, name, options }: any) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-[#2b4141] mb-1">{label}</label>
      <select 
        name={name} 
        value={(formData as any)[name]} 
        onChange={handleInputChange}
        className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-[#0eb1d2] focus:outline-none focus:ring-[#0eb1d2] sm:text-sm"
      >
        {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#c8c2ae] flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-[#2b4141] text-white p-6 md:fixed md:h-full z-10 overflow-y-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-[#0eb1d2] rounded-lg">
            <TrendingUp className="text-white" size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">SwissFamily</h1>
            <p className="text-xs text-[#8ab9b5]">Planificació Financera</p>
          </div>
        </div>

        <nav className="space-y-2">
          <button 
            onClick={() => setActiveTab('input')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'input' ? 'bg-[#0eb1d2] text-white' : 'text-[#8ab9b5] hover:bg-[#8ab9b5]/20'}`}
          >
            <Calculator size={20} />
            Dades Familiars
          </button>
          <button 
            onClick={() => setActiveTab('report')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'report' ? 'bg-[#0eb1d2] text-white' : 'text-[#8ab9b5] hover:bg-[#8ab9b5]/20'}`}
          >
            <FileText size={20} />
            Informe & Anàlisi
          </button>
        </nav>

        {/* Dynamic Simulator Widget in Sidebar */}
        <div className="mt-8 p-4 bg-white/5 rounded-xl border border-[#8ab9b5]/20">
          <div className="flex items-center gap-2 mb-3 text-white">
            <Sliders size={16} className="text-[#0eb1d2]" />
            <span className="font-semibold text-sm">Simulador "What If"</span>
          </div>
          <div className="space-y-3">
             <label className="flex items-center gap-2 cursor-pointer group select-none">
               <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${simPartTime ? 'bg-[#0eb1d2] border-[#0eb1d2]' : 'border-gray-500 group-hover:border-[#0eb1d2]'}`}>
                 {simPartTime && <Zap size={10} className="text-white" />}
               </div>
               <input type="checkbox" className="hidden" checked={simPartTime} onChange={(e) => setSimPartTime(e.target.checked)} />
               <span className="text-xs text-gray-300">Un pare treballa 50%</span>
             </label>

             <label className="flex items-center gap-2 cursor-pointer group select-none">
               <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${simMarketShock ? 'bg-[#0eb1d2] border-[#0eb1d2]' : 'border-gray-500 group-hover:border-[#0eb1d2]'}`}>
                 {simMarketShock && <Zap size={10} className="text-white" />}
               </div>
               <input type="checkbox" className="hidden" checked={simMarketShock} onChange={(e) => setSimMarketShock(e.target.checked)} />
               <span className="text-xs text-gray-300">Mercat estancat (-2%)</span>
             </label>

             <label className="flex items-center gap-2 cursor-pointer group select-none">
               <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${simPrivateSchool ? 'bg-[#0eb1d2] border-[#0eb1d2]' : 'border-gray-500 group-hover:border-[#0eb1d2]'}`}>
                 {simPrivateSchool && <Zap size={10} className="text-white" />}
               </div>
               <input type="checkbox" className="hidden" checked={simPrivateSchool} onChange={(e) => setSimPrivateSchool(e.target.checked)} />
               <span className="text-xs text-gray-300">Universitat/Escola Estranger</span>
             </label>
          </div>
        </div>

        <div className="mt-8 p-4 bg-black/20 rounded-xl border border-[#8ab9b5]/20">
          <p className="text-xs text-[#8ab9b5] mb-2">Patrimoni Estimat (65 anys)</p>
          <p className="text-xl font-bold text-white">
             {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })
                .format(activeScenarioData.data.find(p => p.age === 65)?.totalWealth || 0)}
          </p>
        </div>
      </aside>

      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto">
        {activeTab === 'input' && (
          <div className="max-w-4xl mx-auto space-y-8">
             <div className="bg-white rounded-xl shadow-sm border border-[#8ab9b5]/30 p-6 md:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-[#2b4141]">Configuració del Model</h2>
                  <button onClick={generateReport} disabled={loading} className="flex items-center gap-2 bg-[#0eb1d2] hover:bg-[#0aa0be] text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-sm disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20} />}
                    Generar Report
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Form Sections */}
                  <section>
                    <h3 className="text-lg font-semibold text-[#2b4141] border-b border-[#8ab9b5]/30 pb-2 mb-4 flex items-center gap-2"><Users size={20} className="text-[#0eb1d2]" /> Estructura Familiar</h3>
                    <div className="bg-[#f8fafc] p-4 rounded-lg mb-4 border border-[#8ab9b5]/20">
                      <div className="grid grid-cols-1 gap-4 mb-4">
                        <InputGroup label="Ciutat / Cantó" name="canton" type="text" icon={MapPin} />
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-[#2b4141] mb-1">Estil de Vida</label>
                          <select 
                            name="luxuryLevel" 
                            value={formData.luxuryLevel} 
                            onChange={handleInputChange}
                            className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-[#0eb1d2] focus:outline-none focus:ring-[#0eb1d2] sm:text-sm"
                          >
                            <option value="humble">Humil (Basic)</option>
                            <option value="comfortable">Confortable (Standard)</option>
                            <option value="luxury">Luxe (Premium)</option>
                          </select>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 italic mb-2">
                        * El lloguer s'ajustarà automàticament segons fills i estil de vida.
                      </div>
                      <button onClick={handleEstimateCosts} disabled={loadingEstimate || !formData.canton} className="w-full flex items-center justify-center gap-2 bg-[#8ab9b5] hover:bg-[#2b4141] text-white px-4 py-2 rounded-md transition-colors text-sm font-medium disabled:opacity-50">
                        {loadingEstimate ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />} Refinar costos amb IA
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <InputGroup label="Edat Actual" name="currentAge" suffix="anys" />
                      <InputGroup label="Edat Jubilació" name="retirementAge" suffix="anys" />
                      <InputGroup label="Fills Actuals" name="currentChildren" icon={Baby} />
                      <InputGroup label="Fills Futurs" name="futureChildren" icon={Baby} />
                    </div>
                  </section>
                  <section>
                    <h3 className="text-lg font-semibold text-[#2b4141] border-b border-[#8ab9b5]/30 pb-2 mb-4 flex items-center gap-2"><Briefcase size={20} className="text-[#8ab9b5]" /> Ingressos i Carrera</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <InputGroup label="Salari Adult 1" name="annualGrossSalary1" suffix="CHF" />
                             <SelectGroup label="Etapa Carrera" name="careerStage1" options={[{value: 'junior', label: 'Junior (<30)'}, {value: 'mid', label: 'Mid (30-45)'}, {value: 'senior', label: 'Senior (45+)'}, {value: 'executive', label: 'Executive'}]} />
                        </div>
                        <div>
                             <InputGroup label="Salari Adult 2" name="annualGrossSalary2" suffix="CHF" />
                             <SelectGroup label="Etapa Carrera" name="careerStage2" options={[{value: 'junior', label: 'Junior (<30)'}, {value: 'mid', label: 'Mid (30-45)'}, {value: 'senior', label: 'Senior (45+)'}, {value: 'executive', label: 'Executive'}]} />
                        </div>
                    </div>
                    <InputGroup label="Bonus Familiar" name="annualBonus" suffix="CHF" />
                    <InputGroup label="Inflació Base" name="expectedSalaryIncrease" step="0.1" suffix="%" />
                  </section>
                  <section>
                    <h3 className="text-lg font-semibold text-[#2b4141] border-b border-[#8ab9b5]/30 pb-2 mb-4 flex items-center gap-2"><Home size={20} className="text-[#8ab9b5]" /> Despeses Mensuals</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <InputGroup label="Lloguer Mensual" name="currentHousingCost" suffix="CHF" />
                        <InputGroup label="Habitacions Actuals" name="currentRooms" step="0.5" suffix="hab" />
                    </div>
                    <InputGroup label="Vida (Supermercat, Asseg, Oci)" name="monthlyLivingCost" suffix="CHF" />
                    <InputGroup label="Inflació Lloguer Anual" name="housingCostIncrease" step="0.1" suffix="%" />
                    <InputGroup label="Viatges (Anual)" name="yearlyTravelBudget" icon={Plane} suffix="CHF/any" />
                  </section>
                  <section className="md:col-span-2">
                    <h3 className="text-lg font-semibold text-[#2b4141] border-b border-[#8ab9b5]/30 pb-2 mb-4 flex items-center gap-2"><Baby size={20} className="text-[#0eb1d2]" /> Costos Criança (Per Fill)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <InputGroup label="Kita / Guarderia (< 5 anys)" name="monthlyDaycareCost" suffix="CHF/m" />
                      <InputGroup label="Escola / Extraescolars (5-18)" name="monthlySchoolActivityCost" suffix="CHF/m" />
                      <InputGroup label="Suport Universitat (Total)" name="universitySupport" suffix="CHF" />
                    </div>
                  </section>
                  
                  {/* Detailed Asset Section */}
                  <section className="md:col-span-2">
                    <h3 className="text-lg font-semibold text-[#2b4141] border-b border-[#8ab9b5]/30 pb-2 mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-[#8ab9b5]" /> Patrimoni & Pensions (Per Adult)</h3>
                    
                    <div className="bg-[#f8fafc] rounded-lg p-4 border border-[#8ab9b5]/20 mb-4">
                      <h4 className="font-semibold text-[#2b4141] mb-3 flex items-center gap-2"><User size={16} /> Adult 1</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <InputGroup label="Capital LPP (2n Pilar)" name="pillar2Balance1" suffix="CHF" />
                        <InputGroup label="Capital 3a (Acumulat)" name="pillar3Balance1" suffix="CHF" />
                        <InputGroup label="Aportació Anual 3a (Plan)" name="pillar3AnnualContribution1" suffix="CHF" />
                      </div>
                    </div>

                    <div className="bg-[#f8fafc] rounded-lg p-4 border border-[#8ab9b5]/20 mb-4">
                      <h4 className="font-semibold text-[#2b4141] mb-3 flex items-center gap-2"><User size={16} /> Adult 2</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <InputGroup label="Capital LPP (2n Pilar)" name="pillar2Balance2" suffix="CHF" />
                        <InputGroup label="Capital 3a (Acumulat)" name="pillar3Balance2" suffix="CHF" />
                        <InputGroup label="Aportació Anual 3a (Plan)" name="pillar3AnnualContribution2" suffix="CHF" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <InputGroup label="Estalvi Líquid Actual (Total)" name="currentSavings" suffix="CHF" />
                      <InputGroup label="Rendiment Inversió Estimat" name="investmentReturn" step="0.1" suffix="%" />
                    </div>
                  </section>
                </div>
             </div>
             <FinancialChart data={scenarios[1].data} />
          </div>
        )}

        {activeTab === 'report' && (
          <div className="max-w-5xl mx-auto pb-20">
            {/* Header / Executive Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-[#8ab9b5]/30 p-8 mb-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-[#2b4141]">Informe Planificació Financera</h1>
                  <p className="text-[#8ab9b5] mt-1">Simulació professional per a família a {formData.canton}</p>
                </div>
                <div className="bg-[#f8fafc] p-2 rounded-lg border border-[#8ab9b5]/20 flex gap-2">
                   {(['pessimistic', 'neutral', 'optimistic'] as ScenarioType[]).map((type) => (
                     <button
                       key={type}
                       onClick={() => setSelectedScenario(type)}
                       className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize
                         ${selectedScenario === type ? 'bg-[#0eb1d2] text-white shadow-sm' : 'text-[#2b4141] hover:bg-[#8ab9b5]/10'}`}
                     >
                       {type}
                     </button>
                   ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <SummaryCard 
                  label="Patrimoni Jubilació (65)" 
                  value={new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(activeScenarioData.data.find(p => p.age === formData.retirementAge)?.totalWealth || 0)} 
                />
                <SummaryCard 
                  label="Viabilitat" 
                  value={activeScenarioData.isViable ? "VIABLE" : "NO VIABLE"} 
                  alert={!activeScenarioData.isViable} 
                  subtext={activeScenarioData.isViable ? "Pla sostenible fins als 90 anys" : `Fons esgotats als ${activeScenarioData.savingsDepletedAge} anys`}
                />
                 <SummaryCard 
                  label="Edat Prematura Viable" 
                  value={earlyRetirementAge ? `${earlyRetirementAge} anys` : "N/A"} 
                  subtext={earlyRetirementAge && earlyRetirementAge < formData.retirementAge ? "Jubilació anticipada possible" : "No es pot anticipar"}
                />
                 <SummaryCard 
                  label="Cost Total Fills" 
                  value={new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(
                    activeScenarioData.data.reduce((acc, curr) => acc + curr.childrenExpenses, 0)
                  )} 
                  subtext="Cost total fins 25 anys"
                />
              </div>

              {/* Generated Report Content */}
              {report && (
                 <div className="bg-[#f8fafc] p-8 rounded-lg border border-[#8ab9b5]/20 prose prose-stone max-w-none text-sm text-[#656c6e] prose-p:text-[#656c6e] prose-li:text-[#656c6e] prose-td:text-[#656c6e] prose-th:text-[#2b4141] prose-table:text-sm prose-h1:text-[#2b4141] prose-h2:text-[#0eb1d2] prose-h3:text-[#2b4141]">
                   <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
                 </div>
              )}
            </div>

            {/* Section 1: Income */}
            <div className="bg-white rounded-xl shadow-sm border border-[#8ab9b5]/30 p-6 mb-8">
              <SectionHeader icon={Wallet} title="1. Projecció d'Ingressos Nets" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                   <h4 className="text-sm font-semibold text-[#2b4141] mb-4">Evolució Salarial i Pensions</h4>
                   <IncomeChart data={activeScenarioData.data} />
                   <ChartExplanation 
                      title="Interpretació"
                      interpretation="La corba mostra el creixement professional segons la teva etapa de carrera (junior/mid/senior). La 'caiguda' als 65 anys marca l'inici de la jubilació, on els ingressos passen a provenir dels pilars (AHV, LPP i 3r Pilar)."
                   />
                </div>
                <div className="overflow-x-auto h-64">
                  <h4 className="text-sm font-semibold text-[#2b4141] mb-4">Taula Resum Ingressos</h4>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#f8fafc] text-[#2b4141] sticky top-0">
                      <tr><th className="p-2">Edat</th><th className="p-2">Ingrés Brut</th><th className="p-2">Ingrés Net</th></tr>
                    </thead>
                    <tbody>
                      {activeScenarioData.data.filter((_, i) => i % 5 === 0).map((row) => (
                        <tr key={row.age} className="border-b border-gray-100">
                          <td className="p-2 text-[#2b4141] font-medium">{row.age}</td>
                          <td className="p-2 font-medium text-[#656c6e]">{new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(row.totalGrossIncome)}</td>
                          <td className="p-2 font-medium text-[#2b4141]">{new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(row.totalIncome)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Section 2 & 3: Expenses & Children */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
               <div className="bg-white rounded-xl shadow-sm border border-[#8ab9b5]/30 p-6">
                  <SectionHeader icon={Home} title="2. Desglossament Despeses" />
                  <ExpensesChart data={activeScenarioData.data} />
                  <ChartExplanation 
                      title="Interpretació de Despeses"
                      interpretation="L'increment anual reflecteix la inflació. Si veieu un salt brusc en el cost d'habitatge (verd fosc), és perquè el model ha detectat que la família creix i necessita mudar-se a un pis amb més habitacions."
                   />
               </div>
               <div className="bg-white rounded-xl shadow-sm border border-[#8ab9b5]/30 p-6">
                  <SectionHeader icon={Baby} title="3. Impacte Cost Fills" />
                  <ChildrenCostChart data={activeScenarioData.data} />
                  <ChartExplanation 
                      title="Pics de Despesa"
                      interpretation="Els pics coincideixen amb l'etapa de Kita (0–5 anys, aprox. 30k CHF/any) i l'etapa Universitària (19–23 anys, aprox. 50k CHF totals)."
                   />
               </div>
            </div>

            {/* Section 4: Savings */}
            <div className="bg-white rounded-xl shadow-sm border border-[#8ab9b5]/30 p-6 mb-8">
              <SectionHeader icon={TrendingUp} title="4. Estalvi i Inversió" />
              <WealthChart data={activeScenarioData.data} />
              <ChartExplanation 
                  title="Composició del Patrimoni"
                  interpretation="La majoria del creixement a llarg termini prové del rendiment acumulat (interès compost). La franja lila representa els fons de pensions (intocables fins a la jubilació)."
              />
            </div>

            {/* Section 5: Cash Flow */}
            <div className="bg-white rounded-xl shadow-sm border border-[#8ab9b5]/30 p-6 mb-8">
              <SectionHeader icon={PieChart} title="5. Cash Flow Anual" />
              <CashFlowChart data={activeScenarioData.data} />
              <ChartExplanation 
                  title="Flux de Caixa"
                  interpretation="Les barres vermelles indiquen anys on les despeses superen els ingressos (dèficit). És habitual durant els anys de doble Kita o en jubilació avançada, requerint l'ús d'estalvis previs."
              />
            </div>

             {/* Section 6: Scenarios */}
             <div className="bg-white rounded-xl shadow-sm border border-[#8ab9b5]/30 p-6 mb-8">
              <SectionHeader icon={Shield} title="6. Anàlisi de Sensibilitat" />
              <ScenariosComparisonChart scenarios={scenarios} />
              <ChartExplanation 
                  title="Impacte del Rendiment"
                  interpretation="L'interès compost és la variable crítica. Petits canvis en el rendiment anual (2.5% vs 6.5%) generen diferències de milions de CHF a 40 anys vista."
              />
            </div>
            
            <div className="flex justify-center pt-8">
                <button 
                onClick={() => setActiveTab('input')}
                className="text-[#0eb1d2] font-medium hover:underline flex items-center gap-1"
                >
                Tornar a editar dades <ChevronRight size={16} />
                </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;