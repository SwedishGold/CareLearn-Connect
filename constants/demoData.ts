import { UserData } from '../types';

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const twoDaysAgo = new Date(today);
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
const lastWeek = new Date(today);
lastWeek.setDate(lastWeek.getDate() - 5);

export const DEMO_USER_DATA: UserData = {
    checklistProgress: {
        0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: false, 8: false, 9: true
    },
    goalsProgress: {
        'goal1': { rating: 4, reflection: "Jag känner mig trygg med handhygienen nu. Har övat med fluorescerande medel." },
        'goal2': { rating: 3, reflection: "Sekretess är svårt när anhöriga ringer och är oroliga. Jag bad min handledare om råd." },
        'goal3': { rating: 5, reflection: "Fick beröm av min handledare för mitt bemötande av en orolig patient." },
        'goal4': { rating: 2, reflection: "Behöver läsa på mer om skillnaden mellan LPT §4 och §11." },
        'goal5': { rating: 4, reflection: "Har tagit NEWS-kontroller på 5 patienter idag och dokumenterat korrekt." }
    },
    logbookEntries: [
        {
            timestamp: today,
            text: "Idag var det en stressig morgon på PIVA. Vi fick in två akutfall samtidigt. Jag fick hjälpa till att duka fram vätska och hålla koll på en annan patient i dagrummet. Det var lärorikt att se hur lugna personalen var trots stressen.",
            type: 'standard',
            aiSuggestion: "Bra observation! Hur påverkade personalens lugn patienterna i dagrummet? Vad kan du ta med dig av deras kroppsspråk?"
        },
        {
            timestamp: yesterday,
            text: "Incidentanalys: En patient blev utåtagerande vid medicinutdelningen.",
            type: 'incident',
            incident: {
                situation: "Patient X vägrade ta sin medicin och kastade muggen i golvet.",
                thoughtsAndFeelings: "Jag blev rädd först, men försökte backa undan.",
                actions: "Jag larmade inte direkt utan hämtade min handledare. Vi pratade lugnt med patienten.",
                outcomes: "Patienten lugnade sig och tog medicinen efter en stund.",
                analysis: "Jag borde kanske ha larmat för säkerhets skull, men det löste sig bra."
            },
            comments: [
                { authorId: 'supervisor', authorName: 'Maria (Handledare)', text: 'Snyggt hanterat! Din bedömning att hämta mig var helt rätt i det läget.', timestamp: new Date() }
            ]
        },
        {
            timestamp: twoDaysAgo,
            text: "Fick vara med på ronden idag. Det var svårt att hänga med i alla termer, men jag frågade om 'bältesläggning' efteråt.",
            type: 'standard'
        }
    ],
    knowledgeTestHistory: [
        {
            timestamp: lastWeek,
            score: 28,
            totalQuestions: 30,
            answers: [], 
            tier: 'tier1'
        }
    ],
    knowledgeTestInProgress: null,
    chatHistory: [
        { id: '1', sender: 'user', text: 'Vad innebär vårdintyg?' },
        { id: '2', sender: 'bot', text: '**Vårdintyg** är ett läkarintyg som utfärdas när en läkare bedömer att en patient lider av en allvarlig psykisk störning och har ett oundgängligt behov av psykiatrisk vård som inte kan tillgodoses frivilligt.\n\nDet är första steget mot tvångsvård enligt **LPT (Lagen om psykiatrisk tvångsvård)**.' }
    ],
    logbookStreak: {
        current: 3,
        longest: 5,
        lastEntryDate: today.toISOString().split('T')[0]
    },
    achievements: ['CHECKLIST_COMPLETE', 'STREAK_3', 'AI_LICENSE_COMPLETE'],
    completedCommunicationScenarios: ['Ledsen och tystlåten patient'],
    dailySimulatorUsage: { date: today.toISOString().split('T')[0], count: 1 },
    unlockedKnowledgeTiers: { usk: 2, ssk: 1 }
};