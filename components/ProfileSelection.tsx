
import React, { useState, memo, useMemo, useRef, useEffect } from 'react';
import { User, Role } from '../types';
import { ICONS } from '../constants';
import { InfoTooltip, Modal } from './UI';
import { playLogin, playSuccess, playError } from '../services/soundService';
import * as storage from '../services/localStorageService';

interface ProfileSelectionProps {
  users: User[];
  onSelectProfile: (user: User, isLogin?: boolean) => void;
  onUpdateUserPin: (userId: string, pin: string) => void;
  onCreateProfile: (name: string, role: Role, workplace: string, pin: string, aplWeeks?: number, email?: string, password?: string) => void;
}

// Google Icon Component
const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px" className="mr-2">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
    </svg>
);

const FeatureItem: React.FC<{ icon: React.ReactNode, title: string, text: string }> = ({ icon, title, text }) => (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:bg-slate-800/50 transition-colors">
        <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-full shrink-0">
            {icon}
        </div>
        <div>
            <h3 className="font-bold text-slate-100 mb-1">{title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{text}</p>
        </div>
    </div>
);

const ProfileSelection: React.FC<ProfileSelectionProps> = memo(({ onSelectProfile, onCreateProfile }) => {
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Signup State
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newRole, setNewRole] = useState<Role | ''>('');
    const [newWorkplace, setNewWorkplace] = useState('');
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [registrationConfig, setRegistrationConfig] = useState<Awaited<ReturnType<typeof storage.getRegistrationConfig>> | null>(null);
    
    const workplaceWrapperRef = useRef<HTMLDivElement>(null);
    
    const allowedWorkplaces = useMemo(() => registrationConfig?.allowedWorkplaces || [], [registrationConfig]);

    useEffect(() => {
        // Load beta registration policy from backend settings (seeded if missing).
        const loadConfig = async () => {
            try {
                const cfg = await storage.getRegistrationConfig();
                setRegistrationConfig(cfg);
                // Preselect first allowed workplace for better UX
                if (!newWorkplace && cfg.allowedWorkplaces?.length) {
                    setNewWorkplace(cfg.allowedWorkplaces[0]);
                }
            } catch (e) {
                console.warn("Could not load registration config, falling back to defaults.");
                if (!newWorkplace) setNewWorkplace('Avdelning 51 PIVA Sundsvall');
            }
        };
        loadConfig();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        setIsLoading(true);
        try {
            // Using Firebase Auth
            const user = await storage.loginUser(loginEmail, loginPassword);
            if (user) {
                playLogin();
                onSelectProfile(user, true);
            } else {
                playError();
                setLoginError('Fel e-post eller lösenord.');
                alert('Fel e-post eller lösenord.');
            }
        } catch (error: any) {
            playError();
            setLoginError('Inloggningen misslyckades.');
            console.error(error);
            alert(`Inloggning misslyckades: ${error.message || 'Okänt fel'}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        try {
            // False = Not registration (expect existing user)
            const user = await storage.authenticateWithGoogle(false);
            if (user) {
                playLogin();
                onSelectProfile(user, true);
            }
        } catch (error: any) {
            playError();
            console.error(error);
            alert(`Inloggning misslyckades: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
        const finalWorkplace = newRole === 'developer' ? 'CareLearn HQ' : newWorkplace;
        
        if (!newRole) {
            alert("Du måste välja en roll (t.ex. Student) innan du kan gå med via Google.");
            return;
        }
        if (newRole === 'admin' || newRole === 'huvudhandledare') {
            const contact = registrationConfig
                ? `${registrationConfig.developerContactEmail} / ${registrationConfig.developerLinkedInUrl}`
                : 'kontakta utvecklaren';
            alert(`Chef/Admin-konto skapas av utvecklaren. Kontakta: ${contact}`);
            return;
        }
        if (newRole !== 'developer' && !finalWorkplace) {
            alert("Du måste välja en arbetsplats (t.ex. din avdelning) innan du kan gå med via Google.");
            return;
        }

        setIsLoading(true);
        try {
            // First: Register via Google Auth
            const user = await storage.authenticateWithGoogle(true, newRole, finalWorkplace);
            playLogin();
            // onSelectProfile will be called by AuthStateChanged in App.tsx
            
        } catch (error: any) {
            console.error(error);
            playError();
            alert(`Registrering misslyckades: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDevLogin = async () => {
        setIsLoading(true);
        // Securely load from env or prompt
        // @ts-ignore
        const email = import.meta.env.VITE_DEV_EMAIL || prompt("Ange utvecklar-epost:");
        // @ts-ignore
        const password = import.meta.env.VITE_DEV_PASSWORD || prompt("Ange utvecklar-lösenord:"); 

        if (!email || !password) {
            setIsLoading(false);
            return;
        }

        try {
            // Försök logga in först
            const devUser = await storage.loginUser(email, password);
            if (devUser) {
                playLogin();
                onSelectProfile(devUser, true);
            }
        } catch (e: any) {
            // Om användaren inte finns (nytt projekt), skapa den!
            console.log("Dev user not found, creating...", e);
            try {
                const newUser = await storage.registerUser(
                    'Andreas Hillborgh', 
                    email, 
                    password, 
                    'developer', 
                    'CareLearn HQ', 
                    undefined
                );
                playSuccess();
                onSelectProfile(newUser, true);
            } catch (regError: any) {
                console.error("Could not create dev user", regError);
                alert("Kunde inte skapa utvecklarkonto: " + regError.message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const passwordsDoNotMatch = confirmPassword && newPassword !== confirmPassword;

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalWorkplace = newRole === 'developer' ? 'CareLearn HQ' : newWorkplace;

        if (!newName || !newEmail || !newPassword || !confirmPassword || !newRole) {
            alert("Vänligen fyll i alla obligatoriska fält.");
            return;
        }
        if (newRole === 'admin' || newRole === 'huvudhandledare') {
            const contact = registrationConfig
                ? `${registrationConfig.developerContactEmail} / ${registrationConfig.developerLinkedInUrl}`
                : 'kontakta utvecklaren';
            alert(`Chef/Admin-konto skapas av utvecklaren. Kontakta: ${contact}`);
            return;
        }
        if (newPassword !== confirmPassword) {
            alert("Lösenorden matchar inte.");
            return;
        }
        if (newRole !== 'developer' && !finalWorkplace) {
            alert("Du måste välja en arbetsplats för att kunna nätverka.");
            return;
        }

        setIsLoading(true);
        try {
            // Auth + Firestore creation handled by service via App.tsx callback
            await onCreateProfile(newName, newRole, finalWorkplace, '1234', undefined, newEmail, newPassword);
            // If success, App.tsx handles auth state change and redirect
        } catch (error: any) {
            console.error(error);
            let msg = error.message || "Okänt fel";
            if (msg.includes('email-already-in-use')) msg = "E-postadressen används redan.";
            if (msg.includes('weak-password')) msg = "Lösenordet är för svagt (minst 6 tecken).";
            if (msg.includes('invalid-email')) msg = "Ogiltig e-postadress.";
            
            playError();
            alert("Registrering misslyckades: " + msg);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-slate-200 overflow-y-auto">
            <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="h-8 w-auto text-red-500">
                            <use href="#carelearn-logo-symbol"></use>
                        </svg>
                        <span className="text-2xl font-bold tracking-tight text-white hidden sm:block">
                            CareLearn <span className="text-red-500">Connect</span>
                        </span>
                    </div>

                    <div className="hidden md:flex items-center gap-3">
                        <button 
                            type="button" 
                            onClick={handleGoogleLogin}
                            disabled={isLoading}
                            className="bg-white hover:bg-slate-100 text-slate-700 font-medium py-1.5 px-3 rounded text-sm transition-colors flex items-center"
                            title="Logga in med Google"
                        >
                            <GoogleIcon />
                            <span className="hidden lg:inline">Google</span>
                        </button>
                        <div className="h-6 w-px bg-slate-700 mx-2"></div>
                        <form onSubmit={handleLogin} className="flex items-center gap-3">
                            <input
                                type="email"
                                placeholder="E-post"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-red-500 outline-none w-40 placeholder-slate-400"
                            />
                            <input
                                type="password"
                                placeholder="Lösenord"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-red-500 outline-none w-40 placeholder-slate-400"
                            />
                            <button type="submit" disabled={isLoading} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-1.5 px-4 rounded text-sm transition-colors">
                                {isLoading ? '...' : 'Logga in'}
                            </button>
                        </form>
                    </div>

                    <button 
                        className="md:hidden text-white font-bold"
                        onClick={() => setShowLoginModal(!showLoginModal)}
                    >
                        Logga in
                    </button>
                </div>
                {showLoginModal && (
                    <div className="md:hidden p-4 bg-slate-800 border-t border-slate-700">
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={handleGoogleLogin}
                                className="bg-white text-slate-800 font-bold py-2 rounded flex items-center justify-center w-full"
                            >
                                <GoogleIcon /> Logga in med Google
                            </button>
                            <div className="flex items-center gap-2 text-slate-500 text-xs">
                                <div className="h-px bg-slate-600 flex-1"></div>
                                ELLER
                                <div className="h-px bg-slate-600 flex-1"></div>
                            </div>
                            <form onSubmit={handleLogin} className="flex flex-col gap-3">
                                <input
                                    type="email"
                                    placeholder="E-post"
                                    value={loginEmail}
                                    onChange={(e) => setLoginEmail(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 rounded p-2 text-white placeholder-slate-400"
                                />
                                <input
                                    type="password"
                                    placeholder="Lösenord"
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 rounded p-2 text-white placeholder-slate-400"
                                />
                                <button type="submit" className="bg-red-600 text-white font-bold py-2 rounded">Logga in</button>
                            </form>
                        </div>
                    </div>
                )}
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-start">
                    
                    <div className="space-y-8 mt-4 animate-fade-in-up">
                        <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight">
                            Håll kontakten med din avdelning och lär dig smartare.
                        </h1>
                        <p className="text-xl text-slate-400">
                            CareLearn Connect ger dig en AI-handledare, digitala verktyg och ett nätverk av kollegor – direkt i din ficka.
                        </p>
                        
                        <div className="space-y-4 pt-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-2xl">👩‍⚕️</div>
                                <span className="font-semibold text-lg">Se vilka som jobbar på din enhet</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-2xl">🤖</div>
                                <span className="font-semibold text-lg">Få svar dygnet runt av din AI-Handledare</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-2xl">🎓</div>
                                <span className="font-semibold text-lg">Samla poäng och nå dina lärandemål</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-800 overflow-hidden animate-fade-in">
                        <div className="p-6 border-b border-slate-800 bg-slate-800/50">
                            <h2 className="text-2xl font-bold text-white">Skapa ett nytt konto</h2>
                            <p className="text-slate-400 text-sm">Det är gratis och tar bara en minut.</p>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <form onSubmit={handleSignup} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <select
                                        value={newRole}
                                        onChange={(e) => setNewRole(e.target.value as Role)}
                                        className="col-span-2 md:col-span-1 w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                                        required
                                    >
                                        <option value="" disabled>Välj roll...</option>
                                        <option value="usk-elev">Elev (USK)</option>
                                        <option value="ssk-student">Student (SSK)</option>
                                        <option value="anstalld-usk">Undersköterska (USK)</option>
                                        <option value="anstalld-ssk">Sjuksköterska (SSK)</option>
                                        <option value="vikarie-usk">Vikarie</option>
                                        <option value="handledare-usk">Handledare</option>
                                        <option value="admin" disabled>Chef/Admin (kräver konto skapat av utvecklare)</option>
                                    </select>
                                    
                                    {newRole !== 'developer' && (
                                        <div className="col-span-2 md:col-span-1 space-y-2" ref={workplaceWrapperRef}>
                                            <select
                                                value={newWorkplace}
                                                onChange={(e) => setNewWorkplace(e.target.value)}
                                                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                                                required
                                            >
                                                <option value="" disabled>Välj avdelning...</option>
                                                {(allowedWorkplaces.length ? allowedWorkplaces : ['Avdelning 51 PIVA Sundsvall', 'Avdelning 7 Sundsvall']).map((wp) => (
                                                    <option key={wp} value={wp}>{wp}</option>
                                                ))}
                                            </select>
                                            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-xs text-slate-300 leading-relaxed">
                                                <div className="font-semibold text-slate-200 mb-1">Beta: avdelningar är låsta</div>
                                                <div className="text-slate-400">
                                                    {registrationConfig?.betaInfoText || 'Just nu är endast Avdelning 51 PIVA Sundsvall och Avdelning 7 Sundsvall öppna för egenregistrering. Fler avdelningar kommer.'}
                                                </div>
                                                <div className="mt-2 text-slate-300">
                                                    Vid intresse av att ansluta fler avdelningar, kontakta utvecklaren:
                                                    {' '}
                                                    <a
                                                        href={`mailto:${registrationConfig?.developerContactEmail || 'Andreas.guldberg@gmail.com'}`}
                                                        className="text-indigo-300 hover:underline"
                                                    >
                                                        {registrationConfig?.developerContactEmail || 'Andreas.guldberg@gmail.com'}
                                                    </a>
                                                    {' '}
                                                    eller via
                                                    {' '}
                                                    <a
                                                        href={registrationConfig?.developerLinkedInUrl || 'https://www.linkedin.com/in/andreas-hillborgh-51581371?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app'}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-indigo-300 hover:underline"
                                                    >
                                                        LinkedIn
                                                    </a>
                                                    .
                                                </div>
                                                <div className="mt-2 text-slate-400">
                                                    Chef/Admin-konton skapas endast av utvecklaren (max 1 per avdelning).
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleGoogleSignup}
                                    disabled={isLoading}
                                    className="w-full bg-white hover:bg-slate-100 text-slate-800 font-bold py-3 rounded-lg transition-colors shadow flex items-center justify-center btn-press"
                                >
                                    <GoogleIcon /> Gå med via Google
                                </button>

                                <div className="flex items-center gap-3 text-slate-500 text-sm">
                                    <div className="h-px bg-slate-800 flex-1"></div>
                                    eller med e-post
                                    <div className="h-px bg-slate-800 flex-1"></div>
                                </div>

                                <input
                                    type="text"
                                    placeholder="Namn"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-500"
                                    required
                                />
                                <input
                                    type="email"
                                    placeholder="E-postadress"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-500"
                                    required
                                />
                                <div className="space-y-2">
                                    <input
                                        type="password"
                                        placeholder="Lösenord (minst 6 tecken)"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full p-3 bg-slate-950 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-500"
                                        required
                                    />
                                    <input
                                        type="password"
                                        placeholder="Upprepa lösenord"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className={`w-full p-3 bg-slate-950 border ${passwordsDoNotMatch ? 'border-red-500' : 'border-slate-700'} rounded-lg text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-500 transition-colors`}
                                        required
                                    />
                                </div>

                                <button type="submit" disabled={passwordsDoNotMatch || isLoading} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors shadow-lg text-lg btn-press mt-2">
                                    {isLoading ? 'Registrerar...' : 'Skapa konto'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureItem icon={ICONS.users} title="Ditt Vård-Community" text="Hitta kollegor, studenter och handledare på din enhet." />
                    <FeatureItem icon={ICONS.ai} title="Smart AI-Handledare" text="Få svar på frågor om rutiner och vårdprocesser dygnet runt." />
                    <FeatureItem icon={ICONS.chartPie} title="Följ din utveckling" text="Visualisera dina framsteg med checklistor och quiz." />
                </div>
            </main>

            <footer className="border-t border-slate-800 bg-slate-900 py-8 mt-12">
                <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
                    <p className="mb-2">&copy; {new Date().getFullYear()} CareLearn Connect.</p>
                    <div className="flex justify-center gap-4">
                        <button onClick={handleDevLogin} className="hover:text-white text-slate-600 text-xs font-mono">[Dev Access]</button>
                    </div>
                </div>
            </footer>
        </div>
    );
});

export default ProfileSelection;
