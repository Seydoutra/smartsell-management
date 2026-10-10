# Parcours agence — suite v70

- La fiche client charge ses devis et factures par identifiant client, sans charger les documents de tous les clients. Le module reste réservé au droit de consultation de la facturation.
- Les montants encaissés et les soldes sont affichés séparément par facture et devise. Aucun chiffre global mélangeant des devises n'est calculé. Un échec de chargement n'est pas présenté comme un espace vide.
- Depuis la fiche client, un bouton ouvre directement ses devis/factures/paiements.
- Convertir à nouveau le même devis récupère sa facture existante. La création est sérialisée par un verrou sur le devis.
- Lorsqu'un projet est démarré depuis un devis déjà facturé, les factures de ce devis encore sans projet sont rattachées automatiquement. Les projets existants ne sont pas remplacés.
- Dans le formulaire d'encaissement courant, l'identifiant de tentative est conservé en cas d'erreur. Une relance identique récupère le paiement ; une tentative modifiée est refusée. Après succès confirmé, un nouvel encaissement reçoit un nouvel identifiant.
- Le dossier de marque est réinitialisé lorsque le client change et les réponses tardives sont ignorées.

## Vérifications

Suite complète : 193 tests. TypeScript et build vérifiés. Migration testée dans une transaction annulée sur la base réelle : conversion répétée sans doublon, rattachement facture/projet tardif, paiement répété sans doublon, refus d'une tentative modifiée et d'une facture inexistante, puis second paiement distinct.

## Limites

Les opérations ne sont jamais envoyées automatiquement hors ligne. Après fermeture ou rechargement de l'application, l'identifiant en mémoire du formulaire d'encaissement est perdu : consulter l'historique avant de recréer un paiement incertain. La reprise persistante de tous les formulaires et la file globale d'incidents restent à réaliser.
