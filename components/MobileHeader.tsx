import React, { memo } from 'react';

interface MobileHeaderProps {
    onMenuClick: () => void;
    appName: string;
}

const MobileHeader: React.FC<MobileHeaderProps> = memo(({ onMenuClick, appName }) => (
    <header className="lg:hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm p-4 border-b border-slate-200/80 dark:border-slate-700/80 flex justify-between items-center sticky top-0 z-20 no-print h-[65px]">
        <svg className="h-7 text-slate-800 dark:text-slate-100">
          <use href="#carelearn-logo-full"></use>
        </svg>
        <button onClick={onMenuClick} className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700 dark:text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-16 6h16" />
            </svg>
        </button>
    </header>
));

export default MobileHeader;
