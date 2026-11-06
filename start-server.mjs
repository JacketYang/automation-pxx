// 单入口启动器：一个进程、一个控制台窗口，统一管理
//   1) 常驻浏览器（CDP 9222，独立进程，登录态持久）
//   2) 本机 Agent 服务（127.0.0.1:17368）
//   3) Next.js 工作台（localhost:3000）
// 只打开一个浏览器窗口指向工作台。
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const agentDir = path.join(here, "public", "agent");
const ps1 = path.join(agentDir, "ensure-browser.ps1");

function log(tag, msg) {
  const t = new Date().toLocaleTimeString();
  console.log(`[${t}] [${tag}] ${msg}`);
}

// 1) 确保常驻浏览器已启动（独立进程，跨命令保留登录态）
try {
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1], { stdio: "inherit" });
} catch (e) {
  log("browser", "启动脚本执行异常：" + e.message + "（agent 会自行兜底）");
}

// 2) 若首次运行，先构建
if (!fs.existsSync(path.join(here, "node_modules", "next"))) {
  log("web", "首次运行，安装依赖并构建…");
  try { execFileSync("npm", ["install"], { cwd: here, stdio: "inherit", shell: true }); } catch (e) { log("web", "npm install 失败：" + e.message); }
  try { execFileSync("npm", ["run", "build"], { cwd: here, stdio: "inherit", shell: true }); } catch (e) { log("web", "npm run build 失败：" + e.message); }
}

// 3) 两个子进程，日志汇到本控制台
const children = [];
function startChild(tag, cmdArgs, cwd) {
  // Windows 的 node/npx 是 .cmd，直接 spawn(shell:false) 会 EINVAL；
  // 用 cmd.exe /d /s /c 显式包裹，既避免 DEP0190 又能正确启动。
  const full = process.platform === "win32"
    ? ["cmd.exe", ["/d", "/s", "/c", cmdArgs.join(" ")]]
    : [cmdArgs[0], cmdArgs.slice(1)];
  const c = spawn(full[0], full[1], { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
  const pipe = (stream) => stream.on("data", (d) => process.stdout.write(`[${tag}] ` + d.toString()));
  pipe(c.stdout); pipe(c.stderr);
  c.on("exit", (code) => log(tag, `进程退出 code=${code}`));
  c.on("error", (e) => log(tag, "启动失败：" + e.message));
  children.push(c);
  return c;
}

startChild("agent", ["node", "agent.mjs", "start"], agentDir);
startChild("web", ["npx", "next", "start", "-p", "3000"], here);

// 4) 等 3000 就绪后，只开一个浏览器窗口
function waitPort(port, timeoutMs = 30000) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => { res.resume(); resolve(true); });
      req.on("error", () => {});
      req.setTimeout(800, () => req.destroy());
      if (Date.now() - t0 > timeoutMs) { resolve(false); return; }
      setTimeout(tick, 500);
    };
    tick();
  });
}

(async () => {
  const ok = await waitPort(3000);
  if (ok) {
    log("web", "工作台已就绪：http://localhost:3000");
    // 在常驻 Chrome（9222）里打开工作台标签 —— 不新开浏览器进程，始终只有一个窗口。
    // 用 CDP /json/new 需要 PUT，回退到 /json/list 复用已有标签再导航。
    const openTab = (method, urlPath) => new Promise((resolve) => {
      const req = http.request({ host: "127.0.0.1", port: 9222, path: urlPath, method }, (res) => {
        let b = ""; res.on("data", (d) => b += d); res.on("end", () => resolve(b));
      });
      req.on("error", () => resolve("")); req.setTimeout(3000, () => req.destroy());
      req.end();
    });
    let opened = false;
    try {
      const created = await openTab("PUT", "/json/new?http://localhost:3000/");
      opened = Boolean(created && created.includes("localhost:3000"));
    } catch {}
    if (!opened) {
      // 回退：让系统默认浏览器打开（可能是第二个窗口，但保证工作台能开）
      try { if (process.platform === "win32") spawn("cmd", ["/c", "start", "", "http://localhost:3000/"], { stdio: "ignore", detached: true, shell: false }).unref(); } catch {}
    }
  } else {
    log("web", "工作台 3000 未在预期时间内就绪，请查看上方日志");
  }
  log("main", "单窗口运行中：关闭此窗口将停止 Agent 与工作台（常驻浏览器保留登录态）");
})();

// 优雅退出：本窗口被关闭时，终止两个子进程（常驻浏览器是独立进程，不受影响）
function shutdown() {
  for (const c of children) { try { c.kill(); } catch {} }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
