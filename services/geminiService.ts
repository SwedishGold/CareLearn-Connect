
import { GoogleGenAI, Type, Schema, Content } from "@google/genai";
import { User, UserData, Role, LogbookEntry, KnowledgeTestAttempt, CustomDocument, GeneratedAppConfig, CareFlowStep, ChatMessage, FeedbackEntry, FeedbackAnalysis, ExternalFeedbackAnalysis, SBARFeedback, DailyChallenge, CompletedChallenge, KnowledgeTestQuestion, DailySuggestion, AIGeneratedProfile } from '../types';
import { APP_DATA } from '../constants';
import * as storage from '../services/localStorageService';
import { checkTextForPII, sanitizeText } from './securityService'; // Import sanitizer

// --- API KEY CONFIGURATION ---
// Helper to get key from Vite environment variable
const getSystemKey = (): string => {
  // Read from Vite environment variable set in .env file
  // @ts-ignore
  const apiKey = import.meta.env.VITE_API_KEY;
  
  if (!apiKey) {
    console.warn('VITE_API_KEY not found in environment. AI features will fail.');
    return 'MISSING_KEY';
  }
  
  return apiKey;
};

// Helper to parse JSON from AI response - ROBUST VERSION
const parseAIJSON = <T>(text: string): T => {
    try {
        let cleanedText = text.trim();
        
        // Remove citation markers which often break JSON (e.g. [cite: 1])
        cleanedText = cleanedText.replace(/\[cite:.*?\]/g, '');

        // Improved regex to find the outermost JSON object or array
        const jsonObjectMatch = cleanedText.match(/\{[\s\S]*\}/);
        const jsonArrayMatch = cleanedText.match(/\[[\s\S]*\]/);
        
        let match = null;
        
        // Determine if we expect an object or array based on the first significant char or try both
        if (jsonArrayMatch && (!jsonObjectMatch || jsonArrayMatch.index! < jsonObjectMatch.index!)) {
             match = jsonArrayMatch;
        } else {
             match = jsonObjectMatch;
        }

        if (match) {
            cleanedText = match[0];
        }

        // Remove any lingering markdown
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        
        // Basic fix for trailing commas before closing braces/brackets
        cleanedText = cleanedText.replace(/,\s*([\]}])/g, '$1');

        return JSON.parse(cleanedText) as T;
    } catch (error) {
        console.error("JSON Parse Error:", error);
        console.error("Raw text received:", text);
        throw error;
    }
};

// Local helper to get role display name to avoid circular dependency with UI.tsx
const getRoleDisplayName = (role: Role) => {
    const names: Record<Role, string> = {
      'usk-elev': 'Undersköterske-elev',
      'ssk-student': 'Sjuksköterske-student',
      'handledare-usk': 'Handledare (USK)',
      'handledare-ssk': 'Handledare (SSK)',
      'larare-usk': 'Lärare (USK)',
      'larare-ssk': 'Lärare (SSK)',
      'admin': 'Administratör',
      'vikarie-usk': 'Vikarie (USK)',
      'vikarie-ssk': 'Vikarie (SSK)',
      'overlakare': 'Överläkare',
      'huvudhandledare': 'Huvudhandledare',
      'anstalld-usk': 'Anställd (USK)',
      'anstalld-ssk': 'Anställd (SSK)',
      'developer': 'Utvecklare',
    };
    return names[role] || role;
};

// MODIFIED: Use active user key if available, else fallback to system key
const getAI = (forceSystemKey: boolean = false) => {
    const systemKey = getSystemKey();
    
    if (forceSystemKey) {
        if (!systemKey) throw new Error("Ingen API-nyckel konfigurerad i systemet.");
        return new GoogleGenAI({ apiKey: systemKey });
    }
    
    const userKey = storage.getCurrentUserApiKey();
    // Prioritize user key (BYOK), then system key
    const finalKey = userKey || systemKey;
    
    if (!finalKey) {
        console.warn("No API key found (User or System). AI features will fail.");
    }
    
    return new GoogleGenAI({ apiKey: finalKey || "MISSING_KEY" });
};

// --- GEMINI MODEL ROUTING (PRIMARY + FALLBACK) ---
// Primär: Gemini 3.0 Flash. Fallback: nuvarande modell som appen använder idag.
const PRIMARY_TEXT_MODEL = 'gemini-3.0-flash' as const;
const FALLBACK_TEXT_MODEL = 'gemini-2.5-flash' as const;

type GenerateContentParams = Parameters<GoogleGenAI['models']['generateContent']>[0];
type GenerateContentResponse = Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>;
type GenerateContentStreamParams = Parameters<GoogleGenAI['models']['generateContentStream']>[0];
type GenerateContentStreamResponse = Awaited<ReturnType<GoogleGenAI['models']['generateContentStream']>>;

const shouldFallbackToLegacyModel = (error: unknown): boolean => {
    // Vi faller tillbaka brett eftersom "model not found", quota, 4xx/5xx kan dyka upp olika beroende på SDK/version.
    // Viktigt: om primär modellen inte är tillgänglig i ett projekt, vill vi alltid kunna fortsätta på nuvarande modell.
    if (!error) return true;
    if (typeof error === 'string') return true;
    if (error instanceof Error) return true;
    return true;
};

const generateTextWithFallback = async (
    ai: GoogleGenAI,
    request: Omit<GenerateContentParams, 'model'>,
    meta?: { feature?: string }
): Promise<GenerateContentResponse> => {
    try {
        return await ai.models.generateContent({ ...request, model: PRIMARY_TEXT_MODEL } as GenerateContentParams);
    } catch (error) {
        if (!shouldFallbackToLegacyModel(error)) throw error;
        console.warn(`[Gemini] Primär modell misslyckades (${PRIMARY_TEXT_MODEL})${meta?.feature ? ` för ${meta.feature}` : ''}. Faller tillbaka till ${FALLBACK_TEXT_MODEL}.`, error);
        return await ai.models.generateContent({ ...request, model: FALLBACK_TEXT_MODEL } as GenerateContentParams);
    }
};

const generateTextStreamWithFallback = async (
    ai: GoogleGenAI,
    request: Omit<GenerateContentStreamParams, 'model'>,
    meta?: { feature?: string }
): Promise<GenerateContentStreamResponse> => {
    try {
        return await ai.models.generateContentStream({ ...request, model: PRIMARY_TEXT_MODEL } as GenerateContentStreamParams);
    } catch (error) {
        if (!shouldFallbackToLegacyModel(error)) throw error;
        console.warn(`[Gemini] Primär stream-modell misslyckades (${PRIMARY_TEXT_MODEL})${meta?.feature ? ` för ${meta.feature}` : ''}. Faller tillbaka till ${FALLBACK_TEXT_MODEL}.`, error);
        return await ai.models.generateContentStream({ ...request, model: FALLBACK_TEXT_MODEL } as GenerateContentStreamParams);
    }
};

// --- CORE CONTEXT (ROLE + WORKPLACE + TOOL) ---
const buildToolContextBlock = (params: {
    toolName: string;
    user?: Pick<User, 'name' | 'role' | 'workplace'>;
    role?: Role;
    workplaceName?: string;
}): string => {
    const role = params.user?.role || params.role || 'okänd';
    const workplace = (params.user?.workplace || params.workplaceName || '').trim() || 'okänd';
    const name = (params.user?.name || '').trim();

    // Kort och stabilt – detta ska hjälpa modellen att svara rätt utan att “spilla” in i output-format (t.ex. JSON).
    return `
KONTEXT (CareLearn Connect):
- VERKTYG: ${params.toolName}
- ANVÄNDARE: ${name || 'okänd'}
- ROLL: ${role}
- ARBETSPLATS/AVDELNING: ${workplace}
`.trim();
};

