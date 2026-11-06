import { createHmac, timingSafeEqual } from "node:crypto";
export const SESSION_COOKIE = "pxx_session";
function safeEqual(a: string, b: string) { const x=Buffer.from(a), y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y); }
export function createSessionToken() { const s=process.env.AUTH_SECRET; if(!s||s.length<32) throw new Error("AUTH_SECRET must be at least 32 chars"); return createHmac("sha256",s).update("pxx-session-v1").digest("hex"); }
export function isValidSession(t?:string) { try { return !!t && safeEqual(t,createSessionToken()); } catch { return false; } }
export function verifyDashboardPassword(p:string) { const expected=process.env.DASHBOARD_PASSWORD; return !!expected && !!p && safeEqual(p,expected); }
export function dashboardAuth(req:Request):Response|null { const token=(req.headers.get("cookie")||"").match(/(?:^|;\\s*)pxx_session=([^;]+)/)?.[1]; return isValidSession(token)?null:Response.json({error:"未登录或登录已过期"},{status:401}); }
export function agentAuth(req:Request):Response|null { const expected=process.env.AGENT_TOKEN; const actual=req.headers.get("authorization")?.replace(/^Bearer\\s+/i,"")||""; return expected&&safeEqual(actual,expected)?null:Response.json({error:"Agent 身份验证失败"},{status:401}); }
