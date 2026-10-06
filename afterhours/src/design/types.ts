/**
 * The design document.
 *
 * This is the single source of truth for what the artwork looks like. It is a
 * plain, JSON-serialisable object so it can be saved to disk, restored from
 * localStorage, and — later — synchronised between collaborators.
 *
 * Shared-editing notes:
 *  - `id` identifies the document; `revision` increases on every change, which
 *    gives a total order for last-writer-wins or an anchor for OT/CRDT patches.
 *  - All edits go through `DesignAction`s (see reducer.ts). Actions are plain
 *    JSON too, so a future sync layer can broadcast actions instead of whole
 *    documents.
 */

export const DESIGN_SCHEMA = 'afterhours.design' as const;
export const DESIGN_VERSION = 1 as const;

export type PresetId = 'chrome' | 'current' | 'signal' | 'tesseract';
export const PRESET_IDS: readonly PresetId[] = ['chrome', 'current', 'signal', 'tesseract'];

/** Normalised point in artwork space: (0,0) top-left, (1,1) bottom-right. */
export interface Vec2 {
  x: number;
  y: number;
}

export interface DesignText {
  artist: string;
  title: string;
}

export interface DesignColors {
  /** Base colour of the artwork. */
  background: string;
  /** Highlight colour used by shapes and typography. */
  accent: string;
}

/** All three are 0..1 and are interpreted per preset. */
export interface DesignMotion {
  /** How fast the scene's internal clock advances. */
  speed: number;
  /** Visual density / amplitude of the procedural forms. */
  intensity: number;
  /** Strength of the grain overlay. */
  texture: number;
}

export interface DesignLayout {
  /** Anchor of the title block. */
  titlePosition: Vec2;
}

export interface DesignState {
  schema: typeof DESIGN_SCHEMA;
  version: typeof DESIGN_VERSION;
  id: string;
  revision: number;
  updatedAt: string;
  preset: PresetId;
  text: DesignText;
  colors: DesignColors;
  motion: DesignMotion;
  layout: DesignLayout;
  /** Integer seed that drives every procedural choice for the current preset. */
  seed: number;
}

export const TEXT_MAX_LENGTH = 80;
