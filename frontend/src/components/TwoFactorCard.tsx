import { useState, FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff, Copy } from "lucide-react";
import { twoFactorApi } from "../api/twoFactor";
import { useAuth, useInvalidateAuth } from "../store/AuthContext";
import toast from "react-hot-toast";

// Two-factor sign-in for admin accounts (authenticator app + recovery codes).
export function TwoFactorCard() {
  const { user } = useAuth();
  const invalidateAuth = useInvalidateAuth();
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
      toast.success("Two-factor sign-in is on");
    },
    onError: (err: any) => toast.error(String(err)),
  });
  const disable = useMutation({
    mutationFn: () => twoFactorApi.disable(code),
    onSuccess: () => {
      setCode("");
      invalidateAuth();
      toast.success("Two-factor sign-in turned off");
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
          <h2 className="font-semibold text-foreground">Two-factor sign-in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {enabled
              ? "On — signing in needs your password and a code from your authenticator app."
              : "Recommended for every admin: a stolen password alone won't be enough to get in."}
          </p>
        </div>
      </div>

      {recoveryCodes && (
        <div className="mt-4 rounded-lg border border-warning/40 bg-warning-soft p-4">
          <p className="text-sm font-semibold text-warning">Save these recovery codes now — they won't be shown again.</p>
          <p className="mt-1 text-xs text-muted-foreground">Each one signs you in once if you lose your phone.</p>
          <pre className="mt-3 grid grid-cols-2 gap-1 font-mono text-sm text-foreground">{recoveryCodes.join("\n")}</pre>
          <button
            type="button"
            className="btn-outline btn-sm mt-3"
            onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n")).then(() => toast.success("Copied"))}
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </div>
      )}

      {!enabled && !setup && (
        <button onClick={() => start.mutate()} disabled={start.isPending} className="btn-primary mt-4">
          Set up two-factor sign-in
        </button>
      )}

      {(setup || enabled) && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          {setup && (
            <div className="flex flex-wrap items-center gap-4">
              <img src={setup.qrDataUrl} alt="QR code for your authenticator app" className="h-44 w-44 rounded-lg border border-border bg-white p-1" />
              <div className="min-w-0 text-sm text-muted-foreground">
                <p>1. Scan this with Google Authenticator, Authy or Microsoft Authenticator.</p>
                <p className="mt-1">Or enter this key: <code className="break-all font-mono text-foreground">{setup.secret}</code></p>
                <p className="mt-1">2. Type the 6-digit code it shows.</p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={setup ? "123456" : "Code or recovery code"}
              className="input max-w-xs font-mono"
              autoComplete="one-time-code"
              required
            />
            <button type="submit" disabled={enable.isPending || disable.isPending} className={setup ? "btn-primary" : "btn-outline"}>
              {setup ? "Turn on" : "Turn off"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