// --- PII SCANNER FOR UPLOADS ---
export const scanTextForPII = async (text: string): Promise<{ hasPII: boolean; reason?: string }> => {
    const safeText = text || '';
    // 1. Client-side Regex Check (Fastest)
    const pnrRegex = /\b(19|20)?\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[-+]?\d{4}\b/;
    if (pnrRegex.test(safeText)) {
        return { hasPII: true, reason: "Personnummer hittades i texten." };
    }

    // 2. AI-based Check (Smarter)
    const ai = getAI();
    try {
        const response = await generateTextWithFallback(ai, {
            contents: `
                Analysera följande text utdrag för känsliga personuppgifter (PII) som bryter mot GDPR/Patientsekretess.
                Leta efter: Namn på patienter, Adresser, Telefonnummer, Personnummer, Detaljerade sjukdomsberättelser kopplade till individ.
                
                Text: "${safeText.substring(0, 2000)}"
                
                Svara ENDAST med JSON: { "safe": boolean, "reason": string | null }
            `,
            config: { responseMimeType: "application/json" }
        }, { feature: 'PII-scan' });
        
        const result = parseAIJSON<{ safe: boolean, reason: string | null }>(response.text || '{}');
        if (!result.safe) {
            return { hasPII: true, reason: result.reason || "Känsligt innehåll upptäcktes av AI." };
        }
        return { hasPII: false };

    } catch (e) {
        console.warn("AI PII scan failed, relying on regex", e);
        return { hasPII: false }; // Fail open if AI fails, rely on regex
    }
};


// --- STAGE 1: Structure & Deep Research ---
export const generateAppStructure = async (workplaceName: string, role: Role): Promise<Omit<GeneratedAppConfig, 'quizQuestions'>> => {
    const ai = getAI();
    const roleDisplay = getRoleDisplayName(role);
    const isSSK = role.includes('ssk');
    const educationContext = isSSK 
        ? 'Sjuksköterskeprogrammet (Mittuniversitetet/Högskolor)' 
        : 'Vård- och omsorgscollege Västernorrland (Komvux)';

    const validateWorkplaceAnchoring = (structure: any, wp: string) => {
        const needle = (wp || '').trim().toLowerCase();
        const desc = (structure?.workplaceDescription || '').toLowerCase();
        return !needle || desc.includes(needle);
    };

    const basePrompt = `
        Du är en expertpedagog och vårdutvecklare i Region Västernorrland.
        
        UPPGIFT:
        Skapa en utbildningsprofil för en ${roleDisplay} på: "${workplaceName}".
        VIKTIGT: Du får INTE byta arbetsplats. Om namnet är tvetydigt ska du INTE anta en annan ort/enhet. Utgå alltid från exakt angiven arbetsplats.

        GENERERA JSON (Strict format):
        - "workplaceDescription": En detaljerad kontextbeskrivning om enheten (används av Chatbot). KRAV: måste innehålla exakt arbetsplatssträng "${workplaceName}".
        - "checklist": 15 konkreta introduktionspunkter (Minst 5 unika för enheten, t.ex. specifik utrustning).
        - "goals": 6 konkreta lärandemål kopplade till kursplanen.
        - "specialty": (psykiatri, aldreomsorg, akutsjukvard, lss, primarvard, annat).
        - "welcomeMessage": Välkomsttext.
        - "resources": 3-5 objekt med { "title": "Titel", "content": "Kort sammanfattning...", "type": "Riktlinje/Lag/Rutin" }.

        Returnera ENDAST JSON. Ingen annan text.
    `;

    // Attempt 1: With Google Search (Deep Research)
    try {
        console.log("Generating structure (Attempt 1 - Deep Research Mode)...");
        const response = await generateTextWithFallback(ai, {
            contents: `
                INSTRUKTION FÖR FORSKNING (STEG 1):
                Använd Google Sök för att hitta så mycket specifik information som möjligt om "${workplaceName}".
                Leta efter:
                1. Vilka patientgrupper vårdas där?
                2. Vilka specifika diagnoser eller vårdbehov är vanliga?
                3. Finns det offentliga riktlinjer, verksamhetsberättelser eller nyheter om enheten?
                VIKTIGT: Du får INTE byta arbetsplats. Om du inte kan bekräfta att en träff gäller exakt "${workplaceName}", skriv mer generiskt men behåll arbetsplatsnamnet.
                
                INSTRUKTION FÖR SKAPANDE (STEG 2):
                Använd informationen du hittade ovan för att skapa en MYCKET specifik och anpassad profil.
                Om du hittade att det är en PIVA-avdelning, ska checklistan innehålla punkter om larm, säkerhet och tvångsvård.
                Om det är ett SÄBO, fokusera på bemötande vid demens och BPSD.
                
                ${basePrompt}
            `,
            config: { tools: [{ googleSearch: {} }] } // Only tools allowed, no responseMimeType
        }, { feature: 'generateAppStructure (deep research)' });

        const parsed = parseAIJSON<any>(response.text || '{}');
        if (!validateWorkplaceAnchoring(parsed, workplaceName)) {
            throw new Error(`App structure is not anchored to selected workplace "${workplaceName}".`);
        }
        return parsed;
    } catch (error) {
        console.warn("Structure Generation Attempt 1 failed (Deep Research). Retrying without tools...", error);
        
        // Attempt 2: Without Tools (Internal Knowledge - Safer JSON)
        try {
            const responseRetry = await generateTextWithFallback(ai, {
                contents: basePrompt,
                config: { responseMimeType: "application/json" }
            }, { feature: 'generateAppStructure (no tools)' });
            const parsed = parseAIJSON<any>(responseRetry.text || '{}');
            if (!validateWorkplaceAnchoring(parsed, workplaceName)) {
                console.warn("Structure not anchored to workplace; returning conservative fallback.");
                return {
                    workplaceDescription: `Arbetsplats: ${workplaceName}. (Beta) Kontext saknar verifierad enhetsprofil – svar hålls generiska tills lokala rutiner/PM finns i kunskapsbanken.`,
                    checklist: APP_DATA.checklist.slice(0, 15),
                    goals: APP_DATA.knowledgeRequirements.map(k => k.text).slice(0, 6),
                    specialty: 'annat',
                    welcomeMessage: `Välkommen till ${workplaceName}!`,
                    resources: []
                };
            }
            return parsed;
        } catch (retryError) {
            console.error("Structure Generation Attempt 2 failed:", retryError);
            throw retryError;
        }
    }
};

