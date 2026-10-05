import { PRESET_LIST } from '../design/presets';
import type { PresetId } from '../design/types';

export function PresetPicker({ value, onChange }: { value: PresetId; onChange(preset: PresetId): void }) {
  return (
    <div className="presets" role="radiogroup" aria-label="Visual preset">
      {PRESET_LIST.map((p) => {
        const id = `preset-${p.id}`;
        const checked = p.id === value;
        return (
          <div className={`preset${checked ? ' is-checked' : ''}`} key={p.id}>
            <input
              className="preset__input"
              type="radio"
              name="preset"
              id={id}
              value={p.id}
              checked={checked}
              onChange={() => onChange(p.id)}
            />
            <label className="preset__label" htmlFor={id}>
              <span className="preset__name">{p.name}</span>
              <span className="preset__tagline">{p.tagline}</span>
            </label>
          </div>
        );
      })}
    </div>
  );
}
