import { GoogleGenAI } from "@google/genai";
import { FinancialData, ScenarioResult } from "../types";

const SYSTEM_INSTRUCTION = `
Ets un assessor financer expert especialitzat en planificació familiar a Suïssa (Wealth Management).
El teu objectiu és analitzar les dades financeres d'una família i generar un informe detallat en format Markdown.
L'idioma de sortida ha de ser Català.

Has de tenir en compte:
1. El context suís (Costos de Kita/Guarderia, 2n i 3r Pilar, impostos cantonals, cost de vida elevat).
2. L'impacte de tenir fills (reducció de capacitat d'estalvi durant els anys de Kita).
3. La viabilitat dels objectius de jubilació en diferents escenaris.
4. Riscos potencials (pèrdua de feina, mercat).

Estructura de l'informe:
- **Resum Executiu**: Viabilitat general del pla.
- **Anàlisi d'Escenaris**: Compara l'escenari neutre amb el pessimista.
- **Costos de Criança**: Estimació del cost total per fill fins als 25 anys.
- **Recomanacions**: Optimització fiscal (3a pilar), estratègia d'inversió i gestió de riscos.
`;

export const generateFinancialReport = async (data: FinancialData, scenarios: ScenarioResult[]): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key not found");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Extract summary data from scenarios for the prompt
    const neutral = scenarios.find(s => s.type === 'neutral');
    const pessimistic = scenarios.find(s => s.type === 'pessimistic');
    const optimistic = scenarios.find(s => s.type === 'optimistic');

    const formatMoney = (n: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(n);

    const prompt = `
      Analitza les següents dades financeres per a una família a Suïssa:
      
      **Dades Familiars:**
      - Edat Actual (pares): ${data.currentAge}
      - Edat Jubilació: ${data.retirementAge}
      - Fills Actuals: ${data.currentChildren}
      - Fills Futurs: ${data.futureChildren}
      - Cantó: ${data.canton}

      **Resultats de la Simulació (Calculats prèviament):**
      
      1. **Escenari Neutre**:
         - Patrimoni final: ${formatMoney(neutral?.finalWealth || 0)}
         - Es queden sense diners?: ${neutral?.savingsDepletedAge ? `Sí, als ${neutral.savingsDepletedAge} anys` : 'No'}
         
      2. **Escenari Pessimista** (Mercat baix, menys sou, més costos):
         - Patrimoni final: ${formatMoney(pessimistic?.finalWealth || 0)}
         - Es queden sense diners?: ${pessimistic?.savingsDepletedAge ? `Sí, als ${pessimistic.savingsDepletedAge} anys` : 'No'}

      3. **Escenari Optimista**:
         - Patrimoni final: ${formatMoney(optimistic?.finalWealth || 0)}

      **Detalls Econòmics:**
      - Ingressos totals anuals: ${data.annualGrossSalary1 + data.annualGrossSalary2 + data.annualBonus} CHF
      - Estalvi actual: ${data.currentSavings} CHF
      - Cost Lloguer: ${data.currentHousingCost} CHF/mes
      - Cost Kita (Total): ${data.monthlyDaycareCost * (data.currentChildren > 0 ? 1 : 0)} CHF/mes (estimat)

      Si us plau, genera un informe precís que expliqui si el pla és viable, quins riscos corren en l'escenari pessimista i quines accions han de prendre avui.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    return response.text || "No s'ha pogut generar l'informe.";
  } catch (error) {
    console.error("Error generating report:", error);
    return "Hi ha hagut un error connectant amb l'assistent financer. Si us plau, verifica la teva clau API.";
  }
};

export const estimateLocationCosts = async (
  location: string,
  totalChildren: number,
  luxuryLevel: string
): Promise<Partial<FinancialData> | null> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      Actua com un expert immobiliari i financer a Suïssa.
      Estima els costos mensuals realistes per a una família que viu a: "${location}".
      
      Perfil:
      - Total fills: ${totalChildren}
      - Estil de vida: ${luxuryLevel} (basic, comfortable, premium)
      
      Retorna un JSON (sense markdown) amb aquests camps:
      {
        "monthlyDaycareCost": (Cost Kita privat sense subvenció per 1 fill/mes),
        "monthlySchoolActivityCost": (Roba, extraescolars, material per fill/mes),
        "currentHousingCost": (Lloguer pis adequat per la família/mes),
        "monthlyLivingCost": (Supermercat, assegurances salut, transport, electricitat per tota la família/mes)
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Error estimating costs:", error);
    return null;
  }
};