# Telemetry design

## Flow
```
<audio> element events ─┐
PerformanceResourceTiming ─┼─► telemetry client (batches, 5 s or 20 events, sendBeacon on pagehide)
timed GET /api/ping ────┘            │  POST /api/v1/telemetry/events
                                     ▼
                              FastAPI ingest ──► stream_events (append) + streams (upsert) ─► PostgreSQL
FastAPI middleware ──────────────────────────────► request_metrics
CloudFront logs / VPC Flow Logs ─► S3 ─► ingest job ─► cdn_requests / flow_log_records
```
Client buffers in memory and retries with the same `event_id` (server dedupes). Telemetry failure must never affect playback.

## Listener events (browser → `stream_events`)
| event_type | Fired when | Key fields |
|---|---|---|
| `play` | user starts a track (new `stream_id`) | position 0 |
| `pause` / `resume` | user toggles | position |
| `skip` | user presses next / selects another track mid-play | position (→ `listened_seconds`) |
| `complete` | `ended` fired | position ≈ duration |
| `buffering_start` / `buffering_end` | `waiting` / `playing`-after-wait | duration derived |
| `error` | `<audio>` `error` event | error code in payload |

## Stream metrics (browser, once per stream)
- `time_to_first_audio_ms`: click → first `playing`.
- Resource Timing for the audio URL: `ttfb_ms`, `load_time_ms`, `transfer_size`. Range requests mean one file may produce several entries; we sum/choose the first and document it.
- `client_rtt_ms`: median of 3 timed `/ping` calls at session start and per stream.
- `cdn_cache_status`: from `X-Cache` (`Hit from cloudfront` / `Miss from cloudfront`), `na` locally.

These are **application metrics**. They are labelled "Client-observed" in the UI, separate from the "AWS network" panels.

## Server events
`request_metrics`: one row per API request (route template, status, duration). Sampled/excluded for `/healthz`.

## AWS sources (Phase 5)
- **VPC Flow Logs** (v2 default format + `flow-direction`, `pkt-srcaddr`, `pkt-dstaddr`), max aggregation interval 1 min, destination S3.
- **CloudFront standard logs** → S3 for cache result type, edge time-taken.
- **CloudWatch metrics** (ALB `TargetResponseTime`, `HTTPCode_Target_5XX_Count`, EC2 `NetworkOut`) for alarms and anomaly input.

## Simulation
`scripts/simulate.py --users N --sessions M [--seed S] [--degraded-fraction F]` writes through the same ingest code path as real traffic, tagged `data_source='simulated'`. Latency ~ log-normal per session "network profile" (fiber / cable / mobile / congested); probability of buffering rises with latency and low throughput; skip/abandon probability is **deliberately increased** with degraded profiles so the dashboard has a visible relationship. The script prints this assumption, and docs state that the correlation in simulated data is built in and proves only that the pipeline works.

## Analytics methodology notes
- Latency buckets: `<50`, `50–100`, `100–200`, `200+` ms (configurable); show n and 95% Wilson interval per bucket; hide buckets with n<30.
- Confounders to mention in UI: device, connection type, track length, time of day. Observational → "associated with", never "causes".
- Percentiles computed in SQL with `percentile_cont`.
