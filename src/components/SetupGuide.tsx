export default function SetupGuide() {
  return <div className="space-y-3 text-sm text-slate-700">
    <h2 className="text-base font-semibold">连接本机 Agent（只需首次安装）</h2>
    <p>先把下面文件下载到电脑上的同一个文件夹：</p>
    <ul className="list-disc space-y-1 pl-5">
      <li><a className="text-blue-600 underline" href="/agent/agent.mjs" download>agent.mjs</a></li>
      <li><a className="text-blue-600 underline" href="/agent/package.json" download>package.json</a></li>
      <li><a className="text-blue-600 underline" href="/agent/pricing.mjs" download>pricing.mjs</a></li>
      <li><a className="text-blue-600 underline" href="/agent/pricing.test.mjs" download>pricing.test.mjs</a></li>
      <li><a className="text-blue-600 underline" href="/agent/login-agent.bat" download>login-agent.bat（首次双击登录）</a></li>
      <li><a className="text-blue-600 underline" href="/agent/start-agent.bat" download>start-agent.bat（以后双击启动）</a></li>
    </ul>
    <ol className="list-decimal space-y-2 pl-5">
      <li>安装 Node.js 18+ 和 Chrome 或 Edge。</li>
      <li>首次在文件夹打开终端，运行 <code>npm install</code>，再运行 <code>node agent.mjs login</code>，登录 1688 和拼多多。</li>
      <li>以后只需双击 <code>start-agent.bat</code>，不需要再输入商品命令。</li>
      <li>回到本网页，右上角显示「Agent 在线」后，直接粘贴商品链接并点击开始处理。</li>
    </ol>
    <p className="text-xs text-slate-500">Agent 只监听本机 127.0.0.1:17368。Cookie 和浏览器操作均保留在本机，不上传云端。关闭 Agent 窗口即可停止。</p>
  </div>;
}
