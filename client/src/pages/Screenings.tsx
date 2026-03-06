import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCreateScreening, useScreeningOverview } from "@/hooks/use-screenings";
import type { ZillowLead } from "@shared/schema";

type ScreeningFormState = {
  tenantId: string;
  status: "pending" | "approved" | "rejected";
  creditScore: string;
  backgroundCheck: "clear" | "flagged" | "unset";
  notes: string;
};

const initialForm: ScreeningFormState = {
  tenantId: "",
  status: "pending",
  creditScore: "",
  backgroundCheck: "unset",
  notes: "",
};

function formatDate(value?: string | Date | null): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return format(date, "MMM d, yyyy");
}

function getScreeningBadgeClass(status: string): string {
  switch (status) {
    case "approved":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "rejected":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-amber-100 text-amber-700 border-amber-200";
  }
}

function getLeadBadgeClass(status: string): string {
  switch (status) {
    case "contacted":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "screening_started":
      return "bg-violet-100 text-violet-700 border-violet-200";
    case "archived":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-orange-100 text-orange-700 border-orange-200";
  }
}

export default function Screenings() {
  const { data, isLoading } = useScreeningOverview();
  const { mutateAsync: createScreening, isPending: isCreating } = useCreateScreening();
  const [form, setForm] = useState<ScreeningFormState>(initialForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<ZillowLead | null>(null);

  const tenantNameById = useMemo(() => {
    const map = new Map<string, string>();
    (data?.tenants || []).forEach((tenant) => map.set(tenant.id, tenant.name));
    return map;
  }, [data?.tenants]);

  const propertyLabelByExternalId = useMemo(() => {
    const map = new Map<string, string>();
    (data?.properties || []).forEach((property) => {
      map.set(String(property.id), `${property.address}, ${property.city}, ${property.state}`);
    });
    return map;
  }, [data?.properties]);

  const startScreening = (lead?: ZillowLead) => {
    setSelectedLead(lead || null);
    const leadNote = lead
      ? `Lead ${lead.externalLeadId}: ${lead.applicantName || "Unknown applicant"} (${lead.applicantEmail || "no email"})${lead.message ? `\n\nMessage: ${lead.message}` : ""}`
      : "";
    setForm((current) => ({ ...current, notes: leadNote || current.notes }));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedLead(null);
    setForm(initialForm);
  };

  const handleSubmit = async () => {
    if (!form.tenantId) return;
    await createScreening({
      tenantId: form.tenantId,
      status: form.status,
      creditScore: form.creditScore ? Number(form.creditScore) : undefined,
      backgroundCheck: form.backgroundCheck === "unset" ? undefined : form.backgroundCheck,
      notes: form.notes.trim() || undefined,
    });
    closeDialog();
  };

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-display text-slate-900">Tenant Screening</h1>
        <p className="text-slate-500">Review inbound applicants and create screening records from leasing leads.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{data?.summary.totalLeads ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">New Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-700">{data?.summary.pendingLeads ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Pending Screenings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-700">{data?.summary.activeScreenings ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-700">{data?.summary.approvedScreenings ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg">Zillow Lead Inbox</CardTitle>
          <Button
            variant="outline"
            className="border-slate-200"
            onClick={() => startScreening()}
            disabled={!data?.tenants.length}
          >
            Create Screening
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-slate-500">Loading leads...</div>
          ) : !data?.leads.length ? (
            <div className="py-12 text-center text-slate-500">No leads available yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Move-In</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900">{lead.applicantName || "Unknown applicant"}</div>
                      <div className="text-xs text-slate-500">{lead.applicantEmail || "No email provided"}</div>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {propertyLabelByExternalId.get(lead.propertyExternalId || "") || lead.propertyExternalId || "Unmapped listing"}
                    </TableCell>
                    <TableCell className="text-slate-600">{lead.moveInDate || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getLeadBadgeClass(lead.status)}>
                        {lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{formatDate(lead.receivedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="border-slate-200" onClick={() => startScreening(lead)}>
                        Start Screening
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Screening Records</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-slate-500">Loading screenings...</div>
          ) : !data?.screenings.length ? (
            <div className="py-12 text-center text-slate-500">No screenings created yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Background</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.screenings.map((screening) => (
                  <TableRow key={screening.id}>
                    <TableCell className="font-medium text-slate-900">
                      {tenantNameById.get(screening.tenantId) || screening.tenantId}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getScreeningBadgeClass(screening.status)}>
                        {screening.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{screening.creditScore ?? "N/A"}</TableCell>
                    <TableCell className="text-slate-600">{screening.backgroundCheck || "N/A"}</TableCell>
                    <TableCell className="text-slate-600">{formatDate(screening.createdAt)}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-slate-600">{screening.notes || "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => (!open ? closeDialog() : setDialogOpen(true))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Screening</DialogTitle>
            <DialogDescription>
              {selectedLead
                ? `Create a screening record for lead ${selectedLead.externalLeadId}.`
                : "Create a screening record for a tenant."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tenant">Tenant</Label>
              <Select value={form.tenantId} onValueChange={(value) => setForm((current) => ({ ...current, tenantId: value }))}>
                <SelectTrigger id="tenant">
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.tenants || []).map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value: "pending" | "approved" | "rejected") =>
                    setForm((current) => ({ ...current, status: value }))
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">pending</SelectItem>
                    <SelectItem value="approved">approved</SelectItem>
                    <SelectItem value="rejected">rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="credit-score">Credit Score</Label>
                <Input
                  id="credit-score"
                  type="number"
                  min={300}
                  max={850}
                  value={form.creditScore}
                  onChange={(event) => setForm((current) => ({ ...current, creditScore: event.target.value }))}
                  placeholder="e.g. 710"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="background-check">Background Check</Label>
              <Select
                value={form.backgroundCheck}
                onValueChange={(value: "clear" | "flagged" | "unset") =>
                  setForm((current) => ({ ...current, backgroundCheck: value }))
                }
              >
                <SelectTrigger id="background-check">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">not set</SelectItem>
                  <SelectItem value="clear">clear</SelectItem>
                  <SelectItem value="flagged">flagged</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={5}
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Add screening details, concerns, or follow-up notes."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isCreating || !form.tenantId}>
              {isCreating ? "Saving..." : "Save Screening"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
