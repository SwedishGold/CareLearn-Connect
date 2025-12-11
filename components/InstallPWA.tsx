import React, { useState, useEffect, memo } from 'react';

const InstallPWA: React.FC = memo(() => {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setSupportsPWA(true);
      setPromptInstall(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!promptInstall) {
      return;
    }
    promptInstall.prompt();
    promptInstall.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        setPromptInstall(null); // Clear prompt
        setSupportsPWA(false); // Hide button
    });
  };

  if (!supportsPWA) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-up w-full max-w-sm px-4">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="bg-red-600 rounded-md p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </div>
                <div>
                    <h4 className="font-bold text-slate-100 text-sm">Installera Appen</h4>
                    <p className="text-xs text-slate-400">Lägg till på hemskärmen</p>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={() => setSupportsPWA(false)}
                    className="text-slate-400 hover:text-slate-200 text-sm font-semibold px-2"
                >
                    Nej tack
                </button>
                <button 
                    onClick={handleInstallClick}
                    className="bg-slate-100 text-slate-900 text-sm font-bold py-2 px-4 rounded hover:bg-white transition-colors"
                >
                    Installera
                </button>
            </div>
        </div>
    </div>
  );
});

export default InstallPWA;