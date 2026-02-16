import { Property } from "@shared/schema";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BedDouble, Bath, Ruler, MapPin } from "lucide-react";
import { Link } from "wouter";

interface PropertyCardProps {
  property: Property;
}

export function PropertyCard({ property }: PropertyCardProps) {
  const statusColor = {
    available: "bg-green-100 text-green-700 border-green-200",
    rented: "bg-blue-100 text-blue-700 border-blue-200",
    maintenance: "bg-orange-100 text-orange-700 border-orange-200",
  }[property.status] || "bg-gray-100 text-gray-700";

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 border-slate-200 group">
      <div className="relative h-48 overflow-hidden bg-slate-100">
        {/* Using a dynamic placeholder based on ID to simulate unique images */}
        <img 
          src={property.imageUrl || `https://placehold.co/600x400/e2e8f0/94a3b8?text=Property+${property.id}`}
          alt={property.address}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 right-3">
          <Badge className={`px-3 py-1 capitalize shadow-sm border ${statusColor} hover:${statusColor}`}>
            {property.status}
          </Badge>
        </div>
        <div className="absolute bottom-3 left-3">
          <div className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-bold text-slate-900 shadow-lg">
            ${Number(property.price).toLocaleString()}/mo
          </div>
        </div>
      </div>
      
      <CardHeader className="p-5 pb-2">
        <h3 className="text-lg font-bold font-display text-slate-900 truncate">{property.address}</h3>
        <div className="flex items-center text-slate-500 text-sm mt-1">
          <MapPin className="w-3.5 h-3.5 mr-1" />
          {property.city}, {property.state} {property.zipCode}
        </div>
      </CardHeader>
      
      <CardContent className="p-5 pt-4 pb-4">
        <div className="flex justify-between items-center text-sm text-slate-600">
          <div className="flex items-center gap-1.5">
            <BedDouble className="w-4 h-4 text-blue-500" />
            <span>{property.bedrooms} Beds</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bath className="w-4 h-4 text-blue-500" />
            <span>{Number(property.bathrooms)} Baths</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Ruler className="w-4 h-4 text-blue-500" />
            <span>{property.sqft} sqft</span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="p-5 pt-0">
        <Link href={`/properties/${property.id}`} className="w-full">
          <Button className="w-full bg-slate-900 hover:bg-slate-800 transition-all shadow-md hover:shadow-lg">
            View Details
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
