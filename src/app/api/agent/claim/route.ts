import { db } from "@/db";
import { jobs } from "@/db/schema";
import { getConfig, touchAgent } from "@/lib/config";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** 本地 agent 轮询：领取下一个排队任务（同时作为心跳） */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { host?: string; version?: string };
  await touchAgent({ host: body.host ?? "", version: body.version ?? "" });

  const res = await db.execute(sql`
    update jobs set
      status = 'running',
      stage = '已被 agent 领取',
      attempts = attempts + 1,
      updated_at = now()
    where id = (
      select id from jobs where status = 'queued' order by id limit 1 for update skip locked
    )
    returning id, offer_id as "offerId", source_url as "sourceUrl", mode
  `);
  const job = (res.rows[0] as { id: number; offerId: string; sourceUrl: string; mode: string } | undefined) ?? null;
  return Response.json({ job, config: await getConfig() });
}
