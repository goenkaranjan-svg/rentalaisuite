import { useMutation, useQuery } from "@tanstack/react-query";

export type SmartAlert = {
  id: string;
  type: "overdue_rent" | "lease_expiry" | "maintenance_stalled" | "data_sync" | "vacancy_risk";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  propertyId?: number;
  leaseId?: number;
  createdAt: string;
};

export type PortfolioHealthItem = {
  propertyId: number;
  address: string;
  city: string;
  state: string;
  score: number;
  occupancyScore: number;
  onTimeRentScore: number;
  maintenanceScore: number;
  noiTrendScore: number;
  openMaintenanceCount: number;
};

export type LeaseRenewalPipelineItem = {
  leaseId: number;
  propertyId: number;
  tenantId: string;
  endDate: string;
  daysUntilEnd: number;
  stage: "outreach" | "negotiating" | "renewed" | "move-out";
  nextAction: string;
};

export type MonthlyOwnerReportResponse = {
  month: string;
  summary: {
    properties: number;
    activeLeases: number;
    occupancyRate: number;
    expectedMonthlyRent: number;
    collected: number;
    outstanding: number;
    openMaintenance: number;
  };
  csv: string;
};

export type RentGuidanceResponse = {
  propertyId: number;
  currentRent: number;
  recommendedRent: number;
  suggestedRange: { min: number; max: number };
  confidence: "high" | "medium" | "low";
  factors: {
    comparableCount: number;
    cityOccupancyRatePct: number;
    seasonalFactor: number;
  };
  rationale: string;
};

export function useSmartAlerts() {
  return useQuery<SmartAlert[]>({
    queryKey: ["/api/insights/alerts"],
    queryFn: async () => {
      const res = await fetch("/api/insights/alerts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch smart alerts");
      return await res.json();
    },
    refetchInterval: 60_000,
  });
}

export function usePortfolioHealth() {
  return useQuery<PortfolioHealthItem[]>({
    queryKey: ["/api/insights/portfolio-health"],
    queryFn: async () => {
      const res = await fetch("/api/insights/portfolio-health", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch portfolio health");
      return await res.json();
    },
  });
}

export function useLeaseRenewalPipeline() {
  return useQuery<LeaseRenewalPipelineItem[]>({
    queryKey: ["/api/leases/renewal-pipeline"],
    queryFn: async () => {
      const res = await fetch("/api/leases/renewal-pipeline", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch renewal pipeline");
      return await res.json();
    },
  });
}

export function useMonthlyOwnerReportExport() {
  return useMutation({
    mutationFn: async (month?: string) => {
      const suffix = month ? `?month=${encodeURIComponent(month)}` : "";
      const res = await fetch(`/api/reports/monthly-owner${suffix}`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to export monthly report");
      }
      return (await res.json()) as MonthlyOwnerReportResponse;
    },
  });
}

export function useRentGuidance(propertyId: number) {
  return useQuery<RentGuidanceResponse>({
    queryKey: ["/api/rent-guidance", propertyId],
    enabled: Number.isFinite(propertyId) && propertyId > 0,
    queryFn: async () => {
      const res = await fetch(`/api/rent-guidance/${propertyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch rent guidance");
      return await res.json();
    },
  });
}
