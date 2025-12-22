
import React from 'react';

export type Role =
  | 'usk-elev'
  | 'ssk-student'
  | 'handledare-usk'
  | 'handledare-ssk'
  | 'larare-usk'
  | 'larare-ssk'
  | 'admin'
  | 'developer' // New Role: Andreas Hillborgh (Super Admin)
  | 'vikarie-usk'
  | 'vikarie-ssk'
  | 'overlakare'
  | 'huvudhandledare'
  | 'anstalld-usk'
  | 'anstalld-ssk';

export type CareSpecialty = 'psykiatri' | 'aldreomsorg' | 'akutsjukvard' | 'lss' | 'primarvard' | 'annat';

export interface Credential {
    id: string;
    type: 'diploma' | 'certificate';
    title: string; // e.g. "Godkänd APL - PIVA"
    issuerName: string;
    issuerRole: string;
    date: string;
    workplace: string;
    summary: string; // e.g. "Checklista 100%, Omdöme: Väl godkänd"
}

export interface PastPlacement {
    workplace: string;
    role: Role;
    period: string; // "2023-01-01 - 2023-02-01"
    dataSnapshot: UserData;
}

export interface AIGeneratedProfile {
    bio: string;
    strengths: string[];
    learningTips: string;
    welcomeMessage: string;
}

// NEW: Workplace definition for multi-tenancy
export interface Workplace {
    id: string;
    name: string;
    city: string;
    specialty: CareSpecialty;
    description: string; // AI generated context
    checklist: string; // Newline separated
    knowledgeRequirements: string; // Newline separated
    knowledgeTestQuestionsUsk?: string; // JSON string
    knowledgeTestQuestionsSsk?: string; // JSON string
    memberCount: number;
    createdByType: 'AI' | 'User';
    searchKey: string; // Lowercase name for searching
}

// --- Registration / Beta policy ---
export interface RegistrationConfig {
  // Which workplaces can be selected during self-signup (beta gating).
  // IMPORTANT: use workplace IDs to avoid ambiguity/bias from name-only matching.
  allowedWorkplaces: { id: string; name: string }[];
  // Roles that require manual provisioning by Developer (cannot self-signup).
  blockedSignupRoles: Role[];
  // Shown in UI and used in error messages.
  betaInfoText: string;
  developerContactEmail: string;
  developerLinkedInUrl: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  pin?: string;
  email?: string; // New: For login
  password?: string; // New: Simulated hash
  apiKey?: string; // New: BYOK (Bring Your Own Key)
  googleId?: string; // New: For Google Auth simulation
  supervisorId?: string; // ID of the assigned supervisor
  workplace?: string; // Display name of workplace
  workplaceId?: string; // NEW: ID linking to Workplace collection
  connections?: string[]; // IDs of connected users (friends/colleagues)
  pendingRequests?: string[]; // IDs of users who have sent a connection request
  credentials?: Credential[]; // NEW: Portable merits
  pastPlacements?: PastPlacement[]; // NEW: Archived data
  createdAt?: string; // ISO Timestamp
  aiGeneratedProfile?: AIGeneratedProfile; // AI generated context
}

export type View =
  | 'dashboard'
  | 'checklist'
  | 'logbook'
  | 'goals'
  | 'knowledge-test'
  | 'modules'
  | 'chatbot'
  | 'about'
  | 'feedback'
  | 'profile-selection'
  | 'progress' // Supervisor view
  | 'student-detail' // Supervisor view
  | 'supervisor-chatbot' // Supervisor view
  | 'resources' // Supervisor view
  | 'admin-dashboard' // Admin view
  | 'developer-dashboard' // NEW: Developer view
  | 'feedback-viewer' // Admin view
  | 'flagged-content' // Admin view for flagged AI content
  | 'file-management' // Admin view
  | 'attendance' // Student view for attendance
  | 'ai-license' // Student view for AI ethics and usage course
  | 'presentation' // View for the new guided tour presentation
  | 'qa' // View for the new Q&A page
  | 'about-creator' // View for the new "About Me" page
  | 'example-report' // View for the example university report
  | 'communication-lab' // Student view for voice scenarios
  | 'analytics' // Admin/Supervisor view for data visualization
  | 'ai-feedback-viewer' // Admin view for AI chat feedback
  | 'department-settings'
  | 'clinical-simulator' // New view for interactive cases
  | 'community' // NEW: Social Network View
  | 'settings'; // NEW: Settings View

