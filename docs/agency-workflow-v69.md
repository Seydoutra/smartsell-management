# Parcours agence — première livraison

## Couverture

- Factures/devis : brouillon par compte, restauration explicite, sauvegarde avant création et identifiant de tentative conservé. Une relance identique récupère le document existant ; une relance modifiée est refusée pour éviter un second document involontaire.
- Fiche client : dossier de marque révisable et démarrage confirmé d'un projet depuis un devis. Les prestations, le client, le budget et la devise sont repris. Ce démarrage ne constitue pas une signature électronique ni une acceptation automatique du devis.
- Smart Social et portail client : annotations générales, repères sur les images, instants sur les vidéos et comparaison des versions. Une version envoyée est immuable. Modifier son contenu source archive l'ancienne validation et requiert une nouvelle validation.

## Sécurité

Les lectures utilisent les politiques RLS. Les mutations utilisent des fonctions serveur avec contrôle du tenant, du client et des droits d'action. Les brouillons sont privés à leur auteur. Le client consulte son dossier de marque mais ne l'édite pas. Les annotations sur les versions clôturées sont refusées côté serveur.

## Vérifications effectuées

- Suite automatisée : 187 tests réussis.
- Compilation TypeScript et build Vite réussis.
- Sur la base réelle, migration et fixtures exécutées dans une transaction ensuite annulée : révision concurrente/null refusée, client absent refusé, brouillon d'un autre auteur refusé, création de devis/projet/validation idempotente, tentative modifiée refusée, immutabilité et archivage après modification éditoriale.
- Écrans de test locaux à 390 px en thèmes clair/sombre : pas de débordement horizontal. Ces fixtures n'envoient aucune communication réelle.

## Limites explicites

La sauvegarde des brouillons nécessite Internet et une session valide ; ce n'est pas un mode hors ligne. Cette première livraison ne couvre pas encore la reprise des formulaires clients/tâches, une file globale d'incidents, ni l'automatisation de toutes les étapes contractuelles ou de facturation du parcours client. Les dossiers de marque utilisent un lien HTTPS pour le logo.
