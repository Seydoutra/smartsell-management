import type { InvoiceItem } from '../types/models'

export function validateBillingItems(items: InvoiceItem[], discount: number): string | null {
  if (!items.length) return 'Ajoutez au moins une prestation.'
  if (items.some(item => !item.description.trim())) return 'Renseignez la description de chaque prestation.'
  if (items.some(item => !Number.isFinite(item.quantity) || item.quantity <= 0)) return 'La quantité de chaque prestation doit être supérieure à zéro.'
  if (items.some(item => !Number.isFinite(item.unit_price) || item.unit_price < 0)) return 'Le prix de chaque prestation doit être positif ou nul.'
  if (items.some(item => !Number.isFinite(item.tax_rate) || item.tax_rate < 0 || item.tax_rate > 100)) return 'La TVA doit être comprise entre 0 et 100 %.'
  if (!Number.isFinite(discount) || discount < 0) return 'La remise doit être positive ou nulle.'
  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price * (1 + item.tax_rate / 100), 0)
  if (discount > total) return 'La remise ne peut pas dépasser le montant des prestations.'
  return null
}
