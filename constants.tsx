
import React from 'react';
import { User, Role, KnowledgeTestQuestion, Achievement, CustomDocument, CareSpecialty } from './types';

// FIX: Exporting ICONS to be available in other modules.
export const ICONS = {
    modules: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    mic: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>,
    resources: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v11.494m-9-8.494h18m-18 5.494h18M5.494 12l1.503-3.006a.55.55 0 01.992 0L9 12m-3.506 0l1.503 3.006a.55.55 0 00.992 0L9 12m6 0l-1.503-3.006a.55.55 0 01.992 0L15 12m-3.506 0l1.503 3.006a.55.55 0 00.992 0L15 12" /></svg>,
    supervisor: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    chartPie: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>,
    admin: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286zm0 13.036h.008v.008h-.008v-.008z" /></svg>,
    developer: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    feedbackViewer: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    flaggedContentViewer: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6H8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>,
    fileManagement: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
    student: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>,
    userCircle: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    teacher: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    bell: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
    tour: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V5.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
    qa: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    about: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    feedback: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
    moon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
    sun: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    aiTips: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
    ai: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
    logbook: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v11.494m-9-8.494h18m-18 5.494h18M5.494 12l1.503-3.006a.55.55 0 01.992 0L9 12m-3.506 0l1.503 3.006a.55.55 0 00.992 0L9 12m6 0l-1.503-3.006a.55.55 0 01.992 0L15 12m-3.506 0l1.503 3.006a.55.55 0 00.992 0L15 12" /></svg>,
    goals: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M12 12l-6.75 4.5M12 12l6.75 4.5" /></svg>,
    knowledgeTest: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    checklist: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    calendar: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    warning: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    cross: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
    trash: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    flag: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6H8.5l-1-1H5a2 2 0 00-2 2z" /></svg>,
    brain: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
    link: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.536a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
    arrowRight: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>,
    search: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    book: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v11.494m-9-8.494h18m-18 5.494h18M5.494 12l1.503-3.006a.55.55 0 01.992 0L9 12m-3.506 0l1.503 3.006a.55.55 0 00.992 0L9 12m6 0l-1.503-3.006a.55.55 0 01.992 0L15 12m-3.506 0l1.503 3.006a.55.55 0 00.992 0L15 12" /></svg>,
    document: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
    lock: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    diploma: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
    sbar: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    cloud: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>,
    server: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>,
    shield: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    users: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    settings: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
};

export const ROLE_ICONS: Record<Role, React.ReactElement> = {
    'usk-elev': ICONS.student,
    'ssk-student': ICONS.student,
    'handledare-usk': ICONS.supervisor,
    'handledare-ssk': ICONS.supervisor,
    'huvudhandledare': ICONS.supervisor,
    'larare-usk': ICONS.teacher,
    'larare-ssk': ICONS.teacher,
    'admin': ICONS.admin,
    'developer': ICONS.developer,
    'vikarie-usk': ICONS.userCircle,
    'vikarie-ssk': ICONS.userCircle,
    'anstalld-usk': ICONS.userCircle,
    'anstalld-ssk': ICONS.userCircle,
    'overlakare': ICONS.supervisor,
};

export const TERMINOLOGY = [
    { term: 'LPT', definition: 'Lagen om psykiatrisk tvångsvård', context: 'Används när patienten motsätter sig vård...' },
    { term: 'HSL', definition: 'Hälso- och sjukvårdslagen', context: 'Frivillig vård...' },
    { term: 'PIVA', definition: 'Psykiatrisk Intensivvårdsavdelning', context: 'Avdelning för akut sjuka...' },
    { term: 'SBAR', definition: 'Situation, Bakgrund, Aktuellt, Rekommendation', context: 'Kommunikationsmodell...' },
];

