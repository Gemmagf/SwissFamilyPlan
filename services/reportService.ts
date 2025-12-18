
import { FinancialData, ScenarioResult, ProjectionPoint, Insight, Recommendation } from '../types';

const formatMoney = (n: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(n);

function analyzeFinancialHealth(data: FinancialData, points: ProjectionPoint[]): {
  insights: Insight[];
  kpis: any;
} {
  const insights: Insight[] = [];
  const worstYear = points.reduce((prev, curr) => (prev.yearlySavings < curr.yearlySavings ? prev : curr));
  const maxDeficit = worstYear.yearlySavings < 0 ? worstYear.yearlySavings : 0;
  const freedomPoint = points.find(p => p.age < data.retirementAge && (p.investedAssets * 0.04) > p.totalExpenses);

  const deficitYears = points.filter(p => p.isDeficit);
  if (deficitYears.length > 0) {
    const startYear = deficitYears[0].year;
    const endYear = deficitYears[deficitYears.length - 1].year;
    const sample = deficitYears[0];
    let cause = "despeses generals";
    if (sample.childrenExpenses > sample.totalExpenses * 0.3) cause = "costos de guarderia (Kita)";
    else if (sample.housingExpenses > sample.totalExpenses * 0.4) cause = "increment costos habitatge";

    insights.push({
      type: 'warning',
      title: 'Tensió de Tresoreria',
      description: `Es preveu un flux de caixa negatiu entre ${startYear} i ${endYear} degut principalment a ${cause}.`,
      severity: maxDeficit < -20000 ? 'high' : 'medium',
      financialImpact: `Dèficit màxim: ${formatMoney(maxDeficit)}`
    });
  }

  const maxP3 = 7056;
  const gap = (maxP3 - data.pillar3AnnualContribution1) + (maxP3 - data.pillar3AnnualContribution2);
  if (gap > 0) {
    insights.push({
      type: 'opportunity',
      title: 'Optimització Fiscal (3r Pilar)',
      description: 'L\'aportació actual al 3r Pilar és inferior al màxim legal.',
      severity: 'medium',
      financialImpact: `Deducció no aprofitada: ~${formatMoney(gap)}`
    });
  }

  const movePoint = points.find(p => p.notes?.some(n => n.includes('Mudança')));
  if (movePoint) {
    insights.push({
      type: 'info',
      title: 'Projecció Immobiliària',
      description: `L'any ${movePoint.year} es contempla un canvi de residència per adaptar-se al creixement del nucli familiar.`,
      severity: 'medium'
    });
  }

  const totalChildCost = points.reduce((acc, p) => acc + p.childrenExpenses, 0);
  const avgChildCostPerYear = totalChildCost / (points.filter(p => p.activeChildren > 0).length || 1);

  return {
    insights,
    kpis: {
      worstYear: worstYear.year,
      maxDeficit,
      freedomAge: freedomPoint?.age || null,
      totalChildCost,
      avgChildCostPerYear
    }
  };
}

function generateRecommendations(data: FinancialData, kpis: any, insights: Insight[]): Recommendation[] {
  const recs: Recommendation[] = [];
  const maxP3 = 7056;
  const p3Gap = (maxP3 - data.pillar3AnnualContribution1) + (maxP3 - data.pillar3AnnualContribution2);
  if (p3Gap > 0) {
    recs.push({
      id: 'fiscal-p3', priority: 1, category: 'Fiscal',
      title: 'Augmentar aportació al 3r Pilar',
      action: `Incrementar l'aportació anual en ${formatMoney(p3Gap)}.`,
      benefit: `Estalvi fiscal estimat de ${formatMoney(p3Gap * 0.25)} anuals.`,
      urgencyLabel: 'Ara'
    });
  }
  const targetEmerg = (data.monthlyLivingCost + data.currentHousingCost) * 6;
  if (data.currentSavings < targetEmerg) {
    recs.push({
      id: 'risk-emergency', priority: 1, category: 'Risc',
      title: 'Consolidar Fons d\'Emergència',
      action: `Destinar l'estalvi mensual a liquiditat fins assolir ${formatMoney(targetEmerg)}.`,
      benefit: 'Cobertura de 6 mesos de despeses fixes.', urgencyLabel: 'Ara'
    });
  }
  if (data.currentSavings > targetEmerg * 1.5 && p3Gap === 0) {
     recs.push({
      id: 'inv-cashdrag', priority: 2, category: 'Inversió',
      title: 'Gestió d\'Excedent de Tresoreria',
      action: `Reassignar ${formatMoney(data.currentSavings - targetEmerg)} a vehicles d'inversió.`,
      benefit: 'Protecció contra inflació i generació de rendiment compost.', urgencyLabel: '1-3 anys'
    });
  }
  recs.push({
    id: 'strat-pension', priority: 3, category: 'Carrera',
    title: 'Estratègia de Compra 2n Pilar (Buy-in)',
    action: 'Planificar aportacions extraordinàries al 2n Pilar a partir dels 50 anys.',
    benefit: 'Optimització fiscal en el pic de la corba salarial.', urgencyLabel: 'Llarg termini'
  });
  return recs.sort((a, b) => a.priority - b.priority);
}

function generateLifeRoadmap(data: FinancialData, points: ProjectionPoint[]): string {
  let md = `### Full de Ruta (Timeline)\n\n`;
  md += `| Any | Edat | Esdeveniment | Anàlisi d'Impacte |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  points.filter(p => p.notes).forEach(p => {
    p.notes?.forEach(note => {
      md += `| ${p.year} | ${p.age} | ${note} | Impacte en cash flow reflectit. |\n`;
    });
  });
  const retirementPoint = points.find(p => p.age === data.retirementAge);
  if (retirementPoint) {
    md += `| ${retirementPoint.year} | ${retirementPoint.age} | Jubilació Planificada | ${retirementPoint.totalWealth > 0 ? "Cobertura suficient." : "Risc detectat."} |\n`;
  }
  return md + `\n`;
}

function generateRetirementAnalysis(data: FinancialData, earlyRetirementAge: number | null): string {
  let md = `### Estudi de Jubilació Anticipada\n\n`;
  md += `L'objectiu de jubilació actual està fixat als **${data.retirementAge} anys**.\n\n`;
  
  if (earlyRetirementAge && earlyRetirementAge < data.retirementAge) {
    md += `*   **Viabilitat:** La jubilació anticipada és **opcional, no necessària**. Segons el model, podríeu avançar-la fins als **${earlyRetirementAge} anys** sense comprometre la solvència a llarg termini.\n`;
    md += `*   **Marge de Seguretat:** Disposeu d'un marge de ${data.retirementAge - earlyRetirementAge} anys de capital lliure.\n`;
  } else if (earlyRetirementAge && earlyRetirementAge === data.retirementAge) {
    md += `*   **Viabilitat:** El pla està ajustat. L'edat de ${data.retirementAge} anys és el límit de prudència financera actual.\n`;
  } else {
    md += `*   **Viabilitat:** Amb la configuració actual, la jubilació anticipada presenta un risc elevat. Es recomana mantenir l'edat de ${data.retirementAge} o augmentar la taxa d'estalvi actual.\n`;
  }
  return md + `\n`;
}

export function generateReportMarkdown(
  data: FinancialData, 
  scenarios: ScenarioResult[], 
  earlyRetirementAge: number | null
): string {
  const neutral = scenarios.find(s => s.type === 'neutral')!;
  const pessimistic = scenarios.find(s => s.type === 'pessimistic')!;
  const { insights, kpis } = analyzeFinancialHealth(data, neutral.data);
  const recommendations = generateRecommendations(data, kpis, insights);
  const patrimonyAtRetirement = neutral.data.find(p => p.age === data.retirementAge)?.totalWealth || 0;

  let md = `# Informe Financer: SwissFamilyPlan\n`;
  md += `**Data:** ${new Date().toLocaleDateString('ca-ES')} | **Perfil:** ${data.luxuryLevel.toUpperCase()}\n\n`;

  md += `## 1. Resum Executiu\n\n`;
  md += neutral.isViable 
    ? `L'anàlisi de viabilitat confirma que l'estructura financera és **sostenible**. Podeu permetre-us el vostre pla de vida sense comprometre la jubilació.\n\n`
    : `L'anàlisi detecta **riscos estructurals**. Calen ajustos per garantir la solvència post-jubilació.\n\n`;

  md += `**Indicadors Clau (KPI):**\n`;
  md += `*   **Patrimoni a la Jubilació:** ${formatMoney(patrimonyAtRetirement)}.\n`;
  md += kpis.freedomAge ? `*   **Independència Financera:** Assolible als **${kpis.freedomAge} anys**.\n` : '';
  md += `*   **Cost Promig Fills:** ${formatMoney(kpis.avgChildCostPerYear)}/any.\n\n`;

  md += `## 2. Planificació Vital i Futur\n\n`;
  md += generateLifeRoadmap(data, neutral.data);
  md += generateRetirementAnalysis(data, earlyRetirementAge);

  md += `## 3. Recomanacions Estratègiques\n\n`;
  const p1 = recommendations.filter(r => r.priority === 1);
  if (p1.length > 0) {
    md += `### Prioritat 1: Accions Immediates\n`;
    p1.forEach(r => md += `*   **${r.title}**: ${r.action}\n`);
    md += `\n`;
  }
  const rest = recommendations.filter(r => r.priority > 1);
  if (rest.length > 0) {
    md += `### Prioritat 2 i 3: Optimització i Estratègia\n`;
    rest.forEach(r => md += `*   **${r.title}**: ${r.action}\n`);
  }

  md += `\n---\n### Annex: Estrès de Mercat\n`;
  md += `En l'escenari pessimista, el patrimoni final seria de **${formatMoney(pessimistic.finalWealth)}**. Pla viable: **${pessimistic.isViable ? "Sí" : "No"}**.\n`;

  return md;
}
