export default function SetupGuide() {
  return <div className="space-y-3 text-sm text-slate-700">
    <h2 className="text-base font-semibold">连接本机 Agent（只需首次安装）</h2>
    <ol className="list-decimal space-y-2 pl-5">
      <li>下载并解压 <a className="text-blue-600 underline" href="/agent/agent-package.zip">Windows Agent 安装包</a>。</li>
      <li>首次在该文件夹打开终端，运行 <code>npm install</code>，然后运行 <code>node agent.mjs login</code>，在弹出的浏览器分别登录 1688 和拼多多。</li>
      <li>以后双击 <code>start-agent.bat</code> 启动即可。浏览器会复用已保存的登录状态。</li>
      <li>回到本网页，右上角显示「Agent 在线」后，直接粘贴 1688 链接并点击开始处理。</li>
    </ol>
    <p className="text-xs text-slate-500">Agent 只在本机 127.0.0.1:17368 提供服务。浏览器 Cookie、商品采集内容和操作过程均保留在本机。关闭 Agent 窗口即可停止。</p>
  </div>;
}
