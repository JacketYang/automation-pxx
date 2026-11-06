import { db } from "@/db";
import { jobs, type JobMode } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { mode?: string };
  const patch: Partial<typeof jobs.$inferInsert> = {
    status: "queued",
    stage: "等待 agent 领取",
    error: "",
    updatedAt: new Date(),
  };
  if (body.mode === "check" || body.mode === "fill" || body.mode === "publish") {
    patch.mode = body.mode as JobMode;
  }
  await db.update(jobs).set(patch).where(eq(jobs.id, Number(id)));
  return Response.json({ ok: true });
}
