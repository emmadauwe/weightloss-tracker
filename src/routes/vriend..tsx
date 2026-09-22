
function SharedPlan({ plan, ownerName }: { plan: WorkoutPlan; ownerName: string }) {
  const { items: myPlans, adopt } = useWorkoutPlans();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const already = myPlans.some((p) => p.source_owner === plan.user_id && p.source_plan === plan.id);

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-accent"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{plan.name}</div>
          <div className="text-xs text-muted-foreground">{plan.exercises.length} oefeningen</div>
        </div>
      </button>
      {open && (
        <ul className="space-y-1 border-t border-border px-3 py-3 text-xs text-muted-foreground">
          {plan.exercises.map((ex, i) => (
            <li key={i} className="break-words">
              · {ex.name}
              {ex.sets || ex.reps ? ` — ${ex.sets ?? "?"}×${ex.reps ?? "?"}` : ""}
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end border-t border-border px-3 py-1.5">
        <Button
          size="sm"
          variant="ghost"
          disabled={already || busy}
          onClick={() => {
            setBusy(true);
            void adopt(plan, ownerName).finally(() => setBusy(false));
          }}
        >
          {already ? (
            <Check className="mr-1 h-4 w-4 text-primary" />
          ) : (
            <Download className="mr-1 h-4 w-4 text-primary" />
          )}
          {already ? "In jouw schema's" : "Overnemen"}
        </Button>
      </div>
    </div>
  );
}
