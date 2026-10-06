/** Save/load designs as JSON files, with validation on the way in. */

import { parseDesignJson, type ParseResult } from './schema';
import type { DesignState } from './types';

export const DESIGN_FILE_MAX_BYTES = 1_000_000;

export function designFileName(design: DesignState, ext: string): string {
  const slug = `${design.text.artist} ${design.text.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `afterhours-${slug || 'design'}-${design.preset}.${ext}`;
}

export function serializeDesign(design: DesignState): string {
  return JSON.stringify(design, null, 2);
}

export type SaveOutcome = 'saved' | 'declined';

/**
 * Some hosts (for example a claude.ai artifact viewer) block page-initiated
 * downloads and instead expose a save hook on `window.claude`. When that hook
 * answers, the file goes through it; otherwise we fall back to a plain
 * browser download. The app never depends on the hook being present.
 */
interface HostSaveHook {
  save(request: { filename: string; data: Blob }): Promise<unknown>;
}

async function hostSaveHook(): Promise<HostSaveHook | null> {
  const w = window as unknown as { claude?: { use?: (name: string) => Promise<unknown> } };
  const use = w.claude?.use;
  if (typeof use !== 'function') return null;
  try {
    const ns = (await use.call(w.claude, 'downloads')) as Partial<HostSaveHook> | null;
    return ns && typeof ns.save === 'function' ? (ns as HostSaveHook) : null;
  } catch {
    return null;
  }
}

function browserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Hand a file to the user. Resolves 'declined' when a host prompt was refused. */
export async function saveBlob(blob: Blob, filename: string): Promise<SaveOutcome> {
  const hook = await hostSaveHook();
  if (hook) {
    try {
      await hook.save({ filename, data: blob });
      return 'saved';
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === 'declined') return 'declined';
      throw new Error(`The host refused the save (${code ?? 'unknown error'}).`);
    }
  }
  browserDownload(blob, filename);
  return 'saved';
}

export function saveDesignJson(design: DesignState): Promise<SaveOutcome> {
  const blob = new Blob([serializeDesign(design)], { type: 'application/json' });
  return saveBlob(blob, designFileName(design, 'json'));
}

export async function readDesignFile(file: File): Promise<ParseResult> {
  if (file.size > DESIGN_FILE_MAX_BYTES) {
    return { ok: false, error: `"${file.name}" is too large to be a design file (over 1 MB).` };
  }
  const looksJson = file.type === 'application/json' || file.type === '' || /\.json$/i.test(file.name);
  if (!looksJson) {
    return { ok: false, error: `"${file.name}" doesn't look like a JSON design file.` };
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: `Couldn't read "${file.name}".` };
  }
  return parseDesignJson(text, DESIGN_FILE_MAX_BYTES);
}
