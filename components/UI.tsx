
import React, { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { User, View, Role, NavItem as NavItemType, Notification, CareFlowStep, CustomDocument, ToastNotification } from '../types';
import { ICONS, APP_DATA, DOCUMENT_RELATIONS } from '../constants';
import { generateCareFlow } from '../services/geminiService';
import * as storage from '../services/localStorageService';
import { playClick, playNotification, playModalOpen, playToggle, playHover } from '../services/soundService';


// --- Helper Functions ---
export const getRoleDisplayName = (role: Role) => {
    const names: Record<Role, string> = {
      'usk-elev': 'Undersköterske-elev',
      'ssk-student': 'Sjuksköterske-student',
      'handledare-usk': 'Handledare (USK)',
      'handledare-ssk': 'Handledare (SSK)',
      'larare-usk': 'Lärare (USK)',
      'larare-ssk': 'Lärare (SSK)',
      'admin': 'Administratör/Chef',
      'vikarie-usk': 'Vikarie (USK)',
      'vikarie-ssk': 'Vikarie (SSK)',
      'overlakare': 'Överläkare',
      'huvudhandledare': 'Huvudhandledare',
      'anstalld-usk': 'Anställd (USK)',
      'anstalld-ssk': 'Anställd (SSK)',
      'developer': 'Utvecklare',
    };
    return names[role] || role;
};

/**
 * Converts a Date object to a 'YYYY-MM-DD' string, ignoring timezone.
 * This is crucial to prevent off-by-one errors when converting local dates.
 * @param date The date to convert.
 * @returns A string in 'YYYY-MM-DD' format.
 */
export const toYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- Reusable Components ---

// NEW: Security Indicator
const SecurityIndicator: React.FC = memo(() => (
    <div className="px-4 py-2 mt-2 mb-2 flex items-center justify-center text-xs text-slate-500">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded border border-slate-200 dark:border-slate-700/50" title="PII-filtret är aktivt. Ingen patientdata skickas.">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-mono">GDPR-SKYDD: AKTIVT</span>
        </div>
    </div>
));

// NEW: Upgrade Modal for Premium Features
export const UpgradeModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    useEffect(() => {
        playModalOpen();
    }, []);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-[60] p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-900 to-slate-900 p-6 text-center border-b border-slate-700">
                    <div className="mx-auto w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mb-4 border border-purple-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-1">Uppgradera till CareLearn Pro</h2>
                    <p className="text-purple-300 text-sm">Lås upp din fulla potential</p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-slate-300">
                            <span className="text-green-400">✓</span>
                            <p>Obegränsad AI-Handledare (Gemini 3 Pro)</p>
                        </div>
                        <div className="flex items-center gap-3 text-slate-300">
                            <span className="text-green-400">✓</span>
                            <p>Full tillgång till Kommunikationslabbet (Bild & Röst)</p>
                        </div>
                        <div className="flex items-center gap-3 text-slate-300">
                            <span className="text-green-400">✓</span>
                            <p>Djupgående loggboksanalys</p>
                        </div>
                        <div className="flex items-center gap-3 text-slate-300">
                            <span className="text-green-400">✓</span>
                            <p>SBAR-träning med röstfeedback</p>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-800 text-center">
                        <p className="text-3xl font-bold text-white mb-2">79 kr <span className="text-sm font-normal text-slate-400">/ månad</span></p>
                        <p className="text-xs text-slate-500 mb-4">Ingen bindningstid. Avsluta när du vill.</p>
                        
                        <button onClick={onClose} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-colors btn-press">
                            Simulera Köp (Test)
                        </button>
                        <button onClick={onClose} className="mt-3 text-slate-400 hover:text-white text-sm font-medium">
                            Kanske senare
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// NEW: Visual Toast Notification Component
export const ToastMessage: React.FC<{ toast: ToastNotification; onClose: (id: string) => void }> = memo(({ toast, onClose }) => {
    useEffect(() => {
        // Play sound on mount
        playNotification();
        
        const timer = setTimeout(() => {
            onClose(toast.id);
        }, 5000); // Auto dismiss after 5 seconds
        return () => clearTimeout(timer);
    }, [toast.id, onClose]);

    const bgColors = {
        info: 'bg-slate-800 border-slate-600 text-slate-100',
        success: 'bg-green-900/90 border-green-600 text-green-100',
        alert: 'bg-red-900/90 border-red-600 text-red-100',
    };

    return (
        <div className={`flex items-center justify-between p-4 mb-3 rounded-lg shadow-xl border backdrop-blur-md animate-slide-in-right ${bgColors[toast.type]}`}>
            <div className="flex items-center gap-3">
                {toast.type === 'success' && <span className="text-xl">🎉</span>}
                {toast.type === 'alert' && <span className="text-xl">⚠️</span>}
                {toast.type === 'info' && <span className="text-xl">ℹ️</span>}
                <p className="text-sm font-medium">{toast.text}</p>
            </div>
            <button onClick={() => onClose(toast.id)} className="ml-4 text-white/60 hover:text-white">
                &times;
            </button>
        </div>
    );
});

export const ToastContainer: React.FC<{ toasts: ToastNotification[]; removeToast: (id: string) => void }> = memo(({ toasts, removeToast }) => {
    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col w-full max-w-sm pointer-events-none">
            <div className="pointer-events-auto">
                {toasts.map(toast => (
                    <ToastMessage key={toast.id} toast={toast} onClose={removeToast} />
                ))}
            </div>
        </div>
    );
});


