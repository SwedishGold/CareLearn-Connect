
import React, { useState, useEffect, memo, useCallback } from 'react';
import { DepartmentSettings as DepartmentSettingsType, CareSpecialty } from '../types';
import * as storage from '../services/localStorageService';
import { InfoTooltip } from './UI';
import { ICONS, SPECIALTY_DATA } from '../constants';
import { generateWorkplaceContent } from '../services/geminiService';
import { playProcess, playSuccess } from '../services/soundService';

interface DepartmentSettingsProps {
    settings: DepartmentSettingsType | null;
    onUpdateSettings: (newSettings: DepartmentSettingsType) => void;
}

const ListEditor: React.FC<{ 
    items: string[], 
    onChange: (newItems: string[]) => void, 
    title: string 
}> = ({ items, onChange, title }) => {
    const [newItem, setNewItem] = useState('');

    const handleAdd = () => {
        if (newItem.trim()) {
            onChange([...items, newItem.trim()]);
            setNewItem('');
        }
    };

    const handleRemove = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        onChange(newItems);
    };

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">{title}</label>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="Lägg till ny punkt..."
                    className="flex-1 p-2 border border-slate-600 rounded-md bg-slate-900 text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                />
                <button onClick={handleAdd} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-bold">+</button>
            </div>
            <div className="bg-slate-900/50 rounded-md border border-slate-700 max-h-60 overflow-y-auto">
                {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 border-b border-slate-700/50 last:border-0 hover:bg-slate-800/50">
                        <span className="text-sm text-slate-300">{item}</span>
                        <button onClick={() => handleRemove(idx)} className="text-red-400 hover:text-red-200 p-1">
                            {ICONS.cross}
                        </button>
                    </div>
                ))}
                {items.length === 0 && <p className="text-slate-500 text-center p-4 text-sm">Listan är tom.</p>}
            </div>
        </div>
    );
};

