import { adminClient } from "../_shared/http.ts";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!);
const page = (title: string, message: string, action = "") => new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · SmartSell</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090b;color:#fff;font:16px Inter,system-ui;padding:20px}.card{width:min(520px,100%);background:#151218;border:1px solid #302735;border-radius:22px;padding:32px;box-shadow:0 25px 70px #0008}.mark{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:#6a2b85;color:#faee35;font-weight:900;font-size:22px}h1{font-size:clamp(1.7rem,7vw,2.5rem);margin:24px 0 10px}p{color:#bbb3bf;line-height:1.6}.done{color:#faee35}button{width:100%;border:0;border-radius:13px;background:#6a2b85;color:#fff;padding:15px;font-weight:800;font-size:1rem;margin-top:18px;cursor:pointer}small{display:block;color:#77717b;margin-top:18px;text-align:center}</style></head><body><main class="card"><div class="mark">SS</div><h1>${title}</h1><p>${message}</p>${action}<small>SmartSell · Suivi sécurisé des tâches</small></main></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

Deno.serve(async (request) => {
  const url = new URL(request.url), token = url.searchParams.get("token");
  if (!token) return page("Lien invalide", "Ce lien de confirmation est incomplet.");
  const admin = adminClient();
  const { data: reminder } = await admin.from("task_reminder_schedule").select("id,task_id,profile_id,status,tasks(title,status,due_at)").eq("confirmation_token", token).maybeSingle();
  if (!reminder) return page("Lien expiré", "Ce rappel n’existe plus ou a déjà été remplacé.");
  const task = Array.isArray(reminder.tasks) ? reminder.tasks[0] : reminder.tasks;
  const safeTitle = escapeHtml(task?.title || "La tâche assignée");
  if (task?.status === "TERMINE") return page("Tâche déjà terminée", `<span class="done">${safeTitle}</span> a déjà été confirmée. Aucun autre rappel ne sera envoyé.`);
  if (request.method === "GET") return page("Avez-vous terminé ?", `Confirmez uniquement si la tâche <strong>${safeTitle}</strong> a bien été exécutée. Sans confirmation, les rappels continueront jusqu’à l’échéance.`, `<form method="post"><button type="submit">✓ Confirmer que la tâche est terminée</button></form>`);
  if (request.method !== "POST") return page("Action impossible", "Méthode non autorisée.");
  const { error } = await admin.from("tasks").update({ status: "TERMINE", completed_at: new Date().toISOString() }).eq("id", reminder.task_id);
  if (error) return page("Confirmation impossible", "Une erreur est survenue. Réessayez depuis le lien du SMS.");
  await admin.from("task_reminder_schedule").update({ status: "CANCELLED" }).eq("task_id", reminder.task_id).eq("status", "PENDING");
  await admin.from("notifications").insert({ profile_id: reminder.profile_id, channel: "IN_APP", title: "Tâche terminée", body: `${task?.title || "La tâche"} a été confirmée depuis le rappel SMS.`, entity_type: "task", entity_id: reminder.task_id });
  return page("Merci, c’est enregistré", `<span class="done">${safeTitle}</span> est maintenant marquée comme terminée dans SmartSell. Les prochains rappels ont été arrêtés.`);
});
