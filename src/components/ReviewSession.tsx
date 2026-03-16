import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { dataService } from '../services/data';
import { getNextReviewDate } from '../lib/ebbinghaus';
import { X, Check, RefreshCw, ChevronLeft, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateAIContent } from '../services/ai';

export function ReviewSession({ words, onComplete }: { words: any[], onComplete: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [currentDetails, setCurrentDetails] = useState<{example?: string, mnemonic?: string}>({});

  const currentWord = words[currentIndex];

  useEffect(() => {
    if (currentWord) {
      setCurrentDetails({
        example: currentWord.example,
        mnemonic: currentWord.mnemonic
      });
    }
  }, [currentWord]);

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
        const details = JSON.parse(response.text);
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

  const handleReview = async (remembered: boolean) => {
    if (!currentWord) return;
    
    setLoading(true);
    
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
    
    try {
      await dataService.updateWord(currentWord.id, updateData);
      
      // Move to next word
      if (currentIndex + 1 < words.length) {
        setCurrentIndex(currentIndex + 1);
        setShowMeaning(false);
        setCurrentDetails({});
      } else {
        onComplete();
      }
    } catch (e) {
      console.error("Error updating word:", e);
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto px-4 relative">
      <div className="absolute top-0 left-4">
        <Button variant="ghost" size="icon" onClick={onComplete} className="hover:bg-stone-100 rounded-full">
          <ChevronLeft className="w-5 h-5 text-stone-600" strokeWidth={1.5} />
        </Button>
      </div>
      
      <div className="w-full mb-8 flex justify-between items-center text-xs font-medium text-stone-400 uppercase tracking-widest pt-12">
        <span>Reviewing</span>
        <span>{currentIndex + 1} / {words.length}</span>
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={currentWord.id + (showMeaning ? '-meaning' : '-word')}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="w-full min-h-[400px] md:min-h-[440px] bg-white rounded-2xl shadow-sm border border-stone-200 flex flex-col p-6 md:p-8 text-center cursor-pointer relative overflow-hidden group"
          onClick={() => !showMeaning && setShowMeaning(true)}
        >
          {showMeaning ? (
            <div className="w-full h-full flex flex-col items-center overflow-y-auto no-scrollbar py-2">
              <h2 className="text-3xl font-serif text-stone-900 mb-4">{currentWord.word}</h2>
              <div className="h-px w-12 bg-stone-200 mx-auto mb-6" />
              
              <div className="flex flex-col space-y-3 w-full text-left">
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
                  <>
                    {currentDetails.example && (
                      <div className="space-y-1 pt-2 border-t border-stone-50">
                        <span className="text-[10px] text-stone-400 uppercase tracking-widest">Example</span>
                        <p className="text-sm text-stone-600 leading-relaxed">{currentDetails.example}</p>
                      </div>
                    )}
                    
                    {currentDetails.mnemonic && (
                      <div className="space-y-1 pt-2 border-t border-stone-50">
                        <span className="text-[10px] text-stone-400 uppercase tracking-widest">Analysis & Mnemonic</span>
                        <p className="text-xs text-stone-500 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-100 italic">
                          {currentDetails.mnemonic}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6 flex flex-col items-center justify-center h-full w-full flex-1">
              <h2 className="text-4xl md:text-5xl font-serif text-stone-900">{currentWord.word}</h2>
              <p className="text-stone-400 text-xs uppercase tracking-widest mt-8 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <RefreshCw className="w-3 h-3" strokeWidth={1.5} /> Tap to flip
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {showMeaning && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full flex gap-3 md:gap-4 mt-6"
        >
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
        </motion.div>
      )}
    </div>
  );
}
