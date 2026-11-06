# PXX：1688 商品分析 → 拼多多上架

> 更新时间：2026-11-07 03:13 (+08:00)
> 开发规范 / 项目蓝图 / 交接详情见 [`DEVELOPMENT.md`](./DEVELOPMENT.md)（唯一权威文档）。本文只放极简上手。

## 启动（本地单窗口）

双击根目录 `start-all.bat`（= `node start-server.mjs`）：一个控制台窗口同时启动常驻浏览器（CDP 9222，登录态持久）、本机 Agent（`127.0.0.1:17368`）和 Next.js 工作台（`http://localhost:3000`）；首次自动 `npm install` + `npm run build`，并在常驻 Chrome 里打开工作台（全程一个浏览器窗口）。

首次登录：点工作台右上角「去登录」，在常驻浏览器登录 1688 / 拼多多；登录后点「重新检测」或提交任务会自动检测。也可双击 `public/agent/login-agent.bat`。**常驻浏览器不要关闭**，登录态即可持续复用。

## 验证

```bash
npm run typecheck
npm run build
node --check public/agent/agent.mjs
cd public/agent && npm test
```

当前阶段只跑通「上架」闭环；推广、发货、客服售后等为蓝图方向，暂不开发。当前主攻阻塞：拼多多类目页首图上传。
