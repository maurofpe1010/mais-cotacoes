"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [splash, setSplash] = useState(true);
  useEffect(() => { const timer = window.setTimeout(() => setSplash(false), 1800); return () => window.clearTimeout(timer); }, []);
  async function signIn(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); setMessage(""); try { const { error: authError } = await supabaseBrowser().auth.signInWithPassword({ email, password }); if (authError) throw authError; router.push("/dashboard"); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível entrar."); } finally { setLoading(false); } }
  async function signUp() { setLoading(true); setError(""); setMessage(""); try { const { error: authError } = await supabaseBrowser().auth.signUp({ email, password }); if (authError) throw authError; setMessage("Conta criada. Verifique seu e-mail para confirmar o acesso."); } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível criar a conta."); } finally { setLoading(false); } }
  const logo = <img src="/mais-corretora-logo.png" alt="Mais Corretora" className="access-logo-image" />;
  if (splash) return <main className="splash-screen"><div className="splash-brand">{logo}<p>Gestão comercial de benefícios</p></div></main>;
  return <main className="auth premium-auth"><section className="auth-card premium-auth-card"><div className="access-logo">{logo}</div><div className="eyebrow">Acesso seguro</div><h1>Bem-vindo de volta</h1><p>Entre para acompanhar oportunidades, cotações e resultados.</p><form onSubmit={signIn}><label className="field">E-mail<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="voce@empresa.com" /></label><label className="field">Senha<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={6} placeholder="••••••••" /></label>{message && <p className="notice">{message}</p>}{error && <p className="error">{error}</p>}<button className="primary" disabled={loading}>{loading ? "Aguarde…" : "Entrar"}</button></form><p className="access-signup">Ainda não tem acesso? <button onClick={signUp} disabled={loading}>Criar conta</button></p></section></main>;
}
