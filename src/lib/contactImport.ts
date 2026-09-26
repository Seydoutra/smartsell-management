export type ImportedContact = {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  tags: string;
};

const clean = (value: unknown) => String(value ?? "").trim();
const key = (value: unknown) =>
  clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const aliases: Record<keyof Omit<ImportedContact, "id">, string[]> = {
  name: ["nom", "nomcomplet", "fullname", "name", "contact"],
  phone: ["telephone", "tel", "phone", "mobile", "whatsapp"],
  email: ["email", "emailadresse", "adressemail", "courriel", "mail"],
  company: ["entreprise", "societe", "company", "organisation", "organization"],
  tags: ["tags", "tag", "categorie", "groupe", "segment"],
};

export function normalizePhone(value: unknown) {
  const raw = clean(value).replace(/^'/, "");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00224")) return `+${digits.slice(2)}`;
  if (digits.startsWith("224")) return `+${digits}`;
  if (digits.length === 9) return `+224${digits}`;
  return raw.startsWith("+") ? `+${digits}` : digits;
}

function parseCsvRows(text: string) {
  const delimiter = (text.split(/\r?\n/, 1)[0]?.match(/;/g)?.length || 0) >
    (text.split(/\r?\n/, 1)[0]?.match(/,/g)?.length || 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); if (row.some((x) => x.trim())) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export function contactsFromRows(rows: unknown[][]): ImportedContact[] {
  if (!rows.length) return [];
  const headers = rows[0].map(key);
  const indexFor = (field: keyof typeof aliases) =>
    headers.findIndex((header) => aliases[field].includes(header));
  const indexes = {
    name: indexFor("name"), phone: indexFor("phone"), email: indexFor("email"),
    company: indexFor("company"), tags: indexFor("tags"),
  };
  if (indexes.phone < 0 && indexes.email < 0) {
    throw new Error("Le fichier doit contenir une colonne Téléphone ou E-mail.");
  }
  const seen = new Set<string>();
  return rows.slice(1).map((row, rowIndex) => {
    const phone = indexes.phone >= 0 ? normalizePhone(row[indexes.phone]) : "";
    const email = indexes.email >= 0 ? clean(row[indexes.email]).toLowerCase() : "";
    const dedupe = `${phone}|${email}`;
    if ((!phone && !email) || seen.has(dedupe)) return null;
    seen.add(dedupe);
    return {
      id: `${rowIndex}-${dedupe}`,
      name: indexes.name >= 0 ? clean(row[indexes.name]) : "",
      phone,
      email,
      company: indexes.company >= 0 ? clean(row[indexes.company]) : "",
      tags: indexes.tags >= 0 ? clean(row[indexes.tags]) : "",
    };
  }).filter((contact): contact is ImportedContact => Boolean(contact));
}

export function contactsFromCsv(text: string) {
  return contactsFromRows(parseCsvRows(text.replace(/^\uFEFF/, "")));
}

export async function contactsFromFile(file: File) {
  if (/\.csv$/i.test(file.name) || /text\/(csv|plain)/i.test(file.type)) {
    return contactsFromCsv(await file.text());
  }
  const { default: readXlsxFile } = await import("read-excel-file");
  const rows = await readXlsxFile(file);
  return contactsFromRows(rows as unknown[][]);
}

export function googleSheetCsvUrl(value: string) {
  const input = value.trim();
  const id = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  if (!id) throw new Error("Collez un lien Google Sheets valide.");
  const gid = input.match(/[?#&]gid=(\d+)/)?.[1] || "0";
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`;
}
