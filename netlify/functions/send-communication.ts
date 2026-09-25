export default async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const body = await request.json() as { channel:'SMS'|'EMAIL'; recipients:string[]; message:string }
  const testMode = process.env.COMMUNICATION_TEST_MODE !== 'false'
  const limit = Number(process.env[body.channel==='SMS'?'MAX_SMS_PER_CAMPAIGN':'MAX_EMAILS_PER_CAMPAIGN'] || 250)
  if (body.recipients.length > limit) return Response.json({ error:`La limite de ${limit} destinataires est dépassée.` }, { status:400 })
  const recipients = testMode ? [body.channel==='SMS' ? process.env.COMMUNICATION_TEST_PHONE : process.env.COMMUNICATION_TEST_EMAIL].filter(Boolean) : body.recipients
  if (!recipients.length) return Response.json({ error:'Aucun destinataire de test configuré' }, { status:400 })
  // Les adaptateurs fournisseurs sont volontairement exécutés ici, jamais dans le navigateur.
  return Response.json({ status:'QUEUED', testMode, recipientCount:recipients.length })
}
