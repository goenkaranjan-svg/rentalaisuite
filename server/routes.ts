
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./integrations/auth";
import { registerChatRoutes } from "./integrations/chat";
import { registerImageRoutes } from "./integrations/image";
import { seedDatabase } from "./seed";
import OpenAI from "openai";

// Initialize OpenAI for backend logic (Lease gen, Maintenance analysis)
// Use placeholder when no key is set so app can start; AI routes will check and return friendly error
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "sk-placeholder",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Seed Database (Non-blocking)
  seedDatabase().catch(console.error);

  // 1. Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // 2. Setup Integrations
  registerChatRoutes(app);
  registerImageRoutes(app);

  // 3. Application Routes
  
  // === Properties ===
  app.get(api.properties.list.path, async (req, res) => {
    const properties = await storage.getProperties();
    res.json(properties);
  });

  app.get(api.properties.get.path, async (req, res) => {
    const property = await storage.getProperty(Number(req.params.id));
    if (!property) return res.status(404).json({ message: "Property not found" });
    res.json(property);
  });

  app.post(api.properties.create.path, async (req, res) => {
    try {
      const input = api.properties.create.input.parse(req.body);
      const property = await storage.createProperty(input);
      res.status(201).json(property);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.properties.update.path, async (req, res) => {
     try {
      const input = api.properties.update.input.parse(req.body);
      const property = await storage.updateProperty(Number(req.params.id), input);
      if (!property) return res.status(404).json({ message: "Property not found" });
      res.json(property);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.properties.delete.path, async (req, res) => {
    await storage.deleteProperty(Number(req.params.id));
    res.status(204).send();
  });

  // === Leases ===
  app.get(api.leases.list.path, async (req: any, res) => {
    const user = req.user as any;
    const userId = user.claims.sub;
    const dbUser = await storage.getUser(userId);

    console.log(`Lease API Request - User: ${userId}, Role: ${dbUser?.role}`);

    let leaseList;
    if (dbUser?.role === "manager") {
      leaseList = await storage.getLeases();
    } else {
      leaseList = await storage.getLeasesByTenant(userId);
    }
    
    console.log(`Lease API Response - Count: ${leaseList.length}`);
    res.json(leaseList);
  });

  app.post(api.leases.create.path, async (req, res) => {
    try {
      const input = api.leases.create.input.parse(req.body);
      const lease = await storage.createLease(input);
      res.status(201).json(lease);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  app.patch("/api/leases/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const lease = await storage.updateLease(id, req.body);
      res.json(lease);
    } catch (err) {
      res.status(400).json({ message: "Failed to update lease" });
    }
  });

  // AI Lease Generation
  app.post(api.leases.generateDoc.path, async (req, res) => {
    try {
      const leaseId = Number(req.params.id);
      const lease = await storage.getLease(leaseId);
      if (!lease) return res.status(404).json({ message: "Lease not found" });
      
      const property = await storage.getProperty(lease.propertyId);

      const prompt = `Generate a residential lease agreement for the property at ${property?.address}, ${property?.city}, ${property?.state}. 
      Rent: $${lease.rentAmount}. 
      Start Date: ${lease.startDate}. 
      End Date: ${lease.endDate}. 
      Tenant ID: ${lease.tenantId}.
      Include standard clauses for maintenance, security deposit, and utilities. Output as clear professional text.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
      });

      const draftText = response.choices[0]?.message?.content || "Failed to generate.";
      
      // Update lease with draft text
      await storage.updateLease(leaseId, { draftText });

      res.json({ documentText: draftText });
    } catch (error) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ message: "AI generation failed" });
    }
  });

  // === Maintenance ===
  app.get(api.maintenance.list.path, async (req, res) => {
    const requests = await storage.getMaintenanceRequests();
    res.json(requests);
  });

  app.post(api.maintenance.create.path, async (req, res) => {
    try {
      const input = api.maintenance.create.input.parse(req.body);
      const request = await storage.createMaintenanceRequest(input);
      res.status(201).json(request);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  app.patch(api.maintenance.update.path, async (req, res) => {
    try {
      const input = api.maintenance.update.input.parse(req.body);
      const request = await storage.updateMaintenanceRequest(Number(req.params.id), input);
       if (!request) return res.status(404).json({ message: "Request not found" });
      res.json(request);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  // AI Maintenance Analysis
  app.post(api.maintenance.analyze.path, async (req, res) => {
    try {
      const reqId = Number(req.params.id);
      const maintenanceRequest = await storage.getMaintenanceRequest(reqId);
      if (!maintenanceRequest) return res.status(404).json({ message: "Request not found" });

      const prompt = `Analyze this maintenance request: "${maintenanceRequest.title} - ${maintenanceRequest.description}".
      Categorize the priority (Low, Medium, High, Emergency) and suggest a trade (Plumbing, Electrical, HVAC, General).
      Format: "Priority: [Priority], Trade: [Trade]. Suggestion: [Brief suggestion]"`;

       const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
      });
      
      const analysis = response.choices[0]?.message?.content || "Analysis failed.";
      
      // Save analysis to DB
      await storage.updateMaintenanceRequest(reqId, { aiAnalysis: analysis });

      res.json({ analysis });
    } catch (error) {
       console.error("AI Analysis Error:", error);
      res.status(500).json({ message: "AI analysis failed" });
    }
  });

  // === Accounting / Payments ===
  app.get(api.payments.list.path, async (req: any, res) => {
    const user = req.user as any;
    const dbUser = await storage.getUser(user.claims.sub);
    
    let paymentList;
    if (dbUser?.role === "manager") {
      paymentList = await storage.getPayments();
    } else {
      // Find active leases for this tenant
      const tenantLeases = await storage.getLeasesByTenant(user.claims.sub);
      const leaseIds = tenantLeases.map(l => l.id);
      const allPayments = await storage.getPayments();
      paymentList = allPayments.filter(p => leaseIds.includes(p.leaseId));
    }
    res.json(paymentList);
  });

  app.get("/api/accounting/summary", async (req: any, res) => {
    const allPayments = await storage.getPayments();
    const totalCollected = allPayments
      .filter(p => p.status === "paid")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const pending = allPayments
      .filter(p => p.status === "pending")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    
    res.json({ totalCollected, pending });
  });

  app.post(api.payments.create.path, async (req, res) => {
     try {
      const input = api.payments.create.input.parse(req.body);
      const payment = await storage.createPayment(input);
      res.status(201).json(payment);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });
  
  // === Screenings ===
   app.post(api.screenings.create.path, async (req, res) => {
     try {
      const input = api.screenings.create.input.parse(req.body);
      const screening = await storage.createScreening(input);
      res.status(201).json(screening);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  return httpServer;
}
