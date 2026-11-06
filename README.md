# PXX：1688 商品分析 → 拼多多上架

当前只开发第一阶段：读取 1688 商品、分析 SKU 成本和利润、判断上架条件，并在用户自己的 Windows 浏览器中填写拼多多商品表单。

## 一键部署

1. 将本仓库导入 Vercel。
2. Framework 选择 Next.js，Root Directory 使用仓库根目录。
3. 不需要配置 Environment Variables。
4. 后续推送到 `main`，Vercel 自动重新部署。

当前 MVP 目标是不依赖 PostgreSQL、Neon、Supabase、Redis、AUTH_SECRET、AGENT_TOKEN 或 DASHBOARD_PASSWORD。网页不承担云端任务队列；商品浏览器操作由用户本机 Agent 执行。

## 本机 Agent（Windows）

需要 Node.js 18+ 和 Chrome 或 Edge。下载 `public/agent` 目录中的四个文件到同一目录：

- `agent.mjs`
- `package.json`
- `pricing.mjs`
- `pricing.test.mjs`

PowerShell：

```powershell
npm install
npm test
node agent.mjs login
```

在弹出的独立浏览器里登录 1688 和拼多多商家后台。然后执行：

```powershell
node agent.mjs check "https://detail.1688.com/offer/123456789012.html"
node agent.mjs list "https://detail.1688.com/offer/123456789012.html"
```

- `check`：只分析商品。
- `list`：分析并填写拼多多表单，停在提交前。
- `list --submit`：提交上架。前期先不要批量自动提交。

登录态和 `chrome-profile` 目录只保存在本机，严禁提交到 GitHub 或上传到云端。

## 定价规则

逐 SKU 计算贡献利润，参考 `JacketYang/xiaoman`：

`P × (1 - 平台费率 - 售后损耗率 - 1/目标 ROI) - 商品成本 - 单件运费 - 其他单笔成本 ≥ 目标经营利润`

默认参数：平台费率 0.6%、售后损耗 3%、目标 ROI 2、目标经营利润 ¥3。最低加价率只作为售价下限。缺少明确一件代发价或单件运费/包邮证据时，不允许自动上架。经营参数需要根据店铺真实账单和投放数据校准。

## 当前不做

- 云端数据库、云端任务队列和多设备同步
- 登录系统、权限系统、Token 和密码环境变量
- 订单采购、发货、推广、客服和售后
- 自动绕过验证码或平台风控

## 验证

```bash
npm test
npm run typecheck
npm run build
```

先保证网页可一键部署和本机 Agent 可运行，再迭代真实商品页面兼容性。平台页面可能改版或触发验证；遇到登录、验证码、类目或商品属性不确定时暂停，由用户处理。
