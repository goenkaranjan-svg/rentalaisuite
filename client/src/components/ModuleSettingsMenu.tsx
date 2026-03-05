import { Settings2 } from "lucide-react";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type ModuleSettingsItem = {
  label: string;
  href?: string;
  onSelect?: () => void;
};

export function ModuleSettingsMenu({
  moduleName,
  items,
}: {
  moduleName: string;
  items: ModuleSettingsItem[];
}) {
  const [, setLocation] = useLocation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 border-slate-200 bg-white text-slate-600"
          aria-label={`${moduleName} settings`}
          title={`${moduleName} settings`}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            onClick={() => {
              if (item.onSelect) item.onSelect();
              if (item.href) setLocation(item.href);
            }}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
