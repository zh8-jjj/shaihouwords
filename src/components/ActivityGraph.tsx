import { useEffect, useState } from 'react';
import { dataService } from '../services/data';
import { format, subDays, startOfWeek, addDays, isAfter, isBefore, startOfDay, getYear, getMonth, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ArrowLeft, Flame, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';

type ViewMode = 'year' | 'month';

export function ActivityGraph({ onBack }: { onBack: () => void }) {
  const [activeDays, setActiveDays] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [totalActive, setTotalActive] = useState(0);
  
  const today = startOfDay(new Date());
  const currentYear = getYear(today);
  const currentMonth = getMonth(today);

  const [viewMode, setViewMode] = useState<ViewMode>('year');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  useEffect(() => {
    async function fetchAllActivity() {
      try {
        const activityData = await dataService.getActivity();
        const active = new Map<string, number>();
        let currentStreak = 0;
        
        activityData.forEach((data: any) => {
          active.set(data.id, data.count || 1);
        });
        
        // Calculate current streak
        let checkDate = new Date();
        let checkDateStr = format(checkDate, 'yyyy-MM-dd');
        
        // If not active today, check if active yesterday to keep streak alive
        if (!active.has(checkDateStr)) {
          checkDate = subDays(checkDate, 1);
          checkDateStr = format(checkDate, 'yyyy-MM-dd');
        }
        
        while (active.has(checkDateStr)) {
          currentStreak++;
          checkDate = subDays(checkDate, 1);
          checkDateStr = format(checkDate, 'yyyy-MM-dd');
        }

        setActiveDays(active);
        setTotalActive(active.size);
        setStreak(currentStreak);
      } catch (error) {
        console.error("Error fetching full activity graph:", error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchAllActivity();
  }, []);

  const getIntensityClass = (count: number) => {
    if (count === 0) return 'bg-[#f3f3f3]';
    if (count < 5) return 'bg-[#a1d99b]';
    if (count < 15) return 'bg-[#74c476]';
    if (count < 30) return 'bg-[#41ab5d]';
    return 'bg-[#238b45]';
  };

  // Generate Year View Data
  const renderYearView = () => {
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31);
    const startDate = startOfWeek(yearStart);
    
    const days = [];
    let currentDate = startDate;
    
    while (isBefore(currentDate, yearEnd) || currentDate.getTime() === yearEnd.getTime()) {
      days.push(currentDate);
      currentDate = addDays(currentDate, 1);
    }

    const monthLabels = [
      { name: 'Jan', weekIndex: 0 },
      { name: 'Feb', weekIndex: 5 },
      { name: 'Mar', weekIndex: 9 },
      { name: 'Apr', weekIndex: 13 },
      { name: 'May', weekIndex: 18 },
      { name: 'Jun', weekIndex: 22 },
      { name: 'Jul', weekIndex: 26 },
      { name: 'Aug', weekIndex: 31 },
      { name: 'Sep', weekIndex: 35 },
      { name: 'Oct', weekIndex: 39 },
      { name: 'Nov', weekIndex: 44 },
      { name: 'Dec', weekIndex: 48 },
    ];

    const totalActionsInYear = Array.from(activeDays.entries())
      .filter(([date]) => date.startsWith(selectedYear.toString()))
      .reduce((sum, [, count]) => sum + count, 0);

    return (
      <div className="min-w-[800px] py-4">
        <div className="mb-4">
          <p className="text-sm text-stone-500 font-medium tracking-wide uppercase">{selectedYear}: {totalActionsInYear} actions</p>
        </div>

        <div className="relative">
          {/* Month Labels */}
          <div className="flex mb-2 text-[10px] text-stone-400 font-medium">
            {monthLabels.map((month, i) => (
              <div 
                key={i} 
                className="absolute" 
                style={{ left: `${month.weekIndex * 14 + 4}px` }}
              >
                {month.name}
              </div>
            ))}
          </div>
          
          <div className="pt-4">
            <div className="grid grid-rows-7 grid-flow-col gap-[2px]">
              {days.map((day, i) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const count = activeDays.get(dateStr) || 0;
                
                const isCurrentYear = getYear(day) === selectedYear;
                const isFuture = isAfter(day, today);
                
                return (
                  <div 
                    key={i}
                    className={`w-[12px] h-[12px] rounded-[3px] transition-colors hover:ring-1 hover:ring-stone-300
                      ${!isCurrentYear ? 'opacity-0' : ''}
                      ${isFuture ? 'bg-[#f3f3f3]' : getIntensityClass(count)}
                    `}
                    title={`${dateStr}: ${count} actions`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Generate Month View Data
  const renderMonthView = () => {
    const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
    const monthEnd = endOfMonth(monthStart);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    const startDayOfWeek = getDay(monthStart); // 0 = Sunday, 1 = Monday, etc.
    const paddingDays = Array.from({ length: startDayOfWeek }).map((_, i) => i);

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs font-medium text-stone-400 uppercase tracking-widest py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {paddingDays.map(i => (
            <div key={`pad-${i}`} className="aspect-square rounded-xl bg-transparent" />
          ))}
          {daysInMonth.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const count = activeDays.get(dateStr) || 0;
            const isFuture = isAfter(day, today);
            
            return (
              <div 
                key={dateStr}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all
                  ${isFuture ? 'bg-stone-50/50 text-stone-300' : getIntensityClass(count)}
                  ${count > 0 ? 'text-white shadow-sm' : 'text-stone-500'}
                  ${!isFuture && count === 0 ? 'border border-stone-100' : ''}
                  hover:scale-105 hover:shadow-md cursor-default
                `}
                title={`${dateStr}: ${count} actions`}
              >
                <span className="font-serif text-lg">{format(day, 'd')}</span>
                {count > 0 && (
                  <span className="text-[10px] opacity-80 mt-0.5 font-sans">{count}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handlePrev = () => {
    if (viewMode === 'year') {
      setSelectedYear(y => y - 1);
    } else {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(y => y - 1);
      } else {
        setSelectedMonth(m => m - 1);
      }
    }
  };

  const handleNext = () => {
    if (viewMode === 'year') {
      if (selectedYear < currentYear) setSelectedYear(y => y + 1);
    } else {
      if (selectedYear === currentYear && selectedMonth === currentMonth) return;
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(y => y + 1);
      } else {
        setSelectedMonth(m => m + 1);
      }
    }
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="space-y-8 max-w-5xl mx-auto pt-20 sm:pt-24 pb-20 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-stone-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-stone-600" strokeWidth={1.5} />
          </Button>
          <h2 className="text-3xl font-serif tracking-tight text-stone-900">Learning Trajectory</h2>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end sm:justify-start">
          <div className="flex items-center gap-2 bg-white/50 p-1 rounded-full border border-stone-200 shadow-sm">
            <Button variant="ghost" size="icon" onClick={handlePrev} className="w-7 h-7 rounded-full text-stone-600 hover:bg-stone-50">
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <div className="px-1 text-center min-w-[100px]">
              <span className="text-sm font-serif text-stone-900 whitespace-nowrap">
                {viewMode === 'year' ? selectedYear : `${monthNames[selectedMonth]} ${selectedYear}`}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleNext} 
              disabled={viewMode === 'year' ? selectedYear === currentYear : (selectedYear === currentYear && selectedMonth === currentMonth)}
              className="w-7 h-7 rounded-full text-stone-600 hover:bg-stone-50 disabled:opacity-30"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg border border-stone-200">
            <button 
              onClick={() => setViewMode('year')}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'year' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Yearly
            </button>
            <button 
              onClick={() => setViewMode('month')}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'month' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Monthly
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-stone-400 font-serif italic">Loading trajectory...</div>
        ) : (
          <div className="overflow-x-auto no-scrollbar pb-4">
            {viewMode === 'year' ? renderYearView() : renderMonthView()}
            
            {viewMode === 'month' && (
              <div className="flex items-center justify-end gap-3 mt-6 text-[10px] text-stone-400 font-medium uppercase tracking-widest">
                <span>Less</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-sm bg-slate-100" />
                  <div className="w-3 h-3 rounded-sm bg-emerald-200" />
                  <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                  <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                  <div className="w-3 h-3 rounded-sm bg-emerald-600" />
                </div>
                <span>More</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-stone-50 rounded-bl-full -z-10" />
          <div className="w-12 h-12 border border-stone-200 text-stone-800 rounded-full flex items-center justify-center bg-white">
            <Flame className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-1">Current Streak</p>
            <p className="text-3xl font-serif text-stone-900">{streak} <span className="text-lg font-sans text-stone-500">Days</span></p>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-stone-50 rounded-bl-full -z-10" />
          <div className="w-12 h-12 border border-stone-200 text-stone-800 rounded-full flex items-center justify-center bg-white">
            <CalendarIcon className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-1">Total Active</p>
            <p className="text-3xl font-serif text-stone-900">{totalActive} <span className="text-lg font-sans text-stone-500">Days</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

