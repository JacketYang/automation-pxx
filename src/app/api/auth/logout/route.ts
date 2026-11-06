import { SESSION_COOKIE } from "@/lib/auth";
export async function POST(){const r=Response.json({ok:true});r.headers.append("Set-Cookie",`${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);return r;}
