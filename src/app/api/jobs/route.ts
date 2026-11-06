import { db } from "@/db";
import { jobs, type JobMode } from "@/db/schema";
import { parseOfferId } from "@/lib/config";
import { desc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(jobs).orderBy(desc(jobs.id)).limit(100);
  return Response.json({ jobs: rows });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { urls?: string; mode?: string };
  const mode: JobMode = body.mode === "check" || body.mode === "fill" ? body.mode : "publish";
  const lines = String(body.urls ?? "")
    .split(/[\s\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const seen = new Map<string, string>();
  const invalid: string[] = [];
  for (const line of lines) {
    const id = parseOfferId(line);
    if (!id) invalid.push(line);
    else if (!seen.has(id)) seen.set(id, line);
  }
  if (seen.size === 0) {
    return Response.json({ error: "没有识别到有效的 1688 商品链接", invalid }, { status: 400 });
  }

  const active = await db
    .select({ offerId: jobs.offerId })
    .from(jobs)
    .where(inArray(jobs.status, ["queued", "running"]));
  const activeIds = new Set(active.map((a) => a.offerId));

  const toInsert = [...seen.entries()]
    .filter(([id]) => !activeIds.has(id))
    .map(([offerId, sourceUrl]) => ({
      offerId,
      sourceUrl: /^\d+$/.test(sourceUrl) ? `https://detail.1688.com/offer/${offerId}.html` : sourceUrl,
      mode,
    }));
  if (toInsert.length) await db.insert(jobs).values(toInsert);

  return Response.json({
    created: toInsert.length,
    skipped: seen.size - toInsert.length,
    invalid,
  });
}
