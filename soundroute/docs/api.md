# API (FastAPI, prefix `/api/v1`)

OpenAPI docs auto-served at `/docs`. All analytics endpoints accept `?source=real|simulated|all` (default `all`), `?from=&to=` and return counts alongside rates so the UI can show sample sizes.

## Catalogue
| Method | Path | Notes |
|---|---|---|
| GET | `/healthz` | liveness (ALB health check; no DB) |
| GET | `/readyz` | readiness (checks DB) |
| GET | `/ping` | tiny response; used by browser to measure `client_rtt_ms` |
| GET | `/tracks` | `?q=&artist_id=&limit=&offset=` |
| GET | `/tracks/{id}` | metadata incl. `audio_url`, `artwork_url` |
| GET | `/artists` · `/artists/{id}` | artist with tracks |
| GET | `/discover` | featured/new/most-played shelves for Home |

## Sessions & telemetry
| Method | Path | Notes |
|---|---|---|
| POST | `/sessions` | `{username}` → creates/gets user + session, returns `session_id` |
| POST | `/sessions/{id}/end` | sets `ended_at` (also accepted via `sendBeacon`) |
| POST | `/telemetry/events` | **batch** of ≤50 events; idempotent on `event_id`; returns accepted/duplicate counts |
| POST | `/telemetry/stream-metrics` | browser timing summary per stream (Resource Timing, cache status) |

## Analytics (read-only)
| Path | Returns |
|---|---|
| `/analytics/overview` | total streams, unique listeners, avg listen duration, completion & skip rate |
| `/analytics/top-tracks` · `/top-artists` | `?limit=` |
| `/analytics/network/summary` | avg / p50 / p95 / p99 request latency, bytes, failed requests |
| `/analytics/network/timeseries` | latency & request volume per time bucket |
| `/analytics/network/flows` | accepted/rejected, bytes by protocol/port (AWS data only) |
| `/analytics/network/cache` | cache hit ratio (AWS data only; `available:false` locally) |
| `/analytics/engagement/by-latency` | latency bucket → n, completion rate, skip rate |
| `/analytics/engagement/by-load-time` | load-time bucket → completion rate |
| `/analytics/engagement/buffering` | buffering count → abandonment rate |
| `/analytics/engagement/session-quality` | RTT quality tier → mean session duration |
| `/analytics/topology` | nodes/edges for the architecture diagram + observed flow volumes/rejects |
| `/analytics/anomalies` | detected anomalies |

## Internal / ingestion (not public routes)
Flow-log & CloudFront-log ingestion run as CLI jobs (`python -m analytics.ingest ...`), not HTTP endpoints, so the API surface has no write path into AWS data.

## Conventions
Pydantic v2 request/response models; errors as `{ "detail": ..., "code": ... }`; 422 for validation; telemetry never returns 5xx for a duplicate; bodies >64 KB rejected.
