import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "1688 → 拼多多 自动上架",
  description: "贴 1688 链接，判断能不能上架，并自动在拼多多商家后台上架。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
