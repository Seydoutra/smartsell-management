# Commandes assistées et rapports clients — 9 octobre 2026

## Commandes sans clé IA

Le bouton microphone « Dicter une action » est dans l’en-tête de l’application des collaborateurs. Sur un petit écran, son icône conserve le même libellé accessible. Il ouvre un dialogue avec dictée volontaire, instruction modifiable, exemples, aperçu et confirmation.

Cette première version est un interpréteur local à règles, pas un agent OpenAI. Elle accepte une création à la fois : client, tâche, projet, facture ou devis. Elle utilise les opérations Supabase déjà employées par les formulaires, avec les mêmes contrôles serveur. Aucune suppression, publication, campagne ou transmission au client n’est prise en charge. L’attribution d’une mission conserve ses notifications habituelles.

Exemples :

- `Créer un client Alpha, email contact@exemple.com, téléphone +224620000000`
- `Créer une tâche Préparer les visuels, projet Campagne été, attribuer à Fatou, échéance 2026-12-10`
- `Créer un projet Campagne été, client Alpha, description Communication de décembre`
- `Créer une facture, client Alpha, service Community management, montant 700000 GNF, échéance 2026-12-10, sans TVA`
- `Créer un devis, client Alpha, service Création de site, montant 2000000 GNF, date 2026-12-10`

Séparer les champs par des virgules ; « virgule » prononcée est aussi accepté. Montants en chiffres, dates au format AAAA-MM-JJ. Les noms sont associés uniquement lorsque la correspondance est exacte et unique ; autrement il faut sélectionner l’élément dans l’aperçu. Les champs non pris en charge sont signalés, jamais exécutés comme du code.

La Web Speech API du navigateur n’est pas universellement disponible. Le microphone n’est jamais ouvert au démarrage. Selon le navigateur, la reconnaissance utilise son fournisseur distant et nécessite Internet. Aucun audio n’est stocké par Smartsell. La saisie clavier fonctionne dans tous les cas. Une version avec OpenAI pourra ultérieurement comprendre des formulations libres, avec appels de fonctions côté serveur, clés non exposées, autorisations, confirmation et idempotence serveur.

Une création ne part qu’après confirmation. L’enregistrement est bloqué hors réseau et à l’expiration de l’essai. La session et le tenant sont vérifiés avant chaque écriture. Les actions exécutées sont transmises au journal existant. En cas de réponse réseau incertaine ou d’attribution échouée après insertion, la liste doit être vérifiée avant de réessayer : cette version n’effectue aucune relance automatique des créations.

## Clients : suivi contractuel récurrent

Depuis une fiche client, fixer une fois les engagements mensuels en publications, vidéos et reels et renseigner la situation initiale des pages. Une révision prend effet à partir du mois choisi ; une exception mensuelle ne modifie pas les autres mois. Les relevés sociaux sont manuels et datés tant qu’aucun fournisseur de statistiques n’est connecté. Une valeur inconnue reste « Non renseigné ».

Les livrables comptent seulement les contenus marqués publiés dans le mois, une fois par contenu, sans multiplier par le nombre de réseaux. Les reels ne sont pas recomptés parmi les vidéos ou publications. L’interprétation est calculée à partir des données réelles, pas présentée comme une prédiction IA.

La migration additive `supabase/v62_client_social_reporting.sql` crée quatre tables sous RLS, leurs contrôles de périmètre et les générateurs de rapports. Le job `smartsell-client-monthly-reports` exécute la génération à 00 h 05 le premier jour du mois. Les rapports définitifs des mois terminés sont figés et idempotents ; seuls les comptes portail actifs du client et du tenant concernés reçoivent une notification interne. Aucun e-mail/SMS de rapport n’est prétendu envoyé. Le portail possède un onglet Performance et les rapports peuvent être téléchargés en PDF.

## Vérifications

Tests automatisés de l’interpréteur, du dialogue, des confirmations, des droits, des sessions, du périmètre des références, du CRM, du répertoire et du suivi contractuel. Le test `tests/client-social-reporting.database.mjs` valide la migration dans PostgreSQL local (PGlite, dépendance temporaire externe).

La migration a aussi été exécutée en transaction annulée sur le schéma de production, puis appliquée ; les comptes de lignes métier sont inchangés. Génération et idempotence des rapports et séparation RLS ont été vérifiées sur des données temporaires dans une autre transaction annulée. Aucun contenu QA n’est conservé en production. Ce test de rôles SQL n’est pas un test de connexion OAuth/JWT fournisseur de bout en bout.

La réception réelle de SMS, la dictée sur chaque modèle de téléphone et l’envoi de rapports par un fournisseur e-mail ne sont pas couverts par ces tests automatisés.
