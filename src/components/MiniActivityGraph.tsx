import { useEffect, useState } from 'react';
import { dataService } from '../services/data';
import { format, subDays } from 'date-fns';

export function MiniActivityGraph({ onClick }: { onClick: () => void }) {
  const [activeDays, setActiveDays] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    async function fetchActivity() {
      try {
        const activityData = await dataService.getActivity();
        const active = new Map<string, number>();
        activityData.forEach((data: any) => {
          active.set(data.id, data.count || 1);
        });
        setActiveDays(active);
      } catch (error) {
        console.error("Error fetching mini activity graph:", error);
      }
    }
    
    fetchActivity();
  }, []);

  // Generate last 7 days
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    return format(d, 'yyyy-MM-dd');
  });

  const getIntensityClass = (count: number) => {
    if (count === 0) return 'bg-slate-200';
    if (count < 5) return 'bg-emerald-300';
    if (count < 15) return 'bg-emerald-400';
    if (count < 30) return 'bg-emerald-500';
    return 'bg-emerald-600';
  };

  return (
    <div 
      className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity p-1.5 rounded-lg hover:bg-stone-50 border border-transparent hover:border-stone-200"
      onClick={onClick}
      title="View Activity Graph"
    >
      {days.map(day => {
        const count = activeDays.get(day) || 0;
        return (
          <div 
            key={day}
            className={`w-3 h-3 rounded-sm ${getIntensityClass(count)}`}
            title={`${day}: ${count} actions`}
          />
        );
      })}
    </div>
  );
}
