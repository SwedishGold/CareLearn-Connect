// components/StudentDetail.tsx
import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { User, UserData, Role, LogbookEntry, AttendanceRecord, AttendanceStatus, Notification, ScheduleEntry } from '../types';
import { APP_DATA, ICONS } from '../constants';
import Checklist from './Checklist';
import Goals from './Goals';
import { InfoTooltip, ProgressCircle, Modal, getRoleDisplayName } from './UI';
import { getAIAssistedWeeklyReport, getAIKnowledgeTestAnalysis, generateAssessmentDraft } from '../services/geminiService';
import { KnowledgeTest } from './Quiz';
import * as storage from '../services/localStorageService';
import { playProcess, playSuccess } from '../services/soundService';

// Make TypeScript aware of the globally included libraries for PDF generation
declare const jspdf: any;
declare const html2canvas: any;

interface StudentDetailProps {
  currentUser: User;
  student: User;
  data: UserData;
  onBack: () => void;
  onUpdateStudentData: (studentId: string, updatedData: Partial<UserData>) => void;
}

// ... (Other helper components: PrintableStudentReport, LogbookDetail remain unchanged) ...
const getQuestionsForRole = (role: Role) => {
    if (role === 'ssk-student') return APP_DATA.knowledgeTestQuestions.ssk.tier1.concat(APP_DATA.knowledgeTestQuestions.ssk.tier2);
    if (role === 'usk-elev') return APP_DATA.knowledgeTestQuestions.usk.tier1.concat(APP_DATA.knowledgeTestQuestions.usk.tier2);
    if (role === 'vikarie-ssk') return APP_DATA.knowledgeTestQuestions.vikarieSsk;
    if (role === 'vikarie-usk') return APP_DATA.knowledgeTestQuestions.vikarieUsk;
    return [];
};

const PrintableStudentReport: React.FC<{ student: User; data: UserData }> = memo(({ student, data }) => {
    const checklistCompleted = Object.values(data.checklistProgress || {}).filter(Boolean).length;
    const checklistTotal = APP_DATA.checklist.length;
    const checklistPercentage = checklistTotal > 0 ? (checklistCompleted / checklistTotal) * 100 : 0;

    const goalsWithProgress = APP_DATA.knowledgeRequirements
        .map(req => ({ ...req, progress: data.goalsProgress[req.id] }))
        .filter(g => g.progress && g.progress.rating > 0);

    const latestLogbookEntries = [...data.logbookEntries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);
    
    return (
        <div className="p-8 bg-white text-black" style={{ fontFamily: 'sans-serif' }} id="printable-student-report">
            <h1 className="text-3xl font-bold mb-2">Progressionrapport: {student.name}</h1>
            <p className="text-sm text-gray-500 mb-6">Rapport genererad: {new Date().toLocaleString('sv-SE')}</p>

            <h2 className="text-xl font-bold mt-6 mb-3 border-b pb-2">Checklista</h2>
            <p className="text-base">{checklistCompleted} av {checklistTotal} punkter avklarade ({checklistPercentage.toFixed(0)}%)</p>

            <h2 className="text-xl font-bold mt-6 mb-3 border-b pb-2">Skattade Lärandemål</h2>
            {goalsWithProgress.length > 0 ? (
                goalsWithProgress.map(g => (
                    <div key={g.id} className="mb-4" style={{ pageBreakInside: 'avoid' }}>
                        <p className="font-semibold">{g.text} - <span className="font-bold">Betyg: {g.progress.rating}/5</span></p>
                        {g.progress.reflection && <p className="text-sm italic text-gray-700 bg-gray-100 p-2 rounded-md mt-1">"{g.progress.reflection}"</p>}
                    </div>
                ))
            ) : <p className="text-base">Inga lärandemål har skattats än.</p>}

            <h2 className="text-xl font-bold mt-6 mb-3 border-b pb-2">Senaste Loggboksinlägg</h2>
            {latestLogbookEntries.length > 0 ? (
                latestLogbookEntries.map((entry, index) => (
                    <div key={index} className="mb-4" style={{ pageBreakInside: 'avoid' }}>
                        <p className="text-sm font-semibold">{entry.timestamp.toLocaleString('sv-SE')}</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{entry.text}</p>
                        {entry.comments && entry.comments.map((comment, cIndex) => (
                            <div key={cIndex} className="mt-2 ml-4 p-2 bg-gray-100 border-l-4 border-gray-300 rounded-r-md">
                                <p className="text-xs font-bold">{comment.authorName}:</p>
                                <p className="text-xs">{comment.text}</p>
                            </div>
                        ))}
                    </div>
                ))
            ) : <p className="text-base">Inga loggboksinlägg finns.</p>}
        </div>
    );
});

