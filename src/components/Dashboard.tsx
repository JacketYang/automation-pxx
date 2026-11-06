"use client";

import { useCallback, useEffect, useState } from "react";
import JobCard from "./JobCard";
import SettingsPanel from "./SettingsPanel";
import SetupGuide from "./SetupGuide";
import type { AgentInfo, Config, Job } from "./types";

const MODES = [
  { v: "check", t: "只判断", d: "读取 1688 商品，告诉你能不能上、建议卖多少钱" },
  { v: "fill", t: "判断 + 填好表单", d: "能上就在拼多多后台填好，停在“提交”前由你确认" },
  { v: "publish", t: "判断 + 自动上架", d: "能上就全自动提交（填写不完整时会自动退回到“待确认”）" },
] as const;

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [agent, setAgent] = useState<AgentInfo>({});
  const [config, setConfig] = useState<Config | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [urls, setUrls] = useState("");
  const [mode, setMode] = useState<"check" | "fill" | "publish">("fill");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"jobs" | "setup" | "rules">("jobs");

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([fetch("/api/jobs").then((r) => r.json()), fetch("/api/settings").then((r) => r.json())]);
      setJobs(a.jobs);
      setAgent(b.agent);
      setConfig((c) => c ?? b.config);
      setNow(Date.now());
    } catch {
      /* ignore transient errors */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [load]);

  const online = agent.at ? now - new Date(agent.at).getTime() < 20000 : false;

  async function submit() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ urls, mode }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: j.error || "提交失败" });
    setUrls("");
    setMsg({
      ok: true,
      text: `已加入队列 ${j.created} 个${j.skipped ? `，${j.skipped} 个已在排队/处理中被跳过` : ""}${j.invalid?.length ? `，${j.invalid.length} 个无法识别` : ""}${online ? "" : "。注意：agent 还没连接，请先看“连接 agent”"}`,
    });
    load();
  }

  const counts = {
    active: jobs.filter((j) => j.status === "queued" || j.status === "running").length,
    ok: jobs.filter((j) => ["eligible", "filled", "published"].includes(j.status)).length,
    rejected: jobs.filter((j) => j.status === "rejected").length,
    published: jobs.filter((j) => j.status === "published").length,
  };
  const waiting = jobs.find((j) => j.status === "running" && j.stage.startsWith("等待你操作"));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">1688 → 拼多多 自动上架</h1>
          <p className="text-sm text-slate-500">贴 1688 链接 → 判断能不能上 → 自动在拼多多商家后台上架</p>
        </div>
        <button
          type="button"
          onClick={() => setTab("setup")}
          className={`ml-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${online ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}
        >
          <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-red-500"}`} />
          {online ? `Agent 在线${agent.host ? ` · ${agent.host}` : ""}` : "Agent 未连接（点击查看连接方法）"}
        </button>
      </header>

      {waiting && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>⏸ 需要你操作：</strong>
          {waiting.stage.replace("等待你操作：", "")}（任务 #{waiting.id}，请切换到 agent 打开的浏览器窗口）
        </div>
      )}

      <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">添加 1688 商品链接（可一次贴多个，每行一个）</h2>
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          rows={3}
          placeholder="https://detail.1688.com/offer/123456789012.html"
          className="w-full rounded-lg border border-slate-300 p-3 font-mono text-sm outline-none focus:border-blue-500"
        />
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {MODES.map((m) => (
            <label
              key={m.v}
              className={`cursor-pointer rounded-lg border p-3 text-sm ${mode === m.v ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <input type="radio" className="mr-2" checked={mode === m.v} onChange={() => setMode(m.v)} />
              <span className="font-medium">{m.t}</span>
              <div className="mt-1 text-xs text-slate-500">{m.d}</div>
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={submit}
            disabled={busy || !urls.trim()}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {busy ? "提交中…" : "开始"}
          </button>
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
        </div>
      </section>

      <nav className="mb-4 flex gap-1 border-b border-slate-200 text-sm">
        {(
          [
            ["jobs", `任务（${jobs.length}）`],
            ["setup", "连接 agent"],
            ["rules", "定价与判断规则"],
          ] as const
        ).map(([k, t]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 ${tab === k ? "border-slate-900 font-medium text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "jobs" && (
        <section className="space-y-3">
          {jobs.length > 0 && (
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <span>处理中 {counts.active}</span>
              <span>可上架 {counts.ok}</span>
              <span>不能上 {counts.rejected}</span>
              <span>已上架 {counts.published}</span>
            </div>
          )}
          {jobs.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              还没有任务。先在上面贴一个 1688 链接试试{!online && "（需要先连接 agent）"}。
            </div>
          )}
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} onChange={load} />
          ))}
        </section>
      )}

      {tab === "setup" && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <SetupGuide />
        </section>
      )}

      {tab === "rules" && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          {config ? <SettingsPanel config={config} onSaved={setConfig} /> : <p className="text-sm text-slate-500">加载中…</p>}
        </section>
      )}
    </main>
  );
}
