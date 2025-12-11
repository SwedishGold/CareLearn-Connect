
import React, { useState, useEffect, useMemo, memo, useRef } from 'react';
import { KnowledgeTestQuestion, User, UserData, KnowledgeTestAttempt, KnowledgeTestAttemptAnswer, KnowledgeTestInProgress, KnowledgeTestTier, DepartmentSettings } from '../types';
import { APP_DATA, ICONS } from '../constants';
import { InfoTooltip } from './UI';
import * as storage from '../services/localStorageService';
import { playClick, playSuccess, playError, playProcess, playUpload } from '../services/soundService';
import { generateQuizTier, generateQuizFromDocument } from '../services/geminiService';
import { parseFile } from './FileManagement'; 

interface KnowledgeTestProps {
  viewer?: User;
  user: User;
  userData: UserData;
  knowledgeTestHistory: KnowledgeTestAttempt[];
  knowledgeTestInProgress: KnowledgeTestInProgress | null;
  onTestComplete: (attempt: KnowledgeTestAttempt) => void;
  onResetHistory: () => void;
  onSaveProgress: (progress: KnowledgeTestInProgress | null) => void;
  onAskAI?: (prompt: string) => void;
  departmentSettings?: DepartmentSettings | null;
  onUpdateDepartmentSettings?: (settings: DepartmentSettings) => void;
}

