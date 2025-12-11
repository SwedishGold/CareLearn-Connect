
import React, { useState, useEffect, memo, useCallback } from 'react';
import { FeedbackEntry, FeedbackAnalysis } from '../types';
import * as storage from '../services/localStorageService';
import { getAIFeedbackAnalysis, generateFeedbackAnalysis } from '../services/geminiService';
import { ICONS } from '../constants';
import { Modal, InfoTooltip } from './UI';

// Make TypeScript aware of the globally included libraries for PDF generation
declare const jspdf: any;
declare const html2canvas: any;

const RatingDisplay: React.FC<{ score: number }> = ({ score }) => (
    <div className="flex items-center">
        {[1, 2, 3, 4, 5].map(val => (
            <div key={val} className={`w-5 h-5 rounded-full border-2 ${score >= val ? 'bg-red-500 border-red-500' : 'bg-slate-200 dark:bg-slate-600 border-slate-300 dark:border-slate-500'}`}></div>
        ))}
        <span className="ml-2 font-bold text-lg text-slate-700 dark:text-slate-200">{score > 0 ? score : '-'}</span>
    </div>
);

// A component to render feedback in a format suitable for printing to PDF
// This component now explicitly uses light-theme colors to be independent of the app's theme.
const PrintableFeedback: React.FC<{ feedback: FeedbackEntry[] }> = memo(({ feedback }) => (
    <div className="p-8 font-sans bg-white text-black">
        <h1 className="text-3xl font-bold mb-2 text-black">Feedbackrapport</h1>
        <p className="text-sm text-gray-500 mb-8">Genererad {new Date().toLocaleString('sv-SE')}</p>
        <div className="space-y-6">
            {feedback.map(item => (
                <div key={item.id} className="border border-gray-200 p-4 rounded-lg break-inside-avoid">
                    <div className="flex justify-between items-center text-sm text-gray-500 mb-4 pb-2 border-b border-gray-200">
                        <div className="flex flex-col">
                            <span className="font-semibold text-base text-black">{item.title}</span>
                            {item.gender && item.ageRange && (
                                <span className="text-xs text-gray-600">{`${item.gender === 'vill-ej-ange' ? 'Ej angett kön' : item.gender.charAt(0).toUpperCase() + item.gender.slice(1)}, ${item.ageRange}`}</span>
                            )}
                        </div>
                        <span>{new Date(item.timestamp).toLocaleString('sv-SE')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-800">
                        <div className="space-y-3">
                            <div><p className="font-semibold">Helhetsintryck: {item.overallImpression}/5</p></div>
                             <div>
                                <p className="font-semibold">Upplevd nytta:</p>
                                <ul className="list-disc list-inside pl-4">
                                    <li>Checklistor: {item.featureUsefulness.checklist}/5</li>
                                    <li>Kunskapstest: {item.featureUsefulness.knowledgeTest}/5</li>
                                    <li>Struktur: {item.featureUsefulness.structure}/5</li>
                                </ul>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <p className="font-semibold">Syn på AI & Tänkande:</p>
                                <ul className="list-disc list-inside pl-4">
                                    <li>AI-stöd: {item.aiAndThinking.viewOnAI}/5</li>
                                    <li>Kritiskt tänkande: {item.aiAndThinking.criticalThinking}/5</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    {item.comments && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <h4 className="font-semibold text-black">Kommentarer:</h4>
                            <p className="text-gray-800 whitespace-pre-wrap italic bg-gray-100 p-2 rounded-md mt-1">"{item.comments}"</p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>
));

const SentimentGauge: React.FC<{ score: number, label: string }> = ({ score, label }) => {
    let colorClass = 'text-gray-500';
    let barColorClass = 'bg-gray-500';
    
    if (score >= 75) {
        colorClass = 'text-green-500';
        barColorClass = 'bg-green-500';
    } else if (score >= 40) {
        colorClass = 'text-yellow-500';
        barColorClass = 'bg-yellow-500';
    } else {
        colorClass = 'text-red-500';
        barColorClass = 'bg-red-500';
    }

    return (
        <div className="text-center p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Kvalitetsindex</h4>
            <div className={`text-4xl font-bold ${colorClass}`}>{score}%</div>
            <p className={`text-sm font-medium ${colorClass} mt-1`}>{label}</p>
            <div className="w-full bg-slate-300 dark:bg-slate-600 h-2 rounded-full mt-3 overflow-hidden">
                <div className={`h-full ${barColorClass} transition-all duration-1000 ease-out`} style={{ width: `${score}%` }}></div>
            </div>
        </div>
    );
};


const FeedbackViewer: React.FC = memo(() => {
    const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
    const [showOldAnalysis, setShowOldAnalysis] = useState(false); // Toggle for the old modal
    const [analysisResult, setAnalysisResult] = useState<string>(''); // Old string result
    
    // NEW: AI Analysis State
    const [aiInsights, setAiInsights] = useState<FeedbackAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        const fetchFeedback = async () => {
            const loadedFeedback = await storage.loadFeedback();
            const sortedFeedback = loadedFeedback.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            setFeedback(sortedFeedback);
        };
        fetchFeedback();
    }, []);

    const handleGenerateInsights = useCallback(async () => {
        if (feedback.length === 0) return;
        setIsAnalyzing(true);
        try {
            const insights = await generateFeedbackAnalysis(feedback);
            setAiInsights(insights);
        } catch (error) {
            console.error("Failed to generate insights", error);
            alert("Kunde inte generera insikter.");
        } finally {
            setIsAnalyzing(false);
        }
    }, [feedback]);

    const handleDownloadPDF = useCallback(async () => {
        setIsDownloading(true);
        const htmlElement = document.documentElement;
        const wasInDarkMode = htmlElement.classList.contains('dark');
        const printableElement = document.createElement('div');
        let root: any = null; // Use a more generic type for the root

        try {
            // Temporarily switch to light mode for rendering
            if (wasInDarkMode) {
                htmlElement.classList.remove('dark');
            }

            printableElement.style.position = 'absolute';
            printableElement.style.left = '-9999px';
            printableElement.style.width = '210mm'; // A4 width
            document.body.appendChild(printableElement);

            root = (await import('react-dom/client')).createRoot(printableElement);
            root.render(<PrintableFeedback feedback={feedback} />);

            // Wait for render
            await new Promise(resolve => setTimeout(resolve, 500));

            const canvas = await html2canvas(printableElement, {
                scale: 2,
                backgroundColor: '#ffffff' // Explicitly set a white background
            });
            const imgData = canvas.toDataURL('image/png');

            const { jsPDF } = jspdf;
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = canvas.height * pdfWidth / canvas.width;
            
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position -= pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }
            
            const date = new Date().toISOString().split('T')[0];
            pdf.save(`feedback-rapport-${date}.pdf`);

        } catch(err) {
            console.error("PDF Generation failed:", err);
            alert("Kunde inte generera PDF. Se konsolen för mer information.");
        } finally {
            // Cleanup: unmount React component, remove element, restore theme
            if (root) {
                root.unmount();
            }
            if (printableElement.parentNode) {
                printableElement.parentNode.removeChild(printableElement);
            }
            if (wasInDarkMode) {
                htmlElement.classList.add('dark');
            }
            setIsDownloading(false);
        }
    }, [feedback]);


    return (
        <div className="card-base p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-2">Kvalitetsbarometern & Feedback</h2>
                    <p className="text-gray-600 dark:text-slate-400">Strategisk analys av användarupplevelsen.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                     <button 
                        onClick={handleGenerateInsights} 
                        disabled={feedback.length === 0 || isAnalyzing}
                        className="flex items-center justify-center bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 transition-colors duration-200 btn-press w-full sm:w-auto"
                    >
                        {isAnalyzing ? (
                             <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Analyserar...
                             </>
                        ) : (
                            <>
                                {ICONS.ai}
                                <span className="ml-2">Uppdatera Insikter (AI)</span>
                            </>
                        )}
                    </button>
                    <button 
                        onClick={handleDownloadPDF} 
                        disabled={feedback.length === 0 || isLoading || isDownloading}
                        className="flex items-center justify-center bg-slate-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-500 disabled:bg-slate-400 transition-colors duration-200 btn-press w-full sm:w-auto"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        <span className="ml-2">{isDownloading ? 'Genererar...' : 'Ladda ner PDF'}</span>
                    </button>
                </div>
            </div>
            
            {/* AI Insights Dashboard */}
            {aiInsights && (
                <div className="mb-8 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 animate-fade-in">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                        <span className="text-indigo-500 mr-2">{ICONS.chartPie}</span>
                        Strategisk Analys
                        <InfoTooltip text="AI-genererad analys baserad på all insamlad fritext och betyg." />
                    </h3>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                        {/* Gauge */}
                        <div className="lg:col-span-1">
                            <SentimentGauge score={aiInsights.sentimentScore} label={aiInsights.sentimentLabel} />
                        </div>

                        {/* Executive Summary */}
                        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Executive Summary</h4>
                            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{aiInsights.executiveSummary}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Trending Topics */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3">Trendande Ämnen</h4>
                            <div className="flex flex-wrap gap-2">
                                {aiInsights.trendingTopics.map((t, i) => (
                                    <span key={i} className={`px-3 py-1 rounded-full text-sm font-medium border ${t.sentiment === 'pos' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                                        {t.topic} ({t.count})
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Critical Alerts */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center">
                                <span className="text-red-500 mr-2">{ICONS.warning}</span> Kritiska Signaler
                            </h4>
                            {aiInsights.criticalAlerts.length > 0 ? (
                                <ul className="space-y-2">
                                    {aiInsights.criticalAlerts.map((alert, i) => (
                                        <li key={i} className="text-sm text-red-600 dark:text-red-400 flex items-start">
                                            <span className="mr-2">•</span> {alert}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-green-600 dark:text-green-400">Inga kritiska varningar identifierade.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">Rådata (Senaste inlägg)</h3>
                {feedback.length > 0 ? (
                    feedback.map(item => (
                        <div key={item.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border dark:border-slate-700">
                            <div className="flex justify-between items-center text-sm text-gray-500 dark:text-slate-400 mb-4 pb-2 border-b dark:border-slate-700">
                                <div className="flex flex-col">
                                    <span className="font-semibold text-base text-slate-800 dark:text-slate-200">{item.title}</span>
                                    {item.gender && item.ageRange && (
                                        <span className="text-xs">{`${item.gender === 'vill-ej-ange' ? 'Ej angett kön' : item.gender.charAt(0).toUpperCase() + item.gender.slice(1)}, ${item.ageRange}`}</span>
                                    )}
                                </div>
                                <span>{item.timestamp.toLocaleString('sv-SE')}</span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                <div className="space-y-3">
                                    <div>
                                        <p className="font-semibold text-slate-600 dark:text-slate-300">Helhetsintryck:</p>
                                        <RatingDisplay score={item.overallImpression} />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-600 dark:text-slate-300">Upplevd nytta:</p>
                                        <div className="pl-2 mt-1 space-y-1">
                                            <p>Checklistor: <RatingDisplay score={item.featureUsefulness.checklist} /></p>
                                            <p>Kunskapstest: <RatingDisplay score={item.featureUsefulness.knowledgeTest} /></p>
                                            <p>Struktur: <RatingDisplay score={item.featureUsefulness.structure} /></p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                     <div>
                                        <p className="font-semibold text-slate-600 dark:text-slate-300">Syn på AI & Tänkande:</p>
                                        <div className="pl-2 mt-1 space-y-1">
                                            <p>AI-stöd: <RatingDisplay score={item.aiAndThinking.viewOnAI} /></p>
                                            <p>Kritiskt tänkande: <RatingDisplay score={item.aiAndThinking.criticalThinking} /></p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {item.comments && (
                                <div className="mt-4 pt-4 border-t dark:border-slate-700">
                                    <h4 className="font-semibold text-slate-600 dark:text-slate-300">Kommentarer:</h4>
                                    <p className="text-gray-800 dark:text-slate-200 whitespace-pre-wrap italic bg-slate-100 dark:bg-slate-700/50 p-2 rounded-md mt-1">"{item.comments}"</p>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <p className="text-center text-gray-500 dark:text-slate-400 py-8">Ingen feedback har lämnats ännu.</p>
                )}
            </div>

             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
            `}</style>
        </div>
    );
});

export default FeedbackViewer;
