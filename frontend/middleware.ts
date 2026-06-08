import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware({
  locales: ["sv", "en"],
  defaultLocale: "sv",
  localePrefix: "always",
});

const PROTECTED_PATTERN = /^\/[a-z]{2}\/(dashboard|admin)(\/|$)/;
const AUTH_PAGE_PATTERN = /^\/[a-z]{2}\/auth\/(login|register|forgot-password)(\/|$)/;

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authCookie = request.cookies.get("auth_token");
  const locale = pathname.split("/")[1] || "sv";

  // Gate protected routes — redirect to login if no auth cookie
  if (PROTECTED_PATTERN.test(pathname) && !authCookie) {
    return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url));
  }

  // Gate auth pages — redirect to dashboard if already authenticated
  if (AUTH_PAGE_PATTERN.test(pathname) && authCookie) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
