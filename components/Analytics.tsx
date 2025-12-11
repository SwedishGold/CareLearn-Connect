
import React, { useMemo, useState, useEffect, memo, useCallback, useRef } from 'react';
import { User, UserData, Role, KnowledgeTestQuestion, ExternalFeedbackAnalysis } from '../types';
import { ICONS, APP_DATA } from '../constants';
import { getRoleDisplayName, InfoTooltip } from './UI';
import { analyzeExternalFeedbackFile, getAIGroupAnalyticsSummary } from '../services/geminiService';
import { playProcess } from '../services/soundService';

// Declarations for libraries
declare const pdfjsLib: any;
declare const mammoth: any;
declare const jspdf: any;
declare const html2canvas: any;

// Worker setup
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs`;
}

// Helper: Parse File
const parseFile = (file: File): Promise<{ title: string; content: string }> => {
    return new Promise((resolve, reject) => {
        if (file.type === 'application/msword') {
            return reject(new Error(`Gammalt .doc-format. Spara om filen som .docx eller .pdf och försök igen.`));
        }

        const title = file.name.replace(/\.[^/.]+$/, '');
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                if (!event.target?.result) return reject(new Error(`Kunde inte läsa filen ${file.name}.`));
                let content = '';

                if (file.type === 'application/pdf') {
                    const typedarray = new Uint8Array(event.target.result as ArrayBuffer);
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    let textContent = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const text = await page.getTextContent();
                        textContent += text.items.map((item: any) => item.str).join(' ') + '\n';
                    }
                    content = textContent;
                } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    const result = await mammoth.extractRawText({ arrayBuffer: event.target.result as ArrayBuffer });
                    content = result.value;
                } else {
                    content = event.target.result as string;
                }

                if (content.trim()) resolve({ title, content });
                else reject(new Error(`Filen ${file.name} verkar vara tom.`));
            } catch (err) {
                console.error('Parsing error:', err);
                reject(new Error(`Kunde inte tolka innehållet i ${file.name}.`));
            }
        };
        reader.onerror = () => reject(new Error(`Ett fel uppstod när ${file.name} skulle läsas.`));
        
        if (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    });
};

interface AnalyticsProps {
    allStudentData: { user: User, data: UserData }[];
    users: User[];
}

const Bar: React.FC<{ label: string; value: number; max: number; }> = ({ label, value, max }) => (
    <div className="flex items-center text-xs mb-1">
        <div className="w-1/4 pr-2 text-right text-gray-600 dark:text-slate-400 truncate">{label}</div>
        <div className="w-3/4 flex items-center">
            <div className="h-4 bg-red-400 rounded-sm" style={{ width: max > 0 ? `${(value / max) * 100}%` : '0%' }}></div>
            <div className="pl-2 font-bold text-gray-800 dark:text-slate-200">{value}</div>
        </div>
    </div>
);

// Component for displaying External Analysis results
const ExternalAnalysisView: React.FC<{ analysis: ExternalFeedbackAnalysis }> = ({ analysis }) => {
    const { overallSummary, totalEntries, positiveThemes, improvementAreas, actionableRecommendations } = analysis;
    return (
        <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg border dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Sammanfattning ({totalEntries} inlägg)</h3>
                <p className="text-slate-600 dark:text-slate-300">{overallSummary}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
                    <h4 className="font-bold text-green-800 dark:text-green-300 mb-2">Positivt</h4>
                    <ul className="list-disc list-inside text-sm text-green-900 dark:text-green-200 space-y-1">
                        {positiveThemes.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                </div>
                <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
                    <h4 className="font-bold text-red-800 dark:text-red-300 mb-2">Förbättringsområden</h4>
                    <ul className="list-disc list-inside text-sm text-red-900 dark:text-red-200 space-y-1">
                        {improvementAreas.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                </div>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <h3 className="font-bold text-indigo-800 dark:text-indigo-200 mb-3">Rekommendationer</h3>
                <ul className="space-y-2">
                    {actionableRecommendations.map((rec, i) => (
                        <li key={i} className="flex gap-2 items-start text-sm text-indigo-900 dark:text-indigo-300">
                            <span className="text-indigo-500 font-bold">•</span>
                            {rec}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const Analytics: React.FC<AnalyticsProps> = ({ allStudentData, users }) => {
    const [activeTab, setActiveTab] = useState<'internal' | 'external'>('internal');
    const [externalFile, setExternalFile] = useState<File | null>(null);
    const [externalAnalysis, setExternalAnalysis] = useState<ExternalFeedbackAnalysis | null>(null);
    const [isAnalyzingExternal, setIsAnalyzingExternal] = useState(false);
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

    // Calculate Internal Stats
    const stats = useMemo(() => {
        const studentUsers = allStudentData.filter(d => d.user.role.includes('elev') || d.user.role.includes('student'));
        const totalStudents = studentUsers.length;
        
        let totalChecklistPercent = 0;
        let totalTestScore = 0;
        let testCount = 0;
        const goalRatings: Record<string, number[]> = {};

        // Question Analysis
        const questionStats: Record<number, { correct: number, total: number, text: string }> = {};

        studentUsers.forEach(({ data }) => {
            // Checklist
            const completed = Object.values(data.checklistProgress || {}).filter(Boolean).length;
            totalChecklistPercent += (completed / APP_DATA.checklist.length) * 100;

            // Goals
            Object.entries(data.goalsProgress || {}).forEach(([id, prog]: [string, any]) => {
                if (prog.rating > 0) {
                    if (!goalRatings[id]) goalRatings[id] = [];
                    goalRatings[id].push(prog.rating);
                }
            });

            // Tests
            data.knowledgeTestHistory.forEach(attempt => {
                totalTestScore += (attempt.score / attempt.totalQuestions) * 100;
                testCount++;
                
                attempt.answers.forEach(ans => {
                    if (!questionStats[ans.questionOriginalIndex]) {
                        // Find question text from APP_DATA (simplified lookup)
                        const qObj = [...APP_DATA.knowledgeTestQuestions.usk.tier1, ...APP_DATA.knowledgeTestQuestions.usk.tier2, ...APP_DATA.knowledgeTestQuestions.ssk.tier1, ...APP_DATA.knowledgeTestQuestions.ssk.tier2].find(q => q.originalIndex === ans.questionOriginalIndex);
                        questionStats[ans.questionOriginalIndex] = { correct: 0, total: 0, text: qObj?.q || "Okänd fråga" };
                    }
                    questionStats[ans.questionOriginalIndex].total++;
                    if (ans.isCorrect) questionStats[ans.questionOriginalIndex].correct++;
                });
            });
        });

        const avgChecklist = totalStudents > 0 ? Math.round(totalChecklistPercent / totalStudents) : 0;
        const avgTest = testCount > 0 ? Math.round(totalTestScore / testCount) : 0;

        // Process Goals
        const goalsAnalysis = Object.entries(goalRatings).map(([id, ratings]) => ({
            id,
            text: APP_DATA.knowledgeRequirements.find(k => k.id === id)?.text || id,
            avg: ratings.reduce((a, b) => a + b, 0) / ratings.length
        })).sort((a, b) => a.avg - b.avg).slice(0, 3); // Lowest 3

        // Process Questions
        const toughQuestions = Object.values(questionStats)
            .map(q => ({ ...q, rate: (q.correct / q.total) * 100 }))
            .sort((a, b) => a.rate - b.rate)
            .slice(0, 3); // Hardest 3

        return {
            totalStudents,
            avgChecklist,
            avgTest,
            goalsAnalysis,
            toughQuestions
        };
    }, [allStudentData]);

    const handleExternalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setExternalFile(e.target.files[0]);
    };

    const runExternalAnalysis = async () => {
        if (!externalFile) return;
        setIsAnalyzingExternal(true);
        playProcess();
        try {
            const { content } = await parseFile(externalFile);
            const result = await analyzeExternalFeedbackFile(content);
            setExternalAnalysis(result);
        } catch (e) {
            alert("Kunde inte analysera filen.");
        } finally {
            setIsAnalyzingExternal(false);
        }
    };

    const generateAiSummary = async () => {
        setIsGeneratingSummary(true);
        playProcess();
        try {
            const summary = await getAIGroupAnalyticsSummary(allStudentData);
            setAiSummary(summary);
        } catch (e) {
            setAiSummary("Kunde inte generera sammanfattning.");
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Dataanalys</h2>
                    <p className="text-slate-600 dark:text-slate-400">Insikter för utbildningsledning.</p>
                </div>
                <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('internal')} className={`px-4 py-2 rounded-md font-bold text-sm ${activeTab === 'internal' ? 'bg-white dark:bg-slate-600 shadow' : 'text-slate-500 dark:text-slate-400'}`}>Intern Data</button>
                    <button onClick={() => setActiveTab('external')} className={`px-4 py-2 rounded-md font-bold text-sm ${activeTab === 'external' ? 'bg-white dark:bg-slate-600 shadow' : 'text-slate-500 dark:text-slate-400'}`}>Extern Feedback</button>
                </div>
            </header>

            {activeTab === 'internal' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Key Metrics */}
                    <div className="card-base p-6 lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.totalStudents}</p>
                            <p className="text-xs font-bold uppercase text-slate-500">Studenter</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.avgChecklist}%</p>
                            <p className="text-xs font-bold uppercase text-slate-500">Checklista Snitt</p>
                        </div>
                        <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.avgTest}%</p>
                            <p className="text-xs font-bold uppercase text-slate-500">Provresultat Snitt</p>
                        </div>
                        <div className="flex items-center justify-center">
                            <button onClick={generateAiSummary} disabled={isGeneratingSummary} className="w-full h-full bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition-colors flex flex-col items-center justify-center p-2 disabled:bg-slate-600">
                                {isGeneratingSummary ? (
                                    <span className="animate-pulse">Analyserar...</span>
                                ) : (
                                    <>
                                        <span className="text-xl">{ICONS.ai}</span>
                                        <span className="text-xs mt-1">Generera Analys</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* AI Summary */}
                    {aiSummary && (
                        <div className="card-base p-6 lg:col-span-2 bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-500">
                            <h3 className="font-bold text-indigo-800 dark:text-indigo-200 mb-2 flex items-center gap-2">{ICONS.ai} AI-Analys av Gruppen</h3>
                            <div className="prose prose-sm max-w-none text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: aiSummary.replace(/\n/g, '<br />') }} />
                        </div>
                    )}

                    {/* Knowledge Gaps */}
                    <div className="card-base p-6">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Svåraste Frågorna</h3>
                        <div className="space-y-4">
                            {stats.toughQuestions.map((q, i) => (
                                <div key={i} className="border-b border-slate-100 dark:border-slate-700 pb-2 last:border-0">
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{q.text}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mr-4">
                                            <div className="bg-red-500 h-2 rounded-full" style={{ width: `${100 - q.rate}%` }}></div>
                                        </div>
                                        <span className="text-xs font-bold text-red-500 whitespace-nowrap">{Math.round(100 - q.rate)}% fel</span>
                                    </div>
                                </div>
                            ))}
                            {stats.toughQuestions.length === 0 && <p className="text-slate-500 text-sm">För lite data.</p>}
                        </div>
                    </div>

                    {/* Goal Gaps */}
                    <div className="card-base p-6">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Lägst Skattade Mål</h3>
                        <div className="space-y-4">
                            {stats.goalsAnalysis.map((g, i) => (
                                <div key={i} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded border dark:border-slate-700">
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{g.text}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Snitt: {g.avg.toFixed(1)}/5</span>
                                    </div>
                                </div>
                            ))}
                             {stats.goalsAnalysis.length === 0 && <p className="text-slate-500 text-sm">För lite data.</p>}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'external' && (
                <div className="card-base p-6 max-w-3xl mx-auto">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Analys av Extern Feedback</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                        Ladda upp en PDF eller textfil med utvärderingar (t.ex. från NKSE eller enkäter) för att låta AI sammanställa teman och åtgärder.
                    </p>
                    
                    <div className="flex gap-4 items-center mb-6">
                        <input type="file" accept=".pdf,.txt,.docx" onChange={handleExternalUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                        <button onClick={runExternalAnalysis} disabled={!externalFile || isAnalyzingExternal} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors">
                            {isAnalyzingExternal ? 'Analyserar...' : 'Analysera'}
                        </button>
                    </div>

                    {externalAnalysis && <ExternalAnalysisView analysis={externalAnalysis} />}
                </div>
            )}
        </div>
    );
};

export default Analytics;
