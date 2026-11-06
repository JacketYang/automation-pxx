"use client";

import { useState } from "react";
import type { Job } from "./types";

const STATUS: Record<Job["status"], { label: string; cls: string }> = {
  queued: { label: "排队中", cls: "bg-slate-200 text-slate-700" },
  running: { label: "处理中", cls: "bg-blue-100 text-blue-700" },
  rejected: { label: "不能上架", cls: "bg-red-100 text-red-700" },
  eligible: { label: "可以上架", cls: "bg-emerald-100 text-emerald-700" },
  filled: { label: "已填好·待确认", cls: "bg-amber-100 text-amber-800" },
  published: { label: "已上架", cls: "bg-emerald-600 text-white" },
  failed: { label: "出错", cls: "bg-red-600 text-white" },
};
const MODE: Record<Job["mode"], string> = { check: "仅判断", fill: "判断+填表", publish: "判断+自动上架" };
const LEVEL = {
  block: { icon: "⛔", cls: "text-red-700" },
  warn: { icon: "⚠️", cls: "text-amber-700" },
  info: { icon: "✅", cls: "text-emerald-700" },
};

function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} 秒前`;
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  return `${Math.floor(s / 86400)} 天前`;
}

export default function JobCard({ job, onChange }: { job: Job; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const st = STATUS[job.status];
  const active = job.status === "queued" || job.status === "running";

  async function retry(mode?: Job["mode"]) {
    await fetch(`/api/jobs/${job.id}/retry`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode }) });
    onChange();
  }
  async function remove() {
    await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 p-4 text-left">
        {job.product?.gallery?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={job.product.gallery[0]} alt="" referrerPolicy="no-referrer" className="h-14 w-14 shrink-0 rounded-md bg-slate-100 object-cover" />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-md bg-slate-100" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
            {job.verdict === "warn" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">有警告</span>}
            <span className="text-xs text-slate-400">#{job.id} · {MODE[job.mode]} · {ago(job.updatedAt)}</span>
          </div>
          <div className="mt-1 truncate text-sm font-medium text-slate-900">{job.title || `1688 商品 ${job.offerId}`}</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">
            {active && <span className="mr-2 text-blue-600">{job.stage || "…"}</span>}
            {!active && job.stage && <span className="mr-2">{job.stage}</span>}
            {job.pricing && (
              <span>
                建议拼单价 ¥{job.pricing.maxGroup} · 预计经营利润 ¥{job.pricing.minProfit}
              </span>
            )}
            {job.pddGoodsId && <span className="ml-2">商品ID {job.pddGoodsId}</span>}
          </div>
          {!open && job.reasons.filter((r) => r.level === "block").slice(0, 1).map((r) => (
            <div key={r.code} className="mt-1 truncate text-xs text-red-600">⛔ {r.msg}</div>
          ))}
        </div>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 p-4 text-sm">
          {job.pddTitle && (
            <div>
              <div className="text-xs text-slate-500">拼多多标题（已清理极限词，≤30 字）</div>
              <div>{job.pddTitle}</div>
            </div>
          )}

          {job.reasons.length > 0 && (
            <div>
              <div className="mb-1 text-xs text-slate-500">判断依据</div>
              <ul className="space-y-1">
                {job.reasons.map((r, i) => (
                  <li key={i} className={LEVEL[r.level].cls}>
                    {LEVEL[r.level].icon} {r.msg}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {job.pricing && (
            <div className="overflow-x-auto">
              <div className="mb-1 text-xs text-slate-500">建议定价与预计利润（元）</div>
              {job.pricing.assumptions && <div className="mb-2 text-[11px] text-slate-500">按投产比 {job.pricing.assumptions.targetRoi}、平台费率 {job.pricing.assumptions.pddFeePercent}%、售后损耗 {job.pricing.assumptions.afterSalesLossPercent}%、每单目标利润 ¥{job.pricing.assumptions.minProfit} 估算；实际费用以店铺账单和真实投放为准。</div>}
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1 pr-3">规格</th>
                    <th className="pr-3">到岸成本</th>
                    <th className="pr-3">拼单价</th>
                    <th className="pr-3">单买价</th>
                    <th className="pr-3">平台费估</th>
                    <th className="pr-3">推广费估</th>
                    <th className="pr-3">售后损耗</th>
                    <th className="pr-3">预计经营利润</th>
                    <th>库存</th>
                  </tr>
                </thead>
                <tbody>
                  {job.pricing.skus.slice(0, 30).map((s, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-1 pr-3">{s.name}</td>
                      <td className="pr-3">{s.landedCost}</td>
                      <td className="pr-3 font-medium">{s.group}</td>
                      <td className="pr-3">{s.single}</td>
                      <td className="pr-3">{s.platformFee}</td>
                      <td className="pr-3">{s.promotionCost}</td>
                      <td className="pr-3">{s.afterSalesCost}</td>
                      <td className="pr-3">{s.profit}</td>
                      <td>{s.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>           </div>
          )}

          {job.error && <pre className="whitespace-pre-wrap rounded-md bg-red-50 p-3 text-xs text-red-800">{job.error}</pre>}

          {job.logs.length > 0 && (
            <div>
              <div className="mb-1 text-xs text-slate-500">运行日志</div>
              <div className="max-h-56 overflow-y-auto rounded-md bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-200">
                {job.logs.map((l, i) => (
                  <div key={i}>
                    <span className="text-slate-500">{new Date(l.t).toLocaleTimeString()} </span>
                    {l.m}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <a href={`https://detail.1688.com/offer/${job.offerId}.html`} target="_blank" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50">
              打开 1688 页面
            </a>
            {!active && (
              <>
                <button onClick={() => retry("check")} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50">重新判断</button>
                <button onClick={() => retry("fill")} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50">重新填表（不提交）</button>
                <button onClick={() => retry("publish")} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-700">重新自动上架</button>
              </>
            )}
            {job.status === "running" && (
              <button onClick={() => retry()} className="rounded-md border border-amber-300 px-3 py-1.5 text-xs text-amber-800 hover:bg-amber-50">卡住了？重新排队</button>
            )}
            <button onClick={remove} className="ml-auto rounded-md px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">删除</button>
          </div>
        </div>
      )}
    </div>
  );
}
