
import React, { useState, useEffect, memo, useCallback, useRef, useMemo } from 'react';
import { User, UserData, View, Role, SavedCareFlow, DepartmentSettings, CustomDocument, DailyScenarioUsage, DailySuggestion, ScheduleEntry, Post, PostCategory } from '../types';
import * as storage from '../services/localStorageService';
import { getAIDashboardSuggestion, getSupervisorDashboardInsights } from '../services/geminiService';
import { ICONS, APP_DATA, ACHIEVEMENTS } from '../constants';
import DailyAttendanceManager from './DailyAttendanceManager';
import { InfoTooltip, toYYYYMMDD, getRoleDisplayName, Modal, UpgradeModal, ProgressCircle, FlowRenderer } from './UI';
import BreakReminder from './BreakReminder';
import { ClinicalSimulator } from './ClinicalSimulator';
import { playSuccess, playClick, playLevelUp, playMessageSent } from '../services/soundService';
import FieldTimer from './FieldTimer';

// Make TypeScript aware of the globally included libraries
declare const jspdf: any;
declare const html2canvas: any;

const isStaffRole = (role: Role) => {
    return role.startsWith('handledare') || role.startsWith('larare') || role === 'admin' || role === 'overlakare' || role === 'huvudhandledare';
}

interface DashboardProps {
    user: User;
    userData: UserData;
    setView: (view: View) => void;
    onUpdateUserData: (data: Partial<UserData>) => void;
    allStudentData?: { user: User, data: UserData }[];
    onUpdateStudentData?: (studentId: string, updatedData: Partial<UserData>) => void;
    onSelectStudent?: (userId: string) => void;
    onAskAI: (prompt: string) => void;
    
    // Care Flow Props
    onSelectCareFlow?: (flow: SavedCareFlow) => void;
    selectedCareFlow?: SavedCareFlow | null;
    onDeleteCareFlowRequest?: (flow: SavedCareFlow) => void;
    careFlowToDelete?: SavedCareFlow | null;
    onConfirmDeleteCareFlow?: () => void;
    onCloseModals?: () => void;

    departmentSettings: DepartmentSettings | null;
    onUpdateDepartmentSettings: (settings: DepartmentSettings) => void;
    onCreateUser: (name: string, role: Role, aplWeeks?: number) => Promise<User>; 
    onDeleteUser: (userId: string) => void;
    timeLeft?: number;
    onClinicalChallengeComplete?: (isCorrect: boolean) => void;
    
    // New prop for student view
    schedule?: ScheduleEntry[];
}

const badgeThemes: Record<string, { border: string, bg: string, shadow: string, glow: string }> = {
    CHECKLIST_COMPLETE: { 
        border: 'border-emerald-500', 
        bg: 'from-emerald-900/40 to-emerald-900/10', 
        shadow: 'shadow-emerald-500/20',
        glow: 'bg-emerald-500'
    },
    KNOWLEDGE_TEST_ACE: { 
        border: 'border-cyan-500', 
        bg: 'from-cyan-900/40 to-cyan-900/10', 
        shadow: 'shadow-cyan-500/20',
        glow: 'bg-cyan-500'
    },
    LOGBOOK_5: { 
        border: 'border-amber-500', 
        bg: 'from-amber-900/40 to-amber-900/10', 
        shadow: 'shadow-amber-500/20',
        glow: 'bg-amber-500'
    },
    STREAK_5: { 
        border: 'border-red-500', 
        bg: 'from-red-900/40 to-red-900/10', 
        shadow: 'shadow-red-500/20',
        glow: 'bg-red-500'
    },
    AI_LICENSE_COMPLETE: { 
        border: 'border-fuchsia-500', 
        bg: 'from-fuchsia-900/40 to-fuchsia-900/10', 
        shadow: 'shadow-fuchsia-500/20',
        glow: 'bg-fuchsia-500'
    },
    AI_LICENSE_STAFF: { 
        border: 'border-indigo-500', 
        bg: 'from-indigo-900/40 to-indigo-900/10', 
        shadow: 'shadow-indigo-500/20',
        glow: 'bg-indigo-500'
    },
    AI_LICENSE_ADMIN: { 
        border: 'border-violet-500', 
        bg: 'from-violet-900/40 to-violet-900/10', 
        shadow: 'shadow-violet-500/20',
        glow: 'bg-violet-500'
    },
    COMM_LAB_FIRST_TRY: { 
        border: 'border-blue-500', 
        bg: 'from-blue-900/40 to-blue-900/10', 
        shadow: 'shadow-blue-500/20',
        glow: 'bg-blue-500'
    },
    CLINICAL_CHALLENGE_MASTER: { 
        border: 'border-purple-500', 
        bg: 'from-purple-900/40 to-purple-900/10', 
        shadow: 'shadow-purple-500/20',
        glow: 'bg-purple-500'
    },
};

const defaultTheme = { 
    border: 'border-slate-500', 
    bg: 'from-slate-900/40 to-slate-900/10', 
    shadow: 'shadow-slate-500/20',
    glow: 'bg-slate-500'
};

