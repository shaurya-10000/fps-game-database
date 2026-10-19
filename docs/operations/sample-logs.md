# Sample Production Logs

The logger emits **one JSON object per line** via `console.log` / `console.warn` / `console.error`. This is a real line captured from a test run of `CanonicalResultService.acceptResult`:

```
{"timestamp":"2026-10-19T06:30:18.380Z","level":"info","msg":"Successfully committed canonical match result","matchId":"match_9d7b0ee3-39d3-4093-960d-57a89a05bbb3"}
```

A warning line from the same run (queue lag threshold crossed):

```
{"timestamp":"2026-10-19T06:30:19.112Z","level":"warn","msg":"ALERT: Queue age exceeds 60 seconds","oldestPendingAgeMs":61422,"pendingDepth":3,"deadLetterCount":0}
```

The logger strips `authorization` and `cookie` headers from any `req` object before serialization. This is enforced by `tests/integration/logger.test.ts` (asserts `output.req.headers.authorization` and `output.req.headers.cookie` are `undefined`).