export const VASTERNORRLAND_UNITS = [
    // Sundsvall - Sjukhus
    { name: 'Avdelning 51 PIVA Sundsvall', specialty: 'psykiatri' },
    { name: 'Avdelning 52 Sundsvall', specialty: 'psykiatri' },
    { name: 'Avdelning 50 Sundsvall', specialty: 'psykiatri' },
    { name: 'Avdelning 7 Sundsvall', specialty: 'akutsjukvard' },
    { name: 'Psykiatriska Kliniken Sundsvall (Allmän)', specialty: 'psykiatri' },
    { name: 'Rättspsykiatrin Sundsvall (RPK)', specialty: 'psykiatri' },
    { name: 'BUP Sundsvall (Barn- och ungdomspsykiatri)', specialty: 'psykiatri' },
    { name: 'Avdelning 24 Hjärtavdelning Sundsvall', specialty: 'akutsjukvard' },
    { name: 'Avdelning 12 Ortoped Sundsvall', specialty: 'akutsjukvard' },
    { name: 'Avdelning 27 Stroke Sundsvall', specialty: 'akutsjukvard' },
    { name: 'Avdelning 25 Stroke/Rehab Sundsvall', specialty: 'akutsjukvard' },
    { name: 'Avdelning 10 Kirurg Sundsvall', specialty: 'akutsjukvard' },
    { name: 'Avdelning 11 Kirurg/Urolog Sundsvall', specialty: 'akutsjukvard' },
    { name: 'Avdelning 26 Lung/Medicin Sundsvall', specialty: 'akutsjukvard' },
    { name: 'IVA (Intensivvårdsavdelningen) Sundsvall', specialty: 'akutsjukvard' },
    { name: 'Akutmottagningen Sundsvall', specialty: 'akutsjukvard' },
    { name: 'Förlossningen Sundsvall', specialty: 'annat' },
    { name: 'BB Sundsvall', specialty: 'annat' },
    { name: 'Geriatriken Sundsvall', specialty: 'aldreomsorg' },
    
    // Sundsvall - Hälsocentraler
    { name: 'Hälsocentralen Nacksta', specialty: 'primarvard' },
    { name: 'Hälsocentralen Granlo', specialty: 'primarvard' },
    { name: 'Hälsocentralen Skönsberg', specialty: 'primarvard' },
    { name: 'Hälsocentralen Centrum Sundsvall', specialty: 'primarvard' },
    { name: 'Hälsocentralen Matfors', specialty: 'primarvard' },
    { name: 'Hälsocentralen Alnö', specialty: 'primarvard' },

    // Örnsköldsvik
    { name: 'Psykiatriska Mottagningen Örnsköldsvik', specialty: 'psykiatri' },
    { name: 'Medicinavdelning Örnsköldsvik', specialty: 'akutsjukvard' },
    { name: 'Kirurgavdelning Örnsköldsvik', specialty: 'akutsjukvard' },
    { name: 'Akutmottagningen Örnsköldsvik', specialty: 'akutsjukvard' },
    { name: 'Hälsocentralen Ankaret', specialty: 'primarvard' },
    { name: 'Hälsocentralen Domsjö', specialty: 'primarvard' },
    
    // Sollefteå
    { name: 'Sollefteå Sjukhus Medicin', specialty: 'akutsjukvard' },
    { name: 'Sollefteå Sjukhus Rehab', specialty: 'annat' },
    { name: 'Akutmottagningen Sollefteå', specialty: 'akutsjukvard' },
    { name: 'Hälsocentralen Sollefteå', specialty: 'primarvard' },

    // Kommunal Vård (Exempel) - Sundsvall
    { name: 'SÄBO Norra Kajen', specialty: 'aldreomsorg' },
    { name: 'SÄBO Lindgården', specialty: 'aldreomsorg' },
    { name: 'Hemtjänsten Skönsmon', specialty: 'aldreomsorg' },
    { name: 'Hemtjänsten Centrum', specialty: 'aldreomsorg' },
    { name: 'LSS Gruppboende Granloholm', specialty: 'lss' },
    { name: 'LSS Bosvedjan', specialty: 'lss' },
    
    // Kommunal Vård - Timrå
    { name: 'SÄBO Haga Äldreboende Timrå', specialty: 'aldreomsorg' },
    { name: 'Hemtjänst Timrå Centrum', specialty: 'aldreomsorg' },

    // Kommunal Vård - Härnösand
    { name: 'SÄBO Högsliden Härnösand', specialty: 'aldreomsorg' },
    { name: 'Hemtjänst Härnösand', specialty: 'aldreomsorg' },
    
    // Kommunal Vård - Kramfors
    { name: 'SÄBO Jättespannet Kramfors', specialty: 'aldreomsorg' },
    
    // Kommunal Vård - Ånge
    { name: 'SÄBO Parkbacken Ånge', specialty: 'aldreomsorg' },
];

export const SPECIALTY_DATA: Record<string, any> = {
    'psykiatri': { checklist: [], goals: [] },
    'aldreomsorg': { checklist: [], goals: [] },
    'akutsjukvard': { checklist: [], goals: [] },
    'lss': { checklist: [], goals: [] },
    'primarvard': { checklist: [], goals: [] },
    'annat': { checklist: [], goals: [] }
};

export const DOCUMENT_RELATIONS: Record<string, string[]> = {};

export const ACHIEVEMENTS: Record<string, Achievement> = {
    'CHECKLIST_COMPLETE': { id: 'CHECKLIST_COMPLETE', name: 'Checklista Klar', description: 'Du har klarat alla moment!', icon: '✅' },
    'KNOWLEDGE_TEST_ACE': { id: 'KNOWLEDGE_TEST_ACE', name: 'Prov-ess', description: 'Alla rätt på provet!', icon: '🧠' },
    'LOGBOOK_5': { id: 'LOGBOOK_5', name: 'Reflekterare', description: '5 loggboksinlägg skrivna.', icon: '📝' },
    'STREAK_3': { id: 'STREAK_3', name: 'På Hugget', description: '3 dagar i rad.', icon: '🔥' },
    'STREAK_5': { id: 'STREAK_5', name: 'Fokuserad', description: '5 dagar i rad.', icon: '⚡' },
    'AI_LICENSE_COMPLETE': { id: 'AI_LICENSE_COMPLETE', name: 'AI-Körkort', description: 'Behörig att använda AI-stöd.', icon: '🤖' },
    'AI_LICENSE_STAFF': { id: 'AI_LICENSE_STAFF', name: 'AI-Körkort (Personal)', description: 'Behörig att använda AI-stöd.', icon: '🤖' },
    'AI_LICENSE_ADMIN': { id: 'AI_LICENSE_ADMIN', name: 'AI-Körkort (Admin)', description: 'Behörig att använda AI-stöd.', icon: '🤖' },
    'COMM_LAB_FIRST_TRY': { id: 'COMM_LAB_FIRST_TRY', name: 'Första Samtalet', description: 'Genomfört ett scenario i labbet.', icon: '💬' },
    'CLINICAL_CHALLENGE_MASTER': { id: 'CLINICAL_CHALLENGE_MASTER', name: 'Klinisk Mästare', description: 'Klarat dagens kliniska utmaning.', icon: '🏥' },
};

