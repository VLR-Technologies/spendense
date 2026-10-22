/** Bound unavailable-service waits, retaining caller cancellation and SDK errors. */
export async function supabaseFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const controller = new AbortController();
  const signal =
    init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 8000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
