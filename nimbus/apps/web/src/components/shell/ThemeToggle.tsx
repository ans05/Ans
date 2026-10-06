'use client';

import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { IconButton } from '@/components/ui/Button';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'nimbus:theme';
const CHANGE_EVENT = 'nimbus:themechange';

function readTheme(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    media.removeEventListener('change', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function applyTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage unavailable: the choice lasts for this page only.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'light' as Theme);
  const dark = theme === 'dark';
  return (
    <IconButton label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => applyTheme(dark ? 'light' : 'dark')}>
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </IconButton>
  );
}
