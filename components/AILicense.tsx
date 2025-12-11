
import React, { useState, memo, useMemo } from 'react';
import { User, Role } from '../types';

interface AILicenseProps {
    user: User;
    onComplete: () => void;
    onBack: () => void;
}

const isStaffRole = (role: Role) => role.startsWith('handledare') || role.startsWith('larare') || role === 'overlakare';

const studentQuizQuestions = [
    {
        question: "Du är osäker på doseringen av ett läkemedel och frågar AI:n, som ger dig ett svar. Vad gör du?",
        answers: [
            "Litar på AI:n, den är ju en superdator.",
            "Kontrollerar i FASS och stämmer av med min handledare.",
            "Frågar AI:n igen för att vara säker."
        ],
        correctAnswerIndex: 1
    },
    {
        question: "Du behöver skriva en reflektion om bemötande av en patient du träffat. Vad är OK att skriva i chatten?",
        answers: [
            "Reflektion om en paranoid patient på rum 4.",
            "Reflektion om en patient, Kalle, 55 år.",
            "Hjälp mig reflektera kring bemötande av patienter med paranoia generellt."
        ],
        correctAnswerIndex: 2
    },
    {
        question: "AI-Handledaren är bäst lämpad för att...",
        answers: [
            "Sammanfatta dokument, ge inspiration och agera rollspelspartner.",
            "Ställa diagnoser och fatta slutgiltiga kliniska beslut.",
            "Ersätta min mänskliga handledare."
        ],
        correctAnswerIndex: 0
    },
    {
        question: "Om AI:n ger ett svar som verkar konstigt eller felaktigt, vad bör du göra?",
        answers: [
            "Ignorera det och lita på att den har rätt nästa gång.",
            "Ifrågasätta svaret, prova att ställa om frågan och diskutera det med din handledare.",
            "Acceptera svaret, AI:n är smartare än jag."
        ],
        correctAnswerIndex: 1
    },
    {
        question: "Vem har det slutgiltiga ansvaret för innehållet i din loggbok, även om du använt AI för att få inspiration?",
        answers: [
            "AI:n eftersom den skrev förslaget.",
            "Min handledare som ska godkänna den.",
            "Jag själv. Jag måste stå för allt som står där."
        ],
        correctAnswerIndex: 2
    },
    {
        question: "Kan AI-Handledaren ställa en medicinsk diagnos på en patient om du beskriver symtomen?",
        answers: [
            "Ja, den är ofta bättre än läkare på diagnoser.",
            "Kanske, om jag beskriver väldigt noga.",
            "Nej, aldrig. Den kan bara ge generell information om sjukdomstillstånd."
        ],
        correctAnswerIndex: 2
    },
    {
        question: "Varför är det viktigt att du lär dig rutinerna utantill och inte bara förlitar dig på appen?",
        answers: [
            "För att appen kanske inte fungerar vid strömavbrott eller nätverksproblem.",
            "För att det ser bättre ut inför chefen.",
            "Det är inte viktigt, jag har alltid mobilen med mig."
        ],
        correctAnswerIndex: 0
    },
    {
        question: "Vad innebär det att vara 'källkritisk' mot AI?",
        answers: [
            "Att man alltid antar att AI:n ljuger.",
            "Att man dubbelkollar fakta mot säkra källor (PM, Vårdhandboken) eftersom AI kan hitta på ('hallucinera').",
            "Att man är otrevlig mot chatboten."
        ],
        correctAnswerIndex: 1
    }
];

