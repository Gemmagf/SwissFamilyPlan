import React, { useState, useMemo } from 'react';
import { FinancialData, ProjectionPoint, ScenarioResult, ScenarioType } from './types';
import { estimateLocationCosts } from './services/geminiService'; // kept for estimation feature
import { runAllScenarios, calculateViableEarlyRetirement } from './services/financeEngine';
import { generateReportMarkdown } from './services/reportService';
import { FinancialChart } from './components/FinancialChart';
import { 
  IncomeChart, ExpensesChart, ChildrenCostChart, WealthChart, CashFlowChart, ScenariosComparisonChart 
} from './components/ReportCharts';
import { 
  Users, Wallet, Home, TrendingUp, Baby, Plane, FileText, Loader2, ChevronRight, Calculator, MapPin, Wand2,
  AlertTriangle, CheckCircle, TrendingDown, PieChart, Shield
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Default Data based on "Escenari de prova"
const initialData: FinancialData = {
  currentAge: 30,
  retirementAge: 65,
  currentChildren: 0,
  futureChildren: 4,
  firstChildBirthYearOffset: 1,
  childSpacingYears: 2,
  annualGrossSalary1: 110000,
  annualGrossSalary2: 90000,
  annualBonus: 0,
  expectedSalaryIncrease: 3.0, // 3% annual growth
  currentSavings: 200000, // Initial Savings
  monthlyContribution: 3000, // 36k/year
  investmentReturn: 4.5,
  pillar2Value: 50000,
  pillar3Value: 14000,
  housingStatus: 'rent',
  currentHousingCost: 1500, // Will increase with kids/inflation
  housingCostIncrease: 2.5, // Annual inflation + market adjustments
  monthlyLivingCost: 7900, // Approx 95k/year total living expenses
  monthlyDaycareCost: 2500, // Per child < 5
  monthlySchoolActivityCost: 500, // Per child > 5
  yearlyTravelBudget: 5000, 
  universitySupport: 50000, // Lump sum per child
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

  // Advanced Simulation Engine (Determininstic)
  const scenarios = useMemo((): ScenarioResult[] => {
    return runAllScenarios(formData);
  }, [formData]);

  const activeScenarioData = useMemo(() => 
    scenarios.find(s => s.type === selectedScenario) || scenarios[1]
  , [scenarios, selectedScenario]);

  // Calculate Early Retirement KPI
  const earlyRetirementAge = useMemo(() => {
    return calculateViableEarlyRetirement(formData);
  }, [formData]);

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
    // Generates the deterministic markdown report
    const result = generateReportMarkdown(formData, scenarios);
    // Artificial delay to feel like processing if desired, or just immediate
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

        <div className="mt-12 p-4 bg-black/20 rounded-xl border border-[#8ab9b5]/20">
          <p className="text-xs text-[#8ab9b5] mb-2">Patrimoni Estimat (65 anys)</p>
          <p className="text-xl font-bold text-white">
             {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })
                .format(activeScenarioData.data.find(p => p.age === 65)?.totalWealth || 0)}
          </p>
          <p className="text-xs text-[#8ab9b5] mt-4 mb-2">Patrimoni Final (90 anys)</p>
          <p className="text-lg text-white opacity-80">
             {new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 })
                .format(activeScenarioData.finalWealth)}
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
                        <InputGroup label="Estil de Vida" name="luxuryLevel" type="text" />
                      </div>
                      <button onClick={handleEstimateCosts} disabled={loadingEstimate || !formData.canton} className="w-full flex items-center justify-center gap-2 bg-[#8ab9b5] hover:bg-[#2b4141] text-white px-4 py-2 rounded-md transition-colors text-sm font-medium disabled:opacity-50">
                        {loadingEstimate ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />} Estimar costos automàticament
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
                    <h3 className="text-lg font-semibold text-[#2b4141] border-b border-[#8ab9b5]/30 pb-2 mb-4 flex items-center gap-2"><Wallet size={20} className="text-[#8ab9b5]" /> Ingressos Anuals (Bruts)</h3>
                    <InputGroup label="Salari Adult 1" name="annualGrossSalary1" suffix="CHF" />
                    <InputGroup label="Salari Adult 2" name="annualGrossSalary2" suffix="CHF" />
                    <InputGroup label="Bonus Familiar" name="annualBonus" suffix="CHF" />
                    <InputGroup label="Increment Salarial Estimat" name="expectedSalaryIncrease" step="0.1" suffix="%" />
                  </section>
                  <section>
                    <h3 className="text-lg font-semibold text-[#2b4141] border-b border-[#8ab9b5]/30 pb-2 mb-4 flex items-center gap-2"><Home size={20} className="text-[#8ab9b5]" /> Despeses Mensuals</h3>
                    <InputGroup label="Lloguer Mensual" name="currentHousingCost" suffix="CHF" />
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
                  <section className="md:col-span-2">
                    <h3 className="text-lg font-semibold text-[#2b4141] border-b border-[#8ab9b5]/30 pb-2 mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-[#8ab9b5]" /> Estalvi & Patrimoni</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <InputGroup label="Estalvi Total Actual" name="currentSavings" suffix="CHF" />
                      <InputGroup label="Aportació Mensual" name="monthlyContribution" suffix="CHF" />
                      <InputGroup label="Rendiment Inversió" name="investmentReturn" step="0.1" suffix="%" />
                      <InputGroup label="2n Pilar (LPP)" name="pillar2Value" suffix="CHF" />
                      <InputGroup label="3r Pilar (3a)" name="pillar3Value" suffix="CHF" />
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

              {/* AI Executive Summary */}
              {report && (
                 <div className="bg-[#f8fafc] p-6 rounded-lg border border-[#8ab9b5]/20 prose prose-stone max-w-none text-sm text-[#656c6e] prose-p:text-[#656c6e] prose-li:text-[#656c6e] prose-td:text-[#656c6e] prose-th:text-[#2b4141] prose-table:text-sm">
                   <h3 className="text-[#2b4141] font-bold mt-0 flex items-center gap-2"><FileText size={16} /> Resum Executiu (IA)</h3>
                   <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.split('##')[0] || "Generant..."}</ReactMarkdown>
                 </div>
              )}
            </div>

            {/* Section 1: Income */}
            <div className="bg-white rounded-xl shadow-sm border border-[#8ab9b5]/30 p-6 mb-8">
              <SectionHeader icon={Wallet} title="1. Projecció d'Ingressos Nets (Cash In)" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                   <h4 className="text-sm font-semibold text-[#2b4141] mb-4">Evolució Salarial Neta</h4>
                   <IncomeChart data={activeScenarioData.data} />
                   <ChartExplanation 
                      title="Evolució Salarial Neta"
                      items={[
                        "Salaris nets dels dos pares",
                        "Bonus (si aplica)"
                      ]}
                      desc="Aquest gràfic mostra l’evolució dels ingressos nets familiars (després d’impostos) des dels 30 fins als 90 anys, assumint: creixement del salari del 3% anual fins als 55 anys, estabilització després, i reducció d’ingressos en la jubilació."
                      interpretation="La corba ascendent fins ~55 reflecteix el creixement professional; després hi ha estabilització i una caiguda prevista en la jubilació (65 anys)."
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
                  <SectionHeader icon={Home} title="2. Desglossament Despeses (Amb Inflació)" />
                  <ExpensesChart data={activeScenarioData.data} />
                  <ChartExplanation 
                      title="Despesa Total Anual"
                      items={[
                        "Fills & Educació: Kita (0–5 anys), activitats (6–18), universitat (18–22)",
                        "Habitatge: lloguer + assegurances + serveis",
                        "Viatges: viatges anuals ajustats per inflació",
                        "Vida Diària: menjar, transport, assegurances, salut, etc."
                      ]}
                      interpretation="El gruix de color taronja (fills) creix molt en: anys 30–35 → Kita (etapa més cara), anys 48–52 → universitat"
                   />
               </div>
               <div className="bg-white rounded-xl shadow-sm border border-[#8ab9b5]/30 p-6">
                  <SectionHeader icon={Baby} title="3. Impacte Cost Fills" />
                  <ChildrenCostChart data={activeScenarioData.data} />
                  <ChartExplanation 
                      title="Impacte Cost Fills"
                      desc="Mostra la despesa anual específica dels fills comparada amb el pressupost total de despeses."
                      interpretation="Els pics coincideixen amb: Kita (0–5 anys) ~30k/any per fill, Universitat (18–22) ~50k total per fill."
                   />
               </div>
            </div>

            {/* Section 4: Savings */}
            <div className="bg-white rounded-xl shadow-sm border border-[#8ab9b5]/30 p-6 mb-8">
              <SectionHeader icon={TrendingUp} title="4. Estalvi i Inversió (Wealth)" />
              <WealthChart data={activeScenarioData.data} />
              <ChartExplanation 
                  title="Estalvi i Inversió"
                  items={[
                    "Lila/Indi → Pilar 2/3 (pensions)",
                    "Blau → Inversions",
                    "Verd → Estalvis líquids"
                  ]}
                  interpretation="La part superior és el creixement per interès compost: és la prova que a llarg termini el patrimoni creix molt més pel rendiment acumulat que no pas per l’estalvi anual."
              />
            </div>

            {/* Section 5: Cash Flow */}
            <div className="bg-white rounded-xl shadow-sm border border-[#8ab9b5]/30 p-6 mb-8">
              <SectionHeader icon={PieChart} title="5. Cash Flow Anual" />
              <CashFlowChart data={activeScenarioData.data} />
              <ChartExplanation 
                  title="Cash Flow Anual"
                  items={[
                    "Ingressos totals",
                    "Despeses totals",
                    "Estalvi (positiu = verd, negatiu = vermell)"
                  ]}
                  interpretation="Els anys en vermell són: anys amb cost de Kita, anys amb universitat, després de la jubilació (ingressos més baixos). Això és normal i no vol dir inviabilitat → només que cal utilitzar estalvis inversos."
              />
            </div>

             {/* Section 6: Scenarios */}
             <div className="bg-white rounded-xl shadow-sm border border-[#8ab9b5]/30 p-6 mb-8">
              <SectionHeader icon={Shield} title="6. Anàlisi d'Escenaris i Sensibilitat" />
              <ScenariosComparisonChart scenarios={scenarios} />
              <ChartExplanation 
                  title="Escenaris"
                  items={[
                    "Pessimista → 2.5% anual",
                    "Neutre → 4.5% anual",
                    "Optimista → 6.5% anual"
                  ]}
                  interpretation="La diferència a llarg termini és enorme: a 90 anys hi ha un rang de milions de CHF de diferència. Això demostra que l’interès compost és la variable més important del model."
              />
              <div className="grid grid-cols-3 gap-4 mt-6 text-center text-sm">
                <div className="p-3 bg-red-50 rounded text-red-800">
                  <strong>Pessimista</strong><br/>
                  Patrimoni 65: {new Intl.NumberFormat('de-CH', {compactDisplay: "short", notation: "compact"}).format(scenarios.find(s=>s.type==='pessimistic')?.data.find(p => p.age === 65)?.totalWealth || 0)} CHF
                </div>
                <div className="p-3 bg-gray-50 rounded text-gray-800">
                  <strong>Neutre</strong><br/>
                  Patrimoni 65: {new Intl.NumberFormat('de-CH', {compactDisplay: "short", notation: "compact"}).format(scenarios.find(s=>s.type==='neutral')?.data.find(p => p.age === 65)?.totalWealth || 0)} CHF
                </div>
                <div className="p-3 bg-blue-50 rounded text-blue-800">
                  <strong>Optimista</strong><br/>
                  Patrimoni 65: {new Intl.NumberFormat('de-CH', {compactDisplay: "short", notation: "compact"}).format(scenarios.find(s=>s.type==='optimistic')?.data.find(p => p.age === 65)?.totalWealth || 0)} CHF
                </div>
              </div>
            </div>

            {/* Report Content */}
            {report && (
               <div className="bg-white rounded-xl shadow-sm border border-[#8ab9b5]/30 p-8 prose prose-stone max-w-none text-[#656c6e] prose-p:text-[#656c6e] prose-li:text-[#656c6e] prose-td:text-[#656c6e] prose-th:text-[#2b4141] prose-table:text-sm">
                  <SectionHeader icon={FileText} title="Anàlisi Detallat" />
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
               </div>
            )}
            
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