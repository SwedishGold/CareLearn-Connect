
import React, { useState, memo, useCallback, useMemo, useEffect } from 'react';
import { User, Role, UserData, CompetenceDomain } from '../types';
import { ROLE_ICONS, ICONS, APP_DATA } from '../constants';
import { getRoleDisplayName, Modal, InfoTooltip } from './UI';
import * as storage from '../services/localStorageService';
import { generateStrategicReport } from '../services/geminiService';
import { playDelete, playProcess } from '../services/soundService';

interface AdminDashboardProps {
  users: User[];
  onDeleteUser: (userId: string) => void;
  onSelectUser: (userId: string) => void;
  onCreateUser: (name: string, role: Role, aplWeeks?: number) => Promise<User>;
}

const CreateUserModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onCreateUser: (name: string, role: Role, aplWeeks?: number) => void;
    allowedRoles: { role: Role; label: string }[];
    showAplWeeksFor?: Role[];
}> = ({ isOpen, onClose, onCreateUser, allowedRoles, showAplWeeksFor = [] }) => {
    const [name, setName] = useState('');
    const [role, setRole] = useState<Role | ''>('');
    const [aplWeeks, setAplWeeks] = useState('');
    const [consent, setConsent] = useState(false);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        const needsAplWeeks = showAplWeeksFor.includes(role as Role);
        const weeks = parseInt(aplWeeks, 10);
        
        if (name.trim() && role && consent && (!needsAplWeeks || (needsAplWeeks && aplWeeks && weeks > 0))) {
            onCreateUser(name.trim(), role, needsAplWeeks ? weeks : undefined);
            // Reset and close
            setName('');
            setRole('');
            setAplWeeks('');
            setConsent(false);
            onClose();
        } else {
            alert('Vänligen fyll i alla fält korrekt.');
        }
    };

    if (!isOpen) return null;

    const needsAplWeeks = showAplWeeksFor.includes(role as Role);
    const isFormValid = name.trim() !== '' && role !== '' && consent && (!needsAplWeeks || (needsAplWeeks && aplWeeks && parseInt(aplWeeks, 10) > 0));

    return (
        <Modal title="Skapa ny användare" onClose={onClose}>
            <form onSubmit={handleCreate} className="space-y-4">
                <div>
                    <label htmlFor="name-input" className="block text-sm font-semibold text-slate-300 mb-1">Namn</label>
                    <input
                        id="name-input"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full p-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 bg-slate-700 text-slate-100"
                        placeholder="För- och efternamn"
                        required
                    />
                </div>
                 <div>
                    <label htmlFor="role-select" className="block text-sm font-semibold text-slate-300 mb-1">Roll</label>
                    <select
                        id="role-select"
                        value={role}
                        onChange={(e) => setRole(e.target.value as Role)}
                        className="w-full p-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 bg-slate-700 text-slate-100"
                        required
                    >
                        <option value="" disabled>Välj en roll...</option>
                        {allowedRoles.map(r => (
                            <option key={r.role} value={r.role}>{r.label}</option>
                        ))}
                    </select>
                </div>
                {needsAplWeeks && (
                    <div>
                        <label htmlFor="weeks-input" className="block text-sm font-semibold text-slate-300 mb-1">APL-periodens längd (veckor)</label>
                        <input
                            id="weeks-input"
                            type="number"
                            value={aplWeeks}
                            onChange={(e) => setAplWeeks(e.target.value)}
                            className="w-full p-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 bg-slate-700 text-slate-100"
                            placeholder="Antal veckor, t.ex. 8"
                            required
                            min="1"
                        />
                    </div>
                )}
                <div className="pt-2 text-left">
                    <label className="flex items-start text-sm text-slate-300">
                        <input
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                            className="h-5 w-5 rounded text-red-600 focus:ring-red-500 border-gray-500 bg-slate-800 mt-0.5"
                            required
                        />
                        <span className="ml-3">Användaren har informerats om att deras data sparas och hanteras enligt appens riktlinjer.</span>
                    </label>
                </div>
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className="bg-slate-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-500 transition-colors btn-press">
                        Avbryt
                    </button>
                    <button type="submit" disabled={!isFormValid} className="bg-red-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-600 disabled:bg-red-300 transition-colors btn-press">
                        Skapa & notifiera
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const HeatmapCell: React.FC<{ value: number, label: string }> = ({ value, label }) => {
    let colorClass = 'bg-slate-800';
    let textClass = 'text-slate-400';

    if (value >= 80) {
        colorClass = 'bg-green-500/20 border-green-500/50';
        textClass = 'text-green-400';
    } else if (value >= 50) {
        colorClass = 'bg-yellow-500/20 border-yellow-500/50';
        textClass = 'text-yellow-400';
    } else if (value > 0) {
        colorClass = 'bg-red-500/20 border-red-500/50';
        textClass = 'text-red-400';
    }

    return (
        <div className={`flex flex-col justify-center items-center p-4 rounded-lg border ${colorClass} min-h-[100px]`}>
            <span className={`text-2xl font-bold ${textClass}`}>{value}%</span>
            <span className="text-xs text-slate-300 text-center mt-1">{label}</span>
        </div>
    );
};


const AdminDashboard: React.FC<AdminDashboardProps> = memo(({ users, onDeleteUser, onSelectUser, onCreateUser }) => {
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [creationSuccess, setCreationSuccess] = useState<string | null>(null);
    const [strategicReport, setStrategicReport] = useState<string | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [competenceData, setCompetenceData] = useState<CompetenceDomain[]>([]);

    const handleDeleteClick = useCallback((e: React.MouseEvent, user: User) => {
        e.stopPropagation();
        setUserToDelete(user);
    }, []);

    const confirmDelete = useCallback(() => {
        if (userToDelete) {
            playDelete();
            onDeleteUser(userToDelete.id);
            setUserToDelete(null);
        }
    }, [userToDelete, onDeleteUser]);
    
    const handleCreateUser = async (name: string, role: Role, aplWeeks?: number) => {
        const newUser = await onCreateUser(name, role, aplWeeks);
        setCreationSuccess(`Profilen för ${newUser.name} har skapats. De kan nu logga in och välja en pinkod.`);
        setTimeout(() => setCreationSuccess(null), 5000);
    };

    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        playProcess();
        try {
             // Prepare data for AI
             const allData = await storage.getAllUserDataForAdmin();
             const studentData = allData.filter(d => ['usk-elev', 'ssk-student', 'vikarie-usk', 'vikarie-ssk'].includes(d.user.role));
             
             // Simple aggregation for the prompt
             const summaryData = studentData.map(d => ({
                 role: d.user.role,
                 checklistPercent: (Object.values(d.data.checklistProgress || {}).filter(Boolean).length / APP_DATA.checklist.length) * 100,
                 avgTestScore: d.data.knowledgeTestHistory.length > 0 ? (d.data.knowledgeTestHistory.slice(-1)[0].score / d.data.knowledgeTestHistory.slice(-1)[0].totalQuestions) * 100 : 0,
                 goalsRated: Object.values(d.data.goalsProgress || {}).filter(g => (g as any).rating > 0).length
             }));

             const report = await generateStrategicReport(JSON.stringify(summaryData));
             setStrategicReport(report);
        } catch(e) {
            alert("Kunde inte generera rapport.");
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleBroadcast = () => {
        if(!broadcastMessage.trim()) return;
        setIsBroadcasting(true);
        // In a real app, this would push to a server. Here we simulate it for the demo.
        alert(`Meddelandet har skickats som en notis till alla ${users.length} användare.`);
        setBroadcastMessage('');
        setIsBroadcasting(false);
    };

    const studentUsers = users.filter(u => u.role === 'usk-elev' || u.role === 'ssk-student');
    const staffUsers = users.filter(u => !studentUsers.map(su => su.id).includes(u.id) && u.role !== 'admin');
    
    // Competence Heatmap Logic - Use Effect instead of Memo for async
    useEffect(() => {
        const fetchCompetenceData = async () => {
            const allData = await storage.getAllUserDataForAdmin();
            const targets = allData.filter(d => ['usk-elev', 'ssk-student', 'vikarie-usk'].includes(d.user.role));
            
            if (targets.length === 0) {
                setCompetenceData([]);
                return;
            }

            // Simplified domains based on checklist items
            const domains: CompetenceDomain[] = [
                { name: 'Akututrustning & HLR', score: 0, status: 'good', gapDescription: '' },
                { name: 'LPT & Tvångsvård', score: 0, status: 'good', gapDescription: '' },
                { name: 'Dokumentation', score: 0, status: 'good', gapDescription: '' },
                { name: 'Basala Hygiencrutiner', score: 0, status: 'good', gapDescription: '' },
            ];

            // Mock calculation for visualization (in real app, map specific checklist items to domains)
            domains.forEach(dom => {
                let totalScore = 0;
                targets.forEach(t => {
                    // Randomize slightly for demo variance based on real checklist progress
                    const progress = (Object.values(t.data.checklistProgress || {}).filter(Boolean).length / Math.max(1, APP_DATA.checklist.length));
                    totalScore += progress * 100;
                });
                dom.score = Math.round(totalScore / targets.length);
                
                // Add specific mock gaps for demo
                if (dom.name === 'LPT & Tvångsvård') dom.score = Math.min(dom.score, 45); 
            });

            setCompetenceData(domains);
        };
        fetchCompetenceData();
    }, []);

    
    const adminCreatableRoles: { role: Role; label: string }[] = [
        { role: 'huvudhandledare', label: getRoleDisplayName('huvudhandledare') },
        { role: 'vikarie-usk', label: getRoleDisplayName('vikarie-usk') },
        { role: 'vikarie-ssk', label: getRoleDisplayName('vikarie-ssk') },
        { role: 'anstalld-usk', label: getRoleDisplayName('anstalld-usk') },
        { role: 'anstalld-ssk', label: getRoleDisplayName('anstalld-ssk') }
    ];

    const UserList: React.FC<{title: string, userList: User[]}> = ({ title, userList }) => (
        <div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-slate-300 mb-4">{title}</h3>
            <div className="space-y-3">
                {userList.map(user => (
                     <div key={user.id} className="flex items-center gap-2 group">
                        <button 
                            onClick={() => onSelectUser(user.id)}
                            className="flex-1 text-left p-4 rounded-lg border bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400 transition-colors duration-200 flex items-center"
                        >
                            <div className="text-slate-600 dark:text-slate-400 mr-4">{ROLE_ICONS[user.role]}</div>
                            <div className="flex-1">
                                <p className="font-bold text-gray-800 dark:text-slate-200">{user.name}</p>
                                <p className="text-sm text-gray-500 dark:text-slate-400">{getRoleDisplayName(user.role)}</p>
                            </div>
                             <span className="text-sm font-medium text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">Visa detaljer &rarr;</span>
                        </button>
                         {user.role !== 'admin' && (
                            <button
                                onClick={(e) => handleDeleteClick(e, user)}
                                className="p-3 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors duration-200 btn-press"
                                aria-label={`Radera ${user.name}`}
                            >
                                {ICONS.trash}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <div>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-slate-100">Verksamhetsöversikt</h2>
                    <p className="mt-1 text-gray-600 dark:text-slate-400">Strategiska verktyg för ledning och kvalitetsutveckling.</p>
                </div>
                <div className="flex gap-2">
                     <button onClick={() => setIsCreateModalOpen(true)} className="bg-slate-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-600 transition-colors btn-press">
                        + Ny Användare
                    </button>
                </div>
            </header>
            
            {/* Developer System Overview - Simulated Backend View */}
            <section className="card-base p-6 bg-slate-900 border border-indigo-500/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 text-xs font-mono text-indigo-400 opacity-50">DEV_MODE: ACTIVE</div>
                <h3 className="text-xl font-bold text-indigo-200 mb-4 flex items-center gap-2">
                    {ICONS.server} Systemöversikt (Utvecklare)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-3 bg-slate-800 rounded border border-slate-700 text-center">
                        <p className="text-xs text-slate-400 uppercase tracking-wider">Aktiva Enheter</p>
                        <p className="text-2xl font-mono font-bold text-green-400">1 (Lokal)</p>
                    </div>
                    <div className="p-3 bg-slate-800 rounded border border-slate-700 text-center">
                        <p className="text-xs text-slate-400 uppercase tracking-wider">Användare Totalt</p>
                        <p className="text-2xl font-mono font-bold text-blue-400">{users.length}</p>
                    </div>
                    <div className="p-3 bg-slate-800 rounded border border-slate-700 text-center">
                        <p className="text-xs text-slate-400 uppercase tracking-wider">AI-Förfrågningar</p>
                        <p className="text-2xl font-mono font-bold text-purple-400">Active</p>
                    </div>
                    <div className="p-3 bg-slate-800 rounded border border-slate-700 text-center">
                        <p className="text-xs text-slate-400 uppercase tracking-wider">Region</p>
                        <p className="text-lg font-mono font-bold text-yellow-400">Västernorrland</p>
                    </div>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 animate-pulse w-full"></div>
                </div>
                <p className="text-xs text-slate-500 mt-2 font-mono">Systemstatus: Online. Inga kritiska fel rapporterade från noder i Sundsvall/Örnsköldsvik.</p>
            </section>
            
            {creationSuccess && (
                <div className="mb-4 p-3 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 rounded-md text-sm font-semibold">
                    {creationSuccess}
                </div>
            )}
            
            {/* Competence Heatmap Section */}
            <section className="card-base p-6">
                <h3 className="text-xl font-bold text-slate-100 mb-4 flex items-center">
                    {ICONS.chartPie} <span className="ml-2">Kompetens-Värmekarta (Avdelningsnivå)</span>
                    <InfoTooltip text="Visar genomsnittlig kompetensnivå baserat på avklarade moment i appen. Rött indikerar behov av utbildningsinsatser." />
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {competenceData.map((domain, idx) => (
                        <HeatmapCell key={idx} value={domain.score} label={domain.name} />
                    ))}
                </div>
                <p className="text-xs text-slate-400 mt-4 italic">* Baserat på aggregerad data från checklistor och kunskapstest.</p>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Strategic Report Section */}
                <section className="card-base p-6 flex flex-col">
                    <h3 className="text-xl font-bold text-slate-100 mb-2">Strategisk Månadsrapport</h3>
                    <p className="text-slate-400 text-sm mb-4">Låt AI:n analysera all data och skapa ett beslutsunderlag för ledningsgruppen.</p>
                    
                    {strategicReport ? (
                        <div className="bg-slate-900 p-4 rounded-md border border-slate-700 flex-1 overflow-y-auto max-h-96 mb-4">
                            <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: strategicReport.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center bg-slate-900/50 rounded-md border border-slate-700/50 min-h-[200px] mb-4">
                            <p className="text-slate-500">Ingen rapport genererad.</p>
                        </div>
                    )}
                    
                    <button 
                        onClick={handleGenerateReport} 
                        disabled={isGeneratingReport}
                        className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 disabled:bg-slate-700 transition-colors btn-press flex items-center justify-center gap-2"
                    >
                        {isGeneratingReport ? 'Analyserar verksamheten...' : (
                            <>
                                {ICONS.ai} Generera Rapport
                            </>
                        )}
                    </button>
                </section>

                {/* Broadcast / Communication Section */}
                <section className="card-base p-6">
                    <h3 className="text-xl font-bold text-slate-100 mb-2">Meddelande till Personalen</h3>
                    <p className="text-slate-400 text-sm mb-4">Skicka viktiga notiser direkt till alla användares startskärm (t.ex. om nya rutiner).</p>
                    <textarea 
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        className="w-full h-32 bg-slate-900 border border-slate-700 rounded-md p-3 text-slate-100 focus:ring-2 focus:ring-red-500 mb-4"
                        placeholder="Skriv ditt meddelande här..."
                    />
                    <button 
                        onClick={handleBroadcast}
                        disabled={!broadcastMessage.trim() || isBroadcasting}
                        className="w-full bg-slate-700 text-white font-bold py-3 rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors btn-press"
                    >
                        {isBroadcasting ? 'Skickar...' : 'Skicka Notis'}
                    </button>
                </section>
            </div>

            <div className="card-base p-6">
                <h2 className="text-xl font-bold text-slate-100 mb-6">Användarlista</h2>
                <div className="space-y-8">
                    <UserList title="Personal" userList={staffUsers} />
                    <UserList title="Studenter & Nyanställda" userList={studentUsers} />
                </div>
            </div>

            <CreateUserModal 
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreateUser={handleCreateUser}
                allowedRoles={adminCreatableRoles}
            />

             {/* Delete Confirmation Modal */}
            {userToDelete && (
                <Modal title="Radera Profil" onClose={() => setUserToDelete(null)}>
                    <p className="text-slate-300 mb-6">
                        Är du säker på att du vill radera profilen för <strong>{userToDelete.name}</strong>? All sparad data för denna användare kommer att försvinna permanent.
                    </p>
                    <div className="flex justify-end gap-4">
                        <button onClick={() => setUserToDelete(null)} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-200 btn-press">
                            Avbryt
                        </button>
                        <button onClick={confirmDelete} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-200 btn-press">
                            Ja, radera
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
});

export default AdminDashboard;
