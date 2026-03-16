import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

// Ce fichier est exécuté côté serveur à chaque requête.
// Il lit le cookie "locale" pour savoir quelle langue charger.
// Si le cookie n'existe pas, on tombe sur "fr" par défaut.
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value ?? "fr";

  // Charge le fichier messages/fr.json ou messages/en.json
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return { locale, messages };
});
