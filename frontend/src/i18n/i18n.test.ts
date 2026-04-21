import { describe, expect, it } from "@jest/globals";

import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

type JsonLeaf = string;
type JsonNode = { [key: string]: JsonLeaf | JsonNode };
type JsonValue = JsonLeaf | JsonNode;
type LocaleFile = Record<string, JsonValue>;

const flattenKeys = (obj: JsonValue, prefix = ""): string[] => {
  if (typeof obj === "string") return [prefix];
  return Object.entries(obj).flatMap(([key, value]) =>
    flattenKeys(value, prefix ? `${prefix}.${key}` : key)
  );
};

const flattenEntries = (obj: JsonValue, prefix = ""): [string, string][] => {
  if (typeof obj === "string") return [[prefix, obj]];
  return Object.entries(obj).flatMap(([key, value]) =>
    flattenEntries(value, prefix ? `${prefix}.${key}` : key)
  );
};

const extractVariables = (value: string): string[] => {
  const matches = value.match(/\{[^}]+\}/g);
  return matches ? [...new Set(matches)].sort() : [];
};

const locales: Record<string, LocaleFile> = { fr, en, es };

describe("i18n — translation files", () => {
  it("all locales have exactly the same keys (no missing or extra key)", () => {
    const keysByLocale = Object.entries(locales).map(([name, file]) => ({
      name,
      keys: new Set(flattenKeys(file)),
    }));

    const reference = keysByLocale[0];

    for (const { name, keys } of keysByLocale.slice(1)) {
      const missing = [...reference.keys].filter((k) => !keys.has(k));
      const extra = [...keys].filter((k) => !reference.keys.has(k));

      expect(missing).toEqual([]);
      expect(extra).toEqual([]);

      if (missing.length > 0) {
        throw new Error(`[${name}] missing keys: ${missing.join(", ")}`);
      }
      if (extra.length > 0) {
        throw new Error(`[${name}] extra keys not in fr: ${extra.join(", ")}`);
      }
    }
  });

  it("no translation value is empty", () => {
    for (const [locale, file] of Object.entries(locales)) {
      const entries = flattenEntries(file);
      const empty = entries.filter(([, value]) => value.trim() === "");
      expect(empty.map(([key]) => `${locale}.${key}`)).toEqual([]);
    }
  });

  it("interpolation variables are consistent across all locales", () => {
    const entriesByLocale = Object.fromEntries(
      Object.entries(locales).map(([name, file]) => [
        name,
        Object.fromEntries(flattenEntries(file)),
      ])
    );

    const frKeys = Object.keys(entriesByLocale.fr);

    for (const key of frKeys) {
      const frVars = extractVariables(entriesByLocale.fr[key]);
      if (frVars.length === 0) continue;

      for (const [locale, entries] of Object.entries(entriesByLocale)) {
        if (locale === "fr") continue;
        const vars = extractVariables(entries[key] ?? "");
        expect(vars).toEqual(frVars);
      }
    }
  });
});

describe("LanguageSwitcher — locale cycle", () => {
  const LOCALES = ["fr", "en", "es"] as const;

  const getNext = (current: string): string => {
    const index = LOCALES.indexOf(current as (typeof LOCALES)[number]);
    return LOCALES[(index + 1) % LOCALES.length];
  };

  it("cycles through fr → en → es → fr", () => {
    expect(getNext("fr")).toBe("en");
    expect(getNext("en")).toBe("es");
    expect(getNext("es")).toBe("fr");
  });
});
