import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import heroImg from "@assets/hero.jpg"; // Placeholder, won't be used due to Unsplash replacement below

export default function Login() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 z-0" />
        {/* real estate modern city skyline */}
        <img 
          src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"
          alt="Modern building"
          className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay"
        />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold font-display tracking-tight">PropMan.ai</span>
          </div>
          
          <h1 className="text-5xl font-bold font-display leading-tight mb-6">
            The future of <br/>
            <span className="text-blue-400">property management</span>
          </h1>
          <p className="text-lg text-slate-300 max-w-md">
            Automate leases, streamline maintenance, and optimize your rental portfolio with AI-driven insights.
          </p>
        </div>

        <div className="relative z-10 text-sm text-slate-400">
          © 2024 PropMan Inc. All rights reserved.
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex flex-col justify-center items-center p-8 bg-white">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold font-display text-slate-900">Welcome Back</h2>
            <p className="text-slate-500">Sign in to access your dashboard</p>
          </div>

          <div className="pt-8 pb-6">
            <Button 
              size="lg" 
              className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-900/10 transition-all hover:-translate-y-0.5"
              onClick={() => window.location.href = "/api/login"}
            >
              Sign In
            </Button>
          </div>

          <p className="text-xs text-slate-400">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
