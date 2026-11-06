# 开发规范（必须遵守）

## 当前阶段边界

当前唯一目标：**1688 商品分析 → 拼多多商品上架**。

必须按顺序完成：
1. 输入 1688 商品链接并读取商品信息。
2. 读取 SKU、单件代发价、库存、单件运费和包邮证据。
3. 逐 SKU 计算到岸成本、拼单价、单买价和预计经营利润。
4. 检查禁售词、品牌与资质风险。
5. 打开拼多多商家后台，填写标题、图片、类目、SKU、价格和库存。
6. 默认停在最终提交前供人工检查；自动提交必须由用户明确开启。

订单采购发货、推广、客服售后等后续阶段不得提前引入。

## 极简架构原则

- Vercel 只托管 Next.js 网页；GitHub 的 `main` 更新触发自动部署。
- 本机 Windows Agent 使用 Playwright 操作用户本机已登录的 Chrome/Edge。
- 当前阶段不使用数据库、云端任务队列或多设备同步。
- 不引入 PostgreSQL、Neon、Supabase、Redis、ORM 或迁移系统。
- 不引入登录系统、权限系统、Token、AUTH_SECRET、DASHBOARD_PASSWORD 或其他部署密钥。
- 不需要 Vercel Environment Variables；如未来确有必要，必须先说明无法用更简单方案解决的原因。
- 网页通过 localhost 直接连接本机 Agent，检测在线状态、下发任务并展示进度；本机 Agent 负责真实浏览器任务。
- Agent 仅监听 127.0.0.1，不把浏览器登录态或商品数据发送到云端。
- 不得把本机登录态、Cookie、密码、验证码或 `chrome-profile` 上传到 Vercel/GitHub。

## 依赖与部署

- 优先使用 Next.js、React 和 Node.js 内置能力。
- 新增依赖前先确认原生能力是否足够。
- 保持 Vercel 默认 Next.js 构建，不添加自定义部署服务。
- 合并到 `main` 前必须保证 `npm run typecheck`、`npm test`（如有）和 `npm run build` 通过。
- README 必须保持从零部署步骤简短准确；不能要求用户手工创建数据库或生成密钥。

## 代码质量与商品数据

- 价格计算必须是可独立测试的纯函数；禁止把金额计算散落在页面 DOM 操作中。
- 价格以 SKU 为单位计算，不得用批发阶梯价冒充单件代发价。
- 未识别明确代发价、单件运费或包邮证据时，必须标记未知并阻止自动发布；不得伪造数据。
- 价格默认参数需明确展示，实际费率、广告投产比和售后损耗须允许按真实经营数据校准。
- 关键页面选择器应集中管理；失败时输出截图和可读日志。
- 浏览器步骤必须有超时、重试边界和人工接管方式。
- 不绕过验证码、登录验证、平台风控或权限限制。
- 发布、付款、退款等不可逆或涉及资金的动作必须有明确人工确认；本阶段默认不自动发布。

## 数据与状态

- 当前阶段数据优先保存在用户本机；临时网页输入不承诺跨设备同步。
- 如未来确有持久化需求，先评估本机 JSON/SQLite 是否足够；不要默认引入云数据库。
- 不得为了“以后可能用到”提前建设多租户、微服务、消息队列或复杂权限系统。

## 文档与交付

- 每项功能完成后，同一提交更新 README 或本规范，记录能力、运行命令和已知限制。
- 每次工作在 PR 描述中列出改动、测试结果和未完成事项。
- 不得把未运行的构建、未验证的页面或未完成的自动化宣称为成功。
- 先做可运行的最小闭环，再扩展；不做与当前阶段无关的架构工作。

## 变更纪律

- 不得擅自扩展当前阶段范围。
- 不得为了技术“完整性”增加用户必须配置的服务。
- 所有新功能优先采用最少文件、最少依赖、最少步骤的实现。

## 后续架构方向（备忘，不阻塞当前闭环）

> **项目长期蓝图与开发交接请以仓库根目录 [`ROADMAP.md`](./ROADMAP.md) 为准**，本节仅保留早期备忘，如有冲突以 ROADMAP.md 为准。
> 核心：最终整合成完整电商后台（上架 → 运营推广 → 订单发货 → 客服售后），全部用模拟操作、不用官方 API，操作可能全部在云端，本地只作信息展示 / 指令输入窗口；当前阶段只跑通上架，不按蓝图开发。

