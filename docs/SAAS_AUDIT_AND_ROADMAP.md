# Transformation de SmartSell Management en SaaS multi-tenant

Date de l'audit : 26 septembre 2026

Base auditée : branche `main`, commit `5bca502`

Périmètre : clone isolé uniquement ; aucune connexion ni modification de la production.

## Résumé exécutif

L'application est un monolithe React/Vite connecté directement à Supabase. Elle couvre déjà un large périmètre métier (CRM, projets, tâches, finance, communication, RH, portail client, automatisation), mais son modèle de sécurité suppose une seule entreprise. La transformer en SaaS exige d'abord de rendre le tenant explicite dans la base de données et dans tous les chemins serveur.

Le risque bloquant est l'isolation : de nombreuses politiques RLS historiques accordent la lecture à tout utilisateur authentifié avec `using (true)`, tandis que `is_admin()` et les rôles sont globaux. Ajouter uniquement une colonne `organization_id` dans l'interface ne suffirait pas ; l'isolation doit être imposée par PostgreSQL et testée avec deux tenants antagonistes.

La phase 1 préparée dans cette branche installe un socle indépendant : organisations, espaces de travail, adhésions, contexte actif, helpers d'autorisation et RLS restrictive. Elle ne modifie pas encore les données métier, afin de ne pas introduire une fausse impression de sécurité ni une migration irréversible.

## Architecture actuelle

| Couche | État observé | Conséquence SaaS |
| --- | --- | --- |
| Frontend | React 19, Vite, grands composants fonctionnels, navigation locale | Ajouter un provider de tenant et découper les domaines avant d'élargir le produit |
| Accès aux données | Client Supabase direct dans `src/services/repository.ts`, cache global par nom de ressource | Le cache et les requêtes doivent être partitionnés par organisation/espace |
| Authentification | Supabase Auth + table `profiles` à rôle global | Les rôles doivent devenir des rôles d'adhésion à une organisation |
| Autorisation | RLS active mais plusieurs lectures globales et fonctions de rôle globales | Bloquant : risque de lecture inter-tenant |
| Backend privilégié | Edge Functions avec `service_role` après authentification applicative | Chaque fonction doit reconstruire et vérifier le contexte tenant avant toute requête admin |
| Données | Environ 50 tables, clés métier globales et numéros uniques globaux | Ajouter `organization_id`, puis `workspace_id` là où pertinent, et revoir toutes les contraintes uniques |
| Fichiers | Buckets privés mais politiques de lecture authentifiée globale | Préfixer les chemins par tenant et imposer le préfixe en RLS Storage |
| Facturation SaaS | Absente | Créer plans, abonnements, événements webhook et droits calculés côté serveur |
| Déploiement | GitHub Pages sur `main`, un seul environnement | Séparer preview/staging/production, migrations contrôlées et rollback documenté |
| Secrets | `.env.example` sans valeur réelle, mais aucun `.gitignore` | `.gitignore` ajouté ; effectuer aussi un scan d'historique et une rotation si nécessaire |

## Risques prioritaires

### P0 — isolation et privilèges

1. Les politiques `authenticated_read ... using (true)` permettent à un utilisateur authentifié de voir des données qui ne lui appartiennent pas dans un modèle multi-tenant.
2. `public.is_admin()` est global. Un administrateur d'une organisation ne doit jamais devenir administrateur des autres.
3. Les Edge Functions utilisent le client `service_role`, qui contourne la RLS. Elles vérifient des rôles globaux, mais pas une adhésion au tenant ciblé.
4. Les politiques Storage autorisent actuellement la lecture authentifiée globale. Les objets doivent suivre un chemin du type `organizations/<organization_id>/workspaces/<workspace_id>/...`.
5. `campaign-dispatch` considère la clé anonyme comme autorisation cron. Une clé publique ne doit jamais autoriser une opération privilégiée.

### P1 — intégrité des données

