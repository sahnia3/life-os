-- Fitness & Habits

CREATE TABLE weight_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weight_kg  NUMERIC(5,2) NOT NULL,
    logged_at  DATE NOT NULL DEFAULT CURRENT_DATE,
    notes      TEXT,
    UNIQUE(user_id, logged_at)
);

ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own weight logs" ON weight_logs FOR ALL USING (auth.uid() = user_id);

CREATE TABLE workout_templates (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    exercises  JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own templates" ON workout_templates FOR ALL USING (auth.uid() = user_id);

CREATE TABLE workouts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id  UUID REFERENCES workout_templates(id),
    name         TEXT NOT NULL,
    duration_min INTEGER,
    notes        TEXT,
    logged_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own workouts" ON workouts FOR ALL USING (auth.uid() = user_id);

CREATE TABLE workout_sets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id   UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise     TEXT NOT NULL,
    set_number   SMALLINT NOT NULL,
    reps         INTEGER,
    weight_kg    NUMERIC(5,2),
    duration_sec INTEGER,
    sort_order   INTEGER DEFAULT 0
);

ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own workout sets" ON workout_sets FOR ALL
  USING (EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_sets.workout_id AND workouts.user_id = auth.uid()));

CREATE TABLE habits (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    icon        TEXT DEFAULT 'flame',
    color       TEXT DEFAULT '#4F46E5',
    frequency   TEXT DEFAULT 'daily' CHECK (frequency IN ('daily','weekdays','weekly','custom')),
    target_days SMALLINT DEFAULT 7,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own habits" ON habits FOR ALL USING (auth.uid() = user_id);

CREATE TABLE habit_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    habit_id   UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    logged_at  DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE(habit_id, logged_at)
);

CREATE INDEX idx_habit_logs_user_date ON habit_logs(user_id, logged_at);

ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own habit logs" ON habit_logs FOR ALL USING (auth.uid() = user_id);
