import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export default getRequestConfig(async () => {
  // Lit le cookie "locale" posé par le LanguageSwitcher
  // Si absent → français par défaut
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value ?? "fr";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
