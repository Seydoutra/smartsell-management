# Configurer les SMS et emails

Les messages réels passent uniquement par les fonctions serveur. Les clés ne sont jamais placées dans le navigateur.

## SMS

1. Choisissez un fournisseur SMS compatible avec la Guinée.
2. Créez un compte chez ce fournisseur.
3. Copiez l’adresse API, la clé, le secret et le Sender ID fournis.
4. Dans Supabase, ouvrez **Edge Functions → Secrets**.
5. Ajoutez `NIMBA_SERVICE_ID`, `NIMBA_SECRET_TOKEN` et `NIMBA_SENDER_NAME`.
6. Gardez `COMMUNICATION_TEST_MODE=true` pendant les essais et renseignez `COMMUNICATION_TEST_PHONE`.
7. Dans Smartsell, ouvrez **Communication** puis faites un premier essai vers le numéro de test.

## Email

1. Récupérez les paramètres SMTP ou la clé API de votre fournisseur email.
2. Ajoutez dans les secrets Supabase `EMAIL_PROVIDER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` et `EMAIL_FROM`.
3. Gardez le mode test actif et renseignez `COMMUNICATION_TEST_EMAIL`.
4. Testez un email depuis le module Communication.

Avant une campagne réelle, définissez `COMMUNICATION_TEST_MODE=false` dans Supabase. L’application demande toujours une confirmation indiquant le canal et le nombre de destinataires.

## Appels

Les appels nécessitent un fournisseur Voice (par exemple Twilio Voice, Vonage ou une API d’opérateur local). Ajoutez `VOICE_PROVIDER`, `VOICE_API_URL`, `VOICE_API_KEY` et `VOICE_CALLER_ID` dans les secrets Supabase. Définissez ensuite, dans **Administration → Droits et limites**, qui peut appeler et combien d’appels par jour. Le système refuse l’appel si le droit manque ou si le quota est atteint, et conserve un journal d’audit. Vérifiez les règles locales de consentement et d’enregistrement avant d’activer toute fonction d’enregistrement.
