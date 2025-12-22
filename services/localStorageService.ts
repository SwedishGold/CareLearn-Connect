
import { User, UserData, Role, LogbookEntry, DepartmentSettings, CustomDocument, Notification, Post, Credential, ScheduleEntry, PastPlacement, UnansweredQuestion, FlaggedContentEntry, FeedbackEntry, Workplace, RegistrationConfig } from '../types';
import { APP_DATA } from '../constants';
import { DEMO_USER_DATA } from '../constants/demoData';
import { generateUserProfile } from '../services/geminiService';

// --- FIREBASE CONFIGURATION ---
// @ts-ignore
const getEnv = (key: string) => import.meta.env[key] || "";

const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("VITE_FIREBASE_APP_ID"),
  measurementId: getEnv("VITE_FIREBASE_MEASUREMENT_ID") 
};

// Initialize Firebase via global scripts (compat version from index.html)
declare const firebase: any;

let auth: any;
let db: any;
let analytics: any;

try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            // Check if config is present before initializing to avoid errors on empty env
            if (firebaseConfig.apiKey) {
                firebase.initializeApp(firebaseConfig);
            } else {
                console.warn("Firebase config missing from .env");
            }
        }
        
        // Even if config failed, we might have an existing app instance
        if (firebase.apps.length) {
            auth = firebase.auth();
            db = firebase.firestore();
            if (firebase.analytics) {
                analytics = firebase.analytics();
            }
            
            // Enable Offline Persistence
            db.enablePersistence().catch((err: any) => {
                if (err.code == 'failed-precondition') {
                    console.warn("Multiple tabs open, persistence can only be enabled in one tab at a a time.");
                } else if (err.code == 'unimplemented') {
                    console.warn("Browser doesn't support persistence");
                }
            });
        }
    } else {
        console.error("Firebase SDK not loaded.");
    }
} catch (error) {
    console.error("Firebase Initialization Error.", error);
}

// --- CONSTANTS ---
export const getDefaultUserData = (role: Role, aplWeeks: number = 4): UserData => {
    const isDev = role === 'developer';
    return {
        checklistProgress: {},
        awardedChecklistItems: [],
        logbookEntries: [],
        goalsProgress: {},
        knowledgeTestHistory: [],
        knowledgeTestInProgress: null,
        chatHistory: [],
        aplTotalDays: aplWeeks * 5,
        achievements: isDev ? ['AI_LICENSE_COMPLETE', 'AI_LICENSE_STAFF', 'AI_LICENSE_ADMIN'] : [],
        notifications: [],
        isFirstLogin: !isDev,
        hasCompletedAILicense: isDev,
        hasCompletedStaffAILicense: isDev,
        hasCompletedAdminAILicense: isDev,
        xp: isDev ? 1000 : 0
    };
};

// --- REGISTRATION POLICY (BETA) ---
const REGISTRATION_SETTINGS_DOC_ID = 'registration';

const normalizeWorkplace = (workplace: string): string => (workplace || '').trim();

export const getRegistrationConfig = async (): Promise<RegistrationConfig> => {
    const ref = db.collection('settings').doc(REGISTRATION_SETTINGS_DOC_ID);
    const snap = await ref.get();
    if (snap.exists) {
        const existing = snap.data() as RegistrationConfig;

        // Auto-migration: make workplaces unambiguous (prevents AI/search from "choosing" the wrong unit)
        const migratedAllowed = (existing.allowedWorkplaces || []).map(w => {
            const trimmed = (w || '').trim();
            if (trimmed === 'Avdelning 51') return 'Avdelning 51 PIVA Sundsvall';
            if (trimmed === 'Avdelning 7') return 'Avdelning 7 Sundsvall';
            if (trimmed === 'Avd 51') return 'Avdelning 51 PIVA Sundsvall';
            if (trimmed === 'Avd 7') return 'Avdelning 7 Sundsvall';
            return trimmed;
        }).filter(Boolean);

        const needsUpdate =
            JSON.stringify(migratedAllowed) !== JSON.stringify(existing.allowedWorkplaces || []);

        if (needsUpdate) {
            const next: RegistrationConfig = { ...existing, allowedWorkplaces: migratedAllowed };
            await ref.set(next);
            return next;
        }

        return existing;
    }

    const defaults: RegistrationConfig = {
        // Fullständiga namn för att undvika förväxling vid search/AI (t.ex. "Avdelning 7" på annan ort).
        allowedWorkplaces: ['Avdelning 51 PIVA Sundsvall', 'Avdelning 7 Sundsvall'],
        blockedSignupRoles: ['admin', 'huvudhandledare', 'developer'],
        betaInfoText:
            'CareLearn Connect är i beta. Just nu är endast Avdelning 51 PIVA Sundsvall och Avdelning 7 Sundsvall öppna för egenregistrering. Fler avdelningar kommer när rutiner/PM finns uppladdade i kunskapsbanken.',
        developerContactEmail: 'Andreas.guldberg@gmail.com',
        developerLinkedInUrl: 'https://www.linkedin.com/in/andreas-hillborgh-51581371?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app'
    };
    await ref.set(defaults);
    return defaults;
};

