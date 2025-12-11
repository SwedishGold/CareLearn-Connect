
import React, { memo } from 'react';
import { User, DepartmentSettings } from '../types';

interface ContextualOnboardingProps {
    user: User;
    settings: DepartmentSettings;
    onContinue: () => void;
}

const ContextualOnboarding: React.FC<ContextualOnboardingProps> = memo(({ user, settings, onContinue }) => {
    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-xl p-8 shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Välkommen till {settings.workplaceName}</h1>
                    <p className="text-slate-400">Din digitala introduktion är redo.</p>
                </div>

                <div className="space-y-6 text-slate-300">
                    <p>
                        Vi har anpassat CareLearn för din roll som <strong>{user.role}</strong> inom <strong>{settings.specialty}</strong>.
                    </p>
                    
                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                        <h3 className="font-bold text-white mb-2">Vad har skapats åt dig?</h3>
                        <ul className="list-disc list-inside space-y-2 text-sm">
                            <li>En checklista med {settings.checklist.split('\n').length} punkter specifika för denna enhet.</li>
                            <li>Lärandemål baserade på din utbildningsnivå.</li>
                            <li>En kunskapsbank med relevanta rutiner (som du kan utöka).</li>
                        </ul>
                    </div>

                    <p>
                        AI-Handledaren är förladdad med kontext om din arbetsplats: 
                        <br/>
                        <em className="text-sm text-slate-400">"{settings.workplaceDescription}"</em>
                    </p>
                </div>

                <div className="mt-8 flex justify-center">
                    <button 
                        onClick={onContinue}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg transition-colors shadow-lg shadow-red-900/20"
                    >
                        Starta Introduktionen
                    </button>
                </div>
            </div>
        </div>
    );
});

export default ContextualOnboarding;