完整版的目标方向是“云端控制中心 + 本机浏览器执行端”：
- 云端网页负责操作界面、商品任务管理、任务状态与日志展示，以及利润、ROI、运费和筛选规则等参数的持久化。
- 本机 Agent 只负责连接用户本机已登录的浏览器、执行 Playwright 操作，并回传执行进度、结果和必要的诊断信息；不承担长期业务配置的唯一存储职责。
- 云端与本机 Agent 之间未来需要明确的任务下发、心跳、结果回传和安全通信协议。实现时再评估持久化存储与部署方案，不提前引入复杂基础设施。

该方向是后续备忘，**当前不作为开发阻塞项**。当前最高优先级仍是先跑通本地最小闭环：读取 1688 商品 → SKU/成本与利润分析 → 进入拼多多发布表单 → 识别并填写商品与 SKU → 停在人工确认提交前。云端化不能以牺牲当前流程可运行性为代价。

## 拼多多表单 DOM 故障排查

- 上架表单识别失败时，先采集真实页面 DOM 结构再修选择器，禁止凭猜测反复更换选择器。
- 诊断优先输出机器可读 JSON：当前页面 URL/标题、frame 列表、可见输入框/按钮/弹窗、关键节点属性与文本；截图仅作为可选辅助，不得作为诊断的必要输入。
- 诊断数据不得包含 Cookie、Authorization、密码、验证码或其他会话凭据；上传诊断文件前应检查并脱敏。
- 选择器应集中管理；兼容 iframe、动态弹窗及 Shadow DOM（仅在真实页面确认存在时实现），识别失败时输出明确错误和 JSON 诊断文件。
- 修复后至少用真实登录页面验证表单节点识别、字段填写和 SKU 填写；默认仍停在最终提交前供人工检查。

---

# 开发交接记录（2026-11-06）

> 本节记录当前真实开发状态，供后续开发者/工具接手。记录中的“已提交”只代表代码已推送 GitHub，不代表已经在用户本机或拼多多真实页面验证通过。

## 项目当前目标与用户工作方式

- 项目：`JacketYang/automation-pxx`，主分支：`main`。
- 目标闭环：1688 商品分析 → SKU 成本/利润核算 → 拼多多发布表单填写 → 停在最终提交前人工确认。
- 用户希望直接修改并推送 GitHub，不要反复询问是否提交，不要只提供方案或让用户手工拼接代码。
- 用户本机没有完整 clone 整个仓库。每次修改本地 Agent 时，必须明确指出要替换的**单个具体文件**，不能笼统要求更新整个仓库。
- 用户本机 Agent 目录：`D:\ISO\pxx\pdd-agent`；本地文件名：`agent.mjs`。本机服务端口：`17368`。
- 交流要求：中文、直接、少废话；不要虚报“已修复/已验证”。用户对无依据的小步试错和偏离当前故障的修改非常反感，后续接手应先阅读本记录及相关代码，再集中处理问题。

## 当前仓库关键文件

- `public/agent/agent.mjs`：本机 Playwright Agent，1688 采集、拼多多登录检测、类目页和详情页操作、SKU 表单填写、本机 HTTP 服务。
- `public/agent/pricing.mjs`：独立 SKU 定价逻辑。
- `public/agent/pricing.test.mjs`：定价测试。
- `public/agent/start-agent.bat`：Windows 启动脚本。
- `DEVELOPMENT.md`：开发约束和本交接记录。
- `README.md`：部署与 Agent 使用说明。

## 已完成并保留的主要逻辑

### 本机 Agent 与网页连接

- Agent 本机监听 `127.0.0.1:17368`，提供 `/health`、`/jobs`、`/settings` 和 `POST /jobs`。
- 网页直接检测本机 Agent、发送任务并展示任务状态/日志，不使用云端任务队列。
- Agent 以 Playwright persistent profile 启动 Chrome/Edge，登录态保存在本机 `chrome-profile`。
- 首次通过 `node agent.mjs login` 登录 1688 和拼多多；不能假设会继承用户日常浏览器的登录态。
- `start-agent.bat` 已改为优先使用用户目录下的便携 Node 路径，并用 `cmd /k` 保留启动错误窗口。该脚本仍需在用户实际机器验证。

### 1688 分析与定价约束

