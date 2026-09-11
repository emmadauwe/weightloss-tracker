import { Link } from "@tanstack/react-router";
import { ArrowLeft, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";

export function AppHeader({
  title, subtitle, back,
}: { title: string; subtitle?: string; back?: boolean }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4">
        {back && (
          <Link to=".." className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent">
            <ArrowLeft className="h-5 w-5 text-primary" />
          </Link>
        )}
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            {title}
          </h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <button
          type="button"
          aria-label="Uitloggen"
          onClick={() => void signOut()}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent"
        >
          <LogOut className="h-4 w-4 text-primary" />
        </button>
      </div>
    </header>
  );
}
