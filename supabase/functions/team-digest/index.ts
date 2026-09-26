import { adminClient, edgeError, handleOptions, json } from "../_shared/http.ts";
import { sendNimbaSms } from "../_shared/nimba.ts";

Deno.serve(async (request) => {
  const options = handleOptions(request); if (options) return options;
  try {
    const secret = Deno.env.get("CRON_SECRET");
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!secret || request.headers.get("x-cron-secret") !== secret && bearer !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") && bearer !== Deno.env.get("SUPABASE_ANON_KEY")) return json(request, { error: "Non autorisé" }, 401);
    const body = await request.json().catch(() => ({})) as { kind?: "EVENING" | "WEEKLY" };
    const kind = body.kind === "WEEKLY" ? "WEEKLY" : "EVENING";
    const admin = adminClient(); const now = new Date(); const dateKey = now.toISOString().slice(0, 10);
    const { data: profiles, error } = await admin.from("profiles").select("id,full_name,phone").eq("active", true).not("phone", "is", null);
    if (error) return json(request, { error: error.message }, 500);
    let sent = 0, skipped = 0;
    for (const profile of profiles || []) {
      const { data: prior } = await admin.from("team_digest_deliveries").select("id").eq("profile_id", profile.id).eq("digest_date", dateKey).eq("kind", kind).maybeSingle();
      if (prior) { skipped++; continue; }
      const firstName = String(profile.full_name || "collaborateur").split(/\s+/)[0];
      const message = kind === "WEEKLY"
        ? `Merci ${firstName} pour ton engagement cette semaine. Continue à faire avancer tes missions et à tenir SmartSell à jour. Ton travail compte pour toute l'équipe.`
        : `Hello ${firstName}, comment vas-tu ? As-tu des tâches en pause ? Pense à mettre tes tâches à jour dans SmartSell avant de terminer ta journée. Merci pour ton engagement.`;
      let status = "SENT", errorMessage: string | null = null;
      try { if (Deno.env.get("COMMUNICATION_TEST_MODE") !== "false") { if (!Deno.env.get("COMMUNICATION_TEST_PHONE")) throw new Error("Numéro de test SMS manquant"); await sendNimbaSms([Deno.env.get("COMMUNICATION_TEST_PHONE")!], message); } else await sendNimbaSms([profile.phone], message); sent++; }
      catch (caught) { status = "FAILED"; errorMessage = caught instanceof Error ? caught.message : "Envoi impossible"; }
      await admin.from("team_digest_deliveries").insert({ profile_id: profile.id, kind, digest_date: dateKey, status, error: errorMessage });
    }
    return json(request, { kind, sent, skipped, total: profiles?.length || 0 });
  } catch (error) { return edgeError(request, error); }
});
