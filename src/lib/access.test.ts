import { describe, expect, it } from "vitest";
import { isActionAllowed, isModuleAllowed } from "./access";
import type { AccessControl } from "../types/models";

const access: AccessControl = {
  profile_id: "user",
  allowed_modules: ["Clients", "Tâches"],
  denied_permissions: ["clients.delete"],
  can_initiate_calls: false,
  max_sms_per_day: 0,
  max_emails_per_day: 10,
  max_calls_per_day: 0,
  max_export_rows: 100,
  max_approval_amount: 0,
};

describe("granular access", () => {
  it("denies access while permissions are loading", () => {
    expect(isActionAllowed(["COLLABORATEUR"], null, false, "clients.view")).toBe(false);
  });
  it("requires the module and the action", () => {
    expect(isActionAllowed(["COLLABORATEUR"], access, true, "clients.view")).toBe(true);
    expect(isActionAllowed(["COLLABORATEUR"], access, true, "clients.delete")).toBe(false);
    expect(isActionAllowed(["COLLABORATEUR"], access, true, "accounting.view")).toBe(false);
  });
  it("only lets a workspace owner bypass restrictions", () => {
    expect(isModuleAllowed(["SUPER_ADMIN"], null, false, "Comptabilité",true)).toBe(true);
    expect(isModuleAllowed(["SUPER_ADMIN"], null, false, "Comptabilité")).toBe(false);
    expect(isActionAllowed(["SUPER_ADMIN"],access,true,"clients.delete")).toBe(false);
  });
  it("denies mutations when viewing is revoked even with multiple admin roles",()=>{
    const denied={...access,denied_permissions:['clients.view']};
    expect(isActionAllowed(['ADMIN','SUPER_ADMIN'],denied,true,'clients.create')).toBe(false);
    expect(isActionAllowed(['ADMIN','SUPER_ADMIN'],denied,true,'clients.delete')).toBe(false);
  });
});
