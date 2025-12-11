
import React, { useState, useMemo, memo } from 'react';
import { UserData, ScheduleEntry } from '../types';
import { InfoTooltip } from './UI';
import { ICONS } from '../constants';

interface AttendanceProps {
  userData: UserData;
  supervisorSchedule?: ScheduleEntry[];
}

const SHIFT_COLORS: Record<string, { bg: string, text: string, dot: string, label: string, border: string }> = {
    'Dag': { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-800 dark:text-yellow-200', dot: 'bg-yellow-500', label: 'Dagpass', border: 'border-yellow-200 dark:border-yellow-800' },
    'Kväll': { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-800 dark:text-blue-200', dot: 'bg-blue-500', label: 'Kvällspass', border: 'border-blue-200 dark:border-blue-800' },
    'Natt': { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-800 dark:text-purple-200', dot: 'bg-purple-500', label: 'Nattpass', border: 'border-purple-200 dark:border-purple-800' },
    'Helg': { bg: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-800 dark:text-pink-200', dot: 'bg-pink-500', label: 'Helgpass', border: 'border-pink-200 dark:border-pink-800' },
    'Egen tid': { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-800 dark:text-emerald-200', dot: 'bg-emerald-500', label: 'Egen tid', border: 'border-emerald-200 dark:border-emerald-800' },
    'default': { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400', label: 'Ospecificerat', border: 'border-slate-200 dark:border-slate-700' }
};

const Attendance: React.FC<AttendanceProps> = memo(({ userData, supervisorSchedule }) => {
  const { aplTotalDays = 0, attendanceRecords = [] } = userData;
  
  // State for Calendar
  const [currentDate, setCurrentDate] = useState(new Date());
  // Default to today's date string
  const [selectedDateStr, setSelectedDateStr] = useState(new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' }));

  const daysPresent = attendanceRecords.filter(r => r.status === 'present').length;
  const percentage = aplTotalDays > 0 ? Math.round((daysPresent / aplTotalDays) * 100) : 0;

  // 1. Process Data: Merge schedule and attendance records into a single map
  const combinedView = useMemo(() => {
      const map: Record<string, { schedule?: ScheduleEntry, status?: string, notes?: string }> = {};
      const activeSchedule = supervisorSchedule || userData.schedule || [];

      activeSchedule.forEach(s => {
          if (!map[s.date]) map[s.date] = {};
          map[s.date].schedule = s;
      });
      
      attendanceRecords.forEach(r => {
          if (!map[r.date]) map[r.date] = {};
          map[r.date].status = r.status;
          map[r.date].notes = r.notes;
      });
      return map;
  }, [supervisorSchedule, userData.schedule, attendanceRecords]);

  // 2. Calendar Logic
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0 = Sun
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // 0 = Mon

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  
  const currentMonthName = currentDate.toLocaleString('sv-SE', { month: 'long', year: 'numeric' });
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // 3. Render Detail Card Data
  const selectedDetails = combinedView[selectedDateStr];
  const selectedDateObj = new Date(selectedDateStr);
  const isToday = selectedDateStr === new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  
  const getShiftStyle = (type?: string) => SHIFT_COLORS[type || ''] || SHIFT_COLORS['default'];

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header & Stats */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {ICONS.calendar} Min Kalender
                <InfoTooltip text="Här ser du dina inbokade pass (färgade prickar) och din registrerade närvaro (ikoner). Klicka på ett datum för detaljer." />
            </h3>
            <div className="text-right">
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{daysPresent}/{aplTotalDays}</span>
                <p className="text-xs text-slate-500">Dagar klara</p>
            </div>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2 overflow-hidden">
            <div className="bg-indigo-500 h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <button onClick={prevMonth} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300">&lt;</button>
              <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 capitalize">{currentMonthName}</h4>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300">&gt;</button>
          </div>

          <div className="p-4">
              <div className="grid grid-cols-7 mb-2 text-center">
                  {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map(d => (
                      <div key={d} className="text-xs font-bold text-slate-400 py-1">{d}</div>
                  ))}
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {Array.from({ length: adjustedFirstDay }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square"></div>
                  ))}
                  
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const year = currentDate.getFullYear();
                      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
                      const dayStr = day.toString().padStart(2, '0');
                      const dateStr = `${year}-${month}-${dayStr}`;
                      
                      const entry = combinedView[dateStr];
                      const isSelected = dateStr === selectedDateStr;
                      const isTodayCell = dateStr === new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' });
                      const shiftStyle = entry?.schedule ? getShiftStyle(entry.schedule.shiftType) : null;

                      return (
                          <button
                              key={day}
                              onClick={() => setSelectedDateStr(dateStr)}
                              className={`
                                aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all border-2
                                ${isSelected 
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 z-10 scale-105 shadow-md' 
                                    : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'}
                                ${isTodayCell && !isSelected ? 'bg-slate-100 dark:bg-slate-700 ring-1 ring-slate-300 dark:ring-slate-600' : ''}
                              `}
                          >
                              <span className={`text-sm font-medium ${isTodayCell ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {day}
                              </span>
                              
                              <div className="h-4 flex items-center justify-center gap-0.5 mt-0.5 w-full">
                                  {/* Prioritize Status Icon if past, otherwise Shift Dot */}
                                  {entry?.status ? (
                                      <span className="text-xs leading-none">
                                          {entry.status === 'present' ? '✅' : entry.status === 'sick' ? '🤒' : '❌'}
                                      </span>
                                  ) : shiftStyle ? (
                                      <div className={`w-2 h-2 rounded-full ${shiftStyle.dot}`}></div>
                                  ) : null}
                              </div>
                          </button>
                      );
                  })}
              </div>
          </div>
          
          <div className="flex flex-wrap gap-4 px-4 pb-4 justify-center border-t dark:border-slate-700 pt-3 bg-slate-50 dark:bg-slate-800/50">
                {Object.entries(SHIFT_COLORS).filter(([key]) => key !== 'default').map(([key, style]) => (
                    <div key={key} className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${style.dot}`}></div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{key}</span>
                    </div>
                ))}
          </div>
      </div>

      {/* Selected Day Detail Card */}
      <div className={`rounded-lg shadow-lg border overflow-hidden animate-fade-in transition-colors ${selectedDetails?.schedule ? getShiftStyle(selectedDetails.schedule.shiftType).border : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-800`}>
            <div className={`p-4 ${selectedDetails?.schedule ? getShiftStyle(selectedDetails.schedule.shiftType).bg : 'bg-slate-100 dark:bg-slate-700'}`}>
                <div className="flex justify-between items-center">
                    <h3 className={`text-lg font-bold ${selectedDetails?.schedule ? getShiftStyle(selectedDetails.schedule.shiftType).text : 'text-slate-800 dark:text-slate-100'}`}>
                        {selectedDateObj.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }).split(' ').map(capitalize).join(' ')}
                    </h3>
                    {isToday && <span className="px-2 py-0.5 bg-white/50 rounded text-xs font-bold uppercase tracking-wide">Idag</span>}
                </div>
            </div>
            
            <div className="p-6">
                {selectedDetails?.schedule ? (
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1 text-slate-500">Inbokat Pass</p>
                                <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{selectedDetails.schedule.shiftType}</h4>
                            </div>
                            <div className="text-right">
                                <p className="text-xl font-mono font-bold text-slate-700 dark:text-slate-200">{selectedDetails.schedule.startTime} - {selectedDetails.schedule.endTime}</p>
                                <p className="text-xs opacity-70 text-slate-500">Planerat av handledare</p>
                            </div>
                        </div>
                        
                        {selectedDetails.status && (
                            <div className="mt-4 pt-4 border-t dark:border-slate-700">
                                <p className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2 text-slate-500">Utfall & Närvaro</p>
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">
                                        {selectedDetails.status === 'present' ? '✅' : selectedDetails.status === 'sick' ? '🤒' : '❌'}
                                    </span>
                                    <div>
                                        <span className={`text-sm font-bold uppercase ${
                                            selectedDetails.status === 'present' ? 'text-green-600' : 
                                            selectedDetails.status === 'sick' ? 'text-yellow-600' : 'text-red-600'
                                        }`}>
                                            {selectedDetails.status === 'present' ? 'Närvarande' : selectedDetails.status === 'sick' ? 'Sjukanmäld' : 'Frånvarande'}
                                        </span>
                                        {selectedDetails.notes && <p className="text-xs text-slate-500 mt-0.5">"{selectedDetails.notes}"</p>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-6 text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="text-lg font-medium">Ledig dag</p>
                        <p className="text-xs">Inget pass inbokat.</p>
                    </div>
                )}
            </div>
      </div>
    </div>
  );
});

export default Attendance;
