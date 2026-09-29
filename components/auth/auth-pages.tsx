"use client";

import { ArrowRight, BarChart3, Check, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { useAuth, type WorkspaceSetupDetails } from "@/components/auth/auth-provider";
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

export function WelcomePage() {
  const router = useRouter();
  const { configurationError, isAuthenticated, isReady, workspaceId } = useAuth();

  useEffect(() => {
    if (isReady && isAuthenticated) router.replace(workspaceId ? "/dashboard" : "/onboarding");
  }, [isAuthenticated, isReady, router, workspaceId]);

  if (!isReady || isAuthenticated) return null;

  return (
    <AuthShell>
      <div className="w-full max-w-md space-y-8">
        <div>
          <div className="mb-6 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary lg:hidden">
            <BarChart3 className="size-5" />
          </div>
          <p className="mb-2 text-sm font-medium text-primary">SalesFlow workspace</p>
          <h1 className="text-3xl font-semibold tracking-tight">Make every opportunity count.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Keep your pipeline, team activity, and revenue forecast together in one clear view.
          </p>
        </div>
        {configurationError ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{configurationError}</p> : null}
        <div className="space-y-3">
          <Button className="h-11 w-full" onClick={() => router.push("/login")}>Log in <ArrowRight /></Button>
          <Button className="h-11 w-full" variant="outline" onClick={() => router.push("/signup")}>Create an account</Button>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="size-3.5" /> Secure workspace access</p>
      </div>
    </AuthShell>
  );
}

export function LoginPage() {
  const router = useRouter();
  const { configurationError, isAuthenticated, isReady, signIn, workspaceId } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isReady && isAuthenticated) router.replace(workspaceId ? "/dashboard" : "/onboarding");
  }, [isAuthenticated, isReady, router, workspaceId]);

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
          {configurationError ? <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{configurationError} Add the Supabase environment variables in Vercel, then redeploy.</p> : null}
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2"><Label htmlFor="login-email">Work email</Label><Input id="login-email" name="email" type="email" placeholder="you@company.com" required /></div>
          <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="login-password">Password</Label><Link className="text-xs font-medium text-primary hover:underline" href="/forgot-password">Forgot password?</Link></div><Input id="login-password" name="password" type="password" placeholder="Enter your password" required /></div>
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
        <p className="text-center text-sm text-muted-foreground">Already have an account? <Link className="font-medium text-primary hover:underline" href="/login">Sign in</Link></p>
      </div>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const resetError = await sendPasswordReset(String(form.get("email")));
    if (resetError) {
      setError(resetError);
      setPending(false);
      return;
    }
    setSent(true);
    setPending(false);
  }

  return (
    <AuthShell>
      <div className="w-full max-w-md space-y-7">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">Account recovery</p>
          <h1 className="text-3xl font-semibold tracking-tight">Reset your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter the email address for your SalesFlow account and we’ll send you a secure reset link.</p>
        </div>
        {sent ? (
          <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
            If an account exists for that email, a password reset link is on its way. Check your inbox and spam folder.
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2"><Label htmlFor="reset-email">Work email</Label><Input id="reset-email" name="email" type="email" placeholder="you@company.com" autoComplete="email" required /></div>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <Button className="h-11 w-full" type="submit" disabled={pending}>{pending ? "Sending link..." : "Send reset link"} <ArrowRight /></Button>
          </form>
        )}
        <p className="text-center text-sm text-muted-foreground"><Link className="font-medium text-primary hover:underline" href="/login">Back to sign in</Link></p>
      </div>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmPassword"))) {
      setError("The passwords do not match.");
      return;
    }

    setPending(true);
    setError(null);
    const updateError = await updatePassword(password);
    if (updateError) {
      setError("This reset link may have expired or already been used. Request a new link and try again.");
      setPending(false);
      return;
    }
    setSaved(true);
    setPending(false);
  }

  return (
    <AuthShell>
      <div className="w-full max-w-md space-y-7">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">Secure account recovery</p>
          <h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">Use at least 8 characters for your new password.</p>
        </div>
        {saved ? (
          <div role="status" className="space-y-4">
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Your password has been updated.</p>
            <Button asChild className="h-11 w-full"><Link href="/login">Continue to sign in <ArrowRight /></Link></Button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
            <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></div>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <Button className="h-11 w-full" type="submit" disabled={pending}>{pending ? "Updating password..." : "Update password"} <ArrowRight /></Button>
          </form>
        )}
        {!saved ? <p className="text-center text-sm text-muted-foreground"><Link className="font-medium text-primary hover:underline" href="/login">Back to sign in</Link></p> : null}
      </div>
    </AuthShell>
  );
}

