# SoundRoute — Plan & checklist

## Phase 1 — Architecture & repo ✅ (this commit)
- [x] Inspect repo (contains unrelated Chrome extension → project lives in `soundroute/`)
- [x] Architecture, schema, API, telemetry docs
- [x] Skeleton, `.gitignore`, `.env.example`
- [ ] **You approve / adjust the open questions below**

## Phase 2 — Local MVP
Build order (each step is runnable/testable before the next):
- [ ] 2.1 `docker-compose.yml` with `db`; backend skeleton + `/healthz`; pytest wired to a test DB
- [ ] 2.2 SQLAlchemy models + Alembic initial migration (content + telemetry tables)
- [ ] 2.3 Seed: artists/tracks; `generate_demo_audio.py` (original synthesised tones + SVG artwork)
- [ ] 2.4 Catalogue endpoints + tests
- [ ] 2.5 Session + telemetry ingest (idempotent, `streams` upsert) + tests
- [ ] 2.6 Frontend scaffold (Vite/React/TS/Tailwind), design tokens, layout, routing
- [ ] 2.7 Discover + Browse pages
- [ ] 2.8 Audio player (context + persistent bar) with Vitest tests for the state machine
- [ ] 2.9 Telemetry client (batching, beacon, Resource Timing, RTT ping)
- [ ] 2.10 `docker compose up` end-to-end check

## Phase 3 — Analytics
- [ ] `request_metrics` middleware
- [ ] SQL analytics queries + tests with fixture data
- [ ] `scripts/simulate.py` (+ tests for determinism with `--seed`)
- [ ] Listener dashboard, Network dashboard, Network→Engagement page (Recharts)
- [ ] Real/simulated toggle & badges

## Phase 4 — AWS (Terraform; `plan` only until you confirm)
- [ ] network module (VPC, 3×2 subnets, IGW, NAT toggle, routes)
- [ ] security groups (CF→ALB→App→DB chain)
- [ ] storage_cdn (S3 web+audio, OAC, CloudFront, headers policy)
- [ ] database (RDS, subnet group, secrets)
- [ ] compute (launch template, ASG, ALB, IAM, SSM)
- [ ] observability basics (CloudWatch alarms, budget alarm)
- [ ] `docs/aws-deploy.md`: cost table, deploy, **teardown**

## Phase 5 — Network observability
- [ ] Flow Logs → S3, parser + ingest job (tested on sample records)
- [ ] CloudFront log ingest, cache hit ratio
- [ ] Topology page (nodes/edges, ports, volume, rejects)
- [ ] `analytics/` detectors (rolling mean, z-score, thresholds) behind `Detector` protocol + tests
- [ ] Anomalies UI

## Phase 6 — Polish
- [ ] README (all requested sections), diagrams, screenshots, demo script, resume blurb
- [ ] CI (GitHub Actions: ruff, pytest, eslint, vitest, `terraform validate`)

## Open questions (defaults in bold; reply only if you disagree)
1. Project location: **`soundroute/` subfolder** (leave the Chrome extension untouched) vs. repo root.
2. API via CloudFront `/api/*` (**yes**, see architecture §2) vs. directly to ALB.
3. NAT gateway: **include behind `enable_nat` flag (default true for realism, documented cost)** vs. EC2 in public subnets.
4. Flow Logs destination: **S3** (cheap, batch) vs. CloudWatch Logs.
5. Python **3.12**, Postgres **16**, Node **22**, React **18**, Tailwind **3**? (versions to confirm at scaffold time).
6. Visual identity: working palette **deep ink-navy background, electric-coral accent, mint for "good", amber for "warning"**; name/logo "SoundRoute" with a routing-wave glyph.
