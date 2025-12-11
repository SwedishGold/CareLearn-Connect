
import { User } from '../types';

export interface SecurityCheckResult {
    safe: boolean;
    reason?: string;
    matchedString?: string;
    severity: 'warning' | 'critical';
}

/**
 * Scans text for Personally Identifiable Information (PII) using strict Regex patterns.
 * This runs 100% client-side to prevent data leakage.
 */
export const checkTextForPII = (text: string): SecurityCheckResult => {
    if (!text) return { safe: true, severity: 'warning' };

    // 1. Swedish Personnummer (SSN) - Comprehensive checks
    // Format: YYYYMMDD-XXXX, YYMMDD-XXXX, YYYYMMDDXXXX, YYMMDDXXXX
    // Also catches spaced formats: 1990 01 01 - 1234
    const ssnPattern = /(?:\b(?:\d{2}|\d{4})[- ]?(?:0[1-9]|1[0-2])[- ]?(?:0[1-9]|[12]\d|3[01])[- ]?[-+]?[- ]?\d{4}\b)/;
    const ssnMatch = text.match(ssnPattern);
    
    if (ssnMatch) {
        return { 
            safe: false, 
            reason: 'Texten innehåller format som liknar personnummer. Det är strikt förbjudet.', 
            matchedString: ssnMatch[0],
            severity: 'critical'
        };
    }

    // 2. Swedish Mobile/Phone Numbers
    const phonePattern = /\b(?:0|\+46)(?:[- ]?\d{1,3}){2,4}\b/;
    // Filter out simple years or small numbers, valid phone numbers usually > 7 digits
    const phoneMatch = text.match(phonePattern);
    if (phoneMatch && phoneMatch[0].replace(/\D/g, '').length > 7) {
        return { 
            safe: false, 
            reason: 'Texten verkar innehålla telefonnummer. Undvik kontaktuppgifter.', 
            matchedString: phoneMatch[0],
            severity: 'warning' 
        };
    }

    // 3. Email Addresses
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const emailMatch = text.match(emailPattern);
    if (emailMatch) {
         return { 
            safe: false, 
            reason: 'Texten innehåller e-postadress. Undvik kontaktuppgifter.', 
            matchedString: emailMatch[0],
            severity: 'warning' 
        };
    }

    // 4. Semantic Context (Names associated with patient roles)
    const nameContextPattern = /(patient|patienten|brukare|brukaren|boende|klient|eleven|syster)\s+(heter|är|kallad)\s+([A-ZÅÄÖ][a-zåäö]+)/i;
    const nameMatch = text.match(nameContextPattern);
    if (nameMatch) {
        return { 
            safe: false, 
            reason: 'Identifierande namnkombination upptäcktes (t.ex. "Patienten heter X"). Använd "Patienten" eller fingerade namn.', 
            matchedString: nameMatch[0],
            severity: 'warning'
        };
    }

    return { safe: true, severity: 'warning' };
};

/**
 * Sanitizes a string by masking PII (Redaction).
 * Used for scrubbing AI output or local display if needed.
 */
export const sanitizeText = (text: string): string => {
    let sanitized = text;
    
    // Mask SSNs
    sanitized = sanitized.replace(/(?:\b(?:\d{2}|\d{4})[- ]?(?:0[1-9]|1[0-2])[- ]?(?:0[1-9]|[12]\d|3[01])[- ]?[-+]?[- ]?\d{4}\b)/g, '[PERSONNUMMER]');
    
    // Mask Phones (Aggressive)
    sanitized = sanitized.replace(/\b(?:0|\+46)(?:[- ]?\d{1,3}){2,4}\b/g, (match) => match.replace(/\D/g, '').length > 7 ? '[TELEFONNUMMER]' : match);
    
    // Mask Emails
    sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');

    // Mask Names in context
    sanitized = sanitized.replace(/(patient|patienten|brukare|brukaren|boende|klient|eleven)\s+(heter|är|kallad)\s+([A-ZÅÄÖ][a-zåäö]+)/gi, '$1 $2 [NAMN]');

    return sanitized;
};

/**
 * Specific sanitizer for AI Responses to catch hallucinations of PII
 */
export const sanitizeAIResponse = (text: string): string => {
    if (!text) return '';
    
    const check = checkTextForPII(text);
    if (!check.safe) {
        // If AI generated PII, redact it
        return sanitizeText(text) + "\n\n*[Varning: AI-svaret innehöll känslig information som har censurerats automatiskt.]*";
    }
    return text;
};
