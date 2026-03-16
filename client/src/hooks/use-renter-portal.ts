import { useQuery } from "@tanstack/react-query";

export type RenterPortalContact = {
  managerName: string | null;
  managerEmail: string | null;
  managerPhone: string | null;
  emergencyPhone: string | null;
  emergencyInstructions: string | null;
};

export function useRenterPortalContact(enabled = true) {
  return useQuery<RenterPortalContact>({
    queryKey: ["/api/renter-portal/contact"],
    enabled,
    queryFn: async () => {
      const res = await fetch("/api/renter-portal/contact", { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to load renter contact information.");
      return body as RenterPortalContact;
    },
  });
}
