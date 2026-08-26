import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Simple cache (5 min)
let cache: { ts: number; data: unknown } | null = null;

export async function GET() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return NextResponse.json({ configured: false });
  }

  if (cache && Date.now() - cache.ts < 5 * 60_000) {
    return NextResponse.json(cache.data);
  }

  try {
    // Dynamic import — only installed if user wants Gmail
    type ImapModule = typeof import("imapflow");
    let ImapFlow: ImapModule["ImapFlow"];
    try {
      const mod = (await import("imapflow")) as ImapModule;
      ImapFlow = mod.ImapFlow;
    } catch {
      return NextResponse.json({
        configured: false,
        setupHint:
          "Run `npm install imapflow` in life-os to enable Gmail widget.",
      });
    }

    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user, pass },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    let unread = 0;
    const recent: Array<{ from: string; subject: string; ts: number }> = [];
    try {
      const search = (await client.search({ seen: false })) || [];
      unread = Array.isArray(search) ? search.length : 0;
      const last = Array.isArray(search) ? search.slice(-5).reverse() : [];
      for (const seq of last) {
        // fetchOne returns `false` (not just undefined) when the message is
        // gone; narrow that out before touching envelope.
        const msg = await client.fetchOne(String(seq), { envelope: true });
        if (msg && msg.envelope) {
          const from = msg.envelope.from?.[0]?.address ?? "";
          recent.push({
            from,
            subject: msg.envelope.subject ?? "(no subject)",
            ts: msg.envelope.date
              ? new Date(msg.envelope.date).getTime()
              : Date.now(),
          });
        }
      }
    } finally {
      lock.release();
      await client.logout();
    }

    const data = { configured: true, unread, recent };
    cache = { ts: Date.now(), data };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({
      configured: true,
      error: e instanceof Error ? e.message : "Gmail fetch failed",
    });
  }
}
