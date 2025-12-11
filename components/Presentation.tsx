
import React, { useState, useEffect, memo, useCallback } from 'react';
import * as storage from '../services/localStorageService';
import { User } from '../types';
import { getRoleDisplayName } from './UI';

interface SectionData {
    title: string;
    description: string;
    image: {
        src: string;
        alt: string;
    };
}

const ImageHighlight: React.FC<{ src: string, alt: string, onImageUpload: (file: File) => void, isAdmin: boolean }> = ({ src, alt, onImageUpload, isAdmin }) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onImageUpload(file);
        }
    };
    
    return (
        <div className="my-4 relative group">
            <img src={src} alt={alt} className="max-w-full rounded-lg shadow-lg border dark:border-slate-700" />
            {isAdmin && (
                <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span>Byt bild</span>
                    <input type="file" className="hidden" accept="image/png, image/jpeg, image/gif" onChange={handleFileChange} />
                </label>
            )}
        </div>
    );
};

interface PresentationProps {
    user: User;
    onBack: () => void;
}

const Presentation: React.FC<PresentationProps> = memo(({ user, onBack }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [customImages, setCustomImages] = useState<{ [key: number]: string }>({});
    const [workplaceName, setWorkplaceName] = useState<string>('Avdelningen');

    useEffect(() => {
        const fetchSettings = async () => {
            setCustomImages(storage.loadPresentationImages());
            const settings = await storage.loadDepartmentSettings();
            if (settings?.workplaceName) {
                setWorkplaceName(settings.workplaceName);
            }
        };
        fetchSettings();
    }, []);
    
    const roleDisplay = getRoleDisplayName(user.role);

    const sections: SectionData[] = [
        {
            title: `1. Välkommen till CareLearn Connect`,
            description: `Hej ${roleDisplay}! Du är nu en del av det sociala kunskapsnätverket på ${workplaceName}. CareLearn Connect är designat för att koppla ihop teori, praktik och kollegor i en modern plattform.`,
            image: { src: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=800&auto=format&fit=crop", alt: "Kollegor som samarbetar och nätverkar." }
        },
        {
            title: "2. Bygg din Profil & Nätverk",
            description: "Hitta din handledare och dina kollegor i 'Connect'-vyn. Skicka signaler, be om signaturer på din checklista och se vilka som är aktiva på din enhet. Du är inte ensam i ditt lärande.",
            image: { src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=800&auto=format&fit=crop", alt: "Digitalt nätverk av människor." }
        },
        {
            title: "3. Level Up: XP & Gamification",
            description: "Allt du gör ger XP! Klarar du checklistan? +50 XP. Skriver du loggbok? +100 XP. Se din 'Level' stiga på startsidan och lås upp nya utmärkelser ('Badges') när du når milstolpar. Gör lärandet till en resa.",
            image: { src: "https://images.unsplash.com/photo-1553481187-be93c21490a9?q=80&w=800&auto=format&fit=crop", alt: "Spel-element och troféer." }
        },
        {
            title: "4. AI-Handledaren & Kunskapsbanken",
            description: "Din AI-assistent har läst in era lokala rutiner och dokument. Ställ frågor dygnet runt, få hjälp att formulera svåra loggboksinlägg eller be om en 'Second Opinion'. AI:n vet vad som gäller på just er arbetsplats.",
            image: { src: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=800&auto=format&fit=crop", alt: "AI-visualisering och digital hjärna." }
        },
        {
            title: "5. Kommunikationslabbet: Träna säkert",
            description: "Osäker på hur du ska bemöta en orolig vårdtagare? I vårt simulator-labb får du prata med en AI-röst. Du får även en bild av situationen. Efteråt får du feedback på din empati och tydlighet. En trygg plats att göra fel på.",
            image: { src: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=800&auto=format&fit=crop", alt: "En närbild på en mikrofon i en studio." }
        },
        {
            title: "6. Dagens Kliniska Utmaning",
            description: "Varje dag får du ett nytt, unikt patientfall genererat av AI baserat på din roll. Det tränar din förmåga att fatta snabba, kliniska beslut. Systemet lär sig av dina svar och anpassar svårighetsgraden.",
            image: { src: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=800&auto=format&fit=crop", alt: "En person som löser ett komplext pussel eller tittar på medicinsk data." }
        },
        {
            title: "7. Loggbok med Röst & Analys",
            description: "Reflektion är nyckeln. Diktera dina tankar direkt med rösten efter ett pass. AI-handledaren analyserar dina inlägg, hittar mönster i din utveckling och ställer djupa frågor som får dig att tänka ett steg längre.",
            image: { src: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?q=80&w=800&auto=format&fit=crop", alt: "En digital ljudvåg och en anteckningsbok." }
        },
        {
            title: "8. Säkerhet & AI-Körkortet",
            description: "Innan du får tillgång till de avancerade AI-funktionerna måste du ta ditt 'AI-Körkort'. Vi lär dig hur du använder tekniken ansvarsfullt och varför patientsekretess är heligt i en digital värld.",
            image: { src: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?q=80&w=800&auto=format&fit=crop", alt: "Ett digitalt lås eller sköld som symboliserar datasäkerhet." }
        },
        {
            title: "9. Din Profil & Inställningar",
            description: "Under din profil kan du anpassa appen. Byt mellan Ljust och Mörkt tema, uppdatera din API-nyckel för obegränsad AI-kraft, och se din samlade statistik.",
            image: { src: "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?q=80&w=800&auto=format&fit=crop", alt: "Inställningar och profilhantering." }
        },
        {
            title: "10. Redo att börja?",
            description: `CareLearn Connect är mer än en app – det är din digitala partner i vardagen. Koppla upp dig, börja samla XP och utvecklas tillsammans med dina kollegor på ${workplaceName}. Nu kör vi!`,
            image: { src: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=800&auto=format&fit=crop", alt: "En hand som trycker på en start-knapp." }
        }
    ];

    useEffect(() => {
        // Preload all images to prevent lag on step change
        sections.forEach((section, index) => {
            const img = new Image();
            // Check for a custom image first, otherwise use the default
            const imgSrc = customImages[index] || section.image.src;
            img.src = imgSrc;
        });
    }, [sections, customImages]);

    const totalSteps = sections.length;
    const isLastSection = currentStep === sections.length - 1;

    const handleImageUpload = useCallback((stepIndex: number) => (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1280;
                const MAX_HEIGHT = 720;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

                try {
                    storage.savePresentationImage(stepIndex, dataUrl);
                    setCustomImages(prev => ({ ...prev, [stepIndex]: dataUrl }));
                } catch (e) {
                    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
                        alert('Kunde inte spara bilden. Lagringsutrymmet i webbläsaren är fullt. Ta bort andra bilder för att frigöra utrymme.');
                    } else {
                         alert('Ett okänt fel uppstod vid sparande av bilden.');
                    }
                }
            };
            if (event.target?.result) img.src = event.target.result as string;
        };
        reader.readAsDataURL(file);
    }, []);

    const handleNext = () => {
        if (currentStep < totalSteps - 1) setCurrentStep(currentStep + 1);
    };

    const handlePrev = () => {
        if (currentStep > 0) setCurrentStep(currentStep - 1);
    };

    return (
        <div className="card-base p-8 max-w-4xl mx-auto">
            <div className="relative">
                <h1 className="text-3xl font-bold text-center text-slate-800 dark:text-slate-100">Välkommen till CareLearn Connect</h1>
            </div>
            <p className="text-center text-slate-600 dark:text-slate-400 mt-2 mb-8">En introduktion till ditt nya digitala nätverk.</p>

            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-8">
                <div 
                    className="bg-red-500 h-2.5 rounded-full transition-all duration-500" 
                    style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}>
                </div>
            </div>

            <div className="min-h-[450px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div key={`text-${currentStep}`} className="md:pr-8 animate-fade-in">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{sections[currentStep].title}</h2>
                        <p className="mt-2 text-slate-600 dark:text-slate-300 leading-relaxed">{sections[currentStep].description}</p>
                    </div>
                    <div key={`image-${currentStep}`} className="animate-fade-in">
                         <ImageHighlight 
                            src={customImages[currentStep] || sections[currentStep].image.src} 
                            alt={sections[currentStep].image.alt} 
                            onImageUpload={handleImageUpload(currentStep)}
                            isAdmin={user.role === 'admin'}
                         />
                    </div>
                </div>
            </div>

            <div className="mt-12 flex justify-between items-center">
                <button onClick={handlePrev} disabled={currentStep === 0} className="bg-slate-200 text-slate-700 font-bold py-2 px-6 rounded-lg hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed btn-press">
                    Föregående
                </button>

                {!isLastSection ? (
                    <button onClick={handleNext} className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-600 btn-press">
                        Nästa
                    </button>
                ) : (
                    <button onClick={onBack} className="bg-red-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-red-600 transition-colors btn-press">
                        Gör AI-Körkortet
                    </button>
                )}
            </div>
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
});

export default Presentation;