export const updateRegistrationConfig = async (config: RegistrationConfig): Promise<void> => {
    const ref = db.collection('settings').doc(REGISTRATION_SETTINGS_DOC_ID);
    await ref.set(config);
};

const formatRegistrationContact = (cfg: RegistrationConfig): string =>
    `Kontakta: ${cfg.developerContactEmail} eller via LinkedIn: ${cfg.developerLinkedInUrl}`;

const enforceRegistrationPolicy = async (args: {
    config: RegistrationConfig;
    role: Role;
    workplace: string;
    allowPrivilegedProvisioning: boolean;
}): Promise<void> => {
    const role = args.role;
    const workplace = normalizeWorkplace(args.workplace);
    const cfg = args.config;

    // Developer should not be self-registered via regular signup.
    if (role === 'developer') {
        throw new Error('Utvecklarkonto skapas via utvecklarflödet (Dev Access).');
    }

    // Block privileged roles from self-signup (admin/chef etc.)
    if ((cfg.blockedSignupRoles || []).includes(role) && !args.allowPrivilegedProvisioning) {
        throw new Error(`Denna roll kräver att kontot skapas av utvecklaren.\n\n${formatRegistrationContact(cfg)}`);
    }

    // Workplace must be one of the allowed beta workplaces (for self-signup).
    const allowed = (cfg.allowedWorkplaces || []).map(normalizeWorkplace).filter(Boolean);
    if (!workplace || !allowed.includes(workplace)) {
        throw new Error(`${cfg.betaInfoText}\n\nTillgängliga avdelningar just nu: ${allowed.join(', ') || 'inga'}.\n\n${formatRegistrationContact(cfg)}`);
    }

    // Enforce max 1 admin per workplace (policy across all workplaces).
    if (role === 'admin') {
        const existing = await db
            .collection('users')
            .where('role', '==', 'admin')
            .where('workplace', '==', workplace)
            .limit(1)
            .get();
        if (!existing.empty) {
            throw new Error(`Det finns redan ett Admin/Chef-konto för ${workplace}. Kontakta utvecklaren för ändringar.`);
        }
    }
};

export const createPrivilegedAccount = async (args: {
    name: string;
    email: string;
    temporaryPassword: string;
    role: Role; // should be 'admin' (or other privileged roles if enabled later)
    workplace: string;
}): Promise<User> => {
    const cfg = await getRegistrationConfig();
    await enforceRegistrationPolicy({
        config: cfg,
        role: args.role,
        workplace: args.workplace,
        allowPrivilegedProvisioning: true,
    });

    // Bypass self-signup policy in registerUser since we already enforced above.
    return await registerUser(
        args.name,
        args.email,
        args.temporaryPassword,
        args.role,
        args.workplace,
        undefined,
        undefined,
        undefined,
        { bypassRegistrationPolicy: true }
    );
};

// --- AUTH SERVICE ---

export const registerUser = async (
    name: string,
    email: string,
    password: string | undefined,
    role: Role,
    workplace: string,
    apiKey?: string,
    aplWeeks?: number,
    workplaceId?: string,
    options?: { bypassRegistrationPolicy?: boolean }
): Promise<User> => {
    if (!password) throw new Error("Lösenord krävs för registrering.");
    
    try {
        // 0. Enforce beta registration policy (unless explicitly bypassed by developer tooling)
        if (!options?.bypassRegistrationPolicy && role !== 'developer') {
            const registrationConfig = await getRegistrationConfig();
            await enforceRegistrationPolicy({
                config: registrationConfig,
                role,
                workplace,
                allowPrivilegedProvisioning: false,
            });
        }

        // 1. Create Auth User
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;

        // 2. Generate AI Profile (with Fallback)
        let aiProfile = undefined;
        try {
            aiProfile = await generateUserProfile(name, role, workplace);
        } catch (e) {
            console.error("AI Profile Generation failed during registration, proceeding with basic profile.", e);
        }

        const newUser: User = {
            id: uid,
            name,
            email,
            role,
            workplace,
            workplaceId: workplaceId || '', // Default to empty if not provided (global mode)
            pin: '1234', // Legacy support
            connections: [],
            pendingRequests: [],
            credentials: [],
            pastPlacements: [],
            createdAt: new Date().toISOString(),
            ...(aiProfile && { aiGeneratedProfile: aiProfile }) // Only add if defined
        };

        // 3. Save to Firestore (Profile + Initial Data)
        const batch = db.batch();
        const userRef = db.collection('users').doc(uid);
        const dataRef = db.collection('userData').doc(uid);

        batch.set(userRef, newUser);
        batch.set(dataRef, getDefaultUserData(role, aplWeeks));
        
        // 4. Update workplace member count if joining one
        if (workplaceId) {
            const wpRef = db.collection('workplaces').doc(workplaceId);
            batch.update(wpRef, {
                memberCount: firebase.firestore.FieldValue.increment(1)
            });
        }

        await batch.commit();
        
        console.log("User registered successfully:", uid);
        return newUser;
    } catch (error: any) {
        console.error("Registration Error:", error);
        throw new Error(error.message || "Kunde inte skapa användare.");
    }
};

