"use client";
import { useState, type FormEvent } from "react";
export default function LoginPage(){
 const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");try{const r=await fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password})});const j=await r.json();if(!r.ok)throw new Error(j.error||"登录失败");location.assign("/");}catch(e){setError(e instanceof Error?e.message:"登录失败");}finally{setBusy(false);}}
 return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4"><form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-sm"><h1 className="text-xl font-semibold">1688 → 拼多多 自动上架</h1><p className="my-3 text-sm text-slate-500">请输入工作台访问密码</p><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required className="w-full rounded-lg border border-slate-300 px-3 py-2"/>{error&&<p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}<button disabled={busy||!password} className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white disabled:opacity-50">{busy?"登录中…":"登录工作台"}</button></form></main>;
}
