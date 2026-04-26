import type { Metadata } from "next";
import { Sora, Space_Grotesk } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { AbstractIntlMessages } from "next-intl";
import "./globals.css";

const bodyFont = Sora({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nexus",
  description:
    "Plateforme de chat temps réel avec serveurs, canaux, rôles et persistance.",
};

// Le layout est async : il récupère la locale et les messages côté serveur
// puis les injecte dans NextIntlClientProvider pour tous les composants enfants.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isTauri = process.env.NEXT_TAURI === "1";
  const locale = isTauri ? "fr" : await getLocale();
  const messages: AbstractIntlMessages = isTauri
    ? ((await import("../../messages/fr.json")).default as AbstractIntlMessages)
    : await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${bodyFont.variable} ${displayFont.variable} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
