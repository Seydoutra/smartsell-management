import { CSSProperties, FormEvent, MouseEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  Bell,
  Bot,
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
  Gauge,
  Gift,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageSquareText,
  Mic,
  Moon,
  Package,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Target,
  Upload,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { companyProfile } from "./lib/companyProfile";
import { commercialDrafts, commercialKindNames, commercialPdfFile } from './lib/commercialPdf';
import { useOnlineStatus } from "./lib/network";
import BetaSandboxApp from "./BetaSandboxApp";
import CommunicationHub from "./CommunicationHub";
import TeamChat from "./TeamChat";
import TeamActivityDashboard from "./TeamActivityDashboard";
import SmartSocial from "./SmartSocial";
import CommercialPipeline from './CommercialPipeline';
import ClientSocialDashboard from './ClientSocialDashboard';
import ModuleNavigation from './ModuleNavigation';
import ActionCommand from './ActionCommand';
import { commandKinds, commandPermission } from './lib/actionCommand';
import { moduleNavigationHash, readModuleIntent, type ModuleIntent } from './lib/commercialPipeline';
import PlanningCalendar from "./PlanningCalendar";
import { ClientConversationDesk, ClientPortalExperience } from "./ClientPortalExperience";
import { contactsFromCsv, contactsFromFile, googleSheetCsvUrl, ImportedContact } from "./lib/contactImport";
import { can, Permission, Role } from "./lib/permissions";
import { isActionAllowed, isModuleAllowed } from "./lib/access";
import { playUiTone } from "./lib/uiFeedback";
import { watchTranslations } from "./lib/i18n";
import { statusTone } from './lib/statusTone';
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
  HRPage,
  SignupRequestsPage,
  SuppliersPage,
  TeamAccessPage,
} from "./AdvancedModulesV3";
import { CampaignStudioPage, CommercialRadarPage, DigitalTwinPage } from "./InnovationsV4";
import { AutopilotPage } from "./AutopilotV5";
import { NotificationBell, OperationsCenter } from "./OperationsCenter";
import { SmsSettings } from './SmsSettings';
import { PerformanceGoals } from './PerformanceGoals';
import TrialPaywall from './TrialPaywall';
import SubscriptionPage from './SubscriptionPage';
import SupportCenter from './SupportCenter';
import ReferralDashboard from './ReferralDashboard';
import {
  connectGoogleCalendar,
  createCampaign,
  createCallList,
  createContactGroup,
  completePasswordChange,
  createClient,
  createCommercialDocument,
  createEditorialItem,
  createEquipment,
  createEquipmentCategory,
  createExpense,
  createInvoice,
  createProject,
  createProspect,
  createService,
  createTask,
  createTeamMember,
  currentSession,
  deleteClient,
  deleteEditorialItem,
  deleteEquipment,
  deleteProject,
  deleteService,
  deleteTask,
  executeNextBestAction,
  askAiAssistant,
  generateAgencyIntelligence,
  getAccessControl,
  getCalendarConnection,
  getCompanySettings,
  getClientWorkspace,
  getProfile,
  getTenantTrialStatus,
  getProjectWorkspace,
  getAppSetting,
  finishCall,
  listActivityLogs,
  listCallLogs,
  listCallListContacts,
  listCallLists,
  listCampaigns,
  listContactGroups,
  listClients,
  listCommercialDocuments,
  listEditorialItems,
  listEquipment,
  listEquipmentCategories,
  listEquipmentMovements,
  listExpenses,
  listInvoices,
  listPayments,
  listProfiles,
  listProspects,
  listProjects,
  listSocialIntegrations,
  saveSocialIntegration,
  saveAppSetting,
  listServices,
  listSuppliers,
  listTasks,
  listTeamChatMessages,
  listUserSessions,
  onAuthChange,
  recordPayment,
  recordEquipmentMovement,
  startPasswordResetOtp,
  verifyPasswordResetOtp,
  sendCommunication,
  signIn,
  signOut,
  startCall,
  updateClient,
  updateCommercialDocument,
  updateEditorialItem,
  updateExpenseStatus,
  updateEquipment,
  updateProfile,
  updateProject,
  updateService,
  updateTask,
  updateNextBestAction,
  uploadClientAvatar,
} from "./services/repository";
import type {
  AccessControl,
  ActivityLog,
  AgencyBriefing,
  CalendarConnection,
  CallList,
  CallListContact,
  CallLog,
  Campaign,
  Client,
  CompanySettings,
  CommercialDocument,
  ContactGroup,
  EditorialItem,
  Equipment,
  EquipmentCategory,
  EquipmentMovement,
  Expense,
  Invoice,
  InvoiceItem,
  Notification,
  NextBestAction,
  Payment,
  Profile,
  Project,
  Prospect,
  Service,
  Supplier,
  SocialIntegration,
  Task,
  TeamChatMessage,
  UserSession,
} from "./types/models";

type Page =
  | "Dashboard"
  | "Clients"
  | "Projets"
  | "Tâches"
  | "Planning"
  | "Éditorial"
  | "Smart Social"
  | "Services"
  | "Fournisseurs"
  | "Facturation"
  | "Documents"
  | "Comptabilité"
  | "Matériel"
  | "Communication"
  | "Équipe"
  | "Demandes SaaS"
  | "RH"
  | "Rapports"
  | "Centre de contrôle"
  | "Paramètres SMS"
  | "Objectifs & performance"
  | "Parrainage"
  | "Abonnement"
  | "Assistance"
  | "Jumeau numérique"
  | "Radar commercial"
  | "Studio campagnes IA"
  | "Autopilot IA"
  | "Portail client"
  | "Intégrations"
  | "Assistant IA";