1. Plusieurs contraintes `unique` sont globales (`company_profile`, numéros de documents, codes équipement, paramètres), alors qu'elles devront être composites avec `organization_id`.
2. Les relations indirectes (lignes de facture, commentaires, membres de projet, destinataires) doivent hériter du tenant du parent, idéalement via clés étrangères composites ou triggers de cohérence.
3. Le cache frontend utilise des clés globales comme `clients` ou `projects`; un changement d'espace pourrait afficher des données en cache du tenant précédent.
4. Le mode démo et les données réelles cohabitent dans l'application. Leur séparation doit être structurelle dans le futur SaaS.

### P2 — exploitation

1. Il n'existe pas de migration horodatée standard ni de test d'intégration RLS exécuté par CI.
2. Le workflow déploie `main` directement sur GitHub Pages sans étape de staging ni validation de migration.
3. Les métriques, journaux et quotas sont centrés utilisateur, pas tenant.

## Modèle cible

Une organisation représente le compte facturé. Un espace de travail segmente les opérations d'une même organisation (agence, filiale, marque ou équipe). Un utilisateur peut appartenir à plusieurs organisations et à plusieurs espaces.

Rôles d'organisation proposés :

- `OWNER` : gouvernance, transfert de propriété, suppression et facturation ;
- `ADMIN` : membres, espaces et configuration ;
- `BILLING` : abonnement, factures SaaS et moyens de paiement ;
- `MEMBER` : accès opérationnel explicite aux espaces ;
- `VIEWER` : lecture seule explicite aux espaces.

Les rôles métier actuels (`COMMERCIAL`, `COMPTABLE`, etc.) deviennent, à terme, des rôles ou groupes propres à une organisation. Ils ne doivent plus être interprétés globalement.

Règle de sécurité cible : chaque ligne métier porte `organization_id`; les objets opérationnels portent aussi `workspace_id`. La RLS vérifie l'adhésion active et, le cas échéant, l'accès à l'espace. L'interface filtre pour l'ergonomie, mais PostgreSQL reste la frontière de sécurité.

## Feuille de route exploitable

### Phase 0 — garde-fous et environnement isolé (1 à 2 jours)

- créer des projets Supabase distincts pour développement et staging ;
- interdire toute clé de production dans les environnements locaux et CI ;
- ajouter secret scanning, dependency scanning et protection de branche ;
- retirer l'acceptation de la clé anonyme comme secret cron ;
- figer un inventaire des tables, fonctions, policies, buckets et jobs.

Critère de sortie : aucun test ou développement ne peut joindre la production et tous les secrets sont hors Git.

### Phase 1 — noyau de tenancy (préparée ici, 2 à 4 jours)

- créer `organizations`, `organization_memberships`, `workspaces`, `workspace_memberships` et `user_tenant_contexts` ;
- ajouter les helpers RLS tenant-aware et les RPC atomiques de création/sélection ;
- empêcher la suppression du dernier owner ;
- ajouter tests structurels et, dans l'environnement Supabase local, tests comportementaux à deux tenants.

Critère de sortie : deux organisations peuvent être créées et aucun membre ne peut lire ou sélectionner l'organisation/espace de l'autre.

### Phase 2 — rattachement des données et RLS métier (1 à 2 semaines)

Migrer par grappes, jamais toutes les tables d'un coup :

1. identité/configuration : départements, profil entreprise, paramètres, contrôles d'accès ;
2. CRM : clients, contacts, prospects, groupes et listes d'appel ;
3. production : projets, tâches, éditorial, shoots, documents ;
4. finance : devis, factures, paiements, dépenses, services, fournisseurs ;
5. automatisation/IA : briefings, scénarios, brouillons, autopilot ;
6. audit et communications.

Pour chaque grappe : ajouter des colonnes nullables, backfiller, vérifier les incohérences, créer index et clés composites, remplacer les policies, exécuter les tests antagonistes, puis seulement rendre les colonnes `not null`.

Critère de sortie : toutes les tables exposées ont une policy tenant-aware et aucun `using (true)` métier ne subsiste.

### Phase 3 — contexte tenant dans l'application et onboarding (1 semaine)

- créer un `TenantProvider` chargé avant les requêtes métier ;
- ajouter sélection organisation/espace et invalider tout cache lors d'un changement ;
- inclure le tenant dans toutes les clés de cache ;
- créer le parcours : compte → organisation → espace principal → invitation d'équipe → configuration société ;
- rendre les invitations à usage unique, expirables et auditables ;
- adapter les Edge Functions pour vérifier `organization_id` et `workspace_id` avant d'utiliser `service_role`.

