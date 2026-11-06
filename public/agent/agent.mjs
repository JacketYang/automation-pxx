#!/usr/bin/env node
/**
 * 1688 → 拼多多 自动上架 agent（运行在你自己的电脑上）
 *
 * 用法：
 *   node agent.mjs login                      首次：打开浏览器，登录 1688 和 拼多多商家后台（登录态保存在 ./chrome-profile）
 *   node agent.mjs check <1688链接>            只判断能不能上架
 *   node agent.mjs list  <1688链接>            判断 + 在拼多多后台填好表单（停在提交前，等你确认）
 *   node agent.mjs list  <1688链接> --submit   判断 + 填写 + 自动提交上架
 *   node agent.mjs inspect-pdd                打印拼多多发布页的表单结构（用于调试选择器）
 *
 * 通用参数：
 *   --profile <dir>    浏览器登录态目录，默认 ./chrome-profile
 *   --cdp [url]        连接已经开着的 Chrome（--remote-debugging-port=9222），不再自己启动
 *   --channel <name>   chrome / msedge，默认依次尝试
 *   --category <词>    指定拼多多类目搜索词
 *   --config <file>    本地 JSON，覆盖默认的加价/违禁词等规则（不接网页时用）
 *   --out <dir>        图片和截图输出目录，默认 ./output
 */
import { chromium } from "playwright-core";
import { priceSku } from "./pricing.mjs";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { createServer } from "node:http";

const MAX_PRICE_MULTIPLE = 3.5;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ───────────────────────── 参数 ─────────────────────────
const argv = process.argv.slice(2);
const cmd = argv[0] && !argv[0].startsWith("--") ? argv[0] : "help";
const flags = {};
const positional = [];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const k = a.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith("--")) flags[k] = true;
    else {
      flags[k] = n;
      i++;
    }
  } else positional.push(a);
}
const OUT = path.resolve(flags.out || "output");

const DEFAULTS = {
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
  requireDropship: false,
  bannedKeywords: ["香烟", "电子烟", "处方药", "药品", "成人用品", "情趣", "仿真枪", "管制刀具", "匕首", "医疗器械", "美瞳", "烟花", "高仿", "仿牌"],
  brandKeywords: ["耐克", "nike", "阿迪达斯", "adidas", "苹果", "iphone", "华为", "小米", "路易威登", "gucci", "chanel", "迪奥", "爱马仕", "迪士尼", "乐高", "lego"],
  warnKeywords: ["食品", "零食", "保健", "化妆", "护肤", "面膜", "婴儿", "玩具", "充电", "电池", "插座", "电器", "灯"],
};
const EXTREME_WORDS = [
  "最", "第一", "唯一", "顶级", "极致", "国家级", "全网", "首个", "独家", "绝对", "100%", "百分百", "史上", "万能",
  "特效", "包治", "永久", "秒杀", "全球", "世界级", "极品", "无敌", "正品", "官方", "旗舰", "驰名", "免检", "特供", "专供",
  "爆款", "清仓", "批发", "厂家", "工厂", "直销", "一件代发", "代发", "跨境", "1688", "淘宝", "天猫", "京东", "拼多多", "现货", "定制", "热卖", "货源",
];

// ───────────────────────── 小工具 ─────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round2 = (n) => Math.round(n * 100) / 100;
const uniq = (a) => [...new Set(a)];
const ts = () => new Date().toLocaleTimeString();

function makeStep(job) {
  const step = async (msg, patch = {}) => {
    console.log(`[${ts()}] ${msg}`);
    if (job) {
      job.logs.push({ t: new Date().toISOString(), m: msg });
      if (job.logs.length > 300) job.logs.shift();
      Object.assign(job, patch, { updatedAt: new Date().toISOString() });
    }
  };
  step.report = async (patch) => { if (job) Object.assign(job, patch, { updatedAt: new Date().toISOString() }); };
  return step;
}

async function waitForHuman(page, isDone, msg, step, timeoutMs = 10 * 60 * 1000) {
  await step(`⏸ 需要你在弹出的浏览器里操作：${msg}`, { stage: `等待你操作：${msg}` });
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await isDone().catch(() => false)) {
      await step("▶ 检测到已完成，继续");
      return;
    }
    await sleep(1500);
  }
  throw new Error(`等待人工操作超时：${msg}`);
}

// ───────────────────────── 浏览器 ─────────────────────────
async function openBrowser() {
  if (flags.cdp) {
    const url = flags.cdp === true ? "http://127.0.0.1:9222" : flags.cdp;
    const browser = await chromium.connectOverCDP(url);
    const context = browser.contexts()[0] || (await browser.newContext());
    return { context, close: () => browser.close() };
  }
  const dir = path.resolve(flags.profile || "chrome-profile");
  const channels = flags.channel ? [flags.channel] : ["chrome", "msedge"];
  let lastErr;
  for (const channel of channels) {
    try {
      const context = await chromium.launchPersistentContext(dir, {
        channel,
        headless: false,
        viewport: null,
        args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
        ignoreDefaultArgs: ["--enable-automation"],
      });
      return { context, close: () => context.close() };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    "无法启动 Chrome / Edge（请确认已安装，且没有别的 Chrome 正在占用同一个 chrome-profile）：" + (lastErr?.message || "")
  );
}

// ───────────────────────── 1688 采集 ─────────────────────────
async function gate1688(page, context, step) {
  const blocked = async () => {
    const url = page.url();
    if (/login\.(1688|taobao)\.com|passport\.1688\.com|havanaone|\/member\/login/.test(url)) return "登录 1688";
    if (/punish|_____tmd_____|x5secdata|captcha/.test(url)) return "完成滑块验证";
    const head = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
    if (/请拖动下方滑块|请按住滑块|滑动验证|验证码拦截|Access Denied/.test(head.slice(0, 2000))) return "完成滑块验证";
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      const t = await f.locator("body").innerText({ timeout: 800 }).catch(() => "");
      if (/请拖动下方滑块|请按住滑块/.test(t)) return "完成滑块验证";
    }
    return null;
  };
  const why = await blocked();
  if (!why) return;
  await waitForHuman(page, async () => !(await blocked()), `1688 需要你${why}`, step);
  await sleep(2500);
}

