import React, { useState, memo } from 'react';
import { User, UserData, View, Role } from '../types';
import { APP_DATA } from '../constants';
import { getRoleDisplayName, Modal } from './UI';
import * as storage from '../services/localStorageService';

interface StudentProgressProps {
  user: User;
  userData: UserData;
  onUpdateUserData: (data: Partial<UserData>) => void;
  studentData: { user: User; data: UserData }[];
  onSelectStudent: (userId: string) => void;
  setView: (view: View) => void;
  onAccountDeletion: () => void;
  onCreateUser: (name: string, role: Role, aplWeeks?: number) => Promise<User>;
  allUsers: User[];
  onAssignSupervisor: (studentId: string, supervisorId: string) => void;
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

const StudentCard: React.FC<{ 
    student: User, 
    data: UserData, 
    onSelect: () => void, 
    onAssign?: () => void,
    isAssigned: boolean 
}> = ({ student, data, onSelect, onAssign, isAssigned }) => {
    const checklistCompleted = Object.values(data.checklistProgress || {}).filter(Boolean).length;
    const checklistTotal = APP_DATA.checklist.length;
    const checklistPercent = checklistTotal > 0 ? Math.round((checklistCompleted / checklistTotal) * 100) : 0;
    const logbookCount = data.logbookEntries.length;
    
    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold text-xl">
                    {student.name.charAt(0)}
                </div>
                <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100">{student.name}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{getRoleDisplayName(student.role)}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-300">
                <div className="text-center">
                    <p className="font-bold">{checklistPercent}%</p>
                    <p className="text-xs text-slate-500">Checklista</p>
                </div>
                <div className="text-center">
                    <p className="font-bold">{logbookCount}</p>
                    <p className="text-xs text-slate-500">Inlägg</p>
                </div>
            </div>

            <div className="flex gap-2">
                {!isAssigned && onAssign && (
                    <button onClick={onAssign} className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-sm font-bold">
                        Bli handledare
                    </button>
                )}
                <button onClick={onSelect} className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-600 text-sm font-bold">
                    Öppna Profil
                </button>
            </div>
        </div>
    );
};

const StudentProgress: React.FC<StudentProgressProps> = memo(({ user, userData, onUpdateUserData, studentData, onSelectStudent, setView, onAccountDeletion, onCreateUser, allUsers, onAssignSupervisor }) => {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [creationSuccess, setCreationSuccess] = useState<string | null>(null);

    const myStudents = studentData.filter(s => s.user.supervisorId === user.id);
    const otherStudents = studentData.filter(s => s.user.supervisorId !== user.id);

    const handleCreateUserWrapper = async (name: string, role: Role, aplWeeks?: number) => {
        const newUser = await onCreateUser(name, role, aplWeeks);
        setCreationSuccess(`Användare ${newUser.name} skapad! Pinkod: 1234`);
        setTimeout(() => setCreationSuccess(null), 5000);
    };

    const creatableRoles: { role: Role; label: string }[] = [
        { role: 'usk-elev', label: 'Undersköterske-elev' },
        { role: 'ssk-student', label: 'Sjuksköterskestudent' },
        { role: 'vikarie-usk', label: 'Vikarie (USK)' },
        { role: 'vikarie-ssk', label: 'Vikarie (SSK)' }
    ];

    return (
        <div className="space-y-8">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Elev-översikt</h2>
                    <p className="mt-1 text-slate-600 dark:text-slate-400">Följ dina studenters utveckling.</p>
                </div>
                <button onClick={() => setIsCreateModalOpen(true)} className="bg-slate-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-600 transition-colors btn-press">
                    + Ny Student/Vikarie
                </button>
            </header>

            {creationSuccess && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
                    {creationSuccess}
                </div>
            )}

            <div className="space-y-6">
                {myStudents.length > 0 && (
                    <div className="card-base p-6">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Mina Studenter</h3>
                        <div className="grid gap-4">
                            {myStudents.map(({ user: student, data }) => (
                                <StudentCard 
                                    key={student.id} 
                                    student={student} 
                                    data={data} 
                                    onSelect={() => onSelectStudent(student.id)} 
                                    isAssigned={true}
                                />
                            ))}
                        </div>
                    </div>
                )}

                <div className="card-base p-6">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">{myStudents.length > 0 ? 'Övriga Studenter på Enheten' : 'Alla Studenter på Enheten'}</h3>
                    {otherStudents.length === 0 ? (
                        <p className="text-slate-500">Inga andra studenter hittades.</p>
                    ) : (
                        <div className="grid gap-4">
                            {otherStudents.map(({ user: student, data }) => (
                                <StudentCard 
                                    key={student.id} 
                                    student={student} 
                                    data={data} 
                                    onSelect={() => onSelectStudent(student.id)} 
                                    onAssign={() => onAssignSupervisor(student.id, user.id)}
                                    isAssigned={false}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <CreateUserModal 
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreateUser={handleCreateUserWrapper}
                allowedRoles={creatableRoles}
                showAplWeeksFor={['usk-elev', 'ssk-student']}
            />
        </div>
    );
});

export default StudentProgress;