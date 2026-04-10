-- Calendar & Events
CREATE TABLE events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT,
    start_time   TIMESTAMPTZ NOT NULL,
    end_time     TIMESTAMPTZ,
    is_all_day   BOOLEAN DEFAULT FALSE,
    location     TEXT,
    color        TEXT DEFAULT '#3B82F6',
    recurrence   JSONB,
    external_id  TEXT,
    source       TEXT DEFAULT 'manual' CHECK (source IN ('manual','google','task')),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_user_time ON events(user_id, start_time);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own events" ON events FOR ALL USING (auth.uid() = user_id);
