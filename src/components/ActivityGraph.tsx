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
    if (count === 0) return 'bg-slate-100';
    if (count < 5) return 'bg-emerald-200';
    if (count < 15) return 'bg-emerald-400';
    if (count < 30) return 'bg-emerald-500';
    return 'bg-emerald-600';
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

    return (
      <div className="min-w-[800px]">
        <div className="flex gap-3">
          <div className="flex flex-col text-xs text-stone-400 pr-2 font-medium" style={{ gap: '4px' }}>
            <div className="h-3" />
            <div className="h-3 leading-3">Mon</div>
            <div className="h-3" />
            <div className="h-3 leading-3">Wed</div>
            <div className="h-3" />
            <div className="h-3 leading-3">Fri</div>
            <div className="h-3" />
          </div>
          
          <div className="flex-1">
            <div className="grid grid-rows-7 grid-flow-col gap-1">
              {days.map((day, i) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const count = activeDays.get(dateStr) || 0;
                
                if (getYear(day) !== selectedYear) {
                  return <div key={i} className="w-3 h-3 opacity-0" />;
                }
                if (isAfter(day, today)) {
                  return <div key={i} className="w-3 h-3 bg-stone-50 rounded-sm" />;
                }
                
                return (
                  <div 
                    key={dateStr}
                    className={`w-3 h-3 rounded-sm ${getIntensityClass(count)} transition-colors hover:ring-1 hover:ring-stone-400`}
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
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-stone-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-stone-600" strokeWidth={1.5} />
        </Button>
        <h2 className="text-3xl font-serif tracking-tight text-stone-900">Learning Trajectory</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      <div className="bg-white p-10 rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-2 bg-stone-50 p-1 rounded-xl border border-stone-200 w-fit">
            <button 
              onClick={() => setViewMode('year')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'year' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Yearly
            </button>
            <button 
              onClick={() => setViewMode('month')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'month' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Monthly
            </button>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={handlePrev} className="rounded-full border-stone-200 text-stone-600 hover:bg-stone-50">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="w-40 text-center">
              <span className="text-xl font-serif text-stone-900">
                {viewMode === 'year' ? selectedYear : `${monthNames[selectedMonth]} ${selectedYear}`}
              </span>
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleNext} 
              disabled={viewMode === 'year' ? selectedYear >= currentYear : (selectedYear === currentYear && selectedMonth === currentMonth)}
              className="rounded-full border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {loading ? (
          <div className="h-64 flex items-center justify-center text-stone-400 font-serif italic">Loading trajectory...</div>
        ) : (
          <div className="overflow-x-auto pb-4">
            {viewMode === 'year' ? renderYearView() : renderMonthView()}
            
            <div className="flex items-center justify-end gap-3 mt-10 text-xs text-stone-400 font-medium uppercase tracking-widest">
              <span>Less</span>
              <div className="flex gap-1.5">
                <div className="w-4 h-4 rounded-sm bg-slate-100" />
                <div className="w-4 h-4 rounded-sm bg-emerald-200" />
                <div className="w-4 h-4 rounded-sm bg-emerald-400" />
                <div className="w-4 h-4 rounded-sm bg-emerald-500" />
                <div className="w-4 h-4 rounded-sm bg-emerald-600" />
              </div>
              <span>More</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

