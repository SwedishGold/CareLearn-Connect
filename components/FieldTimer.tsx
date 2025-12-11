import React, { useState, useEffect, useRef, memo } from 'react';

// A single 7-segment digit component
const SevenSegmentDigit = memo(({ digit }: { digit: string }) => {
  const segmentsMap: { [key: string]: string[] } = {
    '0': ['a', 'b', 'c', 'd', 'e', 'f'],
    '1': ['b', 'c'],
    '2': ['a', 'b', 'd', 'e', 'g'],
    '3': ['a', 'b', 'c', 'd', 'g'],
    '4': ['b', 'c', 'f', 'g'],
    '5': ['a', 'c', 'd', 'f', 'g'],
    '6': ['a', 'c', 'd', 'e', 'f', 'g'],
    '7': ['a', 'b', 'c'],
    '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    '9': ['a', 'b', 'c', 'd', 'f', 'g'],
  };
  const activeSegments = segmentsMap[digit] || [];

  return (
    <div className="digit">
      {['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(s => (
        <div key={s} className={`segment ${s} ${activeSegments.includes(s) ? 'on' : ''}`}></div>
      ))}
    </div>
  );
});

// The colon separator for the timer
const Colon = memo(() => (
    <div className="colon">
        <div className="dot"></div>
        <div className="dot"></div>
    </div>
));

const ClockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);


// The main timer component that assembles the digits and text
const FieldTimer: React.FC<{ timeLeft: number }> = ({ timeLeft }) => {
  const [infoVisible, setInfoVisible] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  
  const positiveTimeLeft = Math.max(0, timeLeft);

  const minutes = Math.floor(positiveTimeLeft / 60000);
  const seconds = Math.floor((positiveTimeLeft % 60000) / 1000);
  const hundredths = Math.floor((positiveTimeLeft % 1000) / 10);

  const m1 = String(Math.floor(minutes / 10));
  const m2 = String(minutes % 10);
  const s1 = String(Math.floor(seconds / 10));
  const s2 = String(seconds % 10);
  const h1 = String(Math.floor(hundredths / 10));
  const h2 = String(hundredths % 10);

  const timeUp = timeLeft <= 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(event.target as Node)) {
        setInfoVisible(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="card-base p-6 flex flex-col justify-between h-full no-print">
        <div>
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-bold text-slate-100 flex items-center">
                    <ClockIcon />
                    <span className="ml-2">Fokustid</span>
                </h3>
                <div ref={infoRef} className="timer-info-container">
                    <button onClick={() => setInfoVisible(!infoVisible)} className="info-button" aria-label="Visa information om timer">
                    i
                    </button>
                    {infoVisible && (
                    <div className="timer-tooltip">
                        <h3 className="timer-title">FOKUSTID</h3>
                        <p className="timer-desc">
                        {timeUp 
                            ? "Din dagliga tid i appen har förbrukats. Fokusera nu på de praktiska momenten ute på avdelningen." 
                            : "Din dagliga tid är begränsad för att uppmuntra dig att spendera mer tid i den praktiska vården. AI-modeller är också mycket energikrävande, så vi använder dem ansvarsfullt."
                        }
                        </p>
                        <div className="mt-3 pt-2 border-t border-white/10 text-right text-xs text-slate-400 font-mono">
                            <p>SYS. TEMP: 36.8°C</p>
                            <p>CPU LOAD: 12%</p>
                            <p>SIGNAL: STRONG</p>
                        </div>
                    </div>
                    )}
                </div>
            </div>
             <p className="text-sm text-slate-400 mb-4">
                {timeUp ? "Din dagliga tid i appen har förbrukats." : "Kvarvarande tid i appen idag."}
            </p>
        </div>
        <div className="flex justify-center items-center my-auto">
            <div className={`timer-display ${timeUp ? 'time-up' : ''}`}>
                <SevenSegmentDigit digit={m1} />
                <SevenSegmentDigit digit={m2} />
                <Colon />
                <SevenSegmentDigit digit={s1} />
                <SevenSegmentDigit digit={s2} />
                <Colon />
                <SevenSegmentDigit digit={h1} />
                <SevenSegmentDigit digit={h2} />
            </div>
        </div>
    </div>
  );
};

export default memo(FieldTimer);