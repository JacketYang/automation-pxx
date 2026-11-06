import { db } from "@/db";
import { jobs } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await db.delete(jobs).where(eq(jobs.id, Number(id)));
  return Response.json({ ok: true });
}
