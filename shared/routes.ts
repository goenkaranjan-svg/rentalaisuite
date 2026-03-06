
import { z } from 'zod';
import { 
  insertPropertySchema, properties, 
  insertLeaseSchema, leases,
  insertMaintenanceRequestSchema, maintenanceRequests,
  insertPaymentSchema, payments,
  insertScreeningSchema, screenings,
  insertZillowLeadSchema, zillowLeads,
  strMarketListings, multifamilySaleListings,
  upsertManagerRentNotificationSettingsSchema,
  upsertManagerLeaseExpiryNotificationSettingsSchema,
  upsertManagerMaintenanceAutomationSettingsSchema
} from './schema';

// Shared error schemas
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

const listingFieldMappingSchema = z.object({
  common: z
    .object({
      title: z.string().optional(),
      availableDate: z.string().optional(),
      leaseTermMonths: z.number().int().positive().optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().optional(),
      contactPhone: z.string().optional(),
      amenities: z.array(z.string()).optional(),
      petsAllowed: z.boolean().optional(),
      furnished: z.boolean().optional(),
      parkingIncluded: z.boolean().optional(),
      laundry: z.string().optional(),
    })
    .optional(),
  zillow: z
    .object({
      propertyType: z.string().optional(),
      applicationUrl: z.string().optional(),
      virtualTourUrl: z.string().optional(),
    })
    .optional(),
  apartments: z
    .object({
      communityName: z.string().optional(),
      unitNumber: z.string().optional(),
      depositAmount: z.number().nonnegative().optional(),
      utilitiesIncluded: z.array(z.string()).optional(),
    })
    .optional(),
});

const zillowLeadDeliveryPayloadSchema = z.object({
  leadId: z.string().optional(),
  externalLeadId: z.string().optional(),
  listingId: z.union([z.string(), z.number()]).optional(),
  listingExternalId: z.string().optional(),
  propertyId: z.union([z.string(), z.number()]).optional(),
  propertyExternalId: z.string().optional(),
  managerId: z.string().optional(),
  managerEmail: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().optional(),
  moveInDate: z.string().optional(),
  applicant: z.record(z.unknown()).optional(),
  renter: z.record(z.unknown()).optional(),
}).passthrough();

