import { FinancialData, ScenarioResult } from '../types';

const formatMoney = (n: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(n);

export function generateReportMarkdown(data: FinancialData, scenarios: ScenarioResult[]): string {
  const neutral = scenarios.find(s => s.type === 'neutral')!;
  const pessimistic = scenarios.find(s => s.type === 'pessimistic')!;
  const optimistic = scenarios.find(s => s.type === 'optimistic')!;

  // KPIs
  const patrimonyAtRetirement = neutral.data.find(p => p.age === data.retirementAge)?.totalWealth ?? neutral.finalWealth;
  const patrimonyAtMax = neutral.maxWealth;
  const childrenTotalCost = neutral.data.reduce((acc, p) => acc + p.childrenExpenses, 0);

  // Compose Markdown
  let md = `# Informe de Planificació Financera — Resum\n\n`;
  md += `**Client:** Família a ${data.canton}\n\n`;
  md += `**Edat actual (pares):** ${data.currentAge}\n\n`;
  md += `**Fills previstos:** ${data.currentChildren} actuals + ${data.futureChildren} futurs\n\n`;

  md += `---\n\n## 1) Resum Executiu\n\n`;
  md += `- **Viabilitat (escenari neutre):** ${neutral.isViable ? 'VIABLE' : `Risc: esgotament als ${neutral.savingsDepletedAge} anys`}\n`;
  md += `- **Patrimoni estimat a ${data.retirementAge} anys (neutre):** ${formatMoney(patrimonyAtRetirement)}\n`;
  md += `- **Màxim patrimoni durant la vida (neutre):** ${formatMoney(patrimonyAtMax)}\n\n`;

  md += `**Observacions ràpides:**\n`;
  md += `- Amb aportacions de ${formatMoney(data.monthlyContribution * 12)}/any i un rendiment esperat del ${data.investmentReturn}%, l’escenari neutre mostra un patrimoni final suficient per mantenir un nivell de vida còmode.\n\n`;

  md += `---\n\n## 2) Anàlisi d'Escenaris (KPIs)\n\n`;
  // Markdown Table with alignment
  md += `| Escenari | Patrimoni final | Viabilitat |\n`;
  md += `| :--- | ---: | :---: |\n`;
  md += `| Pessimista | ${formatMoney(pessimistic.finalWealth)} | ${pessimistic.isViable ? 'VIABLE' : `NO (esgotat als ${pessimistic.savingsDepletedAge} anys)`} |\n`;
  md += `| Neutre | ${formatMoney(neutral.finalWealth)} | ${neutral.isViable ? 'VIABLE' : `NO (esgotat als ${neutral.savingsDepletedAge} anys)`} |\n`;
  md += `| Optimista | ${formatMoney(optimistic.finalWealth)} | ${optimistic.isViable ? 'VIABLE' : `NO (esgotat als ${optimistic.savingsDepletedAge} anys)`} |\n\n`;

  md += `---\n\n## 3) Ingressos en Jubilació (Els 3 Pilars)\n\n`;
  md += `A partir dels ${data.retirementAge} anys, els ingressos de la família provenen només dels tres pilars del sistema suís:\n`;
  md += `1. **AHV (Pilar 1)**: Renda pública (aprox. màx 44k CHF/any per parella).\n`;
  md += `2. **LPP (Pilar 2)**: Renda derivada del capital acumulat (convertit amb taxa del 5.8%).\n`;
  md += `3. **Pilar 3a**: Capital privat convertit en una renda anual equivalent (linear drawdown) fins als 90 anys.\n\n`;
  md += `En els gràfics, això reemplaça la línia salarial i passa a mostrar-se com a franges d’ingressos estables durant tota la jubilació.\n\n`;

  md += `---\n\n## 4) Costos de Criança (resum)\n\n`;
  md += `Cost total (aprox. sumat any a any, escenari neutre): **${formatMoney(childrenTotalCost)}**\n\n`;
  md += `Detall per anys i recomanacions: revisa la secció de gràfics per veure els pics de Kita (0–5 anys) i universitat (18–22 anys).\n\n`;

  md += `---\n\n## 5) Taula Resum Anual (Extracte 5 anys)\n\n`;
  md += `| Any | Edat | Fills (Càrrec) | Ingrés Brut | Ingrés Net (aprox.) | Despeses | Estalvi net | Patrimoni |\n`;
  md += `| ---: | ---: | :---: | ---: | ---: | ---: | ---: | ---: |\n`;
  neutral.data.filter((_, i) => i % 5 === 0).forEach(p => {
    md += `| **${p.year}** | **${p.age}** | ${p.activeChildren} | ${formatMoney(p.totalGrossIncome)} | ${formatMoney(p.totalIncome)} | ${formatMoney(p.totalExpenses)} | ${formatMoney(p.yearlySavings)} | ${formatMoney(p.totalWealth)} |\n`;
  });

  md += `\n---\n\n## 6) Recomanacions Professionals (Family Office)\n\n`;
  
  md += `### 🏛️ Estratègia d'Inversió (Wealth Management)\n`;
  md += `*   **Horitzó Temporal**: Aprofita que els fons per a la jubilació tenen un horitzó de +20 anys. Mantingues una exposició alta a renda variable (ETFs globals) per combatre la inflació.\n`;
  md += `*   **Automatització (DCA)**: L'aportació mensual de ${formatMoney(data.monthlyContribution)} ha de ser automàtica (standing order) per evitar el "market timing".\n`;
  md += `*   **Rebalanceig**: Un cop l'any, ajusta la cartera si un actiu ha pujat massa, per mantenir el perfil de risc desitjat.\n\n`;

  md += `### ⚖️ Optimització Fiscal a Suïssa\n`;
  md += `*   **Pilar 3a**: Màxima prioritat. Aporta el màxim anual (actualment ~7k CHF) per persona treballadora. Això redueix directament la base imposable.\n`;
  md += `*   **Compres al 2n Pilar (Buy-ins)**: En anys de bonus alts o 5-10 anys abans de jubilar-se, fer aportacions voluntàries al 2n pilar és la millor eina per estalviar impostos massivament. Revisa el "gap" de compra al teu certificat de la caixa de pensions.\n`;
  md += `*   **Estratègia de Retirada**: No retiris tot el capital (2n i 3r pilar) el mateix any. Planifica retirar-los en anys diferents per "trencar" la progressivitat de l'impost sobre la retirada de capital.\n\n`;

  md += `### 🛡️ Protecció Familiar i Successió\n`;
  md += `*   **Assegurança de Vida**: Amb ${data.currentChildren + data.futureChildren} fills previstos i hipoteca/lloguer alt, és **crític** tenir una assegurança de vida (risc pur) que cobreixi mínim 2-3 anys d'ingressos si falta un progenitor.\n`;
  md += `*   **Testament i Mandat**: A Suïssa, assegura't de tenir un "Vorsorgeauftrag" (mandat d'incapacitat) i un testament per protegir la parella en cas de desgràcia, especialment si no esteu casats o teniu propietats.\n`;
  md += `*   **Comptes Junior**: Obre comptes d'estalvi/inversió a nom dels fills *ara* per aprofitar l'interès compost fins que tinguin 18 anys. El temps és el millor actiu.\n\n`;

  md += `---\n\n**Nota:** Aquest informe és una simulació basada en les dades introduïdes. Els mercats fluctuen i la fiscalitat pot canviar. Es recomana revisar aquest pla anualment.\n`;

  return md;
}