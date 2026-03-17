import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { Loader2, CheckCircle2, FileSignature } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCompleteLeaseSigning, useValidateSigningToken } from "@/hooks/use-leases";

export default function LeaseSign() {
  const [match, params] = useRoute("/sign/:token");
  const token = useMemo(() => {
    if (!match || !params?.token) return "";
    return decodeURIComponent(params.token).trim();
  }, [match, params?.token]);

  const { data, isLoading, error } = useValidateSigningToken(token);
  const { mutateAsync: completeSigning, isPending } = useCompleteLeaseSigning();
  const [fullName, setFullName] = useState("");
  const [result, setResult] = useState<{ signedAt: string; signedFullName: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSign = async () => {
    setSubmitError(null);
    try {
      const response = await completeSigning({ token, fullName });
      setResult({ signedAt: response.signedAt, signedFullName: response.signedFullName });
    } catch (err: any) {
      setSubmitError(String(err?.message || "Failed to sign lease."));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <FileSignature className="w-5 h-5 text-emerald-700" />
            Lease Signing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" /> Verifying signing link...
            </div>
          )}

          {!isLoading && (error || !data?.valid) && (
            <p className="text-sm text-red-600">This signing link is invalid or expired.</p>
          )}

          {!isLoading && data?.valid && !result && (
            <>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
                <p><span className="font-medium">Lease:</span> #{data.leaseId}</p>
                <p><span className="font-medium">Property:</span> {data.propertyAddress ?? "-"}</p>
                <p><span className="font-medium">Monthly rent:</span> ${Number(data.rentAmount ?? 0).toLocaleString()}</p>
                <p><span className="font-medium">Expires:</span> {data.expiresAt ? new Date(data.expiresAt).toLocaleString() : "-"}</p>
              </div>

              <div className="space-y-2">
                <Label>Full legal name</Label>
                <Input
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              {submitError && <p className="text-sm text-red-600">{submitError}</p>}

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={handleSign}
                disabled={isPending || fullName.trim().length < 2}
              >
                {isPending ? "Signing..." : "Sign Lease"}
              </Button>
            </>
          )}

          {result && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm space-y-2">
              <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="w-4 h-4" /> Lease signed successfully</p>
              <p>Signed by: {result.signedFullName}</p>
              <p>Signed at: {new Date(result.signedAt).toLocaleString()}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