/** 在页面内执行：尽可能从页面全局数据 + DOM 里拿到商品信息 */
function scrapePage() {
  const out = {
    title: "", titleDom: "", images: [], domImages: [], detailImages: [], skuProps: [], skuMap: null,
    tiers: [], minOrderField: null, descUrl: "", attrs: {}, seller: "", text: "", domPrices: [], stockField: null,
  };
  const imgKey = /^(offerImgList|imageList|imgList|images|mainImages|mainImageList|gallery|galleryList|offerImages)$/i;
  const tierKey = /^(priceRanges|priceRange|offerPriceRanges|priceTierList|currentPrices)$/i;
  const pickImg = (it) =>
    typeof it === "string"
      ? it
      : it && (it.fullPathImageURI || it.originalImageURI || it.imageURI || it.imgUrl || it.url || it.fullPath || it.src || it.big || it.original || it.imageUrl);
  const seen = new WeakSet();
  let count = 0;
  function walk(o, depth) {
    if (!o || typeof o !== "object" || depth > 14 || count > 300000 || seen.has(o)) return;
    if (typeof Node !== "undefined" && o instanceof Node) return;
    if (o === window) return;
    seen.add(o);
    let keys;
    try { keys = Object.keys(o); } catch { return; }
    for (const k of keys) {
      count++;
      let v;
      try { v = o[k]; } catch { continue; }
      if (typeof v === "string") {
        if (/^(subject|offerTitle|productTitle)$/.test(k) && v.length > 4 && !out.title) out.title = v;
        else if (/^(detailUrl|descUrl)$/.test(k) && /^(https?:)?\/\//.test(v) && !out.descUrl) out.descUrl = v;
        else if (/^(sellerLoginId|companyName)$/.test(k) && !out.seller) out.seller = v;
      } else if (typeof v === "number") {
        if (/^(minOrderQuantity|minOrderQty)$/.test(k) && out.minOrderField === null) out.minOrderField = v;
        if (/^(canBookCount|totalCanBookCount)$/.test(k) && out.stockField === null) out.stockField = v;
      } else if (Array.isArray(v)) {
        if (imgKey.test(k)) {
          for (const it of v) { const u = pickImg(it); if (u) out.images.push(u); }
        } else if (tierKey.test(k)) {
          for (const it of v) {
            if (it && typeof it === "object")
              out.tiers.push({ begin: Number(it.beginAmount ?? it.startQuantity ?? it.begin ?? it.quantity ?? 1), price: Number(it.price ?? it.discountPrice ?? it.value) });
          }
        } else if (k === "skuProps" && !out.skuProps.length) {
          out.skuProps = v.map((p) => ({
            prop: String(p.prop || p.name || ""),
            value: (p.value || []).map((x) => ({ name: String(x.name || x.value || ""), imageUrl: x.imageUrl || x.imgUrl || "" })),
          }));
        } else if (/^(attributes|featureAttributes|productFeatureList|offerAttributes)$/.test(k)) {
          for (const it of v) {
            const n = it && (it.name || it.attributeName || it.fid);
            const val = it && (it.value || it.attributeValue || it.values);
            if (n && val) out.attrs[String(n)] = String(Array.isArray(val) ? val.join(",") : val);
          }
        }
      } else if (v && typeof v === "object" && /^(skuInfoMap|skuMap)$/.test(k) && !Array.isArray(v) && !out.skuMap) {
        out.skuMap = {};
        for (const [sk, x] of Object.entries(v)) {
          if (x && typeof x === "object")
            out.skuMap[sk] = { price: x.discountPrice ?? x.price ?? null, canBookCount: x.canBookCount ?? x.stock ?? null, skuId: x.skuId ?? null };
        }
      }
      if (v && typeof v === "object") walk(v, depth + 1);
    }
  }
  for (const k of ["context", "__INIT_DATA", "__INITIAL_STATE__", "__GLOBAL_DATA", "__STORE_DATA__"]) {
    try { if (window[k]) walk(window[k], 0); } catch { /* ignore */ }
  }
  const imgSrc = (i) => i.getAttribute("data-lazyload-src") || i.getAttribute("data-src") || i.getAttribute("data-lazy-src") || i.currentSrc || i.src;
  out.titleDom = (document.querySelector("h1")?.innerText || document.title || "").replace(/\s*[-_—]\s*(阿里巴巴|1688).*$/, "").trim();
  const gallerySel = '[class*="gallery"] img, [class*="Gallery"] img, [class*="mainImg"] img, [class*="offerImg"] img, [class*="od-gallery"] img, [class*="img-list"] img, [class*="thumb"] img';
  document.querySelectorAll(gallerySel).forEach((i) => out.domImages.push(imgSrc(i)));
  const og = document.querySelector('meta[property="og:image"]')?.content;
  if (og) out.domImages.push(og);
  const detailSel = '#detailContentContainer img, #description img, #desc-lazyload-container img, [class*="detail-desc"] img, [class*="html-description"] img, [class*="description"] img, [class*="od-pc-offer-description"] img, [id*="desc"] img';
  document.querySelectorAll(detailSel).forEach((i) => out.detailImages.push(imgSrc(i)));
  document.querySelectorAll('[class*="price"], [class*="Price"]').forEach((e) => {
    const m = (e.innerText || "").match(/[¥￥]\s*(\d+(?:\.\d{1,2})?)/g);
    if (m) m.slice(0, 4).forEach((x) => out.domPrices.push(parseFloat(x.replace(/[^\d.]/g, ""))));
  });
  out.text = (document.body.innerText || "").slice(0, 30000);
  return out;
}

const normImg = (u) => {
  if (!u || typeof u !== "string") return null;
  u = u.trim();
  if (u.startsWith("//")) u = "https:" + u;
  if (!/^https?:\/\//.test(u)) return null;
  if (!/alicdn\.com|aliimg\.com|1688\.com/.test(u)) return null;
  if (/\.(gif|svg)(\?|$)/i.test(u)) return null;
  const tps = u.match(/tps-(\d+)-(\d+)/);
  if (tps && (+tps[1] < 300 || +tps[2] < 300)) return null; // 图标/小横幅
  if (/sprite|logo|avatar|icon/i.test(u)) return null;
  u = u.replace(/(\.(?:jpg|jpeg|png))_[^/]*$/i, "$1").replace(/_\d+x\d+(?:q\d+)?\.(jpg|jpeg|png|webp)$/i, ".$1");
  return u;
};

async function extract1688(page, context, offerId, step) {
  const url = `https://detail.1688.com/offer/${offerId}.html`;
  await step(`打开 1688 商品页 ${url}`, { stage: "读取 1688 商品" });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await gate1688(page, context, step);
  await sleep(3000);
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 1400);
    await sleep(450);
  }
  await gate1688(page, context, step);
  await page.evaluate(() => window.scrollTo(0, 0));
  const raw = await page.evaluate(scrapePage);

  // 详情长图：有时在单独的 desc 接口里
  let descImgs = [];
  if (raw.descUrl) {
    try {
      const html = await page.evaluate(async (u) => (await fetch(u.startsWith("//") ? "https:" + u : u)).text(), raw.descUrl);
      descImgs = [...html.matchAll(/src=\\?["']([^"'\\]+)/g)].map((m) => m[1]);
    } catch { /* ignore */ }
  }

  const text = raw.text || "";
  const unavailable = /商品已下架|该商品已失效|offer已下架|商品已过期|商品不存在|您访问的页面不存在|没有找到相关/.test(text.slice(0, 4000));

  // 图片
  const gallery = uniq([...raw.images, ...raw.domImages].map(normImg).filter(Boolean)).slice(0, 10);
  const detailImages = uniq([...raw.detailImages, ...descImgs].map(normImg).filter(Boolean)).filter((u) => !gallery.includes(u)).slice(0, 30);

  // 只从“代发下单”区域读取单件代发价与运费，避免误用批发阶梯价。
  const dropshipSection = text.includes("代发下单")
    ? text.split("代发下单").slice(1).join("代发下单").split(/官方仓退货|商家代发热度|铺货素材预览/)[0]
    : "";
  const onePiecePriceMatch = dropshipSection.match(/(?:1件价格|一件价格)[\s\S]{0,24}?[¥￥]\s*([\d.]+)/);
  const onePiecePrice = onePiecePriceMatch ? Number(onePiecePriceMatch[1]) : null;
  const shipMatch = dropshipSection.match(/(?:运费|快递费)\s*[¥￥]?\s*(\d+(?:\.\d{1,2})?)\s*(?:元)?(?:起)?/);
  const singlePieceFreeShip = /(?:1件|一件)[^\n]{0,20}包邮|包邮[^\n]{0,20}(?:1件|一件)/.test(dropshipSection);
  const multiPieceOnlyFreeShip = /(?:满?\s*2件包邮|2件起包邮|≥\s*2件包邮|两件包邮)/.test(dropshipSection);
  const genericSinglePriceFreeShip = /包邮/.test(dropshipSection) && /(?:1件价格|一件价格)/.test(dropshipSection) && !multiPieceOnlyFreeShip;
  const freeShip = singlePieceFreeShip || genericSinglePriceFreeShip;
  const onePieceDropship = /一件代发|1件代发|1件价格|一件价格|1件包邮|一件包邮|1件起发|一件起发/i.test(dropshipSection);

  // 规格
  const dims = (raw.skuProps || []).filter((d) => d.prop && d.value.length).slice(0, 3);
  const baseTier = raw.tiers.filter((t) => t.price > 0).sort((a, b) => a.begin - b.begin)[0];
  const domMin = raw.domPrices.filter((n) => n > 0).sort((a, b) => a - b)[0];
  let baseCost = onePiecePrice || baseTier?.price || domMin || 0;
  const skus = [];
  if (raw.skuMap) {
    for (const [key, v] of Object.entries(raw.skuMap)) {
      const attrs = key.split(/&gt;|>/).map((s) => s.trim()).filter(Boolean);
      const price = parseFloat(v.price);
      // SKU价格若低于代发区单件价，按较高者计，避免误用批发SKU价低估成本。
      const skuCost = price > 0 ? (onePiecePrice > 0 ? Math.max(price, onePiecePrice) : price) : baseCost;
      const img = dims[0]?.value.find((x) => x.name === attrs[0])?.imageUrl || "";
      skus.push({ name: attrs.join(" / "), attrs, cost: skuCost, stock: Number(v.canBookCount) || 0, image: normImg(img) || "" });
    }
  }
  if (!baseCost && skus.length) baseCost = Math.min(...skus.map((s) => s.cost).filter((n) => n > 0));

  // 起批量
  let minOrder = null;
  if (raw.tiers.length) minOrder = Math.min(...raw.tiers.map((t) => t.begin).filter((n) => n > 0));
  if (!minOrder && raw.minOrderField) minOrder = raw.minOrderField;
  if (!minOrder) {
    const m = text.match(/(\d+)\s*[\u4e00-\u9fa5]{1,2}\s*起批/) || text.match(/≥\s*(\d+)/);
    if (m) minOrder = parseInt(m[1], 10);
  }

  // 服务标签
  const hours = [...text.matchAll(/(\d+)\s*小时\s*(?:内)?\s*发货/g)].map((m) => parseInt(m[1], 10));
  if (/当天发货|当日发货|次日发/.test(text)) hours.push(24);
  const flags2 = {
    dropship: /一件代发|支持代发|代发/.test(dropshipSection),
    onePieceDropship,
    onePiecePrice,
    sevenDay: /7天(?:无理由|包换)|七天无理由/.test(text),
    freeShip,
    shippingCost: freeShip ? 0 : shipMatch ? Number(shipMatch[1]) : null,
    shipHours: hours.length ? Math.min(...hours) : null,
  };

  const title = (raw.title || raw.titleDom || "").trim();
  const product = {
    offerId,
    url,
    title,
    seller: raw.seller,
    unavailable,
    cost: round2(baseCost || 0),
    onePiecePrice,
    minOrder,
    stock: raw.stockField ?? (skus.length ? skus.reduce((a, s) => a + s.stock, 0) : null),
    gallery,
    detailImages,
    dims: dims.map((d) => ({ name: d.prop, values: d.value.map((v) => v.name) })),
    skus,
    attrs: raw.attrs,
    flags: flags2,
    tiers: raw.tiers.filter((t) => t.price > 0),
    skuRead: skus.length > 0,
  };
  await step(
    `读取完成：标题「${title.slice(0, 30)}」成本 ¥${product.cost} 主图 ${gallery.length} 详情图 ${detailImages.length} 规格 ${skus.length}`
  );
  return product;
}

// ───────────────────────── 判断 + 定价 ─────────────────────────
const hit = (hay, kw) => {
  const k = kw.toLowerCase();
  if (/^[a-z0-9 :]+$/.test(k)) return new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(hay);
  return hay.includes(k);
};


function evaluate(p, cfg) {
  const reasons = [];
  const add = (level, code, msg) => reasons.push({ level, code, msg });

  if (p.unavailable) add("block", "unavailable", "1688 商品已下架/失效，或页面不存在");
  if (!p.title) add("block", "no_title", "没读到商品标题（可能被验证页拦截）");
  if (p.gallery.length === 0) add("block", "no_images", "没读到商品主图");
  else if (p.gallery.length < 3) add("warn", "few_images", `主图只有 ${p.gallery.length} 张，拼多多要求至少 3 张，会用 SKU 图/详情图补`);
  if (!(p.cost > 0)) add("block", "no_price", "没读到价格");
  if (p.minOrder && p.minOrder > cfg.maxMinOrder && !p.flags.onePieceDropship) add("warn", "min_order", `起批量 ${p.minOrder}，未识别到一件代发标识；先继续流程，发布前请核实能否单件采购`);

  const hay = [p.title, ...Object.values(p.attrs || {}), ...p.skus.map((s) => s.name)].join(" ").toLowerCase();
  const bad = cfg.bannedKeywords.filter((k) => hit(hay, k));
  if (bad.length) add("block", "banned", `命中拼多多违禁/禁售词：${bad.join("、")}`);
  const brands = cfg.brandKeywords.filter((k) => hit(hay, k));
  if (brands.length) add("warn", "brand", `含品牌词：${brands.join("、")}（需确认授权；流程测试阶段先不自动淘汰）`);
  const warns = cfg.warnKeywords.filter((k) => hit(hay, k));
  if (warns.length) add("warn", "qualification", `可能需要类目资质/3C/备案：${warns.join("、")}`);
  const brandAttr = p.attrs?.["品牌"];
  if (brandAttr && !/^(无|无品牌|其他|其它|不详|暂无|-)$/.test(brandAttr.trim()) && !brands.length)
    add("warn", "brand_attr", `1688 属性里品牌=「${brandAttr}」，拼多多品牌需授权，上架会填“无品牌”`);

  if (!p.flags.sevenDay) add("warn", "no_7day", "页面没看到“7天无理由”，拼多多多数类目强制要求");
  if (p.flags.shipHours && p.flags.shipHours > cfg.promiseHours)
    add("warn", "ship_slow", `货源发货时效 ${p.flags.shipHours} 小时，超过设置的 ${cfg.promiseHours} 小时；先继续流程，发布前需调整承诺时效`);
  if (!p.flags.onePieceDropship) add("warn", "no_dropship", "未识别到明确的一件代发标识；先使用读取到的价格估算，发布前请核实单件采购条件");
  if (!(p.onePiecePrice > 0)) add("warn", "dropship_price_unknown", "未读取到代发区域明确的 1 件价格；暂用可读取的 SKU/商品价格估算，发布前必须核实单件价格");
  if (!Number.isFinite(p.flags.shippingCost)) add("warn", "shipping_unknown", `未读取到明确运费；暂按本机设置的 ¥${cfg.shippingCost} 估算，发布前请核实实际单件运费`);
  if (p.dims.length > 2) add("warn", "many_dims", `规格维度 ${p.dims.length} 个，拼多多最多 2 个，需手动合并`);
  if (p.skus.length > 50) add("warn", "many_skus", `SKU ${p.skus.length} 个，较多`);
  if (!p.skuRead) add("warn", "sku_unread", "没读到规格明细，按单规格处理（有多规格的话需要手动补）");
  if (p.stock === 0) add("block", "no_stock", "货源库存为 0");
  else if (p.stock != null && p.stock < 10) add("warn", "low_stock", `货源库存只有 ${p.stock}`);

  // 定价
  const list = p.skus.length ? p.skus : [{ name: "默认", attrs: ["默认"], cost: p.cost, stock: p.stock || 0, image: "" }];
  const effectiveShipping = Number.isFinite(p.flags.shippingCost) ? p.flags.shippingCost : cfg.shippingCost;
  const skuPricing = list.map((s) => {
    const pr = priceSku(s.cost > 0 ? s.cost : p.cost, cfg, effectiveShipping);
    return { name: s.name, attrs: s.attrs, image: s.image, stock: Math.max(1, Math.min(cfg.defaultStock, s.stock > 0 ? s.stock : cfg.defaultStock)), ...pr };
  });
  const minProfit = Math.min(...skuPricing.map((s) => s.profit));
  const worst = Math.max(...skuPricing.map((s) => s.group / Math.max(s.landedCost, 0.01)));
  if (p.cost > 0 && worst > MAX_PRICE_MULTIPLE)
    add("warn", "high_price_multiple", `含运费到岸成本下，目标利润售价需要达到成本的 ${round2(worst)} 倍；超过参考倍数 ${MAX_PRICE_MULTIPLE}，先继续流程，建议人工对比市场价`);
  const pricing = {
    skus: skuPricing,
    minProfit: round2(minProfit),
    maxGroup: Math.max(...skuPricing.map((s) => s.group)),
    assumptions: { targetRoi: cfg.targetRoi, pddFeePercent: cfg.pddFeePercent, afterSalesLossPercent: cfg.afterSalesLossPercent, minProfit: cfg.minProfit },
  };

  const verdict = reasons.some((r) => r.level === "block") ? "blocked" : reasons.some((r) => r.level === "warn") ? "warn" : "ok";
  if (verdict === "ok") add("info", "ok", "未发现问题，可以上架");
  return { verdict, canList: verdict === "ok" || (verdict === "warn" && cfg.allowWarn), reasons, pricing };
}

function buildPddTitle(title) {
  let t = title;
  for (const w of EXTREME_WORDS) t = t.split(w).join(" ");
  t = t.replace(/[【】\[\]()（）{}<>《》|丨\/\\,，。!！?？~～·•★☆♥❤✔✓+_:：;；"'“”‘’]/g, " ").replace(/\s+/g, " ").trim();
  const width = (s) => [...s].reduce((a, c) => a + (/[\u0000-\u00ff]/.test(c) ? 1 : 2), 0);
  if (t.length < 4) t = title.replace(/\s+/g, " ").trim();
  let out = "";
  for (const c of t) {
    if (width(out + c) > 60) break;
    out += c;
  }
  return out.trim();
}

// ───────────────────────── 图片下载 ─────────────────────────
async function downloadImages(urls, dir, prefix, step) {
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  let n = 0;
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { "user-agent": UA, referer: "https://detail.1688.com/" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 3000) continue;
      const ct = r.headers.get("content-type") || "";
      const ext = /png/.test(ct) ? "png" : /webp/.test(ct) ? "webp" : "jpg";
      const f = path.join(dir, `${prefix}${String(++n).padStart(2, "0")}.${ext}`);
      fs.writeFileSync(f, buf);
      files.push(f);
    } catch (e) {
      await step(`图片下载失败 ${u.slice(-40)}：${e.message}`);
    }
  }
  return files;
}

// ───────────────────────── 拼多多后台 ─────────────────────────
const PDD_CATEGORY_URL = "https://mms.pinduoduo.com/goods/category";
const isFormUrl = (u) => /goods_add|goods_edit|goods\/edit|goods\/add/.test(u);

// 拼多多首图控件的 accept 只有 image/jpeg,image/png，而 1688 对 Chrome UA 常返回 webp。
// downloadImages 的扩展名来自 content-type，不可信，一律按文件头判定真实格式。
const PDD_IMAGE_KINDS = ["jpeg", "png"];

function sniffImageKind(file) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const head = Buffer.alloc(16);
    const n = fs.readSync(fd, head, 0, 16, 0);
    if (n >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
    if (n >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
    if (n >= 12 && head.subarray(0, 4).toString("latin1") === "RIFF" &&
        head.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
    if (n >= 6 && head.subarray(0, 6).toString("latin1").startsWith("GIF8")) return "gif";
    if (n >= 2 && head[0] === 0x42 && head[1] === 0x4d) return "bmp";
    return "unknown";
  } catch {
    return "unreadable";
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// 首图优先取真实格式为 jpeg/png 的那张；全都不合时仍返回第一张，
// 由 uploadCategoryCover 报出具体格式，而不是在这里悄悄换图或假装没图。
function pickCoverImage(gallery) {
  return gallery.find((f) => PDD_IMAGE_KINDS.includes(sniffImageKind(f))) || gallery[0];
}

async function clickText(page, re, timeout = 4000) {
  const cands = [
    page.getByRole("button", { name: re }),
    page.locator("button,a,[role=button],[class*=btn],[class*=Btn]").filter({ hasText: re }),
    page.getByText(re),
  ];
  for (const c of cands) {
    const l = c.first();
    if (await l.isVisible().catch(() => false)) {
      await l.click({ timeout }).catch(() => {});
      return true;
    }
  }
  return false;
}

/** 从文字标签向上找最近的、包含 innerSel 元素的容器，并给目标元素打标记 */
async function tagNear(page, labelRe, innerSel, visibleOnly = true) {
  return page.evaluate(
    ({ src, innerSel, visibleOnly }) => {
      const re = new RegExp(src);
      document.querySelectorAll("[data-agent-t]").forEach((e) => e.removeAttribute("data-agent-t"));
      const cands = [...document.querySelectorAll("label,span,div,p,td,th,h1,h2,h3,h4,b,strong")].filter((e) => {
        const t = (e.innerText || "").trim();
        return e.children.length <= 3 && t.length > 0 && t.length < 24 && re.test(t);
      });
      for (const c of cands) {
        let n = c;
        for (let i = 0; i < 8 && n; i++) {
          n = n.parentElement;
          if (!n) break;
          const found = [...n.querySelectorAll(innerSel)].find((x) => !visibleOnly || x.getClientRects().length > 0);
          if (found) {
            found.setAttribute("data-agent-t", "1");
            return true;
          }
        }
      }
      return false;
    },
    { src: labelRe.source, innerSel, visibleOnly }
  );
}

const TEXT_INPUT = "input:not([type=file]):not([type=hidden]):not([type=radio]):not([type=checkbox]),textarea";

async function fillByLabel(page, labelRe, value) {
  if (!(await tagNear(page, labelRe, TEXT_INPUT, true))) throw new Error(`找不到输入框：${labelRe}`);
  const el = page.locator('[data-agent-t="1"]').first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await el.fill(String(value));
}

async function uploadByLabel(page, labelRe, files, step) {
  if (!files.length) throw new Error("没有可上传的图片");
  if (!(await tagNear(page, labelRe, "input[type=file]", false))) throw new Error(`找不到上传控件：${labelRe}`);
  const el = page.locator('[data-agent-t="1"]').first();
  const multiple = await el.getAttribute("multiple").catch(() => null);
  if (multiple !== null) await el.setInputFiles(files);
  else
    for (const f of files) {
      if (!(await tagNear(page, labelRe, "input[type=file]", false))) break;
      await page.locator('[data-agent-t="1"]').first().setInputFiles(f);
      await sleep(1800);
    }
  await sleep(2500 + files.length * 700);
  await step(`  已上传 ${files.length} 张（${labelRe.source}）`);
}

async function fillSkuTable(page, pricing) {
  const tables = page.locator("table");
  const n = await tables.count();
  for (let t = 0; t < n; t++) {
    const table = tables.nth(t);
    let heads = await table.locator("thead th, thead td").allInnerTexts().catch(() => []);
    if (!heads.length) heads = await table.locator("tr").first().locator("th,td").allInnerTexts().catch(() => []);
    const idx = (re) => heads.findIndex((h) => re.test(h.replace(/[*＊]/g, "").trim()));
    const gi = idx(/拼单价|团购价/), si = idx(/单买价/), ki = idx(/库存/);
    if (gi < 0 && ki < 0) continue;
    let rows = table.locator("tbody tr");
    if (!(await rows.count())) rows = table.locator("tr").filter({ has: page.locator("input") });
    const rc = await rows.count();
    let filled = 0;
    for (let r = 0; r < rc; r++) {
      const row = rows.nth(r);
      const text = await row.innerText().catch(() => "");
      if (/拼单价|团购价/.test(text) && /单买价/.test(text)) continue;
      let sku = pricing.skus.length === 1
        ? pricing.skus[0]
        : pricing.skus.find((s) => s.attrs?.length && s.attrs.every((a) => text.includes(a)));
      // 拼多多 SKU 行有时只显示“已启用”，不展示规格文本；仅当行数与源 SKU 数完全一致时按行序对应。
      if (!sku && rc === pricing.skus.length) sku = pricing.skus[r];
      if (!sku) continue;
      const cells = row.locator("td");
      const setCell = async (i, val) => {
        if (i < 0) return;
        const inp = cells.nth(i).locator('input:not([type=checkbox]):not([type=radio]):not([type=hidden])').first();
        if (await inp.count() && await inp.isVisible().catch(() => false)) {
          await inp.fill(String(val));
          filled++;
        }
      };
      await setCell(gi, sku.group);
      await setCell(si, sku.single);
      await setCell(ki, sku.stock);
    }
    if (filled) return filled;
  }
  return 0;
}

async function addSpecs(page, product, step) {
  const dims = product.dims.slice(0, 2);
  if (!dims.length || !product.skuRead) return;
  const nameInputs = page.locator('input[placeholder*="规格类型"], input[placeholder*="规格名"], input[placeholder*="请选择规格"]');
  const nameCount = await nameInputs.count();
  const valueInputs = page.locator('input[placeholder*="规格值"], input[placeholder*="添加规格值"], input[placeholder*="输入规格"], input[placeholder="请输入规格名称"], input[placeholder="自定义款式"], input[placeholder="自定义组合"]');
  let valueCursor = 0;
  let added = 0;
  for (let i = 0; i < dims.length; i++) {
    const d = dims[i];
    const ni = nameInputs.nth(i);
    if (i < nameCount && await ni.isVisible().catch(() => false)) {
      const current = await ni.getAttribute("value").catch(() => "");
      if (!current || current.startsWith("规格类型")) {
        await ni.fill(d.name.slice(0, 20));
        await ni.press("Enter").catch(() => {});
      }
    }
    // 兼容拼多多当前类目表单中的“自定义款式/自定义组合”规格值输入框。
    let vi = valueInputs.nth(i);
    if (!(await vi.isVisible().catch(() => false))) {
      vi = valueInputs.nth(valueCursor);
    }
    if (!(await vi.isVisible().catch(() => false))) {
      await step(`  ⚠ 规格「${d.name}」未找到可见规格值输入框，保留页面供人工检查`);
      continue;
    }
    for (const v of d.values.slice(0, 30)) {
      await vi.fill(String(v).slice(0, 20));
      await vi.press("Enter").catch(() => {});
      await sleep(250);
      added++;
    }
    valueCursor++;
  }
  await step(`  规格录入完成：${dims.map((d) => d.name).join(" / ")}；已提交 ${added} 个规格值`);
  await sleep(1000);
}

async function pickCategory(page, context, pddTitle, cfg, step) {
  const kws = [flags.category, cfg.categoryHint, pddTitle.slice(0, 30), pddTitle.slice(-8), pddTitle.slice(0, 8)].filter(Boolean);
  const input = page
    .locator('input[placeholder*="类目"], input[placeholder*="商品名称"], input[placeholder*="搜索"], input[placeholder*="关键"]')
    .first();
  let picked = false;
  for (const kw of kws) {
    if (!(await input.isVisible().catch(() => false))) break;
    await step(`  搜索类目：${kw}`);
    await input.fill("").catch(() => {});
    await input.fill(kw).catch(() => {});
    await input.press("Enter").catch(() => {});
    await sleep(2200);
    const sug = page.locator("li, [class*=item], [class*=option], [class*=result]").filter({ hasText: />/ }).first();
    if (await sug.isVisible().catch(() => false)) {
      await sug.click().catch(() => {});
      picked = true;
      break;
    }
  }
  if (picked) {
    await sleep(800);
    await clickText(page, /确认发布该类目|确定发布该类目|确认并下一步|确认类目|下一步|确定/);
  }
  const findForm = () => context.pages().find((p) => isFormUrl(p.url()));
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    const f = findForm();
    if (f) return f;
    if (await page.getByText(/商品标题/).first().isVisible().catch(() => false)) return page;
    await sleep(800);
  }
  await waitForHuman(page, async () => !!findForm() || (await page.getByText(/商品标题/).first().isVisible().catch(() => false)), "自动选类目没成功：请手动选好类目并进入“商品发布表单”页面", step);
  return findForm() || page;
}

async function uploadCategoryCover(page, imagePath, step) {
  if (!imagePath || !fs.existsSync(imagePath)) throw new Error(`首图文件不存在：${imagePath || "(empty)"}`);
  const stat = fs.statSync(imagePath);
  if (!stat.size) throw new Error("首图文件大小为 0，无法上传");

  // 拼多多前端按 File.type 拒绝 accept 之外的格式：文件照样塞得进 input.files，
  // 但计数永远是 (0/10)。不先判格式就会把格式问题当成选择器问题排查 25 秒。
  const kind = sniffImageKind(imagePath);
  if (!PDD_IMAGE_KINDS.includes(kind)) {
    throw new Error(
      `首图真实格式为 ${kind}（按文件头判定，不看扩展名），拼多多首图控件只接受 jpeg/png：${imagePath}`
    );
  }
  await step(`  首图格式校验通过：${kind}`);

  // 拼多多当前 DOM 已确认：隐藏 file input 位于“本地上传”按钮内部。
  // 直接 setInputFiles 会被组件清空；必须走真实按钮触发的 filechooser。
  const candidates = [];
  const diagnostics = [];
  for (const frame of page.frames()) {
    const inputs = frame.locator('input[type="file"]');
    const count = await inputs.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const info = await input.evaluate((el) => {
        const button = el.closest("button");
        const section = el.closest('[class*="goodsCarousel_uploadImgEnter"]') ||
          el.closest('section[class*="goodsCarousel"]');
        return {
          accept: el.getAttribute("accept") || "",
          multiple: el.multiple,
          disabled: el.disabled,
          inputClass: String(el.className || ""),
          buttonText: (button?.innerText || "").trim(),
          buttonClass: String(button?.className || ""),
          sectionText: (section?.innerText || "").trim().replace(/\s+/g, " ").slice(0, 220),
          sectionClass: String(section?.className || ""),
          sectionImages: section?.querySelectorAll("img").length || 0
        };
      }).catch((e) => ({ error: e.message }));
      diagnostics.push({ frameUrl: frame.url(), index: i, ...info });
      const isLocalImageUpload =
        /image/i.test(info.accept || "") &&
        /本地上传/.test(info.buttonText || "") &&
        /goodsCarousel/.test((info.inputClass || "") + " " + (info.sectionClass || ""));
      if (!info.disabled && isLocalImageUpload) candidates.push({ frame, input, index: i, info });
    }
  }

  if (!candidates.length) {
    throw new Error(`未找到拼多多商品轮播图区域的“本地上传”控件。控件诊断=${JSON.stringify(diagnostics)}`);
  }

  const attempts = [];
  for (const candidate of candidates) {
    const { frame, input, index, info } = candidate;
    try {
      const before = await input.evaluate((el) => {
        const section = el.closest('[class*="goodsCarousel_uploadImgEnter"]') ||
          el.closest('section[class*="goodsCarousel"]');
        return {
          sectionText: (section?.innerText || "").trim().replace(/\s+/g, " "),
          sectionImages: section?.querySelectorAll("img").length || 0,
          bodyImages: document.querySelectorAll("img").length
        };
      });

      const button = input.locator("xpath=..");
      const chooserPromise = frame.page().waitForEvent("filechooser", { timeout: 10000 });
      // click 失败或有多个候选时，这个 promise 可能永远走不到 await。
      // 无 handler 的 rejection 会打死整个 Agent 进程（Node v15+ 默认 throw），
      // 连 HTTP 服务、任务状态和诊断日志一起消失。
      chooserPromise.catch(() => {});
      await button.click({ timeout: 10000 });
      let chooser;
      try {
        chooser = await chooserPromise;
      } catch (e) {
        // filechooser 不触发多半不是选择器问题：按钮可能没走 <input type=file>，
        // 而是用 File System Access API 打开选择器，那条路径不会触发本事件。
        const probe = await frame.evaluate(() => ({
          hasShowOpenFilePicker: typeof window.showOpenFilePicker === "function",
          fileInputCount: document.querySelectorAll('input[type="file"]').length,
          inputs: [...document.querySelectorAll('input[type="file"]')].slice(0, 5).map((el) => ({
            accept: el.getAttribute("accept") || "",
            cls: String(el.className || "").slice(0, 90),
            parentTag: el.parentElement?.tagName || "",
            nearestClickable: el.parentElement?.closest("button,[role=button],a")?.tagName || "",
            display: getComputedStyle(el).display,
            pointerEvents: getComputedStyle(el).pointerEvents,
          })),
          frameCount: window.frames.length,
          frameUrls: [...Array(window.frames.length)].map((_, i) => window.frames[i]?.location.href.slice(0, 120) || ""),
        })).catch((x) => ({ probeError: x.message }));
        // 弹窗/新标签页也会造成同样的现象：filechooser 落在那个 Page 上，
        // 而我们监听的是当前 input 所属的 Page。
        let pages = [];
        try { pages = frame.page().context().pages().map((p) => p.url().slice(0, 140)); } catch { /* ignore */ }
        throw new Error(
          `点击“本地上传”后 10 秒内没有收到 filechooser 事件（原始：${e.message.split("\n")[0]}）。` +
          `若 hasShowOpenFilePicker=true，说明该控件走的是 File System Access API，` +
          `永远不会触发 filechooser，需要换上传路径而不是换选择器；` +
          `若 pages 数量在本次点击后增加，说明选择器开在新标签页/弹窗里，当前 Page 收不到该事件。` +
          `pages=${JSON.stringify(pages)}；探测=${JSON.stringify(probe)}`
        );
      }
      await chooser.setFiles(imagePath);

      const deadline = Date.now() + 25000;
      let verified = null;
      while (Date.now() < deadline) {
        verified = await input.evaluate((el, oldState) => {
          const section = el.closest('[class*="goodsCarousel_uploadImgEnter"]') ||
            el.closest('section[class*="goodsCarousel"]');
          const sectionText = (section?.innerText || "").trim().replace(/\s+/g, " ");
          const sectionImages = section?.querySelectorAll("img").length || 0;
          const bodyImages = document.querySelectorAll("img").length;
          const countMatch = sectionText.match(/上传图片\s*[（(](\d+)\s*\/\s*10[）)]/);
          const oldCountMatch = oldState.sectionText.match(/上传图片\s*[（(](\d+)\s*\/\s*10[）)]/);
          const countIncreased = !!(countMatch && (!oldCountMatch || Number(countMatch[1]) > Number(oldCountMatch[1])));
          const imageIncreased = sectionImages > oldState.sectionImages;
          const uploadedState = /重新上传|更换图片|删除图片/.test(sectionText);
          return {
            ok: countIncreased || imageIncreased || uploadedState,
            sectionText,
            sectionImages,
            bodyImages,
            countIncreased,
            imageIncreased,
            uploadedState
          };
        }, before).catch((e) => ({ ok: false, error: e.message }));
        if (verified?.ok) break;
        await sleep(500);
      }

      if (verified?.ok) {
        await step(`  首图上传已验证：拼多多轮播图区域状态已变化（控件 index=${index}）`);
        return { frame, index, verified };
      }
      attempts.push({
        frameUrl: frame.url(), index, buttonText: info.buttonText,
        reason: "已通过本地上传按钮选择文件，但轮播图区域没有出现上传计数/预览变化",
        before, after: verified
      });
    } catch (e) {
      attempts.push({ frameUrl: frame.url(), index, reason: e.message });
    }
  }
  throw new Error(`已通过拼多多“本地上传”按钮尝试首图，但未检测到轮播图上传结果。尝试记录=${JSON.stringify(attempts)}；控件诊断=${JSON.stringify(diagnostics)}`);
}

async function prepareCategoryPage(page, context, pddTitle, firstImage, step) {
  // 先按 URL 判断当前所处阶段，避免拿详情页/登录页去套类目页选择器。
  const currentUrl = () => { try { return new URL(page.url()); } catch { return null; } };
  let u = currentUrl();
  if (u && isFormUrl(u.href)) {
    await step(`拼多多当前已在商品详情页，跳过阶段 1：${u.pathname}`);
    return page;
  }
  const isCategoryUrl = (url) => {
    try {
      const x = new URL(url);
      const pathname = x.pathname.endsWith("/") ? x.pathname.slice(0, -1) : x.pathname;
      return x.hostname === "mms.pinduoduo.com" && pathname === "/goods/category";
    } catch { return false; }
  };
  if (!isCategoryUrl(page.url())) {
    await step(`当前页面不是类目页（${page.url()}），重新打开类目入口`);
    await page.goto(PDD_CATEGORY_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  }
  await step("拼多多阶段 1/2：首图、标题与自动类目", { stage: "拼多多：填写标题并识别类目" });

  // 标题输入框可能由页面异步渲染，也可能位于 iframe；优先按实际 placeholder 识别。
  const titleSelectors = [
    'input[placeholder*="商品描述+规格"]',
    'input[placeholder*="最多输入30个汉字"]',
    'input[placeholder*="商品标题"]',
    'textarea[placeholder*="商品标题"]',
    'input[aria-label*="商品标题"]'
  ];
  let title = null;
  let titleFrame = null;
  const deadlineForTitle = Date.now() + 15000;
  while (Date.now() < deadlineForTitle && !title) {
    for (const frame of page.frames()) {
      for (const selector of titleSelectors) {
        const candidate = frame.locator(selector).first();
        if (await candidate.isVisible().catch(() => false)) {
          title = candidate;
          titleFrame = frame;
          break;
        }
      }
      if (title) break;
    }
    if (!title) await sleep(500);
  }
  if (!title) {
    const frames = page.frames().map(f => f.url()).join(" | ");
    throw new Error(`类目页标题框未找到；当前URL=${page.url()}；是否类目页=${isCategoryUrl(page.url())}；frames=${frames}`);
  }
  await uploadCategoryCover(page, firstImage, step);
  await title.fill(pddTitle);
  await title.press("Tab");
  await sleep(2600);

  const next = page.getByText(/下一步[，, ]*完善商品信息/).first();
  if (!(await next.isVisible().catch(() => false))) {
    throw new Error(`类目页未出现“下一步，完善商品信息”；当前URL=${page.url()}；请检查首图/标题是否填写成功`);
  }
  await next.click({ timeout: 10000 });
  await step("  已点击下一步，等待商品详情页");
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const form = context.pages().find((p) => isFormUrl(p.url()));
    if (form) {
      await form.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});
      return form;
    }
    if (isFormUrl(page.url())) return page;
    await sleep(400);
  }
  throw new Error(`点击下一步后未进入商品详情页（goods_add）；当前URL=${page.url()}`);
}
async function isPddLoginRequired(page) {
  let u;
  try { u = new URL(page.url()); } catch { return true; }
  const host = u.hostname.toLowerCase();
  const path = u.pathname.toLowerCase();
  if (/^(login|passport)(\.|$)/.test(host) || /(^|\/)(login|passport)(\/|$)/.test(path)) return true;

  // 不再用“页面出现账号登录/手机登录文字”作为唯一依据，避免把普通页面文案误判成未登录。
  const visibleLoginControl = await page.locator(
    'input[placeholder*="手机号"]:visible, input[placeholder*="手机号码"]:visible, input[placeholder*="验证码"]:visible, input[placeholder*="短信"]:visible'
  ).count().catch(() => 0);
  if (visibleLoginControl) {
    const body = await page.locator("body").innerText({ timeout: 1500 }).catch(() => "");
    if (/登录/.test(body) && /验证码|手机号|扫码/.test(body)) return true;
  }
  return false;
}

async function publishToPdd({ context, product, pricing, pddTitle, files, cfg, mode, step }) {
  let page = await context.newPage();
  await step("打开拼多多商家后台发布页", { stage: "拼多多：打开发布页" });
  await page.goto(PDD_CATEGORY_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await sleep(2500);
  if (await isPddLoginRequired(page)) {
    await step(`  当前拼多多页面需要登录：${page.url()}`);
    await waitForHuman(page, async () => {
      for (const candidate of context.pages()) {
        if (/mms\.pinduoduo\.com/.test(candidate.url()) && !(await isPddLoginRequired(candidate))) {
          page = candidate;
          return true;
        }
      }
      return !(await isPddLoginRequired(page));
    }, "请在当前弹出的拼多多浏览器页面完成登录；登录成功后会自动继续", step);
    if (!/mms\.pinduoduo\.com/.test(page.url())) {
      await page.goto(PDD_CATEGORY_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
      await sleep(2000);
    }
  }
  for (let i = 0; i < 3; i++) if (!(await clickText(page, /^(我知道了|知道了|以后再说|暂不|跳过)$/, 1500))) break;

  page = await prepareCategoryPage(page, context, pddTitle, pickCoverImage(files.gallery), step);
  await page.bringToFront();
  await sleep(1800);

  const problems = [];
  const attempt = async (name, fn) => {
    try {
      await fn();
      await step(`✔ ${name}`);
      return true;
    } catch (e) {
      problems.push(`${name}：${e.message.split("\n")[0]}`);
      await step(`✘ ${name}：${e.message.split("\n")[0]}`);
      return false;
    }
  };

  await step("填写商品表单", { stage: "拼多多：填写表单" });
  const okTitle = await attempt("商品标题", () => fillByLabel(page, /商品标题|商品名称/, pddTitle));
  const gal = [...files.gallery];
  for (const f of files.skuImages) if (gal.length < 3 && !gal.includes(f)) gal.push(f);
  for (const f of files.detail) if (gal.length < 3 && !gal.includes(f)) gal.push(f);
  const okImg = await attempt("商品轮播图", () => uploadByLabel(page, /商品轮播图|轮播图|商品主图/, gal.slice(0, 10), step));
  await attempt("商品详情图", () => uploadByLabel(page, /商品详情|商品详情图|图文详情|详情图/, (files.detail.length ? files.detail : files.gallery).slice(0, 20), step));
  await attempt("商品规格", () => addSpecs(page, product, step));
  let priced = 0;
  await attempt("价格/库存表", async () => {
    priced = await fillSkuTable(page, pricing);
    if (!priced) throw new Error("没找到价格库存表（需要先建好规格），请手动填价格");
  });
  if (!priced && pricing.skus.length === 1) {
    const s = pricing.skus[0];
    const a = await fillByLabel(page, /拼单价/, s.group).then(() => true).catch(() => false);
    await fillByLabel(page, /单买价/, s.single).catch(() => {});
    await fillByLabel(page, /库存/, s.stock).catch(() => {});
    if (a) priced = 1;
  }
  // 不自动填写虚构的“市场参考价”；仅填核算出的拼单价和单买价。
  await attempt(`承诺发货 ${cfg.promiseHours} 小时`, async () => {
    if (!(await clickText(page, new RegExp(`${cfg.promiseHours}\\s*小时`), 2000))) throw new Error("没找到选项");
  });
  if (cfg.shippingTemplate) {
    await attempt("运费模板", async () => {
      if (!(await tagNear(page, /运费模板/, "input, [class*=select]", true))) throw new Error("没找到运费模板选择框");
      await page.locator('[data-agent-t="1"]').first().click();
      await sleep(600);
      if (!(await clickText(page, new RegExp(cfg.shippingTemplate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), 2000))) throw new Error("没找到该模板");
    });
  }

  fs.mkdirSync(OUT, { recursive: true });
  const shot = path.join(OUT, `${product.offerId}-filled.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  await step(`表单截图：${shot}`);

  const complete = okTitle && okImg && priced > 0;
  if (mode !== "publish" || !complete) {
    const why = mode !== "publish" ? "填写模式：已停在提交前" : `自动填写不完整（${problems.join("；")}），未自动提交`;
    await step(`✅ ${why}。请在浏览器里检查/补全，再点“提交”。`, {
      status: "filled",
      stage: "已填好，等你确认提交",
      error: problems.length ? problems.join("\n") : "",
    });
    return { page, status: "filled" };
  }

  await step("点击提交上架", { stage: "拼多多：提交" });
  const clicked = await clickText(page, /提交并上架|提交上架|立即发布|发布商品|提交审核|提交/, 5000);
  if (!clicked) {
    await step("没找到提交按钮，请手动点击", { status: "filled", stage: "已填好，没找到提交按钮", error: "没找到提交按钮" });
    return { page, status: "filled" };
  }
  await sleep(2500);
  await clickText(page, /^(确认提交|确定|继续提交|仍要提交)$/, 2000);
  const t0 = Date.now();
  while (Date.now() - t0 < 25000) {
    const okText = await page.getByText(/提交成功|发布成功|操作成功|创建成功/).first().isVisible().catch(() => false);
    if (okText || /goods_list|goods\/list|success/.test(page.url())) {
      const m = (page.url() + " " + (await page.locator("body").innerText().catch(() => ""))).match(/goods_?id[=:：]?\s*(\d{6,})|商品ID[：:]\s*(\d{6,})/i);
      await step("🎉 拼多多提示提交成功", { status: "published", stage: "已提交上架", pddGoodsId: m ? m[1] || m[2] : "" });
      return { page, status: "published" };
    }
    await sleep(1000);
  }
  const errs = await page.locator("text=/请输入|请选择|请上传|不能为空|必填|不符合/").allInnerTexts().catch(() => []);
  const msg = errs.length ? uniq(errs).slice(0, 6).join("；") : "提交后未检测到成功提示";
  await step(`⚠ 提交可能被拦截：${msg}。页面已保留，请手动处理。`, { status: "filled", stage: "提交被拦截，等你处理", error: msg });
  return { page, status: "filled" };
}

// ───────────────────────── 任务流水线 ─────────────────────────
async function runJob({ context, job, cfg, step, mode }) {
  const offerId = job.offerId;
  const outDir = path.join(OUT, offerId);
  fs.mkdirSync(outDir, { recursive: true });
  let page = await context.newPage();
  let keepPage = null;
  try {
    // 提醒登录状态（不阻塞）
    const ck = await context.cookies("https://www.1688.com").catch(() => []);
    if (!ck.some((c) => c.name === "__cn_logon__" && c.value === "true"))
      await step("⚠ 似乎还没登录 1688，价格/代发信息可能读不全。可先运行 node agent.mjs login");

    const product = await extract1688(page, context, offerId, step);
    await page.close().catch(() => {});
    page = null;

    const ev = evaluate(product, cfg);
    const pddTitle = buildPddTitle(product.title);
    for (const r of ev.reasons) await step(`${r.level === "block" ? "⛔" : r.level === "warn" ? "⚠" : "✔"} ${r.msg}`);
    const summary = { ...product, text: undefined };
    fs.writeFileSync(path.join(outDir, "product.json"), JSON.stringify({ product: summary, ...ev, pddTitle }, null, 2));

    const base = { title: product.title, pddTitle, verdict: ev.verdict, reasons: ev.reasons, product: summary, pricing: ev.pricing };
    if (!ev.canList) {
      await step("判断结果：不建议上架", { ...base, status: "rejected", stage: "不能上架" });
      return { status: "rejected", verdict: ev.verdict, reasons: ev.reasons, pricing: ev.pricing };
    }
    if (mode === "check") {
      await step(`判断结果：可以上架（${ev.verdict === "ok" ? "无问题" : "有警告"}），建议拼单价 ¥${ev.pricing.maxGroup}`, { ...base, status: "eligible", stage: "可以上架" });
      return { status: "eligible", verdict: ev.verdict, reasons: ev.reasons, pricing: ev.pricing };
    }
    await step("判断结果：可以上架，开始准备素材", { ...base, stage: "下载图片" });

    const skuImgs = uniq(product.skus.map((s) => s.image).filter(Boolean));
    const files = {
      gallery: await downloadImages(product.gallery, path.join(outDir, "gallery"), "g", step),
      skuImages: await downloadImages(skuImgs.slice(0, 6), path.join(outDir, "sku"), "s", step),
      detail: await downloadImages(product.detailImages, path.join(outDir, "detail"), "d", step),
    };
    await step(`图片：主图 ${files.gallery.length}，详情图 ${files.detail.length}`);

    const res = await publishToPdd({ context, product, pricing: ev.pricing, pddTitle, files, cfg, mode, step });
    if (res.status === "filled") keepPage = res.page;
    return { status: res.status, verdict: ev.verdict, reasons: ev.reasons, pricing: ev.pricing };
  } catch (e) {
    const p = page || context.pages().at(-1);
    const shot = path.join(outDir, "error.png");
    await p?.screenshot({ path: shot }).catch(() => {});
    await step(`❌ 出错：${e.message}（截图 ${shot}）`, { status: "failed", stage: "出错", error: e.message });
    return { status: "failed", error: e.message };
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => {});
    void keepPage;
  }
}

// ───────────────────────── 命令 ─────────────────────────
const LOCAL_CONFIG_PATH = path.resolve("pxx-config.json");

function loadLocalConfig() {
  let cfg = { ...DEFAULTS };
  if (fs.existsSync(LOCAL_CONFIG_PATH)) {
    try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, "utf8")) }; }
    catch (e) { console.warn("本机配置文件读取失败，使用默认配置：", e.message); }
  }
  if (flags.config) cfg = { ...cfg, ...JSON.parse(fs.readFileSync(flags.config, "utf8")) };
  return cfg;
}

function parseOfferId(s) {
  const t = String(s || "").trim();
  if (/^\d{8,15}$/.test(t)) return t;
  const m = t.match(/offer\/(\d{8,15})/) || t.match(/[?&](?:offerId|offer_id|id|object_id)=(\d{8,15})/i) || t.match(/(\d{10,15})\.html/);
  return m ? m[1] : null;
}

function printResult(r) {
  console.log("\n════════ 结果 ════════");
  console.log("状态：", r.status, r.verdict ? `(${r.verdict})` : "");
  if (r.pricing) {
    console.log("建议定价：");
    for (const s of r.pricing.skus.slice(0, 12))
      console.log(`  ${s.name.padEnd(14)} 成本¥${s.cost}  拼单价¥${s.group}  单买价¥${s.single}  利润¥${s.profit}  库存${s.stock}`);
  }
  console.log("═══════════════════\n");
}

async function main() {
  if (cmd === "help" || flags.help) {
    console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?\n?|^ \* ?/gm, ""));
    return;
  }

  if (cmd === "login") {
    const { context, close } = await openBrowser();
    const p1 = await context.newPage();
    await p1.goto("https://login.1688.com/member/signin.htm", { waitUntil: "domcontentloaded" }).catch(() => {});
    const p2 = await context.newPage();
    await p2.goto("https://mms.pinduoduo.com/login/", { waitUntil: "domcontentloaded" }).catch(() => {});
    console.log("\n请在弹出的浏览器里：\n  1) 登录 1688（采购账号）\n  2) 登录 拼多多商家后台\n登录完成后回到这里按回车。\n");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await rl.question("都登录好了吗？按回车继续 ");
    rl.close();
    const ck = await context.cookies("https://www.1688.com");
    console.log("1688 登录态：", ck.some((c) => c.name === "__cn_logon__" && c.value === "true") ? "✔ 已登录" : "⚠ 未检测到（可能 cookie 名变了，不一定有问题）");
    await p2.goto(PDD_CATEGORY_URL, { waitUntil: "domcontentloaded" }).catch(() => {});
    await sleep(2500);
    console.log("拼多多登录态：", await isPddLoginRequired(p2) ? "⚠ 仍需要登录" : "✔ 未检测到登录拦截");
    await close();
    return;
  }

  if (cmd === "start") {
    const PORT = Number(flags.port || 17368);
    const jobs = [];
    let nextId = 1;
    let active = false;
    let context;
    let browserClose;
    const allowedOrigin = (origin) => {
      if (!origin) return true;
      try {
        const u = new URL(origin);
        return (u.protocol === "https:" && u.hostname.endsWith(".vercel.app")) || u.hostname === "localhost" || u.hostname === "127.0.0.1";
      } catch { return false; }
    };
    const server = createServer(async (req, res) => {
      const origin = req.headers.origin || "";
      if (!allowedOrigin(origin)) { res.writeHead(403); res.end("Origin denied"); return; }
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Access-Control-Allow-Private-Network", "true");
      }
      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200); res.end(JSON.stringify({ online: true, version: "1.1.0", host: process.env.COMPUTERNAME || "本机", active, port: PORT })); return;
      }
      if (req.method === "GET" && req.url === "/jobs") {
        res.writeHead(200); res.end(JSON.stringify({ jobs: jobs.slice().reverse() })); return;
      }
      if (req.method === "GET" && req.url === "/settings") {
        const cfg = loadLocalConfig();
        res.writeHead(200); res.end(JSON.stringify({ minProfit: cfg.minProfit, targetRoi: cfg.targetRoi, shippingCost: cfg.shippingCost })); return;
      }
      if (req.method === "POST" && req.url === "/settings") {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        let body = {};
        try { body = JSON.parse(raw || "{}"); } catch {}
        const minProfit = Number(body.minProfit);
        const targetRoi = Number(body.targetRoi);
        if (!Number.isFinite(minProfit) || minProfit < 0 || minProfit > 10000 ||
            !Number.isFinite(targetRoi) || targetRoi <= 1 || targetRoi > 100) {
          res.writeHead(400); res.end(JSON.stringify({ error: "最低利润需为 0–10000 元，目标 ROI 需大于 1 且不超过 100" })); return;
        }
        const current = loadLocalConfig();
        const next = { ...current, minProfit: round2(minProfit), targetRoi: round2(targetRoi) };
        fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
        res.writeHead(200); res.end(JSON.stringify({ minProfit: next.minProfit, targetRoi: next.targetRoi })); return;
      }
      if (req.method === "POST" && req.url === "/jobs") {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        let body = {};
        try { body = JSON.parse(raw || "{}"); } catch {}
        const mode = ["check", "fill", "publish"].includes(body.mode) ? body.mode : "fill";
        const lines = String(body.urls || "").split(/[\s,，;；]+/).map(x => x.trim()).filter(Boolean);
        const ids = [...new Set(lines.map(parseOfferId).filter(Boolean))];
        if (!ids.length) { res.writeHead(400); res.end(JSON.stringify({ error: "没有识别到有效的 1688 商品链接" })); return; }
        const created = ids.map(offerId => {
          const job = { id: nextId++, offerId, sourceUrl: `https://detail.1688.com/offer/${offerId}.html`, mode, status: "queued", stage: "排队中", logs: [], createdAt: new Date().toISOString() };
          jobs.push(job); return job;
        });
        res.writeHead(202); res.end(JSON.stringify({ created: created.length, jobs: created })); return;
      }
      res.writeHead(404); res.end(JSON.stringify({ error: "not found" }));
    });
    server.listen(PORT, "127.0.0.1", async () => {
      console.log(`✔ PXX Agent 已连接本机服务：http://127.0.0.1:${PORT}`);
      console.log("请保持此窗口运行；网页会自动检测连接并直接发送任务。");
      try {
        const opened = await openBrowser();
        context = opened.context;
        browserClose = opened.close;
        context.on("close", () => { console.log("浏览器已关闭"); });
        while (true) {
          const job = jobs.find(x => x.status === "queued");
          if (!job) { await sleep(700); continue; }
          active = true;
          job.status = "running";
          job.stage = "开始处理";
          const step = makeStep(job);
          await runJob({ context, job, cfg: loadLocalConfig(), step, mode: job.mode });
          if (job.status === "running") { job.status = "failed"; job.stage = "任务结束但未返回结果"; }
          job.updatedAt = new Date().toISOString();
          active = false;
        }
      } catch (e) {
        console.error("Agent 启动失败：", e?.message || e);
        server.close();
        process.exitCode = 1;
      }
    });
    server.on("error", e => { console.error("本机服务启动失败：", e.message); process.exitCode = 1; });
    await new Promise(() => {});
    return;
  }

  if (cmd === "inspect-pdd") {
    const { context, close } = await openBrowser();
    const page = await context.newPage();
    await page.goto(PDD_CATEGORY_URL, { waitUntil: "domcontentloaded" }).catch(() => {});
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await rl.question("请在浏览器里选好类目，进入“商品发布表单”页面，然后按回车 ");
    rl.close();
    const pages = context.pages();
    const info = { capturedAt: new Date().toISOString(), pages: [] };
    for (const p of pages) {
      const pageInfo = { url: p.url(), frames: [] };
      for (const frame of p.frames()) {
        const frameInfo = await frame.evaluate(() => {
          const visible = (e) => !!e.getClientRects().length;
          const text = (e) => (e.innerText || e.getAttribute("aria-label") || e.getAttribute("title") || "").trim().slice(0, 160);
          return {
            url: location.href,
            title: document.title,
            labels: [...document.querySelectorAll("label,[class*=label],[class*=Label]")].map(text).filter((t) => t && t.length < 80).slice(0, 300),
            inputs: [...document.querySelectorAll("input,textarea,select")].map((e) => ({
              tag: e.tagName, type: e.type || "", placeholder: e.getAttribute("placeholder") || "",
              name: e.getAttribute("name") || "", cls: typeof e.className === "string" ? e.className : "",
              ariaLabel: e.getAttribute("aria-label") || "", visible: visible(e),
              parentText: (e.parentElement?.parentElement?.innerText || "").trim().slice(0, 120),
              // 不读取 value，避免把用户输入、密码或验证码写入诊断文件。
            })).slice(0, 500),
            buttons: [...document.querySelectorAll("button,[role=button]")].map(text).filter(Boolean).slice(0, 300),
            tables: [...document.querySelectorAll("table")].map((t) => [...t.querySelectorAll("thead th,thead td,tr:first-child th,tr:first-child td")].map(text)).slice(0, 100),
            tableDetails: [...document.querySelectorAll("table")].slice(0, 30).map((t) => [...t.querySelectorAll("tr")].slice(0, 30).map((tr) => ({
              text: (tr.innerText || "").trim().slice(0, 300),
              cells: [...tr.querySelectorAll("th,td")].map((cell) => ({
                text: (cell.innerText || "").trim().slice(0, 100),
                inputs: [...cell.querySelectorAll("input,textarea,select")].map((e) => ({
                  tag: e.tagName, type: e.type || "", placeholder: e.getAttribute("placeholder") || "",
                  cls: typeof e.className === "string" ? e.className : "", visible: visible(e)
                }))
              }))
            }))),
            shadowRoots: [...document.querySelectorAll("*")].filter((e) => e.shadowRoot).length,
          };
        }).catch((e) => ({ url: frame.url(), error: e.message }));
        pageInfo.frames.push(frameInfo);
      }
      info.pages.push(pageInfo);
    }
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "pdd-form.json"), JSON.stringify(info, null, 2), "utf8");
    console.log(`已保存 ${path.join(OUT, "pdd-form.json")}（包含所有打开页面及 iframe；未生成截图）`);
    await close();
    return;
  }

  if (cmd === "check" || cmd === "list") {
    const id = parseOfferId(positional[0]);
    if (!id) throw new Error("请提供 1688 商品链接或商品 ID，例如：node agent.mjs check https://detail.1688.com/offer/123456789012.html");
    const mode = cmd === "check" ? "check" : flags.submit ? "publish" : "fill";
    const { context, close } = await openBrowser();
    const step = makeStep();
    const r = await runJob({ context, job: { offerId: id }, cfg: loadLocalConfig(), step, mode });
    printResult(r);
    if (r.status === "filled") {
      console.log("浏览器已保留在发布页，请检查后手动提交。完成后按 Ctrl+C 退出。");
      await new Promise(() => {});
    }
    await close();
    return;
  }


  throw new Error(`未知命令 ${cmd}，运行 node agent.mjs help 查看用法`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("\n❌ " + (e?.message || e));
    process.exit(1);
  }
);