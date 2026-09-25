"use client";

import { ArrowRight, BarChart3, Check, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.28),_transparent_38%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.16),_transparent_34%)]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden flex-col justify-between bg-blue-600 p-10 text-white lg:flex">
          <div>
            <div className="mb-16 flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span className="flex size-9 items-center justify-center rounded-lg bg-white/15">
                <BarChart3 className="size-5" />
              </span>
              SalesFlow
            </div>
            <p className="max-w-xs text-3xl font-semibold leading-tight tracking-tight">
              Turn pipeline signals into confident revenue decisions.
            </p>
          </div>
          <div className="space-y-4 text-sm text-blue-100">
            <p className="flex items-center gap-2"><Check className="size-4" /> Forecast with a clear view of every deal</p>
            <p className="flex items-center gap-2"><Check className="size-4" /> Keep your team focused on what moves revenue</p>
            <p className="flex items-center gap-2"><Check className="size-4" /> Bring accounts, activities, and goals together</p>
          </div>
        </section>
        <section className="flex items-center justify-center p-6 sm:p-10">{children}</section>
      </div>
    </main>
  );
}

export function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isReady, signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isReady && isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, isReady, router]);

  if (!isReady || isAuthenticated) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const signInError = await signIn(String(form.get("email")), String(form.get("password")));
    if (signInError) {
      setError(signInError);
      setPending(false);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <AuthShell>
      <div className="w-full max-w-md space-y-8">
        <div>
          <div className="mb-6 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary lg:hidden">
            <BarChart3 className="size-5" />
          </div>
          <p className="mb-2 text-sm font-medium text-primary">Welcome back</p>
          <h1 className="text-3xl font-semibold tracking-tight">Sign in to SalesFlow</h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage your pipeline and keep your team moving forward.</p>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2"><Label htmlFor="login-email">Work email</Label><Input id="login-email" name="email" type="email" placeholder="you@company.com" required /></div>
          <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="login-password">Password</Label><Link className="text-xs font-medium text-primary hover:underline" href="#">Forgot password?</Link></div><Input id="login-password" name="password" type="password" placeholder="Enter your password" required /></div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="h-11 w-full" type="submit" disabled={pending}>{pending ? "Signing in..." : "Sign in"} <ArrowRight /></Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">New to SalesFlow? <Link className="font-medium text-primary hover:underline" href="/signup">Create an account</Link></p>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="size-3.5" /> Secure workspace access</p>
      </div>
    </AuthShell>
  );
}

export function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await signUp(
      String(form.get("fullName")),
      String(form.get("email")),
      String(form.get("password")),
    );
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    if (result.needsEmailConfirmation) {
      setError("Check your email to confirm your account, then return here to sign in.");
      setPending(false);
      return;
    }
    router.push("/onboarding");
  }

  return (
    <AuthShell>
      <div className="w-full max-w-md space-y-8">
        <div><p className="mb-2 text-sm font-medium text-primary">Start your workspace</p><h1 className="text-3xl font-semibold tracking-tight">Create your account</h1><p className="mt-2 text-sm text-muted-foreground">Set up your SalesFlow workspace in a few quick steps.</p></div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2"><Label htmlFor="signup-name">Full name</Label><Input id="signup-name" name="fullName" type="text" placeholder="Alex Morgan" required /></div>
          <div className="space-y-2"><Label htmlFor="signup-email">Work email</Label><Input id="signup-email" name="email" type="email" placeholder="you@company.com" required /></div>
          <div className="space-y-2"><Label htmlFor="signup-password">Password</Label><Input id="signup-password" name="password" type="password" placeholder="At least 8 characters" minLength={8} required /></div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="h-11 w-full" type="submit" disabled={pending}>{pending ? "Creating account..." : "Continue to setup"} <ArrowRight /></Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">Already have an account? <Link className="font-medium text-primary hover:underline" href="/">Sign in</Link></p>
      </div>
    </AuthShell>
  );
}

export function OnboardingPage() {
  const router = useRouter();
  const { createWorkspace, isAuthenticated, isReady, workspaceId } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isReady && !isAuthenticated) router.replace("/signup");
    if (isReady && workspaceId) router.replace("/dashboard");
  }, [isAuthenticated, isReady, router, workspaceId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const createError = await createWorkspace(String(form.get("workspaceName")), String(form.get("teamSize")));
    if (createError) {
      setError(createError);
      setPending(false);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <AuthShell>
      <div className="w-full max-w-md space-y-8">
        <div><p className="mb-2 text-sm font-medium text-primary">Step 1 of 1</p><h1 className="text-3xl font-semibold tracking-tight">Tell us about your team</h1><p className="mt-2 text-sm text-muted-foreground">We’ll tailor your pipeline workspace to the way you sell.</p></div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2"><Label htmlFor="workspace-name">Workspace name</Label><Input id="workspace-name" name="workspaceName" type="text" placeholder="Acme Sales" required /></div>
          <div className="space-y-2"><Label htmlFor="team-size">Team size</Label><select id="team-size" name="teamSize" className="flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-sm" defaultValue="1-10"><option value="1-10">1-10 people</option><option value="11-50">11-50 people</option><option value="51-200">51-200 people</option><option value="201+">201+ people</option></select></div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="h-11 w-full" type="submit" disabled={pending}>{pending ? "Creating workspace..." : "Open my dashboard"} <ArrowRight /></Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">Already have an account? <Link className="font-medium text-primary hover:underline" href="/">Sign in instead</Link></p>
      </div>
    </AuthShell>
  );
}
