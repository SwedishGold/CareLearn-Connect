
import React, { useState, useEffect, memo } from 'react';
import { User, ChatMessage } from '../types';
import * as storage from '../services/localStorageService';
import { ICONS } from '../constants';

interface FeedbackItem {
    user: User;
    userPrompt: ChatMessage | null;
    botResponse: ChatMessage;
}

const AIFeedbackViewer: React.FC = memo(() => {
    const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
    const [filter, setFilter] = useState<'all' | 'liked' | 'disliked'>('all');

    useEffect(() => {
        const fetchFeedback = async () => {
            const allUserData = await storage.getAllUserDataForAdmin();
            const items: FeedbackItem[] = [];

            allUserData.forEach(({ user, data }) => {
                const history = data.chatHistory || [];
                history.forEach((msg, index) => {
                    if (msg.sender === 'bot' && msg.feedback) {
                        const userPrompt = index > 0 && history[index - 1].sender === 'user' ? history[index - 1] : null;
                        items.push({
                            user,
                            userPrompt,
                            botResponse: msg,
                        });
                    }
                });
            });
            
            // Sort by most recent feedback first, using the timestamp in the ID
            items.sort((a, b) => {
                const timeA = parseInt(a.botResponse.id.split('-').pop() || '0');
                const timeB = parseInt(b.botResponse.id.split('-').pop() || '0');
                return timeB - timeA;
            });

            setFeedbackItems(items);
        };
        fetchFeedback();
    }, []);

    const filteredItems = feedbackItems.filter(item => {
        if (filter === 'all') return true;
        return item.botResponse.feedback === filter;
    });

    return (
        <div className="card-base p-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Granska AI-Feedback</h2>
            <p className="mt-2 mb-6 text-gray-600 dark:text-slate-400">Här samlas de AI-svar som studenter och handledare har gett feedback på (tumme upp/ner). Använd detta för att identifiera mönster och förbättra AI-assistentens instruktioner och prestanda.</p>

            <div className="flex items-center gap-2 mb-6 p-2 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                <button onClick={() => setFilter('all')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-colors ${filter === 'all' ? 'bg-red-500 text-white' : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>Alla ({feedbackItems.length})</button>
                <button onClick={() => setFilter('liked')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-colors ${filter === 'liked' ? 'bg-green-500 text-white' : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>👍 Positiva ({feedbackItems.filter(i => i.botResponse.feedback === 'liked').length})</button>
                <button onClick={() => setFilter('disliked')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-colors ${filter === 'disliked' ? 'bg-yellow-500 text-white' : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>👎 Negativa ({feedbackItems.filter(i => i.botResponse.feedback === 'disliked').length})</button>
            </div>

            <div className="space-y-4">
                {filteredItems.length > 0 ? (
                    filteredItems.map((item, index) => (
                        <div key={index} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border dark:border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Feedback från: <span className="font-semibold">{item.user.name}</span>
                                </p>
                                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${
                                    item.botResponse.feedback === 'liked'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                                }`}>
                                    {item.botResponse.feedback === 'liked' ? '👍 Positiv' : '👎 Negativ'}
                                </div>
                            </div>

                            {item.userPrompt && (
                                <div className="mb-2 p-3 rounded-lg bg-slate-200 dark:bg-slate-900/50">
                                    <p className="font-semibold text-sm text-slate-600 dark:text-slate-300">Användarens fråga:</p>
                                    <p className="italic text-slate-800 dark:text-slate-200">"{item.userPrompt.text}"</p>
                                </div>
                            )}
                            <div className={`p-3 rounded-lg border-l-4 ${item.botResponse.feedback === 'liked' ? 'border-green-500' : 'border-red-500'}`}>
                                <p className="font-semibold text-sm text-slate-600 dark:text-slate-300">AI:ns svar:</p>
                                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{item.botResponse.text}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-slate-500 dark:text-slate-400 py-8">Ingen feedback av denna typ har registrerats ännu.</p>
                )}
            </div>
        </div>
    );
});

export default AIFeedbackViewer;
