import "@testing-library/jest-dom";
import "@testing-library/jest-dom/jest-globals";
import { jest } from "@jest/globals";
import fr from "./messages/fr.json";

type Translations = Record<string, Record<string, string>>;

jest.mock("@/components/LanguageSwitcher", () => () => null);

jest.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const ns = (fr as Translations)[namespace];
    return ns?.[key] ?? key;
  },
  useLocale: () => "fr",
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
