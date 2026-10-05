import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AudioEngine, type AudioSnapshot } from './AudioEngine';

export interface AudioController {
  engine: AudioEngine;
  snapshot: AudioSnapshot;
  load(file: File): Promise<boolean>;
  play(): Promise<void>;
  pause(): void;
  toggle(): Promise<void>;
  seek(seconds: number): void;
  eject(): void;
}

/**
 * One AudioEngine per component lifetime. The engine's resources are attached
 * in an effect and released in its cleanup, which keeps React StrictMode's
 * mount → unmount → mount cycle from leaking an AudioContext. State is read
 * through useSyncExternalStore so React re-renders exactly when the engine
 * emits a new snapshot.
 */
export function useAudioEngine(onError?: (message: string) => void): AudioController {
  const [engine] = useState(() => new AudioEngine());
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  });

  useEffect(() => {
    engine.attach();
    let lastError: string | null = null;
    const unsubscribe = engine.subscribe((snap) => {
      if (snap.error && snap.error !== lastError) onErrorRef.current?.(snap.error);
      lastError = snap.error;
    });
    return () => {
      unsubscribe();
      engine.dispose();
    };
  }, [engine]);

  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);

  const load = useCallback(
    async (file: File) => {
      try {
        await engine.loadFile(file);
        return true;
      } catch {
        return false;
      }
    },
    [engine],
  );
  const play = useCallback(async () => {
    try {
      await engine.play();
    } catch {
      // Surfaced through the snapshot's error field.
    }
  }, [engine]);
  const pause = useCallback(() => engine.pause(), [engine]);
  const toggle = useCallback(async () => {
    try {
      await engine.toggle();
    } catch {
      // Surfaced through the snapshot's error field.
    }
  }, [engine]);
  const seek = useCallback((s: number) => engine.seek(s), [engine]);
  const eject = useCallback(() => engine.eject(), [engine]);

  return { engine, snapshot, load, play, pause, toggle, seek, eject };
}
