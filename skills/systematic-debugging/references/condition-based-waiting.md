# Condition-Based Waiting

Arbitrary sleeps guess when an asynchronous effect will finish. Poll or subscribe to
the actual observable condition with a bounded timeout and diagnostic failure.

```js
async function waitFor(read, describe, timeoutMs = 5000) {
  const started = Date.now();
  while (true) {
    const value = await read();
    if (value) return value;
    if (Date.now() - started >= timeoutMs) {
      throw new Error(`Timed out waiting for ${describe} after ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
```

Read fresh state inside the loop, use a reasonable polling interval, and always bound
the wait. Prefer event/subscription APIs when available. A fixed delay is appropriate
only when elapsed time is itself the contract (for example debounce behavior); first
wait for the triggering state and document why the exact duration matters.

For intermittent diagnosis, log attempts, elapsed time, seed/order, and the final
observed state. Raising a timeout without evidence merely makes failures slower.
