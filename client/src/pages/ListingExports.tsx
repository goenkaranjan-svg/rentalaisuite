import { useState } from "react";
import { Search, Copy, FileOutput, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  type ListingFieldMapping,
  useAvailableListingProperties,
  useCreateListingMappingTemplate,
  useDeleteListingMappingTemplate,
  useGenerateApartmentsExport,
  useGenerateZillowExport,
  useListingMappingTemplates,
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
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [mapping, setMapping] = useState({
    title: "",
    availableDate: "",
    leaseTermMonths: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    amenities: "",
    petsAllowed: false,
    furnished: false,
    parkingIncluded: false,
    laundry: "",
    zillowPropertyType: "",
    zillowApplicationUrl: "",
    zillowVirtualTourUrl: "",
    apartmentsCommunityName: "",
    apartmentsUnitNumber: "",
    apartmentsDepositAmount: "",
    apartmentsUtilitiesIncluded: "",
  });
  const { toast } = useToast();

  const { data: availableProperties, isLoading } = useAvailableListingProperties(search);
  const { data: templates } = useListingMappingTemplates();
  const createTemplate = useCreateListingMappingTemplate();
  const deleteTemplate = useDeleteListingMappingTemplate();
  const zillowExport = useGenerateZillowExport();
  const apartmentsExport = useGenerateApartmentsExport();
  const zillowPublish = usePublishZillowListing();
  const apartmentsPublish = usePublishApartmentsListing();

  const selectedProperty = availableProperties?.find((p) => p.id === selectedPropertyId) ?? null;

  const buildFieldMapping = (): ListingFieldMapping => {
    const amenities = mapping.amenities
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const utilitiesIncluded = mapping.apartmentsUtilitiesIncluded
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const leaseTermMonths = Number(mapping.leaseTermMonths);
    const depositAmount = Number(mapping.apartmentsDepositAmount);

    return {
      common: {
        title: mapping.title || undefined,
        availableDate: mapping.availableDate || undefined,
        leaseTermMonths: Number.isFinite(leaseTermMonths) && leaseTermMonths > 0 ? leaseTermMonths : undefined,
        contactName: mapping.contactName || undefined,
        contactEmail: mapping.contactEmail || undefined,
        contactPhone: mapping.contactPhone || undefined,
        amenities: amenities.length > 0 ? amenities : undefined,
        petsAllowed: mapping.petsAllowed,
        furnished: mapping.furnished,
        parkingIncluded: mapping.parkingIncluded,
        laundry: mapping.laundry || undefined,
      },
      zillow: {
        propertyType: mapping.zillowPropertyType || undefined,
        applicationUrl: mapping.zillowApplicationUrl || undefined,
        virtualTourUrl: mapping.zillowVirtualTourUrl || undefined,
      },
      apartments: {
        communityName: mapping.apartmentsCommunityName || undefined,
        unitNumber: mapping.apartmentsUnitNumber || undefined,
        depositAmount: Number.isFinite(depositAmount) && depositAmount >= 0 ? depositAmount : undefined,
        utilitiesIncluded: utilitiesIncluded.length > 0 ? utilitiesIncluded : undefined,
      },
    };
  };

  const applyFieldMapping = (nextMapping?: ListingFieldMapping) => {
    const common = nextMapping?.common ?? {};
    const zillow = nextMapping?.zillow ?? {};
    const apartments = nextMapping?.apartments ?? {};
    setMapping({
      title: common.title ?? "",
      availableDate: common.availableDate ?? "",
      leaseTermMonths: common.leaseTermMonths ? String(common.leaseTermMonths) : "",
      contactName: common.contactName ?? "",
      contactEmail: common.contactEmail ?? "",
      contactPhone: common.contactPhone ?? "",
      amenities: common.amenities?.join(", ") ?? "",
      petsAllowed: Boolean(common.petsAllowed),
      furnished: Boolean(common.furnished),
      parkingIncluded: Boolean(common.parkingIncluded),
      laundry: common.laundry ?? "",
      zillowPropertyType: zillow.propertyType ?? "",
      zillowApplicationUrl: zillow.applicationUrl ?? "",
      zillowVirtualTourUrl: zillow.virtualTourUrl ?? "",
      apartmentsCommunityName: apartments.communityName ?? "",
      apartmentsUnitNumber: apartments.unitNumber ?? "",
      apartmentsDepositAmount: apartments.depositAmount !== undefined ? String(apartments.depositAmount) : "",
      apartmentsUtilitiesIncluded: apartments.utilitiesIncluded?.join(", ") ?? "",
    });
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied", description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard access was blocked.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8 animate-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Listing Syndication</h1>
          <p className="text-slate-500 mt-1">
            Search available rentals, select one property, and generate Zillow/Apartments.com formatted payloads.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search available properties by address, city, zip..."
            className="pl-10 border-slate-200 bg-slate-50 focus:bg-white transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Available Properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[560px] overflow-y-auto">
            {isLoading && <p className="text-sm text-slate-500">Loading properties...</p>}
            {!isLoading && availableProperties?.length === 0 && (
              <p className="text-sm text-slate-500">
                No available properties found. Clear search, or set a property status to <span className="font-medium">available</span> on the Properties page.
              </p>
            )}
            {availableProperties?.map((property) => {
              const isSelected = selectedPropertyId === property.id;
              return (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => setSelectedPropertyId(property.id)}
                  className={`w-full text-left rounded-lg border p-4 transition-colors ${
                    isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{propertyLabel(property)}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        ${Number(property.price).toLocaleString()} / month • {property.bedrooms} bd • {property.bathrooms} ba •{" "}
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
          <CardHeader>
            <CardTitle className="text-base">Generate Platform Formats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
              {selectedProperty ? (
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 mt-1 text-slate-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{propertyLabel(selectedProperty)}</p>
                    <p className="text-xs text-slate-500">Property ID: {selectedProperty.id}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Select one available property to generate export formats.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={!selectedPropertyId || zillowExport.isPending}
                onClick={() =>
                  selectedPropertyId &&
                  zillowExport.mutate({ propertyId: selectedPropertyId, mapping: buildFieldMapping() })
                }
              >
                <FileOutput className="w-4 h-4 mr-2" />
                {zillowExport.isPending ? "Generating Zillow..." : "Generate Zillow XML"}
              </Button>
              <Button
                variant="outline"
                disabled={!selectedPropertyId || apartmentsExport.isPending}
                onClick={() =>
                  selectedPropertyId &&
                  apartmentsExport.mutate({ propertyId: selectedPropertyId, mapping: buildFieldMapping() })
                }
              >
                <FileOutput className="w-4 h-4 mr-2" />
                {apartmentsExport.isPending ? "Generating Apartments..." : "Generate Apartments Format"}
              </Button>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50 space-y-4">
              <p className="text-sm font-medium text-slate-900">Custom Field Mapping</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  placeholder="Template name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Load saved template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template) => (
                      <SelectItem key={template.id} value={String(template.id)}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    type="button"
                    className="flex-1"
                    onClick={() => {
                      const picked = templates?.find((template) => String(template.id) === selectedTemplateId);
                      if (!picked) {
                        toast({ title: "Template not found", variant: "destructive" });
                        return;
                      }
                      applyFieldMapping(picked.mapping);
                      setTemplateName(picked.name);
                      toast({ title: "Template loaded", description: picked.name });
                    }}
                    disabled={!selectedTemplateId}
                  >
                    Load
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={createTemplate.isPending || !templateName.trim()}
                    onClick={() =>
                      createTemplate.mutate(
                        { name: templateName.trim(), mapping: buildFieldMapping() },
                        {
                          onSuccess: (template) => {
                            setSelectedTemplateId(String(template.id));
                            toast({ title: "Template saved", description: template.name });
                          },
                          onError: (error) => {
                            toast({ title: "Save failed", description: error.message, variant: "destructive" });
                          },
                        }
                      )
                    }
                  >
                    {createTemplate.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    variant="destructive"
                    type="button"
                    className="shrink-0"
                    disabled={deleteTemplate.isPending || !selectedTemplateId}
                    onClick={() =>
                      deleteTemplate.mutate(Number(selectedTemplateId), {
                        onSuccess: () => {
                          setSelectedTemplateId("");
                          toast({ title: "Template deleted" });
                        },
                        onError: (error) => {
                          toast({ title: "Delete failed", description: error.message, variant: "destructive" });
                        },
                      })
                    }
                  >
                    {deleteTemplate.isPending ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder="Listing title" value={mapping.title} onChange={(e) => setMapping((s) => ({ ...s, title: e.target.value }))} />
                <Input type="date" value={mapping.availableDate} onChange={(e) => setMapping((s) => ({ ...s, availableDate: e.target.value }))} />
                <Input placeholder="Lease term months (e.g. 12)" value={mapping.leaseTermMonths} onChange={(e) => setMapping((s) => ({ ...s, leaseTermMonths: e.target.value }))} />
                <Input placeholder="Laundry (in-unit/on-site/none)" value={mapping.laundry} onChange={(e) => setMapping((s) => ({ ...s, laundry: e.target.value }))} />
                <Input placeholder="Contact name" value={mapping.contactName} onChange={(e) => setMapping((s) => ({ ...s, contactName: e.target.value }))} />
                <Input placeholder="Contact email" value={mapping.contactEmail} onChange={(e) => setMapping((s) => ({ ...s, contactEmail: e.target.value }))} />
                <Input placeholder="Contact phone" value={mapping.contactPhone} onChange={(e) => setMapping((s) => ({ ...s, contactPhone: e.target.value }))} />
                <Input placeholder="Amenities (comma-separated)" value={mapping.amenities} onChange={(e) => setMapping((s) => ({ ...s, amenities: e.target.value }))} />
                <Input placeholder="Zillow property type" value={mapping.zillowPropertyType} onChange={(e) => setMapping((s) => ({ ...s, zillowPropertyType: e.target.value }))} />
                <Input placeholder="Zillow application URL" value={mapping.zillowApplicationUrl} onChange={(e) => setMapping((s) => ({ ...s, zillowApplicationUrl: e.target.value }))} />
                <Input placeholder="Zillow virtual tour URL" value={mapping.zillowVirtualTourUrl} onChange={(e) => setMapping((s) => ({ ...s, zillowVirtualTourUrl: e.target.value }))} />
                <Input placeholder="Apartments community name" value={mapping.apartmentsCommunityName} onChange={(e) => setMapping((s) => ({ ...s, apartmentsCommunityName: e.target.value }))} />
                <Input placeholder="Apartments unit number" value={mapping.apartmentsUnitNumber} onChange={(e) => setMapping((s) => ({ ...s, apartmentsUnitNumber: e.target.value }))} />
                <Input placeholder="Apartments deposit amount" value={mapping.apartmentsDepositAmount} onChange={(e) => setMapping((s) => ({ ...s, apartmentsDepositAmount: e.target.value }))} />
                <Input placeholder="Utilities included (comma-separated)" value={mapping.apartmentsUtilitiesIncluded} onChange={(e) => setMapping((s) => ({ ...s, apartmentsUtilitiesIncluded: e.target.value }))} />
              </div>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={mapping.petsAllowed} onCheckedChange={(checked) => setMapping((s) => ({ ...s, petsAllowed: checked }))} />
                  <span className="text-sm">Pets allowed</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={mapping.furnished} onCheckedChange={(checked) => setMapping((s) => ({ ...s, furnished: checked }))} />
                  <span className="text-sm">Furnished</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={mapping.parkingIncluded} onCheckedChange={(checked) => setMapping((s) => ({ ...s, parkingIncluded: checked }))} />
                  <span className="text-sm">Parking included</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="default"
                disabled={!selectedPropertyId || zillowPublish.isPending}
                onClick={() =>
                  selectedPropertyId &&
                  zillowPublish.mutate({ propertyId: selectedPropertyId, mapping: buildFieldMapping() }, {
                    onSuccess: (result) => {
                      toast({
                        title: result.success ? "Published to Zillow" : "Zillow publish failed",
                        description: `HTTP ${result.statusCode} from ${result.target}`,
                        variant: result.success ? "default" : "destructive",
                      });
                    },
                    onError: (error) => {
                      toast({
                        title: "Zillow publish failed",
                        description: error.message,
                        variant: "destructive",
                      });
                    },
                  })
                }
              >
                {zillowPublish.isPending ? "Publishing Zillow..." : "Publish to Zillow"}
              </Button>
              <Button
                variant="outline"
                disabled={!selectedPropertyId || apartmentsPublish.isPending}
                onClick={() =>
                  selectedPropertyId &&
                  apartmentsPublish.mutate(
                    { propertyId: selectedPropertyId, format: "json", mapping: buildFieldMapping() },
                    {
                      onSuccess: (result) => {
                        toast({
                          title: result.success ? "Published to Apartments.com" : "Apartments publish failed",
                          description: `HTTP ${result.statusCode} from ${result.target}`,
                          variant: result.success ? "default" : "destructive",
                        });
                      },
                      onError: (error) => {
                        toast({
                          title: "Apartments publish failed",
                          description: error.message,
                          variant: "destructive",
                        });
                      },
                    }
                  )
                }
              >
                {apartmentsPublish.isPending ? "Publishing Apartments..." : "Publish to Apartments (JSON)"}
              </Button>
              <Button
                variant="outline"
                disabled={!selectedPropertyId || apartmentsPublish.isPending}
                onClick={() =>
                  selectedPropertyId &&
                  apartmentsPublish.mutate(
                    { propertyId: selectedPropertyId, format: "csv", mapping: buildFieldMapping() },
                    {
                      onSuccess: (result) => {
                        toast({
                          title: result.success ? "Published to Apartments.com" : "Apartments publish failed",
                          description: `HTTP ${result.statusCode} from ${result.target}`,
                          variant: result.success ? "default" : "destructive",
                        });
                      },
                      onError: (error) => {
                        toast({
                          title: "Apartments publish failed",
                          description: error.message,
                          variant: "destructive",
                        });
                      },
                    }
                  )
                }
              >
                {apartmentsPublish.isPending ? "Publishing Apartments..." : "Publish to Apartments (CSV)"}
              </Button>
            </div>

            {zillowPublish.data && (
              <div className={`rounded-lg border p-3 text-sm ${zillowPublish.data.success ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                <p className="font-medium">
                  Zillow publish: {zillowPublish.data.success ? "Success" : "Failed"} (HTTP {zillowPublish.data.statusCode})
                </p>
                <p className="text-xs text-slate-600 mt-1">Target: {zillowPublish.data.target}</p>
                <Textarea readOnly value={zillowPublish.data.responseBody || "No response body"} className="mt-2 min-h-[80px] font-mono text-xs bg-white" />
              </div>
            )}

            {apartmentsPublish.data && (
              <div className={`rounded-lg border p-3 text-sm ${apartmentsPublish.data.success ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                <p className="font-medium">
                  Apartments publish ({apartmentsPublish.data.format.toUpperCase()}): {apartmentsPublish.data.success ? "Success" : "Failed"} (HTTP {apartmentsPublish.data.statusCode})
                </p>
                <p className="text-xs text-slate-600 mt-1">Target: {apartmentsPublish.data.target}</p>
                <Textarea readOnly value={apartmentsPublish.data.responseBody || "No response body"} className="mt-2 min-h-[80px] font-mono text-xs bg-white" />
              </div>
            )}

            {zillowExport.data && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Zillow XML</p>
                  <Button size="sm" variant="ghost" onClick={() => copyText(zillowExport.data!.payload, "Zillow XML")}>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
                {zillowExport.data.missingFields.length > 0 && (
                  <p className="text-xs text-amber-600">
                    Missing fields: {zillowExport.data.missingFields.join(", ")}
                  </p>
                )}
                <Textarea readOnly value={zillowExport.data.payload} className="min-h-[190px] font-mono text-xs" />
              </div>
            )}

            {apartmentsExport.data && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Apartments.com JSON</p>
                  <Button size="sm" variant="ghost" onClick={() => copyText(apartmentsExport.data!.payload, "Apartments JSON")}>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
                {apartmentsExport.data.missingFields.length > 0 && (
                  <p className="text-xs text-amber-600">
                    Missing fields: {apartmentsExport.data.missingFields.join(", ")}
                  </p>
                )}
                <Textarea readOnly value={apartmentsExport.data.payload} className="min-h-[160px] font-mono text-xs" />
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Apartments.com CSV Row</p>
                  <Button size="sm" variant="ghost" onClick={() => copyText(apartmentsExport.data!.csv, "Apartments CSV")}>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <Textarea readOnly value={apartmentsExport.data.csv} className="min-h-[120px] font-mono text-xs" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
