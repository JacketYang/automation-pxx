import test from "node:test";
import assert from "node:assert/strict";
import { priceSku } from "./pricing.mjs";

const cfg = {
  shippingCost: 2.5,
  fixedCost: 0,
  markupPercent: 30,
  pddFeePercent: 0.6,
  afterSalesLossPercent: 3,
  targetRoi: 2,
  minProfit: 3,
  singleBuyExtra: 1,
};

test("uses xiaoman assumptions and achieves target operating profit", () => {
  const p = priceSku(7.14, cfg, 0);
  assert.equal(p.group, 21.9);
  assert.ok(p.profit >= 3);
  assert.equal(p.promotionCost, 10.95);
  assert.equal(p.landedCost, 7.14);
});

test("includes verified per-order shipping in landed cost", () => {
  const p = priceSku(5.76, cfg, 2.5);
  assert.equal(p.landedCost, 8.26);
  assert.ok(p.profit >= 3);
});

test("rejects impossible target ROI / fee assumptions", () => {
  assert.throws(() => priceSku(5, { ...cfg, targetRoi: 1, pddFeePercent: 1, afterSalesLossPercent: 5 }, 0), /无法实现正利润/);
});

test("calculates single-buy profit separately", () => {
  const p = priceSku(7.14, cfg, 0);
  assert.ok(p.singleProfit > p.profit);
});

test("never sells below break-even even with hostile parameters", () => {
  const bad = { ...cfg, minProfit: -50, singleBuyExtra: -20, markupPercent: -80 };
  const p = priceSku(10, bad, 5);
  assert.ok(p.profit >= 0, `拼单价利润不应为负: ${p.profit}`);
  assert.ok(p.singleProfit >= 0, `单买价利润不应为负: ${p.singleProfit}`);
  assert.ok(p.single >= p.group, "单买价不得低于拼单价");
  assert.ok(p.group >= p.landedCost, "售价不得低于到岸成本");
});
