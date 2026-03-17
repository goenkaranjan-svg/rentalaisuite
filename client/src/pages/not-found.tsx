import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <Card className="w-full max-w-md mx-4 shadow-xl">
        <CardContent className="pt-6 text-center">
          <div className="flex mb-4 gap-2 justify-center">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold font-display text-slate-900">Page Not Found</h1>
          <p className="mt-2 text-sm text-slate-600 mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link href="/">
            <Button className="w-full bg-slate-900 hover:bg-slate-800">Return to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