export const api = {
  properties: {
    list: {
      method: 'GET' as const,
      path: '/api/properties' as const,
      input: z.object({
        status: z.enum(['available', 'rented', 'maintenance']).optional(),
        search: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof properties.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/properties/:id' as const,
      responses: {
        200: z.custom<typeof properties.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/properties' as const,
      input: insertPropertySchema,
      responses: {
        201: z.custom<typeof properties.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/properties/:id' as const,
      input: insertPropertySchema.partial(),
      responses: {
        200: z.custom<typeof properties.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/properties/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  listingExports: {
    availableProperties: {
      method: "GET" as const,
      path: "/api/listings/available" as const,
      input: z
        .object({
          search: z.string().optional(),
        })
        .optional(),
      responses: {
        200: z.array(z.custom<typeof properties.$inferSelect>()),
      },
    },
    zillow: {
      method: "POST" as const,
      path: "/api/listings/export/zillow" as const,
      input: z.object({
        propertyId: z.number(),
        mapping: listingFieldMappingSchema.optional(),
      }),
      responses: {
        200: z.object({
          propertyId: z.number(),
          platform: z.literal("zillow"),
          payload: z.string(),
          missingFields: z.array(z.string()),
        }),
      },
    },
    apartments: {
      method: "POST" as const,
      path: "/api/listings/export/apartments" as const,
      input: z.object({
        propertyId: z.number(),
        mapping: listingFieldMappingSchema.optional(),
      }),
      responses: {
        200: z.object({
          propertyId: z.number(),
          platform: z.literal("apartments.com"),
          payload: z.string(),
          csv: z.string(),
          missingFields: z.array(z.string()),
        }),
      },
    },
    publishZillow: {
      method: "POST" as const,
      path: "/api/listings/publish/zillow" as const,
      input: z.object({
        propertyId: z.number(),
        mapping: listingFieldMappingSchema.optional(),
      }),
      responses: {
        200: z.object({
          platform: z.literal("zillow"),
          propertyId: z.number(),
          success: z.boolean(),
          statusCode: z.number(),
          target: z.string(),
          responseBody: z.string(),
          publishedAt: z.string(),
        }),
      },
    },
    publishApartments: {
      method: "POST" as const,
      path: "/api/listings/publish/apartments" as const,
      input: z.object({
        propertyId: z.number(),
        format: z.enum(["json", "csv"]).optional(),
        mapping: listingFieldMappingSchema.optional(),
      }),
      responses: {
        200: z.object({
          platform: z.literal("apartments.com"),
          propertyId: z.number(),
          success: z.boolean(),
          statusCode: z.number(),
          target: z.string(),
          responseBody: z.string(),
          publishedAt: z.string(),
          format: z.enum(["json", "csv"]),
        }),
      },
    },
    templatesList: {
      method: "GET" as const,
      path: "/api/listings/templates" as const,
      responses: {
        200: z.array(
          z.object({
            id: z.number(),
            managerId: z.string(),
            name: z.string(),
            mapping: listingFieldMappingSchema,
            createdAt: z.string().nullable(),
          })
        ),
      },
    },
    templatesCreate: {
      method: "POST" as const,
      path: "/api/listings/templates" as const,
      input: z.object({
        name: z.string().min(1).max(120),
        mapping: listingFieldMappingSchema,
      }),
      responses: {
        201: z.object({
          id: z.number(),
          managerId: z.string(),
          name: z.string(),
          mapping: listingFieldMappingSchema,
          createdAt: z.string().nullable(),
        }),
      },
    },
    templatesDelete: {
      method: "DELETE" as const,
      path: "/api/listings/templates/:id" as const,
      responses: {
        204: z.void(),
      },
    },
  },
  strMarket: {
    get: {
      method: "GET" as const,
      path: "/api/str-market/listings/:id" as const,
      responses: {
        200: z.custom<typeof strMarketListings.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    list: {
      method: "GET" as const,
      path: "/api/str-market/listings" as const,
      input: z
        .object({
          search: z.string().optional(),
          city: z.string().optional(),
          region: z.string().optional(),
          roomType: z.string().optional(),
          minAnnualReturn: z.coerce.number().nonnegative().optional(),
          maxNightlyRate: z.coerce.number().positive().optional(),
          minOccupancyRate: z.coerce.number().min(0).max(100).optional(),
          limit: z.coerce.number().int().positive().max(5000).optional(),
        })
        .optional(),
      responses: {
        200: z.array(z.custom<typeof strMarketListings.$inferSelect>()),
      },
    },
    sync: {
      method: "POST" as const,
      path: "/api/str-market/sync" as const,
      responses: {
        200: z.object({
          scrapedCount: z.number(),
          storedCount: z.number(),
          source: z.string(),
          syncedAt: z.string(),
        }),
      },
    },
  },
  multifamilySale: {
    list: {
      method: "GET" as const,
      path: "/api/investor/multifamily/listings" as const,
      input: z
        .object({
          search: z.string().optional(),
          city: z.string().optional(),
          region: z.string().optional(),
          minPrice: z.coerce.number().nonnegative().optional(),
          maxPrice: z.coerce.number().positive().optional(),
          limit: z.coerce.number().int().positive().max(500).optional(),
        })
        .optional(),
      responses: {
        200: z.array(z.custom<typeof multifamilySaleListings.$inferSelect>()),
      },
    },
    sync: {
      method: "POST" as const,
      path: "/api/investor/multifamily/sync" as const,
      responses: {
        200: z.object({
          fetchedCount: z.number(),
          storedCount: z.number(),
          source: z.string(),
          syncedAt: z.string(),
        }),
      },
    },
  },
  leases: {
    list: {
      method: 'GET' as const,
      path: '/api/leases' as const,
      responses: {
        200: z.array(z.custom<typeof leases.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/leases' as const,
      input: insertLeaseSchema,
      responses: {
        201: z.custom<typeof leases.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    generateDoc: {
      method: 'POST' as const,
      path: '/api/leases/:id/generate' as const, // AI generation endpoint
      responses: {
        200: z.object({ documentText: z.string() }),
        404: errorSchemas.notFound,
      },
    },
    sendForSigning: {
      method: "POST" as const,
      path: "/api/leases/:id/signing/request" as const,
      responses: {
        200: z.object({
          leaseId: z.number(),
          status: z.string(),
          expiresAt: z.string(),
          sentTo: z.string(),
          signingLink: z.string().optional(),
        }),
      },
    },
    signingStatus: {
      method: "GET" as const,
      path: "/api/leases/:id/signing-status" as const,
      responses: {
        200: z.object({
          leaseId: z.number(),
          status: z.string(),
          createdAt: z.string().nullable(),
          expiresAt: z.string().nullable(),
          signedAt: z.string().nullable(),
          signedFullName: z.string().nullable(),
          tenantEmail: z.string().nullable(),
        }),
      },
    },
    signingValidate: {
      method: "GET" as const,
      path: "/api/leases/signing/validate" as const,
      input: z.object({ token: z.string().min(20) }),
      responses: {
        200: z.object({
          valid: z.boolean(),
          leaseId: z.number().optional(),
          status: z.string().optional(),
          expiresAt: z.string().optional(),
          propertyAddress: z.string().optional(),
          rentAmount: z.number().optional(),
          tenantEmail: z.string().optional(),
        }),
      },
    },
    signingComplete: {
      method: "POST" as const,
      path: "/api/leases/signing/complete" as const,
      input: z.object({
        token: z.string().min(20),
        fullName: z.string().min(2).max(120),
      }),
      responses: {
        200: z.object({
          message: z.string(),
          leaseId: z.number(),
          signedAt: z.string(),
          signedFullName: z.string(),
        }),
      },
    },
    expiryNotificationSettings: {
      method: "GET" as const,
      path: "/api/leases/expiry-notification-settings" as const,
      responses: {
        200: z.object({
          managerId: z.string(),
          enabled: z.boolean(),
          daysBeforeExpiry: z.number().int().min(1).max(365),
          updatedAt: z.string().nullable(),
        }),
      },
    },
    updateExpiryNotificationSettings: {
      method: "PUT" as const,
      path: "/api/leases/expiry-notification-settings" as const,
      input: upsertManagerLeaseExpiryNotificationSettingsSchema.pick({
        enabled: true,
        daysBeforeExpiry: true,
      }),
      responses: {
        200: z.object({
          managerId: z.string(),
          enabled: z.boolean(),
          daysBeforeExpiry: z.number().int().min(1).max(365),
          updatedAt: z.string().nullable(),
        }),
      },
    },
  },
  maintenance: {
    list: {
      method: 'GET' as const,
      path: '/api/maintenance' as const,
      input: z.object({
        status: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof maintenanceRequests.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/maintenance' as const,
      input: insertMaintenanceRequestSchema,
      responses: {
        201: z.custom<typeof maintenanceRequests.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    analyze: {
      method: 'POST' as const,
      path: '/api/maintenance/:id/analyze' as const, // AI analysis
      responses: {
        200: z.object({ analysis: z.string() }),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/maintenance/:id' as const,
      input: insertMaintenanceRequestSchema.partial(),
      responses: {
        200: z.custom<typeof maintenanceRequests.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    },
    automationSettings: {
      method: "GET" as const,
      path: "/api/maintenance/automation-settings" as const,
      responses: {
        200: z.object({
          managerId: z.string(),
          autoTriageEnabled: z.boolean(),
          autoEscalationEnabled: z.boolean(),
          autoVendorAssignmentEnabled: z.boolean(),
          updatedAt: z.string().nullable(),
        }),
      },
    },
    updateAutomationSettings: {
      method: "PUT" as const,
      path: "/api/maintenance/automation-settings" as const,
      input: upsertManagerMaintenanceAutomationSettingsSchema.pick({
        autoTriageEnabled: true,
        autoEscalationEnabled: true,
        autoVendorAssignmentEnabled: true,
      }),
      responses: {
        200: z.object({
          managerId: z.string(),
          autoTriageEnabled: z.boolean(),
          autoEscalationEnabled: z.boolean(),
          autoVendorAssignmentEnabled: z.boolean(),
          updatedAt: z.string().nullable(),
        }),
      },
    },
  },
  payments: {
    list: {
      method: 'GET' as const,
      path: '/api/payments' as const,
      responses: {
        200: z.array(z.custom<typeof payments.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/payments' as const,
      input: insertPaymentSchema,
      responses: {
        201: z.custom<typeof payments.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  accounting: {
    summary: {
      method: 'GET' as const,
      path: '/api/accounting/summary' as const,
      responses: {
        200: z.object({
          totalCollected: z.number(),
          pending: z.number(),
          overdue: z.number(),
          outstanding: z.number(),
          paymentCount: z.number(),
          chart: z.array(
            z.object({
              label: z.string(),
              collected: z.number(),
              outstanding: z.number(),
            })
          ),
        }),
      },
    },
    rentOverdueNotificationSettings: {
      method: "GET" as const,
      path: "/api/accounting/rent-overdue-notification-settings" as const,
      responses: {
        200: z.object({
          managerId: z.string(),
          enabled: z.boolean(),
          overdueDays: z.number().int().min(1).max(60),
          updatedAt: z.string().nullable(),
        }),
      },
    },
    updateRentOverdueNotificationSettings: {
      method: "PUT" as const,
      path: "/api/accounting/rent-overdue-notification-settings" as const,
      input: upsertManagerRentNotificationSettingsSchema.pick({
        enabled: true,
        overdueDays: true,
      }),
      responses: {
        200: z.object({
          managerId: z.string(),
          enabled: z.boolean(),
          overdueDays: z.number().int().min(1).max(60),
          updatedAt: z.string().nullable(),
        }),
      },
    },
  },
  screenings: {
    list: {
      method: 'GET' as const,
      path: '/api/screenings' as const,
      responses: {
        200: z.object({
          leads: z.array(z.custom<typeof zillowLeads.$inferSelect>()),
          screenings: z.array(z.custom<typeof screenings.$inferSelect>()),
          tenants: z.array(z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
          })),
          properties: z.array(z.object({
            id: z.number().int().positive(),
            address: z.string(),
            city: z.string(),
            state: z.string(),
          })),
          summary: z.object({
            totalLeads: z.number().int().nonnegative(),
            pendingLeads: z.number().int().nonnegative(),
            activeScreenings: z.number().int().nonnegative(),
            approvedScreenings: z.number().int().nonnegative(),
          }),
        }),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/screenings' as const,
      input: insertScreeningSchema,
      responses: {
        201: z.custom<typeof screenings.$inferSelect>(),
        400: errorSchemas.validation,
      },
    }
  },
  integrations: {
    zillow: {
      leadDelivery: {
        method: 'POST' as const,
        path: '/api/integrations/zillow/lead-delivery' as const,
        input: zillowLeadDeliveryPayloadSchema,
        responses: {
          202: z.object({
            success: z.literal(true),
            leadId: z.number().int().positive(),
            externalLeadId: z.string(),
          }),
          400: errorSchemas.validation,
          401: errorSchemas.validation,
        },
      },
      createLead: {
        method: 'POST' as const,
        path: '/api/integrations/zillow/leads' as const,
        input: insertZillowLeadSchema,
        responses: {
          201: z.custom<typeof zillowLeads.$inferSelect>(),
          400: errorSchemas.validation,
        },
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