export const ProgressCircle: React.FC<{ percentage: number, size?: number, strokeWidth?: number, className?: string }> = memo(({ percentage, size = 80, strokeWidth = 8, className }) => {
    const radius = (size - strokeWidth) / 2;
    const viewBox = `0 0 ${size} ${size}`;
    const dashArray = radius * Math.PI * 2;
    const dashOffset = dashArray - dashArray * (percentage / 100);

    return (
        <svg width={size} height={size} viewBox={viewBox} className={className}>
            <circle
                className="text-slate-200 dark:text-slate-700"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={`${strokeWidth}px`}
                fill="none"
                stroke="currentColor"
            />
            <circle
                className="text-red-500 transition-all duration-1000 ease-out"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={`${strokeWidth}px`}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                fill="none"
                stroke="currentColor"
                style={{
                    strokeDasharray: dashArray,
                    strokeDashoffset: dashOffset,
                    strokeLinecap: 'round',
                }}
            />
        </svg>
    );
});


export const Button: React.FC<{ onClick: () => void, children: React.ReactNode, className?: string, disabled?: boolean }> = memo(({ onClick, children, className, disabled }) => (
    <button
        onClick={(e) => {
            playClick();
            onClick();
        }}
        disabled={disabled}
        className={`bg-white text-black font-bold py-3 px-6 rounded-md hover:bg-slate-300 transition-colors duration-200 disabled:bg-slate-600 btn-press ${className}`}
    >
        {children}
    </button>
));

export const Modal: React.FC<{ title: string; children: React.ReactNode; onClose: () => void }> = memo(({ title, children, onClose }) => {
    useEffect(() => {
        playModalOpen();
    }, []);

    return (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex justify-center items-center z-50 p-4 transition-opacity duration-200" onClick={onClose}>
            <div
                className="bg-white dark:bg-black/80 backdrop-blur-xl p-4 sm:p-6 rounded-lg shadow-2xl w-full max-w-md md:max-w-2xl max-h-[90vh] md:max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
                    <button onClick={onClose} className="text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 text-2xl leading-none transition-colors duration-200">&times;</button>
                </div>
                <div className="overflow-y-auto pr-2 text-slate-700 dark:text-slate-200">
                    {children}
                </div>
            </div>
        </div>
    );
});