export interface ViewConfig {
    requiresStudentAILicense?: boolean;
    requiresStaffAILicense?: boolean;
    requiresAdminAILicense?: boolean;
}

export const VIEW_CONFIGS: Record<View, ViewConfig> = {
    'dashboard': {},
    'checklist': {},
    'logbook': {},
    'goals': {},
    'knowledge-test': {},
    'modules': {},
    'chatbot': { requiresStudentAILicense: true },
    'about': {},
    'feedback': {},
    'profile-selection': {},
    'progress': { requiresStaffAILicense: true },
    'student-detail': {},
    'supervisor-chatbot': { requiresStaffAILicense: true },
    'resources': { requiresStaffAILicense: true },
    'admin-dashboard': {},
    'developer-dashboard': {}, // No license required for dev
    'feedback-viewer': { requiresAdminAILicense: true },
    'flagged-content': { requiresAdminAILicense: true },
    'file-management': { requiresAdminAILicense: true },
    'attendance': {},
    'ai-license': {},
    'presentation': {},
    'qa': {},
    'about-creator': {},
    'example-report': {},
    'communication-lab': { requiresStudentAILicense: true },
    'analytics': { requiresAdminAILicense: true },
    'ai-feedback-viewer': { requiresAdminAILicense: true },
    'department-settings': { requiresAdminAILicense: true },
    'clinical-simulator': { requiresStudentAILicense: true },
    'community': {},
    'settings': {},
};

export interface ChecklistProgress {
  [key: number]: boolean;
}

export interface LogbookComment {
    authorId: string;
    authorName: string;
    text: string;
    timestamp: Date;
}

export interface CriticalIncident {
  situation: string;
  thoughtsAndFeelings: string;
  actions: string;
  outcomes: string;
  analysis: string;
}

export interface LogbookEntry {
  timestamp: Date;
  text: string; // Will now store formatted markdown for both types for easy rendering
  type: 'standard' | 'incident';
  incident?: CriticalIncident;
  comments?: LogbookComment[];
  aiSuggestion?: string;
}

export interface GoalProgress {
    rating: number;
    reflection: string;
}

export interface GoalsProgress {
  [goalId: string]: GoalProgress;
}

export interface KnowledgeTestAnswer {
    t: string;
    c: boolean;
}

export interface KnowledgeTestQuestion {
    q: string;
    a: KnowledgeTestAnswer[];
    e: string;
    originalIndex: number;
    verified?: boolean;
}

export interface KnowledgeTestAttemptAnswer {
    questionOriginalIndex: number;
    selectedAnswerIndex: number;
    isCorrect: boolean;
}

export type KnowledgeTestTier = 'tier1' | 'tier2' | 'vikarie';

export interface KnowledgeTestAttempt {
    timestamp: Date;
    score: number;
    totalQuestions: number;
    answers: KnowledgeTestAttemptAnswer[];
    questionOrder?: number[]; // Array of originalIndex in the order they were presented. Optional for backward compatibility.
    tier: KnowledgeTestTier;
}

export interface KnowledgeTestInProgress {
    questions: KnowledgeTestQuestion[];
    currentQuestionIndex: number;
    currentAttemptAnswers: KnowledgeTestAttemptAnswer[];
    tier: KnowledgeTestTier;
}

export interface ChatMessageSource {
  docId: string;
  title: string;
  quote: string;
}

export interface ChatMessage {
    id: string;
    sender: 'user' | 'bot';
    text: string;
    feedback?: 'liked' | 'disliked';
    isWarning?: boolean;
    reasoning?: string;
    confidence?: number;
    sources?: ChatMessageSource[];
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
}

export type AttendanceStatus = 'present' | 'sick' | 'absent';

export interface AttendanceRecord {
    date: string; // YYYY-MM-DD
    status: AttendanceStatus;
    notes?: string;
    startTime?: string; // HH:mm
    endTime?: string; // HH:mm
}

