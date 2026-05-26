import createMiddleware from "next-intl/middleware";

export default createMiddleware({
  // A list of all locales that are supported
  locales: ["en", "sv"],

  // Used when no locale matches - Swedish is the primary market
  defaultLocale: "sv",

  // Always include the locale prefix
  localePrefix: "always",
});

export const config = {
  // Match only pathnames that need locale handling
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