const staffQuizQuestions = [
    {
        question: "En AI-genererad rapport flaggar en student som 'i riskzonen' på grund av få loggboksinlägg. Vad är din primära åtgärd?",
        answers: [
            "Genast konfrontera studenten med AI-rapporten.",
            "Använda rapporten som en absolut sanning för bedömning.",
            "Se det som en signal att ha ett öppet och stödjande samtal med studenten om deras APL."
        ],
        correctAnswerIndex: 2
    },
    {
        question: "Vad är den största etiska risken med att använda AI för att analysera studenters reflektioner?",
        answers: [
            "Att det sparar tid.",
            "Att studenterna skriver bättre reflektioner.",
            "Att förstärka egna fördomar (confirmation bias) eller skapa en känsla av övervakning hos studenten."
        ],
        correctAnswerIndex: 2
    },
    {
        question: "En student visar dig en AI-genererad reflektion som är 'för' perfekt. Vad är den bästa pedagogiska approachen?",
        answers: [
            "Anklaga studenten för fusk.",
            "Använda texten som en utgångspunkt för att diskutera själva reflektionsprocessen och studentens egna tankar.",
            "Ge studenten högsta betyg för en välskriven text."
        ],
        correctAnswerIndex: 1
    },
    {
        question: "Din viktigaste roll som handledare när det gäller AI-verktyg är att...",
        answers: [
            "Förbjuda all användning av AI för att undvika problem.",
            "Uppmuntra studenten att lita på AI:ns svar för att bli mer effektiv.",
            "Vägleda studenten i att använda AI kritiskt och ansvarsfullt, samt att alltid förlita sig på professionellt omdöme och bekräftade källor."
        ],
        correctAnswerIndex: 2
    },
    {
        question: "AI:n föreslår en formulering till en studentfeedback som känns lite opersonlig och 'kall'. Vad gör du?",
        answers: [
            "Skickar den ändå, det sparar tid.",
            "Redigerar texten så att den får min egen röst, värme och empati.",
            "Ber AI:n skriva den argare."
        ],
        correctAnswerIndex: 1
    },
    {
        question: "En student och du är oense om en rutin. Studenten säger 'Men AI:n sa att man gör så här'. Hur hanterar du det?",
        answers: [
            "Säger att AI alltid har fel.",
            "Säger 'Vad intressant, låt oss kolla upp vad vårt lokala PM säger i Vårdhandboken tillsammans'.",
            "Ändrar rutinen så den stämmer med AI:n."
        ],
        correctAnswerIndex: 1
    },
    {
        question: "Vilken typ av data är lämpligast att låta AI:n analysera för att spara tid åt dig?",
        answers: [
            "Känsliga personuppgifter om studentens privatliv.",
            "Mönster i studentens loggbok (t.ex. om de fokuserar mest på görande eller varande).",
            "Hemliga patientjournaler."
        ],
        correctAnswerIndex: 1
    },
    {
        question: "Om en student verkar överdrivet beroende av AI-appen för att svara på frågor under ronder, vad bör du göra?",
        answers: [
            "Uppmuntra det, det går snabbt.",
            "Uppmana studenten att lägga undan telefonen ibland för att träna på att lita på sin egen kunskap och intuition.",
            "Ta ifrån dem telefonen permanent."
        ],
        correctAnswerIndex: 1
    }
];

