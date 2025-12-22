
import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { User, UserData, View, Role, KnowledgeTestAttempt, KnowledgeTestInProgress, LogbookEntry, Notification, VIEW_CONFIGS, ChatMessage, KnowledgeTestTier, DailyScenarioUsage, MonthlyUsage, SavedCareFlow, CareFlowStep, DepartmentSettings, ScheduleEntry, ToastNotification, GoalsProgress } from '../types';
import * as storage from '../services/localStorageService';
import { Sidebar, toYYYYMMDD, Modal, FlowRenderer, ToastContainer } from './UI';
import { Modules } from './Modules';
import ProfileSelection from './ProfileSelection';
import Dashboard from './Dashboard';
import Checklist from './Checklist';
import Logbook from './Logbook';
import Goals from './Goals';
import { KnowledgeTest } from './Quiz';
import Chatbot from './Chatbot';
import About from './About';
import Feedback from './Feedback';
import StudentProgress from './StudentProgress';
import { StudentDetail } from './StudentDetail';
import SupervisorChatbot from './SupervisorChatbot';
import PedagogicalResources from './PedagogicalResources';
import AdminDashboard from './AdminDashboard';
import FeedbackViewer from './FeedbackViewer';
import AIFeedbackViewer from './AIFeedbackViewer';
import FlaggedContentViewer from './FlaggedContentViewer';
import FileManagement from './FileManagement';
import Attendance from './Attendance';
import { AILicense } from './AILicense';
import Presentation from './Presentation';
import QA from './QA';
import AboutCreator from './AboutCreator';
import ExampleReport from './ExampleReport';
import DepartmentSettingsComponent from './DepartmentSettings';
import { APP_DATA, ACHIEVEMENTS, ICONS } from '../constants';
import CommunicationLab from './CommunicationLab';
import Analytics from './Analytics';
import Onboarding from './Onboarding';
import MobileHeader from './MobileHeader';
import { playLogout, playDelete, playLevelUp, playSuccess } from '../services/soundService';
import { generateAppStructure } from '../services/geminiService';
import ContextualOnboarding from './ContextualOnboarding';
import ErrorBoundary from './ErrorBoundary';
import DeveloperDashboard from './DeveloperDashboard';
import Community from './Community';
import Settings from './Settings';
import InstallPWA from './InstallPWA';

// Declare firebase globals from index.html scripts
declare const firebase: any;

const isStaffRole = (role: Role) => {
    return role.startsWith('handledare') || role.startsWith('larare') || role === 'admin' || role === 'overlakare' || role === 'huvudhandledare';
}

// Offline Indicator Component
const OfflineIndicator: React.FC = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-xs font-bold text-center py-1 z-[100] animate-pulse">
            Du är offline. Vissa AI-funktioner är inte tillgängliga.
        </div>
    );
};

// Fun Loader Component
const FunLoader: React.FC = memo(() => {
    const [progress, setProgress] = useState(0);
    const [messageIndex, setMessageIndex] = useState(0);
    
    const messages = [
        "Initierar AI-forskare...",
        "Läser igenom Vårdhandboken (snabbspolning)...",
        "Analyserar verksamhetens rutiner...",
        "Brygger digitalt kaffe till handledaren...",
        "Kalibrerar empati-modulen...",
        "Optimerar checklistor för maximal effektivitet...",
        "Nästan klar, städar upp i kodbasen..."
    ];

    useEffect(() => {
        // Progress bar simulation (2 minutes roughly)
        const totalDuration = 90000; // 90 seconds target
        const intervalTime = 100;
        const steps = totalDuration / intervalTime;
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            // Ease out curve for realistic feel
            const p = Math.min(100, Math.round(100 * (1 - Math.pow(1 - currentStep / steps, 3))));
            setProgress(p);
            
            // Cycle messages every 4 seconds
            if (currentStep % 40 === 0) { // 40 * 100ms = 4000ms
                setMessageIndex(prev => (prev + 1) % messages.length);
            }

            if (p >= 100) clearInterval(timer);
        }, intervalTime);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="min-h-screen profile-selection-bg flex flex-col justify-center items-center p-4">
            <div className="grid-overlay"></div>
            <div className="grain-overlay"></div>
            <div className="relative z-10 text-center max-w-md w-full bg-black/60 backdrop-blur-xl p-8 rounded-2xl border border-white/10 shadow-2xl">
                <div className="mb-8 relative">
                    <div className="w-20 h-20 mx-auto border-4 border-slate-700 border-t-red-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-mono text-red-400 font-bold">{progress}%</span>
                    </div>
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-2 animate-pulse">
                    Konfigurerar arbetsplats...
                </h2>
                
                <div className="h-16 flex items-center justify-center">
                    <p className="text-slate-300 text-lg font-medium transition-all duration-500 transform">
                        {messages[messageIndex]}
                    </p>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-2 mb-4 overflow-hidden border border-slate-700">
                    <div 
                        className="bg-gradient-to-r from-red-600 to-orange-500 h-2 rounded-full transition-all duration-200" 
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                
                <p className="text-sm text-slate-500 font-mono mt-4">
                    Detta kan ta 1-2 minuter. <br/> Stäng inte fönstret.
                </p>
            </div>
        </div>
    );
});

interface FloatingChatProps {
    user: User;
    userData: UserData;
    allStudentData: { user: User; data: UserData }[];
    onUpdateUserData: (data: Partial<UserData>) => void;
    onAccountDeletion: () => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    initialMessage: string;
    clearInitialMessage: () => void;
    currentView: View;
    setView: (view: View) => void;
    setViewAfterLicense: (view: View) => void;
}


