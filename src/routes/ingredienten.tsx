import { createFileRoute, redirect } from "@tanstack/react-router";

/** De ingrediënten wonen nu in de receptenbibliotheek. */
export const Route = createFileRoute("/ingredienten")({
  beforeLoad: () => {
    throw redirect({ to: "/gerechten" });
  },
});
