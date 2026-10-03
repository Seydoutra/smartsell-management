export type StatusTone = 'danger'|'warning'|'pending'|'progress'|'info'|'success'|'neutral'

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')

/** Priority matters: IMPAYEE contains PAYEE, and PARTIELLEMENT_PAYEE contains both. */
export function statusTone(status?: string | null): StatusTone {
  const value = normalize(status || '')
  if (!value) return 'neutral'
  if (value === 'A_FAIRE') return 'pending'
  if (value === 'EN_COURS') return 'progress'
  if (value === 'EN_ATTENTE') return 'warning'
  if (value === 'EN_REVUE') return 'info'
  if (value === 'BLOQUE') return 'danger'
  if (value === 'TERMINE') return 'success'
  if (value === 'SAIN') return 'success'
  if (value === 'A_SURVEILLER') return 'warning'
  if (value === 'CRITIQUE') return 'danger'
  if (/PARTIEL|ACOMPTE|PAUSE|REPORTE|RELANCER|CALLBACK|MAINTENANCE/.test(value)) return 'warning'
  if (/IMPAY|NON_PAY|RETARD|ECHOU|FAILED|ERREUR|REFUS|REJET|ANNULE|SUSPENDU|INACTIF|EXPIRE|CRITIQUE|URGENT|HORS_SERVICE|DEMANDEES/.test(value)) return 'danger'
  if (/TERMINE|PAYE|ENCAISSE|APPROUVE|VALIDE|PUBLIE|ACTIF|ACTIVE|CONNECTE|SENT|COMPLETED|LIVRE|REALISE|APPELE/.test(value)) return 'success'
  if (/EN_COURS|PROGRESS|MISSION|DIALING|EN_APPEL|QUEUED|CONTACT|QUALIFIE|ENVOI/.test(value)) return 'progress'
  if (/PLANIFIE|PROGRAMME|RENDEZ_VOUS|SCHEDULED/.test(value)) return 'info'
  if (/ATTENTE|A_VALIDER|REDIGER|CREATION|A_FAIRE|TO_CALL|DRAFT|PREPARATION/.test(value)) return 'pending'
  return 'neutral'
}
