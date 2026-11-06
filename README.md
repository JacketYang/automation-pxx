# PXX：1688 商品分析 → 拼多多上架

当前只开发第一阶段：读取 1688 商品、分析 SKU 成本和利润、判断上架条件，并在用户自己的 Windows 浏览器中填写拼多多商品表单。

## 一键部署

1. 将本仓库导入 Vercel。
2. Framework 选择 Next.js，Root Directory 使用仓库根目录。
3. 不需要配置 Environment Variables。
4. 后续推送到 `main`，Vercel 自动重新部署。

当前 MVP 目标是不依赖 PostgreSQL、Neon、Supabase、Redis、AUTH_SECRET、AGENT_TOKEN 或 DASHBOARD_PASSWORD。网页直接连接用户本机 Agent（127.0.0.1），自动检测在线状态、下发任务并显示进度；不使用云端任务队列。

## 本机 Agent（Windows）

首次下载 `public/agent` 中的 `agent.mjs`、`package.json`、`pricing.mjs`、`pricing.test.mjs` 和 `start-agent.bat` 到同一目录。安装 Node.js 18+、Chrome 或 Edge 后，首次运行：

```powershell
npm install
node agent.mjs login
```

登录 1688 和拼多多后，以后双击 `start-agent.bat` 启动本机 Agent。打开 HTTPS 网页，等右上角显示在线，直接粘贴 1688 链接开始处理。网页显示任务状态、SKU 定价、风险判断和执行日志。

本机 Agent 只监听 `127.0.0.1:17368`，不经过云端队列。浏览器登录态保存在本机 `chrome-profile`，严禁上传。

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
