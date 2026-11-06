"use client";

import { useEffect, useState } from "react";

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 pr-16 text-xs leading-relaxed text-slate-100">{children}</pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(children);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 rounded bg-slate-700 px-2 py-1 text-[11px] text-white hover:bg-slate-600"
      >
        {copied ? "已复制" : "复制"}
      </button>
    </div>
  );
}

export default function SetupGuide() {
  const [origin, setOrigin] = useState("https://你的控制台地址");
  const [os, setOs] = useState<"unix" | "win">("win");
  useEffect(() => setOrigin(window.location.origin), []);

  const download =
    os === "unix"
      ? `mkdir pdd-agent && cd pdd-agent
curl -O ${origin}/agent/agent.mjs -O ${origin}/agent/package.json -O ${origin}/agent/pricing.mjs -O ${origin}/agent/pricing.test.mjs
npm install`
      : `mkdir pdd-agent; cd pdd-agent
curl.exe -O ${origin}/agent/agent.mjs -O ${origin}/agent/package.json -O ${origin}/agent/pricing.mjs -O ${origin}/agent/pricing.test.mjs
npm install`;

  return (
    <div className="space-y-4 text-sm text-slate-700">
      <p>
        拼多多和 1688 的登录态、滑块验证都在<strong>你自己的电脑</strong>上，所以浏览器自动化由一个小程序（agent）在本机完成；
        这个网页负责收链接、给判断结果和日志。
      </p>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">1</span>
          <strong>下载 agent</strong>（需要 Node 18+ 和 Chrome/Edge）
          <span className="ml-auto flex overflow-hidden rounded-md border border-slate-300 text-xs">
            {(["unix", "win"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setOs(k)}
                className={`px-2 py-1 ${os === k ? "bg-slate-900 text-white" : "bg-white"}`}
              >
                {k === "unix" ? "Mac / Linux" : "Windows"}
              </button>
            ))}
          </span>
        </div>
        <Code>{download}</Code>
        <p className="mt-1 text-xs text-slate-500">
          也可以直接下载：<a className="text-blue-600 underline" href="/agent/agent.mjs" download>agent.mjs</a>、
          <a className="text-blue-600 underline" href="/agent/package.json" download>package.json</a>、
          <a className="text-blue-600 underline" href="/agent/README.md" target="_blank">README</a>
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">2</span>
          <strong>登录一次</strong>（会弹出一个独立的 Chrome 窗口，在里面登录 1688 和拼多多商家后台）
        </div>
        <Code>node agent.mjs login</Code>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">3</span>
          <strong>设置 Agent Token 并启动 agent，连接本控制台</strong>（保持窗口开着）
        </div>
        <Code>{os === "win" ? `$env:PDD_AGENT_TOKEN = "粘贴 Vercel 中的 AGENT_TOKEN"\nnode agent.mjs watch --server ${origin} --token $env:PDD_AGENT_TOKEN` : `export PDD_AGENT_TOKEN="粘贴 Vercel 中的 AGENT_TOKEN"\nnode agent.mjs watch --server ${origin} --token $PDD_AGENT_TOKEN`}</Code>
        <p className="mt-1 text-xs text-slate-500">先在 Vercel 环境变量中设置 AGENT_TOKEN，并在此处填入同一个值。连上后页面右上角会变成「Agent 在线」，然后在上面贴 1688 链接即可。</p>
      </div>

      <div className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        <strong>过程中需要你的地方：</strong>1688 滑块验证、登录过期、拼多多类目自动选不中——agent 会暂停并在这里显示「等待你操作」，你在弹出的浏览器里弄完它就自动继续。
        <br />
        <strong>不想用网页：</strong>直接 <code>node agent.mjs list &lt;1688链接&gt; --submit</code> 也可以。
      </div>
    </div>
  );
}
