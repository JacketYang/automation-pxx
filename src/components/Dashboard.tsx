"use client";

import { useMemo, useState } from "react";

const SAMPLE = "https://detail.1688.com/offer/123456789012.html";

export default function Dashboard() {
  const [urls, setUrls] = useState("");
  const [mode, setMode] = useState<"check" | "list" | "submit">("list");
  const [copied, setCopied] = useState(false);
  const commands = useMemo(() => urls.split(/[\\s，,；;]+/).map((x) => x.trim()).filter(Boolean).map((url) => {
    const escaped = url.replace(/'/g, "''");
    if (mode === "check") return `node agent.mjs check '${escaped}'`;
    if (mode === "submit") return `node agent.mjs list '${escaped}' --submit`;
    return `node agent.mjs list '${escaped}'`;
  }).join("\\n"), [urls, mode]);

  async function copy() {
    await navigator.clipboard.writeText(commands);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <div className="mb-2 text-sm font-medium text-blue-700">PXX · 第一阶段</div>
        <h1 className="text-3xl font-bold tracking-tight">1688 商品分析 → 拼多多上架</h1>
        <p className="mt-3 text-slate-600">先把商品分析、SKU 成本核算和上架流程跑通。网页不接数据库，商品浏览器操作在你自己的 Windows 电脑完成。</p>
      </header>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">添加 1688 商品链接</h2>
        <p className="mt-1 text-sm text-slate-500">每行一个链接。这里生成本机 Agent 命令，不会把登录信息或浏览器数据上传到云端。</p>
        <textarea value={urls} onChange={(e) => setUrls(e.target.value)} rows={5} placeholder={SAMPLE} className="mt-4 w-full rounded-lg border border-slate-300 p-3 font-mono text-sm outline-none focus:border-blue-500" />
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {([["check", "只分析商品"], ["list", "分析并填表（不提交）"], ["submit", "分析并自动提交"]] as const).map(([value, label]) => (
            <label key={value} className={`cursor-pointer rounded-lg border p-3 text-sm ${mode === value ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}>
              <input type="radio" className="mr-2" checked={mode === value} onChange={() => setMode(value)} />{label}
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button disabled={!commands} onClick={copy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">{copied ? "已复制命令" : "复制本机执行命令"}</button>
          <span className="text-xs text-slate-500">{commands ? `${commands.split("\\n").length} 个商品` : "等待输入链接"}</span>
        </div>
        {commands && <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">{commands}</pre>}
      </section>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">第一次使用</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
          <li>在 Windows 安装 Node.js 及 Chrome 或 Edge。</li>
          <li>下载仓库 <code>public/agent</code> 目录中的文件到同一个文件夹，运行 <code>npm install</code>。</li>
          <li>运行 <code>node agent.mjs login</code>，在弹出的浏览器里登录 1688 和拼多多商家后台。</li>
          <li>复制上面的命令到该文件夹的 PowerShell 执行。首次先选“分析并填表”，人工核对后再提交。</li>
        </ol>
        <p className="mt-4 text-xs text-slate-500">浏览器登录态只留在本机的 chrome-profile 目录。不要把该目录上传到 GitHub。</p>
      </section>
      <section className="mt-6 rounded-2xl bg-slate-100 p-5 text-sm text-slate-600">
        <h2 className="font-semibold text-slate-900">当前开发范围</h2>
        <p className="mt-2">只做 1688 商品读取、SKU 定价与风险判断、拼多多表单填写。云端任务队列、数据库、账号体系、Token、订单采购、推广和客服暂不开发。</p>
      </section>
    </main>
  );
}
