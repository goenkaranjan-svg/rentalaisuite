import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { Property } from "@shared/schema";

export type ListingFieldMapping = {
  common?: {
    title?: string;
    availableDate?: string;
    leaseTermMonths?: number;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    amenities?: string[];
    petsAllowed?: boolean;
    furnished?: boolean;
    parkingIncluded?: boolean;
    laundry?: string;
  };
  zillow?: {
    propertyType?: string;
    applicationUrl?: string;
    virtualTourUrl?: string;
  };
  apartments?: {
    communityName?: string;
    unitNumber?: string;
    depositAmount?: number;
    utilitiesIncluded?: string[];
  };
};

export type ZillowExportResponse = {
  propertyId: number;
  platform: "zillow";
  payload: string;
  missingFields: string[];
};

export type ApartmentsExportResponse = {
  propertyId: number;
  platform: "apartments.com";
  payload: string;
  csv: string;
  missingFields: string[];
};

export type PublishZillowResponse = {
  platform: "zillow";
  propertyId: number;
  success: boolean;
  statusCode: number;
  target: string;
  responseBody: string;
  publishedAt: string;
};

export type PublishApartmentsResponse = {
  platform: "apartments.com";
  propertyId: number;
  success: boolean;
  statusCode: number;
  target: string;
  responseBody: string;
  publishedAt: string;
  format: "json" | "csv";
};

export type ListingMappingTemplateRecord = {
  id: number;
  managerId: string;
  name: string;
  mapping: ListingFieldMapping;
  createdAt: string | null;
};

export function useAvailableListingProperties(search?: string) {
  const queryParams = new URLSearchParams();
  if (search?.trim()) queryParams.append("search", search.trim());
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";

  return useQuery<Property[]>({
    queryKey: [api.listingExports.availableProperties.path, search],
    queryFn: async () => {
      const res = await fetch(`${api.listingExports.availableProperties.path}${queryString}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch available properties");
      }
      return res.json();
    },
  });
}

export function useGenerateZillowExport() {
  return useMutation({
    mutationFn: async ({
      propertyId,
      mapping,
    }: {
      propertyId: number;
      mapping?: ListingFieldMapping;
    }): Promise<ZillowExportResponse> => {
      const res = await fetch(api.listingExports.zillow.path, {
        method: api.listingExports.zillow.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ propertyId, mapping }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to generate Zillow export");
      }
      return res.json();
    },
  });
}

export function useGenerateApartmentsExport() {
  return useMutation({
    mutationFn: async ({
      propertyId,
      mapping,
    }: {
      propertyId: number;
      mapping?: ListingFieldMapping;
    }): Promise<ApartmentsExportResponse> => {
      const res = await fetch(api.listingExports.apartments.path, {
        method: api.listingExports.apartments.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ propertyId, mapping }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to generate Apartments.com export");
      }
      return res.json();
    },
  });
}

export function usePublishZillowListing() {
  return useMutation({
    mutationFn: async ({
      propertyId,
      mapping,
    }: {
      propertyId: number;
      mapping?: ListingFieldMapping;
    }): Promise<PublishZillowResponse> => {
      const res = await fetch(api.listingExports.publishZillow.path, {
        method: api.listingExports.publishZillow.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ propertyId, mapping }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to publish Zillow listing");
      }
      return res.json();
    },
  });
}

export function usePublishApartmentsListing() {
  return useMutation({
    mutationFn: async ({
      propertyId,
      format = "json",
      mapping,
    }: {
      propertyId: number;
      format?: "json" | "csv";
      mapping?: ListingFieldMapping;
    }): Promise<PublishApartmentsResponse> => {
      const res = await fetch(api.listingExports.publishApartments.path, {
        method: api.listingExports.publishApartments.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ propertyId, format, mapping }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to publish Apartments.com listing");
      }
      return res.json();
    },
  });
}

export function useListingMappingTemplates() {
  return useQuery<ListingMappingTemplateRecord[]>({
    queryKey: [api.listingExports.templatesList.path],
    queryFn: async () => {
      const res = await fetch(api.listingExports.templatesList.path, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to load mapping templates");
      }
      return res.json();
    },
  });
}

export function useCreateListingMappingTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; mapping: ListingFieldMapping }) => {
      const res = await fetch(api.listingExports.templatesCreate.path, {
        method: api.listingExports.templatesCreate.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to create template");
      }
      return (await res.json()) as ListingMappingTemplateRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.listingExports.templatesList.path] });
    },
  });
}

export function useDeleteListingMappingTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: number) => {
      const url = api.listingExports.templatesDelete.path.replace(":id", String(templateId));
      const res = await fetch(url, {
        method: api.listingExports.templatesDelete.method,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to delete template");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.listingExports.templatesList.path] });
    },
  });
}
