import { NextRequest, NextResponse } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
export function proxy(request:NextRequest) {
 const path=request.nextUrl.pathname;
 if(path==="/login"||path.startsWith("/agent/")||path==="/favicon.ico") return NextResponse.next();
 if(isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
 return NextResponse.redirect(new URL("/login",request.url));
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|api/).*)"]};
