-- Ideas & Notes
CREATE TABLE notes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    body       TEXT,
    tags       TEXT[] DEFAULT '{}',
    color      TEXT DEFAULT 'default',
    is_pinned  BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_tags ON notes USING GIN(tags);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own notes" ON notes FOR ALL USING (auth.uid() = user_id);
