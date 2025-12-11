
import React, { useState, useEffect } from 'react';
import { FlaggedContentEntry } from '../types';
import * as storage from '../services/localStorageService';
import { Modal } from './UI';
import { ICONS } from '../constants';

const FlaggedContentViewer: React.FC = () => {
    const [flaggedContent, setFlaggedContent] = useState<FlaggedContentEntry[]>([]);
    const [selectedEntry, setSelectedEntry] = useState<FlaggedContentEntry | null>(null);

    const loadContent = async () => {
        const content = await storage.loadFlaggedContent();
        const sortedContent = content.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setFlaggedContent(sortedContent);
    };

    useEffect(() => {
        loadContent();
    }, []);

    const handleUpdateStatus = (id: string, status: 'new' | 'reviewed') => {
        storage.updateFlaggedContentStatus(id, status);
        loadContent();
        if(selectedEntry?.id === id) {
            setSelectedEntry({...selectedEntry, status});
        }
    };
    
    const newFlags = flaggedContent.filter(f => f.status === 'new').length;

    return (
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-lg shadow-md border dark:border-slate-700">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Granska flaggat innehåll</h2>
            <p className="text-gray-600 mb-6">Här är AI-svar som användare har flaggat som problematiska. Du har <span className="font-bold">{newFlags}</span> ogranskade flaggningar.</p>
            
            <div className="space-y-3">
                {flaggedContent.length > 0 ? (
                    flaggedContent.map(entry => (
                        <button key={entry.id} onClick={() => setSelectedEntry(entry)} className="w-full text-left p-4 rounded-lg border bg-gray-50 hover:bg-indigo-50 hover:border-indigo-400 transition-colors flex items-center gap-4">
                            <span className={`h-3 w-3 rounded-full flex-shrink-0 ${entry.status === 'new' ? 'bg-orange-500' : 'bg-green-500'}`} title={entry.status === 'new' ? 'Ny' : 'Granskad'}></span>
                            <div className="flex-1">
                                <p className="font-semibold text-gray-800">Flaggad av: {entry.user.name} ({entry.user.role})</p>
                                <p className="text-sm text-gray-500">{entry.timestamp.toLocaleString('sv-SE')}</p>
                            </div>
                            <span className="text-sm font-medium text-indigo-600">Visa konversation &rarr;</span>
                        </button>
                    ))
                ) : (
                    <p className="text-center text-gray-500 py-8">Inget innehåll har flaggats ännu.</p>
                )}
            </div>

            {selectedEntry && (
                <Modal title={`Flaggad konversation från ${selectedEntry.user.name}`} onClose={() => setSelectedEntry(null)}>
                     <div className="my-4 p-4 border-l-4 rounded-r-lg bg-orange-50 border-orange-400">
                        <h4 className="font-bold text-orange-800">Användarens motivering:</h4>
                        <p className="text-orange-900 mt-1 italic">"{selectedEntry.reason}"</p>
                    </div>

                    <div className="space-y-4 max-h-[60vh]">
                        {selectedEntry.chatHistory.map((msg, index) => (
                            <div key={index} className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.sender === 'bot' && (
                                    <div className="w-8 h-8 p-1.5 bg-gray-200 rounded-full flex-shrink-0">{ICONS.ai}</div>
                                )}
                                <div className={`max-w-2xl p-3 rounded-lg ${msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'} ${index === selectedEntry.flaggedMessageIndex ? 'ring-2 ring-orange-500' : ''}`}>
                                    <div className="flex items-center gap-2">
                                        <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br>') }}></p>
                                        {msg.feedback === 'liked' && <span className="text-2xl">👍</span>}
                                        {msg.feedback === 'disliked' && <span className="text-2xl">👎</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                     <div className="mt-6 pt-4 border-t flex justify-end items-center gap-4">
                        <span className="text-sm font-semibold">Status: <span className={`capitalize px-2 py-1 rounded-full text-xs ${selectedEntry.status === 'new' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>{selectedEntry.status}</span></span>
                         {selectedEntry.status === 'new' ? (
                            <button onClick={() => handleUpdateStatus(selectedEntry.id, 'reviewed')} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">Markera som granskad</button>
                         ) : (
                            <button onClick={() => handleUpdateStatus(selectedEntry.id, 'new')} className="bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-600">Markera som ny</button>
                         )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default FlaggedContentViewer;
