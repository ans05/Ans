/**
 * AudioEngine owns every Web Audio resource for the app.
 *
 * Signal path:  <audio> element ──▶ MediaElementSource ──▶ AnalyserNode ──▶ speakers
 *
 * The AnalyserNode runs a 2048-point FFT on whatever is playing. Each frame we
 * read its frequency and time-domain buffers and pass them to the pure feature
 * extractor. Nothing here starts playback on its own: the AudioContext is only
 * created inside a user gesture (the Play button), which is what browsers
 * require for sound to be audible.
 */

import { createFeatureExtractor, type AudioFeatures } from './features';

export type AudioStatus = 'empty' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

export interface AudioSnapshot {
  status: AudioStatus;
  fileName: string | null;
  duration: number;
  currentTime: number;
  error: string | null;
}

export const AUDIO_FILE_MAX_BYTES = 250 * 1024 * 1024;
const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|oga|m4a|aac|flac|webm|opus|aiff?)$/i;

export function validateAudioFile(file: File): string | null {
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > AUDIO_FILE_MAX_BYTES) return `"${file.name}" is over 250 MB. Try a smaller file.`;
  const typeOk = file.type.startsWith('audio/') || file.type === 'video/webm' || file.type === 'video/ogg';
  if (!typeOk && !AUDIO_EXTENSIONS.test(file.name)) {
    return `"${file.name}" isn't a recognised audio file. Try MP3, WAV, OGG, M4A, FLAC or AAC.`;
  }
  return null;
}

type Listener = (snapshot: AudioSnapshot) => void;

export class AudioEngine {
  private element: HTMLAudioElement;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private objectUrl: string | null = null;
  private freqData = new Uint8Array(0);
  private timeData = new Uint8Array(0);
  private readonly extractor = createFeatureExtractor();
  private readonly listeners = new Set<Listener>();
  private snapshot: AudioSnapshot = { status: 'empty', fileName: null, duration: 0, currentTime: 0, error: null };
  private attached = false;
  private readonly fftSize = 2048;

  constructor() {
    this.element = new Audio();
  }

