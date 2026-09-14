"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
export function BackButton() { const router = useRouter(); const pathname = usePathname(); useEffect(() => { if (!pathname.includes("/pricing/edit")) return; const update = () => document.querySelectorAll("td").forEach(cell => { if (cell.textContent?.trim() === "59 a 59+ anos") cell.textContent = "59 anos ou +"; }); update(); const observer = new MutationObserver(update); observer.observe(document.body, { childList: true, subtree: true }); return () => observer.disconnect(); }, [pathname]); return <button onClick={() => router.back()} style={{ border: 0, background: "none", color: "#1769c2", fontWeight: 700, cursor: "pointer", padding: "0 0 18px" }}>← Voltar</button>; }