export const loginUser = async (email: string, password: string): Promise<User | null> => {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;
        return await getUser(uid);
    } catch (error) {
        console.error("Login Error:", error);
        throw error;
    }
};

/**
 * Authenticates using Google Popup.
 * Handles both Login (existing users) and Registration (new users).
 * 
 * @param isRegistration - If true, we expect role/workplace to create a profile.
 * @param role - Required if isRegistration is true.
 * @param workplace - Required if isRegistration is true.
 * @param aplWeeks - Optional duration for students.
 */
export const authenticateWithGoogle = async (
    isRegistration: boolean,
    role?: Role,
    workplace?: string,
    aplWeeks?: number
): Promise<User> => {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const { uid, displayName, email } = result.user;

        // Check if user profile exists in Firestore
        const userDoc = await db.collection('users').doc(uid).get();

        if (userDoc.exists) {
            // LOGIN FLOW: User exists, return profile
            // (Even if they clicked "Register", if they have an account, just log them in)
            return userDoc.data() as User;
        } else {
            // REGISTRATION FLOW: User does not exist
            if (!isRegistration) {
                // If they tried to LOGIN but have no profile, we can either:
                // 1. Throw error (Strict)
                // 2. Redirect to registration (Better UX, handled by UI usually)
                // Here we throw to let UI handle the message
                // Also clean up the auth session so they aren't stuck in "logged in but no profile" state
                await auth.signOut();
                throw new Error("Ingen profil hittad för detta Google-konto. Vänligen registrera dig först.");
            }

            if (!role || !workplace) {
                // Should be caught by UI, but double check
                await auth.signOut();
                throw new Error("Roll och arbetsplats måste väljas för att skapa ett konto.");
            }

            // Enforce beta registration policy (Google self-signup)
            const registrationConfig = await getRegistrationConfig();
            await enforceRegistrationPolicy({
                config: registrationConfig,
                role,
                workplace,
                allowPrivilegedProvisioning: false,
            });

            // Create new profile
            console.log("Creating new Google user profile...");
            
            // Generate AI Profile (with Fallback)
            let aiProfile = undefined;
            try {
                aiProfile = await generateUserProfile(displayName || "Användare", role, workplace);
            } catch (e) {
                console.error("AI Profile Gen failed", e);
            }

            const newUser: User = {
                id: uid,
                name: displayName || email?.split('@')[0] || "Användare",
                email: email || "",
                role,
                workplace,
                googleId: uid, // Mark as google user
                pin: '1234',
                connections: [],
                pendingRequests: [],
                credentials: [],
                pastPlacements: [],
                createdAt: new Date().toISOString(),
                ...(aiProfile && { aiGeneratedProfile: aiProfile })
            };

            const batch = db.batch();
            batch.set(db.collection('users').doc(uid), newUser);
            batch.set(db.collection('userData').doc(uid), getDefaultUserData(role, aplWeeks));
            
            await batch.commit();
            return newUser;
        }
    } catch (error: any) {
        console.error("Google Auth Error:", error);
        throw error;
    }
};

// NEW: Get User by UID (For onAuthStateChanged)
export const getUser = async (uid: string): Promise<User | null> => {
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            return doc.data() as User;
        }
        return null;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
};

