
import React, { memo, useMemo } from 'react';
import { ChecklistProgress, Role } from '../types';
import { APP_DATA, ICONS } from '../constants';
import { InfoTooltip } from './UI';
import { playToggle } from '../services/soundService';

interface ChecklistProps {
  progress: ChecklistProgress;
  onToggle: (index: number, isChecked: boolean) => void;
  isReadOnly?: boolean;
  onAskAI?: (prompt: string) => void;
  userRole?: Role;
  docMap?: Record<number, string> | null;
  onNavigateToDoc?: (docId: string) => void;
  // NEW: Accept dynamic items
  customItems?: string[];
}

const Checklist: React.FC<ChecklistProps> = memo(({ progress, onToggle, isReadOnly = false, onAskAI, userRole, docMap, onNavigateToDoc, customItems }) => {
  // Use custom items if provided (from AI/Settings), otherwise fallback to default APP_DATA
  const items = useMemo(() => {
      return (customItems && customItems.length > 0) ? customItems : APP_DATA.checklist;
  }, [customItems]);

  const completed = Object.values(progress).filter(Boolean).length;
  const total = items.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  const isSupervisor = userRole && (userRole.startsWith('handledare') || userRole.startsWith('larare'));
  const tooltipText = isSupervisor
    ? "Detta är studentens introduktionschecklista. Gå igenom och bocka av punkterna tillsammans med studenten för att dokumentera hens framsteg."
    : "Detta är en lista med praktiska moment att gå igenom under din APL. Bocka av dem tillsammans med din handledare för att säkerställa att du får en komplett introduktion.";

  const handleToggleWrapper = (index: number, checked: boolean) => {
      if (!isReadOnly) {
          playToggle();
          onToggle(index, checked);
      }
  };

  return (
    <div className="card-base p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Introduktionschecklista</h3>
                <InfoTooltip text={tooltipText} />
            </div>
            <span className="text-lg font-bold text-red-600 dark:text-red-400">{percentage}%</span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4">
          <div
            className="bg-red-500 h-4 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
         <p className="text-sm text-right text-slate-500 dark:text-slate-400 mt-1">{completed} av {total} punkter avklarade</p>
      </div>

      {isReadOnly && (
        <div className="mb-6 p-4 bg-orange-100 dark:bg-orange-900/40 border-l-4 border-orange-400 text-orange-800 dark:text-orange-200 rounded-r-md">
          <p><strong className="font-bold">Observera:</strong> Checklistan är skrivskyddad för dig. Den ska fyllas i tillsammans med din handledare, som kan bocka av punkterna åt dig från sin vy.</p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((item, index) => {
          const relevantDocId = docMap?.[index];
          return (
            <div key={index} className="flex items-center gap-2">
              <label
                htmlFor={`check-${index}`}
                className={`group flex-1 flex items-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-md border border-slate-200 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-500 transition-colors duration-200 btn-press ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} has-[:checked]:bg-red-50 dark:has-[:checked]:bg-red-900/20 has-[:checked]:border-red-400 dark:has-[:checked]:border-red-600`}
              >
                <input
                  type="checkbox"
                  id={`check-${index}`}
                  className="custom-checkbox-input"
                  onChange={(e) => handleToggleWrapper(index, e.target.checked)}
                  checked={!!progress[index]}
                  disabled={isReadOnly}
                />
                <div className="w-7 h-7 rounded-md border-2 border-slate-400 dark:border-slate-500 flex items-center justify-center flex-shrink-0 custom-checkbox-container">
                    <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 8L6 12L14 4" className="custom-checkbox-svg" />
                    </svg>
                </div>

                <span className={`ml-4 flex-1 text-slate-700 dark:text-slate-200 group-has-[:checked]:text-slate-500 dark:group-has-[:checked]:text-slate-400 group-has-[:checked]:line-through transition-colors`}>{item}</span>
              </label>
              {relevantDocId && onNavigateToDoc && (
                <button 
                  onClick={() => onNavigateToDoc(relevantDocId)}
                  className="p-3 h-full rounded-md bg-blue-50 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-300 transition-colors duration-200 btn-press border border-slate-200 dark:border-slate-700"
                  title="Visa relevant rutin"
                >
                  {ICONS.link}
                </button>
              )}
              {isReadOnly && onAskAI && (
                <button 
                  onClick={() => onAskAI(`Förklara mer om introduktionspunkten: "${item}"`)}
                  className="p-3 h-full rounded-md bg-red-50 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-slate-700 text-red-700 dark:text-red-300 transition-colors duration-200 btn-press border border-slate-200 dark:border-slate-700"
                  title={`Fråga AI om: "${item}"`}
                >
                  {ICONS.ai}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default Checklist;
