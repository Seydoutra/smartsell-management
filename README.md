# Smartsell Management

Centre de gestion interne de Smartsell. Le projet fonctionne immédiatement en mode démonstration et peut ensuite être connecté à Supabase.

## Démarrage simple

1. Installez Node.js 22.
2. Ouvrez un terminal dans ce dossier.
3. Lancez `pnpm install` puis `pnpm dev`.
4. Ouvrez l’adresse affichée.

Compte de démonstration :

- Email : `superadmin@smartsell.local`
- Mot de passe : `Smartsell@2026!`

Ces identifiants ne sont utilisés qu’en mode démo. Ils ne doivent jamais servir en production.

## Vérifications

- `pnpm build` construit la version de production.
- `pnpm test` vérifie les calculs et permissions critiques.

## Mise en production

Suivez [GUIDE_INSTALLATION_SIMPLE.md](./GUIDE_INSTALLATION_SIMPLE.md), puis [DEPLOY_NETLIFY.md](./DEPLOY_NETLIFY.md). La configuration SMS/email est détaillée dans [GUIDE_SMS_EMAIL.md](./GUIDE_SMS_EMAIL.md).

Le suivi des sessions et actions est documenté dans [POLITIQUE_SUIVI_ACTIVITE.md](./POLITIQUE_SUIVI_ACTIVITE.md). Lisez cette politique avec l’équipe avant l’activation en production.
