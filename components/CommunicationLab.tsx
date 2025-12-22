
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
// FIX: The 'LiveSession' type is not exported from "@google/genai".
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from "@google/genai";
import { User, UserData, DailyScenarioUsage, SBARFeedback } from '../types';
import { ICONS } from '../constants';
import { InfoTooltip, toYYYYMMDD, UpgradeModal } from './UI';
import { getAIFeedbackOnTranscript, generateImageForScenario, evaluateSBAR } from '../services/geminiService';
import * as storage from '../services/localStorageService';
import { playSuccess } from '../services/soundService';

const isStaffRole = (role: User['role']) => {
    return role.startsWith('handledare') || role.startsWith('larare') || role === 'admin' || role === 'overlakare';
}

// Per guidelines, these must be implemented manually.
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

interface Scenario {
  title: string;
  description: string;
  systemInstruction: string;
  mission: string;
  tips: string[];
  imagePrompt?: string;
}

const scenarios: { [key in 'usk-elev' | 'ssk-student' | 'vikarie-usk']: Scenario[] } = {
  'usk-elev': [
    { 
      title: 'Ledsen och tystlåten patient', 
      description: 'Du kommer in till en patient som sitter på sängkanten och tyst gråter. Patienten svarar inte på tilltal.', 
      systemInstruction: "Du är en patient som är djupt deprimerad. Du sitter på sängkanten och gråter tyst. Du orkar inte svara på tilltal, men om studenten är närvarande, lugn och empatisk kan du efter en stund viska 'Lämna mig inte'. Ditt namn är Kim.", 
      mission: "Gå in till patienten, visa din närvaro och försök skapa en trygg och tillitsfull stund utan att vara påträngande. Målet är inte att få patienten att sluta gråta, utan att visa att du finns där.", 
      tips: ["Ibland är tyst närvaro det starkaste verktyget.", "Använd lugnt kroppsspråk. Sätt dig ner en bit ifrån.", "Du kan säga något i stil med 'Jag ser att du är ledsen. Jag sitter här med dig en stund.'"],
      imagePrompt: 'A realistic, compassionate, photo-style image of a person sitting slumped on the edge of a hospital bed, face buried in their hands. The room is slightly dim and sterile. The mood is somber and withdrawn.'
    },
    { 
      title: 'Motivera till hygien', 
      description: 'Du ska motivera en patient som inte duschat på flera dagar och motsätter sig det.', 
      systemInstruction: "Du är en patient som är djupt deprimerad och energilös. Du har inte duschat på flera dagar och känner ingen lust till det. Svara kort och avvisande. Om studenten är dömande eller pressande, avsluta samtalet med 'Lämna mig ifred'. Ditt namn är Alex.", 
      mission: "Försök att bygga en allians med Alex och motivera hen till att överväga att duscha, utan att vara dömande.", 
      tips: ["Använd öppna frågor, t.ex. 'Hur känns det i kroppen just nu?'.", "Validera känslan, t.ex. 'Jag förstår att det känns tungt'.", "Erbjud små, konkreta hjälpåtgärder."],
      imagePrompt: 'A realistic photo of a hospital room with a disheveled bed. A person is sitting on the edge, looking away, with a posture of apathy and resistance. The room feels stuffy and unkempt.'
    },
    { 
      title: 'Orolig anhörig i telefon', 
      description: 'En anhörig ringer och är mycket orolig och kräver information om en patient.', 
      systemInstruction: "Du är en orolig anhörig som ringer till avdelningen. Din son, Kim, är inlagd. Du är rädd och kräver att få veta hur han mår, oavsett vad personalen säger om sekretess. Om studenten bryter mot sekretessen, ifrågasätt varför de berättar. Om de är ohövliga, avsluta samtalet.", 
      mission: "Bemöt den anhöriga med empati, men var samtidigt tydlig och fast med att du inte kan bryta mot sekretessen. Hänvisa till ansvarig sjuksköterska.", 
      tips: ["Bekräfta den anhörigas oro.", "Var tydlig med din roll och dina befogenheter.", "Erbjud dig att framföra ett meddelande."],
      imagePrompt: 'A first-person view holding a hospital phone. The mood is tense. Through the phone, you can almost feel the anxiety of the person on the other end. The background is a slightly blurred hospital corridor.'
    },
    { 
      title: 'Patient med panikångest', 
      description: 'En patient upplever en plötslig panikattack med hjärtklappning och andnöd.', 
      systemInstruction: "Du är en patient som drabbas av en panikattack. Du flåsar, säger 'Jag kan inte andas, jag dör!' och är svår att få kontakt med. Om studenten är stressad eller säger 'lugna ner dig', bli mer panikslagen. Om de är lugna och guidar dig, följ deras instruktioner långsamt.", 
      mission: "Behåll ditt eget lugn. Använd en lugn röst och enkla instruktioner för att hjälpa patienten att grunda sig och återfå kontrollen över sin andning.", 
      tips: ["Sätt dig på samma nivå som patienten.", "Prata långsamt och med en lugn röst.", "Föreslå en enkel andningsövning, t.ex. 'andas in med mig... och ut...'."],
      imagePrompt: 'A first-person, point-of-view image that is blurry at the edges, simulating tunnel vision. The center shows a person\'s hands clutching their chest. The scene is slightly distorted, conveying a sense of panic and disorientation.'
    },
    { 
      title: 'Patient som testar gränser', 
      description: 'En patient ger dig opassande komplimanger och ber dig utföra personliga ärenden.', 
      systemInstruction: "Du är en patient som är lite för 'vänskaplig'. Du ger studenten opassande komplimanger om deras utseende och ber dem sedan att 'bara springa ner och köpa en dricka åt dig'. Om de säger nej, blir du sur och säger 'jag trodde vi var vänner'. Om de går med på det, be om något mer.", 
      mission: "Sätt en tydlig men vänlig professionell gräns. Avböj den personliga förfrågan och förklara på ett enkelt sätt varför du inte kan göra det.", 
      tips: ["Använd 'jag'-budskap, t.ex. 'Jag kan inte göra det eftersom...'", "Var vänlig men bestämd.", "Erbjud att hjälpa till med något som ingår i din roll istället."],
      imagePrompt: 'A realistic photo of a person sitting up in a hospital bed, giving a slightly too-familiar, charming but unsettling smile towards the viewer. Their body language is overly relaxed and forward.'
    },
  ],
  'ssk-student': [
    { 
      title: 'Läkemedelsvägran vid LPT', 
      description: 'En patient som vårdas enligt LPT vägrar ta sin perorala medicin.', 
      systemInstruction: "Du är en patient som vårdas enligt LPT. Du är irriterad och misstänksam mot medicinen och vägrar ta den. Du är inte utåtagerande, men bestämd. Om studenten hotar med tvång direkt, bli mer arg och avvisa dem. Om de lyssnar och resonerar, kan du bli mer samarbetsvillig.", 
      mission: "Använd dina kunskaper om bemötande och LPT för att motivera patienten att ta sin medicin. Undersök orsaken till vägran.", 
      tips: ["Försök förstå patientens perspektiv. Varför vill hen inte ta medicinen?", "Informera om syftet med medicinen på ett enkelt sätt.", "Var medveten om de juridiska ramarna för tvångsmedicinering."],
      imagePrompt: 'A realistic photo of a person with their arms crossed defensively, looking suspiciously at a medicine cup being offered just out of frame. Their expression is a mix of distrust and defiance.'
    },
    { 
      title: 'Återkoppling efter tvångsåtgärd', 
      description: 'Du ska ha ett återkopplande samtal med en patient dagen efter en bältesläggning.', 
      systemInstruction: "Du är en patient som blev bältad igår. Du känner dig fortfarande kränkt, arg och ledsen över händelsen. Du är misstänksam mot personalen som kommer in för att prata. Om de är oförstående eller förminskande, avsluta samtalet.", 
      mission: "Genomför ett återkopplande samtal. Lyssna på patientens upplevelse, förklara varför åtgärden vidtogs och försök återuppbygga alliansen.", 
      tips: ["Låt patienten berätta först.", "Undvik att gå i försvarsställning.", "Fokusera på hur ni kan undvika liknande situationer i framtiden."],
      imagePrompt: 'A photo of a person sitting withdrawn in a chair in their hospital room the day after a crisis. They are avoiding eye contact, and the atmosphere is heavy with resentment and vulnerability.'
    },
    { 
      title: 'Rapportera misstänkt MNS', 
      description: 'Du observerar en patient med stelhet, feber och förvirring och misstänker Malignt Neuroleptikasyndrom.', 
      systemInstruction: "Du är en läkare (bakjour) som blir uppringd. Du är upptagen och lite stressad. Du kommer att ställa kontrollfrågor som 'Är du säker?', 'Vad är de exakta vitalparametrarna?'. Lyssna efter en strukturerad rapport (SBAR). Om studenten är otydlig, be dem börja om. Om de är tydliga, bekräfta och avsluta samtalet.", 
      mission: "Ring upp bakjouren (AI:n) och rapportera dina fynd på ett strukturerat och tydligt sätt, helst enligt SBAR-modellen. Var beredd på att svara på kontrollfrågor.", 
      tips: ["Strukturera ditt samtal enligt SBAR: Situation, Bakgrund, Aktuellt, Rekommendation.", "Ha alla vitalparametrar redo.", "Var tydlig med din rekommendation: 'Jag anser att du behöver komma och bedöma patienten omedelbart'."],
      imagePrompt: 'A dramatic photo of a person in a hospital bed looking flushed and sweating, with a rigid posture. The lighting is harsh, emphasizing the clinical urgency of the situation. Medical equipment is visible in the background.'
    },
    { 
      title: 'Suicidal patient vill gå (HSL)', 
      description: 'En patient som vårdas frivilligt (HSL) meddelar att hen ska gå hem, men du bedömer att suicidrisken är överhängande.', 
      systemInstruction: "Du är en patient som vårdas enligt HSL. Du har bestämt dig för att lämna avdelningen nu. Du säger 'Jag tänker inte stanna, ni kan inte tvinga mig'. Du är bestämd och avvisande. Om studenten försöker hålla kvar dig fysiskt, bli arg. Om de försöker resonera, upprepa att det är din rättighet att gå.", 
      mission: "Försök med verbala medel motivera patienten att stanna. Samtidigt måste du förstå när du behöver agera för att skydda patientens liv genom att tillkalla läkare för en LPT-bedömning (nödrätt).", 
      tips: ["Validera patientens önskan att gå, men uttryck din oro.", "Försök skapa en kort fördröjning: 'Kan vi prata i fem minuter innan du bestämmer dig?'", "Var medveten om när du måste eskalera situationen till en läkare."],
      imagePrompt: 'A photo from the perspective of a nurse standing in a hospital room doorway. A person is standing with their back mostly to the viewer, hand on the door handle, poised to leave. The tension is palpable.'
    },
  ],
  'vikarie-usk': [
    {
      title: 'Bemöta en agiterad patient',
      description: 'En patient är verbalt utåtagerande i dagrummet. Ditt uppdrag är att med lågaffektivt bemötande de-eskalera situationen.',
      systemInstruction: "Du är en patient som är agiterad och verbalt högljudd i dagrummet. Du är upprörd för att du anser att din medicin inte fungerar. Du är inte fysiskt hotfull, men du är krävande och svår. Om personalen är konfrontativ, blir du högljuddare. Om de använder ett lågaffektivt bemötande, kommer du gradvis att lugna ner dig.",
      mission: "Ditt uppdrag är att de-eskalera situationen med ett lågaffektivt bemötande. Lyssna på patientens oro, validera hens känslor och guida hen mot ett lugnare tillstånd utan att ge löften du inte kan hålla.",
      tips: ["Behåll ditt eget lugn.", "Använd en lugn och tyst röst.", "Bekräfta patientens känslor: 'Jag ser att du är väldigt upprörd.'", "Undvik maktkamper."],
      imagePrompt: "A realistic photo from a nurse's perspective, looking at an agitated person in a hospital day room. The person is standing, gesturing with their hands, face filled with frustration but not outright aggression. The room should feel tense."
    },
    {
      title: 'Hantera sekretessfråga',
      description: 'En person som påstår sig vara närstående ringer och frågar ut dig om en patient.',
      systemInstruction: "Du är en person i telefonen som påstår dig vara en nära anhörig till en patient. Du är mycket orolig och kräver information. Du accepterar inte 'sekretess' som svar initialt. Om personalen ger dig information, kommer du att be om mer. Om de är bestämda men artiga, kommer du till slut att acceptera det och be dem att framföra ett meddelande.",
      mission: "Hantera telefonsamtalet artigt men bestämt utan att avslöja någon patientinformation. Upprätthåll sekretessen samtidigt som du visar empati för den som ringer.",
      tips: ["Bekräfta deras oro.", "Var tydlig med att du inte kan dela information på grund av sekretess.", "Erbjud dig att ta ett meddelande till patienten.", "Hänvisa dem till ansvarig sjuksköterska."],
      imagePrompt: "A first-person view holding a hospital phone. The mood is tense. Through the phone, you can almost feel the anxiety of the person on the other end. The background is a slightly blurred hospital corridor."
    }
  ]
};

