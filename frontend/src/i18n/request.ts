import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  if (process.env.NEXT_TAURI === "1") {
    return {
      locale: "fr",
      messages: (await import("../../messages/fr.json")).default,
    };
  }

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value ?? "fr";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
