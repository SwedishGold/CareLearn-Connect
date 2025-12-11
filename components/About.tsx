import React, { memo } from 'react';

interface AboutProps {
    onPlayPodcast: (src: string) => void;
}

const About: React.FC<AboutProps> = memo(({ onPlayPodcast }) => {
    const podcastSrc = "https://drive.google.com/file/d/1V66kjKiDQHEzmvFbqnbExE41kHaDpg1b/preview";

    return (
        <div className="card-base max-w-3xl mx-auto overflow-hidden">
            <div className="p-8">
                <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Om CareLearn</h2>

                    <div className="my-6 p-4 bg-slate-100 dark:bg-slate-800/50 border-l-4 border-red-400 rounded-r-md">
                        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Lyssna på en genomgång</h3>
                        <p className="mt-2 text-sm text-slate-900 dark:text-slate-300">
                            Klicka på knappen för att lyssna på en detaljerad genomgång av plattformens syfte och funktioner medan du utforskar appen.
                        </p>
                        <p className="mt-2 text-xs text-slate-800 dark:text-slate-400 italic mb-4">
                            <strong>Observera:</strong> Ljudklippet är skapat med hjälp av Google NotebookLM. Rösterna är AI-genererade och diskuterar projektet och dess kursmål.
                        </p>
                         <button 
                            onClick={() => onPlayPodcast(podcastSrc)}
                            className="bg-red-500 text-white font-bold py-2 px-4 rounded-md hover:bg-red-600 transition-colors duration-200 flex items-center gap-2 btn-press"
                         >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                            Spela upp ljudgenomgång
                        </button>
                    </div>
                    
                    <p>
                        Välkommen till CareLearn, ett interaktivt verktyg skapat för att stödja och berika din arbetsplatsförlagda lärande (APL) på Psykiatrisk Intensivvårdsavdelning (PIVA) 51. Appen är utvecklad av Andreas Hillborgh, med lång erfarenhet från psykiatrin och handledning, som ett sätt att omsätta pedagogiska idéer till ett praktiskt och användbart verktyg.
                    </p>
                    
                    <h3 className="text-2xl font-semibold pt-4 text-slate-800 dark:text-slate-100">Appens Vision</h3>
                    <p className="mt-2">
                        Tanken är att skapa ett interaktivt och anpassat stöd som underlättar för både elever och handledare under APL-perioden. Plattformen ska:
                    </p>
                    <ul className="list-disc list-inside space-y-2 mt-2 pl-4">
                        <li><strong>Standardisera & Effektivisera:</strong> Säkerställa en likvärdig och komplett introduktion för alla genom en digital checklista.</li>
                        <li><strong>Avlasta Handledare:</strong> Frigöra tid från repetitiva informationsmoment till djupare, kvalitativ handledning.</li>
                        <li><strong>Tillgängliggöra Kunskap:</strong> Samla viktiga rutiner och dokument på en lättillgänglig plats, tillgänglig dygnet runt.</li>
                        <li><strong>Erbjuda Säker Träning:</strong> Ge en trygg miljö att öva kunskap och bemötande via quiz och AI-scenarier.</li>
                        <li><strong>Stödja Reflektion:</strong> Underlätta dokumentation av lärande, uppmuntra till daglig reflektion i loggboken och hjälpa till att koppla praktiska erfarenheter till kursens kunskapskrav.</li>
                    </ul>
                    
                    <p className="mt-4 p-4 bg-slate-100 dark:bg-slate-800/50 border-l-4 border-red-400 rounded-r-md">
                        För mer detaljerade frågor om appen, AI-Handledaren och datahantering, se avsnittet <strong>"Frågor & Svar"</strong> i sidomenyn.
                    </p>

                    <h3 className="text-2xl font-semibold pt-4 text-slate-800 dark:text-slate-100">Lag & Etik: GDPR och AI Act</h3>
                    
                    <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-4">GDPR – Dataskydd i fokus</h4>
                    <p className="mt-2">
                        CareLearn är byggd med integritet som grundprincip. All behandling av personuppgifter sker enligt Dataskyddsförordningen (GDPR, EU 2016/679).
                    </p>
                    <ul className="list-disc list-inside space-y-2 mt-2 pl-4">
                        <li><strong className="font-semibold text-slate-800 dark:text-slate-200">Lokal datalagring:</strong> Din personliga data, inklusive checklistor, loggboksinlägg och testresultat, lagras endast lokalt i din webbläsare via <code>localStorage</code>. Ingen information skickas till någon central server.</li>
                        <li><strong className="font-semibold text-slate-800 dark:text-slate-200">Begränsad delning:</strong> Handledare och lärare kan ta del av dina framsteg endast via appen på samma enhet, eller i framtida nätverksversioner med tydlig rollbaserad åtkomst.</li>
                        <li><strong className="font-semibold text-slate-800 dark:text-slate-200">AI-interaktioner:</strong> Konversationer med AI-Handledaren skickas till externa servrar (Google) för att generera svar. Du får därför inte skriva in patientdata eller annan personidentifierande information i chatten – något som förklaras tydligt i "AI-Körkortet".</li>
                        <li><strong className="font-semibold text-slate-800 dark:text-slate-200">Ditt val:</strong> Du har full kontroll. Rensar du din webbhistorik raderas även all data kopplad till appen.</li>
                    </ul>
                    <p className="mt-2">
                        Läs mer på <a href="https://www.imy.se/verksamhet/dataskydd/" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:underline font-semibold">Integritetsskyddsmyndighetens webbplats</a>.
                    </p>

                    <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-6">AI Act – Begränsad risk, full transparens</h4>
                    <p className="mt-2">
                        CareLearn omfattas av EU:s förordning om artificiell intelligens (AI Act, EU 2024/1689) och klassificeras som ett AI-system med <strong>begränsad risk</strong>, enligt kapitel V, Artikel 50.1.
                    </p>

                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 border rounded-md">
                        <h5 className="font-bold text-slate-800 dark:text-slate-200">Varför "begränsad risk"?</h5>
                        <p className="mt-2">
                            EU-förordningen kräver att AI-system som interagerar med människor – som chatbots – är transparenta. Användare ska förstå att de kommunicerar med en maskin (Artikel 50.1 a–b). Appen uppfyller detta krav genom:
                        </p>
                        <ul className="list-disc list-inside space-y-1 mt-2 pl-4">
                            <li>AI:n kallas tydligt för "AI-Handledaren".</li>
                            <li>Alla användare genomgår ett obligatoriskt AI-Körkort som förklarar vad AI:n är, hur den fungerar och dess begränsningar.</li>
                        </ul>
                    </div>

                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 border rounded-md">
                        <h5 className="font-bold text-slate-800 dark:text-slate-200">Varför inte "hög risk"?</h5>
                        <p className="mt-2">
                            Även om appen används inom utbildning och hälso- och sjukvård, klassificeras den inte som högrisk (enligt Artikel 6 och Bilaga III). Anledningen är:
                        </p>
                        <ul className="list-disc list-inside space-y-1 mt-2 pl-4">
                            <li>AI-systemet används endast som ett stödverktyg.</li>
                            <li>AI:n fattar inga autonoma beslut om antagning, betyg eller diagnos.</li>
                            <li>En människa har alltid det slutliga ansvaret ("human-in-the-loop").</li>
                        </ul>
                    </div>

                    <p className="mt-4">
                        Med detta uppfyller appen både lagens krav och etikens principer för säker och tillförlitlig AI.
                    </p>
                    <p className="mt-2">
                        Läs mer om AI-förordningen på <a href="https://www.regeringen.se/faktapromemoria/2021/05/202021fpm-109/" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:underline font-semibold">Regeringens webbplats</a>.
                    </p>
                </div>
            </div>
        </div>
    );
});

export default About;