- 保留逐 SKU 核算，不得把批发阶梯价当作一件代发价。
- 核心利润约束：`P × (1 - f - s - 1/R) - C ≥ G`。
  - P：拼单售价；f：平台费率；s：售后损耗；R：目标 ROI。
  - C：商品成本、单件运费及其他单笔成本；G：目标经营利润。
- 默认参数：平台费率 0.6%、售后损耗 3%、目标 ROI 2、目标利润 ¥3。
- 没有明确的一件代发价、单件运费或单件包邮证据时，必须阻止真实自动发布，不得推测补值。
- 禁售词、下架、缺标题/图片/价格、确认零库存等硬拦截不得随意放宽。
- 品牌、发货时效、一件代发识别等风险可按既定 warning 规则处理，不可擅自删除核心校验。

### 拼多多页面流程

1. 类目页：`https://mms.pinduoduo.com/goods/category`
   - 上传商品首图。
   - 填商品标题（页面实际 placeholder 曾观察到“商品标题组成：商品描述+规格，最多输入30个汉字（60个字符）”）。
   - 标题失焦后由拼多多自动识别/推荐类目。
   - 点击“下一步，完善商品信息”进入详情表单。
2. 详情页 URL 路径：`/goods/goods_add/index`
   - 商品轮播图、辅助图、商品属性、详情图、规格、SKU 价格库存、发货承诺、运费模板等。
   - SKU 表格需要按真实规格行逐行匹配，不得假定只有一个 SKU。
   - 最终默认停在“提交并上架”之前，人工检查后再提交。

### 表单诊断

- `inspect-pdd` 输出 JSON 诊断，遍历页面及 frames，包含 URL、标签、输入框、按钮、表格和 tableDetails。
- 诊断不读取 input.value，避免输出用户输入、密码或验证码。
- 选择器修复应基于真实 DOM 证据，不要凭猜测反复改 selector。
- 详情页 SKU 逻辑曾修复无 thead 表格、规格值 placeholder、多规格行映射等问题；这些逻辑不可在修复图片上传时顺带重写。

## 当前阻塞：拼多多类目页首图上传（最高优先级）

### 用户最新提供的真实 DOM 诊断

页面：`https://mms.pinduoduo.com/goods/category`

唯一 file input 的诊断：

```json
{
  "index": 0,
  "accept": "image/jpeg,image/png",
  "multiple": true,
  "disabled": false,
  "visible": false,
  "id": "",
  "name": "",
  "labelText": "",
  "chain": [
    {
      "tag": "INPUT",
      "cls": "MmsUiUploadPicVideoButton___origin___3-TdF2-163-0",
      "text": "",
      "images": 0
    },
    {
      "tag": "BUTTON",
      "cls": "BTN_outerWrapper_5-194-0 BTN_gray_5-194-0 BTN_small_5-194-0 BTN_outerWrapperBtn_5-194-0",
      "text": "本地上传",
      "images": 0
    },
    {
      "tag": "SPAN",
      "cls": "MmsUiUploadPicVideoButton___fileButton___2b-vY2-163-0",
      "text": "本地上传",
      "images": 0
    },
    {
      "tag": "SPAN",
      "cls": "",
      "text": "本地上传",
      "images": 0
    },
    {
      "tag": "SECTION",
      "cls": "goodsCarousel_btns__22KMn",
      "text": "图片空间上传本地上传",
      "images": 0
    },
    {
      "tag": "SECTION",
      "cls": "goodsCarousel_uploadImgEnter__9UMu8",
      "text": "上传图片 (0/10)",
      "images": 0
    },
    {
      "tag": "DIV",
      "cls": "MaterialModalButton_v2_materialContainer__3ut03",
      "text": "上传图片 (0/10)",
      "images": 0
    }
  ]
}
```

失败记录：
- Playwright 直接对该隐藏 input 调用 `setInputFiles()` 后，页面读取到的 `input.files` 仍是空数组（count=0/name="" /size=0/type=""）。
- 旧实现错误地把 `setInputFiles()` 调用不报错当成上传成功，导致日志出现“类目页首图已上传”，实际页面没有图片。
- 之后增加的预览检测仍未解决根因；不能继续沿用“直接 setInputFiles 隐藏 input”的假设。
- 真实 DOM 已证明 input 嵌套在“本地上传”按钮内，按钮属于 `goodsCarousel` 图片轮播上传区域。

### 最近推送的上传改动

