import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-profile";
import { useProperties } from "@/hooks/use-properties";
import { useCreateVendor, useDiscoverVendors, useImportVendorCandidate, useVendors } from "@/hooks/use-vendors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, MapPin, Phone, Plus, Search, Sparkles, Star } from "lucide-react";

const tradeOptions = ["plumbing", "electrical", "hvac", "appliance", "pest", "security", "general"];

export default function Vendors() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const [search, setSearch] = useState("");
  const [trade, setTrade] = useState("plumbing");
  const [propertyId, setPropertyId] = useState<string>("none");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorWebsite, setVendorWebsite] = useState("");
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [locationSeeded, setLocationSeeded] = useState(false);
  const { data: properties } = useProperties();
  const { data: profile } = useUserProfile();
  const scopedProperties = useMemo(
    () => (properties ?? []).filter((property) => property.managerId === user?.id),
    [properties, user?.id],
  );
  const { data: vendors, isLoading } = useVendors(search);
  const { mutate: discover, data: discoveryResult, isPending: isDiscovering } = useDiscoverVendors();
  const { mutate: importCandidate } = useImportVendorCandidate();
  const { mutate: createVendor, isPending: isCreatingVendor } = useCreateVendor();
  const [importingCandidateId, setImportingCandidateId] = useState<string | null>(null);

  useEffect(() => {
    if (locationSeeded || !profile) return;
    setCity(profile.city ?? "");
    setState(profile.state ?? "");
    setZipCode(profile.zipCode ?? "");
    setLocationSeeded(true);
  }, [locationSeeded, profile]);

  useEffect(() => {
    if (propertyId === "none") return;
    const selectedProperty = scopedProperties.find((property) => String(property.id) === propertyId);
    if (!selectedProperty) return;
    setCity(selectedProperty.city);
    setState(selectedProperty.state);
    setZipCode(selectedProperty.zipCode);
  }, [propertyId, scopedProperties]);

  if (!isManager) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        Vendor management is available for managers only.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Vendors</h1>
          <p className="mt-1 text-slate-500">Build a technician directory and import nearby vendors with AI-assisted discovery.</p>
          <p className="mt-2 text-xs text-slate-400">
            Default search location comes from your profile. Selecting a property overrides it.
          </p>
        </div>
        <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20">
              <Plus className="mr-2 h-4 w-4" />
              Add Vendor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Add vendor manually</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="RapidFix Plumbing" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Trade</Label>
                  <Select value={trade} onValueChange={setTrade}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tradeOptions.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} placeholder="(555) 555-5555" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} placeholder="dispatch@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input value={vendorWebsite} onChange={(e) => setVendorWebsite(e.target.value)} placeholder="https://example.com" />
                </div>
              </div>
              <Button
                className="w-full"
                disabled={isCreatingVendor || !vendorName.trim()}
                onClick={() => {
                  createVendor(
                    {
                      managerId: user?.id || "",
                      name: vendorName.trim(),
                      tradeCategories: [trade],
                      serviceStates: state ? [state.toUpperCase()] : [],
                      serviceCities: city ? [city] : [],
                      serviceZipCodes: zipCode ? [zipCode] : [],
                      phone: vendorPhone || null,
                      email: vendorEmail || null,
                      website: vendorWebsite || null,
                      rating: null,
                      reviewCount: null,
                      licenseNumber: null,
                      insuranceExpiry: null,
                      isOnCall: false,
                      isActive: true,
                      source: "manual",
                      sourceExternalId: null,
                      confidenceScore: "1.000",
                      rawIntakeData: null,
                    },
                    {
                      onSuccess: () => {
                        setVendorDialogOpen(false);
                        setVendorName("");
                        setVendorPhone("");
                        setVendorEmail("");
                        setVendorWebsite("");
                      },
                    },
                  );
                }}
              >
                {isCreatingVendor ? "Saving..." : "Save vendor"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Discover nearby technicians
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Property</Label>
                <Select value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No property selected</SelectItem>
                    {scopedProperties.map((property) => (
                      <SelectItem key={property.id} value={String(property.id)}>
                        {property.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trade</Label>
                <Select value={trade} onValueChange={setTrade}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tradeOptions.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Atlanta" />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="GA" maxLength={2} />
              </div>
              <div className="space-y-2">
                <Label>Zip Code</Label>
                <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="30303" />
              </div>
            </div>
            <Button
              className="w-full sm:w-auto"
              disabled={isDiscovering}
              onClick={() => discover({
                propertyId: propertyId === "none" ? undefined : Number(propertyId),
                city: city || undefined,
                state: state || undefined,
                zipCode: zipCode || undefined,
                trade,
              })}
            >
              {isDiscovering ? "Searching..." : "Find vendors"}
            </Button>

            {discoveryResult ? (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-600">
                  Source: <span className="font-medium text-slate-900">{discoveryResult.provider}</span>
                </div>
                {discoveryResult.candidates.map((candidate) => (
                  <div key={`${candidate.source}-${candidate.sourceExternalId || candidate.name}`} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{candidate.name}</p>
                          {candidate.rating ? (
                            <Badge variant="secondary" className="gap-1">
                              <Star className="h-3 w-3" />
                              {candidate.rating}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {candidate.tradeCategories.map((item) => (
                            <Badge key={item} variant="outline">{item}</Badge>
                          ))}
                        </div>
                        <div className="space-y-1 text-sm text-slate-600">
                          {candidate.phone ? <div className="flex items-center gap-2"><Phone className="h-4 w-4" />{candidate.phone}</div> : null}
                          {candidate.serviceCities?.length || candidate.serviceZipCodes?.length ? (
                            <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{[...candidate.serviceCities, ...candidate.serviceZipCodes].join(" • ")}</div>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={importingCandidateId === `${candidate.source}-${candidate.sourceExternalId || candidate.name}`}
                        onClick={() => {
                          const candidateId = `${candidate.source}-${candidate.sourceExternalId || candidate.name}`;
                          setImportingCandidateId(candidateId);
                          importCandidate(candidate, { onSettled: () => setImportingCandidateId(null) });
                        }}
                      >
                        {importingCandidateId === `${candidate.source}-${candidate.sourceExternalId || candidate.name}` ? "Importing..." : "Import"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900">Vendor directory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Search vendors..." />
            </div>
            {isLoading ? (
              <div className="py-10 text-center text-slate-500">Loading vendors...</div>
            ) : vendors?.length ? (
              <div className="space-y-3">
                {vendors.map((vendor) => (
                  <div key={vendor.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{vendor.name}</p>
                          <Badge variant={vendor.isOnCall ? "default" : "secondary"}>
                            {vendor.isOnCall ? "On call" : vendor.source}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {vendor.tradeCategories.map((item) => (
                            <Badge key={item} variant="outline">{item}</Badge>
                          ))}
                        </div>
                        <div className="space-y-1 text-sm text-slate-600">
                          {vendor.phone ? <div className="flex items-center gap-2"><Phone className="h-4 w-4" />{vendor.phone}</div> : null}
                          {vendor.serviceCities?.length ? <div className="flex items-center gap-2"><Building2 className="h-4 w-4" />{vendor.serviceCities.join(", ")}</div> : null}
                        </div>
                      </div>
                      {vendor.rating ? (
                        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                          {vendor.rating} stars
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                No vendors yet. Import candidates or add one manually.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
