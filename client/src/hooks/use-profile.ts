import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export type UserProfile = {
  email: string | null;
  phoneNumber: string | null;
  mfaEnabled: boolean;
};

type UpdateUserProfileInput = {
  email: string;
  phoneNumber?: string | null;
};

type MfaSetupResponse = {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
};

export function useUserProfile() {
  return useQuery<UserProfile>({
    queryKey: ["/api/auth/profile"],
    queryFn: async () => {
      const res = await fetch("/api/auth/profile", { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to load user profile.");
      return body as UserProfile;
    },
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: UpdateUserProfileInput) => {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to update profile.");
      return body as UserProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Profile updated", description: "Your contact details were saved." });
    },
  });
}

export function useMfaSetup() {
  return useMutation({
    mutationFn: async ({ password }: { password: string }) => {
      const res = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to start 2FA setup.");
      return body as MfaSetupResponse;
    },
  });
}

export function useEnableMfa() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ secret, code }: { secret: string; code: string }) => {
      const res = await fetch("/api/auth/mfa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ secret, code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to enable 2FA.");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "2FA enabled", description: "Your account now requires an authenticator code." });
    },
  });
}

export function useDisableMfa() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to disable 2FA.");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "2FA disabled", description: "Two-factor authentication is turned off." });
    },
  });
}
