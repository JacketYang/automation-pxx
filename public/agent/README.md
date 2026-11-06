# 本地 Agent 使用说明

Agent 在你的 Windows 电脑运行，负责打开 Chrome/Edge、读取 1688 商品并操作拼多多商家后台。浏览器登录态只保存在本机的 `chrome-profile` 目录。

## 安装

需要 Node.js 18+ 和已安装的 Chrome 或 Edge。下载以下四个文件到同一目录：

- `agent.mjs`
- `package.json`
- `pricing.mjs`
- `pricing.test.mjs`

然后运行：

```powershell
npm install
npm test
node agent.mjs login
```

在弹出的独立浏览器窗口中自行登录 1688 和拼多多商家后台。不要向任何人提供密码、验证码或 Cookie。

## 连接 Vercel 工作台

先在 Vercel 环境变量设置 `AGENT_TOKEN`，本机使用同一个值：

```powershell
$env:PDD_AGENT_TOKEN = "你的 AGENT_TOKEN"
node agent.mjs watch --server https://你的工作台域名 --token $env:PDD_AGENT_TOKEN
```

保持该终端窗口运行。不要把 Token 或 `chrome-profile` 上传到 GitHub。

## 定价模型（参照 xiaoman 核算表）

默认假设：平台费率 0.6%、售后损耗 3%、目标投产比 2、每单目标经营利润 3 元。对每个 SKU 单独核算，拼单价向上取整到 0.1 元：

`售价 × (1 - 平台费率 - 售后损耗率 - 1/目标投产比) - 商品成本 - 单件运费 - 其他每单成本 ≥ 目标经营利润`

最低加价率只作为售价下限。Agent 只从 1688「代发下单」区域读取明确的 1 件价格；如果没有明确的一件代发价，或没有读取到包邮/实际运费，工作台会阻止自动上架。请先核实具体 SKU、代发下单价、运费、发货时效和拼多多面单支持情况。

平台费率、售后损耗和广告投产比是经营估算，不代表平台最终扣费或实际投放结果；请按店铺账单、广告报表和售后数据调整。

## 常用命令

- `node agent.mjs login`：打开独立浏览器登录
- `node agent.mjs check <1688链接>`：只判断商品
- `node agent.mjs list <1688链接>`：填写表单但停在提交前
- `node agent.mjs list <1688链接> --submit`：提交上架（建议先充分测试）
- `node agent.mjs watch --server <工作台地址> --token <AGENT_TOKEN>`：连接网页工作台
