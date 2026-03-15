import { db, auth } from '../firebase';
import { doc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { format } from 'date-fns';

export async function recordActivity() {
  if (!auth.currentUser) return;
  
  const today = new Date();
  const dateId = format(today, 'yyyy-MM-dd');
  
  try {
    const activityRef = doc(db, `users/${auth.currentUser.uid}/activity/${dateId}`);
    await setDoc(activityRef, {
      count: increment(1),
      lastActive: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Failed to record activity:", error);
  }
}
