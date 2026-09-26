import { CSSProperties, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  Bell,
  BookOpenCheck,
  Boxes,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  Moon,
  Package,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  Send,
  Settings2,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { companyProfile } from "./lib/companyProfile";
import { contactsFromCsv, contactsFromFile, googleSheetCsvUrl, ImportedContact } from "./lib/contactImport";
import { can, Permission, Role } from "./lib/permissions";
import {
  endSession,
  pulseSession,
  startSession,
  trackActivity,
} from "./services/activityTracker";
import {
  AiAssistantPage,
  BillingV3,
  ClientPortalAdmin,
  ClientPortalView,
  EditorialV3,
  HRPage,
  SuppliersPage,
  TeamAccessPage,
} from "./AdvancedModulesV3";
import {
  connectGoogleCalendar,
  completePasswordChange,
  createClient,
  createCommercialDocument,
  createEditorialItem,
  createEquipment,
  createExpense,
  createInvoice,
  createProject,
  createService,
  createTask,
  createTeamMember,
  currentSession,
  deleteClient,
  deleteEditorialItem,
  deleteProject,
  deleteService,
  deleteTask,
  getAccessControl,
  getCalendarConnection,
  getClientWorkspace,
  getProfile,
  getProjectWorkspace,
  listActivityLogs,
  listClients,
  listCommercialDocuments,
  listEditorialItems,
  listEquipment,
  listExpenses,
  listInvoices,
  listPayments,
  listProfiles,
  listProjects,
  listServices,
  listSuppliers,
  listTasks,
  listUserSessions,
  onAuthChange,
  recordPayment,
  requestPasswordReset,
  sendCommunication,
  signIn,
  signOut,
  updateClient,
  updateCommercialDocument,
  updateEditorialItem,
  updateProfile,
  updateProject,
  updateService,
  updateTask,
} from "./services/repository";
import type {
  AccessControl,
  ActivityLog,
  CalendarConnection,
  Client,
  CommercialDocument,
  EditorialItem,
  Equipment,
  Expense,
  Invoice,
  InvoiceItem,
  Payment,
  Profile,
  Project,
  Service,
  Supplier,
  Task,
  UserSession,
} from "./types/models";

type Page =
  | "Dashboard"
  | "Clients"
  | "Projets"
  | "Tâches"
  | "Planning"
  | "Éditorial"
  | "Services"
  | "Fournisseurs"
  | "Facturation"
  | "Documents"
  | "Comptabilité"
  | "Matériel"
  | "Communication"
  | "Équipe"
  | "RH"
  | "Rapports"
  | "Portail client"
  | "Assistant IA";
type CrudRights = { view: boolean; create: boolean; update: boolean; delete: boolean };
const nav: [Page, typeof LayoutDashboard, Permission?][] = [
  ["Dashboard", LayoutDashboard],
  ["Clients", Users, "crm.write"],
  ["Projets", BriefcaseBusiness, "projects.write"],
  ["Tâches", ClipboardList, "projects.write"],
  ["Planning", CalendarDays, "projects.write"],
  ["Éditorial", BookOpenCheck, "projects.write"],
  ["Services", Boxes, "finance.read"],
  ["Fournisseurs", BriefcaseBusiness, "finance.read"],
  ["Facturation", ReceiptText, "finance.read"],
  ["Documents", FileCheck2, "finance.read"],
  ["Comptabilité", CircleDollarSign, "finance.read"],
  ["Matériel", Package, "projects.write"],
  ["Communication", Mail, "communication.send"],
  ["Équipe", Users, "users.manage"],
  ["RH", BriefcaseBusiness, "users.manage"],
  ["Rapports", Activity, "audit.read"],
  ["Portail client", ShieldCheck, "users.manage"],
  ["Assistant IA", MessageSquareText],
];
const pageNames = new Set<Page>(nav.map(([name]) => name));
const pageFromHash = (): Page => {
  const value = decodeURIComponent(location.hash.replace(/^#\/?/, "").split("?")[0] || "Dashboard") as Page;
  return pageNames.has(value) ? value : "Dashboard";
};
const clientFromHash = () => new URLSearchParams(location.hash.split("?")[1] || "").get("client");
const money = (v: number, c = "GNF") =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: c,
    maximumFractionDigits: c === "GNF" ? 0 : 2,
  }).format(Number(v || 0));
const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const label = (s?: string | null) => (s || "—").replaceAll("_", " ");

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email, password);
      sessionStorage.setItem("smartsell-show-welcome", "1");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="login-shell">
      <section className="login-brand">
        <img
          src={companyProfile.logo_light}
          className="login-logo"
          alt="Smartsell"
        />
        <div className="brand-orbit">
          <span />
        </div>
        <div className="login-manifesto">
          <p>Centre de gestion</p>
          <h1>
            GÉREZ.
            <br />
            CRÉEZ.
            <br />
            <em>LIVREZ.</em>
            <br />
            GRANDISSEZ.
          </h1>
        </div>
        <div className="contact-line">
          <span>{companyProfile.address}</span>
          <span>{companyProfile.email}</span>
        </div>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="eyebrow">
            <i /> ACCÈS SÉCURISÉ
          </div>
          <h2>Connexion</h2>
          <p className="muted">Accédez à votre espace de production.</p>
          <label>
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Mot de passe
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="link forgot-link"
            onClick={async () => {
              if (!email) return setError("Saisissez votre email.");
              await requestPasswordReset(email);
              setError("Lien envoyé par email.");
            }}
          >
            Mot de passe oublié ?
          </button>
          {error && <p className="form-error">{error}</p>}
          <button disabled={busy} className="primary-btn">
            {busy ? "Connexion…" : "Ouvrir mon espace"} <span>→</span>
          </button>
        </form>
      </section>
    </main>
  );
}

function WelcomeSplash({ profile, onComplete }: { profile: Profile; onComplete: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 3600);
    return () => window.clearTimeout(timer);
  }, [onComplete]);
  const hour = Number(new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Africa/Conakry",
  }).format(new Date()).replace(/\D/g, ""));
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Salut" : "Bonsoir";
  const displayName = profile.full_name.trim().split(/\s+/)[0] || "à vous";
  return (
    <motion.main
      className="welcome-splash"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.55 }}
    >
      <motion.h1
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.75 }}
      >
        {greeting}, {displayName}.<br />
        <span>Bon retour.</span>
      </motion.h1>
    </motion.main>
  );
}
function Modal({
  title,
  onClose,
  children,
  wide = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={onClose}
    >
      <motion.div
        className={`modal ${wide ? "wide-modal" : ""}`}
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">
              <i /> SMARTSELL
            </span>
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
function Field({
  label: txt,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "wide" : ""}>
      {txt}
      {children}
    </label>
  );
}
function Header({
  title,
  copy,
  onAdd,
  add = "Créer",
  children,
}: {
  title: string;
  copy: string;
  onAdd?: () => void;
  add?: string;
  children?: ReactNode;
}) {
  return (
    <div className="module-head">
      <div>
        <span className="eyebrow">
          <i /> SMARTSELL MANAGEMENT
        </span>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      <div className="head-actions">{children}{onAdd && (
          <button className="primary-btn compact" onClick={onAdd}>
            <Plus />
            {add}
          </button>
        )}</div>
    </div>
  );
}
function Empty({ name, onAdd }: { name: string; onAdd?: () => void }) {
  return (
    <div className="empty-state">
      <FileText />
      <h3>Aucun {name}</h3>
      <p>Le premier enregistrement apparaîtra ici.</p>
      {onAdd && (
        <button className="primary-btn compact" onClick={onAdd}>
          <Plus />
          Créer
        </button>
      )}
    </div>
  );
}
function ErrorBar({ value }: { value: string }) {
  return value ? <div className="error-banner">{value}</div> : null;
}
function Stat({
  name,
  value,
  copy,
  featured = false,
}: {
  name: string;
  value: string | number;
  copy: string;
  featured?: boolean;
}) {
  return (
    <article className={`kpi ${featured ? "featured" : ""}`}>
      <span>{name}</span>
      <strong>{value}</strong>
      <small>{copy}</small>
    </article>
  );
}
function Danger({
  onClick,
  label = "Supprimer",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button className="danger-btn" onClick={onClick}>
      <Trash2 />
      {label}
    </button>
  );
}

function Dashboard({ profile }: { profile: Profile }) {
  const [c, setC] = useState<Client[]>([]),
    [p, setP] = useState<Project[]>([]),
    [i, setI] = useState<Invoice[]>([]),
    [t, setT] = useState<Task[]>([]),
    [payments, setPayments] = useState<Payment[]>([]),
    [expenses, setExpenses] = useState<Expense[]>([]),
    [suppliers, setSuppliers] = useState<Supplier[]>([]),
    [team, setTeam] = useState<Profile[]>([]),
    [sessions, setSessions] = useState<UserSession[]>([]),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      listClients(),
      listProjects(),
      listInvoices(),
      listTasks(),
      listPayments(),
      listExpenses(),
      listSuppliers(),
      listProfiles(),
      listUserSessions(),
    ]).then(([a, b, d, e, f, g, h, j, k]) => {
      setC(a);
      setP(b);
      setI(d);
      setT(e);
      setPayments(f);
      setExpenses(g);
      setSuppliers(h);
      setTeam(j);
      setSessions(k);
    }).finally(()=>setLoading(false));
  }, []);
  const billed = i.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const collected = payments.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const spent = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const receivables = Math.max(0, billed - collected);
  const openTasks = t.filter((row) => row.status !== "TERMINE");
  const completion = t.length ? Math.round((t.filter((row) => row.status === "TERMINE").length / t.length) * 100) : 0;
  const overdue = i.filter((row) => row.status !== "PAYEE" && row.due_date && new Date(row.due_date) < new Date());
  const activeProjects = p.filter((row) => !["TERMINE", "ANNULE"].includes(row.status));
  const onlineIds = new Set(sessions.filter((row) => !row.signed_out_at && Date.now() - new Date(row.last_seen_at).getTime() < 15 * 60_000).map((row) => row.profile_id));
  const monthSeries = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - (5 - index));
    const month = date.getMonth(), year = date.getFullYear();
    const revenue = i.filter((row) => { const value = new Date(row.issue_date); return value.getMonth() === month && value.getFullYear() === year; }).reduce((sum, row) => sum + Number(row.total || 0), 0);
    const cost = expenses.filter((row) => { const value = new Date(row.spent_on); return value.getMonth() === month && value.getFullYear() === year; }).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return { label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date), revenue, cost };
  }), [i, expenses]);
  const chartMax = Math.max(1, ...monthSeries.flatMap((row) => [row.revenue, row.cost]));
  const topClients = useMemo(() => c.map((client) => ({ client, total: i.filter((row) => row.client_id === client.id).reduce((sum, row) => sum + Number(row.total || 0), 0) })).sort((a, b) => b.total - a.total).slice(0, 4), [c, i]);
  const metrics = [
    { label: "Facturé", value: money(billed), copy: `${i.length} facture(s)`, icon: ReceiptText, tone: "purple" },
    { label: "Encaissé", value: money(collected), copy: `${payments.length} paiement(s)`, icon: WalletCards, tone: "green" },
    { label: "À recevoir", value: money(receivables), copy: `${overdue.length} facture(s) en retard`, icon: CircleDollarSign, tone: "yellow" },
    { label: "Dépenses", value: money(spent), copy: `Solde ${money(collected - spent)}`, icon: Activity, tone: "red" },
    { label: "Clients", value: c.length, copy: `${c.filter((row) => row.status === "ACTIVE").length} actifs`, icon: Users, tone: "blue" },
    { label: "Projets", value: activeProjects.length, copy: `${p.length} au total`, icon: BriefcaseBusiness, tone: "purple" },
    { label: "Tâches", value: openTasks.length, copy: `${completion}% terminées`, icon: ClipboardList, tone: "green" },
    { label: "Fournisseurs", value: suppliers.length, copy: `${suppliers.filter((row) => row.status === "ACTIVE").length} actifs`, icon: Boxes, tone: "yellow" },
  ];
  return (
    <div className={`command-dashboard ${loading ? "is-loading" : ""}`}>
      <motion.section className="command-hero" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{duration:.45}}>
        <div className="command-grid"/><div className="command-glow glow-one"/><div className="command-glow glow-two"/>
        <div className="command-copy"><span className="eyebrow"><i/> CENTRE DE COMMANDE EN TEMPS RÉEL</span><h1>Bonjour, {profile.full_name.split(" ")[0]}.</h1><p>Une vision instantanée de la finance, des opérations, des clients et de l’équipe.</p><div className="live-chip"><i/> Données synchronisées avec Supabase</div></div>
        <div className="command-orbit"><div className="orbit-ring ring-a"/><div className="orbit-ring ring-b"/><div className="orbit-core"><strong>{money(collected-spent)}</strong><span>trésorerie nette</span></div></div>
      </motion.section>
      <section className="command-metrics">{metrics.map((metric,index)=><motion.article className={`command-metric tone-${metric.tone}`} key={metric.label} initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{delay:.04*index,duration:.35}} whileHover={{y:-4}}><div className="metric-icon"><metric.icon/></div><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.copy}</small><div className="metric-scan"/></motion.article>)}</section>
      <section className="command-panels">
        <motion.article className="panel finance-radar" initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}}><div className="command-panel-head"><div><span className="eyebrow"><i/> FINANCE</span><h2>Flux des 6 derniers mois</h2></div><span className="pulse-label">● LIVE</span></div><div className="future-chart">{monthSeries.map(row=><div className="future-month" key={row.label}><div className="future-bars"><i style={{height:`${Math.max(4,row.revenue/chartMax*100)}%`}}/><b style={{height:`${Math.max(4,row.cost/chartMax*100)}%`}}/></div><span>{row.label}</span></div>)}</div><div className="chart-key"><span><i/>Facturation</span><span><i/>Dépenses</span></div></motion.article>
        <motion.article className="panel operations-ring" initial={{opacity:0,x:16}} animate={{opacity:1,x:0}}><div className="command-panel-head"><div><span className="eyebrow"><i/> EXÉCUTION</span><h2>Avancement opérationnel</h2></div></div><div className="progress-orb" style={{"--progress":`${completion*3.6}deg`} as CSSProperties}><div><strong>{completion}%</strong><span>tâches terminées</span></div></div><div className="operation-stats"><span><b>{openTasks.length}</b> ouvertes</span><span><b>{t.filter(row=>row.priority==="URGENTE"&&row.status!=="TERMINE").length}</b> urgentes</span><span><b>{activeProjects.length}</b> projets actifs</span></div></motion.article>
        <motion.article className="panel client-intelligence" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}><div className="command-panel-head"><div><span className="eyebrow"><i/> CLIENTS</span><h2>Portefeuille principal</h2></div><span>{c.length} comptes</span></div><div className="rank-list">{topClients.length?topClients.map((row,index)=><div key={row.client.id}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{row.client.name}</strong><small>{row.client.sector||"Secteur non renseigné"}</small></div><b>{money(row.total)}</b></div>):<p className="muted">Les revenus par client apparaîtront ici.</p>}</div></motion.article>
        <motion.article className="panel team-radar" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}><div className="command-panel-head"><div><span className="eyebrow"><i/> ÉQUIPE</span><h2>Présence et capacité</h2></div><span>{onlineIds.size} en ligne</span></div><div className="team-cloud">{team.slice(0,8).map((member,index)=><motion.div key={member.id} animate={{y:[0,-3,0]}} transition={{duration:2.8+index*.15,repeat:Infinity,delay:index*.12}} className={onlineIds.has(member.id)?"online":""}><b>{member.full_name.slice(0,2).toUpperCase()}</b><span>{member.full_name.split(" ")[0]}</span></motion.div>)}</div><div className="team-summary"><span><b>{team.filter(row=>row.active).length}</b> collaborateurs actifs</span><span><b>{suppliers.length}</b> fournisseurs référencés</span></div></motion.article>
      </section>
    </div>
  );
}