type CrudRights = { view: boolean; create: boolean; update: boolean; delete: boolean };
const nav: [Page, typeof LayoutDashboard, Permission?][] = [
  ["Dashboard", LayoutDashboard],
  ["Objectifs & performance", Target],
  ["Parrainage", Gift],
  ["Abonnement", CircleDollarSign],
  ["Assistance", LifeBuoy],
  ["Clients", Users, "crm.write"],
  ["Projets", BriefcaseBusiness, "projects.write"],
  ["Tâches", ClipboardList, "projects.write"],
  ["Planning", CalendarDays, "projects.write"],
  ["Smart Social", BookOpenCheck],
  ["Services", Boxes, "finance.read"],
  ["Fournisseurs", BriefcaseBusiness, "finance.read"],
  ["Facturation", ReceiptText, "finance.read"],
  ["Documents", FileCheck2, "finance.read"],
  ["Comptabilité", CircleDollarSign, "finance.read"],
  ["Matériel", Package, "projects.write"],
  ["Communication", Mail, "communication.send"],
  ["Équipe", Users, "users.manage"],
  ["Demandes SaaS", ShieldCheck, "users.manage"],
  ["RH", BriefcaseBusiness, "users.manage"],
  ["Rapports", Activity, "audit.read"],
  ["Centre de contrôle", ShieldCheck, "audit.read"],
  ["Paramètres SMS", Settings2],
  ["Jumeau numérique", Gauge, "finance.read"],
  ["Radar commercial", Target, "crm.write"],
  ["Studio campagnes IA", Megaphone, "communication.send"],
  ["Autopilot IA", Bot],
  ["Portail client", ShieldCheck, "users.manage"],
  ["Assistant IA", MessageSquareText],
];
const navGroups:{label:string;pages:Page[]}[]=[
  {label:'Pilotage',pages:['Dashboard','Objectifs & performance','Parrainage','Abonnement','Assistance']},
  {label:'Production & clients',pages:['Clients','Projets','Tâches','Planning','Smart Social']},
  {label:'Finance & achats',pages:['Services','Fournisseurs','Facturation','Documents','Comptabilité','Matériel']},
  {label:'Communication',pages:['Communication','Paramètres SMS']},
  {label:'Administration',pages:['Équipe','Demandes SaaS','RH','Rapports','Centre de contrôle','Portail client']},
  {label:'Intelligence artificielle',pages:['Jumeau numérique','Radar commercial','Studio campagnes IA','Autopilot IA','Assistant IA']},
];
const pageNames = new Set<Page>([...nav.map(([name]) => name), 'Éditorial', 'Intégrations']);
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
const statusClass = statusTone;

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [notice, setNotice] = useState("");
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
          {!resetMode && <label>Mot de passe<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
          {resetMode && <label>Téléphone enregistré<input required type="tel" placeholder="+224 620 12 47 66" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>}
          {resetMode && challengeId && <><label>Code reçu par SMS<input required inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} /></label><label>Nouveau mot de passe<input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label></>}
          {notice && <p className="form-success">{notice}</p>}
          <button type="button" className="link forgot-link" onClick={async () => { if (!resetMode) { setResetMode(true); setError(""); return; } if (!email || !phone) return setError("Saisissez votre email et le téléphone enregistré."); setBusy(true); setError(""); try { const result = await startPasswordResetOtp({ email, phone }); setChallengeId(result.challenge_id); setNotice("Un code de réinitialisation vient d’être envoyé par SMS."); } catch (err) { setError(err instanceof Error ? err.message : "Envoi impossible"); } finally { setBusy(false); } }}>{resetMode ? "Recevoir le code SMS" : "Mot de passe oublié ?"}</button>
          {resetMode && challengeId && <button type="button" className="primary-btn" disabled={busy} onClick={async () => { if (!otp || newPassword.length < 8) return setError("Code et mot de passe de 8 caractères minimum requis."); setBusy(true); setError(""); try { await verifyPasswordResetOtp({ challengeId, code: otp, password: newPassword }); setNotice("Mot de passe mis à jour. Vous pouvez vous connecter."); setResetMode(false); setChallengeId(""); setOtp(""); setNewPassword(""); } catch (err) { setError(err instanceof Error ? err.message : "Code invalide ou expiré."); } finally { setBusy(false); } }}>Réinitialiser le mot de passe <span>→</span></button>}
          {resetMode && <button type="button" className="link" onClick={() => { setResetMode(false); setChallengeId(""); setError(""); setNotice(""); }}>Retour à la connexion</button>}
          {error && <p className="form-error">{error}</p>}
          {!resetMode && <button disabled={busy} className="primary-btn">
            {busy ? "Connexion…" : "Ouvrir mon espace"} <span>→</span>
          </button>}
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
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
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
function currentGreeting(){
  const hour=Number(new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",hour12:false,timeZone:"Africa/Conakry"}).format(new Date()).replace(/\D/g,""));
  return hour<12?"Bonjour":hour<18?"Bon après-midi":"Bonsoir";
}
function currentGreetingEnglish(){
  const hour=Number(new Intl.DateTimeFormat("en-US",{hour:"2-digit",hour12:false,timeZone:"Africa/Conakry"}).format(new Date()).replace(/\D/g,""));
  return hour<12?"Good morning":hour<18?"Good afternoon":"Good evening";
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
              <i /> SMARTSELL MANAGEMENT
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
function ProfileChecklist({ profiles, name, selected=[] }: { profiles:Profile[]; name:string; selected?:string[] }) {
  return <div className="check-options profile-checklist">
    {profiles.filter(profile=>profile.active).map(profile=><label key={profile.id}>
      <input type="checkbox" name={name} value={profile.id} defaultChecked={selected.includes(profile.id)}/>
      <span>{profile.full_name}</span>
    </label>)}
    {!profiles.some(profile=>profile.active)&&<small>Aucun collaborateur actif disponible.</small>}
  </div>;
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

function TrendCurve({rows,showRevenue,showCost}:{rows:Array<{label:string;revenue:number;cost:number}>;showRevenue:boolean;showCost:boolean}) {
  const max=Math.max(1,...rows.flatMap(row=>[row.revenue,row.cost]));
  const points=(key:'revenue'|'cost')=>rows.map((row,index)=>`${8+index*(84/Math.max(1,rows.length-1))},${88-(row[key]/max)*70}`).join(' ');
  return <div className="trend-curve" aria-label="Évolution financière animée">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
      <defs><linearGradient id="curveGlow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#6a2b85"/><stop offset="1" stopColor="#b66bd2"/></linearGradient></defs>
      {[22,44,66,88].map(value=><line key={value} x1="5" y1={value} x2="95" y2={value} className="curve-grid"/>)}
      {showRevenue&&<motion.polyline points={points('revenue')} className="curve-line revenue" initial={{pathLength:0,opacity:0}} animate={{pathLength:1,opacity:1}} transition={{duration:1.4,ease:'easeOut'}}/>}
      {showCost&&<motion.polyline points={points('cost')} className="curve-line cost" initial={{pathLength:0,opacity:0}} animate={{pathLength:1,opacity:1}} transition={{duration:1.4,delay:.18,ease:'easeOut'}}/>}
    </svg>
    <div className="curve-labels">{rows.map(row=><span key={row.label}>{row.label}</span>)}</div>
  </div>;
}

function Dashboard({ profile, access, accessLoaded, onNavigate, english }: { profile: Profile; access:AccessControl|null; accessLoaded:boolean; onNavigate:(page:Page,clientId?:string|null)=>void; english:boolean }) {
  const roles=(profile.roles?.length?profile.roles:[profile.role]) as Role[];
  const platformOwner=profile.is_platform_owner===true;
  const allowed=(action:string)=>isActionAllowed(roles,access,accessLoaded,action);
  const canClients=allowed('clients.view'), canProjects=allowed('projects.view'), canTasks=allowed('tasks.view'),
    canInvoices=allowed('invoices.view'), canAccounting=allowed('accounting.view'), canSuppliers=allowed('suppliers.view'),
    canTeam=allowed('team.view'), canFinance=canInvoices||canAccounting;
  const canIntelligence=roles.some(role=>['SUPER_ADMIN','ADMIN','MANAGER'].includes(role))&&canClients&&canProjects&&canTasks&&canInvoices&&canAccounting;
  const tx = english ? {
    netCash:'net cash', allowedMetrics:'authorized metrics', retry:'Retry', aiDirector:'AI DIRECTOR', strategicBriefing:'Your strategic briefing', analyze:'Analyzing…', refresh:'Refresh', opportunities:'Opportunities', watchouts:'Watchouts', nextAction:'NEXT BEST ACTION', recommended:'Recommended decisions', confirmDone:'Confirm completed', open:'Open', ignore:'Ignore', noUrgent:'No urgent action. Refresh the briefing when data changes.', forecast:'FORECAST', digitalTwin:'Digital twin', simulate:'Simulate cash flow, margin and capacity.', detect:'DETECT', commercialRadar:'Commercial radar', prioritize:'Prioritize customers and prospects.', accelerate:'ACCELERATE', campaignStudio:'AI campaign studio', design:'Design, approve and deliver.', ready:'Your workspace is ready', emptyData:'No business data is assigned yet. Available modules will appear after your first activities.', billed:'Billed', receivable:'Receivable', collected:'Collected', expenses:'Expenses', clients:'Clients', projects:'Projects', tasks:'Tasks', suppliers:'Suppliers', invoiceCount:'invoice(s)', overdue:'overdue invoice(s)', paymentCount:'payment(s)', balance:'Balance', active:'active', total:'in total', completed:'completed', finance:'FINANCE', sixMonths:'Last 6 months flow', billing:'Billing', expensesLegend:'Expenses', execution:'EXECUTION', operational:'Operational progress', doneTasks:'completed tasks', openTasks:'open', urgentTasks:'urgent', portfolio:'Main portfolio', accounts:'accounts', noSector:'Sector not provided', noClients:'Customers will appear here.', team:'TEAM', teamMotion:'Team in motion', online:'online', activeCollaborators:'active collaborators', livePresence:'live presence', suppliersRef:'suppliers referenced'
  } : {
    netCash:'trésorerie nette', allowedMetrics:'indicateurs autorisés', retry:'Réessayer', aiDirector:'DIRECTEUR IA', strategicBriefing:'Votre briefing stratégique', analyze:'Analyse…', refresh:'Actualiser', opportunities:'Opportunités', watchouts:'Points de vigilance', nextAction:'NEXT BEST ACTION', recommended:'Les décisions recommandées', confirmDone:'Confirmer terminée', open:'Ouvrir', ignore:'Ignorer', noUrgent:'Aucune action urgente. Actualisez le briefing lorsque les données changent.', forecast:'PRÉVOIR', digitalTwin:'Jumeau numérique', simulate:'Simuler trésorerie, marge et capacité.', detect:'DÉTECTER', commercialRadar:'Radar commercial', prioritize:'Prioriser clients et prospects.', accelerate:'ACCÉLÉRER', campaignStudio:'Studio campagnes IA', design:'Concevoir, valider puis diffuser.', ready:'Votre espace est prêt', emptyData:'Aucune donnée métier ne vous est encore attribuée. Les modules disponibles apparaîtront dès vos premières activités.', billed:'Facturé', receivable:'À recevoir', collected:'Encaissé', expenses:'Dépenses', clients:'Clients', projects:'Projets', tasks:'Tâches', suppliers:'Fournisseurs', invoiceCount:'facture(s)', overdue:'facture(s) en retard', paymentCount:'paiement(s)', balance:'Solde', active:'actifs', total:'au total', completed:'terminées', finance:'FINANCE', sixMonths:'Flux des 6 derniers mois', billing:'Facturation', expensesLegend:'Dépenses', execution:'EXÉCUTION', operational:'Avancement opérationnel', doneTasks:'tâches terminées', openTasks:'ouvertes', urgentTasks:'urgentes', portfolio:'Portefeuille principal', accounts:'comptes', noSector:'Secteur non renseigné', noClients:'Les clients apparaîtront ici.', team:'ÉQUIPE', teamMotion:'Équipe en mouvement', online:'en ligne', activeCollaborators:'collaborateurs actifs', livePresence:'présence en direct', suppliersRef:'fournisseurs référencés'
  };
  const [c, setC] = useState<Client[]>([]),
    [p, setP] = useState<Project[]>([]),
    [i, setI] = useState<Invoice[]>([]),
    [t, setT] = useState<Task[]>([]),
    [payments, setPayments] = useState<Payment[]>([]),
    [expenses, setExpenses] = useState<Expense[]>([]),
    [suppliers, setSuppliers] = useState<Supplier[]>([]),
    [team, setTeam] = useState<Profile[]>([]),
    [sessions, setSessions] = useState<UserSession[]>([]),
    [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]),
    [salesAdvice, setSalesAdvice] = useState(''),
    [salesAdviceBusy, setSalesAdviceBusy] = useState(false),
    [monthlyGoal, setMonthlyGoal] = useState<{metric:string;target:number;period:string;plan?:string}>(),
    [goalBusy, setGoalBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(''),
    [briefing,setBriefing]=useState<AgencyBriefing|null>(null),
    [nextActions,setNextActions]=useState<NextBestAction[]>([]),
    [intelligenceBusy,setIntelligenceBusy]=useState(false),
    [intelligenceError,setIntelligenceError]=useState('');
  const loadIntelligence=async()=>{if(!canIntelligence)return;setIntelligenceBusy(true);setIntelligenceError('');try{const result=await generateAgencyIntelligence();setBriefing(result.briefing);setNextActions(result.actions)}catch(error){setIntelligenceError(error instanceof Error?error.message:'Briefing indisponible')}finally{setIntelligenceBusy(false)}};
  useEffect(() => {
    setLoadError('');
    setLoading(true);
    Promise.all([
      canClients?listClients():Promise.resolve([]),
      canProjects?listProjects():Promise.resolve([]),
      canInvoices?listInvoices():Promise.resolve([]),
      canTasks?listTasks():Promise.resolve([]),
      canAccounting?listPayments():Promise.resolve([]),
      canAccounting?listExpenses():Promise.resolve([]),
      canSuppliers?listSuppliers():Promise.resolve([]),
      canTeam?listProfiles():Promise.resolve([]),
      canTeam?listUserSessions():Promise.resolve([]),
      canTeam&&roles.includes('SUPER_ADMIN')?listActivityLogs():Promise.resolve([]),
    ]).then(([a, b, d, e, f, g, h, j, k, l]) => {
      setC(a);
      setP(b);
      setI(d);
      setT(e);
      setPayments(f);
      setExpenses(g);
      setSuppliers(h);
      setTeam(j);
      setSessions(k);
      setActivityLogs(l);
    }).catch((error)=>setLoadError(error instanceof Error?error.message:'Impossible de charger les indicateurs.')).finally(()=>setLoading(false));
    if(canIntelligence)void loadIntelligence();
  }, [accessLoaded,access?.allowed_modules.join('|'),access?.denied_permissions.join('|')]);
  useEffect(()=>{if(!roles.includes('SUPER_ADMIN'))return;void getAppSetting<{metric:string;target:number;period:string;plan?:string}>('monthly_goal').then(value=>setMonthlyGoal(value||undefined)).catch(()=>undefined)},[roles.join('|')]);
  const saveMonthlyGoal=async(goal:{metric:string;target:number;period:string})=>{setGoalBusy(true);try{const active=team.filter(member=>member.active&&!member.roles?.includes('SUPER_ADMIN'));const allocation=active.length?Math.ceil(goal.target/active.length):goal.target;const plan=await askAiAssistant(`Objectif mensuel Smartsell Management : ${goal.target} ${goal.metric} sur ${goal.period}. Équipe active : ${active.map(item=>item.full_name).join(', ')||'aucun collaborateur'}. Répartis l’objectif sur 4 semaines et indique les activités opérationnelles prioritaires. Donne un plan très concis en français.`, 'Plan d’objectifs mensuel');const value={...goal,plan:`Répartition indicative : ${allocation} ${goal.metric} par collaborateur actif.\n${plan}`};await saveAppSetting('monthly_goal',value);setMonthlyGoal(value)}catch(error){setSalesAdvice(error instanceof Error?error.message:'Impossible de calculer le plan')}finally{setGoalBusy(false)}};
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
  const clientRows = topClients.map((row,index)=><div key={row.client.id}><span>{String(index+1).padStart(2,"0")}</span><div><strong>{row.client.name}</strong><small>{row.client.sector||tx.noSector}</small></div>{canInvoices&&<b>{money(row.total)}</b>}</div>);
  const salesLeads = useMemo(() => team.filter(item=>platformOwner&&item.is_temporary&&item.role==='SUPER_ADMIN').map(item=>{const history=sessions.filter(row=>row.profile_id===item.id),logs=activityLogs.filter(row=>(row as any).actor_id===item.id),actions=logs.length,score=Math.min(100,Math.round((history.length?20:0)+(history.reduce((sum,row)=>sum+Number(row.pages_viewed||0),0)>3?15:0)+(actions?20:0)+(actions>5?20:0)+(actions>15?15:0)+(history.reduce((sum,row)=>sum+Number(row.active_seconds||0),0)>300?10:0)));return {item,score,actions,last:history.sort((a,b)=>new Date(b.last_seen_at).getTime()-new Date(a.last_seen_at).getTime())[0]?.last_seen_at||item.created_at}}).sort((a,b)=>b.score-a.score),[team,sessions,activityLogs,platformOwner]);
  const loadSalesAdvice=async()=>{if(!salesLeads.length)return;setSalesAdviceBusy(true);try{const context=salesLeads.slice(0,8).map(lead=>`${lead.item.full_name}: score ${lead.score}/100, ${lead.actions} actions, dernier accès ${lead.last||'inconnu'}`).join('\n');setSalesAdvice(await askAiAssistant('Tu es le directeur commercial SaaS de Smartsell Management. À partir des essais ci-dessous, donne 3 actions de conversion concrètes, priorisées, avec un message de relance court pour le prospect le plus chaud. Réponds en français, de façon concise.\n'+context,'Pipeline des essais autonomes'))}catch(error){setSalesAdvice(error instanceof Error?error.message:'Suggestion IA indisponible')}finally{setSalesAdviceBusy(false)}};
  const metrics = [
    ...(canInvoices?[{ label: tx.billed, value: money(billed), copy: `${i.length} ${tx.invoiceCount}`, icon: ReceiptText, tone: "purple" },{ label: tx.receivable, value: money(receivables), copy: `${overdue.length} ${tx.overdue}`, icon: CircleDollarSign, tone: "yellow" }]:[]),
    ...(canAccounting?[{ label: tx.collected, value: money(collected), copy: `${payments.length} ${tx.paymentCount}`, icon: WalletCards, tone: "green" },{ label: tx.expenses, value: money(spent), copy: `${tx.balance} ${money(collected - spent)}`, icon: Activity, tone: "red" }]:[]),
    ...(canClients?[{ label: tx.clients, value: c.length, copy: `${c.filter((row) => row.status === "ACTIVE").length} ${tx.active}`, icon: Users, tone: "blue" }]:[]),
    ...(canProjects?[{ label: tx.projects, value: activeProjects.length, copy: `${p.length} ${tx.total}`, icon: BriefcaseBusiness, tone: "purple" }]:[]),
    ...(canTasks?[{ label: tx.tasks, value: openTasks.length, copy: `${completion}% ${tx.completed}`, icon: ClipboardList, tone: "green" }]:[]),
    ...(canSuppliers?[{ label: tx.suppliers, value: suppliers.length, copy: `${suppliers.filter((row) => row.status === "ACTIVE").length} ${tx.active}`, icon: Boxes, tone: "yellow" }]:[]),
  ];
  return (
    <div className={`command-dashboard ${loading ? "is-loading" : ""}`}>
      <motion.section className="command-hero" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{duration:.45}}>
        <div className="command-grid"/><div className="command-glow glow-one"/><div className="command-glow glow-two"/>
        <div className="command-copy"><span className="eyebrow"><i/> {english?"SMARTSELL MANAGEMENT DASHBOARD":"TABLEAU DE BORD SMARTSELL MANAGEMENT"}</span><h1>{english?currentGreetingEnglish():currentGreeting()}, {profile.full_name.split(" ")[0]}.</h1><p>{english?"Your personalized view of activity, projects and today’s priorities.":"Votre vue personnalisée de l’activité, des projets et des priorités du jour."}</p><div className="live-chip"><i/> {english?"Live data":"Données actualisées"}</div></div>
        <div className="command-orbit"><div className="orbit-ring ring-a"/><div className="orbit-ring ring-b"/><div className="orbit-core"><strong>{canAccounting?money(collected-spent):metrics.length}</strong><span>{canAccounting?tx.netCash:tx.allowedMetrics}</span></div></div>
      </motion.section>
      {loadError&&<div className="error-banner dashboard-load-error"><span>{loadError}</span><button className="ghost-action" onClick={()=>window.location.reload()}>{tx.retry}</button></div>}
      {canIntelligence&&<section className="agency-intelligence">
        <motion.article className="panel agency-briefing" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}>
          <div className="agency-ai-head"><div className="ai-orb compact"><Sparkles/></div><div><span className="eyebrow"><i/> {tx.aiDirector}</span><h2>{briefing?.greeting||tx.strategicBriefing}</h2></div><button className="ghost-action" disabled={intelligenceBusy} onClick={()=>void loadIntelligence()}>{intelligenceBusy?tx.analyze:tx.refresh}</button></div>
          {intelligenceError?<div className="error-banner">{intelligenceError}</div>:<><p className="briefing-summary">{briefing?.summary||'Analyse des opérations en cours…'}</p><div className="briefing-signals"><div><strong>{tx.opportunities}</strong>{(briefing?.opportunities||[]).map((item,index)=><span key={index}>↗ {item}</span>)}</div><div><strong>{tx.watchouts}</strong>{(briefing?.watchouts||[]).map((item,index)=><span key={index}>• {item}</span>)}</div></div></>}
        </motion.article>
        <motion.article className="panel next-actions" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:.08}}><div className="command-panel-head"><div><span className="eyebrow"><i/> NEXT BEST ACTION</span><h2>Les décisions recommandées</h2></div><b>{nextActions.length}</b></div><div className="next-action-list">{nextActions.length?nextActions.map(action=><div key={action.id} className={`next-action priority-${action.priority.toLowerCase()}`}><span className="action-priority">{action.priority}</span><div><strong>{action.title}</strong><small>{action.reason}</small></div><div className="next-action-buttons"><button className="primary-btn compact" onClick={async()=>{await executeNextBestAction(action);setNextActions(rows=>rows.filter(row=>row.id!==action.id));onNavigate(action.target_page as Page,action.client_id)}}>{action.action_type==='COMPLETE_TASK'?'Confirmer terminée':'Ouvrir'}</button><button className="icon-btn" title="Ignorer" onClick={async()=>{await updateNextBestAction(action.id,'IGNOREE');setNextActions(rows=>rows.filter(row=>row.id!==action.id))}}><X/></button></div></div>):<p className="muted">Aucune action urgente. Actualisez le briefing lorsque les données changent.</p>}</div></motion.article>
      </section>}
      {platformOwner&&<SaaSSalesDashboard leads={salesLeads} advice={salesAdvice} busy={salesAdviceBusy} onSuggest={()=>void loadSalesAdvice()} onOpen={()=>onNavigate('Demandes SaaS')} />}
      {roles.includes('SUPER_ADMIN')&&<MonthlyGoalDashboard goal={monthlyGoal} busy={goalBusy} onSave={saveMonthlyGoal} />}
      <section className="innovation-launchpad">
        {canAccounting&&<button onClick={()=>onNavigate("Jumeau numérique")}><Gauge/><span><small>{tx.forecast}</small><strong>{tx.digitalTwin}</strong><em>{tx.simulate}</em></span><ChevronRight/></button>}
        {canClients&&<button onClick={()=>onNavigate("Radar commercial")}><Target/><span><small>{tx.detect}</small><strong>{tx.commercialRadar}</strong><em>{tx.prioritize}</em></span><ChevronRight/></button>}
        {allowed('communication.view')&&<button onClick={()=>onNavigate("Studio campagnes IA")}><Megaphone/><span><small>{tx.accelerate}</small><strong>{tx.campaignStudio}</strong><em>{tx.design}</em></span><ChevronRight/></button>}
      </section>
      {!metrics.length&&<div className="panel feature-ready"><ShieldCheck/><div><h2>{tx.ready}</h2><p>{tx.emptyData}</p></div></div>}
      <section className="command-metrics">{metrics.map((metric,index)=><motion.article className={`command-metric tone-${metric.tone}`} key={metric.label} initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{delay:.04*index,duration:.35}} whileHover={{y:-4}}><div className="metric-icon"><metric.icon/></div><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.copy}</small><div className="metric-scan"/></motion.article>)}</section>
      <section className="command-panels">
        {canFinance&&<motion.article className="panel finance-radar" initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} whileHover={{y:-4,scale:1.005}}><div className="command-panel-head"><div><span className="eyebrow"><i/> {tx.finance}</span><h2>{tx.sixMonths}</h2></div><span className="pulse-label">● LIVE</span></div><TrendCurve rows={monthSeries} showRevenue={canInvoices} showCost={canAccounting}/><div className="future-chart">{monthSeries.map((row,index)=><div className="future-month" key={row.label}><div className="future-bars"><motion.i initial={{height:0}} animate={{height:`${Math.max(4,row.revenue/chartMax*100)}%`}} transition={{duration:.75,delay:index*.08}}/><motion.b initial={{height:0}} animate={{height:`${Math.max(4,row.cost/chartMax*100)}%`}} transition={{duration:.75,delay:.12+index*.08}}/></div><span>{row.label}</span></div>)}</div><div className="chart-key">{canInvoices&&<span><i/>{tx.billing}</span>}{canAccounting&&<span><i/>{tx.expensesLegend}</span>}</div></motion.article>}
        {(canTasks||canProjects)&&<motion.article className="panel operations-ring" initial={{opacity:0,x:16}} animate={{opacity:1,x:0}}><div className="command-panel-head"><div><span className="eyebrow"><i/> {tx.execution}</span><h2>{tx.operational}</h2></div></div><div className="progress-orb" style={{"--progress":`${completion*3.6}deg`} as CSSProperties}><div><strong>{canTasks?`${completion}%`:'—'}</strong><span>{tx.doneTasks}</span></div></div><div className="operation-stats">{canTasks&&<><span><b>{openTasks.length}</b> {tx.openTasks}</span><span><b>{t.filter(row=>row.priority==="URGENTE"&&row.status!=="TERMINE").length}</b> {tx.urgentTasks}</span></>}{canProjects&&<span><b>{activeProjects.length}</b> {tx.projects.toLowerCase()}</span>}</div></motion.article>}
        {canClients&&<motion.article className="panel client-intelligence" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}><div className="command-panel-head"><div><span className="eyebrow"><i/> CLIENTS</span><h2>{tx.portfolio}</h2></div><span>{c.length} {tx.accounts}</span></div><div className="rank-list">{clientRows.length?clientRows:<p className="muted">{tx.noClients}</p>}</div></motion.article>}
        {canTeam&&<motion.article className="panel team-radar" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}><div className="command-panel-head"><div><span className="eyebrow"><i/> {tx.team}</span><h2>{tx.teamMotion}</h2></div><span className="pulse-label">● {onlineIds.size} {tx.online}</span></div><div className="team-cloud">{team.slice(0,8).map((member,index)=><motion.div key={member.id} whileHover={{y:-5,scale:1.04}} animate={{y:[0,-3,0]}} transition={{duration:2.8+index*.15,repeat:Infinity,delay:index*.12}} className={`team-member-card ${onlineIds.has(member.id)?"online":""}`}><b className="team-photo">{member.avatar_url?<img src={member.avatar_url} alt={`Photo de ${member.full_name}`}/>:member.full_name.slice(0,2).toUpperCase()}</b><span>{member.full_name.split(" ")[0]}</span><small>{member.roles?.[0]||member.role||"Collaborateur"}</small></motion.div>)}</div><div className="team-summary"><span><b>{team.filter(row=>row.active).length}</b> {tx.activeCollaborators}</span><span><b>{onlineIds.size}</b> {tx.livePresence}</span>{canSuppliers&&<span><b>{suppliers.length}</b> {tx.suppliersRef}</span>}</div></motion.article>}
      </section>
    </div>
  );
}

