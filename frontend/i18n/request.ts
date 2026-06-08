import { getRequestConfig } from "next-intl/server";

const locales = ["sv", "en"] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const validLocale =
    requested && typeof requested === "string"
      ? requested.replace(/^\/+|\/+$/g, "").trim()
      : "sv";

  if (!locales.includes(validLocale as any)) {
    return {
      locale: "sv",
      messages: (await import("../messages/sv.json")).default,
    };
  }

  const messages = await import("../messages/" + validLocale + ".json");
  return {
    locale: validLocale,
    messages: messages.default,
  };
});