const adminQuizQuestions = [
    {
        question: "Du ser i analysvyn att en studentgrupp har låga resultat på kunskapstestet. Vad är din mest ansvarsfulla första åtgärd?",
        answers: [
            "Radera studenternas profiler eftersom de är underpresterande.",
            "Identifiera vilka frågor som är svårast och överväga om de är otydliga eller om undervisningsmaterialet behöver förbättras.",
            "Skicka ut ett meddelande till alla handledare och påpeka att deras studenter har dåliga resultat."
        ],
        correctAnswerIndex: 1,
    },
    {
        question: "En användare har flaggat ett AI-svar som 'felaktigt'. Vad är syftet med att du granskar detta?",
        answers: [
            "Att straffa användaren för att de flaggat i onödan.",
            "Att förstå kontexten, bedöma om AI:n gav felaktig information, och se om systemets instruktioner behöver justeras.",
            "Att enbart markera flaggningen som 'granskad' för att rensa listan."
        ],
        correctAnswerIndex: 1,
    },
    {
        question: "Varför är det viktigt att INTE ladda upp dokument med patientinformation till AI:ns kunskapsbank via 'Hantera Kunskapsbank'?",
        answers: [
            "AI:n kan bli förvirrad av för mycket information.",
            "Det skapar en allvarlig risk för dataläckor och brott mot GDPR/sekretesslagen, då informationen kan exponeras för användare.",
            "Det spelar ingen roll, AI:n förstår ändå inte patientdata."
        ],
        correctAnswerIndex: 1,
    },
    {
        question: "Som administratör är ditt primära ansvar gällande AI-systemet att...",
        answers: [
            "Säkerställa att systemet fungerar tekniskt felfritt och används på ett etiskt och ansvarsfullt sätt som stödjer lärandet.",
            "Använda analysverktygen för att i detalj övervaka enskilda studenters chattkonversationer.",
            "Maximera användarnas tid i appen, oavsett aktivitet."
        ],
        correctAnswerIndex: 0,
    },
    {
        question: "Vad är risken med att ha gamla, inaktuella PM uppladdade i kunskapsbanken?",
        answers: [
            "Det tar upp onödigt lagringsutrymme.",
            "AI:n kommer att ge studenterna felaktiga och potentiellt farliga råd baserat på gamla rutiner.",
            "Ingen risk, AI:n vet vad som är nytt ändå."
        ],
        correctAnswerIndex: 1
    },
    {
        question: "AI-analysen visar att sentimentet (stämningen) bland studenterna sjunker drastiskt. Hur bör du tolka det?",
        answers: [
            "Som en absolut sanning att allt är dåligt.",
            "Som en indikator (signal) att undersöka saken närmare genom dialog med handledare och studenter.",
            "Som ett tekniskt fel i algoritmen."
        ],
        correctAnswerIndex: 1
    },
    {
        question: "Vad gäller kring 'Bias' (partiskhet) i AI-genererade rapporter?",
        answers: [
            "AI är en maskin och är därför alltid objektiv.",
            "AI kan spegla ojämlikheter i sin träningsdata, så jag måste granska rapporter kritiskt för att se att de inte missgynnar vissa grupper.",
            "Bias är bara ett problem i USA, inte i Sverige."
        ],
        correctAnswerIndex: 1
    },
    {
        question: "När bör du radera en användare ur systemet?",
        answers: [
            "När de inte har loggat in på en vecka.",
            "När deras APL eller anställning är avslutat, för att minimera datalagring enligt GDPR.",
            "Aldrig, all data ska sparas för alltid."
        ],
        correctAnswerIndex: 1
    }
];


