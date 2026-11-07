// Fire-and-forget work (emails, audit writes) that runs after a response.
// Tracked so graceful shutdown — and the test suite between tests — can wait
// for it to finish instead of cutting it off mid-query.
const pending = new Set<Promise<unknown>>();

export function track<T>(task: Promise<T>): Promise<T> {
  const tracked = task.finally(() => pending.delete(tracked));
  pending.add(tracked);
  return tracked;
}

export async function settleBackgroundTasks(): Promise<void> {
  while (pending.size > 0) {
    await Promise.allSettled([...pending]);
  }
}
