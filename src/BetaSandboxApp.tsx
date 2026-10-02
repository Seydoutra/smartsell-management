import { FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Bell, BriefcaseBusiness, CalendarDays, CircleDollarSign, FileText,
  LayoutDashboard, LogOut, Mail, Menu, Package, Phone, Plus, RotateCcw, Search,
  Send, ShieldCheck, Trash2, Users, X,
} from "lucide-react";
import { companyProfile } from "./lib/companyProfile";
import { demoData, DemoRecord } from "./lib/demoData";
import type { Profile } from "./types/models";

type SandboxPage = "Dashboard" | "Prospects" | "Clients" | "Projets" | "Tâches" | "Planning" | "Éditorial" | "Services" | "Factures" | "Comptabilité" | "Fournisseurs" | "Matériel" | "Communication" | "Équipe" | "RH" | "Rapports" | "Portail client";
type SandboxStore = Record<string, DemoRecord[]>;

const nav: { label: SandboxPage; icon: typeof LayoutDashboard }[] = [
  { label: "Dashboard", icon: LayoutDashboard }, { label: "Prospects", icon: BriefcaseBusiness },
  { label: "Clients", icon: Users }, { label: "Projets", icon: BriefcaseBusiness },
  { label: "Tâches", icon: FileText }, { label: "Planning", icon: CalendarDays },
  { label: "Éditorial", icon: CalendarDays }, { label: "Services", icon: Package },
  { label: "Factures", icon: FileText }, { label: "Comptabilité", icon: CircleDollarSign },
  { label: "Fournisseurs", icon: Package }, { label: "Matériel", icon: Package },
  { label: "Communication", icon: Mail }, { label: "Équipe", icon: Users },
  { label: "RH", icon: Users }, { label: "Rapports", icon: BarChart3 },
  { label: "Portail client", icon: ShieldCheck },
];

const extraSeeds: SandboxStore = {
  Planning: [{ id: "bp1", title: "Réunion de lancement", subtitle: "Équipe créative · Salle Conakry", status: "Planifié", meta: "Demain · 09:30" }],
  Services: [{ id: "bs1", title: "Gestion réseaux sociaux", subtitle: "Forfait mensuel", status: "Actif", meta: "Pack bêta", amount: "8 M GNF" }],
  Factures: demoData.Finance ?? [], Comptabilité: demoData.Finance ?? [],
  Fournisseurs: [{ id: "bf1", title: "Studio Démo 224", subtitle: "Production audiovisuelle", status: "Actif", meta: "contact@demo.test" }],
  RH: [{ id: "brh1", title: "Aminata Test", subtitle: "Contrat fictif · Création", status: "Présent", meta: "Solde congés : 18 jours" }],
  Rapports: [{ id: "br1", title: "Rapport mensuel fictif", subtitle: "Performance globale", status: "Disponible", meta: "Généré aujourd’hui" }],
  "Portail client": [{ id: "bpc1", title: "Maison Kanu — Démo", subtitle: "Accès client fictif", status: "Actif", meta: "3 projets visibles" }],
};

function seedStore(): SandboxStore {
  return Object.fromEntries(nav.filter((item) => item.label !== "Dashboard").map(({ label }) => [label, structuredClone(extraSeeds[label] ?? demoData[label] ?? [])]));
}

function readStore(key: string): SandboxStore {
  try { return JSON.parse(localStorage.getItem(key) || "null") || seedStore(); } catch { return seedStore(); }
}

