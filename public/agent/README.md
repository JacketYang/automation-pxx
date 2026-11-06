# PXX 本机 Agent

## 首次安装（Windows）
1. 安装 Node.js 18+ 和 Chrome 或 Edge。
2. 在此目录运行 `npm install`。
3. 首次登录：`node agent.mjs login`，在打开的浏览器中登录 1688 和拼多多。
4. 以后双击 `start-agent.bat`。Agent 启动后网页会自动显示在线。

## 使用
打开已部署的 HTTPS 控制台，等待右上角显示 Agent 在线。直接在网页粘贴 1688 商品链接，选择只分析、分析并填表或分析并提交，然后点击开始处理。任务进度、SKU 定价、风险判断和日志会直接显示在网页。

Agent 提供本机 HTTP 服务：`http://127.0.0.1:17368`，仅监听回环地址，不暴露到局域网或公网。网页和 Agent 之间不经过云端任务队列。登录态保存在本机 `chrome-profile`。

命令行可选：`node agent.mjs login`、`node agent.mjs start`、`node agent.mjs check <1688链接>`、`node agent.mjs list <1688链接>`。运行测试：`node --test pricing.test.mjs`。

不要上传 `chrome-profile`，不要分享密码或验证码。Agent 不需要 Token、数据库或云端任务队列。
