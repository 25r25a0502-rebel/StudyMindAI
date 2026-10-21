import { create } from 'zustand';

export const THEMES = [
  { id: 'onyx', name: 'Onyx Black', desc: 'Pure black · ash grey', dot: 'linear-gradient(135deg,#000000,#3f3f46)' },
  { id: 'midnight', name: 'Midnight Aurora', desc: 'Violet · cyan · pink', dot: 'linear-gradient(135deg,#6d28d9,#22d3ee)' },
  { id: 'ocean', name: 'Deep Ocean', desc: 'Blue · teal · aqua', dot: 'linear-gradient(135deg,#1e40af,#2dd4bf)' },
  { id: 'ember', name: 'Sunset Ember', desc: 'Orange · rose · gold', dot: 'linear-gradient(135deg,#ea580c,#f43f5e)' },
  { id: 'forest', name: 'Neon Forest', desc: 'Emerald · lime · mint', dot: 'linear-gradient(135deg,#059669,#a3e635)' },
  { id: 'candy', name: 'Cotton Candy', desc: 'Fuchsia · purple · pink', dot: 'linear-gradient(135deg,#a21caf,#f472b6)' },
  { id: 'paper', name: 'Light Paper', desc: 'Clean light mode', dot: 'linear-gradient(135deg,#ffffff,#c4b5fd)' }
];

function initial() {
  try { return localStorage.getItem('sm-theme') || 'onyx'; } catch { return 'onyx'; }
}
export const useTheme = create((set) => ({
  theme: initial(),
  setTheme: (id) => {
    try { localStorage.setItem('sm-theme', id); } catch {}
    document.body.dataset.theme = id;
    set({ theme: id });
  }
}));
// apply on load
try { document.body.dataset.theme = initial(); } catch {}
