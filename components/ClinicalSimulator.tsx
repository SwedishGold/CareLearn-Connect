
import React, { useState, useEffect } from 'react';
import { DailyChallenge, User, UserData, CompletedChallenge } from '../types';
import { generateDailyChallenge } from '../services/geminiService';
import { ICONS } from '../constants';
import { playClick, playSuccess, playError } from '../services/soundService';
import { toYYYYMMDD } from './UI';

interface ClinicalSimulatorProps {
    user: User;
    userData: UserData;
    onUpdateUserData: (data: Partial<UserData>) => void;
    onClose: () => void;
    isSimLimitReached: boolean;
    onChallengeComplete?: (isCorrect: boolean) => void;
}

export const ClinicalSimulator: React.FC<ClinicalSimulatorProps> = ({ user, userData, onUpdateUserData, onClose, isSimLimitReached, onChallengeComplete }) => {
    const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0); // 0: Analyze Logbook, 1: Check Goals, 2: Generate
    const [error, setError] = useState<string | null>(null);
    const [hasApiKey, setHasApiKey] = useState(false);
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
    const [revealResult, setRevealResult] = useState(false);
    const [view, setView] = useState<'challenge' | 'history'>('challenge');

    const todayStr = toYYYYMMDD(new Date());
    
    const todaysCompletedChallenge = userData.clinicalChallengeHistory?.find(h => h.timestamp.startsWith(todayStr));

    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio && window.aistudio.hasSelectedApiKey) {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                setHasApiKey(hasKey);
            } else {
                setHasApiKey(true); 
            }
        };
        checkKey();
    }, []);

    const handleSelectKey = async () => {
        if (window.aistudio && window.aistudio.openSelectKey) {
            await window.aistudio.openSelectKey();
            setHasApiKey(true);
        }
    };

    useEffect(() => {
        if (view === 'challenge' && hasApiKey && !challenge && !loading) {
            if (todaysCompletedChallenge) {
                setChallenge(todaysCompletedChallenge.challenge);
                setSelectedOptionId(todaysCompletedChallenge.selectedOptionId);
                setRevealResult(true);
            } else if (!isSimLimitReached) {
                startChallenge();
            } else {
                setView('history');
            }
        }
    }, [hasApiKey, view, isSimLimitReached, todaysCompletedChallenge]);

    const startChallenge = async () => {
        setLoading(true);
        setError(null);
        setLoadingStep(0);

        // Simulate analysis steps for UX
        setTimeout(() => setLoadingStep(1), 1000);
        setTimeout(() => setLoadingStep(2), 2000);

        try {
            const result = await generateDailyChallenge(user.role, userData);
            setChallenge(result);
            
            const todayStr = toYYYYMMDD(new Date());
            const currentCount = userData.dailySimulatorUsage?.date === todayStr ? userData.dailySimulatorUsage.count : 0;
            onUpdateUserData({ 
                dailySimulatorUsage: { date: todayStr, count: currentCount + 1 } 
            });

        } catch (e) {
            setError("Kunde inte ladda dagens utmaning. Kontrollera din anslutning.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleOptionSelect = (optionId: string, isCorrect: boolean) => {
        if (revealResult) return; 
        
        setSelectedOptionId(optionId);
        setRevealResult(true);
        
        if (isCorrect) {
            playSuccess();
        } else {
            playError();
        }

        if (challenge) {
            const newHistoryItem: CompletedChallenge = {
                id: `chal-${Date.now()}`,
                timestamp: new Date().toISOString(),
                challenge: challenge,
                selectedOptionId: optionId,
                isCorrect: isCorrect
            };
            const currentHistory = userData.clinicalChallengeHistory || [];
            const updatedHistory = [...currentHistory, newHistoryItem];
            onUpdateUserData({ clinicalChallengeHistory: updatedHistory });
            
            if (onChallengeComplete) {
                onChallengeComplete(isCorrect);
            }
        }
    };

    const renderHistory = () => {
        const history = userData.clinicalChallengeHistory || [];
        if (history.length === 0) {
            return <p className="text-slate-400 text-center mt-8">Ingen historik än.</p>;
        }
        
        return (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {[...history].reverse().map((item, index) => (
                    <div key={item.id} className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-slate-200">{item.challenge.title}</h4>
                            <span className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-slate-400 mb-3 line-clamp-2">{item.challenge.scenario}</p>
                        <div className={`text-sm font-bold ${item.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                            {item.isCorrect ? '✓ Rätt svarat' : '✗ Fel svarat'}
                        </div>
                        <button 
                            onClick={() => {
                                setChallenge(item.challenge);
                                setSelectedOptionId(item.selectedOptionId);
                                setRevealResult(true);
                                setView('challenge');
                            }}
                            className="mt-2 text-xs text-purple-400 hover:underline"
                        >
                            Visa detaljer & feedback
                        </button>
                    </div>
                ))}
            </div>
        );
    };

    if (!hasApiKey) {
        return (
            <div className="card-base p-8 text-center">
                <h2 className="text-2xl font-bold text-slate-100 mb-4">API-nyckel krävs</h2>
                <p className="text-slate-300 mb-6">För att köra dagens kliniska utmaning krävs en API-nyckel.</p>
                <button onClick={handleSelectKey} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 btn-press">Välj Nyckel</button>
                <button onClick={onClose} className="block mt-4 text-slate-500 hover:underline mx-auto">Avbryt</button>
            </div>
        );
    }

    const getLoadingText = () => {
        switch(loadingStep) {
            case 0: return "Analyserar dina loggboksinlägg...";
            case 1: return "Identifierar kunskapsluckor i checklistan...";
            default: return "Skapar ditt unika patientfall...";
        }
    };

    return (
        <div className="card-base p-0 overflow-hidden flex flex-col max-w-2xl mx-auto shadow-2xl border border-purple-500/30 h-full max-h-[80vh]">
            {/* Header */}
            <div className="bg-slate-900/80 p-4 border-b border-slate-700 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-900/50 rounded-lg text-purple-300 border border-purple-500/30">
                        {ICONS.brain}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-100">Dagens Kliniska Utmaning</h3>
                        <p className="text-xs text-purple-300 uppercase tracking-wider font-bold">Personanpassat Fall</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-900 border-b border-slate-700">
                <button 
                    onClick={() => setView('challenge')} 
                    className={`flex-1 py-3 text-sm font-bold transition-colors ${view === 'challenge' ? 'text-purple-400 border-b-2 border-purple-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Dagens Fall
                </button>
                <button 
                    onClick={() => setView('history')} 
                    className={`flex-1 py-3 text-sm font-bold transition-colors ${view === 'history' ? 'text-purple-400 border-b-2 border-purple-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Historik
                </button>
            </div>

            <div className="p-6 md:p-8 bg-gradient-to-b from-slate-800 to-slate-900 overflow-y-auto flex-1">
                {view === 'history' ? (
                    renderHistory()
                ) : loading ? (
                     <div className="h-full flex flex-col items-center justify-center text-center">
                        <div className="relative mb-6">
                            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500"></div>
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-purple-400">AI</div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-200 animate-pulse transition-all duration-500">
                            {getLoadingText()}
                        </h3>
                    </div>
                ) : error ? (
                    <div className="text-center">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button onClick={onClose} className="bg-slate-700 text-white px-6 py-2 rounded hover:bg-slate-600">Stäng</button>
                    </div>
                ) : challenge ? (
                    <>
                         {/* Scenario Card */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-white mb-3">{challenge.title}</h2>
                            <div className="p-5 bg-slate-800 rounded-xl border border-slate-700 text-slate-200 text-lg leading-relaxed shadow-inner">
                                {challenge.scenario}
                            </div>
                        </div>

                        {/* Options */}
                        <div className="space-y-4">
                            {challenge.options.map((option) => {
                                let btnClass = "w-full p-4 rounded-xl border-2 text-left transition-all duration-300 relative overflow-hidden group ";
                                const isSelected = selectedOptionId === option.id;
                                
                                if (revealResult) {
                                    if (option.isCorrect) {
                                        btnClass += "bg-green-900/30 border-green-500 text-green-100 shadow-[0_0_15px_rgba(34,197,94,0.3)]";
                                    } else if (isSelected && !option.isCorrect) {
                                        btnClass += "bg-red-900/30 border-red-500 text-red-100 opacity-100";
                                    } else {
                                        btnClass += "bg-slate-800 border-slate-700 text-slate-500 opacity-50";
                                    }
                                } else {
                                    btnClass += "bg-slate-800 border-slate-600 hover:border-purple-400 hover:bg-slate-750 text-slate-200 hover:shadow-lg btn-press";
                                }

                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => handleOptionSelect(option.id, option.isCorrect)}
                                        disabled={revealResult}
                                        className={btnClass}
                                    >
                                        <div className="flex items-center">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mr-4 transition-colors ${
                                                revealResult 
                                                    ? (option.isCorrect ? 'bg-green-500 text-white' : (isSelected ? 'bg-red-500 text-white' : 'bg-slate-600 text-slate-400'))
                                                    : 'bg-slate-700 text-slate-300 group-hover:bg-purple-500 group-hover:text-white'
                                            }`}>
                                                {option.id}
                                            </div>
                                            <span className="font-medium">{option.text}</span>
                                            {revealResult && option.isCorrect && (
                                                <span className="ml-auto text-green-400 font-bold">✓ RÄTT</span>
                                            )}
                                            {revealResult && isSelected && !option.isCorrect && (
                                                <span className="ml-auto text-red-400 font-bold">✗ FEL</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Feedback Section (Revealed after choice) */}
                        {revealResult && challenge.options.find(o => o.id === selectedOptionId) && (
                            <div className="mt-8 animate-fade-in-up pb-4">
                                <div className={`p-6 rounded-xl border-l-4 shadow-lg ${challenge.options.find(o => o.id === selectedOptionId)?.isCorrect ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'}`}>
                                    <h4 className={`font-bold text-lg mb-2 ${challenge.options.find(o => o.id === selectedOptionId)?.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                        {challenge.options.find(o => o.id === selectedOptionId)?.isCorrect ? "Utmärkt resonerat!" : "Inte riktigt rätt..."}
                                    </h4>
                                    <p className="text-slate-200 leading-relaxed">
                                        {challenge.options.find(o => o.id === selectedOptionId)?.feedback}
                                    </p>
                                    
                                    {!challenge.options.find(o => o.id === selectedOptionId)?.isCorrect && (
                                        <div className="mt-4 pt-4 border-t border-white/10">
                                            <p className="text-sm text-slate-400 uppercase font-bold mb-1">Rätt lösning:</p>
                                            <p className="text-slate-300 text-sm">
                                                {challenge.options.find(o => o.isCorrect)?.feedback}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                {todaysCompletedChallenge && (
                                    <p className="text-center text-slate-500 text-xs mt-4">Detta resultat är sparat i din historik.</p>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center mt-8">
                        <p className="text-slate-400 mb-4">Ingen utmaning laddad.</p>
                        <button 
                            onClick={startChallenge} 
                            disabled={isSimLimitReached && !todaysCompletedChallenge}
                            className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500"
                        >
                            Starta Utmaning
                        </button>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
            `}</style>
        </div>
    );
};