function ClientDetail({
  id,
  onClose,
  onChanged,
  onNavigate,
  rights,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  onNavigate: (page: "Projets" | "Tâches" | "Facturation", clientId: string) => void;
  rights: CrudRights;
}) {
  const [data, setData] = useState<Awaited<
      ReturnType<typeof getClientWorkspace>
    > | null>(null),
    [edit, setEdit] = useState(false),
    [error, setError] = useState("");
  const load = () =>
    getClientWorkspace(id)
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, [id]);
  if (!data)
    return (
      <Modal title="Fiche client" onClose={onClose}>
        <div className="empty-state">Chargement…</div>
      </Modal>
    );
  const paid = data.invoices.reduce(
    (s, x) => s + (x.payments || []).reduce((a, p) => a + Number(p.amount), 0),
    0,
  );
  return (
    <Modal title={data.client.name} onClose={onClose}>
      <ErrorBar value={error} />
      {edit ? (
        <form
          className="entity-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            await updateClient(id, f);
            setEdit(false);
            load();
            onChanged();
          }}
        >
          <div className="form-grid">
            <Field label="Nom">
              <input name="name" defaultValue={data.client.name} />
            </Field>
            <Field label="Secteur">
              <input name="sector" defaultValue={data.client.sector || ""} />
            </Field>
            <Field label="Email">
              <input
                name="email"
                type="email"
                defaultValue={data.client.email || ""}
              />
            </Field>
            <Field label="Téléphone">
              <input name="phone" defaultValue={data.client.phone || ""} />
            </Field>
            <Field label="Adresse" wide>
              <input name="address" defaultValue={data.client.address || ""} />
            </Field>
            <Field label="Notes" wide>
              <textarea name="notes" defaultValue={data.client.notes || ""} />
            </Field>
          </div>
          <button className="primary-btn compact">Enregistrer</button>
        </form>
      ) : (
        <>
          <div className="detail-hero">
            <div className="record-avatar large">
              {data.client.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3>{data.client.legal_name || data.client.name}</h3>
              <p>
                {data.client.email || "Aucun email"} ·{" "}
                {data.client.phone || "Aucun téléphone"}
              </p>
              <span className="status">{label(data.client.status)}</span>
            </div>
            {rights.update && <button className="ghost-action" onClick={() => setEdit(true)}>
              <Pencil />
              Modifier
            </button>}
          </div>
          <div className="detail-kpis">
            <button type="button" className="detail-kpi-link" onClick={()=>{onClose();onNavigate("Projets",id)}} aria-label={`Voir les ${data.projects.length} projets de ${data.client.name}`}><Stat name="Projets" value={data.projects.length} copy="Ouvrir les projets" /></button>
            <button type="button" className="detail-kpi-link" onClick={()=>{onClose();onNavigate("Tâches",id)}} aria-label={`Voir les ${data.tasks.length} tâches de ${data.client.name}`}><Stat name="Tâches" value={data.tasks.length} copy="Ouvrir les tâches" /></button>
            <button type="button" className="detail-kpi-link" onClick={()=>{onClose();onNavigate("Facturation",id)}} aria-label={`Voir les factures de ${data.client.name}`}><Stat name="Facturé" value={money(data.invoices.reduce((s, x) => s + Number(x.total), 0))} copy={`Payé ${money(paid)} · Ouvrir`} /></button>
          </div>
          <DetailList
            title="Projets"
            rows={data.projects.map((x) => [
              x.name,
              `${label(x.status)} · ${x.progress}%`,
              money(x.budget, x.currency),
            ])}
          />
          <DetailList
            title="Tâches"
            rows={data.tasks.map((x) => [
              x.title,
              `${label(x.status)} · ${x.profiles?.full_name || "Non assignée"}`,
              fmt(x.due_at),
            ])}
          />
          <DetailList
            title="Factures et paiements"
            rows={data.invoices.map((x) => [
              x.number,
              label(x.status),
              money(x.total, x.currency),
            ])}
          />
          {rights.delete && (
            <div className="danger-zone">
              <Danger
                onClick={async () => {
                  if (
                    confirm(`Supprimer définitivement ${data.client.name} ?`)
                  ) {
                    try {
                      await deleteClient(id);
                      onChanged();
                      onClose();
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Suppression impossible",
                      );
                    }
                  }
                }}
              />
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
function DetailList({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      {rows.length ? (
        rows.map((r, i) => (
          <div className="detail-line" key={i}>
            <strong>{r[0]}</strong>
            <span>{r[1]}</span>
            <b>{r[2]}</b>
          </div>
        ))
      ) : (
        <p className="muted">Aucun élément lié.</p>
      )}
    </section>
  );
}

function ClientsPage({ rights, onNavigate }: { rights: CrudRights; onNavigate: (page: "Projets" | "Tâches" | "Facturation", clientId: string) => void }) {
  const [rows, setRows] = useState<Client[]>([]),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState("");
  const load = () =>
    listClients()
      .then(setRows)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <Header
        title="Clients"
        copy="Fiches complètes, projets, tâches, factures et paiements reliés."
        onAdd={rights.create ? () => setOpen(true) : undefined}
        add="Nouveau client"
      />
      <ErrorBar value={error} />
      <div className="records panel">
        {!rows.length ? (
          <Empty name="client" onAdd={rights.create ? () => setOpen(true) : undefined} />
        ) : (
          rows.map((r) => (
            <article
              className="clickable-row"
              key={r.id}
              onClick={() => setSelected(r.id)}
            >
              <div className="record-main">
                <span className="record-avatar">
                  {r.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{r.name}</strong>
                  <small>{r.sector || "Secteur non renseigné"}</small>
                </div>
              </div>
              <span className="status">{label(r.status)}</span>
              <span className="record-meta">
                {r.email || r.phone || "Aucun contact"}
              </span>
              <b className="record-amount">
                Ouvrir <ChevronRight />
              </b>
            </article>
          ))
        )}
      </div>
      <AnimatePresence>
        {open && (
          <Modal title="Créer un client" onClose={() => setOpen(false)}>
            <form
              className="entity-form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await createClient(
                    Object.fromEntries(
                      new FormData(e.currentTarget),
                    ) as Partial<Client>,
                  );
                  setOpen(false);
                  load();
                } catch (x) {
                  setError(x instanceof Error ? x.message : "Erreur");
                }
              }}
            >
              <div className="form-grid">
                <Field label="Nom">
                  <input name="name" required />
                </Field>
                <Field label="Raison sociale">
                  <input name="legal_name" />
                </Field>
                <Field label="Secteur">
                  <input name="sector" />
                </Field>
                <Field label="Téléphone">
                  <input name="phone" />
                </Field>
                <Field label="WhatsApp">
                  <input name="whatsapp" />
                </Field>
                <Field label="Email">
                  <input name="email" type="email" />
                </Field>
                <Field label="Adresse" wide>
                  <input name="address" />
                </Field>
              </div>
              <button className="primary-btn compact">Enregistrer</button>
            </form>
          </Modal>
        )}
        {selected && (
          <ClientDetail
            id={selected}
            onClose={() => setSelected(null)}
            onChanged={load}
            onNavigate={onNavigate}
            rights={rights}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function ProjectDetail({
  id,
  onClose,
  onChanged,
  rights,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  rights: CrudRights;
}) {
  const [data, setData] = useState<Awaited<
      ReturnType<typeof getProjectWorkspace>
    > | null>(null),
    [error, setError] = useState("");
  const load = () =>
    getProjectWorkspace(id)
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, [id]);
  if (!data)
    return (
      <Modal title="Projet" onClose={onClose}>
        <div className="empty-state">Chargement…</div>
      </Modal>
    );
  return (
    <Modal title={data.project.name} onClose={onClose}>
      <ErrorBar value={error} />
      <div className="detail-hero">
        <div className="record-avatar large">PR</div>
        <div>
          <h3>{data.project.name}</h3>
          <p>
            {data.project.clients?.name || "Sans client"} ·{" "}
            {data.project.type || "Autre"}
          </p>
          <span className="status">{label(data.project.status)}</span>
        </div>
      </div>
      <form
        className="entity-form inline-editor"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!rights.update) return;
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<
            string,
            string
          >;
          await updateProject(id, {
            status: f.status,
            progress: Number(f.progress),
            priority: f.priority,
            ends_on: f.ends_on || null,
            description: f.description,
          });
          load();
          onChanged();
        }}
      >
        <fieldset disabled={!rights.update} className="permission-fieldset"><div className="form-grid">
          <Field label="Statut">
            <select name="status" defaultValue={data.project.status}>
              <option>PLANIFIE</option>
              <option>EN_COURS</option>
              <option>EN_PAUSE</option>
              <option>TERMINE</option>
              <option>ANNULE</option>
            </select>
          </Field>
          <Field label="Progression %">
            <input
              name="progress"
              type="number"
              min="0"
              max="100"
              defaultValue={data.project.progress}
            />
          </Field>
          <Field label="Priorité">
            <select name="priority" defaultValue={data.project.priority}>
              <option>NORMALE</option>
              <option>HAUTE</option>
              <option>URGENTE</option>
            </select>
          </Field>
          <Field label="Échéance">
            <input
              name="ends_on"
              type="date"
              defaultValue={data.project.ends_on || ""}
            />
          </Field>
          <Field label="Description" wide>
            <textarea
              name="description"
              defaultValue={data.project.description || ""}
            />
          </Field>
        </div>
        {rights.update && <button className="primary-btn compact">Mettre à jour le projet</button>}</fieldset>
      </form>
      <DetailList
        title="Tâches"
        rows={data.tasks.map((x) => [
          x.title,
          `${label(x.status)} · ${x.profiles?.full_name || "Non assignée"}`,
          fmt(x.due_at),
        ])}
      />
      <DetailList
        title="Factures"
        rows={data.invoices.map((x) => [
          x.number,
          label(x.status),
          money(x.total, x.currency),
        ])}
      />
      {rights.delete && (
        <div className="danger-zone">
          <Danger
            onClick={async () => {
              if (
                confirm(
                  `Supprimer le projet ${data.project.name} et ses tâches ?`,
                )
              ) {
                await deleteProject(id);
                onChanged();
                onClose();
              }
            }}
          />
        </div>
      )}
    </Modal>
  );
}
function ProjectsPage({ rights, clientFilter, onClearFilter }: { rights: CrudRights; clientFilter?: string | null; onClearFilter?: () => void }) {
  const [rows, setRows] = useState<Project[]>([]),
    [clients, setClients] = useState<Client[]>([]),
    [profiles, setProfiles] = useState<Profile[]>([]),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState("");
  const load = () => listProjects().then(setRows).catch((e) => setError(e.message));
  const openCreator = () => {
    setOpen(true);
    if (!clients.length || !profiles.length) void Promise.all([listClients(), listProfiles()]).then(([a, b]) => { setClients(a); setProfiles(b); }).catch((e) => setError(e.message));
  };
  useEffect(() => {
    void load();
  }, []);
  const displayedRows = clientFilter ? rows.filter((row) => row.client_id === clientFilter) : rows;
  return (
    <>
      <Header
        title="Projets"
        copy="Suivi détaillé, équipe, progression, tâches et facturation."
        onAdd={rights.create ? openCreator : undefined}
        add="Nouveau projet"
      />
      {clientFilter && <div className="filter-banner"><span>Affichage des projets du client sélectionné.</span><button type="button" onClick={onClearFilter}>Afficher tous les projets</button></div>}
      <ErrorBar value={error} />
      <div className="records panel">
        {!displayedRows.length ? (
          <Empty name="projet" onAdd={rights.create ? openCreator : undefined} />
        ) : (
          displayedRows.map((r) => (
            <article
              className="clickable-row"
              key={r.id}
              onClick={() => setSelected(r.id)}
            >
              <div className="record-main">
                <span className="record-avatar">PR</span>
                <div>
                  <strong>{r.name}</strong>
                  <small>
                    {r.clients?.name || "Sans client"} ·{" "}
                    {r.profiles?.full_name || "Sans manager"}
                  </small>
                </div>
              </div>
              <span className="status">{label(r.status)}</span>
              <span className="record-meta">
                <i className="mini-progress">
                  <b style={{ width: `${r.progress}%` }} />
                </i>
                {r.progress}%
              </span>
              <b className="record-amount">
                {money(r.budget, r.currency)} <ChevronRight />
              </b>
            </article>
          ))
        )}
      </div>
      <AnimatePresence>
        {open && (
          <Modal title="Créer un projet" onClose={() => setOpen(false)}>
            <form
              className="entity-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = Object.fromEntries(
                  new FormData(e.currentTarget),
                ) as Record<string, string>;
                await createProject({
                  ...f,
                  budget: Number(f.budget),
                  manager_id: f.manager_id || null,
                } as Partial<Project>);
                setOpen(false);
                load();
              }}
            >
              <div className="form-grid">
                <Field label="Nom">
                  <input name="name" required />
                </Field>
                <Field label="Client">
                  <select name="client_id" required>
                    <option value="">Choisir…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Responsable">
                  <select name="manager_id">
                    <option value="">Non affecté</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Type">
                  <input name="type" />
                </Field>
                <Field label="Budget">
                  <input name="budget" type="number" min="0" />
                </Field>
                <Field label="Fin prévue">
                  <input name="ends_on" type="date" />
                </Field>
                <Field label="Description" wide>
                  <textarea name="description" />
                </Field>
              </div>
              <button className="primary-btn compact">Créer</button>
            </form>
          </Modal>
        )}
        {selected && (
          <ProjectDetail
            id={selected}
            onClose={() => setSelected(null)}
            onChanged={load}
            rights={rights}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function TasksPage({
  rights,
  planning = false,
  clientFilter,
  onClearFilter,
}: {
  rights: CrudRights;
  planning?: boolean;
  clientFilter?: string | null;
  onClearFilter?: () => void;
}) {
  const [rows, setRows] = useState<Task[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [profiles, setProfiles] = useState<Profile[]>([]),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<Task | null>(null),
    [calendarConnection, setCalendarConnection] =
      useState<CalendarConnection | null>(null),
    [calendarBusy, setCalendarBusy] = useState(false),
    [error, setError] = useState("");
  const load = () => listTasks().then(setRows).catch((e) => setError(e.message));
  const loadReferences = () => {
    if (!projects.length || !profiles.length) void Promise.all([listProjects(), listProfiles()]).then(([a, b]) => { setProjects(a); setProfiles(b); }).catch((e) => setError(e.message));
  };
  const openCreator = () => { setOpen(true); loadReferences(); };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (planning) {
      void getCalendarConnection()
        .then(setCalendarConnection)
        .catch((e) => setError(e.message));
      const params = new URLSearchParams(location.search);
      const state = params.get("calendar");
      if (state === "connected") {
        setError("");
        void getCalendarConnection().then(setCalendarConnection);
      } else if (state) {
        setError(state === "invalid_state" ? "La demande Google a expiré. Cliquez à nouveau sur Connecter Google Agenda." : "La connexion Google Agenda n’a pas abouti. Vérifiez le compte Google choisi puis réessayez.");
      }
      if (state) {
        params.delete("calendar");
        history.replaceState({}, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
      }
    }
  }, [planning]);
  const calendar = (t: Task) => {
    const start = t.due_at ? new Date(t.due_at) : new Date();
    const end = new Date(start.getTime() + 3600000);
    const g = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(t.title)}&dates=${g(start)}/${g(end)}&details=${encodeURIComponent(t.description || "Tâche Smartsell")}`;
  };
  const displayedRows = clientFilter ? rows.filter((row) => row.projects?.client_id === clientFilter) : rows;
  return (
    <>
      <Header
        title={planning ? "Planning" : "Tâches"}
        copy={
          planning
            ? "Échéances, rappels personnalisés et ajout dans Google Agenda."
            : "Affectation, statut, priorité et alertes multicanales."
        }
        onAdd={rights.create ? openCreator : undefined}
        add="Nouvelle tâche"
      />
      {clientFilter && <div className="filter-banner"><span>Affichage des tâches du client sélectionné.</span><button type="button" onClick={onClearFilter}>Afficher toutes les tâches</button></div>}
      {planning && (
        <section className="panel calendar-connection">
          <div className="channel-icon">
            <CalendarDays />
          </div>
          <div>
            <strong>Synchronisation Google Agenda</strong>
            <p>
              {calendarConnection?.connected
                ? `Connecté à ${calendarConnection.calendar_email || "Google Agenda"}. Les tâches assignées sont synchronisées automatiquement.`
                : "Chaque collaborateur connecte une seule fois son propre compte Google. Ses tâches assignées apparaissent ensuite automatiquement dans son agenda."}
            </p>
          </div>
          {calendarConnection?.connected ? (
            <span className="status">Connecté</span>
          ) : (
            <button
              className="primary-btn compact"
              disabled={calendarBusy}
              onClick={async () => {
                try {
                  setCalendarBusy(true);
                  await connectGoogleCalendar();
                } catch (e) {
                  setCalendarBusy(false);
                  setError(
                    e instanceof Error ? e.message : "Connexion impossible",
                  );
                }
              }}
            >
              <CalendarDays />
              {calendarBusy ? "Connexion…" : "Connecter Google Agenda"}
            </button>
          )}
        </section>
      )}
      {planning && <div className="smart-reminder-note"><Bell/><div><strong>3 rappels SMS intelligents</strong><span>Ils sont répartis à 50 %, 80 % et 95 % du délai disponible. Le lien du SMS permet de confirmer la tâche et d’arrêter immédiatement les rappels suivants.</span></div></div>}
      <ErrorBar value={error} />
      <div className="records panel">
        {!displayedRows.length ? (
          <Empty name="tâche" onAdd={rights.create ? openCreator : undefined} />
        ) : (
          displayedRows.map((r) => (
            <article
              className="clickable-row"
              key={r.id}
              onClick={() => { setSelected(r); loadReferences(); }}
            >
              <div className="record-main">
                <span className="record-avatar">✓</span>
                <div>
                  <strong>{r.title}</strong>
                  <small>
                    {r.projects?.name || "Sans projet"} ·{" "}
                    {r.profiles?.full_name || "Non assignée"}
                  </small>
                </div>
              </div>
              <span className="status">{label(r.status)}</span>
              <span className="record-meta">
                {fmt(r.due_at)} · 3 rappels automatiques
              </span>
              <b className="record-amount">
                {planning ? (
                  <a
                    href={calendar(r)}
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Google Agenda
                  </a>
                ) : (
                  label(r.priority)
                )}{" "}
                <ChevronRight />
              </b>
            </article>
          ))
        )}
      </div>
      <AnimatePresence>
        {open && (
          <Modal
            title="Créer une tâche et ses rappels"
            onClose={() => setOpen(false)}
          >
            <form
              className="entity-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await createTask({
                  title: String(f.get("title")),
                  project_id: String(f.get("project_id") || "") || null,
                  assignee_id: String(f.get("assignee_id") || "") || null,
                  priority: String(f.get("priority")),
                  due_at: String(f.get("due_at") || "") || null,
                  description: String(f.get("description") || ""),
                  reminder_minutes: Number(f.get("reminder_minutes") || 30),
                  notification_channels: f.getAll(
                    "notification_channels",
                  ) as string[],
                });
                setOpen(false);
                load();
              }}
            >
              <div className="form-grid">
                <Field label="Titre">
                  <input name="title" required />
                </Field>
                <Field label="Projet">
                  <select name="project_id">
                    <option value="">Sans projet</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Assignée à">
                  <select name="assignee_id">
                    <option value="">Non assignée</option>
                    {profiles
                      .filter((p) => p.active)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Priorité">
                  <select name="priority">
                    <option>NORMALE</option>
                    <option>HAUTE</option>
                    <option>URGENTE</option>
                  </select>
                </Field>
                <Field label="Échéance">
                  <input name="due_at" type="datetime-local" required />
                </Field>
                <Field label="Rappel avant">
                  <select name="reminder_minutes" defaultValue="30">
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 heure</option>
                    <option value="120">2 heures</option>
                    <option value="1440">1 jour</option>
                  </select>
                </Field>
                <Field label="Canaux d’alerte" wide>
                  <div className="check-options">
                    <label>
                      <input
                        name="notification_channels"
                        type="checkbox"
                        value="IN_APP"
                        defaultChecked
                      />{" "}
                      Application
                    </label>
                    <label>
                      <input
                        name="notification_channels"
                        type="checkbox"
                        value="EMAIL"
                      />{" "}
                      E-mail
                    </label>
                    <label>
                      <input
                        name="notification_channels"
                        type="checkbox"
                        value="SMS"
                        defaultChecked
                      />{" "}
                      SMS
                    </label>
                  </div>
                  <small>Le SMS est envoyé au numéro enregistré dans le profil du collaborateur. Trois messages différents seront programmés automatiquement.</small>
                </Field>
                <Field label="Description" wide>
                  <textarea name="description" />
                </Field>
              </div>
              <button className="primary-btn compact">
                Créer et programmer
              </button>
            </form>
          </Modal>
        )}
        {selected && (
          <Modal title={selected.title} onClose={() => setSelected(null)}>
            <form
              className="entity-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!rights.update) return;
                const f = Object.fromEntries(
                  new FormData(e.currentTarget),
                ) as Record<string, string>;
                await updateTask(selected.id, {
                  title: f.title,
                  description: f.description,
                  status: f.status,
                  priority: f.priority,
                  due_at: f.due_at || null,
                  assignee_id: f.assignee_id || null,
                });
                setSelected(null);
                load();
              }}
            >
              <fieldset disabled={!rights.update} className="permission-fieldset"><div className="form-grid">
                <Field label="Titre">
                  <input name="title" defaultValue={selected.title} />
                </Field>
                <Field label="Statut">
                  <select name="status" defaultValue={selected.status}>
                    <option>A_FAIRE</option>
                    <option>EN_COURS</option>
                    <option>EN_REVUE</option>
                    <option>TERMINE</option>
                    <option>BLOQUE</option>
                  </select>
                </Field>
                <Field label="Assignée à">
                  <select
                    name="assignee_id"
                    defaultValue={selected.assignee_id || ""}
                  >
                    <option value="">Non assignée</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Priorité">
                  <select name="priority" defaultValue={selected.priority}>
                    <option>NORMALE</option>
                    <option>HAUTE</option>
                    <option>URGENTE</option>
                  </select>
                </Field>
                <Field label="Échéance">
                  <input
                    name="due_at"
                    type="datetime-local"
                    defaultValue={selected.due_at?.slice(0, 16) || ""}
                  />
                </Field>
                <Field label="Description" wide>
                  <textarea
                    name="description"
                    defaultValue={selected.description || ""}
                  />
                </Field>
              </div></fieldset>
              <div className="form-actions">
                <a
                  className="ghost-action"
                  href={calendar(selected)}
                  target="_blank"
                >
                  <CalendarDays />
                  Google Agenda
                </a>
                {rights.update && <button className="primary-btn compact">Enregistrer</button>}
                {rights.delete && (
                  <Danger
                    onClick={async () => {
                      if (confirm("Supprimer cette tâche ?")) {
                        await deleteTask(selected.id);
                        setSelected(null);
                        load();
                      }
                    }}
                  />
                )}
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function ServicesPage({ admin }: { admin: boolean }) {
  const [rows, setRows] = useState<Service[]>([]),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<Service | null>(null);
  const load = () => listServices().then(setRows);
  useEffect(() => {
    void load();
  }, []);
  const form = (item?: Service) => (
    <form
      className="entity-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<
          string,
          string
        >;
        const input = {
          name: f.name,
          category: f.category,
          description: f.description,
          unit: f.unit,
          unit_price: Number(f.unit_price),
          currency: f.currency,
          tax_rate: Number(f.tax_rate),
          active: true,
        };
        item ? await updateService(item.id, input) : await createService(input);
        setOpen(false);
        setSelected(null);
        load();
      }}
    >
      <div className="form-grid">
        <Field label="Service">
          <input name="name" required defaultValue={item?.name} />
        </Field>
        <Field label="Catégorie">
          <input name="category" defaultValue={item?.category || ""} />
        </Field>
        <Field label="Unité">
          <input name="unit" defaultValue={item?.unit || "Prestation"} />
        </Field>
        <Field label="Prix unitaire">
          <input
            name="unit_price"
            type="number"
            min="0"
            defaultValue={item?.unit_price || 0}
          />
        </Field>
        <Field label="Devise">
          <select name="currency" defaultValue={item?.currency || "GNF"}>
            <option>GNF</option>
            <option>EUR</option>
            <option>USD</option>
          </select>
        </Field>
        <Field label="Taxe %">
          <input
            name="tax_rate"
            type="number"
            min="0"
            defaultValue={item?.tax_rate || 0}
          />
        </Field>
        <Field label="Description" wide>
          <textarea name="description" defaultValue={item?.description || ""} />
        </Field>
      </div>
      <div className="form-actions">
        <button className="primary-btn compact">Enregistrer</button>
        {item && admin && (
          <Danger
            onClick={async () => {
              if (confirm("Supprimer ce service ?")) {
                await deleteService(item.id);
                setSelected(null);
                load();
              }
            }}
          />
        )}
      </div>
    </form>
  );
  return (
    <>
      <Header
        title="Catalogue de services"
        copy="Prestations réutilisables dans les devis, factures et bons."
        onAdd={() => setOpen(true)}
        add="Nouveau service"
      />
      <div className="records panel">
        {!rows.length ? (
          <Empty name="service" onAdd={() => setOpen(true)} />
        ) : (
          rows.map((r) => (
            <article
              className="clickable-row"
              key={r.id}
              onClick={() => setSelected(r)}
            >
              <div className="record-main">
                <span className="record-avatar">SV</span>
                <div>
                  <strong>{r.name}</strong>
                  <small>
                    {r.category || "Sans catégorie"} · par {r.unit}
                  </small>
                </div>
              </div>
              <span className="status">{r.active ? "Actif" : "Inactif"}</span>
              <span className="record-meta">Taxe {r.tax_rate}%</span>
              <b className="record-amount">
                {money(r.unit_price, r.currency)} <ChevronRight />
              </b>
            </article>
          ))
        )}
      </div>
      <AnimatePresence>
        {open && (
          <Modal title="Nouveau service" onClose={() => setOpen(false)}>
            {form()}
          </Modal>
        )}
        {selected && (
          <Modal title={selected.name} onClose={() => setSelected(null)}>
            {form(selected)}
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function InvoiceView({
  invoice,
  onClose,
}: {
  invoice: Invoice;
  onClose: () => void;
}) {
  const paid = (invoice.payments || []).reduce(
    (s, p) => s + Number(p.amount),
    0,
  );
  return (
    <Modal title={`Facture ${invoice.number}`} onClose={onClose}>
      <div className="invoice-sheet">
        <div className="invoice-brand">
          <img src={companyProfile.logo_dark} />
          <div>
            <strong>{companyProfile.company_name}</strong>
            <span>
              {companyProfile.address}
              <br />
              {companyProfile.email} · {companyProfile.phone}
            </span>
          </div>
        </div>
        <div className="invoice-meta">
          <div>
            <small>FACTURÉ À</small>
            <strong>{invoice.clients?.name}</strong>
            <span>
              {invoice.clients?.address}
              <br />
              {invoice.clients?.email}
            </span>
          </div>
          <div>
            <small>FACTURE</small>
            <strong>{invoice.number}</strong>
            <span>
              Émise le {fmt(invoice.issue_date)}
              <br />
              Échéance {fmt(invoice.due_date)}
            </span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qté</th>
              <th>Prix</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.invoice_items?.map((x, i) => (
              <tr key={i}>
                <td>{x.description}</td>
                <td>{x.quantity}</td>
                <td>{money(x.unit_price, invoice.currency)}</td>
                <td>
                  {money(
                    x.quantity * x.unit_price * (1 + x.tax_rate / 100),
                    invoice.currency,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="invoice-total">
          <span>Total</span>
          <strong>{money(invoice.total, invoice.currency)}</strong>
          <span>Payé</span>
          <b>{money(paid, invoice.currency)}</b>
          <span>Solde</span>
          <strong>
            {money(Math.max(0, invoice.total - paid), invoice.currency)}
          </strong>
        </div>
      </div>
      <button
        className="primary-btn compact no-print"
        onClick={() => window.print()}
      >
        Imprimer / PDF
      </button>
    </Modal>
  );
}
function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]),
    [payments, setPayments] = useState<Payment[]>([]),
    [clients, setClients] = useState<Client[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [services, setServices] = useState<Service[]>([]),
    [mode, setMode] = useState<"invoice" | "payment" | null>(null),
    [selected, setSelected] = useState<Invoice | null>(null),
    [items, setItems] = useState<InvoiceItem[]>([
      { description: "", quantity: 1, unit_price: 0, tax_rate: 0 },
    ]);
  const load = () =>
    Promise.all([
      listInvoices(),
      listPayments(),
      listClients(),
      listProjects(),
      listServices(),
    ]).then(([a, b, c, d, e]) => {
      setInvoices(a);
      setPayments(b);
      setClients(c);
      setProjects(d);
      setServices(e);
    });
  useEffect(() => {
    void load();
  }, []);
  const outstanding = invoices.filter((x) => x.status !== "PAYEE");
  return (
    <>
      <Header
        title="Facturation"
        copy="Génération de factures PDF, lignes de services et rapprochement des paiements."
        onAdd={() => setMode("invoice")}
        add="Nouvelle facture"
      />
      <div className="toolbar-actions">
        <button onClick={() => setMode("payment")}>
          <WalletCards />
          Enregistrer un paiement
        </button>
      </div>
      <div className="records panel">
        {!invoices.length ? (
          <Empty name="facture" onAdd={() => setMode("invoice")} />
        ) : (
          invoices.map((r) => (
            <article
              className="clickable-row"
              key={r.id}
              onClick={() => setSelected(r)}
            >
              <div className="record-main">
                <span className="record-avatar">FA</span>
                <div>
                  <strong>{r.number}</strong>
                  <small>
                    {r.clients?.name} · {r.projects?.name || "Sans projet"}
                  </small>
                </div>
              </div>
              <span className="status">{label(r.status)}</span>
              <span className="record-meta">Échéance {fmt(r.due_date)}</span>
              <b className="record-amount">
                {money(r.total, r.currency)} <ChevronRight />
              </b>
            </article>
          ))
        )}
      </div>
      <AnimatePresence>
        {mode === "invoice" && (
          <Modal title="Créer une facture" onClose={() => setMode(null)}>
            <form
              className="entity-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = Object.fromEntries(
                  new FormData(e.currentTarget),
                ) as Record<string, string>;
                await createInvoice({
                  client_id: f.client_id,
                  project_id: f.project_id,
                  due_date: f.due_date,
                  currency: f.currency,
                  discount: 0,
                  items,
                });
                setMode(null);
                setItems([
                  { description: "", quantity: 1, unit_price: 0, tax_rate: 0 },
                ]);
                load();
              }}
            >
              <div className="form-grid">
                <Field label="Client">
                  <select name="client_id" required>
                    <option value="">Choisir…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Projet">
                  <select name="project_id">
                    <option value="">Sans projet</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Échéance">
                  <input name="due_date" type="date" required />
                </Field>
                <Field label="Devise">
                  <select name="currency">
                    <option>GNF</option>
                    <option>EUR</option>
                    <option>USD</option>
                  </select>
                </Field>
              </div>
              <div className="service-picker">
                <span>Ajouter depuis le catalogue</span>
                {services
                  .filter((x) => x.active)
                  .map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() =>
                        setItems([
                          ...items,
                          {
                            description: s.name,
                            quantity: 1,
                            unit_price: Number(s.unit_price),
                            tax_rate: Number(s.tax_rate),
                          },
                        ])
                      }
                    >
                      {s.name} · {money(s.unit_price, s.currency)}
                    </button>
                  ))}
              </div>
              <div className="invoice-lines">
                {items.map((it, i) => (
                  <div className="invoice-line" key={i}>
                    <input
                      placeholder="Description"
                      value={it.description}
                      onChange={(e) =>
                        setItems(
                          items.map((x, j) =>
                            j === i ? { ...x, description: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <input
                      aria-label="Quantité"
                      type="number"
                      min="1"
                      value={it.quantity}
                      onChange={(e) =>
                        setItems(
                          items.map((x, j) =>
                            j === i
                              ? { ...x, quantity: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                    <input
                      aria-label="Prix"
                      type="number"
                      min="0"
                      value={it.unit_price}
                      onChange={(e) =>
                        setItems(
                          items.map((x, j) =>
                            j === i
                              ? { ...x, unit_price: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                    <input
                      aria-label="Taxe"
                      type="number"
                      min="0"
                      value={it.tax_rate}
                      onChange={(e) =>
                        setItems(
                          items.map((x, j) =>
                            j === i
                              ? { ...x, tax_rate: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="ghost-action"
                onClick={() =>
                  setItems([
                    ...items,
                    {
                      description: "",
                      quantity: 1,
                      unit_price: 0,
                      tax_rate: 0,
                    },
                  ])
                }
              >
                <Plus />
                Ajouter une ligne
              </button>
              <button className="primary-btn compact">
                Générer la facture
              </button>
            </form>
          </Modal>
        )}
        {mode === "payment" && (
          <Modal title="Enregistrer un paiement" onClose={() => setMode(null)}>
            <form
              className="entity-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = Object.fromEntries(
                  new FormData(e.currentTarget),
                ) as Record<string, string>;
                await recordPayment({
                  invoice_id: f.invoice_id,
                  amount: Number(f.amount),
                  method: f.method,
                  reference: f.reference,
                });
                setMode(null);
                load();
              }}
            >
              <div className="form-grid">
                <Field label="Facture" wide>
                  <select name="invoice_id" required>
                    {outstanding.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.number} · {i.clients?.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Montant">
                  <input name="amount" type="number" min="1" required />
                </Field>
                <Field label="Mode">
                  <select name="method">
                    <option>Virement</option>
                    <option>Espèces</option>
                    <option>Mobile Money</option>
                    <option>Chèque</option>
                  </select>
                </Field>
                <Field label="Référence" wide>
                  <input name="reference" />
                </Field>
              </div>
              <button className="primary-btn compact">Valider</button>
            </form>
          </Modal>
        )}
        {selected && (
          <InvoiceView invoice={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
      <p className="module-footnote">
        {payments.length} paiement(s) enregistré(s).
      </p>
    </>
  );
}

function EditorialPage() {
  const [rows, setRows] = useState<EditorialItem[]>([]),
    [clients, setClients] = useState<Client[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<EditorialItem | null>(null);
  const load = () =>
    Promise.all([listEditorialItems(), listClients(), listProjects()]).then(
      ([a, b, c]) => {
        setRows(a);
        setClients(b);
        setProjects(c);
      },
    );
  useEffect(() => {
    void load();
  }, []);
  const form = (item?: EditorialItem) => (
    <form
      className="entity-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<
          string,
          string
        >;
        const input = {
          title: f.title,
          client_id: f.client_id || null,
          project_id: f.project_id || null,
          platform: f.platform,
          content_type: f.content_type,
          caption: f.caption,
          publish_at: f.publish_at || null,
          published_url: f.published_url || null,
          status: f.status,
        };
        item
          ? await updateEditorialItem(item.id, input)
          : await createEditorialItem(input);
        setOpen(false);
        setSelected(null);
        load();
      }}
    >
      <div className="form-grid">
        <Field label="Publication">
          <input name="title" required defaultValue={item?.title} />
        </Field>
        <Field label="Client">
          <select name="client_id" defaultValue={item?.client_id || ""}>
            <option value="">Choisir…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Projet">
          <select name="project_id" defaultValue={item?.project_id || ""}>
            <option value="">Sans projet</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Plateforme">
          <select name="platform" defaultValue={item?.platform || "Instagram"}>
            <option>Instagram</option>
            <option>Facebook</option>
            <option>LinkedIn</option>
            <option>TikTok</option>
            <option>YouTube</option>
            <option>Site web</option>
          </select>
        </Field>
        <Field label="Format">
          <input name="content_type" defaultValue={item?.content_type || ""} />
        </Field>
        <Field label="Publication prévue">
          <input
            name="publish_at"
            type="datetime-local"
            defaultValue={item?.publish_at?.slice(0, 16) || ""}
          />
        </Field>
        <Field label="Statut">
          <select name="status" defaultValue={item?.status || "A_REDIGER"}>
            <option>A_REDIGER</option>
            <option>EN_CREATION</option>
            <option>A_VALIDER</option>
            <option>PLANIFIE</option>
            <option>PUBLIE</option>
          </select>
        </Field>
        <Field label="Lien publié">
          <input
            name="published_url"
            type="url"
            defaultValue={item?.published_url || ""}
          />
        </Field>
        <Field label="Légende" wide>
          <textarea name="caption" defaultValue={item?.caption || ""} />
        </Field>
      </div>
      <div className="form-actions">
        <button className="primary-btn compact">Enregistrer</button>
        {item && (
          <Danger
            onClick={async () => {
              if (confirm("Supprimer cette publication ?")) {
                await deleteEditorialItem(item.id);
                setSelected(null);
                load();
              }
            }}
          />
        )}
      </div>
    </form>
  );
  return (
    <>
      <Header
        title="Calendrier éditorial"
        copy="Planification, validation, publication et lien final communiqué au client."
        onAdd={() => setOpen(true)}
        add="Nouvelle publication"
      />
      <div className="editorial-board">
        {["A_REDIGER", "EN_CREATION", "A_VALIDER", "PLANIFIE", "PUBLIE"].map(
          (s) => (
            <section className="editorial-column" key={s}>
              <h3>
                {label(s)} <b>{rows.filter((x) => x.status === s).length}</b>
              </h3>
              {rows
                .filter((x) => x.status === s)
                .map((x) => (
                  <button key={x.id} onClick={() => setSelected(x)}>
                    <strong>{x.title}</strong>
                    <span>
                      {x.clients?.name || "Sans client"} · {x.platform}
                    </span>
                    <small>{fmt(x.publish_at)}</small>
                  </button>
                ))}
            </section>
          ),
        )}
      </div>
      <AnimatePresence>
        {open && (
          <Modal
            title="Planifier une publication"
            onClose={() => setOpen(false)}
          >
            {form()}
          </Modal>
        )}
        {selected && (
          <Modal title={selected.title} onClose={() => setSelected(null)}>
            {form(selected)}
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function DocumentsPage() {
  const [rows, setRows] = useState<CommercialDocument[]>([]),
    [clients, setClients] = useState<Client[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<CommercialDocument | null>(null);
  const load = () =>
    Promise.all([
      listCommercialDocuments(),
      listClients(),
      listProjects(),
    ]).then(([a, b, c]) => {
      setRows(a);
      setClients(b);
      setProjects(c);
    });
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <Header
        title="Documents commerciaux"
        copy="Bons de commande, livraison, vente et sortie de matériel."
        onAdd={() => setOpen(true)}
        add="Nouveau bon"
      />
      <div className="records panel">
        {!rows.length ? (
          <Empty name="document" onAdd={() => setOpen(true)} />
        ) : (
          rows.map((r) => (
            <article
              className="clickable-row"
              key={r.id}
              onClick={() => setSelected(r)}
            >
              <div className="record-main">
                <span className="record-avatar">{r.number.slice(0, 2)}</span>
                <div>
                  <strong>{r.number}</strong>
                  <small>
                    {label(r.kind)} · {r.clients?.name}
                  </small>
                </div>
              </div>
              <span className="status">{label(r.status)}</span>
              <span className="record-meta">{fmt(r.issue_date)}</span>
              <b className="record-amount">
                {money(r.total, r.currency)} <ChevronRight />
              </b>
            </article>
          ))
        )}
      </div>
      <AnimatePresence>
        {open && (
          <Modal title="Créer un document" onClose={() => setOpen(false)}>
            <form
              className="entity-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = Object.fromEntries(
                  new FormData(e.currentTarget),
                ) as Record<string, string>;
                await createCommercialDocument({
                  ...f,
                  total: Number(f.total),
                } as Partial<CommercialDocument>);
                setOpen(false);
                load();
              }}
            >
              <div className="form-grid">
                <Field label="Type">
                  <select name="kind">
                    <option value="BON_COMMANDE">Bon de commande</option>
                    <option value="BON_LIVRAISON">Bon de livraison</option>
                    <option value="BON_VENTE">Bon de vente</option>
                    <option value="BON_SORTIE">Bon de sortie matériel</option>
                  </select>
                </Field>
                <Field label="Client">
                  <select name="client_id" required>
                    <option value="">Choisir…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Projet">
                  <select name="project_id">
                    <option value="">Sans projet</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Date prévue">
                  <input name="expected_date" type="date" />
                </Field>
                <Field label="Montant">
                  <input name="total" type="number" min="0" defaultValue="0" />
                </Field>
                <Field label="Devise">
                  <select name="currency">
                    <option>GNF</option>
                    <option>EUR</option>
                    <option>USD</option>
                  </select>
                </Field>
                <Field label="Notes" wide>
                  <textarea name="notes" />
                </Field>
              </div>
              <button className="primary-btn compact">Générer</button>
            </form>
          </Modal>
        )}
        {selected && (
          <Modal title={selected.number} onClose={() => setSelected(null)}>
            <div className="document-preview">
              <span className="eyebrow">
                <i /> {label(selected.kind)}
              </span>
              <h2>{selected.number}</h2>
              <p>
                <strong>Client :</strong> {selected.clients?.name}
              </p>
              <p>
                <strong>Projet :</strong> {selected.projects?.name || "—"}
              </p>
              <p>
                <strong>Montant :</strong>{" "}
                {money(selected.total, selected.currency)}
              </p>
              <p>{selected.notes}</p>
              <div className="form-actions">
                <button
                  className="primary-btn compact"
                  onClick={() => window.print()}
                >
                  Imprimer / PDF
                </button>
                <button
                  className="ghost-action"
                  onClick={async () => {
                    await updateCommercialDocument(selected.id, {
                      status: "VALIDE",
                    });
                    setSelected(null);
                    load();
                  }}
                >
                  Valider
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function AccountingPage() {
  const [rows, setRows] = useState<Expense[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [open, setOpen] = useState(false);
  const load = () =>
    Promise.all([listExpenses(), listProjects()]).then(([a, b]) => {
      setRows(a);
      setProjects(b);
    });
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <Header
        title="Comptabilité"
        copy="Dépenses, catégories, projets et suivi financier."
        onAdd={() => setOpen(true)}
        add="Nouvelle dépense"
      />
      <section className="production-kpis">
        <Stat
          name="Dépenses"
          value={money(rows.reduce((s, x) => s + Number(x.amount), 0))}
          copy={`${rows.length} opération(s)`}
        />
        <Stat
          name="À approuver"
          value={rows.filter((x) => x.status === "BROUILLON").length}
          copy="dépenses en attente"
        />
        <Stat
          name="Projets concernés"
          value={new Set(rows.map((x) => x.project_id).filter(Boolean)).size}
          copy="centres de coûts"
        />
      </section>
      <div className="records panel spaced">
        {rows.map((r) => (
          <article key={r.id}>
            <div className="record-main">
              <span className="record-avatar">DP</span>
              <div>
                <strong>{r.description}</strong>
                <small>{r.projects?.name || "Frais généraux"}</small>
              </div>
            </div>
            <span className="status">{label(r.status)}</span>
            <span className="record-meta">
              {r.category || "Autre"} · {fmt(r.spent_on)}
            </span>
            <b className="record-amount">{money(r.amount, r.currency)}</b>
          </article>
        ))}
      </div>
      <AnimatePresence>
        {open && (
          <Modal title="Enregistrer une dépense" onClose={() => setOpen(false)}>
            <form
              className="entity-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = Object.fromEntries(
                  new FormData(e.currentTarget),
                ) as Record<string, string>;
                await createExpense({
                  ...f,
                  amount: Number(f.amount),
                } as Partial<Expense>);
                setOpen(false);
                load();
              }}
            >
              <div className="form-grid">
                <Field label="Description">
                  <input name="description" required />
                </Field>
                <Field label="Catégorie">
                  <input name="category" />
                </Field>
                <Field label="Projet">
                  <select name="project_id">
                    <option value="">Frais généraux</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Montant">
                  <input name="amount" type="number" min="0" required />
                </Field>
                <Field label="Date">
                  <input name="spent_on" type="date" required />
                </Field>
                <Field label="Devise">
                  <select name="currency">
                    <option>GNF</option>
                    <option>EUR</option>
                    <option>USD</option>
                  </select>
                </Field>
              </div>
              <button className="primary-btn compact">Enregistrer</button>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function EquipmentPage() {
  const [rows, setRows] = useState<Equipment[]>([]),
    [open, setOpen] = useState(false);
  const load = () => listEquipment().then(setRows);
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <Header
        title="Matériel"
        copy="Inventaire, numéros de série, état et disponibilité."
        onAdd={() => setOpen(true)}
        add="Nouveau matériel"
      />
      <div className="records panel">
        {!rows.length ? (
          <Empty name="matériel" onAdd={() => setOpen(true)} />
        ) : (
          rows.map((r) => (
            <article key={r.id}>
              <div className="record-main">
                <span className="record-avatar">MT</span>
                <div>
                  <strong>{r.name}</strong>
                  <small>
                    {r.code} · {r.serial_number || "Sans numéro de série"}
                  </small>
                </div>
              </div>
              <span className="status">{label(r.status)}</span>
              <span className="record-meta">{r.category || "Autre"}</span>
              <b className="record-amount">{r.condition || "—"}</b>
            </article>
          ))
        )}
      </div>
      <AnimatePresence>
        {open && (
          <Modal title="Ajouter du matériel" onClose={() => setOpen(false)}>
            <form
              className="entity-form"
              onSubmit={async (e) => {
                e.preventDefault();
                await createEquipment(
                  Object.fromEntries(
                    new FormData(e.currentTarget),
                  ) as Partial<Equipment>,
                );
                setOpen(false);
                load();
              }}
            >
              <div className="form-grid">
                <Field label="Code">
                  <input name="code" required />
                </Field>
                <Field label="Désignation">
                  <input name="name" required />
                </Field>
                <Field label="Catégorie">
                  <input name="category" />
                </Field>
                <Field label="N° de série">
                  <input name="serial_number" />
                </Field>
                <Field label="État">
                  <input name="condition" />
                </Field>
                <Field label="Statut">
                  <select name="status">
                    <option>DISPONIBLE</option>
                    <option>EN_MISSION</option>
                    <option>MAINTENANCE</option>
                    <option>HORS_SERVICE</option>
                  </select>
                </Field>
                <Field label="Notes" wide>
                  <textarea name="notes" />
                </Field>
              </div>
              <button className="primary-btn compact">Enregistrer</button>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function CommunicationPage({ onBack }: { onBack: () => void }) {
  const [channel, setChannel] = useState<"SMS" | "EMAIL">("SMS"),
    [to, setTo] = useState(""),
    [message, setMessage] = useState(""),
    [result, setResult] = useState(""),
    [busy, setBusy] = useState(false),
    [contacts, setContacts] = useState<ImportedContact[]>([]),
    [selectedContacts, setSelectedContacts] = useState<string[]>([]),
    [sheetUrl, setSheetUrl] = useState(""),
    [importBusy, setImportBusy] = useState(false);
  type PhoneContact = { name?: string[]; tel?: string[]; email?: string[] };
  type ContactsManager = {
    getProperties: () => Promise<string[]>;
    select: (properties: string[], options: { multiple: boolean }) => Promise<PhoneContact[]>;
  };
  const contactsManager = (navigator as Navigator & { contacts?: ContactsManager }).contacts;
  const phoneDirectoryAvailable = Boolean(contactsManager && window.isSecureContext);
  const availableContacts = contacts.filter((contact) => channel === "SMS" ? contact.phone : contact.email);
  const mergeContacts = (next: ImportedContact[]) => {
    setContacts((current) => {
      const merged = [...current];
      next.forEach((contact) => {
        if (!merged.some((item) => (contact.phone && item.phone === contact.phone) || (contact.email && item.email === contact.email))) merged.push(contact);
      });
      return merged;
    });
    setResult(`${next.length} contact(s) importé(s). Sélectionnez les destinataires à ajouter.`);
  };
  const importFile = async (file: File) => {
    setImportBusy(true); setResult("");
    try { mergeContacts(await contactsFromFile(file)); }
    catch (error) { setResult(error instanceof Error ? error.message : "Import impossible"); }
    finally { setImportBusy(false); }
  };
  const importGoogleSheet = async () => {
    setImportBusy(true); setResult("");
    try {
      const response = await fetch(googleSheetCsvUrl(sheetUrl));
      if (!response.ok) throw new Error("Le Google Sheet doit être partagé en lecture ou publié sur le Web.");
      mergeContacts(contactsFromCsv(await response.text()));
    } catch (error) { setResult(error instanceof Error ? error.message : "Import Google Sheets impossible"); }
    finally { setImportBusy(false); }
  };
  const importPhoneDirectory = async () => {
    if (!contactsManager || !window.isSecureContext) {
      setResult("Le répertoire direct n’est pas disponible dans ce navigateur. Ouvrez SmartSell avec Chrome sur Android, ou utilisez l’import CSV/Excel.");
      return;
    }
    setImportBusy(true); setResult("");
    try {
      const supported = await contactsManager.getProperties();
      const properties = ["name", "tel", "email"].filter((property) => supported.includes(property));
      const selected = await contactsManager.select(properties, { multiple: true });
      const imported = selected.flatMap((contact, contactIndex) => {
        const name = contact.name?.[0] || "Contact téléphone";
        const phones = (contact.tel || []).map((phone) => phone.trim()).filter(Boolean);
        const emails = (contact.email || []).map((email) => email.trim().toLowerCase()).filter(Boolean);
        const count = Math.max(phones.length, emails.length, 1);
        return Array.from({ length: count }, (_, index): ImportedContact => ({
          id: `phone-${Date.now()}-${contactIndex}-${index}`,
          name,
          phone: phones[index] || (index === 0 ? phones[0] || "" : ""),
          email: emails[index] || (index === 0 ? emails[0] || "" : ""),
          company: "Répertoire téléphone",
          tags: "Téléphone",
        })).filter((contact) => contact.phone || contact.email);
      });
      const recipients = imported
        .map((contact) => channel === "SMS" ? contact.phone : contact.email)
        .filter(Boolean);
      if (!recipients.length) {
        setResult(channel === "SMS" ? "Les contacts choisis ne contiennent aucun numéro de téléphone." : "Les contacts choisis ne contiennent aucune adresse e-mail.");
        return;
      }
      mergeContacts(imported);
      const existing = to.split(/[;,\n]/).map((value) => value.trim()).filter(Boolean);
      setTo(Array.from(new Set([...existing, ...recipients])).join("\n"));
      setResult(`${recipients.length} destinataire(s) du téléphone ajouté(s) au message.`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setResult("Sélection du répertoire annulée.");
      else setResult(error instanceof Error ? error.message : "Impossible d’ouvrir le répertoire du téléphone.");
    } finally { setImportBusy(false); }
  };
  const addSelectedRecipients = () => {
    const recipients = contacts.filter((contact) => selectedContacts.includes(contact.id)).map((contact) => channel === "SMS" ? contact.phone : contact.email).filter(Boolean);
    const existing = to.split(/[;,\n]/).map((value) => value.trim()).filter(Boolean);
    setTo(Array.from(new Set([...existing, ...recipients])).join("\n"));
    setResult(`${recipients.length} destinataire(s) ajouté(s) au message.`);
  };
  return (
    <>
      <Header
        title="Communication"
        copy="Importez vos contacts, sélectionnez les destinataires, puis envoyez vos SMS ou e-mails."
      ><button type="button" className="ghost-action" onClick={onBack}><ArrowLeft/>Retour</button></Header>
      <section className="panel contact-import-panel">
        <div className="contact-import-head"><div><span className="eyebrow"><i/> CARNET DE CONTACTS</span><h2>Importer des destinataires</h2><p>Colonnes reconnues : Nom complet, Téléphone, E-mail, Entreprise et Tags.</p></div><div className="template-actions"><a className="ghost-action" href={`${import.meta.env.BASE_URL}templates/Modele-import-contacts-Smartsell.xlsx`} download><FileSpreadsheet/>Modèle Excel</a><a className="ghost-action" href={`${import.meta.env.BASE_URL}templates/modele-contacts-smartsell.csv`} download>Modèle CSV</a></div></div>
        <div className="phone-directory-row">
          <button type="button" className="phone-directory-button" disabled={importBusy} onClick={()=>void importPhoneDirectory()}>
            <Users/><span><strong>Répertoire du téléphone</strong><small>Choisir directement un ou plusieurs contacts</small></span><ChevronRight/>
          </button>
          <small className={phoneDirectoryAvailable ? "directory-ready" : "directory-fallback"}>{phoneDirectoryAvailable ? "Disponible sur cet appareil" : "Selon le navigateur · Chrome Android recommandé"}</small>
        </div>
        <div className="contact-import-tools">
          <label className="upload-card"><Upload/><span>{importBusy ? "Import en cours…" : "Importer CSV ou Excel"}</span><small>.csv ou .xlsx</small><input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={importBusy} onChange={(event)=>{const file=event.target.files?.[0];if(file)void importFile(file);event.currentTarget.value=""}}/></label>
          <div className="google-sheet-import"><FileSpreadsheet/><div><strong>Google Sheets</strong><small>Collez le lien d’une feuille partagée en lecture.</small></div><input value={sheetUrl} onChange={(event)=>setSheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…"/><button type="button" className="primary-btn compact" disabled={!sheetUrl||importBusy} onClick={()=>void importGoogleSheet()}>Importer</button></div>
        </div>
        {contacts.length>0&&<div className="contact-picker"><div className="contact-picker-toolbar"><strong>{contacts.length} contact(s) importé(s)</strong><div><button type="button" className="ghost-action" onClick={()=>setSelectedContacts(availableContacts.map(contact=>contact.id))}>Tout sélectionner ({availableContacts.length})</button><button type="button" className="primary-btn compact" disabled={!selectedContacts.length} onClick={addSelectedRecipients}>Ajouter aux destinataires</button></div></div><div className="contact-table"><div className="contact-row contact-header"><span></span><span>Nom</span><span>Téléphone</span><span>E-mail</span><span>Entreprise</span></div>{contacts.map(contact=>{const usable=channel==="SMS"?Boolean(contact.phone):Boolean(contact.email);return <label className={`contact-row ${usable?"":"disabled"}`} key={contact.id}><input type="checkbox" disabled={!usable} checked={selectedContacts.includes(contact.id)} onChange={(event)=>setSelectedContacts(event.target.checked?[...selectedContacts,contact.id]:selectedContacts.filter(id=>id!==contact.id))}/><span>{contact.name||"Sans nom"}</span><span>{contact.phone||"—"}</span><span>{contact.email||"—"}</span><span>{contact.company||"—"}</span></label>})}</div></div>}
      </section>
      <div className="communication-layout">
        <form
          className="panel communication-compose"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setResult("");
            try {
              const r = await sendCommunication({
                channel,
                recipients: to
                  .split(/[;,\n]/)
                  .map((x) => x.trim())
                  .filter(Boolean),
                message,
              });
              setResult(
                r.testMode
                  ? `Mode test : ${r.recipientCount} SMS dirigé(s) vers le numéro de test configuré.`
                  : `Envoi accepté par Nimba SMS · ${r.recipientCount} destinataire(s)${r.providerStatus ? ` · statut ${r.providerStatus}` : ""}.`,
              );
            } catch (x) {
              setResult(x instanceof Error ? x.message : "Envoi impossible");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="channel-tabs">
            <button
              type="button"
              className={channel === "SMS" ? "active" : ""}
              onClick={() => { setChannel("SMS"); setSelectedContacts([]); }}
            >
              <MessageSquareText />
              SMS
            </button>
            <button
              type="button"
              className={channel === "EMAIL" ? "active" : ""}
              onClick={() => { setChannel("EMAIL"); setSelectedContacts([]); }}
            >
              <Mail />
              Email
            </button>
          </div>
          <label>
            Destinataires
            <textarea
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={
                channel === "SMS"
                  ? "+224 620 00 00 00"
                  : "client@entreprise.com"
              }
              required
            />
          </label>
          <label>
            Message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={7}
              required
            />
          </label>
          <button className="primary-btn compact" disabled={busy}>
            <Send />
            {busy ? "Envoi…" : "Envoyer"}
          </button>
          {result && <p className="result-note">{result}</p>}
        </form>
        <aside className="panel communication-help">
          <Phone />
          <h2>Appels</h2>
          <p>
            Le connecteur d’appels est prêt côté serveur. Il sera activé dès que
            les identifiants du fournisseur téléphonique seront ajoutés dans
            Supabase.
          </p>
          <span className="status">Connecteur API prêt</span>
          <h3>Sécurité</h3>
          <p>
            Les campagnes respectent les plafonds par utilisateur et restent en
            mode test tant que les fournisseurs SMS/e-mail ne sont pas activés.
          </p>
        </aside>
      </div>
    </>
  );
}

function TeamPage({ admin }: { admin: boolean }) {
  const [rows, setRows] = useState<Profile[]>([]),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<Profile | null>(null),
    [error, setError] = useState("");
  const load = () => listProfiles().then(setRows);
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <Header
        title="Équipe et droits"
        copy="Créez les comptes, attribuez les rôles et suspendez les accès."
        onAdd={admin ? () => setOpen(true) : undefined}
        add="Nouvel utilisateur"
      />
      <ErrorBar value={error} />
      <div className="records panel">
        {rows.map((r) => (
          <article
            className="clickable-row"
            key={r.id}
            onClick={() => setSelected(r)}
          >
            <div className="record-main">
              <span className="record-avatar">
                {r.full_name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{r.full_name}</strong>
                <small>{label(r.role)}</small>
              </div>
            </div>
            <span className={`status ${!r.active ? "danger" : ""}`}>
              {r.active ? "Actif" : "Suspendu"}
            </span>
            <span className="record-meta">
              {r.must_change_password
                ? "Mot de passe à changer"
                : "Compte vérifié"}
            </span>
            <b className="record-amount">
              Gérer <ChevronRight />
            </b>
          </article>
        ))}
      </div>
      <AnimatePresence>
        {open && (
          <Modal title="Créer un utilisateur" onClose={() => setOpen(false)}>
            <form
              className="entity-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = Object.fromEntries(
                  new FormData(e.currentTarget),
                ) as Record<string, string>;
                try {
                  await createTeamMember({
                    email: f.email,
                    password: f.password,
                    name: f.name,
                    roles: [f.role],
                  });
                  setOpen(false);
                  load();
                } catch (x) {
                  setError(
                    x instanceof Error ? x.message : "Création impossible",
                  );
                }
              }}
            >
              <div className="form-grid">
                <Field label="Nom complet">
                  <input name="name" required />
                </Field>
                <Field label="Email">
                  <input name="email" type="email" required />
                </Field>
                <Field label="Mot de passe temporaire">
                  <input
                    name="password"
                    type="password"
                    minLength={8}
                    required
                  />
                </Field>
                <Field label="Rôle">
                  <select name="role">
                    {[
                      "ADMIN",
                      "MANAGER",
                      "CHEF_DE_PROJET",
                      "COMMERCIAL",
                      "COMMUNITY_MANAGER",
                      "GRAPHISTE",
                      "VIDEASTE",
                      "PHOTOGRAPHE",
                      "DEVELOPPEUR",
                      "COMPTABLE",
                      "COLLABORATEUR",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <button className="primary-btn compact">Créer le compte</button>
            </form>
          </Modal>
        )}
        {selected && (
          <Modal title={selected.full_name} onClose={() => setSelected(null)}>
            <div className="access-summary">
              <ShieldCheck />
              <div>
                <strong>{label(selected.role)}</strong>
                <p>
                  Les menus et actions sont filtrés selon ce rôle. Le Super
                  Admin conserve tous les droits.
                </p>
              </div>
            </div>
            {admin && (
              <div className="form-actions">
                <button
                  className="primary-btn compact"
                  onClick={async () => {
                    await updateProfile(selected.id, {
                      active: !selected.active,
                    });
                    setSelected(null);
                    load();
                  }}
                >
                  {selected.active
                    ? "Suspendre le compte"
                    : "Réactiver le compte"}
                </button>
              </div>
            )}
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function ReportsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]),
    [sessions, setSessions] = useState<UserSession[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all([listActivityLogs(), listUserSessions()])
      .then(([a, b]) => {
        setLogs(a);
        setSessions(b);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <Header
        title="Rapports et activité"
        copy="Temps de connexion, pages vues et actions réalisées par les utilisateurs."
      />
      <ErrorBar value={error} />
      <section className="production-kpis">
        <Stat name="Sessions" value={sessions.length} copy="sessions suivies" />
        <Stat
          name="Temps cumulé"
          value={`${Math.round(sessions.reduce((s, x) => s + x.active_seconds, 0) / 60)} min`}
          copy="activité mesurée"
        />
        <Stat
          name="Pages vues"
          value={sessions.reduce((s, x) => s + x.pages_viewed, 0)}
          copy="navigation enregistrée"
        />
        <Stat name="Actions" value={logs.length} copy="journal récent" />
      </section>
      <div className="report-grid">
        <section className="panel report-panel">
          <h2>Sessions utilisateurs</h2>
          {sessions.map((s) => (
            <div className="audit-row" key={s.id}>
              <span className="record-avatar">
                {(s.profiles?.full_name || "U").slice(0, 2)}
              </span>
              <div>
                <strong>{s.profiles?.full_name || "Utilisateur"}</strong>
                <small>
                  Dernière activité{" "}
                  {new Date(s.last_seen_at).toLocaleString("fr-FR")}
                </small>
              </div>
              <b>{Math.round(s.active_seconds / 60)} min</b>
              <time>{s.pages_viewed} pages</time>
            </div>
          ))}
        </section>
        <section className="panel report-panel">
          <h2>Journal d’actions</h2>
          {logs.map((l) => (
            <div className="audit-row" key={l.id}>
              <span className="record-avatar">
                {(l.profiles?.full_name || "U").slice(0, 2)}
              </span>
              <div>
                <strong>
                  {l.profiles?.full_name || "Utilisateur"} · {label(l.action)}
                </strong>
                <small>{label(l.entity_type)}</small>
              </div>
              <b>{new Date(l.created_at).toLocaleDateString("fr-FR")}</b>
              <time>
                {new Date(l.created_at).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

function SimplePage({ page }: { page: "RH" | "Portail client" }) {
  return (
    <>
      <Header
        title={page}
        copy={
          page === "RH"
            ? "Dossiers collaborateurs, congés et informations contractuelles."
            : "Accès client aux projets, publications, factures, paiements et notifications."
        }
      />
      <div className="panel feature-ready">
        <ShieldCheck />
        <div>
          <h2>
            {page === "RH" ? "Socle RH sécurisé" : "Portail client sécurisé"}
          </h2>
          <p>
            {page === "RH"
              ? "Les structures RH et demandes de congés sont ajoutées à Supabase. Les formulaires détaillés seront activés après la migration V2."
              : "Les accès clients sont isolés par client dans Supabase. La création d’un compte portail nécessite une invitation nominative pour éviter tout accès au mauvais dossier."}
          </p>
          <span className="status">Structure V2 prête</span>
        </div>
      </div>
    </>
  );
}

function Shell({
  profile,
  onLogout,
}: {
  profile: Profile;
  onLogout: () => void;
}) {
  const [page, setPage] = useState<Page>(pageFromHash),
    [theme, setTheme] = useState<"light" | "dark">(
      () =>
        (localStorage.getItem("smartsell-theme") as "light" | "dark") ||
        "light",
    ),
    [mobile, setMobile] = useState(false),
    [clientFilter, setClientFilter] = useState<string | null>(clientFromHash),
    [access, setAccess] = useState<AccessControl | null>(null),
    [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null),
    [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const navigate = (next: Page, clientId: string | null = null) => {
    const hash = `#/${encodeURIComponent(next)}${clientId ? `?client=${encodeURIComponent(clientId)}` : ""}`;
    history.pushState({}, "", hash);
    setPage(next);
    setClientFilter(clientId);
    setMobile(false);
  };
  useEffect(() => {
    if (!location.hash) history.replaceState({}, "", `#/${encodeURIComponent("Dashboard")}`);
    const sync = () => { setPage(pageFromHash()); setClientFilter(clientFromHash()); };
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("hashchange", sync); };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("smartsell-theme", theme);
  }, [theme]);
  useEffect(() => {
    startSession();
    void getAccessControl(profile.id).then(setAccess);
    const timer = window.setInterval(pulseSession, 60_000);
    return () => window.clearInterval(timer);
  }, [profile.id]);
  useEffect(() => {
    trackActivity("Page consultée", page, `Consultation de ${page}`);
  }, [page]);
  useEffect(() => {
    const ready = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent); };
    const done = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener('beforeinstallprompt', ready);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', ready); window.removeEventListener('appinstalled', done); };
  }, []);
  const installApp = async () => {
    if (installPrompt) { await installPrompt.prompt(); const choice = await installPrompt.userChoice; if (choice.outcome === 'accepted') setInstallPrompt(null); return; }
    alert('Dans Chrome ou Edge, ouvrez le menu du navigateur puis choisissez « Installer SmartSell Apps ». Sur iPhone/iPad : Partager → Sur l’écran d’accueil.');
  };
  const roles = (profile.roles?.length ? profile.roles : [profile.role]) as Role[],
    admin = roles.some((item) => ["SUPER_ADMIN", "ADMIN"].includes(item));
  if (roles.includes("CLIENT")) return <ClientPortalView onLogout={onLogout} />;
  const actionAllowed = (key: string) => roles.includes("SUPER_ADMIN") || !access?.denied_permissions?.includes(key);
  const rightsFor = (scope: string): CrudRights => ({
    view: actionAllowed(`${scope}.view`),
    create: actionAllowed(`${scope}.create`),
    update: actionAllowed(`${scope}.update`),
    delete: actionAllowed(`${scope}.delete`),
  });
  const viewKeys: Partial<Record<Page,string>> = {Clients:'clients.view',Projets:'projects.view',Tâches:'tasks.view',Planning:'planning.view',Éditorial:'editorial.view',Services:'services.view',Fournisseurs:'suppliers.view',Facturation:'invoices.view',Documents:'documents.view',Comptabilité:'accounting.view',Matériel:'equipment.view',Communication:'communication.view',Équipe:'team.view',RH:'hr.view',Rapports:'reports.view','Portail client':'portal.view'};
  const visible = (n: [Page, typeof LayoutDashboard, Permission?]) =>
    (!n[2] || can(roles, n[2])) &&
    (!viewKeys[n[0]] || actionAllowed(viewKeys[n[0]]!)) &&
    (!access?.allowed_modules?.length ||
      access.allowed_modules.includes(n[0]) ||
      roles.includes("SUPER_ADMIN"));
  return (
    <div className="app-shell production-shell v2-shell">
      <aside className={mobile ? "mobile-open" : ""}>
        <div className="side-head">
          <img src={companyProfile.logo_light} />
          <button className="mobile-close" onClick={() => setMobile(false)}>
            <X />
          </button>
        </div>
        <nav>
          <small>SMARTSELL APPS V3</small>
          {nav.filter(visible).map(([name, Icon]) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => navigate(name)}
            >
              <Icon />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="user-avatar">
            {profile.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <strong>{profile.full_name}</strong>
            <small>{roles.map(label).join(" · ")}</small>
          </div>
          <button
            onClick={() => {
              endSession();
              onLogout();
            }}
          >
            <LogOut />
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header>
          <button className="mobile-menu" onClick={() => setMobile(true)}>
            <Menu />
          </button>
          <div className="production-badge">
            SMARTSELL APPS V3 <i />
          </div>
          <div className="top-actions">
            {!installed&&<button className="install-app-btn" onClick={()=>void installApp()} title="Installer SmartSell Apps sur cet appareil"><Download/><span>Installer l’application</span></button>}
            <button
              className="icon-btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </button>
            <button className="icon-btn">
              <Bell />
            </button>
          </div>
        </header>
        <main>
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {page === "Dashboard" ? (
                <Dashboard profile={profile} />
              ) : page === "Clients" ? (
                <ClientsPage rights={rightsFor('clients')} onNavigate={(next,clientId)=>navigate(next,clientId)} />
              ) : page === "Projets" ? (
                <ProjectsPage rights={rightsFor('projects')} clientFilter={clientFilter} onClearFilter={()=>navigate("Projets")} />
              ) : page === "Tâches" ? (
                <TasksPage rights={rightsFor('tasks')} clientFilter={clientFilter} onClearFilter={()=>navigate("Tâches")} />
              ) : page === "Planning" ? (
                <TasksPage rights={{view:actionAllowed('planning.view'),create:actionAllowed('planning.create'),update:actionAllowed('planning.update'),delete:actionAllowed('tasks.delete')}} planning />
              ) : page === "Éditorial" ? (
                <EditorialV3 />
              ) : page === "Services" ? (
                <ServicesPage admin={admin} />
              ) : page === "Fournisseurs" ? (
                <SuppliersPage admin={admin} />
              ) : page === "Facturation" ? (
                <BillingV3 admin={actionAllowed('invoices.delete')} canCreate={actionAllowed('invoices.create')} canUpdate={actionAllowed('invoices.update')} canSend={actionAllowed('invoices.send')} clientFilter={clientFilter} onClearFilter={()=>navigate("Facturation")} />
              ) : page === "Documents" ? (
                <DocumentsPage />
              ) : page === "Comptabilité" ? (
                <AccountingPage />
              ) : page === "Matériel" ? (
                <EquipmentPage />
              ) : page === "Communication" ? (
                <CommunicationPage onBack={()=>navigate("Dashboard")} />
              ) : page === "Équipe" ? (
                <TeamAccessPage admin={admin} />
              ) : page === "RH" ? (
                <HRPage />
              ) : page === "Rapports" ? (
                <ReportsPage />
              ) : page === "Portail client" ? (
                <ClientPortalAdmin />
              ) : (
                <AiAssistantPage />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
export default function ProductionAppV2() {
  const [loading, setLoading] = useState(true),
    [profile, setProfile] = useState<Profile | null>(null),
    [showWelcome, setShowWelcome] = useState(false);
  const refresh = async () => {
    try {
      const session = await currentSession();
      const nextProfile = session ? await getProfile() : null;
      setProfile(nextProfile);
      if (nextProfile && sessionStorage.getItem("smartsell-show-welcome") === "1") {
        sessionStorage.removeItem("smartsell-show-welcome");
        setShowWelcome(true);
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
    const sub = onAuthChange(() => void refresh());
    return () => sub.unsubscribe();
  }, []);
  if (loading)
    return (
      <div className="app-loading">
        <img src={companyProfile.logo_dark} />
        <span>Chargement sécurisé…</span>
      </div>
    );
  if (!profile) return <Login onSuccess={refresh} />;
  if (showWelcome) return <WelcomeSplash profile={profile} onComplete={() => setShowWelcome(false)} />;
  if (profile.must_change_password) return <PasswordChangeGate profile={profile} onComplete={refresh} />;
  return (
    <Shell
      profile={profile}
      onLogout={async () => {
        await signOut();
        setProfile(null);
      }}
    />
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function PasswordChangeGate({ profile, onComplete }: { profile: Profile; onComplete: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <main className="login-shell">
    <section className="login-brand">
      <img src={companyProfile.logo_light} className="login-logo" alt="SmartSell" />
      <div className="brand-orbit"><span /></div>
      <div className="login-manifesto"><p>Première connexion</p><h1>PROTÉGEZ.<br />VOTRE.<br /><em>COMPTE.</em></h1></div>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const form = new FormData(event.currentTarget);
        const password = String(form.get("password"));
        const confirmation = String(form.get("confirmation"));
        if (password !== confirmation) { setError("Les deux mots de passe ne correspondent pas."); return; }
        setBusy(true);
        try { await completePasswordChange(password); onComplete(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Modification impossible"); }
        finally { setBusy(false); }
      }}>
        <div className="eyebrow"><i /> CHANGEMENT OBLIGATOIRE</div>
        <h2>Bienvenue, {profile.full_name.split(" ")[0]}.</h2>
        <p className="muted">Le mot de passe reçu par e-mail ou SMS est temporaire. Choisissez maintenant votre mot de passe personnel.</p>
        <label>Nouveau mot de passe<input name="password" type="password" minLength={10} autoComplete="new-password" required /><small>10 caractères minimum, avec majuscule, minuscule et chiffre.</small></label>
        <label>Confirmer le mot de passe<input name="confirmation" type="password" minLength={10} autoComplete="new-password" required /></label>
        {error && <p className="form-error">{error}</p>}
        <button disabled={busy} className="primary-btn">{busy ? "Sécurisation…" : "Enregistrer et continuer"} <span>→</span></button>
      </form>
    </section>
  </main>;
}
