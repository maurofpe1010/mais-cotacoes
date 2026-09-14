import Link from "next/link";
import { BackButton } from "@/components/back-button";
import { CatalogImportShortcuts } from "@/components/catalog-import-shortcuts";
import { PricingEditShortcuts } from "@/components/pricing-edit-shortcuts";
import { OrganizationLogo } from "@/components/organization-logo";
import { PlanHospitalsManager } from "@/components/plan-hospitals-manager";
const links = [["Visão geral", "/dashboard"], ["CRM", "/dashboard/crm"], ["Cotações", "/dashboard/quotes"], ["Operadoras e planos", "/dashboard/plans"], ["Tabelas de preço", "/dashboard/pricing"], ["Relatórios", "/dashboard/reports"]];
export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <div className="shell"><aside className="sidebar"><div><OrganizationLogo /><div className="brand">MAIS <span>COTAÇÕES</span></div><p style={{ fontSize: 12, color: "#b6d2f7" }}>Gestão comercial de benefícios</p></div><nav className="nav">{links.map(([label, href]) => <Link key={href} href={href} className={href === "/dashboard" ? "active" : ""}>{label}</Link>)}</nav><div className="account">Sua corretora<br /><Link href="/dashboard/settings" style={{ color: "white", fontWeight: 700 }}>Configurações</Link></div></aside><div className="main"><div className="mobile-app-header"><div className="brand">MAIS <span>COTAÇÕES</span></div><nav className="mobile-nav">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav></div><BackButton />{children}<CatalogImportShortcuts /><PlanHospitalsManager /><PricingEditShortcuts /></div></div>; }
