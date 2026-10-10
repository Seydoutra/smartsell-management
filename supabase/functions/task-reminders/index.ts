import { adminClient, json } from "../_shared/http.ts";
import { sendNimbaSms } from "../_shared/nimba.ts";
import { automatedRecipientEligible } from "../_shared/notificationEligibility.ts";

const messages = [
  (name: string, title: string, due: string) => `Bonjour ${name}. Petit rappel SmartSell : « ${title} » est prévue pour ${due}. Vous avez encore le temps de bien vous organiser.`,
  (name: string, title: string, due: string) => `${name}, avez-vous commencé « ${title} » ? L’échéance est ${due}. Pensez à confirmer dès que la tâche est terminée.`,
  (name: string, title: string, due: string) => `Dernier rappel SmartSell, ${name} : « ${title} » arrive à échéance ${due}. Confirmez son exécution ou finalisez-la dès maintenant.`,
];

Deno.serve(async (request) => {
  try {
  const secret = Deno.env.get("CRON_SECRET");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const authorized = Boolean((secret && request.headers.get("x-cron-secret") === secret)
    || (bearer && bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")));
  if (!authorized) return json(request, { error: "Non autorisé" }, 401);
  const admin = adminClient(), now = new Date();
  const { data: assignments, error: assignmentError } = await admin.from('task_assignment_sms')
    .select('id,task_id,profile_id,tenant_owner_id,tasks(title,due_at,status,creator_id,tenant_owner_id),recipient:profiles!task_assignment_sms_profile_id_fkey(full_name,phone,tenant_owner_id,active)')
    .eq('status','PENDING').lte('scheduled_for',now.toISOString()).order('scheduled_for').limit(100);
  if (assignmentError) return json(request, { error: assignmentError.message }, 500);
  let assignmentSent = 0, assignmentFailed = 0;
  for (const assignment of assignments || []) {
    const task = Array.isArray(assignment.tasks) ? assignment.tasks[0] : assignment.tasks;
    const profile = Array.isArray(assignment.recipient) ? assignment.recipient[0] : assignment.recipient;
    if (!task || !profile?.active || ['TERMINE','ANNULEE'].includes(task.status) || task.tenant_owner_id !== profile.tenant_owner_id || !await automatedRecipientEligible(admin, assignment.profile_id, assignment.tenant_owner_id)) {
      await admin.from('task_assignment_sms').update({ status:'CANCELLED' }).eq('id',assignment.id);
      continue;
    }
    const phone = Deno.env.get('COMMUNICATION_TEST_MODE') === 'true'
      ? Deno.env.get('COMMUNICATION_TEST_PHONE') : profile.phone;
    const due = task.due_at ? new Date(task.due_at).toLocaleString('fr-FR',{timeZone:'Africa/Conakry',dateStyle:'short',timeStyle:'short'}) : 'à définir';
    const name = String(profile.full_name || 'collaborateur').split(/\s+/)[0];
    const body = `Bonjour ${name}, la tâche « ${task.title} » vous est attribuée. Échéance : ${due}. Connectez-vous pour voir votre mission : https://seydoutra.github.io/smartsell-management/`;
    try {
      if (!phone) throw new Error('Numéro du collaborateur manquant');
      const result = await sendNimbaSms([phone],body,assignment.tenant_owner_id);
      await admin.from('task_assignment_sms').update({status:'SENT',sent_at:new Date().toISOString(),provider_message_id:result.uid||result.id||null,error:null}).eq('id',assignment.id);
      assignmentSent++;
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : 'Envoi SMS impossible';
      await admin.from('task_assignment_sms').update({status:'FAILED',error:detail}).eq('id',assignment.id);
      if (task.creator_id) await admin.from('notifications').insert({profile_id:task.creator_id,tenant_owner_id:assignment.tenant_owner_id,channel:'IN_APP',title:'SMS de tâche non envoyé',body:`${task.title} : ${detail}`,entity_type:'task',entity_id:assignment.task_id});
      assignmentFailed++;
    }
  }
  const { data: projectAssignments, error: projectAssignmentError } = await admin.from('project_assignment_sms')
    .select('id,project_id,profile_id,tenant_owner_id,projects(name,status,tenant_owner_id),recipient:profiles!project_assignment_sms_profile_id_fkey(full_name,phone,tenant_owner_id,active)')
    .eq('status','PENDING').lte('scheduled_for',now.toISOString()).order('scheduled_for').limit(100);
  if (projectAssignmentError) return json(request, { error: projectAssignmentError.message }, 500);
  let projectSent = 0, projectFailed = 0;
  for (const assignment of projectAssignments || []) {
    const project = Array.isArray(assignment.projects) ? assignment.projects[0] : assignment.projects;
    const profile = Array.isArray(assignment.recipient) ? assignment.recipient[0] : assignment.recipient;
    if (!project || !profile?.active || project.status === 'ANNULE' || project.tenant_owner_id !== profile.tenant_owner_id || !await automatedRecipientEligible(admin, assignment.profile_id, assignment.tenant_owner_id)) {
      await admin.from('project_assignment_sms').update({status:'CANCELLED'}).eq('id',assignment.id);
      continue;
    }
    const phone = Deno.env.get('COMMUNICATION_TEST_MODE') === 'true'
      ? Deno.env.get('COMMUNICATION_TEST_PHONE') : profile.phone;
    const name = String(profile.full_name || 'collaborateur').split(/\s+/)[0];
    const body = `Bonjour ${name}, le projet « ${project.name} » vous est attribué. Connectez-vous pour découvrir votre mission : https://seydoutra.github.io/smartsell-management/`;
    try {
      if (!phone) throw new Error('Numéro du collaborateur manquant');
      const result = await sendNimbaSms([phone],body,assignment.tenant_owner_id);
      await admin.from('project_assignment_sms').update({status:'SENT',sent_at:new Date().toISOString(),provider_message_id:result.uid||result.id||null,error:null}).eq('id',assignment.id);
      projectSent++;
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : 'Envoi SMS impossible';
      await admin.from('project_assignment_sms').update({status:'FAILED',error:detail}).eq('id',assignment.id);
      await admin.from('notifications').insert({profile_id:assignment.tenant_owner_id,tenant_owner_id:assignment.tenant_owner_id,channel:'IN_APP',title:'SMS de projet non envoyé',body:`${project.name} : ${detail}`,entity_type:'project',entity_id:assignment.project_id});
      projectFailed++;
    }
  }
  const { data: reminders, error } = await admin.from("task_reminder_schedule")
    .select("id,task_id,profile_id,step,scheduled_for,confirmation_token,tasks(title,due_at,status,tenant_owner_id,notification_channels),profiles(full_name,phone,tenant_owner_id)")
    .eq("status", "PENDING").lte("scheduled_for", now.toISOString()).order("scheduled_for").limit(100);
  if (error) return json(request, { error: error.message }, 500);
  let sent = 0, failed = 0, cancelled = 0;
  for (const reminder of reminders || []) {
    const task = Array.isArray(reminder.tasks) ? reminder.tasks[0] : reminder.tasks;
    const profile = Array.isArray(reminder.profiles) ? reminder.profiles[0] : reminder.profiles;
    if (!task || ['TERMINE','ANNULEE'].includes(task.status) || !task.notification_channels?.includes('SMS') || !task.due_at || new Date(task.due_at) <= now || !await automatedRecipientEligible(admin, reminder.profile_id, task.tenant_owner_id)) {
      await admin.from("task_reminder_schedule").update({ status: "CANCELLED" }).eq("id", reminder.id); cancelled++; continue;
    }
    // Le mode test doit être explicitement activé. Une variable absente ne doit
    // jamais détourner les rappels vers un seul numéro de test en production.
    const testMode = Deno.env.get("COMMUNICATION_TEST_MODE") === "true";
    const phone = testMode ? Deno.env.get("COMMUNICATION_TEST_PHONE") : profile?.phone;
    const name = String(profile?.full_name || "collaborateur").split(/\s+/)[0];
    const due = new Date(task.due_at).toLocaleString("fr-FR", { timeZone: "Africa/Conakry", dateStyle: "short", timeStyle: "short" });
    const confirmUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/task-reminder-action?token=${reminder.confirmation_token}`;
    const body = `${messages[Math.max(0, Math.min(2, Number(reminder.step) - 1))](name, task.title, due)} Confirmer : ${confirmUrl}`;
    let status = "SENT", providerMessageId: string | null = null, errorMessage: string | null = null;
    try {
      if (!phone) throw new Error("Numéro du collaborateur manquant");
      if (!task.tenant_owner_id || task.tenant_owner_id !== profile?.tenant_owner_id) throw new Error('Espace SMS du destinataire invalide');
      const result = await sendNimbaSms([phone], body, task.tenant_owner_id); providerMessageId = result.uid || result.id || null; sent++;
      await admin.from("notifications").insert({ profile_id: reminder.profile_id, tenant_owner_id: task.tenant_owner_id || profile?.tenant_owner_id || null, channel: "IN_APP", title: `Rappel ${reminder.step}/3 : ${task.title}`, body: `Échéance ${due}.`, entity_type: "task", entity_id: reminder.task_id });
    } catch (caught) { status = "FAILED"; errorMessage = caught instanceof Error ? caught.message : "Envoi SMS impossible"; failed++; }
    await admin.from("task_reminder_schedule").update({ status, sent_at: now.toISOString(), provider_message_id: providerMessageId, error: errorMessage }).eq("id", reminder.id);
    await admin.from("reminder_deliveries").upsert({ task_id: reminder.task_id, profile_id: reminder.profile_id, tenant_owner_id: task.tenant_owner_id || profile?.tenant_owner_id || null, channel: "SMS", scheduled_for: reminder.scheduled_for, status, provider_message_id: providerMessageId, error: errorMessage }, { onConflict: "task_id,channel,scheduled_for" });
  }
  return json(request, { assignments: { processed: assignments?.length || 0, sent:assignmentSent, failed:assignmentFailed, projects:{processed:projectAssignments?.length||0,sent:projectSent,failed:projectFailed} }, reminders: { processed: reminders?.length || 0, sent, failed, cancelled } });
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : 'Erreur de traitement des rappels' }, 500);
  }
});
