import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type Palette = 'saade_classic' | 'olive_royal' | 'rose_or' | 'marine' | 'emeraude';
export type Theme = 'light' | 'dark' | 'auto';

export const PALETTES: { id: Palette; label: string; colors: string[] }[] = [
  { id: 'saade_classic', label: 'SAADÉ Classique', colors: ['#FAF6F0', '#C49A5A', '#2C1A0E'] },
  { id: 'olive_royal',   label: 'Olive Royal',     colors: ['#F4F3E8', '#6B7A3A', '#D4AF37'] },
  { id: 'rose_or',       label: 'Rose Or',         colors: ['#FCF4F0', '#C44A6A', '#E6A23C'] },
  { id: 'marine',        label: 'Marine Lounge',   colors: ['#F0F4F8', '#2A5C8A', '#E8853F'] },
  { id: 'emeraude',      label: 'Émeraude',        colors: ['#F0F6F2', '#2E7A5C', '#E6A53C'] },
];

const PALETTE_KEY = 'saade-palette';
const THEME_KEY = 'saade-theme';

function applyDom(palette: Palette, theme: Theme) {
  const root = document.documentElement;
  if (palette === 'saade_classic') root.removeAttribute('data-palette');
  else root.setAttribute('data-palette', palette);
  const wantDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', wantDark);
}

export function useTheme() {
  const { user } = useAuth();
  const [palette, setPaletteState] = useState<Palette>(() => (localStorage.getItem(PALETTE_KEY) as Palette) || 'saade_classic');
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem(THEME_KEY) as Theme) || 'light');

  useEffect(() => { applyDom(palette, theme); }, [palette, theme]);

  // Sync depuis user_preferences
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('user_preferences' as any).select('palette, theme').eq('user_id', user.id).maybeSingle();
      if (data) {
        const p = (data as any).palette as Palette;
        const t = (data as any).theme as Theme;
        if (p) { setPaletteState(p); localStorage.setItem(PALETTE_KEY, p); }
        if (t) { setThemeState(t); localStorage.setItem(THEME_KEY, t); }
      }
    })();
  }, [user]);

  const setPalette = useCallback(async (p: Palette) => {
    setPaletteState(p); localStorage.setItem(PALETTE_KEY, p);
    if (user) await supabase.from('user_preferences' as any).upsert({ user_id: user.id, palette: p, theme }, { onConflict: 'user_id' });
  }, [user, theme]);

  const setTheme = useCallback(async (t: Theme) => {
    setThemeState(t); localStorage.setItem(THEME_KEY, t);
    if (user) await supabase.from('user_preferences' as any).upsert({ user_id: user.id, palette, theme: t }, { onConflict: 'user_id' });
  }, [user, palette]);

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  return { palette, setPalette, theme, setTheme, toggle, palettes: PALETTES };
}
