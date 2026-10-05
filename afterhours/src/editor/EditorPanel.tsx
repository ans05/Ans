import { useRef, type ChangeEvent } from 'react';
import type { AudioController } from '../audio/useAudioEngine';
import type { DesignAction } from '../design/reducer';
import type { DesignState } from '../design/types';
import { TEXT_MAX_LENGTH } from '../design/types';
import { AudioSection } from './AudioSection';
import { Button, ColorField, Section, Slider, TextField, Toggle } from './controls';
import { PresetPicker } from './PresetPicker';

export interface EditorPanelProps {
  design: DesignState;
  dispatch(action: DesignAction): void;
  animating: boolean;
  onToggleAnimating(): void;
  reduceMotion: boolean;
  reduceMotionIsSystem: boolean;
  onSetReduceMotion(value: boolean): void;
  audio: AudioController;
  exporting: boolean;
  onExportPng(): void;
  onSaveJson(): void;
  onLoadJson(file: File): void;
  onReset(): void;
}

export function EditorPanel(p: EditorPanelProps) {
  const { design, dispatch } = p;
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const onPickJson = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) p.onLoadJson(file);
  };

  return (
    <div className="editor">
      <Section index="01" title="Preset" aside={<span className="section__meta">text is kept</span>}>
        <PresetPicker value={design.preset} onChange={(preset) => dispatch({ type: 'set-preset', preset })} />
        <div className="button-row">
          <Button type="button" variant="primary" onClick={() => dispatch({ type: 'randomize' })}>
            Randomize
          </Button>
          <Button type="button" variant="ghost" onClick={p.onReset}>
            Reset preset
          </Button>
        </div>
      </Section>

      <Section index="02" title="Words">
        <TextField
          id="artist"
          label="Artist"
          value={design.text.artist}
          maxLength={TEXT_MAX_LENGTH}
          placeholder="Artist name"
          onChange={(value) => dispatch({ type: 'set-text', field: 'artist', value })}
        />
        <TextField
          id="title"
          label="Album title"
          value={design.text.title}
          maxLength={TEXT_MAX_LENGTH}
          placeholder="Album title"
          onChange={(value) => dispatch({ type: 'set-text', field: 'title', value })}
        />
        <p className="field__hint">Drag the title on the artwork, or focus the artwork and use the arrow keys.</p>
      </Section>

      <Section index="03" title="Colour">
        <div className="grid-2">
          <ColorField
            id="color-bg"
            label="Background"
            value={design.colors.background}
            onChange={(value) => dispatch({ type: 'set-color', field: 'background', value })}
          />
          <ColorField
            id="color-accent"
            label="Accent"
            value={design.colors.accent}
            onChange={(value) => dispatch({ type: 'set-color', field: 'accent', value })}
          />
        </div>
      </Section>

      <Section index="04" title="Motion">
        <Slider
          id="speed"
          label="Speed"
          value={design.motion.speed}
          onChange={(value) => dispatch({ type: 'set-motion', field: 'speed', value })}
        />
        <Slider
          id="intensity"
          label="Intensity"
          value={design.motion.intensity}
          onChange={(value) => dispatch({ type: 'set-motion', field: 'intensity', value })}
        />
        <Slider
          id="texture"
          label="Texture"
          value={design.motion.texture}
          onChange={(value) => dispatch({ type: 'set-motion', field: 'texture', value })}
        />
        <div className="button-row">
          <Button type="button" onClick={p.onToggleAnimating} aria-pressed={p.animating}>
            {p.animating ? 'Pause animation' : 'Play animation'}
          </Button>
        </div>
        <Toggle
          id="reduce-motion"
          label="Reduce motion"
          checked={p.reduceMotion}
          onChange={p.onSetReduceMotion}
          note={p.reduceMotionIsSystem ? '(following your system setting)' : undefined}
        />
      </Section>

      <Section index="05" title="Audio">
        <AudioSection audio={p.audio} />
      </Section>

      <Section index="06" title="Export & files">
        <div className="button-row">
          <Button type="button" variant="primary" onClick={p.onExportPng} disabled={p.exporting}>
            {p.exporting ? 'Rendering…' : 'Export PNG'}
          </Button>
          <Button type="button" onClick={p.onSaveJson}>
            Save design
          </Button>
          <label className="btn btn--default file-button" htmlFor="design-file">
            Load design
            <input
              ref={jsonInputRef}
              id="design-file"
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={onPickJson}
            />
          </label>
        </div>
        <p className="field__hint">
          PNG exports at 2048 × 2048 with no editor controls. Designs save as JSON you can reload or share.
        </p>
      </Section>
    </div>
  );
}
