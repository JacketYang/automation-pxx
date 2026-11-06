import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type Config = {
  markupPercent: number; // 在成本上加价百分比
  shippingCost: number; // 预估每单快递成本（元）
  fixedCost: number; // 其它固定成本（包装等）
  pddFeePercent: number; // 平台技术服务费 %
  minProfit: number; // 每单目标经营利润（扣除推广费和售后损耗后，元）
  targetRoi: number; // 目标投产比（成交额/推广费）
  afterSalesLossPercent: number; // 售后损耗率 %
  maxMinOrder: number; // 允许的最大起批量（一件代发 = 1）
  singleBuyExtra: number; // 单买价 = 拼单价 + 这个数
  defaultStock: number; // 上架库存（不超过货源库存）
  promiseHours: number; // 承诺发货时间 24/48
  shippingTemplate: string; // 拼多多运费模板名称（留空=默认）
  categoryHint: string; // 固定类目关键词（留空=按标题自动搜）
  allowWarn: boolean; // 有“警告”时是否继续上架
  requireDropship: boolean; // 页面必须出现“代发”字样
  bannedKeywords: string[];
  brandKeywords: string[];
  warnKeywords: string[];
};

export const DEFAULT_CONFIG: Config = {
  markupPercent: 30,
  shippingCost: 2.5,
  fixedCost: 0,
  pddFeePercent: 0.6,
  minProfit: 3,
  targetRoi: 2,
  afterSalesLossPercent: 3,
  maxMinOrder: 1,
  singleBuyExtra: 1,
  defaultStock: 100,
  promiseHours: 48,
  shippingTemplate: "",
  categoryHint: "",
  allowWarn: true,
  requireDropship: true,
  bannedKeywords: [
    "香烟", "烟草", "电子烟", "雾化", "处方药", "药品", "减肥药", "壮阳", "催情", "成人用品", "情趣",
    "仿真枪", "弹弓", "弩", "管制刀具", "匕首", "甩棍", "电击", "防狼", "窃听", "监听", "针孔",
    "迷药", "赌博", "筹码", "医疗器械", "隐形眼镜", "美瞳", "农药", "烟花", "爆竹", "鞭炮", "文物",
    "古董", "活体", "象牙", "犀牛角", "替考", "代考", "作弊", "翻墙", "刷单", "假证", "公章", "高仿", "仿牌",
  ],
  brandKeywords: [
    "耐克", "nike", "阿迪达斯", "adidas", "苹果", "apple", "iphone", "华为", "小米", "路易威登", "古驰",
    "gucci", "香奈儿", "chanel", "迪奥", "dior", "爱马仕", "普拉达", "prada", "巴宝莉", "burberry",
    "卡地亚", "劳力士", "新百伦", "new balance", "彪马", "puma", "lululemon", "北面", "迪士尼", "disney",
    "hello kitty", "三丽鸥", "泡泡玛特", "乐高", "lego", "原单", "A货", "得力", "晨光", "百乐", "斑马",
  ],
  warnKeywords: [
    "食品", "零食", "保健", "化妆", "护肤", "面膜", "口红", "香水", "婴儿", "婴幼儿", "奶粉", "玩具",
    "充电", "电池", "锂", "插座", "电器", "灯", "酒", "茶叶", "黄金", "钻石", "口罩", "消毒", "宠物食品", "种子",
  ],
};

export async function getConfig(): Promise<Config> {
  const rows = await db.select().from(settings).where(eq(settings.key, "config"));
  const saved = (rows[0]?.value ?? {}) as Partial<Config>;
  return { ...DEFAULT_CONFIG, ...saved };
}

export async function saveConfig(patch: Partial<Config>): Promise<Config> {
  const merged = { ...(await getConfig()), ...sanitize(patch) };
  await db
    .insert(settings)
    .values({ key: "config", value: merged })
    .onConflictDoUpdate({ target: settings.key, set: { value: merged, updatedAt: new Date() } });
  return merged;
}

function num(v: unknown, fallback: number, min = 0, max = 1e6) {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
function list(v: unknown, fallback: string[]) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/[\n,，、]/).map((x) => x.trim()).filter(Boolean);
  return fallback;
}

function sanitize(p: Partial<Config>): Partial<Config> {
  const d = DEFAULT_CONFIG;
  const out: Partial<Config> = {};
  if (p.markupPercent !== undefined) out.markupPercent = num(p.markupPercent, d.markupPercent, 0, 1000);
  if (p.shippingCost !== undefined) out.shippingCost = num(p.shippingCost, d.shippingCost);
  if (p.fixedCost !== undefined) out.fixedCost = num(p.fixedCost, d.fixedCost);
  if (p.pddFeePercent !== undefined) out.pddFeePercent = num(p.pddFeePercent, d.pddFeePercent, 0, 50);
  if (p.minProfit !== undefined) out.minProfit = num(p.minProfit, d.minProfit, 0, 100000);
  if (p.targetRoi !== undefined) out.targetRoi = num(p.targetRoi, d.targetRoi, 0.1, 100);
  if (p.afterSalesLossPercent !== undefined) out.afterSalesLossPercent = num(p.afterSalesLossPercent, d.afterSalesLossPercent, 0, 100);
  if (p.maxMinOrder !== undefined) out.maxMinOrder = num(p.maxMinOrder, d.maxMinOrder, 1, 10000);
  if (p.singleBuyExtra !== undefined) out.singleBuyExtra = num(p.singleBuyExtra, d.singleBuyExtra, 0, 1000);
  if (p.defaultStock !== undefined) out.defaultStock = num(p.defaultStock, d.defaultStock, 1, 100000);
  if (p.promiseHours !== undefined) out.promiseHours = num(p.promiseHours, d.promiseHours, 24, 72);
  if (p.shippingTemplate !== undefined) out.shippingTemplate = String(p.shippingTemplate).trim();
  if (p.categoryHint !== undefined) out.categoryHint = String(p.categoryHint).trim();
  if (p.allowWarn !== undefined) out.allowWarn = Boolean(p.allowWarn);
  if (p.requireDropship !== undefined) out.requireDropship = Boolean(p.requireDropship);
  if (p.bannedKeywords !== undefined) out.bannedKeywords = list(p.bannedKeywords, d.bannedKeywords);
  if (p.brandKeywords !== undefined) out.brandKeywords = list(p.brandKeywords, d.brandKeywords);
  if (p.warnKeywords !== undefined) out.warnKeywords = list(p.warnKeywords, d.warnKeywords);
  return out;
}

export async function touchAgent(info: Record<string, unknown>) {
  const value = { ...info, at: new Date().toISOString() };
  await db
    .insert(settings)
    .values({ key: "agent", value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function getAgent(): Promise<{ at?: string; host?: string; version?: string }> {
  const rows = await db.select().from(settings).where(eq(settings.key, "agent"));
  return (rows[0]?.value ?? {}) as { at?: string; host?: string; version?: string };
}

/** 从各种 1688 链接里解析 offerId（支持 detail/m/offerId= 参数/纯数字） */
export function parseOfferId(input: string): string | null {
  const s = input.trim();
  if (/^\d{8,15}$/.test(s)) return s;
  const m =
    s.match(/offer\/(\d{8,15})/) ||
    s.match(/[?&](?:offerId|offer_id|id|object_id)=(\d{8,15})/i) ||
    s.match(/(\d{10,15})\.html/);
  return m ? m[1] : null;
}
