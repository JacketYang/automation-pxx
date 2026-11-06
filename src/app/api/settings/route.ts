import { getAgent, getConfig, saveConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const [config, agent] = await Promise.all([getConfig(), getAgent()]);
  return Response.json({ config, agent });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const config = await saveConfig(body);
  return Response.json({ config });
}
