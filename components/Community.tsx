
import React, { useState, useEffect, memo, useCallback } from 'react';
import { User, Role, Post, PostCategory, PostComment } from '../types';
import * as storage from '../services/localStorageService';
import { moderateContent } from '../services/geminiService';
import { ICONS, ROLE_ICONS } from '../constants';
import { playSuccess, playNotification, playClick, playError, playMessageSent, playDelete } from '../services/soundService';
import { InfoTooltip } from './UI';

interface CommunityProps {
    currentUser: User;
}

interface CommunityUser {
    id: string;
    name: string;
    role: Role;
    status: 'online' | 'busy' | 'offline';
    lastActive: string;
    isSimulated?: boolean;
    connectionStatus?: 'none' | 'pending' | 'connected';
}

const CATEGORY_STYLES: Record<PostCategory, { label: string, color: string, bg: string, icon: string }> = {
    'knowledge': { label: 'Lärdom', color: 'text-blue-400', bg: 'bg-blue-900/30', icon: '💡' },
    'question': { label: 'Fråga', color: 'text-orange-400', bg: 'bg-orange-900/30', icon: '❓' },
    'praise': { label: 'Pepp', color: 'text-green-400', bg: 'bg-green-900/30', icon: '🔥' },
    'tip': { label: 'Tips', color: 'text-yellow-400', bg: 'bg-yellow-900/30', icon: '⚠️' },
    'progress': { label: 'Framsteg', color: 'text-purple-200', bg: 'bg-gradient-to-r from-purple-600 to-indigo-600', icon: '🚀' }
};