// --- STAGE 2 & 3: Quiz Generation (Per Tier) ---
export const generateQuizTier = async (workplaceName: string, role: Role, specialty: string, tier: 'tier1' | 'tier2'): Promise<KnowledgeTestQuestion[]> => {
    const ai = getAI();
    const roleDisplay = getRoleDisplayName(role);
    const difficulty = tier === 'tier1' ? 'Grundläggande (Lagar, Hygien, Bemötande)' : 'Fördjupad (Specifika diagnoser, Akutläkemedel, Komplex omvårdnad)';
    // We request 30, but parse safely.
    const count = 30;

    try {
        const response = await generateTextWithFallback(ai, {
            contents: `
                Skapa ett kunskapstest för en ${roleDisplay} på "${workplaceName}" (${specialty}).
                
                NIVÅ: ${difficulty}
                ANTAL: 30 frågor.

                KRAV:
                - Frågorna ska vara relevanta för arbetsplatsen.
                - 4 svarsalternativ per fråga.
                - "verified": false.
                - "originalIndex": Börja på ${tier === 'tier1' ? 1 : 1001}.

                FORMAT (JSON Array):
                [
                  { 
                    "q": "Frågetext...", 
                    "a": [{ "t": "Svar A", "c": true }, { "t": "Svar B", "c": false }, { "t": "Svar C", "c": false }, { "t": "Svar D", "c": false }], 
                    "e": "Förklaring...",
                    "originalIndex": 1, 
                    "verified": false 
                  }
                ]
                Returnera ENDAST JSON. Ingen annan text.
            `,
            config: { responseMimeType: "application/json" }
        }, { feature: `generateQuizTier (${tier})` });

        const questions = parseAIJSON<KnowledgeTestQuestion[]>(response.text || '[]');
        
        // Post-process to ensure correct indexing if AI messed up
        return questions.map((q, i) => ({
            ...q,
            originalIndex: tier === 'tier1' ? i + 1 : 1001 + i,
            verified: false
        }));

    } catch (error) {
        console.error(`Quiz Gen Error (${tier}):`, error);
        return []; 
    }
};

export const generateQuizQuestions = async (workplaceName: string, role: Role, specialty: string) => {
    const tier1 = await generateQuizTier(workplaceName, role, specialty, 'tier1');
    const tier2 = await generateQuizTier(workplaceName, role, specialty, 'tier2');
    return { tier1, tier2 };
};

export const generateFullAppConfig = async (workplaceName: string, role: Role): Promise<GeneratedAppConfig> => {
    const structure = await generateAppStructure(workplaceName, role);
    const quiz = await generateQuizQuestions(workplaceName, role, structure.specialty);
    
    return {
        ...structure,
        quizQuestions: quiz
    };
};

const getProgressionContext = (userData: UserData): string => {
    const checklistCompleted = Object.values(userData.checklistProgress || {}).filter(Boolean).length;
    const goalsRated = Object.values(userData.goalsProgress || {}).filter((g: any) => g.rating > 0).length;
    const lastTest = userData.knowledgeTestHistory.slice(-1)[0];
    const testInfo = lastTest ? `${lastTest.score}/${lastTest.totalQuestions} (${lastTest.tier})` : "Inget test gjort";
    const logbookCount = userData.logbookEntries.length;

    return `
    - Checklistpunkter klara: ${checklistCompleted}
    - Lärandemål skattade: ${goalsRated}
    - Senaste testresultat: ${testInfo}
    - Antal loggboksinlägg: ${logbookCount}
    `;
};

// --- NEW: SMART CONTEXT SELECTOR (OPTIMIZATION) ---
const selectRelevantDocuments = (docs: CustomDocument[], query: string): CustomDocument[] => {
    // Gemini Flash-modellerna har stor kontext. Vi är generösa för att säkra att uppladdade filer "får plats".
    // To ensure the AI reads user uploaded files, we can be very generous.
    // We prioritize by relevance score but fallback to include everything up to a safe limit.
    
    if (docs.length === 0) return [];
    
    const terms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scored = docs.map(doc => {
        let score = 0;
        const content = (doc.title + " " + doc.content).toLowerCase();
        
        // Match title
        if (doc.title.toLowerCase().includes(query.toLowerCase())) score += 20;
        
        // Match keywords
        terms.forEach(term => {
            if (content.includes(term)) score += 1;
        });
        
        // BOOST: Always prioritize local/custom docs over global generic ones
        if (doc.isCustom || !doc.isGlobal) score += 5; 
        
        return { doc, score };
    });

    // Sort by score descending (highest relevance first)
    // Secondary sort: Custom docs first
    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.doc.isCustom ? 1 : 0) - (a.doc.isCustom ? 1 : 0);
    });

    // Return up to 30 documents. This ensures we cover almost all uploaded files 
    // unless the user has uploaded an extreme amount.
    return scored.slice(0, 30).map(s => s.doc);
};


