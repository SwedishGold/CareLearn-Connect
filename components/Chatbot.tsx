import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { User, ChatMessage, UserData, View, CustomDocument } from '../types';
import { getAIChatResponseStream, generateAIPatientPersona, generateSafeQueryExample } from '../services/geminiService';
import { checkTextForPII, sanitizeText, sanitizeAIResponse } from '../services/securityService'; 
import { ICONS, APP_DATA } from '../constants';
import * as storage from '../services/localStorageService';
import { Modal, InfoTooltip } from './UI';
import { playMessageSent, playMessageReceived, playAlert } from '../services/soundService';
import SupervisorChatbot from './SupervisorChatbot';

interface ChatbotProps {
  user: User;
  userData: UserData;
  onUpdateUserData: (newUserData: Partial<UserData>) => void;
  onAccountDeletion: () => void;
  initialMessage?: string;
  onClearInitialMessage?: () => void;
  setView: (view: View) => void;
  setIsOpen: (isOpen: boolean) => void;
}

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
    <div className="mt-2 text-xs pl-11">
      {sources.length > 0 && (
        <div className="mb-2">
          <button onClick={() => setSourcesExpanded(!sourcesExpanded)} className="font-semibold text-slate-500 hover:text-slate-300 flex items-center gap-1">
            Källor ({sources.length})
            <svg className={`w-4 h-4 transition-transform ${sourcesExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
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
            <div className="w-8 h-8 p-1.5 bg-gray-200 dark:bg-slate-700 rounded-full flex-shrink-0 text-slate-700 dark:text-slate-200">{ICONS.ai}</div>
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
            <div className={`max-w-2xl p-3 rounded-lg relative ${
                msg.sender === 'user' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-slate-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200'
            }`}>
                <div 
                    className={`whitespace-pre-wrap ${msg.sender === 'bot' && isLoading && isLast ? 'typing-cursor' : ''}`}
                    dangerouslySetInnerHTML={{ __html: msg.text ? msg.text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') : '...' }}
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

const Chatbot: React.FC<ChatbotProps> = ({ user, userData, onUpdateUserData, onAccountDeletion, initialMessage, onClearInitialMessage, setView, setIsOpen }) => {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRolePlaying, setIsRolePlaying] = useState(false);
  const [flaggingState, setFlaggingState] = useState<{ index: number; reason: string } | null>(null);
  const [flagConfirmation, setFlagConfirmation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatView, setChatView] = useState<'chat' | 'scenarios' | 'persona-generator'>('chat');
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [docCount, setDocCount] = useState(0); 
  
  useEffect(() => {
    const fetchData = async () => {
        const initialData = await storage.loadUserData(user.id);
        setHistory(initialData?.chatHistory || []);
        const docs = await storage.getCustomDocuments(user.workplace, user.role);
        setDocCount(docs.length);
    };
    fetchData();
  }, [user.id, user.workplace, user.role]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, chatView]);

  const handleSend = useCallback(async (messageToSend?: string) => {
    const text = (messageToSend || input).trim();
    if (!text || isLoading) return;
    
    playMessageSent();

    let rolePlayingStatus = isRolePlaying;
    const lowercasedText = text.toLowerCase();

    if (lowercasedText.startsWith('starta scenario:') || lowercasedText.startsWith('starta ett rollspel med följande')) {
        rolePlayingStatus = true;
        setIsRolePlaying(true);
    } else if (lowercasedText === 'avsluta scenario') {
        rolePlayingStatus = false;
        setIsRolePlaying(false);
    }

    const piiCheck = checkTextForPII(text);
    if (!piiCheck.safe) {
        playAlert(); 
        const currentWarnings = userData.gdprWarningCount || 0;
        const newWarnings = currentWarnings + 1;
        
        const warningText = `**GDPR-VARNING ${newWarnings}/3**\n\n${piiCheck.reason}\n\n**Meddelandet blockerades.** Din fråga skickades aldrig till AI:n.\nDu har identifierat en patient (eller använt format som liknar personuppgifter) vilket bryter mot våra säkerhetsregler. Vid 3 varningar raderas kontot.`;
        
        const warningMessage: ChatMessage = { 
            id: `bot-warn-${Date.now()}`, 
            sender: 'bot', 
            text: warningText, 
            isWarning: true 
        };
        
        const sanitizedInput = sanitizeText(text);
        const userMessage: ChatMessage = { id: `user-${Date.now()}`, sender: 'user', text: sanitizedInput + " [BLOCKERAD]" };
        
        const newHistory = [...history, userMessage, warningMessage];

        setHistory(newHistory);
        setInput('');
        onUpdateUserData({
            chatHistory: newHistory,
            gdprWarningCount: newWarnings
        });
        
        if (newWarnings >= 3) {
            setShowDeletionModal(true);
        }
        return;
    }

    const newUserMessage: ChatMessage = { id: `user-${Date.now()}`, sender: 'user', text };
    const historyWithUserMessage = [...history, newUserMessage];
    
    setHistory([...historyWithUserMessage, { id: `bot-load-${Date.now()}`, sender: 'bot', text: '' }]);
    setInput('');
    setIsLoading(true);

    try {
      const responseStream = await getAIChatResponseStream(user, historyWithUserMessage, userData, rolePlayingStatus);
      
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
      
      const safeBotResponse = sanitizeAIResponse(botResponseText);
      
      if (safeBotResponse !== botResponseText) {
          setHistory(prev => {
              const newHistory = [...prev];
              newHistory[newHistory.length - 1].text = safeBotResponse;
              return newHistory;
          });
      }
      
      onUpdateUserData({ chatHistory: [...historyWithUserMessage, { id: `bot-resp-${Date.now()}`, sender: 'bot', text: safeBotResponse }] });

    } catch (error) {
      console.error("Chatbot error:", error);
      const errorMessage: ChatMessage = { id: `bot-err-${Date.now()}`, sender: 'bot', text: 'Ursäkta, ett fel uppstod. Försök igen.' };
      setHistory([...historyWithUserMessage, errorMessage]);
      onUpdateUserData({ chatHistory: [...historyWithUserMessage, errorMessage] });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, isRolePlaying, history, userData, onUpdateUserData, user]);

  useEffect(() => {
    if (initialMessage && onClearInitialMessage) {
        handleSend(initialMessage);
        onClearInitialMessage();
    }
  }, [initialMessage, onClearInitialMessage, handleSend]);

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
        const initialMessage: ChatMessage = {
            id: `bot-init-${Date.now()}`,
            sender: 'bot',
            text: `Hej ${user.name}! Jag är din personliga AI-Handledare. Jag kan hjälpa dig att förstå rutiner, svara på frågor om omvårdnad eller agera bollplank för reflektion. Kom ihåg att aldrig skriva patientuppgifter här.`
        };
        setHistory([initialMessage]);
        onUpdateUserData({ chatHistory: [initialMessage] });
        setShowClearHistoryModal(false);
  }, [user.name, onUpdateUserData]);

  const handleSourceClick = (title: string) => { setView('modules'); setIsOpen(false); };
  const handleElaborate = () => { handleSend("Ja, förklara mer detaljerat."); };
  const sourceRegex = /SOURCES:\[(.*?)\]$/;

  return (
    <div className="flex flex-col h-full w-full bg-transparent rounded-lg">
        {docCount > 0 && (
             <div className="bg-indigo-900/30 border-b border-indigo-800/50 p-2 flex items-center justify-center text-xs text-indigo-300 font-mono gap-2">
                {React.cloneElement(ICONS.brain, { className: "w-3 h-3" })}
                <span>Ansluten till Kunskapsbank ({docCount} dokument)</span>
            </div>
        )}

        <main ref={chatContainerRef} className="flex-1 p-6 overflow-y-auto space-y-4">
            {history.map((msg, index) => {
                const mainText = msg.text ? msg.text.replace(sourceRegex, '').trim() : '';
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
                    <span>Tänker...</span>
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
                    placeholder="Ställ en fråga..."
                    className="flex-1 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-800 placeholder-slate-400 text-slate-100 border-slate-600"
                    disabled={isLoading}
                />
                <button
                    onClick={() => handleSend()}
                    disabled={isLoading}
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
  );
};

export default memo(Chatbot);