  /** Wire up the media element. Safe to call again after dispose(). */
  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.element = new Audio();
    this.element.preload = 'auto';
    const el = this.element;
    el.addEventListener('play', this.onPlay);
    el.addEventListener('pause', this.onPause);
    el.addEventListener('ended', this.onPause);
    el.addEventListener('timeupdate', this.onTime);
    el.addEventListener('durationchange', this.onTime);
    el.addEventListener('loadedmetadata', this.onLoaded);
    el.addEventListener('error', this.onError);
    this.emit({ status: 'empty', fileName: null, duration: 0, currentTime: 0, error: null });
  }

  /** Current UI-facing state (stable reference until the next change). */
  getSnapshot = (): AudioSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get hasAudio(): boolean {
    return this.snapshot.status !== 'empty' && this.snapshot.status !== 'error' && this.snapshot.status !== 'loading';
  }

  get isPlaying(): boolean {
    return this.snapshot.status === 'playing';
  }

  /** Load a local file. Resolves once metadata is known, rejects with a friendly message. */
  async loadFile(file: File): Promise<void> {
    if (!this.attached) this.attach();
    const problem = validateAudioFile(file);
    if (problem) {
      this.emit({ status: this.snapshot.fileName ? this.snapshot.status : 'empty', error: problem });
      throw new Error(problem);
    }
    this.element.pause();
    this.revokeUrl();
    this.extractor.reset();
    this.objectUrl = URL.createObjectURL(file);
    this.emit({ status: 'loading', fileName: file.name, duration: 0, currentTime: 0, error: null });

    await new Promise<void>((resolve, reject) => {
      const el = this.element;
      const cleanup = () => {
        el.removeEventListener('loadedmetadata', onOk);
        el.removeEventListener('error', onErr);
      };
      const onOk = () => {
        cleanup();
        resolve();
      };
      const onErr = () => {
        cleanup();
        reject(new Error(decodeErrorMessage(el.error, file.name)));
      };
      el.addEventListener('loadedmetadata', onOk);
      el.addEventListener('error', onErr);
      el.src = this.objectUrl as string;
      el.load();
    }).catch((err: Error) => {
      this.revokeUrl();
      this.emit({ status: 'error', error: err.message, fileName: file.name });
      throw err;
    });

    this.emit({ status: 'ready', error: null });
  }

  /** Start playback. Must be called from a user gesture the first time. */
  async play(): Promise<void> {
    if (!this.hasAudio) return;
    this.ensureGraph();
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
    try {
      await this.element.play();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Playback was blocked.';
      this.emit({ error: `Couldn't start playback: ${message}` });
      throw err;
    }
  }

  pause(): void {
    this.element.pause();
  }

  async toggle(): Promise<void> {
    if (this.isPlaying) this.pause();
    else await this.play();
  }

  seek(seconds: number): void {
    if (!this.hasAudio || !Number.isFinite(seconds)) return;
    const d = this.element.duration;
    this.element.currentTime = Math.max(0, Math.min(Number.isFinite(d) ? d : seconds, seconds));
    this.onTime();
  }

  /** Drop the loaded file and return to ambient mode. */
  eject(): void {
    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
    this.revokeUrl();
    this.extractor.reset();
    this.emit({ status: 'empty', fileName: null, duration: 0, currentTime: 0, error: null });
  }

  /**
   * Analyse the current audio frame. Returns features driven by the file when
   * playing, or relaxes toward silence otherwise. The returned object is
   * reused between frames — read it, don't keep it.
   */
  analyse(dt: number): AudioFeatures {
    if (this.analyser && this.context && this.isPlaying) {
      this.analyser.getByteFrequencyData(this.freqData);
      this.analyser.getByteTimeDomainData(this.timeData);
      return this.extractor.update(this.freqData, this.timeData, this.context.sampleRate, this.fftSize, dt);
    }
    return this.extractor.relax(dt);
  }

  /** Release every resource: audio graph, object URL, element listeners. */
  dispose(): void {
    if (!this.attached) return;
    this.attached = false;
    const el = this.element;
    el.pause();
    el.removeEventListener('play', this.onPlay);
    el.removeEventListener('pause', this.onPause);
    el.removeEventListener('ended', this.onPause);
    el.removeEventListener('timeupdate', this.onTime);
    el.removeEventListener('durationchange', this.onTime);
    el.removeEventListener('loadedmetadata', this.onLoaded);
    el.removeEventListener('error', this.onError);
    el.removeAttribute('src');
    el.load();
    this.revokeUrl();
    this.sourceNode?.disconnect();
    this.analyser?.disconnect();
    this.sourceNode = null;
    this.analyser = null;
    if (this.context) {
      void this.context.close().catch(() => undefined);
      this.context = null;
    }
    this.extractor.reset();
    this.snapshot = { status: 'empty', fileName: null, duration: 0, currentTime: 0, error: null };
  }

  private ensureGraph(): void {
    if (this.context) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      this.emit({ error: 'Web Audio is not supported in this browser; playing without analysis.' });
      return;
    }
    const context = new Ctor();
    const analyser = context.createAnalyser();
    analyser.fftSize = this.fftSize;
    analyser.smoothingTimeConstant = 0.78;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    const source = context.createMediaElementSource(this.element);
    source.connect(analyser);
    analyser.connect(context.destination);
    this.context = context;
    this.analyser = analyser;
    this.sourceNode = source;
    this.freqData = new Uint8Array(analyser.frequencyBinCount);
    this.timeData = new Uint8Array(analyser.fftSize);
  }

  private revokeUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private emit(patch: Partial<AudioSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l(this.snapshot);
  }

  private onPlay = () => this.emit({ status: 'playing', error: null });
  private onPause = () => {
    if (this.snapshot.status === 'playing') this.emit({ status: 'paused' });
  };
  private onTime = () => {
    const d = this.element.duration;
    this.emit({
      currentTime: this.element.currentTime || 0,
      duration: Number.isFinite(d) ? d : 0,
    });
  };
  private onLoaded = () => this.onTime();
  private onError = () => {
    if (this.snapshot.status === 'loading') return; // handled by loadFile
    this.emit({ status: 'error', error: decodeErrorMessage(this.element.error, this.snapshot.fileName ?? 'file') });
  };
}

function decodeErrorMessage(error: MediaError | null, name: string): string {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_DECODE:
      return `"${name}" couldn't be decoded. The file may be corrupt or use an unsupported codec.`;
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return `"${name}" isn't a format this browser can play. Try MP3, WAV, OGG or M4A.`;
    case MediaError.MEDIA_ERR_NETWORK:
      return `Reading "${name}" was interrupted.`;
    case MediaError.MEDIA_ERR_ABORTED:
      return `Loading "${name}" was cancelled.`;
    default:
      return `"${name}" couldn't be loaded.`;
  }
}
