import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  window.location.href = "/api/logout";
}

type UserRole = "manager" | "tenant" | "investor";

type LoginInput = {
  email: string;
  password: string;
  role: UserRole;
};

type PasskeyRequestOptionsResponse = {
  publicKey?: CredentialRequestOptions["publicKey"];
  message?: string;
};

type SignupInput = {
  email: string;
  password: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
};

export function useTenants() {
  return useQuery<User[]>({
    queryKey: ["/api/auth/tenants"],
    queryFn: async () => {
      const res = await fetch("/api/auth/tenants", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tenants");
      return await res.json();
    },
  });
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (input: LoginInput) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to login.");
      return body;
    },
    onSuccess: (data: any) => {
      if (data?.id) {
        queryClient.setQueryData(["/api/auth/user"], data);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (input: SignupInput) => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to sign up.");
      return body;
    },
    onSuccess: (data: any) => {
      if (data?.id) {
        queryClient.setQueryData(["/api/auth/user"], data);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to process request.");
      return body as { message: string; resetToken?: string };
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to reset password.");
      return body;
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch("/api/auth/verify-email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to resend verification email.");
      return body as { message: string };
    },
  });

  const passkeyLoginMutation = useMutation({
    mutationFn: async () => {
      if (!("credentials" in navigator) || !window.PublicKeyCredential) {
        throw new Error("Passkeys are not supported on this device/browser.");
      }

      const optionsRes = await fetch("/api/auth/passkeys/auth/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const optionsBody = (await optionsRes.json().catch(() => ({}))) as PasskeyRequestOptionsResponse;
      if (!optionsRes.ok) {
        throw new Error(optionsBody?.message || "Unable to start passkey login.");
      }
      if (!optionsBody.publicKey) {
        throw new Error(optionsBody?.message || "Passkey login is not enabled yet.");
      }

      const assertion = (await navigator.credentials.get({
        publicKey: optionsBody.publicKey,
      })) as PublicKeyCredential | null;

      if (!assertion) throw new Error("Passkey authentication was cancelled.");

      const verifyRes = await fetch("/api/auth/passkeys/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(assertion),
      });
      const verifyBody = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        throw new Error(verifyBody?.message || "Passkey verification failed.");
      }
      return verifyBody;
    },
    onSuccess: (data: any) => {
      if (data?.id) {
        queryClient.setQueryData(["/api/auth/user"], data);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    login: loginMutation.mutateAsync,
    signup: signupMutation.mutateAsync,
    forgotPassword: forgotPasswordMutation.mutateAsync,
    resetPassword: resetPasswordMutation.mutateAsync,
    resendVerificationEmail: resendVerificationMutation.mutateAsync,
    loginWithPasskey: passkeyLoginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isSigningUp: signupMutation.isPending,
    isProcessingForgotPassword: forgotPasswordMutation.isPending,
    isResettingPassword: resetPasswordMutation.isPending,
    isResendingVerificationEmail: resendVerificationMutation.isPending,
    isLoggingInWithPasskey: passkeyLoginMutation.isPending,
  };
}
