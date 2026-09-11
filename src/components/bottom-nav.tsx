import { Link } from "@tanstack/react-router";
import { Scale, UtensilsCrossed, ChefHat, Apple, Target } from "lucide-react";

const items = [
  { to: "/", label: "Gewicht", icon: Scale },
  { to: "/vandaag", label: "Vandaag", icon: UtensilsCrossed },
  { to: "/gerechten", label: "Gerechten", icon: ChefHat },
  { to: "/ingredienten", label: "Ingrediënten", icon: Apple },
  { to: "/doel", label: "Doel", icon: Target },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2 py-1.5">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: true }}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors data-[status=active]:text-primary"
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
