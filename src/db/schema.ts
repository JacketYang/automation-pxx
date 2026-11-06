import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type JobMode = "check" | "fill" | "publish";
export type JobStatus =
  | "queued" // 等待本地 agent 领取
  | "running" // agent 正在处理
  | "rejected" // 判断为不能上架
  | "eligible" // 判断为可以上架（仅判断模式）
  | "filled" // 已在拼多多后台填好，等你确认提交
  | "published" // 已提交上架
  | "failed"; // 出错

export type Reason = { level: "block" | "warn" | "info"; code: string; msg: string };

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  sourceUrl: text("source_url").notNull(),
  offerId: text("offer_id").notNull(),
  mode: text("mode").$type<JobMode>().notNull().default("publish"),
  status: text("status").$type<JobStatus>().notNull().default("queued"),
  stage: text("stage").notNull().default(""),
  title: text("title").notNull().default(""),
  pddTitle: text("pdd_title").notNull().default(""),
  verdict: text("verdict").$type<"ok" | "warn" | "blocked" | "">().notNull().default(""),
  reasons: jsonb("reasons").$type<Reason[]>().notNull().default([]),
  product: jsonb("product").$type<Record<string, unknown> | null>(),
  pricing: jsonb("pricing").$type<Record<string, unknown> | null>(),
  logs: jsonb("logs").$type<{ t: string; m: string }[]>().notNull().default([]),
  pddGoodsId: text("pdd_goods_id").notNull().default(""),
  error: text("error").notNull().default(""),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
