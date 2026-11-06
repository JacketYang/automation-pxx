import {getAgent,getConfig,saveConfig} from "@/lib/config";import {dashboardAuth} from "@/lib/auth";
export const dynamic="force-dynamic";
export async function GET(req:Request){const denied=dashboardAuth(req);if(denied)return denied;const [config,agent]=await Promise.all([getConfig(),getAgent()]);return Response.json({config,agent});}
export async function PUT(req:Request){const denied=dashboardAuth(req);if(denied)return denied;const body=await req.json().catch(()=>({}));const config=await saveConfig(body);return Response.json({config});}
