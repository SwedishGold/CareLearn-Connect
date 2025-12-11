import { User, UserData } from '../types';
import { APP_DATA } from '../constants';

/**
 * Generates a list of actionable reminders for students.
 */
export const getStudentReminders = (data: UserData): string[] => {
    const reminders: string[] = [];
    
    const checklistCompleted = Object.values(data.checklistProgress || {}).filter(Boolean).length;
    const isChecklistDone = checklistCompleted >= APP_DATA.checklist.length;
    
    if (!isChecklistDone) {
        reminders.push("Fortsätt att arbeta med din introduktionschecklista.");
    }
    
    if (data.logbookEntries.length < 3) {
        reminders.push("Kom ihåg att reflektera regelbundet i din loggbok.");
    }

    const goalsRatedCount = Object.values(data.goalsProgress || {}).filter(g => (g as any).rating > 0).length;
    if (goalsRatedCount < APP_DATA.knowledgeRequirements.length) {
        reminders.push("Ta en stund för att skatta och reflektera över dina lärandemål.");
    }

    if (data.knowledgeTestHistory.length === 0) {
        reminders.push("Testa dina kunskaper i kunskapstestet för att se vad du kan.");
    }

    return reminders;
};

/**
 * Generates a list of actionable reminders for supervisors/teachers.
 */
export const getSupervisorReminders = (studentData: { user: User; data: UserData }[]): string[] => {
    if (studentData.length === 0) return [];
    
    const reminders = new Set<string>();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    studentData.forEach(sd => {
        // Check for inactive logbook
        const lastEntry = sd.data.logbookEntries.slice(-1)[0];
        if (!lastEntry || lastEntry.timestamp < threeDaysAgo) {
            reminders.add(`${sd.user.name} har inte skrivit i loggboken på över 3 dagar.`);
        }

        // Check for very low-rated goals
        const lowRatedGoal = Object.values(sd.data.goalsProgress).some(g => g.rating > 0 && g.rating <= 2);
        if (lowRatedGoal) {
            reminders.add(`${sd.user.name} har skattat sig lågt på ett lärandemål. Följ upp!`);
        }
    });

    if (reminders.size === 0) {
        reminders.add("Alla studenter verkar vara aktiva. Bra jobbat!");
    }
    
    reminders.add("Använd AI-stödet för att få en snabb överblick över framsteg.");

    return Array.from(reminders);
};