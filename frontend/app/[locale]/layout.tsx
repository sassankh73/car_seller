import "../globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales } from "../../i18n/config";
import AuthProviderWrapper from "../../components/AuthProviderWrapper";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client...
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body className="bg-gray-900 min-h-screen flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <AuthProviderWrapper>
            {children}
          </AuthProviderWrapper>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