const FloatingChat: React.FC<FloatingChatProps> = memo(({ user, userData, allStudentData, onUpdateUserData, onAccountDeletion, isOpen, setIsOpen, initialMessage, clearInitialMessage, currentView, setView, setViewAfterLicense }) => {
    const [bubblePosition, setBubblePosition] = useState({ bottom: 24, left: 24 });
    const bubbleDragRef = useRef<HTMLButtonElement>(null);
    const bubbleOffsetRef = useRef({ x: 0, y: 0 });
    const isBubbleDraggingRef = useRef(false);
    const hasBubbleDraggedRef = useRef(false);
    
    const [windowPosition, setWindowPosition] = useState({ top: 50, left: 50 });
    const windowDragRef = useRef<HTMLDivElement>(null);
    const windowOffsetRef = useRef({ x: 0, y: 0 });
    const isWindowDraggingRef = useRef(false);
    
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

    const isStudent = !isStaffRole(user.role) && user.role !== 'developer';
    const isAdmin = user.role === 'admin';

    const contextualPrompts: Partial<Record<View, { icon: React.ReactElement<{ className?: string }>; text: string }>> = {
      'logbook': { icon: ICONS.logbook, text: "Behöver du reflektionshjälp?" },
      'goals': { icon: ICONS.goals, text: "Hjälp att sätta ett delmål?" },
      'knowledge-test': { icon: ICONS.knowledgeTest, text: "Förklara ett quiz-svar?" },
      'communication-lab': { icon: ICONS.mic, text: "Behöver du samtalstips?"},
    };
    const prompt = isStudent ? contextualPrompts[currentView] : undefined;


    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (initialMessage) {
            setIsOpen(true);
        }
    }, [initialMessage, setIsOpen]);

    const handleBubbleDragStart = useCallback((clientX: number, clientY: number) => {
        if (!bubbleDragRef.current) return;
        hasBubbleDraggedRef.current = false;
        isBubbleDraggingRef.current = true;
        const rect = bubbleDragRef.current.getBoundingClientRect();
        bubbleOffsetRef.current = {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    }, []);

    const handleBubbleMouseDown = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        handleBubbleDragStart(e.clientX, e.clientY);
        e.preventDefault();
    }, [handleBubbleDragStart]);

    const handleBubbleTouchStart = useCallback((e: React.TouchEvent<HTMLButtonElement>) => {
        if (e.touches.length === 1) {
            handleBubbleDragStart(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, [handleBubbleDragStart]);
    
    const handleBubbleClick = useCallback(() => {
        if (hasBubbleDraggedRef.current) return;

        if (isStudent && !userData.hasCompletedAILicense) {
            setViewAfterLicense(currentView);
            setView('ai-license');
            return;
        }
        if (isAdmin && !userData.hasCompletedAdminAILicense) {
            setViewAfterLicense(currentView);
            setView('ai-license');
            return;
        }
        if (!isStudent && !isAdmin && !userData.hasCompletedStaffAILicense) {
            setViewAfterLicense(currentView);
            setView('ai-license');
            return;
        }
        
        if (bubbleDragRef.current && isDesktop) {
            const rect = bubbleDragRef.current.getBoundingClientRect();
            const windowWidth = 448;
            const windowHeight = Math.min(600, window.innerHeight * 0.75);
            
            let top = rect.top + rect.height - windowHeight;
            let left = rect.left;

            top = Math.max(16, Math.min(top, window.innerHeight - windowHeight - 16));
            left = Math.max(16, Math.min(left, window.innerWidth - windowWidth - 16));
            
            setWindowPosition({ top, left });
        }
        setIsOpen(true);
    }, [isStudent, isAdmin, userData, currentView, isDesktop, setView, setIsOpen, setViewAfterLicense, user.role]);

     const handleWindowDragStart = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if (windowDragRef.current) {
            isWindowDraggingRef.current = true;
            const rect = windowDragRef.current.getBoundingClientRect();
            windowOffsetRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
            e.preventDefault();
        }
    }, []);

    useEffect(() => {
        const handleDragMove = (clientX: number, clientY: number) => {
            if (isBubbleDraggingRef.current && bubbleDragRef.current) {
                hasBubbleDraggedRef.current = true;
                const newLeft = clientX - bubbleOffsetRef.current.x;
                const newBottom = window.innerHeight - (clientY - bubbleOffsetRef.current.y) - bubbleDragRef.current.offsetHeight;
                setBubblePosition({
                    left: Math.max(8, Math.min(newLeft, window.innerWidth - bubbleDragRef.current.offsetWidth - 8)),
                    bottom: Math.max(8, Math.min(newBottom, window.innerHeight - bubbleDragRef.current.offsetHeight - 8)),
                });
            } else if (isWindowDraggingRef.current && windowDragRef.current && isDesktop) {
                let top = clientY - windowOffsetRef.current.y;
                let left = clientX - windowOffsetRef.current.x;

                top = Math.max(8, Math.min(top, window.innerHeight - windowDragRef.current.offsetHeight - 8));
                left = Math.max(8, Math.min(left, window.innerWidth - windowDragRef.current.offsetWidth - 8));
                setWindowPosition({ top, left });
            }
        };
        
        const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 1) handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
        };

        const handleDragEnd = () => {
            isBubbleDraggingRef.current = false;
            isWindowDraggingRef.current = false;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('mouseup', handleDragEnd);
        window.addEventListener('touchend', handleDragEnd);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [isDesktop]);
    
    if (isOpen) {
        return (
            <div
                ref={windowDragRef}
                className={`fixed bg-white/95 dark:bg-black/5 backdrop-blur-xl flex flex-col animate-fade-in-up no-print z-40 border border-slate-200 dark:border-white/10 ${
                    isDesktop
                    ? 'rounded-lg shadow-2xl w-full max-w-md h-[75vh] max-h-[700px]'
                    : 'inset-0'
                }`}
                style={isDesktop ? { top: `${windowPosition.top}px`, left: `${windowPosition.left}px` } : {}}
            >
                <header 
                    onMouseDown={isDesktop ? handleWindowDragStart : undefined}
                    className={`p-4 border-b border-slate-200 dark:border-white/10 flex justify-between items-center flex-shrink-0 ${isDesktop ? 'cursor-move' : ''}`}
                >
                     <div className="flex items-center">
                        <div className="text-red-500 dark:text-red-400">{ICONS.ai}</div>
                        <div className="ml-3">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">AI-Handledaren</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{isStudent ? 'Din personliga assistent' : 'Ställ frågor om studenter'}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 font-bold text-2xl leading-none" aria-label="Minimera chatt">
                       —
                    </button>
                </header>
                <div className="flex-1 min-h-0">
                     {isStudent ? (
                        <Chatbot 
                            user={user} 
                            userData={userData} 
                            onUpdateUserData={onUpdateUserData} 
                            onAccountDeletion={onAccountDeletion} 
                            initialMessage={initialMessage} 
                            onClearInitialMessage={clearInitialMessage}
                            setView={setView}
                            setIsOpen={setIsOpen}
                         />
                    ) : (
                        <SupervisorChatbot 
                            user={user} 
                            userData={userData} 
                            onUpdateUserData={onUpdateUserData} 
                            studentData={allStudentData} 
                            onAccountDeletion={onAccountDeletion}
                            setView={setView}
                            setIsOpen={setIsOpen}
                        />
                    )}
                </div>
                 <style>{`
                    @keyframes fade-in-up {
                        from { opacity: 0; transform: translateY(30px) scale(0.95); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
                `}</style>
            </div>
        );
    }

    return (
        <div
            style={{
                bottom: `${bubblePosition.bottom}px`,
                left: `${bubblePosition.left}px`,
                touchAction: 'none'
            }}
            className="fixed z-30 flex items-end no-print"
        >
            {prompt && (
                <div className="bg-white/90 dark:bg-slate-700/80 backdrop-blur-md p-3 rounded-xl shadow-lg mr-3 mb-2 animate-context-prompt-in border border-slate-200 dark:border-slate-600">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{prompt.text}</p>
                </div>
            )}
            <button
                ref={bubbleDragRef}
                onMouseDown={handleBubbleMouseDown}
                onTouchStart={handleBubbleTouchStart}
                onClick={handleBubbleClick}
                 style={{ cursor: isBubbleDraggingRef.current ? 'grabbing' : 'pointer' }}
                className="bg-red-500 hover:bg-red-600 text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 animate-fade-in-up btn-press"
                aria-label="Öppna AI-Handledaren"
            >
                {prompt ? React.cloneElement(prompt.icon, { className: "w-8 h-8" }) : React.cloneElement(ICONS.ai, { className: "w-8 h-8" })}
            </button>
        </div>
    );
});