const LogbookDetail: React.FC<{
    data: UserData;
    student: User;
    currentUser: User;
    onUpdateStudentData: StudentDetailProps['onUpdateStudentData'];
}> = memo(({ data, student, currentUser, onUpdateStudentData }) => {
    const { logbookEntries: entries } = data;
    const [commentText, setCommentText] = useState<{ [key: number]: string }>({});

    const handleSaveComment = (entryIndex: number) => {
        const text = commentText[entryIndex];
        if (!text || !text.trim()) return;

        const sortedEntries = [...entries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const targetEntry = sortedEntries[entryIndex];
        
        const originalEntryIndex = entries.findIndex(e => e.timestamp === targetEntry.timestamp && e.text === targetEntry.text);
        if (originalEntryIndex === -1) return;
        
        const updatedEntries = [...entries];
        const entryToUpdate = updatedEntries[originalEntryIndex];

        const newComment = {
            authorId: currentUser.id,
            authorName: currentUser.name,
            text: text.trim(),
            timestamp: new Date(),
        };
        
        if (!entryToUpdate.comments) {
            entryToUpdate.comments = [];
        }
        entryToUpdate.comments.push(newComment);

        storage.addNotification(student.id, {
            text: `${currentUser.name} har kommenterat ditt loggboksinlägg.`,
            link: 'logbook',
            type: 'info'
        });
        
        onUpdateStudentData(student.id, { logbookEntries: updatedEntries });
        setCommentText(prev => ({ ...prev, [entryIndex]: '' }));
    };

    const sortedEntries = [...entries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return (
        <div className="card-base p-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-4">Loggboksinlägg</h3>
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
            {sortedEntries.length > 0 ? (
                sortedEntries.map((entry, index) => (
                <div key={index} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border dark:border-slate-700">
                    <p className="text-sm text-gray-500 dark:text-slate-400 font-medium mb-2">
                    {entry.timestamp.toLocaleDateString('sv-SE')} {entry.timestamp.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-gray-800 dark:text-slate-200 whitespace-pre-wrap">{entry.text}</p>
                    {entry.comments && entry.comments.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-600 space-y-2">
                            {entry.comments.map((comment, cIndex) => (
                                <div key={cIndex} className="bg-slate-100 dark:bg-slate-900/50 border-l-4 border-red-400 dark:border-red-500 p-3 rounded-r-md">
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{comment.authorName} (Handledare)</p>
                                    <p className="text-xs text-slate-700 dark:text-slate-400 mb-1">{comment.timestamp.toLocaleDateString('sv-SE')}</p>
                                    <p className="text-sm text-slate-900 dark:text-slate-300">{comment.text}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-600">
                        <textarea
                            value={commentText[index] || ''}
                            onChange={(e) => setCommentText(prev => ({ ...prev, [index]: e.target.value }))}
                            className="w-full mt-2 p-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm bg-slate-900 text-white placeholder-slate-400 dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500"
                            rows={2}
                            placeholder={`Skriv en kommentar till ${student.name}...`}
                        />
                        <button
                            onClick={() => handleSaveComment(index)}
                            disabled={!commentText[index] || !commentText[index].trim()}
                            className="bg-slate-800 text-white font-semibold py-1 px-3 rounded-md hover:bg-slate-600 transition-colors text-sm mt-2 disabled:bg-slate-400 btn-press"
                        >
                            Spara kommentar
                        </button>
                    </div>
                </div>
                ))
            ) : (
                <p className="text-center text-gray-500 dark:text-slate-400 py-8">Studenten har inte skrivit några inlägg ännu.</p>
            )}
            </div>
        </div>
    );
});

const AttendanceManager: React.FC<{
    student: User;
    currentUser: User;
    data: UserData;
    onUpdateStudentData: StudentDetailProps['onUpdateStudentData'];
}> = memo(({ student, currentUser, data, onUpdateStudentData }) => {
    const [totalDaysInput, setTotalDaysInput] = useState(data.aplTotalDays || '');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState('');
    const [shiftType, setShiftType] = useState<'Dag' | 'Kväll' | 'Natt' | 'Helg' | 'Egen tid'>('Dag');
    const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); 
    const [customStart, setCustomStart] = useState('08:00');
    const [customEnd, setCustomEnd] = useState('17:00');

    const attendanceRecords = data.attendanceRecords || [];
    // CHANGED: Use the student's own schedule data
    const existingSchedule = data.schedule || [];

    const handleSetTotalDays = () => {
        const days = parseInt(String(totalDaysInput), 10);
        if (!isNaN(days) && days >= 0) {
            onUpdateStudentData(student.id, { aplTotalDays: days });
        } else {
            alert('Ange ett giltigt nummer för totalt antal dagar.');
        }
    };

    const handleGenerateSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!startDate || !endDate) {
            alert("Välj start- och slutdatum.");
            return;
        }
        if (selectedDays.length === 0) {
            alert("Välj minst en veckodag.");
            return;
        }
        if (shiftType === 'Egen tid' && (!customStart || !customEnd)) {
            alert("Ange start- och sluttid för egen tid.");
            return;
        }

        playProcess();
        await storage.addScheduleRange(
            student.id, 
            new Date(startDate), 
            new Date(endDate), 
            shiftType, 
            shiftType === 'Egen tid' ? customStart : undefined,
            shiftType === 'Egen tid' ? customEnd : undefined,
            selectedDays, 
            currentUser.id
        );
        
        // IMPORTANT: Manually refresh local state via onUpdateStudentData to show new schedule instantly
        // since addScheduleRange updates localStorage but not React state here directly
        const updatedStudentData = await storage.loadUserData(student.id);
        if (updatedStudentData?.schedule) {
            onUpdateStudentData(student.id, { schedule: updatedStudentData.schedule });
        }
        
        storage.addNotification(student.id, {
            text: `Din handledare har uppdaterat ditt schema.`,
            type: 'info',
            link: 'attendance'
        });

        playSuccess();
        alert("Schema genererat! Studenten kan nu se detta i sin app.");
    };

    const toggleDay = (dayIndex: number) => {
        setSelectedDays(prev => prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]);
    };

    const weekDays = ['Sön', 'Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör'];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                    {/* Settings */}
                    <div className="card-base p-6">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-4">Inställningar</h3>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={totalDaysInput}
                                onChange={e => setTotalDaysInput(e.target.value)}
                                className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded-md bg-slate-900 text-white placeholder-slate-400 dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500"
                                placeholder="Totalt antal APL-dagar"
                            />
                            <button onClick={handleSetTotalDays} className="bg-slate-800 text-white font-semibold py-2 px-4 rounded-md hover:bg-slate-600 btn-press">Spara</button>
                        </div>
                    </div>

                    {/* Scheduler */}
                    <div className="card-base p-6 border-l-4 border-l-indigo-500">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2 flex items-center gap-2">
                            {ICONS.calendar} Smart Schemaläggare
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">Planera studentens pass snabbt.</p>
                        <form onSubmit={handleGenerateSchedule} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Från</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-800 rounded border dark:border-slate-600 text-slate-800 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Till</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 bg-slate-100 dark:bg-slate-800 rounded border dark:border-slate-600 text-slate-800 dark:text-white" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Passtyp</label>
                                <select value={shiftType} onChange={e => setShiftType(e.target.value as any)} className="w-full p-2 bg-slate-100 dark:bg-slate-800 rounded border dark:border-slate-600 text-slate-800 dark:text-white">
                                    <option value="Dag">Dag (07:00-16:00)</option>
                                    <option value="Kväll">Kväll (11:15-21:30)</option>
                                    <option value="Natt">Natt (21:00-07:00)</option>
                                    <option value="Helg">Helg (07:00-15:00)</option>
                                    <option value="Egen tid">Egen tid (Anpassad)</option>
                                </select>
                            </div>

                            {shiftType === 'Egen tid' && (
                                <div className="grid grid-cols-2 gap-4 bg-slate-100 dark:bg-slate-800/50 p-2 rounded">
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Start</label>
                                        <input type="time" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full p-2 bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Slut</label>
                                        <input type="time" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full p-2 bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600" />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dagar</label>
                                <div className="flex gap-1 justify-between">
                                    {weekDays.map((day, idx) => (
                                        <button 
                                            key={idx}
                                            type="button"
                                            onClick={() => toggleDay(idx)}
                                            className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${selectedDays.includes(idx) ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}
                                        >
                                            {day.charAt(0)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition-colors btn-press shadow-md">
                                Generera Schema
                            </button>
                        </form>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Scheduled Shifts List */}
                    <div className="card-base p-6 overflow-hidden">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-4">Planerat Schema</h3>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                            {existingSchedule.length > 0 ? existingSchedule.sort((a,b) => a.date.localeCompare(b.date)).map((s, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded border dark:border-slate-700">
                                    <div>
                                        <span className="font-bold text-slate-700 dark:text-slate-200">{s.date}</span>
                                        <span className="text-xs text-slate-500 ml-2">({new Date(s.date).toLocaleDateString('sv-SE', { weekday: 'short' })})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-1 rounded font-bold ${
                                            s.shiftType === 'Dag' ? 'bg-yellow-100 text-yellow-800' : 
                                            s.shiftType === 'Kväll' ? 'bg-blue-100 text-blue-800' : 
                                            'bg-purple-100 text-purple-800'
                                        }`}>
                                            {s.shiftType}
                                        </span>
                                        <span className="text-xs font-mono text-slate-500">{s.startTime}-{s.endTime}</span>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-center text-slate-500 py-8">Inget schema lagt än.</p>
                            )}
                        </div>
                    </div>

                    {/* Recorded Attendance History */}
                    <div className="card-base p-6 overflow-hidden">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-4">Registrerad Närvaro (Utfall)</h3>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                            {attendanceRecords.length > 0 ? attendanceRecords.sort((a,b) => b.date.localeCompare(a.date)).map((r, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded border dark:border-slate-700">
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{r.date}</span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${
                                        r.status === 'present' ? 'bg-green-100 text-green-800' :
                                        r.status === 'sick' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                        {r.status === 'present' ? 'Närvarande' : r.status === 'sick' ? 'Sjuk' : 'Frånvarande'}
                                    </span>
                                </div>
                            )) : (
                                <p className="text-center text-slate-500 py-8">Ingen närvaro registrerad än.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

const InternshipConclusion: React.FC<{
    student: User;
    data: UserData;
    currentUser: User;
    onClose: () => void;
}> = memo(({ student, data, currentUser, onClose }) => {
    const [summary, setSummary] = useState('');
    const [isConfirmed, setIsConfirmed] = useState(false);

    const checklistCompleted = Object.values(data.checklistProgress || {}).filter(Boolean).length;
    const checklistTotal = APP_DATA.checklist.length;
    const isReady = checklistCompleted / checklistTotal >= 0.8; // Require 80%

    const handleConclude = () => {
        if (!isConfirmed) return;
        
        playSuccess();
        storage.concludeInternship(
            student.id,
            currentUser.name,
            getRoleDisplayName(currentUser.role),
            summary || "Godkänd praktikperiod."
        );
        
        alert("Praktiken är nu avslutad och diplom är utfärdat till studentens profil.");
        onClose();
        window.location.reload(); // Force refresh to update data views
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg border dark:border-slate-700 text-center">
                <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
                    🎓
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Avsluta & Diplomera</h2>
                <p className="text-slate-600 dark:text-slate-300 mt-2">
                    Du är på väg att avsluta praktiken för <strong>{student.name}</strong>.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded border text-center ${isReady ? 'bg-green-100 border-green-300 text-green-800' : 'bg-red-100 border-red-300 text-red-800'}`}>
                    <p className="font-bold text-xl">{checklistCompleted}/{checklistTotal}</p>
                    <p className="text-xs uppercase">Checklista</p>
                </div>
                <div className="p-4 rounded border bg-blue-100 border-blue-300 text-blue-800 text-center">
                    <p className="font-bold text-xl">{data.logbookEntries.length}</p>
                    <p className="text-xs uppercase">Loggboksinlägg</p>
                </div>
            </div>

            {!isReady && (
                <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded text-sm">
                    <strong>OBS:</strong> Studenten har inte uppnått 80% av checklistan. Är du säker på att du vill godkänna?
                </div>
            )}

            <div>
                <label className="block text-sm font-bold text-slate-500 mb-2">Slutomdöme (Visas på diplomet)</label>
                <textarea 
                    value={summary}
                    onChange={e => setSummary(e.target.value)}
                    className="w-full h-32 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-indigo-500"
                    placeholder="Skriv ett kort omdöme..."
                />
            </div>

            <div className="flex items-center gap-2">
                <input 
                    type="checkbox" 
                    id="confirm-end" 
                    checked={isConfirmed} 
                    onChange={e => setIsConfirmed(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="confirm-end" className="text-sm text-slate-700 dark:text-slate-300">
                    Jag intygar att studenten har fullgjort sin praktikperiod.
                </label>
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t dark:border-slate-700">
                <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded">Avbryt</button>
                <button 
                    onClick={handleConclude} 
                    disabled={!isConfirmed}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-bold rounded shadow-lg transition-colors"
                >
                    Utfärda Diplom
                </button>
            </div>
        </div>
    );
});

export const StudentDetail: React.FC<StudentDetailProps> = memo(({ currentUser, student, data, onBack, onUpdateStudentData }) => {
    const [view, setView] = useState<'overview' | 'checklist' | 'logbook' | 'goals' | 'knowledge-test' | 'attendance' | 'conclusion'>('overview');
    const [isReportLoading, setIsReportLoading] = useState(false);
    const [generatedReport, setGeneratedReport] = useState<string | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [knowledgeTestAnalysis, setKnowledgeTestAnalysis] = useState<string | null>(null);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
    const [isAssessmentLoading, setIsAssessmentLoading] = useState(false);
    const [assessmentDraft, setAssessmentDraft] = useState<string | null>(null);
    const [showAssessmentModal, setShowAssessmentModal] = useState(false);

    const handleGenerateReport = async () => {
        setIsReportLoading(true);
        setGeneratedReport(null);
        playProcess();
        try {
            const report = await getAIAssistedWeeklyReport(student, data);
            setGeneratedReport(report);
        } catch (error) {
            console.error(error);
            setGeneratedReport("Kunde inte generera rapport.");
        } finally {
            setIsReportLoading(false);
        }
    };

    const handleGenerateAssessment = async () => {
        setIsAssessmentLoading(true);
        setAssessmentDraft(null);
        setShowAssessmentModal(true);
        playProcess();
        try {
            const draft = await generateAssessmentDraft(data, student.name);
            setAssessmentDraft(draft);
        } catch (error) {
            setAssessmentDraft("Kunde inte generera utkast.");
        } finally {
            setIsAssessmentLoading(false);
        }
    };

    const handleGenerateAnalysis = useCallback(async () => {
        setIsAnalysisLoading(true);
        setKnowledgeTestAnalysis(null);
        playProcess();
        try {
            const analysis = await getAIKnowledgeTestAnalysis(student, data.knowledgeTestHistory);
            setKnowledgeTestAnalysis(analysis);
        } catch (error) {
            console.error(error);
            setKnowledgeTestAnalysis("Kunde inte generera analysen.");
        } finally {
            setIsAnalysisLoading(false);
        }
    }, [student, data.knowledgeTestHistory]);

    const handleDownloadPdf = useCallback(async () => {
        setIsGeneratingPdf(true);
        const reportElement = document.getElementById('printable-student-report');
        if (reportElement) {
            try {
                const canvas = await html2canvas(reportElement, { scale: 2, backgroundColor: '#ffffff' });
                const imgData = canvas.toDataURL('image/png');
                
                const { jsPDF } = jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const imgHeight = canvas.height * pdfWidth / canvas.width;
                
                let heightLeft = imgHeight;
                let position = 0;
                
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
                
                while (heightLeft > 0) {
                    position -= pdfHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }
                
                pdf.save(`rapport-${student.name.replace(/ /g, '_')}-${new Date().toISOString().split('T')[0]}.pdf`);
            } catch (error) {
                console.error("PDF generation failed", error);
                alert("Kunde inte generera PDF-rapporten.");
            }
        }
        setIsGeneratingPdf(false);
    }, [student]);

    const handleChecklistToggle = (index: number, isChecked: boolean) => {
        const newProgress = { ...data.checklistProgress, [index]: isChecked };
        onUpdateStudentData(student.id, { checklistProgress: newProgress });
    };

    const sortedLogbookEntries = [...data.logbookEntries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const checklistCompleted = Object.values(data.checklistProgress || {}).filter(Boolean).length;
    const checklistTotal = APP_DATA.checklist.length;
    const checklistPercentage = checklistTotal > 0 ? Math.round((checklistCompleted / checklistTotal) * 100) : 0;
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-6">
                <div className="card-base p-6 text-center">
                    <h2 className="text-2xl font-bold text-gray-800">{student.name}</h2>
                    <p className="text-gray-500 capitalize">{student.role.replace('-', ' ')}</p>
                    <div className="mt-4 flex justify-center">
                        <ProgressCircle percentage={checklistPercentage} />
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{checklistPercentage}% av checklistan avklarad</p>
                </div>

                <div className="card-base p-4">
                    <button onClick={() => setView('overview')} className={`w-full text-left p-3 rounded-md font-medium transition ${view === 'overview' ? 'bg-red-100 text-red-800' : 'hover:bg-slate-100'}`}>Översikt</button>
                    <button onClick={() => setView('checklist')} className={`w-full text-left p-3 rounded-md font-medium transition ${view === 'checklist' ? 'bg-red-100 text-red-800' : 'hover:bg-slate-100'}`}>Checklista</button>
                    <button onClick={() => setView('logbook')} className={`w-full text-left p-3 rounded-md font-medium transition ${view === 'logbook' ? 'bg-red-100 text-red-800' : 'hover:bg-slate-100'}`}>Loggbok ({data.logbookEntries.length})</button>
                    <button onClick={() => setView('goals')} className={`w-full text-left p-3 rounded-md font-medium transition ${view === 'goals' ? 'bg-red-100 text-red-800' : 'hover:bg-slate-100'}`}>Lärandemål</button>
                    <button onClick={() => setView('knowledge-test')} className={`w-full text-left p-3 rounded-md font-medium transition ${view === 'knowledge-test' ? 'bg-red-100 text-red-800' : 'hover:bg-slate-100'}`}>Kunskapstest</button>
                    <button onClick={() => setView('attendance')} className={`w-full text-left p-3 rounded-md font-medium transition ${view === 'attendance' ? 'bg-red-100 text-red-800' : 'hover:bg-slate-100'}`}>Schema & Närvaro</button>
                    <button onClick={() => setView('conclusion')} className={`w-full text-left p-3 rounded-md font-medium transition mt-4 border-t border-slate-200 ${view === 'conclusion' ? 'bg-yellow-100 text-yellow-800' : 'hover:bg-yellow-50 text-yellow-700'}`}>Avsluta & Diplomera</button>
                </div>
                <button onClick={onBack} className="w-full text-slate-500 hover:text-slate-800 text-sm">Tillbaka till listan</button>
            </div>
            <div className="md:col-span-2">
                {view === 'overview' && (
                    <div className="card-base p-6 space-y-6">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800 flex items-center">
                                AI-Assisterad Handledning
                                <InfoTooltip text="Verktyg för att skapa underlag och omdömen." />
                            </h3>
                            <div className="flex gap-2 mt-2">
                                <button onClick={handleGenerateReport} disabled={isReportLoading} className="bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600 disabled:bg-slate-400">
                                    {isReportLoading ? "Genererar..." : "Veckorapport"}
                                </button>
                                <button onClick={handleGenerateAssessment} className="bg-purple-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-800">
                                    Generera Slutbedömning (Utkast)
                                </button>
                            </div>
                            {generatedReport && <div className="mt-4 p-4 bg-slate-100 rounded-md prose prose-sm max-w-none" dangerouslySetInnerHTML={{__html: generatedReport.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />}
                        </div>
                        
                         <div className="border-t pt-6">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">Senaste Loggboksinlägg</h3>
                             {sortedLogbookEntries.slice(0, 2).map((entry, index) => (
                                <div key={index} className="mb-4 p-3 bg-slate-100 rounded-md">
                                    <p className="text-xs text-gray-500">{entry.timestamp.toLocaleDateString('sv-SE')}</p>
                                    <p className="italic truncate">"{entry.text}"</p>
                                </div>
                            ))}
                        </div>
                         <div className="border-t pt-6">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center">
                                PDF Rapport
                                <InfoTooltip text="Generera en PDF-rapport med en sammanställning av studentens progression inom checklista, lärandemål och loggbok." />
                            </h3>
                            <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="mt-2 bg-slate-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-500 disabled:bg-slate-400">
                                {isGeneratingPdf ? "Genererar PDF..." : "Ladda ner Rapport (PDF)"}
                            </button>
                        </div>
                    </div>
                )}
                
                {view === 'checklist' && <Checklist progress={data.checklistProgress} onToggle={handleChecklistToggle} userRole={currentUser.role} />}
                {view === 'logbook' && <LogbookDetail data={data} student={student} currentUser={currentUser} onUpdateStudentData={onUpdateStudentData} />}
                {view === 'goals' && <Goals progress={data.goalsProgress} onSave={(newProgress) => onUpdateStudentData(student.id, { goalsProgress: newProgress })} userRole={student.role} isReadOnly={true} />}
                {view === 'knowledge-test' && (
                    <div className="space-y-6">
                        <div className="card-base p-6">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 flex items-center">
                                AI-Analys av Kunskapstest
                                <InfoTooltip text="Låt AI analysera studentens samlade testresultat." />
                            </h3>
                            <button onClick={handleGenerateAnalysis} disabled={isAnalysisLoading || data.knowledgeTestHistory.length === 0} className="mt-2 bg-slate-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600 disabled:bg-slate-400 btn-press">
                                {isAnalysisLoading ? "Analyserar..." : "Generera AI-analys"}
                            </button>
                            {data.knowledgeTestHistory.length === 0 && <p className="text-sm text-slate-500 mt-2">Studenten har inte gjort något test än.</p>}
                            {isAnalysisLoading && <p className="mt-4 text-slate-500 animate-pulse">Analyserar resultat...</p>}
                            {knowledgeTestAnalysis && (
                                <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-md prose prose-sm max-w-none dark:prose-invert" 
                                     dangerouslySetInnerHTML={{__html: knowledgeTestAnalysis.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/### (.*)/g, '<h3 class="!text-lg !font-bold">$1</h3>') }} 
                                />
                            )}
                        </div>
                        <KnowledgeTest 
                            viewer={currentUser}
                            user={student}
                            userData={data}
                            knowledgeTestHistory={data.knowledgeTestHistory} 
                            knowledgeTestInProgress={data.knowledgeTestInProgress} 
                            onTestComplete={() => {}} 
                            onResetHistory={() => {}} 
                            onSaveProgress={() => {}} 
                         />
                    </div>
                )}
                {view === 'attendance' && <AttendanceManager student={student} currentUser={currentUser} data={data} onUpdateStudentData={onUpdateStudentData} />}
                {view === 'conclusion' && <InternshipConclusion student={student} data={data} currentUser={currentUser} onClose={() => setView('overview')} />}
            </div>
            
            <div className="absolute -left-[9999px] top-0 w-[210mm] no-print">
                <PrintableStudentReport student={student} data={data} />
            </div>
            
            {showAssessmentModal && (
                <Modal title="AI-genererat Omdömesutkast" onClose={() => setShowAssessmentModal(false)}>
                    <div className="space-y-4">
                        <p className="text-slate-300 text-sm">Detta är ett utkast genererat av Gemini 3 Pro baserat på all tillgänglig studentdata. Du bör alltid redigera och validera texten innan den används officiellt.</p>
                        {isAssessmentLoading ? (
                             <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                                <span className="ml-3 text-slate-300">Syntetiserar data...</span>
                            </div>
                        ) : (
                            <textarea 
                                className="w-full h-96 p-4 bg-slate-800 text-slate-100 rounded border border-slate-600 font-mono text-sm"
                                value={assessmentDraft || ''}
                                readOnly
                            />
                        )}
                        <div className="flex justify-end gap-2">
                             <button onClick={() => setShowAssessmentModal(false)} className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-500">Stäng</button>
                             <button onClick={() => navigator.clipboard.writeText(assessmentDraft || '')} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700" disabled={!assessmentDraft}>Kopiera text</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
});