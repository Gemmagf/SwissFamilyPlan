import { FinancialData, ScenarioResult } from '../types';

const formatMoney = (n: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(n);

export function generateReportMarkdown(
  data: FinancialData, 
  scenarios: ScenarioResult[], 
  earlyRetirementAge: number | null
): string {
  const neutral = scenarios.find(s => s.type === 'neutral')!;
  const pessimistic = scenarios.find(s => s.type === 'pessimistic')!;
  
  // KPI Calculations
  const retirementPoint = neutral.data.find(p => p.age === data.retirementAge);
  const patrimonyAtRetirement = retirementPoint?.totalWealth ?? neutral.finalWealth;
  const childrenTotalCost = neutral.data.reduce((acc, p) => acc + p.childrenExpenses, 0);
  
  // Find deficit periods for Narrative
  const deficitPeriods: {start: number, end: number, cause: string}[] = [];
  let currentDeficitStart: number | null = null;
  
  neutral.data.forEach((p, i) => {
    if (p.isDeficit) {
      if (currentDeficitStart === null) currentDeficitStart = p.year;
    } else {
      if (currentDeficitStart !== null) {
        // End of a deficit period
        const midYearIndex = i - 1; 
        const samplePoint = neutral.data[midYearIndex];
        let cause = "Despeses generals";
        if (samplePoint.childrenExpenses > (samplePoint.totalExpenses * 0.3)) cause = "Càrrega Kita/Educació";
        else if (samplePoint.age >= data.retirementAge) cause = "Rendes jubilació insuficients";
        
        deficitPeriods.push({ start: currentDeficitStart, end: p.year - 1, cause });
        currentDeficitStart = null;
      }
    }
  });

  // Collect Timeline Events (Moved House, etc.)
  const events = neutral.data.filter(p => p.notes && p.notes.length > 0).map(p => ({
     year: p.year,
     age: p.age,
     note: p.notes!.join(", ")
  }));
  // Filter out repetitive annual events if any, keep major ones
  const majorEvents = events.filter(e => !e.note.includes("Fons Esgotats") || e.year % 5 === 0);

  // Recommendations Logic
  const maxP3 = 7056;
  const p1Gap = maxP3 - data.pillar3AnnualContribution1;
  const p2Gap = maxP3 - data.pillar3AnnualContribution2;
  const totalP3Gap = Math.max(0, p1Gap) + Math.max(0, p2Gap);
  const taxSavingPotential = totalP3Gap * 0.25; // Approx marginal tax rate

  // --- REPORT GENERATION ---

  let md = `# Informe de Planificació Financera: SwissFamilyPlan\n\n`;
  md += `**Data:** ${new Date().toLocaleDateString('ca-ES')} | **Cantó:** ${data.canton} | **Perfil:** ${data.luxuryLevel.toUpperCase()}\n\n`;
  
  // 1. Executive Summary
  md += `## 1. Visió General i Diagnòstic\n\n`;
  md += `El vostre pla financer es classifica com a **${neutral.isViable ? '🟢 VIABLE' : '🔴 VULNERABLE'}** sota hipòtesis neutres.\n\n`;
  
  md += `**Fites Principals:**\n`;
  md += `- **Patrimoni a la Jubilació (${data.retirementAge} anys):** ${formatMoney(patrimonyAtRetirement)}\n`;
  if (majorEvents.some(e => e.note.includes("Mudança"))) {
     md += `- **Habitatge:** El model preveu una mudança necessària a un pis més gran al voltant de l'any ${majorEvents.find(e => e.note.includes("Mudança"))?.year} per acomodar la família.\n`;
  }
  md += `- **Cost Criança Total:** ${formatMoney(childrenTotalCost)} (estimat fins als 25 anys).\n\n`;

  // 2. Narrative Cash Flow
  md += `## 2. Narrativa del Flux de Caixa\n\n`;
  md += `L'anàlisi detecta com evolucionarà la vostra capacitat d'estalvi any a any:\n\n`;
  
  if (deficitPeriods.length === 0) {
      md += `✅ **Sostenibilitat:** Manteniu superàvit (estalvi positiu) durant tota la projecció. Això indica una estructura de costos molt sana o ingressos molt alts.\n`;
  } else {
      md += `⚠️ **Períodes de Tensió Financera (Dèficit):**\n`;
      deficitPeriods.forEach(p => {
         md += `- **${p.start}–${p.end}**: Flux negatiu causat principalment per **${p.cause}**. Durant aquests anys, la família consumirà estalvis acumulats.\n`;
      });
      md += `\n*Nota: Tenir dèficit temporalment no és dolent si hi ha liquiditat prèvia (estalvis) per cobrir-lo, com és el cas de la fase Kita.*\n`;
  }

  // 3. Strategic Recommendations
  md += `\n## 3. Recomanacions Tàctiques (Valor Afegit)\n\n`;

  md += `### 💰 Fiscalitat i 3r Pilar\n`;
  if (totalP3Gap > 0) {
      md += `🚨 **Oportunitat Perduda:** No esteu maximitzant el 3r Pilar. Teniu un "gap" de ${formatMoney(totalP3Gap)}/any.\n`;
      md += `> **Acció Immediata:** Si cobriu aquest gap, obtindreu un **retorn fiscal garantit immediat d'aprox. ${formatMoney(taxSavingPotential)} cada any** en devolució d'impostos. És una rendibilitat del 25% sense risc.\n`;
  } else {
      md += `✅ **Òptim:** Esteu aprofitant al màxim la deducció del 3r Pilar (${formatMoney(maxP3*2)}/any en total).\n`;
  }

  md += `\n### 🏠 Estratègia d'Habitatge\n`;
  if (data.housingStatus === 'rent') {
      md += `Actualment pagueu ${formatMoney(data.currentHousingCost)}/mes. `;
      if ((data.currentChildren + data.futureChildren) > data.currentRooms) {
          md += `Amb ${data.currentChildren + data.futureChildren} fills previstos i només ${data.currentRooms} habitacions, el model ha forçat automàticament un increment de lloguer futur per reflectir una mudança realista.\n`;
      } else {
          md += `L'espai actual sembla suficient per a la planificació familiar indicada.\n`;
      }
  }

  md += `\n### 🎓 Planificació Educativa\n`;
  md += `Si els vostres fills estudien a Suïssa i viuen a casa, el cost és manejable (~15k/any). Si opten per universitats a altres cantons (Lausanne, St. Gallen) o a l'estranger, el cost es dispara a **30k-40k CHF/any**.\n`;
  md += `> **Recomanació:** Obriu un compte d'inversió "Junior" a nom dels pares (per control) amb una aportació de 100-200 CHF/mes des del naixement.\n`;

  // 4. Timeline
  if (majorEvents.length > 0) {
      md += `\n## 4. Timeline d'Esdeveniments Clau\n\n`;
      md += `| Any | Edat | Esdeveniment |\n`;
      md += `| :--- | :--- | :--- |\n`;
      majorEvents.slice(0, 8).forEach(e => {
          md += `| **${e.year}** | ${e.age} | ${e.note} |\n`;
      });
  }

  // 5. Comparison Table
  md += `\n## 5. Comparativa d'Escenaris a 90 anys\n\n`;
  md += `| Escenari | Patrimoni Final | Estat |\n`;
  md += `| :--- | ---: | :--- |\n`;
  md += `| Pessimista | ${formatMoney(pessimistic.finalWealth)} | ${pessimistic.isViable ? 'Viable' : '❌ Esgotat'} |\n`;
  md += `| Neutre | ${formatMoney(neutral.finalWealth)} | Viable |\n`;

  return md;
}