function SaaSSalesDashboard({leads,advice,busy,onSuggest,onOpen}:{leads:Array<{item:Profile;score:number;actions:number;last?:string|null}>;advice:string;busy:boolean;onSuggest:()=>void;onOpen:()=>void}){
  const hot=leads.filter(row=>row.score>=71).length, engaged=leads.filter(row=>row.score>=31).length;
  return <motion.section className="panel saas-sales-dashboard" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}><div className="command-panel-head"><div><span className="eyebrow"><i/> SALES SaaS · PRIVÉ SUPER ADMIN</span><h2>Transformer les essais en clients</h2><p>Les indicateurs d’usage vous indiquent qui contacter et pourquoi.</p></div><div className="saas-sales-actions"><button className="ghost-action" onClick={onOpen}>Voir les demandes</button><button className="primary-btn compact" onClick={onSuggest} disabled={busy}><Sparkles/>{busy?'Analyse IA…':'Suggestions IA'}</button></div></div><div className="saas-sales-kpis"><div><b>{leads.length}</b><span>Essais SaaS</span></div><div><b>{engaged}</b><span>Engagés</span></div><div><b>{hot}</b><span>Prospects chauds</span></div><div><b>{leads.length?Math.round(engaged/leads.length*100):0}%</b><span>Activation</span></div></div>{advice&&<div className="saas-ai-advice"><Sparkles/><div><strong>Recommandations du directeur commercial IA</strong><p>{advice}</p></div></div>}<div className="saas-sales-list">{leads.slice(0,5).map(lead=><div key={lead.item.id}><span className={`saas-score ${lead.score>=71?'hot':lead.score>=31?'warm':''}`}>{lead.score}</span><div><strong>{lead.item.full_name}</strong><small>{lead.actions} actions · dernière activité {fmt(lead.last)}</small></div><em>{lead.score>=71?'À contacter maintenant':lead.score>=31?'À accompagner':'À réactiver'}</em></div>)}{!leads.length&&<p className="muted">Aucune inscription autonome à analyser pour le moment.</p>}</div></motion.section>
}

function MonthlyGoalDashboard(_props:{goal?:{metric:string;target:number;period:string;plan?:string};busy:boolean;onSave:(goal:{metric:string;target:number;period:string})=>Promise<void>}){
  return <motion.section className="panel monthly-goal-dashboard" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}><span className="eyebrow">PILOTAGE DES ÉQUIPES</span><h2>Objectifs & performance</h2><p>Objectifs mensuels, répartition validée par le manager, responsables, suivi hebdomadaire et bilan.</p><button className="primary-btn compact" onClick={()=>{location.hash='/'+encodeURIComponent('Objectifs & performance')}}>Gérer les objectifs</button></motion.section>
}

