import { useRef, type ChangeEvent } from 'react';
import type { AudioMode } from '../audio/mode';
import type { AudioController } from '../audio/useAudioEngine';
import { Button } from './controls';
import { formatTime } from './format';

export function ModeBadge({ mode, fileName }: { mode: AudioMode; fileName: string | null }) {
  const text =
    mode === 'reactive'
      ? `Audio reactive · ${fileName ?? ''}`
      : mode === 'paused'
        ? 'Audio paused · ambient motion'
        : 'Ambient mode · no audio loaded';
  return (
    <span className={`mode mode--${mode}`} role="status" aria-live="polite">
      <span className="mode__dot" aria-hidden="true" />
      {text}
    </span>
  );
}

export function AudioSection({ audio }: { audio: AudioController }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { snapshot } = audio;
  const hasFile = snapshot.status === 'ready' || snapshot.status === 'playing' || snapshot.status === 'paused';
  const playing = snapshot.status === 'playing';

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Failures are reported through the engine's error channel.
    await audio.load(file);
  };

  return (
    <div className="audio">
      <div className="audio__row">
        <label className="btn btn--default file-button" htmlFor="audio-file">
          {hasFile ? 'Replace audio' : 'Load audio file'}
          <input
            ref={inputRef}
            id="audio-file"
            className="sr-only"
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.webm"
            onChange={onPick}
          />
        </label>
        <Button
          type="button"
          variant={hasFile ? 'primary' : 'default'}
          disabled={!hasFile}
          aria-pressed={playing}
          onClick={() => void audio.toggle()}
        >
          {playing ? 'Pause audio' : 'Play audio'}
        </Button>
        {hasFile ? (
          <Button type="button" variant="ghost" onClick={audio.eject} aria-label="Remove loaded audio">
            Eject
          </Button>
        ) : null}
      </div>

      {snapshot.status === 'loading' ? <p className="audio__meta">Loading {snapshot.fileName}…</p> : null}

      {hasFile ? (
        <div className="audio__transport">
          <p className="audio__meta" title={snapshot.fileName ?? ''}>
            <span className="audio__file">{snapshot.fileName}</span>
          </p>
          <div className="audio__scrub">
            <span className="audio__time" aria-hidden="true">
              {formatTime(snapshot.currentTime)}
            </span>
            <input
              className="range range--thin"
              type="range"
              min={0}
              max={Math.max(1, snapshot.duration)}
              step={0.1}
              value={Math.min(snapshot.currentTime, Math.max(1, snapshot.duration))}
              aria-label="Playback position"
              aria-valuetext={`${formatTime(snapshot.currentTime)} of ${formatTime(snapshot.duration)}`}
              onChange={(e) => audio.seek(Number(e.target.value))}
              style={{
                ['--fill' as string]: `${snapshot.duration ? (snapshot.currentTime / snapshot.duration) * 100 : 0}%`,
              }}
            />
            <span className="audio__time" aria-hidden="true">
              {formatTime(snapshot.duration)}
            </span>
          </div>
        </div>
      ) : (
        <p className="audio__meta">
          Nothing loaded. The artwork runs in ambient mode, driven by slow synthetic rhythm. Audio stays on your
          device and is never uploaded.
        </p>
      )}
    </div>
  );
}
