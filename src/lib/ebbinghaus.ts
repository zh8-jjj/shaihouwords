import { addDays, startOfDay } from 'date-fns';

// Ebbinghaus intervals in days
// 1st review: 1 day later
// 2nd review: 2 days later
// 3rd review: 4 days later
// 4th review: 7 days later
// 5th review: 15 days later
// 6th review: 30 days later
export const EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30];

export function getNextReviewDate(reviewCount: number, fromDate: Date = new Date()): Date {
  // If reviewCount exceeds our defined intervals, we consider it graduated or keep adding 30 days
  const interval = reviewCount < EBBINGHAUS_INTERVALS.length 
    ? EBBINGHAUS_INTERVALS[reviewCount] 
    : 30;
    
  // Strict timing: exactly N days (24 hours * N) from the provided date
  return new Date(fromDate.getTime() + interval * 24 * 60 * 60 * 1000);
}
