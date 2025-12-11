
// components/SupervisorChatbot.tsx
import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import * as storage from '../services/localStorageService';
import { getSupervisorChatResponseStream, containsSensitiveInfo, generateSafeQueryExample } from '../services/geminiService';
import { User, UserData, ChatMessage, View, CustomDocument } from '../types';
import { ICONS, APP_DATA } from '../constants';
import { Modal } from './UI';
import { playMessageSent, playMessageReceived } from '../services/soundService';

interface SupervisorChatbotProps {
    user: User;
    userData: UserData;
    onUpdateUserData: (data: Partial<UserData>) => void;
    studentData: { user: User; data: UserData }[];
    onAccountDeletion: () => void;
    setView: (view: View) => void;
    setIsOpen: (isOpen: boolean) => void;
}

// ... (Keep MessageAddons and MemoizedChatMessage as is)
const MessageAddons: React.FC<{
  messageText: string;
  isLastBotMessage: boolean;
  onSourceClick: (title: string) => void;
  onElaborate: () => void;
}> = memo(({ messageText, isLastBotMessage, onSourceClick, onElaborate }) => {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  
  const sourceRegex = /SOURCES:\[(.*?)\]$/;
  const sourceMatch = messageText.match(sourceRegex);
  const sources = sourceMatch ? sourceMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];
  
  const showElaborateButton = isLastBotMessage && messageText.includes("Vill du ha en mer detaljerad förklaring?");

  if (sources.length === 0 && !showElaborateButton) {
    return null;
  }

  return (
    <div className="mt-2 text-xs pl-11"> {/* Align with bot message */}
      {sources.length > 0 && (
        <div className="mb-2">
          <button onClick={() => setSourcesExpanded(!sourcesExpanded)} className="font-semibold text-slate-500 hover:text-slate-300 flex items-center gap-1">
            Källor ({sources.length})
            <svg className={`w-4 h-4 transition-transform ${sourcesExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </button>
          {sourcesExpanded && (
            <div className="mt-1 p-2 bg-slate-200 dark:bg-slate-800 rounded-md space-y-1 animate-fade-in-fast">
              {sources.map(title => (
                <a key={title} href="#" onClick={(e) => { e.preventDefault(); onSourceClick(title); }} className="block text-indigo-600 dark:text-indigo-400 hover:underline">
                  - {title}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
      {showElaborateButton && (
        <div className="mt-2">
          <button onClick={onElaborate} className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold py-1 px-3 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 text-sm btn-press">
            Ja, förklara mer detaljerat
          </button>
        </div>
      )}
       <style>{`
        @keyframes fade-in-fast {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .animate-fade-in-fast { animation: fade-in-fast 0.2s ease-out; }
      `}</style>
    </div>
  );
});

const MemoizedChatMessage: React.FC<{
  msg: ChatMessage;
  isLoading: boolean;
  isLast: boolean;
  onFeedback: (feedback: 'liked' | 'disliked') => void;
  onFlag: () => void;
}> = memo(({ msg, isLoading, isLast, onFeedback, onFlag }) => {
  return (
    <div className={`flex items-start gap-2.5 group ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
        {msg.sender === 'bot' && !msg.isWarning && (
            <div className="w-8 h-8 p-1.5 bg-gray-200 dark:bg-slate-700 rounded-full flex-shrink-0">{ICONS.ai}</div>
        )}

        {msg.isWarning ? (
            <div className="max-w-2xl p-4 my-2 rounded-lg border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20">
                <div className="flex items-start gap-3">
                    <div className="text-red-500 w-6 h-6 flex-shrink-0 mt-1">{ICONS.warning}</div>
                    <div className="prose prose-sm max-w-none text-red-900 dark:text-red-200">
                        <p 
                            className="whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong class="text-red-950 dark:text-red-100">$1</strong>') }}
                        ></p>
                    </div>
                </div>
            </div>
        ) : (
            <div className={`max-w-2xl p-3 rounded-lg relative ${msg.sender === 'user' ? 'chat-bubble-user' : 'chat-bubble-bot'}`}>
                <div 
                    className={`whitespace-pre-wrap ${msg.sender === 'bot' && isLoading && isLast ? 'typing-cursor' : ''}`}
                    dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                ></div>
            </div>
        )}

        {msg.sender === 'bot' && !msg.isWarning && !isLoading && (
            <div className="self-center flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onFeedback('liked')} title="Bra svar" className="transition-transform transform hover:scale-125 focus:outline-none">
                    <span className={`text-2xl transition-colors ${msg.feedback === 'liked' ? 'text-green-500' : 'text-gray-400 hover:text-green-500'}`}>👍</span>
                </button>
                <button onClick={() => onFeedback('disliked')} title="Dåligt svar" className="transition-transform transform hover:scale-125 focus:outline-none">
                    <span className={`text-2xl transition-colors ${msg.feedback === 'disliked' ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}>👎</span>
                </button>
                <button onClick={onFlag} title="Flagga svar" className="p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600 hover:text-orange-500 transition-colors duration-200">
                    {ICONS.flag}
                </button>
            </div>
        )}
    </div>
  );
});

const SupervisorChatbot: React.FC<SupervisorChatbotProps> = ({ user, userData, onUpdateUserData, studentData, onAccountDeletion, setView, setIsOpen }) => {
    const [history, setHistory] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [flaggingState, setFlaggingState] = useState<{ index: number; reason: string } | null>(null);
    const [flagConfirmation, setFlagConfirmation] = useState(false);
    const [showDeletionModal, setShowDeletionModal] = useState(false);
    const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Load history from userData or set initial message based on role
        const getInitialMessage = () => {
            if (user.role === 'admin') {
                return `Hej ${user.name}. Jag är din AI-Strateg. Jag har tillgång till aggregerad data från alla användare. Fråga mig om trender, analys, eller be om rekommendationer för att förbättra plattformen.`;
            }
            if (user.role === 'developer') {
                return `Hej ${user.name}. Jag är din System-Arkitekt. Jag har full insyn i systemets parametrar. Vad vill du diskutera kring arkitektur, kod eller features?`;
            }
            return `Hej ${user.name}! Jag är din AI-assistent. Jag har tillgång till all data för dina ${studentData.length} studenter. Fråga mig något, till exempel "Vem behöver mest stöd?" eller "Ge mig en sammanfattning av Stinas loggbok".`;
        };
    
        const initialHistory: ChatMessage[] = userData.chatHistory && userData.chatHistory.length > 1 
            ? userData.chatHistory
            : [{
                id: `bot-init-${Date.now()}`,
                sender: 'bot',
                text: getInitialMessage()
              }];
        setHistory(initialHistory);
    }, [userData.chatHistory, studentData.length, user.role, user.name]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [history]);

    const handleSend = useCallback(async (messageToSend?: string) => {
        const text = (messageToSend || input).trim();
        if (!text || isLoading) return;
        
        playMessageSent();

        // GDPR Check for sensitive info
        if (containsSensitiveInfo(text)) {
            const currentWarnings = userData.gdprWarningCount || 0;
            const newWarnings = currentWarnings + 1;

            const safeExample = await generateSafeQueryExample(text);

            const warningText = `**VARNING ${newWarnings} AV 3**\n\nDin fråga innehåller information som kan vara patientkänslig. Det är ett allvarligt brott mot sekretesslagen. **AI-assistenten har inte behandlat din fråga.**\n\nFörsök att omformulera frågan generellt. Istället för din fråga kunde du till exempel ha skrivit:\n*"${safeExample}"*\n\nVid en tredje varning kommer ditt konto automatiskt att raderas.`;

            const userMessage: ChatMessage = { id: `user-${Date.now()}`, sender: 'user', text };
            const warningMessage: ChatMessage = { id: `bot-warn-${Date.now()}`, sender: 'bot', text: warningText, isWarning: true };
            const newHistory = [...history, userMessage, warningMessage];
            
            setHistory(newHistory);
            setInput('');
            onUpdateUserData({
                chatHistory: newHistory,
                gdprWarningCount: newWarnings
            });
            
            if (newWarnings >= 3) {
                setShowDeletionModal(true);
                return;
            }
            
            return; // Stop execution here
        }

        const newUserMessage: ChatMessage = { id: `user-${Date.now()}`, sender: 'user', text };
        const historyWithUserMessage = [...history, newUserMessage];

        setHistory([...historyWithUserMessage, { id: `bot-load-${Date.now()}`, sender: 'bot', text: '' }]);
        setInput('');
        setIsLoading(true);

        try {
            const responseStream = await getSupervisorChatResponseStream(user, historyWithUserMessage, studentData);
            
            let botResponseText = '';
            let firstChunkReceived = false;
            for await (const chunk of responseStream) {
                if (!firstChunkReceived) {
                    playMessageReceived();
                    firstChunkReceived = true;
                }
                botResponseText += chunk;
                setHistory(prev => {
                    const newHistory = [...prev];
                    newHistory[newHistory.length - 1].text = botResponseText;
                    return newHistory;
                });
            }
            onUpdateUserData({ chatHistory: [...historyWithUserMessage, { id: `bot-resp-${Date.now()}`, sender: 'bot', text: botResponseText }] });
        } catch (error) {
            console.error("Supervisor Chatbot error:", error);
            const errorMessage: ChatMessage = { id: `bot-err-${Date.now()}`, sender: 'bot', text: 'Ursäkta, ett fel uppstod när jag analyserade studentdata. Försök igen.' };
            const newHistory = [...historyWithUserMessage, errorMessage];
            setHistory(newHistory);
            onUpdateUserData({ chatHistory: newHistory });
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, history, studentData, onUpdateUserData, user, userData.gdprWarningCount]);

    const handleFeedback = useCallback((index: number, feedback: 'liked' | 'disliked') => {
        const newHistory = [...history];
        const message = newHistory[index];
        if (message.feedback === feedback) {
            delete message.feedback;
        } else {
            message.feedback = feedback;
        }
        setHistory(newHistory);
        onUpdateUserData({ chatHistory: newHistory });
    }, [history, onUpdateUserData]);

    const handleFlagSubmit = useCallback(() => {
        if (flaggingState && flaggingState.reason.trim()) {
            storage.saveFlaggedContent(user, history, flaggingState.index, flaggingState.reason);
            setFlaggingState(null);
            setFlagConfirmation(true);
            setTimeout(() => setFlagConfirmation(false), 4000);
        }
    }, [flaggingState, user, history]);

    const handleClearHistory = useCallback(() => {
        const getInitialMessage = () => {
            if (user.role === 'admin') {
                return `Hej ${user.name}. Jag är din AI-Strateg. All data är nu rensad. Ställ en ny fråga för att påbörja en ny analys.`;
            }
            if (user.role === 'developer') {
                return `Hej ${user.name}. Jag är din System-Arkitekt. Historiken är rensad. Vad ska vi titta på nu?`;
            }
            return `Hej ${user.name}! Jag är din AI-assistent. Konversationen är rensad. Fråga mig något nytt om dina ${studentData.length} studenter.`;
        };
        
        const initialMessage: ChatMessage = {
            id: `bot-init-${Date.now()}`,
            sender: 'bot',
            text: getInitialMessage()
        };
        onUpdateUserData({ chatHistory: [initialMessage] });
        setShowClearHistoryModal(false);
    }, [onUpdateUserData, studentData.length, user.role, user.name]);

     const handleSourceClick = (title: string) => {
        setView('modules');
        setIsOpen(false);
    };

    const handleElaborate = () => {
        handleSend("Ja, förklara mer detaljerat.");
    };
    
    const sourceRegex = /SOURCES:\[(.*?)\]$/;

    return (
        <>
            <div className="flex flex-col h-full w-full bg-transparent rounded-lg">
                <main ref={chatContainerRef} className="flex-1 p-6 overflow-y-auto space-y-1">
                    {history.map((msg, index) => {
                        const mainText = msg.text.replace(sourceRegex, '').trim();
                        const isLastMessage = index === history.length - 1;
                        return (
                            <div key={index}>
                               <MemoizedChatMessage
                                  msg={{...msg, text: mainText}}
                                  isLoading={isLoading}
                                  isLast={isLastMessage}
                                  onFeedback={(feedback) => handleFeedback(index, feedback)}
                                  onFlag={() => setFlaggingState({ index, reason: '' })}
                                />
                                {msg.sender === 'bot' && !isLoading && !msg.isWarning && (
                                    <MessageAddons 
                                        messageText={msg.text}
                                        isLastBotMessage={isLastMessage}
                                        onSourceClick={handleSourceClick}
                                        onElaborate={handleElaborate}
                                    />
                                )}
                            </div>
                        );
                    })}
                    {isLoading && history[history.length - 1]?.sender === 'bot' && history[history.length - 1]?.text === '' && (
                    <div className="flex justify-start">
                        <div className="max-w-lg p-3 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-100">
                        <div className="flex items-center">
                            <div className="dot-pulse mr-2"></div>
                            <span>Analyserar data...</span>
                        </div>
                        </div>
                    </div>
                    )}
                    <div ref={messagesEndRef} />
                </main>

                <footer className="p-4 border-t border-white/10 flex-shrink-0">
                    {flagConfirmation && <p className="text-center text-green-600 dark:text-green-400 text-sm mb-2 font-semibold">Tack! Din feedback har skickats till admin.</p>}
                    <div className="flex items-center gap-2">
                         <button
                            onClick={() => setShowClearHistoryModal(true)}
                            className="p-3 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-md transition-colors"
                            title="Rensa chathistorik"
                            disabled={isLoading}
                        >
                            {ICONS.trash}
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                            placeholder={studentData.length > 0 || user.role === 'admin' || user.role === 'developer' ? "Ställ en fråga..." : "Inga studenter att fråga om."}
                            className="flex-1 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-800 placeholder-slate-400 text-slate-100 border-slate-600"
                            disabled={isLoading || (studentData.length === 0 && user.role !== 'admin' && user.role !== 'developer')}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={isLoading || (studentData.length === 0 && user.role !== 'admin' && user.role !== 'developer')}
                            className="bg-red-600 text-white font-bold py-3 px-6 rounded-md hover:bg-red-700 disabled:bg-red-400 transition-colors duration-200"
                        >
                            Skicka
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 text-center mt-2 px-4">AI-svar kan innehålla fel. Dubbelkolla alltid kritisk information med din handledare eller i styrdokument.</p>
                </footer>
                <style>{`
                    .dot-pulse {
                        position: relative; left: -9999px; width: 10px; height: 10px; border-radius: 5px; background-color: #4f46e5; color: #4f46e5; box-shadow: 9999px 0 0 -5px; animation: dot-pulse 1.5s infinite linear; animation-delay: .25s;
                    }
                    .dot-pulse::before, .dot-pulse::after {
                        content: ''; display: inline-block; position: absolute; top: 0; width: 10px; height: 10px; border-radius: 5px; background-color: #4f46e5; color: #4f46e5;
                    }
                    html.dark .dot-pulse, html.dark .dot-pulse::before, html.dark .dot-pulse::after { background-color: #818cf8; color: #818cf8; }
                    .dot-pulse::before { box-shadow: 9984px 0 0 -5px; animation: dot-pulse-before 1.5s infinite linear; animation-delay: 0s; }
                    .dot-pulse::after { box-shadow: 10014px 0 0 -5px; animation: dot-pulse-after 1.5s infinite linear; animation-delay: .5s; }
                    @keyframes dot-pulse-before { 0% { box-shadow: 9984px 0 0 -5px } 30% { box-shadow: 9984px 0 0 2px } 60%, 100% { box-shadow: 9984px 0 0 -5px } }
                    @keyframes dot-pulse { 0% { box-shadow: 9999px 0 0 -5px } 30% { box-shadow: 9999px 0 0 2px } 60%, 100% { box-shadow: 9999px 0 0 -5px } }
                    @keyframes dot-pulse-after { 0% { box-shadow: 10014px 0 0 -5px } 30% { box-shadow: 10014px 0 0 2px } 60%, 100% { box-shadow: 10014px 0 0 -5px } }
                `}</style>
            </div>
             {flaggingState !== null && (
                <Modal title="Rapportera problematiskt svar" onClose={() => setFlaggingState(null)}>
                <p className="mb-4 text-slate-300">Du är på väg att flagga detta AI-svar. Förklara nedan varför du anser att svaret är felaktigt, partiskt eller på annat sätt problematiskt.</p>
                <textarea
                    value={flaggingState.reason}
                    onChange={(e) => setFlaggingState({ ...flaggingState, reason: e.target.value })}
                    className="w-full h-32 p-2 border rounded-md focus:ring-2 focus:ring-red-500 bg-slate-700 text-slate-100 placeholder-slate-400"
                    placeholder="Min motivering är..."
                />
                <div className="flex justify-end gap-4 mt-4">
                    <button onClick={() => setFlaggingState(null)} className="bg-slate-600 text-slate-100 font-bold py-2 px-4 rounded-lg hover:bg-slate-500 transition-colors duration-200">
                    Avbryt
                    </button>
                    <button
                    onClick={handleFlagSubmit}
                    disabled={!flaggingState.reason.trim()}
                    className="bg-orange-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-600 disabled:bg-orange-300 transition-colors duration-200"
                    >
                    Skicka rapport
                    </button>
                </div>
                </Modal>
            )}
             {showDeletionModal && (
                <Modal title="Konto Raderas" onClose={() => {}}>
                    <div className="text-center">
                        <p className="text-lg font-semibold text-red-400 mb-4">
                            Ditt konto har raderats på grund av upprepade (3) överträdelser mot reglerna för hantering av patientdata.
                        </p>
                        <p className="text-slate-300 mb-6">
                            Detta är en automatisk säkerhetsåtgärd för att skydda patientintegriteten. Du kommer nu att loggas ut.
                        </p>
                        <button
                            onClick={onAccountDeletion}
                            className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition-colors duration-200"
                        >
                            Jag förstår
                        </button>
                    </div>
                </Modal>
            )}
             {showClearHistoryModal && (
                <Modal title="Rensa chathistorik" onClose={() => setShowClearHistoryModal(false)}>
                    <p>Är du säker på att du vill radera hela din konversation med AI-assistenten? Detta kan inte ångras.</p>
                    <div className="flex justify-end gap-4 mt-6">
                        <button onClick={() => setShowClearHistoryModal(false)} className="bg-slate-600 text-slate-100 font-bold py-2 px-4 rounded-lg hover:bg-slate-500">
                            Avbryt
                        </button>
                        <button onClick={handleClearHistory} className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600">
                            Ja, rensa historiken
                        </button>
                    </div>
                </Modal>
            )}
        </>
    );
};

export default memo(SupervisorChatbot);
