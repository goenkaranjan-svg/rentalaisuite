import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Building2, ShieldCheck, Users, TrendingUp, LogIn, UserPlus, KeyRound, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    title: "Welcome back",
    description: "Continue where you left off.",
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

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const {
    user,
    login,
    signup,
    forgotPassword,
    resetPassword,
    isLoggingIn,
    isSigningUp,
    isProcessingForgotPassword,
    isResettingPassword,
  } = useAuth();

  const [role, setRole] = useState<UserRole>("manager");
  const [mode, setMode] = useState<AuthMode>("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [devResetToken, setDevResetToken] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role === "tenant") setLocation("/renter");
    else if (user.role === "investor") setLocation("/investor");
    else setLocation("/");
  }, [user, setLocation]);

  const handleSignIn = async () => {
    try {
      await login({ email, password, role });
      toast({ title: "Signed in", description: "Welcome back." });
    } catch (error: any) {
      toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    }
  };

  const handleSignUp = async () => {
    try {
      await signup({ email, password, role, firstName, lastName });
      toast({ title: "Account created", description: "You are now signed in." });
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

  const socialLogin = (provider: "google" | "facebook") => {
    window.location.href = `/api/login/${provider}?role=${role}`;
  };

  const activeRole = roleConfig[role];
  const activeMode = modeConfig[mode];
  const ActiveModeIcon = activeMode.icon;
  const passwordRuleState = PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.check(password) }));
  const newPasswordRuleState = PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.check(newPassword) }));

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="hidden lg:flex flex-col justify-between p-10 xl:p-12 bg-gradient-to-br from-white via-slate-50 to-emerald-50 relative overflow-hidden border-r border-slate-200">
        <div className="pointer-events-none absolute -top-20 -right-16 h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-slate-200/40 blur-3xl" />
        <div className="relative text-slate-900">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-500/20">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold font-display">PropMan.ai</span>
          </div>
          <h1 className="text-5xl font-bold font-display leading-tight mb-6">Invest and manage with confidence.</h1>
          <p className="text-slate-600 max-w-md">
            Fast property operations for managers, renters, and investors in one secure workspace.
          </p>
        </div>
        <div className="relative grid gap-3 text-slate-800">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Built for focused decisions</p>
            <p className="mt-2 text-sm text-slate-600">Track leasing, maintenance, accounting, and investment opportunities with fewer clicks.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["manager", "tenant", "investor"] as UserRole[]).map((r) => {
              const Icon = roleConfig[r].icon;
              return (
                <div key={r} className="rounded-xl border border-slate-200 bg-white p-3 text-center transition-all duration-300 hover:-translate-y-0.5">
                  <Icon className="mx-auto h-4 w-4 text-emerald-700" />
                  <p className="mt-2 text-xs text-slate-700">{roleConfig[r].label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-white">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-md"
        >
        <Card className="w-full border-slate-200 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 lg:hidden">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-slate-900">PropMan.ai</span>
              </div>
              <Badge variant="secondary">Secure Access</Badge>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">Role</Label>
              <Select value={role} onValueChange={(value: UserRole) => setRole(value)}>
                <SelectTrigger className="bg-slate-50 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Property Manager</SelectItem>
                  <SelectItem value="tenant">Renter</SelectItem>
                  <SelectItem value="investor">Investor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${mode}-heading`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <CardTitle className="text-2xl flex items-center gap-2">
                  <ActiveModeIcon className="h-5 w-5 text-cyan-700" />
                  {activeMode.title}
                </CardTitle>
                <p className="mt-1 text-sm text-slate-600">{activeMode.description}</p>
              </motion.div>
            </AnimatePresence>
            <div className="rounded-xl border border-slate-200 p-2">
              <div className="grid grid-cols-2 gap-2">
                {(["signin", "signup"] as AuthMode[]).map((m) => (
                  <Button
                    key={m}
                    variant={mode === m ? "default" : "outline"}
                    className={`transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${mode === m ? "shadow-md shadow-cyan-900/10" : "bg-white hover:bg-slate-50"}`}
                    onClick={() => setMode(m)}
                  >
                    {modeConfig[m].label}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500">{activeRole.label}: {activeRole.subtitle}</p>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
            {mode === "signin" && (
              <>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button className="w-full h-11 transition-all duration-200 hover:brightness-110" onClick={handleSignIn} disabled={isLoggingIn}>
                  {isLoggingIn
                    ? "Signing in..."
                    : `Sign In as ${
                        role === "manager" ? "Manager" : role === "investor" ? "Investor" : "Renter"
                      }`}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="bg-white h-10 transition-all duration-200 hover:-translate-y-0.5" onClick={() => socialLogin("google")}>
                    Continue with Google
                  </Button>
                  <Button variant="outline" className="bg-white h-10 transition-all duration-200 hover:-translate-y-0.5" onClick={() => socialLogin("facebook")}>
                    Continue with Facebook
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="w-full text-sm text-slate-600 hover:text-slate-900 underline underline-offset-2"
                >
                  Forgot password?
                </button>
              </>
            )}

            {mode === "signup" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
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
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="Create a secure password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-700 mb-2">Password complexity requirements</p>
                  <div className="space-y-1">
                    {passwordRuleState.map((rule) => (
                      <p key={rule.id} className={`text-xs ${rule.met ? "text-emerald-700" : "text-slate-500"}`}>
                        {rule.met ? "✓" : "•"} {rule.label}
                      </p>
                    ))}
                  </div>
                </div>
                <Button className="w-full h-11 transition-all duration-200 hover:brightness-110" onClick={handleSignUp} disabled={isSigningUp}>
                  {isSigningUp
                    ? "Creating account..."
                    : `Create ${
                        role === "manager" ? "Manager" : role === "investor" ? "Investor" : "Renter"
                      } Account`}
                </Button>
              </>
            )}

            {mode === "forgot" && (
              <>
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-2"
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
                  />
                </div>
                <Button className="w-full h-11 transition-all duration-200 hover:brightness-110" onClick={handleForgot} disabled={isProcessingForgotPassword}>
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
                  />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    placeholder="Enter a new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-700 mb-2">Password complexity requirements</p>
                  <div className="space-y-1">
                    {newPasswordRuleState.map((rule) => (
                      <p key={rule.id} className={`text-xs ${rule.met ? "text-emerald-700" : "text-slate-500"}`}>
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
          </CardContent>
        </Card>
        </motion.div>
      </div>
    </div>
  );
}