function ClientDetail({
  id,
  onClose,
  onChanged,
  onNavigate,
  rights,
  tenantOwnerId,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  onNavigate: (page: "Projets" | "Tâches" | "Facturation", clientId: string) => void;
  rights: CrudRights;
  tenantOwnerId:string;
}) {
  const [data, setData] = useState<Awaited<
      ReturnType<typeof getClientWorkspace>
    > | null>(null),
    [edit, setEdit] = useState(false),
    [photoBusy, setPhotoBusy] = useState(false),
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
            const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, unknown>;
            const photo=f.avatar_file; delete f.avatar_file;
            await updateClient(id, f);
            if(photo instanceof File && photo.size){setPhotoBusy(true);try{await updateClient(id,{avatar_url:await uploadClientAvatar(photo)})}finally{setPhotoBusy(false)}}
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
            <Field label="Photo du client" wide>
              <input name="avatar_file" type="file" accept="image/png,image/jpeg,image/webp" disabled={photoBusy} />
              <small className="muted">Image facultative, visible dans le CRM et la fiche client.</small>
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
            <div className="record-avatar large client-photo-avatar">
              {data.client.avatar_url ? <img src={data.client.avatar_url} alt={`Photo de ${data.client.name}`} /> : data.client.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3>{data.client.legal_name || data.client.name}</h3>
              <p>
                {data.client.email || "Aucun email"} ·{" "}
                {data.client.phone || "Aucun téléphone"}
              </p>
              <span className={`status ${statusClass(data.client.status)}`}>{label(data.client.status)}</span>
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
          <ClientSocialDashboard tenantOwnerId={tenantOwnerId} clientId={id} clientName={data.client.name} canEdit={rights.update}/>
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
              `${label(x.status)} · ${x.task_assignees?.map(member=>member.profiles?.full_name).filter(Boolean).join(', ') || x.profiles?.full_name || "Non assignée"}`,
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

// Social connections are now part of the Smart Social workspace.

function ClientsPage({ rights, onNavigate, tenantOwnerId, canViewOffers, intent }: { rights: CrudRights; onNavigate: (page: "Projets" | "Tâches" | "Facturation", clientId: string) => void; tenantOwnerId:string; canViewOffers:boolean; intent:ModuleIntent }) {
  const [rows, setRows] = useState<Client[]>([]),
    [workspace,setWorkspace]=useState<'CLIENTS'|'PIPELINE'>(intent.view==='PIPELINE'?'PIPELINE':'CLIENTS'),
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
  useEffect(()=>{
    setWorkspace(intent.view==='PIPELINE'?'PIPELINE':'CLIENTS');
    if(intent.action==='new-client'&&rights.create)setOpen(true);
  },[intent.view,intent.action,intent.request,rights.create]);
  return (
    <>
      <Header
        title="Clients"
        copy="Fiches complètes, projets, tâches, factures et paiements reliés."
        onAdd={rights.create ? () => {setWorkspace('CLIENTS');setOpen(true)} : undefined}
        add="Nouveau client"
      />
      <ErrorBar value={error} />
      <div className="crm-workspace-tabs"><button className={workspace==='CLIENTS'?'active':''} onClick={()=>setWorkspace('CLIENTS')}><Users/>Clients & comptes</button><button className={workspace==='PIPELINE'?'active':''} onClick={()=>setWorkspace('PIPELINE')}><Target/>Pipeline commercial</button></div>
      {workspace==='PIPELINE'&&<CommercialPipeline tenantOwnerId={tenantOwnerId} rights={rights} canViewOffers={canViewOffers} intent={intent}/>}
      {workspace==='CLIENTS'&&<>
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
                <span className="record-avatar client-list-avatar">
                  {r.avatar_url ? <img src={r.avatar_url} alt={`Photo de ${r.name}`} /> : r.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{r.name}</strong>
                  <small>{r.sector || "Secteur non renseigné"}</small>
                </div>
              </div>
              <span className={`status ${statusClass(r.status)}`}>{label(r.status)}</span>
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
                  const form=new FormData(e.currentTarget);
                  const created=await createClient(Object.fromEntries(form) as Partial<Client>);
                  const photo=form.get('avatar_file');
                  if(photo instanceof File && photo.size) await updateClient(created.id,{avatar_url:await uploadClientAvatar(photo)});
                  setOpen(false);
                  setSelected(created.id);
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
                <Field label="Photo du client" wide>
                  <input name="avatar_file" type="file" accept="image/png,image/jpeg,image/webp" />
                  <small className="muted">PNG, JPG ou WEBP. Facultatif.</small>
                </Field>
              </div>
              <button className="primary-btn compact">Enregistrer</button>
            </form>
          </Modal>
        )}
        {selected && (
          <ClientDetail
            id={selected}
            tenantOwnerId={tenantOwnerId}
            onClose={() => setSelected(null)}
            onChanged={load}
            onNavigate={onNavigate}
            rights={rights}
          />
        )}
      </AnimatePresence>
      </>}
    </>
  );
}

function ProjectDetail({
  id,
  onClose,
  onChanged,
  rights,
  profiles,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  rights: CrudRights;
  profiles: Profile[];
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
          <span className={`status ${statusTone(data.project.status)}`}>{label(data.project.status)}</span>
        </div>
      </div>
      <form
        className="entity-form inline-editor"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!rights.update) return;
          const formData=new FormData(e.currentTarget);
          const f = Object.fromEntries(formData) as Record<
            string,
            string
          >;
          await updateProject(id, {
            status: f.status,
            progress: Number(f.progress),
            priority: f.priority,
            ends_on: f.ends_on || null,
            description: f.description,
          },formData.getAll('member_ids').map(String));
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
          <Field label="Équipe du projet (plusieurs choix possibles)" wide>
            <ProfileChecklist profiles={profiles} name="member_ids" selected={data.project.project_members?.map(member=>member.profile_id)||[]}/>
          </Field>
        </div>
        {rights.update && <button className="primary-btn compact">Mettre à jour le projet</button>}</fieldset>
      </form>
      <DetailList
        title="Tâches"
        rows={data.tasks.map((x) => [
          x.title,
          `${label(x.status)} · ${x.task_assignees?.map(member=>member.profiles?.full_name).filter(Boolean).join(', ') || x.profiles?.full_name || "Non assignée"}`,
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
function ProjectsPage({ rights, currentProfileId, clientFilter, onClearFilter }: { rights: CrudRights; currentProfileId: string; clientFilter?: string | null; onClearFilter?: () => void }) {
  const [rows, setRows] = useState<Project[]>([]),
    [clients, setClients] = useState<Client[]>([]),
    [profiles, setProfiles] = useState<Profile[]>([]),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [view, setView] = useState<'BOARD'|'LIST'>('BOARD'),
    [scope, setScope] = useState<'MINE'|'ALL'>('MINE'),
    [dragId, setDragId] = useState<string | null>(null),
    [error, setError] = useState("");
  const load = () => listProjects().then(setRows).catch((e) => setError(e.message));
  const loadReferences = () => {
    if (!clients.length || !profiles.length) void Promise.all([listClients(), listProfiles()]).then(([a, b]) => { setClients(a); setProfiles(b); }).catch((e) => setError(e.message));
  };
  const openCreator = () => {
    setOpen(true);
    loadReferences();
  };
  useEffect(() => {
    void load();
  }, []);
  const scopedRows = scope === 'MINE' ? rows.filter(row => row.manager_id === currentProfileId || row.project_members?.some(member => member.profile_id === currentProfileId)) : rows;
  const displayedRows = clientFilter ? scopedRows.filter((row) => row.client_id === clientFilter) : scopedRows;
  return (
    <>
      <Header
        title="Projets"
        copy="Suivi détaillé, équipe, progression, tâches et facturation."
        onAdd={rights.create ? openCreator : undefined}
        add="Nouveau projet"
      >
        <div className="segmented">
          <button className={view==='BOARD'?'active':''} onClick={()=>setView('BOARD')}>Tableau</button>
          <button className={view==='LIST'?'active':''} onClick={()=>setView('LIST')}>Liste</button>
        </div>
      </Header>
      {clientFilter && <div className="filter-banner"><span>Affichage des projets du client sélectionné.</span><button type="button" onClick={onClearFilter}>Afficher tous les projets</button></div>}
      <div className="work-scope-tabs" role="group" aria-label="Portée des projets"><button type="button" className={scope==='MINE'?'active':''} onClick={()=>setScope('MINE')}>Mes projets <span>{rows.filter(row=>row.manager_id===currentProfileId||row.project_members?.some(member=>member.profile_id===currentProfileId)).length}</span></button><button type="button" className={scope==='ALL'?'active':''} onClick={()=>setScope('ALL')}>Tous les projets <span>{rows.length}</span></button></div>
      <ErrorBar value={error} />
      {view==='BOARD' ? <section className="kanban-board project-kanban-board">{(['PLANIFIE','EN_COURS','EN_ATTENTE','TERMINE'] as const).map(status=><div className="kanban-column" key={status} onDragOver={event=>event.preventDefault()} onDrop={async()=>{if(!dragId||!rights.update)return;try{await updateProject(dragId,{status});setDragId(null);await load()}catch(e){setError(e instanceof Error?e.message:'Déplacement impossible')}}}><header><strong>{label(status)}</strong><span>{displayedRows.filter(row=>row.status===status).length}</span></header>{displayedRows.filter(row=>row.status===status).map(project=><article className="kanban-card project-kanban-card" key={project.id} draggable={rights.update} onDragStart={()=>setDragId(project.id)} onClick={()=>{setSelected(project.id);loadReferences()}}><div className="record-main"><span className="record-avatar">PR</span><div><strong>{project.name}</strong><small>{project.clients?.name||'Sans client'}</small></div></div><small>{project.project_members?.map(member=>member.profiles?.full_name).filter(Boolean).join(', ')||project.profiles?.full_name||'Sans équipe'}</small><footer><span className={`status ${statusTone(project.priority)}`}>{label(project.priority)}</span><time>{project.progress}% · {fmt(project.ends_on)}</time></footer><i className="mini-progress"><b style={{width:`${project.progress}%`}}/></i></article>)}</div>)}</section> : <div className="records panel">
        {!displayedRows.length ? (
          <Empty name="projet" onAdd={rights.create ? openCreator : undefined} />
        ) : (
          displayedRows.map((r) => (
            <article
              className="clickable-row"
              key={r.id}
              onClick={() => {setSelected(r.id);loadReferences();}}
            >
              <div className="record-main">
                <span className="record-avatar">PR</span>
                <div>
                  <strong>{r.name}</strong>
                  <small>
                    {r.clients?.name || "Sans client"} ·{" "}
                    {r.project_members?.map(member=>member.profiles?.full_name).filter(Boolean).join(', ') || r.profiles?.full_name || "Sans équipe"}
                  </small>
                </div>
              </div>
              <span className={`status ${statusClass(r.status)}`}>{label(r.status)}</span>
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
      </div>}
      <AnimatePresence>
        {open && (
          <Modal title="Créer un projet" onClose={() => setOpen(false)}>
            <form
              className="entity-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const formData=new FormData(e.currentTarget);
                const f = Object.fromEntries(formData) as Record<string, string>;
                await createProject({
                  ...f,
                  budget: Number(f.budget),
                } as Partial<Project>,formData.getAll('member_ids').map(String));
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
                <Field label="Équipe du projet (optionnel)" wide>
                  <ProfileChecklist profiles={profiles} name="member_ids" />
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
            profiles={profiles}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function TasksPage({
  rights,
  currentProfileId,
  canAssign = false,
  planning = false,
  clientFilter,
  onClearFilter,
}: {
  rights: CrudRights;
  currentProfileId: string;
  canAssign?: boolean;
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
    [view,setView]=useState<'LIST'|'KANBAN'>('LIST'),
    [scope,setScope]=useState<'MINE'|'ALL'>('MINE'),
    [planningView,setPlanningView]=useState<'CALENDAR'|'LIST'>('CALENDAR'),
    [dragId,setDragId]=useState<string|null>(null),
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
      const params = new URLSearchParams(location.hash.split("?")[1] || location.search);
      const state = params.get("calendar");
      if (state === "connected") {
        setError("");
        void getCalendarConnection().then(setCalendarConnection);
      } else if (state) {
        setError(state === "invalid_state" ? "La demande Google a expiré. Cliquez à nouveau sur Connecter Google Agenda." : "La connexion Google Agenda n’a pas abouti. Vérifiez le compte Google choisi puis réessayez.");
      }
      if (state) {
        params.delete("calendar");
        if (location.hash.includes("?calendar=")) {
          const cleanHash = location.hash.split("?")[0];
          history.replaceState({}, "", `${location.pathname}${location.search}${cleanHash}`);
        } else {
          history.replaceState({}, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
        }
      }
    }
  }, [planning]);
  const calendar = (t: Task) => {
    const start = t.due_at ? new Date(t.due_at) : new Date();
    const end = new Date(start.getTime() + 3600000);
    const g = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(t.title)}&dates=${g(start)}/${g(end)}&details=${encodeURIComponent(t.description || "Tâche Smartsell")}`;
  };
  const myTasks = rows.filter(row => row.assignee_id === currentProfileId || row.task_assignees?.some(member => member.profile_id === currentProfileId));
  const scopedRows = scope === 'MINE' ? myTasks : rows;
  const displayedRows = clientFilter ? scopedRows.filter((row) => row.projects?.client_id === clientFilter) : scopedRows;
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
      <div className="work-scope-tabs" role="group" aria-label="Portée des tâches"><button type="button" className={scope==='MINE'?'active':''} onClick={()=>setScope('MINE')}>Mes tâches <span>{myTasks.length}</span></button><button type="button" className={scope==='ALL'?'active':''} onClick={()=>setScope('ALL')}>Toutes les tâches <span>{rows.length}</span></button></div>
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
            <span className="status success">Connecté</span>
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
      {planning&&<div className="kanban-toolbar"><button className={planningView==='CALENDAR'?'active':''} onClick={()=>setPlanningView('CALENDAR')}>Calendrier global</button><button className={planningView==='LIST'?'active':''} onClick={()=>setPlanningView('LIST')}>Liste des tâches</button></div>}
      {planning&&planningView==='CALENDAR'&&<PlanningCalendar tasks={displayedRows} onSelect={task=>{setSelected(task);loadReferences()}}/>}
      {!planning&&<div className="kanban-toolbar"><button className={view==='LIST'?'active':''} onClick={()=>setView('LIST')}>Liste</button><button className={view==='KANBAN'?'active':''} onClick={()=>setView('KANBAN')}>Tableau Kanban</button><span>Déplacez une carte entre les colonnes pour mettre à jour son statut.</span></div>}
      {planning&&planningView==='CALENDAR'?null:view==='KANBAN'&&!planning?<section className="kanban-board">{(['A_FAIRE','EN_COURS','EN_ATTENTE','EN_REVUE','BLOQUE','TERMINE'] as const).map(status=><div className="kanban-column" data-tone={statusTone(status)} key={status} onDragOver={event=>event.preventDefault()} onDrop={async()=>{if(!dragId||!rights.update)return;try{await updateTask(dragId,{status});setDragId(null);setError('');await load()}catch(e){setError(e instanceof Error?e.message:'Déplacement impossible')}}}><header><strong>{label(status)}</strong><span>{displayedRows.filter(row=>row.status===status).length}</span></header>{displayedRows.filter(row=>row.status===status).map(task=><article className="kanban-card" data-tone={statusTone(task.status)} key={task.id} draggable={rights.update} onDragStart={()=>setDragId(task.id)} onClick={()=>{setSelected(task);loadReferences()}}><strong>{task.title}</strong><small>{task.projects?.name||'Sans projet'}</small><small>{task.task_assignees?.map(member=>member.profiles?.full_name).filter(Boolean).join(', ')||task.profiles?.full_name||'Non assignée'}</small><footer><span className={`status ${statusTone(task.status)}`}>{label(task.status)}</span><time>{fmt(task.due_at)}</time></footer></article>)}</div>)}</section>:<div className="records panel">
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
                    {r.task_assignees?.map(member=>member.profiles?.full_name).filter(Boolean).join(', ') || r.profiles?.full_name || "Non assignée"}
                  </small>
                </div>
              </div>
              <span className={`status ${statusTone(r.status)}`}>{label(r.status)}</span>
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
      </div>}
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
                  priority: String(f.get("priority")),
                  due_at: String(f.get("due_at") || "") || null,
                  description: String(f.get("description") || ""),
                  reminder_minutes: Number(f.get("reminder_minutes") || 30),
                  notification_channels: f.getAll(
                    "notification_channels",
                  ) as string[],
                },canAssign ? f.getAll('assignee_ids').map(String) : []);
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
                {canAssign ? <Field label="Personnes assignées (optionnel)" wide>
                  <ProfileChecklist profiles={profiles} name="assignee_ids" />
                </Field> : <div className="security-note"><ShieldCheck/><span>Vous pouvez créer la tâche. L’attribution à d’autres collaborateurs est réservée aux personnes autorisées dans « Équipe et droits ».</span></div>}
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
                try {
                  const formData=new FormData(e.currentTarget);
                  const f = Object.fromEntries(formData) as Record<string, string>;
                  const nextAssignees=formData.getAll('assignee_ids').map(String).sort();
                  const previousAssignees=(selected.task_assignees?.map(member=>member.profile_id)??(selected.assignee_id?[selected.assignee_id]:[])).sort();
                  const assignmentsChanged=canAssign&&JSON.stringify(nextAssignees)!==JSON.stringify(previousAssignees);
                  await updateTask(selected.id, {
                    title: f.title,
                    description: f.description,
                    status: f.status,
                    priority: f.priority,
                    due_at: f.due_at || null,
                  },assignmentsChanged?nextAssignees:undefined);
                  setError('');
                  setSelected(null);
                  await load();
                } catch (caught) { setError(caught instanceof Error?caught.message:'Mise à jour impossible'); }
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
                    <option>EN_ATTENTE</option>
                    <option>EN_REVUE</option>
                    <option>BLOQUE</option>
                    <option>TERMINE</option>
                  </select>
                </Field>
                {canAssign ? <Field label="Personnes assignées" wide>
                  <ProfileChecklist profiles={profiles} name="assignee_ids" selected={selected.task_assignees?.map(member=>member.profile_id) ?? (selected.assignee_id?[selected.assignee_id]:[])}/>
                </Field> : <div className="security-note"><ShieldCheck/><span>L’attribution à d’autres collaborateurs nécessite l’autorisation « Attribuer ».</span></div>}
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

function ServicesPage({ rights }: { rights:CrudRights }) {
  const [rows, setRows] = useState<Service[]>([]),
    [suppliers, setSuppliers] = useState<Supplier[]>([]),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<Service | null>(null);
  const load = () => Promise.all([listServices(),listSuppliers()]).then(([services,nextSuppliers])=>{setRows(services);setSuppliers(nextSuppliers)});
  useEffect(() => {
    void load();
  }, []);
  const form = (item?: Service) => (
    <form
      className="entity-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if(item?!rights.update:!rights.create)return;
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
          supplier_id: f.supplier_id || null,
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
        <Field label="Fournisseur associé">
          <select name="supplier_id" defaultValue={item?.supplier_id || ""}>
            <option value="">Service interne / aucun fournisseur</option>
            {suppliers.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </Field>
        <Field label="Description" wide>
          <textarea name="description" defaultValue={item?.description || ""} />
        </Field>
      </div>
      <div className="form-actions">
        {(!item&&rights.create||Boolean(item)&&rights.update)&&<button className="primary-btn compact">Enregistrer</button>}
        {item && rights.delete && (
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
        onAdd={rights.create?() => setOpen(true):undefined}
        add="Nouveau service"
      />
      <div className="records panel">
        {!rows.length ? (
          <Empty name="service" onAdd={rights.create?() => setOpen(true):undefined} />
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
                    {r.category || "Sans catégorie"} · par {r.unit} · {r.suppliers?.name || "Service interne"}
                  </small>
                </div>
              </div>
              <span className={`status ${statusTone(r.active ? "Actif" : "Inactif")}`}>{r.active ? "Actif" : "Inactif"}</span>
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
              <span className={`status ${statusTone(r.status)}`}>{label(r.status)}</span>
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

function DocumentsPage({rights}:{rights:CrudRights}) {
  const [rows, setRows] = useState<CommercialDocument[]>([]),
    [clients, setClients] = useState<Client[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [company,setCompany] = useState<CompanySettings|null>(null),
    [kind,setKind] = useState('BON_COMMANDE'),
    [notes,setNotes] = useState(''),
    [documentError,setDocumentError] = useState(''),
    [pdfBusy,setPdfBusy] = useState(false),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<CommercialDocument | null>(null);
  const load = () =>
    Promise.all([
      listCommercialDocuments(),
      listClients(),
      listProjects(),
      getCompanySettings(),
    ]).then(([a, b, c, d]) => {
      setRows(a);
      setClients(b);
      setProjects(c);
      setCompany(d);
    });
  const pdfAction=async(share:boolean)=>{
    if(!selected||pdfBusy)return
    setPdfBusy(true);setDocumentError('')
    try{
      const file=await commercialPdfFile(selected,company)
      if(share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:selected.number,text:commercialKindNames[selected.kind]||selected.kind});return}
      const url=URL.createObjectURL(file),anchor=document.createElement('a')
      anchor.href=url;anchor.download=file.name;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),60_000)
      if(share)setDocumentError('Le partage de fichier n’est pas pris en charge sur cet appareil. Le PDF a été téléchargé pour que vous puissiez l’envoyer.')
    }catch(error){if((error as DOMException).name!=='AbortError')setDocumentError(error instanceof Error?error.message:'PDF indisponible')}
    finally{setPdfBusy(false)}
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <Header
        title="Générateur de documents"
        copy="Bons, offres, ordres de mission et projets de contrats : créez, téléchargez et partagez vos PDF."
        onAdd={rights.create?() => setOpen(true):undefined}
        add="Nouveau document"
      />
      {documentError&&<div className="error-banner" role="status">{documentError}</div>}
      <div className="records panel">
        {!rows.length ? (
          <Empty name="document" onAdd={rights.create?() => setOpen(true):undefined} />
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
                    {commercialKindNames[r.kind]||label(r.kind)} · {r.clients?.name}
                  </small>
                </div>
              </div>
              <span className={`status ${statusTone(r.status)}`}>{label(r.status)}</span>
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
                try{
                  setDocumentError('')
                  await createCommercialDocument({...f,kind,notes,total:Number(f.total)} as Partial<CommercialDocument>);
                  setOpen(false);setNotes('');setKind('BON_COMMANDE');await load();
                }catch(error){setDocumentError(error instanceof Error?error.message:'Création impossible')}
              }}
            >
              <div className="form-grid">
                <Field label="Type">
                  <select name="kind" value={kind} onChange={event=>{const next=event.target.value;setKind(next);setNotes(commercialDrafts[next]||'')}}>
                    <option value="BON_COMMANDE">Bon de commande</option>
                    <option value="BON_LIVRAISON">Bon de livraison</option>
                    <option value="BON_VENTE">Bon de vente</option>
                    <option value="BON_SORTIE">Bon de sortie matériel</option>
                    <option value="BON_ENTREE">Bon d’entrée matériel</option>
                    <option value="CONTRAT_CLIENT">Projet de contrat client</option>
                    <option value="OFFRE_COMMUNICATION">Offre de communication</option>
                    <option value="ORDRE_MISSION">Ordre de mission</option>
                    <option value="PROPOSITION_COMMERCIALE">Proposition commerciale</option>
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
                <Field label="Contenu / clauses / détails" wide>
                  <textarea name="notes" rows={12} value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Décrivez la prestation, les livrables et les conditions du document…" />
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
                <i /> {commercialKindNames[selected.kind]||label(selected.kind)}
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
              <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{selected.notes}</p>
              <div className="form-actions">
                <button
                  className="primary-btn compact"
                  disabled={pdfBusy}
                  onClick={() => void pdfAction(false)}
                >
                  {pdfBusy?'Préparation du PDF…':'Télécharger le PDF'}
                </button>
                <button className="ghost-action" disabled={pdfBusy} onClick={()=>void pdfAction(true)}><Send/>Partager le PDF</button>
                {rights.update&&<button
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
                </button>}
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function AccountingPage({rights}:{rights:CrudRights}) {
  const [rows, setRows] = useState<Expense[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [invoices, setInvoices] = useState<Invoice[]>([]),
    [payments, setPayments] = useState<Payment[]>([]),
    [open, setOpen] = useState(false);
  const load = () =>
    Promise.all([listExpenses(), listProjects(),listInvoices(),listPayments()]).then(([a, b,c,d]) => {
      setRows(a);
      setProjects(b);
      setInvoices(c);
      setPayments(d);
    });
  useEffect(() => {
    void load();
  }, []);
  const approved=rows.filter(row=>row.status==='APPROUVE'),approvedTotal=approved.reduce((sum,row)=>sum+Number(row.amount),0),pendingTotal=rows.filter(row=>row.status!=='APPROUVE').reduce((sum,row)=>sum+Number(row.amount),0),billed=invoices.reduce((sum,row)=>sum+Number(row.total),0),collected=payments.reduce((sum,row)=>sum+Number(row.amount),0),receivables=Math.max(0,billed-collected),result=collected-approvedTotal,categories=Object.entries(rows.reduce<Record<string,number>>((acc,row)=>{const key=row.category||'Autre';acc[key]=(acc[key]||0)+Number(row.amount);return acc},{})).sort((a,b)=>b[1]-a[1]);
  return (
    <>
      <Header
        title="Comptabilité"
        copy="Pilotage des dépenses, encaissements, créances, résultat et centres de coûts."
        onAdd={rights.create?() => setOpen(true):undefined}
        add="Nouvelle dépense"
      />
      <section className="production-kpis accounting-kpis">
        <Stat
          name="Dépenses approuvées"
          value={money(approvedTotal)}
          copy={`${approved.length} opération(s) validée(s)`}
        />
        <Stat
          name="Dépenses à approuver"
          value={money(pendingTotal)}
          copy={`${rows.length-approved.length} en attente`}
        />
        <Stat
          name="Encaissements"
          value={money(collected)}
          copy={`${payments.length} paiement(s)`}
        />
        <Stat name="Créances clients" value={money(receivables)} copy={`${invoices.filter(invoice=>invoice.status!=='PAYEE').length} facture(s) à suivre`}/>
        <Stat name="Résultat de trésorerie" value={money(result)} copy={result>=0?'Solde positif':'Attention : solde négatif'}/>
        <Stat name="Total facturé" value={money(billed)} copy={`${invoices.length} facture(s)`}/>
      </section>
      <section className="accounting-overview">
        <div className="panel accounting-breakdown"><div className="panel-title"><div><span className="eyebrow"><i/> ANALYSE</span><h2>Dépenses par catégorie</h2></div></div>{categories.length?categories.slice(0,8).map(([name,value])=><div className="accounting-bar" key={name}><span>{name}</span><i><b style={{width:`${Math.max(4,value/Math.max(...categories.map(entry=>entry[1]))*100)}%`}}/></i><strong>{money(value)}</strong></div>):<p className="muted">Aucune dépense enregistrée.</p>}</div>
        <div className="panel accounting-summary"><h2>Situation financière</h2><div><span>Taux d'encaissement</span><strong>{billed?Math.round(collected/billed*100):0}%</strong></div><div><span>Centres de coûts</span><strong>{new Set(rows.map(row=>row.project_id).filter(Boolean)).size}</strong></div><div><span>Dépenses totales</span><strong>{money(approvedTotal+pendingTotal)}</strong></div></div>
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
            <span className={`status ${statusTone(r.status)}`}>{label(r.status)}</span>
            <span className="record-meta">
              {r.category || "Autre"} · {fmt(r.spent_on)}
            </span>
            <b className="record-amount">{money(r.amount, r.currency)}</b>
            {rights.update&&r.status!=='APPROUVE'&&<button className="ghost-action" onClick={async()=>{await updateExpenseStatus(r.id,'APPROUVE');await load()}}>Approuver</button>}
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

function EquipmentPage({rights}:{rights:CrudRights}) {
  const [rows,setRows]=useState<Equipment[]>([]),[categories,setCategories]=useState<EquipmentCategory[]>([]),
    [movements,setMovements]=useState<EquipmentMovement[]>([]),[open,setOpen]=useState(false),[categoryOpen,setCategoryOpen]=useState(false),
    [selected,setSelected]=useState<Equipment|null>(null),[movementType,setMovementType]=useState<'SORTIE'|'RETOUR'|null>(null),[error,setError]=useState('');
  const load=()=>Promise.all([listEquipment(),listEquipmentCategories(),listEquipmentMovements()]).then(([equipment,nextCategories,nextMovements])=>{setRows(equipment);setCategories(nextCategories);setMovements(nextMovements)}).catch(reason=>setError(reason instanceof Error?reason.message:'Chargement impossible'));
  useEffect(()=>{void load()},[]);
  const equipmentForm=(item?:Equipment)=><form className="entity-form" onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget),categoryId=String(form.get('category_id')||''),category=categories.find(row=>row.id===categoryId);const input={code:String(form.get('code')),name:String(form.get('name')),model:String(form.get('model')||'')||null,category_id:categoryId||null,category:category?.name||'Autre',serial_number:String(form.get('serial_number')||'')||null,condition:String(form.get('condition')||'')||null,status:String(form.get('status')),notes:String(form.get('notes')||'')||null} as Partial<Equipment>;try{if(item)await updateEquipment(item.id,input);else await createEquipment(input);setOpen(false);setSelected(null);await load()}catch(reason){setError(reason instanceof Error?reason.message:'Enregistrement impossible')}}}>
    <div className="form-grid"><Field label="Code"><input name="code" defaultValue={item?.code||''} required/></Field><Field label="Désignation"><input name="name" defaultValue={item?.name||''} required/></Field><Field label="Modèle"><input name="model" defaultValue={item?.model||''}/></Field><Field label="Catégorie"><select name="category_id" defaultValue={item?.category_id||categories.find(row=>row.name===item?.category)?.id||''} required><option value="">Choisir…</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Field label="N° de série"><input name="serial_number" defaultValue={item?.serial_number||''}/></Field><Field label="État"><input name="condition" defaultValue={item?.condition||''} placeholder="Bon, à contrôler…"/></Field><Field label="Statut"><select name="status" defaultValue={item?.status||'DISPONIBLE'}><option>DISPONIBLE</option><option>EN_MISSION</option><option>MAINTENANCE</option><option>HORS_SERVICE</option></select></Field><Field label="Notes" wide><textarea name="notes" defaultValue={item?.notes||''}/></Field></div><button className="primary-btn compact">{item?'Enregistrer les modifications':'Ajouter à l’inventaire'}</button>
  </form>;
  return <>
    <Header title="Matériel" copy="Inventaire complet, modèles, catégories personnalisables et traçabilité des entrées/sorties." onAdd={rights.create?()=>setOpen(true):undefined} add="Nouveau matériel">
      {rights.create&&<button className="ghost-action" onClick={()=>setCategoryOpen(true)}><Plus/>Nouvelle catégorie</button>}
    </Header>
    <ErrorBar value={error}/>
    <section className="command-metrics equipment-summary"><Stat name="Équipements" value={rows.length} copy={`${rows.filter(row=>row.status==='DISPONIBLE').length} disponibles`}/><Stat name="En mission" value={rows.filter(row=>row.status==='EN_MISSION').length} copy="sorties actives"/><Stat name="Catégories" value={categories.length} copy="standards et personnalisées"/><Stat name="Mouvements" value={movements.length} copy="entrées et sorties tracées"/></section>
    <div className="records panel">{rows.length?rows.map(row=><article className="clickable-row" key={row.id} onClick={()=>setSelected(row)}><div className="record-main"><span className="record-avatar">MT</span><div><strong>{row.name}</strong><small>{row.code} · {row.model||'Modèle non renseigné'} · {row.serial_number||'Sans n° de série'}</small></div></div><span className={`status ${statusTone(row.status)}`}>{label(row.status)}</span><span className="record-meta">{row.category||'Autre'}</span><b className="record-amount">{row.condition||'—'} <ChevronRight/></b></article>):<Empty name="matériel" onAdd={rights.create?()=>setOpen(true):undefined}/>}</div>
    <section className="panel detail-section"><h3>Derniers mouvements</h3>{movements.slice(0,10).map(movement=><div className="detail-line" key={movement.id}><strong>{movement.movement_type==='SORTIE'?'↗ Bon de sortie':'↙ Bon de rentrée'} · {movement.equipment?.name||'Matériel'}</strong><span>{movement.reason||movement.condition_notes||'Sans précision'}</span><b>{fmt(movement.moved_at)}</b></div>)}{!movements.length&&<p className="muted">Aucun mouvement enregistré.</p>}</section>
    <AnimatePresence>
      {open&&<Modal title="Ajouter du matériel" onClose={()=>setOpen(false)}>{equipmentForm()}</Modal>}
      {categoryOpen&&<Modal title="Créer une catégorie" onClose={()=>setCategoryOpen(false)} wide={false}><form className="entity-form" onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget);try{await createEquipmentCategory({name:String(form.get('name')),description:String(form.get('description')||'')});setCategoryOpen(false);await load()}catch(reason){setError(reason instanceof Error?reason.message:'Création impossible')}}}><Field label="Nom"><input name="name" required/></Field><Field label="Description"><textarea name="description"/></Field><button className="primary-btn compact">Créer la catégorie</button></form></Modal>}
      {selected&&!movementType&&<Modal title={selected.name} onClose={()=>setSelected(null)}><div className="detail-hero"><div className="record-avatar large">MT</div><div><h3>{selected.name}</h3><p>{selected.model||'Modèle non renseigné'} · {selected.category||'Autre'} · {selected.serial_number||'Sans n° de série'}</p><span className={`status ${statusTone(selected.status)}`}>{label(selected.status)}</span></div></div>{rights.update&&equipmentForm(selected)}<div className="form-actions">{rights.update&&<><button className="ghost-action" onClick={()=>setMovementType('SORTIE')}>Bon de sortie</button><button className="primary-btn compact" onClick={()=>setMovementType('RETOUR')}>Bon de rentrée</button></>}{rights.delete&&<Danger onClick={async()=>{if(confirm(`Supprimer ${selected.name} de l’inventaire ?`)){await deleteEquipment(selected.id);setSelected(null);await load()}}}/>}</div></Modal>}
      {selected&&movementType&&<Modal title={movementType==='SORTIE'?'Enregistrer un bon de sortie':'Enregistrer un bon de rentrée'} onClose={()=>setMovementType(null)} wide={false}><form className="entity-form" onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget);try{await recordEquipmentMovement({equipment_id:selected.id,movement_type:movementType,reason:String(form.get('reason')||''),condition_notes:String(form.get('condition_notes')||'')});setMovementType(null);setSelected(null);await load()}catch(reason){setError(reason instanceof Error?reason.message:'Mouvement impossible')}}}><p><strong>{selected.code} · {selected.name}</strong></p><Field label="Motif"><input name="reason" required placeholder={movementType==='SORTIE'?'Projet, tournage, prêt…':'Retour, réintégration, récupération…'}/></Field><Field label="État constaté"><textarea name="condition_notes" placeholder="État du matériel au moment du mouvement"/></Field><button className="primary-btn compact">Valider le {movementType==='SORTIE'?'bon de sortie':'bon de rentrée'}</button></form></Modal>}
    </AnimatePresence>
  </>;
}

function CommunicationPage({ onBack }: { onBack: () => void }) {
  const [tool,setTool]=useState<'MESSAGE'|'CAMPAIGNS'|'CALLS'>('MESSAGE'),[channel,setChannel]=useState<'SMS'|'EMAIL'>('SMS'),[to,setTo]=useState(''),[subject,setSubject]=useState(''),[message,setMessage]=useState(''),[result,setResult]=useState(''),[busy,setBusy]=useState(false),[contacts,setContacts]=useState<ImportedContact[]>([]),[selectedContacts,setSelectedContacts]=useState<string[]>([]),[sheetUrl,setSheetUrl]=useState(''),[importBusy,setImportBusy]=useState(false),[campaigns,setCampaigns]=useState<Campaign[]>([]),[prospects,setProspects]=useState<Prospect[]>([]),[clients,setClients]=useState<Client[]>([]),[calls,setCalls]=useState<CallLog[]>([]),[campaignOpen,setCampaignOpen]=useState(false),[prospectOpen,setProspectOpen]=useState(false),[activeCall,setActiveCall]=useState<{log:CallLog;name:string}|null>(null);
  type PhoneContact={name?:string[];tel?:string[];email?:string[]};type ContactsManager={getProperties:()=>Promise<string[]>;select:(properties:string[],options:{multiple:boolean})=>Promise<PhoneContact[]>};
  const contactsManager=(navigator as Navigator&{contacts?:ContactsManager}).contacts,phoneDirectoryAvailable=Boolean(contactsManager&&window.isSecureContext),availableContacts=contacts.filter(contact=>channel==='SMS'?contact.phone:contact.email);
  const reloadOperations=()=>Promise.all([listCampaigns(),listProspects(),listClients(),listCallLogs()]).then(([nextCampaigns,nextProspects,nextClients,nextCalls])=>{setCampaigns(nextCampaigns);setProspects(nextProspects);setClients(nextClients);setCalls(nextCalls)}).catch(error=>setResult(error instanceof Error?error.message:'Chargement impossible'));
  useEffect(()=>{void reloadOperations()},[]);
  const mergeContacts=(next:ImportedContact[])=>{setContacts(current=>{const merged=[...current];next.forEach(contact=>{if(!merged.some(item=>(contact.phone&&item.phone===contact.phone)||(contact.email&&item.email===contact.email)))merged.push(contact)});return merged});setResult(`${next.length} contact(s) importé(s). Sélectionnez les destinataires à ajouter.`)};
  const importFile=async(file:File)=>{setImportBusy(true);setResult('');try{mergeContacts(await contactsFromFile(file))}catch(error){setResult(error instanceof Error?error.message:'Import impossible')}finally{setImportBusy(false)}};
  const importGoogleSheet=async()=>{setImportBusy(true);setResult('');try{const response=await fetch(googleSheetCsvUrl(sheetUrl));if(!response.ok)throw new Error('Le Google Sheet doit être partagé en lecture ou publié sur le Web.');mergeContacts(contactsFromCsv(await response.text()))}catch(error){setResult(error instanceof Error?error.message:'Import Google Sheets impossible')}finally{setImportBusy(false)}};
  const importPhoneDirectory=async()=>{if(!contactsManager||!window.isSecureContext){setResult('Ce navigateur ne permet pas aux applications Web d’ouvrir Contacts. Utilisez Chrome sur Android, puis touchez à nouveau l’icône du répertoire.');return}setImportBusy(true);setResult('');try{const supported=await contactsManager.getProperties(),properties=['name','tel','email'].filter(property=>supported.includes(property)),selected=await contactsManager.select(properties,{multiple:true}),imported=selected.flatMap((contact,contactIndex)=>{const name=contact.name?.[0]||'Contact téléphone',phones=(contact.tel||[]).map(value=>value.trim()).filter(Boolean),emails=(contact.email||[]).map(value=>value.trim().toLowerCase()).filter(Boolean),count=Math.max(phones.length,emails.length,1);return Array.from({length:count},(_,index):ImportedContact=>({id:`phone-${Date.now()}-${contactIndex}-${index}`,name,phone:phones[index]||'',email:emails[index]||'',company:'Répertoire téléphone',tags:'Téléphone'})).filter(contact=>contact.phone||contact.email)}),recipients=imported.map(contact=>channel==='SMS'?contact.phone:contact.email).filter(Boolean);if(!recipients.length){setResult(channel==='SMS'?'Les contacts choisis ne contiennent aucun numéro.':'Les contacts choisis ne contiennent aucun e-mail.');return}mergeContacts(imported);const existing=to.split(/[;,\n]/).map(value=>value.trim()).filter(Boolean);setTo(Array.from(new Set([...existing,...recipients])).join('\n'));setResult(`${recipients.length} destinataire(s) ajouté(s) depuis Contacts.`)}catch(error){setResult(error instanceof DOMException&&error.name==='AbortError'?'Sélection annulée.':error instanceof Error?error.message:'Impossible d’ouvrir Contacts.')}finally{setImportBusy(false)}};
  const addSelectedRecipients=()=>{const recipients=contacts.filter(contact=>selectedContacts.includes(contact.id)).map(contact=>channel==='SMS'?contact.phone:contact.email).filter(Boolean),existing=to.split(/[;,\n]/).map(value=>value.trim()).filter(Boolean);setTo(Array.from(new Set([...existing,...recipients])).join('\n'));setResult(`${recipients.length} destinataire(s) ajouté(s).`)};
  const callContact=async(contact:{type:'PROSPECT'|'CLIENT';id:string;name:string;phone:string})=>{try{const log=await startCall({contact_type:contact.type,contact_id:contact.id,phone:contact.phone});setActiveCall({log,name:contact.name});window.location.href=`tel:${contact.phone.replace(/\s/g,'')}`}catch(error){setResult(error instanceof Error?error.message:'Appel impossible')}};
  const campaignStatus=(campaign:Campaign)=>campaign.status==='QUEUED'&&campaign.scheduled_at&&new Date(campaign.scheduled_at)>new Date()?'PLANIFIÉE':campaign.status;
  return <>
    <Header title="Communication" copy="Messages directs, campagnes marketing planifiées et centre d’appels commercial."><button type="button" className="ghost-action" onClick={onBack}><ArrowLeft/>Retour</button></Header>
    <div className="communication-mode-tabs"><button className={tool==='MESSAGE'?'active':''} onClick={()=>setTool('MESSAGE')}><MessageSquareText/>Message rapide</button><button className={tool==='CAMPAIGNS'?'active':''} onClick={()=>setTool('CAMPAIGNS')}><Send/>Campagnes</button><button className={tool==='CALLS'?'active':''} onClick={()=>setTool('CALLS')}><Phone/>Call center</button></div>
    {tool!=='CALLS'&&<section className="panel contact-import-panel">
      <div className="contact-import-head"><div><span className="eyebrow"><i/> BASE DE CONTACTS</span><h2>Importer des destinataires</h2><p>CSV, Excel ou Google Sheets — Nom, Téléphone, E-mail, Entreprise et Tags.</p></div><div className="template-actions"><a className="ghost-action" href={`${import.meta.env.BASE_URL}templates/Modele-import-contacts-Smartsell.xlsx`} download><FileSpreadsheet/>Modèle Excel</a><a className="ghost-action" href={`${import.meta.env.BASE_URL}templates/modele-contacts-smartsell.csv`} download>Modèle CSV</a></div></div>
      <div className="contact-import-tools"><label className="upload-card"><Upload/><span>{importBusy?'Import en cours…':'Importer CSV ou Excel'}</span><small>.csv ou .xlsx</small><input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={importBusy} onChange={event=>{const file=event.target.files?.[0];if(file)void importFile(file);event.currentTarget.value='' }}/></label><div className="google-sheet-import"><FileSpreadsheet/><div><strong>Google Sheets</strong><small>Feuille partagée en lecture.</small></div><input value={sheetUrl} onChange={event=>setSheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…"/><button type="button" className="primary-btn compact" disabled={!sheetUrl||importBusy} onClick={()=>void importGoogleSheet()}>Importer</button></div></div>
      {contacts.length>0&&<div className="contact-picker"><div className="contact-picker-toolbar"><strong>{contacts.length} contact(s) importé(s)</strong><div><button type="button" className="ghost-action" onClick={()=>setSelectedContacts(availableContacts.map(contact=>contact.id))}>Tout sélectionner ({availableContacts.length})</button><button type="button" className="primary-btn compact" disabled={!selectedContacts.length} onClick={addSelectedRecipients}>Ajouter aux destinataires</button></div></div><div className="contact-table"><div className="contact-row contact-header"><span></span><span>Nom</span><span>Téléphone</span><span>E-mail</span><span>Entreprise</span></div>{contacts.map(contact=>{const usable=channel==='SMS'?Boolean(contact.phone):Boolean(contact.email);return <label className={`contact-row ${usable?'':'disabled'}`} key={contact.id}><input type="checkbox" disabled={!usable} checked={selectedContacts.includes(contact.id)} onChange={event=>setSelectedContacts(event.target.checked?[...selectedContacts,contact.id]:selectedContacts.filter(id=>id!==contact.id))}/><span>{contact.name||'Sans nom'}</span><span>{contact.phone||'—'}</span><span>{contact.email||'—'}</span><span>{contact.company||'—'}</span></label>})}</div></div>}
    </section>}
    {tool==='MESSAGE'&&<div className="communication-layout"><form className="panel communication-compose" onSubmit={async event=>{event.preventDefault();setBusy(true);setResult('');try{const response=await sendCommunication({channel,recipients:to.split(/[;,\n]/).map(value=>value.trim()).filter(Boolean),message,subject});setResult(`Envoi accepté · ${response.recipientCount} destinataire(s)${response.providerStatus?` · ${response.providerStatus}`:''}.`)}catch(error){setResult(error instanceof Error?error.message:'Envoi impossible')}finally{setBusy(false)}}}>
      <div className="channel-tabs"><button type="button" className={channel==='SMS'?'active':''} onClick={()=>{setChannel('SMS');setSelectedContacts([])}}><MessageSquareText/>SMS</button><button type="button" className={channel==='EMAIL'?'active':''} onClick={()=>{setChannel('EMAIL');setSelectedContacts([])}}><Mail/>Email</button></div>
      <label>Destinataires<div className="recipient-input"><textarea value={to} onChange={event=>setTo(event.target.value)} placeholder={channel==='SMS'?'+224 620 00 00 00':'client@entreprise.com'} required/>{channel==='SMS'&&<button type="button" className="directory-icon" aria-label="Ouvrir le répertoire du téléphone" title={phoneDirectoryAvailable?'Ouvrir Contacts':'Chrome Android requis'} onClick={()=>void importPhoneDirectory()}><Users/></button>}</div></label>
      {channel==='EMAIL'&&<label>Objet<input value={subject} onChange={event=>setSubject(event.target.value)} required/></label>}
      <label>Message<textarea value={message} onChange={event=>setMessage(event.target.value)} rows={7} required/></label><button className="primary-btn compact" disabled={busy}><Send/>{busy?'Envoi…':'Envoyer'}</button>{result&&<p className="result-note">{result}</p>}
    </form><aside className="panel communication-help"><Phone/><h2>Prospection multicanale</h2><p>Utilisez le répertoire dans le champ Destinataires, préparez une campagne ou ouvrez le Call center pour traiter les prospects un par un.</p><span className="status success">SMS Nimba actif</span><h3>Confidentialité</h3><p>Smartsell Management ne reçoit que les contacts sélectionnés volontairement dans le sélecteur natif du téléphone.</p></aside></div>}
    {tool==='CAMPAIGNS'&&<section className="campaign-workspace"><div className="campaign-toolbar panel"><div><span className="eyebrow"><i/> MARKETING</span><h2>Campagnes SMS & e-mail</h2><p>Préparez l’audience, programmez l’heure et suivez l’état de diffusion.</p></div><button className="primary-btn compact" onClick={()=>setCampaignOpen(true)}><Plus/>Nouvelle campagne</button></div><div className="campaign-stats"><div className="panel"><b>{campaigns.length}</b><span>Campagnes</span></div><div className="panel"><b>{campaigns.filter(item=>campaignStatus(item)==='PLANIFIÉE').length}</b><span>Planifiées</span></div><div className="panel"><b>{campaigns.filter(item=>item.status==='SENT').length}</b><span>Envoyées</span></div><div className="panel"><b>{campaigns.reduce((sum,item)=>sum+Number(item.recipient_count||0),0)}</b><span>Destinataires</span></div></div><div className="records panel">{campaigns.length?campaigns.map(item=><article key={item.id}><div className="record-main"><span className="record-avatar">{item.channel==='SMS'?'SM':'EM'}</span><div><strong>{item.name}</strong><small>{item.channel} · {item.recipient_count} destinataire(s)</small></div></div><span className={`status ${statusTone(campaignStatus(item))}`}>{campaignStatus(item)}</span><span className="record-meta">{item.scheduled_at?new Date(item.scheduled_at).toLocaleString('fr-FR'):'Sans programmation'}</span><b className="record-amount">{item.status==='FAILED'?'À vérifier':'Suivi actif'}</b></article>):<div className="empty-state">Aucune campagne. Créez votre première diffusion marketing.</div>}</div></section>}
    {tool==='CALLS'&&<section className="call-center"><div className="call-center-hero panel"><div><span className="eyebrow"><i/> LIVE SALES DESK</span><h2>Centre d’appels commercial</h2><p>File de prospection, appel direct, qualification et compte rendu.</p></div><button className="primary-btn compact" onClick={()=>setProspectOpen(true)}><Plus/>Nouveau prospect</button><div className="call-pulse"><Phone/><span>Prêt à appeler</span></div></div><div className="call-center-grid"><div className="panel call-queue"><h3>File de prospection</h3>{[...prospects.map(item=>({type:'PROSPECT' as const,id:item.id,name:item.contact_name||item.company,company:item.company,phone:item.phone||'',email:item.email||'',stage:item.stage})),...clients.map(item=>({type:'CLIENT' as const,id:item.id,name:item.name,company:item.legal_name||item.name,phone:item.phone||'',email:item.email||'',stage:'CLIENT'}))].filter(item=>item.phone).map(item=><div className="call-row" key={`${item.type}-${item.id}`}><span className="call-avatar">{item.name.slice(0,2).toUpperCase()}</span><div><strong>{item.name}</strong><small>{item.company} · {item.stage}</small><em>{item.phone}{item.email?` · ${item.email}`:''}</em></div><button onClick={()=>void callContact(item)}><Phone/>Appeler</button></div>)}</div><aside className="panel call-history"><h3>Derniers appels</h3>{calls.length?calls.slice(0,12).map(call=><div key={call.id}><span>{call.phone}</span><b>{call.outcome||call.status}</b><small>{new Date(call.created_at).toLocaleString('fr-FR')}</small></div>):<p>Aucun appel enregistré.</p>}</aside></div></section>}
    {campaignOpen&&<Modal title="Nouvelle campagne marketing" onClose={()=>setCampaignOpen(false)}><form className="entity-form" onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget),action=((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement)?.value||'schedule',recipients=String(form.get('recipients')||'').split(/[;,\n]/).map(value=>value.trim()).filter(Boolean);setBusy(true);try{await createCampaign({name:String(form.get('name')),channel:String(form.get('channel')) as 'SMS'|'EMAIL',subject:String(form.get('subject')||''),message:String(form.get('message')),recipients,scheduled_at:String(form.get('scheduled_at')||'')||null,send_now:action==='now'});setCampaignOpen(false);setResult(action==='now'?'Campagne lancée.':'Campagne planifiée.');await reloadOperations()}catch(error){setResult(error instanceof Error?error.message:'Création impossible')}finally{setBusy(false)}}}><div className="form-grid"><Field label="Nom"><input name="name" required/></Field><Field label="Canal"><select name="channel" defaultValue={channel} onChange={event=>setChannel(event.target.value as 'SMS'|'EMAIL')}><option value="SMS">SMS</option><option value="EMAIL">E-mail</option></select></Field>{channel==='EMAIL'&&<Field label="Objet" wide><input name="subject" required/></Field>}<Field label="Destinataires" wide><div className="campaign-audience-actions"><button type="button" onClick={()=>{const values=clients.map(item=>channel==='SMS'?item.phone:item.email).filter(Boolean).join('\n');const field=document.querySelector<HTMLTextAreaElement>('textarea[name="recipients"]');if(field)field.value=values}}>Tous les clients</button><button type="button" onClick={()=>{const values=prospects.filter(item=>item.marketing_opt_in).map(item=>channel==='SMS'?item.phone:item.email).filter(Boolean).join('\n');const field=document.querySelector<HTMLTextAreaElement>('textarea[name="recipients"]');if(field)field.value=values}}>Prospects consentants</button></div><textarea name="recipients" defaultValue={to} rows={5} required placeholder="Un destinataire par ligne"/></Field><Field label="Message" wide><textarea name="message" rows={7} required/></Field><Field label="Date et heure d’envoi" wide><input name="scheduled_at" type="datetime-local" defaultValue={new Date(Date.now()+3600000).toISOString().slice(0,16)}/></Field></div><div className="form-actions"><button className="ghost-action" type="submit" value="schedule" disabled={busy}><CalendarDays/>Planifier</button><button className="primary-btn compact" type="submit" value="now" disabled={busy}><Send/>Envoyer maintenant</button></div></form></Modal>}
    {prospectOpen&&<Modal title="Ajouter un prospect" onClose={()=>setProspectOpen(false)}><form className="entity-form" onSubmit={async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));try{await createProspect({...values,sms_opt_in:Boolean(values.sms_opt_in),email_opt_in:true,marketing_opt_in:Boolean(values.marketing_opt_in)} as Partial<Prospect>);setProspectOpen(false);await reloadOperations()}catch(error){setResult(error instanceof Error?error.message:'Création impossible')}}}><div className="form-grid"><Field label="Entreprise"><input name="company" required/></Field><Field label="Contact"><input name="contact_name"/></Field><Field label="Téléphone"><input name="phone" type="tel" required/></Field><Field label="E-mail"><input name="email" type="email"/></Field><Field label="Besoin" wide><textarea name="need"/></Field><Field label="Source"><input name="source" defaultValue="Prospection commerciale"/></Field><Field label="Consentement" wide><div className="check-options"><label><input type="checkbox" name="sms_opt_in"/>SMS autorisé</label><label><input type="checkbox" name="marketing_opt_in"/>Marketing autorisé</label></div></Field></div><button className="primary-btn compact">Ajouter à la file</button></form></Modal>}
    {activeCall&&<Modal title={`Compte rendu · ${activeCall.name}`} onClose={()=>setActiveCall(null)}><form className="entity-form" onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget);try{await finishCall(activeCall.log.id,{status:'COMPLETED',outcome:String(form.get('outcome')),notes:String(form.get('notes')),duration_seconds:Number(form.get('duration_seconds')||0)});setActiveCall(null);await reloadOperations()}catch(error){setResult(error instanceof Error?error.message:'Enregistrement impossible')}}}><div className="call-live"><span className="call-live-icon"><Phone/></span><div><strong>{activeCall.log.phone}</strong><small>L’appel a été ouvert dans le téléphone. Enregistrez ensuite son résultat.</small></div></div><div className="form-grid"><Field label="Résultat"><select name="outcome"><option>INTÉRESSÉ</option><option>À RELANCER</option><option>RENDEZ-VOUS PRIS</option><option>INJOIGNABLE</option><option>NON INTÉRESSÉ</option><option>MAUVAIS NUMÉRO</option></select></Field><Field label="Durée (secondes)"><input name="duration_seconds" type="number" min="0" defaultValue="0"/></Field><Field label="Notes" wide><textarea name="notes" rows={5}/></Field></div><button className="primary-btn compact"><CheckCircle2/>Terminer et enregistrer</button></form></Modal>}
    {result&&tool!=='MESSAGE'&&<p className="result-note standalone-result">{result}</p>}
  </>;
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
      <section className="team-management">
        <div className="team-overview panel">
          <div>
            <span className="eyebrow"><i /> ESPACE COLLABORATEURS</span>
            <h2>Une équipe claire, des accès maîtrisés.</h2>
            <p>Ouvrez une fiche pour modifier le profil, ajouter sa photo, gérer son rôle ou suspendre son accès.</p>
          </div>
          <div className="team-overview-stats">
            <span><b>{rows.length}</b><small>profils</small></span>
            <span><b>{rows.filter((row) => row.active).length}</b><small>actifs</small></span>
            <span><b>{rows.filter((row) => row.avatar_url).length}</b><small>photos</small></span>
          </div>
        </div>
        {rows.length ? <div className="team-management-grid">
          {rows.map((r) => (
            <article className="team-card panel" key={r.id} onClick={() => setSelected(r)}>
              <div className="team-card-head">
                <span className="team-card-photo team-photo">
                  {r.avatar_url ? <img src={r.avatar_url} alt={`Photo de ${r.full_name}`} /> : r.full_name.slice(0, 2).toUpperCase()}
                </span>
                <div className="team-card-identity">
                  <strong>{r.full_name}</strong>
                  <small>{label(r.role)}</small>
                </div>
                <span className={`status ${r.active ? "success" : "danger"}`}>{r.active ? "Actif" : "Suspendu"}</span>
              </div>
              <div className="team-card-meta">
                <span>{r.phone || "Téléphone non renseigné"}</span>
                <span>{r.must_change_password ? "Mot de passe à changer" : "Compte vérifié"}</span>
              </div>
              <div className="team-card-actions">
                {admin && <button className="primary-btn compact" onClick={(event) => { event.stopPropagation(); setSelected(r); }}><Pencil /> Modifier</button>}
                {admin && <button className="ghost-action compact" onClick={async (event) => { event.stopPropagation(); await updateProfile(r.id, { active: !r.active }); await load(); }}>{r.active ? "Suspendre" : "Réactiver"}</button>}
                <button className="icon-btn" aria-label={`Ouvrir la fiche de ${r.full_name}`} onClick={(event) => { event.stopPropagation(); setSelected(r); }}><ChevronRight /></button>
              </div>
            </article>
          ))}
        </div> : <div className="empty-state panel">Aucun collaborateur enregistré.</div>}
      </section>
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
                  const created = await createTeamMember({
                    email: f.email,
                    password: f.password,
                    name: f.name,
                    roles: [f.role],
                  });
                  if (f.avatar_url && created.id) await updateProfile(created.id, { avatar_url: f.avatar_url });
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
                <Field label="Photo (URL)" wide>
                  <input name="avatar_url" type="url" placeholder="https://…/photo.jpg" />
                </Field>
              </div>
              <button className="primary-btn compact">Créer le compte</button>
            </form>
          </Modal>
        )}
        {selected && (
          <Modal title={`Modifier · ${selected.full_name}`} onClose={() => setSelected(null)}>
            {admin && <form className="entity-form" onSubmit={async (event) => { event.preventDefault(); const form=new FormData(event.currentTarget); try { await updateProfile(selected.id,{full_name:String(form.get("full_name")),role:String(form.get("role")),phone:String(form.get("phone")||"")||null,avatar_url:String(form.get("avatar_url")||"")||null,active:form.get("active")==="on"}); setSelected(null); await load(); } catch (error) { setError(error instanceof Error ? error.message : "Modification impossible"); } }}>
              <div className="form-grid">
                <Field label="Nom complet"><input name="full_name" defaultValue={selected.full_name} required /></Field>
                <Field label="Rôle"><select name="role" defaultValue={selected.role}>{["ADMIN","MANAGER","CHEF_DE_PROJET","COMMERCIAL","COMMUNITY_MANAGER","GRAPHISTE","VIDEASTE","PHOTOGRAPHE","DEVELOPPEUR","COMPTABLE","COLLABORATEUR"].map(role=><option key={role}>{role}</option>)}</select></Field>
                <Field label="Téléphone"><input name="phone" type="tel" defaultValue={selected.phone||""} /></Field>
                <Field label="Photo (URL)" wide><input name="avatar_url" type="url" defaultValue={selected.avatar_url||""} placeholder="https://…/photo.jpg" /></Field>
                <label className="check-options wide"><input name="active" type="checkbox" defaultChecked={selected.active} /> Compte actif</label>
              </div>
              <button className="primary-btn compact" type="submit"><Save/>Enregistrer les modifications</button>
            </form>}
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
          <span className="status success">Structure V2 prête</span>
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
  const online = useOnlineStatus();
  const [page, setPage] = useState<Page>(pageFromHash),
    [theme, setTheme] = useState<"light" | "dark">(
      () =>
        (localStorage.getItem("smartsell-theme") as "light" | "dark") ||
        "light",
    ),
    [mobile, setMobile] = useState(false),
    [clientFilter, setClientFilter] = useState<string | null>(clientFromHash),
    [routeQuery,setRouteQuery]=useState(()=>location.hash.split('?')[1]||''),
    [access, setAccess] = useState<AccessControl | null>(null),
    [accessLoaded, setAccessLoaded] = useState(false),
    [openGroups,setOpenGroups]=useState<string[]>(['Pilotage','Production & clients','Communication']),
    [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null),
    [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches),
    [notificationRows, setNotificationRows] = useState<Notification[]>([]),
    [chatOpen,setChatOpen] = useState(false),
    [commandOpen,setCommandOpen] = useState(false),
    [workspaceRevision,setWorkspaceRevision] = useState(0),
    [chatWelcome,setChatWelcome] = useState(false),
    [chatUnread,setChatUnread] = useState<TeamChatMessage[]>([]),
    [englishDashboard, setEnglishDashboard] = useState(false),
    [paywallOpen,setPaywallOpen] = useState(false),
    [trialClock,setTrialClock] = useState(Date.now()),
    [tenantTrial,setTenantTrial] = useState({is_temporary:Boolean(profile.is_temporary),access_expires_at:profile.access_expires_at||null});
  const expiredTrial=Boolean(tenantTrial.is_temporary&&!profile.is_platform_owner&&tenantTrial.access_expires_at&&new Date(tenantTrial.access_expires_at).getTime()<=trialClock);
  useEffect(()=>{const timer=window.setInterval(()=>setTrialClock(Date.now()),30_000);return()=>window.clearInterval(timer)},[]);
  useEffect(()=>{void getTenantTrialStatus(profile).then(setTenantTrial).catch(()=>undefined)},[profile.id,profile.tenant_owner_id,profile.access_expires_at]);
  const routeIntent=useMemo(()=>readModuleIntent(routeQuery),[routeQuery]);
  useEffect(()=>{const group=navGroups.find(item=>item.pages.includes(page));if(group)setOpenGroups(current=>current.includes(group.label)?current:[...current,group.label])},[page]);
  const navigate = (next: Page, clientId: string | null = null, intent:ModuleIntent={}) => {
    const hash = moduleNavigationHash(next,clientId,intent);
    history.pushState({}, "", hash);
    setPage(next);
    setClientFilter(clientId);
    setRouteQuery(hash.split('?')[1]||'');
    setMobile(false);
  };
  useEffect(()=>watchTranslations(englishDashboard),[englishDashboard]);
  useEffect(() => {
    if (!location.hash) history.replaceState({}, "", `#/${encodeURIComponent("Dashboard")}`);
    const sync = () => { setPage(pageFromHash()); setClientFilter(clientFromHash()); setRouteQuery(location.hash.split('?')[1]||''); };
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
    setAccessLoaded(false);
    void getAccessControl(profile.id).then(setAccess).catch(()=>setAccess(null)).finally(()=>setAccessLoaded(true));
    const timer = window.setInterval(pulseSession, 60_000);
    return () => window.clearInterval(timer);
  }, [profile.id]);
  const chatSeenKey=`smartsell-chat-seen:${profile.id}`;
  const markChatRead=useCallback(()=>{localStorage.setItem(chatSeenKey,new Date().toISOString());setChatUnread([])},[chatSeenKey]);
  useEffect(()=>{
    if(profile.role==='CLIENT'||profile.roles?.includes('CLIENT'))return;
    let active=true,first=true,previousUnread=0;
    const load=()=>void listTeamChatMessages().then(rows=>{
      if(!active)return;
      const seen=localStorage.getItem(chatSeenKey)||'1970-01-01T00:00:00Z';
      const unread=rows.filter(row=>row.sender_id!==profile.id&&row.created_at>seen);
      setChatUnread(unread);
      if(!chatOpen&&unread.length>previousUnread){setChatWelcome(true);if(!first)playUiTone('confirm')}
      previousUnread=unread.length;
      first=false;
    }).catch(()=>{first=false});
    load();const timer=window.setInterval(load,15000);
    window.addEventListener('focus',load);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',load)};
  },[profile.id,profile.role,profile.roles,chatSeenKey,chatOpen]);
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
    alert('Dans Chrome ou Edge, ouvrez le menu du navigateur puis choisissez « Installer Smartsell Management ». Sur iPhone/iPad : Partager → Sur l’écran d’accueil.');
  };
  const handleUiClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const control = target.closest('button, a, [role="button"]');
    if (!control || (control as HTMLButtonElement).disabled) return;
    if(expiredTrial && page!=='Abonnement' && page!=='Assistance' && control.closest('.app-main main') && !control.closest('.trial-expired-banner')){
      event.preventDefault();event.stopPropagation();setPaywallOpen(true);return;
    }
    playUiTone(control.classList.contains('primary-btn') ? 'confirm' : 'tap');
  }, [expiredTrial,page]);
  const roles = (profile.roles?.length ? profile.roles : [profile.role]) as Role[],
    admin = roles.some((item) => ["SUPER_ADMIN", "ADMIN"].includes(item)),
    platformOwner = profile.is_platform_owner===true;
  if (roles.includes("CLIENT")) return <ClientPortalExperience tenantOwnerId={profile.tenant_owner_id||profile.id} onLogout={onLogout} />;
  if (!accessLoaded&&!roles.includes("SUPER_ADMIN")) return <div className="app-loading"><img src={companyProfile.logo_dark}/><span>Vérification de vos autorisations…</span></div>;
  const actionAllowed = (key: string) => isActionAllowed(roles,access,accessLoaded,key);
  const navNotificationCount = (name: Page) => {
    const unread = notificationRows.filter(row=>!row.read_at);
    if (name === 'Centre de contrôle') return unread.length;
    const types:Partial<Record<Page,string[]>> = {
      Projets:['project','projects'], Tâches:['task','tasks'], Planning:['task','tasks'],
      Communication:['communication','campaign'], Facturation:['invoice','invoices'],
      Équipe:['team','user'], Clients:['client','clients'],
    };
    return unread.filter(row=>types[name]?.includes(row.entity_type||'')).length;
  };
  const rightsFor = (scope: string): CrudRights => ({
    view: actionAllowed(`${scope}.view`),
    create: actionAllowed(`${scope}.create`),
    update: actionAllowed(`${scope}.update`),
    delete: actionAllowed(`${scope}.delete`),
  });
  const viewKeys: Partial<Record<Page,string>> = {Clients:'clients.view',Projets:'projects.view',Tâches:'tasks.view',Planning:'planning.view',Éditorial:'editorial.view',Services:'services.view',Fournisseurs:'finance.read',Facturation:'invoices.view',Documents:'documents.view',Comptabilité:'accounting.view',Matériel:'equipment.view',Communication:'communication.view',Intégrations:'communication.view',Équipe:'team.view',RH:'hr.view',Rapports:'reports.view','Centre de contrôle':'audit.read','Portail client':'portal.view','Jumeau numérique':'accounting.view','Radar commercial':'clients.view','Studio campagnes IA':'communication.view'};
  const visible = (n: [Page, typeof LayoutDashboard, Permission?]) => n[0]==='Assistance' ? true : n[0]==='Parrainage'||n[0]==='Abonnement' ? (profile.tenant_owner_id||profile.id)===profile.id : n[0]==='Objectifs & performance' ? !roles.includes('CLIENT') : n[0]==='Paramètres SMS' ? (profile.is_platform_owner===true||roles.includes('SUPER_ADMIN')) : n[0]==='Dashboard'||(n[0]==='Demandes SaaS' ? platformOwner : (
    (!viewKeys[n[0]] || actionAllowed(viewKeys[n[0]]!)) &&
    (n[0]==='Centre de contrôle' ? actionAllowed('audit.read') : isModuleAllowed(roles,access,accessLoaded,n[0]))));
  const socialVisible=actionAllowed('editorial.view')||actionAllowed('communication.view');
  const socialRoute=page==='Smart Social'||page==='Éditorial'||page==='Intégrations';
  const currentPage = socialRoute&&socialVisible ? page : nav.some((item)=>item[0]===page&&(item[0]==='Smart Social'?socialVisible:visible(item))) ? page : 'Dashboard';
  return (
    <div className="app-shell production-shell v2-shell" onClickCapture={handleUiClick} onSubmitCapture={event=>{if(expiredTrial&&currentPage!=='Abonnement'&&currentPage!=='Assistance'){event.preventDefault();event.stopPropagation();setPaywallOpen(true)}}}>
      <aside className={mobile ? "mobile-open" : ""}>
        <div className="side-head">
          <img src={companyProfile.logo_light} />
          <button className="mobile-close" onClick={() => setMobile(false)}>
            <X />
          </button>
        </div>
        <nav>
          <small>SMARTSELL MANAGEMENT</small>
          {navGroups.map(group=>{const items=nav.filter(item=>group.pages.includes(item[0])&&(item[0]==='Smart Social'?socialVisible:visible(item)));if(!items.length)return null;const expanded=openGroups.includes(group.label);return <section className={`nav-group ${expanded?'expanded':''}`} key={group.label}>
            <button className="nav-group-toggle" aria-expanded={expanded} onClick={()=>setOpenGroups(groups=>groups.includes(group.label)?groups.filter(item=>item!==group.label):[...groups,group.label])}><span>{group.label}</span><ChevronRight/></button>
            <AnimatePresence initial={false}>{expanded&&<motion.div className="nav-group-items" initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:.24,ease:'easeOut'}}>{items.map(([name,Icon])=>name==='Clients'||name==='Facturation'?<ModuleNavigation key={name} name={name==='Clients'?'CRM & clients':'Factures & devis'} icon={Icon} active={currentPage===name} intent={routeIntent} notificationCount={navNotificationCount(name)} onNavigate={intent=>navigate(name,null,intent)} links={name==='Clients'?[
              {label:'Gérer les clients',view:'CLIENTS',allowed:actionAllowed('clients.view')},
              {label:'Ajouter un client',view:'CLIENTS',action:'new-client',allowed:actionAllowed('clients.create')},
              {label:'Pipeline commercial',view:'PIPELINE',allowed:actionAllowed('clients.view')},
              {label:'Ajouter un prospect',view:'PIPELINE',action:'new-prospect',allowed:actionAllowed('clients.create')},
            ]:[
              {label:'Voir les factures',view:'FACTURE',allowed:actionAllowed('invoices.view')},
              {label:'Ajouter une facture',view:'FACTURE',action:'new-document',allowed:actionAllowed('invoices.create')},
              {label:'Voir les devis',view:'DEVIS',allowed:actionAllowed('invoices.view')},
              {label:'Ajouter un devis',view:'DEVIS',action:'new-document',allowed:actionAllowed('invoices.create')},
            ]}/>:<button key={name} className={currentPage===name||(name==='Smart Social'&&socialRoute)?'active':''} onClick={()=>navigate(name)}><Icon/><span>{name}</span>{navNotificationCount(name)>0&&<b className="nav-alert-badge">{navNotificationCount(name)>99?'99+':navNotificationCount(name)}</b>}</button>)}</motion.div>}</AnimatePresence>
          </section>})}
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
          <div className="top-navigation">
            <button className="mobile-menu" onClick={() => setMobile(true)}><Menu /></button>
            {currentPage!=="Dashboard"&&<button className="global-back" onClick={()=>navigate("Dashboard")} title="Retour au tableau de bord"><ArrowLeft/><span>Retour</span></button>}
            <div className="production-badge">SMARTSELL MANAGEMENT <i /></div>
          </div>
          <div className="top-actions">
            <button className="command-launch" type="button" onClick={()=>{setChatOpen(false);setChatWelcome(false);setCommandOpen(true)}} title="Dicter une action" aria-label="Dicter une action"><Mic/><span>Dicter une action</span></button>
            <button className="assist-header-btn" type="button" onClick={()=>navigate('Assistance')} title="Contacter l’assistance Smartsell" aria-label="Contacter l’assistance"><LifeBuoy/><span>Assistance</span></button>
            <button className="icon-btn chat-header-btn" type="button" onClick={()=>{setChatWelcome(false);setChatOpen(true);markChatRead()}} title="Messages de l’équipe" aria-label={`Messages de l’équipe${chatUnread.length?` : ${chatUnread.length} non lus`:''}`}><MessageSquareText/>{chatUnread.length>0&&<b>{chatUnread.length>99?'99+':chatUnread.length}</b>}</button>
            {!installed&&<button className="install-app-btn" onClick={()=>void installApp()} title="Installer Smartsell Management sur cet appareil"><Download/><span>Installer l’application</span></button>}
            <button className="language-toggle" onClick={()=>setEnglishDashboard(value=>!value)} title="Dashboard language">{englishDashboard?"FR":"EN"}</button>
            <button
              className="icon-btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </button>
            <NotificationBell onRowsChange={setNotificationRows} onOpenEntity={row=>{
              if(row.entity_type==='team_chat'){setChatWelcome(false);setChatOpen(true);markChatRead()}
              else if(row.entity_type==='task')navigate('Tâches')
              else if(row.entity_type==='project')navigate('Projets')
            }}/>
          </div>
        </header>
        {expiredTrial&&<div className="trial-expired-banner" role="status"><span>Votre essai est terminé. Vos données restent visibles, mais les actions sont désactivées.</span><button type="button" onClick={()=>navigate('Abonnement')}>Choisir un abonnement</button></div>}
        <main>
          {!online&&<div className="offline-banner" role="status"><strong>Mode hors connexion</strong><span>Les écrans déjà chargés restent disponibles. Attendez le retour du réseau avant d’enregistrer une modification.</span></div>}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentPage}:${workspaceRevision}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {currentPage === "Dashboard" ? (
                <Dashboard profile={profile} access={access} accessLoaded={accessLoaded} onNavigate={navigate} english={englishDashboard} />
              ) : currentPage === "Clients" ? (
                <ClientsPage rights={rightsFor('clients')} tenantOwnerId={profile.tenant_owner_id||profile.id} canViewOffers={actionAllowed('services.view')} intent={routeIntent} onNavigate={(next,clientId)=>navigate(next,clientId)} />
              ) : currentPage === "Projets" ? (
                <ProjectsPage rights={rightsFor('projects')} currentProfileId={profile.id} clientFilter={clientFilter} onClearFilter={()=>navigate("Projets")} />
              ) : currentPage === "Tâches" ? (
                <TasksPage rights={rightsFor('tasks')} currentProfileId={profile.id} canAssign={actionAllowed('tasks.assign')} clientFilter={clientFilter} onClearFilter={()=>navigate("Tâches")} />
              ) : currentPage === "Planning" ? (
                <TasksPage rights={{view:actionAllowed('planning.view'),create:actionAllowed('planning.create'),update:actionAllowed('planning.update'),delete:actionAllowed('tasks.delete')}} currentProfileId={profile.id} canAssign={actionAllowed('tasks.assign')} planning />
              ) : currentPage === "Smart Social" || currentPage === "Éditorial" || currentPage === "Intégrations" ? (
                <SmartSocial key={currentPage} tenantOwnerId={profile.tenant_owner_id||profile.id} editorialRights={rightsFor('editorial')} connectionRights={rightsFor('communication')} initialView={currentPage==='Intégrations'?'CONNECTIONS':'CALENDAR'} />
              ) : currentPage === "Services" ? (
                <ServicesPage rights={rightsFor('services')} />
              ) : currentPage === "Fournisseurs" ? (
                <SuppliersPage admin={admin} canCreate={actionAllowed('suppliers.create')} canUpdate={actionAllowed('suppliers.update')} canDelete={actionAllowed('suppliers.delete')} />
              ) : currentPage === "Facturation" ? (
                <BillingV3 admin={actionAllowed('invoices.delete')} canCreate={actionAllowed('invoices.create')} canUpdate={actionAllowed('invoices.update')} canSend={actionAllowed('invoices.send')} signedBySmartsell={profile.is_platform_owner===true} clientFilter={clientFilter} intent={routeIntent} onClearFilter={()=>navigate("Facturation")} />
              ) : currentPage === "Documents" ? (
                <DocumentsPage rights={rightsFor('documents')} />
              ) : currentPage === "Comptabilité" ? (
                <AccountingPage rights={rightsFor('accounting')} />
              ) : currentPage === "Matériel" ? (
                <EquipmentPage rights={rightsFor('equipment')} />
              ) : currentPage === "Communication" ? (
                <CommunicationHub canApprove={admin} onBack={()=>navigate("Dashboard")} onOpenIntegrations={()=>navigate("Intégrations")} />
              ) : currentPage === "Équipe" ? (
                <>{admin&&<TeamActivityDashboard tenantOwnerId={profile.tenant_owner_id||profile.id}/>}<TeamAccessPage admin={admin} superAdmin={roles.includes("SUPER_ADMIN")} currentProfileId={profile.id} tenantOwnerId={profile.tenant_owner_id||profile.id} /></>
              ) : currentPage === "Demandes SaaS" ? (
                <SignupRequestsPage />
              ) : currentPage === "RH" ? (
                <HRPage currentProfileId={profile.id} />
              ) : currentPage === "Rapports" ? (
                <ReportsPage />
              ) : currentPage === "Paramètres SMS" ? (
                <SmsSettings />
              ) : currentPage === "Objectifs & performance" ? (
                <PerformanceGoals />
              ) : currentPage === "Parrainage" ? (
                <ReferralDashboard />
              ) : currentPage === "Abonnement" ? (
                <SubscriptionPage />
              ) : currentPage === "Assistance" ? (
                <SupportCenter profile={profile} />
              ) : currentPage === "Centre de contrôle" ? (
                <OperationsCenter profile={profile} />
              ) : currentPage === "Jumeau numérique" ? (
                <DigitalTwinPage />
              ) : currentPage === "Radar commercial" ? (
                <CommercialRadarPage />
              ) : currentPage === "Studio campagnes IA" ? (
                <CampaignStudioPage onOpenCampaigns={()=>navigate("Communication")} />
              ) : currentPage === "Autopilot IA" ? (
                <AutopilotPage onNavigate={target=>navigate(target as Page)} />
              ) : currentPage === "Portail client" ? (
                <><ClientPortalAdmin /><ClientConversationDesk /></>
              ) : (
                <AiAssistantPage />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {expiredTrial&&<TrialPaywall open={paywallOpen} onClose={()=>setPaywallOpen(false)} expiredAt={tenantTrial.access_expires_at!} canRequest={(profile.tenant_owner_id||profile.id)===profile.id}/>}
      {commandOpen&&<ActionCommand profile={profile} allowed={actionAllowed} blocked={expiredTrial||!online||!commandKinds.some(kind=>actionAllowed(commandPermission(kind)))} onClose={()=>setCommandOpen(false)} onCreated={kind=>{setWorkspaceRevision(value=>value+1);navigate(kind==='CLIENT'?'Clients':kind==='TASK'?'Tâches':kind==='PROJECT'?'Projets':'Facturation',null,{view:kind==='FACTURE'||kind==='DEVIS'?kind:undefined})}}/>}
      <AnimatePresence>
        {chatWelcome&&!chatOpen&&<Modal title="Vous avez de nouveaux messages" onClose={()=>setChatWelcome(false)}><div className="chat-welcome-preview"><p>Voici les derniers échanges reçus depuis votre précédente visite.</p>{chatUnread.slice(-3).reverse().map(item=><article key={item.id}><strong>{item.profiles?.full_name||'Collaborateur'}{item.recipient_id?' · privé':' · équipe'}</strong><span>{item.body}</span></article>)}<button type="button" className="primary-btn compact" onClick={()=>{setChatWelcome(false);setChatOpen(true);markChatRead()}}>Ouvrir la messagerie</button></div></Modal>}
        {chatOpen&&<Modal title="Messagerie" onClose={()=>setChatOpen(false)}><TeamChat onRead={markChatRead}/></Modal>}
      </AnimatePresence>
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
  if (profile.is_beta_tester) return <BetaSandboxApp profile={profile} onLogout={async () => { await signOut(); setProfile(null); }} />;
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
      <img src={companyProfile.logo_light} className="login-logo" alt="Smartsell Management" />
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