Critère de sortie : un utilisateur multi-organisations change d'espace sans mélange de cache ni requête ambiguë.

### Phase 4 — abonnements, droits et quotas (1 à 2 semaines)

- abstraire le fournisseur de paiement derrière une interface ; choisir le fournisseur après validation des pays, devises et moyens de paiement visés ;
- créer `plans`, `plan_entitlements`, `subscriptions`, `billing_customers`, `billing_events` et `usage_counters` ;
- traiter les webhooks de façon signée, idempotente et rejouable ;
- calculer les droits côté serveur, jamais à partir d'un simple état frontend ;
- distinguer limites dures (refus) et souples (alerte/grâce) ;
- prévoir essai, retard de paiement, grâce, suspension et réactivation.

Quotas initiaux recommandés : membres actifs, espaces, stockage, clients, campagnes, SMS/e-mails, exécutions IA et exports.

Critère de sortie : une modification d'abonnement produit exactement les droits attendus même après relecture d'un webhook.

### Phase 5 — domaines personnalisés (3 à 5 jours)

- créer `organization_domains` avec état de vérification et challenge DNS ;
- conserver un domaine canonique par défaut basé sur le slug ;
- résoudre le tenant côté serveur depuis le host, sans faire confiance à un identifiant envoyé par le navigateur ;
- automatiser certificats TLS, renouvellement, redirection canonique et suppression sûre ;
- interdire tout domaine dupliqué et protéger contre le takeover après désactivation.

Critère de sortie : un domaine non vérifié ne route jamais vers des données et un domaine supprimé cesse immédiatement de résoudre le tenant.

### Phase 6 — migration des données existantes (3 à 7 jours + répétitions)

- créer une organisation legacy SmartSell et son espace principal en staging ;
- produire un mapping déterministe de chaque ligne vers organisation/espace ;
- migrer les utilisateurs internes comme membres et conserver les comptes portail comme accès client limités ;
- exécuter un dry-run avec comptages, sommes financières, orphelins et checksums ;
- répéter jusqu'à zéro divergence ;
- préparer rollback logique et fenêtre de gel courte ;
- ne lancer la migration production qu'après validation métier signée.

Critère de sortie : comptages et agrégats financiers avant/après correspondent, zéro ligne métier n'a un tenant nul et les tests inter-tenant sont verts.

### Phase 7 — déploiement progressif et exploitation (3 à 5 jours)

- chaîne `preview → staging → production` avec migrations forward-only ;
- feature flags pour le sélecteur tenant, l'onboarding et la facturation ;
- canary sur comptes internes avant ouverture ;
- sauvegarde vérifiée, point-in-time recovery, runbooks et alertes ;
- métriques par tenant sans exposer les données personnelles dans les logs ;
- SLO initiaux : disponibilité, erreurs d'auth, refus RLS, latence et échecs webhook.

Critère de sortie : déploiement reproductible, rollback applicatif testé et procédure d'incident documentée.

## Stratégie de test obligatoire

Les tests de sécurité doivent créer au moins deux organisations A et B, avec un owner et un membre chacune. Pour chaque table migrée, vérifier : lecture A autorisée, écriture A autorisée selon rôle, lecture B refusée, écriture B refusée, absence de tenant refusée, relation parent/enfant croisée refusée, accès `service_role` protégé par validation applicative.

Ajouter également : tests d'idempotence webhook, concurrence sur quotas, changement de contexte, cache invalidé, invitation expirée, dernier owner protégé, domaine dupliqué refusé et restauration d'une sauvegarde.

## Décisions à prendre avant la facturation

- pays de facturation et d'encaissement de l'éditeur ;
- devises réellement supportées ;
- moyens de paiement requis (carte, mobile money, virement) ;
- modèle tarifaire (par membre, par espace, par volume ou hybride) ;
- politique de taxes, factures et conservation ;
- limites exactes de chaque plan et comportement en dépassement.

Ces décisions conditionnent le fournisseur de paiement et ne doivent pas être codées en dur avant validation commerciale et juridique.