export interface Notification {
    id: string;
    text: string;
    timestamp: Date;
    read: boolean;
    link?: View;
    linkContext?: any; // To pass additional context, e.g., a doc ID
    type?: 'info' | 'success' | 'alert'; // Added type for visual styling
}

export interface ToastNotification {
    id: string;
    text: string;
    type: 'info' | 'success' | 'alert';
}

export interface MonthlyUsage {
  month: string; // 'YYYY-MM'
  activeDays: string[];
  scenariosUsed: number;
}

export interface DailyScenarioUsage {
  date: string; // 'YYYY-MM-DD'
  count: number;
}

export interface SavedCareFlow {
  id: string;
  query: string;
  flow: CareFlowStep[];
  timestamp: string;
}

export interface ScheduleEntry {
  date: string; // YYYY-MM-DD
  studentId: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  shiftType: 'Dag' | 'Kväll' | 'Natt' | 'Helg' | string;
}

// New type for single-turn challenge
export interface DailyChallenge {
    title: string;
    scenario: string;
    options: {
        id: string;
        text: string;
        isCorrect: boolean;
        feedback: string;
    }[];
}

export interface CompletedChallenge {
    id: string;
    timestamp: string; // ISO date
    challenge: DailyChallenge;
    selectedOptionId: string;
    isCorrect: boolean;
}

export interface SBARFeedback {
    s: { score: number; feedback: string }; // Situation
    b: { score: number; feedback: string }; // Background
    a: { score: number; feedback: string }; // Assessment
    r: { score: number; feedback: string }; // Recommendation
    overall: string;
}

export interface DailySuggestion {
    suggestion: string;
    timestamp: string; // ISO date string
    completed?: boolean;
    type?: 'checklist' | 'goal' | 'general';
    relatedId?: string | number; // Index for checklist, ID for goal
}

export interface UserData {
  checklistProgress: ChecklistProgress;
  awardedChecklistItems?: number[]; // Track items that have already awarded XP
  logbookEntries: LogbookEntry[];
  goalsProgress: GoalsProgress;
  knowledgeTestHistory: KnowledgeTestAttempt[];
  knowledgeTestInProgress: KnowledgeTestInProgress | null;
  chatHistory: ChatMessage[];
  logbookStreak?: {
      current: number;
      longest: number;
      lastEntryDate: string | null; // ISO date string YYYY-MM-DD
  };
  achievements?: string[]; // Array of achievement IDs
  aplTotalDays?: number;
  attendanceRecords?: AttendanceRecord[];
  notifications?: Notification[];
  hasCompletedAILicense?: boolean;
  hasCompletedStaffAILicense?: boolean;
  hasCompletedAdminAILicense?: boolean;
  isFirstLogin?: boolean;
  gdprWarningCount?: number;
  dailyUsage?: {
      date: string; // YYYY-MM-DD
      // REMOVED TIME LEFT
  };
  monthlyUsage?: MonthlyUsage;
  dailyScenarioUsage?: DailyScenarioUsage;
  dailySimulatorUsage?: DailyScenarioUsage; // New field for Clinical Simulator usage
  clinicalChallengeHistory?: CompletedChallenge[]; // NEW: Store challenge history
  aiSuggestion?: DailySuggestion;
  completedCommunicationScenarios?: string[];
  scenarioImages?: { [scenarioTitle: string]: string };
  unlockedKnowledgeTiers?: {
      usk: number;
      ssk: number;
  };
  savedCareFlows?: SavedCareFlow[];
  schedule?: ScheduleEntry[]; // For supervisors
  supervisorInsights?: string; // Cache for supervisor insights
  lastSynced?: string; // ISO timestamp of last sync
  xp?: number; // Total Experience Points
}

export interface FeedbackEntry {
    id: string;
    timestamp: Date;
    user?: User;
    title: string; // The self-reported title from the dropdown
    ageRange: string; // e.g., "18-25", "26-35"
    gender: 'man' | 'kvinna' | 'vill-ej-ange';
    overallImpression: number; // 1-5
    featureUsefulness: {
        checklist: number; // 1-5
        knowledgeTest: number; // 1-5
        structure: number; // 1-5
    };
    aiAndThinking: {
        viewOnAI: number; // 1-5
        criticalThinking: number; // 1-5
    };
    comments: string; // Free text comments
}

