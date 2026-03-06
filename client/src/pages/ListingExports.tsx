import { useMemo, useState } from "react";
import { CheckCircle2, Search, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  useAvailableListingProperties,
  usePublishApartmentsListing,
  usePublishZillowListing,
} from "@/hooks/use-listing-exports";
import type { Property } from "@shared/schema";

function propertyLabel(property: Property): string {
  return `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`;
}

export default function ListingExports() {
  const [search, setSearch] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [selectedSites, setSelectedSites] = useState({
    zillow: true,
    apartments: true,
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const { toast } = useToast();

  const { data: availableProperties, isLoading } = useAvailableListingProperties(search);
  const zillowPublish = usePublishZillowListing();
  const apartmentsPublish = usePublishApartmentsListing();

  const selectedProperty = useMemo(
    () => availableProperties?.find((p) => p.id === selectedPropertyId) ?? null,
    [availableProperties, selectedPropertyId]
  );

  const publishCount = Number(selectedSites.zillow) + Number(selectedSites.apartments);

  const handlePublish = async () => {
    if (!selectedPropertyId) {
      toast({ title: "Select a property", description: "Pick one listing to publish." });
      return;
    }

    if (publishCount === 0) {
      toast({ title: "Select at least one site", description: "Choose where to publish.", variant: "destructive" });
      return;
    }

    setIsPublishing(true);
    try {
      const jobs: Array<Promise<{ site: string; success: boolean; statusCode: number }>> = [];

      if (selectedSites.zillow) {
        jobs.push(
          zillowPublish
            .mutateAsync({ propertyId: selectedPropertyId })
            .then((result) => ({ site: "Zillow", success: result.success, statusCode: result.statusCode }))
        );
      }

      if (selectedSites.apartments) {
        jobs.push(
          apartmentsPublish
            .mutateAsync({ propertyId: selectedPropertyId, format: "json" })
            .then((result) => ({ site: "Apartments.com", success: result.success, statusCode: result.statusCode }))
        );
      }

      const settled = await Promise.allSettled(jobs);
      const successes: string[] = [];
      const failures: string[] = [];

      settled.forEach((entry) => {
        if (entry.status === "fulfilled") {
          const line = `${entry.value.site} (HTTP ${entry.value.statusCode})`;
          if (entry.value.success) {
            successes.push(line);
          } else {
            failures.push(line);
          }
        } else {
          failures.push("One site failed before publishing");
        }
      });

      if (failures.length === 0) {
        toast({
          title: "Listing published",
          description: `Published to ${successes.join(", ")}.`,
        });
      } else {
        toast({
          title: successes.length > 0 ? "Partially published" : "Publish failed",
          description: [
            successes.length > 0 ? `Success: ${successes.join(", ")}` : null,
            `Failed: ${failures.join(", ")}`,
          ]
            .filter(Boolean)
            .join(" | "),
          variant: "destructive",
        });
      }
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-emerald-50/50 p-6 shadow-sm">
        <h1 className="text-3xl font-bold font-display text-slate-900">Syndication</h1>
        <p className="text-slate-600 mt-1 max-w-3xl">
          Listing Feed Generator creates a standardized feed and distributes to selected rental marketplaces.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 space-y-3">
            <CardTitle className="text-base">Choose Property</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by address, city, zip..."
                className="pl-10 border-slate-200 bg-slate-50 focus:bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[620px] overflow-y-auto">
            {isLoading && <p className="text-sm text-slate-500">Loading properties...</p>}
            {!isLoading && availableProperties?.length === 0 && (
              <p className="text-sm text-slate-500">No available properties found.</p>
            )}
            {availableProperties?.map((property) => {
              const isSelected = selectedPropertyId === property.id;
              return (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => setSelectedPropertyId(property.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${
                    isSelected
                      ? "border-emerald-400 bg-emerald-50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{propertyLabel(property)}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        ${Number(property.price).toLocaleString()} / month • {property.bedrooms} bd • {property.bathrooms} ba • {" "}
                        {property.sqft} sqft
                      </p>
                    </div>
                    <Badge variant={isSelected ? "default" : "secondary"}>{isSelected ? "Selected" : "Available"}</Badge>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Feed Generator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              {selectedProperty ? (
                <p className="text-sm text-slate-700">
                  Publishing listing for <span className="font-medium text-slate-900">{propertyLabel(selectedProperty)}</span>
                </p>
              ) : (
                <p className="text-sm text-slate-500">Select a property to continue.</p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">Select sites to publish</p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSites({ zillow: true, apartments: true })}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSites({ zillow: false, apartments: false })}
                  >
                    Clear all
                  </Button>
                </div>
              </div>
              <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 cursor-pointer bg-white">
                <div>
                  <p className="text-sm font-medium text-slate-900">Zillow Rentals</p>
                  <p className="text-xs text-slate-500">Publish via Zillow listing endpoint</p>
                </div>
                <Checkbox
                  checked={selectedSites.zillow}
                  onCheckedChange={(checked) =>
                    setSelectedSites((prev) => ({ ...prev, zillow: checked === true }))
                  }
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 cursor-pointer bg-white">
                <div>
                  <p className="text-sm font-medium text-slate-900">Apartments.com</p>
                  <p className="text-xs text-slate-500">Publish via Apartments.com distribution endpoint</p>
                </div>
                <Checkbox
                  checked={selectedSites.apartments}
                  onCheckedChange={(checked) =>
                    setSelectedSites((prev) => ({ ...prev, apartments: checked === true }))
                  }
                />
              </label>
            </div>

            <Button
              className="w-full"
              disabled={!selectedPropertyId || publishCount === 0 || isPublishing}
              onClick={handlePublish}
            >
              <Send className="w-4 h-4 mr-2" />
              {isPublishing ? "Publishing..." : `Publish to ${publishCount} Site${publishCount > 1 ? "s" : ""}`}
            </Button>

            {(zillowPublish.data || apartmentsPublish.data) && (
              <div className="space-y-2">
                {zillowPublish.data && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-2 ${
                      zillowPublish.data.success ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                    }`}
                  >
                    {zillowPublish.data.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span>
                      Zillow: {zillowPublish.data.success ? "Published" : "Failed"} (HTTP {zillowPublish.data.statusCode})
                    </span>
                  </div>
                )}

                {apartmentsPublish.data && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-2 ${
                      apartmentsPublish.data.success ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                    }`}
                  >
                    {apartmentsPublish.data.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span>
                      Apartments.com: {apartmentsPublish.data.success ? "Published" : "Failed"} (HTTP {apartmentsPublish.data.statusCode})
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
