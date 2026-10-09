# Demandes matériel et Achats & dépenses

## Mise en service

Appliquer `supabase/v63_equipment_requests.sql`, puis `supabase/v64_company_purchases_expenses.sql` et `supabase/v65_supplier_tenant_isolation.sql` avant l’utilisation du registre. La dernière migration ajoute l’isolation manquante aux fournisseurs historiques et supprime les anciennes règles de lecture globale. Elle refuse tout rattachement ambigu à plusieurs espaces. Les migrations sont additives et ne suppriment pas les anciennes données. Le responsable matériel est configurable par le propriétaire de chaque espace ; Adama Bangoura est configurée uniquement dans l’espace Smartsell existant.

## Matériel

Un collaborateur actif peut demander un bon depuis Finance & achats → Demandes matériel. Le propriétaire et le responsable reçoivent une notification dans l’application. Une validation suffit ; elle réserve le matériel sans enregistrer sa remise. Le propriétaire peut révoquer cette approbation avant la remise.

La remise effective exige un constat et une à cinq photos par équipement. Les retours peuvent être partiels et exigent également constat, photos et état. Un équipement dégradé passe en maintenance ; hors service, il devient indisponible. Les bons conservent les constats de départ et de retour. Les anciennes sorties peuvent être retournées par le responsable via le parcours historique.

Photos JPEG, PNG ou WebP, maximum 5 Mio chacune : stockage privé, accès contrôlé par espace et demande, liens de lecture temporaires. Les droits sont vérifiés côté serveur, pas uniquement dans les boutons. Les comptes clients n’accèdent pas à ce module. Les notifications de ce parcours sont internes ; aucun SMS ou email n’est annoncé comme envoyé.

## Achats & dépenses

Trois registres : dépenses et charges, achats fournisseurs, demandes d’achat. Une demande approuvée peut être convertie en dépense d’achat au montant réellement engagé. La conversion est idempotente : elle ne crée pas de doublon. Une approbation ne constitue pas une preuve de paiement.

Les indicateurs de ce module séparent GNF, EUR et USD, excluent les charges refusées et ne comptent pas les budgets non convertis comme dépenses. La consultation, création, modification et suppression respectent les droits comptables ; une dépense liée à une demande d’achat ne peut pas être supprimée directement.

## Vérification

Les tests UI et services sont exécutés avec Vitest. `tests/equipment-requests.database.mjs` vérifie les réservations, retours partiels, photos, isolation des espaces, rôles, notifications et conversion idempotente dans PostgreSQL local via PGlite. Les captures locales de validation utilisent uniquement des données de démonstration.
