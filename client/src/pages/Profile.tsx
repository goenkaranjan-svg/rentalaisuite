import { useEffect, useState } from "react";
import { ShieldCheck, UserCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useUpdateUserProfile, useUserProfile } from "@/hooks/use-profile";
import { useRenterPortalContact } from "@/hooks/use-renter-portal";
import { useAuth } from "@/hooks/use-auth";

export default function Profile() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profile, isLoading } = useUserProfile();
  const { data: renterContact } = useRenterPortalContact(user?.role === "tenant");
  const updateProfile = useUpdateUserProfile();

  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<"email" | "phone" | "">("");

  useEffect(() => {
    if (!profile) return;
    setEmail(profile.email ?? "");
    setPhoneNumber(profile.phoneNumber ?? "");
    setCity(profile.city ?? "");
    setState(profile.state ?? "");
    setZipCode(profile.zipCode ?? "");
    setTwoFactorEnabled(Boolean(profile.mfaEnabled));
    setTwoFactorMethod(profile.twoFactorMethod ?? "");
  }, [profile]);

  const saveProfile = async () => {
    try {
      if (twoFactorEnabled && !twoFactorMethod) {
        toast({
          title: "2FA method required",
          description: "Choose email or phone before enabling 2FA.",
          variant: "destructive",
        });
        return;
      }
      if (twoFactorEnabled && twoFactorMethod === "phone" && !phoneNumber.trim()) {
        toast({
          title: "Phone required",
          description: "Add a phone number to use phone-based 2FA.",
          variant: "destructive",
        });
        return;
      }
      await updateProfile.mutateAsync({
        email,
        phoneNumber: phoneNumber.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zipCode: zipCode.trim() || null,
        twoFactorEnabled,
        twoFactorMethod:
          twoFactorEnabled && (twoFactorMethod === "email" || twoFactorMethod === "phone")
            ? twoFactorMethod
            : null,
      });
      toast({
        title: "Profile saved",
        description: "Your contact details have been updated.",
      });
    } catch (error) {
      toast({
        title: "Failed to save profile",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8 animate-in">
      <div>
        <h1 className="text-3xl font-bold font-display text-slate-900">Profile</h1>
        <p className="text-slate-500 mt-1">Manage your contact details, default location, and two-factor authentication.</p>
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
                <Label htmlFor="profile-user-id">User ID</Label>
                <Input
                  id="profile-user-id"
                  value={user?.id ?? ""}
                  readOnly
                  disabled
                />
              </div>
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
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="profile-city">City</Label>
                  <Input
                    id="profile-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Atlanta"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-state">State</Label>
                  <Input
                    id="profile-state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="GA"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-zip">Zip code</Label>
                  <Input
                    id="profile-zip"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="30303"
                  />
                </div>
              </div>
              <Button onClick={saveProfile} disabled={updateProfile.isPending}>
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
          <RadioGroup
            value={twoFactorEnabled ? "enabled" : "disabled"}
            onValueChange={(value) => setTwoFactorEnabled(value === "enabled")}
            className="gap-3"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id="2fa-disabled" value="disabled" />
              <Label htmlFor="2fa-disabled">Disabled</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="2fa-enabled" value="enabled" />
              <Label htmlFor="2fa-enabled">Enabled</Label>
            </div>
          </RadioGroup>

          {twoFactorEnabled ? (
            <div className="space-y-3 rounded-md border border-slate-200 p-4 bg-slate-50/70">
              <p className="text-sm text-slate-600">Choose your two-factor verification method.</p>
              <RadioGroup
                value={twoFactorMethod}
                onValueChange={(value) => setTwoFactorMethod(value as "email" | "phone")}
                className="gap-3"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="2fa-method-email" value="email" />
                  <Label htmlFor="2fa-method-email">Email</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="2fa-method-phone" value="phone" />
                  <Label htmlFor="2fa-method-phone">Phone</Label>
                </div>
              </RadioGroup>
              {twoFactorMethod === "phone" ? (
                <p className="text-xs text-slate-500">Phone 2FA uses the phone number in your contact information.</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {user?.role === "tenant" ? (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Contact & Emergency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Property Team</p>
              <p className="mt-2 font-medium text-slate-900">{renterContact?.managerName ?? "Property Manager"}</p>
              <p className="mt-1 text-slate-600">{renterContact?.managerEmail ?? "No email on file yet"}</p>
              <p className="text-slate-600">{renterContact?.managerPhone ?? "No direct phone on file yet"}</p>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-rose-600">Emergency</p>
              <p className="mt-2 font-medium text-rose-900">
                {renterContact?.emergencyPhone ?? "Use the portal and email for urgent issues"}
              </p>
              <p className="mt-2 text-rose-700">
                {renterContact?.emergencyInstructions ?? "For emergencies, contact your property team immediately after submitting a request."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
