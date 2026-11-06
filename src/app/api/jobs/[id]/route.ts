import {db} from "@/db";import {jobs} from "@/db/schema";import {dashboardAuth} from "@/lib/auth";import {eq} from "drizzle-orm";
export const dynamic="force-dynamic";
export async function DELETE(req:Request,ctx:{params:Promise<{id:string}>}){const denied=dashboardAuth(req);if(denied)return denied;const {id}=await ctx.params;const n=Number(id);if(!Number.isSafeInteger(n)||n<=0)return Response.json({error:"任务 ID 无效"},{status:400});await db.delete(jobs).where(eq(jobs.id,n));return Response.json({ok:true});}
