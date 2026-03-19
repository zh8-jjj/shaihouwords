import { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { dataService } from '../services/data';
import { CheckCircle2, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { generateAIContent } from '../services/ai';

export function AddWords({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [aiCount, setAiCount] = useState<number>(0);

  const handleAdd = async () => {
    if (!text.trim()) return;
    
    setLoading(true);
    setAiCount(0);
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    const wordsToAdd: {word: string, meaning: string, example?: string, mnemonic?: string}[] = [];
    const wordsToFetch: string[] = [];
    
    for (const line of lines) {
      // Parse by splitting on the first occurrence of a separator (hyphen, dash, comma, or colon)
      // This allows meanings to contain commas or hyphens.
      const separatorMatch = line.match(/[-—,:]/);
      
      if (separatorMatch && separatorMatch.index !== undefined) {
        const word = line.substring(0, separatorMatch.index).trim();
        const meaning = line.substring(separatorMatch.index + 1).trim();
        
        if (word && meaning) {
          wordsToAdd.push({ word, meaning });
        }
      } else {
        // No separator found, assume it's just an English word
        const word = line.trim();
        if (word) {
          wordsToFetch.push(word);
        }
      }
    }

    if (wordsToFetch.length > 0) {
      try {
        const response = await generateAIContent({
          prompt: `Provide the Chinese meaning, part of speech, a simple example sentence (with Chinese translation), and a brief root/affix analysis or mnemonic for the following English words. 
          Return a JSON object with a single property 'words' which is an array of objects with 'word', 'meaning', 'example', and 'mnemonic' properties. 
          Example meaning format: 'n. 苹果; v. 采摘'.
          Example sentence format: 'The apple is red. (这个苹果是红色的。)'.
          Mnemonic format: '词根: apple (苹果); 记忆: 想象一个红苹果'.
          Words: ${wordsToFetch.join(', ')}`,
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
          const parsed = JSON.parse(jsonText);
          const fetchedWords = parsed.words || [];
          wordsToAdd.push(...fetchedWords);
          setAiCount(fetchedWords.length);
        }
      } catch (e) {
        console.error("Error fetching meanings from AI:", e);
        alert("Failed to fetch meanings for some words. Please try again or add meanings manually.");
      }
    }
    
    let added = 0;
    const now = new Date();
    
    // We'll add them one by one. In a real app, a batch write is better, 
    // but for simplicity and safety with rules, we'll do individual adds.
    for (const item of wordsToAdd) {
      try {
        await dataService.addWord({
          word: item.word,
          meaning: item.meaning,
          example: item.example || '',
          mnemonic: item.mnemonic || '',
          nextReviewDate: now.toISOString(), // Review immediately!
          reviewCount: 0,
          status: 'learning'
        });
        added++;
      } catch (e) {
        console.error("Error adding word:", e);
      }
    }
    
    if (added > 0) {
      await dataService.recordActivity();
    }
    
    setLoading(false);
    setSuccessCount(added);
    setText('');
  };

  if (successCount !== null) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
        <div className="w-16 h-16 border border-stone-200 rounded-full flex items-center justify-center bg-white shadow-sm">
          <CheckCircle2 className="w-6 h-6 text-stone-800" strokeWidth={1.5} />
        </div>
        <h2 className="text-3xl font-serif text-stone-900 tracking-tight">Added {successCount} words</h2>
        <p className="text-stone-500 text-sm uppercase tracking-widest leading-relaxed">
          They are ready for your review session today.
          {aiCount > 0 && <span className="block mt-4 text-stone-800 font-serif italic normal-case text-base"><Sparkles className="w-4 h-4 inline mr-1 text-stone-400" strokeWidth={1.5}/> AI generated meanings for {aiCount} words.</span>}
        </p>
        <Button onClick={onBack} className="mt-8 h-12 px-8 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium">Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto pt-20 sm:pt-24 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-stone-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-stone-600" strokeWidth={1.5} />
        </Button>
        <h2 className="text-3xl font-serif tracking-tight text-stone-900">Add New Words</h2>
      </div>
      
      <div className="space-y-6 bg-white p-10 rounded-2xl shadow-sm border border-stone-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-stone-50 rounded-bl-full -z-10" />
        <div className="space-y-3">
          <label className="text-xs font-medium text-stone-400 uppercase tracking-widest">
            Paste your words
          </label>
          <Textarea 
            placeholder="apple&#10;banana&#10;serendipity - 不期而遇的美好"
            className="h-64 font-serif text-lg bg-stone-50/50 border-stone-200 focus:border-stone-400 focus:ring-stone-400 rounded-xl resize-none p-6 placeholder:text-stone-300 placeholder:italic"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-xs text-stone-400 leading-relaxed pt-2">
            您可以直接粘贴英文单词（AI 将自动生成释义），或者使用格式：<code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 font-mono">单词 - 释义</code>。每行一个单词。
          </p>
        </div>
        
        <div className="flex justify-end pt-4">
          <Button 
            onClick={handleAdd} 
            disabled={loading || !text.trim()}
            className="h-12 px-8 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-medium transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={1.5} />
                Processing...
              </>
            ) : (
              'Add Words'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
