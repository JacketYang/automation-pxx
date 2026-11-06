# PXX：1688 商品分析 → 拼多多上架

当前只开发第一阶段：读取 1688 商品、分析 SKU 成本和利润、判断上架条件，并在用户自己的 Windows 浏览器中填写拼多多商品表单。

## 一键启动（本地部署，当前方式）

> 项目长期蓝图与开发交接见 [`ROADMAP.md`](./ROADMAP.md)；开发规范见 [`DEVELOPMENT.md`](./DEVELOPMENT.md)。

在仓库根目录双击 `start-all.bat`（或运行 `node start-server.mjs`）：单窗口同时启动
① 常驻浏览器（CDP 9222，登录态持久）② 本机 Agent 服务（127.0.0.1:17368）③ Next.js 工作台（http://localhost:3000）。
首次运行会自动 `npm install` + `npm run build`，并只打开一个浏览器窗口指向工作台。

首次登录：点工作台右上角「去登录」，会在常驻浏览器打开 1688 / 拼多多登录页；登录后点「重新检测」或提交任务即自动检测，无需重启。
也可单独双击 `public/agent/login-agent.bat` 完成登录。常驻浏览器不要关闭，登录态即可持续复用。

> Vercel 部署为历史方式：当前运营商对 `*.vercel.app` 做 SNI 封锁，且工作台已改为本地运行；`vercel.json` 及 `pxx.fu8.cc.cd` 域名配置为遗留，不再作为主入口。

当前 MVP 目标是不依赖 PostgreSQL、Neon、Supabase、Redis、AUTH_SECRET、AGENT_TOKEN 或 DASHBOARD_PASSWORD。网页直接连接用户本机 Agent（127.0.0.1），自动检测在线状态、下发任务并显示进度；不使用云端任务队列。

## 本机 Agent（Windows）

首次下载 `public/agent` 中的 `agent.mjs`、`package.json`、`pricing.mjs`、`pricing.test.mjs`、`ensure-browser.ps1` 和 `start-agent.bat` 到同一目录。安装 Node.js 18+、Chrome 或 Edge 后，首次运行：

```powershell
npm install
node agent.mjs login
```

登录 1688 和拼多多后，以后双击 `start-agent.bat` 启动本机 Agent（会复用同一个常驻浏览器，登录态持久）。打开本地工作台网页，等右上角显示在线、拼多多显示「已登录」，直接粘贴 1688 链接开始处理。网页显示任务状态、SKU 定价、风险判断和执行日志。

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
