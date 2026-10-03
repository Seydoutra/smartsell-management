import { describe, expect, it } from 'vitest'
import { editorialFromCsv, editorialFromRows } from './editorialImport'

describe('editorial calendar import',()=>{
  it('parses semicolon CSV and quoted captions without breaking columns',()=>{
    const rows=editorialFromCsv('Titre;Date;Heure;Réseaux;Légende;Statut\n"Annonce, lancement";04/10/2026;14:30;Instagram|LinkedIn;"Bonjour, notre offre arrive";PLANIFIE')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({title:'Annonce, lancement',platforms:['Instagram','LinkedIn'],caption:'Bonjour, notre offre arrive',status:'PLANIFIE',error:null})
  })
  it('reports missing titles and invalid dates before import',()=>{
    const rows=editorialFromCsv('Titre,Date\n,impossible')
    expect(rows[0].error).toContain('Titre manquant')
    expect(rows[0].error).toContain('Date invalide')
  })
  it('requires an explicit title and date column',()=>expect(()=>editorialFromCsv('Nom du client;Réseau\nA;Instagram')).toThrow(/Date/))
  it('recognizes the 14-column Cherifa template after two heading rows',()=>{
    const rows=editorialFromRows([
      ['CALENDRIER ÉDITORIAL — CLIENT'],['Légende couleurs'],
      ['Date','Jour','Sem.','Format','Pôle / Thème','Type','Objectif du post','Réseau social','Titre infographie (texte sur visuel)','Sous-titre / détails infographie','Texte de publication','Hashtags optimisés','État','POUR MISE À JOUR'],
      ['05/08/2026','Mercredi','S1','Infographie','Marque','Corporate','Présenter la marque','Facebook + LinkedIn','Un seul partenaire','Quatre expertises','Texte de publication','#Marque','PUBLIÉ','Valider le visuel'],
      ['06/08/2026','Jeudi','S1','Reel','Terrain','Commercial','Montrer le terrain','Facebook','Sur le terrain','Détails','Texte Reel','#Terrain','REPORTÉ','Montage 9:16'],
    ],'Août 2026')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({sheet:'Août 2026',line:4,title:'Un seul partenaire',platforms:['Facebook','LinkedIn'],theme:'Marque',post_type:'Corporate',objective:'Présenter la marque',visual_subtitle:'Quatre expertises',hashtags:'#Marque',production_notes:'Valider le visuel',status:'PUBLIE',error:null})
    expect(rows[1]).toMatchObject({status:'REPORTE',error:null})
  })
  it('maps July yes/no conservatively and flags undated drafts',()=>{
    const rows=editorialFromRows([['Date','Titre infographie (texte sur visuel)','État'],['01/07/2026','Post déjà publié','OUI'],['02/07/2026','Post non publié','NON'],['','Post sans date','']], 'Juillet')
    expect(rows.map(row=>row.status)).toEqual(['PUBLIE','A_REDIGER','A_REDIGER'])
    expect(rows[2].error).toContain('Date invalide')
  })
  it('imports the downloadable template columns and combines Excel date with time',()=>{
    const rows=editorialFromRows([
      ['Date','Heure','Client','Projet','Titre','Réseaux','Format','Thème','Type de post','Objectif du post','Titre sur le visuel','Sous-titre','Légende','Hashtags','Consignes','Semaine','Statut'],
      [new Date(2026,9,15),0.6041666667,'Client A','Projet B','Publication exemple','Instagram, Facebook','Carrousel','Marque','Corporate','Notoriété','Titre visuel','Sous-titre','Texte','#marque','Valider','S3','PLANIFIE'],
    ])
    expect(rows[0]).toMatchObject({client:'Client A',project:'Projet B',title:'Publication exemple',platforms:['Instagram','Facebook'],post_type:'Corporate',status:'PLANIFIE',error:null})
    expect(new Date(rows[0].publish_at).getHours()).toBe(14)
    expect(new Date(rows[0].publish_at).getMinutes()).toBe(30)
  })
})
