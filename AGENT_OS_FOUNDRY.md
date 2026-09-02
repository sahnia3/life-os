# Agent OS / FOUNDRY

The FOUNDRY design (build-node graph, worktree orchestration, review/repair
cycles) has moved out of this repo and now lives in its own sibling repo:

    ~/Desktop/Claudecode/foundry/

This repo (`life-os`) is a consumer of FOUNDRY, not where it's designed or
implemented. Look in the `foundry` repo for anything related to how build
nodes are scheduled, reviewed, or repaired.

## life-os scripts FOUNDRY reuses

- `scripts/install-agent-os-hooks.mjs` — installs the git hooks FOUNDRY relies
  on when operating against this repo's worktrees.
- `scripts/pty-bridge.mjs` — the PTY bridge FOUNDRY uses to drive interactive
  commands inside a build-node session.

Everything else under `scripts/` is specific to life-os itself and is not
referenced by FOUNDRY.