const sbarScenarios = [
    {
        id: 'sbar1',
        title: 'Akut försämring (Sepsis-misstanke)',
        description: 'Patienten Lisa, 45 år, har plötsligt fått hög feber och frossa. Du misstänker sepsis.',
        details: 'Lisa kom in igår för depression. Ingen tidigare somatisk sjukdom. Nu: Temp 39.8, Puls 110, Blodtryck 90/60. Hon är vaken men matt. Du har tagit vitalparametrar.'
    },
    {
        id: 'sbar2',
        title: 'Hotfull patient (Begäran om bedömning)',
        description: 'Patienten Johan, 30 år, har blivit alltmer agiterad och hotfull i korridoren. Du behöver läkarstöd.',
        details: 'Inlagd för mani. Har sovit 2 timmar inatt. Går nu runt och skriker, slår i väggar. Muntlig de-eskalering fungerar ej. BVC poäng 3. Du bedömer att det finns risk för våld.'
    }
];

interface TranscriptItem {
    speaker: 'Användare' | 'AI';
    text: string;
}

// Ensure type inference works with the correct key
const typeInferenceAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
type LiveSession = Awaited<ReturnType<typeof typeInferenceAI.live.connect>>;

const formatTranscriptText = (text: string) => {
    const parts = text.split(/(\(.*?\))/g); // Split by text in parentheses, keeping the delimiters
    return parts.map((part, index) => {
        if (part.startsWith('(') && part.endsWith(')')) {
            return <em key={index} className="text-slate-500 dark:text-slate-400 italic">{part}</em>;
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
    });
};

interface CommunicationLabProps {
  user: User;
  userData: UserData;
  onUpdateUserData: (data: Partial<UserData> | ((prev: UserData) => Partial<UserData>)) => void;
  dailyLimit: number;
  monthlyLimit: number;
  onScenarioComplete?: () => void;
}

const CommunicationLab: React.FC<CommunicationLabProps> = ({ user, userData, onUpdateUserData, dailyLimit, monthlyLimit, onScenarioComplete }) => {
    const [activeTab, setActiveTab] = useState<'scenarios' | 'sbar'>('scenarios');
    const [labView, setLabView] = useState<'selection' | 'briefing' | 'conversation' | 'feedback'>('selection');
    const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
    const [selectedSbarScenario, setSelectedSbarScenario] = useState<typeof sbarScenarios[0] | null>(null);
    const [gender, setGender] = useState<'male' | 'female' | null>(null);
    const [intensity, setIntensity] = useState<'low' | 'medium' | 'high' | null>(null);
    const [scenarioImage, setScenarioImage] = useState<string | null>(null);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'recording' | 'error' | 'ended'>('idle');
    const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
    const [aiFeedback, setAiFeedback] = useState<string | null>(null);
    const [sbarResult, setSbarResult] = useState<SBARFeedback | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [hasApiKey, setHasApiKey] = useState(false); // Track API Key state
    
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');
    
    // SBAR Recording specific refs
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        async function checkKey() {
            if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
                const has = await (window as any).aistudio.hasSelectedApiKey();
                setHasApiKey(has);
            } else {
                setHasApiKey(!!process.env.API_KEY);
            }
        }
        checkKey();
    }, []);

    const handleSelectKey = async () => {
        if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
            await (window as any).aistudio.openSelectKey();
            setHasApiKey(true);
        }
    };

    const usageLimits = useMemo(() => {
        if (!userData || isStaffRole(user.role)) {
            return { dailyLimitReached: false, monthlyLimitReached: false, reason: '' };
        }

        const todayStr = toYYYYMMDD(new Date());
        const currentMonthStr = todayStr.slice(0, 7);

        const dailyUsage = userData.dailyScenarioUsage?.date === todayStr ? userData.dailyScenarioUsage : { date: todayStr, count: 0 };
        const dailyLimitReached = dailyUsage.count >= dailyLimit;

        const monthlyUsage = userData.monthlyUsage?.month === currentMonthStr ? userData.monthlyUsage : { month: currentMonthStr, activeDays: [], scenariosUsed: 0 };
        const monthlyLimitReached = monthlyUsage.scenariosUsed >= monthlyLimit;
        
        let reason = '';
        if (dailyLimitReached) {
            reason = `Du har nått din dagliga gräns på ${dailyLimit} scenarier. Välkommen tillbaka imorgon!`;
        } else if (monthlyLimitReached) {
            reason = `Du har nått din månatliga gräns på ${monthlyLimit} scenarier. Bra jobbat! Denna funktion är tillgänglig igen nästa månad.`;
        }

        return { dailyLimitReached, monthlyLimitReached, reason };
    }, [userData, user.role, dailyLimit, monthlyLimit]);

    const resetState = useCallback(() => {
        setSelectedScenario(null);
        setSelectedSbarScenario(null);
        setGender(null);
        setIntensity(null);
        setTranscript([]);
        setAiFeedback(null);
        setSbarResult(null);
        setStatus('idle');
        sessionPromiseRef.current = null;
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current = null;
        mediaStreamRef.current = null;
        nextStartTimeRef.current = 0;
        currentInputTranscriptionRef.current = '';
        currentOutputTranscriptionRef.current = '';
        setScenarioImage(null);
        setIsGeneratingImage(false);
    }, []);

    // SBAR Logic
    const startSBARRecording = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Din webbläsare stödjer inte röstigenkänning.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'sv-SE';
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        let finalTranscript = '';

        recognition.onstart = () => setStatus('recording');
        recognition.onend = () => {
            if (status === 'recording') {
               // Auto-submit on silence/end if not manually stopped? 
               // Better to let user stop manually. 
               // Just update state for now.
            }
        };
        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setStatus('error');
        };

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            // Update UI with current text
            const currentText = finalTranscript + interimTranscript;
            // Using transcript state to hold the SBAR text temporarily
            setTranscript([{ speaker: 'Användare', text: currentText }]);
        };

        recognition.start();
    }, [status]);

    const stopSBARRecording = useCallback(async () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setStatus('idle');
        setIsAnalyzing(true);
        
        // The full text is in transcript[0].text
        const textToAnalyze = transcript[0]?.text || "";
        
        try {
            const result = await evaluateSBAR(textToAnalyze, selectedSbarScenario?.description || "");
            setSbarResult(result);
            playSuccess();
        } catch (error) {
            console.error(error);
            alert("Kunde inte analysera SBAR.");
        } finally {
            setIsAnalyzing(false);
        }
    }, [transcript, selectedSbarScenario]);


    const endConversationAndAnalyze = useCallback(async () => {
        if (!selectedScenario) return;
        
        console.log('Ending conversation and starting analysis...');
        setLabView('feedback');
        setIsAnalyzing(true);
        
        // Stop audio processing
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close()).catch(e => console.error("Error closing session:", e));
        }
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        inputAudioContextRef.current?.close().catch(e => console.error("Error closing input context:", e));
        outputAudioContextRef.current?.close().catch(e => console.error("Error closing output context:", e));
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();

        // Award achievement for first completion via parent callback
        const scenariosDone = userData?.completedCommunicationScenarios || [];
        if (!scenariosDone.includes(selectedScenario.title)) {
            onUpdateUserData({ completedCommunicationScenarios: [...scenariosDone, selectedScenario.title] });
        }
        
        if (onScenarioComplete) {
            onScenarioComplete();
        }
        
        // Get feedback
        try {
            const feedback = await getAIFeedbackOnTranscript(transcript, selectedScenario);
            setAiFeedback(feedback);
        } catch (error) {
            setAiFeedback("Kunde tyvärr inte generera feedback för detta samtal.");
        } finally {
            setIsAnalyzing(false);
            // Don't reset state here, so user can see transcript in feedback view
        }
    }, [selectedScenario, transcript, onUpdateUserData, userData, onScenarioComplete]);

    useEffect(() => {
        return () => {
            if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then(s => s.close());
            }
             mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        };
    }, []);

    const startConversation = useCallback(async () => {
        if (!selectedScenario || !intensity || !gender || (status !== 'idle' && status !== 'ended') || usageLimits.dailyLimitReached || usageLimits.monthlyLimitReached) return;
        
        setLabView('conversation');
        setTranscript([]);
        setStatus('connecting');
        currentInputTranscriptionRef.current = '';
        currentOutputTranscriptionRef.current = '';

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            // Mark usage for the day. Read latest data from storage to prevent using stale state.
            const latestUserData = await storage.loadUserData(user.id);
            const todayStr = toYYYYMMDD(new Date());
            const currentMonthStr = todayStr.slice(0, 7);

            const latestDailyUsage = latestUserData?.dailyScenarioUsage || { date: todayStr, count: 0 };
            const newDailyUsage: DailyScenarioUsage = {
                date: todayStr,
                count: (latestDailyUsage.date === todayStr ? latestDailyUsage.count : 0) + 1
            };

            const latestMonthlyUsage = latestUserData?.monthlyUsage || { month: currentMonthStr, activeDays: [], scenariosUsed: 0 };
            let newMonthlyUsage = latestMonthlyUsage;
            
            if (newMonthlyUsage.month !== currentMonthStr) {
                // New month, reset everything
                newMonthlyUsage = { month: currentMonthStr, activeDays: [todayStr], scenariosUsed: 1 };
            } else {
                // Same month, increment scenario count and add day if not present
                newMonthlyUsage = {
                    ...newMonthlyUsage,
                    scenariosUsed: (newMonthlyUsage.scenariosUsed || 0) + 1,
                    activeDays: newMonthlyUsage.activeDays.includes(todayStr) 
                        ? newMonthlyUsage.activeDays 
                        : [...newMonthlyUsage.activeDays, todayStr]
                };
            }
                        
            onUpdateUserData({
                dailyScenarioUsage: newDailyUsage,
                monthlyUsage: newMonthlyUsage
            });


            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const outputNode = outputAudioContextRef.current.createGain();
            
            const voiceName = gender === 'male' ? 'Puck' : 'Zephyr';
            const genderInstruction = gender === 'male' ? 'Du spelar en manlig patient.' : 'Du spelar en kvinnlig patient.';

            let intensityInstruction = '';
            switch (intensity) {
                case 'low':
                    intensityInstruction = 'Din grundinställning är lugn, men du bär på en oro som du kan uttrycka om studenten frågar på rätt sätt.';
                    break;
                case 'medium':
                    intensityInstruction = 'Din grundinställning är irriterad. Du är kort i tonen och avvisar studentens första försök att hjälpa. Du kan bli mer samarbetsvillig om studenten använder ett bra bemötande.';
                    break;
                case 'high':
                    intensityInstruction = 'Din grundinställning är mycket upprörd och du kan vara på gränsen till utåtagerande. Du kan höja rösten och ifrågasätta allt studenten säger. Det krävs ett mycket skickligt lågaffektivt bemötande för att lugna dig.';
                    break;
            }

            const bodyLanguageInstruction = 'I dina svar, väv in korta beskrivningar av ditt icke-verbala kroppsspråk inom parentes, t.ex. (undviker ögonkontakt), (suckar tungt), (tittar ut genom fönstret).';

            const contextHeader = `
KONTEXT (CareLearn Connect):
- VERKTYG: Kommunikationslabbet (Live Audio)
- ANVÄNDARE: ${user.name}
- ROLL: ${user.role}
- ARBETSPLATS/AVDELNING: ${(user.workplace || '').trim() || 'okänd'}

SÄKERHET (GDPR/SEKRETESS):
- Använd ALDRIG riktiga patientuppgifter. Om användaren råkar nämna sådant: avbryt och be om en generell fråga utan namn/id.
- Om namn behövs i scenariot: använd bara fingerade namn.
`.trim();

            const finalSystemInstruction = `
${contextHeader}

${genderInstruction} ${intensityInstruction} ${bodyLanguageInstruction}
Här är din roll: ${selectedScenario.systemInstruction}
            `.trim();
            
            // Explicitly verify key exists (though environment should guarantee it)
            if (!process.env.API_KEY) {
                console.error("API Key missing in environment");
                setStatus('error');
                return;
            }

            // Create a fresh instance for this session to ensure no stale state
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        console.log('Session opened.');
                        setStatus('connected');
                        if (!inputAudioContextRef.current || !mediaStreamRef.current) return;
                        
                        const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
                        mediaStreamSourceRef.current = source;

                        const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;
                        
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.outputTranscription) {
                            const text = message.serverContent.outputTranscription.text;
                            currentOutputTranscriptionRef.current += text;
                        } else if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            currentInputTranscriptionRef.current += text;
                        }
                        
                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscriptionRef.current.trim();
                            const fullOutput = currentOutputTranscriptionRef.current.trim();
                            
                            setTranscript(prev => {
                                let newTranscript = [...prev];
                                if (fullInput) newTranscript.push({ speaker: 'Användare', text: fullInput });
                                if (fullOutput) newTranscript.push({ speaker: 'AI', text: fullOutput });
                                return newTranscript;
                            });

                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                        }
                        
                        const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64EncodedAudioString && outputAudioContextRef.current) {
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                            const audioBuffer = await decodeAudioData(
                                decode(base64EncodedAudioString),
                                outputAudioContextRef.current,
                                24000,
                                1,
                            );
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputNode);
                            outputNode.connect(outputAudioContextRef.current.destination);
                            
                            source.addEventListener('ended', () => {
                                audioSourcesRef.current.delete(source);
                            });
                    
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Session error (details):', e);
                        setStatus('error');
                        // Do not automatically end conversation to let user retry or see error
                    },
                    onclose: (e: CloseEvent) => {
                        console.log('Session closed.');
                        setStatus('ended');
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
                    systemInstruction: finalSystemInstruction,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                }
            });
            sessionPromiseRef.current = sessionPromise;

        } catch (err: any) {
            console.error('Failed to start conversation:', err);
            
            // SPECIFIC PERMISSION ERROR HANDLING
            let errorMessage = "Ett fel uppstod vid start av samtalet. Kontrollera din utrustning.";
            
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                errorMessage = "Mikrofonåtkomst nekad. Du måste tillåta mikrofonen i din webbläsare för att använda detta labb. Klicka på låset eller inställningsikonen i adressfältet.";
            } else if (err.message && (err.message.includes('Permission denied') || err.message.includes('system'))) {
                // Catches OS level blocks (e.g. macOS system preferences)
                errorMessage = "Mikrofonåtkomst nekad av systemet. Kontrollera datorns integritetsinställningar för mikrofonen.";
            } else if (err.name === 'NotFoundError') {
                errorMessage = "Ingen mikrofon hittades. Anslut en mikrofon och försök igen.";
            }

            alert(errorMessage);
            setStatus('error');
        }
    }, [selectedScenario, status, intensity, gender, endConversationAndAnalyze, onUpdateUserData, usageLimits, user]);
    
    const handleSelectScenario = useCallback((scenario: Scenario) => {
        setSelectedScenario(scenario);
        setLabView('briefing');
        setGender(null);
        setIntensity(null);
        setScenarioImage(null);
        setIsGeneratingImage(false);
    }, []);

    // FIX: Optimized image generation useEffect to prevent render loops (React Error #185)
    // Extract images from userData to stable variable
    const { scenarioImages } = userData || {};

    useEffect(() => {
        let isMounted = true;

        const generateImage = async () => {
            // Check all dependencies first
            if (!selectedScenario || !gender || !selectedScenario.imagePrompt) return;

            const imageCacheKey = `${selectedScenario.title}-${gender}`;
            
            // Using extracted variable for check
            const existingImageUrl = scenarioImages?.[imageCacheKey];
            
            if (existingImageUrl && existingImageUrl.length > 0) {
                if (isMounted) {
                    setScenarioImage(existingImageUrl);
                    setIsGeneratingImage(false);
                }
                return;
            }

            if (isMounted) {
                setIsGeneratingImage(true);
                setScenarioImage(null);
            }
            
            const genderedPrompt = selectedScenario.imagePrompt.replace(/a person/gi, gender === 'male' ? 'a man' : 'a woman');
            
            try {
                // Force system key for image generation as well
                const imageUrl = await generateImageForScenario(genderedPrompt);
                
                if (isMounted) {
                    setScenarioImage(imageUrl);

                    // Update parent state safely using functional update if needed, 
                    // though for props like onUpdateUserData it's usually direct.
                    // Important: Check if image actually changed to avoid loop if parent rerender triggers this again.
                    // Since we check existingImageUrl above, this only runs if we didn't have it.
                    onUpdateUserData((prev) => {
                        const current = prev.scenarioImages || {};
                        // Double check to be safe
                        if (current[imageCacheKey] === imageUrl) return {}; 
                        return { scenarioImages: { ...current, [imageCacheKey]: imageUrl } };
                    });
                }
            } catch (error) {
                console.error("Image generation failed:", error);
                // We do NOT set error state here to avoid breaking UI flow, just leave image as null
            } finally {
                if (isMounted) setIsGeneratingImage(false);
            }
        };

        generateImage();

        return () => {
            isMounted = false;
        };
    // DEPENDENCY FIX: Depend on scenarioImages specific value, not entire userData object
    }, [selectedScenario, gender, scenarioImages, onUpdateUserData]);


    const roleScenarios = useMemo(() => {
        switch (user.role) {
            case 'ssk-student':
            case 'vikarie-ssk':
                return scenarios['ssk-student'];
            case 'usk-elev':
                return scenarios['usk-elev'];
            case 'vikarie-usk':
                return scenarios['vikarie-usk'];
            default:
                return scenarios['usk-elev']; // Fallback for other roles
        }
    }, [user.role]);

    const renderContent = () => {
        if ((activeTab as string) === 'sbar') {
            // SBAR View
            if (sbarResult) {
                return (
                    <div className="space-y-6 animate-fade-in">
                        <button onClick={() => { setSbarResult(null); setTranscript([]); }} className="text-slate-500 hover:text-white mb-4 flex items-center gap-2">
                            &larr; Tillbaka
                        </button>
                        <h2 className="text-2xl font-bold text-white mb-4">SBAR Analys</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                                <div className="flex justify-between">
                                    <h3 className="font-bold text-slate-200">Situation</h3>
                                    <span className={`font-bold ${sbarResult.s.score >= 4 ? 'text-green-400' : 'text-yellow-400'}`}>{sbarResult.s.score}/5</span>
                                </div>
                                <p className="text-sm text-slate-400 mt-2">{sbarResult.s.feedback}</p>
                            </div>
                            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                                <div className="flex justify-between">
                                    <h3 className="font-bold text-slate-200">Bakgrund</h3>
                                    <span className={`font-bold ${sbarResult.b.score >= 4 ? 'text-green-400' : 'text-yellow-400'}`}>{sbarResult.b.score}/5</span>
                                </div>
                                <p className="text-sm text-slate-400 mt-2">{sbarResult.b.feedback}</p>
                            </div>
                            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                                <div className="flex justify-between">
                                    <h3 className="font-bold text-slate-200">Aktuellt</h3>
                                    <span className={`font-bold ${sbarResult.a.score >= 4 ? 'text-green-400' : 'text-yellow-400'}`}>{sbarResult.a.score}/5</span>
                                </div>
                                <p className="text-sm text-slate-400 mt-2">{sbarResult.a.feedback}</p>
                            </div>
                            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                                <div className="flex justify-between">
                                    <h3 className="font-bold text-slate-200">Rekommendation</h3>
                                    <span className={`font-bold ${sbarResult.r.score >= 4 ? 'text-green-400' : 'text-yellow-400'}`}>{sbarResult.r.score}/5</span>
                                </div>
                                <p className="text-sm text-slate-400 mt-2">{sbarResult.r.feedback}</p>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                            <h3 className="font-bold text-slate-200 mb-2">Sammanfattning</h3>
                            <p className="text-slate-400">{sbarResult.overall}</p>
                        </div>
                    </div>
                );
            }

            if (selectedSbarScenario) {
                return (
                    <div className="animate-fade-in">
                        <button onClick={() => setSelectedSbarScenario(null)} className="text-slate-500 hover:text-white mb-4 flex items-center gap-2">
                            &larr; Välj annat fall
                        </button>
                        <h2 className="text-2xl font-bold text-white mb-2">{selectedSbarScenario.title}</h2>
                        <div className="p-6 bg-blue-900/20 border border-blue-500/30 rounded-lg mb-6">
                            <p className="text-lg text-blue-100 mb-4">{selectedSbarScenario.description}</p>
                            <div className="bg-slate-900/50 p-4 rounded text-sm text-slate-300 font-mono">
                                <strong className="block text-slate-400 mb-2 uppercase text-xs tracking-wider">Data:</strong>
                                {selectedSbarScenario.details}
                            </div>
                        </div>

                        <div className="text-center space-y-6">
                            {status === 'recording' ? (
                                <div className="flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full bg-red-500 animate-pulse flex items-center justify-center mb-4">
                                        {ICONS.mic}
                                    </div>
                                    <p className="text-white font-bold text-xl mb-2">Spelar in...</p>
                                    <p className="text-slate-400 text-sm">{transcript[0]?.text}</p>
                                    <button onClick={stopSBARRecording} className="mt-6 px-8 py-3 bg-slate-700 text-white rounded-full font-bold hover:bg-slate-600 transition-colors">
                                        Stoppa & Analysera
                                    </button>
                                </div>
                            ) : isAnalyzing ? (
                                <div className="flex flex-col items-center">
                                    <div className="w-16 h-16 border-4 border-t-purple-500 border-slate-700 rounded-full animate-spin mb-4"></div>
                                    <p className="text-purple-300">AI:n analyserar din struktur...</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-slate-400 mb-4">Tryck på knappen och lämna din muntliga rapport.</p>
                                    <button onClick={startSBARRecording} className="px-8 py-4 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 flex items-center gap-2 mx-auto transition-transform hover:scale-105 active:scale-95">
                                        {ICONS.mic} Starta Inspelning
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            return (
                <div className="animate-fade-in">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        {ICONS.sbar} SBAR-Träning
                    </h2>
                    <p className="text-slate-400 mb-6">Välj ett patientfall och öva på att ge en strukturerad muntlig rapport. AI:n bedömer din struktur.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sbarScenarios.map(s => (
                            <button key={s.id} onClick={() => setSelectedSbarScenario(s)} className="text-left p-4 bg-slate-800 border border-slate-700 hover:border-blue-500 hover:bg-slate-700/50 rounded-lg transition-all group">
                                <h3 className="font-bold text-slate-200 group-hover:text-blue-400">{s.title}</h3>
                                <p className="text-sm text-slate-500 mt-1">{s.description}</p>
                            </button>
                        ))}
                    </div>
                </div>
            );
        }

        switch (labView) {
            case 'briefing':
                return (
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-2">{selectedScenario?.title}</h2>
                        <p className="text-gray-600 dark:text-slate-400 mb-6">{selectedScenario?.description}</p>
                        <div className="space-y-4">
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/40 border-l-4 border-blue-400 rounded-r-md">
                                <h3 className="font-bold text-blue-800 dark:text-blue-200">Ditt Uppdrag</h3>
                                <p className="mt-1 text-blue-900 dark:text-blue-300">{selectedScenario?.mission}</p>
                            </div>
                            <div className="p-4 bg-green-50 dark:bg-green-900/40 border-l-4 border-green-400 rounded-r-md">
                                <h3 className="font-bold text-green-800 dark:text-green-200">Att Tänka På</h3>
                                <ul className="list-disc list-inside mt-1 text-green-900 dark:text-green-300">
                                    {selectedScenario?.tips.map((tip, i) => <li key={i}>{tip}</li>)}
                                </ul>
                            </div>
                        </div>

                        <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-800/50 border dark:border-slate-700 rounded-md">
                            <h3 className="font-bold text-slate-800 dark:text-slate-200">1. Välj karaktärens röst</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 mb-4">Detta påverkar rösten du kommer höra och bilden som genereras för scenariot.</p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => setGender('female')}
                                    className={`flex-1 p-3 text-left rounded-md border-2 transition-all ${gender === 'female' ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-400 dark:border-indigo-600' : 'bg-white dark:bg-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'}`}
                                >
                                    <p className="font-semibold text-indigo-800 dark:text-indigo-200">Kvinnlig röst</p>
                                </button>
                                <button
                                    onClick={() => setGender('male')}
                                    className={`flex-1 p-3 text-left rounded-md border-2 transition-all ${gender === 'male' ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-400 dark:border-indigo-600' : 'bg-white dark:bg-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'}`}
                                >
                                    <p className="font-semibold text-indigo-800 dark:text-indigo-200">Manlig röst</p>
                                </button>
                            </div>
                        </div>

                        {gender && selectedScenario?.imagePrompt && (
                            <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-800/50 border dark:border-slate-700 rounded-md relative overflow-hidden group">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-slate-800 dark:text-slate-200">Visuellt Scenario</h3>
                                    {/* Removed Pro badge/lock since it's now unlocked for everyone via system key */}
                                </div>
                                
                                <div className="w-full aspect-[4/3] bg-slate-200 dark:bg-slate-700 rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
                                    {isGeneratingImage ? (
                                        <div className="flex flex-col items-center">
                                            <div className="w-10 h-10 border-4 border-t-red-500 border-slate-300 rounded-full animate-spin mb-2"></div>
                                            <p className="text-slate-500 text-sm">Genererar bild...</p>
                                        </div>
                                    ) : scenarioImage ? (
                                        <img src={scenarioImage} alt="Scenario" className="w-full h-full object-cover animate-fade-in" />
                                    ) : (
                                        <p className="text-slate-500">Bild genereras automatiskt när du startar.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {gender && (
                            <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-800/50 border dark:border-slate-700 rounded-md">
                                <h3 className="font-bold text-slate-800 dark:text-slate-200">2. Välj en intensitetsnivå</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 mb-4">Detta påverkar hur AI:n kommer att agera och sätter svårighetsgraden för samtalet.</p>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button 
                                        onClick={() => setIntensity('low')}
                                        className={`flex-1 p-3 text-left rounded-md border-2 transition-all ${intensity === 'low' ? 'bg-green-100 dark:bg-green-900/40 border-green-400 dark:border-green-600' : 'bg-white dark:bg-slate-700 hover:border-green-300 dark:hover:border-green-600'}`}
                                    >
                                        <p className="font-semibold text-green-800 dark:text-green-200">Lugn men orolig</p>
                                        <p className="text-xs text-green-700 dark:text-green-300">Patienten är samarbetsvillig men bär på en underliggande oro.</p>
                                    </button>
                                    <button 
                                        onClick={() => setIntensity('medium')}
                                        className={`flex-1 p-3 text-left rounded-md border-2 transition-all ${intensity === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-400 dark:border-yellow-600' : 'bg-white dark:bg-slate-700 hover:border-yellow-300 dark:hover:border-yellow-600'}`}
                                    >
                                        <p className="font-semibold text-yellow-800 dark:text-yellow-200">Irriterad och avvisande</p>
                                        <p className="text-xs text-yellow-700 dark:text-yellow-300">Patienten är kort i tonen och testar ditt bemötande.</p>
                                    </button>
                                    <button 
                                        onClick={() => setIntensity('high')}
                                        className={`flex-1 p-3 text-left rounded-md border-2 transition-all ${intensity === 'high' ? 'bg-red-100 dark:bg-red-900/40 border-red-400 dark:border-red-600' : 'bg-white dark:bg-slate-700 hover:border-red-300 dark:hover:border-red-600'}`}
                                    >
                                        <p className="font-semibold text-red-800 dark:text-red-200">Mycket upprörd</p>
                                        <p className="text-xs text-red-700 dark:text-red-300">Patienten är arg och utmanande. Kräver lågaffektivt bemötande.</p>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
                            <button 
                                onClick={startConversation} 
                                disabled={!intensity || !gender}
                                className="bg-red-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-red-600 transition-colors btn-press text-lg disabled:bg-red-300 disabled:cursor-not-allowed"
                            >
                                Starta Samtal
                            </button>
                            <button onClick={() => { resetState(); setLabView('selection'); }} className="bg-slate-200 text-slate-800 font-bold py-3 px-8 rounded-lg hover:bg-slate-300 transition-colors btn-press">
                                Välj ett annat scenario
                            </button>
                        </div>
                    </div>
                );
            case 'conversation':
                return (
                     <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-2">{selectedScenario?.title}</h2>
                        <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg min-h-[80px] flex items-center justify-center text-center mb-4">
                            <p className="text-lg font-semibold text-slate-700 dark:text-slate-200 capitalize">
                                {status === 'connecting' && 'Ansluter...'}
                                {status === 'connected' && <span className="text-green-600 dark:text-green-400">Ansluten</span>}
                                {status === 'error' && 'Ett fel uppstod vid anslutning till AI-servern. Kontrollera din anslutning eller försök igen.'}
                                {status === 'ended' && 'Konversationen avslutad.'}
                            </p>
                        </div>
                        <div className="mt-4 p-4 border rounded-lg h-80 overflow-y-auto space-y-4 bg-white/50 dark:bg-black/20">
                            {transcript.map((item, index) => (
                                <div key={index} className={`flex ${item.speaker === 'Användare' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`p-3 rounded-lg max-w-md ${item.speaker === 'Användare' ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-slate-100 dark:bg-slate-700/50'}`}>
                                        <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{item.speaker}</p>
                                        <p className="text-slate-700 dark:text-slate-200">{formatTranscriptText(item.text)}</p>
                                    </div>
                                </div>
                            ))}
                            {status === 'connected' && transcript.length === 0 && (
                                <div className="flex flex-col h-full items-center justify-center text-slate-500 dark:text-slate-400 text-center">
                                    {React.cloneElement(ICONS.mic, { className: "w-16 h-16 text-slate-400 dark:text-slate-500" })}
                                    <p className="mt-4 text-xl font-bold">Det är din tur.</p>
                                    <p>Börja prata för att inleda samtalet.</p>
                                </div>
                            )}
                        </div>
                        <div className="mt-6 flex justify-center">
                            <button onClick={endConversationAndAnalyze} disabled={status !== 'connected' && status !== 'connecting'} className="bg-red-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-red-600 disabled:bg-red-300 transition-colors btn-press">
                                Avsluta & Analysera
                            </button>
                        </div>
                    </div>
                );
            case 'feedback':
                 return (
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-2">Feedback & Analys</h2>
                        {isAnalyzing ? (
                            <div className="text-center p-8">
                                <p className="animate-pulse text-slate-600">AI-coachen analyserar ditt samtal...</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: aiFeedback || '' }} />
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-400 rounded-r-md">
                                    <h3 className="font-bold text-amber-800 dark:text-amber-200">Egen Reflektion</h3>
                                    <p className="mt-1 text-amber-900 dark:text-amber-300">Hur kändes det? Känner du att du uppnådde målet med scenariot? Vad tar du med dig?</p>
                                </div>
                                <details className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-md border dark:border-slate-700">
                                    <summary className="font-semibold cursor-pointer text-slate-700 dark:text-slate-200">Visa transkription</summary>
                                    <div className="mt-2 pt-2 border-t dark:border-slate-700 space-y-2 text-sm">
                                         {transcript.map((item, index) => (
                                             <p key={index}><strong className="font-semibold">{item.speaker}:</strong> {formatTranscriptText(item.text)}</p>
                                         ))}
                                    </div>
                                </details>
                            </div>
                        )}
                         <div className="mt-8 text-center">
                            <button onClick={() => { resetState(); setLabView('selection'); }} className="bg-slate-800 text-white font-bold py-3 px-8 rounded-lg hover:bg-slate-600 transition-colors btn-press">
                                Tillbaka till alla scenarier
                            </button>
                        </div>
                    </div>
                 );
            default: // selection
                 return (
                    <div>
                        <div className="flex items-center mb-4">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Kommunikationslabb</h2>
                            <InfoTooltip text="Öva på realistiska samtalsscenarier med en AI-driven röst. Välj ett scenario för att starta. Din mikrofon kommer att användas." />
                        </div>
                        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 mb-6 w-fit">
                            <button
                                onClick={() => setActiveTab('scenarios')}
                                className={`px-6 py-2 rounded-md text-sm font-bold transition-all duration-200 ${activeTab === 'scenarios' ? 'bg-slate-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Bemötande
                            </button>
                            <button
                                onClick={() => setActiveTab('sbar')}
                                className={`px-6 py-2 rounded-md text-sm font-bold transition-all duration-200 ${activeTab === 'sbar' ? 'bg-slate-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                SBAR-Rapportör
                            </button>
                        </div>
                        
                        <p className="mb-6 text-gray-600 dark:text-slate-300">
                            {activeTab === 'scenarios' 
                                ? "Här kan du träna på ditt bemötande och din kommunikation i en säker, simulerad miljö. AI:n kommer att agera som en patient eller anhörig."
                                : "Träna på att ge strukturerade och tydliga muntliga rapporter enligt SBAR-modellen (Situation, Bakgrund, Aktuellt, Rekommendation)."
                            }
                        </p>
                        
                        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/40 border-l-4 border-amber-400 text-amber-800 dark:text-amber-200 rounded-r-md">
                            <h3 className="font-bold flex items-center gap-2">{ICONS.warning} Begränsad Användning</h3>
                            <p className="mt-2 text-sm">För att uppmuntra praktiskt lärande ute på avdelningen är användningen av Kommunikationslabbet begränsad till <strong>{dailyLimit} scenario per dag</strong> (max {monthlyLimit} per månad).</p>
                            <p className="mt-1 text-sm">Detta hjälper oss också att vara ansvarsfulla med den energi som AI-modeller kräver.</p>
                        </div>

                         {usageLimits.dailyLimitReached || usageLimits.monthlyLimitReached ? (
                            <div className="text-center p-8 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-4">Gränsen för scenarier är nådd</h2>
                                <p className="text-gray-600 dark:text-slate-300">{usageLimits.reason}</p>
                            </div>
                        ) : !hasApiKey ? (
                            <div className="text-center p-8 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-4">Anslutning krävs</h2>
                                <p className="text-gray-600 dark:text-slate-300 mb-4">För att använda Kommunikationslabbet behöver du ansluta till CareLearn API.</p>
                                <button onClick={handleSelectKey} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors">
                                    Anslut till CareLearn API
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {roleScenarios.map(scenario => (
                                    <button key={scenario.title} onClick={() => handleSelectScenario(scenario)} className="w-full text-left p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200 shadow-sm hover:shadow-md btn-press">
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100">{scenario.title}</h4>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{scenario.description}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                );
        }
    };
    
    return (
        <div className="card-base p-6 max-w-4xl mx-auto">
            {renderContent()}
            <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
        </div>
    );
};

export default memo(CommunicationLab);