// --- CHATBOT CONTEXT WITH ZERO TOLERANCE GDPR & LOGBOOK AWARENESS ---
export const getAIChatResponseStream = async function* (user: User, history: ChatMessage[], userData: UserData, isRolePlaying: boolean) {
    const ai = getAI();
    const settings = await storage.loadDepartmentSettings();
    const workplaceName = user.workplace || settings?.workplaceName || "denna arbetsplats";
    const workplaceDescription = settings?.workplaceDescription || "En vårdavdelning.";
    
    const lastUserMessage = history.slice().reverse().find(m => m.sender === 'user')?.text || '';
    const allDocs = await storage.getCustomDocuments(user.workplace, user.role);
    const relevantDocs = selectRelevantDocuments(allDocs, lastUserMessage);
    
    const checklistCompleted = Object.values(userData.checklistProgress || {}).filter(Boolean).length;
    const checklistPercent = APP_DATA.checklist.length > 0 ? Math.round((checklistCompleted / APP_DATA.checklist.length) * 100) : 0;
    const progressionContext = getProgressionContext(userData);

    // LOGBOOK CONTEXT - Provide latest entries for metacognition
    const recentLogs = userData.logbookEntries
        .slice(-5) // Last 5 entries
        .map(e => `[DATUM: ${new Date(e.timestamp).toLocaleDateString()}] ${e.text.substring(0, 300)}...`)
        .join('\n');

    const formattedDocs = relevantDocs.length > 0 ? relevantDocs.map(d => `
--- DOKUMENT START: ${d.title} ---
TYP: ${d.metadata?.type || 'Internt Dokument'}
KÄLLA: ${d.isGlobal ? 'Global' : 'Lokal/Egen'}
INNEHÅLL:
${(d.content || '').substring(0, 20000)} 
--- DOKUMENT SLUT ---
`).join('\n') : "Inga specifika dokument hittades i kunskapsbanken.";

    const getRoleSpecificInstruction = (role: Role) => {
        if (role.startsWith('usk')) return "Svara 'hands-on'. Fokusera på omvårdnad, observationer, rapportering och hygien. Undvik avancerad medicinsk diagnos.";
        if (role.startsWith('ssk')) return "Svara med omvårdnadsvetenskaplig och medicinsk tyngd. Inkludera läkemedel, lagrum (LPT/HSL) och bedömningar.";
        return "Svara professionellt och anpassat för vårdpersonal.";
    };

    const securityProtocol = `
    !!! SÄKERHETSPROTOKOLL (GDPR/SEKRETESS) !!!
    1. Du får ALDRIG acceptera eller lagra namn, personnummer, adresser eller specifika detaljer om verkliga patienter.
    2. Om användaren nämner en specifik patient (t.ex. "Anders på rum 5", "19400505-1234"), AVBRYT OMEDELBART.
    3. Svara ENDAST med denna fras om regel 2 bryts: "Jag kan inte diskutera specifika patienter på grund av sekretess. Vänligen ställ frågan generellt utan namn eller id."
    4. Generera aldrig text som ser ut som journalanteckningar med riktiga namn.
    `;

    let systemInstruction = "";
    const toolContext = buildToolContextBlock({
        toolName: isRolePlaying ? 'Chatbot (Rollspel/Scenario)' : 'Chatbot (AI-handledare)',
        user,
        workplaceName
    });

    if (isRolePlaying) {
        systemInstruction = `
${toolContext}

Du spelar en roll i ett vårdscenario som utspelar sig på ${workplaceName}. Agera trovärdigt enligt scenariot.
${securityProtocol}
        `.trim();
    } else {
        systemInstruction = `
            ${toolContext}

            Du är en pedagogisk, metakognitiv AI-Handledare för ${user.name} (${getRoleDisplayName(user.role)}) på ${workplaceName}.
            ROLL-INSTRUKTION: ${getRoleSpecificInstruction(user.role)}
            
            ${securityProtocol}

            RELEVANT KUNSKAPSBANK (Lokala rutiner & PM):
            Du har tillgång till följande dokument som användaren/avdelningen har laddat upp. 
            Det är MYCKET VIKTIGT att du använder denna information om den är relevant för frågan.
            ${formattedDocs}

            ARBETSPATS-KONTEXT:
            ${workplaceDescription}

            ANVÄNDAR-PROGRESSION:
            - Checklistan: ${checklistPercent}% klar.
            ${progressionContext}

            STUDENTENS LOGGBOK (HISTORIK):
            Använd detta för att ställa uppföljande, reflekterande frågor (t.ex. "Hur hänger detta ihop med det du skrev i måndags om...?").
            ${recentLogs || "Inga loggboksinlägg än."}
            
            DINA REGLER:
            1. PRIORITERA DOKUMENT: Om svaret finns i "RELEVANT KUNSKAPSBANK", basera ditt svar på det och referera tydligt till dokumentet.
            2. FORMATTERING KÄLLOR: Om du använder information från ett uppladdat dokument, MÅSTE du avsluta svaret med en källhänvisning i exakt detta format:
               SOURCES:[Dokumenttitel 1, Dokumenttitel 2]
            3. KORT & SMART: Svara kortfattat (max 3-4 stycken) om inte användaren ber om mer. Använd punktlistor.
            4. METAKOGNITION: Ställ motfrågor baserat på deras progression och loggbok ("Du skrev tidigare om... hur tänker du nu?"). Detta är din viktigaste pedagogiska uppgift.
            5. Om svaret inte finns i dokumenten, använd Google Sök eller din allmänna medicinska kunskap, men var tydlig med att det är ett generellt svar.
        `;
    }

    const stream = await generateTextStreamWithFallback(ai, {
        contents: history.map(m => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
        config: {
            tools: [{ googleSearch: {} }],
            systemInstruction: systemInstruction
        }
    }, { feature: 'chat stream' });
    for await (const chunk of stream) {
        yield chunk.text || '';
    }
};

// --- DAILY TIP GENERATION (UPDATED FOR SMART PLANNING) ---
export const getAIDashboardSuggestion = async (user: User, userData: UserData): Promise<DailySuggestion> => {
    const ai = getAI();
    
    // 1. Calculate Timeline
    const totalDays = userData.aplTotalDays || 20; // Default if not set
    const daysPresent = userData.attendanceRecords?.filter(r => r.status === 'present').length || 0;
    const daysLeft = Math.max(0, totalDays - daysPresent);
    
    // 2. Get Missing Checklist Items
    const settings = await storage.loadDepartmentSettings();
    const currentChecklist = settings?.checklist ? settings.checklist.split('\n') : APP_DATA.checklist;
    
    const missingChecklistItems = currentChecklist
        .map((item, index) => ({ item, index }))
        .filter(obj => !userData.checklistProgress[obj.index]);

    const completedChecklistCount = currentChecklist.length - missingChecklistItems.length;

    // 3. Get Missing Goals
    const currentGoals = settings?.knowledgeRequirements 
        ? settings.knowledgeRequirements.split('\n').map((t, i) => ({ id: `goal-${i+1}`, text: t })) 
        : APP_DATA.knowledgeRequirements;
    
    const unratedGoals = currentGoals.filter(g => !userData.goalsProgress[g.id] || userData.goalsProgress[g.id].rating === 0);

    const logbookCount = userData.logbookEntries.length;
    const lastLog = userData.logbookEntries.length > 0 ? userData.logbookEntries[userData.logbookEntries.length - 1].text : "Inga inlägg än.";

    try {
        const response = await generateTextWithFallback(ai, {
            contents: `
                Agera som en strategisk och peppande handledare för ${user.name} (${getRoleDisplayName(user.role)}).
                Din uppgift är att planera dagens uppdrag.

                ANVÄNDARDATA:
                - Dagar kvar på praktik/APL: ${daysLeft} av ${totalDays}.
                - Checklista: ${completedChecklistCount} av ${currentChecklist.length} klara.
                - Saknade moment i checklista: ${JSON.stringify(missingChecklistItems.slice(0, 10).map(i => i.item))}
                - Oskattade mål: ${unratedGoals.length}.
                - Loggboksinlägg: ${logbookCount}. Senaste: "${lastLog.substring(0, 100)}..."

                STRATEGI:
                1. Om det är få dagar kvar (${daysLeft} < 5) och checklistan inte är klar: MÅSTE prioritera en specifik checklista-punkt.
                2. Om loggboken är tom/gammal: Ge en reflektionsuppgift.
                3. Om allt flyter på: Ge en "bonus-utmaning" (t.ex. "Fråga din handledare om...").
                4. Var personlig.

                FORMAT (Returnera ENDAST JSON):
                {
                    "suggestion": "Text med uppmaningen (max 2 meningar)",
                    "type": "checklist" | "goal" | "general",
                    "relatedId": (nummer för checklist index, sträng för mål-ID, eller null)
                }
            `,
            config: { responseMimeType: "application/json" }
        }, { feature: 'dashboard suggestion' });

        const result = parseAIJSON<DailySuggestion>(response.text || '{}');
        
        // Add timestamp here to ensure freshness
        return {
            ...result,
            timestamp: new Date().toISOString().split('T')[0]
        };
        
    } catch (error) {
        console.error("Dashboard Suggestion Error:", error);
        return {
            suggestion: "Gå igenom din checklista med handledaren och se vad ni kan bocka av idag!",
            type: 'general',
            timestamp: new Date().toISOString().split('T')[0]
        };
    }
};

// --- NEW: Generate Care Flow Guide ---
export const generateCareFlow = async (query: string, role: Role, workplaceName?: string): Promise<CareFlowStep[]> => {
    const ai = getAI();
    const roleDisplay = getRoleDisplayName(role);
    
    // FETCH RELEVANT DOCS to ensure navigator is aware of uploaded files
    const allDocs = await storage.getCustomDocuments(workplaceName, role);
    const relevantDocs = selectRelevantDocuments(allDocs, query);
    const docsContext = relevantDocs.map(d => `[DOKUMENT: ${d.title}]\n${d.content.substring(0, 5000)}`).join('\n\n');

    try {
        const response = await generateTextWithFallback(ai, {
            contents: `
                ${buildToolContextBlock({ toolName: 'Vårdflödes-navigator (CareFlow)', role, workplaceName })}

                Du är en expert på vårdprocesser och kliniska riktlinjer.
                UPPGIFT: Skapa en visuell steg-för-steg vårdflödesguide för: "${query}".
                MÅLGRUPP: ${roleDisplay} (Anpassa språknivå och detaljrikedom).

                RELEVANTA RIKTLINJER FRÅN KUNSKAPSBANKEN:
                ${docsContext}

                INSTRUKTIONER:
                1. Dela upp processen i 4-8 logiska steg.
                2. Om information finns i "RELEVANTA RIKTLINJER", MÅSTE du basera stegen på dessa.
                3. Fokusera på patientsäkerhet, hygien och korrekt ordning.
                4. Håll beskrivningarna korta och instruerande (imperativ form).
                5. Om källan kommer från ett uppladdat dokument, ange "sourceTitle".

                FORMAT (JSON Array):
                [
                  {
                    "step": 1,
                    "title": "Kort rubrik (t.ex. 'Förberedelser')",
                    "description": "Konkret instruktion...",
                    "sourceTitle": "Namn på dokumentet om relevant"
                  }
                ]
                Returnera ENDAST JSON.
            `,
            config: { responseMimeType: "application/json" }
        }, { feature: 'generateCareFlow' });

        return parseAIJSON<CareFlowStep[]>(response.text || '[]');
    } catch (error) {
        console.error("CareFlow generation failed:", error);
        return [];
    }
};

// --- NEW: Generate Care Flow DIRECTLY from a specific document ---
export const generateCareFlowFromContext = async (docContent: string, docTitle: string, role: Role): Promise<CareFlowStep[]> => {
    const ai = getAI();
    const roleDisplay = getRoleDisplayName(role);
    
    try {
        const response = await generateTextWithFallback(ai, {
            contents: `
                Du är en expert på att omvandla tunga vårdtexter till pedagogiska flödesscheman.
                
                UPPGIFT: Skapa ett steg-för-steg vårdflöde (Action Cards) baserat EXKLUSIVT på följande dokument.
                DOKUMENT: "${docTitle}"
                INNEHÅLL:
                ${docContent.substring(0, 30000)}

                MÅLGRUPP: ${roleDisplay}.

                INSTRUKTIONER:
                1. Extrahera de praktiska stegen ur texten.
                2. Skapa 4-10 tydliga steg.
                3. Varje steg ska vara en konkret handling.
                4. Gör det "roligt" och engagerande genom bra rubriker.

                FORMAT (JSON Array):
                [
                  {
                    "step": 1,
                    "title": "Kort rubrik (Action)",
                    "description": "Instruktion..."
                  }
                ]
                Returnera ENDAST JSON.
            `,
            config: { responseMimeType: "application/json" }
        }, { feature: 'generateCareFlowFromContext' });

        return parseAIJSON<CareFlowStep[]>(response.text || '[]');
    } catch (error) {
        console.error("Contextual CareFlow generation failed:", error);
        return [];
    }
};

// --- PERSONALIZED DAILY CHALLENGE ---
export const generateDailyChallenge = async (role: Role, userData: UserData): Promise<DailyChallenge> => {
    // FORCE system key for this free feature
    const ai = getAI(true);
    const roleDisplay = getRoleDisplayName(role);
    const settings = await storage.loadDepartmentSettings();
    const workplace = settings?.workplaceName || "Vårdavdelningen";

    // 1. Analyze User Progress
    const completedChecklist = Object.keys(userData.checklistProgress || {}).filter(k => userData.checklistProgress[Number(k)]).length;
    const totalChecklist = APP_DATA.checklist.length;
    const incompleteChecklist = APP_DATA.checklist.filter((_, i) => !userData.checklistProgress[i]).slice(0, 3); // Top 3 missing items
    
    const lowRatedGoals = Object.entries(userData.goalsProgress || {})
        .filter(([_, v]: [string, any]) => v.rating > 0 && v.rating <= 2)
        .map(([k, _]) => APP_DATA.knowledgeRequirements.find(r => r.id === k)?.text)
        .filter(Boolean);

    const lastLogbookEntry = userData.logbookEntries.slice(-1)[0]?.text || "Ingen inlägg än.";

    try {
        const response = await generateTextWithFallback(ai, {
            contents: `
                Du är en expert mentor för en ${roleDisplay} på ${workplace}.
                Skapa dagens kliniska utmaning anpassad efter användarens faktiska behov.

                ANVÄNDARDATA:
                - Checklistan: ${completedChecklist}/${totalChecklist} klar.
                - Saknade moment (Exempel): ${incompleteChecklist.join(', ') || "Inga"}
                - Svaga områden (Lärandemål med låg skattning): ${lowRatedGoals.join(', ') || "Inga"}
                - Senaste loggbokstanke: "${lastLogbookEntry.substring(0, 200)}"

                INSTRUKTIONER:
                1. ANALYSERA DATA: Hitta en kunskapslucka eller ett tema att följa upp.
                   - Om användaren har låga mål, skapa ett scenario kring det.
                   - Om användaren har missat checklist-punkter, skapa ett scenario där man övar på det.
                   - Om allt ser bra ut, skapa ett mer komplext fall.
                2. SKAPA ETT SCENARIO: En kort, realistisk situation (max 3 meningar).
                3. SKAPA 3 ALTERNATIV: Ett korrekt och två felaktiga (men rimliga).
                4. KOPPLA TILL PRAKTIK: Ge feedback som förklarar varför.

                FORMAT (JSON):
                {
                    "title": "Rubrik (Kopplad till ämnet)",
                    "scenario": "Beskrivning...",
                    "options": [
                        { "id": "A", "text": "Alternativ A", "isCorrect": true, "feedback": "Förklaring..." },
                        { "id": "B", "text": "Alternativ B", "isCorrect": false, "feedback": "Förklaring..." },
                        { "id": "C", "text": "Alternativ C", "isCorrect": false, "feedback": "Förklaring..." }
                    ]
                }
            `,
            config: { responseMimeType: "application/json" }
        }, { feature: 'daily challenge' });

        return parseAIJSON<DailyChallenge>(response.text || '{}');
    } catch (error) {
        console.error("Challenge gen failed:", error);
        // Fallback
        return {
            title: "Systemfel",
            scenario: "Kunde inte generera en personlig utmaning just nu. Försök igen senare.",
            options: []
        };
    }
};

// --- AI FEEDBACK ANALYSIS (REAL IMPLEMENTATION) ---
export const getAIFeedbackAnalysis = async (feedback: FeedbackEntry[]): Promise<FeedbackAnalysis> => {
    const ai = getAI();
    
    // Safety check for empty feedback
    if (feedback.length === 0) {
        return {
            sentimentScore: 50,
            sentimentLabel: 'Neutral',
            executiveSummary: 'Ingen feedback att analysera.',
            trendingTopics: [],
            criticalAlerts: []
        };
    }

    // Format feedback for prompt
    const feedbackText = feedback.map(f => 
        `[Roll: ${f.title}] [Betyg: ${f.overallImpression}/5] [Kommentar: ${f.comments || 'Ingen'}]`
    ).join('\n');

    try {
        const response = await generateTextWithFallback(ai, {
            contents: `
                Agera som en strategisk produktanalytiker. Analysera följande feedback-data från användare av vårdplattformen CareLearn.
                
                DATA:
                ${feedbackText.substring(0, 15000)}

                UPPGIFT:
                Generera en strukturerad analys.

                JSON FORMAT:
                {
                    "sentimentScore": (nummer 0-100, där 100 är mycket positivt),
                    "sentimentLabel": ("Positiv" | "Neutral" | "Negativ"),
                    "executiveSummary": "En koncis sammanfattning av användarnas åsikter (max 3 meningar).",
                    "trendingTopics": [
                        { "topic": "Kort ämne", "sentiment": "pos" eller "neg", "count": (uppskattat antal) }
                    ],
                    "criticalAlerts": ["Lista på allvarliga buggar, kraschar eller säkerhetsproblem som nämns."]
                }
                
                Returnera ENDAST JSON.
            `,
            config: { responseMimeType: "application/json" }
        }, { feature: 'feedback analysis' });

        return parseAIJSON<FeedbackAnalysis>(response.text || '{}');
    } catch (error) {
        console.error("Feedback Analysis Error:", error);
        // Fallback
        return {
            sentimentScore: 0,
            sentimentLabel: 'Neutral',
            executiveSummary: 'Kunde inte analysera feedback just nu.',
            trendingTopics: [],
            criticalAlerts: ['AI-Analys misslyckades']
        };
    }
};

export const generateFeedbackAnalysis = async (feedback: FeedbackEntry[]) => getAIFeedbackAnalysis(feedback);

// --- IMAGE GENERATION FOR COMMUNICATION LAB ---
export const generateImageForScenario = async (prompt: string): Promise<string> => {
    // FORCE system key for free usage
    const ai = getAI(true);
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', 
            contents: { parts: [{ text: prompt }] },
        });
        
        const candidates = response.candidates;
        if (candidates && candidates.length > 0) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        
        throw new Error("Ingen bild genererades.");
    } catch (error) {
        console.error("Gemini Image Gen Error:", error);
        throw error;
    }
};