export default function BetaSandboxApp({ profile, onLogout }: { profile: Profile; onLogout: () => void }) {
  const storageKey = `smartsell-beta-sandbox:${profile.id}`;
  const [page, setPage] = useState<SandboxPage>("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [store, setStore] = useState<SandboxStore>(() => readStore(storageKey));
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [notice, setNotice] = useState("");
  const rows = store[page] ?? [];
  const filtered = rows.filter((row) => `${row.title} ${row.subtitle} ${row.status}`.toLowerCase().includes(query.toLowerCase()));
  const totals = useMemo(() => ({ clients: store.Clients?.length ?? 0, projects: store.Projets?.length ?? 0, tasks: store.Tâches?.length ?? 0, invoices: store.Factures?.length ?? 0 }), [store]);

  const save = (next: SandboxStore) => { setStore(next); localStorage.setItem(storageKey, JSON.stringify(next)); };
  const add = (event: FormEvent) => {
    event.preventDefault();
    const next = { ...store, [page]: [{ id: crypto.randomUUID(), title, subtitle: detail || "Donnée fictive créée en mode bêta", status: "Nouveau", meta: "À l’instant" }, ...rows] };
    save(next); setModal(false); setTitle(""); setDetail(""); setNotice("Élément fictif enregistré — aucune donnée réelle modifiée.");
  };
  const remove = (id: string) => save({ ...store, [page]: rows.filter((row) => row.id !== id) });
  const reset = () => { const next = seedStore(); save(next); setNotice("Le bac à sable a été réinitialisé avec ses données fictives."); };
  const simulate = (action: string) => setNotice(`${action} simulé avec succès. Aucun envoi, appel ou coût réel.`);

  return <div className="beta-sandbox app-shell">
    <AnimatePresence>{mobileOpen && <motion.button className="scrim" aria-label="Fermer" onClick={() => setMobileOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}</AnimatePresence>
    <aside className={mobileOpen ? "mobile-open" : ""}>
      <div className="side-head"><img src={companyProfile.logo_light} alt="Smartsell Management" /><button className="mobile-close" onClick={() => setMobileOpen(false)}><X /></button></div>
      <div className="beta-side-label"><ShieldCheck size={16} /><span>MODE BÊTA ISOLÉ</span></div>
      <nav><small>TOUS LES MODULES</small>{nav.map((item) => <button key={item.label} className={page === item.label ? "active" : ""} onClick={() => { setPage(item.label); setQuery(""); setMobileOpen(false); }}><item.icon /><span>{item.label}</span></button>)}</nav>
      <div className="side-bottom"><div className="user-avatar">BT</div><div><strong>{profile.full_name}</strong><small>Bêta testeur · Tous droits</small></div><button onClick={onLogout}><LogOut size={18} /></button></div>
    </aside>
    <div className="app-main">
      <header><button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu /></button><div className="beta-header-badge"><ShieldCheck size={17} /><b>Bac à sable</b><span>100 % données fictives</span></div><div className="top-actions"><button className="icon-btn"><Bell /></button><button className="ghost-btn" onClick={reset}><RotateCcw size={16} /> Réinitialiser</button></div></header>
      <main>
        <div className="beta-warning"><strong>ENVIRONNEMENT BÊTA ISOLÉ</strong><span>Vous pouvez tout tester. Rien ici ne modifie les clients, projets, finances ou communications de production.</span></div>
        {notice && <button className="beta-notice" onClick={() => setNotice("")}>{notice}<X size={15} /></button>}
        {page === "Dashboard" ? <section className="module-page">
          <div className="module-head"><div><span className="eyebrow"><i /> LABORATOIRE SMARTSELL</span><h1>Bonjour, {profile.full_name.split(" ")[0]}.</h1><p>Testez librement toute la plateforme avec un jeu de données indépendant.</p></div><button className="primary-btn compact" onClick={() => { setPage("Clients"); setModal(true); }}><Plus size={17} /> Créer un test</button></div>
          <div className="kpis"><article className="kpi featured"><span>Clients fictifs</span><strong>{totals.clients}</strong><small>isolés de la production</small></article><article className="kpi"><span>Projets test</span><strong>{totals.projects}</strong><small>aucun impact réel</small></article><article className="kpi"><span>Tâches test</span><strong>{totals.tasks}</strong><small>librement modifiables</small></article><article className="kpi"><span>Factures fictives</span><strong>{totals.invoices}</strong><small>aucune valeur comptable</small></article></div>
          <div className="panel beta-dashboard-panel"><ShieldCheck /><div><h2>Isolation active</h2><p>Les données de ce profil sont enregistrées uniquement dans ce navigateur et associées à l’identifiant du bêta-testeur. Les API de communication et les écritures Supabase métier sont désactivées.</p></div></div>
        </section> : <section className="module-page">
          <div className="module-head"><div><span className="eyebrow"><i /> MODULE BÊTA</span><h1>{page}</h1><p>Jeu de données fictives indépendant, avec droits de création et suppression complets.</p></div><button className="primary-btn compact" onClick={() => setModal(true)}><Plus size={17} /> Ajouter</button></div>
          {page === "Communication" && <div className="beta-actions"><button onClick={() => simulate("SMS")}><Send /> Simuler un SMS</button><button onClick={() => simulate("E-mail")}><Mail /> Simuler un e-mail</button><button onClick={() => simulate("Appel")}><Phone /> Simuler un appel</button><button onClick={() => simulate("Campagne")}><BarChart3 /> Simuler une campagne</button></div>}
          <div className="filter-bar"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Rechercher dans ${page.toLowerCase()}…`} /></label><span>{filtered.length} éléments fictifs</span></div>
          <div className="records panel"><div className="records-head"><span>Nom</span><span>Statut</span><span>Détail</span><span>Actions</span></div>{filtered.map((row) => <article key={row.id}><div className="record-main"><span className="record-avatar">{row.title.slice(0, 2).toUpperCase()}</span><div><strong>{row.title}</strong><small>{row.subtitle}</small></div></div><span className="status">{row.status}</span><span className="record-meta">{row.meta}</span><button className="icon-btn danger" aria-label="Supprimer" onClick={() => remove(row.id)}><Trash2 size={16} /></button></article>)}{!filtered.length && <div className="empty-state"><Search /><h3>Aucun élément fictif</h3><p>Créez-en un pour tester ce module.</p></div>}</div>
        </section>}
      </main>
    </div>
    <AnimatePresence>{modal && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setModal(false)}><motion.form className="modal" onSubmit={add} initial={{ opacity: 0, y: 18, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow"><i /> DONNÉE FICTIVE</span><h2>Ajouter dans {page}</h2></div><button type="button" className="icon-btn" onClick={() => setModal(false)}><X /></button></div><label>Nom<input required autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nom de test" /></label><label>Description<input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Contexte fictif" /></label><div className="modal-actions"><button type="button" className="ghost-cancel" onClick={() => setModal(false)}>Annuler</button><button className="primary-btn compact">Enregistrer dans le bac à sable</button></div></motion.form></motion.div>}</AnimatePresence>
  </div>;
}
