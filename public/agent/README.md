# 本机 Agent

Agent 在你的 Windows 电脑运行，使用本机 Chrome/Edge 登录态读取 1688 并操作拼多多商家后台。无需数据库、云端服务、Token 或环境变量。

## 安装

下载本目录中的 `agent.mjs`、`package.json`、`pricing.mjs`、`pricing.test.mjs`，放在同一目录：

```powershell
npm install
npm test
node agent.mjs login
```

在弹出的浏览器中登录 1688 和拼多多商家后台。

## 使用

```powershell
node agent.mjs check "1688商品链接"
node agent.mjs list "1688商品链接"
node agent.mjs list "1688商品链接" --submit
```

- `check`：只判断商品能否上架并分析价格。
- `list`：判断并填写拼多多表单，停在最终提交前。
- `list --submit`：提交发布；初期建议人工检查后提交。

## 定价

默认平台费率 0.6%、售后损耗 3%、目标 ROI 2、目标经营利润 ¥3。逐 SKU 使用公式：

`售价 × (1 - 平台费率 - 售后损耗率 - 1/目标 ROI) - 商品成本 - 单件运费 - 其他成本 ≥ 目标利润`

必须有明确的一件代发价和单件运费/包邮证据；否则不自动上架。参数是经营估算，应按店铺实际账单校准。

登录态只保存在本机 `chrome-profile`，不要分享或上传。