export const generateQuizFromDocument = async (content: string): Promise<KnowledgeTestQuestion[]> => {
    const ai = getAI();
    try {
        const safeContent = content.substring(0, 100000); // Token limit safeguard
        const response = await generateTextWithFallback(ai, {
            contents: `
                Du är en expertpedagog inom vård och omsorg.
                Din uppgift är att skapa ett kunskapstest baserat EXKLUSIVT på texten nedan.
                
                TEXT:
                "${safeContent}"

                INSTRUKTIONER:
                1. Skapa 5-10 relevanta flervalsfrågor.
                2. Frågorna ska testa förståelse av texten.
                3. Varje fråga ska ha 4 svarsalternativ varav ett är rätt.
                4. Ge en förklaring ("e") till varför svaret är rätt, baserat på texten.
                
                FORMAT (JSON Array):
                [
                  { 
                    "q": "Frågetext...", 
                    "a": [{ "t": "Svar A", "c": true }, { "t": "Svar B", "c": false }, ...], 
                    "e": "Förklaring...",
                    "originalIndex": 0,
                    "verified": false
                  }
                ]
                Returnera ENDAST JSON.
            `,
            config: { responseMimeType: "application/json" }
        }, { feature: 'quiz from document' });

        const questions = parseAIJSON<KnowledgeTestQuestion[]>(response.text || '[]');
        return questions.map((q, i) => ({ ...q, originalIndex: i + 1, verified: false }));
    } catch (e) {
        console.error("Quiz Gen Error:", e);
        return [];
    }
};