const GlobalPodcastPlayer: React.FC<{ src: string; isVisible: boolean; onClose: () => void; }> = memo(({ src, isVisible, onClose }) => {
     const [isMinimized, setIsMinimized] = useState(false);
    const [position, setPosition] = useState({ bottom: 96, right: 24 });
    const dragRef = useRef<HTMLButtonElement>(null);
    const offsetRef = useRef({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const hasDraggedRef = useRef(false);

    const handleDragStart = useCallback((clientX: number, clientY: number) => { if (!dragRef.current) return; hasDraggedRef.current = false; isDraggingRef.current = true; const rect = dragRef.current.getBoundingClientRect(); offsetRef.current = { x: clientX - rect.left, y: clientY - rect.top }; }, []);
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLButtonElement>) => { handleDragStart(e.clientX, e.clientY); e.preventDefault(); }, [handleDragStart]);
    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLButtonElement>) => { if (e.touches.length === 1) { handleDragStart(e.touches[0].clientX, e.touches[0].clientY); } }, [handleDragStart]);
    const handlePlayerBubbleClick = useCallback(() => { if (!hasDraggedRef.current) { setIsMinimized(false); } }, []);

    useEffect(() => {
        const handleDragMove = (clientX: number, clientY: number) => {
            if (!isDraggingRef.current || !dragRef.current) return;
            hasDraggedRef.current = true;
            const newX = window.innerWidth - (clientX - offsetRef.current.x) - dragRef.current.offsetWidth;
            const newY = window.innerHeight - (clientY - offsetRef.current.y) - dragRef.current.offsetHeight;
            setPosition({ right: Math.max(8, Math.min(newX, window.innerWidth - dragRef.current.offsetWidth - 8)), bottom: Math.max(8, Math.min(newY, window.innerHeight - dragRef.current.offsetHeight - 8)) });
        };
        const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
        const handleTouchMove = (e: TouchEvent) => { if (e.touches.length === 1) handleDragMove(e.touches[0].clientX, e.touches[0].clientY); };
        const handleDragEnd = () => { isDraggingRef.current = false; };
        window.addEventListener('mousemove', handleMouseMove); window.addEventListener('touchmove', handleTouchMove); window.addEventListener('mouseup', handleDragEnd); window.addEventListener('touchend', handleDragEnd);
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('touchmove', handleTouchMove); window.removeEventListener('mouseup', handleDragEnd); window.removeEventListener('touchend', handleDragEnd); };
    }, []);

    if (!isVisible) return null;
    return (
        <>
            <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out no-print ${isMinimized ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0 animate-fade-in-up'}`}>
                <div className="bg-white dark:bg-slate-800/80 backdrop-blur-xl shadow-2xl rounded-md w-full max-w-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center p-3 border-b border-slate-200 dark:border-slate-700/50"><h3 className="font-bold text-slate-800 dark:text-slate-100">Ljuduppspelare</h3><div className="flex items-center gap-2"><button onClick={() => setIsMinimized(true)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 font-bold text-2xl leading-none">—</button><button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 font-bold text-2xl leading-none">&times;</button></div></div>
                    <div className="p-2"><iframe src={src} width="100%" height="100" allow="autoplay" frameBorder="0" title="Podcast Player" className="rounded-sm"></iframe></div>
                </div>
            </div>
            {isMinimized && (
                <button ref={dragRef} onMouseDown={handleMouseDown} onTouchStart={handleTouchStart} onClick={handlePlayerBubbleClick} style={{ bottom: `${position.bottom}px`, right: `${position.right}px`, cursor: isDraggingRef.current ? 'grabbing' : 'pointer', touchAction: 'none' }} className="fixed z-50 bg-red-500 text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 no-print animate-fade-in-up">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                </button>
            )}
        </>
    );
});

