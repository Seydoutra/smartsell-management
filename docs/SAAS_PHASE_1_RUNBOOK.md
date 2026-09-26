# Runbook — phase 1 du socle SaaS

## Contenu livré

- migration `supabase/v18_saas_tenancy_foundation.sql` ;
- organisations et espaces de travail ;
- adhésions et rôles au niveau organisation/espace ;
- contexte actif utilisateur ;
- fonctions d'autorisation utilisables par les futures policies ;
- RPC atomiques de création d'organisation et de changement de contexte ;
- protection contre la suppression du dernier owner ;
- tests statiques de garde-fous dans `src/lib/saasMigration.test.ts`.

## Ce que cette phase ne fait volontairement pas

- elle n'ajoute pas `organization_id` aux tables métier existantes ;
- elle ne remplace pas encore les policies historiques ;
- elle ne migre aucune donnée ;
- elle ne crée ni abonnement, ni quota, ni domaine personnalisé ;
- elle ne doit pas être appliquée directement en production.

## Validation en environnement local ou staging

1. Créer un projet Supabase jetable sans donnée de production.
2. Appliquer les migrations historiques dans leur ordre documenté, puis `v18_saas_tenancy_foundation.sql`.
3. Créer deux utilisateurs Supabase de test.
4. Pour chacun, appeler `create_organization_with_workspace` avec un slug distinct.
5. Vérifier qu'un utilisateur ne peut ni lire l'organisation de l'autre, ni sélectionner son espace via `set_tenant_context`.
6. Ajouter un second owner, vérifier le transfert de propriété, puis vérifier que le dernier owner ne peut pas être retiré.
7. Exécuter `pnpm test` et `pnpm build`.

## Conditions avant fusion

- un test SQL comportemental à deux tenants tourne dans CI avec Supabase local ;
- le fichier `campaign-dispatch` n'accepte plus la clé anonyme comme autorisation cron ;
- un plan de backfill de l'organisation legacy est validé sur une copie anonymisée ;
- les contraintes uniques à convertir en contraintes composites sont inventoriées ;
- aucune variable de production n'est disponible dans CI de branche.

## Retour arrière

Tant qu'aucune table métier ne référence ce socle, le rollback consiste à supprimer, dans cet ordre, les fonctions/policies, `user_tenant_contexts`, `workspace_memberships`, `workspaces`, `organization_memberships`, `organizations`, puis les deux enums. En staging partagé, préférer une migration de correction plutôt qu'une suppression manuelle.