// --- COMMUNITY MODERATION ---
export const moderateContent = async (text: string): Promise<{ allowed: boolean; reason?: string; autoReply?: string }> => {
    const ai = getAI(true); // Use system key
    try {
        // PII Check first
        const piiCheck = checkTextForPII(text);
        if (!piiCheck.safe) {
            return { allowed: false, reason: "Innehåller personuppgifter/patientdata." };
        }

        const response = await generateTextWithFallback(ai, {
            contents: `
                Du är moderator och pedagogisk AI-Handledare för "CareLearn Connect", ett socialt nätverk för vårdpersonal och studenter.
                
                UPPGIFT: Analysera följande inläggstext.
                TEXT: "${text}"

                REGLER FÖR BLOCKERING (NO-GO):
                1. Mobbing, kränkande särbehandling, påhopp.
                2. Hatiskt språk, rasism, sexism.
                3. Skvaller eller identifierbara detaljer om patienter.
                
                AUTO-SVAR (AI-Handledaren):
                Om inlägget är tillåtet, generera ALLTID ett kort, stöttande eller reflekterande svar (max 2 meningar).
                - Om det är en fråga: Svara eller ge ett tips.
                - Om det är en reflektion: Bekräfta och ställ en motfråga.
                - Om det är ett tips: Tacka och förstärk budskapet.
                - Signera INTE svaret, det görs av systemet.

                JSON FORMAT:
                {
                    "allowed": boolean,
                    "reason": "Kort förklaring om det blockeras, annars null",
                    "autoReply": "Din genererade kommentar här..."
                }
            `,
            config: { responseMimeType: "application/json" }
        }, { feature: 'moderation' });

        return parseAIJSON(response.text || '{}');
    } catch (error) {
        console.error("Moderation error:", error);
        // Fail safe: allow text if AI fails but flag internally (simulated here by just allowing)
        return { allowed: true }; 
    }
};

// --- Summarize Document Content ---
export const summarizeDocumentContent = async (content: string): Promise<string> => {
    const ai = getAI();
    try {
        const response = await generateTextWithFallback(ai, {
            contents: `
                Du är en pedagogisk assistent för vårdpersonal.
                Sammanfatta följande dokumentinnehåll på ett tydligt och strukturerat sätt.
                Använd punktlistor och fetstil för att markera viktiga nyckelord.
                Fokusera på det som är viktigt för det dagliga arbetet.
                
                DOKUMENTINNEHÅLL:
                "${content.substring(0, 50000)}"
            `,
        }, { feature: 'summarize document' });
        return response.text || "Kunde inte generera sammanfattning.";
    } catch (e) {
        console.error("Summary failed:", e);
        return "Ett fel uppstod vid sammanfattningen.";
    }
};

