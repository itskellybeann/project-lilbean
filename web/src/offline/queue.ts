import { get, set } from "idb-keyval";
import { api } from "../api/client";

export interface QueuedMutation {
  id: string;
  method: "POST" | "DELETE";
  path: string;
  body?: unknown;
  // Local-only display data (never sent to the server) so a UI can reconstruct
  // a readable optimistic row purely from the queue, even after a fresh reload.
  meta?: Record<string, unknown>;
}

const KEY = "lilbean_offline_queue";

async function readQueue(): Promise<QueuedMutation[]> {
  return (await get<QueuedMutation[]>(KEY)) || [];
}

async function writeQueue(queue: QueuedMutation[]) {
  await set(KEY, queue);
}

// id lets a caller pre-generate a client-side id (e.g. so an optimistic UI
// row's id matches the id used for dedupe on the server, via clientId).
export async function enqueueMutation(mutation: Omit<QueuedMutation, "id"> & { id?: string }): Promise<string> {
  const id = mutation.id || crypto.randomUUID();
  const queue = await readQueue();
  queue.push({ ...mutation, id });
  await writeQueue(queue);
  return id;
}

export async function removeFromQueue(id: string) {
  const queue = await readQueue();
  await writeQueue(queue.filter((m) => m.id !== id));
}

export async function isQueued(id: string): Promise<boolean> {
  const queue = await readQueue();
  return queue.some((m) => m.id === id);
}

export async function queueForPath(pathPrefix: string): Promise<QueuedMutation[]> {
  const queue = await readQueue();
  return queue.filter((m) => m.path.startsWith(pathPrefix));
}

let flushing = false;

// Processes the queue in order, stopping at the first failure (still offline,
// or a real server error) so nothing gets skipped or reordered.
export async function flushQueue(onProgress?: () => void) {
  if (flushing) return;
  flushing = true;
  try {
    for (;;) {
      const queue = await readQueue();
      if (queue.length === 0) break;
      const next = queue[0];
      try {
        if (next.method === "POST") await api.post(next.path, next.body);
        else await api.del(next.path);
        await removeFromQueue(next.id);
        onProgress?.();
      } catch {
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

export const OFFLINE_SYNC_EVENT = "lilbean-offline-sync";

export function dispatchOfflineSyncEvent() {
  window.dispatchEvent(new Event(OFFLINE_SYNC_EVENT));
}

let autoFlushArmed = false;

export function setupAutoFlush(onProgress?: () => void) {
  if (autoFlushArmed) return;
  autoFlushArmed = true;
  window.addEventListener("online", () => flushQueue(onProgress));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") flushQueue(onProgress);
  });
  flushQueue(onProgress);
}
