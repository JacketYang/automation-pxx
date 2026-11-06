import { createSessionToken, SESSION_COOKIE, verifyDashboardPassword } from "@/lib/auth";
export const dynamic="force-dynamic";
export async function POST(req:Request){
 const origin=req.headers.get("origin"); if(origin&&new URL(origin).host!==new URL(req.url).host)return Response.json({error:"请求来源无效"},{status:403});
 const body=await req.json().catch(()=>({})); if(!verifyDashboardPassword(String(body.password??"")))return Response.json({error:"访问密码不正确"},{status:401});
 let token:string;try{token=createSessionToken();}catch{return Response.json({error:"服务端尚未配置 AUTH_SECRET"},{status:503});}
 const r=Response.json({ok:true});r.headers.append("Set-Cookie",`${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`);return r;
}