- `cf38e7b`：开始检查文件绑定和图片预览，避免盲报成功。
- `fdf9fd2`：引入 `uploadCategoryCover()`。
- `0552a82`：清理误加的 toast 监听逻辑；用户明确要求不要把问题转移到 toast。
- `cd428d5`：恢复上传 helper。
- `44a8486`：收紧上传候选区域筛选。
- `6a68cf7`：根据真实 DOM 改为点击“本地上传”按钮，监听 Playwright `filechooser`，通过文件选择器 `setFiles(imagePath)` 选择文件。
- `af03a61`：把上传结果验证区域调整为优先定位 `[class*="goodsCarousel_uploadImgEnter"]`，检查“上传图片 (n/10)”计数变化、区域图片数量变化或上传后的操作状态。

当前最新文件：`public/agent/agent.mjs`，最近一次记录的 GitHub blob SHA：`5c91a15b43f574c00302251598d3685cdb924a96`（提交 `af03a61`）。**该提交已被下方 2026-11-06 改动取代，且它本身无法解析，不要以它为准。**

### 当前实现的验证边界与下一步

- 新实现大致流程：定位 accept 为图片且位于 `goodsCarousel` 区域的 input → 点击 input 的父级“本地上传”按钮 → 等待页面 `filechooser` 事件 → `chooser.setFiles(imagePath)` → 轮询上传区域计数/图片状态。
- 该实现是基于用户给出的 DOM 结构做出的针对性改动，**尚未获得用户本机运行结果，也没有在真实拼多多登录页面验证通过**。
- 不能声称首图上传已经修复；必须等实际运行日志和页面结果确认。
- 若仍失败，下一步应基于本次点击路径收集必要的真实信息：filechooser 是否触发、触发后 input.files 是否有文件、上传区域计数是否变化、按钮/上传区域 DOM 是否在点击后重建。不要再无差别尝试多个 selector。
- 需要检查当前点击的父节点确实是可交互的“本地上传”按钮，且 filechooser 监听绑定到正确 page；如有疑问，以真实事件和 DOM 变化为依据修复。
- 不要增加 toast 监听或把 toast 当成图片上传的替代验证。
- 上传成功的唯一有效证据应是拼多多轮播图上传区域确实出现新图片/计数增长/可确认的上传完成状态；不能仅以文件选择器事件触发或本地 input.files 有值作为成功。

### 2026-11-06 23:06 真实页面第二轮反馈

用户本机日志给出两条事实，且否证了本轮两个候选解释：

- `首图格式校验通过：jpeg` —— 该商品首图确实是 jpeg，**webp 未命中本次数据**（闸门仍保留，属真实隐患）。
- 失败点为 `locator.click: Timeout 10000ms exceeded`，Playwright 明确 **`element is not visible`**，重试 20 次全部如此；解析到的触发节点是 `<button type="button" data-testid="beast-core-button" class="BTN_outerWrapper_5-194-0 …">`。**`filechooser` 从未进入判断**，之前列的 File System Access API、新标签页/弹窗两条推论全部不适用（代码没走到那一步）。

### 根因（内置浏览器实测真实已登录页面，已确定）

- 承载“图片空间上传 / 本地上传”两个按钮的 `goodsCarousel_btns` 上挂着**行内 `style="display:none"`**，由 React 的 `onMouseEnter` 改写为 flex；未展开时按钮盒子为 0×0。
- 因此 Playwright 判定 `element is not visible`、重试 20 次全部无效。**agent 代码从未 hover 那个 96×96 的 `goodsCarousel_uploadImgEnter` 入口**，面板永远不展开——这就是首图上传长期卡住的根因，与选择器、filechooser、文件格式都无关。
- 对入口派发 `mouseover` 后实测：`goodsCarousel_btns` 的 display `none → flex`，“本地上传”按钮得到 86×24；点击该按钮内部调用 `input.click()`（实测 2 次）。`window.showOpenFilePicker` 在浏览器里存在但拼多多此处未使用，所以 Playwright 的 `filechooser` 事件路径成立。
- 同时**否证两个先前推断**：① 不是 `visibility:hidden`；② 上一轮“display:none 时 innerText 为空、所以筛选不可能通过”的推理是错的——规范规定未渲染元素的 `innerText` 回退为 `textContent`，真实测量为 `innerText:"本地上传", visibility:visible, rects:0, offsetW:0`，“筛选通过但不可见”完全自洽。

### 本轮改动