export const loginWithGoogle = async (email: string, name: string, googleId: string, apiKey?: string): Promise<User> => {
    // Simulated Google Login flows logic (Not actively used with real Firebase Auth in this snippet)
    try {
        const snapshot = await db.collection('users').where('email', '==', email).get();
        
        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            const user = userDoc.data() as User;
            if (apiKey || googleId) {
                await userDoc.ref.update({ googleId: googleId || user.googleId });
            }
            return user;
        } else {
            // NOTE: This creates a document but doesn't create a Firebase Auth user. 
            // In a real app, you'd use auth.signInWithPopup(provider).
            const uid = `google-${Date.now()}`;
            const newUser: User = {
                id: uid,
                name,
                email,
                role: 'usk-elev', // Default
                workplace: 'Ej angivet',
                googleId,
                // apiKey removed
                pin: '1234',
                connections: [],
                pendingRequests: [],
                credentials: [],
                pastPlacements: []
            };
            
            const batch = db.batch();
            batch.set(db.collection('users').doc(uid), newUser);
            batch.set(db.collection('userData').doc(uid), getDefaultUserData('usk-elev'));
            await batch.commit();
            return newUser;
        }
    } catch (e) {
        console.error(e);
        throw e;
    }
};

export const logoutCurrentUser = async () => {
    await auth.signOut();
};

export const getCurrentUserApiKey = (): string | undefined => {
    return undefined; 
};

// --- WORKPLACE SERVICE (NEW) ---

export const searchWorkplaces = async (query: string): Promise<Workplace[]> => {
    if (!query || query.length < 2) return [];
    const searchKey = query.toLowerCase();
    
    // Firestore simple prefix search
    const snapshot = await db.collection('workplaces')
        .where('searchKey', '>=', searchKey)
        .where('searchKey', '<=', searchKey + '\uf8ff')
        .limit(10)
        .get();
        
    return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Workplace));
};

export const createWorkplace = async (data: Omit<Workplace, 'id' | 'searchKey' | 'memberCount' | 'createdByType'>): Promise<Workplace> => {
    const newWorkplace: Workplace = {
        id: '', // Will be set by Firestore
        ...data,
        memberCount: 1, // Creator is first member
        createdByType: 'AI',
        searchKey: data.name.toLowerCase()
    };
    
    const docRef = await db.collection('workplaces').add(newWorkplace);
    
    // Update local object with new ID
    newWorkplace.id = docRef.id;
    
    // We should also update the doc with its own ID for cleaner fetching later
    await docRef.update({ id: docRef.id });
    
    return newWorkplace;
};

export const joinWorkplace = async (userId: string, workplaceId: string, workplaceName: string) => {
    const batch = db.batch();
    
    // Update User
    const userRef = db.collection('users').doc(userId);
    batch.update(userRef, { 
        workplaceId: workplaceId,
        workplace: workplaceName 
    });
    
    // Increment Member Count
    const wpRef = db.collection('workplaces').doc(workplaceId);
    batch.update(wpRef, {
        memberCount: firebase.firestore.FieldValue.increment(1)
    });
    
    await batch.commit();
};

// --- DATA SERVICE ---

export const loadUsers = async (): Promise<User[]> => {
    const snapshot = await db.collection('users').get();
    return snapshot.docs.map((doc: any) => doc.data() as User);
};

export const loadUsersSync = (): User[] => {
    console.warn("Synchronous loadUsers called - returning empty. Update component to use async.");
    return []; 
};

export const saveUsers = async (users: User[]) => {
    console.warn("saveUsers (bulk) is deprecated in Firebase mode.");
    const batch = db.batch();
    users.forEach(user => {
        const ref = db.collection('users').doc(user.id);
        batch.set(ref, user, { merge: true });
    });
    await batch.commit();
};

export const loadUserData = async (userId: string): Promise<UserData | null> => {
    try {
        const doc = await db.collection('userData').doc(userId).get();
        if (doc.exists) {
            const data = doc.data();
            // Date conversion helpers
            const convertDates = (obj: any): any => {
                if (!obj) return obj;
                if (obj.seconds !== undefined) return new Date(obj.seconds * 1000); // Firestore Timestamp
                if (typeof obj === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(obj)) return new Date(obj);
                return obj;
            };

            if (data.logbookEntries) {
                data.logbookEntries = data.logbookEntries.map((e: any) => ({
                    ...e,
                    timestamp: convertDates(e.timestamp),
                    comments: e.comments?.map((c: any) => ({...c, timestamp: convertDates(c.timestamp)}))
                }));
            }
            if (data.notifications) {
                data.notifications = data.notifications.map((n: any) => ({
                    ...n,
                    timestamp: convertDates(n.timestamp)
                }));
            }
            if (data.knowledgeTestHistory) {
                data.knowledgeTestHistory = data.knowledgeTestHistory.map((h: any) => ({
                    ...h,
                    timestamp: convertDates(h.timestamp)
                }));
            }
            return data as UserData;
        }
        return null;
    } catch (error) {
        console.error("Error loading user data", error);
        return null;
    }
};

export const saveUserData = async (userId: string, data: UserData) => {
    try {
        await db.collection('userData').doc(userId).set(data, { merge: true });
    } catch (e) {
        console.error("Save Error", e);
    }
};

