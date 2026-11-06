# 1688 → 拼多多自动上架工作台

工作台部署在 Vercel；Playwright Agent 运行在你自己的 Windows 电脑上。Chrome 登录态和 profile 只保存在本机。

## 1. 创建 Neon 数据库
1. 在 https://neon.tech 创建 PostgreSQL 项目，区域尽量选靠近 Vercel 部署区域的地点。
2. 复制 Pooled connection string（主机名包含 `-pooler`）作为运行时连接；再复制 Direct connection string（主机名不含 `-pooler`）用于数据库迁移。两者都保留 `sslmode=require`。
3. 分别保存为 Vercel 环境变量 `DATABASE_URL` 和 `DATABASE_URL_UNPOOLED`。

## 2. 设置 Vercel 环境变量
在本地 PowerShell 运行两次以下命令，分别生成 AUTH_SECRET 和 AGENT_TOKEN（两次结果必须不同）：
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
在 Vercel → Project → Settings → Environment Variables 设置：
- `DATABASE_URL`：Neon pooled connection string（Vercel Functions 运行时）
- `DATABASE_URL_UNPOOLED`：Neon direct connection string（运行 Drizzle 迁移时使用；可选）
- `DASHBOARD_PASSWORD`：你自己设置的长随机工作台密码
- `AUTH_SECRET`：第一条命令生成的随机值（至少 32 字符）
- `AGENT_TOKEN`：第二条命令生成的另一个随机值

不要把任何真实密钥提交到 GitHub。

## 3. 部署
在 Vercel 中 Add New → Project → Import Git Repository，选择 `JacketYang/automation-pxx`。
部署分支先选 `deploy/vercel-neon-hardening` 进行验证；Framework Preset 选 Next.js，Root Directory 保持仓库根目录。确认四个必需环境变量和可选的 DATABASE_URL_UNPOOLED 已添加后 Deploy。

## 4. 初始化数据库
在 Neon 控制台 SQL Editor 中执行仓库文件 `database/schema.sql`。也可以在本地设置好 DATABASE_URL_UNPOOLED 后运行 `npm install`、`npm run db:push`。Drizzle 迁移优先使用直连，Vercel 运行时继续使用 pooled DATABASE_URL。

## 5. Windows 本机 Agent
在新目录下载 agent（不要覆盖旧的 profile）：
```powershell
mkdir pdd-agent-cloud
cd pdd-agent-cloud
Invoke-WebRequest https://YOUR-VERCEL-DOMAIN/agent/agent.mjs -OutFile agent.mjs
Invoke-WebRequest https://YOUR-VERCEL-DOMAIN/agent/package.json -OutFile package.json
Invoke-WebRequest https://YOUR-VERCEL-DOMAIN/agent/pricing.mjs -OutFile pricing.mjs
Invoke-WebRequest https://YOUR-VERCEL-DOMAIN/agent/pricing.test.mjs -OutFile pricing.test.mjs
npm install
node agent.mjs login
$env:PDD_AGENT_TOKEN = "填入与 Vercel AGENT_TOKEN 相同的值"
node agent.mjs watch --server https://YOUR-VERCEL-DOMAIN --token $env:PDD_AGENT_TOKEN
```
把 YOUR-VERCEL-DOMAIN 换成真实 Vercel 域名。登录弹出的独立浏览器，分别登录 1688 和拼多多商家后台。Agent 需要保持运行。

## 6. 验证流程
先选择「只判断」测试普通商品；再选择「判断 + 填好表单」检查类目、SKU、图片和价格。初期建议不要启用自动提交，人工核对后再决定。

## 安全说明
- 不要把账号密码、验证码、Cookie、Chrome Profile、Neon 连接串或 Token 发给任何人。
- Vercel 负责网页/API；它不会运行持久 Chrome 或 Android 模拟器。Agent 必须在本机运行。
- 商品风险判断是辅助规则，不等同平台审核或法律意见。品牌、资质、食品、电器等风险项应人工复核。
