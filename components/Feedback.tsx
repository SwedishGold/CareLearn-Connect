
import React, { useState, memo, useCallback, useMemo } from 'react';
import { User, Role } from '../types';
import * as storage from '../services/localStorageService';
import { ICONS } from '../constants';
import { playTabSwitch, playSuccess } from '../services/soundService';

interface FeedbackProps {
  user: User;
}

const RatingButton: React.FC<{
  value: number;
  selectedValue: number;
  onClick: (val: number) => void;
  icon?: React.ReactNode;
  label?: string;
}> = ({ value, selectedValue, onClick, icon, label }) => (
    <button
        type="button"
        onClick={() => onClick(value)}
        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200 w-full aspect-square btn-press ${
            selectedValue === value
                ? 'bg-red-500 border-red-500 text-white shadow-lg scale-105'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-red-300 dark:hover:border-red-700'
        }`}
    >
        <div className="text-2xl mb-1">{icon || value}</div>
        {label && <span className="text-xs font-bold">{label}</span>}
    </button>
);

const StepIndicator: React.FC<{ currentStep: number; totalSteps: number }> = ({ currentStep, totalSteps }) => (
    <div className="flex justify-center items-center gap-2 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
            <div 
                key={i} 
                className={`h-2 rounded-full transition-all duration-300 ${
                    i === currentStep ? 'w-8 bg-red-500' : 'w-2 bg-slate-300 dark:bg-slate-700'
                }`}
            />
        ))}
    </div>
);

const Feedback: React.FC<FeedbackProps> = memo(({ user }) => {
  const [step, setStep] = useState(0);
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  const [feedback, setFeedback] = useState({
    overallImpression: 0,
    featureUsefulness: {
        checklist: 0,
        knowledgeTest: 0,
        structure: 0,
    },
    aiAndThinking: {
        viewOnAI: 0,
        criticalThinking: 0,
    },
    comments: '',
    title: '',
    otherTitle: '',
    ageRange: '',
    gender: ''
  });

  const isStudent = user.role.startsWith('usk') || user.role.startsWith('ssk') || user.role.startsWith('vikarie') || user.role.startsWith('anstalld');
  
  const titleOptions = [
    "Undersköterske-elev",
    "Sjuksköterske-student",
    "Vikarie (Skötare/USK)",
    "Vikarie (Sjuksköterska)",
    "Nyanställd",
    "Handledare",
    "Huvudhandledare",
    "Enhetschef",
    "Lärare",
    "Övrigt"
  ];

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    const finalTitle = feedback.title === 'Övrigt' ? feedback.otherTitle.trim() : feedback.title;

    if (!finalTitle || !feedback.ageRange || !feedback.gender) {
        alert("Vänligen fyll i alla obligatoriska fält.");
        return;
    }

    const feedbackData = {
      title: finalTitle,
      ageRange: feedback.ageRange,
      gender: feedback.gender as 'man' | 'kvinna' | 'vill-ej-ange',
      overallImpression: feedback.overallImpression,
      featureUsefulness: feedback.featureUsefulness,
      aiAndThinking: feedback.aiAndThinking,
      comments: feedback.comments.trim(),
    };

    // Save locally for admin dashboard preview
    storage.saveFeedback(feedbackData, user);
    
    // NEW: Notify developer immediately via simulated system
    storage.notifyDeveloper(`Ny feedback från ${user.name}`);
    
    playSuccess();
    setFormSubmitted(true);
    
    // Construct email body for developer
    const subject = `Feedback CareLearn Beta: ${finalTitle}`;
    const body = `
    Roll: ${finalTitle}
    Ålder: ${feedback.ageRange}
    Kön: ${feedback.gender}
    
    Helhetsbetyg: ${feedback.overallImpression}/5
    Nytta Checklista: ${feedback.featureUsefulness.checklist}/5
    Nytta Quiz: ${feedback.featureUsefulness.knowledgeTest}/5
    Nytta Struktur: ${feedback.featureUsefulness.structure}/5
    
    AI Värde: ${feedback.aiAndThinking.viewOnAI}/5
    Kritiskt Tänkande: ${feedback.aiAndThinking.criticalThinking}/5
    
    Kommentar:
    ${feedback.comments}
    `;
    
    // Trigger mailto after a short delay to show success state
    setTimeout(() => {
        window.location.href = `mailto:andreas.guldberg@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }, 1500);

  }, [feedback, user]);

  const handleNext = () => {
      if (step === 0 && (feedback.overallImpression === 0 || feedback.aiAndThinking.viewOnAI === 0)) {
          alert("Vänligen gör ett val för alla frågor.");
          return;
      }
      playTabSwitch();
      setStep(s => s + 1);
  };

  const handleBack = () => {
      playTabSwitch();
      setStep(s => s - 1);
  };

  if (formSubmitted) {
      return (
        <div className="card-base p-12 max-w-xl mx-auto text-center animate-fade-in">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Tack för din feedback!</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Eftersom detta är en beta-version öppnas nu ditt e-postprogram så att du kan skicka datan direkt till utvecklaren.</p>
            <button onClick={() => setFormSubmitted(false)} className="text-sm text-slate-500 hover:underline">Gå tillbaka</button>
        </div>
      );
  }

  return (
    <div className="card-base p-6 sm:p-8 max-w-3xl mx-auto min-h-[600px] flex flex-col">
        <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Utvärdera CareLearn (Beta)</h2>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">Din åsikt är avgörande för vidareutvecklingen. Steg {step + 1} av 3</p>
        </div>
        
        <StepIndicator currentStep={step} totalSteps={3} />

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            {step === 0 && (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border dark:border-slate-700">
                        <label className="block text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 text-center">
                            Hur upplever du appen som helhet?
                        </label>
                        <div className="grid grid-cols-5 gap-3 max-w-md mx-auto">
                            <RatingButton value={1} selectedValue={feedback.overallImpression} onClick={v => setFeedback(p => ({...p, overallImpression: v}))} icon="😠" label="Dålig" />
                            <RatingButton value={2} selectedValue={feedback.overallImpression} onClick={v => setFeedback(p => ({...p, overallImpression: v}))} icon="🙁" />
                            <RatingButton value={3} selectedValue={feedback.overallImpression} onClick={v => setFeedback(p => ({...p, overallImpression: v}))} icon="😐" label="Ok" />
                            <RatingButton value={4} selectedValue={feedback.overallImpression} onClick={v => setFeedback(p => ({...p, overallImpression: v}))} icon="🙂" />
                            <RatingButton value={5} selectedValue={feedback.overallImpression} onClick={v => setFeedback(p => ({...p, overallImpression: v}))} icon="🤩" label="Super" />
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border dark:border-slate-700">
                         <label className="block text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 text-center">
                            Hur värdefull är AI-Handledaren för ditt lärande?
                        </label>
                        <div className="grid grid-cols-5 gap-3 max-w-md mx-auto">
                            {[1, 2, 3, 4, 5].map(val => (
                                <RatingButton key={val} value={val} selectedValue={feedback.aiAndThinking.viewOnAI} onClick={v => setFeedback(p => ({...p, aiAndThinking: {...p.aiAndThinking, viewOnAI: v}}))} label={val.toString()} />
                            ))}
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2 px-2">
                            <span>Inte alls</span>
                            <span>Mycket värdefull</span>
                        </div>
                    </div>
                </div>
            )}

            {step === 1 && (
                <div className="space-y-6 animate-fade-in">
                    <div className="text-center mb-4">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Funktioner & Nytta</h3>
                        <p className="text-slate-500 text-sm">Skatta nyttan av specifika delar (1 = låg, 5 = hög)</p>
                    </div>

                    <div className="space-y-6">
                         {/* Adaptive Question 1 */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                {isStudent ? "Strukturen (Checklista & Mål)" : "Elev-översikten"}
                            </label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map(val => (
                                    <button type="button" key={val} onClick={() => setFeedback(p => ({...p, featureUsefulness: {...p.featureUsefulness, checklist: val}}))} className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${feedback.featureUsefulness.checklist === val ? 'bg-slate-800 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{val}</button>
                                ))}
                            </div>
                        </div>

                        {/* Adaptive Question 2 */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                {isStudent ? "Loggbok & Reflektion" : "AI-Analysverktygen"}
                            </label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map(val => (
                                    <button type="button" key={val} onClick={() => setFeedback(p => ({...p, featureUsefulness: {...p.featureUsefulness, structure: val}}))} className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${feedback.featureUsefulness.structure === val ? 'bg-slate-800 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{val}</button>
                                ))}
                            </div>
                        </div>

                        {/* Common Question */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Kunskapstest & Quiz
                            </label>
                             <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map(val => (
                                    <button type="button" key={val} onClick={() => setFeedback(p => ({...p, featureUsefulness: {...p.featureUsefulness, knowledgeTest: val}}))} className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${feedback.featureUsefulness.knowledgeTest === val ? 'bg-slate-800 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{val}</button>
                                ))}
                            </div>
                        </div>

                         <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Bidrar appen till kritiskt tänkande?
                            </label>
                             <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map(val => (
                                    <button type="button" key={val} onClick={() => setFeedback(p => ({...p, aiAndThinking: {...p.aiAndThinking, criticalThinking: val}}))} className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${feedback.aiAndThinking.criticalThinking === val ? 'bg-slate-800 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{val}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6 animate-fade-in">
                    <div className="text-center mb-4">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Om dig & Dina tankar</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Roll</label>
                            <select required value={feedback.title} onChange={e => setFeedback({ ...feedback, title: e.target.value, otherTitle: '' })} className="w-full p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border-transparent focus:border-red-500 focus:ring-0 text-slate-800 dark:text-slate-100">
                                <option value="" disabled>Välj...</option>
                                {titleOptions.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        {feedback.title === 'Övrigt' && (
                             <div className="md:col-span-2">
                                <input type="text" placeholder="Ange din roll" value={feedback.otherTitle} onChange={e => setFeedback({...feedback, otherTitle: e.target.value})} className="w-full p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border-transparent focus:border-red-500 focus:ring-0 text-slate-800 dark:text-slate-100"/>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ålder</label>
                            <select required value={feedback.ageRange} onChange={e => setFeedback({ ...feedback, ageRange: e.target.value })} className="w-full p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border-transparent focus:border-red-500 focus:ring-0 text-slate-800 dark:text-slate-100">
                                <option value="" disabled>Välj...</option>
                                <option value="18-25">18-25</option>
                                <option value="26-35">26-35</option>
                                <option value="36-45">36-45</option>
                                <option value="46-55">46-55</option>
                                <option value="56-65">56-65</option>
                                <option value="65+">65+</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kön</label>
                            <div className="flex gap-2">
                                {['kvinna', 'man', 'vill-ej-ange'].map(g => (
                                    <button key={g} type="button" onClick={() => setFeedback({...feedback, gender: g})} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${feedback.gender === g ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                                        {g === 'vill-ej-ange' ? 'Vill ej ange' : g.charAt(0).toUpperCase() + g.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Övriga kommentarer</label>
                        <textarea 
                            value={feedback.comments} 
                            onChange={e => setFeedback({...feedback, comments: e.target.value})} 
                            className="w-full p-4 rounded-lg bg-slate-100 dark:bg-slate-800 border-transparent focus:border-red-500 focus:ring-0 text-slate-800 dark:text-slate-100 min-h-[120px]" 
                            placeholder="Vad var bra? Vad kan bli bättre?"
                        />
                    </div>
                </div>
            )}

            <div className="mt-auto pt-8 flex justify-between gap-4">
                {step > 0 ? (
                    <button type="button" onClick={handleBack} className="px-6 py-3 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors btn-press">
                        Tillbaka
                    </button>
                ) : <div></div>}
                
                {step < 2 ? (
                    <button type="button" onClick={handleNext} className="px-8 py-3 rounded-lg bg-slate-800 dark:bg-white text-white dark:text-black font-bold hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors btn-press ml-auto">
                        Nästa
                    </button>
                ) : (
                    <button type="submit" className="px-8 py-3 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition-colors btn-press shadow-lg shadow-red-500/30 ml-auto">
                        Skicka Feedback
                    </button>
                )}
            </div>
        </form>
        <style>{`
            @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
        `}</style>
    </div>
  );
});

export default Feedback;
