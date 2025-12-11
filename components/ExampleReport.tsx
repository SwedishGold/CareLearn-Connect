import React, { memo } from 'react';

const ExampleReport: React.FC = memo(() => {
    return (
        <div className="card-base p-8 max-w-4xl mx-auto text-slate-700 dark:text-slate-300 leading-relaxed">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-4">Exempelrapport: Implementation av AI i Undervisning</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-6">Detta är en exempelrapport skriven utifrån PIVA Lärplattform som scenario, för att illustrera hur examinationsuppgiften kan besvaras.</p>
            
            <hr className="my-8 border-slate-200 dark:border-slate-700" />

            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-8 mb-4">Rubrik 1: Scenariobeskrivning</h2>
            
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">Kontext</h3>
            <ul className="list-disc list-inside space-y-2 pl-4 mb-4">
                <li><strong className="font-semibold text-slate-800 dark:text-slate-200">Skolämne:</strong> Vård och omsorg, specifikt inom psykiatrisk omvårdnad.</li>
                <li><strong className="font-semibold text-slate-800 dark:text-slate-200">Årskurs/kurstyp:</strong> Undersköterskeelever under sitt Arbetsplatsförlagda Lärande (APL) på en psykiatrisk intensivvårdsavdelning (PIVA).</li>
                <li><strong className="font-semibold text-slate-800 dark:text-slate-200">Gruppstorlek:</strong> 1-2 elever per handledare.</li>
                <li><strong className="font-semibold text-slate-800 dark:text-slate-200">Tid:</strong> Ett kontinuerligt moment under hela APL-perioden (cirka 8 veckor).</li>
                <li><strong className="font-semibold text-slate-800 dark:text-slate-200">Förkunskaper:</strong> Eleverna förväntas ha grundläggande kunskaper i omvårdnad men är nybörjare inom den psykiatriska specialistvården. De saknar praktisk erfarenhet av att arbeta med patienter i akut psykisk kris.</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">Pedagogisk vinkel</h3>
            <p>Den pedagogiska vinkeln är <strong className="font-semibold text-slate-800 dark:text-slate-200">formativ återkoppling</strong>. Målet är att skapa en kontinuerlig dialog kring studentens lärande, där återkoppling inte är en slutprodukt utan en integrerad del av den dagliga lärprocessen. I detta scenario innebär det att både studenten och handledaren får ett datadrivet underlag som synliggör progression och identifierar utvecklingsområden i realtid. Detta underlag blir startpunkten för reflekterande och framåtsyftande samtal, vilket stärker studentens förmåga till självutvärdering och metakognition.</p>

            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">AI-system</h3>
            <p>AI-systemet som implementeras är av typen <strong className="font-semibold text-slate-800 dark:text-slate-200">Generativ text</strong>, specifikt en avancerad språkmodell (t.ex. Google Gemini) integrerad i CareLearn. AI:n fungerar som en "AI-Handledare" med två preciserade huvudfunktioner:</p>
            <ol className="list-decimal list-inside space-y-2 pl-4 my-4">
                <li><strong className="font-semibold text-slate-800 dark:text-slate-200">För studenten:</strong> Analysera studentens samlade data (checklista, loggbok, skattade lärandemål) för att generera en personlig "Veckans Fokus" med förslag på vad studenten kan ägna extra uppmärksamhet åt.</li>
                <li><strong className="font-semibold text-slate-800 dark:text-slate-200">För handledaren:</strong> Syntetisera en enskild students data till en koncis, strukturerad rapport som belyser styrkor, utvecklingsområden och föreslår diskussionspunkter inför handledningssamtal.</li>
            </ol>
            
            <hr className="my-8 border-slate-200 dark:border-slate-700" />

            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-8 mb-4">Rubrik 2: Implementering</h2>
            
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">Vad ska AI-systemet användas till?</h3>
            <p>Målet med AI-systemet är att <strong className="font-semibold text-slate-800 dark:text-slate-200">effektivisera och fördjupa den formativa återkopplingen</strong>. För studenten är målet att få ett personaliserat och direkt stöd som hjälper dem att själva se och reflektera över sitt lärande. För handledaren är målet att snabbt få en datadriven överblick som frigör tid från administrativ informationsinsamling till kvalitativt pedagogiskt samtal.</p>
            
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">Hur tänker du att AI ska användas för att nå målet?</h3>
            <p>När studenten loggar in på sin översiktssida möts hen av en AI-genererad ruta med "Veckans Fokus". Denna text har skapats genom att AI:n analyserat studentens senaste aktivitet.</p>
            <p>När handledaren förbereder sig för ett veckosamtal kan hen med ett klick generera en AI-rapport för studenten. Rapporten sammanfattar data och presenterar den i ett lättöverskådligt format, t.ex.:</p>
            <ul className="list-disc list-inside space-y-2 pl-4 my-4">
                <li><strong className="font-semibold text-slate-800 dark:text-slate-200">Styrkor:</strong> "Stina skriver konsekvent i loggboken och har slutfört 80% av checklistan."</li>
                <li><strong className="font-semibold text-slate-800 dark:text-slate-200">Utvecklingsområden:</strong> "Hon har skattat sig lågt på lärandemålet om lagar och verkar undvika att reflektera kring det."</li>
                <li><strong className="font-semibold text-slate-800 dark:text-slate-200">Förslag på diskussionspunkter:</strong> "Fråga Stina vad som känns svårt med LPT och HSL. Utgå från hennes loggboksinlägg om den arga patienten för att diskutera bemötande."</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">Vad finns det för fördelar med att använda AI i detta fall?</h3>
            <p>Den främsta fördelen är <strong className="font-semibold text-slate-800 dark:text-slate-200">personaliserad och omedelbar återkoppling</strong>. Istället för generell feedback får studenten specifika, datadrivna förslag. För handledaren är fördelen en enorm tidsbesparing och ett objektivt underlag som säkerställer att inga viktiga delar av studentens utveckling missas. Det skapar förutsättningar för mer djupgående och mindre administrativt tunga handledningssamtal.</p>
            
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">Vad finns det för risker (etiska och/regulatoriska) med att implementera AI enligt ditt förslag?</h3>
            <p>En <strong className="font-semibold text-slate-800 dark:text-slate-200">etisk risk</strong> är att studenten upplever en känsla av att vara konstant övervakad av en algoritm, vilket kan hämma ärligheten i deras reflektioner. Detta är särskilt problematiskt i en vårdkontext där äkta reflektion kring svåra etiska situationer är avgörande. Om studenten börjar skriva vad hen tror AI:n vill "höra" försvinner lärandemomentet. Det är kritiskt att AI:ns roll kommuniceras som ett stöd, inte ett kontrollverktyg. En annan risk är <strong className="font-semibold text-slate-800 dark:text-slate-200">confirmation bias</strong> hos handledaren; om AI:n flaggar ett "problem" kan handledaren omedvetet leta efter bevis som stärker den bilden, vilket kan leda till en orättvis bedömning.</p>

            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">Vad finns det för hinder med implementeringen (kulturella och/eller tekniska)?</h3>
            <p>Ett <strong className="font-semibold text-slate-800 dark:text-slate-200">kulturellt hinder</strong> kan vara skepticism från erfarna handledare som känner att deras professionella omdöme och "magkänsla" ifrågasätts av en maskin. Inom vården finns en stark tradition av personlig kunskapsöverföring, och att introducera ett AI-verktyg kan ses som opersonligt. Det krävs därför utbildning och transparens för att visa att AI:n är ett verktyg för att <em className="italic">förstärka</em>, inte ersätta, deras kompetens. Ett <strong className="font-semibold text-slate-800 dark:text-slate-200">tekniskt hinder</strong> är beroendet av en fungerande och säker API-koppling, samt risken för att AI-modellen ger generiska eller irrelevanta svar om den inte får tillräckligt bra indata från studenten.</p>

            <hr className="my-8 border-slate-200 dark:border-slate-700" />
            
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-8 mb-4">Rubrik 3: Effekt på lärandet</h2>

            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">Bedömning av effekt</h3>
            <p>Jag bedömer att en implementering av denna AI-typ i det givna scenariot får en <strong className="font-semibold text-slate-800 dark:text-slate-200">tydligt positiv effekt på lärandet</strong>.</p>
            
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">Motivering</h3>
            <p>Effekten uppstår inte för att AI:n "lär ut" något, utan för att den <strong className="font-semibold text-slate-800 dark:text-slate-200">förstärker och effektiviserar den formativa återkopplingsprocessen</strong>, vilket är en bevisat stark drivkraft för lärande.</p>
            <ol className="list-decimal list-inside space-y-2 pl-4 my-4">
                <li><strong className="font-semibold text-slate-800 dark:text-slate-200">Den främjar metakognition:</strong> Genom att AI:n synliggör kopplingar (eller avsaknad av kopplingar) mellan studentens olika aktiviteter, tvingas studenten att reflektera över sitt eget lärande på en högre nivå. Frågan går från "Vad har jag gjort?" till "Hur hänger det jag har gjort ihop med vad jag förväntas lära mig?". Detta är en grundläggande färdighet för livslångt lärande i vårdyrket.</li>
                <li><strong className="font-semibold text-slate-800 dark:text-slate-200">Den kvalificerar handledningen:</strong> När handledaren slipper lägga tid på att manuellt sammanställa information kan samtalet istället fokusera på de komplexa, nyanserade och etiska aspekterna av omvårdnadsyrket som AI:n inte kan hantera. AI:n tar hand om "vad" (data), så att människan kan fokusera på "hur" och "varför" (visdom och omdöme).</li>
            </ol>
            <p>Lärandet sker alltså i symbiosen mellan AI:ns databearbetning och den efterföljande mänskliga dialogen, vilket leder till en djupare och mer reflekterande inlärningsupplevelse.</p>
        </div>
    );
});

export default ExampleReport;