const LockoutScreen: React.FC<{ reason: 'dailyTime' | 'monthlyDays'; onLogout: () => void; }> = memo(({ reason, onLogout }) => {
    const messages = { dailyTime: { title: "Fokustiden är slut för idag", message: "Din dagliga tid i appen har förbrukats." }, monthlyDays: { title: "Månadsgränsen nådd", message: "Du har nått din gräns på 20 aktiva dagar i appen den här månaden." } };
    const { title, message } = messages[reason];
    return (
        <div className="profile-selection-bg min-h-screen flex flex-col justify-center items-center p-4 text-center">
          <div className="grid-overlay"></div> <div className="grain-overlay"></div>
          <div className="relative z-10 max-w-lg w-full bg-white/80 dark:bg-black/60 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10">
            <div className="text-primary-color w-20 h-20 mx-auto mb-6"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg></div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-4">{title}</h1>
            <p className="text-slate-600 dark:text-slate-300 mb-8">{message}</p>
            <button onClick={onLogout} className="w-full bg-red-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-red-600 transition-colors btn-press">Logga ut</button>
          </div>
        </div>
    );
});

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserData, setCurrentUserData] = useState<UserData | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [allStudentData, setAllStudentData] = useState<{ user: User, data: UserData }[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [viewAfterLicense, setViewAfterLicense] = useState<View>('dashboard');
  const [podcastConfig, setPodcastConfig] = useState({ src: '', isVisible: false });
  const [departmentSettings, setDepartmentSettings] = useState<DepartmentSettings | null>(null);
  const [appName, setAppName] = useState('CareLearn');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatbotInitialMessage, setChatbotInitialMessage] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(1800 * 1000); 
  const [isIntroActive, setIsIntroActive] = useState(false);
  const [lockoutReason, setLockoutReason] = useState<'dailyTime' | 'monthlyDays' | null>(null);
  const [selectedCareFlow, setSelectedCareFlow] = useState<SavedCareFlow | null>(null);
  const [careFlowToDelete, setCareFlowToDelete] = useState<SavedCareFlow | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [onboardingSettings, setOnboardingSettings] = useState<DepartmentSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- INITIALIZATION VIA AUTH OBSERVER ---
  useEffect(() => {
      // Apply theme preference early
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme !== 'light') {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }

      // Initialize Firebase Auth listener
      if (typeof firebase !== 'undefined') {
          const unsubscribe = firebase.auth().onAuthStateChanged(async (firebaseUser: any) => {
              if (firebaseUser) {
                  // User is signed in. Fetch extended profile from Firestore.
                  try {
                      const appUser = await storage.getUser(firebaseUser.uid);
                      if (appUser) {
                          const data = await storage.loadUserData(appUser.id);
                          const settings = await storage.loadDepartmentSettings() || storage.applyCustomAppSettings();
                          
                          setCurrentUser(appUser);
                          if (data) {
                              setCurrentUserData(data);
                              // FORCE INTRO ON FIRST LOGIN
                              if (data.isFirstLogin) {
                                  setIsIntroActive(true);
                                  setOnboardingSettings(settings);
                              }
                          } else {
                              setCurrentUserData(storage.getDefaultUserData(appUser.role));
                          }

                          setDepartmentSettings(settings);
                          setAppName(settings.appName);
                          
                          // Load lists for staff - UPDATED to pass workplace context
                          if (isStaffRole(appUser.role)) {
                              const students = await storage.getAllStudentData(appUser.role, appUser.workplace);
                              setAllStudentData(students);
                              const allUsersList = await storage.loadUsers();
                              setUsers(allUsersList);
                          }
                      } else {
                          // Auth exists but Firestore profile missing (rare edge case, maybe deleted)
                          setCurrentUser(null);
                      }
                  } catch (e) {
                      console.error("Failed to load user profile:", e);
                      setCurrentUser(null);
                  }
              } else {
                  // No user is signed in.
                  setCurrentUser(null);
                  setCurrentUserData(null);
              }
              setIsLoading(false);
          });
          
          return () => unsubscribe();
      } else {
          console.error("Firebase not loaded");
          setIsLoading(false);
      }
  }, []);

  const updateUserData = useCallback((dataOrFn: Partial<UserData> | ((prev: UserData) => Partial<UserData>)) => {
    if (currentUser) {
      setCurrentUserData(prevUserData => {
        if (!prevUserData) return null;
        const data = typeof dataOrFn === 'function' ? dataOrFn(prevUserData) : dataOrFn;
        // Merge with existing data to ensure full UserData object
        const updatedData: UserData = { ...prevUserData, ...data };
        storage.saveUserData(currentUser.id, updatedData);
        return updatedData;
      });
    }
  }, [currentUser]);

  // Award XP and show visual feedback
  const awardXP = useCallback((amount: number, reason: string) => {
      if (!currentUserData) return;
      playLevelUp();
      const currentXP = currentUserData.xp || 0;
      const newXP = currentXP + amount;
      
      updateUserData({ xp: newXP });
      
      const newNotification: Notification = {
          id: `xp-${Date.now()}`,
          text: `+${amount} XP: ${reason}`,
          timestamp: new Date(),
          read: false,
          type: 'success'
      };
      
      // Dispatch immediately for toast
      const event = new CustomEvent('piva-notification', { detail: { userId: currentUser?.id, notification: newNotification } });
      window.dispatchEvent(event);

  }, [currentUserData, currentUser, updateUserData]);
  
  const handleUpdateTheme = useCallback((isDark: boolean) => {
      const html = document.documentElement;
      if (isDark) {
          html.classList.add('dark');
      } else {
          html.classList.remove('dark');
      }
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    const handleCustomNotification = (event: CustomEvent) => {
        const { userId, notification } = event.detail;
        if (currentUser && userId === currentUser.id) {
            const newToast: ToastNotification = { id: notification.id, text: notification.text, type: notification.type || 'info' };
            setToasts(prev => [...prev, newToast]);
        }
    };
    window.addEventListener('piva-notification', handleCustomNotification as EventListener);
    return () => { window.removeEventListener('piva-notification', handleCustomNotification as EventListener); };
  }, [currentUser]);

  const removeToast = useCallback((id: string) => { setToasts(prev => prev.filter(t => t.id !== id)); }, []);

  const handleUpdateDepartmentSettings = useCallback((newSettings: DepartmentSettings) => {
      storage.saveDepartmentSettings(newSettings);
      setDepartmentSettings(newSettings);
      setAppName(newSettings.appName);
      document.title = newSettings.appName;
      storage.applyCustomAppSettings();
  }, []);

  const refreshUsers = useCallback(async () => { const loadedUsers = await storage.loadUsers(); setUsers(loadedUsers); }, []);
  
  useEffect(() => { if (isMobileSidebarOpen) { document.body.style.overflow = 'hidden'; } else { document.body.style.overflow = ''; } return () => { document.body.style.overflow = ''; }; }, [isMobileSidebarOpen]);
  useEffect(() => { storage.seedDemoStudentData(); refreshUsers(); }, [refreshUsers]);

  // Legacy refresh logic if currentUser changes outside of AuthState (e.g. forced refresh)
  useEffect(() => { 
      const loadUser = async () => {
          if (currentUser && !currentUserData) { 
              const data = await storage.loadUserData(currentUser.id); 
              setCurrentUserData(data); 
              if (isStaffRole(currentUser.role)) { 
                  // Pass workplace here too
                  setAllStudentData(await storage.getAllStudentData(currentUser.role, currentUser.workplace)); 
              } 
          }
      };
      loadUser();
  }, [currentUser, currentUserData, refreshUsers]);

  const handleSelectProfile = useCallback((user: User, isLogin: boolean = false) => {
    // This is now mainly used for the initial login/register success feedback from ProfileSelection component
    // Actual state setting happens via onAuthStateChanged
    // Just ensure loader shows until auth state resolves
    if (isLogin) setIsLoading(true);
  }, []);

  const handleCreateProfile = useCallback(async (name: string, role: Role, workplace: string, workplaceId: string, pin: string, aplWeeks?: number, email?: string, password?: string) => {
      // NOTE: This function is passed to ProfileSelection. 
      // It handles the business logic of creating a profile structure/settings before calling register.
      
      setIsConfiguring(true);
      
      try {
          let structure = { specialty: 'annat', checklist: [], goals: [], workplaceDescription: '', resources: [] };
          
          try {
              // @ts-ignore
              structure = await generateAppStructure(workplace, role);
          } catch (err) {
              console.error("Structure failed, using defaults", err);
              structure.specialty = 'annat';
              structure.checklist = APP_DATA.checklist;
              structure.goals = APP_DATA.knowledgeRequirements.map(k => k.text);
              structure.workplaceDescription = `Välkommen till din introduktion på ${workplace}.`;
          }

          const currentSettings = await storage.loadDepartmentSettings() || storage.applyCustomAppSettings();
          
          const newSettings: DepartmentSettings = {
              ...currentSettings,
              workplaceName: workplace,
              // @ts-ignore
              specialty: structure.specialty,
              checklist: (structure.checklist || []).join('\n'),
              knowledgeRequirements: (structure.goals || []).join('\n'),
              knowledgeTestQuestionsUsk: role.includes('usk') ? "" : currentSettings.knowledgeTestQuestionsUsk, 
              knowledgeTestQuestionsSsk: role.includes('ssk') ? "" : currentSettings.knowledgeTestQuestionsSsk,
              workplaceDescription: structure.workplaceDescription || ''
          };
          
          storage.saveDepartmentSettings(newSettings);
          setDepartmentSettings(newSettings);
          setOnboardingSettings(newSettings); 
          
          if (structure.resources && structure.resources.length > 0) {
              structure.resources.forEach((res: any) => {
                  storage.addCustomDocument({
                      title: res.title,
                      content: res.content,
                      metadata: { type: res.type, responsibleUnit: 'AI Research', sourceUrl: 'Webben' },
                      workplace: workplace
                  });
              });
          }

          let newUser: User;

          // Use secure registration. onAuthStateChanged will pick up the new user automatically.
          if (email && password) {
             newUser = await storage.registerUser(name, email, password, role, workplace, undefined, aplWeeks, workplaceId);
          } else {
             // Fallback for dev mode without password
             newUser = await storage.createUser(name, role, workplace, pin, aplWeeks);
          }
          
          // CRITICAL: Manually set state immediately to prevent redirect to login
          // This bypasses the slight delay of the Auth Listener
          if (newUser) {
              const defaultData = storage.getDefaultUserData(role, aplWeeks);
              defaultData.isFirstLogin = true; // Ensure onboarding triggers
              
              setCurrentUser(newUser);
              setCurrentUserData(defaultData);
              setIsIntroActive(true); // Triggers the visual intro
          }
          
          playSuccess();

      } catch (error: any) {
          console.error("Critical Setup Error", error);
          // Re-throw so ProfileSelection knows it failed
          throw error;
      } finally {
          setIsConfiguring(false);
      }
  }, [refreshUsers]);

  const handleCreateUser = useCallback(async (name: string, role: Role, aplWeeks?: number): Promise<User> => { 
      const newUser = await storage.createUser(name, role, "Okänd arbetsplats", "1234", aplWeeks); 
      
      // Auto-assign supervisor if created by one
      if (currentUser && (currentUser.role.startsWith('handledare') || currentUser.role === 'huvudhandledare' || currentUser.role === 'overlakare')) {
          storage.assignSupervisorToStudent(newUser.id, currentUser.id);
      }
      
      refreshUsers(); 
      if (currentUser && isStaffRole(currentUser.role)) { 
          // Pass workplace
          setAllStudentData(await storage.getAllStudentData(currentUser.role, currentUser.workplace)); 
      } 
      return newUser; 
  }, [refreshUsers, currentUser]);

  const handleUpdateUserPin = useCallback((userId: string, pin: string) => { storage.updateUserPin(userId, pin); refreshUsers(); }, [refreshUsers]);
  const handleDeleteUser = useCallback(async (userId: string) => { playDelete(); await storage.deleteUser(userId); refreshUsers(); if (currentUser && isStaffRole(currentUser.role)) { setAllStudentData(await storage.getAllStudentData(currentUser.role, currentUser.workplace)); } }, [currentUser, refreshUsers]);
  const handleLogout = useCallback(() => { playLogout(); storage.logoutCurrentUser(); setCurrentUser(null); setLockoutReason(null); setIsIntroActive(false); }, []);
  
  const handleIntroComplete = useCallback(() => { 
      // Do nothing, just let terminal finish and wait for user interaction in ContextualOnboarding
  }, []);

  const handleStartPresentation = useCallback(() => { 
      setIsIntroActive(false); 
      setView('presentation'); 
  }, []);

  const handleUpdateStudentData = useCallback(async (studentId: string, data: Partial<UserData>) => { const studentCurrentData = await storage.loadUserData(studentId); const updatedData = { ...studentCurrentData, ...data }; storage.saveUserData(studentId, updatedData); if (currentUser && isStaffRole(currentUser.role)) { setAllStudentData(await storage.getAllStudentData(currentUser.role, currentUser.workplace)); } }, [currentUser]);
  
  const handleSaveLogbookEntry = useCallback((newEntry: LogbookEntry) => { 
      if (!currentUser) return; 
      awardXP(100, "Loggboksinlägg");
      
      updateUserData((prevData: UserData) => { 
          const updatedEntries = [...(prevData.logbookEntries || []), newEntry]; 
          
          let streak = prevData.logbookStreak || { current: 0, longest: 0, lastEntryDate: null };
          const today = new Date().toISOString().split('T')[0];
          
          if (streak.lastEntryDate !== today) {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              const yesterdayStr = yesterday.toISOString().split('T')[0];
              
              if (streak.lastEntryDate === yesterdayStr) {
                  streak.current += 1;
              } else {
                  streak.current = 1;
              }
              streak.lastEntryDate = today;
              streak.longest = Math.max(streak.current, streak.longest);
              
              if (streak.current === 5 && !(prevData.achievements || []).includes('STREAK_5')) {
                  awardXP(500, "Bonus: 5 dagars streak!");
                  const newAchievements = [...(prevData.achievements || []), 'STREAK_5'];
                  return { logbookEntries: updatedEntries, logbookStreak: streak, achievements: newAchievements };
              }
          }
          
          return { logbookEntries: updatedEntries, logbookStreak: streak }; 
      }); 
      storage.createAndDistributeNotifications(currentUser, `${currentUser.name} har skrivit ett nytt inlägg i sin loggbok.`); 
  }, [currentUser, updateUserData, awardXP]);

  const handleChecklistToggle = useCallback((idx: number, checked: boolean) => {
      updateUserData(prev => {
          const newProgress = { ...prev.checklistProgress, [idx]: checked };
          let newAwarded = prev.awardedChecklistItems || [];
          
          if (checked) {
              // CHEAT PREVENTION: Only award XP if not previously awarded
              if (!newAwarded.includes(idx)) {
                  awardXP(50, "Checklistpunkt");
                  newAwarded = [...newAwarded, idx];
              }
              
              const completed = Object.values(newProgress).filter(Boolean).length;
              const total = departmentSettings?.checklist?.split('\n').length || APP_DATA.checklist.length;
              
              if (completed === total && !(prev.achievements || []).includes('CHECKLIST_COMPLETE')) {
                  awardXP(1000, "Bonus: Checklista Klar!");
                  return { checklistProgress: newProgress, awardedChecklistItems: newAwarded, achievements: [...(prev.achievements || []), 'CHECKLIST_COMPLETE'] };
              }
          }
          return { checklistProgress: newProgress, awardedChecklistItems: newAwarded };
      });
  }, [updateUserData, awardXP, departmentSettings]);

  const handleUpdateLogbookEntry = useCallback((timestamp: Date, updates: Partial<LogbookEntry>) => { const targetTime = new Date(timestamp).getTime(); updateUserData((prevData: UserData) => { const updatedEntries = prevData.logbookEntries.map(entry => { if (new Date(entry.timestamp).getTime() === targetTime) { return { ...entry, ...updates }; } return entry; }); return { logbookEntries: updatedEntries }; }); }, [updateUserData]);
  const handleSaveKnowledgeTestProgress = useCallback((progress: KnowledgeTestInProgress | null) => { updateUserData({ knowledgeTestInProgress: progress }); }, [updateUserData]);
  
  const handleKnowledgeTestComplete = useCallback((attempt: KnowledgeTestAttempt) => { 
      if (!currentUser) return; 
      
      const scorePercent = (attempt.score / attempt.totalQuestions) * 100;
      awardXP(attempt.score * 10, "Kunskapstest Poäng");
      
      updateUserData((prevData: UserData) => { 
          let achievements = prevData.achievements || [];
          if (scorePercent === 100 && !achievements.includes('KNOWLEDGE_TEST_ACE')) {
              awardXP(500, "Bonus: Alla rätt!");
              achievements = [...achievements, 'KNOWLEDGE_TEST_ACE'];
          }
          const newHistory = [...(prevData.knowledgeTestHistory || []), attempt]; 
          return { knowledgeTestHistory: newHistory, knowledgeTestInProgress: null, achievements }; 
      }); 
  }, [currentUser, updateUserData, awardXP]);

  // Handler for Clinical Simulator Completion
  const handleClinicalChallengeComplete = useCallback((isCorrect: boolean) => {
      if(isCorrect) {
          awardXP(300, "Klinisk Utmaning Klarad");
          updateUserData(prev => {
              if(!(prev.achievements || []).includes('CLINICAL_CHALLENGE_MASTER')) {
                  awardXP(500, "Bonus: Första Utmaningen!");
                  return { achievements: [...(prev.achievements || []), 'CLINICAL_CHALLENGE_MASTER'] };
              }
              return {};
          });
      } else {
          awardXP(50, "Bra försök!");
      }
  }, [awardXP, updateUserData]);

  // Handler for Communication Lab Completion
  const handleScenarioComplete = useCallback(() => {
      awardXP(200, "Scenario Slutfört");
      updateUserData(prev => {
          if(!(prev.achievements || []).includes('COMM_LAB_FIRST_TRY')) {
              awardXP(300, "Bonus: Första Scenariot!");
              return { achievements: [...(prev.achievements || []), 'COMM_LAB_FIRST_TRY'] };
          }
          return {};
      });
  }, [awardXP, updateUserData]);

  const handleResetKnowledgeTestHistory = useCallback(() => { updateUserData({ knowledgeTestHistory: [], knowledgeTestInProgress: null }); }, [updateUserData]);
  const handleSelectStudentForDetail = useCallback((userId: string) => { setSelectedStudentId(userId); setView('student-detail'); }, []);
  const handleAccountDeletion = useCallback(() => { if (currentUser) { handleDeleteUser(currentUser.id); handleLogout(); } }, [currentUser, handleDeleteUser, handleLogout]);
  const handleNavigate = useCallback((targetView: View) => { setView(targetView); }, []);
  const handleInitiateChat = useCallback((prompt: string) => { setChatbotInitialMessage(prompt); setIsChatOpen(true); }, []);
  const handleMarkNotificationsAsRead = useCallback(() => { updateUserData((prevData) => { if (prevData.notifications?.some(n => !n.read)) { const readNotifications = prevData.notifications.map(n => ({ ...n, read: true })); return { notifications: readNotifications }; } return {}; }); }, [updateUserData]);
  
  const handleCompleteAILicense = useCallback(() => { 
      if (!currentUser) return; 
      awardXP(500, "AI-Körkort Klarat!");
      updateUserData(prev => ({ 
          hasCompletedAILicense: true, 
          achievements: [...(prev.achievements || []), 'AI_LICENSE_COMPLETE'] 
      })); 
      setView(viewAfterLicense); 
  }, [currentUser, updateUserData, viewAfterLicense, awardXP]);
  
  // Award badge for staff as well
  const handleCompleteStaffAILicense = useCallback(() => { 
      if (!currentUser) return; 
      awardXP(500, "AI-Körkort (Handledare) Klarat!");
      
      // Update data immediately with badge
      updateUserData(prev => {
          const currentAchievements = prev.achievements || [];
          if (!currentAchievements.includes('AI_LICENSE_STAFF')) {
              return { 
                  hasCompletedStaffAILicense: true,
                  achievements: [...currentAchievements, 'AI_LICENSE_STAFF'] // Award staff badge
              };
          }
          return { hasCompletedStaffAILicense: true };
      }); 
      
      setView(viewAfterLicense); 
  }, [currentUser, updateUserData, viewAfterLicense, awardXP]);

  const handleCompleteAdminAILicense = useCallback(() => { if (!currentUser) return; updateUserData({ hasCompletedAdminAILicense: true }); setView(viewAfterLicense); }, [currentUser, updateUserData, viewAfterLicense]);
  const handlePlayPodcast = useCallback((src: string) => { setPodcastConfig({ src, isVisible: true }); }, []);
  const handleClosePodcast = useCallback(() => { setPodcastConfig({ src: '', isVisible: false }); }, []);
  const clearInitialMessage = useCallback(() => setChatbotInitialMessage(''), []);
  const handleSaveCareFlow = useCallback((query: string, flow: CareFlowStep[]) => { if (!currentUser) return; const newFlow: SavedCareFlow = { id: `flow-${Date.now().toString()}`, query, flow, timestamp: new Date().toISOString(), }; updateUserData((prev) => ({ savedCareFlows: [...(prev.savedCareFlows || []), newFlow] })); }, [currentUser, updateUserData]);
  const handleConfirmDeleteCareFlow = useCallback(() => { if (!careFlowToDelete || !currentUser) return; playDelete(); updateUserData((prev) => ({ savedCareFlows: (prev.savedCareFlows || []).filter(f => f.id !== careFlowToDelete.id) })); setCareFlowToDelete(null); setSelectedCareFlow(null); }, [careFlowToDelete, currentUser, updateUserData]);
  
  // NEW: Handler to close care flow modals
  const handleCloseModals = useCallback(() => {
      setSelectedCareFlow(null);
      setCareFlowToDelete(null);
  }, []);

  const handleAssignSupervisor = useCallback(async (studentId: string, supervisorId: string) => { storage.assignSupervisorToStudent(studentId, supervisorId); refreshUsers(); if (currentUser && isStaffRole(currentUser.role)) { setAllStudentData(await storage.getAllStudentData(currentUser.role, currentUser.workplace)); } }, [currentUser, refreshUsers]);

  const dynamicChecklist = useMemo(() => departmentSettings?.checklist ? departmentSettings.checklist.split('\n').filter(Boolean) : [], [departmentSettings]);
  const dynamicGoals = useMemo(() => { const rawGoals = departmentSettings?.knowledgeRequirements ? departmentSettings.knowledgeRequirements.split('\n').filter(Boolean) : []; return rawGoals.length > 0 ? rawGoals.map((text, index) => ({ id: `goal-${index + 1}`, text })) : []; }, [departmentSettings]);

  const sidebarProps = useMemo(() => { if (!currentUser) return null; return { user: currentUser, currentView: view, onLogout: handleLogout, notifications: currentUserData?.notifications || [], onMarkAsRead: handleMarkNotificationsAsRead, appName: appName, }; }, [currentUser, view, handleLogout, currentUserData, handleMarkNotificationsAsRead, appName]);

  const renderView = () => {
        if (!currentUser || !currentUserData || !departmentSettings) return null;

        const selectedStudent = allStudentData.find(d => d.user.id === selectedStudentId);

        switch (view) {
          case 'dashboard': {
            if (currentUser.role === 'developer') {
                return <DeveloperDashboard setView={handleNavigate} />;
            }
            // Use current user's schedule directly
            const mySchedule = currentUserData.schedule || [];

            return <Dashboard 
                user={currentUser} 
                userData={currentUserData} 
                setView={handleNavigate} 
                onUpdateUserData={updateUserData} 
                allStudentData={allStudentData} 
                onUpdateStudentData={handleUpdateStudentData} 
                onSelectStudent={handleSelectStudentForDetail} 
                onAskAI={handleInitiateChat} 
                timeLeft={timeLeft} 
                onSelectCareFlow={setSelectedCareFlow} 
                selectedCareFlow={selectedCareFlow}
                onDeleteCareFlowRequest={setCareFlowToDelete} 
                careFlowToDelete={careFlowToDelete}
                onConfirmDeleteCareFlow={handleConfirmDeleteCareFlow}
                onCloseModals={handleCloseModals}
                departmentSettings={departmentSettings} 
                onUpdateDepartmentSettings={handleUpdateDepartmentSettings} 
                onCreateUser={handleCreateUser} 
                onDeleteUser={handleDeleteUser}
                onClinicalChallengeComplete={handleClinicalChallengeComplete}
                schedule={mySchedule} // Pass schedule to dashboard
            />;
          }
          case 'developer-dashboard':
            return <DeveloperDashboard setView={handleNavigate} />;
          case 'community':
            return <Community currentUser={currentUser} />;
          case 'settings':
            return <Settings user={currentUser} onUpdateTheme={handleUpdateTheme} onLogout={handleLogout} />;
          case 'about':
            return <About onPlayPodcast={handlePlayPodcast} />;
          case 'qa':
            return <QA />;
          case 'about-creator':
            return <AboutCreator setView={handleNavigate} />;
          case 'example-report':
            return <ExampleReport />;
          case 'feedback':
            return <Feedback user={currentUser} />;
          case 'checklist':
            return <Checklist progress={currentUserData.checklistProgress} onToggle={handleChecklistToggle} isReadOnly={false} onAskAI={handleInitiateChat} userRole={currentUser.role} customItems={dynamicChecklist} />;
          case 'logbook':
            return <Logbook entries={currentUserData.logbookEntries} onSave={handleSaveLogbookEntry} onUpdateEntry={handleUpdateLogbookEntry} streak={currentUserData.logbookStreak} />;
          case 'goals':
            return <Goals progress={currentUserData.goalsProgress} onSave={(newProgress) => updateUserData({ goalsProgress: newProgress })} userRole={currentUser.role} customItems={dynamicGoals} />;
          case 'attendance': {
              // Pass the current user's schedule directly to the view
              return <Attendance userData={currentUserData} supervisorSchedule={currentUserData.schedule} />;
          }
          case 'knowledge-test':
            return <KnowledgeTest user={currentUser} userData={currentUserData} knowledgeTestHistory={currentUserData.knowledgeTestHistory} knowledgeTestInProgress={currentUserData.knowledgeTestInProgress} onTestComplete={handleKnowledgeTestComplete} onResetHistory={handleResetKnowledgeTestHistory} onSaveProgress={handleSaveKnowledgeTestProgress} onAskAI={handleInitiateChat} departmentSettings={departmentSettings} onUpdateDepartmentSettings={handleUpdateDepartmentSettings} />;
          case 'modules':
            return <Modules user={currentUser} onAskAI={handleInitiateChat} onSaveCareFlow={handleSaveCareFlow} onHighlightComplete={() => {}} />;
          case 'progress':
            return <StudentProgress user={currentUser} userData={currentUserData} onUpdateUserData={updateUserData} studentData={allStudentData} onSelectStudent={handleSelectStudentForDetail} setView={handleNavigate} onAccountDeletion={handleAccountDeletion} onCreateUser={handleCreateUser} allUsers={users} onAssignSupervisor={handleAssignSupervisor} />;
          case 'student-detail':
            if (!selectedStudent) return <div>Student not found. <button onClick={() => setView('progress')} className="text-red-600">Go back</button></div>
            return <StudentDetail currentUser={currentUser} student={selectedStudent.user} data={selectedStudent.data} onBack={() => { setSelectedStudentId(null); setView('progress'); }} onUpdateStudentData={handleUpdateStudentData} />;
          case 'resources':
            return <PedagogicalResources allStudentData={allStudentData} />;
          case 'admin-dashboard':
            return <AdminDashboard users={users} onDeleteUser={handleDeleteUser} onSelectUser={handleSelectStudentForDetail} onCreateUser={handleCreateUser} />;
          case 'department-settings':
            return <DepartmentSettingsComponent settings={departmentSettings} onUpdateSettings={handleUpdateDepartmentSettings} />;
          case 'feedback-viewer':
            return <FeedbackViewer />;
          case 'ai-feedback-viewer':
            return <AIFeedbackViewer />;
          case 'flagged-content':
            return <FlaggedContentViewer />;
          case 'file-management':
            return <FileManagement />;
          case 'communication-lab':
            return <CommunicationLab 
                user={currentUser} 
                userData={currentUserData!} 
                onUpdateUserData={updateUserData} 
                dailyLimit={departmentSettings.communicationLabDailyLimit} 
                monthlyLimit={departmentSettings.communicationLabMonthlyLimit}
                onScenarioComplete={handleScenarioComplete}
            />;
          case 'analytics':
            return <Analytics allStudentData={allStudentData} users={users} />;
          default:
            return <div>View not found</div>;
        }
  };

  if (isLoading || isConfiguring) {
      return <FunLoader />;
  }

  if (!currentUser) {
    return <ProfileSelection 
        users={users} 
        onSelectProfile={handleSelectProfile} 
        onUpdateUserPin={handleUpdateUserPin} 
        onCreateProfile={handleCreateProfile}
    />;
  }
  
  if (currentUser && !isStaffRole(currentUser.role) && lockoutReason) {
      return <LockoutScreen reason={lockoutReason} onLogout={handleLogout} />;
  }
  
  if (view === 'ai-license' && currentUserData) {
    const handleComplete = () => {
        if (!currentUser) return;
        if (currentUser.role === 'admin') {
            handleCompleteAdminAILicense();
        } else if (isStaffRole(currentUser.role)) {
            handleCompleteStaffAILicense();
        } else {
            handleCompleteAILicense();
        }
    };
    return <AILicense user={currentUser} onComplete={handleComplete} onBack={() => setView('dashboard')} />;
  }

  if (view === 'presentation' && currentUser) {
      const handlePresentationBack = () => {
          if (!currentUserData) {
              setView('dashboard');
              return;
          }
          
          if (currentUser.role === 'developer') {
              setView('dashboard');
              return;
          }
          
          // Mark First Login as done
          if (currentUserData.isFirstLogin) {
              updateUserData({ isFirstLogin: false });
          }

          const isAdmin = currentUser.role === 'admin';
          const isStaff = isStaffRole(currentUser.role) && !isAdmin;
          const isStudent = !isStaffRole(currentUser.role);

          const hasLicense = (isStudent && currentUserData.hasCompletedAILicense) ||
                             (isStaff && currentUserData.hasCompletedStaffAILicense) ||
                             (isAdmin && currentUserData.hasCompletedAdminAILicense);

          if (hasLicense) {
              setView('dashboard');
          } else {
              setViewAfterLicense('dashboard');
              setView('ai-license');
          }
      };

      return <Presentation user={currentUser} onBack={handlePresentationBack} />;
  }

  // Force onboarding if Intro is active OR if user has isFirstLogin flag set (safety catch)
  if (isIntroActive || (currentUserData && currentUserData.isFirstLogin)) {
    return (
        <>
            <Onboarding user={currentUser} onComplete={handleIntroComplete} />
            {/* Ensure ContextualOnboarding shows if settings are available, otherwise wait or show error/loader */}
            {onboardingSettings && <ContextualOnboarding user={currentUser} settings={onboardingSettings} onContinue={handleStartPresentation} />}
        </>
    );
  }

  return (
    <ErrorBoundary>
      <OfflineIndicator />
      <div className="flex h-screen bg-transparent font-sans">
            <div className="hidden lg:flex flex-shrink-0">
                <Sidebar {...sidebarProps!} setView={handleNavigate} />
            </div>
            {isMobileSidebarOpen && (
                <>
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)}></div>
                    <div className="fixed top-0 left-0 h-full z-40 lg:hidden shadow-xl animate-slide-in">
                        <Sidebar {...sidebarProps!} onLogout={() => { setIsMobileSidebarOpen(false); handleLogout(); }} setView={(view: View) => { setIsMobileSidebarOpen(false); handleNavigate(view); }} />
                    </div>
                </>
            )}
            <div className="flex-1 flex flex-col overflow-hidden">
                <MobileHeader onMenuClick={() => setIsMobileSidebarOpen(true)} appName={appName} />
                <main key={view} className="flex-1 p-4 md:p-6 overflow-y-auto page-enter relative">
                    {renderView()}
                    <InstallPWA />
                    <ToastContainer toasts={toasts} removeToast={removeToast} />
                </main>
            </div>
        </div>
        <GlobalPodcastPlayer src={podcastConfig.src} isVisible={podcastConfig.isVisible} onClose={handleClosePodcast} />
        {currentUser && currentUserData && (
            <FloatingChat user={currentUser} userData={currentUserData} allStudentData={allStudentData} onUpdateUserData={updateUserData} onAccountDeletion={handleAccountDeletion} isOpen={isChatOpen} setIsOpen={setIsChatOpen} initialMessage={chatbotInitialMessage} clearInitialMessage={clearInitialMessage} currentView={view} setView={handleNavigate} setViewAfterLicense={setViewAfterLicense} />
        )}
    </ErrorBoundary>
  );
};

export default App;
