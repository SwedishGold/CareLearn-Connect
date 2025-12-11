import React, { useState, useMemo, useRef, useEffect, memo, useCallback } from 'react';
import { User, CareFlowStep, CustomDocument, CustomDocumentMetadata } from '../types';
import * as storage from '../services/localStorageService';
import { APP_DATA, ICONS, TERMINOLOGY } from '../constants';
import { CareFlowNavigator, RelationGraph, InfoTooltip, Modal, FlowRenderer } from './UI';
import { extractMetadata, summarizeDocumentContent, generateCareFlowFromContext } from '../services/geminiService'; // Import new flow function
import { playClick, playToggle, playTabSwitch, playUpload, playDelete, playProcess, playSuccess } from '../services/soundService';

// Make TypeScript aware of the globally included libraries
declare const pdfjsLib: any;
declare const mammoth: any;

// Set the worker source for pdf.js once
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs`;
}

interface ModulesProps {
  user: User;
  onAskAI: (prompt: string) => void;
  onSaveCareFlow: (query: string, flow: CareFlowStep[]) => void;
  initialOpenDocId?: string | null;
  highlighting?: { docId: string; quote: string } | null;
  onHighlightComplete: () => void;
}

const SmartTextRenderer: React.FC<{ text: string }> = memo(({ text }) => {
    const regex = useMemo(() => {
        if (TERMINOLOGY.length === 0) return null;
        const termsPattern = TERMINOLOGY
            .map(t => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .sort((a, b) => b.length - a.length) 
            .join('|');
        return new RegExp(`\\b(${termsPattern})\\b`, 'gi');
    }, []);

    if (!text) return null;
    if (!regex) return <>{text}</>;

    const parts = text.split(regex);

    return (
        <span>
            {parts.map((part, i) => {
                const matchedTerm = TERMINOLOGY.find(t => t.term.toLowerCase() === part.toLowerCase());
                if (matchedTerm) {
                    return (
                        <span key={i} className="group relative inline-block cursor-help border-b border-dotted border-slate-500 hover:border-red-400 text-slate-200 hover:text-white transition-colors">
                            {part}
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-slate-200 text-xs rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-700">
                                <strong className="block text-red-400 mb-1 text-sm">{matchedTerm.term}</strong>
                                {matchedTerm.definition}
                                <br/>
                                <em className="block mt-2 text-slate-400">{matchedTerm.context}</em>
                                <svg className="absolute text-slate-900 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
                            </span>
                        </span>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
});

// Helper to parse uploaded files
const parseFile = (file: File): Promise<{ title: string; content: string }> => {
    return new Promise((resolve, reject) => {
        if (file.type === 'application/msword') {
            return reject(new Error(`Gammalt .doc-format. Spara om filen som .docx eller .pdf och försök igen.`));
        }

        const title = file.name.replace(/\.[^/.]+$/, ''); // Remove any extension
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                if (!event.target?.result) {
                    return reject(new Error(`Kunde inte läsa filen ${file.name}.`));
                }

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
                } else { // Default to text
                    content = event.target.result as string;
                }

                if (content.trim()) {
                    resolve({ title, content });
                } else {
                    reject(new Error(`Filen ${file.name} verkar vara tom.`));
                }
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


export const Modules: React.FC<ModulesProps> = memo(({ user, onAskAI, onSaveCareFlow, initialOpenDocId, highlighting, onHighlightComplete }) => {
    const [activeTab, setActiveTab] = useState<'documents' | 'wiki'>('documents');
    const [searchQuery, setSearchQuery] = useState('');
    const [openDocKey, setOpenDocKey] = useState<string | null>(initialOpenDocId || null);
    const [expandedTermIndex, setExpandedTermIndex] = useState<number | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    
    // Summarization State
    const [summaryResult, setSummaryResult] = useState<{ docId: string, text: string } | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    
    // Care Flow Generation State
    const [isGeneratingFlow, setIsGeneratingFlow] = useState(false);
    const [generatedFlow, setGeneratedFlow] = useState<{ docTitle: string, flow: CareFlowStep[] } | null>(null);
    
    const docRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const highlightRef = useRef<HTMLElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [customDocuments, setCustomDocuments] = useState<CustomDocument[]>([]);

    const loadDocs = useCallback(async () => {
        // Pass user workplace and role to filter correctly
        const docs = await storage.getCustomDocuments(user.workplace, user.role);
        setCustomDocuments(docs);
    }, [user]);

    useEffect(() => {
        loadDocs();
    }, [loadDocs]);

    const allDocuments = useMemo(() => {
        const builtIn: CustomDocument[] = Object.entries(APP_DATA.documents).map(([id, doc]) => ({ id, ...doc, isCustom: false }));
        return [...builtIn, ...customDocuments];
    }, [customDocuments]);

    const filteredDocuments = useMemo(() => {
        if (!searchQuery.trim()) return allDocuments;
        const lowerQuery = searchQuery.toLowerCase();
        return allDocuments.filter(doc => 
            doc.title.toLowerCase().includes(lowerQuery) || 
            doc.content.toLowerCase().includes(lowerQuery)
        );
    }, [allDocuments, searchQuery]);

    const filteredTerminology = useMemo(() => {
        if (!searchQuery.trim()) return TERMINOLOGY;
        const lowerQuery = searchQuery.toLowerCase();
        return TERMINOLOGY.filter(item => 
            item.term.toLowerCase().includes(lowerQuery) || 
            item.definition.toLowerCase().includes(lowerQuery)
        );
    }, [searchQuery]);

    // Simplified toggle for expand/collapse (now redundant for text but kept for state management if needed)
    const handleToggle = (docKey: string) => {
        playToggle();
        if (openDocKey === docKey) {
            setOpenDocKey(null);
        } else {
            setOpenDocKey(docKey);
        }
    };
    
    const handleRelatedClick = useCallback((relatedKey: string) => {
        playClick();
        const targetElement = docRefs.current[relatedKey];
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setOpenDocKey(relatedKey);
        }
    }, []);
    
    const handleReportGap = useCallback(() => {
        if (searchQuery.trim()) {
            storage.saveKnowledgeGap(searchQuery.trim(), user);
            alert('Tack! Vi har registrerat detta som en saknad resurs.');
            setSearchQuery('');
        }
    }, [searchQuery, user]);

    const handleSummarize = useCallback(async (doc: CustomDocument) => {
        if (openDocKey === doc.id && summaryResult?.docId === doc.id) {
            // Toggle off
            setOpenDocKey(null);
            return;
        }
        
        setIsSummarizing(true);
        setOpenDocKey(doc.id); // Open this doc card
        setSummaryResult(null);
        playProcess();
        
        try {
            const text = await summarizeDocumentContent(doc.content);
            setSummaryResult({ docId: doc.id, text });
        } catch (error) {
            alert("Kunde inte sammanfatta dokumentet.");
        } finally {
            setIsSummarizing(false);
        }
    }, [openDocKey, summaryResult]);

    // --- NEW: Generate Care Flow from specific doc ---
    const handleGenerateFlow = useCallback(async (doc: CustomDocument) => {
        setIsGeneratingFlow(true);
        playProcess();
        try {
            const flow = await generateCareFlowFromContext(doc.content, doc.title, user.role);
            if (flow && flow.length > 0) {
                setGeneratedFlow({ docTitle: doc.title, flow });
                playSuccess();
            } else {
                alert("Kunde inte skapa ett vårdflöde från detta dokument.");
            }
        } catch (e) {
            console.error(e);
            alert("Ett fel uppstod vid generering.");
        } finally {
            setIsGeneratingFlow(false);
        }
    }, [user.role]);

    // Upload Logic
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        playUpload();

        let successCount = 0;
        for (let i = 0; i < files.length; i++) {
            try {
                const { title, content } = await parseFile(files[i]);
                const metadata = await extractMetadata(content);
                // Uploaded by user in "Resurser" -> Defaults to their workplace and is visible to all roles there by default
                storage.addCustomDocument({ 
                    title, 
                    content, 
                    metadata: { ...metadata, responsibleUnit: `Uppladdad av ${user.name}` },
                    workplace: user.workplace
                });
                successCount++;
            } catch (e) {
                console.error(e);
                alert(`Kunde inte ladda upp ${files[i].name}`);
            }
        }
        
        setIsUploading(false);
        setShowUpload(false);
        loadDocs(); // Refresh list
        if (successCount > 0) {
            alert(`${successCount} dokument har lagts till i din kunskapsbank. AI-Handledaren kan nu svara på frågor om dessa.`);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleDeleteDocument = (docId: string) => {
        if (window.confirm("Vill du ta bort detta dokument? Det kommer inte längre vara tillgängligt för AI:n.")) {
            playDelete();
            storage.deleteCustomDocument(docId);
            loadDocs();
        }
    };
    
    // Auto-scroll to summary if opened via AI link
    useEffect(() => {
        const targetId = initialOpenDocId;
        if (targetId) {
            setActiveTab('documents');
            const doc = allDocuments.find(d => d.id === targetId);
            if (doc) {
                handleSummarize(doc); // Auto-summarize when linked
            }
        }
    }, [initialOpenDocId, allDocuments, handleSummarize]);

    return (
        <div className="space-y-6">
            
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button
                        onClick={() => { playTabSwitch(); setActiveTab('documents'); setSearchQuery(''); }}
                        className={`px-6 py-2 rounded-md text-sm font-bold transition-all duration-200 ${activeTab === 'documents' ? 'bg-slate-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Rutiner & Dokument
                    </button>
                    <button
                        onClick={() => { playTabSwitch(); setActiveTab('wiki'); setSearchQuery(''); }}
                        className={`px-6 py-2 rounded-md text-sm font-bold transition-all duration-200 ${activeTab === 'wiki' ? 'bg-slate-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Begrepps-akuten (Wiki)
                    </button>
                </div>
            </div>

            {activeTab === 'documents' && (
                <>
                    <CareFlowNavigator user={user} onSourceClick={ (title: string) => {
                        const doc = allDocuments.find(d => d.title === title);
                        if(doc) {
                            handleRelatedClick(doc.id);
                            // Optionally trigger summary automatically
                            handleSummarize(doc);
                        }
                    }} onSaveFlow={onSaveCareFlow} />

                    <div className="card-base p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                                    Kunskapsbank (RAG)
                                    <InfoTooltip text="Dessa dokument används av AI-Handledaren för att svara på dina frågor. Du kan inte läsa hela texten här (för att undvika 'information overload'), men du kan få en smart sammanfattning eller generera en guide." />
                                </h2>
                            </div>
                            
                            <div className="flex gap-2 w-full sm:w-auto">
                                <div className="relative flex-1 sm:w-64">
                                    <input 
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Sök i dokument..."
                                        className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-md pl-9 pr-3 py-2 focus:ring-2 focus:ring-red-500 focus:outline-none"
                                    />
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <button 
                                    onClick={() => setShowUpload(!showUpload)}
                                    className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-md transition-colors flex items-center gap-2 text-sm font-bold"
                                >
                                    {showUpload ? 'Dölj uppladdning' : '+ Lägg till'}
                                </button>
                            </div>
                        </div>

                        {showUpload && (
                            <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg animate-fade-in">
                                <h3 className="text-sm font-bold text-slate-200 mb-2">Lägg till nya kunskapsdokument</h3>
                                <p className="text-xs text-slate-400 mb-4">Ladda upp lokala rutiner eller PM (.pdf, .docx). Dessa sparas endast i din webbläsare och används av AI:n för att ge dig bättre svar.</p>
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    accept=".pdf,.docx,.txt"
                                    multiple
                                    onChange={handleFileUpload}
                                    disabled={isUploading}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 mb-2"
                                />
                                {isUploading && <p className="text-xs text-indigo-400 animate-pulse">Bearbetar och läser in dokument...</p>}
                            </div>
                        )}

                        <div className="space-y-3">
                            {filteredDocuments.length > 0 ? (
                                filteredDocuments.map((doc) => (
                                    <div
                                        key={doc.id}
                                        ref={(el) => { docRefs.current[doc.id] = el; }}
                                        className="p-4 rounded-md border border-slate-700 bg-slate-800/30 transition-all duration-300"
                                    >
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="p-2 bg-slate-700 rounded text-slate-300 flex-shrink-0">
                                                    {React.cloneElement(ICONS.document, { className: "w-5 h-5" })}
                                                </div>
                                                <div className="truncate">
                                                    <span className="font-semibold text-lg text-slate-100 block truncate" title={doc.title}>
                                                        {doc.title}
                                                    </span>
                                                    <div className="flex gap-2 text-xs text-slate-500 mt-1">
                                                        {doc.isCustom && <span className="text-indigo-400 font-bold">Egen</span>}
                                                        <span>{doc.metadata?.type || 'Dokument'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                                <button
                                                    onClick={() => handleSummarize(doc)}
                                                    disabled={isSummarizing}
                                                    className={`flex-1 sm:flex-none text-sm font-semibold py-2 px-4 rounded-md flex items-center justify-center gap-1.5 btn-press transition-colors ${
                                                        openDocKey === doc.id && summaryResult?.docId === doc.id 
                                                        ? 'bg-slate-600 text-white' 
                                                        : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                                                    }`}
                                                >
                                                    {React.cloneElement(ICONS.ai, { className: "w-4 h-4" })}
                                                    {openDocKey === doc.id && summaryResult?.docId === doc.id ? 'Dölj' : 'Sammanfatta'}
                                                </button>
                                                
                                                <button
                                                    onClick={() => handleGenerateFlow(doc)}
                                                    disabled={isGeneratingFlow}
                                                    className="flex-1 sm:flex-none text-sm bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 flex items-center justify-center gap-1.5 btn-press shadow-lg shadow-indigo-900/20"
                                                >
                                                    {React.cloneElement(ICONS.sbar, { className: "w-4 h-4" })}
                                                    Skapa Vårdflöde
                                                </button>

                                                {doc.isCustom && (
                                                    <button 
                                                        onClick={() => handleDeleteDocument(doc.id)}
                                                        className="p-2 text-red-400 hover:bg-red-900/30 rounded-md transition-colors"
                                                        title="Radera"
                                                    >
                                                        {ICONS.trash}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Summary Result Display */}
                                        {summaryResult && summaryResult.docId === doc.id && openDocKey === doc.id && (
                                            <div className="mt-4 p-6 bg-indigo-900/20 border border-indigo-800 rounded-lg text-sm text-slate-200 animate-fade-in shadow-inner relative">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-l-lg"></div>
                                                <h4 className="font-bold text-indigo-300 text-base mb-3 flex items-center gap-2">
                                                    {ICONS.ai} AI-Sammanfattning
                                                </h4>
                                                <div className="prose prose-invert prose-sm max-w-none space-y-4 leading-relaxed">
                                                    <div dangerouslySetInnerHTML={{ 
                                                        __html: summaryResult.text
                                                            .replace(/### (.*)/g, '<h3 class="text-white font-bold text-base mt-4 mb-2">$1</h3>')
                                                            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-200 font-bold">$1</strong>')
                                                            .replace(/^- (.*)/gm, '<li class="ml-4 list-disc text-slate-300 mb-1">$1</li>')
                                                            .replace(/\n/g, '<br/>')
                                                    }} />
                                                </div>
                                            </div>
                                        )}
                                        {isSummarizing && openDocKey === doc.id && !summaryResult && (
                                            <div className="mt-4 p-4 bg-slate-800 rounded-lg animate-pulse text-sm text-slate-400 flex items-center gap-3">
                                                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                                AI:n läser dokumentet och sammanfattar...
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 space-y-4">
                                     <p className="text-slate-400">Inga dokument matchade din sökning "{searchQuery}".</p>
                                     <button onClick={handleReportGap} className="text-sm bg-red-900/30 text-red-200 border border-red-800 py-2 px-4 rounded-md hover:bg-red-900/50 transition-colors">
                                        Rapportera saknad information
                                     </button>
                                     <p className="text-xs text-slate-500">Detta hjälper admin att veta vad som saknas i kunskapsbanken.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'wiki' && (
                <div className="card-base p-6 animate-fade-in">
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                                Begrepps-akuten
                                <InfoTooltip text="En snabbguide till de vanligaste förkortningarna och begreppen på avdelningen." />
                            </h2>
                            <p className="text-slate-400 text-sm mt-1">Förklaringar till PIVA-språket.</p>
                        </div>
                        <div className="relative w-full sm:w-64">
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Sök begrepp (t.ex. LPT)..."
                                className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded-md pl-9 pr-3 py-2 focus:ring-2 focus:ring-red-500 focus:outline-none"
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredTerminology.map((item, index) => (
                            <div 
                                key={index}
                                className={`bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-red-500/50 transition-all duration-200 cursor-pointer ${expandedTermIndex === index ? 'col-span-1 sm:col-span-2 lg:col-span-3 bg-slate-800 border-red-500 shadow-lg ring-1 ring-red-500/30' : 'hover:-translate-y-1'}`}
                                onClick={() => { playToggle(); setExpandedTermIndex(expandedTermIndex === index ? null : index); }}
                            >
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-red-400 tracking-wider">{item.term}</h3>
                                    {expandedTermIndex === index ? (
                                        <span className="text-slate-500">&times;</span>
                                    ) : (
                                        <span className="text-slate-600 text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity">Info &rarr;</span>
                                    )}
                                </div>
                                <p className="text-slate-200 font-medium mt-1">{item.definition}</p>
                                
                                {expandedTermIndex === index && (
                                    <div className="mt-4 pt-4 border-t border-slate-700 animate-fade-in">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Kontext & Användning</h4>
                                        <p className="text-slate-300 text-sm leading-relaxed">{item.context}</p>
                                        
                                        <div className="mt-4 flex justify-end">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAskAI(`Förklara begreppet "${item.term}" (${item.definition}) mer ingående och ge exempel på hur det används på en vårdavdelning.`);
                                                }}
                                                className="text-xs bg-slate-700 hover:bg-slate-600 text-white py-1.5 px-3 rounded flex items-center gap-1.5 transition-colors"
                                            >
                                                {ICONS.ai} Be AI förklara mer
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    
                    {filteredTerminology.length === 0 && (
                         <p className="text-slate-400 text-center py-8">Inga begrepp matchade din sökning.</p>
                    )}
                </div>
            )}
            
            {/* Generated Flow Modal */}
            {generatedFlow && (
                <Modal title={`Vårdflöde: ${generatedFlow.docTitle}`} onClose={() => setGeneratedFlow(null)}>
                    <div className="space-y-4">
                        <p className="text-slate-300 text-sm mb-4">Här är ett genererat vårdflöde baserat på dokumentet. Du kan spara det till din samling.</p>
                        <FlowRenderer flow={generatedFlow.flow} />
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
                            <button 
                                onClick={() => setGeneratedFlow(null)}
                                className="px-4 py-2 text-slate-300 hover:text-white font-medium transition-colors"
                            >
                                Stäng
                            </button>
                            <button 
                                onClick={() => {
                                    onSaveCareFlow(`Guide: ${generatedFlow.docTitle}`, generatedFlow.flow);
                                    playSuccess();
                                    setGeneratedFlow(null);
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-lg btn-press flex items-center gap-2"
                            >
                                {ICONS.sbar} Spara till Vårdflöden
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
            
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
            `}</style>
        </div>
    );
});