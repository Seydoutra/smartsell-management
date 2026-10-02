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

## E-mails avec Resend

Deux configurations distinctes sont nécessaires : les Edge Functions envoient les messages de bienvenue, les messages de Communication et les campagnes ; **Supabase Auth** envoie les confirmations d'inscription et les liens de récupération.

1. Dans Resend, ajoutez un domaine que vous contrôlez et vérifiez les enregistrements DNS demandés (SPF/DKIM). Une adresse Gmail personnelle ne peut pas servir d'expéditeur pour un domaine vérifié qui ne vous appartient pas.
2. Créez une clé API Resend avec le droit d'envoi. Ne la mettez jamais dans une variable `VITE_`, dans GitHub Pages, ni dans le dépôt.
3. Dans **Supabase → Edge Functions → Secrets**, définissez `RESEND_API_KEY` avec cette clé et `EMAIL_FROM` avec une adresse du domaine vérifié, par exemple `Smartsell Management <no-reply@votre-domaine.fr>`.
4. Pour les confirmations et les mots de passe oubliés, activez l'intégration **Resend** dans Supabase, ou configurez **Authentication → SMTP** avec l'hôte `smtp.resend.com`, le port `465`, l'utilisateur `resend` et la clé API comme mot de passe. Utilisez un expéditeur du domaine vérifié. Cette étape est indépendante des secrets Edge Functions.
5. Gardez `COMMUNICATION_TEST_MODE=true` pendant les essais et définissez `COMMUNICATION_TEST_EMAIL` avec une boîte que vous contrôlez. Testez d'abord l'inscription, puis « mot de passe oublié », un e-mail de bienvenue et un e-mail dans Communication. Vérifiez la livraison dans le journal Resend.

Ne désactivez le mode test qu'après avoir confirmé la livraison et le comportement des quotas. Pour les campagnes, recueillez le consentement des destinataires et offrez une désinscription.

Avant une campagne réelle, définissez `COMMUNICATION_TEST_MODE=false` dans Supabase. L’application demande toujours une confirmation indiquant le canal et le nombre de destinataires.

## Appels

Les appels nécessitent un fournisseur Voice (par exemple Twilio Voice, Vonage ou une API d’opérateur local). Ajoutez `VOICE_PROVIDER`, `VOICE_API_URL`, `VOICE_API_KEY` et `VOICE_CALLER_ID` dans les secrets Supabase. Définissez ensuite, dans **Administration → Droits et limites**, qui peut appeler et combien d’appels par jour. Le système refuse l’appel si le droit manque ou si le quota est atteint, et conserve un journal d’audit. Vérifiez les règles locales de consentement et d’enregistrement avant d’activer toute fonction d’enregistrement.