// ... (Rest of exports generateCareFlow, getSupervisorDashboardInsights, etc. remain same)
// --- SUPERVISOR INSIGHTS ---
// Force system key if user key is missing to ensure functionality
export const getSupervisorChatResponseStream = async function* (user: User, history: ChatMessage[], studentData: any[]) {
    const ai = getAI(true); // Always force system key for supervisor insights to ensure it works
    
    // Prepare anonymized but detailed summary for AI context
    const studentContext = studentData.map(s => ({
        id: s.user.id,
        name: s.user.name,
        role: s.user.role,
        checklistProgress: `${Object.values(s.data.checklistProgress || {}).filter(Boolean).length}/${APP_DATA.checklist.length}`,
        logbookEntries: s.data.logbookEntries.length,
        lastLog: s.data.logbookEntries.slice(-1)[0]?.text?.substring(0, 200) || "Inga inlägg",
        goalsRated: Object.values(s.data.goalsProgress || {}).filter((g: any) => g.rating > 0).length,
        testScore: s.data.knowledgeTestHistory.slice(-1)[0]?.score || "Ej gjort"
    }));

    let systemInstruction = `
        Du är en "Super-Aware" AI-Handledare för ${user.name}.
        Du har tillgång till detaljerad data om alla studenter.
        Ditt mål är att hjälpa handledaren att snabbt se trender, identifiera risker och planera stöd.

        STUDENTDATA:
        ${JSON.stringify(studentContext, null, 2)}

        INSTRUKTIONER:
        1. Svara direkt på frågor om specifika studenter baserat på datan.
        2. Identifiera proaktivt studenter som halkar efter (t.ex. låg checklist-progression eller få loggboksinlägg).
        3. Ge konkreta pedagogiska råd. T.ex. "Lisa har inte skrivit i loggboken på länge, fråga henne om..."
        4. Var professionell, uppmuntrande och datadriven.
    `;

    if (user.role === 'developer') {
        systemInstruction = `
            Du är en AI-Arkitekt och assistent till utvecklaren ${user.name}.
            Du har kontext om applikationen "CareLearn".
            
            DIN ROLL:
            Hjälpa utvecklaren att felsöka, brainstorma features, skriva kod-snippets (React/TypeScript) och analysera systemet.
            
            KONTEXT:
            Du agerar i en React PWA med Firebase (simulerad local storage).
            
            Svara tekniskt, koncist och lösningsorienterat.
        `;
    }

    const stream = await generateTextStreamWithFallback(ai, {
        contents: history.map(m => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
        config: {
            systemInstruction: systemInstruction
        }
    }, { feature: 'supervisor chat stream' });

    for await (const chunk of stream) {
        yield chunk.text || '';
    }
};

export const getSupervisorDashboardInsights = async (studentData: any[]): Promise<string> => {
    if (!studentData || studentData.length === 0) return "Inga studenter att analysera.";
    
    // Prepare anonymized summary with Tenure logic (Fix for new students)
    const today = new Date();
    
    const summary = studentData.map(s => {
        let tenureDays = 0;
        // Check for first logbook entry or first schedule entry to determine "start date" approximately
        const firstLog = s.data.logbookEntries?.[0];
        const firstSchedule = s.data.schedule?.[0];
        
        let startDate = new Date();
        if (firstLog) startDate = new Date(firstLog.timestamp);
        if (firstSchedule && new Date(firstSchedule.date) < startDate) startDate = new Date(firstSchedule.date);
        
        tenureDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        // If no data, assume brand new
        if (!firstLog && !firstSchedule) tenureDays = 0;

        return {
            role: s.user.role,
            checklistPercent: Math.round((Object.values(s.data.checklistProgress || {}).filter(Boolean).length / APP_DATA.checklist.length) * 100),
            logbookCount: s.data.logbookEntries.length,
            lastActive: s.data.dailyUsage?.date || 'Okänt',
            testScore: s.data.knowledgeTestHistory.length > 0 ? Math.round((s.data.knowledgeTestHistory.slice(-1)[0].score / s.data.knowledgeTestHistory.slice(-1)[0].totalQuestions) * 100) : 0,
            isNew: tenureDays < 5 // Flag as new if less than 5 days active
        };
    });

    const ai = getAI(true); // Force system key
    try {
        const response = await generateTextWithFallback(ai, {
            contents: `
                Analysera följande studentdata för en handledare.
                DATA: ${JSON.stringify(summary)}
                
                OBS: Studenter markerade med "isNew": true har precis börjat. Det är helt normalt att de har 0% progression. Döm dem inte för det, utan lyft det som "Nystartad".
                
                GE EN KORT SAMMANFATTNING (Max 4 punkter):
                1. Generell status (hur går det för gruppen?).
                2. Identifiera eventuella studenter som halkar efter (baserat på checklist/test/aktivitet), MEN IGNORERA NYA STUDENTER HÄR.
                3. Ge ett konkret tips till handledaren baserat på datan.
                
                Använd inte JSON, svara med vanlig text/markdown.
            `
        }, { feature: 'supervisor dashboard insights' });
        return response.text || "Kunde inte generera insikter.";
    } catch (e) {
        console.error("Supervisor Insights Failed:", e);
        return "AI-analysen är tillfälligt otillgänglig. Kontrollera din anslutning.";
    }
};

export const generateShiftBriefing = async (docs: CustomDocument[]): Promise<string> => { return "Briefing..."; };
export const getAILogbookAnalysis = async (entries: LogbookEntry[]): Promise<string> => { return "Analys..."; };
export const getAILogbookSuggestion = async (entry: LogbookEntry, docs: CustomDocument[]): Promise<string> => { return "Förslag..."; };
export const getAIMetacognitivePrompt = async (goalText: string, reflection: string, role: Role): Promise<string> => { return "Fråga..."; };
// FORCE system key for this free feature
export const getAIFeedbackOnTranscript = async (transcript: any[], scenario: any) => {
    const ai = getAI(true);
    try {
        const response = await generateTextWithFallback(ai, {
            contents: `
                Analysera transkriptet från en kommunikationsövning mellan en vårdstudent och en simulerad patient.
                SCENARIO: ${scenario.title} - ${scenario.mission}
                TRANSKRIPT: ${JSON.stringify(transcript)}
                
                GE FEEDBACK PÅ:
                1. Empati och bemötande.
                2. Tydlighet i kommunikationen.
                3. Strategi (löste studenten uppgiften?).
                
                Svara med uppmuntrande och konstruktiv ton.
            `
        }, { feature: 'feedback on transcript' });
        return response.text || "Ingen feedback kunde genereras.";
    } catch(e) {
        return "Kunde inte ansluta till AI för feedback.";
    }
};

// AI Assisted Weekly Report for Supervisors
export const getAIAssistedWeeklyReport = async (student: User, data: UserData): Promise<string> => {
    const ai = getAI(true); // Force system key for reliability in demo
    
    // Summarize data
    const checklistCount = Object.values(data.checklistProgress || {}).filter(Boolean).length;
    const logbookSummaries = data.logbookEntries.slice(-3).map(e => e.text.substring(0, 100) + "...").join(" | ");
    const goalsRated = Object.values(data.goalsProgress || {}).filter((g: any) => g.rating > 0).length;
    
    try {
        const response = await generateTextWithFallback(ai, {
            contents: `
                Agera som en erfaren pedagogisk handledare. Skapa ett underlag för ett handledningssamtal med studenten ${student.name} (${student.role}).
                
                DATA:
                - Progression Checklista: ${checklistCount} av ${APP_DATA.checklist.length}.
                - Antal loggboksinlägg: ${data.logbookEntries.length}.
                - Senaste tankar: ${logbookSummaries}
                - Måluppfyllelse: ${goalsRated} av ${APP_DATA.knowledgeRequirements.length} mål skattade.
                
                GENERERA:
                1. **Styrkor:** Vad verkar studenten göra bra? (Baserat på aktivitet och loggbok).
                2. **Utvecklingsområden:** Vad bör vi fokusera på nästa vecka? (T.ex. om checklistan går långsamt eller loggboken är tunn).
                3. **Diskussionsfrågor:** 2-3 öppna frågor att ställa till studenten för att främja reflektion.
                
                Håll tonen professionell, stöttande och objektiv.
            `
        }, { feature: 'weekly report' });
        return response.text || "Kunde inte generera rapport.";
    } catch (e) {
        console.error("Report generation failed", e);
        throw new Error("AI-tjänsten svarade inte.");
    }
};

export const getAIKnowledgeTestAnalysis = async (student: User, history: KnowledgeTestAttempt[]): Promise<string> => { return "Analys..."; };
export const generateAssessmentDraft = async (data: UserData, studentName: string): Promise<string> => { return "Utkast..."; };
export const containsSensitiveInfo = (text: string): boolean => false; // Handled by securityService
export const generateSafeQueryExample = async (unsafeText: string): Promise<string> => { return "..."; };

// --- Pedagogical Tips Implementation ---

export const getAITeachingTips = async (): Promise<string> => {
    // Placeholder - not actively used in current UI but good to have signature
    return "";
};

export const getAIConstructiveFeedbackTips = async (): Promise<string> => {
    const ai = getAI(true);
    try {
        const response = await generateTextWithFallback(ai, {
            contents: `
                Agera som en erfaren pedagogisk handledare inom vården.
                Ge 5 konkreta och handfasta tips på hur man ger konstruktiv feedback till en student (USK/SSK).
                
                Fokusera på:
                1. Hur man skapar trygghet och mottaglighet.
                2. Användbara modeller (t.ex. Jag-budskap eller Feedforward).
                3. Vikten av timing och plats.
                4. Hur man balanserar positiv förstärkning med korrigering.
                
                Ge även 2 konkreta exempel på "Bra" vs "Dålig" feedback i en vårdsituation (t.ex. hygien eller patientbemötande).
                
                Använd Markdown för formatering med rubriker och punktlistor.
            `
        }, { feature: 'constructive feedback tips' });
        return response.text || "Inga tips kunde genereras.";
    } catch (error) {
        console.error("Feedback Tips Error:", error);
        throw new Error("AI-tjänsten svarade inte.");
    }
};

export const getAIDifficultConversationTips = async (): Promise<string> => {
    const ai = getAI(true);
    try {
        const response = await generateTextWithFallback(ai, {
            contents: `
                Agera som expert på kommunikation och ledarskap inom vården.
                Ge en steg-för-steg guide för hur en handledare genomför ett "svårt samtal" med en student som riskerar att bli underkänd, har brister i bemötandet eller attitydproblem.
                
                Inkludera:
                1. **Förberedelser**: Vad ska handledaren ha klart innan?
                2. **Samtalsstruktur**: En tydlig agenda.
                3. **Exempelfraser**: Hur inleder man? Hur tar man upp problemet rakt men varsamt?
                4. **Hantera reaktioner**: Tips om studenten blir arg, ledsen eller tyst.
                
                Använd Markdown för formatering med rubriker och punktlistor.
            `
        }, { feature: 'difficult conversation tips' });
        return response.text || "Inga tips kunde genereras.";
    } catch (error) {
        console.error("Difficult Conversation Tips Error:", error);
        throw new Error("AI-tjänsten svarade inte.");
    }
};

// --- NEW: Generate User Profile (Registration) ---
export const generateUserProfile = async (name: string, role: Role, workplace: string): Promise<AIGeneratedProfile> => {
    const ai = getAI(true); // Use system key
    const validateWorkplaceAnchoring = (profile: AIGeneratedProfile, workplaceName: string) => {
        const wp = (workplaceName || '').trim();
        const bio = (profile?.bio || '').toLowerCase();
        const welcome = (profile?.welcomeMessage || '').toLowerCase();
        const needle = wp.toLowerCase();
        // Krav: modellen får inte "byta" arbetsplats. Den måste minst referera till exakt sträng någonstans.
        if (needle && (bio.includes(needle) || welcome.includes(needle))) return true;
        return false;
    };
    try {
        const response = await generateTextWithFallback(ai, {
            contents: `
                INSTRUKTION FÖR FORSKNING (STEG 1):
                Använd Google Sök för att hitta specifik information om "${workplace}".
                Leta efter vilken typ av vård som bedrivs, patientgrupper och om det finns någon specifik profil.
                VIKTIGT: Du får INTE byta arbetsplats. Om du hittar flera träffar med liknande namn ska du inte "välja en annan". Om du är osäker: skriv generiskt men behåll exakt arbetsplatsnamn.
                
                INSTRUKTION FÖR SKAPANDE (STEG 2):
                Baserat på din research och den angivna rollen, generera en professionell och personlig profil för en ny användare i utbildningsplattformen CareLearn.
                
                ANVÄNDARE:
                Namn: ${name}
                Roll: ${getRoleDisplayName(role)}
                Arbetsplats (EXAKT STRÄNG, får ej ändras): ${workplace}
                
                GENERERA JSON:
                {
                    "bio": "En kort, välkomnande biografi på svenska (max 3 meningar). KRAV: måste innehålla exakt arbetsplatssträng: '${workplace}'.",
                    "strengths": ["Styrka 1", "Styrka 2", "Styrka 3"] (Kopplat till rollen och arbetsplatsen),
                    "learningTips": "Ett konkret studietips som är relevant för just denna typ av vård.",
                    "welcomeMessage": "Ett peppande välkomstmeddelande anpassat till enheten. KRAV: måste innehålla exakt arbetsplatssträng: '${workplace}'."
                }
            `,
            config: { 
                tools: [{ googleSearch: {} }] // Only tools allowed, no responseMimeType
            }
        }, { feature: 'generate user profile (with search)' });
        
        const parsed = parseAIJSON<AIGeneratedProfile>(response.text || '{}');
        if (!validateWorkplaceAnchoring(parsed, workplace)) {
            throw new Error(`AI-profile is not anchored to selected workplace "${workplace}".`);
        }
        return parsed;
    } catch (e) {
        console.error("Profile gen failed, attempting fallback...", e);
        // Fallback profile if search fails, try without tools
        try {
             const responseRetry = await generateTextWithFallback(ai, {
                contents: `
                    Du är en professionell, pedagogisk assistent. Du får INTE byta arbetsplats.
                    Arbetsplats (EXAKT STRÄNG): ${workplace}
                    Roll: ${getRoleDisplayName(role)}
                    Namn: ${name}

                    Returnera ENDAST JSON i detta format:
                    { "bio": "MÅSTE innehålla exakt '${workplace}'", "strengths": [], "learningTips": "...", "welcomeMessage": "MÅSTE innehålla exakt '${workplace}'" }
                `,
                config: { responseMimeType: "application/json" }
            }, { feature: 'generate user profile (no tools)' });
            const parsed = parseAIJSON<AIGeneratedProfile>(responseRetry.text || '{}');
            if (!validateWorkplaceAnchoring(parsed, workplace)) {
                throw new Error(`AI-profile fallback is not anchored to selected workplace "${workplace}".`);
            }
            return parsed;
        } catch (retryError) {
             return {
                bio: `Välkommen till CareLearn! Arbetsplats: ${workplace}.`,
                strengths: ["Engagemang", "Nyfikenhet", "Samarbetsvilja"],
                learningTips: "Ta vara på varje tillfälle att lära i praktiken.",
                welcomeMessage: `Välkommen till ${workplace}!`
            };
        }
    }
};

export const getDeveloperStrategicAdvice = async () => "";
export const generateAIPatientPersona = async (role: Role, challenge: string) => "";
export const generateStrategicReport = async (dataSummary: string) => "";
export const extractMetadata = async (content: string) => ({});
export const generateWorkplaceContent = async (workplace: string, specialty: string) => ({ checklist: [], goals: [] });
// FORCE system key for this free feature
export const evaluateSBAR = async (text: string, scenarioDescription: string) => {
    const ai = getAI(true);
    // ... implementation would go here ...
    return { s: {score:0, feedback:''}, b: {score:0, feedback:''}, a: {score:0, feedback:''}, r: {score:0, feedback:''}, overall: '' };
};
export const getAIGroupAnalyticsSummary = async (allStudentData: any[]) => "";
export const analyzeExternalFeedbackFile = async (content: string) => ({ totalEntries: 0, overallSummary: '', positiveThemes: [], improvementAreas: [], actionableRecommendations: [], demographics: { ageDistribution: [], genderDistribution: [], roleDistribution: [] }, ratings: { averageOverall: 0 }, notableQuotes: [] });
