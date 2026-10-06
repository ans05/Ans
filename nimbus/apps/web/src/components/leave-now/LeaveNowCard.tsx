'use client';

import { formatDuration, formatTime, leaveNowState, zoneAbbreviation, type FlightSegment } from '@nimbus/core';
import { useSnapshot } from '@/hooks/useSnapshot';
import { selectLeaveNowPlan, selectTravelMinutes } from '@/lib/selectors';
import { useNimbus } from '@/lib/state/NimbusProvider';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Stepper } from '@/components/ui/Stepper';

export function LeaveNowCard({ flight }: { flight: FlightSegment }) {
  const snap = useSnapshot();
  const { actions } = useNimbus();
  const plan = selectLeaveNowPlan(snap, flight);
  const travelMinutes = selectTravelMinutes(snap, flight);
  const { status, minutesUntilLeave } = leaveNowState(plan, snap.now);
  const zone = plan.timeZone;
  const airport = flight.from.code ?? flight.from.name;

  const statusChip =
    status === 'now' ? (
      <Chip tone="warn">Leave now</Chip>
    ) : status === 'soon' ? (
      <Chip tone="warn">In {formatDuration(minutesUntilLeave)}</Chip>
    ) : (
      <Chip>In {formatDuration(minutesUntilLeave)}</Chip>
    );

  return (
    <Card className="animate-fade-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-meta font-medium uppercase tracking-[0.08em]">Leave for {airport}</p>
          <p className="mt-1 text-[34px] leading-none font-semibold tracking-[-0.02em] md:text-[40px]">{formatTime(plan.leaveBy, zone)}</p>
          <p className="mt-2 text-sm text-ink-2">
            {flight.carrier} {flight.flightNumber} to {flight.to.name.replace(' Heathrow', '')} departs {formatTime(plan.departure, zone)}{' '}
            {zoneAbbreviation(plan.departure, zone)}
          </p>
        </div>
        {statusChip}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Chip tone="outline">{formatDuration(plan.travelMinutes)} to the airport</Chip>
        <Chip tone="outline">{formatDuration(plan.airportMinutes)} at the airport</Chip>
        <Chip tone="outline">{formatDuration(plan.bufferMinutes)} buffer</Chip>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <Stepper
          label="Travel time to the airport"
          value={travelMinutes}
          min={5}
          max={240}
          step={5}
          format={formatDuration}
          onChange={(minutes) => actions.setTravelMinutes(flight.id, minutes)}
        />
      </div>
    </Card>
  );
}