export function OnboardingPage() {
  const router = useRouter();
  const { createWorkspace, isAuthenticated, isReady, workspaceId } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(1);
  const [setup, setSetup] = useState({
    workspaceName: "",
    teamSize: "1-10",
    industry: "Technology",
    salesMotion: "Outbound sales",
    salesCycle: "1-3 months",
    primaryGoal: "Grow qualified pipeline",
  });

  useEffect(() => {
    if (isReady && !isAuthenticated) router.replace("/signup");
    if (isReady && workspaceId) router.replace("/dashboard");
  }, [isAuthenticated, isReady, router, workspaceId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) {
      setStep((current) => current + 1);
      return;
    }
    setPending(true);
    setError(null);
    const details: WorkspaceSetupDetails = {
      industry: setup.industry,
      salesMotion: setup.salesMotion,
      salesCycle: setup.salesCycle,
      primaryGoal: setup.primaryGoal,
    };
    const createError = await createWorkspace(setup.workspaceName, setup.teamSize, details);
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
        <div>
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Workspace setup</span><span>Step {step} of 3</span>
          </div>
          <div className="mb-6 grid grid-cols-3 gap-1.5" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((item) => <span key={item} className={`h-1 rounded-full ${item <= step ? "bg-primary" : "bg-muted"}`} />)}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {step === 1 ? "Set up your workspace" : step === 2 ? "Shape your pipeline" : "Review your setup"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === 1 ? "Give your team a home and tell us a little about your business." : step === 2 ? "We’ll tune the starting view around how your team sells." : "Your workspace is ready to be created. You can adjust these details later."}
          </p>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {step === 1 ? <>
            <div className="space-y-2"><Label htmlFor="workspace-name">Workspace name</Label><Input id="workspace-name" value={setup.workspaceName} onChange={(event) => setSetup({ ...setup, workspaceName: event.target.value })} placeholder="Acme Sales" maxLength={120} required /></div>
            <div className="space-y-2"><Label htmlFor="team-size">Team size</Label><select id="team-size" value={setup.teamSize} onChange={(event) => setSetup({ ...setup, teamSize: event.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-sm"><option value="1-10">1-10 people</option><option value="11-50">11-50 people</option><option value="51-200">51-200 people</option><option value="201+">201+ people</option></select></div>
            <div className="space-y-2"><Label htmlFor="industry">Industry</Label><select id="industry" value={setup.industry} onChange={(event) => setSetup({ ...setup, industry: event.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-sm">{["Technology", "Professional services", "Financial services", "Healthcare", "Manufacturing", "Retail and commerce", "Other"].map((item) => <option key={item}>{item}</option>)}</select></div>
          </> : null}
          {step === 2 ? <>
            <div className="space-y-2"><Label htmlFor="sales-motion">How does your team sell?</Label><select id="sales-motion" value={setup.salesMotion} onChange={(event) => setSetup({ ...setup, salesMotion: event.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-sm">{["Outbound sales", "Inbound-led sales", "Product-led sales", "Partner-led sales", "A mix of channels"].map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="sales-cycle">Typical sales cycle</Label><select id="sales-cycle" value={setup.salesCycle} onChange={(event) => setSetup({ ...setup, salesCycle: event.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-sm"><option>Under 1 month</option><option>1-3 months</option><option>3-6 months</option><option>Over 6 months</option></select></div>
            <div className="space-y-2"><Label htmlFor="primary-goal">Primary focus</Label><select id="primary-goal" value={setup.primaryGoal} onChange={(event) => setSetup({ ...setup, primaryGoal: event.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-sm"><option>Grow qualified pipeline</option><option>Improve forecast accuracy</option><option>Shorten sales cycles</option><option>Improve team visibility</option></select></div>
          </> : null}
          {step === 3 ? <dl className="divide-y divide-border rounded-lg border border-border px-4">{[
            ["Workspace", setup.workspaceName], ["Team", `${setup.teamSize} people`], ["Industry", setup.industry], ["Sales motion", setup.salesMotion], ["Sales cycle", setup.salesCycle], ["Primary focus", setup.primaryGoal],
          ].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>)}</dl> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-3">
            {step > 1 ? <Button className="h-11 flex-1" type="button" variant="outline" onClick={() => setStep((current) => current - 1)} disabled={pending}>Back</Button> : null}
            <Button className="h-11 flex-1" type="submit" disabled={pending || (step === 1 && !setup.workspaceName.trim())}>{pending ? "Creating workspace..." : step === 3 ? "Create workspace" : "Continue"} <ArrowRight /></Button>
          </div>
        </form>
        <p className="text-center text-sm text-muted-foreground">Already have an account? <Link className="font-medium text-primary hover:underline" href="/login">Sign in instead</Link></p>
      </div>
    </AuthShell>
  );
}
