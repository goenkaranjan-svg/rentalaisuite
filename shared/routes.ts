
import { z } from 'zod';
import { 
  insertPropertySchema, properties, 
  insertLeaseSchema, leases,
  insertMaintenanceRequestSchema, maintenanceRequests,
  insertPaymentSchema, payments,
  insertScreeningSchema, screenings
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
    }
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
    }
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
  screenings: {
    create: {
      method: 'POST' as const,
      path: '/api/screenings' as const,
      input: insertScreeningSchema,
      responses: {
        201: z.custom<typeof screenings.$inferSelect>(),
        400: errorSchemas.validation,
      },
    }
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
