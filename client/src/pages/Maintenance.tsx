import {
  useMaintenanceRequests,
  useUpdateMaintenanceRequest,
  useAnalyzeMaintenance,
  useMaintenanceAutomationSettings,
  useUpdateMaintenanceAutomationSettings,
  useCreateMaintenanceRequest,
} from "@/hooks/use-maintenance";
import { useLeases } from "@/hooks/use-leases";
import { useProperties } from "@/hooks/use-properties";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Clock3, Settings2, Wrench } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, formatDistanceToNowStrict } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useEffect, useMemo, useRef, useState } from "react";

function getPriorityColor(priority: string) {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-700 border-red-200";
    case "emergency":
      return "bg-red-500 text-white border-red-600 animate-pulse";
    case "medium":
      return "bg-orange-100 text-orange-700 border-orange-200";
    default:
      return "bg-blue-100 text-blue-700 border-blue-200";
  }
}

function getTenantStatusClass(status: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "in_progress":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "rejected":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

function formatTimelineDate(value?: string | Date | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

function buildTenantTimeline(request: {
  createdAt?: string | Date | null;
  status: string;
  assignedVendor?: string | null;
  slaDueAt?: string | Date | null;
  assignmentNote?: string | null;
}) {
  const events = [
    {
      label: "Submitted",
      detail: formatTimelineDate(request.createdAt),
    },
  ];

  if (request.assignedVendor) {
    events.push({
      label: "Assigned vendor",
      detail: request.assignedVendor,
    });
  }

  if (request.slaDueAt) {
    events.push({
      label: "Target response",
      detail: formatTimelineDate(request.slaDueAt),
    });
  }

  events.push({
    label: "Current status",
    detail: request.status.replaceAll("_", " "),
  });

  if (request.assignmentNote) {
    events.push({
      label: "Team note",
      detail: request.assignmentNote,
    });
  }

  return events;
}

export default function Maintenance() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const isTenant = user?.role === "tenant";
  const { data: requests, isLoading } = useMaintenanceRequests();
  const { data: leases } = useLeases();
  const { data: properties } = useProperties();
  const { data: automationSettings } = useMaintenanceAutomationSettings(isManager);
  const { mutate: updateAutomationSettings, isPending: isSavingAutomationSettings } = useUpdateMaintenanceAutomationSettings();
  const { mutate: updateStatus } = useUpdateMaintenanceRequest();
  const { mutate: analyze, isPending: isAnalyzing } = useAnalyzeMaintenance();
  const { mutate: createMaintenance, isPending: isSubmittingRequest } = useCreateMaintenanceRequest();
  const [autoTriageEnabled, setAutoTriageEnabled] = useState(true);
  const [autoEscalationEnabled, setAutoEscalationEnabled] = useState(true);
  const [autoVendorAssignmentEnabled, setAutoVendorAssignmentEnabled] = useState(true);
  const [automationSettingsReady, setAutomationSettingsReady] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const lastSavedAutomationSettingsRef = useRef<string | null>(null);

  const activeLease = useMemo(
    () => (leases ?? []).find((lease) => lease.status === "active") ?? null,
    [leases],
  );

  const propertyById = useMemo(() => {
    const map = new Map<number, { address: string; city: string; state: string; zipCode: string }>();
    (properties ?? []).forEach((property) => {
      map.set(property.id, property);
    });
    return map;
  }, [properties]);

  useEffect(() => {
    if (!automationSettings) return;
    setAutoTriageEnabled(automationSettings.autoTriageEnabled);
    setAutoEscalationEnabled(automationSettings.autoEscalationEnabled);
    setAutoVendorAssignmentEnabled(automationSettings.autoVendorAssignmentEnabled);
    lastSavedAutomationSettingsRef.current = [
      automationSettings.autoTriageEnabled,
      automationSettings.autoEscalationEnabled,
      automationSettings.autoVendorAssignmentEnabled,
    ].join(":");
    setAutomationSettingsReady(true);
  }, [automationSettings]);

  useEffect(() => {
    if (!isManager || !automationSettingsReady) return;
    const signature = [autoTriageEnabled, autoEscalationEnabled, autoVendorAssignmentEnabled].join(":");
    if (signature === lastSavedAutomationSettingsRef.current) return;

    const timer = setTimeout(() => {
      updateAutomationSettings(
        {
          autoTriageEnabled,
          autoEscalationEnabled,
          autoVendorAssignmentEnabled,
        },
        {
          onSuccess: () => {
            lastSavedAutomationSettingsRef.current = signature;
          },
        },
      );
    }, 500);

    return () => clearTimeout(timer);
  }, [
    autoEscalationEnabled,
    autoTriageEnabled,
    autoVendorAssignmentEnabled,
    automationSettingsReady,
    isManager,
    updateAutomationSettings,
  ]);

  const submitMaintenance = () => {
    if (!isTenant || !user || !activeLease || !title.trim() || !description.trim()) return;
    createMaintenance(
      {
        propertyId: activeLease.propertyId,
        tenantId: user.id,
        title: title.trim(),
        description: description.trim(),
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

  if (isTenant) {
    return (
      <div className="space-y-8 animate-in">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Maintenance</h1>
          <p className="text-slate-500 mt-1">Submit a request and track updates from your property team.</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Submit Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Property</p>
                <p className="mt-2 font-medium text-slate-900">
                  {activeLease && propertyById.get(activeLease.propertyId)
                    ? `${propertyById.get(activeLease.propertyId)?.address}, ${propertyById.get(activeLease.propertyId)?.city}, ${propertyById.get(activeLease.propertyId)?.state} ${propertyById.get(activeLease.propertyId)?.zipCode}`
                    : "No active lease property found"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenance-title">Title</Label>
                <Input
                  id="maintenance-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Leaky faucet"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenance-description">Description</Label>
                <Textarea
                  id="maintenance-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue, location, and urgency"
                />
              </div>

              <Button onClick={submitMaintenance} disabled={!activeLease || isSubmittingRequest}>
                {isSubmittingRequest ? "Submitting..." : "Submit Request"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Request Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="text-center py-10 text-slate-500">Loading requests...</div>
              ) : requests?.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <p className="text-slate-500">No maintenance requests yet.</p>
                </div>
              ) : (
                requests?.map((req) => (
                  <div key={req.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{req.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{req.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={`capitalize ${getTenantStatusClass(req.status)}`}>
                          {req.status.replaceAll("_", " ")}
                        </Badge>
                        <Badge variant="outline" className={`capitalize ${getPriorityColor(req.priority)}`}>
                          {req.priority}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3 border-l border-slate-200 pl-4">
                      {buildTenantTimeline(req).map((event) => (
                        <div key={`${req.id}-${event.label}`}>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{event.label}</p>
                          <p className="text-sm text-slate-800 capitalize">{event.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Maintenance Requests</h1>
          <p className="text-slate-500 mt-1">Track and manage property repairs.</p>
        </div>
        {isManager && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-slate-200 bg-white text-slate-600"
                aria-label="Maintenance settings"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[95vw] max-w-80 p-3 space-y-2">
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2">
                <span className="text-sm text-slate-700">Enable auto-triage</span>
                <Switch checked={autoTriageEnabled} onCheckedChange={setAutoTriageEnabled} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2">
                <span className="text-sm text-slate-700">Enable SLA escalations</span>
                <Switch checked={autoEscalationEnabled} onCheckedChange={setAutoEscalationEnabled} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2">
                <span className="text-sm text-slate-700">Enable vendor auto-assignment</span>
                <Switch checked={autoVendorAssignmentEnabled} onCheckedChange={setAutoVendorAssignmentEnabled} />
              </div>
              <p className="text-[11px] text-slate-500">
                {isSavingAutomationSettings ? "Saving..." : "Changes are saved automatically."}
              </p>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-10">Loading requests...</div>
        ) : requests?.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <p className="text-slate-500">No active maintenance requests.</p>
          </div>
        ) : (
          requests?.map((req) => (
            <Card key={req.id} className="border-slate-200 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline" className={getPriorityColor(req.priority)}>
                        {req.priority}
                      </Badge>
                      <span className="text-sm text-slate-400">
                        {format(new Date(req.createdAt || new Date()), "MMM d, yyyy")}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{req.title}</h3>
                    <p className="text-slate-600 text-sm mb-4">{req.description}</p>

                    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className="capitalize">
                        {req.category || "general"}
                      </Badge>
                      {req.assignedVendor ? (
                        <Badge variant="secondary" className="inline-flex items-center gap-1">
                          <Wrench className="h-3 w-3" />
                          {req.assignedVendor}
                        </Badge>
                      ) : null}
                      {req.assignmentNote ? (
                        <span className="text-slate-500">{req.assignmentNote}</span>
                      ) : null}
                      {req.slaDueAt ? (
                        <Badge variant="outline" className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3" />
                          SLA {formatDistanceToNowStrict(new Date(req.slaDueAt), { addSuffix: true })}
                        </Badge>
                      ) : null}
                      {req.escalatedAt ? (
                        <Badge className="bg-red-600 text-white hover:bg-red-600">
                          Escalated
                        </Badge>
                      ) : null}
                    </div>

                    {req.aiAnalysis && (
                      <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex gap-3 text-sm text-blue-800">
                        <Bot className="w-5 h-5 flex-shrink-0" />
                        <div>
                          <span className="font-semibold">AI Analysis:</span> {req.aiAnalysis}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 md:min-w-[200px]">
                    <div className="flex flex-col items-start gap-2 text-sm font-medium text-slate-700 sm:flex-row sm:items-center">
                      Status:
                      <Select defaultValue={req.status} onValueChange={(val) => updateStatus({ id: req.id, status: val })}>
                        <SelectTrigger className="h-8 w-full sm:w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {!req.aiAnalysis && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                        onClick={() => analyze(req.id)}
                        disabled={isAnalyzing}
                      >
                        <Bot className="w-4 h-4" />
                        {isAnalyzing ? "Analyzing..." : "Analyze with AI"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