// --- NEW WIDGET: ScheduleWidget ---
const ScheduleWidget: React.FC<{ schedule?: ScheduleEntry[] }> = memo(({ schedule }) => {
    // 1. Get today's date safely in local time format YYYY-MM-DD
    const today = new Date();
    const todayStr = toYYYYMMDD(today);
    
    // 2. Filter and sort schedule
    const upcomingSchedule = useMemo(() => {
        if (!schedule || schedule.length === 0) return [];
        
        return schedule
            .filter(entry => entry.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [schedule, todayStr]);

    const todaysShift = upcomingSchedule.find(s => s.date === todayStr);
    const nextShifts = upcomingSchedule.filter(s => s.date !== todayStr).slice(0, 3);

    // Helpers for display
    const getShiftColor = (type: string) => {
        if (type === 'Dag') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800';
        if (type === 'Kväll') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border-blue-200 dark:border-blue-800';
        if (type === 'Natt') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200 border-purple-200 dark:border-purple-800';
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700';
    };

    const formatDisplayDate = (dateStr: string) => {
        // Force midday time to avoid timezone offset issues when creating Date object
        const d = new Date(dateStr + 'T12:00:00'); 
        const dayName = d.toLocaleDateString('sv-SE', { weekday: 'long' });
        const dayDate = d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
        return { dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1), dayDate };
    };

    return (
        <div className="card-base p-6 h-full flex flex-col relative overflow-hidden bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-black border-l-4 border-l-blue-500">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                {ICONS.calendar} Schema & Närvaro
            </h3>

            {/* Today's Highlight */}
            <div className="mb-4">
                {todaysShift ? (
                    <div className={`p-4 rounded-lg border-2 ${getShiftColor(todaysShift.shiftType)} shadow-sm relative overflow-hidden group transition-all hover:scale-[1.02]`}>
                        <div className="absolute top-0 right-0 p-2 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">IDAG ({formatDisplayDate(todayStr).dayDate})</p>
                        <h4 className="text-2xl font-bold mb-1">{todaysShift.shiftType}</h4>
                        <p className="text-lg font-mono font-medium">{todaysShift.startTime} - {todaysShift.endTime}</p>
                    </div>
                ) : (
                    <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Inget inbokat pass idag.</p>
                        <p className="text-xs text-slate-400 mt-1">Njut av ledigheten!</p>
                    </div>
                )}
            </div>

            {/* Upcoming List */}
            <div className="flex-1 overflow-y-auto pr-1">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kommande</h4>
                <div className="space-y-2">
                    {nextShifts.length > 0 ? nextShifts.map((s, i) => {
                        const { dayName, dayDate } = formatDisplayDate(s.date);
                        return (
                            <div key={i} className="flex justify-between items-center p-2.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                                <div>
                                    <span className="block font-bold text-sm text-slate-700 dark:text-slate-200">{dayName}</span>
                                    <span className="text-xs text-slate-500">{dayDate}</span>
                                </div>
                                <div className="text-right">
                                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${getShiftColor(s.shiftType).split(' ')[0]} ${getShiftColor(s.shiftType).split(' ')[1]}`}>
                                        {s.shiftType}
                                    </span>
                                    <p className="text-xs font-mono text-slate-500 mt-0.5">{s.startTime}-{s.endTime}</p>
                                </div>
                            </div>
                        );
                    }) : (
                        <p className="text-xs text-slate-400 italic">Inga fler pass inbokade.</p>
                    )}
                </div>
            </div>
        </div>
    );
});

const AchievementBadge: React.FC<{ ach: { id: string, name: string, icon: string, description: string }, index: number, onShare: (ach: any) => void }> = memo(({ ach, index, onShare }) => {
    const theme = badgeThemes[ach.id] || defaultTheme;

    return (
        <div 
            className={`relative group w-full sm:w-48 h-64 rounded-xl border ${theme.border} bg-gradient-to-b ${theme.bg} backdrop-blur-md shadow-lg ${theme.shadow} transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl overflow-hidden flex flex-col items-center text-center p-4 stagger-item cursor-pointer`}
            style={{ '--stagger-delay': `${index * 100}ms` } as React.CSSProperties}
            onClick={() => onShare(ach)}
        >
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none transform -translate-x-full group-hover:animate-shine" />
            <div className={`absolute top-10 left-1/2 -translate-x-1/2 w-24 h-24 ${theme.glow} rounded-full blur-[50px] opacity-20 group-hover:opacity-40 transition-opacity duration-300`} />
            
            {/* Share Button Overlay */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                <button className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md" title="Dela till Community">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                </button>
            </div>

            <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
                <div className="text-5xl mb-4 drop-shadow-md transform group-hover:scale-110 transition-transform duration-300 filter grayscale-[0.3] group-hover:grayscale-0">
                    {ach.icon}
                </div>
                <h4 className="font-bold text-slate-100 tracking-wide text-sm uppercase mb-2 px-2 leading-tight">
                    {ach.name}
                </h4>
                <div className={`h-0.5 w-8 ${theme.glow} opacity-50 mb-2`} />
                <p className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">
                    {ach.description}
                </p>
                <p className="mt-4 text-[10px] text-white/50 font-mono opacity-0 group-hover:opacity-100 transition-opacity">Klicka för att dela</p>
            </div>
            <div className={`absolute top-2 left-2 w-2 h-2 border-t-2 border-l-2 ${theme.border} opacity-50`} />
            <div className={`absolute top-2 right-2 w-2 h-2 border-t-2 border-r-2 ${theme.border} opacity-50`} />
            <div className={`absolute bottom-2 left-2 w-2 h-2 border-b-2 border-l-2 ${theme.border} opacity-50`} />
            <div className={`absolute bottom-2 right-2 w-2 h-2 border-b-2 border-r-2 ${theme.border} opacity-50`} />
        </div>
    );
});

const AchievementsCard: React.FC<{ userData: UserData, onShareAchievement: (ach: any) => void }> = memo(({ userData, onShareAchievement }) => {
    const earnedAchievements = (userData.achievements || []).map(id => ({ id, ...ACHIEVEMENTS[id] }));
    const prevCountRef = useRef(earnedAchievements.length);

    useEffect(() => {
        if (earnedAchievements.length > prevCountRef.current) {
            playSuccess();
        }
        prevCountRef.current = earnedAchievements.length;
    }, [earnedAchievements.length]);

    if (earnedAchievements.length === 0) {
        return null;
    }

    return (
        <div className="mt-8">
             <div className="flex items-center mb-6">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="text-yellow-500">🏆</span> Mina Utmärkelser
                </h3>
                <div className="ml-4 h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-slate-700 to-transparent" />
            </div>
            
            <div className="flex flex-wrap gap-6 justify-center sm:justify-start">
                {earnedAchievements.map((ach, index) => (
                    <AchievementBadge key={ach.id} ach={ach} index={index} onShare={onShareAchievement} />
                ))}
            </div>
            
            <style>{`
                @keyframes shine {
                    0% { transform: translateX(-100%) translateY(-100%); }
                    100% { transform: translateX(100%) translateY(100%); }
                }
                .group:hover .animate-shine {
                    animation: shine 1s cubic-bezier(0.4, 0, 0.2, 1);
                }
            `}</style>
        </div>
    );
});

// NEW: XP & Level Widget
const XPLevelWidget: React.FC<{ xp: number }> = memo(({ xp }) => {
    const level = Math.floor(xp / 1000) + 1;
    const progress = (xp % 1000) / 10; // 0-100%

    return (
        <div className="card-base p-6 mb-6 flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-900 border border-slate-700 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
            
            <div className="flex items-center gap-4 z-10">
                <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-red-500 flex items-center justify-center shadow-lg">
                    <span className="text-2xl font-bold text-white">{level}</span>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">Current Level</h3>
                    <p className="text-xs text-slate-400 font-mono">NEXT LEVEL: {Math.floor(xp/1000 + 1) * 1000} XP</p>
                </div>
            </div>

            <div className="flex-1 w-full sm:max-w-md z-10">
                <div className="flex justify-between text-xs text-slate-400 mb-1 font-mono">
                    <span>{xp} XP</span>
                    <span>{(level * 1000)} XP</span>
                </div>
                <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div 
                        className="h-full bg-gradient-to-r from-red-600 to-orange-500 transition-all duration-1000 ease-out relative"
                        style={{ width: `${progress}%` }}
                    >
                        <div className="absolute top-0 right-0 w-1 h-full bg-white/50 shadow-[0_0_10px_white]"></div>
                    </div>
                </div>
            </div>
        </div>
    );
});

// UPDATED: Smart Daily Focus / Mission Widget
const DailyTipWidget: React.FC<{ 
    user: User, 
    userData: UserData, 
    onUpdateUserData: (d: Partial<UserData>) => void,
    onNavigate: (view: View) => void
}> = memo(({ user, userData, onUpdateUserData, onNavigate }) => {
    const [suggestion, setSuggestion] = useState<DailySuggestion | null>(userData.aiSuggestion || null);
    const [loading, setLoading] = useState(false);

    // Days Completed Logic for Progress Bar
    const totalDays = userData.aplTotalDays || 20;
    const daysPresent = userData.attendanceRecords?.filter(r => r.status === 'present').length || 0;
    const daysPercent = Math.min(100, Math.round((daysPresent / totalDays) * 100));

    useEffect(() => {
        const fetchTip = async () => {
            const today = toYYYYMMDD(new Date());
            
            // Check if we have a valid, current suggestion
            if (userData.aiSuggestion && userData.aiSuggestion.timestamp === today) {
                setSuggestion(userData.aiSuggestion);
                
                // Auto-complete check for CHECKLIST items
                if (
                    !userData.aiSuggestion.completed && 
                    userData.aiSuggestion.type === 'checklist' && 
                    typeof userData.aiSuggestion.relatedId === 'number'
                ) {
                    if (userData.checklistProgress[userData.aiSuggestion.relatedId]) {
                        // User has checked the box elsewhere, mark mission complete!
                        handleCompleteMission();
                    }
                }
                return;
            }

            // Otherwise generate a new one
            setLoading(true);
            try {
                const newTip = await getAIDashboardSuggestion(user, userData);
                setSuggestion(newTip);
                onUpdateUserData({ aiSuggestion: newTip });
            } catch (error) {
                console.error("Tip generation failed", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTip();
    }, [userData.aiSuggestion, user, userData.checklistProgress]); // Re-run if checklist progress changes

    const handleRefresh = async () => {
        setLoading(true);
        try {
            const newTip = await getAIDashboardSuggestion(user, userData);
            setSuggestion(newTip);
            onUpdateUserData({ aiSuggestion: newTip });
        } catch(e) { console.error(e) } 
        finally { setLoading(false); }
    };

    const handleCompleteMission = () => {
        if (!suggestion) return;
        playSuccess();
        playLevelUp(); // Extra sound for daily mission
        
        const updatedSuggestion = { ...suggestion, completed: true };
        setSuggestion(updatedSuggestion);
        onUpdateUserData({ aiSuggestion: updatedSuggestion });
    };

    const handleAction = () => {
        if (suggestion?.type === 'checklist') {
            onNavigate('checklist');
        } else if (suggestion?.type === 'goal') {
            onNavigate('goals');
        } else {
            handleCompleteMission();
        }
    };

    return (
        <div className={`card-base p-6 mb-6 border-l-4 relative overflow-hidden transition-all duration-500 ${suggestion?.completed ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-gradient-to-br from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 border-indigo-500'}`}>
            
            {/* Header / Timeline */}
            <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide text-xs flex items-center gap-2">
                    {ICONS.calendar} 
                    {suggestion?.completed ? "UPPDRAG SLUTFÖRT" : "DAGENS UPPDRAG"}
                </h3>
                <div className="text-xs font-mono text-slate-500">
                    DAG {daysPresent + 1} AV {totalDays}
                </div>
            </div>

            {/* Content */}
            <div className="flex gap-4 items-start relative z-10">
                <div className={`p-3 rounded-full h-fit flex-shrink-0 transition-colors ${suggestion?.completed ? 'bg-green-100 text-green-600' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
                    {suggestion?.completed ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                        ICONS.aiTips
                    )}
                </div>
                
                <div className="flex-1">
                    {loading ? (
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 animate-pulse mb-2"></div>
                    ) : (
                        <p className={`text-lg font-medium mb-3 ${suggestion?.completed ? 'text-green-800 dark:text-green-200 line-through opacity-70' : 'text-slate-800 dark:text-slate-200'}`}>
                            "{suggestion?.suggestion}"
                        </p>
                    )}

                    {!loading && !suggestion?.completed && (
                        <button 
                            onClick={handleAction}
                            className="mt-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2 px-4 rounded-full shadow-md transition-transform active:scale-95 flex items-center gap-2"
                        >
                            {suggestion?.type === 'checklist' && ICONS.checklist}
                            {suggestion?.type === 'checklist' ? 'Gå till Checklistan' : 
                             suggestion?.type === 'goal' ? 'Skatta Mål' : 'Markera som klart'}
                        </button>
                    )}
                    
                    {suggestion?.completed && (
                        <p className="text-sm text-green-600 dark:text-green-400 font-bold flex items-center gap-1 animate-fade-in">
                            Bra jobbat! Du ligger i fas.
                        </p>
                    )}
                </div>
            </div>

            {/* Refresh (Hidden unless hover) */}
            <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); handleRefresh(); }} className="p-1 text-slate-400 hover:text-indigo-500" title="Generera nytt uppdrag">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
            </div>
            
            {/* Timeline Bar Background */}
            <div className="absolute bottom-0 left-0 h-1 bg-slate-200 dark:bg-slate-700 w-full">
                <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${daysPercent}%` }}></div>
            </div>
        </div>
    );
});

// NEW: Supervisor Focus Widget (Matches DailyTipWidget but for staff)
const SupervisorFocusWidget: React.FC<{ 
    user: User, 
    allStudentData: any[],
    onNavigate: (view: View) => void
}> = memo(({ user, allStudentData, onNavigate }) => {
    const [insights, setInsights] = useState<string>('Laddar analys...');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchInsights = async () => {
            if (allStudentData && allStudentData.length > 0) {
                const cached = localStorage.getItem('supervisor_insights_cache');
                if (cached) {
                    setInsights(cached);
                } else {
                    setLoading(true);
                    try {
                        const result = await getSupervisorDashboardInsights(allStudentData);
                        setInsights(result);
                        localStorage.setItem('supervisor_insights_cache', result);
                    } catch (e) {
                        setInsights("Kunde inte ladda insikter just nu.");
                    } finally {
                        setLoading(false);
                    }
                }
            } else {
                setInsights("Du har inga studenter kopplade än. Lägg till studenter för att få AI-insikter.");
            }
        };
        fetchInsights();
    }, [allStudentData]);

    return (
        <div className="card-base p-6 mb-6 border-l-4 border-indigo-500 bg-gradient-to-br from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 relative overflow-hidden transition-all duration-500">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide text-xs flex items-center gap-2">
                    {ICONS.ai} HANDLEDAR-ANALYS
                </h3>
                <div className="text-xs font-mono text-slate-500">
                    {allStudentData?.length || 0} STUDENTER
                </div>
            </div>

            {/* Content */}
            <div className="flex gap-4 items-start relative z-10">
                <div className="p-3 rounded-full h-fit flex-shrink-0 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    {ICONS.supervisor}
                </div>
                
                <div className="flex-1">
                    {loading ? (
                        <div className="space-y-2">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 animate-pulse"></div>
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 animate-pulse"></div>
                        </div>
                    ) : (
                        <div className="prose prose-sm max-w-none text-slate-800 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: insights.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    )}
                    
                    <button 
                        onClick={() => onNavigate('progress')}
                        className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2 px-4 rounded-full shadow-md transition-transform active:scale-95 flex items-center gap-2"
                    >
                        Gå till mina studenter
                    </button>
                </div>
            </div>
        </div>
    );
});

interface DashboardWidgetProps {
    icon: React.ReactElement<{ className?: string }>;
    label: string;
    value: string;
    percentage: number;
    onClick: () => void;
    className?: string;
    style?: React.CSSProperties;
    infoText?: string;
    color?: string; // Added color prop for dev dashboard
}

export const DashboardWidget = memo(({ icon, label, value, percentage, onClick, className, style, infoText, color = 'red' }: DashboardWidgetProps) => {
    // Map color prop to tailwind text classes if percentage is -1 (static widget)
    const textClass = percentage === -1 ? 
        (color === 'green' ? 'text-green-600 dark:text-green-400' : 
         color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
         color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
         'text-red-600 dark:text-red-400') 
        : 'text-slate-600 dark:text-slate-400';

    return (
        <div 
            onClick={onClick} 
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
            className={`card-base p-4 text-left hover:ring-2 hover:ring-red-500 transition-all duration-200 group flex flex-col justify-between h-full min-h-[170px] btn-press relative cursor-pointer ${className}`}
            style={style}
        >
            {infoText && (
                <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
                    <InfoTooltip text={infoText} align="right" className="ml-0" />
                </div>
            )}
            <div>
                <div className="flex justify-between items-start">
                    <div className="p-2 bg-slate-100 dark:bg-slate-700/50 rounded-md text-slate-600 dark:text-slate-400">{React.cloneElement(icon, { className: "w-6 h-6" })}</div>
                    {percentage >= 0 && <span className="font-mono text-2xl font-bold text-red-600 dark:text-red-400">{percentage.toFixed(0)}%</span>}
                </div>
                <h4 className="font-bold text-slate-600 dark:text-slate-400 mt-4 text-base">{label}</h4>
            </div>
            <div>
                <p className={`text-sm mt-1 ${percentage === -1 ? `text-2xl font-bold ${textClass}` : 'text-slate-600 dark:text-slate-400'}`}>{value}</p>
                {percentage >= 0 && (
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2">
                        <div className="bg-red-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                    </div>
                )}
            </div>
        </div>
    );
});

interface SavedCareFlowsCardProps {
    flows: SavedCareFlow[];
    onFlowClick: (flow: SavedCareFlow) => void;
    onFlowDelete: (flow: SavedCareFlow) => void;
}

const SavedCareFlowsCard: React.FC<SavedCareFlowsCardProps> = memo(({ flows, onFlowClick, onFlowDelete }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScrollButtons = useCallback(() => {
        const el = scrollContainerRef.current;
        if (el) {
            const hasOverflow = el.scrollWidth > el.clientWidth;
            setCanScrollLeft(el.scrollLeft > 5);
            setCanScrollRight(hasOverflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
        } else {
            setCanScrollLeft(false);
            setCanScrollRight(false);
        }
    }, []);

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        
        checkScrollButtons();
        el.addEventListener('scroll', checkScrollButtons, { passive: true });
        window.addEventListener('resize', checkScrollButtons);
        const observer = new MutationObserver(checkScrollButtons);
        observer.observe(el, { childList: true });

        return () => {
            el.removeEventListener('scroll', checkScrollButtons);
            window.removeEventListener('resize', checkScrollButtons);
            observer.disconnect();
        };
    }, [flows, checkScrollButtons]);

    const scroll = (amount: number) => {
        scrollContainerRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
    };

    return (
        <div className="card-base p-6 relative bg-gradient-to-br from-slate-100 to-white dark:from-slate-800 dark:to-slate-900 border dark:border-slate-700">
            <div className="absolute top-4 right-4">
                 <InfoTooltip text="Dina sparade vårdflöden som du genererat med AI-verktyget. Klicka för att se hela guiden." align="right" className="ml-0" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center mb-4">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-full mr-3 text-indigo-600 dark:text-indigo-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                </div>
                <span>Sparade Vårdflöden</span>
            </h3>
            <div className="relative group">
                <div 
                    ref={scrollContainerRef}
                    className="flex gap-4 overflow-x-auto py-2 -mx-2 px-2"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', scrollSnapType: 'x mandatory' } as React.CSSProperties}
                >
                    {flows.map((flow) => (
                        <div key={flow.id} className="flex-shrink-0 w-[280px] h-[160px] relative rounded-xl transition-all duration-300 hover:scale-[1.02]" style={{ scrollSnapAlign: 'start' }}>
                             <div
                                className="w-full h-full p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md hover:shadow-lg hover:border-indigo-500 cursor-pointer flex flex-col justify-between overflow-hidden relative"
                                onClick={() => onFlowClick(flow)}
                            >
                                <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 rounded-bl-full -mr-10 -mt-10 pointer-events-none"></div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate pr-6 text-lg">{flow.query}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">{new Date(flow.timestamp).toLocaleDateString()}</p>
                                </div>
                                
                                <div className="mt-2 flex gap-1 flex-wrap">
                                    {flow.flow.slice(0,3).map((s, i) => (
                                        <span key={i} className="text-[10px] px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 truncate max-w-[80px]">
                                            {i+1}. {s.title}
                                        </span>
                                    ))}
                                    {flow.flow.length > 3 && <span className="text-[10px] text-slate-400 self-center">+{flow.flow.length - 3}</span>}
                                </div>
                            </div>
                             <button
                                onClick={(e) => { e.stopPropagation(); onFlowDelete(flow); }}
                                className="absolute top-2 right-2 p-1.5 rounded-full text-slate-400 bg-white dark:bg-slate-800 shadow-sm opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all btn-press z-10"
                                aria-label="Radera vårdflöde"
                            >
                                {React.cloneElement(ICONS.trash as React.ReactElement<{ className?: string }>, { className: "w-4 h-4" })}
                            </button>
                        </div>
                    ))}
                </div>

                {canScrollLeft && (
                    <button onClick={() => scroll(-300)} className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10 btn-press">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                )}
                {canScrollRight && (
                     <button onClick={() => scroll(300)} className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10 btn-press">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                )}
            </div>
             <style>{`
                .line-clamp-2 { overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
                .overflow-x-auto::-webkit-scrollbar { display: none; }
             `}</style>
        </div>
    );
});

export const LargeDashboardWidget: React.FC<{
    icon: React.ReactElement<{ className?: string }>;
    label: string;
    description: string;
    onClick: () => void;
    style?: React.CSSProperties;
    className?: string;
    infoText?: string;
    isCompleted?: boolean;
    completedText?: string;
}> = ({ icon, label, description, onClick, style, className, infoText, isCompleted, completedText }) => (
    <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
        className={`card-base p-4 text-left hover:ring-2 hover:ring-red-500 transition-all duration-200 group flex flex-col justify-between h-full min-h-[170px] relative btn-press cursor-pointer ${className}`}
        style={style}
    >
        {infoText && (
            <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
                <InfoTooltip text={infoText} align="right" className="ml-0" />
            </div>
        )}
        <div>
            <div className="p-2 bg-slate-100 dark:bg-slate-700/50 rounded-md text-red-500 dark:text-red-400 w-fit">
                {React.cloneElement(icon, { className: "w-6 h-6" })}
            </div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100 mt-4 text-base">{label}</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{description}</p>
        </div>
        <div className="mt-4 text-right">
            {isCompleted ? (
                 <span className="text-green-500 dark:text-green-400 font-semibold text-sm opacity-100">{completedText || 'Visa Historik'} &rarr;</span>
            ) : (
                 <span className="text-red-500 dark:text-red-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Öppna &rarr;</span>
            )}
        </div>
    </div>
);

// Printable Diploma Component
const Diploma: React.FC<{ user: User; userData: UserData }> = memo(({ user, userData }) => {
    const date = new Date().toLocaleDateString('sv-SE');
    return (
        <div id="printable-diploma" className="bg-white text-black p-12 w-[297mm] h-[210mm] flex flex-col items-center justify-center text-center border-[20px] border-double border-slate-800 relative">
            <div className="absolute top-8 right-8 opacity-20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99z"/></svg>
            </div>
            
            <h1 className="text-6xl font-serif font-bold mb-4 tracking-wider uppercase text-slate-900">KURSINTYG</h1>
            <div className="w-32 h-1 bg-slate-900 mb-8"></div>
            
            <p className="text-xl italic mb-2">Härmed intygas att</p>
            <h2 className="text-4xl font-bold mb-6 text-slate-800">{user.name}</h2>
            
            <p className="text-lg mb-8 max-w-2xl">
                har genomfört sin introduktion på PIVA Avdelning 51 och visat godkänd kompetens inom samtliga obligatoriska moment i CareLearn-plattformen.
            </p>
            
            <div className="grid grid-cols-2 gap-8 mb-12 w-full max-w-3xl text-left">
                <div className="border-t pt-2">
                    <p className="font-bold">Moment:</p>
                    <ul className="list-disc list-inside text-sm mt-1">
                        <li>Introduktionschecklista (100%)</li>
                        <li>AI-Körkort</li>
                        <li>Kunskapstest: Godkänd</li>
                    </ul>
                </div>
                <div className="border-t pt-2">
                    <p className="font-bold">Prestationer:</p>
                    <ul className="list-disc list-inside text-sm mt-1">
                        {(userData.achievements || []).slice(0, 3).map(id => (
                            <li key={id}>{ACHIEVEMENTS[id]?.name || id}</li>
                        ))}
                    </ul>
                </div>
            </div>
            
            <div className="flex justify-between w-full max-w-3xl mt-8">
                <div className="text-center">
                    <div className="w-48 border-b border-black mb-2"></div>
                    <p className="text-sm">Enhetschef</p>
                </div>
                <div className="text-center">
                    <p className="mb-2 font-bold">{date}</p>
                    <p className="text-sm">Datum</p>
                </div>
            </div>
        </div>
    );
});

// Component: ReferralCard
const ReferralCard: React.FC<{ type: 'student' | 'supervisor', onDismiss: () => void }> = memo(({ type, onDismiss }) => {
    return (
        <div className="card-base p-6 bg-gradient-to-r from-pink-500/10 to-rose-500/10 border-pink-500/20 relative">
            <button onClick={onDismiss} className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                &times;
            </button>
            <div className="flex gap-4">
                <div className="p-3 bg-pink-100 dark:bg-pink-900/30 rounded-full h-fit text-pink-600 dark:text-pink-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1">
                        {type === 'student' ? 'Tipsa en kompis!' : 'Tipsa en kollega!'}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Gillar du CareLearn? Hjälp oss sprida verktyget till fler inom vården. Det är helt gratis under beta-perioden.
                    </p>
                    <button 
                        onClick={() => {
                            if (navigator.share) {
                                navigator.share({
                                    title: 'CareLearn Connect',
                                    text: 'Kolla in det här verktyget för APL och introduktion inom vården!',
                                    url: window.location.href
                                });
                            } else {
                                alert("Länk kopierad till urklipp!");
                                navigator.clipboard.writeText(window.location.href);
                            }
                        }}
                        className="text-sm font-bold text-pink-600 dark:text-pink-400 hover:underline"
                    >
                        Dela Länk &rarr;
                    </button>
                </div>
            </div>
        </div>
    );
});

const Dashboard: React.FC<DashboardProps> = memo(({ user, userData, setView, onUpdateUserData, allStudentData, onUpdateStudentData, onSelectStudent, onAskAI, timeLeft, onSelectCareFlow, selectedCareFlow, onDeleteCareFlowRequest, careFlowToDelete, onConfirmDeleteCareFlow, onCloseModals, departmentSettings, onUpdateDepartmentSettings, onCreateUser, onDeleteUser, onClinicalChallengeComplete, schedule }) => {
    const isStudent = !isStaffRole(user.role);
    const isSupervisor = user.role.startsWith('handledare') || user.role === 'overlakare';
    const isAdmin = user.role === 'admin';
    const isHuvudhandledare = user.role === 'huvudhandledare';

    const checklistCompleted = Object.values(userData.checklistProgress).filter(Boolean).length;
    const checklistTotal = departmentSettings?.checklist?.split('\n').length || APP_DATA.checklist.length;
    const checklistPercentage = checklistTotal > 0 ? Math.round((checklistCompleted / checklistTotal) * 100) : 0;

    const logbookEntriesCount = userData.logbookEntries.length;
    const goalsRatedCount = Object.values(userData.goalsProgress).filter((g: any) => g.rating > 0).length;
    const knowledgeTestScore = userData.knowledgeTestHistory.length > 0 ? userData.knowledgeTestHistory[userData.knowledgeTestHistory.length - 1].score : 0;
    
    // Check if simulator limit reached
    const todayStr = toYYYYMMDD(new Date());
    const isSimLimitReached = (userData.dailySimulatorUsage?.date === todayStr && userData.dailySimulatorUsage.count >= (departmentSettings?.clinicalSimulatorDailyLimit || 1));

    const [showReferral, setShowReferral] = useState(true);
    const [showSimulator, setShowSimulator] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    // --- FUN Sharing Logic ---
    const triggerConfetti = () => {
        setShowConfetti(true);
        playSuccess();
        playLevelUp();
        setTimeout(() => setShowConfetti(false), 4000);
    };

    const handleShareAchievement = async (achievement: any) => {
        if (!user.workplace) {
            alert("Du måste tillhöra en arbetsplats för att dela framsteg.");
            return;
        }
        
        triggerConfetti();
        
        const content = `🏆 **Jag har just erövrat utmärkelsen "${achievement.name}"!**\n\n${achievement.description}\n\nKänns riktigt bra att nå detta mål. Heja mig! 🎉`;
        
        const newPost: Post = {
            id: `share-${Date.now()}`,
            authorId: user.id,
            authorName: user.name,
            authorRole: user.role,
            workplace: user.workplace,
            workplaceId: user.workplaceId || '',
            content: content,
            category: 'progress',
            timestamp: new Date().toISOString(),
            likes: 0,
            comments: []
        };
        
        await storage.savePost(newPost);
        
        // Dispatch event for toast
        const event = new CustomEvent('piva-notification', { 
            detail: { 
                userId: user.id, 
                notification: { id: `share-toast-${Date.now()}`, text: 'Din utmärkelse har delats i Community!', type: 'success' } 
            } 
        });
        window.dispatchEvent(event);
    };

    const handleShareProgress = async () => {
        if (!user.workplace) {
            alert("Du måste tillhöra en arbetsplats för att dela framsteg.");
            return;
        }

        const xp = userData.xp || 0;
        const level = Math.floor(xp / 1000) + 1;
        const badges = userData.achievements?.length || 0;
        
        if (xp === 0) {
            alert("Samla lite XP först innan du delar!");
            return;
        }

        triggerConfetti();

        const content = `🚀 **Statusuppdatering:**\n\nJag har nu nått **Level ${level}** (${xp} XP) och samlat **${badges} utmärkelser**! \n\nKämpar på och lär mig massor varje dag. 💪`;

        const newPost: Post = {
            id: `share-level-${Date.now()}`,
            authorId: user.id,
            authorName: user.name,
            authorRole: user.role,
            workplace: user.workplace,
            workplaceId: user.workplaceId || '',
            content: content,
            category: 'progress',
            timestamp: new Date().toISOString(),
            likes: 0,
            comments: []
        };

        await storage.savePost(newPost);
        
        const event = new CustomEvent('piva-notification', { 
            detail: { 
                userId: user.id, 
                notification: { id: `share-lvl-toast-${Date.now()}`, text: 'Dina framsteg har delats till kollegorna!', type: 'success' } 
            } 
        });
        window.dispatchEvent(event);
    };

    return (
        <div className="space-y-6 pb-20 md:pb-0 relative">
            
            {showConfetti && (
                <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
                    <div className="absolute w-full h-full animate-confetti-fall bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCI+CjxyZWN0IHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2ZmNCIgLz4KPC9zdmc+')] opacity-50"></div>
                    <div className="text-6xl animate-bounce">🎉</div>
                </div>
            )}

            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                        Välkommen, {user.name.split(' ')[0]}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        {getRoleDisplayName(user.role)} • {user.workplace || (departmentSettings?.workplaceName || 'Avdelningen')}
                    </p>
                </div>
                <div className="flex gap-2">
                    {isStudent && (
                        <button onClick={handleShareProgress} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-purple-500/30 flex items-center gap-2 transform hover:scale-105 active:scale-95 btn-press">
                            📣 Fira i Nätverket
                        </button>
                    )}
                </div>
            </header>

            {/* Referral / Promo */}
            {showReferral && (isStudent || isSupervisor) && (
                <div className="animate-fade-in-up">
                    <ReferralCard type={isStudent ? 'student' : 'supervisor'} onDismiss={() => setShowReferral(false)} />
                </div>
            )}

            {/* Top Widget Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                
                {/* 1. Daily Focus / Insights */}
                <div className="md:col-span-2 xl:col-span-2 animate-fade-in stagger-item" style={{ '--stagger-delay': '100ms' } as React.CSSProperties}>
                    {isStudent ? (
                        <DailyTipWidget user={user} userData={userData} onUpdateUserData={onUpdateUserData} onNavigate={setView} />
                    ) : (
                        <SupervisorFocusWidget user={user} allStudentData={allStudentData || []} onNavigate={setView} />
                    )}
                </div>

                {/* 2. XP / Stats / Timer */}
                <div className="animate-fade-in stagger-item" style={{ '--stagger-delay': '200ms' } as React.CSSProperties}>
                    {isStudent ? (
                        <XPLevelWidget xp={userData.xp || 0} />
                    ) : (
                        <div className="card-base p-6 h-full flex flex-col justify-center items-center bg-slate-900 border border-slate-700">
                            <p className="text-slate-400 uppercase text-xs font-bold mb-2">DIN AKTIVITET</p>
                            <p className="text-4xl font-bold text-white mb-1">Active</p>
                            <p className="text-green-400 text-sm">Online</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Navigation Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {isStudent && (
                    <>
                        <DashboardWidget
                            icon={ICONS.checklist}
                            label="Checklista"
                            value={`${checklistCompleted}/${checklistTotal} klara`}
                            percentage={checklistPercentage}
                            onClick={() => setView('checklist')}
                            className="stagger-item"
                            style={{ animationDelay: '300ms' }}
                        />
                        <DashboardWidget
                            icon={ICONS.logbook}
                            label="Loggbok"
                            value={`${logbookEntriesCount} inlägg`}
                            percentage={-1}
                            onClick={() => setView('logbook')}
                            className="stagger-item"
                            style={{ animationDelay: '400ms' }}
                        />
                        <DashboardWidget
                            icon={ICONS.goals}
                            label="Lärandemål"
                            value={`${goalsRatedCount} skattade`}
                            percentage={-1}
                            onClick={() => setView('goals')}
                            className="stagger-item"
                            style={{ animationDelay: '500ms' }}
                        />
                        <DashboardWidget
                            icon={ICONS.knowledgeTest}
                            label="Kunskapstest"
                            value={knowledgeTestScore > 0 ? `Senast: ${knowledgeTestScore}p` : "Ej gjort"}
                            percentage={-1}
                            onClick={() => setView('knowledge-test')}
                            className="stagger-item"
                            style={{ animationDelay: '600ms' }}
                        />
                        <LargeDashboardWidget
                            icon={ICONS.mic}
                            label="Kommunikationslabb"
                            description="Träna på svåra samtal med AI-patienter."
                            onClick={() => setView('communication-lab')}
                            className="md:col-span-2 stagger-item"
                            style={{ animationDelay: '700ms' }}
                            infoText="Simulera verkliga situationer och få feedback på ditt bemötande."
                        />
                        <LargeDashboardWidget
                            icon={ICONS.modules}
                            label="Resurser & Rutiner"
                            description="Avdelningens samlade kunskapsbank."
                            onClick={() => setView('modules')}
                            className="md:col-span-2 stagger-item"
                            style={{ animationDelay: '800ms' }}
                        />
                    </>
                )}

                {(isSupervisor || isHuvudhandledare) && (
                    <>
                        <DashboardWidget
                            icon={ICONS.supervisor}
                            label="Elev-översikt"
                            value={`${allStudentData?.length || 0} studenter`}
                            percentage={-1}
                            onClick={() => setView('progress')}
                            className="stagger-item"
                        />
                        <DashboardWidget
                            icon={ICONS.resources}
                            label="Pedagogik"
                            value="Tips & Verktyg"
                            percentage={-1}
                            onClick={() => setView('resources')}
                            className="stagger-item"
                        />
                        <DashboardWidget
                            icon={ICONS.users}
                            label="Community"
                            value="Nätverk"
                            percentage={-1}
                            onClick={() => setView('community')}
                            className="stagger-item"
                        />
                        <DashboardWidget
                            icon={ICONS.settings}
                            label="Inställningar"
                            value="Hantera"
                            percentage={-1}
                            onClick={() => setView('department-settings')} // Supervisor/Head uses this? Usually admin. Let's redirect to general settings or remove.
                            // Actually, supervisors might want to see settings but maybe not edit all.
                            // Redirecting to 'settings' (profile) for now
                            // Or if they are admin role
                            className="stagger-item"
                        />
                         <div className="md:col-span-2 xl:col-span-4 mt-6">
                            <DailyAttendanceManager studentData={allStudentData || []} onUpdateStudentData={onUpdateStudentData!} onSelectStudent={onSelectStudent!} />
                        </div>
                    </>
                )}

                {isAdmin && (
                    <>
                        <DashboardWidget
                            icon={ICONS.chartPie}
                            label="Dataanalys"
                            value="Statistik"
                            percentage={-1}
                            onClick={() => setView('analytics')}
                        />
                        <DashboardWidget
                            icon={ICONS.settings}
                            label="Inställningar"
                            value="Konfigurera"
                            percentage={-1}
                            onClick={() => setView('department-settings')}
                        />
                         <DashboardWidget
                            icon={ICONS.users}
                            label="Användare"
                            value="Hantera"
                            percentage={-1}
                            onClick={() => setView('admin-dashboard')}
                        />
                    </>
                )}
            </div>

            {/* Schedule & Extra Tools */}
            {isStudent && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div className="h-full">
                        <ScheduleWidget schedule={schedule} />
                    </div>
                    <div className="grid grid-rows-2 gap-6">
                        {/* Clinical Simulator Access */}
                        <div 
                            onClick={() => setShowSimulator(true)}
                            className="card-base p-6 bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border-purple-500/30 hover:border-purple-500 transition-all cursor-pointer group relative overflow-hidden"
                        >
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">Dagens Kliniska Utmaning</h3>
                            <p className="text-slate-300 text-sm mb-4 pr-12">
                                Ett unikt patientfall genererat av AI för att testa din bedömningsförmåga.
                            </p>
                            <span className="inline-block bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full group-hover:bg-purple-500 transition-colors">
                                {isSimLimitReached ? 'Genomförd ✅' : 'Starta Simulering ▶'}
                            </span>
                        </div>

                        {/* Community Access */}
                        <div 
                            onClick={() => setView('community')}
                            className="card-base p-6 bg-slate-800 border-slate-700 hover:border-slate-500 transition-all cursor-pointer group"
                        >
                            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                {ICONS.users} Community
                            </h3>
                            <p className="text-slate-400 text-sm">
                                Se vad dina kollegor pratar om och dela dina erfarenheter.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Saved Flows */}
            {(userData.savedCareFlows || []).length > 0 && (
                <div className="mt-6 animate-fade-in">
                    <SavedCareFlowsCard 
                        flows={userData.savedCareFlows || []} 
                        onFlowClick={onSelectCareFlow!} 
                        onFlowDelete={onDeleteCareFlowRequest!} 
                    />
                </div>
            )}

            {/* Achievements */}
            {isStudent && (
                <div className="mt-6 animate-fade-in">
                    <AchievementsCard userData={userData} onShareAchievement={handleShareAchievement} />
                </div>
            )}

            {/* Student Timer (Only visible if limit enabled and > 0, usually hidden now based on design preference) */}
            {isStudent && timeLeft !== undefined && timeLeft > 0 && false && (
                <div className="mt-6">
                    <FieldTimer timeLeft={timeLeft} />
                </div>
            )}

            {showSimulator && isStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <ClinicalSimulator 
                        user={user} 
                        userData={userData} 
                        onUpdateUserData={onUpdateUserData} 
                        onClose={() => setShowSimulator(false)}
                        isSimLimitReached={isSimLimitReached}
                        onChallengeComplete={onClinicalChallengeComplete}
                    />
                </div>
            )}

            {selectedCareFlow && (
                <Modal title={selectedCareFlow.query} onClose={onCloseModals!}>
                    <FlowRenderer flow={selectedCareFlow.flow} />
                </Modal>
            )}

            {careFlowToDelete && (
                <Modal title="Radera vårdflöde" onClose={onCloseModals!}>
                    <p>Är du säker på att du vill ta bort "{careFlowToDelete.query}"?</p>
                    <div className="flex justify-end gap-4 mt-6">
                        <button onClick={onCloseModals} className="bg-slate-200 text-slate-800 px-4 py-2 rounded font-bold">Avbryt</button>
                        <button onClick={onConfirmDeleteCareFlow} className="bg-red-500 text-white px-4 py-2 rounded font-bold">Radera</button>
                    </div>
                </Modal>
            )}
            
            {/* Printable Diploma (Hidden) */}
            <div className="absolute -left-[9999px] top-0 no-print">
                <Diploma user={user} userData={userData} />
            </div>
            
            <style>{`
                @keyframes confetti-fall {
                    0% { transform: translateY(-100%); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
                }
                .animate-confetti-fall {
                    animation: confetti-fall 3s linear infinite;
                }
            `}</style>
        </div>
    );
});

export default Dashboard;
