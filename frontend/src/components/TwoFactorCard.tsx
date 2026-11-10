import { useState, FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff, Copy } from "lucide-react";
import { twoFactorApi } from "../api/twoFactor";
import { useAuth, useInvalidateAuth } from "../store/AuthContext";
import toast from "react-hot-toast";
import { useI18n } from "../i18n/I18nProvider";

// Two-factor sign-in for admin accounts (authenticator app + recovery codes).
export function TwoFactorCard() {
  const { user } = useAuth();
  const invalidateAuth = useInvalidateAuth();
  const { t } = useI18n();
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const start = useMutation({
    mutationFn: twoFactorApi.setup,
    onSuccess: (data) => setSetup(data),
    onError: (err: any) => toast.error(String(err)),
  });
  const enable = useMutation({
    mutationFn: () => twoFactorApi.enable(code),
    onSuccess: (data) => {
      setRecoveryCodes(data.recoveryCodes);
      setSetup(null);
      setCode("");
      invalidateAuth();
      toast.success(t("twofa.on"));
    },
    onError: (err: any) => toast.error(String(err)),
  });
  const disable = useMutation({
    mutationFn: () => twoFactorApi.disable(code),
    onSuccess: () => {
      setCode("");
      invalidateAuth();
      toast.success(t("twofa.off"));
    },
    onError: (err: any) => toast.error(String(err)),
  });

  if (!user) return null;
  const enabled = !!user.totpEnabledAt;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (setup) enable.mutate();
    else disable.mutate();
  }

  return (
    <div className="card mt-6 p-6">
      <div className="flex items-start gap-3">
        {enabled ? <ShieldCheck className="mt-0.5 h-5 w-5 text-success" /> : <ShieldOff className="mt-0.5 h-5 w-5 text-warning" />}
        <div className="flex-1">
          <h2 className="font-semibold text-foreground">{t("twofa.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {enabled
              ? t("twofa.enabledBody")
              : t("twofa.disabledBody")}
          </p>
        </div>
      </div>

      {recoveryCodes && (
        <div className="mt-4 rounded-lg border border-warning/40 bg-warning-soft p-4">
          <p className="text-sm font-semibold text-warning">{t("twofa.saveCodes")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("twofa.codesHint")}</p>
          <pre className="mt-3 grid grid-cols-2 gap-1 font-mono text-sm text-foreground">{recoveryCodes.join("\n")}</pre>
          <button
            type="button"
            className="btn-outline btn-sm mt-3"
            onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n")).then(() => toast.success(t("twofa.copied")))}
          >
            <Copy className="h-3.5 w-3.5" /> {t("twofa.copy")}
          </button>
        </div>
      )}

      {!enabled && !setup && (
        <button onClick={() => start.mutate()} disabled={start.isPending} className="btn-primary mt-4">
          {t("twofa.setup")}
        </button>
      )}

      {(setup || enabled) && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          {setup && (
            <div className="flex flex-wrap items-center gap-4">
              <img src={setup.qrDataUrl} alt={t("twofa.qrAlt")} className="h-44 w-44 rounded-lg border border-border bg-white p-1" />
              <div className="min-w-0 text-sm text-muted-foreground">
                <p>{t("twofa.step1")}</p>
                <p className="mt-1">{t("twofa.orKey")} <code className="break-all font-mono text-foreground">{setup.secret}</code></p>
                <p className="mt-1">{t("twofa.step2")}</p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={setup ? "123456" : t("twofa.codePlaceholder")}
              className="input max-w-xs font-mono"
              autoComplete="one-time-code"
              required
            />
            <button type="submit" disabled={enable.isPending || disable.isPending} className={setup ? "btn-primary" : "btn-outline"}>
              {setup ? t("twofa.turnOn") : t("twofa.turnOff")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
