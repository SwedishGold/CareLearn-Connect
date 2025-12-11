
import React, { useState, useEffect, useMemo } from 'react';
import { GoalsProgress, Role } from '../types';
import { APP_DATA, ICONS } from '../constants';
import { InfoTooltip } from './UI';
import { getAIMetacognitivePrompt } from '../services/geminiService';

interface GoalsProps {
  progress: GoalsProgress;
  onSave: (newProgress: GoalsProgress) => void;
  userRole: Role;
  isReadOnly?: boolean;
  // NEW: Dynamic items
  customItems?: { id: string; text: string }[];
}

const Goals: React.FC<GoalsProps> = ({ progress, onSave, userRole, isReadOnly = false, customItems }) => {
  const [localProgress, setLocalProgress] = useState<GoalsProgress>(progress);
  const [saveConfirmation, setSaveConfirmation] = useState(false);
  const [aiHelp, setAiHelp] = useState<{ goalId: string; questions: string; isLoading: boolean } | null>(null);

  // Use custom items if provided, else default
  const goalsList = useMemo(() => {
      return (customItems && customItems.length > 0) ? customItems : APP_DATA.knowledgeRequirements;
  }, [customItems]);

  useEffect(() => {
    setLocalProgress(progress);
  }, [progress]);

  const handleRatingChange = (goalId: string, rating: number) => {
    if (isReadOnly) return;
    setLocalProgress(prev => ({
      ...prev,
      [goalId]: { ...(prev[goalId] || { reflection: '' }), rating },
    }));
  };

  const handleReflectionChange = (goalId: string, reflection: string) => {
    if (isReadOnly) return;
    setLocalProgress(prev => ({
      ...prev,
      [goalId]: { ...(prev[goalId] || { rating: 0 }), reflection },
    }));
  };

  const handleGetAIHelp = async (goalId: string, goalText: string) => {
    if (aiHelp?.goalId === goalId) {
        setAiHelp(null);
        return;
    }
    const currentReflection = localProgress[goalId]?.reflection || '';
    setAiHelp({ goalId, questions: '', isLoading: true });
    const questions = await getAIMetacognitivePrompt(goalText, currentReflection, userRole);
    setAiHelp({ goalId, questions, isLoading: false });
  };

  const handleSave = () => {
    onSave(localProgress);
    setSaveConfirmation(true);
    setTimeout(() => setSaveConfirmation(false), 3000);
  };

  return (
    <div className="card-base p-6">
      {isReadOnly ? (
        <div className="mb-6 p-4 bg-blue-100 dark:bg-blue-900/40 border-l-4 border-blue-400 text-blue-800 dark:text-blue-200 rounded-r-md">
          <p><strong className="font-bold">Observera:</strong> Du granskar studentens egna skattningar och reflektioner. Denna vy är skrivskyddad.</p>
        </div>
      ) : (
        <div className="flex items-start mb-6">
          <p className="text-slate-600 dark:text-slate-300 flex-1">Skatta hur säker du känner dig och koppla dina erfarenheter och reflektioner till varje lärandemål. Dina svar sparas när du klickar på knappen längst ner.</p>
          <InfoTooltip align="right" text="Skatta din egen förmåga från 1 (osäker) till 5 (mycket säker). Använd textrutan för att koppla dina praktiska erfarenheter till varje mål. Detta hjälper dig och din handledare att se din utveckling." />
        </div>
      )}
      
      <div className="space-y-6">
        {goalsList.map((req, index) => {
          const currentProgress = localProgress[req.id] || { rating: 0, reflection: '' };
          return (
            <div key={req.id} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg border border-slate-200 dark:border-slate-700 stagger-item" style={{ '--stagger-delay': `${index * 100}ms` } as React.CSSProperties}>
              <p className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4">{req.text}</p>
              
              <div className="mb-4">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Min skattning (1=Osäker, 5=Mycket säker):</label>
                <div className="flex items-center gap-3 mt-2">
                  {[1, 2, 3, 4, 5].map(val => (
                    <button
                      key={val}
                      onClick={() => handleRatingChange(req.id, val)}
                      disabled={isReadOnly}
                      className={`w-12 h-12 rounded-full transition-all duration-200 text-lg font-bold flex items-center justify-center border-2 ${
                        currentProgress.rating === val
                          ? 'bg-red-500 border-red-500 text-white shadow-lg transform scale-110'
                          : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-red-400 dark:hover:border-red-500'
                      } ${isReadOnly ? 'cursor-default' : 'btn-press'}`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Min Reflektion:</label>
                  <textarea
                    value={currentProgress.reflection}
                    onChange={(e) => handleReflectionChange(req.id, e.target.value)}
                    readOnly={isReadOnly}
                    className={`w-full mt-2 p-3 border rounded-md text-sm transition-colors focus:ring-2 focus:ring-red-500 focus:outline-none ${
                        isReadOnly 
                        ? 'bg-slate-100 dark:bg-slate-900/50 border-transparent text-slate-600 dark:text-slate-400 resize-none' 
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder-slate-400'
                    }`}
                    rows={3}
                    placeholder={isReadOnly ? "Ingen reflektion skriven." : "Koppla en händelse från din praktik hit. Vad har du gjort? Vad var svårt?"}
                  />
              </div>

               {!isReadOnly && (
                 <div className="mt-3 flex justify-end">
                    <button
                        onClick={() => handleGetAIHelp(req.id, req.text)}
                        className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-500 transition-colors"
                    >
                        {ICONS.aiTips}
                        <span>{aiHelp?.goalId === req.id ? 'Dölj AI-hjälp' : 'Få hjälp att reflektera'}</span>
                    </button>
                </div>
                )}
                 {aiHelp?.goalId === req.id && (
                    <div className="mt-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg animate-fade-in">
                        {aiHelp.isLoading ? (
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
                                <p className="text-sm">Genererar frågor...</p>
                            </div>
                        ) : (
                            <>
                                <h4 className="font-bold text-sm text-indigo-800 dark:text-indigo-300 mb-2 flex items-center gap-2">
                                    {ICONS.ai} Reflektionsstöd
                                </h4>
                                <div className="prose prose-sm text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: aiHelp.questions.replace(/^-/gm, '•') }} />
                            </>
                        )}
                    </div>
                )}
            </div>
          );
        })}
      </div>
      
      {!isReadOnly && (
        <div className="mt-8 text-center border-t border-slate-200 dark:border-slate-700 pt-6">
            <button onClick={handleSave} className="bg-red-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-red-700 transition-colors shadow-lg btn-press">
                Spara Framsteg
            </button>
            {saveConfirmation && <p className="text-green-600 dark:text-green-400 text-sm mt-2 font-semibold animate-fade-in">Dina ändringar har sparats!</p>}
        </div>
      )}
    </div>
  );
};

export default Goals;
