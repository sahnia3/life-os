#!/usr/bin/env node
/**
 * Agent OS — opt-in hook installer.
 *
 * Wires Claude Code lifecycle events to the local dashboard so the
 * "Who needs me?" queue, live status, push notifications, and file-collision
 * detection become PUSH-based (authoritative) instead of JSONL-polled.
 *
 * SAFETY:
 *  - Timestamped backup of ~/.claude/settings.json before any write.
 *  - Only APPENDS our hook entries; never removes/replaces existing hooks.
 *  - Idempotent: re-running won't duplicate.
 *  - JSON validated before write; abort on any parse error.
 *  - The emitter is non-blocking + always exits 0, so a down dashboard
 *    can never delay or break a Claude session.
 *
 * Run:  node scripts/install-agent-os-hooks.mjs
 * Undo: node scripts/install-agent-os-hooks.mjs --uninstall
 */
import fs from "fs";
import os from "os";
import path from "path";

const SETTINGS = path.join(os.homedir(), ".claude", "settings.json");
const EMITTER = path.join(
  os.homedir(),
  ".claude",
  "hooks",
  "agent-os-emit.sh"
);
const MARK = "agent-os-emit.sh"; // idempotency marker
const UNINSTALL = process.argv.includes("--uninstall");

const EMITTER_BODY = `#!/usr/bin/env bash
# Agent OS hook emitter — forwards Claude Code hook payloads to the local
# dashboard. Non-blocking + fail-safe: backgrounds a 2s-capped curl and
# ALWAYS exits 0, so it can never delay or break a Claude session.
PAYLOAD=$(cat)
(
  printf '%s' "$PAYLOAD" | /usr/bin/curl -s -m 2 -X POST \\
    -H 'Content-Type: application/json' --data-binary @- \\
    http://localhost:3001/api/agent-os/hook >/dev/null 2>&1
) & disown 2>/dev/null || true
exit 0
`;

const EVENTS = [
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "Notification",
  "Stop",
  "SubagentStop",
  "PreToolUse",
  "PostToolUse",
];

function readSettings() {
  if (!fs.existsSync(SETTINGS)) return {};
  const raw = fs.readFileSync(SETTINGS, "utf8");
  return JSON.parse(raw); // throws → abort, intentional
}

function isOurEntry(entry) {
  return JSON.stringify(entry).includes(MARK);
}

function main() {
  if (!fs.existsSync(SETTINGS)) {
    console.error("settings.json not found at", SETTINGS);
    process.exit(1);
  }
  let settings;
  try {
    settings = readSettings();
  } catch (e) {
    console.error("settings.json is not valid JSON — aborting.", e.message);
    process.exit(1);
  }

  const backup = `${SETTINGS}.agentos-bak-${Date.now()}`;
  fs.copyFileSync(SETTINGS, backup);
  console.log("Backup:", backup);

  settings.hooks = settings.hooks || {};

  if (UNINSTALL) {
    for (const ev of EVENTS) {
      if (Array.isArray(settings.hooks[ev])) {
        settings.hooks[ev] = settings.hooks[ev].filter((g) => !isOurEntry(g));
        if (settings.hooks[ev].length === 0) delete settings.hooks[ev];
      }
    }
    fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));
    if (fs.existsSync(EMITTER)) fs.unlinkSync(EMITTER);
    console.log("Uninstalled Agent OS hooks. Restart Claude sessions to apply.");
    return;
  }

  // Write emitter
  fs.mkdirSync(path.dirname(EMITTER), { recursive: true });
  fs.writeFileSync(EMITTER, EMITTER_BODY, { mode: 0o755 });
  fs.chmodSync(EMITTER, 0o755);
  console.log("Emitter:", EMITTER);

  const entry = {
    hooks: [{ type: "command", command: `bash ${EMITTER}`, timeout: 5 }],
  };
  let added = 0;
  for (const ev of EVENTS) {
    settings.hooks[ev] = settings.hooks[ev] || [];
    if (!settings.hooks[ev].some(isOurEntry)) {
      settings.hooks[ev].push(JSON.parse(JSON.stringify(entry)));
      added++;
    }
  }

  // Validate round-trip before commit
  const serialized = JSON.stringify(settings, null, 2);
  JSON.parse(serialized);
  fs.writeFileSync(SETTINGS, serialized);

  console.log(`Wired ${added} new event(s): ${EVENTS.join(", ")}`);
  console.log(
    "Done. New Claude Code sessions pick this up immediately; existing ones on next settings re-read."
  );
  console.log("Verify: curl -s localhost:3001/api/agent-os/hook | jq");
  console.log(`Undo:   node ${path.relative(process.cwd(), process.argv[1])} --uninstall`);
}

main();
