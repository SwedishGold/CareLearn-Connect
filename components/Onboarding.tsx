
import React, { useState, useEffect, memo } from 'react';
import { User } from '../types';
// Removed sound import

interface OnboardingProps {
    user: User;
    onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = memo(({ user, onComplete }) => {
    const [step, setStep] = useState(0);

    const lines = [
        `Välkommen, ${user.name}...`,
        `<span class="info">[INFO]</span> Initierar profil... <span class="ok">OK</span>`,
        `<span class="info">[INFO]</span> Laddar användardata... <span class="ok">OK</span>`,
        `<span class="ok">[OK]</span> System online.`,
        `<span class="info">[INFO]</span> Detta är din digitala APL-partner.`,
        `<span class="info">[INFO]</span> Använd den för att strukturera ditt lärande och reflektera.`,
        `<span class="info">[INFO]</span> Möt AI-Handledaren - din personliga guide.`,
        `<span class="warn">[WARN]</span> OBS: Dela ALDRIG patientdata med AI:n.`,
        `<span class="ok">[OK]</span> System klart. Omdirigerar till översikt...`,
    ];

    useEffect(() => {
        if (step < lines.length - 1) {
            const timer = setTimeout(() => {
                setStep(s => s + 1);
            }, step < 3 ? 400 : 2000); 
            return () => clearTimeout(timer);
        } else if (step === lines.length - 1) {
            // Last step, wait a bit longer then complete
            const finalTimer = setTimeout(onComplete, 3000);
            return () => clearTimeout(finalTimer);
        }
    }, [step, onComplete, lines.length]);
    
    // A simple typing effect for the currently active line
    const TypingEffect: React.FC<{ text: string }> = ({ text }) => {
        const [typedText, setTypedText] = useState('');
        useEffect(() => {
            let i = 0;
            // Remove HTML tags for counting logic to avoid breaking tags, 
            // but simply appending char by char including tags works if fast enough for this visual style.
            // For safety and simplicity in this effect, we just type out chars.
            const typingInterval = setInterval(() => {
                if (i < text.length) {
                    setTypedText(prev => text.substring(0, i + 1));
                    // Removed sound call here
                    i++;
                } else {
                    clearInterval(typingInterval);
                }
            }, 50);
            return () => clearInterval(typingInterval);
        }, [text]);
        return <span className="typing-cursor" dangerouslySetInnerHTML={{ __html: typedText }} />;
    };

    return (
        <div className="onboarding-container">
            <div className="grid-overlay"></div>
            <div className="grain-overlay"></div>
            <div className="onboarding-box">
                {lines.slice(0, step + 1).map((line, index) => (
                    <p 
                        key={index} 
                        className="onboarding-line" 
                        style={{ '--line-delay': `${index * 50}ms` } as React.CSSProperties}
                    >
                        <span className="prompt">&gt;</span>
                        {index === step ? (
                             <TypingEffect text={line} />
                        ) : (
                             <span dangerouslySetInnerHTML={{ __html: line }} />
                        )}
                    </p>
                ))}
            </div>
             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
             `}</style>
        </div>
    );
});

export default Onboarding;
