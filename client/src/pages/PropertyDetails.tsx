import { useRoute, Link } from "wouter";
import { useProperty } from "@/hooks/use-properties";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, BedDouble, Bath, Ruler } from "lucide-react";

export default function PropertyDetails() {
  const [match, params] = useRoute("/properties/:id");
  const id = match ? Number(params.id) : 0;
  const { data: property, isLoading } = useProperty(id);

  if (!match) return null;

  if (isLoading) {
    return (
      <div className="py-10 text-slate-500">Loading property...</div>
    );
  }

  if (!property) {
    return (
      <div className="space-y-4 py-10">
        <p className="text-slate-600">Property not found.</p>
        <Link href="/properties">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Properties
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/properties">
        <Button variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Properties
        </Button>
      </Link>

      <Card className="overflow-hidden border-slate-200">
        <div className="h-72 bg-slate-100">
          <img
            src={property.imageUrl || `https://placehold.co/1200x600/e2e8f0/94a3b8?text=Property+${property.id}`}
            alt={property.address}
            className="w-full h-full object-cover"
          />
        </div>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{property.address}</CardTitle>
              <p className="text-slate-500 mt-2 flex items-center">
                <MapPin className="w-4 h-4 mr-1" />
                {property.city}, {property.state} {property.zipCode}
              </p>
            </div>
            <Badge className="capitalize">{property.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-3xl font-bold text-slate-900">
            ${Number(property.price).toLocaleString()}/mo
          </div>
          <div className="grid grid-cols-3 gap-4 text-slate-700">
            <div className="flex items-center gap-2"><BedDouble className="w-4 h-4" /> {property.bedrooms} beds</div>
            <div className="flex items-center gap-2"><Bath className="w-4 h-4" /> {Number(property.bathrooms)} baths</div>
            <div className="flex items-center gap-2"><Ruler className="w-4 h-4" /> {property.sqft} sqft</div>
          </div>
          {property.description && (
            <p className="text-slate-600">{property.description}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
