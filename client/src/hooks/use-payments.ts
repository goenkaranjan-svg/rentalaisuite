import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertPayment, type Payment } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type AccountingSummary = {
  totalCollected: number;
  pending: number;
  overdue: number;
  outstanding: number;
  paymentCount: number;
  chart: Array<{ label: string; collected: number; outstanding: number }>;
};

export function usePayments() {
  return useQuery<Payment[]>({
    queryKey: [api.payments.list.path],
    queryFn: async () => {
      const res = await fetch(api.payments.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return await res.json();
    },
  });
}

export function useAccountingSummary() {
  return useQuery<AccountingSummary>({
    queryKey: [api.accounting.summary.path],
    queryFn: async () => {
      const res = await fetch(api.accounting.summary.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch accounting summary");
      return await res.json();
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: InsertPayment) => {
      const res = await fetch(api.payments.create.path, {
        method: api.payments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });
      if (!res.ok) {
        let message = "Failed to record payment";
        try {
          const body = await res.json();
          if (body?.message) message = body.message;
        } catch {
          // Ignore parse error and use default.
        }
        throw new Error(message);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.payments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.accounting.summary.path] });
      toast({ title: "Payment Recorded", description: "Transaction saved successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
