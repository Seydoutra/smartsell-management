# Centre d’automatisations commerciales

Dans Clients → Automatisations. Migration additive v75, aucune suppression.

- Futur prospect gagné : proposition de conversion en client. Le manager peut choisir un client existant ; un email déjà utilisé bloque une création automatique de doublon.
- Accord de devis : confirmation explicite avec note de preuve, puis proposition de démarrage. L’acceptation n’est pas une signature électronique.
- Validation : reprend le projet du devis ou le crée, puis les tâches et la facture seulement si leurs options sont cochées. Une tâche par ligne de devis, titre, responsable et échéance modifiables. Ce premier circuit ne comprend pas encore de bibliothèque de modèles par service.
- Projet rattaché après facture : lien synchronisé du devis vers sa facture.
- Paiement : circuit de facturation existant conservé, statut automatique et journal du centre. Les objectifs automatiques lisent ces paiements à l’actualisation ; aucun objectif manuel n’est modifié.
- Les affectations utilisent les notifications/SMS existants ; le centre ne lance aucune campagne ni paiement.

Les dossiers antérieurs sont analysés sur demande, sans exécuter les créations.
Une proposition unique par événement source. Exécution sous verrou, créations dans une sous-transaction : un échec annule toutes les créations et reste consultable dans l’historique. Reprise possible sans doublons. Une exécution réussie ne peut pas être relancée avec d’autres paramètres.
Tenancy et autorisations vérifiées au serveur pour chaque action, y compris une reprise. Les dossiers financiers ne sont pas renvoyés sans invoices.view. Les paiements ne sont visibles dans le journal qu’avec accounting.view également.

Périmètre livré : colonne vertébrale commerciale. Les circuits validation éditoriale → reporting et tâche → demande matériel restent leurs modules existants, pas de nouvelles automatisations silencieuses.