const FeedItem: React.FC<{ 
    post: Post, 
    currentUser: User,
    onLike: (id: string) => void,
    onComment: (id: string, text: string) => void,
    onDelete: (id: string) => void,
    onEdit: (id: string, newContent: string) => void
}> = ({ post, currentUser, onLike, onComment, onDelete, onEdit }) => {
    const [commentText, setCommentText] = useState('');
    const [showComments, setShowComments] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(post.content);
    
    const handleSubmitComment = (e: React.FormEvent) => {
        e.preventDefault();
        if(commentText.trim()) {
            onComment(post.id, commentText);
            setCommentText('');
        }
    };

    const handleSaveEdit = () => {
        if (editContent.trim()) {
            onEdit(post.id, editContent);
            setIsEditing(false);
        }
    };

    const handleDeletePost = () => {
        if (window.confirm("Är du säker på att du vill ta bort detta inlägg?")) {
            onDelete(post.id);
        }
    };

    const canEdit = currentUser.id === post.authorId;
    const canDelete = canEdit || currentUser.role === 'developer' || currentUser.role === 'admin';

    const style = CATEGORY_STYLES[post.category];
    const isProgress = post.category === 'progress';

    return (
        <div className={`card-base p-5 animate-fade-in mb-4 relative overflow-hidden ${isProgress ? 'border-purple-500/50 bg-gradient-to-br from-white to-purple-50 dark:from-slate-900 dark:to-indigo-900/30' : ''}`}>
            
            {/* Shimmer Effect for Progress Posts */}
            {isProgress && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 animate-pulse"></div>
            )}

            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                        {ROLE_ICONS[post.authorRole] || ICONS.userCircle}
                    </div>
                    <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{post.authorName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(post.timestamp).toLocaleString('sv-SE')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold border ${style.bg} ${style.color} ${isProgress ? 'border-transparent shadow-lg text-white' : 'border-current'}`}>
                        {style.icon} {style.label}
                    </span>
                    {(canEdit || canDelete) && !isEditing && (
                        <div className="flex gap-1 ml-2">
                            {canEdit && (
                                <button onClick={() => setIsEditing(true)} className="p-1 text-slate-400 hover:text-indigo-500 transition-colors" title="Redigera">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                            )}
                            {canDelete && (
                                <button onClick={handleDeletePost} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Radera">
                                    {ICONS.trash}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            <div className={`text-slate-700 dark:text-slate-200 mb-4 whitespace-pre-wrap ${isProgress ? 'text-lg font-medium' : ''}`}>
                {isEditing ? (
                    <div className="space-y-2">
                        <textarea 
                            value={editContent} 
                            onChange={(e) => setEditContent(e.target.value)} 
                            className="w-full p-2 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:outline-none focus:border-indigo-500"
                            rows={3}
                        />
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setIsEditing(false)} className="text-xs px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300">Avbryt</button>
                            <button onClick={handleSaveEdit} className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 font-bold">Spara</button>
                        </div>
                    </div>
                ) : isProgress ? (
                    <span dangerouslySetInnerHTML={{ __html: post.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                ) : (
                    post.content
                )}
            </div>
            
            <div className="flex items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button 
                    onClick={() => onLike(post.id)}
                    className="flex items-center gap-2 text-slate-500 hover:text-red-500 transition-colors text-sm font-semibold active:scale-95 transform"
                >
                    ❤️ {post.likes}
                </button>
                <button 
                    onClick={() => setShowComments(!showComments)}
                    className="flex items-center gap-2 text-slate-500 hover:text-indigo-400 transition-colors text-sm font-semibold"
                >
                    💬 {post.comments.length} Kommentarer
                </button>
            </div>

            {showComments && (
                <div className="mt-4 space-y-3 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                    {post.comments.map(c => (
                        <div key={c.id} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`font-bold text-xs ${c.isAI ? 'text-indigo-400 flex items-center gap-1' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {c.isAI && ICONS.ai}
                                    {c.authorName}
                                </span>
                                <span className="text-[10px] text-slate-400">{new Date(c.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{c.text}</p>
                        </div>
                    ))}
                    <form onSubmit={handleSubmitComment} className="flex gap-2 mt-3">
                        <input 
                            type="text" 
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Skriv en kommentar..."
                            className="flex-1 p-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button type="submit" disabled={!commentText.trim()} className="text-indigo-500 font-bold text-sm hover:text-indigo-400 disabled:opacity-50">
                            Skicka
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

const ConnectionCard: React.FC<{ 
    user: CommunityUser, 
    onConnect: (id: string) => void, 
    onSignal: (id: string) => void,
    onRequestSignature: (id: string) => void
}> = ({ user, onConnect, onSignal, onRequestSignature }) => {
    
    const isSupervisor = user.role.startsWith('handledare') || user.role === 'admin' || user.role === 'huvudhandledare';

    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all rounded-lg p-4 flex flex-col gap-3 group relative overflow-hidden shadow-sm">
            {/* Status Dot */}
            <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${user.status === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : user.status === 'busy' ? 'bg-yellow-500' : 'bg-slate-400'}`}></div>
            
            <div className="flex items-center gap-3">
                <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                    {ROLE_ICONS[user.role] || ICONS.userCircle}
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{user.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user.role.replace('-', ' ')}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
                {user.connectionStatus === 'connected' ? (
                    <>
                        <button 
                            onClick={() => onSignal(user.id)}
                            className="col-span-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold py-2 rounded border border-green-300 dark:border-green-800 flex items-center justify-center gap-1 btn-press"
                        >
                            👋 Skicka Signal
                        </button>
                        {isSupervisor && (
                            <button 
                                onClick={() => onRequestSignature(user.id)}
                                className="col-span-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded transition-colors flex items-center justify-center gap-1 btn-press"
                            >
                                ✍️ Be om Signatur
                            </button>
                        )}
                    </>
                ) : user.connectionStatus === 'pending' ? (
                    <button disabled className="col-span-2 bg-slate-200 dark:bg-slate-700 text-slate-500 text-xs font-bold py-2 rounded cursor-not-allowed">
                        Förfrågan skickad
                    </button>
                ) : (
                    <button 
                        onClick={() => onConnect(user.id)}
                        className="col-span-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold py-2 rounded border border-slate-300 dark:border-slate-600 transition-colors flex items-center justify-center gap-1 btn-press"
                    >
                        🔗 Anslut
                    </button>
                )}
            </div>
        </div>
    );
};

const Community: React.FC<CommunityProps> = memo(({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<'feed' | 'colleagues'>('feed');
    const [colleagues, setColleagues] = useState<CommunityUser[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newPostContent, setNewPostContent] = useState('');
    const [newPostCategory, setNewPostCategory] = useState<PostCategory>('knowledge');
    const [isPosting, setIsPosting] = useState(false);
    const [toasts, setToasts] = useState<{id: string, text: string, type: 'success' | 'info' | 'alert'}[]>([]);
    
    // Derived state for pending requests
    const [pendingRequests, setPendingRequests] = useState<CommunityUser[]>([]);

    const loadColleagues = useCallback(async () => {
        // Load latest user list to get updated connection status
        const allUsers = await storage.loadUsers();
        const realUsers = allUsers.filter(u => u.id !== currentUser.id && u.workplace === currentUser.workplace);
        const myUser = allUsers.find(u => u.id === currentUser.id); // Get fresh user object with connections
        
        const myConnections = myUser?.connections || [];
        const myPending = myUser?.pendingRequests || [];

        // Simulated users for demo feel
        const simulatedUsers: CommunityUser[] = [];
        if (realUsers.length < 3) {
            if (!currentUser.role.startsWith('handledare')) {
                simulatedUsers.push({ id: 'sim-1', name: 'Maria (Handledare)', role: 'handledare-usk', status: 'online', lastActive: 'Nu', isSimulated: true, connectionStatus: 'none' });
            }
            simulatedUsers.push({ id: 'sim-3', name: 'Klara (Student)', role: 'usk-elev', status: 'online', lastActive: '5m', isSimulated: true, connectionStatus: 'none' });
        }

        const all: CommunityUser[] = [
            ...realUsers.map(u => ({ 
                id: u.id, 
                name: u.name, 
                role: u.role, 
                status: 'offline' as const, 
                lastActive: 'Idag',
                connectionStatus: myConnections.includes(u.id) ? 'connected' as const : myPending.includes(currentUser.id) ? 'pending' as const : 'none' as const 
            })),
            ...simulatedUsers
        ];
        
        setColleagues(all);
        
        // Find users who have sent ME a request
        const requestUsers = allUsers.filter(u => (myPending || []).includes(u.id)).map(u => ({
             id: u.id, name: u.name, role: u.role, status: 'offline' as const, lastActive: 'Idag'
        }));
        setPendingRequests(requestUsers);
        
        setIsLoading(false);
    }, [currentUser]);

    useEffect(() => {
        const fetchPosts = async () => {
            const loadedPosts = await storage.loadPosts(currentUser.workplaceId);
            setPosts(loadedPosts);
        };
        fetchPosts();
        loadColleagues();
        // Poll for updates (poor man's websocket)
        const interval = setInterval(loadColleagues, 5000);
        return () => clearInterval(interval);
    }, [loadColleagues, currentUser.workplaceId]);

    const addToast = (text: string, type: 'success' | 'info' | 'alert' = 'info') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, text, type }]);
        if (type === 'success') playSuccess();
        else if (type === 'alert') playError();
        else playNotification();
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // --- Feed Logic ---

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPostContent.trim()) return;

        setIsPosting(true);
        
        try {
            // 1. AI Moderation Check
            const moderation = await moderateContent(newPostContent);
            
            if (!moderation.allowed) {
                playError();
                addToast(`Inlägget stoppades: ${moderation.reason}`, 'alert');
                setIsPosting(false);
                return;
            }

            // 2. Create Post
            const newPost: Post = {
                id: `post-${Date.now()}`,
                authorId: currentUser.id,
                authorName: currentUser.name,
                authorRole: currentUser.role,
                workplace: currentUser.workplace || 'Okänd',
                // Important: Fallback to empty string if undefined to prevent Firestore error
                workplaceId: currentUser.workplaceId || '',
                content: newPostContent.trim(),
                category: newPostCategory,
                timestamp: new Date().toISOString(),
                likes: 0,
                comments: []
            };

            await storage.savePost(newPost);
            
            // 3. AI Auto-Reply (If applicable)
            if (moderation.autoReply) {
                const aiComment: PostComment = {
                    id: `comment-ai-${Date.now()}`,
                    authorName: 'AI-Handledaren',
                    authorRole: 'AI',
                    text: moderation.autoReply,
                    timestamp: new Date().toISOString(),
                    isAI: true
                };
                newPost.comments.push(aiComment);
                await storage.updatePost(newPost.id, () => newPost); 
            }

            setPosts(prev => [newPost, ...prev]);
            setNewPostContent('');
            playMessageSent();
            addToast("Inlägg publicerat! (+50 XP)", 'success');

        } catch (e: any) {
            console.error(e);
            addToast(`Ett fel uppstod vid publicering: ${e.message || 'Okänt fel'}`, 'alert');
        } finally {
            setIsPosting(false);
        }
    };

    const handleLike = async (postId: string) => {
        // Immediate UI feedback
        playClick();
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
        // Persist
        await storage.updatePost(postId, (p) => ({ ...p, likes: p.likes + 1 }));
    };

    const handleComment = async (postId: string, text: string) => {
        playMessageSent();
        const newComment: PostComment = {
            id: `c-${Date.now()}`,
            authorName: currentUser.name,
            authorRole: currentUser.role,
            text,
            timestamp: new Date().toISOString()
        };
        
        await storage.updatePost(postId, (p) => ({ ...p, comments: [...p.comments, newComment] }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p));
    };

    const handleDeletePost = async (postId: string) => {
        playDelete();
        await storage.deletePost(postId);
        setPosts(prev => prev.filter(p => p.id !== postId));
        addToast("Inlägget har raderats.", 'success');
    };

    const handleEditPost = async (postId: string, newContent: string) => {
        playSuccess();
        await storage.updatePost(postId, (p) => ({ ...p, content: newContent }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: newContent } : p));
        addToast("Inlägget har uppdaterats.", 'success');
    };

    // --- Connection Logic ---

    const handleSignal = (id: string) => {
        playClick();
        const target = colleagues.find(c => c.id === id);
        if (target) {
            // Send actual notification via storage
            storage.addNotification(id, { text: `${currentUser.name} vinkade till dig!`, type: 'info' });
            addToast(`Signal skickad till ${target.name}!`, 'success');
        }
    };

    const handleRequestSignature = (id: string) => {
        playClick();
        const target = colleagues.find(c => c.id === id);
        if (target) {
            storage.addNotification(id, { text: `${currentUser.name} ber om en signatur.`, type: 'info' });
            addToast(`Förfrågan om signatur skickad till ${target.name}.`, 'info');
        }
    };

    const handleConnect = (id: string) => {
        playClick();
        const target = colleagues.find(c => c.id === id);
        if (target) {
            if (target.isSimulated) {
                // Simulate instant accept
                addToast(`${target.name} accepterade din förfrågan!`, 'success');
                // Could update local state to show connected
            } else {
                storage.sendConnectionRequest(currentUser.id, id, currentUser.name);
                addToast(`Kontaktförfrågan skickad till ${target.name}.`, 'info');
                // Update local state to show pending
                setColleagues(prev => prev.map(c => c.id === id ? { ...c, connectionStatus: 'pending' } : c));
            }
        }
    };

    const handleAcceptRequest = async (requesterId: string, requesterName: string) => {
        playSuccess();
        await storage.acceptConnectionRequest(currentUser.id, requesterId, currentUser.name);
        addToast(`Du är nu länkad med ${requesterName}.`, 'success');
        loadColleagues();
    };

    const handleRejectRequest = async (requesterId: string) => {
        playClick();
        await storage.rejectConnectionRequest(currentUser.id, requesterId);
        loadColleagues();
    };

    return (
        <div className="min-h-full space-y-6 relative pb-20">
            <header>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
                        CareLearn Connect
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-mono uppercase tracking-wider hidden sm:block">
                        NODE: {currentUser.workplace || 'UNKNOWN'}
                    </p>
                </div>
                
                <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg border border-slate-300 dark:border-slate-700 w-full sm:w-auto">
                    <button
                        onClick={() => setActiveTab('feed')}
                        className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-bold transition-all duration-200 ${activeTab === 'feed' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                        Kunskapsflödet
                    </button>
                    <button
                        onClick={() => setActiveTab('colleagues')}
                        className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-bold transition-all duration-200 ${activeTab === 'colleagues' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                        Kollegor ({colleagues.length})
                        {pendingRequests.length > 0 && <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingRequests.length}</span>}
                    </button>
                </div>
            </header>

            {activeTab === 'feed' && (
                <div className="max-w-2xl mx-auto">
                    {/* Post Creator */}
                    <div className="card-base p-4 mb-6 border-l-4 border-l-indigo-500">
                        <form onSubmit={handleCreatePost}>
                            <textarea
                                value={newPostContent}
                                onChange={(e) => setNewPostContent(e.target.value)}
                                placeholder={`Dela en lärdom, fråga eller tips, ${currentUser.name.split(' ')[0]}...`}
                                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[80px]"
                            />
                            <div className="flex justify-between items-center mt-3">
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {Object.entries(CATEGORY_STYLES).map(([key, style]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setNewPostCategory(key as PostCategory)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${newPostCategory === key ? `${style.bg} ${style.color} border-current` : 'border-transparent bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                        >
                                            {style.icon} {style.label}
                                        </button>
                                    ))}
                                </div>
                                <button 
                                    type="submit" 
                                    disabled={!newPostContent.trim() || isPosting}
                                    className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors btn-press text-sm"
                                >
                                    {isPosting ? 'Publicerar...' : 'Publicera'}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 italic flex items-center gap-1">
                                {ICONS.shield} Moderator-AI granskar alla inlägg för ton & sekretess.
                            </p>
                        </form>
                    </div>

                    {/* Feed List */}
                    <div className="space-y-4">
                        {posts.length > 0 ? (
                            posts.map(post => (
                                <FeedItem 
                                    key={post.id} 
                                    post={post} 
                                    currentUser={currentUser} 
                                    onLike={handleLike} 
                                    onComment={handleComment} 
                                    onDelete={handleDeletePost}
                                    onEdit={handleEditPost}
                                />
                            ))
                        ) : (
                            <div className="text-center py-12 text-slate-500">
                                <p>Inga inlägg än. Bli den första att dela något!</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'colleagues' && (
                <div className="animate-fade-in">
                    {/* Pending Requests Section */}
                    {pendingRequests.length > 0 && (
                        <div className="mb-8 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-4 rounded-lg">
                            <h3 className="text-indigo-800 dark:text-indigo-200 font-bold mb-3">Inkommande Förfrågningar</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {pendingRequests.map(req => (
                                    <div key={req.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-indigo-100 dark:border-indigo-700 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                                                {ROLE_ICONS[req.role] || ICONS.userCircle}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{req.name}</p>
                                                <p className="text-xs text-slate-500">{req.role}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleAcceptRequest(req.id, req.name)} className="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600">Acceptera</button>
                                            <button onClick={() => handleRejectRequest(req.id)} className="bg-slate-200 text-slate-600 px-3 py-1 rounded text-xs hover:bg-slate-300">Neka</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="relative w-16 h-16">
                                <div className="absolute inset-0 border-2 border-slate-300 dark:border-slate-700 rounded-full"></div>
                                <div className="absolute inset-0 border-t-2 border-red-500 rounded-full animate-spin"></div>
                            </div>
                            <p className="mt-4 text-slate-500 font-mono text-xs animate-pulse">SÖKER I NÄTVERKET...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {colleagues.length > 0 ? (
                                colleagues.map(user => (
                                    <ConnectionCard 
                                        key={user.id} 
                                        user={user} 
                                        onSignal={handleSignal}
                                        onRequestSignature={handleRequestSignature}
                                        onConnect={handleConnect}
                                    />
                                ))
                            ) : (
                                <div className="col-span-full text-center py-12 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                                    <p className="text-slate-500">Inga kollegor hittades på denna enhet.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`pointer-events-auto border px-4 py-3 rounded shadow-xl flex items-center gap-3 animate-slide-in-right ${t.type === 'alert' ? 'bg-red-100 border-red-400 text-red-800' : 'bg-slate-800 border-slate-600 text-slate-100'}`}>
                        <span>{t.type === 'success' ? '✅' : t.type === 'alert' ? '⛔' : 'ℹ️'}</span>
                        <span className="text-sm font-bold">{t.text}</span>
                        <button onClick={() => removeToast(t.id)} className="ml-4 opacity-70 hover:opacity-100">&times;</button>
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.4s ease-out forwards;
                }
            `}</style>
        </div>
    );
});

export default Community;
