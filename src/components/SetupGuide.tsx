export default function SetupGuide() {
  return (
    <div className="space-y-3 text-sm text-slate-700">
      <p>Agent 在你的 Windows 电脑运行。浏览器登录态保存在本机，不需要 Vercel 环境变量或云端数据库。</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>下载仓库 <code>public/agent</code> 目录中的 <code>agent.mjs</code>、<code>package.json</code>、<code>pricing.mjs</code> 和 <code>pricing.test.mjs</code>。</li>
        <li>在该目录打开 PowerShell，运行 <code>npm install</code>。</li>
        <li>运行 <code>node agent.mjs login</code>，在弹出的浏览器登录 1688 和拼多多商家后台。</li>
        <li>使用首页生成命令，先执行分析或填表模式；核对无误后再提交。</li>
      </ol>
      <p className="text-xs text-slate-500">不要分享密码、验证码或 chrome-profile。Agent 不需要 Token，也不连接云端任务队列。</p>
    </div>
  );
}
