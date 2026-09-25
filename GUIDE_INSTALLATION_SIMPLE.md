# Installation simple

Vous n’avez pas besoin d’écrire du code.

## 1. Créer Supabase

1. Allez sur supabase.com et créez un compte.
2. Cliquez sur **New project**.
3. Choisissez un nom et un mot de passe de base de données solide.
4. Attendez que le projet soit prêt.

## 2. Créer la base

1. Dans Supabase, ouvrez **SQL Editor**.
2. Cliquez sur **New query**.
3. Ouvrez le fichier `supabase/setup.sql` de ce projet et copiez tout son contenu.
4. Collez-le dans Supabase puis cliquez sur **Run**.

Le script crée les tables, les protections RLS, les index et les espaces de fichiers.

## 3. Récupérer les deux informations publiques

1. Ouvrez **Project Settings → API**.
2. Copiez **Project URL** dans `VITE_SUPABASE_URL`.
3. Copiez **anon public key** dans `VITE_SUPABASE_ANON_KEY`.
4. Mettez `VITE_DEMO_MODE=false`.

Ne copiez jamais la clé `service_role` dans une variable commençant par `VITE_`.

## 4. Créer le premier Super Admin

1. Ouvrez **Authentication → Users → Add user**.
2. Créez votre utilisateur avec un mot de passe provisoire.
3. Copiez son identifiant utilisateur.
4. Dans SQL Editor, exécutez :

```sql
update public.profiles set role = 'SUPER_ADMIN', must_change_password = true where id = 'IDENTIFIANT_ICI';
```

## 5. Déployer

Suivez le fichier `DEPLOY_NETLIFY.md`. Après connexion, ouvrez **Paramètres → Entreprise** dans l’application pour vérifier le nom, l’adresse, l’email et le téléphone.

## Sauvegardes

Dans Supabase, ouvrez **Database → Backups**. Activez les sauvegardes adaptées à votre offre. Exportez aussi régulièrement les listes importantes en CSV depuis Smartsell Management.
