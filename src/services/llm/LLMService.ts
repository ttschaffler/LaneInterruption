import type { Container, Event, EventType, Lane, Severity } from '@/types';

/**
 * The LLM is used for two things only (§6):
 *   (a) event classification + duration estimation, and
 *   (b) alternative-solution suggestion.
 * Both sit behind this interface so a real provider (e.g. Claude) drops in
 * without touching the engines or UI. v1 ships a deterministic mock.
 */

export interface RawBulletin {
  source: string;
  text: string;
  publishedAt: string;
}

export interface EventClassification {
  type: EventType;
  affectedGeographies: string[];
  affectedPortCodes: string[];
  severity: Severity;
  estimatedDurationDays: number;
  confidence: number;
}

export interface SuggestedAlternative {
  title: string;
  description: string;
  rationale: string;
  /** Rough LT change in days (negative = faster). */
  leadTimeDeltaDays: number;
  /** Rough cost change in currency. */
  costDelta: number;
  fromGeneralMarket: boolean;
}

export interface LLMService {
  /** (a) Classify a raw bulletin into a structured event signal. */
  classifyEvent(bulletin: RawBulletin): Promise<EventClassification>;
  /** (b) Suggest free-form corrective actions for an event/lane/container set. */
  suggestAlternatives(input: {
    event: Event;
    lane: Lane;
    containers: Container[];
  }): Promise<SuggestedAlternative[]>;
}
