import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useAudioEngine } from './audio/useAudioEngine';
import { ArtworkCanvas, type ArtworkCanvasHandle } from './canvas/ArtworkCanvas';
import { designFileName, readDesignFile, saveBlob, saveDesignJson } from './design/file';
import { loadPrefs, savePrefs, type UiPrefs } from './design/storage';
import { audioMode } from './audio/mode';
import { ModeBadge } from './editor/AudioSection';
import { EditorPanel } from './editor/EditorPanel';
import { useDesign } from './hooks/useDesign';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { renderPngBlob } from './render/exportPng';

interface Notice {
  kind: 'info' | 'error';
  text: string;
  id: number;
}

const ISSUE_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date());

export default function App() {
  const { design, dispatch, restored } = useDesign();
  const systemReduced = usePrefersReducedMotion();
  const [prefs, setPrefs] = useState<UiPrefs>(() => loadPrefs());
  const reduceMotion = prefs.reduceMotion ?? systemReduced;
  const canvasRef = useRef<ArtworkCanvasHandle>(null);
  const [notice, setNotice] = useState<Notice | null>(() =>
    restored ? { kind: 'info', text: 'Restored your last design from this browser.', id: 0 } : null,
  );
  const [exporting, setExporting] = useState(false);

  useEffect(() => savePrefs(prefs), [prefs]);

  const notify = useCallback((kind: Notice['kind'], text: string) => {
    setNotice({ kind, text, id: Date.now() });
  }, []);

  // Notices dismiss themselves; errors linger a little longer.
  useEffect(() => {
    if (!notice) return;
    const handle = window.setTimeout(() => setNotice(null), notice.kind === 'error' ? 8000 : 4000);
    return () => window.clearTimeout(handle);
  }, [notice]);

  const audio = useAudioEngine((message) => notify('error', message));

  const onExportPng = useCallback(async () => {
    const frame = canvasRef.current?.getFrame();
    if (!frame) return;
    setExporting(true);
    try {
      const blob = await renderPngBlob(design, frame);
      const outcome = await saveBlob(blob, designFileName(design, 'png'));
      notify('info', outcome === 'saved' ? 'Exported a 2048 × 2048 PNG.' : 'Export cancelled.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }, [design, notify]);

  const onSaveJson = useCallback(async () => {
    try {
      const outcome = await saveDesignJson(design);
      notify('info', outcome === 'saved' ? 'Saved the design as JSON.' : 'Save cancelled.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Save failed.');
    }
  }, [design, notify]);

  const onLoadJson = useCallback(
    async (file: File) => {
      const result = await readDesignFile(file);
      if (!result.ok) {
        notify('error', result.error);
        return;
      }
      dispatch({ type: 'replace', design: result.design });
      notify(
        'info',
        result.warnings.length
          ? `Loaded "${file.name}" with adjustments: ${result.warnings.join(' ')}`
          : `Loaded "${file.name}".`,
      );
    },
    [dispatch, notify],
  );

  const toggleAnimating = useCallback(() => setPrefs((p) => ({ ...p, animating: !p.animating })), []);
  const setReduceMotion = useCallback(
    (value: boolean) => setPrefs((p) => ({ ...p, reduceMotion: value === systemReduced ? null : value })),
    [systemReduced],
  );

  const mode = audioMode(audio.snapshot.status);

  // Page depth: the artwork tilts a few degrees toward the pointer, like a
  // sleeve held up to the light. Off while dragging, under reduced motion,
  // and on touch devices (the CSS gates the hover case).
  const frameRef = useRef<HTMLDivElement>(null);
  const onStagePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const el = frameRef.current;
      if (!el || reduceMotion || e.buttons !== 0 || e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--tilt-x', `${(-ny * 7).toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${(nx * 9).toFixed(2)}deg`);
    },
    [reduceMotion],
  );
  const onStagePointerLeave = useCallback(() => {
    const el = frameRef.current;
    if (!el) return;
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
  }, []);

  return (
    <div className="app">
      <div className="depth-grid" aria-hidden="true" />
      <a className="skip-link" href="#editor">
        Skip to editor
      </a>
      <header className="masthead">
        <h1 className="masthead__title">AFTERHOURS</h1>
        <div className="masthead__meta">
          <span>4D artwork studio</span>
          <span>No. 001</span>
          <span>{ISSUE_DATE}</span>
        </div>
      </header>

      <main className="studio">
        <section className="stage" aria-label="Artwork">
          <div className="stage__bar">
            <span className="eyebrow">Artwork · {design.preset}</span>
            <ModeBadge mode={mode} fileName={audio.snapshot.fileName} />
          </div>
          <div
            ref={frameRef}
            className="stage__frame"
            onPointerMove={onStagePointerMove}
            onPointerLeave={onStagePointerLeave}
          >
          <ArtworkCanvas
            ref={canvasRef}
            design={design}
            animating={prefs.animating}
            reducedMotion={reduceMotion}
            engine={audio.engine}
            onMoveTitle={(position) => dispatch({ type: 'set-title-position', position })}
            onNudgeTitle={(dx, dy) => dispatch({ type: 'nudge-title', dx, dy })}
            onToggleAnimating={toggleAnimating}
          />
          </div>
          <p className="stage__hint">
            Drag the title to move it. Arrow keys nudge, Shift for larger steps, Space plays or pauses.
            {reduceMotion ? ' Reduced motion is on.' : ''}
            {!prefs.animating ? ' Animation paused.' : ''}
          </p>
        </section>

        <aside className="panel" id="editor" aria-label="Editor">
          <EditorPanel
            design={design}
            dispatch={dispatch}
            animating={prefs.animating}
            onToggleAnimating={toggleAnimating}
            reduceMotion={reduceMotion}
            reduceMotionIsSystem={prefs.reduceMotion === null}
            onSetReduceMotion={setReduceMotion}
            audio={audio}
            exporting={exporting}
            onExportPng={() => void onExportPng()}
            onSaveJson={() => void onSaveJson()}
            onLoadJson={(file) => void onLoadJson(file)}
            onReset={() => dispatch({ type: 'reset' })}
          />
        </aside>
      </main>

      <footer className="colophon">
        <span>Design rev. {design.revision} · saved in this browser</span>
        <span>Procedural graphics · 4D projection · Web Audio analysis · no uploads</span>
      </footer>

      <div className="notice-area" aria-live="polite">
        {notice ? (
          <div key={notice.id} className={`notice notice--${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
            {notice.text}
            <button type="button" className="notice__close" onClick={() => setNotice(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
