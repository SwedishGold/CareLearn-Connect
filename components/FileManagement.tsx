
import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { CustomDocument, CustomDocumentMetadata, KnowledgeTestQuestion } from '../types';
import * as storage from '../services/localStorageService';
import { InfoTooltip, Modal } from './UI';
import { extractMetadata, generateQuizFromDocument } from '../services/geminiService';
import { checkTextForPII } from '../services/securityService'; // NEW IMPORT
import { playDelete, playUpload, playAlert } from '../services/soundService';

// Make TypeScript aware of the globally included libraries
declare const pdfjsLib: any;
declare const mammoth: any;

// Set the worker source for pdf.js once
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs`;
}

// EXPORTED helper to parse uploaded files so Quiz component can use it
export const parseFile = (file: File): Promise<{ title: string; content: string }> => {
    return new Promise((resolve, reject) => {
        // STRESS TEST FIX: Limit file size to 5MB
        if (file.size > 5 * 1024 * 1024) {
            return reject(new Error(`Filen är för stor (${(file.size / 1024 / 1024).toFixed(1)}MB). Maxgräns är 5MB.`));
        }

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


const FileManagement: React.FC = memo(() => {
    const [documents, setDocuments] = useState<CustomDocument[]>([]);
    const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
    const [docToDelete, setDocToDelete] = useState<CustomDocument | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [showImportConfirm, setShowImportConfirm] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importFileInputRef = useRef<HTMLInputElement>(null);
    const [uploadStatus, setUploadStatus] = useState<{ success: string[], errors: string[] } | null>(null);
    
    const [uploadProgress, setUploadProgress] = useState({
        current: 0,
        total: 0,
        percent: 0,
        currentFileName: ''
    });
    
    // Quiz Generation State
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    const [generatedQuestions, setGeneratedQuestions] = useState<KnowledgeTestQuestion[] | null>(null);
    const [quizSourceDocTitle, setQuizSourceDocTitle] = useState('');


    const loadDocs = useCallback(async () => {
        setDocuments(await storage.getCustomDocuments());
    }, []);

    useEffect(() => {
        loadDocs();
    }, [loadDocs]);

    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setUploadStatus(null); // Clear previous status
        const files = event.target.files;
        if (files) {
            const allowedTypes = [
                "text/plain",
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/msword" // .doc
            ];
            const acceptedFiles = Array.from(files).filter((file: File) => allowedTypes.includes(file.type));
            
            if (acceptedFiles.length !== files.length) {
                alert("Vissa filer hade ett format som inte stöds och har ignorerats. Endast .txt, .pdf, .doc och .docx är tillåtna.");
            }
            setFilesToUpload(acceptedFiles);
        } else {
            setFilesToUpload([]);
        }
    }, []);

    const handleUpload = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (filesToUpload.length === 0 || isUploading) return;
        
        setIsUploading(true);
        setUploadStatus(null);
        playUpload();
        
        // Initialize progress
        setUploadProgress({
            current: 0,
            total: filesToUpload.length,
            percent: 0,
            currentFileName: 'Initierar...'
        });

        const successfulDocs: { title: string; content: string, metadata: CustomDocumentMetadata }[] = [];
        const failedUploads: string[] = [];

        // Process files sequentially to provide accurate progress updates
        for (let i = 0; i < filesToUpload.length; i++) {
            const file = filesToUpload[i];
            
            // Update progress: Start of file processing
            setUploadProgress(prev => ({
                ...prev,
                current: i + 1,
                currentFileName: file.name,
                percent: Math.round(((i) / filesToUpload.length) * 100)
            }));

            try {
                // Parse content
                const { title, content } = await parseFile(file);
                
                // 2. SAFETY CHECK: Scan for PII (GDPR) - USING LOCAL SECURITY SERVICE
                const piiCheck = checkTextForPII(content);
                if (!piiCheck.safe) {
                    playAlert();
                    throw new Error(`BLOCKERAD: ${piiCheck.reason}`);
                }

                // AI Metadata Extraction
                const metadata = await extractMetadata(content);
                
                successfulDocs.push({ title, content, metadata });
                storage.addCustomDocument({ title, content, metadata });

            } catch (error: any) {
                console.error(`Error processing ${file.name}:`, error);
                failedUploads.push(`${file.name}: ${error.message}`);
            }
            
            // Update progress: End of file processing
            setUploadProgress(prev => ({
                ...prev,
                percent: Math.round(((i + 1) / filesToUpload.length) * 100)
            }));
        }
        
        setUploadStatus({
            success: successfulDocs.map(d => d.title),
            errors: failedUploads,
        });
        
        loadDocs();
        setFilesToUpload([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        
        // Small delay to show 100% completion before resetting UI state
        setTimeout(() => {
            setIsUploading(false);
            setUploadProgress({ current: 0, total: 0, percent: 0, currentFileName: '' });
        }, 500);
        
    }, [filesToUpload, isUploading, loadDocs]);

    const handleDelete = useCallback((doc: CustomDocument) => {
        setDocToDelete(doc);
    }, []);

    const confirmDelete = useCallback(() => {
        if (docToDelete) {
            playDelete();
            storage.deleteCustomDocument(docToDelete.id);
            loadDocs();
            setDocToDelete(null);
        }
    }, [docToDelete, loadDocs]);
    
    const handleGenerateQuiz = useCallback(async (doc: CustomDocument) => {
        setIsGeneratingQuiz(true);
        setQuizSourceDocTitle(doc.title);
        setGeneratedQuestions(null);
        
        try {
            const questions = await generateQuizFromDocument(doc.content);
            setGeneratedQuestions(questions);
        } catch(error) {
            alert("Kunde inte generera frågor. Kontrollera din anslutning och försök igen.");
            console.error(error);
        } finally {
            setIsGeneratingQuiz(false);
        }
    }, []);

    const saveQuizToTest = useCallback(async (target: 'usk' | 'ssk') => {
        if (!generatedQuestions) return;
        
        const settings = await storage.loadDepartmentSettings();
        if (!settings) return;

        try {
            const fieldName = target === 'usk' ? 'knowledgeTestQuestionsUsk' : 'knowledgeTestQuestionsSsk';
            const currentQuestionsStr = settings[fieldName];
            let currentQuestions: { tier1: KnowledgeTestQuestion[], tier2: KnowledgeTestQuestion[] } = { tier1: [], tier2: [] };
            
            try { 
                currentQuestions = JSON.parse(currentQuestionsStr);
                // Safeguard if parsed object is missing properties
                if (!currentQuestions.tier1) currentQuestions.tier1 = [];
                if (!currentQuestions.tier2) currentQuestions.tier2 = [];
            } catch(e) { 
                // Ignore parse error, start fresh
            }

            // RE-INDEXING LOGIC:
            // Calculate the highest current originalIndex to ensure new questions don't collide.
            // This allows the "Pool" to grow indefinitely.
            const existingTier1 = currentQuestions.tier1 || [];
            const maxIndex = existingTier1.reduce((max, q) => Math.max(max, q.originalIndex || 0), 0);
            
            const newQuestionsReindexed = generatedQuestions.map((q, i) => ({
                ...q,
                originalIndex: maxIndex + 1 + i, // Continue index from max
                verified: false // Generated questions are unverified by default
            }));

            // Append new questions to Tier 1
            currentQuestions.tier1 = [...existingTier1, ...newQuestionsReindexed];
            
            const updatedSettings = { ...settings, [fieldName]: JSON.stringify(currentQuestions) };
            storage.saveDepartmentSettings(updatedSettings);
            
            alert(`✅ ${generatedQuestions.length} frågor har lagts till i ${target === 'usk' ? 'Undersköterska' : 'Sjuksköterska'}-poolen! Totalt antal frågor i poolen: ${currentQuestions.tier1.length}.`);
            setGeneratedQuestions(null);
            
        } catch (error) {
            console.error("Error saving quiz questions:", error);
            alert("Kunde inte spara frågorna. Ett fel uppstod vid uppdatering av inställningarna.");
        }
    }, [generatedQuestions]);


    const handleExport = useCallback(async () => {
        setIsExporting(true);
        try {
            const jsonData = await storage.exportAllData();
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().split('T')[0];
            a.download = `carelearn-backup-${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Kunde inte exportera data.');
        } finally {
            setIsExporting(false);
        }
    }, []);

    const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImportFile(file);
            setShowImportConfirm(true);
        }
    };

    const confirmImport = () => {
        if (!importFile) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const jsonString = event.target?.result as string;
                storage.importAllData(jsonString);
                alert("Data har importerats! Sidan kommer nu att laddas om.");
                window.location.reload();
            } catch (error) {
                console.error('Import failed:', error);
                alert("Kunde inte importera data. Kontrollera att filen är en giltig backup-fil.");
            } finally {
                setShowImportConfirm(false);
                setImportFile(null);
                if (importFileInputRef.current) {
                    importFileInputRef.current.value = "";
                }
            }
        };
        reader.readAsText(importFile);
    };


    return (
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-lg shadow-md max-w-4xl mx-auto space-y-8 border dark:border-slate-700">
            <div>
                <div className="flex items-center">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Hantera Kunskapsbank (AI)</h1>
                </div>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                    Här hanterar du de lokala dokument som AI-Handledaren använder som kunskapskälla för er avdelning. Följ stegen nedan för att lägga till era specifika rutiner från Google Drive.
                </p>
            </div>
            
            <div className="p-6 bg-blue-50 dark:bg-blue-900/40 border-l-4 border-blue-400 rounded-r-md">
                <h2 className="font-bold text-blue-800 dark:text-blue-200">Process i två steg för att lägga till filer från Google Drive:</h2>
                <ol className="list-decimal list-inside mt-2 space-y-2 text-blue-900 dark:text-blue-300">
                    <li><strong className="font-semibold">Förbered i Google Drive:</strong> Se till att dina dokument (t.ex. lokala PM för Avd. 51) är i PDF- eller DOCX-format och ladda ner dem till din dator.</li>
                    <li><strong className="font-semibold">Ladda upp till appen:</strong> Använd formuläret nedan för att ladda upp filerna från din dator till appens kunskapsbank.</li>
                </ol>
                <p className="text-xs mt-3 text-slate-600 dark:text-slate-400 italic">
                    <strong>Varför detta extra steg?</strong> För högsta säkerhet hanteras inga lösenord eller direkta API-kopplingar till Google Drive i appen. Denna metod säkerställer att ingen känslig information lämnar din webbläsare och är den säkraste lösningen för en webbapplikation.
                </p>
            </div>

            <form onSubmit={handleUpload} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700 space-y-4">
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 flex items-center">
                    Ladda upp filer
                    <InfoTooltip text="Välj en eller flera filer (.txt, .pdf, .docx) från din dator. Appen kommer att läsa innehållet och göra det tillgängligt för AI-Handledaren." />
                </h2>
                <div>
                    <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Välj filer (.txt, .pdf, .docx)</label>
                    <input 
                        ref={fileInputRef}
                        id="file-upload"
                        type="file" 
                        multiple 
                        onChange={handleFileChange} 
                        className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900/50 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900" 
                    />
                </div>
                 {filesToUpload.length > 0 && !isUploading && (
                    <ul className="text-sm text-slate-600 dark:text-slate-300 list-disc list-inside">
                        {filesToUpload.map(f => <li key={f.name}>{f.name} ({(f.size / 1024).toFixed(1)} KB)</li>)}
                    </ul>
                 )}

                {isUploading && (
                    <div className="space-y-2 mt-4">
                        <div className="flex justify-between text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                            <span>Bearbetar: {uploadProgress.currentFileName}</span>
                            <span>{uploadProgress.current} av {uploadProgress.total}</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4">
                            <div 
                                className="bg-indigo-600 h-4 rounded-full transition-all duration-300 ease-out flex items-center justify-center text-[10px] text-white font-bold" 
                                style={{ width: `${uploadProgress.percent}%` }}
                            >
                                {uploadProgress.percent}%
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic text-center">AI:n läser och kategoriserar dokumenten. Detta kan ta en stund...</p>
                    </div>
                )}

                <button type="submit" disabled={isUploading || filesToUpload.length === 0} className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:bg-indigo-400 btn-press">
                    {isUploading ? 'Bearbetar...' : `Ladda upp ${filesToUpload.length} fil(er)`}
                </button>
                
                {uploadStatus && (
                    <div className="mt-4 text-sm">
                        {uploadStatus.success.length > 0 && (
                            <div className="p-3 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-md">
                                <p className="font-bold">Lyckade uppladdningar:</p>
                                <ul className="list-disc list-inside">
                                    {uploadStatus.success.map(s => <li key={s}>{s}</li>)}
                                </ul>
                            </div>
                        )}
                         {uploadStatus.errors.length > 0 && (
                            <div className="p-3 mt-2 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md">
                                <p className="font-bold">Misslyckade uppladdningar:</p>
                                <ul className="list-disc list-inside">
                                    {uploadStatus.errors.map(e => <li key={e}>{e}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </form>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-4">Uppladdade AI-dokument</h2>
                <div className="space-y-3">
                    {documents.length > 0 ? (
                        documents.map(doc => (
                            <div key={doc.id} className="flex items-center gap-4 p-3 bg-white dark:bg-slate-700/50 rounded-md border dark:border-slate-600/50">
                                <div className="flex-1">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200">{doc.title}</p>
                                    {doc.metadata && (
                                        <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            {doc.metadata.type && <span className="px-2 py-1 bg-slate-700 rounded text-slate-300">Typ: <strong>{doc.metadata.type}</strong></span>}
                                            {doc.metadata.responsibleUnit && <span className="px-2 py-1 bg-slate-700 rounded text-slate-300">Ansvarig: <strong>{doc.metadata.responsibleUnit}</strong></span>}
                                            {doc.metadata.validUntil && <span className="px-2 py-1 bg-slate-700 rounded text-slate-300">Giltig t.o.m: <strong>{doc.metadata.validUntil}</strong></span>}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleGenerateQuiz(doc)} disabled={isGeneratingQuiz} className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:bg-indigo-400">
                                        {isGeneratingQuiz && quizSourceDocTitle === doc.title ? '...' : 'Generera Quiz'}
                                    </button>
                                    <button onClick={() => handleDelete(doc)} className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 rounded-full hover:bg-red-200 dark:hover:bg-red-800 transition-colors btn-press">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-slate-500 dark:text-slate-400">Inga dokument har laddats upp än.</p>
                    )}
                </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 flex items-center">
                    Säkerhetskopiering av Appdata
                    <InfoTooltip text="Exportera all applikationsdata (användare, feedback, framsteg etc.) till en JSON-fil som en säkerhetskopia. Denna fil kan sedan importeras för att återställa appen."/>
                </h2>
                <div className="mt-4 flex flex-col sm:flex-row gap-4">
                    <button onClick={handleExport} disabled={isExporting} className="flex-1 bg-slate-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center disabled:bg-slate-400 btn-press">
                        {isExporting ? 'Exporterar...' : 'Exportera All Data'}
                    </button>
                    <button onClick={() => importFileInputRef.current?.click()} className="flex-1 bg-slate-200 text-slate-800 font-bold py-3 px-6 rounded-lg hover:bg-slate-300 transition-colors flex items-center justify-center btn-press">
                        Importera Data från Fil
                    </button>
                    <input type="file" ref={importFileInputRef} onChange={handleImportFileChange} accept=".json" className="hidden" />
                </div>
            </div>

            {docToDelete && (
                <Modal title="Radera Dokument" onClose={() => setDocToDelete(null)}>
                    <p>Är du säker på att du vill radera dokumentet <strong>{docToDelete.title}</strong>? Detta kan inte ångras.</p>
                     <div className="flex justify-end gap-4 mt-6">
                        <button onClick={() => setDocToDelete(null)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Avbryt</button>
                        <button onClick={confirmDelete} className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600">Radera</button>
                    </div>
                </Modal>
            )}

            {showImportConfirm && importFile && (
                <Modal title="Bekräfta Import" onClose={() => setShowImportConfirm(false)}>
                    <div className="p-4 border-l-4 rounded-r-lg bg-red-50 dark:bg-red-900/40 border-red-400">
                        <h4 className="font-bold text-red-800 dark:text-red-200">VARNING: Detta kommer att skriva över all befintlig data!</h4>
                        <p className="text-red-900 dark:text-red-300 mt-1">
                            Är du säker på att du vill importera datan från filen <strong>{importFile.name}</strong>? All nuvarande data i applikationen (användare, framsteg, feedback, etc.) kommer att raderas och ersättas. Detta kan inte ångras.
                        </p>
                    </div>
                     <div className="flex justify-end gap-4 mt-6">
                        <button onClick={() => setShowImportConfirm(false)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Avbryt</button>
                        <button onClick={confirmImport} className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600">Ja, importera och skriv över</button>
                    </div>
                </Modal>
            )}
            
            {generatedQuestions && (
                <Modal title={`Granska AI-genererat Quiz (${quizSourceDocTitle})`} onClose={() => setGeneratedQuestions(null)}>
                    <div className="space-y-6 max-h-[60vh] overflow-y-auto">
                        {generatedQuestions.map((q, index) => (
                            <div key={index} className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                <p className="font-bold text-slate-800 dark:text-slate-100">{index + 1}. {q.q}</p>
                                <ul className="mt-2 space-y-1 text-sm">
                                    {q.a.map((ans, idx) => (
                                        <li key={idx} className={`${ans.c ? 'text-green-600 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                                            {ans.c ? '✓ ' : '• '} {ans.t}
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-500 italic">Förklaring: {q.e}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
                        <button onClick={() => setGeneratedQuestions(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Avbryt</button>
                        <button onClick={() => saveQuizToTest('usk')} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">Lägg till i USK-poolen</button>
                        <button onClick={() => saveQuizToTest('ssk')} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Lägg till i SSK-poolen</button>
                    </div>
                </Modal>
            )}
        </div>
    );
});

export default FileManagement;
