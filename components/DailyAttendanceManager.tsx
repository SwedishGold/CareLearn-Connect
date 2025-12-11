
import React, { memo } from 'react';
import { User, UserData, AttendanceRecord, AttendanceStatus } from '../types';
import { InfoTooltip } from './UI';
import { ICONS } from '../constants';
import * as storage from '../services/localStorageService';
import { playClick } from '../services/soundService';

interface DailyAttendanceManagerProps {
  studentData: { user: User; data: UserData }[];
  onUpdateStudentData: (studentId: string, updatedData: Partial<UserData>) => void;
  onSelectStudent: (userId: string) => void;
}

const DailyAttendanceManager: React.FC<DailyAttendanceManagerProps> = memo(({ studentData, onUpdateStudentData, onSelectStudent }) => {
    const todayStr = new Date().toISOString().split('T')[0];

    const handleSetStatus = async (e: React.MouseEvent, studentId: string, currentRecords: AttendanceRecord[], status: AttendanceStatus) => {
        e.preventDefault(); 
        e.stopPropagation();
        playClick();
        
        const existingRecordIndex = currentRecords.findIndex(r => r.date === todayStr);
        let updatedRecords: AttendanceRecord[];

        if (existingRecordIndex > -1) {
            // Update existing record for today if status is different
            if (currentRecords[existingRecordIndex].status === status) {
                 // If clicking the same status again, remove it (toggle off)
                updatedRecords = currentRecords.filter(r => r.date !== todayStr);
            } else {
                updatedRecords = [...currentRecords];
                updatedRecords[existingRecordIndex].status = status;
                updatedRecords[existingRecordIndex].notes = 'Uppdaterad via översikt';
            }
        } else {
            // Add new record for today
            const newRecord: AttendanceRecord = { date: todayStr, status, notes: 'Registrerad via översikt' };
            updatedRecords = [...currentRecords, newRecord].sort((a,b) => a.date.localeCompare(b.date));
        }
        
        // This updates the local React state via parent
        onUpdateStudentData(studentId, { attendanceRecords: updatedRecords });
        
        // IMPORTANT: Also force a direct save to ensure persistence for the student immediately
        const currentData = await storage.loadUserData(studentId);
        if (currentData) {
            storage.saveUserData(studentId, { ...currentData, attendanceRecords: updatedRecords });
        }
    };

    if (studentData.length === 0) {
        return null; // Don't show if there are no students
    }

    return (
        <div className="card-base p-6 border-l-4 border-indigo-500">
            <div className="flex items-center mb-4">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Dagens Närvaro ({todayStr})</h3>
                <InfoTooltip text="Klicka på knapparna för att snabbregistrera närvaro. Detta syns direkt i studentens app." />
            </div>
            
            <div className="space-y-3 overflow-y-auto pr-2 relative z-0" style={{ maxHeight: '400px' }}>
                {studentData.map(({ user, data }) => {
                    const todayRecord = (data.attendanceRecords || []).find(r => r.date === todayStr);
                    return (
                        <div key={user.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${todayRecord ? (todayRecord.status === 'present' ? 'bg-green-500' : todayRecord.status === 'sick' ? 'bg-yellow-500' : 'bg-red-500') : 'bg-slate-300'}`}></div>
                                <p className="font-bold text-slate-800 dark:text-slate-100 truncate text-lg">{user.name}</p>
                            </div>
                            <div className="flex items-center justify-start sm:justify-end gap-2 flex-wrap">
                                {(['present', 'sick', 'absent'] as AttendanceStatus[]).map(status => {
                                    const isActive = todayRecord?.status === status;
                                    const content: { [key in AttendanceStatus]: { label: string; icon: React.ReactElement<{ className?: string }> } } = {
                                        present: { label: 'Närvaro', icon: ICONS.checklist },
                                        sick: { label: 'Sjuk', icon: ICONS.warning },
                                        absent: { label: 'Frånvaro', icon: ICONS.cross },
                                    };
                                    const colors = {
                                        present: { active: 'bg-green-600 text-white border-green-700 ring-2 ring-green-300 dark:ring-green-900', inactive: 'bg-white dark:bg-slate-700 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800 hover:bg-green-50' },
                                        sick: { active: 'bg-yellow-500 text-white border-yellow-600 ring-2 ring-yellow-300 dark:ring-yellow-900', inactive: 'bg-white dark:bg-slate-700 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-800 hover:bg-yellow-50' },
                                        absent: { active: 'bg-red-600 text-white border-red-700 ring-2 ring-red-300 dark:ring-red-900', inactive: 'bg-white dark:bg-slate-700 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800 hover:bg-red-50' },
                                    };

                                    return (
                                        <button
                                            key={status}
                                            onClick={(e) => handleSetStatus(e, user.id, data.attendanceRecords || [], status)}
                                            aria-label={content[status].label}
                                            className={`flex items-center gap-2 text-xs font-bold py-2 px-4 rounded-md border transition-all duration-200 transform active:scale-95 shadow-sm ${isActive ? colors[status].active : colors[status].inactive}`}
                                        >
                                            {React.cloneElement(content[status].icon, { className: "w-4 h-4 flex-shrink-0" })}
                                            <span className="hidden sm:inline">{content[status].label}</span>
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={(e) => { e.stopPropagation(); playClick(); onSelectStudent(user.id); }}
                                    className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 py-2 px-3 rounded ml-1 transition-colors"
                                >
                                    Mer &rarr;
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

export default DailyAttendanceManager;