export const AILicense: React.FC<AILicenseProps> = memo(({ user, onComplete, onBack }) => {
    const isAdmin = user.role === 'admin';
    const isStaff = isStaffRole(user.role);
    
    const { content, quizQuestions } = useMemo(() => {
        if (isAdmin) {
            return {
                content: {
                    title: "AI-Körkort för Administratörer",
                    subtitle: "Ansvar, översikt och etisk hantering av AI-systemet och användardata.",
                    steps: [
                        { num: 1, title: "Systemansvar" },
                        { num: 2, title: "Data & Sekretess" },
                        { num: 3, title: "Etisk Granskning" },
                        { num: 4, title: "Kunskapstest" },
                    ],
                    stepContent: [
                        {
                            title: "Ditt Systemansvar",
                            body: "Som administratör har du kontroll över AI:ns kunskapsbas via 'Avdelningsinställningar' och 'Hantera Kunskapsbank'. De checklistor, kunskapstest och dokument du konfigurerar blir AI:ns primära källa till information. Kom ihåg principen 'skräp in, skräp ut'. Kvaliteten på ditt underlag avgör kvaliteten på AI:ns svar. Det är ditt ansvar att säkerställa att informationen är korrekt och uppdaterad.",
                            nextButton: "Nästa: Data & Sekretess"
                        },
                        {
                            title: "Data, Sekretess och GDPR",
                            body: (
                                <div className="space-y-4">
                                     <p>Du har tillgång till vyer ('Dataanalys', 'Granska Feedback') som aggregerar data från alla användare. Även om denna data är avidentifierad, vilar ett stort ansvar på dig:</p>
                                    <div className="border-l-4 border-primary-color p-4 bg-red-50 dark:bg-red-900/40">
                                        <h3 className="font-bold text-red-800 dark:text-red-200">Skydda Användarnas Integritet</h3>
                                        <p className="mt-2 text-red-700 dark:text-red-300">Ditt uppdrag är att identifiera övergripande trender för att förbättra utbildningen, inte att övervaka enskilda individer. Att försöka spåra eller de-anonymisera data är ett brott mot syftet med verktyget och principerna i GDPR. Använd din åtkomst ansvarsfullt.</p>
                                    </div>
                                </div>
                            ),
                            nextButton: "Nästa: Etisk Granskning"
                        },
                        {
                            title: "Etisk Granskning & Systemförbättring",
                            body: "Vyn 'Flaggat Innehåll' är ditt viktigaste verktyg för att upprätthålla kvalitet och säkerhet. När en användare flaggar ett svar är det en signal om att systemet kan ha brister. Ditt ansvar är att: 1. Granska den flaggade konversationen för att förstå problemet. 2. Bedöma om AI:ns svar var felaktigt, olämpligt eller partiskt. 3. Överväga om AI:ns grundinstruktioner ('system prompt') eller kunskapsbasen behöver justeras för att förhindra liknande fel i framtiden.",
                            nextButton: "Starta Kunskapstest"
                        },
                    ]
                },
                quizQuestions: adminQuizQuestions,
            };
        }
        if (isStaff) {
            return {
                content: {
                    title: "AI-Körkort för Handledare & Lärare",
                    subtitle: "Förstå hur du använder AI som ett pedagogiskt verktyg på ett ansvarsfullt och etiskt sätt.",
                    steps: [
                        { num: 1, title: "AI som verktyg" },
                        { num: 2, title: "Etik & Risker" },
                        { num: 3, title: "Ditt Ansvar" },
                        { num: 4, title: "Kunskapstest" },
                    ],
                    stepContent: [
                        {
                            title: "AI som ett verktyg för handledning",
                            body: "AI-assistenten är designad för att vara ett stöd i din handledarroll. Den kan snabbt analysera studentdata för att identifiera mönster, t.ex. vilka studenter som är väldigt aktiva eller vilka som kan behöva extra uppmärksamhet. Se det som en avancerad assistent som kan ge dig ett underlag och spara tid, så att du kan fokusera mer på de meningsfulla pedagogiska samtalen.",
                            nextButton: "Nästa: Etik & Risker"
                        },
                        {
                            title: "Etiska Överväganden & Risker",
                            body: (
                                <div className="space-y-4">
                                    <div className="border-l-4 border-primary-color pl-4">
                                        <h3 className="font-bold text-red-800 dark:text-red-200">Studentintegritet & Övervakning</h3>
                                        <p className="text-red-700 dark:text-red-300">Verktyget analyserar studenternas egna inmatningar. Det är avgörande att du som handledare hanterar denna information varsamt och etiskt. En risk är att studenten känner sig övervakad, vilket kan hämma ärligheten i reflektionerna. Kommunicera tydligt att AI-underlaget är ett stöd för dialog, inte ett facit för bedömning.</p>
                                    </div>
                                    <div className="border-l-4 border-accent-color pl-4">
                                        <h3 className="font-bold text-yellow-800 dark:text-yellow-200">Confirmation Bias (Bekräftelsefördom)</h3>
                                        <p className="text-yellow-700 dark:text-yellow-300">AI:n kan lyfta fram mönster som bekräftar dina egna omedvetna fördomar om en student. Om AI:n säger att en student 'kämpar med initiativtagande' kan du omedvetet börja leta efter bevis för just det. Var medveten om denna risk och använd AI-rapporten som en startpunkt för nyfikna frågor, inte som en slutsats.</p>
                                    </div>
                                </div>
                            ),
                            nextButton: "Nästa: Ditt Ansvar"
                        },
                        {
                            title: "Ditt Ansvar som Handledare",
                            body: "Ditt omdöme som professionell yrkesutövare och pedagog är alltid överordnat AI:ns förslag. Ditt ansvar är att: 1. Kritiskt granska AI-genererat material. 2. Använda det som ett underlag för att ställa öppna, reflekterande frågor till studenten. 3. Förmedla en ansvarsfull och kritisk hållning till AI-verktyg till dina studenter. Du är en förebild.",
                            nextButton: "Starta Kunskapstest"
                        },
                    ]
                },
                quizQuestions: staffQuizQuestions,
            };
        }
        return {
            content: {
                title: "AI-Körkort för Studenter & Vikarier",
                subtitle: "En kort, obligatorisk introduktion till ansvarsfull användning av AI-Handledaren.",
                steps: [
                    { num: 1, title: "Vad är AI?" },
                    { num: 2, title: "Sekretess" },
                    { num: 3, title: "Ditt Ansvar" },
                    { num: 4, title: "Kunskapstest" },
                ],
                stepContent: [
                    {
                        title: "Vad är AI-Handledaren?",
                        body: "AI-Handledaren är en avancerad språkmodell (som ChatGPT eller Google Gemini) som är tränad på stora mängder text. Den är ett verktyg för att hjälpa dig att lära, inte en expert. Den kan sammanfatta texter, förklara begrepp och agera rollspelspartner, men den har inget eget medvetande, inget kliniskt omdöme och kan ha fel.",
                        nextButton: "Nästa: Sekretess & Patientdata"
                    },
                    {
                        title: "Sekretess & Patientdata: Den viktigaste regeln",
                        body: (
                            <div className="border-l-4 border-primary-color p-4 bg-red-50 dark:bg-red-900/40">
                                <h3 className="font-bold text-red-800 dark:text-red-200">Skriv ALDRIG patientkänslig information!</h3>
                                <p className="mt-2 text-red-700 dark:text-red-300">När du chattar med AI:n skickas din fråga till externa servrar. Att inkludera namn, personnummer eller andra identifierande detaljer om en patient är ett allvarligt brott mot sekretesslagen. Plattformen har ett automatiskt skydd som raderar ditt konto vid upprepade överträdelser.</p>
                                <div className="mt-4">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200">❌ Fel: <span className="font-normal text-red-700 dark:text-red-300">"Hjälp mig reflektera kring patienten Stina på rum 4."</span></p>
                                    <p className="font-semibold text-slate-800 dark:text-slate-200">✅ Rätt: <span className="font-normal text-green-700 dark:text-green-300">"Hjälp mig reflektera kring bemötande av patienter med paranoia."</span></p>
                                </div>
                            </div>
                        ),
                        nextButton: "Nästa: Ditt Ansvar"
                    },
                    {
                        title: "Ditt Ansvar: Var källkritisk",
                        body: (
                            <div className="space-y-4">
                                <p>AI:n är ett stöd, inte en ersättare för ditt professionella omdöme. Du är alltid ansvarig för att:</p>
                                <ul className="list-decimal list-inside space-y-3 pl-2">
                                    <li>
                                        <strong>Vara källkritisk:</strong> Dubbelkolla alltid kritisk information (som läkemedel) med din handledare, FASS och lokala rutiner. Lita aldrig blint på ett AI-svar i en klinisk situation.
                                    </li>
                                    <li>
                                        <strong>Bibehålla din egen röst:</strong> Enligt feedback från andra användare finns det en risk att man omedvetet börjar "låta som AI:n". Använd AI-genererade texter som inspiration, men formulera alltid dina egna reflektioner med dina egna ord. Din unika tankeprocess är en central del av ditt lärande.
                                    </li>
                                    <li>
                                        <strong>Förstå dess begränsningar:</strong> AI:n ger generella råd baserat på mönster den sett i text. Den kan inte förstå den unika situationen för en specifik patient eller din arbetsplats alla nyanser. Ditt omdöme och din empati är oersättliga.
                                    </li>
                                </ul>
                            </div>
                        ),
                        nextButton: "Starta Kunskapstest"
                    },
                ]
            },
            quizQuestions: studentQuizQuestions,
        };
    }, [isAdmin, isStaff]);

    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState<(number | null)[]>(Array(quizQuestions.length).fill(null));
    const [showResults, setShowResults] = useState(false);

    const handleNext = () => {
        if (currentStep < content.steps.length) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleAnswer = (questionIndex: number, answerIndex: number) => {
        const newAnswers = [...answers];
        newAnswers[questionIndex] = answerIndex;
        setAnswers(newAnswers);
    };

    const renderQuiz = () => {
        if (showResults) {
            const score = answers.filter((ans, i) => ans === quizQuestions[i].correctAnswerIndex).length;
            const allCorrect = score === quizQuestions.length;
            return (
                <div className="text-center">
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Resultat: {score} / {quizQuestions.length} rätt</h3>
                    {allCorrect ? (
                        <div className="mt-4">
                            <p className="text-green-700 dark:text-green-300 font-semibold">Grattis! Du har klarat AI-Körkortet.</p>
                            <button onClick={onComplete} className="mt-6 bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 transition-colors duration-200 btn-press">
                                Slutför & Lås upp AI-funktioner
                            </button>
                        </div>
                    ) : (
                        <div className="mt-4">
                            <p className="text-red-700 dark:text-red-400 font-semibold">Du behöver ha alla rätt för att slutföra. Gå tillbaka och försök igen.</p>
                            <button onClick={() => setShowResults(false)} className="mt-6 bg-accent-color text-white font-bold py-2 px-6 rounded-lg hover:bg-accent-hover transition-colors duration-200 btn-press">
                                Försök igen
                            </button>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div>
                {quizQuestions.map((q, qIndex) => (
                    <div key={qIndex} className="mb-6 animate-stagger" style={{ animationDelay: `${qIndex * 100}ms` }}>
                        <p id={`question-${qIndex}`} className="font-semibold text-slate-800 dark:text-slate-100">{qIndex + 1}. {q.question}</p>
                        <div role="radiogroup" aria-labelledby={`question-${qIndex}`} className="space-y-2 mt-3">
                            {q.answers.map((ans, aIndex) => {
                                const isSelected = answers[qIndex] === aIndex;
                                return (
                                   <button
                                       key={aIndex}
                                       role="radio"
                                       aria-checked={isSelected}
                                       onClick={() => handleAnswer(qIndex, aIndex)}
                                       className={`w-full text-left p-4 border-2 rounded-lg transition-all duration-200 flex items-center text-slate-800 dark:text-slate-100 btn-press
                                           ${isSelected 
                                               ? 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-500 dark:border-indigo-600 ring-2 ring-indigo-300 dark:ring-indigo-700' 
                                               : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600'}
                                       `}
                                   >
                                       <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 mr-4 flex items-center justify-center
                                           ${isSelected ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-200 dark:bg-indigo-900' : 'border-slate-400 dark:border-slate-500'}
                                       `}>
                                           {isSelected && <div className="w-3 h-3 bg-indigo-600 dark:bg-indigo-400 rounded-full"></div>}
                                       </div>
                                       <span className="flex-1">{ans}</span>
                                   </button>
                               );
                           })}
                        </div>
                    </div>
                ))}
                <button onClick={() => setShowResults(true)} disabled={answers.some(a => a === null)} className="w-full bg-slate-800 dark:bg-white text-white dark:text-black font-bold py-3 rounded-lg hover:bg-slate-600 dark:hover:bg-slate-300 disabled:opacity-50 transition-colors duration-200 btn-press text-lg">
                    Rätta testet
                </button>
            </div>
        );
    };

    return (
        <div className="card-base p-4 sm:p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-center text-slate-800 dark:text-slate-100">{content.title}</h1>
            <p className="text-center text-slate-600 dark:text-slate-400 mt-2 mb-8">{content.subtitle}</p>

            <div className="flex justify-between items-center mb-8 px-2">
                {content.steps.map(step => (
                    <div key={step.num} className={`flex items-center transition-colors duration-300 ${step.num <= currentStep ? 'text-primary-color' : 'text-slate-400 dark:text-slate-500'}`}>
                        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold transition-all duration-300 ${step.num <= currentStep ? 'bg-primary-color text-white border-primary-color' : 'border-slate-400 dark:border-slate-500'}`}>{step.num}</div>
                        <span className="ml-2 font-semibold hidden sm:inline">{step.title}</span>
                    </div>
                ))}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg border dark:border-slate-700 min-h-[300px]">
                {currentStep < content.stepContent.length ? (
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">{content.stepContent[currentStep].title}</h2>
                        <div className="prose prose-sm max-w-none text-slate-700 dark:text-slate-300">
                            {content.stepContent[currentStep].body}
                        </div>
                        <div className="text-right mt-8">
                            <button onClick={handleNext} className="bg-slate-900 dark:bg-white text-white dark:text-black font-bold py-2 px-6 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors duration-200 btn-press">
                                {content.stepContent[currentStep].nextButton}
                            </button>
                        </div>
                    </div>
                ) : (
                    renderQuiz()
                )}
            </div>
             <style>{`
                @keyframes stagger-in {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-stagger {
                    animation: stagger-in 0.5s ease-out both;
                }
            `}</style>
        </div>
    );
});
