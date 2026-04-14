import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Building2, ShieldCheck, Users, TrendingUp, LogIn, UserPlus, KeyRound, Menu, Eye, EyeOff, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type UserRole = "manager" | "tenant" | "investor";
type AuthMode = "signin" | "signup" | "forgot";
const PASSWORD_RULES = [
  { id: "length", label: "At least 12 characters", check: (value: string) => value.length >= 12 },
  { id: "upper", label: "One uppercase letter", check: (value: string) => /[A-Z]/.test(value) },
  { id: "lower", label: "One lowercase letter", check: (value: string) => /[a-z]/.test(value) },
  { id: "number", label: "One number", check: (value: string) => /[0-9]/.test(value) },
  { id: "symbol", label: "One symbol", check: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

const roleConfig: Record<UserRole, { label: string; subtitle: string; icon: LucideIcon }> = {
  manager: { label: "Property Manager", subtitle: "Manage units, leases, and ops", icon: ShieldCheck },
  tenant: { label: "Renter", subtitle: "Track rent, requests, and messages", icon: Users },
  investor: { label: "Investor", subtitle: "Analyze STR opportunities", icon: TrendingUp },
};

const modeConfig: Record<AuthMode, { label: string; title: string; description: string; icon: LucideIcon }> = {
  signin: {
    label: "Sign In",
    title: "Sign in",
    description: "",
    icon: LogIn,
  },
  signup: {
    label: "Sign Up",
    title: "Create your account",
    description: "Set up access in under a minute.",
    icon: UserPlus,
  },
  forgot: {
    label: "Password Reset",
    title: "Reset your password",
    description: "Request a reset token and set a new password.",
    icon: KeyRound,
  },
};

const TEMP_PASSWORD_REVEAL_MS = 5000;
const HERO_WORDS = ["Manage", "Rent", "Invest"] as const;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const {
    user,
    login,
    signup,
    forgotPassword,
    resetPassword,
    resendVerificationEmail,
    loginWithPasskey,
    isLoggingIn,
    isSigningUp,
    isProcessingForgotPassword,
    isResettingPassword,
    isResendingVerificationEmail,
    isLoggingInWithPasskey,
  } = useAuth();

  const [role, setRole] = useState<UserRole>("manager");
  const [mode, setMode] = useState<AuthMode>("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [organizationName, setOrganizationName] = useState("");

  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [devResetToken, setDevResetToken] = useState<string | null>(null);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [heroWordIndex, setHeroWordIndex] = useState(0);
  const [showPasswordTemporarily, setShowPasswordTemporarily] = useState(false);
  const [showNewPasswordTemporarily, setShowNewPasswordTemporarily] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role === "tenant") setLocation("/renter");
    else if (user.role === "investor") setLocation("/investor");
    else setLocation("/");
  }, [user, setLocation]);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroWordIndex((prev) => (prev + 1) % HERO_WORDS.length);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showPasswordTemporarily) return;
    const timer = setTimeout(() => setShowPasswordTemporarily(false), TEMP_PASSWORD_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [showPasswordTemporarily]);

  useEffect(() => {
    if (!showNewPasswordTemporarily) return;
    const timer = setTimeout(() => setShowNewPasswordTemporarily(false), TEMP_PASSWORD_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [showNewPasswordTemporarily]);

  const redirectByRole = (nextRole: UserRole | string | undefined) => {
    if (nextRole === "tenant") {
      setLocation("/renter");
      return;
    }
    if (nextRole === "investor") {
      setLocation("/investor");
      return;
    }
    setLocation("/");
  };

  const handleSignIn = async () => {
    try {
      const signedInUser = await login({ email, password, role });
      if ((signedInUser as any)?.mfaRequired) {
        toast({ title: "MFA required", description: "Complete multi-factor verification to finish signing in." });
        return;
      }
      if (!(signedInUser as any)?.id) {
        toast({ title: "Sign in pending", description: "Additional verification is required before sign-in can complete." });
        return;
      }
      setShowResendVerification(false);
      toast({ title: "Signed in", description: "Welcome back." });
      redirectByRole((signedInUser as any)?.role ?? role);
    } catch (error: any) {
      const message = String(error?.message || "");
      setShowResendVerification(message.toLowerCase().includes("verify your email"));
      toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    }
  };

  const handleResendVerification = async () => {
    try {
      await resendVerificationEmail(email);
      toast({ title: "Verification email sent", description: "Check your inbox for the verification link." });
    } catch (error: any) {
      toast({ title: "Unable to resend", description: error.message, variant: "destructive" });
    }
  };

  const handleSignUp = async () => {
    try {
      await signup({ email, password, role, firstName, lastName, organizationName });
      toast({
        title: "Account created",
        description: "Check your email for the verification link before signing in.",
      });
      setMode("signin");
      setShowResendVerification(false);
    } catch (error: any) {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    }
  };

  const handleForgot = async () => {
    try {
      const result = await forgotPassword(forgotEmail);
      setDevResetToken(result.resetToken ?? null);
      toast({ title: "Reset requested", description: result.message });
    } catch (error: any) {
      toast({ title: "Request failed", description: error.message, variant: "destructive" });
    }
  };

  const handleReset = async () => {
    try {
      await resetPassword({ token: resetToken, password: newPassword });
      toast({ title: "Password updated", description: "You can now sign in." });
      setMode("signin");
    } catch (error: any) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    }
  };

  const handlePasskeyLogin = async () => {
    try {
      const passkeyUser = await loginWithPasskey();
      if (!(passkeyUser as any)?.id) {
        toast({ title: "Passkey sign-in pending", description: "Additional verification is required before sign-in can complete." });
        return;
      }
      toast({ title: "Signed in", description: "Authenticated with passkey." });
      redirectByRole((passkeyUser as any)?.role);
    } catch (error: any) {
      toast({ title: "Passkey sign-in unavailable", description: error.message, variant: "destructive" });
    }
  };

  const activeRole = roleConfig[role];
  const activeMode = modeConfig[mode];
  const ActiveModeIcon = activeMode.icon;
  const passwordRuleState = PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.check(password) }));
  const newPasswordRuleState = PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.check(newPassword) }));

  return (
    <div className="relative min-h-screen bg-slate-950">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/home-city.jpg')" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/45 via-slate-950/70 to-slate-950/85" />
      <div className="relative min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden border-r border-white/10 bg-slate-950/20 backdrop-blur-[1px]">
        <div className="relative text-slate-100">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-500/20">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold font-display">Amrika Housing</span>
          </div>
          <h1 className="text-[44px] font-bold font-display leading-[1.05] mb-5 tracking-tight">
            <span className="text-slate-200/90">A Smarter Way to </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={heroWordIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className={`inline-block bg-clip-text text-transparent ${
                  heroWordIndex === 0
                    ? "bg-gradient-to-r from-emerald-300 to-emerald-400"
                    : heroWordIndex === 1
                    ? "bg-gradient-to-r from-sky-300 to-sky-400"
                    : "bg-gradient-to-r from-amber-300 to-orange-400"
                }`}
              >
                {HERO_WORDS[heroWordIndex]}
              </motion.span>
            </AnimatePresence>
          </h1>
          <p className="text-[15px] leading-6 text-slate-200 max-w-md">
            Fast property operations for managers, renters, and investors in one secure workspace.
          </p>
        </div>
        <div className="relative grid gap-3 text-slate-100">
          <div className="rounded-xl border border-white/20 bg-slate-900/40 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-emerald-300">Built for focused decisions</p>
            <p className="mt-2 text-sm text-slate-200">Track leasing, maintenance, accounting, and investment opportunities with fewer clicks.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-slate-950/35">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-[520px]"
        >
        <div className="rounded-3xl bg-gradient-to-br from-emerald-400/70 via-emerald-500/10 to-sky-500/60 p-[1.2px] shadow-[0_18px_60px_rgba(15,23,42,0.95)]">
        <Card className="login-auth-card w-full rounded-[1.6rem] border border-white/10 bg-slate-950/85 shadow-[0_18px_60px_rgba(15,23,42,0.95)] backdrop-blur-xl">
          <CardHeader className="space-y-3 px-6 pt-6 pb-5 sm:space-y-4 sm:px-9 sm:pt-8 sm:pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 lg:hidden">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-slate-100">Amrika Housing</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Select role"
                    className="ml-auto h-9 w-9 shrink-0 bg-slate-900/80 border-slate-600 text-slate-100"
                  >
                    <Menu className="h-4 w-4 text-slate-300" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setRole("manager")}>Property Manager</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRole("tenant")}>Renter</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRole("investor")}>Investor</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${mode}-heading`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <CardTitle className="text-[24px] sm:text-[30px] tracking-tight flex items-center gap-2 leading-tight text-slate-100">
                  <ActiveModeIcon className="h-6 w-6 text-emerald-400" />
                  {activeMode.title}
                </CardTitle>
                {activeMode.description ? (
                  <p className="mt-1 text-[15px] text-slate-300">{activeMode.description}</p>
                ) : null}
              </motion.div>
            </AnimatePresence>
            <p className="text-sm text-slate-300">
              Signing in as <span className="font-medium text-slate-100">{activeRole.label}</span>
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6 sm:px-9 sm:pb-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
            {mode === "signin" && (
              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSignIn();
                }}
              >
                <div className="space-y-2">
                  <Label className="text-sm">Email</Label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 text-base bg-slate-900/80 border-slate-600 text-slate-100 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Password</Label>
                  <div className="relative">
                    <Input
                      type={showPasswordTemporarily ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 pr-12 text-base bg-slate-900/80 border-slate-600 text-slate-100 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordTemporarily((current) => !current)}
                      className="absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-slate-500 bg-slate-800/95 text-slate-100 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                      aria-label={showPasswordTemporarily ? "Hide password" : "Show password for 5 seconds"}
                    >
                      {showPasswordTemporarily ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all duration-200 px-4" disabled={isLoggingIn}>
                  {isLoggingIn ? "Signing in..." : "Sign in"}
                </Button>
                {showResendVerification && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-10 border-slate-200"
                    onClick={handleResendVerification}
                    disabled={!email || isResendingVerificationEmail}
                  >
                    {isResendingVerificationEmail ? "Sending verification..." : "Resend verification email"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="passkey-button w-full h-12 text-base border-2 border-slate-300 bg-white font-medium text-slate-900"
                  onClick={handlePasskeyLogin}
                  disabled={isLoggingInWithPasskey}
                >
                  {isLoggingInWithPasskey ? "Checking passkey..." : "Sign in with Passkey"}
                </Button>
                <div className="grid grid-cols-2 gap-2 -mt-1">
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-sm text-slate-300 hover:text-slate-100 underline underline-offset-2 text-left"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="text-sm text-slate-300 hover:text-slate-100 underline underline-offset-2 text-right"
                  >
                    Create an account
                  </button>
                </div>
              </form>
            )}

            {mode === "signup" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="h-11 bg-slate-900/80 border-slate-600 text-slate-100 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="h-11 bg-slate-900/80 border-slate-600 text-slate-100 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 bg-slate-900/80 border-slate-600 text-slate-100 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                  />
                </div>
                {role === "manager" && (
                  <div className="space-y-2">
                    <Label>Organization Name</Label>
                    <Input
                      placeholder="Avon Management"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      className="h-11 bg-slate-900/80 border-slate-600 text-slate-100 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showPasswordTemporarily ? "text" : "password"}
                      placeholder="Create a secure password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pr-12 bg-slate-900/80 border-slate-600 text-slate-100 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordTemporarily((current) => !current)}
                      className="absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-slate-500 bg-slate-800/95 text-slate-100 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                      aria-label={showPasswordTemporarily ? "Hide password" : "Show password for 5 seconds"}
                    >
                      {showPasswordTemporarily ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-600 bg-slate-800 p-3">
                  <p className="text-[11px] sm:text-xs font-semibold text-white mb-2">Password complexity requirements</p>
                  <div className="space-y-1">
                    {passwordRuleState.map((rule) => (
                      <p key={rule.id} className={`text-[11px] sm:text-xs ${rule.met ? "text-emerald-400" : "text-slate-300"}`}>
                        {rule.met ? "✓" : "•"} {rule.label}
                      </p>
                    ))}
                  </div>
                </div>
                <Button className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white transition-all duration-200 text-sm sm:text-base px-3 leading-tight" onClick={handleSignUp} disabled={isSigningUp}>
                  {isSigningUp
                    ? "Creating account..."
                    : `Create ${
                        role === "manager" ? "Manager" : role === "investor" ? "Investor" : "Renter"
                      } Account`}
                </Button>
                {role === "manager" && (
                  <p className="text-xs text-slate-400">
                    Your organization workspace will be created during signup.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="w-full text-sm text-slate-300 hover:text-slate-100 underline underline-offset-2"
                >
                  Already have an account? Sign in
                </button>
              </>
            )}

            {mode === "forgot" && (
              <>
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-sm text-slate-300 hover:text-slate-100 underline underline-offset-2"
                >
                  Back to sign in
                </button>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="h-11 bg-slate-900/80 border-slate-600 text-slate-100 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                  />
                </div>
                <Button className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white transition-all duration-200 text-sm sm:text-base px-3" onClick={handleForgot} disabled={isProcessingForgotPassword}>
                  {isProcessingForgotPassword ? "Submitting..." : "Send Reset Link"}
                </Button>

                {devResetToken && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Dev reset token: <code>{devResetToken}</code>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Reset Token</Label>
                  <Input
                    placeholder="Paste reset token"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="h-11 bg-slate-900/80 border-slate-600 text-slate-100 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <div className="relative">
                    <Input
                      type={showNewPasswordTemporarily ? "text" : "password"}
                      placeholder="Enter a new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-11 pr-12 bg-slate-900/80 border-slate-600 text-slate-100 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPasswordTemporarily((current) => !current)}
                      className="absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-slate-500 bg-slate-800/95 text-slate-100 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                      aria-label={showNewPasswordTemporarily ? "Hide new password" : "Show new password for 5 seconds"}
                    >
                      {showNewPasswordTemporarily ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] sm:text-xs font-medium text-slate-700 mb-2">Password complexity requirements</p>
                  <div className="space-y-1">
                    {newPasswordRuleState.map((rule) => (
                      <p key={rule.id} className={`text-[11px] sm:text-xs ${rule.met ? "text-emerald-700" : "text-slate-500"}`}>
                        {rule.met ? "✓" : "•"} {rule.label}
                      </p>
                    ))}
                  </div>
                </div>
                <Button className="w-full h-11 transition-all duration-200 hover:-translate-y-0.5" variant="outline" onClick={handleReset} disabled={isResettingPassword}>
                  {isResettingPassword ? "Updating..." : "Reset Password"}
                </Button>
              </>
            )}
              </motion.div>
            </AnimatePresence>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-300">
              This site is protected by reCAPTCHA and the Google{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-slate-100"
              >
                Privacy Policy
              </a>
              .{" "}
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-slate-100"
              >
                Terms of Service
              </a>{" "}
              apply.
            </p>
          </CardContent>
        </Card>
        </div>
        </motion.div>
      </div>
      </div>
    </div>
  );
}