export const InfoTooltip: React.FC<{ text: string; align?: 'center' | 'right'; className?: string }> = memo(({ text, align = 'center', className }) => {
  const positionClasses = align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2';
  const arrowPositionClasses = align === 'right' ? 'right-3' : 'left-1/2 -translate-x-1/2';
  
  return (
    <div className={`relative flex items-center group ${className !== undefined ? className : 'ml-3'}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 group-hover:text-red-600 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div className={`absolute top-full ${positionClasses} mt-2 w-72 p-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-white text-xs rounded-md shadow-lg border border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20`}>
        {text}
        {/* Arrow pointing up to the icon */}
        <div className={`absolute w-3 h-3 bg-white dark:bg-slate-800 border-t border-l border-slate-200 dark:border-slate-700 transform rotate-45 -top-1.5 ${arrowPositionClasses}`}></div>
      </div>
    </div>
  );
});

export const FlowRenderer: React.FC<{ flow: CareFlowStep[], onSourceClick?: (title: string) => void }> = memo(({ flow, onSourceClick }) => {
    if (!flow || !Array.isArray(flow) || flow.length === 0) {
        return null;
    }

    return (
        <div className="mt-8 relative pl-4 sm:pl-8 py-4">
            {/* Main connecting line */}
            <div className="absolute left-4 sm:left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 via-purple-500 to-green-500 rounded-full opacity-50"></div>

            {flow.map((item, index) => {
                const isLast = index === flow.length - 1;
                return (
                    <div key={index} className="relative mb-8 last:mb-0 group animate-slide-in-right" style={{ animationDelay: `${index * 150}ms` }}>
                        {/* Node Bubble */}
                        <div className={`absolute -left-[2.2rem] sm:-left-[2.2rem] top-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-lg z-10 transition-transform group-hover:scale-110 ${isLast ? 'bg-green-600 ring-4 ring-green-500/30' : 'bg-indigo-600 ring-4 ring-indigo-500/30'}`}>
                            {isLast ? '✓' : item.step}
                        </div>

                        {/* Card Content */}
                        <div className={`ml-4 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white dark:bg-slate-800 ${isLast ? 'border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-900/20' : 'hover:border-indigo-400'}`}>
                            <h4 className={`text-lg font-bold mb-2 flex items-center gap-2 ${isLast ? 'text-green-800 dark:text-green-200' : 'text-slate-800 dark:text-slate-100'}`}>
                                {item.title}
                            </h4>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
                                {item.description}
                            </p>
                            
                            {item.sourceTitle && onSourceClick && (
                                <button 
                                    onClick={() => onSourceClick(item.sourceTitle!)}
                                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded-full text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.536a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                    Källa: {item.sourceTitle}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
            
            {/* End Point */}
            <div className="absolute -left-[1.3rem] sm:-left-[1.3rem] -bottom-2 w-4 h-4 bg-green-500 rounded-full shadow-lg border-2 border-white dark:border-slate-900 z-10"></div>
        </div>
    );
});

export const RelationGraph: React.FC<{ allDocs: CustomDocument[], currentDocId: string, onNodeClick: (docId: string) => void }> = memo(({ allDocs, currentDocId, onNodeClick }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (containerRef.current) {
            setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
        }
    }, []);

    const center = { x: dimensions.width / 2, y: dimensions.height / 2 };
    const radius = Math.min(dimensions.width, dimensions.height) / 2.5;

    const currentDoc = allDocs.find(d => d.id === currentDocId);
    if (!currentDoc) return null;

    const relatedDocIds = DOCUMENT_RELATIONS[currentDocId] || [];
    const relatedDocs = relatedDocIds.map(id => allDocs.find(d => d.id === id)).filter(Boolean) as CustomDocument[];
    
    if(relatedDocs.length === 0) return null;

    return (
        <div ref={containerRef} className="relation-graph-container">
            {/* Central Node */}
            <div className="relation-node central" style={{ transform: `translate(${center.x - 50}px, ${center.y - 40}px)` }}>
                 <div className="relation-node-button">
                    <div className="relation-node-circle">
                         {React.cloneElement(ICONS.fileManagement, { className: 'w-6 h-6' })}
                    </div>
                    <span className="relation-node-label">{currentDoc.title}</span>
                </div>
            </div>

            {/* Satellite Nodes and Lines */}
            {relatedDocs.map((doc, index) => {
                const angle = (index / relatedDocs.length) * 2 * Math.PI;
                const x = center.x + radius * Math.cos(angle);
                const y = center.y + radius * Math.sin(angle);
                const distance = Math.hypot(x - center.x, y - center.y);
                const rotation = Math.atan2(y - center.y, x - center.x) * (180 / Math.PI);

                return (
                    <div key={doc.id}>
                        <div className="relation-node" style={{ transform: `translate(${x - 50}px, ${y - 40}px)` }}>
                            <button onClick={() => onNodeClick(doc.id)} className="relation-node-button">
                                <div className="relation-node-circle">
                                     {React.cloneElement(ICONS.link, { className: 'w-5 h-5' })}
                                </div>
                                <span className="relation-node-label">{doc.title}</span>
                            </button>
                             <div className="relation-line" style={{ width: `${distance}px`, transform: `rotate(${rotation}deg)` }}></div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
});

export const CareFlowNavigator: React.FC<{ user: User, onSourceClick?: (title: string) => void, onSaveFlow: (query: string, flow: CareFlowStep[]) => void }> = memo(({ user, onSourceClick, onSaveFlow }) => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [flow, setFlow] = useState<CareFlowStep[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!query.trim()) return;
        setIsLoading(true);
        setError(null);
        try {
            const steps = await generateCareFlow(query, user.role, user.workplace);
            if (steps && steps.length > 0) {
                setFlow(steps);
            } else {
                setError("AI:n kunde inte generera några steg. Försök igen med en tydligare beskrivning.");
            }
        } catch (e) {
            console.error(e);
            setError("Ett fel uppstod. Kontrollera din anslutning.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="card-base p-6 mb-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                {ICONS.sbar} Vårdflödes-navigator (AI)
                <InfoTooltip text="Beskriv en uppgift (t.ex. 'Sätta KAD') för att få en steg-för-steg guide genererad av AI." />
            </h2>
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Vad vill du göra? (t.ex. 'Sätta KAD', 'Hantera LPT')"
                    className="flex-1 p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-red-500 focus:outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                />
                <button
                    onClick={handleGenerate}
                    disabled={isLoading || !query.trim()}
                    className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-md hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors btn-press flex items-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                            Genererar...
                        </>
                    ) : 'Skapa Guide'}
                </button>
            </div>
            
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            {flow.length > 0 && (
                <div className="animate-fade-in">
                    <div className="flex justify-between items-center mb-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Steg-för-steg: {query}</h3>
                        <button onClick={() => onSaveFlow(query, flow)} className="text-sm text-green-600 dark:text-green-400 hover:text-green-500 font-semibold transition-colors">
                            + Spara flöde
                        </button>
                    </div>
                    <FlowRenderer flow={flow} onSourceClick={onSourceClick} />
                </div>
            )}
        </div>
    );
});


// --- Layout Components ---

const NavItem: React.FC<{ icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void; }> = memo(({ icon, label, isActive, onClick }) => (
  <button
    onClick={() => {
        playClick();
        onClick();
    }}
    onMouseEnter={() => playHover()}
    className={`w-full flex items-center px-4 py-3 text-left transition-colors duration-200 text-sm font-medium rounded-md btn-press ${
      isActive
        ? 'bg-red-500 text-white font-bold shadow-md'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
    }`}
  >
    <div className={`mr-4 transition-colors duration-200 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>{icon}</div>
    <span>{label}</span>
  </button>
));

const getMenuItems = (role: Role): NavItemType[] => {
    const studentItems: NavItemType[] = [
        { view: 'checklist', icon: ICONS.checklist, label: 'Checklista' },
        { view: 'logbook', icon: ICONS.logbook, label: 'Loggbok' },
        { view: 'goals', icon: ICONS.goals, label: 'Lärandemål' },
        { view: 'knowledge-test', icon: ICONS.knowledgeTest, label: 'Kunskapstest' },
        { view: 'modules', icon: ICONS.modules, label: 'Resurser & Rutiner' },
        { view: 'communication-lab', icon: ICONS.mic, label: 'Kommunikationslabb' },
        { view: 'attendance', icon: ICONS.calendar, label: 'Närvaro' },
        { view: 'community', icon: ICONS.users, label: 'Connect (Nätverk)' }, // Added Community
    ];
    const vikarieItems: NavItemType[] = [
        { view: 'checklist', icon: ICONS.checklist, label: 'Checklista' },
        { view: 'logbook', icon: ICONS.logbook, label: 'Loggbok' },
        { view: 'goals', icon: ICONS.goals, label: 'Lärandemål' },
        { view: 'knowledge-test', icon: ICONS.knowledgeTest, label: 'Kunskapstest' },
        { view: 'modules', icon: ICONS.modules, label: 'Resurser & Rutiner' },
        { view: 'communication-lab', icon: ICONS.mic, label: 'Kommunikationslabb' },
        { view: 'attendance', icon: ICONS.calendar, label: 'Närvaro' },
        { view: 'community', icon: ICONS.users, label: 'Connect (Nätverk)' }, // Added Community
    ];
    const supervisorItems: NavItemType[] = [
        { view: 'progress', icon: ICONS.supervisor, label: 'Elev-översikt' },
        { view: 'community', icon: ICONS.users, label: 'Connect (Nätverk)' }, // Added Community
        { view: 'resources', icon: ICONS.resources, label: 'Pedagogiska Resurser' }
    ];
     const adminItems: NavItemType[] = [
        { view: 'admin-dashboard', icon: ICONS.supervisor, label: 'Användarhantering' },
        { view: 'community', icon: ICONS.users, label: 'Connect (Nätverk)' }, // Added Community
        { view: 'analytics', icon: ICONS.chartPie, label: 'Dataanalys' },
        { view: 'department-settings', icon: ICONS.admin, label: 'Avdelningsinställningar' },
        { view: 'feedback-viewer', icon: ICONS.feedbackViewer, label: 'Granska App-Feedback' },
        { view: 'ai-feedback-viewer', icon: ICONS.feedback, label: 'Granska AI-Feedback' },
        { view: 'flagged-content', icon: ICONS.flaggedContentViewer, label: 'Flaggat Innehåll' },
        { view: 'file-management', icon: ICONS.fileManagement, label: 'Hantera Kunskapsbank' },
    ];
    const developerItems: NavItemType[] = [
        { view: 'developer-dashboard', icon: ICONS.developer, label: 'Developer Console' },
        { view: 'analytics', icon: ICONS.chartPie, label: 'Systemanalys' },
        { view: 'department-settings', icon: ICONS.admin, label: 'Debug Inställningar' },
        { view: 'community', icon: ICONS.users, label: 'Connect (Test)' }, // Added Community
    ];

    if (role === 'developer') {
        return developerItems;
    }
    if (role === 'admin') {
        return adminItems;
    }
    if (role.startsWith('handledare') || role.startsWith('larare') || role === 'overlakare') {
        return supervisorItems;
    }
    if (role.startsWith('usk-elev') || role.startsWith('ssk-student')) {
        return studentItems;
    }
    if (role.startsWith('vikarie-')) {
        return vikarieItems;
    }
    return [];
}

const getRoleIcon = (role: Role): React.ReactNode => {
    if (role === 'developer') return ICONS.developer;
    if (role.startsWith('usk-elev') || role.startsWith('ssk-student')) return ICONS.student;
    if (role.startsWith('vikarie-')) return ICONS.userCircle;
    if (role.startsWith('handledare') || role === 'overlakare') return ICONS.supervisor;
    if (role.startsWith('larare')) return ICONS.teacher;
    if (role === 'admin') return ICONS.admin;
    return ICONS.student; // Default
};


export const Sidebar: React.FC<{ 
    user: User; 
    currentView: View; 
    setView: (view: View) => void; 
    onLogout: () => void; 
    notifications: Notification[]; 
    onMarkAsRead: () => void; 
    appName: string; 
}> = memo(({ user, currentView, setView, onLogout, notifications, onMarkAsRead, appName }) => {
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);
    const hasUnread = notifications.some(n => !n.read);
    
    const sortedNotifications = [...notifications].sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1;
        return b.timestamp.getTime() - a.timestamp.getTime();
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [notificationRef]);

    const handleBellClick = () => {
        playClick();
        const isOpening = !showNotifications;
        setShowNotifications(isOpening);
        if (isOpening && hasUnread) {
            setTimeout(() => onMarkAsRead(), 500);
        }
    };

    const mainMenuItems = getMenuItems(user.role);
    
    const allBottomMenuItems: NavItemType[] = [
        { view: 'presentation', icon: ICONS.tour, label: 'Guidad Tur' },
        { view: 'qa', icon: ICONS.qa, label: 'Frågor & Svar' },
        { view: 'about', icon: ICONS.about, label: 'Om Appen' },
        { view: 'about-creator', icon: ICONS.userCircle, label: 'Om Mig' },
        { view: 'feedback', icon: ICONS.feedback, label: 'Lämna Feedback' }
    ];

    const bottomMenuItems = user.role === 'admin'
        ? allBottomMenuItems.filter(item => item.view === 'qa' || item.view === 'presentation')
        : allBottomMenuItems;

  return (
    <div className="relative z-20 bg-white/90 dark:bg-black/30 backdrop-blur-xl border-r border-slate-200 dark:border-slate-700/50 w-64 flex-shrink-0 flex flex-col shadow-2xl no-print">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center h-[65px]">
        <svg className="h-8 text-slate-800 dark:text-slate-100">
          <use href="#carelearn-logo-full"></use>
        </svg>
        <div className="relative" ref={notificationRef}>
            <button 
                onClick={handleBellClick}
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors"
                aria-label="Visa notiser"
            >
                <div className="text-slate-600 dark:text-slate-300">
                    {ICONS.bell}
                </div>
                {hasUnread && (
                    <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-800 animate-pulse"></span>
                )}
            </button>
            {showNotifications && (
                <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-800/90 backdrop-blur-md rounded-lg shadow-xl z-50 border border-slate-200 dark:border-slate-700/50 animate-fade-in-down">
                    <div className="p-3 font-bold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700/50">Notiser</div>
                    <ul className="py-2 max-h-80 overflow-y-auto">
                        {sortedNotifications.length > 0 ? (
                            sortedNotifications.map((notif) => (
                                <li key={notif.id} className={`border-l-4 ${!notif.read ? 'border-red-500 bg-slate-50 dark:bg-slate-700/30' : 'border-transparent'}`}>
                                    <a
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (notif.link) {
                                                playToggle();
                                                setView(notif.link);
                                            }
                                            setShowNotifications(false);
                                        }}
                                        className={`block px-4 py-2 text-sm transition-colors ${notif.link ? 'hover:bg-slate-100 dark:hover:bg-slate-700' : ''} ${!notif.read ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}
                                    >
                                        {notif.text}
                                        <span className="block text-xs text-slate-400 mt-1">{notif.timestamp.toLocaleDateString('sv-SE')}</span>
                                    </a>
                                </li>
                            ))
                        ) : (
                             <li className="px-4 py-3 text-sm text-center text-slate-500 dark:text-slate-400">Inga notiser.</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
      </div>
      <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center bg-slate-50 dark:bg-black/30">
        <div className="text-slate-600 dark:text-slate-200">{getRoleIcon(user.role)}</div>
        <div className="ml-3">
            <p className="font-bold text-slate-800 dark:text-slate-100">{user.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{getRoleDisplayName(user.role)}</p>
            {/* Konto-actions: flyttade hit för mobilåtkomst */}
            <div className="mt-2 flex items-center gap-2">
                <button
                    onClick={() => setView('settings')}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border btn-press ${
                        currentView === 'settings'
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-white/60 dark:bg-slate-900/30 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                    aria-label="Öppna inställningar"
                >
                    <span className="w-4 h-4">{ICONS.settings}</span>
                    Inställningar
                </button>
                <button
                    onClick={onLogout}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 btn-press"
                    aria-label="Logga ut"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 l3-3m0 0-3-3m3 3H9" /></svg>
                    Logga ut
                </button>
            </div>
        </div>
      </div>
      
      {/* SECURITY BADGE */}
      <SecurityIndicator />

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
         <NavItem icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>} label="Översikt" isActive={currentView === 'dashboard'} onClick={() => setView('dashboard')} />
        {mainMenuItems.map(item => (
          <NavItem
            key={item.view}
            icon={item.icon}
            label={item.label}
            isActive={currentView === item.view}
            onClick={() => setView(item.view)}
          />
        ))}
      </nav>
      <div className="p-2 border-t border-slate-200 dark:border-slate-700/50">
         {bottomMenuItems.map(item => (
          <NavItem
            key={item.view}
            icon={item.icon}
            label={item.label}
            isActive={currentView === item.view}
            onClick={() => setView(item.view)}
          />
        ))}
      </div>
      <style>{`
        @keyframes fade-in-down {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .animate-fade-in-down {
            animation: fade-in-down 0.2s ease-out;
        }
        @keyframes slide-in-right {
            from {
                opacity: 0;
                transform: translateX(100%);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        .animate-slide-in-right {
            animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
});
