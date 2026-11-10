import { Request } from "express";
import { Locale, localeFromHeader } from "../emails/i18n";

// The storefront language of this request (sent as Accept-Language), "en"
// when there's none we support.
export function requestLocale(req: Request<any>): Locale {
  return localeFromHeader(req.header("accept-language")) ?? "en";
}
