# Root-Cause Tracing

Use this technique when the observed error is downstream from the corrupt input or
state.

1. Record the exact symptom and the operation that directly emits it.
2. Inspect the complete stack and the values at that operation.
3. Identify the caller and the exact argument/state it supplied.
4. Repeat upward through the call/data chain: where was that value created,
   defaulted, parsed, mutated, or read?
5. Stop at the earliest controllable event whose correction prevents the downstream
   chain without special-casing the symptom.
6. Prove causality by changing or instrumenting only that source and rerunning the
   same reproduction.

Example causal chain:

```text
writeFile uses repositoryPath=""
<- workspace initializer receives empty project path
<- session constructor reads fixture before setup hook
<- fixture exposes an unset value at module initialization (root source)
```

Instrument immediately before a dangerous operation, including safe identifiers,
current working state, and a stack. In tests, use a channel the runner will display.
Do not log secrets. Remove probes after the cause is proven.

A downstream guard may still be valuable, but it is defense in depth. It must not be
misreported as the root fix.
