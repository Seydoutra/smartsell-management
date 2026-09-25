export type DemoRecord = { id: string; title: string; subtitle: string; status: string; meta: string; amount?: string }

export const demoData: Record<string, DemoRecord[]> = {
  Prospects: [
    { id:'p1', title:'Atelier Horizon', subtitle:'Mariam Diallo · Événementiel', status:'Négociation', meta:'Relance demain', amount:'24 M GNF' },
    { id:'p2', title:'Kipex Distribution', subtitle:'Ibrahima Camara · Commerce', status:'Proposition envoyée', meta:'Ajouté il y a 2 jours', amount:'18,5 M GNF' },
    { id:'p3', title:'Nimba Hospitality', subtitle:'Fatou Bah · Hôtellerie', status:'Rendez-vous', meta:'Rendez-vous lundi', amount:'32 M GNF' },
    { id:'p4', title:'Teranga Foods', subtitle:'Abdoulaye Sylla · Agroalimentaire', status:'À contacter', meta:'Source : recommandation', amount:'12 M GNF' },
    { id:'p5', title:'Kaloum Services', subtitle:'Aïssatou Barry · Services', status:'Nouveau', meta:'Ajouté aujourd’hui', amount:'8 M GNF' },
  ],
  Clients: [
    { id:'c1', title:'Maison Kanu', subtitle:'Mode & lifestyle', status:'Actif', meta:'4 projets · Responsable A. Sylla' },
    { id:'c2', title:'Nova Conseil', subtitle:'Conseil aux entreprises', status:'Actif', meta:'2 projets · Responsable M. Diallo' },
    { id:'c3', title:'Studio Nimba', subtitle:'Production créative', status:'Actif', meta:'1 projet · Responsable F. Sow' },
  ],
  Projets: [
    { id:'pr1', title:'Campagne Rentrée 2026', subtitle:'Maison Kanu · Marketing digital', status:'En cours', meta:'68% · Échéance 03 oct.', amount:'35 M GNF' },
    { id:'pr2', title:'Refonte plateforme web', subtitle:'Nova Conseil · Développement web', status:'En cours', meta:'42% · Échéance 28 oct.', amount:'52 M GNF' },
    { id:'pr3', title:'Film institutionnel', subtitle:'Studio Nimba · Production vidéo', status:'Production', meta:'55% · Tournage vendredi', amount:'28 M GNF' },
    { id:'pr4', title:'Identité de marque', subtitle:'Atelier 224 · Branding', status:'Validation', meta:'88% · Échéance demain', amount:'16 M GNF' },
    { id:'pr5', title:'Activation terrain', subtitle:'Demo Transit · Événementiel', status:'Planifié', meta:'15% · Démarrage 12 oct.', amount:'22 M GNF' },
  ],
  Tâches: [
    { id:'t1', title:'Finaliser le storyboard', subtitle:'Film institutionnel · Fatou Sow', status:'Urgent', meta:'Aujourd’hui · 17:00' },
    { id:'t2', title:'Préparer le rapport mensuel', subtitle:'Maison Kanu · Mamadou Diallo', status:'En cours', meta:'Demain · 10:00' },
    { id:'t3', title:'Intégrer la page services', subtitle:'Refonte plateforme web · I. Bah', status:'À faire', meta:'27 sept. · 14:00' },
  ],
  Production: [
    { id:'s1', title:'Tournage — Film institutionnel', subtitle:'Studio Nimba · Cam 1 + Kit lumière', status:'Confirmé', meta:'Vendredi · 09:30 · Kipé' },
    { id:'s2', title:'Shooting — Collection Harmattan', subtitle:'Maison Kanu · Studio A', status:'Préparation', meta:'Samedi · 08:00 · Kaloum' },
  ],
  Éditorial: [
    { id:'e1', title:'Carrousel — Nouveautés rentrée', subtitle:'Maison Kanu · Instagram', status:'À valider client', meta:'Publication 28 sept. · 18:30' },
    { id:'e2', title:'Portrait collaborateur', subtitle:'Nova Conseil · LinkedIn', status:'Programmé', meta:'Publication 29 sept. · 09:00' },
    { id:'e3', title:'Reel making-of', subtitle:'Studio Nimba · Instagram', status:'Design en cours', meta:'Publication 01 oct. · 17:00' },
  ],
  Finance: [
    { id:'f1', title:'FAC-2026-041 · Maison Kanu', subtitle:'Campagne Rentrée 2026', status:'Partiellement payée', meta:'Échéance 30 sept.', amount:'18,5 M GNF' },
    { id:'f2', title:'FAC-2026-039 · Nova Conseil', subtitle:'Refonte plateforme web', status:'En retard', meta:'Échéance 12 sept.', amount:'12 M GNF' },
    { id:'f3', title:'DEV-2026-058 · Atelier Horizon', subtitle:'Production événementielle', status:'Envoyé', meta:'Valable jusqu’au 08 oct.', amount:'24 M GNF' },
  ],
  Matériel: [
    { id:'m1', title:'Sony FX3', subtitle:'CAM-004 · Caméra', status:'Sorti', meta:'Avec Fatou · Retour 27 sept.' },
    { id:'m2', title:'DJI RS 4 Pro', subtitle:'STAB-002 · Stabilisateur', status:'Disponible', meta:'Dernier contrôle 19 sept.' },
    { id:'m3', title:'Aputure 300D II', subtitle:'LUM-007 · Éclairage', status:'Réservé', meta:'Tournage Studio Nimba' },
  ],
  Équipe: [
    { id:'u1', title:'Amadou Sylla', subtitle:'Direction · Super Admin', status:'Disponible', meta:'3 projets actifs' },
    { id:'u2', title:'Mamadou Diallo', subtitle:'Commercial · Manager', status:'En rendez-vous', meta:'5 prospects suivis' },
    { id:'u3', title:'Fatou Sow', subtitle:'Production · Vidéaste', status:'En mission', meta:'2 tournages cette semaine' },
    { id:'u4', title:'Ibrahima Bah', subtitle:'Digital · Développeur', status:'Disponible', meta:'2 projets actifs' },
  ],
  Documents: [
    { id:'d1', title:'Convention Maison Kanu 2026.pdf', subtitle:'Contrat · 2,4 Mo', status:'Signé', meta:'Modifié le 18 sept.' },
    { id:'d2', title:'Brief Film institutionnel.docx', subtitle:'Projet · 840 Ko', status:'Interne', meta:'Modifié hier' },
  ],
  Communication: [
    { id:'co1', title:'Campagne — Offre rentrée', subtitle:'SMS · 128 destinataires', status:'Brouillon', meta:'Créée par Mamadou' },
    { id:'co2', title:'Validation publication client', subtitle:'Email automatique · Maison Kanu', status:'Envoyé', meta:'Aujourd’hui · 10:42' },
  ],
  Administration: [
    { id:'a1', title:'Rôles & permissions', subtitle:'12 rôles configurés', status:'Sécurisé', meta:'Dernière modification 20 sept.' },
    { id:'a2', title:'Journal d’audit', subtitle:'286 événements ce mois', status:'Actif', meta:'Dernière activité il y a 4 min' },
  ],
}
