export type Role = 'SUPER_ADMIN'|'ADMIN'|'MANAGER'|'CHEF_DE_PROJET'|'COMMERCIAL'|'COMMUNITY_MANAGER'|'GRAPHISTE'|'VIDEASTE'|'PHOTOGRAPHE'|'DEVELOPPEUR'|'COMPTABLE'|'COLLABORATEUR'
export type Permission = 'users.manage'|'settings.manage'|'finance.read'|'finance.write'|'crm.write'|'projects.write'|'communication.send'|'calls.initiate'|'exports.run'|'audit.read'

const rules: Record<Role, Permission[]> = {
  SUPER_ADMIN:['users.manage','settings.manage','finance.read','finance.write','crm.write','projects.write','communication.send','calls.initiate','exports.run','audit.read'],
  ADMIN:['users.manage','finance.read','finance.write','crm.write','projects.write','communication.send','calls.initiate','exports.run','audit.read'],
  MANAGER:['finance.read','crm.write','projects.write','communication.send','calls.initiate','exports.run'],
  CHEF_DE_PROJET:['projects.write','exports.run'], COMMERCIAL:['crm.write','communication.send','calls.initiate'],
  COMMUNITY_MANAGER:['projects.write','communication.send'], GRAPHISTE:['projects.write'], VIDEASTE:['projects.write'],
  PHOTOGRAPHE:['projects.write'], DEVELOPPEUR:['projects.write'], COMPTABLE:['finance.read','finance.write'], COLLABORATEUR:[],
}

export const can = (role: Role, permission: Permission) => rules[role].includes(permission)

export type UserLimits = { smsPerDay:number; emailsPerDay:number; callsPerDay:number; exportRows:number; approvalAmount:number }
export const defaultLimits: Record<Role,UserLimits> = {
  SUPER_ADMIN:{smsPerDay:1000,emailsPerDay:2500,callsPerDay:100,exportRows:50000,approvalAmount:Number.MAX_SAFE_INTEGER},
  ADMIN:{smsPerDay:500,emailsPerDay:1000,callsPerDay:60,exportRows:20000,approvalAmount:100_000_000},
  MANAGER:{smsPerDay:200,emailsPerDay:500,callsPerDay:40,exportRows:5000,approvalAmount:25_000_000},
  CHEF_DE_PROJET:{smsPerDay:30,emailsPerDay:100,callsPerDay:15,exportRows:2000,approvalAmount:5_000_000},
  COMMERCIAL:{smsPerDay:100,emailsPerDay:250,callsPerDay:40,exportRows:2000,approvalAmount:0},
  COMMUNITY_MANAGER:{smsPerDay:50,emailsPerDay:100,callsPerDay:5,exportRows:1000,approvalAmount:0},
  GRAPHISTE:{smsPerDay:0,emailsPerDay:20,callsPerDay:0,exportRows:250,approvalAmount:0}, VIDEASTE:{smsPerDay:0,emailsPerDay:20,callsPerDay:0,exportRows:250,approvalAmount:0},
  PHOTOGRAPHE:{smsPerDay:0,emailsPerDay:20,callsPerDay:0,exportRows:250,approvalAmount:0}, DEVELOPPEUR:{smsPerDay:0,emailsPerDay:20,callsPerDay:0,exportRows:1000,approvalAmount:0},
  COMPTABLE:{smsPerDay:20,emailsPerDay:100,callsPerDay:5,exportRows:5000,approvalAmount:25_000_000}, COLLABORATEUR:{smsPerDay:0,emailsPerDay:10,callsPerDay:0,exportRows:100,approvalAmount:0},
}

export const withinLimit = (used:number, limit:number, requested=1) => requested>0 && used+requested<=limit
