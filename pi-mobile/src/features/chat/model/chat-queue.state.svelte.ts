import type { QueueState, WireEvent } from "@pi-mobile/protocol";

type QueueBySession = Record<string, QueueState | undefined>;

let queues = $state<QueueBySession>({});

function queueSnapshot(queue: QueueState = { steering: [], followUp: [] }): QueueState {
  return {
    steering: [...queue.steering],
    followUp: [...queue.followUp],
  };
}

function fromWireQueue(event: Extract<WireEvent, { t: "queue" }>): QueueState {
  const steering: string[] = [];
  const followUp: string[] = [];

  for (const message of event.queued) {
    if (message.queueKind === "follow_up") followUp.push(message.text);
    else steering.push(message.text);
  }

  return { steering, followUp };
}

export const chatQueueState = {
  get(sessionId: string): QueueState {
    return queues[sessionId] ?? queueSnapshot();
  },

  count(sessionId: string): number {
    const queue = queues[sessionId];
    return (queue?.steering.length ?? 0) + (queue?.followUp.length ?? 0);
  },

  set(sessionId: string, queue: QueueState): void {
    queues = { ...queues, [sessionId]: queueSnapshot(queue) };
  },

  clear(sessionId: string): void {
    queues = { ...queues, [sessionId]: queueSnapshot() };
  },

  applyWireEvent(sessionId: string, event: WireEvent): void {
    if (event.t !== "queue") return;
    queues = { ...queues, [sessionId]: fromWireQueue(event) };
  },
};
