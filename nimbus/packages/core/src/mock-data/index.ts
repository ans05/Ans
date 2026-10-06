import { Phase1FixturesSchema, WeekDataSchema } from '../domain/schema';
import type { IsoInstant } from '../domain/types';
import fixturesJson from './fixtures.phase1.json';
import sampleWeekJson from './sample-week.json';

/**
 * The demo dataset: one week, one trip (San Francisco → London → San Francisco),
 * two flights, a dozen meetings and nine tasks. Validated on load so a typo in
 * the JSON fails fast instead of rendering something odd.
 */
export const SAMPLE_WEEK = WeekDataSchema.parse(sampleWeekJson);

/** Hand-authored algorithm results. Phase 2 computes these and deletes the file. */
export const PHASE1_FIXTURES = Phase1FixturesSchema.parse(fixturesJson);

export interface DemoMoment {
  id: string;
  label: string;
  at: IsoInstant;
}

/** Instants inside the sample week that make each feature light up. */
export const DEMO_MOMENTS: readonly DemoMoment[] = [
  { id: 'evening-before', label: 'Evening before', at: '2026-10-13T03:30:00Z' },
  { id: 'travel-day', label: 'Travel day', at: '2026-10-13T20:10:00Z' },
  { id: 'leaving-soon', label: 'Leaving soon', at: '2026-10-13T22:45:00Z' },
  { id: 'at-the-gate', label: 'At the gate', at: '2026-10-14T00:40:00Z' },
  { id: 'in-london', label: 'In London', at: '2026-10-14T16:00:00Z' },
];

export const DEFAULT_DEMO_MOMENT_ID = 'travel-day';
