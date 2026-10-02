export const marketingRoutes=['solutions','fonctionnement','personnalisation','tarifs','contact'] as const
export type MarketingRoute=typeof marketingRoutes[number]
export type PublicMarketingRoute=MarketingRoute|'parrainage'

export const marketingPath=(route:PublicMarketingRoute)=>`${import.meta.env.BASE_URL}${route}/`

export function marketingRouteFromPath(pathname:string,base:string=import.meta.env.BASE_URL):PublicMarketingRoute|null{
  const normalizedBase=base.endsWith('/')?base:`${base}/`
  if(!pathname.startsWith(normalizedBase))return null
  const first=pathname.slice(normalizedBase.length).split('/')[0]
  return first==='parrainage'||marketingRoutes.includes(first as MarketingRoute)?first as PublicMarketingRoute:null
}
