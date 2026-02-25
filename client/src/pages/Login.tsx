import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Building2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type UserRole = "manager" | "tenant";
type AuthMode = "signin" | "signup" | "forgot";

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

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white">
        <div>
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold font-display">PropMan.ai</span>
          </div>
          <h1 className="text-5xl font-bold font-display leading-tight mb-6">Property Management, Simplified</h1>
          <p className="text-slate-300 max-w-md">
            Manager and renter portals with leasing, accounting, and maintenance workflows.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 bg-slate-50">
        <Card className="w-full max-w-md border-slate-200">
          <CardHeader className="space-y-4">
            <CardTitle className="text-2xl">Account Access</CardTitle>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={role === "manager" ? "default" : "outline"} onClick={() => setRole("manager")}>
                Property Manager
              </Button>
              <Button variant={role === "tenant" ? "default" : "outline"} onClick={() => setRole("tenant")}>
                Renter
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant={mode === "signin" ? "default" : "outline"} onClick={() => setMode("signin")}>
                Sign In
              </Button>
              <Button variant={mode === "signup" ? "default" : "outline"} onClick={() => setMode("signup")}>
                Sign Up
              </Button>
              <Button variant={mode === "forgot" ? "default" : "outline"} onClick={() => setMode("forgot")}>
                Forgot
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "signin" && (
              <>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleSignIn} disabled={isLoggingIn}>
                  {isLoggingIn ? "Signing in..." : `Sign In as ${role === "manager" ? "Manager" : "Renter"}`}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => socialLogin("google")}>
                    Continue with Google
                  </Button>
                  <Button variant="outline" onClick={() => socialLogin("facebook")}>
                    Continue with Facebook
                  </Button>
                </div>
              </>
            )}

            {mode === "signup" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Password (min 8 chars)</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleSignUp} disabled={isSigningUp}>
                  {isSigningUp ? "Creating account..." : `Create ${role === "manager" ? "Manager" : "Renter"} Account`}
                </Button>
              </>
            )}

            {mode === "forgot" && (
              <>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleForgot} disabled={isProcessingForgotPassword}>
                  {isProcessingForgotPassword ? "Submitting..." : "Send Reset Link"}
                </Button>

                {devResetToken && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Dev reset token: <code>{devResetToken}</code>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Reset Token</Label>
                  <Input value={resetToken} onChange={(e) => setResetToken(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <Button className="w-full" variant="outline" onClick={handleReset} disabled={isResettingPassword}>
                  {isResettingPassword ? "Updating..." : "Reset Password"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