hover input 最近的可见祖先（真实页面即 96×96 的 `uploadImgEnter`），轮询“本地上传”按钮盒子直至展开（最多 10 次 × 250ms），展开后才执行 click；若仍未展开，输出祖先链的 `w/h/display/visibility/行内 style` 再抛错，不再用 10 秒点击超时去猜。

### 本地 A/B 验证

fixture 已改成与真实页面相同的机制（行内 `display:none` + `mouseover` 监听展开），直接抽取仓库源码执行：

- 已推送版本 `653935e`：复现出用户本机同样的 `locator.click: Timeout 10000ms exceeded`，10.0s 失败；
- 本轮修复版本：0.4s 上传成功，计数变为 `(1/10)`。

**仍未在真实拼多多页面验证**，需要用户本机跑一次确认。

### 真实页面结构是怎么拿到的

由用户在 Qoder **内置浏览器**中本人扫码登录（登录页的拼图滑块验证码由用户手动完成，未做任何验证码绕过），再用浏览器自动化接口对真实已登录页面做只读探测：祖先链几何与计算样式、样式表规则枚举（`.goodsCarousel_*` 不在可读的同源样式表内，另有 2 张跨域表被拒）、`display:none` 的行内属性确认、`mouseover` 展开前后的尺寸对比，以及临时挂钩 `HTMLInputElement.prototype.click` 计数以确认调用链（探测结束即还原）。后续接手者可直接复用这条路径，不必再靠日志猜。注意：本机云实例上的独立 Chromium 无法走通登录，不要用那条路。

## 本地同步说明

每次修改 `public/agent/agent.mjs` 后，用户只需替换本地：
`D:\ISO\pxx\pdd-agent\agent.mjs`

当前 raw 下载地址：
`https://raw.githubusercontent.com/JacketYang/automation-pxx/main/public/agent/agent.mjs`

替换后必须关闭旧 Agent 进程再重新运行 `start-agent.bat`，否则仍可能运行旧代码。若修改其他本地文件，必须逐个明确列出，不能让用户猜。

## 已知尚未完成事项（不要误报完成）

- 拼多多类目页首图上传：转义修复与首图格式闸门已在本地 fixture 验证，**真实页面仍未验证**，仍是当前阻塞。
- 详情页 `uploadByLabel`（522 行）**仍在盲报成功**：只 `sleep` 就打印“已上传 N 张”，不核对计数、预览或 `input.files`。898/899 行的商品轮播图与详情图走的都是这条路径，且传入同一个 `gallery` 数组，webp 问题同样命中。本轮按范围约定未修，勿误认为已验证。
- 点击“下一步”后稳定进入详情页：曾出现点击后仍停留在 `/goods/category`，需与首图真实上传完成状态一起验证。
- 拼多多详情表单属性自动映射：尚未完整实现，属性值不能凭空猜。
- 多 SKU 规格/价格/库存填写：已有兼容逻辑，但需要真实页面数据验证。
- 整体 1688 → 拼多多端到端流程：尚未跑通。
- Vercel 部署、网页与 Agent 连接、设置读写虽已有实现，不代表本机环境端到端验收完成。

## 2026-11-06 Linux 侧复现结论（本次改动）

在云 Linux 实例上用 Playwright fixture 复刻上述真实 DOM 链（`accept`、`multiple`、隐藏 input 嵌在“本地上传”按钮内、`上传图片 (n/10)` 计数全部一致），直接抽取仓库源码中的 `uploadCategoryCover` 执行（不复制逻辑，避免测的是另一份代码），得到三条结论。

