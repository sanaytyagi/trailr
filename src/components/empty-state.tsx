import { GraduationCap, Search } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
          <GraduationCap className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="absolute -right-2 -bottom-2 flex h-8 w-8 items-center justify-center rounded-full bg-secondary border-2 border-background">
          <Search className="h-4 w-4 text-secondary-foreground" />
        </div>
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Start building your college list
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
        Search for colleges above to begin tracking deadlines and decisions.
      </p>
    </div>
  );
}
