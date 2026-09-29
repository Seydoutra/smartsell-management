# Paramètres SMS — déploiement accompagné

État au 29 septembre 2026 : migration v37 appliquée (RLS vérifiée), sept fonctions déployées et actives sur le projet `insqsizvcbvgfysqlxte`. Frontend à publier via le workflow GitHub Pages. Les sources en production ont été téléchargées et comparées avant publication ; le traitement d'erreur global des rappels a été conservé.

1. Exécuter `supabase/v37_tenant_sms.sql`. Vault doit être installé. Les RPC contenant les secrets sont réservées au service role.
2. Déployer ensemble `tenant-sms-settings`, `send-communication`, `campaign-dispatch`, `task-reminders`, `team-digest`, `create-team-member` et `create-client-access`, dépendances partagées incluses.
3. Publier le frontend. Le menu Communication contient « Paramètres SMS ». Le serveur contrôle `is_platform_owner` : un administrateur d'entreprise ne peut ni gérer une autre entreprise ni lire les clés.
4. Vérifier deux espaces indépendants : lecture isolée, demande d'accompagnement, clés absentes des réponses, activation puis pause, bon expéditeur pour un test réel explicitement demandé.

Les OTP conservent les identifiants de plateforme. Les envois métier reçoivent un tenant explicite. Une configuration absente/inactive ne doit pas utiliser les crédits de plateforme (exception de compatibilité : propre espace du propriétaire, sans configuration enregistrée).

Les fonctions en production ont déjà été modifiées via l'éditeur Supabase. Comparer leur source au dépôt avant le déploiement groupé afin de conserver les correctifs non synchronisés. Le nom d'expéditeur doit être approuvé dans Nimba ; cette interface ne crée pas d'organisation Nimba automatiquement et ne certifie pas elle-même cette approbation.

Validation locale : TypeScript, build Vite et 25 tests Vitest réussis, dont les cas clés propres au tenant, tenant sans SMS, pause, OTP plateforme. Aucun test fournisseur réel envoyé. La livraison réelle et les parcours de deux entreprises configurées restent à vérifier lors de leur activation accompagnée.