1. **`af03a61` 的 `agent.mjs` 根本无法解析。** `agent.mjs:727` 正则字面量里的 `\\/` 在 `\\` 吃掉转义后被紧跟的 `/` 提前终止，`node --check` 报 `SyntaxError: Invalid regular expression flags`。同一文件在 Windows 上也是一运行即崩，**上传逻辑从未被执行过**。同类多余转义还有 680/706/724（`\\s` 匹配不到空白，计数文本归一化与解析失效）和 1137（`[\\s,，;；]` 实为“反斜杠或字母 s”，会把 1688 链接在每个 `s` 处切断且不按换行分割，网页提交任务必然报“没有识别到有效的 1688 商品链接”）。已全部改为单反斜杠。**273 行与 915 行的双反斜杠是正确写法，未改动**：前者需匹配 `src=\"`，后者在模板字符串内需二次转义。规律——错误全部出现在 `evaluate()` 回调内；Playwright 用 `Function.prototype.toString()` 原样搬运函数体，不需要额外转义。
2. **首图真实格式是最高概率根因。** `files.gallery[0]` 无任何格式校验，`downloadImages`（454 行）按响应 `content-type` 保留 `.webp`，UA 写死 Chrome 124，而拼多多首图 input 的 `accept` 只有 `image/jpeg,image/png`。实测：`.png` / `.jpg` 约 0.1 秒通过并把计数推到 `(1/10)`；`.webp` 时 `input.files` 有值、`File.type=image/webp`、组件静默丢弃、计数恒为 `(0/10)`，函数烧满 25 秒后才抛出“轮播图区域没有出现上传计数/预览变化”——**这句报错会把排查精确引向选择器和 DOM，而真因是文件格式**。据此新增 `sniffImageKind()`（读文件头 16 字节判定真实格式，不信扩展名）、`pickCoverImage()`（优先取真实 jpeg/png；全都不合时仍返回首张，让报错说明格式，不静默换图）与 `uploadCategoryCover` 入口的格式闸门（非 jpeg/png 立即抛出真实格式）。
3. **“点击后 DOM 重建导致验证失败”这一排查方向不成立。** fixture 中强制 React 重建整棵子树后代码仍正确通过，因为持有的是 Locator（每次 `evaluate` 重新解析）而非 ElementHandle。后续无需再投入该方向。

4. **真实页面首轮反馈（同日 22:50）否定了 webp 假设，并暴露一个新的进程级缺陷。** 用户本机日志先输出 `首图格式校验通过：jpeg`——说明该商品首图确实是 jpeg，webp 是真实存在但本轮未命中的隐患，闸门保留。随后崩溃在 `page.waitForEvent: Timeout 10000ms exceeded while waiting for event "filechooser"`，**且整个 Agent 进程直接退出**。原因是 `uploadCategoryCover` 里 `chooserPromise` 在 753 行创建、755 行才 await：只要 `button.click()` 先抛错，或候选项多于一个，这个 promise 就永远走不到 await，它 10 秒后的 rejection 无人处理，Node v15+ 默认按 throw 处理未捕获 rejection，进程连同 HTTP 服务、任务状态和诊断日志一起消失（堆栈特征：`triggerUncaughtException(err, true /* fromPromise */)`）。这解释了"闪退且什么都没输出"。已加 `chooserPromise.catch(() => {})`，本地用最小脚本复现同类崩溃（exit 1，末行未打印）验证机制成立。
5. **filechooser 不触发不是选择器问题，已改为自动判定。** 新增超时探测并写入错误文本：`hasShowOpenFilePicker`、每个 file input 的 accept/父节点标签/`display`/`pointerEvents`、`frameCount`，以及点击后 `context.pages()` 的 URL 列表。两种可解释该现象且都不需要换选择器的路径：控件走 **File System Access API**（`showOpenFilePicker` 不触发 `filechooser`，必须换上传方式），或选择器开在**新标签页/弹窗**（事件落在别的 Page 上，当前 Page 永远收不到）。fixture 的 `mode=fsa` 与 `mode=overlay` 均如实报告上述字段且进程正常退出（exit 0）。

验证边界：以上全部止于本地 fixture，**真实拼多多页面仍未验证**。判据未变——只有轮播区域计数增长、出现预览或进入已上传状态才算成功，`filechooser` 触发与 `input.files` 有值都不算。待用户在真实页面确认 `output/<任务>/gallery/` 首图后缀及本轮日志后，才能解除“当前阻塞”。

## 给后续接手者的明确要求

1. 先读取本文件、`README.md`、`public/agent/agent.mjs` 和 `public/agent/pricing.mjs`，不要推翻现有架构。
2. 当前只解决首图上传真实闭环，不重写 toast、登录检测、定价、SKU 或网页架构。
3. 使用用户给出的真实 DOM 证据；先判断 filechooser 是否触发及上传区域是否发生状态变化，再做最小且完整的修复。
4. 每次推送前检查 JS 语法（至少执行 `node --check agent.mjs`，并注意文件使用 ES module），有条件时运行定价测试和项目构建。
5. 清楚区分“代码已提交”“本地已替换”“真实页面已验证”三个状态。
6. 默认停在最终提交前，任何时候都不得擅自自动发布商品。

