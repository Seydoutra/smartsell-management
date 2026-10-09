import type { AccessControl } from "../types/models";
import type { Role } from "./permissions";

export const moduleForScope: Record<string, string> = {
  clients: "Clients",
  projects: "Projets",
  tasks: "Tâches",
  planning: "Planning",
  editorial: "Éditorial",
  services: "Services",
  suppliers: "Fournisseurs",
  invoices: "Facturation",
  documents: "Documents",
  accounting: "Comptabilité",
  equipment: "Matériel",
  communication: "Communication",
  team: "Équipe",
  hr: "RH",
  reports: "Rapports",
  portal: "Portail client",
  audit: "Rapports",
};

export function isActionAllowed(
  _roles: Role[],
  access: AccessControl | null,
  accessLoaded: boolean,
  action: string,
  workspaceOwner = false,
) {
  if (workspaceOwner) return true;
  if (!accessLoaded || !access) return false;
  const scope = action.split(".")[0];
  const module = moduleForScope[scope];
  return Boolean(
    module &&
      access.allowed_modules.includes(module) &&
      !access.denied_permissions.includes(`${scope}.view`) &&
      !access.denied_permissions.includes(action),
  );
}

export function isModuleAllowed(
  _roles: Role[],
  access: AccessControl | null,
  accessLoaded: boolean,
  module: string,
  workspaceOwner = false,
) {
  if (workspaceOwner) return true;
  return Boolean(accessLoaded && access?.allowed_modules.includes(module));
}
