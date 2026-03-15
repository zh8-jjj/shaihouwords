import { useState, useEffect, useRef } from 'react';
import { db, auth, googleProvider } from './firebase';
import { signInWithPopup, signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, Timestamp, getDocFromServer } from 'firebase/firestore';
import { Button } from './components/ui/button';
import { AddWords } from './components/AddWords';
import { ReviewSession } from './components/ReviewSession';
import { WordList } from './components/WordList';
import { MiniActivityGraph } from './components/MiniActivityGraph';
import { ActivityGraph } from './components/ActivityGraph';
import { StandaloneJarScene } from './components/StandaloneJarScene';
import { recordActivity } from './lib/activity';
import { startOfDay } from 'date-fns';
import { LogOut, Plus, Play, BookOpen, List, UserCircle2, Settings } from 'lucide-react';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<'dashboard' | 'add' | 'review' | 'list' | 'activity'>('dashboard');
  const [showJarSettings, setShowJarSettings] = useState(false);
  const [isReviewingMap, setIsReviewingMap] = useState(false);
  const [reviewSessionList, setReviewSessionList] = useState<any[]>([]);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const jarRef = useRef<any>(null);
  const [wordsToReview, setWordsToReview] = useState<any[]>([]);
  const [allWordsList, setAllWordsList] = useState<any[]>([]);
  const [totalWords, setTotalWords] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Test connection and ensure user document exists
        try {
          const path = `users/${currentUser.uid}`;
          // Connection test as per guidelines
          await getDocFromServer(doc(db, path));
          
          await setDoc(doc(db, path), {
            email: currentUser.email || 'guest',
            createdAt: serverTimestamp()
          }, { merge: true });
          
          // Record activity for today
          await recordActivity();
        } catch (e) {
          if (e instanceof Error && e.message.includes('the client is offline')) {
            alert("检测到离线状态。请检查您的网络连接，以确保数据能够同步到云端。");
          } else {
            handleFirestoreError(e, OperationType.WRITE, `users/${currentUser.uid}`);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAuthReady) return;

    const today = startOfDay(new Date());
    const todayTimestamp = Timestamp.fromDate(today);

    // Listen to all words for the user
    const q = query(
      collection(db, `users/${user.uid}/words`),
      where('status', '==', 'learning')
    );

    const unsubscribeReview = onSnapshot(
      q,
      (snapshot) => {
        const allLearningWords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const now = Date.now();
        // Client-side filter for strict timing: nextReviewDate <= now
        const toReview = allLearningWords.filter((word: any) => {
          if (!word.nextReviewDate) return false;
          return word.nextReviewDate.toMillis() <= now;
        });
        
        setWordsToReview(toReview);
        setAllWordsList(allLearningWords);
        setTotalWords(allLearningWords.length); // Update total learning words
      },
      (error) => console.error("Error fetching words:", error)
    );

    return () => {
      unsubscribeReview();
    };
  }, [user, isAuthReady]);

  const handleWordClick = (word: any) => {
    // Find the index of the clicked word in the current wordsToReview list
    const index = wordsToReview.findIndex(w => w.id === word.id);
    if (index !== -1) {
      // Reorder the list to start from the clicked word
      const reordered = [
        ...wordsToReview.slice(index),
        ...wordsToReview.slice(0, index)
      ];
      setReviewSessionList(reordered);
      setSelectedWordIndex(0);
    }
  };

  const handleReviewComplete = () => {
    setReviewSessionList([]);
    setSelectedWordIndex(null);
  };

  const handleLogin = async () => {
    try {
      console.log("Attempting Google login...");
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      alert(`登录失败: ${error.message}\n请检查是否在 Firebase 控制台将您的域名添加到了“授权网域”中。`);
    }
  };

  const handleGuestLogin = async () => {
    try {
      console.log("Attempting guest login...");
      await signInAnonymously(auth);
    } catch (error: any) {
      console.error("Guest login failed", error);
      alert(`游客登录失败: ${error.message}`);
    }
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse flex items-center gap-2"><BookOpen className="w-5 h-5 text-stone-400" strokeWidth={1.5} /> <span className="text-stone-500 font-serif italic">Loading...</span></div></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-stone-200 p-10 text-center space-y-8">
          <div className="mx-auto w-16 h-16 border border-stone-200 rounded-full flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-stone-800" strokeWidth={1.5} />
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-serif tracking-tight text-stone-900">晒后单词</h1>
            <p className="text-stone-500 text-sm tracking-widest uppercase">Master vocabulary with spaced repetition</p>
          </div>
          <div className="space-y-4 pt-4">
            <Button size="lg" className="w-full h-12 text-sm font-medium rounded-xl bg-stone-900 hover:bg-stone-800 text-white transition-colors" onClick={handleLogin}>
              Sign in with Google
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest">
                <span className="bg-white px-4 text-stone-400">Or</span>
              </div>
            </div>

            <Button variant="outline" size="lg" className="w-full h-12 text-sm font-medium rounded-xl border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors" onClick={handleGuestLogin}>
              <UserCircle2 className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Continue as Guest
            </Button>
            
            <p className="text-xs text-stone-400 mt-6 leading-relaxed">
              Guest accounts are tied to this browser.<br/>Clear your cache and your data is gone.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-800 font-sans selection:bg-stone-200">
      {/* Top Navigation - Persistent across views */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 bg-[#faf8f5]/80 backdrop-blur-md border-b border-stone-200/50">
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Logo / Home */}
          <button 
            onClick={() => setView('dashboard')}
            className="flex items-center space-x-2 mr-2 sm:mr-4 group"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-white group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4" strokeWidth={2} />
            </div>
            <span className="hidden sm:block font-serif italic text-lg tracking-tight">晒后单词</span>
          </button>

          {/* 调整瓶子外观 - Only relevant for dashboard */}
          <button 
            onClick={() => {
              setView('dashboard');
              setShowJarSettings(!showJarSettings);
            }}
            className={`p-2 sm:p-2.5 rounded-full transition-all duration-300 ${showJarSettings && view === 'dashboard' ? 'bg-stone-800 text-white' : 'bg-white/50 hover:bg-white text-stone-600 border border-stone-200 shadow-sm'}`}
            title="调整瓶子外观"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
          </button>
          {/* 预览单词列表 */}
          <button 
            onClick={() => setView('list')}
            className={`p-2 sm:p-2.5 rounded-full transition-all duration-300 ${view === 'list' ? 'bg-stone-800 text-white' : 'bg-white/50 hover:bg-white text-stone-600 border border-stone-200 shadow-sm'}`}
            title="预览单词列表"
          >
            <List className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* 添加单词 */}
          <button 
            onClick={() => setView('add')}
            className={`p-2 sm:p-2.5 rounded-full transition-all duration-300 ${view === 'add' ? 'bg-stone-800 text-white' : 'bg-white/50 hover:bg-white text-stone-600 border border-stone-200 shadow-sm'}`}
            title="添加单词"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
          </button>

          {/* 图谱轨迹 */}
          <div className="bg-white/50 backdrop-blur-sm px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border border-stone-200 shadow-sm">
            <MiniActivityGraph onClick={() => setView('activity')} />
          </div>
          
          <Button variant="ghost" size="icon" onClick={() => signOut(auth)} title="Sign out" className="text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-full w-8 h-8 sm:w-9 sm:h-9">
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
          </Button>
        </div>
      </header>

      {/* 3D Jar Scene - Full Screen Background for Dashboard */}
      {view === 'dashboard' && (
        <div className="fixed inset-0 z-10">
          <StandaloneJarScene 
            ref={jarRef}
            words={allWordsList.filter(w => {
              const now = Date.now();
              const isDue = w.nextReviewDate && w.nextReviewDate.toMillis() <= now;
              const today = startOfDay(new Date()).getTime();
              const isReviewedToday = w.lastReviewedAt && w.lastReviewedAt.toMillis() >= today;
              return isDue || isReviewedToday;
            }).map(w => w.word)}
            reviewWords={allWordsList.filter(w => {
              // Show words that are due OR were reviewed today
              const now = Date.now();
              const isDue = w.nextReviewDate && w.nextReviewDate.toMillis() <= now;
              const today = startOfDay(new Date()).getTime();
              const isReviewedToday = w.lastReviewedAt && w.lastReviewedAt.toMillis() >= today;
              return isDue || isReviewedToday;
            }).map(w => {
              const today = startOfDay(new Date()).getTime();
              const isReviewedToday = w.lastReviewedAt && w.lastReviewedAt.toMillis() >= today;
              return { ...w, isReviewed: isReviewedToday };
            })}
            showControls={showJarSettings}
            onAnimationComplete={() => setIsReviewingMap(true)}
            onWordClick={handleWordClick}
            onExitReview={() => setIsReviewingMap(false)}
          />
        </div>
      )}

      {/* Review Modal for Dashboard Map View */}
      {view === 'dashboard' && reviewSessionList.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg px-4">
            <ReviewSession 
              words={reviewSessionList} 
              onComplete={handleReviewComplete} 
            />
          </div>
        </div>
      )}

      <main className={`relative pt-20 ${view === 'dashboard' ? 'z-0 pointer-events-none' : 'z-20 max-w-5xl mx-auto px-4 py-4 sm:px-6 sm:py-8 md:py-12'}`}>
        {view === 'dashboard' && (
          <div className="w-full h-[calc(100vh-80px)] flex flex-col items-center justify-center pointer-events-none">
            {/* No cards here, jar UI is handled internally or via header */}
          </div>
        )}

        {view === 'add' && <AddWords onBack={() => setView('dashboard')} />}
        
        {view === 'list' && <WordList onBack={() => setView('dashboard')} />}
        
        {view === 'activity' && <ActivityGraph onBack={() => setView('dashboard')} />}
        
        {view === 'review' && (
          <ReviewSession 
            words={wordsToReview} 
            onComplete={() => setView('dashboard')} 
          />
        )}
      </main>
    </div>
  );
}
