
import React, { useState, useEffect, memo, useCallback } from 'react';
import { View } from '../types';
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
    const [registrationConfig, setRegistrationConfig] = useState<Awaited<ReturnType<typeof storage.getRegistrationConfig>> | null>(null);
    const [isSavingRegistration, setIsSavingRegistration] = useState(false);
    const [unlockWorkplaceName, setUnlockWorkplaceName] = useState('');
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminWorkplace, setAdminWorkplace] = useState('');
    const [adminTempPassword, setAdminTempPassword] = useState('');
    const [adminCreationResult, setAdminCreationResult] = useState<string | null>(null);

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

    useEffect(() => {
        const loadRegistration = async () => {
            try {
                const cfg = await storage.getRegistrationConfig();
                setRegistrationConfig(cfg);
                if (!adminWorkplace && cfg.allowedWorkplaces?.length) {
                    setAdminWorkplace(cfg.allowedWorkplaces[0]);
                }
            } catch (e) {
                console.warn("Could not load registration config", e);
            }
        };
        loadRegistration();
    }, [adminWorkplace]);

    const saveRegistrationConfig = useCallback(async (cfg: NonNullable<typeof registrationConfig>) => {
        setIsSavingRegistration(true);
        try {
            await storage.updateRegistrationConfig(cfg);
            setRegistrationConfig(cfg);
        } finally {
            setIsSavingRegistration(false);
        }
    }, [registrationConfig]);

    const handleUnlockWorkplace = useCallback(async () => {
        const name = (unlockWorkplaceName || '').trim();
        if (!name) return;
        if (!registrationConfig) return;

        const already = (registrationConfig.allowedWorkplaces || []).includes(name);
        if (already) {
            alert("Avdelningen finns redan upplåst för registrering.");
            return;
        }

        // Krav: rutiner/PM ska vara uppladdade i kunskapsbanken innan man låser upp registrering.
        const allDocs = await storage.getCustomDocuments();
        const hasWorkplaceDocs = allDocs.some(d => (d.workplace || '').trim() === name);
        if (!hasWorkplaceDocs) {
            alert(`Kan inte låsa upp "${name}" ännu.\n\nLadda först upp minst ett dokument (rutin/PM) i kunskapsbanken som är kopplat till den avdelningen.`);
            return;
        }

        const next = {
            ...registrationConfig,
            allowedWorkplaces: [...(registrationConfig.allowedWorkplaces || []), name]
        };
        await saveRegistrationConfig(next);
        setUnlockWorkplaceName('');
        alert(`Upplåst: ${name}`);
    }, [unlockWorkplaceName, registrationConfig, saveRegistrationConfig]);

    const handleRemoveWorkplace = useCallback(async (name: string) => {
        if (!registrationConfig) return;
        const nextAllowed = (registrationConfig.allowedWorkplaces || []).filter(w => w !== name);
        const next = { ...registrationConfig, allowedWorkplaces: nextAllowed };
        await saveRegistrationConfig(next);
        if (adminWorkplace === name) {
            setAdminWorkplace(nextAllowed[0] || '');
        }
    }, [registrationConfig, saveRegistrationConfig, adminWorkplace]);

    const generateTempPassword = () => {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
        let out = '';
        for (let i = 0; i < 12; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
        setAdminTempPassword(out);
    };

    const handleCreateAdmin = useCallback(async () => {
        if (!registrationConfig) return;
        const name = adminName.trim();
        const email = adminEmail.trim();
        const workplace = adminWorkplace.trim();
        const password = adminTempPassword.trim();

        if (!name || !email || !workplace || !password) {
            alert("Fyll i namn, e-post, avdelning och ett temporärt lösenord.");
            return;
        }

        try {
            const user = await storage.createPrivilegedAccount({
                name,
                email,
                temporaryPassword: password,
                role: 'admin',
                workplace
            });
            setAdminCreationResult(`Skapade Admin/Chef-konto för ${user.workplace}. Temporärt lösenord: ${password}`);
            setAdminName('');
            setAdminEmail('');
            setAdminTempPassword('');
        } catch (e: any) {
            alert(`Kunde inte skapa Admin/Chef-konto: ${e?.message || 'Okänt fel'}`);
        }
    }, [registrationConfig, adminName, adminEmail, adminWorkplace, adminTempPassword]);

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

            {/* Registration (Beta) Control */}
            <section className="card-base p-6 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        {ICONS.lock} Registrering (Beta) – upplåsning av avdelningar
                    </h3>
                    {isSavingRegistration && <span className="text-xs text-slate-500">Sparar...</span>}
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Endast avdelningar i listan nedan kan väljas vid registrering. Nya avdelningar låses upp först när rutiner/PM är uppladdade i kunskapsbanken.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Upplåsta avdelningar</div>
                        <div className="space-y-2">
                            {(registrationConfig?.allowedWorkplaces || []).length === 0 ? (
                                <div className="text-sm text-slate-500">Inga avdelningar upplåsta.</div>
                            ) : (
                                (registrationConfig?.allowedWorkplaces || []).map(wp => (
                                    <div key={wp} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                                        <span className="font-medium text-slate-800 dark:text-slate-200">{wp}</span>
                                        <button
                                            onClick={() => handleRemoveWorkplace(wp)}
                                            className="text-xs font-semibold text-red-600 hover:text-red-500"
                                        >
                                            Ta bort
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Lås upp ny avdelning</div>
                        <div className="flex gap-2">
                            <input
                                value={unlockWorkplaceName}
                                onChange={(e) => setUnlockWorkplaceName(e.target.value)}
                                placeholder="Ex: Avdelning 12"
                                className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                            />
                            <button
                                onClick={handleUnlockWorkplace}
                                disabled={!unlockWorkplaceName.trim() || isSavingRegistration}
                                className="bg-indigo-600 text-white font-bold px-4 rounded-lg hover:bg-indigo-700 disabled:bg-slate-400"
                            >
                                Lås upp
                            </button>
                        </div>
                        <div className="mt-3 text-xs text-slate-500">
                            Kontakttext som visas för användare: <span className="font-mono">{registrationConfig?.developerContactEmail}</span> /{' '}
                            <span className="font-mono">LinkedIn</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Admin/Chef provisioning */}
            <section className="card-base p-6 border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
                    {ICONS.admin} Skapa Chef/Admin-konto (max 1 per avdelning)
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Chef/Admin-konton ska inte egenregistreras. Skapa här när berörd person kontaktat dig via mail/LinkedIn.
                </p>

                {adminCreationResult && (
                    <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 text-sm">
                        {adminCreationResult}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        placeholder="Namn"
                        className="p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                    <input
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="E-post"
                        className="p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                    <select
                        value={adminWorkplace}
                        onChange={(e) => setAdminWorkplace(e.target.value)}
                        className="p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    >
                        {(registrationConfig?.allowedWorkplaces || ['Avdelning 51', 'Avdelning 7']).map(wp => (
                            <option key={wp} value={wp}>{wp}</option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                        <input
                            value={adminTempPassword}
                            onChange={(e) => setAdminTempPassword(e.target.value)}
                            placeholder="Temporärt lösenord"
                            className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                        />
                        <button
                            type="button"
                            onClick={generateTempPassword}
                            className="px-3 rounded-lg bg-slate-700 text-white font-bold hover:bg-slate-600"
                        >
                            Generera
                        </button>
                    </div>
                </div>
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={handleCreateAdmin}
                        className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700"
                    >
                        Skapa konto
                    </button>
                </div>
            </section>

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
