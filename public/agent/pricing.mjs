export const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Price one selected 1688 SKU using the xiaoman contribution-margin model.
 * pddFeePercent and afterSalesLossPercent are entered as percentage numbers (0.6 = 0.6%).
 * targetRoi is revenue / ad spend (2 means ad spend is estimated as 50% of revenue).
 */
export function priceSku(cost, cfg, shippingCost = cfg.shippingCost) {
  const numbers = [cost, shippingCost, cfg.fixedCost, cfg.markupPercent, cfg.pddFeePercent, cfg.afterSalesLossPercent, cfg.targetRoi, cfg.minProfit, cfg.singleBuyExtra];
  if (numbers.some((n) => !Number.isFinite(Number(n))) || Number(cost) < 0 || Number(shippingCost) < 0) {
    throw new Error("SKU 成本、运费或定价参数无效");
  }
  if (cfg.targetRoi <= 0) throw new Error("目标投产比必须大于 0");
  const platformRate = cfg.pddFeePercent / 100;
  const afterSalesRate = cfg.afterSalesLossPercent / 100;
  const adRate = 1 / cfg.targetRoi;
  const retainedRate = 1 - platformRate - afterSalesRate - adRate;
  if (retainedRate <= 0) throw new Error("平台费率 + 售后损耗 + 推广费率已达到或超过售价，无法实现正利润");

  const landedCost = Number(cost) + Number(shippingCost) + Number(cfg.fixedCost);
  const byMarkup = landedCost * (1 + cfg.markupPercent / 100);
  const byProfit = (landedCost + cfg.minProfit) / retainedRate;
  const group = Math.ceil(Math.max(byMarkup, byProfit) * 10 - 1e-9) / 10;
  const breakdown = (price) => {
    const platformFee = price * platformRate;
    const afterSalesCost = price * afterSalesRate;
    const promotionCost = price * adRate;
    const profit = price - landedCost - platformFee - afterSalesCost - promotionCost;
    return {
      platformFee: roundMoney(platformFee),
      afterSalesCost: roundMoney(afterSalesCost),
      promotionCost: roundMoney(promotionCost),
      profit: roundMoney(profit),
    };
  };
  const single = roundMoney(group + cfg.singleBuyExtra);
  const groupBreakdown = breakdown(group);
  const singleBreakdown = breakdown(single);
  return {
    cost: roundMoney(cost),
    shippingCost: roundMoney(shippingCost),
    landedCost: roundMoney(landedCost),
    group: roundMoney(group),
    single,
    promotionCost: groupBreakdown.promotionCost,
    platformFee: groupBreakdown.platformFee,
    afterSalesCost: groupBreakdown.afterSalesCost,
    profit: groupBreakdown.profit,
    singleProfit: singleBreakdown.profit,
  };
}
