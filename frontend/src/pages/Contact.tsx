import { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight, Clock, ExternalLink, Mail, MapPin, MessageCircle, Package, Phone, Store, Truck, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PageLoader } from "../components/ui/PageLoader";
import { MissingDetailsNotice } from "../components/MissingDetailsNotice";
import { useStoreSettings } from "../hooks/useStoreSettings";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { useAuth } from "../store/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";
import { formatPhone, formatWhatsapp, telLink, whatsappLink } from "../lib/contact";

export default function Contact() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: s, isLoading } = useStoreSettings();
  useDocumentMeta(t("footer.contact"), t("contact.description"));

  const hasChannel = Boolean(s?.whatsapp || s?.phone || s?.email);
  const legalRows = (
    [
      ["contact.legalName", s?.legalName],
      ["contact.registerNumber", s?.registerNumber],
      ["contact.taxId", s?.taxId],
      ["contact.address", s?.address],
    ] as [MessageKey, string | null | undefined][]
  ).filter(([, value]) => value);
  const socials = (
    [
      ["Facebook", s?.facebookUrl],
      ["Instagram", s?.instagramUrl],
      ["TikTok", s?.tiktokUrl],
    ] as [string, string | null | undefined][]
  ).filter(([, url]) => url);

  const quickAnswers: { to: string; icon: LucideIcon; title: MessageKey; hint: MessageKey }[] = [
    { to: "/track-order", icon: Package, title: "contact.quickTrack", hint: "contact.quickTrackHint" },
    { to: "/delivery-returns", icon: Truck, title: "contact.quickDelivery", hint: "contact.quickDeliveryHint" },
    { to: user ? "/orders" : "/track-order", icon: XCircle, title: "contact.quickCancel", hint: "contact.quickCancelHint" },
    { to: "/sell", icon: Store, title: "contact.quickSell", hint: "contact.quickSellHint" },
  ];

  return (
    <div>
      <PageHeader variant="hero" eyebrow={t("footer.help")} title={t("footer.contact")} description={t("contact.description")} />

      <div className="container-page py-10 sm:py-14">
        <MissingDetailsNotice settings={s} />

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            {isLoading ? (
              <PageLoader />
            ) : hasChannel ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {s?.whatsapp && (
                  <ChannelCard icon={MessageCircle} title="WhatsApp" hint={t("contact.whatsappHint")}>
                    <p className="font-semibold text-foreground" dir="ltr">{formatWhatsapp(s.whatsapp)}</p>
                    <a
                      href={whatsappLink(s.whatsapp, t("whatsapp.message"))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm mt-3 bg-[#25d366] text-white hover:bg-[#1fb457]"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {t("contact.whatsappCta")}
                    </a>
                  </ChannelCard>
                )}
                {s?.phone && (
                  <ChannelCard icon={Phone} title={t("contact.phone")} hint={s.openingHours ? <bdi>{s.openingHours}</bdi> : undefined}>
                    <p className="font-semibold text-foreground" dir="ltr">{formatPhone(s.phone)}</p>
                    <a href={telLink(s.phone)} className="btn-outline btn-sm mt-3">
                      <Phone className="h-4 w-4" />
                      {t("contact.call")}
                    </a>
                  </ChannelCard>
                )}
                {s?.email && (
                  <ChannelCard icon={Mail} title={t("contact.email")}>
                    <p className="break-all font-semibold text-foreground" dir="ltr">{s.email}</p>
                    <a href={`mailto:${s.email}`} className="btn-outline btn-sm mt-3">
                      <Mail className="h-4 w-4" />
                      {t("contact.write")}
                    </a>
                  </ChannelCard>
                )}
                {/* Opening hours go with the phone number when there is one. */}
                {(s?.address || (s?.openingHours && !s.phone)) && (
                  <ChannelCard icon={MapPin} title={t("contact.address")}>
                    {s?.address && (
                      <p className="text-sm text-foreground">
                        <bdi>{s.address}</bdi>
                      </p>
                    )}
                    {s?.openingHours && !s.phone && (
                      <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="sr-only">{t("contact.hours")}: </span>
                        <bdi>{s.openingHours}</bdi>
                      </p>
                    )}
                  </ChannelCard>
                )}
              </div>
            ) : (
              <div className="card p-6 text-sm text-muted-foreground">
                <p>{t("contact.soon")}</p>
                <Link to="/track-order" className="btn-outline btn-sm mt-4">
                  <Package className="h-4 w-4" />
                  {t("footer.trackOrder")}
                </Link>
              </div>
            )}

            <section>
              <h2 className="font-serif text-xl font-bold text-foreground">{t("contact.quickTitle")}</h2>
              <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {quickAnswers.map(({ to, icon: Icon, title, hint }) => (
                  <li key={title}>
                    <Link to={to} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/50">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-foreground">{t(title)}</span>
                        <span className="block text-sm text-muted-foreground">{t(hint)}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="space-y-6">
            {socials.length > 0 && (
              <div className="card p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">{t("contact.follow")}</h2>
                <ul className="mt-3 space-y-2">
                  {socials.map(([name, url]) => (
                    <li key={name}>
                      <a href={url!} target="_blank" rel="noopener noreferrer" className="link-accent inline-flex items-center gap-1.5 text-sm font-medium">
                        {name}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">{t("contact.legalTitle")}</h2>
              {legalRows.length > 0 && (
                <dl className="mt-3 space-y-2 text-sm">
                  {legalRows.map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{t(label)}</dt>
                      <dd className="font-medium text-foreground">
                        <bdi>{value}</bdi>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <ul className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
                <li><Link to="/terms" className="link-accent">{t("footer.terms")}</Link></li>
                <li><Link to="/delivery-returns" className="link-accent">{t("footer.deliveryReturns")}</Link></li>
                <li><Link to="/privacy" className="link-accent">{t("footer.privacy")}</Link></li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ChannelCard({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3 flex flex-1 flex-col items-start">{children}</div>
    </div>
  );
}