// --- SETTINGS & DOCUMENTS ---

export const loadDepartmentSettings = async (): Promise<DepartmentSettings | null> => {
    // Legacy support: fetch from 'settings/department' doc if user is global, 
    // BUT we should really fetch from current user's workplace.
    // For now, to keep dashboard working without heavy refactor, we stick to this
    // or try to fetch workplace settings if user context is known in App.tsx
    
    // NOTE: This function is slightly deprecated in the new model. 
    // Ideally components should receive settings from App.tsx which loads it from Workplace.
    // We will keep the global fetch for now as a fallback.
    const doc = await db.collection('settings').doc('department').get();
    return doc.exists ? doc.data() as DepartmentSettings : null;
};

// NEW: Load specific workplace settings
export const loadWorkplaceSettings = async (workplaceId: string): Promise<DepartmentSettings | null> => {
    try {
        const doc = await db.collection('workplaces').doc(workplaceId).get();
        if (doc.exists) {
            const wp = doc.data() as Workplace;
            // Map Workplace to DepartmentSettings structure for compatibility
            return {
                appName: 'CareLearn', // Default, or store in Workplace
                workplaceName: wp.name,
                specialty: wp.specialty,
                checklist: wp.checklist,
                knowledgeRequirements: wp.knowledgeRequirements,
                knowledgeTestQuestionsUsk: wp.knowledgeTestQuestionsUsk || "",
                knowledgeTestQuestionsSsk: wp.knowledgeTestQuestionsSsk || "",
                workplaceDescription: wp.description,
                customDocuments: [], // Fetched separately usually
                dailyTimeLimitSeconds: 1800, // Defaults
                monthlyActiveDaysLimit: 20,
                communicationLabDailyLimit: 1,
                communicationLabMonthlyLimit: 20,
                clinicalSimulatorDailyLimit: 1,
                primaryColor: '#ef4444'
            };
        }
        return null;
    } catch (e) {
        console.error("Failed to load workplace settings", e);
        return null;
    }
};

export const saveDepartmentSettings = async (settings: DepartmentSettings) => {
    await db.collection('settings').doc('department').set(settings);
};

export const clearDepartmentSettings = async () => {
    const defaults = applyCustomAppSettings(); 
    await saveDepartmentSettings(defaults);
};

export const applyCustomAppSettings = (): DepartmentSettings => {
    return {
        appName: 'CareLearn',
        // Default should be explicit to avoid ambiguity in AI/search contexts.
        workplaceName: 'Avdelning 51 PIVA Sundsvall',
        specialty: 'psykiatri',
        checklist: APP_DATA.checklist.join('\n'),
        knowledgeRequirements: APP_DATA.knowledgeRequirements.map(k => k.text).join('\n'),
        knowledgeTestQuestionsUsk: JSON.stringify(APP_DATA.knowledgeTestQuestions.usk),
        knowledgeTestQuestionsSsk: JSON.stringify(APP_DATA.knowledgeTestQuestions.ssk),
        customDocuments: [],
        dailyTimeLimitSeconds: 1800,
        monthlyActiveDaysLimit: 20,
        communicationLabDailyLimit: 1,
        communicationLabMonthlyLimit: 20,
        clinicalSimulatorDailyLimit: 1,
        primaryColor: '#ef4444'
    };
};

export const getCustomDocuments = async (workplaceFilter?: string, roleFilter?: Role): Promise<CustomDocument[]> => {
    let query = db.collection('documents');
    
    // In Firebase, complex OR queries are limited. We fetch and filter client-side for simplicity in this prototype.
    const snapshot = await query.get();
    let docs = snapshot.docs.map((d: any) => d.data() as CustomDocument);

    if (workplaceFilter) {
        docs = docs.filter((d: CustomDocument) => d.isGlobal || d.workplace === workplaceFilter || !d.workplace);
    }

    const isPrivileged = roleFilter === 'admin' || roleFilter === 'developer';
    if (roleFilter && !isPrivileged) {
        docs = docs.filter((d: CustomDocument) => !d.targetRole || d.targetRole === 'all' || d.targetRole === roleFilter);
    }

    return docs;
};

export const addCustomDocument = async (doc: Omit<CustomDocument, 'id' | 'isCustom'>) => {
    const newId = db.collection('documents').doc().id;
    const newDoc = { 
        ...doc, 
        id: newId, 
        isCustom: true,
        workplace: doc.workplace || null 
    };
    await db.collection('documents').doc(newId).set(newDoc);
};

export const deleteCustomDocument = async (docId: string) => {
    await db.collection('documents').doc(docId).delete();
};

// --- UTILS & HELPERS ---

