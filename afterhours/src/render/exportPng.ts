/** Render the artwork at print size into a PNG blob — no editor chrome. */

import type { DesignState } from '../design/types';
import { renderArtwork } from './renderer';
import type { FrameInput } from './types';

export const EXPORT_SIZE = 2048;

export async function renderPngBlob(design: DesignState, frame: FrameInput, size = EXPORT_SIZE): Promise<Blob> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Fonts are a nicety; fall back to system faces.
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a drawing context for export.');
  renderArtwork(ctx, size, design, frame);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG encoding failed.'));
    }, 'image/png');
  });
}
