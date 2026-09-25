# Passage de la démonstration à la production

## 1. Sauvegarder avant toute suppression

Dans Supabase, exportez les clients déjà ajoutés si vous souhaitez les conserver. La remise à zéro des données métier est irréversible.

## 2. Mettre la base à niveau

Dans **Supabase → SQL Editor** :

1. Ouvrez `supabase/production_upgrade.sql`.
2. Copiez tout son contenu dans une nouvelle requête.
3. Cliquez sur **Run**.

Cette migration ajoute la création atomique des factures, la numérotation et le rapprochement des paiements.

## 3. Remise à zéro facultative

Le fichier `supabase/reset_business_data.sql` supprime uniquement les données métier : clients, projets, factures, paiements, tâches, prospects et autres opérations. Il conserve les comptes de connexion et les profils utilisateurs.

Ne l’exécutez qu’après sauvegarde et confirmation explicite. Pour supprimer également des utilisateurs, utilisez **Authentication → Users** dans Supabase, en conservant impérativement le compte Super Admin de Traoré Seydou.

## 4. Activer la production GitHub Pages + Supabase

Dans **GitHub → Settings → Secrets and variables → Actions** :

```text
Variable : VITE_SUPABASE_URL
Secret : VITE_SUPABASE_ANON_KEY
```

Les clés privées et fournisseurs restent exclusivement dans **Supabase → Edge Functions → Secrets**. Chaque mise à jour de la branche `main` déclenche le déploiement GitHub Pages.

## 5. Tester dans cet ordre

1. Connexion avec le compte Supabase de Traoré Seydou.
2. Création d’un client.
3. Création d’un projet rattaché au client.
4. Création d’une tâche rattachée au projet.
5. Création d’une facture rattachée au client et au projet.
6. Ouverture puis impression de la facture en PDF.
7. Enregistrement d’un paiement.
8. Vérification du statut payé ou partiellement payé.

Si une étape échoue, conservez le message affiché et ne modifiez pas les clés au hasard.
