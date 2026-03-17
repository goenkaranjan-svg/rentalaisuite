import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { format } from "date-fns";

import { useAuth } from "@/hooks/use-auth";
import { useLeases } from "@/hooks/use-leases";
import { usePayments, useCreatePayment } from "@/hooks/use-payments";
import { useProperties } from "@/hooks/use-properties";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type UploadedPortalDocument = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  dataUrl: string;
};

const MAX_PORTAL_UPLOAD_BYTES = 2 * 1024 * 1024;

function formatDateLabel(value?: string | Date | null): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return format(date, "MMM d, yyyy");
}

function formatCompactDateTime(value?: string | Date | null): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read the selected file."));
    };
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

export default function RenterPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: leases } = useLeases();
  const { data: properties } = useProperties();
  const { data: payments } = usePayments();
  const { mutate: createPayment, isPending: isPaying } = useCreatePayment();
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedPortalDocument[]>([]);

  const uploadStorageKey = useMemo(
    () => `renter-uploaded-documents-v1:${user?.id ?? "anonymous"}`,
    [user?.id],
  );

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

  useEffect(() => {
    const raw = window.localStorage.getItem(uploadStorageKey);
    if (!raw) {
      setUploadedDocuments([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as UploadedPortalDocument[];
      if (Array.isArray(parsed)) {
        setUploadedDocuments(
          parsed.filter(
            (item) =>
              typeof item?.id === "string" &&
              typeof item?.name === "string" &&
              typeof item?.mimeType === "string" &&
              typeof item?.size === "number" &&
              typeof item?.uploadedAt === "string" &&
              typeof item?.dataUrl === "string",
          ),
        );
      }
    } catch {
      setUploadedDocuments([]);
    }
  }, [uploadStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(uploadStorageKey, JSON.stringify(uploadedDocuments));
  }, [uploadStorageKey, uploadedDocuments]);

  const payRentNow = () => {
    if (!activeLease || balance <= 0) return;
    createPayment(
      {
        leaseId: activeLease.id,
        amount: balance.toFixed(2),
        status: "paid",
        type: "rent",
      },
      {
        onSuccess: () => {
          toast({
            title: "Payment successful",
            description: `$${balance.toLocaleString()} rent payment recorded.`,
          });
        },
        onError: (err) => {
          toast({
            title: "Payment failed",
            description: err instanceof Error ? err.message : "Could not process payment.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const downloadLeaseDraft = () => {
    if (!activeLease?.draftText) return;
    const blob = new Blob([activeLease.draftText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lease-${activeLease.id}-draft.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDocumentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const oversized = files.find((file) => file.size > MAX_PORTAL_UPLOAD_BYTES);
    if (oversized) {
      toast({
        title: "File too large",
        description: `${oversized.name} is larger than 2 MB. Keep renter portal uploads lightweight for now.`,
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    try {
      const nextDocuments = await Promise.all(
        files.map(async (file) => ({
          id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          uploadedAt: new Date().toISOString(),
          dataUrl: await readFileAsDataUrl(file),
        })),
      );

      setUploadedDocuments((current) => [...nextDocuments, ...current].slice(0, 8));
      toast({
        title: "Document added",
        description: `${files.length} file${files.length > 1 ? "s" : ""} ready in your renter portal.`,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not add the selected file.",
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  const removeUploadedDocument = (documentId: string) => {
    setUploadedDocuments((current) => current.filter((item) => item.id !== documentId));
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Lease Summary</CardTitle>
            <Button onClick={payRentNow} disabled={!activeLease || balance <= 0 || isPaying}>
              {isPaying ? "Processing..." : balance > 0 ? `Pay $${balance.toLocaleString()}` : "Paid"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {!activeLease && <p className="text-slate-500">No active lease found.</p>}
            {activeLease && (
              <>
                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div><span className="text-slate-500">Status:</span> <span className="capitalize">{activeLease.status}</span></div>
                  <div><span className="text-slate-500">Start:</span> {formatDateLabel(activeLease.startDate)}</div>
                  <div><span className="text-slate-500">End:</span> {formatDateLabel(activeLease.endDate)}</div>
                  <div><span className="text-slate-500">Monthly Rent:</span> ${monthlyRent.toLocaleString()}</div>
                </div>

                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-900">Lease Documents</p>
                      <p className="text-sm text-stone-600">
                        Open your signed lease when available, or download the current draft copy.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeLease.documentUrl ? (
                        <Button asChild variant="outline">
                          <a href={activeLease.documentUrl} target="_blank" rel="noreferrer">
                            Open Lease
                          </a>
                        </Button>
                      ) : null}
                      {activeLease.draftText ? (
                        <Button variant="outline" onClick={downloadLeaseDraft}>
                          Download Draft
                        </Button>
                      ) : null}
                      {!activeLease.documentUrl && !activeLease.draftText ? (
                        <Badge variant="outline">Document pending</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
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
              <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                <div className="md:col-span-2">
                  <span className="text-slate-500">Address:</span>{" "}
                  <span className="font-medium text-slate-900">
                    {activeProperty.address}, {activeProperty.city}, {activeProperty.state} {activeProperty.zipCode}
                  </span>
                </div>
                <div><span className="text-slate-500">Status:</span> <span className="capitalize">{activeProperty.status}</span></div>
                <div><span className="text-slate-500">Bedrooms:</span> {activeProperty.bedrooms}</div>
                <div><span className="text-slate-500">Bathrooms:</span> {activeProperty.bathrooms}</div>
                <div><span className="text-slate-500">Square Feet:</span> {activeProperty.sqft.toLocaleString()}</div>
                {activeProperty.description ? (
                  <div className="md:col-span-2">
                    <span className="text-slate-500">Description:</span>{" "}
                    <span className="text-slate-700">{activeProperty.description}</span>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
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
          <CardHeader><CardTitle>Document Uploads</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="renter-document-upload">Add documents</Label>
              <Input
                id="renter-document-upload"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                multiple
                onChange={handleDocumentUpload}
              />
              <p className="text-xs text-slate-500">
                Use this for renter insurance, move-in photos, or lease support files. Files are saved in your browser, up to 2 MB each.
              </p>
            </div>

            <div className="space-y-3">
              {uploadedDocuments.map((document) => (
                <div key={document.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{document.name}</p>
                    <p className="text-sm text-slate-500">
                      {formatFileSize(document.size)} • Added {formatCompactDateTime(document.uploadedAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline">
                      <a href={document.dataUrl} download={document.name}>
                        Download
                      </a>
                    </Button>
                    <Button variant="ghost" onClick={() => removeUploadedDocument(document.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              {uploadedDocuments.length === 0 && (
                <p className="text-sm text-slate-500">No uploaded documents yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
