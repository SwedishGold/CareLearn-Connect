
import React, { memo } from 'react';

const QnAItem: React.FC<{ question: string, children: React.ReactNode }> = ({ question, children }) => (
    <details className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-md border dark:border-slate-700 open:border-red-400 dark:open:border-red-500 transition-all group">
        <summary className="font-semibold text-lg cursor-pointer text-slate-800 dark:text-slate-200 hover:text-red-700 dark:hover:text-red-400 flex justify-between items-center">
            {question}
            <span className="text-red-500 transform group-open:rotate-90 transition-transform duration-200">&rarr;</span>
        </summary>
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
            {children}
        </div>
    </details>
);


const QA: React.FC = memo(() => {
    return (
        <div className="card-base p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-center text-slate-800 dark:text-slate-100">Frågor & Svar</h1>
            <p className="text-center text-slate-600 dark:text-slate-400 mt-2 mb-8">Här hittar du information om hur CareLearn-plattformen fungerar och hur du använder verktygen.</p>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold pt-4 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">Appens Funktioner</h2>
                
                <QnAItem question="Hur fungerar checklistan?">
                    <p>Checklistan är din guide genom introduktionen. Den innehåller de viktigaste momenten du behöver gå igenom. Du bockar av punkterna allt eftersom. Din handledare kan också se din checklista och bocka av punkter åt dig för att bekräfta att ni gått igenom dem.</p>
                </QnAItem>

                <QnAItem question="Vem kan läsa min loggbok?">
                    <p>Din loggbok sparas lokalt på din enhet. Om du har kopplat ihop dig med en handledare via QR-kod eller länkning kan de se dina inlägg för att kunna ge feedback och stötta ditt lärande. Tänk på att aldrig skriva patientkänslig information i loggboken.</p>
                </QnAItem>

                <QnAItem question="Vad är 'Dagens Kliniska Utmaning'?">
                    <p>Det är en daglig simulering där AI:n skapar ett unikt patientfall baserat på din roll och dina tidigare framsteg. Du får ett scenario och ska välja bästa åtgärd. Syftet är att träna ditt kliniska beslutsfattande i en säker miljö. Du kan göra en utmaning per dag.</p>
                </QnAItem>

                <QnAItem question="Hur fungerar Kommunikationslabbet?">
                    <p>Här kan du öva på svåra samtal, till exempel att bemöta en orolig anhörig eller motivera en patient. Du pratar med en AI-röst som agerar motpart. Efter samtalet får du feedback på din empati, tydlighet och strategi.</p>
                </QnAItem>

                <h2 className="text-2xl font-bold pt-8 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">AI & Säkerhet</h2>
                
                <QnAItem question="Är AI-Handledaren alltid korrekt?">
                    <p>Nej. AI:n är ett kraftfullt stödverktyg tränat på stora mängder text, men den kan ha fel ("hallucinera"). Använd den för att få förklaringar, sammanfattningar och tips, men <strong>dubbelkolla alltid</strong> kritisk information (som medicinska doser eller specifika lokala rutiner) med din mänskliga handledare eller officiella dokument.</p>
                </QnAItem>

                <QnAItem question="Varför får jag inte skriva patientnamn?">
                    <div className="p-3 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded-r-md">
                        <p className="font-bold text-red-800 dark:text-red-200">Strikt Sekretess gäller!</p>
                        <p className="mt-1">När du chattar med AI:n skickas texten till en extern server för analys. Att inkludera personnummer, namn eller detaljer som kan identifiera en patient är ett brott mot GDPR och sekretesslagen. Appen har filter som varnar dig, och vid upprepade överträdelser stängs kontot av.</p>
                    </div>
                </QnAItem>

                <QnAItem question="Vad är 'Kunskapsbanken'?">
                    <p>Det är en samling dokument (PDF, Word, Text) som din enhet har laddat upp. AI-Handledaren läser dessa dokument för att kunna ge dig svar som är specifika för just din arbetsplats rutiner, istället för bara allmänna svar.</p>
                </QnAItem>

                <h2 className="text-2xl font-bold pt-8 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">Tekniskt</h2>

                <QnAItem question="Krävs internetuppkoppling?">
                    <p>Ja, för de flesta funktioner. AI-chatten, bildgenerering och synkning med handledare kräver internet. Viss data (som dina sparade checklistor) ligger sparat i din webbläsare, men för full funktionalitet bör du vara uppkopplad.</p>
                </QnAItem>

                <QnAItem question="Hur installerar jag appen?">
                    <p>CareLearn är en så kallad PWA (Progressive Web App). Du laddar inte ner den från App Store/Play Store. Istället öppnar du webbsidan i din mobila webbläsare, trycker på "Dela"-knappen (iOS) eller menyn (Android) och väljer <strong>"Lägg till på hemskärmen"</strong>. Då fungerar den precis som en vanlig app.</p>
                </QnAItem>

                <QnAItem question="Jag har bytt enhet, var är min data?">
                    <p>Eftersom datan sparas lokalt i din webbläsare följer den inte automatiskt med om du byter telefon eller dator. Använd funktionen "Dela Framsteg" (QR-kod) eller "Säkerhetskopiering" under Inställningar för att flytta din data.</p>
                </QnAItem>
            </div>
        </div>
    );
});

export default QA;
