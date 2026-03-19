import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { dataService } from '../services/data';
import { getNextReviewDate } from '../lib/ebbinghaus';
import { X, Check, RefreshCw, ChevronLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { generateAIContent } from '../services/ai';

export function ReviewSession({ words, onComplete }: { words: any[], onComplete: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [currentDetails, setCurrentDetails] = useState<{example?: string, mnemonic?: string}>({});
  const [direction, setDirection] = useState(0);
  
  const currentWord = words[currentIndex];
  const nextWord = currentIndex + 1 < words.length ? words[currentIndex + 1] : null;

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  useEffect(() => {
    if (currentWord) {
      setCurrentDetails({
        example: currentWord.example,
        mnemonic: currentWord.mnemonic
      });
      x.set(0);
    }
  }, [currentWord, x]);

  const fetchAiDetails = async () => {
    if (!currentWord || aiLoading) return;
    setAiLoading(true);
    try {
      const response = await generateAIContent({
        prompt: `Provide a simple example sentence (with Chinese translation) and a brief root/affix analysis or mnemonic for the English word: "${currentWord.word}". 
        Return a JSON object with 'example' and 'mnemonic' properties.
        Example sentence format: 'The apple is red. (这个苹果是红色的。)'.
        Mnemonic format: '词根: apple (苹果); 记忆: 想象一个红苹果'.`,
        jsonMode: true
      });

      if (response.text) {
        let jsonText = response.text;
        if (jsonText.includes("```")) {
          const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match) {
            jsonText = match[1];
          }
        }
        const details = JSON.parse(jsonText);
        setCurrentDetails(details);
        // Save to Firestore for future
        await dataService.updateWord(currentWord.id, {
          example: details.example,
          mnemonic: details.mnemonic
        });
      }
    } catch (e) {
      console.error("Error fetching AI details:", e);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (showMeaning && (!currentDetails.example || !currentDetails.mnemonic)) {
      fetchAiDetails();
    }
  }, [showMeaning]);

  const handleReview = (remembered: boolean) => {
    if (!currentWord || loading) return;
    
    setLoading(true);
    setDirection(remembered ? 1 : -1);
    
    // Calculate new review count and next review date
    const newReviewCount = remembered ? currentWord.reviewCount + 1 : 0;
    const nextDate = getNextReviewDate(newReviewCount);
    
    const updateData: any = {
      reviewCount: newReviewCount,
      nextReviewDate: nextDate.toISOString(),
      lastReviewedAt: "serverTimestamp",
      status: newReviewCount >= 6 ? 'graduated' : 'learning'
    };

    if (!remembered) {
      const currentFailures = currentWord.failures || [];
      if (!currentFailures.includes(currentWord.reviewCount)) {
        updateData.failures = [...currentFailures, currentWord.reviewCount];
      }
    }
    
    // Fire and forget DB updates
    dataService.updateWord(currentWord.id, updateData).catch(e => console.error(e));
    dataService.recordActivity().catch(e => console.error(e));

    // Move to next word after a short delay for animation
    setTimeout(() => {
      if (currentIndex + 1 < words.length) {
        setCurrentIndex(currentIndex + 1);
        setShowMeaning(false);
        setCurrentDetails({});
        setLoading(false);
        setDirection(0);
      } else {
        onComplete();
      }
    }, 200);
  };

  const handleDragEnd = (event: any, info: any) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      handleReview(true);
    } else if (info.offset.x < -threshold) {
      handleReview(false);
    }
  };

  const variants = {
    enter: {
      scale: 0.95,
      y: 10,
      opacity: 0,
    },
    center: {
      scale: 1,
      y: 0,
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    },
    exit: (direction: number) => ({
      x: direction * 500,
      opacity: 0,
      scale: 0.9,
      transition: {
        duration: 0.3,
        ease: "easeIn"
      }
    })
  };

  if (!currentWord) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
        <div className="w-16 h-16 border border-stone-200 rounded-full flex items-center justify-center bg-white shadow-sm">
          <Check className="w-6 h-6 text-stone-800" strokeWidth={1.5} />
        </div>
        <h2 className="text-3xl font-serif text-stone-900 tracking-tight">All done for today</h2>
        <p className="text-stone-500 text-sm uppercase tracking-widest">You've completed all your reviews</p>
        <Button onClick={onComplete} className="mt-8 h-12 px-8 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium">Back to Map</Button>
      </div>
    );
  }

  const progressPercentage = (currentIndex / words.length) * 100;

  return (
    <div className="flex flex-col w-full h-[75vh] min-h-[500px] max-h-[800px] max-w-[340px] mx-auto relative pt-12">
      <div className="absolute top-0 left-0 z-50">
        <Button variant="ghost" size="icon" onClick={onComplete} className="hover:bg-stone-100 rounded-full">
          <ChevronLeft className="w-5 h-5 text-stone-600" strokeWidth={1.5} />
        </Button>
      </div>
      
      {/* Progress Bar */}
      <div className="w-32 mx-auto mb-6">
        <div className="flex justify-between items-center text-[10px] font-medium text-stone-400 uppercase tracking-widest mb-2">
          <span>Progress</span>
          <span>{currentIndex} / {words.length}</span>
        </div>
        <div className="w-full h-1.5 bg-stone-200/50 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-[#d97706]"
            initial={{ width: `${progressPercentage}%` }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
      
      {/* Card Stack Area */}
      <div className="relative flex-1 w-full min-h-0 mb-6">
        {/* Next Card (Background) */}
        {nextWord && (
          <motion.div
            key={`next-${nextWord.id}`}
            initial={{ scale: 0.95, y: 10, opacity: 0.5 }}
            animate={{ scale: 0.95, y: 10, opacity: 0.5 }}
            className="absolute inset-0 w-full h-full bg-white rounded-2xl shadow-sm border border-stone-200 flex flex-col items-center justify-center pointer-events-none"
          >
            <h2 className="text-4xl md:text-5xl font-serif text-stone-900">{nextWord.word}</h2>
          </motion.div>
        )}

        {/* Current Card (Foreground) */}
        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={currentWord.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{ x, rotate, opacity }}
            drag={showMeaning && !loading ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            className={`absolute inset-0 w-full h-full bg-white rounded-2xl shadow-md border border-stone-200 flex flex-col p-6 md:p-8 text-center overflow-hidden group ${showMeaning && !loading ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
            onClick={() => !showMeaning && !loading && setShowMeaning(true)}
          >
            {showMeaning ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="w-full h-full flex flex-col items-center overflow-y-auto no-scrollbar py-2"
              >
                <h2 className="text-3xl font-serif text-stone-900 mb-4">{currentWord.word}</h2>
                <div className="h-px w-12 bg-stone-200 mx-auto mb-6 flex-none" />
                
                <div className="flex flex-col space-y-3 w-full text-left flex-1">
                  <div className="space-y-1">
                    <span className="text-[10px] text-stone-400 uppercase tracking-widest">Meaning</span>
                    <div className="flex flex-col space-y-1">
                      {currentWord.meaning.split(/[;；]/).map((m: string, i: number) => (
                        <p key={i} className="text-lg text-stone-700 font-serif italic">{m.trim()}</p>
                      ))}
                    </div>
                  </div>

                  {aiLoading ? (
                    <div className="flex items-center justify-center py-8 text-stone-300">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {currentDetails.example && (
                        <div className="space-y-1 pt-2 border-t border-stone-50">
                          <span className="text-[10px] text-stone-400 uppercase tracking-widest">Example</span>
                          <p className="text-sm text-stone-600 leading-relaxed">{currentDetails.example}</p>
                        </div>
                      )}
                      
                      {currentDetails.mnemonic && (
                        <div className="space-y-1 pt-2 border-t border-stone-50 mt-3">
                          <span className="text-[10px] text-stone-400 uppercase tracking-widest">Analysis & Mnemonic</span>
                          <p className="text-xs text-stone-500 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-100 italic">
                            {currentDetails.mnemonic}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="space-y-6 flex flex-col items-center justify-center h-full w-full flex-1 pointer-events-none">
                <h2 className="text-4xl md:text-5xl font-serif text-stone-900">{currentWord.word}</h2>
                <p className="text-stone-400 text-xs uppercase tracking-widest mt-8 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <RefreshCw className="w-3 h-3" strokeWidth={1.5} /> Tap to flip
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Buttons Area */}
      <div className="flex-none w-full h-[80px] flex flex-col justify-end">
        {showMeaning ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex flex-col items-center space-y-3"
          >
            <p className="text-stone-400 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
              Swipe left to forget, right to remember
            </p>
            <div className="w-full flex gap-3 md:gap-4">
              <Button 
                variant="outline" 
                className="flex-1 h-12 md:h-14 rounded-xl text-sm font-medium border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
                onClick={(e) => { e.stopPropagation(); handleReview(false); }}
                disabled={loading}
              >
                <X className="w-4 h-4 mr-2" strokeWidth={1.5} /> Forgot
              </Button>
              <Button 
                className="flex-1 h-12 md:h-14 rounded-xl text-sm font-medium bg-stone-900 hover:bg-stone-800 text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); handleReview(true); }}
                disabled={loading}
              >
                <Check className="w-4 h-4 mr-2" strokeWidth={1.5} /> Knew it
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-stone-400 text-[10px] uppercase tracking-widest">
              Tap card to reveal meaning
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
