"use client";

import { BarChart3, Check, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { AuthShell } from "@/components/auth/auth-pages";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseClient } from "@/lib/supabase";

interface LookupInfo {
  email: string;
  organizationName: string;
  organizationTag: string;
  expiresAt: string;
}

type LookupState =
  | { kind: "loading" }
  | { kind: "invalid"; message: string }
  | { kind: "valid"; info: LookupInfo };

/**
 * /accept-invite — token-driven join flow.
 *
 * The invited email is LOCKED (never editable) and the role, organization,
 * target and expiry are read server-side from the invitations row. The raw
 * token only identifies the invitation; the accept itself runs through the
 * accept_invitation SECURITY DEFINER RPC as the logged-in invited user.
 */
export function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const { isAuthenticated, isReady, resolveOrganization, signIn, signUp, signOut } = useAuth();

  const [lookup, setLookup] = useState<LookupState>({ kind: "loading" });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [confirmSent, setConfirmSent] = useState(false);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    async function lookupInvite() {
      if (!token) {
        setLookup({ kind: "invalid", message: "This invitation link is missing its token." });
        return;
      }
      try {
        const response = await fetch(`/api/invite/lookup?token=${encodeURIComponent(token)}`);
        const json = await response.json().catch(() => null);
        if (!active) return;
        if (!response.ok || !json?.email) {
          setLookup({ kind: "invalid", message: json?.error ?? "This invitation link is invalid." });
          return;
        }
        setLookup({
          kind: "valid",
          info: {
            email: String(json.email),
            organizationName: String(json.organizationName ?? ""),
            organizationTag: String(json.organizationTag ?? ""),
            expiresAt: String(json.expiresAt ?? ""),
          },
        });
      } catch {
        if (active) setLookup({ kind: "invalid", message: "Could not reach the server. Try again." });
      }
    }
    void lookupInvite();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) {
      setUserEmail(null);
      return;
    }
    let active = true;
    void getSupabaseClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setUserEmail(data.user?.email?.toLowerCase() ?? null);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, isReady]);

  const handleSignUp = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (lookup.kind !== "valid") return;
      if (!fullName.trim()) {
        setFormError("Enter your full name.");
        return;
      }
      if (password.length < 8) {
        setFormError("Password must be at least 8 characters.");
        return;
      }
      setPending(true);
      setFormError(null);
      // Confirmation link returns to this exact page with the same token.
      const redirect = `${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`;
      const result = await signUp(fullName.trim(), lookup.info.email, password, redirect);
      setPending(false);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      if (result.needsEmailConfirmation) setConfirmSent(true);
    },
    [lookup, fullName, password, signUp, token],
  );

  const handleSignIn = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (lookup.kind !== "valid") return;
      if (!password) {
        setFormError("Enter your password.");
        return;
      }
      setPending(true);
      setFormError(null);
      const error = await signIn(lookup.info.email, password);
      setPending(false);
      if (error) setFormError(error);
    },
    [lookup, password, signIn],
  );

  const handleAccept = useCallback(async () => {
    setPending(true);
    setAcceptError(null);
    const { error } = await getSupabaseClient().rpc("accept_invitation", { raw_token: token });
    if (error) {
      setAcceptError(error.message);
      setPending(false);
      return;
    }
    const resolved = await resolveOrganization();
    if (resolved.error) {
      setAcceptError(resolved.error);
      setPending(false);
      return;
    }
    router.replace("/dashboard");
  }, [token, resolveOrganization, router]);

  const info = lookup.kind === "valid" ? lookup.info : null;
  const emailMatches = Boolean(info && userEmail && userEmail === info.email.toLowerCase());

  if (lookup.kind === "loading" || !isReady) {
    return (
      <AuthShell>
        <p className="text-sm text-muted-foreground">Loading invitation…</p>
      </AuthShell>
    );
  }

  if (lookup.kind === "invalid") {
    return (
      <AuthShell>
        <div className="w-full max-w-sm space-y-4 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Invitation unavailable</h1>
          <p className="text-sm text-muted-foreground">{lookup.message}</p>
          <Button variant="outline" onClick={() => router.replace("/")}>
            Back to SalesFlow
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (confirmSent && info) {
    return (
      <AuthShell>
        <div className="w-full max-w-sm space-y-4 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Confirm your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <span className="font-medium text-foreground">{info.email}</span>.
            Open it and you will return to this invitation automatically.
          </p>
          <Button variant="outline" onClick={() => setConfirmSent(false)}>
            I have confirmed — continue
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (isAuthenticated && info) {
    if (!emailMatches) {
      return (
        <AuthShell>
          <div className="w-full max-w-md space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Wrong account</h1>
            <p className="text-sm text-muted-foreground">
              You are signed in as <span className="font-medium text-foreground">{userEmail ?? "another user"}</span>,
              but this invitation was sent to <span className="font-medium text-foreground">{info.email}</span>.
            </p>
            <Button
              onClick={() => {
                signOut();
                setUserEmail(null);
                setFormError(null);
                setAcceptError(null);
              }}
            >
              Sign out and switch account
            </Button>
          </div>
        </AuthShell>
      );
    }

    return (
      <AuthShell>
        <div className="w-full max-w-md space-y-5">
          <div className="space-y-2 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">Join {info.organizationName}</h1>
            <p className="text-sm text-muted-foreground">
              You were invited to join as a sales representative
              {info.organizationTag ? (
                <>
                  {" "}
                  <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold">
                    {info.organizationTag}
                  </span>
                </>
              ) : null}
              .
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="accept-email">Invited email</Label>
            <div className="relative">
              <Input id="accept-email" value={info.email} readOnly className="pr-9" />
              <LockKeyhole className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p className="text-2xs text-muted-foreground">
              Locked to the invited address. {info.expiresAt ? `Expires ${new Date(info.expiresAt).toLocaleString()}.` : ""}
            </p>
          </div>

          {acceptError ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {acceptError}
            </p>
          ) : null}

          <Button className="h-11 w-full" onClick={() => void handleAccept()} disabled={pending}>
            {pending ? "Joining…" : "Accept invitation"}
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Join {info?.organizationName ?? "the team"}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {mode === "signup" ? "Create your account" : "Sign in to accept"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signup"
              ? "Create your account, then accept the invitation to join."
              : "Sign in with the invited email to accept your invitation."}
          </p>
        </div>

        <form className="space-y-5" onSubmit={mode === "signup" ? handleSignUp : handleSignIn}>
          <div className="space-y-2">
            <Label htmlFor="accept-email">Invited email</Label>
            <Input id="accept-email" value={info?.email ?? ""} readOnly />
          </div>

          {mode === "signup" ? (
            <div className="space-y-2">
              <Label htmlFor="accept-name">Full name</Label>
              <Input
                id="accept-name"
                name="fullName"
                type="text"
                required
                autoComplete="name"
                placeholder="Alex Morgan"
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value);
                  setFormError(null);
                }}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="accept-password">
              {mode === "signup" ? "Choose a password" : "Password"}
            </Label>
            <Input
              id="accept-password"
              name="password"
              type="password"
              required
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFormError(null);
              }}
            />
          </div>

          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}

          <Button className="h-11 w-full" type="submit" disabled={pending}>
            {pending
              ? mode === "signup"
                ? "Creating account…"
                : "Signing in…"
              : mode === "signup"
                ? "Create account & continue"
                : "Sign in & continue"}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setFormError(null);
              }}
            >
              {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
            </button>
            <Link className="text-xs font-medium text-muted-foreground hover:underline" href="/">
              Back to SalesFlow
            </Link>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}