export const checkEmailExists = async (email: string): Promise<boolean> => {
    const snapshot = await db.collection('users').where('email', '==', email).get();
    return !snapshot.empty;
};

export const updateUserPin = async (userId: string, pin: string) => {
    await db.collection('users').doc(userId).update({ pin });
};

export const updateUserContext = async (userId: string, newWorkplace: string, newRole: Role) => {
    await db.collection('users').doc(userId).update({ workplace: newWorkplace, role: newRole });
    await db.collection('userData').doc(userId).set(getDefaultUserData(newRole));
};

export const deleteUser = async (userId: string) => {
    const batch = db.batch();
    batch.delete(db.collection('users').doc(userId));
    batch.delete(db.collection('userData').doc(userId));
    await batch.commit();
};

export const getAllStudentData = async (viewerRole: Role, viewerWorkplace?: string): Promise<{ user: User, data: UserData }[]> => {
    const usersSnap = await db.collection('users').get();
    let allUsers = usersSnap.docs.map((d: any) => d.data() as User);
    
    // Filter out staff roles
    const students = allUsers.filter((u: User) => !u.role.includes('admin') && !u.role.includes('handledare') && !u.role.includes('larare') && !u.role.includes('overlakare') && u.role !== 'developer');
    
    // Filter by workplace if provided - use case insensitive trim comparison
    let filteredStudents = students;
    if (viewerWorkplace) {
        const normalizedViewerWp = viewerWorkplace.trim().toLowerCase();
        filteredStudents = students.filter((u: User) => 
            u.workplace && u.workplace.trim().toLowerCase() === normalizedViewerWp
        );
    }
    
    const results = [];
    for (const student of filteredStudents) {
        const data = await loadUserData(student.id);
        results.push({
            user: student,
            data: data || getDefaultUserData(student.role)
        });
    }
    return results;
};

export const getAllUserDataForAdmin = async (): Promise<{ user: User, data: UserData }[]> => {
    const usersSnap = await db.collection('users').get();
    const allUsers = usersSnap.docs.map((d: any) => d.data() as User);
    
    const results = [];
    for (const user of allUsers) {
        const data = await loadUserData(user.id);
        results.push({
            user,
            data: data || getDefaultUserData(user.role)
        });
    }
    return results;
};

