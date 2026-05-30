-- Content-aware monitoring for status.aiassessor.ca
-- Applied to project ctxcznwnjliuywwucamr on 2026-05-30.
-- Adds an optional expected-substring check so a monitor can verify the
-- response BODY (not just the HTTP status). Needed because an SPA host returns
-- 200 + index.html for a missing static file (e.g. a model.json artifact),
-- which a status-code-only probe would read as "up".

alter table public.status_monitors
  add column if not exists expect_contains text;
