CREATE TABLE IF NOT EXISTS jobs (
 id SERIAL PRIMARY KEY, source_url TEXT NOT NULL, offer_id TEXT NOT NULL,
 mode TEXT NOT NULL DEFAULT 'publish', status TEXT NOT NULL DEFAULT 'queued',
 stage TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '', pdd_title TEXT NOT NULL DEFAULT '',
 verdict TEXT NOT NULL DEFAULT '', reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
 product JSONB, pricing JSONB, logs JSONB NOT NULL DEFAULT '[]'::jsonb,
 pdd_goods_id TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '', attempts INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_status_id_idx ON jobs(status,id);
CREATE INDEX IF NOT EXISTS jobs_offer_id_idx ON jobs(offer_id);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
