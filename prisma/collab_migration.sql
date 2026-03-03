ALTER TABLE notebooks ADD COLUMN IF NOT EXISTS is_collaborative BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE notebooks ADD COLUMN IF NOT EXISTS share_token VARCHAR(100) UNIQUE;
ALTER TABLE notebooks ADD COLUMN IF NOT EXISTS original_id UUID;
CREATE INDEX IF NOT EXISTS idx_notebooks_share_token ON notebooks (share_token);

CREATE TABLE IF NOT EXISTS notebook_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(notebook_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_notebook_collaborators_notebook_id ON notebook_collaborators (notebook_id);
CREATE INDEX IF NOT EXISTS idx_notebook_collaborators_user_id ON notebook_collaborators (user_id);
