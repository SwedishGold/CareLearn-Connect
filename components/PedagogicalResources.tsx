
import React, { useState, memo, useCallback } from 'react';
import { getAITeachingTips, getAIAssistedWeeklyReport, getAIConstructiveFeedbackTips, getAIDifficultConversationTips } from '../services/geminiService';
import { ICONS } from '../constants';
import { InfoTooltip } from './UI';
import { User, UserData } from '../types';
import { playProcess } from '../services/soundService';

// A simple markdown-to-html converter
const formatMarkdown = (text: string) => {
    return text
        .replace(/### (.*)/g, '<h3 class="text-xl font-bold text-slate-800 dark:text-slate-100 mt-4 mb-2">$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.*)/gm, '<li class="ml-4 list-disc">$1</li>')
        .replace(/\n/g, '<br />');
};

const AIAssistedSupervision: React.FC<{ allStudentData: { user: User, data: UserData }[] }> = memo(({ allStudentData }) => {
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [report, setReport] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerateReport = async () => {
        if (!selectedStudentId) return;
        
        const student = allStudentData.find(s => s.user.id === selectedStudentId);
        if (!student) return;

        setIsLoading(true);
        setError(null);
        setReport(null);
        playProcess();
        try {
            const result = await getAIAssistedWeeklyReport(student.user, student.data);
            setReport(result);
        } catch (e: any) {
            console.error("Report error", e);
            setError(e.message || "Ett fel uppstod när rapporten skulle genereras.");
        }
        setIsLoading(false);
    };

    return (
        <div className="mt-8 pt-8 border-t dark:border-slate-700">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Träna på AI-assisterad Handledning</h2>
            <p className="mt-2 mb-6 text-gray-600 dark:text-slate-400">
                Denna modul låter dig använda AI för att få ett sammanfattat underlag om en student. Syftet är att du ska träna på att kritiskt granska och använda AI som ett verktyg i din handledning.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg border dark:border-slate-700 space-y-4">
                    <div>
                        <label htmlFor="student-select" className="block text-sm font-medium text-gray-700 dark:text-slate-300">1. Välj en student</label>
                        <select
                            id="student-select"
                            value={selectedStudentId}
                            onChange={(e) => setSelectedStudentId(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-slate-600 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        >
                            <option value="" disabled>-- Välj en student att analysera --</option>
                            {allStudentData.map(s => (
                                <option key={s.user.id} value={s.user.id}>{s.user.name}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleGenerateReport}
                        disabled={!selectedStudentId || isLoading}
                        className="w-full bg-slate-800 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-600 transition-colors flex items-center justify-center disabled:bg-slate-400"
                    >
                        {isLoading ? 'Genererar...' : '2. Generera AI-rapport för handledning'}
                    </button>
                    {error && <p className="text-red-500 text-sm text-center font-bold bg-red-100 dark:bg-red-900/30 p-2 rounded">{error}</p>}
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/40 p-6 rounded-lg border border-amber-200 dark:border-amber-700">
                    <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">Kritiska frågor för dig som handledare</h3>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900 dark:text-amber-300 list-disc list-inside">
                        <li>Stämmer AI:ns bild överens med din egen uppfattning? Vilka nyanser missar den?</li>
                        <li>Vilken information i rapporten är mest värdefull, och vilken är potentiellt missvisande?</li>
                        <li>Hur kan du använda detta underlag för att ställa öppna, nyfikna frågor till studenten istället för att presentera det som en slutsats?</li>
                        <li>Vilka etiska risker (t.ex. bias, övervakningskänsla) ser du med ett sådant här verktyg?</li>
                    </ul>
                </div>
            </div>

            {report && (
                <div className="mt-6">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2">AI-genererat underlag</h3>
                    <div className="p-6 bg-white dark:bg-slate-800/50 border dark:border-slate-700 rounded-lg shadow-inner prose prose-sm max-w-none text-slate-800 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: formatMarkdown(report) }} />
                </div>
            )}
        </div>
    );
});


const PedagogicalResources: React.FC<{ allStudentData: { user: User, data: UserData }[] }> = memo(({ allStudentData }) => {
  const [feedbackTips, setFeedbackTips] = useState<string | null>(null);
  const [isLoadingFeedbackTips, setIsLoadingFeedbackTips] = useState(false);
  const [errorFeedbackTips, setErrorFeedbackTips] = useState<string | null>(null);

  const [conversationTips, setConversationTips] = useState<string | null>(null);
  const [isLoadingConversationTips, setIsLoadingConversationTips] = useState(false);
  const [errorConversationTips, setErrorConversationTips] = useState<string | null>(null);

  
  const fetchFeedbackTips = async () => {
    setIsLoadingFeedbackTips(true);
    setErrorFeedbackTips(null);
    playProcess();
    try {
      const result = await getAIConstructiveFeedbackTips();
      setFeedbackTips(result);
    } catch (e) {
      setErrorFeedbackTips("Ett fel uppstod när feedback-tips skulle hämtas.");
      console.error(e);
    }
    setIsLoadingFeedbackTips(false);
  };

  const fetchConversationTips = async () => {
    setIsLoadingConversationTips(true);
    setErrorConversationTips(null);
    playProcess();
    try {
      const result = await getAIDifficultConversationTips();
      setConversationTips(result);
    } catch (e) {
      setErrorConversationTips("Ett fel uppstod när samtalstips skulle hämtas.");
      console.error(e);
    }
    setIsLoadingConversationTips(false);
  };

  return (
    <div className="card-base p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Pedagogiska Resurser</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Här hittar du AI-genererade tips och moduler för att utveckla din handledning.</p>
      </div>
      
      {/* Removed static general tips section */}

      <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700">
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">Tips för Feedback (AI)</h2>
                <p className="mt-1 text-slate-600 dark:text-slate-400">Specifika modeller och tekniker för att ge effektiv feedback.</p>
            </div>
            <button onClick={fetchFeedbackTips} disabled={isLoadingFeedbackTips} className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600 disabled:bg-slate-400 transition-colors">
                {isLoadingFeedbackTips ? 'Laddar...' : 'Hämta tips'}
            </button>
        </div>
        {feedbackTips && <div className="mt-4 prose prose-sm max-w-none text-slate-800 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: formatMarkdown(feedbackTips) }} />}
        {errorFeedbackTips && <p className="text-red-500 mt-2">{errorFeedbackTips}</p>}
      </div>

      <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700">
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">Tips för Svåra Samtal (AI)</h2>
                <p className="mt-1 text-slate-600 dark:text-slate-400">Råd för att hantera utmanande samtal med studenter.</p>
            </div>
            <button onClick={fetchConversationTips} disabled={isLoadingConversationTips} className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600 disabled:bg-slate-400 transition-colors">
                {isLoadingConversationTips ? 'Laddar...' : 'Hämta tips'}
            </button>
        </div>
        {conversationTips && <div className="mt-4 prose prose-sm max-w-none text-slate-800 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: formatMarkdown(conversationTips) }} />}
        {errorConversationTips && <p className="text-red-500 mt-2">{errorConversationTips}</p>}
      </div>

      <AIAssistedSupervision allStudentData={allStudentData} />
    </div>
  );
});

export default PedagogicalResources;