function shuffleArray(array: KnowledgeTestQuestion[]): KnowledgeTestQuestion[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export const KnowledgeTest: React.FC<KnowledgeTestProps> = memo(({ viewer, user, userData, knowledgeTestHistory, knowledgeTestInProgress, onTestComplete, onResetHistory, onSaveProgress, onAskAI, departmentSettings, onUpdateDepartmentSettings }) => {
  const [questions, setQuestions] = useState<KnowledgeTestQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [currentAttemptAnswers, setCurrentAttemptAnswers] = useState<KnowledgeTestAttemptAnswer[]>([]);
  const [currentTier, setCurrentTier] = useState<KnowledgeTestTier | null>(null);
  const [view, setView] = useState<'menu' | 'test' | 'results' | 'history_details'>('menu');
  const [completedAttempt, setCompletedAttempt] = useState<KnowledgeTestAttempt | null>(null);
  const [selectedHistoryAttempt, setSelectedHistoryAttempt] = useState<KnowledgeTestAttempt | null>(null);
  
  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [genTier, setGenTier] = useState<'tier1' | 'tier2' | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // To force re-calc of memoized questions

  // Custom Quiz Upload State
  const [customQuizFile, setCustomQuizFile] = useState<File | null>(null);
  const [isUploadingCustom, setIsUploadingCustom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSupervisorViewing = viewer && (viewer.role.startsWith('handledare') || viewer.role.startsWith('larare') || viewer.role === 'admin' || viewer.role === 'overlakare');
  
  // Determine if user is a "learner" who can generate quizzes (includes vikarie/anstalld now)
  const canGenerateQuiz = !isSupervisorViewing && user.role !== 'developer';

  // Memoized function to fetch questions
  const getQuestionsSource = useMemo(() => {
      // FORCE load from localStorage if prop is stale to ensure we see newly generated questions
      // Reliance on prop is safer for sync memoization. App.tsx handles freshness.
      const settings = departmentSettings;
      
      const safeParse = (jsonStr: string | undefined, fallback: any) => {
          try {
              if (!jsonStr || jsonStr === "undefined" || jsonStr === "null") return fallback;
              return JSON.parse(jsonStr);
          } catch (e) {
              return fallback;
          }
      };

      // We default to EMPTY ARRAYS if nothing is saved, to trigger the "Generate" UI
      const emptyStruct = { tier1: [], tier2: [] };
      
      const uskQuestions = safeParse(settings?.knowledgeTestQuestionsUsk, emptyStruct);
      const sskQuestions = safeParse(settings?.knowledgeTestQuestionsSsk, emptyStruct);

      const source = {
          usk: {
              tier1: uskQuestions.tier1 || [], 
              tier2: uskQuestions.tier2 || [],
          },
          ssk: {
              tier1: sskQuestions.tier1 || [],
              tier2: sskQuestions.tier2 || [],
          },
          // Fallback to empty for vikarie to allow generation, instead of static only
          vikarieUsk: { tier1: [], tier2: [] }, 
          vikarieSsk: { tier1: [], tier2: [] }
      };
      return source;
  }, [departmentSettings, view, refreshKey]); 

  // NEW: Define allQuestionsForRole for history view
  const allQuestionsForRole = useMemo(() => {
      let pool: KnowledgeTestQuestion[] = [];
      const roleKey = user.role.includes('ssk') ? 'ssk' : 'usk';
      // @ts-ignore - key access
      const dynamicSource = getQuestionsSource[roleKey];
      if (dynamicSource) {
          pool = [...dynamicSource.tier1, ...dynamicSource.tier2];
      }
      if (user.role === 'vikarie-usk') {
          pool = [...pool, ...APP_DATA.knowledgeTestQuestions.vikarieUsk];
      } else if (user.role === 'vikarie-ssk') {
          pool = [...pool, ...APP_DATA.knowledgeTestQuestions.vikarieSsk];
      }
      return pool;
  }, [getQuestionsSource, user.role]);

  useEffect(() => {
    if (knowledgeTestInProgress && knowledgeTestInProgress.questions.length > 0) {
        setQuestions(knowledgeTestInProgress.questions);
        setCurrentQuestionIndex(knowledgeTestInProgress.currentQuestionIndex);
        setCurrentAttemptAnswers(knowledgeTestInProgress.currentAttemptAnswers);
        setCurrentTier(knowledgeTestInProgress.tier);
        setView('test'); 
    } else {
        setQuestions([]);
        setCurrentQuestionIndex(0);
        setCurrentAttemptAnswers([]);
        setCurrentTier(null);
        setView('menu'); 
    }
  }, [knowledgeTestInProgress]);

  const handleGenerateQuestions = async (tier: 'tier1' | 'tier2') => {
      // KEY FIX: Force reload settings from storage if prop is missing/stale
      const settings = departmentSettings || await storage.loadDepartmentSettings();
      
      if (!settings) {
          // If still null, try to init default
          const defaultSettings = storage.applyCustomAppSettings();
           if (!defaultSettings) {
               alert("Kunde inte hitta inställningar. Kontakta support.");
               return;
           }
      }
      
      // Use the settings object we found
      const currentSettings = settings || (await storage.loadDepartmentSettings())!; 
      
      setIsGenerating(true);
      setGenTier(tier);
      playProcess();

      try {
          const specialty = currentSettings.specialty || 'annat';
          const workplace = currentSettings.workplaceName || 'Avdelningen';
          
          const newQuestions = await generateQuizTier(workplace, user.role, specialty, tier);
          
          if (newQuestions.length === 0) {
              throw new Error("AI genererade inga frågor.");
          }

          // Determine where to save based on role
          let roleKey: 'knowledgeTestQuestionsUsk' | 'knowledgeTestQuestionsSsk' = 'knowledgeTestQuestionsUsk';
          if (user.role.includes('ssk')) roleKey = 'knowledgeTestQuestionsSsk';
          
          // Load current structure
          const currentJson = currentSettings[roleKey] || '{}';
          let currentObj = { tier1: [], tier2: [] };
          try { currentObj = JSON.parse(currentJson); } catch(e) {}
          
          // Replace content for that tier (Generated full quizzes usually replace)
          if (tier === 'tier1') currentObj.tier1 = newQuestions;
          else currentObj.tier2 = newQuestions;

          const newSettings = { ...currentSettings, [roleKey]: JSON.stringify(currentObj) };
          
          storage.saveDepartmentSettings(newSettings);
          if (onUpdateDepartmentSettings) {
              onUpdateDepartmentSettings(newSettings);
          }
          
          setRefreshKey(prev => prev + 1); // Force UI refresh
          playSuccess();
          
      } catch (error) {
          console.error("Generation failed", error);
          playError();
          alert("Kunde inte generera frågor. Kontrollera din anslutning.");
      } finally {
          setIsGenerating(false);
          setGenTier(null);
      }
  };

  // Handle Custom Document Upload for Quiz
  const handleCustomFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          setCustomQuizFile(e.target.files[0]);
      }
  };

  const handleGenerateFromDoc = async () => {
      if (!customQuizFile) return;
      
      const settings = departmentSettings || await storage.loadDepartmentSettings();
      if (!settings) {
          alert("Kunde inte ladda inställningar.");
          return;
      }

      setIsUploadingCustom(true);
      playUpload();

      try {
          const { content } = await parseFile(customQuizFile);
          const newQuestions = await generateQuizFromDocument(content);
          
          if (newQuestions.length === 0) throw new Error("Inga frågor skapades.");

          // Determine role key
          let roleKey: 'knowledgeTestQuestionsUsk' | 'knowledgeTestQuestionsSsk' = 'knowledgeTestQuestionsUsk';
          if (user.role.includes('ssk')) roleKey = 'knowledgeTestQuestionsSsk';

          const currentJson = settings[roleKey] || '{}';
          let currentObj = { tier1: [], tier2: [] };
          try { currentObj = JSON.parse(currentJson); } catch(e) {}
          
          // Re-indexing Logic for Appending
          const existingTier1 = currentObj.tier1 || [];
          const maxIndex = existingTier1.reduce((max: number, q: any) => Math.max(max, q.originalIndex || 0), 0);
          
          const newQuestionsReindexed = newQuestions.map((q, i) => ({
              ...q,
              originalIndex: maxIndex + 1 + i, // Continue index from max
              verified: false
          }));

          // Append custom questions to Tier 1
          // @ts-ignore
          currentObj.tier1 = [...existingTier1, ...newQuestionsReindexed];

          const newSettings = { ...settings, [roleKey]: JSON.stringify(currentObj) };
          storage.saveDepartmentSettings(newSettings);
          if (onUpdateDepartmentSettings) onUpdateDepartmentSettings(newSettings);
          
          setRefreshKey(prev => prev + 1);
          playSuccess();
          alert(`✅ Skapade och lade till ${newQuestions.length} frågor från dokumentet i frågepoolen!`);
          setCustomQuizFile(null);
          if(fileInputRef.current) fileInputRef.current.value = "";

      } catch (error) {
          console.error(error);
          alert("Kunde inte skapa quiz från filen.");
      } finally {
          setIsUploadingCustom(false);
      }
  };


  const startNewTest = (tier: KnowledgeTestTier) => {
    let questionPool: KnowledgeTestQuestion[] = [];
    
    // Simplified logic to fetch from the "Smart" source which handles defaults/AI
    // Map user role to source key
    if (user.role.includes('ssk')) {
        questionPool = tier === 'tier1' ? getQuestionsSource.ssk.tier1 : getQuestionsSource.ssk.tier2;
    } else {
        // Default to USK for usk, vikarie-usk, anstalld-usk etc.
        questionPool = tier === 'tier1' ? getQuestionsSource.usk.tier1 : getQuestionsSource.usk.tier2;
    }
    
    // If pool is empty in local storage, check static fallbacks specifically for vikaries if AI wasn't used
    if (questionPool.length === 0) {
        if (user.role === 'vikarie-usk') questionPool = APP_DATA.knowledgeTestQuestions.vikarieUsk;
        if (user.role === 'vikarie-ssk') questionPool = APP_DATA.knowledgeTestQuestions.vikarieSsk;
    }

    if (questionPool.length === 0) {
         // Stay on menu, UI will show generate button
         return;
    }

    // Limit to 30 random questions for a "Session"
    const shuffledPool = shuffleArray(questionPool);
    const sessionQuestions = shuffledPool.slice(0, 30);

    const initialProgress: KnowledgeTestInProgress = {
        questions: sessionQuestions,
        currentQuestionIndex: 0,
        currentAttemptAnswers: [],
        tier: tier,
    };
    onSaveProgress(initialProgress);

    setQuestions(sessionQuestions);
    setCurrentQuestionIndex(0);
    setSelectedAnswerIndex(null);
    setIsAnswered(false);
    setCurrentAttemptAnswers([]);
    setCurrentTier(tier);
    setCompletedAttempt(null);
    setSelectedHistoryAttempt(null);
    setView('test');
  };
  
  const currentQuestion = questions[currentQuestionIndex];

  const handleSelectAnswer = (index: number) => {
    if (!isAnswered) {
      playClick();
      setSelectedAnswerIndex(index);
    }
  };

  const handleCheckAnswer = () => {
    if (selectedAnswerIndex === null) return;
    const isCorrect = currentQuestion.a[selectedAnswerIndex].c;
    if (isCorrect) playSuccess(); else playError();
    const attemptAnswer: KnowledgeTestAttemptAnswer = { questionOriginalIndex: currentQuestion.originalIndex, selectedAnswerIndex: selectedAnswerIndex, isCorrect: isCorrect };
    const newAttemptAnswers = [...currentAttemptAnswers, attemptAnswer];
    setCurrentAttemptAnswers(newAttemptAnswers);
    setIsAnswered(true);
    onSaveProgress({ questions, currentQuestionIndex, currentAttemptAnswers: newAttemptAnswers, tier: currentTier! });
  };
  
  const handleNextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < questions.length) {
      setCurrentQuestionIndex(nextIndex);
      setSelectedAnswerIndex(null);
      setIsAnswered(false);
      onSaveProgress({ questions, currentQuestionIndex: nextIndex, currentAttemptAnswers, tier: currentTier! });
    } else {
      const score = currentAttemptAnswers.filter(a => a.isCorrect).length;
      const finalAttempt: KnowledgeTestAttempt = { timestamp: new Date(), score: score, totalQuestions: questions.length, answers: currentAttemptAnswers, questionOrder: questions.map(q => q.originalIndex), tier: currentTier! };
      onTestComplete(finalAttempt);
      setCompletedAttempt(finalAttempt);
      setView('results');
      playSuccess();
    }
  };
  
  const handleReset = () => { onResetHistory(); setView('menu'); };
  const handleViewHistoryDetails = (attempt: KnowledgeTestAttempt) => { setSelectedHistoryAttempt(attempt); setView('history_details'); };

  const renderResults = (attempt: KnowledgeTestAttempt, title: string, backButton: React.ReactNode, questionsForAttempt: KnowledgeTestQuestion[]) => {
    return (
        <div className="card-base p-8 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-slate-100 mb-2 text-center">{title}</h2>
            <p className="text-xl text-gray-600 dark:text-slate-300 mb-6 text-center">
                Resultat: <span className="font-bold text-red-600 dark:text-red-400">{attempt.score}</span> av <span className="font-bold text-gray-800 dark:text-slate-100">{attempt.totalQuestions}</span> rätt.
            </p>
            <div className="space-y-4 mb-8 max-h-[50vh] overflow-y-auto pr-2">
                {questionsForAttempt.map((q, idx) => {
                    const studentAnswer = attempt.answers.find(a => a.questionOriginalIndex === q.originalIndex);
                    const selectedAnswerText = studentAnswer !== undefined ? q.a[studentAnswer.selectedAnswerIndex]?.t : "Inget svar";
                    const correctAnswerIndex = q.a.findIndex(a => a.c);
                    const isCorrect = studentAnswer?.isCorrect;

                    return (
                        <div key={idx} className={`p-4 rounded-md bg-slate-50 dark:bg-slate-800/50 border-l-4 ${isCorrect ? 'border-green-500' : 'border-red-500'}`}>
                            <div className="flex justify-between items-start">
                                <p className="font-semibold text-gray-800 dark:text-slate-100 flex-1">{idx + 1}. {q.q}</p>
                                {q.verified && (
                                    <span className="ml-2 flex-shrink-0 text-green-500" title="Verifierad fråga">
                                        {ICONS.shield}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm mt-2 text-slate-600 dark:text-slate-400">
                                Ditt svar: <span className={`font-medium ${isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{selectedAnswerText}</span>
                            </p>
                            {!isCorrect && (
                                <p className="text-sm mt-1 text-slate-600 dark:text-slate-400">
                                    Rätt svar: <span className="font-medium text-green-700 dark:text-green-400">{q.a[correctAnswerIndex]?.t}</span>
                                </p>
                            )}
                            <p className="text-sm mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                <strong className="font-semibold text-slate-700 dark:text-slate-200">Förklaring:</strong> {q.e}
                            </p>
                        </div>
                    );
                })}
            </div>
            {backButton}
        </div>
    );
  };

  if (view === 'test') {
    if (!currentQuestion) return <div className="card-base p-8 text-center"><p>Laddar test...</p></div>;
    return (
      <div className="card-base p-8 max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Fråga {currentQuestionIndex + 1} av {questions.length}</h2>
          {!isSupervisorViewing && <button onClick={() => { onSaveProgress(null); setView('menu'); }} className="text-sm text-gray-500 dark:text-slate-400 hover:underline">Avbryt test</button>}
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-6">
            <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}></div>
        </div>
        <div className="flex items-start gap-2 mb-6">
            <p className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex-1">{currentQuestion.q}</p>
            {currentQuestion.verified && <InfoTooltip text="Denna fråga är kvalitetsgranskad och godkänd av en handledare." className="text-green-500" />}
        </div>
        <div className="space-y-3">
          {currentQuestion.a.map((answer, index) => {
            const isSelected = selectedAnswerIndex === index;
            const isCorrect = answer.c;
            
            // Base styles
            let buttonClass = 'bg-white dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-600 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100';
            
            if (isAnswered) {
              if (isCorrect) buttonClass = 'bg-green-100 dark:bg-green-900/30 border-green-400 text-green-900 dark:text-green-100';
              else if (isSelected) buttonClass = 'bg-red-100 dark:bg-red-900/30 border-red-400 text-red-900 dark:text-red-100';
            } else if (isSelected) {
                buttonClass = 'bg-indigo-100 dark:bg-indigo-900/50 border-indigo-400 text-indigo-900 dark:text-indigo-100';
            }
            
            return (
              <button key={index} onClick={() => handleSelectAnswer(index)} disabled={isAnswered} className={`w-full text-left p-4 rounded-md border-2 transition-colors ${buttonClass}`}>
                {answer.t}
              </button>
            );
          })}
        </div>
        {isAnswered && (
          <div className="mt-6 p-4 rounded-md bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700">
            <div className="flex justify-between items-center mb-2"><h3 className="font-bold text-indigo-800 dark:text-indigo-200">Förklaring</h3>{currentQuestion.verified && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded border border-green-300 flex items-center gap-1">{ICONS.shield} Verifierad</span>}</div>
            <p className="mt-2 text-indigo-900 dark:text-indigo-100">{currentQuestion.e}</p>
            {onAskAI && <button onClick={() => onAskAI(`Förklara mer om detta: ${currentQuestion.e}`)} className="text-sm text-indigo-600 dark:text-indigo-300 hover:underline mt-2 font-semibold flex items-center gap-1">{ICONS.ai} Be AI:n förklara mer</button>}
          </div>
        )}
        <div className="mt-6 text-right">
          {!isAnswered ? <button onClick={handleCheckAnswer} disabled={selectedAnswerIndex === null} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors btn-press">Rätta svar</button> : <button onClick={handleNextQuestion} className="bg-orange-500 text-white font-bold py-2 px-6 rounded-md hover:bg-orange-600 transition-colors btn-press">{currentQuestionIndex + 1 < questions.length ? 'Nästa fråga' : 'Slutför test'}</button>}
        </div>
      </div>
    );
  }
  
  if (view === 'results') return renderResults(completedAttempt!, 'Test slutfört!', <button onClick={() => { setView('menu'); setCompletedAttempt(null); }} className="mt-6 bg-indigo-600 text-white font-bold py-2 px-6 rounded-md">Tillbaka till menyn</button>, questions);
  
  if (view === 'history_details') { 
      // Use the memoized allQuestionsForRole
      const questionsForHistory = selectedHistoryAttempt!.questionOrder 
        ? selectedHistoryAttempt!.questionOrder.map(originalIndex => allQuestionsForRole.find(q => q.originalIndex === originalIndex)!) 
        : allQuestionsForRole; 
      
      // Filter out undefined questions to prevent crashes if a question was deleted/changed
      const validQuestionsForHistory = questionsForHistory.filter(Boolean);

      return renderResults(selectedHistoryAttempt!, 'Testresultat', <button onClick={() => { setView('menu'); setSelectedHistoryAttempt(null); }} className="mt-6 bg-indigo-600 text-white font-bold py-2 px-6 rounded-md">Tillbaka till menyn</button>, validQuestionsForHistory); 
  }
  
  const isStudent = user.role === 'usk-elev' || user.role === 'ssk-student';
  const roleKey = user.role.includes('usk') ? 'usk' : 'ssk';
  const unlockedTier = (isStudent && userData.unlockedKnowledgeTiers?.[roleKey]) || 1;
  
  const tier1Count = getQuestionsSource[roleKey].tier1?.length || 0;
  const tier2Count = getQuestionsSource[roleKey].tier2?.length || 0;

  return (
    <div className="card-base p-8 max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">{isSupervisorViewing ? 'Testhistorik' : 'Kunskapstest'}</h2>
        {!isSupervisorViewing && <InfoTooltip text="Testa dina kunskaper inom områden relevanta för din roll. Resultaten sparas." />}
      </div>

      {knowledgeTestInProgress && !isSupervisorViewing ? (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-md border border-indigo-200 dark:border-indigo-700 text-center">
            <p className="font-semibold text-indigo-800 dark:text-indigo-200">Du har ett pågående test.</p>
            <button onClick={() => setView('test')} className="mt-3 bg-indigo-600 text-white font-bold py-2 px-6 rounded-md hover:bg-indigo-700">Fortsätt testet</button>
        </div>
      ) : !isSupervisorViewing ? (
        <div className="space-y-4">
            {canGenerateQuiz ? (
                <>
                    {/* CUSTOM QUIZ UPLOAD */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-700">
                        <h3 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                            {ICONS.fileManagement} Ladda upp & Skapa Frågor (AI)
                        </h3>
                        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                accept=".pdf,.docx,.txt"
                                onChange={handleCustomFileChange}
                                disabled={isUploadingCustom}
                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 dark:file:bg-blue-800 dark:file:text-blue-100"
                            />
                            <button 
                                onClick={handleGenerateFromDoc}
                                disabled={!customQuizFile || isUploadingCustom}
                                className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors btn-press flex-shrink-0"
                            >
                                {isUploadingCustom ? 'Bearbetar...' : 'Generera & Lägg till'}
                            </button>
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">
                            Ladda upp ett dokument så skapar AI:n frågor och lägger till dem i din befintliga frågebank (pool).
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={() => startNewTest('tier1')} className="flex flex-col items-center justify-center p-6 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-orange-500 dark:hover:border-orange-500 transition-all group btn-press">
                            <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">🌱</span>
                            <span className="font-bold text-lg text-slate-800 dark:text-slate-100">Grundläggande (Nivå 1)</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pool: {tier1Count} frågor</span>
                            {tier1Count === 0 && <button onClick={(e) => { e.stopPropagation(); handleGenerateQuestions('tier1'); }} className="mt-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded hover:bg-orange-200">{isGenerating && genTier === 'tier1' ? 'Genererar...' : 'Generera med AI'}</button>}
                        </button>
                        
                        <button onClick={() => startNewTest('tier2')} disabled={unlockedTier < 2} className={`flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all group btn-press ${unlockedTier < 2 ? 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-50 cursor-not-allowed' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-red-500 dark:hover:border-red-500'}`}>
                            <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">{unlockedTier < 2 ? '🔒' : '🔥'}</span>
                            <span className="font-bold text-lg text-slate-800 dark:text-slate-100">Fördjupning (Nivå 2)</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pool: {tier2Count} frågor</span>
                            {unlockedTier >= 2 && tier2Count === 0 && <button onClick={(e) => { e.stopPropagation(); handleGenerateQuestions('tier2'); }} className="mt-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200">{isGenerating && genTier === 'tier2' ? 'Genererar...' : 'Generera med AI'}</button>}
                        </button>
                    </div>
                </>
            ) : (
                <p className="text-center text-gray-500 dark:text-slate-400">Inga test tillgängliga för din roll.</p>
            )}
        </div>
      ) : null}

      <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">Historik</h3>
            {!isSupervisorViewing && knowledgeTestHistory.length > 0 && (
                <button onClick={handleReset} className="text-sm text-red-500 hover:text-red-700">Rensa historik</button>
            )}
        </div>
        {knowledgeTestHistory.length > 0 ? (
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {[...knowledgeTestHistory].reverse().map((attempt, index) => (
              <button key={index} onClick={() => handleViewHistoryDetails(attempt)} className="w-full flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left group">
                <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 block">
                        {new Date(attempt.timestamp).toLocaleDateString()}
                        <span className="text-xs font-normal text-slate-500 ml-2">({attempt.tier === 'tier1' ? 'Nivå 1' : 'Nivå 2'})</span>
                    </span>
                    <span className={`text-sm ${attempt.score / attempt.totalQuestions >= 0.8 ? 'text-green-600' : 'text-orange-600'}`}>
                        {attempt.score} av {attempt.totalQuestions} rätt
                    </span>
                </div>
                <span className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200">&rarr;</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 italic">Inga tidigare resultat.</p>
        )}
      </div>
    </div>
  );
});
