import type { SseEvent, SseEventType } from "@alreadycovered/shared";
import type { ActivityRepository } from "../db/repositories/jobs.js";

type Subscriber = (event: SseEvent) => void;

/**
 * Per-user SSE fan-out. Every event is also durably appended to activity_log
 * (scoped by user_id) via ActivityRepository, so a client that missed events
 * while disconnected can recover by refetching rather than relying on SSE as
 * the database. Subscribers are keyed by userId so one tenant never sees
 * another tenant's activity.
 */
export class EventsHub {
  private readonly subscribersByUser = new Map<string, Set<Subscriber>>();

  constructor(private readonly activity: ActivityRepository) {}

  async publish(userId: string, type: SseEventType, payload: Record<string, unknown> = {}, jobId?: string, packetId?: string): Promise<void> {
    const seq = await this.activity.append(userId, type, payload, jobId, packetId);
    const event: SseEvent = { seq, type, jobId, packetId, timestamp: new Date().toISOString(), payload };
    for (const subscriber of this.subscribersByUser.get(userId) ?? []) subscriber(event);
  }

  subscribe(userId: string, handler: Subscriber): () => void {
    const set = this.subscribersByUser.get(userId) ?? new Set();
    set.add(handler);
    this.subscribersByUser.set(userId, set);
    return () => {
      set.delete(handler);
      if (set.size === 0) this.subscribersByUser.delete(userId);
    };
  }
}
