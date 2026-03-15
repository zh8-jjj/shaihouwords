import { useState, useEffect, useMemo } from 'react';
import { dataService } from '../services/data';
import { Button } from './ui/button';
import { ArrowLeft, Trash2, Check, X, Search, Filter, BookOpen, RefreshCw } from 'lucide-react';

const INTERVALS = [1, 2, 4, 7, 15, 30];

export function WordList({ onBack }: { onBack: () => void }) {
  const [words, setWords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'learning' | 'graduated' | 'all'>('learning');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const fetchWords = async () => {
    try {
      const wordsData = await dataService.getWords();
      setWords(wordsData);
      setLoading(false);
    } catch (e) {
      console.error("Error fetching words:", e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWords();
  }, []);

  const filteredWords = useMemo(() => {
    return words.filter(word => {
      const matchesSearch = word.word.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (word.meaning && word.meaning.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesTab = activeTab === 'all' || word.status === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [words, searchQuery, activeTab]);

  const handleRestart = async (word: any) => {
    try {
      await dataService.updateWord(word.id, {
        status: 'learning',
        reviewCount: 0,
        failures: [],
        nextReviewDate: new Date().toISOString(), // Review immediately
        lastReviewedAt: null
      });
      fetchWords(); // Refresh list
    } catch (e) {
      console.error("Error restarting word:", e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dataService.deleteWord(id);
      setDeletingId(null);
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
      fetchWords(); // Refresh list
    } catch (e) {
      console.error("Error deleting word:", e);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    setIsBulkDeleting(true);
    try {
      // Proxy doesn't support batch yet, so we do it sequentially for now
      // In a real app, we'd add a bulk delete endpoint
      await Promise.all(selectedIds.map(id => dataService.deleteWord(id)));
      setSelectedIds([]);
      setIsSelectionMode(false);
      fetchWords(); // Refresh list
    } catch (e) {
      console.error("Error bulk deleting words:", e);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedIds(filteredWords.map(w => w.id));
      return;
    }

    if (selectedIds.length === filteredWords.length) {
      setSelectedIds([]);
      setIsSelectionMode(false);
    } else {
      setSelectedIds(filteredWords.map(w => w.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
      if (next.length === 0) setIsSelectionMode(false);
      return next;
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-stone-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-stone-600" strokeWidth={1.5} />
          </Button>
          <h2 className="text-3xl font-serif tracking-tight text-stone-900">My Vocabulary</h2>
        </div>

        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all animate-in fade-in slide-in-from-right-2"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete {selectedIds.length}
            </Button>
          )}
          {isSelectionMode && selectedIds.length === 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsSelectionMode(false)}
              className="rounded-full text-stone-500 hover:bg-stone-100 transition-all"
            >
              Cancel
            </Button>
          )}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 group-focus-within:text-stone-600 transition-colors" strokeWidth={1.5} />
            <input 
              type="text" 
              placeholder="Search words..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-stone-200 w-full sm:w-64 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-stone-100 rounded-xl w-fit">
        <button 
          onClick={() => { setActiveTab('learning'); setSelectedIds([]); setIsSelectionMode(false); }}
          className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${activeTab === 'learning' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Learning ({words.filter(w => w.status === 'learning').length})
        </button>
        <button 
          onClick={() => { setActiveTab('graduated'); setSelectedIds([]); setIsSelectionMode(false); }}
          className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${activeTab === 'graduated' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Mastered ({words.filter(w => w.status === 'graduated').length})
        </button>
        <button 
          onClick={() => { setActiveTab('all'); setSelectedIds([]); setIsSelectionMode(false); }}
          className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${activeTab === 'all' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          All ({words.length})
        </button>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden relative min-h-[400px]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-stone-50 rounded-bl-full -z-10" />
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-stone-400 font-serif italic gap-3">
            <div className="w-6 h-6 border-2 border-stone-200 border-t-stone-800 rounded-full animate-spin" />
            Loading words...
          </div>
        ) : filteredWords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-stone-400 font-serif italic gap-2">
            <BookOpen className="w-8 h-8 opacity-20 mb-2" strokeWidth={1} />
            {searchQuery ? "No matches found." : "No words in this category."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-stone-400 uppercase tracking-widest bg-stone-50/50 border-b border-stone-100">
                <tr>
                  <th className="px-6 py-4 w-10">
                    <input 
                      type="checkbox" 
                      checked={isSelectionMode && selectedIds.length === filteredWords.length && filteredWords.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 font-medium">Word</th>
                  <th className="px-6 py-4 font-medium">Meaning</th>
                  {INTERVALS.map(d => (
                    <th key={d} className="px-2 py-4 font-medium text-center">{d}d</th>
                  ))}
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredWords.map((word) => (
                  <tr key={word.id} className={`hover:bg-stone-50/50 transition-colors group ${selectedIds.includes(word.id) ? 'bg-stone-50/80' : ''}`}>
                    <td className="px-6 py-4">
                      {isSelectionMode && (
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(word.id)}
                          onChange={() => toggleSelect(word.id)}
                          className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900 cursor-pointer animate-in zoom-in-50 duration-200"
                        />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-serif text-lg text-stone-900 leading-none">{word.word}</div>
                      <div className="text-[10px] text-stone-400 mt-1 uppercase tracking-tighter">
                        Added {new Date(typeof word.createdAt === 'string' ? word.createdAt : (word.createdAt?.seconds * 1000 || Date.now())).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-stone-500 truncate max-w-[200px]" title={word.meaning}>{word.meaning}</td>
                    {INTERVALS.map((days, i) => {
                      let status = 'pending';
                      if (word.status === 'graduated' || word.reviewCount > i) {
                        status = 'passed';
                      } else if ((word.failures || []).includes(i)) {
                        status = 'failed';
                      } else if (word.reviewCount === i) {
                        status = 'current';
                      }
                      
                      return (
                        <td key={i} className="px-2 py-4 text-center">
                          {status === 'passed' && <Check className="w-4 h-4 text-emerald-500 mx-auto" strokeWidth={2} />}
                          {status === 'failed' && (
                            <div className="w-5 h-5 rounded-full bg-red-50 text-red-400 flex items-center justify-center mx-auto" title="Forgot here">
                              <X className="w-3 h-3" strokeWidth={2} />
                            </div>
                          )}
                          {status === 'current' && <div className="w-2 h-2 rounded-full bg-stone-800 mx-auto animate-pulse" title="Next review" />}
                          {status === 'pending' && <span className="text-stone-200">·</span>}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {word.status === 'graduated' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-full" 
                            onClick={() => handleRestart(word)}
                            title="Restart Review Cycle"
                          >
                            <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
                          </Button>
                        )}
                        {deletingId === word.id ? (
                          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 rounded-full"
                              onClick={() => handleDelete(word.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-stone-400 hover:bg-stone-100 rounded-full"
                              onClick={() => setDeletingId(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-stone-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all rounded-full" 
                            onClick={() => setDeletingId(word.id)}
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
