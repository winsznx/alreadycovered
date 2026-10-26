import { useEffect, useRef } from "react";
import { api } from "./api";

export type ActivityEvent = {
  seq: number;
  type: string;
  jobId?: string;
  packetId?: string;
  timestamp: string;
  payload?: Record<string, unknown>;
};

/** Subscribes to the server's per-user SSE activity stream. Reconnects automatically on drop. */
export function useActivityEvents(onEvent: (event: ActivityEvent) => void): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let source: EventSource | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      source = new EventSource(api.eventsUrl(), { withCredentials: true });
      source.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data) as ActivityEvent;
          handlerRef.current(parsed);
        } catch {
          // ignore malformed heartbeat/comment lines
        }
      };
      source.onerror = () => {
        source?.close();
        if (!cancelled) setTimeout(connect, 2000);
      };
    }

    connect();
    return () => {
      cancelled = true;
      source?.close();
    };
  }, []);
}
