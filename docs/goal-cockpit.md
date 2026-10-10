# Objectifs & performance — cockpit

Migration additive v74_goal_cockpit.sql, sans modification des objectifs existants.
Tous conservent la saisie manuelle par défaut. Le manager choisit explicitement une source.

- Facturation : factures GNF du mois, hors brouillons/annulations.
- Encaissements : paiements GNF réellement enregistrés dans le mois, même pour une facture plus ancienne.
- Tâches : statut terminé ET date de fin renseignée dans le mois.

Chaque source porte sur toute l'entreprise, pas sur une personne. Plusieurs objectifs
peuvent observer le même indicateur : ils ne doivent pas être additionnés comme des ventes distinctes.
Le suivi déclaré par étape reste opérationnel et n'est jamais additionné au résultat automatique.
Actualisation à l'ouverture, au bouton Actualiser et après les actions du module, sans polling permanent.
La clôture capture le résultat dans la transaction du bilan. Il ne change plus avec les sources.

Les fonctions REST authentifiées déduisent l'acteur de auth.uid(), contrôlent le rôle,
les droits financiers/tâches et le tenant. Les collaborateurs n'ont aucun agrégat global.
Les snapshots de clôture sont exclus des réponses du service legacy destiné aux collaborateurs.
Le changement de source exige un compte actif non expiré, une révision correcte et un objectif non clôturé.

Le simulateur est un calcul déterministe, sans API IA payante. Il demande les hypothèses
du manager. La moyenne des factures des trois mois complets précédents est un repère,
pas un prix moyen par service. Le stock CRM gagné/perdu est historique, pas une cohorte mensuelle.
Le radar compare le résultat à une trajectoire linéaire du mois ; il ne modélise pas la saisonnalité.
Les suggestions n'exécutent pas d'actions et ne changent pas les attributions.
