import { getRequestConfig } from "next-intl/server";
import messages from "../../messages/ro.json";

// One fixed locale and no locale in URLs (DECISIONS, stack: i18n). Hungarian
// will add a second messages file and pick the locale here.
export const locale = "ro";

export default getRequestConfig(async () => ({
  locale,
  messages,
  timeZone: "Europe/Bucharest",
}));