export const createAndDistributeNotifications = async (sender: User, message: string) => {
    const usersSnap = await db.collection('users').get();
    const users = usersSnap.docs.map((d: any) => d.data() as User);
    
    // Only notify supervisors in same workplace
    const supervisors = users.filter((u: User) => 
        (u.role.includes('handledare') || u.role.includes('larare') || u.role === 'admin') &&
        u.workplaceId === sender.workplaceId
    );
    
    const batch = db.batch();
    
    for (const supervisor of supervisors) {
        const ref = db.collection('userData').doc(supervisor.id);
        const dataSnap = await ref.get();
        const currentData = dataSnap.exists ? dataSnap.data() : getDefaultUserData(supervisor.role);
        
        const newNotif = {
            id: `notif-${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            read: false,
            text: message,
            type: 'info'
        };
        
        batch.update(ref, {
            notifications: [newNotif, ...(currentData.notifications || [])]
        });
    }
    await batch.commit();
};

export const notifyDeveloper = async (message: string) => {
    console.log("Dev notification:", message);
};

export const addNotification = async (userId: string, notification: Partial<Notification>) => {
    const ref = db.collection('userData').doc(userId);
    const snap = await ref.get();
    
    if (snap.exists) {
        const data = snap.data();
        const newNotif = {
            id: `notif-${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            read: false,
            text: notification.text || '',
            ...notification
        };
        await ref.update({
            notifications: [newNotif, ...(data.notifications || [])]
        });
        const event = new CustomEvent('piva-notification', { detail: { userId, notification: newNotif } });
        window.dispatchEvent(event);
    }
};

// --- COMMUNITY POSTS ---

export const loadPosts = async (workplaceId?: string): Promise<Post[]> => {
    let query = db.collection('posts').orderBy('timestamp', 'desc').limit(50);
    
    // In Firestore, if we filter by field we also need a composite index for ordering.
    // For prototype simplicity, we fetch recent posts and filter client side if scoped.
    // Or, if no workplaceId provided (global dev view), return all.
    
    const snapshot = await query.get();
    let posts = snapshot.docs.map((d: any) => d.data() as Post);
    
    if (workplaceId) {
        posts = posts.filter((p: Post) => p.workplaceId === workplaceId || !p.workplaceId);
    }
    
    return posts;
};

export const savePost = async (post: Post) => {
    await db.collection('posts').doc(post.id).set(post);
};

export const updatePost = async (postId: string, updater: (post: Post) => Post) => {
    const ref = db.collection('posts').doc(postId);
    const snap = await ref.get();
    if (snap.exists) {
        const current = snap.data() as Post;
        const updated = updater(current);
        await ref.set(updated);
    }
};

export const deletePost = async (postId: string) => {
    await db.collection('posts').doc(postId).delete();
};

// --- MISC ---

export const seedDemoStudentData = () => { /* No-op in Cloud mode */ };

export const injectDemoData = async (): Promise<User> => {
    return await registerUser('Anna Andersson (Demo)', `demo-${Date.now()}@example.com`, '123456', 'usk-elev', 'Avdelning 51 PIVA Sundsvall');
};

export const exportAllData = async (): Promise<string> => {
    const users = await loadUsers();
    const userData: any = {};
    for (const u of users) {
        userData[u.id] = await loadUserData(u.id);
    }
    const docs = await getCustomDocuments();
    const settings = await loadDepartmentSettings();
    
    return JSON.stringify({ users, userData, docs, settings });
};

export const importAllData = async (jsonString: string) => {
    const data = JSON.parse(jsonString);
    console.warn("Import functionality restricted in Cloud Mode for safety.");
};

export const loadFlaggedContent = async (): Promise<FlaggedContentEntry[]> => {
    const snap = await db.collection('flags').get();
    return snap.docs.map((d: any) => {
        const data = d.data();
        if (data.timestamp && data.timestamp.toDate) data.timestamp = data.timestamp.toDate();
        return data;
    });
};

export const saveFlaggedContent = async (user: User, chatHistory: any[], index: number, reason: string) => {
    const entry: FlaggedContentEntry = {
        id: `flag-${Date.now()}`,
        timestamp: new Date(),
        user,
        chatHistory,
        flaggedMessageIndex: index,
        reason,
        status: 'new'
    };
    await db.collection('flags').doc(entry.id).set(entry);
};

export const updateFlaggedContentStatus = async (id: string, status: 'new' | 'reviewed') => {
    await db.collection('flags').doc(id).update({ status });
};

export const loadFeedback = async (): Promise<FeedbackEntry[]> => {
    const snap = await db.collection('feedback').get();
    return snap.docs.map((d: any) => {
        const data = d.data();
        if (data.timestamp && data.timestamp.toDate) data.timestamp = data.timestamp.toDate();
        return data;
    });
};

export const saveFeedback = async (feedback: any, user?: User) => {
    const entry = { ...feedback, id: `fb-${Date.now()}`, timestamp: new Date(), user };
    await db.collection('feedback').doc(entry.id).set(entry);
};

export const saveKnowledgeGap = async (question: string, user: User) => {
    const gap: UnansweredQuestion = {
        id: `gap-${Date.now()}`,
        question,
        timestamp: new Date().toISOString(),
        userId: user.id,
        userName: user.name
    };
    await db.collection('gaps').doc(gap.id).set(gap);
};

export const loadKnowledgeGaps = async (): Promise<UnansweredQuestion[]> => {
    const snap = await db.collection('gaps').get();
    return snap.docs.map((d: any) => d.data());
};

export const assignSupervisorToStudent = async (studentId: string, supervisorId: string) => {
    await db.collection('users').doc(studentId).update({ supervisorId });
    
    // Fetch supervisor details to create a nice notification
    const supervisor = await getUser(supervisorId);
    if (supervisor) {
        await addNotification(studentId, {
            text: `Du har tilldelats en ny handledare: ${supervisor.name}`,
            type: 'info',
            link: 'settings' // Link to profile where they can see it
        });
    }
};

export const addScheduleRange = async (studentId: string, startDate: Date, endDate: Date, shiftType: string, customStart: string | undefined, customEnd: string | undefined, daysOfWeek: number[], supervisorId: string) => {
    const ref = db.collection('userData').doc(studentId);
    const doc = await ref.get();
    if(!doc.exists) return;
    
    let currentSchedule = doc.data().schedule || [];
    
    let startTime = "07:00", endTime = "16:00";
    if (shiftType === 'Kväll') { startTime = "11:15"; endTime = "21:30"; }
    else if (shiftType === 'Natt') { startTime = "21:00"; endTime = "07:00"; }
    else if (shiftType === 'Helg') { startTime = "07:00"; endTime = "15:00"; }
    else if (shiftType === 'Egen tid' && customStart && customEnd) {
        startTime = customStart;
        endTime = customEnd;
    }

    const cur = new Date(startDate);
    const end = new Date(endDate);

    while (cur <= end) {
        if (daysOfWeek.includes(cur.getDay())) {
            const dateStr = cur.toISOString().split('T')[0];
            currentSchedule = currentSchedule.filter((s: ScheduleEntry) => !(s.studentId === studentId && s.date === dateStr));
            currentSchedule.push({
                date: dateStr,
                studentId,
                startTime,
                endTime,
                shiftType
            });
        }
        cur.setDate(cur.getDate() + 1);
    }
    await ref.update({ schedule: currentSchedule });
};

export const concludeInternship = async (studentId: string, supervisorName: string, supervisorRole: string, summary: string) => {
    const userRef = db.collection('users').doc(studentId);
    const dataRef = db.collection('userData').doc(studentId);
    
    const userSnap = await userRef.get();
    const dataSnap = await dataRef.get();
    
    if(!userSnap.exists || !dataSnap.exists) return;
    
    const user = userSnap.data();
    const userData = dataSnap.data();

    const diploma: Credential = {
        id: `cred-${Date.now()}`,
        type: 'diploma',
        title: `Godkänd Praktik - ${user.workplace || 'Okänd Enhet'}`,
        issuerName: supervisorName,
        issuerRole: supervisorRole,
        date: new Date().toISOString().split('T')[0],
        workplace: user.workplace || 'Okänd',
        summary
    };

    const pastPlacement: PastPlacement = {
        workplace: user.workplace || 'Okänd',
        role: user.role,
        period: `${userData.attendanceRecords?.[0]?.date || 'Start'} - ${new Date().toISOString().split('T')[0]}`,
        dataSnapshot: userData
    };

    await userRef.update({
        credentials: [...(user.credentials || []), diploma],
        pastPlacements: [...(user.pastPlacements || []), pastPlacement]
    });
    
    const freshData = getDefaultUserData(user.role);
    freshData.xp = userData.xp;
    await dataRef.set(freshData);
};

export const sendConnectionRequest = async (fromUserId: string, toUserId: string, fromName: string) => {
    const toUserRef = db.collection('users').doc(toUserId);
    const doc = await toUserRef.get();
    if(doc.exists) {
        const data = doc.data();
        if(!data.pendingRequests?.includes(fromUserId) && !data.connections?.includes(fromUserId)) {
            await toUserRef.update({
                pendingRequests: [...(data.pendingRequests || []), fromUserId]
            });
            await addNotification(toUserId, { text: `${fromName} vill ansluta till ditt nätverk.`, link: 'community', type: 'info' });
        }
    }
};

export const acceptConnectionRequest = async (userId: string, requesterId: string, userName: string) => {
    const userRef = db.collection('users').doc(userId);
    const reqRef = db.collection('users').doc(requesterId);
    
    const batch = db.batch();
    
    const userSnap = await userRef.get();
    const reqSnap = await reqRef.get();
    
    if(userSnap.exists && reqSnap.exists) {
        const userData = userSnap.data();
        const reqData = reqSnap.data();
        
        batch.update(userRef, {
            connections: [...(userData.connections || []), requesterId],
            pendingRequests: (userData.pendingRequests || []).filter((id: string) => id !== requesterId)
        });
        
        batch.update(reqRef, {
            connections: [...(reqData.connections || []), userId]
        });
        
        await batch.commit();
        await addNotification(requesterId, { text: `${userName} accepterade din kontaktförfrågan!`, link: 'community', type: 'success' });
    }
};

export const rejectConnectionRequest = async (userId: string, requesterId: string) => {
    const userRef = db.collection('users').doc(userId);
    const snap = await userRef.get();
    if(snap.exists) {
        const data = snap.data();
        await userRef.update({
            pendingRequests: (data.pendingRequests || []).filter((id: string) => id !== requesterId)
        });
    }
};

export const savePresentationImage = (stepIndex: number, dataUrl: string) => {
    // Keeping local for now or implement storage upload
    localStorage.setItem(`pres_img_${stepIndex}`, dataUrl);
};
export const loadPresentationImages = (): Record<number, string> => {
    const images: any = {};
    for (let i = 0; i < 20; i++) {
        const item = localStorage.getItem(`pres_img_${i}`);
        if (item) images[i] = item;
    }
    return images;
};

export const createUser = async (name: string, role: Role, workplace: string, pin: string = '1234', aplWeeks?: number) => {
    const fakeEmail = `${name.replace(/\s/g,'.').toLowerCase()}-${Date.now()}@carelearn.local`;
    return registerUser(name, fakeEmail, '123456', role, workplace, undefined, aplWeeks);
};

export const mergeStudentData = async (studentId: string, newData: any) => {
    const current = await loadUserData(studentId);
    if (current) {
        const merged: UserData = { ...current, ...newData };
        if (newData.checklistProgress) {
            merged.checklistProgress = { ...current.checklistProgress, ...newData.checklistProgress };
        }
        await saveUserData(studentId, merged);
    }
};