// Ensure the fallback data has 4 options for consistency, even though AI should overwrite this.
export const APP_DATA = {
    checklist: [
        "Hälsa på personal och patienter",
        "Genomgång av sekretessregler",
        "Rundvandring på avdelningen",
        "Genomgång av brandskydd",
        "Larmrutiner och nödutgångar",
        "Dokumentation i journalsystem (introduktion)",
        "Hygienrutiner (Basala hygienrutiner)",
        "Genomgång av akutvagn/akututrustning",
        "Delta vid överrapportering",
        "Observera medicinutdelning"
    ],
    knowledgeRequirements: [
        { id: 'goal1', text: "Kunna redogöra för basala hygienrutiner" },
        { id: 'goal2', text: "Förstå sekretesslagen och dess tillämpning" },
        { id: 'goal3', text: "Kunna kommunicera respektfullt med patienter" },
        { id: 'goal4', text: "Förstå skillnaden mellan HSL och LPT" },
        { id: 'goal5', text: "Kunna ta vitalparametrar (blodtryck, puls, temp)" },
    ],
    knowledgeTestQuestions: {
        usk: {
            tier1: [
                { q: "Vad är viktigast vid handhygien?", a: [{ t: "Sprit före/efter moment", c: true }, { t: "Bara tvål", c: false }, { t: "Vatten enbart", c: false }, { t: "Torka på byxorna", c: false }], e: "Sprit avdödar bakterier effektivast. Tvål och vatten behövs vid synlig smuts.", originalIndex: 1 },
                { q: "Får du läsa journaler för patienter du inte vårdar?", a: [{ t: "Ja, om jag är nyfiken", c: false }, { t: "Nej", c: true }, { t: "Ja, om de är kända", c: false }, { t: "Bara om ingen ser", c: false }], e: "Sekretesslagen och PDL förbjuder obehörig åtkomst.", originalIndex: 2 }
            ],
            tier2: [
                { q: "En patient är hotfull, vad gör du?", a: [{ t: "Skriker tillbaka", c: false }, { t: "Backar och kallar på hjälp", c: true }, { t: "Brottar ner patienten ensam", c: false }, { t: "Ignorerar det", c: false }], e: "Säkerhet först. De-eskalera och sök stöd.", originalIndex: 3 }
            ]
        },
        ssk: {
            tier1: [
                { q: "Vilken lag styr tvångsvård?", a: [{ t: "LPT", c: true }, { t: "SoL", c: false }, { t: "LSS", c: false }, { t: "HSL", c: false }], e: "Lagen om psykiatrisk tvångsvård (LPT).", originalIndex: 1 }
            ],
            tier2: [
                { q: "Vad är SBAR?", a: [{ t: "En rapportmodell", c: true }, { t: "En medicin", c: false }, { t: "En diagnos", c: false }, { t: "Ett journalsystem", c: false }], e: "Situation, Bakgrund, Aktuellt, Rekommendation - för säker kommunikation.", originalIndex: 2 }
            ]
        },
        vikarieUsk: [
             { q: "Var finns brandsläckaren?", a: [{ t: "I korridoren", c: true }, { t: "Hemma", c: false }, { t: "I källaren", c: false }, { t: "Vet ej", c: false }], e: "Se utrymningsplan.", originalIndex: 1 }
        ],
        vikarieSsk: [
             { q: "Vem ansvarar för läkemedel?", a: [{ t: "Sjuksköterskan", c: true }, { t: "Undersköterskan", c: false }, { t: "Lokalvårdaren", c: false }, { t: "Patienten själv (inlagd)", c: false }], e: "SSK har delegeringsansvar.", originalIndex: 1 }
        ]
    },
    adminProfile: {
        id: 'admin-seed',
        name: 'Admin',
        role: 'admin' as Role,
        workplace: 'CareLearn HQ'
    },
    documents: {
        'doc1': { id: 'doc1', title: 'Brandskyddspolicy', content: 'Vid brand: Rädda, Larma, Släck.' },
        'doc2': { id: 'doc2', title: 'Sekretesspolicy', content: 'Tystnadsplikt gäller alla.' }
    }
};
