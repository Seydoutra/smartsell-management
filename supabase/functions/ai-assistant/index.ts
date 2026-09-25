import { authenticated, edgeError, handleOptions, json } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const preflight = handleOptions(request); if (preflight) return preflight;
  if (request.method !== "POST") return json(request, { error: "Méthode non autorisée" }, 405);
  try {
    const { admin, user } = await authenticated(request);
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json(request, { error: "Ajoutez OPENAI_API_KEY dans les secrets Supabase pour activer l’assistant IA." }, 503);
    const { prompt, context } = await request.json() as { prompt: string; context?: string };
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna", reasoning: { effort: "low" }, max_output_tokens: 1400, instructions: "Tu es le copilote de gestion interne de Smartsell à Conakry. Réponds en français, de façon concise, opérationnelle et prudente. Ne prétends jamais avoir exécuté une action.", input: `Contexte autorisé:\n${(context || "").slice(0, 6000)}\n\nDemande:\n${prompt.slice(0, 3000)}` }) });
    const body = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };
    if (!response.ok) return json(request, { error: body.error?.message || "Service IA indisponible" }, 502);
    const answer = body.output_text || body.output?.flatMap((item) => item.content || []).filter((item) => item.type === "output_text").map((item) => item.text || "").join("\n").trim();
    await admin.from("activity_logs").insert({ actor_id: user.id, action: "CREATE", entity_type: "ai_assistant", metadata: { prompt: prompt.slice(0, 180) } });
    return json(request, { answer: answer || "Aucune réponse générée." });
  } catch (error) { return edgeError(request, error); }
});
