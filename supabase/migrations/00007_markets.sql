-- Trading Bot: Trades, Analyses, Portfolio Snapshots
CREATE TABLE trades (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    market_id       TEXT NOT NULL,
    market_question TEXT NOT NULL,
    token_id        TEXT NOT NULL,
    side            TEXT NOT NULL CHECK (side IN ('BUY','SELL')),
    amount          NUMERIC(12,2) NOT NULL,
    price           NUMERIC(6,4) NOT NULL,
    estimated_prob  NUMERIC(6,4),
    edge            NUMERIC(6,4),
    kelly_pct       NUMERIC(6,4),
    status          TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','filled','cancelled','dry_run')),
    pnl             NUMERIC(12,2),
    exit_price      NUMERIC(6,4),
    exited_at       TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trades_user ON trades(user_id, created_at DESC);
CREATE INDEX idx_trades_market ON trades(user_id, market_id);
CREATE INDEX idx_trades_status ON trades(user_id, status) WHERE status IN ('pending','filled');

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own trades" ON trades FOR ALL USING (auth.uid() = user_id);

CREATE TABLE trade_analyses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    market_id       TEXT NOT NULL,
    market_question TEXT NOT NULL,
    market_price    NUMERIC(6,4) NOT NULL,
    estimated_prob  NUMERIC(6,4) NOT NULL,
    edge            NUMERIC(6,4) NOT NULL,
    confidence      TEXT NOT NULL CHECK (confidence IN ('low','medium','high')),
    reasoning       TEXT,
    action_taken    TEXT CHECK (action_taken IN ('trade','skip','no_edge')),
    trade_id        UUID REFERENCES trades(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analyses_user ON trade_analyses(user_id, created_at DESC);

ALTER TABLE trade_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own analyses" ON trade_analyses FOR ALL USING (auth.uid() = user_id);

CREATE TABLE portfolio_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_value     NUMERIC(12,2) NOT NULL,
    cash            NUMERIC(12,2) NOT NULL,
    invested        NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_pnl       NUMERIC(12,2) NOT NULL DEFAULT 0,
    daily_pnl       NUMERIC(12,2) NOT NULL DEFAULT 0,
    open_positions  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshots_user ON portfolio_snapshots(user_id, created_at DESC);

ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own snapshots" ON portfolio_snapshots FOR ALL USING (auth.uid() = user_id);
