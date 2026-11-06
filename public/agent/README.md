# 1688 → 拼多多 自动上架 agent

运行在你自己的电脑上（需要 Node 18+ 和已安装的 Chrome 或 Edge）。
它会用一个独立的浏览器配置目录（`chrome-profile/`，不会动你平时的 Chrome），所以**你只需要在弹出的窗口里登录一次**。

```bash
npm install                     # 只装 playwright-core，不下载浏览器
node agent.mjs login            # 首次：登录 1688 + 拼多多商家后台，然后回终端按回车

# 方式 A：不用网页，直接命令行
node agent.mjs check https://detail.1688.com/offer/123456789012.html            # 只判断
node agent.mjs list  https://detail.1688.com/offer/123456789012.html            # 判断 + 填好表单，停在提交前
node agent.mjs list  https://detail.1688.com/offer/123456789012.html --submit   # 判断 + 填写 + 自动提交

# 方式 B：接网页控制台（在网页里贴链接，批量处理、看日志和判断理由）
node agent.mjs watch --server https://你的控制台地址
```

## 遇到验证码 / 掉登录怎么办
agent 检测到 1688 滑块、1688 或拼多多登录页时会**暂停并提示**，你在弹出的浏览器里手动处理完，它会自动继续。

## 输出
`output/<商品ID>/` 下有：`product.json`（采集结果+判断+定价）、`gallery/ sku/ detail/`（下载的图片）、`*-filled.png`（填完表单的截图）、`error.png`（出错截图）。

## 自动填写不准怎么办
拼多多后台页面会改版，类目不同表单也不同。运行：

```bash
node agent.mjs inspect-pdd
```

按提示手动进到发布表单页，会生成 `output/pdd-form.json` 和 `pdd-form.png`，把这两个文件和出错的 `error.png` 发出来即可调整选择器。

## 常用参数
`--profile <目录>` `--cdp [http://127.0.0.1:9222]`（连已打开的 Chrome）`--channel chrome|msedge` `--category <类目词>` `--config rules.json`（覆盖加价/违禁词等）`--out <目录>`
