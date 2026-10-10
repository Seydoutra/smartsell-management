# Demandes matériel et Achats & dépenses

## Mise en service

Appliquer `supabase/v63_equipment_requests.sql`, puis `supabase/v64_company_purchases_expenses.sql` et `supabase/v65_supplier_tenant_isolation.sql` avant l’utilisation du registre. La dernière migration ajoute l’isolation manquante aux fournisseurs historiques et supprime les anciennes règles de lecture globale. Elle refuse tout rattachement ambigu à plusieurs espaces. Les migrations sont additives et ne suppriment pas les anciennes données. Le responsable matériel est configurable par le propriétaire de chaque espace ; Adama Bangoura est configurée uniquement dans l’espace Smartsell existant.

## Matériel

Un collaborateur actif peut demander un bon depuis Finance & achats → Demandes matériel. Le propriétaire et le responsable reçoivent une notification dans l’application. Une validation suffit ; elle réserve le matériel sans enregistrer sa remise. Le propriétaire peut révoquer cette approbation avant la remise.

La remise effective exige un constat et une à cinq photos par équipement. Les retours peuvent être partiels et exigent également constat, photos et état. Un équipement dégradé passe en maintenance ; hors service, il devient indisponible. Les bons conservent les constats de départ et de retour. Les anciennes sorties peuvent être retournées par le responsable via le parcours historique.

Photos JPEG, PNG ou WebP, maximum 5 Mio chacune : stockage privé, accès contrôlé par espace et demande, liens de lecture temporaires. Les droits sont vérifiés côté serveur, pas uniquement dans les boutons. Les comptes clients n’accèdent pas à ce module.

Les décisions d’approbation et de refus créent un SMS dans une file durable. Le worker protégé `equipment-decision-notify` la traite chaque minute avec les identifiants Nimba de l’entreprise. Le bon affiche l’état du SMS. « Accepté par Nimba » ne signifie pas encore reçu sur le téléphone. Téléphone absent, configuration inactive et refus fournisseur sont visibles et signalés au propriétaire. Aucun historique n’est envoyé. Une erreur de confirmation en base après réponse fournisseur ne déclenche pas de renvoi automatique susceptible de facturer un doublon.

## Quantités et références (v71 à v73)

Appliquer v71 (collision SQL entre variable et colonne `notes`), puis v72 (stock et SMS). Déployer `equipment-decision-notify` avec ses dépendances, puis v73 pour réutiliser l’appel cron protégé existant sans exposer ses secrets. Le frontend doit être publié après v72.

Les fiches existantes reçoivent une référence automatique `EQ-XXXXXXXX`, sans écraser le code interne ou les historiques. Leur quantité est initialisée à une unité, à corriger après comptage réel. Les références sont générées côté serveur et ne sont pas modifiables. Une fiche peut représenter un lot ; pour suivre individuellement des numéros de série, créer une fiche par unité.

Le stock total reste constant lors d’une sortie : les quantités réservées, sorties et indisponibles sont séparées. Une validation réserve les quantités, la remise avec photos les marque en mission, et un retour conforme les rend disponibles. Un lot retourné dégradé reste indisponible. Les retours peuvent porter sur certaines lignes du bon ; le retour partiel d’une même ligne quantitative n’est pas proposé. Les demandes et validations contrôlent les quantités côté serveur sous verrou, dans le bon espace. Les compteurs calculés ne sont pas modifiables par REST.

La validation déclenche le téléchargement d’un bon PDF et le bon reste téléchargeable depuis son détail par les personnes autorisées. Avant remise, il porte la mention d’autorisation uniquement. Après remise, il reprend les constats. Les photos restent dans le dossier privé, sans URL temporaire imprimée. Une panne de génération PDF ne doit jamais rejouer la décision.

## Achats & dépenses

Trois registres : dépenses et charges, achats fournisseurs, demandes d’achat. Une demande approuvée peut être convertie en dépense d’achat au montant réellement engagé. La conversion est idempotente : elle ne crée pas de doublon. Une approbation ne constitue pas une preuve de paiement.

Les indicateurs de ce module séparent GNF, EUR et USD, excluent les charges refusées et ne comptent pas les budgets non convertis comme dépenses. La consultation, création, modification et suppression respectent les droits comptables ; une dépense liée à une demande d’achat ne peut pas être supprimée directement.

## Vérification

Les tests UI et services sont exécutés avec Vitest. `tests/equipment-requests.database.mjs` vérifie les réservations, retours partiels, photos, isolation des espaces, rôles, notifications et conversion idempotente dans PostgreSQL local via PGlite. Les captures locales de validation utilisent uniquement des données de démonstration.
