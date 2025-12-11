import React, { useState, useMemo, useRef, memo, useCallback } from 'react';
import { LogbookEntry, CriticalIncident } from '../types';
import { InfoTooltip, Modal, toYYYYMMDD } from './UI';
import { getAILogbookAnalysis, getAILogbookSuggestion } from '../services/geminiService';
import { checkTextForPII } from '../services/securityService'; // NEW IMPORT
import { ICONS } from '../constants';
import * as storage from '../services/localStorageService';
import { playSuccess, playProcess, playAlert, playClick } from '../services/soundService';


interface LogbookProps {
  entries: LogbookEntry[];
  onSave: (newEntry: LogbookEntry) => void;
  onUpdateEntry: (timestamp: Date, updates: Partial<LogbookEntry>) => void;
  streak?: {
      current: number;
      longest: number;
      lastEntryDate: string | null;
  };
}

const CalendarView: React.FC<{
    entries: LogbookEntry[],
    streak?: LogbookProps['streak'],
    onDateClick: (dateStr: string) => void
}> = memo(({ entries, streak, onDateClick }) => {
    const [displayDate, setDisplayDate] = useState(new Date());

    const { year, month, daysInMonth, firstDayOfWeek } = useMemo(() => {
        const date = new Date(displayDate);
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const firstDayOfWeek = (firstDay === 0) ? 6 : firstDay - 1; // Monday is 0, Sunday is 6
        return { year, month, daysInMonth, firstDayOfWeek };
    }, [displayDate]);

    const entryDates = useMemo(() => new Set(entries.map(e => toYYYYMMDD(new Date(e.timestamp)))), [entries]);

    const streakDates = useMemo(() => {
        const dates = new Set<string>();
        if (!streak?.lastEntryDate || streak.current <= 1) return dates;

        const lastDate = new Date(streak.lastEntryDate);
        // The streak includes the last entry date and previous consecutive days
        for (let i = 0; i < streak.current; i++) {
            const date = new Date(lastDate);
            date.setUTCDate(date.getUTCDate() - i);
            dates.add(toYYYYMMDD(date));
        }
        return dates;
    }, [streak]);


    const todayStr = toYYYYMMDD(new Date());

    const handlePrevMonth = useCallback(() => setDisplayDate(current => new Date(current.getFullYear(), current.getMonth() - 1, 1)), []);
    const handleNextMonth = useCallback(() => setDisplayDate(current => new Date(current.getFullYear(), current.getMonth() + 1, 1)), []);

    const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
        const dayNumber = i + 1;
        const date = new Date(year, month, dayNumber);
        const dateStr = toYYYYMMDD(date);
        
        const isToday = dateStr === todayStr;
        const hasEntry = entryDates.has(dateStr);
        const isStreak = streakDates.has(dateStr);
        
        let dayClasses = "logbook-sequencer-day relative w-full aspect-square flex items-center justify-center rounded-md text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-offset-slate-800";
        
        if (hasEntry) {
            dayClasses += " has-entry";
            if (isStreak) {
                dayClasses += " is-streak";
            }
        }
        
        if (!hasEntry) {
            dayClasses += " disabled:opacity-50";
        } else {
            dayClasses += " cursor-pointer";
        }

        return (
            <button 
                key={dayNumber} 
                onClick={() => hasEntry && onDateClick(dateStr)} 
                className={dayClasses} 
                disabled={!hasEntry}
                aria-label={`Dag ${dayNumber}, ${hasEntry ? 'har inlägg' : 'inget inlägg'}`}
            >
                <span className={isToday ? 'is-today-marker' : ''}>{dayNumber}</span>
            </button>
        );
    });

    return (
        <div className="card-base p-4">
            <div className="logbook-lcd-display flex justify-between items-center mb-4">
                <button onClick={handlePrevMonth} className="lcd-button text-2xl px-2">&lt;</button>
                <h4 className="lcd-text text-lg">
                    {displayDate.toLocaleString('sv-SE', { month: 'long', year: 'numeric' }).toUpperCase()}
                </h4>
                <button onClick={handleNextMonth} className="lcd-button text-2xl px-2">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 dark:text-slate-400 font-bold mb-2 tracking-wider">
                {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`}></div>)}
                {dayCells}
            </div>
        </div>
    );
});


const Logbook: React.FC<LogbookProps> = ({ entries, onSave, onUpdateEntry, streak }) => {
  const [newEntryText, setNewEntryText] = useState('');
  const [saveConfirmation, setSaveConfirmation] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // Edit State
  const [editingEntry, setEditingEntry] = useState<{ timestamp: string, text: string } | null>(null);

  const entryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [incidentData, setIncidentData] = useState<CriticalIncident>({
    situation: '',
    thoughtsAndFeelings: '',
    actions: '',
    outcomes: '',
    analysis: ''
  });

  const triggerAIContextualAnalysis = useCallback(async (entry: LogbookEntry) => {
    try {
        const documents = await storage.getCustomDocuments(); 
        const suggestion = await getAILogbookSuggestion(entry, documents);
        if (suggestion) {
            onUpdateEntry(entry.timestamp, { aiSuggestion: suggestion });
        }
    } catch (error) {
        console.error("Failed to get contextual AI suggestion for logbook entry:", error);
    }
  }, [onUpdateEntry]);

  const handleSaveStandardEntry = useCallback(() => {
    if (typeof newEntryText === 'string' && newEntryText.trim()) {
      
      // SAFETY CHECK
      const piiCheck = checkTextForPII(newEntryText);
      if (!piiCheck.safe) {
          playAlert();
          alert(`VARNING: ${piiCheck.reason}\n\nDu får inte spara personuppgifter i loggboken. Ta bort den känsliga informationen och försök igen.`);
          return;
      }

      const newEntry: LogbookEntry = {
        text: newEntryText.trim(),
        timestamp: new Date(), // Ensure new object
        type: 'standard',
      };
      
      // Call the save prop which updates parent state and localStorage
      onSave(newEntry);
      playSuccess();
      
      // Trigger AI suggestion in background
      triggerAIContextualAnalysis(newEntry);
      
      // Reset UI
      setNewEntryText('');
      setSaveConfirmation(true);
      setTimeout(() => setSaveConfirmation(false), 3000);
    }
  }, [newEntryText, onSave, triggerAIContextualAnalysis]);

  const handleSaveIncident = () => {
    if (Object.values(incidentData).every(field => typeof field === 'string' && field.trim() !== '')) {
        
      // SAFETY CHECK FOR ALL FIELDS
      const combinedText = `${incidentData.situation} ${incidentData.thoughtsAndFeelings} ${incidentData.actions}`;
      const piiCheck = checkTextForPII(combinedText);
      if (!piiCheck.safe) {
          playAlert();
          alert(`VARNING: ${piiCheck.reason}\n\nDu får inte spara personuppgifter i incidentrapporten. Ta bort den känsliga informationen och försök igen.`);
          return;
      }

      const newEntry: LogbookEntry = {
        text: `Incidentanalys: ${incidentData.situation.substring(0, 50)}...`,
        timestamp: new Date(),
        type: 'incident',
        incident: { ...incidentData }
      };
      playSuccess();
      onSave(newEntry);
      triggerAIContextualAnalysis(newEntry);
      setIsIncidentModalOpen(false);
      setIncidentData({ situation: '', thoughtsAndFeelings: '', actions: '', outcomes: '', analysis: '' });
      setSaveConfirmation(true);
      setTimeout(() => setSaveConfirmation(false), 3000);
    } else {
      alert("Vänligen fyll i alla fält i analysen.");
    }
  };
  
  // --- Edit Handlers ---
  const startEditing = (entry: LogbookEntry) => {
      playClick();
      setEditingEntry({
          timestamp: toYYYYMMDD(new Date(entry.timestamp)) + entry.timestamp.getTime(), // unique key combo
          text: entry.text
      });
  };

  const cancelEditing = () => {
      setEditingEntry(null);
  };

  const saveEdit = (originalEntry: LogbookEntry) => {
      if (!editingEntry || !editingEntry.text.trim()) return;

      // PII Check again for edited text
      const piiCheck = checkTextForPII(editingEntry.text);
      if (!piiCheck.safe) {
          playAlert();
          alert(`VARNING: ${piiCheck.reason}\n\nDu får inte spara personuppgifter i loggboken.`);
          return;
      }

      onUpdateEntry(originalEntry.timestamp, { text: editingEntry.text.trim() });
      playSuccess();
      setEditingEntry(null);
  };

  const handleAnalysis = useCallback(async () => {
      setIsAnalyzing(true);
      setShowAnalysis(true);
      playProcess();
      const result = await getAILogbookAnalysis(entries);
      setAnalysisResult(result);
      setIsAnalyzing(false);
  }, [entries]);

  const handleDateClick = useCallback((dateStr: string) => {
    const ref = entryRefs.current[dateStr];
    if (ref) {
        ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
        ref.classList.add('animate-flash');
        setTimeout(() => ref.classList.remove('animate-flash'), 1500);
    }
  }, []);
  
  const startDictation = useCallback(() => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
          alert("Din webbläsare stödjer inte röstigenkänning.");
          return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'sv-SE';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      let finalTranscript = '';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          if (event.error === 'not-allowed') {
              alert("Mikrofonåtkomst nekad. Kontrollera webbläsarens inställningar och tillåt mikrofonen.");
          }
          setIsListening(false);
      };

      recognition.onresult = (event: any) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                  finalTranscript += event.results[i][0].transcript;
              } else {
                  interimTranscript += event.results[i][0].transcript;
              }
          }
          // Append to existing text, or just use what we have
          if (finalTranscript) {
             setNewEntryText(prev => prev + (prev ? ' ' : '') + finalTranscript);
          }
      };

      recognition.start();
  }, []);

  const sortedEntries = useMemo(() => [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [entries]);

  const renderIncidentField = (label: string, field: keyof CriticalIncident, placeholder: string) => (
    <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</label>
        <textarea
            value={incidentData[field]}
            onChange={(e) => setIncidentData(prev => ({ ...prev, [field]: e.target.value }))}
            className="w-full h-24 p-2 border rounded-md focus:ring-2 focus:ring-red-500 bg-slate-900 dark:bg-slate-800 text-slate-100 placeholder-slate-400 border-slate-300 dark:border-slate-600"
            placeholder={placeholder}
        />
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-1 flex flex-col gap-6">
            <CalendarView entries={entries} streak={streak} onDateClick={handleDateClick} />
            <div className="card-base p-6">
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                      <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100">Nytt loggboksinlägg</h3>
                      <InfoTooltip text="Här reflekterar du över din dag. För en djupare analys av en specifik händelse, använd 'Analysera en händelse'. OBS! Skriv ALDRIG patientkänslig information här." />
                  </div>
                   <button 
                        onClick={startDictation}
                        className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                        title="Diktera inlägg"
                    >
                        {ICONS.mic}
                    </button>
              </div>
              <textarea
                value={newEntryText}
                onChange={(e) => setNewEntryText(e.target.value)}
                className="w-full h-48 p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500 bg-slate-900 text-slate-100 placeholder-slate-400 border-blue-500/50"
                placeholder={isListening ? "Lyssnar..." : "Reflektera över dagens händelser, utmaningar och lärdomar..."}
              />
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                    onClick={() => setIsIncidentModalOpen(true)}
                    className="w-full bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-bold py-3 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-200 btn-press"
                >
                    Analysera händelse
                </button>
                <button
                    onClick={handleSaveStandardEntry}
                    className="w-full bg-red-600 text-white font-bold py-3 rounded-md hover:bg-red-700 transition-colors duration-200 btn-press"
                >
                    Spara inlägg
                </button>
              </div>
              {saveConfirmation && <p className="text-center text-green-600 dark:text-green-400 text-sm mt-2">Ditt inlägg har sparats!</p>}
            </div>
        </div>
        
        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 card-base p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100">Tidigare inlägg</h3>
              <button 
                onClick={handleAnalysis}
                disabled={entries.length < 2}
                // UPDATED: High-contrast button color
                className="flex items-center bg-indigo-600 border border-indigo-500/50 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-slate-800/50 disabled:text-slate-600 disabled:border-slate-700 text-sm transition-colors duration-200 btn-press"
                title={entries.length < 2 ? "Skriv minst 2 inlägg för att kunna analysera" : "Analysera dina inlägg"}
              >
                {ICONS.aiTips} <span className="ml-2">Analysera med AI</span>
              </button>
          </div>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
            {sortedEntries.length > 0 ? (
              sortedEntries.map((entry, index) => {
                  const entryDate = new Date(entry.timestamp);
                  const entryDateStr = toYYYYMMDD(entryDate);
                  const uniqueKey = entryDateStr + entry.timestamp.getTime();
                  const isEditing = editingEntry?.timestamp === uniqueKey;

                  return (
                    <div 
                        key={index} 
                        ref={el => { if (!entryRefs.current[entryDateStr]) { entryRefs.current[entryDateStr] = el; } }} 
                        className="bg-white/30 dark:bg-black/20 backdrop-blur-sm p-4 rounded-lg border border-black/10 dark:border-white/10 transition-colors duration-300 stagger-item" 
                        style={{ '--stagger-delay': `${index * 100}ms` } as React.CSSProperties}
                    >
                      <div className="flex justify-between items-start mb-2">
                          <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">
                            {entryDate.toLocaleDateString('sv-SE')} {entryDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {entry.type === 'standard' && !isEditing && (
                              <button 
                                onClick={() => startEditing(entry)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                title="Redigera inlägg"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                          )}
                      </div>
                      
                      {entry.type === 'incident' && entry.incident ? (
                        <div className="space-y-3">
                          <h4 className="font-bold text-lg text-red-700 dark:text-red-400">Incidentanalys</h4>
                          <div>
                            <p className="font-semibold text-sm text-slate-600 dark:text-slate-400">Situation:</p>
                            <p className="text-gray-800 dark:text-slate-200 whitespace-pre-wrap pl-2 border-l-2 border-slate-200 dark:border-slate-600">{entry.incident.situation}</p>
                          </div>
                           <div>
                            <p className="font-semibold text-sm text-slate-600 dark:text-slate-400">Mina Tankar & Känslor:</p>
                            <p className="text-gray-800 dark:text-slate-200 whitespace-pre-wrap pl-2 border-l-2 border-slate-200 dark:border-slate-600">{entry.incident.thoughtsAndFeelings}</p>
                          </div>
                           <div>
                            <p className="font-semibold text-sm text-slate-600 dark:text-slate-400">Mina Handlingar:</p>
                            <p className="text-gray-800 dark:text-slate-200 whitespace-pre-wrap pl-2 border-l-2 border-slate-200 dark:border-slate-600">{entry.incident.actions}</p>
                          </div>
                           <div>
                            <p className="font-semibold text-sm text-slate-600 dark:text-slate-400">Resultat & Konsekvenser:</p>
                            <p className="text-gray-800 dark:text-slate-200 whitespace-pre-wrap pl-2 border-l-2 border-slate-200 dark:border-slate-600">{entry.incident.outcomes}</p>
                          </div>
                           <div>
                            <p className="font-semibold text-sm text-slate-600 dark:text-slate-400">Analys & Lärdom:</p>
                            <p className="text-gray-800 dark:text-slate-200 whitespace-pre-wrap pl-2 border-l-2 border-slate-200 dark:border-slate-600">{entry.incident.analysis}</p>
                          </div>
                        </div>
                      ) : (
                        isEditing && editingEntry ? (
                            <div className="space-y-2 animate-fade-in">
                                <textarea
                                    value={editingEntry.text}
                                    onChange={(e) => setEditingEntry({ ...editingEntry, text: e.target.value })}
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 min-h-[100px]"
                                />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={cancelEditing} className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-300 dark:hover:bg-slate-600 text-sm">Avbryt</button>
                                    <button onClick={() => saveEdit(entry)} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-bold">Spara</button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-800 dark:text-slate-200 whitespace-pre-wrap">{entry.text}</p>
                        )
                      )}

                      {entry.aiSuggestion && (
                        <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-white/10">
                             <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-300 dark:border-blue-600 p-3 rounded-r-md">
                                <p className="text-sm font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                                    {ICONS.aiTips}
                                    Reflektionsfråga från AI-Handledaren
                                </p>
                                <p className="text-sm text-blue-900 dark:text-blue-100 mt-1 italic">"{entry.aiSuggestion}"</p>
                            </div>
                        </div>
                      )}

                      {entry.comments && entry.comments.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-white/10 space-y-2">
                              {entry.comments.map((comment, cIndex) => (
                                  <div key={cIndex} className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-300 dark:border-red-600 p-3 rounded-r-md">
                                      <p className="text-sm font-bold text-red-800 dark:text-red-200">{comment.authorName} (Handledare)</p>
                                      <p className="text-xs text-red-700 dark:text-red-300 mb-1">{comment.timestamp.toLocaleDateString('sv-SE')}</p>
                                      <p className="text-sm text-red-900 dark:text-red-100">{comment.text}</p>
                                  </div>
                              ))}
                          </div>
                      )}
                    </div>
                  );
                })
            ) : (
                <div className="text-center text-gray-500 dark:text-slate-400 py-8 flex flex-col items-center">
                    <svg className="w-24 h-24 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 6.253v11.494m-9-8.494h18m-18 5.494h18M5.494 12l1.503-3.006a.55.55 0 01.992 0L9 12m-3.506 0l1.503 3.006a.55.55 0 00.992 0L9 12m6 0l-1.503-3.006a.55.55 0 01.992 0L15 12m-3.506 0l1.503 3.006a.55.55 0 00.992 0L15 12" /></svg>
                    <h4 className="text-lg font-bold mt-4">Tom loggbok</h4>
                    <p className="max-w-xs mx-auto mt-1">Du har inte skrivit några inlägg ännu. Använd formuläret till vänster för att börja reflektera.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {isIncidentModalOpen && (
        <Modal title="Analysera en kritisk incident" onClose={() => setIsIncidentModalOpen(false)}>
            <div className="space-y-4">
                {renderIncidentField('Situation', 'situation', 'Beskriv händelsen objektivt. Vad hände?')}
                {renderIncidentField('Mina Tankar & Känslor', 'thoughtsAndFeelings', 'Vad gick igenom ditt huvud? Vad kände du?')}
                {renderIncidentField('Mina Handlingar', 'actions', 'Vad gjorde du (och vad gjorde du inte)?')}
                {renderIncidentField('Resultat & Konsekvenser', 'outcomes', 'Vad blev utfallet för patienten, dig själv och andra?')}
                {renderIncidentField('Analys & Lärdom', 'analysis', 'Vad skulle du göra annorlunda nästa gång? Vad har du lärt dig?')}
            </div>
            <div className="flex justify-end gap-4 mt-6">
                <button onClick={() => setIsIncidentModalOpen(false)} className="bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200 font-bold py-2 px-6 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors btn-press">
                    Avbryt
                </button>
                <button onClick={handleSaveIncident} className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition-colors btn-press">
                    Spara Analys
                </button>
            </div>
        </Modal>
      )}
      {showAnalysis && (
        <Modal title="AI-analys av dina reflektioner" onClose={() => setShowAnalysis(false)}>
            {isAnalyzing ? (
                 <div className="text-center p-8">
                    <p className="text-gray-600 dark:text-slate-300">Analyserar dina inlägg, vänligen vänta...</p>
                </div>
            ) : (
                <div 
                    className="prose prose-sm max-w-none dark:prose-invert" 
                    dangerouslySetInnerHTML={{ __html: analysisResult.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                />
            )}
        </Modal>
      )}
       <style>{`
        @keyframes flash-bg {
          0%, 100% { background-color: var(--initial-bg, #f9fafb); }
          50% { background-color: #e0e7ff; }
        }
        html.dark @keyframes flash-bg {
          0%, 100% { background-color: var(--initial-bg, rgba(51, 65, 85, 0.5)); }
          50% { background-color: rgba(49, 46, 129, 0.5); }
        }
        .animate-flash {
          animation: flash-bg 1.5s ease-in-out;
        }
      `}</style>
    </>
  );
};

export default memo(Logbook);