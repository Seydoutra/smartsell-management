import { describe, expect, it } from "vitest";
import { contactsFromCsv, googleSheetCsvUrl, normalizePhone } from "./contactImport";

describe("contact import", () => {
  it("importe les colonnes françaises et supprime les doublons", () => {
    const contacts = contactsFromCsv(
      "Nom complet;Téléphone;E-mail;Entreprise;Tags\nAïssatou;620 00 00 00;a@example.com;Smart;client\nDoublon;620000000;a@example.com;Smart;client",
    );
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ name: "Aïssatou", phone: "+224620000000", email: "a@example.com" });
  });

  it("normalise les numéros guinéens", () => {
    expect(normalizePhone("00224 621 00 00 00")).toBe("+224621000000");
    expect(normalizePhone("622000000")).toBe("+224622000000");
  });

  it("convertit un lien Google Sheets en export CSV", () => {
    expect(googleSheetCsvUrl("https://docs.google.com/spreadsheets/d/abc-123/edit#gid=42"))
      .toBe("https://docs.google.com/spreadsheets/d/abc-123/gviz/tq?tqx=out:csv&gid=42");
  });
});
