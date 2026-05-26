import { getRequestConfig } from "next-intl/server";

const locales = ["en", "sv"] as const;

export default getRequestConfig(async ({ locale }) => {
  // Ensure locale is a valid string
  const validLocale =
    locale && typeof locale === "string"
      ? locale.replace(/^\/+|\/+$/g, "").trim()
      : "sv"; // Default to Swedish

  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(validLocale as any)) {
    console.log("Invalid locale '" + validLocale + "', falling back to 'sv'");
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
