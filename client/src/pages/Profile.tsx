import { useEffect, useState } from "react";
import { ShieldCheck, UserCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useDisableMfa, useEnableMfa, useMfaSetup, useUpdateUserProfile, useUserProfile } from "@/hooks/use-profile";

export default function Profile() {
  const { toast } = useToast();
  const { data: profile, isLoading } = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const setupMfa = useMfaSetup();
  const enableMfa = useEnableMfa();
  const disableMfa = useDisableMfa();

  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingSecret, setPendingSecret] = useState<string | null>(null);
  const [pendingOtpAuthUrl, setPendingOtpAuthUrl] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;
    setEmail(profile.email ?? "");
    setPhoneNumber(profile.phoneNumber ?? "");
  }, [profile]);

  const saveContactDetails = async () => {
    try {
      await updateProfile.mutateAsync({
        email,
        phoneNumber: phoneNumber.trim() || null,
      });
    } catch (error) {
      toast({
        title: "Failed to save profile",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    }
  };

  const beginMfaSetup = async () => {
    try {
      const result = await setupMfa.mutateAsync({ password: setupPassword });
      setPendingSecret(result.secret);
      setPendingOtpAuthUrl(result.otpauthUrl);
      setBackupCodes(result.backupCodes);
      toast({ title: "2FA setup started", description: "Enter the one-time code from your authenticator app." });
    } catch (error) {
      toast({
        title: "Could not start 2FA",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    }
  };

  const finishMfaSetup = async () => {
    if (!pendingSecret) return;
    try {
      await enableMfa.mutateAsync({ secret: pendingSecret, code: verificationCode });
      setPendingSecret(null);
      setPendingOtpAuthUrl(null);
      setBackupCodes([]);
      setVerificationCode("");
      setSetupPassword("");
    } catch (error) {
      toast({
        title: "Could not enable 2FA",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    }
  };

  const turnOffMfa = async () => {
    try {
      await disableMfa.mutateAsync();
    } catch (error) {
      toast({
        title: "Could not disable 2FA",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8 animate-in">
      <div>
        <h1 className="text-3xl font-bold font-display text-slate-900">Profile</h1>
        <p className="text-slate-500 mt-1">Manage your email, phone number, and two-factor authentication.</p>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center gap-3">
          <UserCircle2 className="h-5 w-5 text-slate-600" />
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-sm text-slate-500">Loading profile...</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email address</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-phone">Phone number</Label>
                <Input
                  id="profile-phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <Button onClick={saveContactDetails} disabled={updateProfile.isPending}>
                {updateProfile.isPending ? "Saving..." : "Save changes"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-slate-600" />
          <CardTitle>Two-Factor Authentication (2FA)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile?.mfaEnabled ? (
            <div className="space-y-3">
              <p className="text-sm text-emerald-700">2FA is currently enabled on your account.</p>
              <Button variant="outline" onClick={turnOffMfa} disabled={disableMfa.isPending}>
                {disableMfa.isPending ? "Disabling..." : "Disable 2FA"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Set up an authenticator app and verify a one-time code.</p>
              {!pendingSecret ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="mfa-password">Current password</Label>
                    <Input
                      id="mfa-password"
                      type="password"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                    />
                  </div>
                  <Button onClick={beginMfaSetup} disabled={setupMfa.isPending || !setupPassword}>
                    {setupMfa.isPending ? "Starting setup..." : "Start 2FA setup"}
                  </Button>
                </>
              ) : (
                <div className="space-y-3 rounded-md border border-slate-200 p-4 bg-slate-50/70">
                  <p className="text-sm text-slate-700">
                    Enter this secret in your authenticator app: <span className="font-mono">{pendingSecret}</span>
                  </p>
                  {pendingOtpAuthUrl ? (
                    <p className="text-xs text-slate-500 break-all">otpauth url: {pendingOtpAuthUrl}</p>
                  ) : null}
                  {backupCodes.length > 0 ? (
                    <p className="text-xs text-slate-500">Backup codes: {backupCodes.join(", ")}</p>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="mfa-code">Authenticator code</Label>
                    <Input
                      id="mfa-code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="123456"
                    />
                  </div>
                  <Button onClick={finishMfaSetup} disabled={enableMfa.isPending || verificationCode.length < 6}>
                    {enableMfa.isPending ? "Enabling..." : "Enable 2FA"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
