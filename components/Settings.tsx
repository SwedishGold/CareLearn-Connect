
import React, { useState, useEffect, memo } from 'react';
import { User, Role } from '../types';
import * as storage from '../services/localStorageService';
import { ICONS, ROLE_ICONS } from '../constants';
import { playSuccess, playClick, playDelete } from '../services/soundService';
import { getRoleDisplayName } from './UI';

interface SettingsProps {
    user: User;
    onUpdateTheme: (isDark: boolean) => void;
    onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = memo(({ user, onUpdateTheme, onLogout }) => {
    const [name, setName] = useState(user.name);
    const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
    const [stats, setStats] = useState({ points: 0, level: 1 });
    const [supervisorName, setSupervisorName] = useState<string | null>(null);

    useEffect(() => {
        setIsDark(document.documentElement.classList.contains('dark'));
        
        const fetchStats = async () => {
            const userData = await storage.loadUserData(user.id);
            const points = (userData?.achievements?.length || 0) * 100 + (userData?.logbookEntries?.length || 0) * 10;
            const level = Math.floor(points / 500) + 1;
            setStats({ points, level });
        };
        fetchStats();

        const fetchSupervisor = async () => {
            if (user.supervisorId) {
                const sv = await storage.getUser(user.supervisorId);
                if (sv) setSupervisorName(sv.name);
            }
        };
        fetchSupervisor();
    }, [user.id, user.supervisorId]);

    const handleThemeToggle = () => {
        try {
            playClick();
        } catch (e) {
            console.warn("Sound play failed", e);
        }
        
        try {
            const newMode = !isDark;
            setIsDark(newMode);
            onUpdateTheme(newMode);
        } catch (e) {
            console.error("Theme toggle failed", e);
            alert("Kunde inte byta tema just nu. Försök igen.");
        }
    };

    const handleSaveProfile = async () => {
        const users = await storage.loadUsers();
        const target = users.find(u => u.id === user.id);
        
        if (target) {
            let updated = false;
            if (name !== user.name) {
                target.name = name;
                updated = true;
            }
            
            if (updated) {
                await storage.saveUsers(users);
                playSuccess();
                alert("Profil uppdaterad!");
                window.location.reload();
            } else {
                playSuccess();
                alert("Inga ändringar att spara.");
            }
        }
    };

    const handleClearData = async () => {
        if (confirm("VARNING: Detta raderar all din data på denna enhet. Är du säker?")) {
            playDelete();
            await storage.deleteUser(user.id);
            onLogout();
        }
    };

    const handleDonate = () => {
        playSuccess();
        // Replace this URL with your actual Swish number info page, Ko-fi, or Patreon link
        const donationUrl = "https://www.buymeacoffee.com/"; 
        window.open(donationUrl, '_blank');
    };

    // Safe access to role icon
    const RoleIcon = ROLE_ICONS[user.role] || ICONS.userCircle;

    return (
        <div className="card-base p-6 max-w-2xl mx-auto space-y-8 animate-fade-in">
            <header className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
                <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-4xl shadow-inner text-slate-700 dark:text-slate-200">
                    {RoleIcon}
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{user.name}</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">{getRoleDisplayName(user.role)}</p>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full border border-yellow-200">
                            Level {stats.level}
                        </span>
                        <span className="text-xs text-slate-400">{stats.points} XP</span>
                    </div>
                </div>
            </header>

            <section className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                    Profil
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Visningsnamn</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Arbetsplats</label>
                        <input 
                            type="text" 
                            value={user.workplace || 'Ej angiven'} 
                            disabled 
                            className="w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                        />
                    </div>
                    {supervisorName && (
                        <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Min Handledare</label>
                            <input 
                                type="text" 
                                value={supervisorName} 
                                disabled 
                                className="w-full p-2 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 font-bold cursor-not-allowed"
                            />
                        </div>
                    )}
                </div>
            </section>

            <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                    Utseende
                </h2>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">Tema</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{isDark ? 'Mörkt läge (Retro Tech)' : 'Ljust läge (Clean Care)'}</p>
                    </div>
                    <button 
                        onClick={handleThemeToggle}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDark ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </section>

            <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="text-yellow-500">⭐</span> Prenumeration & Stöd
                </h2>
                <div className="bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 p-6 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm text-purple-600 dark:text-purple-400 text-2xl">
                            🚀
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">CareLearn Pro</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 mb-4">
                                Genom att stötta projektet hjälper du oss att hålla servrarna igång och utveckla fler funktioner.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button 
                                    onClick={handleDonate}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md btn-press flex items-center justify-center gap-2"
                                >
                                    <span>💖</span> Donera / Swisha
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <button 
                    onClick={handleClearData}
                    className="text-red-500 hover:text-red-700 font-semibold text-sm transition-colors"
                >
                    Radera konto & data
                </button>
                <button 
                    onClick={handleSaveProfile}
                    className="bg-red-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-600 transition-colors shadow-lg btn-press"
                >
                    Spara ändringar
                </button>
            </div>
        </div>
    );
});

export default Settings;
