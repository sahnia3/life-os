-- Tasks & Assignments
CREATE TABLE tasks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT,
    status       TEXT NOT NULL DEFAULT 'todo'
                   CHECK (status IN ('todo','in_progress','done','archived')),
    priority     SMALLINT DEFAULT 3 CHECK (priority BETWEEN 1 AND 4),
    due_date     TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    board_column TEXT DEFAULT 'todo',
    sort_order   INTEGER DEFAULT 0,
    course       TEXT,
    tags         TEXT[] DEFAULT '{}',
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_user_due ON tasks(user_id, due_date) WHERE status != 'archived';
CREATE INDEX idx_tasks_tags ON tasks USING GIN(tags);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own tasks" ON tasks FOR ALL USING (auth.uid() = user_id);

CREATE TABLE subtasks (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    is_done    BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own subtasks" ON subtasks FOR ALL
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid()));
