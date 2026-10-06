import { describe, expect, it } from 'vitest';
import { SAMPLE_WEEK, leaveNowState, planLeaveNow } from '../src';

const ba285 = SAMPLE_WEEK.segments.find((s) => s.id === 'ba285');
if (!ba285 || ba285.kind !== 'flight') throw new Error('fixture missing');

describe('planLeaveNow', () => {
  it('subtracts travel, airport time and buffer from departure', () => {
    const plan = planLeaveNow({ flight: ba285, travelMinutes: 50 });
    // 7:05 PM − 50 min − 2 h − 15 min = 4:00 PM PDT
    expect(plan.leaveBy).toBe('2026-10-13T23:00:00Z');
    expect(plan.totalMinutes).toBe(185);
  });

  it('reports how urgent leaving is', () => {
    const plan = planLeaveNow({ flight: ba285, travelMinutes: 50 });
    expect(leaveNowState(plan, '2026-10-13T20:10:00Z').status).toBe('later');
    expect(leaveNowState(plan, '2026-10-13T22:45:00Z').status).toBe('soon');
    expect(leaveNowState(plan, '2026-10-13T23:05:00Z').status).toBe('now');
    expect(leaveNowState(plan, '2026-10-14T03:00:00Z').status).toBe('departed');
  });
});
