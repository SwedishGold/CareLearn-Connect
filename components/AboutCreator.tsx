import React, { memo } from 'react';
import { View } from '../types';

interface AboutCreatorProps {
    setView: (view: View) => void;
}

const AboutCreator: React.FC<AboutCreatorProps> = memo(({ setView }) => {
    return (
        <div className="card-base max-w-3xl mx-auto overflow-hidden">
            <div className="p-8">
                <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Min Vision & Bakgrund</h2>
                    <p>
                        Hej, mitt namn är Andreas Hillborgh. Denna plattform föddes ur en passion för att förena två världar: den komplexa verkligheten inom psykiatrisk vård och den enorma potentialen i modern utbildningsteknik.
                    </p>
                    <p>
                        Min bakgrund inom vården är bred. Jag har mångårig erfarenhet som skötare från Rättspsykiatriska Kliniken i Sundsvall, som undersköterska inom kommunen och senast på PIVA. I min roll som handledare för undersköterskeelever och nyanställda har jag på nära håll sett den centrala utmaningen: hur överbryggar vi gapet mellan teoretisk kunskap och den intensiva, ofta oförutsägbara, kliniska vardagen? Jag har sett hur värdefull tid för handledning ibland går åt till att repetera grundläggande information – tid som skulle kunna användas för de djupa, reflekterande samtal som verkligen formar en blivande kollega.
                    </p>
                    <p>
                        Denna applikation är mitt svar på den utmaningen. Syftet är inte att ersätta den mänskliga handledaren, utan att <strong className="font-semibold text-slate-900 dark:text-slate-100">förstärka den</strong>. Genom att låta tekniken hantera det repetitiva och strukturerade kan vi frigöra tid och mentalt utrymme för det som verkligen räknas: den personliga vägledningen, det etiska resonemanget och den professionella utvecklingen.
                    </p>

                    <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-800/50 border-l-4 border-red-400 rounded-r-md">
                        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Projektets kontext</h3>
                        <p className="mt-2">
                           Appen är utvecklad som ett projektarbete inom kursen <strong className="font-semibold text-slate-900 dark:text-slate-100">"AI för undervisning och lärande"</strong>, som ges av <a href="https://www.ltu.se/" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:underline font-semibold">Luleå Tekniska Universitet (LTU)</a>. Kursen gav mig de verktyg som krävdes för att omvandla en pedagogisk vision till en fungerande prototyp.
                        </p>
                        <button 
                            onClick={() => setView('example-report')}
                            className="mt-4 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm btn-press"
                        >
                            Se exempelrapport för kursen &rarr;
                        </button>
                    </div>

                     <p className="mt-6">
                        Utöver vården är jag en kreativ och nyfiken person med ett stort intresse för tech, konst och musik. Denna nyfikenhet driver mig att ständigt utforska nya sätt att lösa gamla problem. Ett exempel är ett uppdrag för Sundsvalls Kommun via det digitala företaget <a href="https://ohmy.se/" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:underline font-semibold">OhMy</a>. I rollen som projektledare för mitt företag, Metaverse Innovation Sweden, skapade jag tillsammans med arkitekten Jinsuke Abe i Japan och civilingenjören Tomas i Skåne en digital tvilling av Sundsvalls torg i metaversum. Målet var att genom gamification engagera medborgare i utformningen av torget och göra stadsplanering till en spännande och inkluderande process.
                    </p>
                    <p>
                        Detta, tillsammans med många andra projekt bakom mig, är ett uttryck för min övertygelse om att teknik kan vara en kraftfull och positiv förändringsagent. Tack för att du är en del av denna resa – din feedback är avgörande för att forma framtidens lärande inom vården.
                    </p>
                </div>
            </div>
        </div>
    );
});

export default AboutCreator;