export interface FlaggedContentEntry {
    id: string;
    timestamp: Date;
    user: User;
    chatHistory: ChatMessage[];
    flaggedMessageIndex: number;
    reason: string;
    status: 'new' | 'reviewed';
}

export interface NavItem {
  view: View;
  icon: React.ReactNode;
  label: string;
}

export interface CustomDocumentMetadata {
    type?: string;
    validUntil?: string | null;
    responsibleUnit?: string | null;
    sourceUrl?: string; // Added source URL
}

export interface CustomDocument {
  id: string;
  title: string;
  content: string;
  isCustom?: boolean; // Added to distinguish from built-in
  metadata?: CustomDocumentMetadata;
  workplace?: string; // To track which workplace this document belongs to
  isGlobal?: boolean; // If true, pushed by Developer to specific workplaces
  targetRole?: Role | 'all'; // NEW: Target specific roles with this document
}

export interface CareFlowStep {
  step: number;
  title: string;
  description: string;
  sourceTitle?: string;
  sourceDocId?: string;
  sourceQuote?: string;
}

export interface DepartmentSettings {
    specialty: CareSpecialty;
    workplaceName: string; // e.g., "Kirurgen Huddinge"
    workplaceDescription?: string; // NEW: AI summary of the workplace for chatbot context
    appName: string;
    primaryColor: string;
    checklist: string;
    knowledgeRequirements: string;
    knowledgeTestQuestionsUsk: string; // JSON string of { tier1: [], tier2: [] }
    knowledgeTestQuestionsSsk: string; // JSON string of { tier1: [], tier2: [] }
    customDocuments: CustomDocument[];
    dailyTimeLimitSeconds: number;
    monthlyActiveDaysLimit: number;
    communicationLabDailyLimit: number;
    communicationLabMonthlyLimit: number;
    clinicalSimulatorDailyLimit: number;
    // NEW: License and Sync Fields
    licenseType?: 'Free' | 'Pro' | 'Enterprise';
    licenseSeats?: number;
    lastCloudSync?: string;
}

export interface GeneratedAppConfig {
    checklist: string[];
    goals: string[];
    specialty: CareSpecialty;
    welcomeMessage: string;
    workplaceDescription?: string; 
    resources: { title: string; content: string; type: string }[];
    quizQuestions?: { 
        tier1: KnowledgeTestQuestion[];
        tier2: KnowledgeTestQuestion[];
    };
}

export interface ExternalFeedbackAnalysis {
    totalEntries: number;
    overallSummary: string;
    positiveThemes: string[];
    improvementAreas: string[];
    actionableRecommendations: string[];
    demographics: {
        ageDistribution: { group: string; count: number }[];
        genderDistribution: { gender: string; count: number }[];
        roleDistribution: { role: string; count: number }[];
    };
    ratings: {
        averageOverall: number | null;
    };
    notableQuotes: {
        quote: string;
        context?: string;
    }[];
}

export interface UnansweredQuestion {
    id: string;
    question: string;
    timestamp: string; // ISO string
    userId: string;
    userName: string;
}

export interface CompetenceDomain {
    name: string;
    score: number; // 0-100
    status: 'critical' | 'warning' | 'good';
    gapDescription: string;
}

export interface FeedbackAnalysis {
    sentimentScore: number; // 0-100
    sentimentLabel: 'Negativ' | 'Neutral' | 'Positiv';
    executiveSummary: string;
    trendingTopics: { topic: string; sentiment: 'pos' | 'neg'; count: number }[];
    criticalAlerts: string[]; // Serious issues found in text
}

export type PostCategory = 'knowledge' | 'question' | 'praise' | 'tip' | 'progress';

export interface PostComment {
    id: string;
    authorName: string;
    authorRole: Role | 'AI';
    text: string;
    timestamp: string; // ISO
    isAI?: boolean;
}

export interface Post {
    id: string;
    authorId: string;
    authorName: string;
    authorRole: Role;
    workplace: string; // Display Name
    workplaceId?: string; // Scope posts to workplace ID
    content: string;
    category: PostCategory;
    timestamp: string; // ISO
    likes: number;
    comments: PostComment[];
}
