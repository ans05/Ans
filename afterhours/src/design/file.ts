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

export function downloadBlob(blob: Blob, filename: string): void {
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

export function downloadDesignJson(design: DesignState): void {
  const blob = new Blob([serializeDesign(design)], { type: 'application/json' });
  downloadBlob(blob, designFileName(design, 'json'));
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
