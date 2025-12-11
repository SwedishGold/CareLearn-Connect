
import React, { useState, useEffect, memo, useCallback } from 'react';
import { View, DepartmentSettings, FeedbackEntry, FeedbackAnalysis } from '../types';
import { ICONS } from '../constants';
import { getRoleDisplayName, Modal } from './UI';
import { DashboardWidget } from './Dashboard'; // Import from Dashboard as now exported
import * as storage from '../services/localStorageService';
import { getDeveloperStrategicAdvice } from '../services/geminiService';
import { playProcess } from '../services/soundService';

interface DeveloperDashboardProps {
    setView: (view: View) => void;
}

// NEW: Developer Focus Widget (Smart AI)
const DeveloperFocusWidget: React.FC = memo(() => {
    const [advice, setAdvice] = useState<string>('Analyserar systemdata...');
    const [loading, setLoading] = useState(false);

    const fetchAdvice = useCallback(async () => {
        setLoading(true);
        playProcess();
        try {
            // Check cache
            const cached = sessionStorage.getItem('dev_advice_cache');
            if (cached) {
                setAdvice(cached);
                setLoading(false);
                return;
            }

            const result = await getDeveloperStrategicAdvice();
            setAdvice(result);
            sessionStorage.setItem('dev_advice_cache', result);
        } catch (e) {
            setAdvice("Systemanalys ej tillgänglig.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAdvice();
    }, [fetchAdvice]);

    return (
        <div className="card-base p-6 mb-6 border-l-4 border-indigo-500 bg-gradient-to-br from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 relative overflow-hidden transition-all duration-500">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide text-xs flex items-center gap-2">
                    {ICONS.ai} SYSTEM-INTELLIGENS
                </h3>
                <button onClick={fetchAdvice} className="text-xs text-indigo-500 hover:underline">
                    Uppdatera
                </button>
            </div>

            {/* Content */}
            <div className="flex gap-4 items-start relative z-10">
                <div className="p-3 rounded-full h-fit flex-shrink-0 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    {ICONS.server}
                </div>
                
                <div className="flex-1">
                    {loading ? (
                        <div className="space-y-2">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 animate-pulse"></div>
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 animate-pulse"></div>
                        </div>
                    ) : (
                        <div className="prose prose-sm max-w-none text-slate-800 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: advice.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    )}
                </div>
            </div>
        </div>
    );
});

const DeveloperDashboard: React.FC<DeveloperDashboardProps> = memo(({ setView }) => {
    const [stats, setStats] = useState({ users: 0, docs: 0, feedback: 0 });

    useEffect(() => {
        const loadData = async () => {
            const users = await storage.loadUsers();
            const docs = await storage.getCustomDocuments();
            const feedback = await storage.loadFeedback();
            setStats({
                users: users.length,
                docs: docs.length,
                feedback: feedback.length
            });
        };
        loadData();
    }, []);

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center">
                        Utvecklarpanel
                        <span className="ml-3 text-sm bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-medium border border-indigo-200">
                            {getRoleDisplayName('developer')}
                        </span>
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Centralstyrning och systemövervakning.</p>
                </div>
            </header>

            {/* Smart Focus Widget */}
            <DeveloperFocusWidget />

            {/* Main Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <DashboardWidget
                    icon={ICONS.users}
                    label="Användarbas"
                    value={`${stats.users} st`}
                    percentage={-1}
                    color="blue"
                    onClick={() => setView('admin-dashboard')}
                    className="stagger-item"
                    style={{ animationDelay: '0ms' }}
                />
                <DashboardWidget
                    icon={ICONS.fileManagement}
                    label="Kunskapsbank"
                    value={`${stats.docs} st`}
                    percentage={-1}
                    color="green"
                    onClick={() => setView('file-management')}
                    className="stagger-item"
                    style={{ animationDelay: '100ms' }}
                />
                <DashboardWidget
                    icon={ICONS.feedbackViewer}
                    label="Feedback"
                    value={`${stats.feedback} st`}
                    percentage={-1}
                    color="purple"
                    onClick={() => setView('feedback-viewer')}
                    className="stagger-item"
                    style={{ animationDelay: '200ms' }}
                />
                <DashboardWidget
                    icon={ICONS.settings}
                    label="Konfigurering"
                    value="Inställningar"
                    percentage={-1}
                    color="red"
                    onClick={() => setView('department-settings')} // Or specific dev settings
                    className="stagger-item"
                    style={{ animationDelay: '300ms' }}
                />
            </div>

            {/* Deep Dive Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div 
                    onClick={() => setView('analytics')}
                    className="card-base p-6 hover:border-indigo-400 cursor-pointer transition-colors group"
                >
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            {ICONS.chartPie} Systemanalys
                        </h3>
                        <span className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">Öppna &rarr;</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                        Djupgående analys av användarbeteende, prestanda och pedagogiska utfall över alla noder.
                    </p>
                </div>

                <div 
                    onClick={() => setView('community')}
                    className="card-base p-6 hover:border-indigo-400 cursor-pointer transition-colors group"
                >
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            {ICONS.server} Live-övervakning
                        </h3>
                        <span className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">Öppna &rarr;</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                        Övervaka realtidsaktivitet i "Connect"-flödet och hantera globala meddelanden.
                    </p>
                </div>
            </div>
        </div>
    );
});

export default DeveloperDashboard;
