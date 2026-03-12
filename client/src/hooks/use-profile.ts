import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export type UserProfile = {
  email: string | null;
  phoneNumber: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  mfaEnabled: boolean;
  twoFactorMethod: "email" | "phone" | null;
};

type UpdateUserProfileInput = {
  email: string;
  phoneNumber?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  twoFactorEnabled?: boolean;
  twoFactorMethod?: "email" | "phone" | null;
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
      toast({ title: "Profile updated", description: "Your profile and 2FA settings were saved." });
    },
  });
}