const DepartmentSettingsComponent: React.FC<DepartmentSettingsProps> = memo(({ settings: initialSettings, onUpdateSettings }) => {
    const [settings, setSettings] = useState(initialSettings);
    const [saveConfirmation, setSaveConfirmation] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Helper to parse/stringify lists for the legacy storage format - SAFEGUARDED against undefined
    const getChecklistArray = () => (settings?.checklist || '').split('\n').filter(Boolean);
    const getGoalsArray = () => (settings?.knowledgeRequirements || '').split('\n').filter(Boolean);

    useEffect(() => {
        setSettings(initialSettings);
    }, [initialSettings]);

    const handleSave = useCallback(() => {
        if (!settings) return;
        try {
            onUpdateSettings(settings);
            setSaveConfirmation(true);
            setTimeout(() => setSaveConfirmation(false), 3000);
        } catch (error) {
            alert("Ett fel uppstod vid sparning.");
            console.error("Error:", error);
        }
    }, [settings, onUpdateSettings]);
    
    const handleReset = useCallback(() => {
        if (window.confirm("Är du säker på att du vill återställa alla inställningar till standard? Sidan kommer att laddas om.")) {
            storage.clearDepartmentSettings();
            window.location.reload();
        }
    }, []);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (!settings) return;

         if (name === 'dailyTimeLimitMinutes') {
            const seconds = parseInt(value, 10) * 60;
            setSettings(prev => prev ? ({ ...prev, dailyTimeLimitSeconds: isNaN(seconds) ? 0 : seconds }) : null);
        } else if (name === 'specialty') {
            const newSpecialty = value as CareSpecialty;
            setSettings(prev => prev ? ({ ...prev, specialty: newSpecialty }) : null);
        } else {
            setSettings(prev => prev ? ({ ...prev, [name]: type === 'number' ? (parseInt(value, 10) || 0) : value }) : null);
        }
    }, [settings]);

    const handleListChange = (key: 'checklist' | 'knowledgeRequirements', newItems: string[]) => {
        if (!settings) return;
        setSettings({ ...settings, [key]: newItems.join('\n') });
    };

    const handleAutoGenerate = async () => {
        if (!settings?.workplaceName || !settings?.specialty) {
            alert("Ange ett arbetsplatsnamn och välj en inriktning först.");
            return;
        }
        
        if (!window.confirm(`Detta kommer att ersätta din nuvarande checklista och dina lärandemål med ett AI-genererat förslag anpassat för "${settings.workplaceName}". Vill du fortsätta?`)) {
            return;
        }

        setIsGenerating(true);
        playProcess();
        try {
            const content = await generateWorkplaceContent(settings.workplaceName, settings.specialty);
            setSettings(prev => prev ? ({
                ...prev,
                checklist: content.checklist.join('\n'),
                knowledgeRequirements: content.goals.join('\n')
            }) : null);
            playSuccess();
        } catch (e) {
            alert("Kunde inte generera innehåll. Kontrollera din internetanslutning.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleChangeContext = () => {
        if (window.confirm("Vill du byta arbetsplats helt? Detta raderar nuvarande AI-dokument och checklistor för att starta om konfigureringen för en ny plats. Dina personliga användare finns kvar.")) {
            // Clear specific settings but keep users
            storage.clearDepartmentSettings();
            // Optionally clear custom docs to force new AI search
            localStorage.removeItem('carelearn_documents');
            window.location.reload();
        }
    };

    if (!settings) {
        return <div>Laddar inställningar...</div>;
    }

    return (
        <div className="card-base p-8 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Avdelningsinställningar</h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">Konfigurera innehåll och regler för CareLearn på din enhet.</p>
            </div>

            <div className="space-y-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">Arbetsplats & Profil</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="appName" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Applikationens Namn (Visas i sidomenyn)</label>
                        <input type="text" name="appName" id="appName" value={settings.appName} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-900 text-white"/>
                    </div>
                    <div>
                        <label htmlFor="workplaceName" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Arbetsplatsens Namn (t.ex. "Kirurgen Huddinge")</label>
                        <input type="text" name="workplaceName" id="workplaceName" value={settings.workplaceName || ''} onChange={handleChange} placeholder="Ange enhetsnamn..." className="mt-1 block w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-900 text-white"/>
                    </div>
                </div>
                <div className="pt-4 border-t border-slate-700">
                    <button onClick={handleChangeContext} className="text-sm text-red-400 hover:text-red-300 underline">
                        Byt arbetsplats/kontext helt (Rensar rutiner)
                    </button>
                </div>
            </div>

            <div className="space-y-6 p-6 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-700">
                <h2 className="text-xl font-bold text-indigo-800 dark:text-indigo-200 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    Vårdinriktning & Innehåll
                </h2>
                <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-4">
                    Välj vilken typ av vårdinriktning appen ska anpassas för. Du kan låta AI automatiskt skapa en checklista och mål baserat på ditt val och arbetsplatsens namn.
                </p>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label htmlFor="specialty" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Välj Inriktning</label>
                        <select 
                            name="specialty" 
                            id="specialty" 
                            value={settings.specialty || 'psykiatri'} 
                            onChange={handleChange}
                            className="mt-1 block w-full p-3 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-900 text-white focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="psykiatri">Psykiatri</option>
                            <option value="aldreomsorg">Äldreomsorg / SÄBO</option>
                            <option value="akutsjukvard">Somatisk Akutsjukvård</option>
                            <option value="primarvard">Primärvård / Vårdcentral</option>
                            <option value="lss">LSS / Funktionsstöd</option>
                            <option value="annat">Annat</option>
                        </select>
                    </div>
                    <button 
                        onClick={handleAutoGenerate}
                        disabled={isGenerating || !settings.workplaceName}
                        className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                Genererar...
                            </>
                        ) : (
                            <>
                                {ICONS.ai} AI-Anpassa Innehåll
                            </>
                        )}
                    </button>
                </div>
                {!settings.workplaceName && (
                    <p className="text-xs text-red-400 mt-1">* Du måste ange arbetsplatsens namn ovan för att använda AI-funktionen.</p>
                )}
            </div>

            <div className="space-y-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">Redigera Innehåll Manuellt</h2>
                
                <ListEditor 
                    title="Introduktionschecklista (Punkter)" 
                    items={getChecklistArray()} 
                    onChange={(items) => handleListChange('checklist', items)} 
                />

                <ListEditor 
                    title="Lärandemål (Kursmål)" 
                    items={getGoalsArray()} 
                    onChange={(items) => handleListChange('knowledgeRequirements', items)} 
                />
            </div>

            <div className="space-y-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">Användningsbegränsningar</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="dailyTimeLimitMinutes" className="flex items-center text-sm font-medium text-gray-700 dark:text-slate-300">Daglig Fokustid (minuter) <InfoTooltip text="Maximal tid (i minuter) en student/vikarie kan vara aktiv i appen per dag."/></label>
                        <input type="number" name="dailyTimeLimitMinutes" id="dailyTimeLimitMinutes" value={Math.round(settings.dailyTimeLimitSeconds / 60)} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-900 text-white"/>
                    </div>
                    <div>
                        <label htmlFor="monthlyActiveDaysLimit" className="flex items-center text-sm font-medium text-gray-700 dark:text-slate-300">Aktiva Dagar per Månad <InfoTooltip text="Maximalt antal dagar en student/vikarie kan logga in och använda appen under en kalendermånad."/></label>
                        <input type="number" name="monthlyActiveDaysLimit" id="monthlyActiveDaysLimit" value={settings.monthlyActiveDaysLimit} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-900 text-white"/>
                    </div>
                    <div>
                        <label htmlFor="communicationLabDailyLimit" className="flex items-center text-sm font-medium text-gray-700 dark:text-slate-300">Kommunikationslabb (per dag) <InfoTooltip text="Maximalt antal scenarier en användare kan genomföra i kommunikationslabbet per dag."/></label>
                        <input type="number" name="communicationLabDailyLimit" id="communicationLabDailyLimit" value={settings.communicationLabDailyLimit} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-900 text-white"/>
                    </div>
                     <div>
                        <label htmlFor="communicationLabMonthlyLimit" className="flex items-center text-sm font-medium text-gray-700 dark:text-slate-300">Kommunikationslabb (per månad) <InfoTooltip text="Maximalt antal scenarier en användare kan genomföra i kommunikationslabbet per månad."/></label>
                        <input type="number" name="communicationLabMonthlyLimit" id="communicationLabMonthlyLimit" value={settings.communicationLabMonthlyLimit} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-900 text-white"/>
                    </div>
                    <div>
                        <label htmlFor="clinicalSimulatorDailyLimit" className="flex items-center text-sm font-medium text-gray-700 dark:text-slate-300">Klinisk Simulator (per dag) <InfoTooltip text="Maximalt antal simuleringar en användare kan starta per dag för att spara API-kostnader."/></label>
                        <input type="number" name="clinicalSimulatorDailyLimit" id="clinicalSimulatorDailyLimit" value={settings.clinicalSimulatorDailyLimit} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-slate-900 text-white"/>
                    </div>
                </div>
            </div>
            
            <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button onClick={handleReset} className="bg-slate-200 text-slate-800 font-bold py-2 px-6 rounded-lg hover:bg-slate-300 transition-colors duration-200 btn-press">
                    Återställ Standard
                </button>
                <button onClick={handleSave} className="bg-red-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-600 transition-colors duration-200 btn-press">
                    {saveConfirmation ? 'Sparat!' : 'Spara Inställningar'}
                </button>
            </div>
        </div>
    );
});

export default DepartmentSettingsComponent;
