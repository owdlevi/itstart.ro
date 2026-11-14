import type messages from "../../messages/ro.json";
import type { locale } from "./request";

// Typed message keys: a missing or misspelt key fails type-checking.
declare module "next-intl" {
  interface AppConfig {
    Locale: typeof locale;
    Messages: typeof messages;
  }
}
