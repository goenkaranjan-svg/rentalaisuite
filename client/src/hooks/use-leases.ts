import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertLease, type Lease } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useLeases() {
  return useQuery<Lease[]>({
    queryKey: [api.leases.list.path],
    queryFn: async () => {
      const res = await fetch(api.leases.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leases");
      return await res.json();
    },
  });
}

export function useCreateLease() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertLease) => {
      const res = await fetch(api.leases.create.path, {
        method: api.leases.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create lease");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.leases.list.path] });
      toast({ title: "Lease Created", description: "New lease agreement active." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useGenerateLeaseDoc() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.leases.generateDoc.path, { id });
      const res = await fetch(url, {
        method: api.leases.generateDoc.method,
        credentials: "include",
      });
      if (!res.ok) {
        let message = "Failed to generate document";
        try {
          const errorBody = await res.json();
          if (errorBody?.message) message = errorBody.message;
        } catch {
          // Ignore parse error and use default message.
        }
        throw new Error(message);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.leases.list.path] });
      toast({ title: "Document Generated", description: "Lease agreement drafted by AI." });
    },
    onError: (error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    },
  });
}

export type LeaseSigningStatus = {
  leaseId: number;
  status: string;
  createdAt: string | null;
  expiresAt: string | null;
  signedAt: string | null;
  signedFullName: string | null;
  tenantEmail: string | null;
};

export function useSendLeaseForSigning() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.leases.sendForSigning.path, { id });
      const res = await fetch(url, {
        method: api.leases.sendForSigning.method,
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to send signing request.");
      return body as { sentTo: string; signingLink?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.leases.list.path] });
      toast({
        title: "Signing request sent",
        description: data.signingLink ? `Link: ${data.signingLink}` : `Sent to ${data.sentTo}`,
      });
    },
    onError: (error) => {
      toast({ title: "Send failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useLeaseSigningStatus(leaseId: number | null) {
  return useQuery<LeaseSigningStatus>({
    queryKey: [api.leases.signingStatus.path, leaseId],
    enabled: leaseId !== null,
    queryFn: async () => {
      const url = buildUrl(api.leases.signingStatus.path, { id: leaseId! });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch signing status");
      return await res.json();
    },
  });
}

export function useValidateSigningToken(token: string) {
  return useQuery<{
    valid: boolean;
    leaseId?: number;
    status?: string;
    expiresAt?: string;
    propertyAddress?: string;
    rentAmount?: number;
    tenantEmail?: string;
  }>({
    queryKey: [api.leases.signingValidate.path, token],
    enabled: Boolean(token),
    retry: false,
    queryFn: async () => {
      const query = new URLSearchParams({ token }).toString();
      const res = await fetch(`${api.leases.signingValidate.path}?${query}`, { credentials: "include" });
      if (!res.ok) throw new Error("Invalid signing link");
      return await res.json();
    },
  });
}

export function useCompleteLeaseSigning() {
  return useMutation({
    mutationFn: async (input: { token: string; fullName: string }) => {
      const res = await fetch(api.leases.signingComplete.path, {
        method: api.leases.signingComplete.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to sign lease");
      return body as { message: string; leaseId: number; signedAt: string; signedFullName: string };
    },
  });
}

export type LeaseExpiryNotificationSettings = {
  managerId: string;
  enabled: boolean;
  daysBeforeExpiry: number;
  updatedAt: string | null;
};

export function useLeaseExpiryNotificationSettings(enabled = true) {
  return useQuery<LeaseExpiryNotificationSettings>({
    queryKey: [api.leases.expiryNotificationSettings.path],
    enabled,
    queryFn: async () => {
      const res = await fetch(api.leases.expiryNotificationSettings.path, { credentials: "include" });
      if (res.status === 503 || res.status === 404 || res.status === 403) {
        return {
          managerId: "",
          enabled: true,
          daysBeforeExpiry: 30,
          updatedAt: null,
        };
      }
      if (!res.ok) throw new Error("Failed to fetch lease expiry notification settings");
      return await res.json();
    },
  });
}

export function useUpdateLeaseExpiryNotificationSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { enabled: boolean; daysBeforeExpiry: number }) => {
      const res = await fetch(api.leases.updateExpiryNotificationSettings.path, {
        method: api.leases.updateExpiryNotificationSettings.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to update settings");
      return body as LeaseExpiryNotificationSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.leases.expiryNotificationSettings.path] });
      toast({ title: "Settings saved", description: "Lease expiry reminder settings updated." });
    },
    onError: (error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });
}
