import type { Config } from "@/lib/config";

export type { Config };

export type Reason = { level: "block" | "warn" | "info"; code: string; msg: string };

export type SkuPricing = {
  name: string;
  cost: number;
  group: number;
  single: number;
  market: number;
  profit: number;
  stock: number;
};

export type Job = {
  id: number;
  sourceUrl: string;
  offerId: string;
  mode: "check" | "fill" | "publish";
  status: "queued" | "running" | "rejected" | "eligible" | "filled" | "published" | "failed";
  stage: string;
  title: string;
  pddTitle: string;
  verdict: "ok" | "warn" | "blocked" | "";
  reasons: Reason[];
  product: { gallery?: string[]; skus?: unknown[]; cost?: number } | null;
  pricing: { skus: SkuPricing[]; minProfit: number; maxGroup: number } | null;
  logs: { t: string; m: string }[];
  pddGoodsId: string;
  error: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

export type AgentInfo = { at?: string; host?: string; version?: string };
