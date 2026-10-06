import type { FocusWindow, Meeting, ShieldFlag, Task, Trip, User } from '../domain/types';

export interface RescheduleDraftInput {
  meeting: Meeting;
  flag: ShieldFlag;
  trip: Trip;
  user: User;
}

export interface TaskSuggestion {
  taskId: string;
  reason: string;
}

/** Anything that can write for the user. Template today, Bedrock Claude in phase 4. */
export interface AiProvider {
  draftRescheduleMessage(input: RescheduleDraftInput): Promise<string>;
  suggestTasks(window: FocusWindow, candidates: Task[]): Promise<TaskSuggestion[]>;
}
