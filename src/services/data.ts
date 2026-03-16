/**
 * Data Service that proxies all requests through the server.
 * This allows domestic users to access Firestore data without a VPN.
 */

export interface Word {
  id: string;
  word: string;
  meaning: string;
  example?: string;
  mnemonic?: string;
  reviewCount: number;
  nextReviewDate: any;
  status: 'learning' | 'graduated';
  failures?: number[];
}

export const dataService = {
  // Auth
  async getCurrentUser() {
    const res = await fetch('/api/proxy/user', { credentials: 'include' });
    const data = await res.json();
    return data.user;
  },

  async login(email: string) {
    const res = await fetch('/api/proxy/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email })
    });
    return await res.json();
  },

  async logout() {
    await fetch('/api/proxy/logout', { method: 'POST', credentials: 'include' });
  },

  // Words
  async getWords(): Promise<Word[]> {
    const res = await fetch('/api/proxy/words', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch words');
    return await res.json();
  },

  async addWord(wordData: Partial<Word>) {
    const res = await fetch('/api/proxy/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(wordData)
    });
    return await res.json();
  },

  async updateWord(id: string, updateData: Partial<Word> | any) {
    const res = await fetch(`/api/proxy/words/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updateData)
    });
    return await res.json();
  },

  async deleteWord(id: string) {
    const res = await fetch(`/api/proxy/words/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    return await res.json();
  }
};
