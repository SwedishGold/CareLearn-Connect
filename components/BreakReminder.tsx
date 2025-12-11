
import React, { useState, useEffect, memo } from 'react';
import { ICONS } from '../constants';
import { InfoTooltip } from './UI';

const MESSAGES = [
    "Dags för paus. Sträck på benen.",
    "Vila ögonen. Titta bort från skärmen i 20 sekunder.",
    "Rörelsepaus. Res dig upp och gå ett varv.",
    "Hydrering. Har du druckit vatten nyligen?",
    "Axlar ner. Ta ett djupt andetag."
];

const BreakReminder: React.FC = memo(() => {
    const [message, setMessage] = useState<string | null>(null);
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        // Initial setup
        const interval = setInterval(() => {
            triggerReminder();
        }, 15 * 60 * 1000); // 15 minutes

        return () => clearInterval(interval);
    }, []);

    const triggerReminder = () => {
        const randomMsg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
        setMessage(randomMsg);
        setIsActive(true);

        // Hide after 30 seconds
        setTimeout(() => {
            setIsActive(false);
            setMessage(null);
        }, 30000);
    };

    return (
        <div className="card-base p-6 flex flex-col justify-between h-full min-h-[150px] relative overflow-hidden group border-l-4 border-l-transparent transition-all duration-500" 
             style={{ borderColor: isActive ? '#ef4444' : undefined }}>
            
            <div className="flex justify-between items-start z-10">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 transition-colors duration-500 ${isActive ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span>Hälso-monitor</span>
                    <InfoTooltip text="Påminner dig regelbundet om att ta mikropauser för att vila ögonen och kroppen. Detta hjälper dig att behålla fokus under dagen." />
                </h3>
                <div className={`px-2 py-1 rounded text-[10px] font-mono font-bold border ${isActive ? 'bg-red-500 text-white border-red-500' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 border-slate-300 dark:border-slate-600'}`}>
                    {isActive ? 'ALERT' : 'STANDBY'}
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center relative my-4">
                {isActive ? (
                    <div className="w-full overflow-hidden relative h-12 flex items-center">
                        <div className="whitespace-nowrap animate-marquee text-lg font-bold text-red-600 dark:text-red-400">
                            {message} &nbsp; • &nbsp; {message} &nbsp; • &nbsp; {message}
                        </div>
                    </div>
                ) : (
                    <div className="text-center">
                        <p className="text-sm text-slate-400 font-mono">SYSTEM: NORMAL</p>
                        <div className="w-16 h-1 bg-slate-200 dark:bg-slate-700 mx-auto mt-2 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 w-1/2 animate-pulse"></div>
                        </div>
                    </div>
                )}
            </div>

            <p className="text-xs text-slate-400 text-center z-10">
                {isActive ? "Ta en paus från skärmen." : "Påminner dig var 15:e minut."}
            </p>

            {/* Background decoration */}
            {isActive && (
                <div className="absolute inset-0 bg-red-500/5 dark:bg-red-900/10 pointer-events-none animate-pulse"></div>
            )}

            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                }
                .animate-marquee {
                    animation: marquee 10s linear infinite;
                }
            `}</style>
        </div>
    );
});

export default BreakReminder;
