"use client";

import { useState } from "react";
import type { Config } from "./types";

const NUM_FIELDS: { key: keyof Config; label: string; hint: string; step?: string }[] = [
  { key: "markupPercent", label: "最低加价率 %", hint: "作为售价下限；仍需满足目标投产比和经营利润" },
  { key: "shippingCost", label: "运费缺失时估算 ¥", hint: "仅用于暂算；未核实包邮/运费会阻止上架", step: "0.1" },
  { key: "fixedCost", label: "其它固定成本 ¥", hint: "包装等", step: "0.1" },
  { key: "pddFeePercent", label: "平台费率 %", hint: "按店铺实际费率核实；默认 0.6%", step: "0.1" },
  { key: "minProfit", label: "目标经营利润 ¥", hint: "扣除平台费、售后损耗和推广费后的每单目标", step: "0.1" },
  { key: "targetRoi", label: "目标投产比", hint: "成交额 ÷ 推广费；2 表示推广费按售价的 50% 估算", step: "0.1" },
  { key: "afterSalesLossPercent", label: "售后损耗率 %", hint: "退款、补发、售后等预估比例", step: "0.1" },
  { key: "maxMinOrder", label: "最大起批量", hint: "一件代发=1" },
  { key: "singleBuyExtra", label: "单买价加价 ¥", hint: "单买价=拼单价+此值", step: "0.1" },
  { key: "defaultStock", label: "上架库存", hint: "不超过货源库存" },
  { key: "promiseHours", label: "承诺发货(小时)", hint: "24 或 48" },
];

const LIST_FIELDS: { key: "bannedKeywords" | "brandKeywords" | "warnKeywords"; label: string; hint: string }[] = [
  { key: "bannedKeywords", label: "违禁/禁售词（命中=不能上）", hint: "标题、属性、规格里出现就拒绝" },
  { key: "brandKeywords", label: "品牌词（命中=不能上）", hint: "无授权会侵权" },
  { key: "warnKeywords", label: "资质提醒词（命中=警告）", hint: "可能需要类目资质/3C/备案" },
];

export default function SettingsPanel({ config, onSaved }: { config: Config; onSaved: (c: Config) => void }) {
  const [draft, setDraft] = useState<Record<string, string | boolean>>(() => toDraft(config));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true);
    setMsg("");
    const body: Record<string, unknown> = { ...draft };
    const r = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    setSaving(false);
    if (r.ok) {
      onSaved(j.config);
      setDraft(toDraft(j.config));
      setMsg("已保存，下一个任务开始生效");
    } else setMsg("保存失败");
  }

  const input = "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {NUM_FIELDS.map((f) => (
          <label key={f.key} className="block text-xs text-slate-600">
            {f.label}
            <input
              type="number"
              step={f.step ?? "1"}
              className={input}
              value={String(draft[f.key] ?? "")}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            />
            <span className="text-[11px] text-slate-400">{f.hint}</span>
          </label>
        ))}
        <label className="block text-xs text-slate-600">
          运费模板名称
          <input className={input} value={String(draft.shippingTemplate ?? "")} onChange={(e) => setDraft({ ...draft, shippingTemplate: e.target.value })} />
          <span className="text-[11px] text-slate-400">留空=用后台默认</span>
        </label>
        <label className="block text-xs text-slate-600">
          固定类目搜索词
          <input className={input} value={String(draft.categoryHint ?? "")} onChange={(e) => setDraft({ ...draft, categoryHint: e.target.value })} />
          <span className="text-[11px] text-slate-400">留空=按标题自动搜类目</span>
        </label>
      </div>

      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={Boolean(draft.allowWarn)} onChange={(e) => setDraft({ ...draft, allowWarn: e.target.checked })} />
          有“警告”也继续上架
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={Boolean(draft.requireDropship)} onChange={(e) => setDraft({ ...draft, requireDropship: e.target.checked })} />
          未识别明确单件代发信息就拒绝
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {LIST_FIELDS.map((f) => (
          <label key={f.key} className="block text-xs text-slate-600">
            {f.label}
            <textarea
              rows={6}
              className={input + " font-mono"}
              value={String(draft[f.key] ?? "")}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            />
            <span className="text-[11px] text-slate-400">{f.hint}；用逗号或换行分隔</span>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50">
          {saving ? "保存中…" : "保存规则"}
        </button>
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
      </div>
    </div>
  );
}

function toDraft(c: Config): Record<string, string | boolean> {
  const d: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(c)) {
    d[k] = Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? v : String(v);
  }
  return d;
}
