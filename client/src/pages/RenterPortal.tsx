import { useMemo, useState } from "react";
import { format } from "date-fns";

import { useAuth } from "@/hooks/use-auth";
import { useLeases } from "@/hooks/use-leases";
import { useMaintenanceRequests, useCreateMaintenanceRequest } from "@/hooks/use-maintenance";
import { usePayments, useCreatePayment } from "@/hooks/use-payments";
import { useProperties } from "@/hooks/use-properties";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function RenterPortal() {
  const { user } = useAuth();
  const { data: leases } = useLeases();
  const { data: properties } = useProperties();
  const { data: maintenance } = useMaintenanceRequests();
  const { data: payments } = usePayments();
  const { mutate: createMaintenance, isPending: isSubmittingRequest } = useCreateMaintenanceRequest();
  const { mutate: createPayment, isPending: isPaying } = useCreatePayment();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const activeLease = useMemo(
    () => (leases ?? []).find((l) => l.status === "active") ?? null,
    [leases],
  );
  const activeProperty = useMemo(
    () => (properties ?? []).find((property) => property.id === activeLease?.propertyId) ?? null,
    [activeLease?.propertyId, properties],
  );

  const myPayments = useMemo(
    () => (payments ?? []).sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()),
    [payments],
  );

  const monthlyRent = activeLease ? Number(activeLease.rentAmount) : 0;
  const paidThisMonth = myPayments
    .filter((p) => {
      const d = new Date(p.date ?? new Date());
      const now = new Date();
      return p.status === "paid" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Math.max(monthlyRent - paidThisMonth, 0);

  const submitMaintenance = () => {
    if (!activeLease || !user || !title || !description) return;
    createMaintenance(
      {
        propertyId: activeLease.propertyId,
        tenantId: user.id,
        title,
        description,
        priority: "medium",
        status: "open",
      },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
        },
      },
    );
  };

  const payRentNow = () => {
    if (!activeLease || balance <= 0) return;
    createPayment({
      leaseId: activeLease.id,
      amount: balance.toFixed(2),
      status: "paid",
      type: "rent",
    });
  };

  return (
    <div className="space-y-8 animate-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Renter Portal</h1>
          <p className="text-slate-500 mt-1">Payments, lease details, maintenance, and communication.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-sm text-slate-500">Monthly Rent</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">${monthlyRent.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-sm text-slate-500">Paid This Month</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">${paidThisMonth.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-sm text-slate-500">Current Balance</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-700">${balance.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>My Lease</CardTitle>
          <Button onClick={payRentNow} disabled={!activeLease || balance <= 0 || isPaying}>
            {isPaying ? "Processing..." : balance > 0 ? `Pay $${balance.toLocaleString()}` : "Paid"}
          </Button>
        </CardHeader>
        <CardContent>
          {!activeLease && <p className="text-slate-500">No active lease found.</p>}
          {activeLease && (
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div><span className="text-slate-500">Lease ID:</span> #{activeLease.id}</div>
              <div><span className="text-slate-500">Start:</span> {format(new Date(activeLease.startDate), "MMM d, yyyy")}</div>
              <div><span className="text-slate-500">End:</span> {format(new Date(activeLease.endDate), "MMM d, yyyy")}</div>
              <div><span className="text-slate-500">Monthly Rent:</span> ${monthlyRent.toLocaleString()}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
        </CardHeader>
        <CardContent>
          {!activeProperty && <p className="text-slate-500">Property details are not available yet.</p>}
          {activeProperty && (
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div className="md:col-span-2 xl:col-span-4">
                <span className="text-slate-500">Address:</span>{" "}
                <span className="font-medium text-slate-900">
                  {activeProperty.address}, {activeProperty.city}, {activeProperty.state} {activeProperty.zipCode}
                </span>
              </div>
              <div><span className="text-slate-500">Status:</span> <span className="capitalize">{activeProperty.status}</span></div>
              <div><span className="text-slate-500">Bedrooms:</span> {activeProperty.bedrooms}</div>
              <div><span className="text-slate-500">Bathrooms:</span> {activeProperty.bathrooms}</div>
              <div><span className="text-slate-500">Square Feet:</span> {activeProperty.sqft.toLocaleString()}</div>
              <div><span className="text-slate-500">Listed Rent:</span> ${Number(activeProperty.price).toLocaleString()}</div>
              {activeProperty.description ? (
                <div className="md:col-span-2 xl:col-span-4">
                  <span className="text-slate-500">Description:</span>{" "}
                  <span className="text-slate-700">{activeProperty.description}</span>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3 md:hidden">
              {myPayments.slice(0, 8).map((p) => (
                <div key={p.id} className="rounded-lg border border-slate-200 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-600">{p.date ? format(new Date(p.date), "MMM d, yyyy") : "-"}</p>
                      <p className="capitalize font-medium text-slate-900">{p.type}</p>
                    </div>
                    <p className="font-medium text-slate-900">${Number(p.amount).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{p.status}</Badge>
                </div>
              ))}
              {myPayments.length === 0 && <p className="text-center text-slate-500 py-8">No payments found.</p>}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myPayments.slice(0, 8).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.date ? format(new Date(p.date), "MMM d, yyyy") : "-"}</TableCell>
                      <TableCell className="capitalize">{p.type}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{p.status}</Badge></TableCell>
                      <TableCell className="text-right">${Number(p.amount).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {myPayments.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-8">No payments found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader><CardTitle>Submit Maintenance Request</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leaky faucet" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue" />
            </div>
            <Button onClick={submitMaintenance} disabled={!activeLease || isSubmittingRequest}>
              {isSubmittingRequest ? "Submitting..." : "Submit Request"}
            </Button>

            <div className="pt-4 space-y-2">
              <h3 className="font-medium text-slate-900">Recent Requests</h3>
              {(maintenance ?? []).slice(0, 4).map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm border rounded-md p-2">
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <p className="text-slate-500">{m.description}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{m.status}</Badge>
                </div>
              ))}
              {(maintenance ?? []).length === 0 && <p className="text-slate-500 text-sm">No maintenance requests yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
