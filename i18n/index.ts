import { I18n } from "i18n-js";
import * as Localization from "expo-localization";

import { en } from "./en";
import { tl } from "./tl";
import type { Language } from "@/types";

export const i18n = new I18n({ en, tl });

i18n.defaultLocale = "en";
i18n.locale = Localization.getLocales()[0]?.languageCode === "tl" ? "tl" : "en";
i18n.enableFallback = true;

export function setAppLanguage(language: Language) {
  i18n.locale = language;
}

export function t(scope: string, options?: Record<string, unknown>) {
  return i18n.t(scope, options);
}
