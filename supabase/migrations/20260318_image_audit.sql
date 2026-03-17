-- Image audit table for tracking cover image quality scores
CREATE TABLE IF NOT EXISTS image_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES generated_articles(id),
  image_url TEXT NOT NULL,
  scores JSONB NOT NULL,
  composite_score NUMERIC(4,2) NOT NULL,
  explanation TEXT,
  audit_batch TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_image_audit_article ON image_audit(article_id);
CREATE INDEX idx_image_audit_score ON image_audit(composite_score);
CREATE INDEX idx_image_audit_batch ON image_audit(audit_batch);
