"use client";

import { useCallback, useEffect, useState } from "react";

type Job = {
  id: number; offerId: string; mode: string; status: string; stage: string;
  title?: string; pddTitle?: string; verdict?: string; reasons?: {level:string;msg:string}[];
  pricing?: { skus?: {name:string;cost:number;group:number;single:number;profit:number}[]; maxGroup?:number };
  error?: string; logs?: {t:string;m:string}[]; pddGoodsId?: string;
};
const API = "http://127.0.0.1:17368";
const MODES = [
  {v:"check",t:"只分析",d:"读取商品、判断风险并核算 SKU 价格"},
  {v:"fill",t:"分析并填表",d:"自动填写拼多多表单，停在提交前"},
  {v:"publish",t:"分析并上架",d:"完成填写后尝试提交，请先确认商品资料"},
] as const;
export default function Dashboard() {
  const [urls,setUrls]=useState("");
  const [mode,setMode]=useState<"check"|"fill"|"publish">("fill");
  const [online,setOnline]=useState(false);
  const [host,setHost]=useState("");
  const [jobs,setJobs]=useState<Job[]>([]);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [minProfit,setMinProfit]=useState("3");
  const [targetRoi,setTargetRoi]=useState("2");
  const [settingsSaved,setSettingsSaved]=useState(false);
  const [savingSettings,setSavingSettings]=useState(false);
  const load=useCallback(async()=>{
    try {
      const [h,j,s]=await Promise.all([fetch(API+"/health",{cache:"no-store"}),fetch(API+"/jobs",{cache:"no-store"}),fetch(API+"/settings",{cache:"no-store"})]);
      if(!h.ok||!j.ok||!s.ok) throw new Error("Agent 未响应");
      const health=await h.json(); const data=await j.json(); const settings=await s.json();
      setOnline(Boolean(health.online)); setHost(health.host||"本机"); setJobs(data.jobs||[]);
      setMinProfit(String(settings.minProfit ?? 3)); setTargetRoi(String(settings.targetRoi ?? 2)); setError("");
    } catch { setOnline(false); setHost(""); }
  },[]);
  useEffect(()=>{ load(); const t=window.setInterval(load,1500); return ()=>window.clearInterval(t); },[load]);
  async function saveSettings(){
    setSavingSettings(true);setSettingsSaved(false);setError("");
    try {
      const r=await fetch(API+"/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({minProfit:Number(minProfit),targetRoi:Number(targetRoi)})});
      const data=await r.json(); if(!r.ok) throw new Error(data.error||"保存失败");
      setMinProfit(String(data.minProfit));setTargetRoi(String(data.targetRoi));setSettingsSaved(true);
    } catch(e){setError(e instanceof Error?e.message:"设置保存失败");}
    finally{setSavingSettings(false);}
  }
  async function submit(){
    setBusy(true);setError("");
    try {
      const r=await fetch(API+"/jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({urls,mode})});
      const data=await r.json(); if(!r.ok) throw new Error(data.error||"提交失败");
      setUrls(""); await load();
    } catch(e){setError(e instanceof Error?e.message:"提交失败");}
    finally{setBusy(false);}
  }
  const counts={running:jobs.filter(j=>["running","queued"].includes(j.status)).length,done:jobs.filter(j=>["eligible","filled","published"].includes(j.status)).length,blocked:jobs.filter(j=>["rejected","failed"].includes(j.status)).length};
  return <main className="mx-auto max-w-5xl px-4 py-8">
    <header className="mb-6 flex flex-wrap items-center gap-3">
      <div><div className="text-sm font-medium text-blue-700">PXX · 第一阶段</div><h1 className="text-2xl font-bold">1688 商品分析 → 拼多多上架</h1><p className="mt-1 text-sm text-slate-500">网页直接连接本机 Agent，浏览器登录态保留在你的电脑。</p></div>
      <div className={`ml-auto rounded-full px-4 py-2 text-sm font-medium ${online?"bg-emerald-100 text-emerald-800":"bg-red-100 text-red-700"}`}>{online?"● Agent 在线 · "+host:"● Agent 未连接"}</div>
    </header>
    {!online&&<div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">请先在电脑上启动一次本机 Agent（安装目录里的 <b>start-agent.bat</b>）。启动后此处会自动变成在线，不需要复制商品命令。</div>}
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <div><h2 className="font-semibold">利润与投产比</h2><p className="mt-1 text-xs text-slate-500">这两项仍是硬门槛；修改后保存在本机。</p></div>
        <label className="text-sm">每单最低利润（元）<input type="number" min="0" max="10000" step="0.5" value={minProfit} onChange={e=>{setMinProfit(e.target.value);setSettingsSaved(false);}} className="mt-1 block w-32 rounded-lg border border-slate-300 p-2"/></label>
        <label className="text-sm">目标 ROI<input type="number" min="1.01" max="100" step="0.1" value={targetRoi} onChange={e=>{setTargetRoi(e.target.value);setSettingsSaved(false);}} className="mt-1 block w-32 rounded-lg border border-slate-300 p-2"/></label>
        <button disabled={!online||savingSettings} onClick={saveSettings} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">{savingSettings?"保存中…":"保存参数"}</button>
        {settingsSaved&&<span className="text-xs text-emerald-700">已保存到本机</span>}
      </div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">添加 1688 商品链接</h2><p className="mt-1 text-sm text-slate-500">支持一次粘贴多个链接，每行一个。当前为流程联调宽松模式，风险项会提示但不轻易淘汰。</p>
      <textarea value={urls} onChange={e=>setUrls(e.target.value)} rows={4} placeholder="https://detail.1688.com/offer/123456789012.html" className="mt-3 w-full rounded-lg border border-slate-300 p-3 font-mono text-sm"/>
      <div className="mt-3 grid gap-2 md:grid-cols-3">{MODES.map(m=><label key={m.v} className={`cursor-pointer rounded-lg border p-3 text-sm ${mode===m.v?"border-blue-500 bg-blue-50":"border-slate-200"}`}><input type="radio" className="mr-2" checked={mode===m.v} onChange={()=>setMode(m.v)}/><b>{m.t}</b><div className="mt-1 text-xs text-slate-500">{m.d}</div></label>)}</div>
      <div className="mt-3 flex items-center gap-3"><button disabled={!online||!urls.trim()||busy} onClick={submit} className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40">{busy?"提交中…":"开始处理"}</button>{error&&<span className="text-sm text-red-600">{error}</span>}</div>
    </section>
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap gap-4 text-sm text-slate-500"><b className="text-slate-900">任务记录（{jobs.length}）</b><span>处理中 {counts.running}</span><span>已完成/待确认 {counts.done}</span><span>异常/拦截 {counts.blocked}</span></div>
      {!jobs.length?<div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">还没有任务，粘贴 1688 链接即可开始。</div>:<div className="space-y-3">{jobs.map(j=><article key={j.id} className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2"><b>{j.title||"1688 商品 "+j.offerId}</b><span className="rounded bg-slate-100 px-2 py-1 text-xs">{j.status}</span><span className="ml-auto text-xs text-slate-500">{j.stage}</span></div>
        <div className="mt-1 text-xs text-slate-500">商品 ID：{j.offerId} · {j.mode==="check"?"只分析":j.mode==="publish"?"自动提交":"填写待确认"}</div>
        {j.pddTitle&&<p className="mt-2 text-sm">拼多多标题：{j.pddTitle}</p>}
        {j.pricing?.skus?.length?<div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="text-slate-500"><th className="p-2">SKU</th><th>成本</th><th>拼单价</th><th>单买价</th><th>预计利润</th></tr></thead><tbody>{j.pricing.skus.slice(0,20).map((s,i)=><tr key={i} className="border-t"><td className="p-2">{s.name}</td><td>¥{s.cost}</td><td>¥{s.group}</td><td>¥{s.single}</td><td>¥{s.profit}</td></tr>)}</tbody></table></div>:null}
        {j.reasons?.map((x,i)=><p key={i} className={`mt-1 text-xs ${x.level==="block"?"text-red-600":x.level==="warn"?"text-amber-700":"text-slate-500"}`}>{x.msg}</p>)}
        {j.error&&<p className="mt-2 whitespace-pre-wrap text-xs text-red-600">{j.error}</p>}
        <details className="mt-3"><summary className="cursor-pointer text-xs text-slate-500">查看执行日志（{j.logs?.length||0}）</summary><div className="mt-2 max-h-48 overflow-auto rounded bg-slate-950 p-3 font-mono text-xs text-slate-100">{(j.logs||[]).map((l,i)=><div key={i}>{new Date(l.t).toLocaleTimeString()} {l.m}</div>)}</div></details>
      </article>)}</div>}
    </section>
    <p className="mt-6 text-xs text-slate-400">本机服务仅监听 127.0.0.1:17368；商品页面和登录 Cookie 不会上传到 Vercel。网页需通过 HTTPS 打开。</p>
  </main>;
}
