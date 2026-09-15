import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Verwijdert het account van de ingelogde gebruiker plus alle bijbehorende
 * gegevens. Daarna kan met hetzelfde e-mailadres een volledig leeg account
 * worden aangemaakt.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    await supabaseAdmin.from("high_fives").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`);
    await supabaseAdmin
      .from("friendships")
      .delete()
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    await supabaseAdmin.from("shared_dishes").delete().eq("owner_id", userId);
    await supabaseAdmin.from("user_stats").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_data").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
