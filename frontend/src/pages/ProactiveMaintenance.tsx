"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LogoButton } from "@/components/ui/logo-button";
import { useAuth } from "@/contexts/AuthContext";
import { WobbleCard } from "@/components/ui/wobble-card";

// ─── Types ───────────────────────────────────────────────────
interface AssetHealth {
  device_id: number;
  asset_code: string;
  brand: string;
  model: string;
  assigned_code: string;
  type_name: string;
  lab_name: string;
  vendor_name: string;
  invoice_number: string;
  issue_count: number;
  open_issues: number;
  severe_issues: number;
  health_score: number;
  risk_level: string;
  warranty_status: string;
  days_until_expiry: number | null;
  last_issue_date: string;
  first_issue_date: string;
}

interface Summary {
  total_devices: number;
  needs_attention: number;
  upcoming_warranty: number;
  expired_warranty: number;
  critical_open: number;
}

interface MaintenanceData {
  asset_health: AssetHealth[];
  high_risk_assets: AssetHealth[];
  health_distribution: { range: string; count: number; color: string }[];
  warranty_alerts: {
    expired: AssetHealth[];
    within_30: AssetHealth[];
    within_60: AssetHealth[];
    within_90: AssetHealth[];
  };
  maintenance_timeline: any[];
  issues_by_age: any[];
  lab_risk: any[];
  summary: Summary;
}

interface Recipient {
  id: number;
  name: string;
  email: string;
  role: string;
  assigned_lab: string | null;
}

// ─── Constants ───────────────────────────────────────────────
const RISK_COLORS: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", healthy: "#22c55e",
};
const RISK_BG: Record<string, string> = {
  critical: "border-red-600/60 bg-red-950/30",
  high: "border-orange-600/50 bg-orange-950/20",
  medium: "border-yellow-600/40 bg-yellow-950/20",
  healthy: "border-green-600/40 bg-green-950/20",
};
const WARRANTY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  expired: { bg: "bg-red-600", text: "text-red-200", label: "Expired" },
  expiring_soon: { bg: "bg-orange-600", text: "text-orange-200", label: "< 30 days" },
  expiring: { bg: "bg-yellow-600", text: "text-yellow-200", label: "30-90 days" },
  active: { bg: "bg-green-600", text: "text-green-200", label: "Active" },
  unknown: { bg: "bg-gray-600", text: "text-gray-200", label: "Unknown" },
};

const SECTION_ICONS: Record<string, string> = {
  "CRITICAL ALERTS": "🚨", "MAINTENANCE SCHEDULE": "📅",
  "RISK ASSESSMENT": "⚠️", "COST SAVINGS": "💰", "ACTION ITEMS": "✅",
};
const SECTION_COLORS: Record<string, string> = {
  "CRITICAL ALERTS": "border-red-500/40 bg-red-950/20",
  "MAINTENANCE SCHEDULE": "border-blue-500/40 bg-blue-950/20",
  "RISK ASSESSMENT": "border-orange-500/40 bg-orange-950/20",
  "COST SAVINGS": "border-green-500/40 bg-green-950/20",
  "ACTION ITEMS": "border-purple-500/40 bg-purple-950/20",
};

// ─── Helpers ─────────────────────────────────────────────────
const riskBadge = (level: string) => {
  const color = RISK_COLORS[level] || "#6b7280";
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full text-white font-semibold"
      style={{ backgroundColor: color }}
    >
      {level.toUpperCase()}
    </span>
  );
};

const warrantyBadge = (status: string) => {
  const w = WARRANTY_COLORS[status] || WARRANTY_COLORS.unknown;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${w.bg} ${w.text} font-semibold`}>
      {w.label}
    </span>
  );
};

const healthBar = (score: number) => {
  const color = score <= 25 ? "#ef4444" : score <= 50 ? "#f97316" : score <= 75 ? "#eab308" : "#22c55e";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-neutral-700 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{score}</span>
    </div>
  );
};

const renderInsights = (text: string) => {
  const sections: { heading: string; lines: string[] }[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("### ") || line.startsWith("## ")) {
      if (current) sections.push(current);
      current = { heading: line.replace(/^#+\s*/, ""), lines: [] };
    } else if (line) {
      (current || (current = { heading: "", lines: [] })).lines.push(line);
    }
  }
  if (current) sections.push(current);

  const bold = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <span key={i} className="text-white font-semibold">{part.slice(2, -2)}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sections.map((sec, si) => {
        const key = sec.heading.toUpperCase();
        const icon = SECTION_ICONS[key] || "📌";
        const color = SECTION_COLORS[key] || "border-neutral-600/40 bg-neutral-800/30";
        return (
          <motion.div
            key={si}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: si * 0.08 }}
            className={`rounded-xl border p-4 ${color} ${
              key === "ACTION ITEMS" ? "md:col-span-2" : ""
            }`}
          >
            <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <span className="text-base">{icon}</span> {sec.heading}
            </h3>
            <ul className="space-y-2">
              {sec.lines.map((line, li) => {
                const text = line.replace(/^[\d]+\.\s*/, "").replace(/^-\s*/, "");
                return (
                  <li key={li} className="flex gap-2 text-sm text-gray-400 leading-relaxed">
                    <span className="text-gray-600 mt-0.5 shrink-0">•</span>
                    <span>{bold(text)}</span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        );
      })}
    </div>
  );
};

// ─── Section ─────────────────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
  title, children, className = "",
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className={`bg-neutral-900/80 backdrop-blur-md rounded-2xl border border-neutral-700/50 p-6 ${className}`}
  >
    <h2 className="text-lg font-semibold text-gray-200 mb-4">{title}</h2>
    {children}
  </motion.div>
);

// ─── Main Component ──────────────────────────────────────────
export default function ProactiveMaintenance() {
  const [active, setActive] = useState<string | null>(null);
  const { logout } = useAuth();

  const [data, setData] = useState<MaintenanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [tab, setTab] = useState<"risk" | "ai" | "alerts">("risk");

  // Alert state
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [alertSending, setAlertSending] = useState(false);
  const [alertResult, setAlertResult] = useState<{ success: boolean; message: string; sent_to?: string[]; failed?: { email: string; error: string }[] } | null>(null);

  // Fetch data
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("http://localhost:5000/get_proactive_maintenance");
        const json = await res.json();
        if (json.success) setData(json as MaintenanceData);
        else setError(json.error || "Failed to load data");
      } catch (e: any) {
        setError(e.message || "Network error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Fetch recipients when alerts tab is selected
  useEffect(() => {
    if (tab === "alerts" && recipients.length === 0) {
      (async () => {
        setRecipientsLoading(true);
        try {
          const res = await fetch("http://localhost:5000/get_alert_recipients");
          const json = await res.json();
          if (json.success) setRecipients(json.recipients);
        } catch { /* ignore */ }
        finally { setRecipientsLoading(false); }
      })();
    }
  }, [tab]);

  // Fetch AI insights
  const fetchAiInsights = async () => {
    if (!data) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("http://localhost:5000/get_maintenance_insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analytics: {
            total_devices: data.summary.total_devices,
            needs_attention: data.summary.needs_attention,
            upcoming_warranty: data.summary.upcoming_warranty,
            expired_warranty: data.summary.expired_warranty,
            critical_open: data.summary.critical_open,
            high_risk_assets: data.high_risk_assets.slice(0, 8),
            warranty_expired: data.warranty_alerts.expired.slice(0, 5),
            warranty_30: data.warranty_alerts.within_30.slice(0, 5),
            warranty_60: data.warranty_alerts.within_60.slice(0, 5),
            lab_risk: data.lab_risk.slice(0, 6),
            issues_by_age: data.issues_by_age,
          },
        }),
      });
      const json = await res.json();
      if (json.success) setAiInsights(json.insights);
      else setAiError(json.error || "Failed to get AI insights");
    } catch (e: any) {
      setAiError(e.message || "Could not connect to AI service");
    } finally {
      setAiLoading(false);
    }
  };

  // Send auto alerts to HOD & Lab Incharge
  const sendAutoAlerts = async () => {
    if (!data || data.high_risk_assets.length === 0) return;
    setAlertSending(true);
    setAlertResult(null);
    try {
      const alertsPayload = data.high_risk_assets.map((a) => ({
        asset_code: a.asset_code || a.assigned_code || `Device #${a.device_id}`,
        type_name: a.type_name,
        lab_name: a.lab_name,
        risk_level: a.risk_level,
        health_score: a.health_score,
        issue_summary: `${a.issue_count} issues (${a.open_issues} open, ${a.severe_issues} severe)`,
      }));

      const res = await fetch("http://localhost:5000/send_maintenance_alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alerts: alertsPayload }),
      });
      const json = await res.json();
      setAlertResult({
        success: json.success || false,
        message: json.message || json.error || "Unknown response",
        sent_to: json.sent_to,
        failed: json.failed,
      });
    } catch (e: any) {
      setAlertResult({ success: false, message: e.message || "Failed to send" });
    } finally {
      setAlertSending(false);
    }
  };

  // Derived stats
  const criticalCount = data ? data.high_risk_assets.filter((a) => a.risk_level === "critical").length : 0;

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div
      className="relative min-h-screen flex flex-col items-center py-12 px-4"
      style={{
        backgroundColor: "#1c1c1c",
        backgroundImage: "url(/bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Navbar */}
      <div className="fixed top-3 right-6 z-50">
        <Menu setActive={setActive}>
          <MenuItem setActive={setActive} active={active} item="Asset Management">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/assets">All Assets</HoveredLink>
              <HoveredLink href="/ocr">Add Assets</HoveredLink>
            </div>
          </MenuItem>
          <MenuItem setActive={setActive} active={active} item="Lab Management">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/lab-plan">Lab Floor Plans</HoveredLink>
              <HoveredLink href="/lab-layout">Lab Layout Designer</HoveredLink>
              <HoveredLink href="/lab-configuration">Lab Configuration</HoveredLink>
            </div>
          </MenuItem>
          <MenuItem setActive={setActive} active={active} item="Operations">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/transfers">Transfers</HoveredLink>
              <HoveredLink href="/dashboard/issues">Issues</HoveredLink>
              <HoveredLink href="/documents">Documents</HoveredLink>
            </div>
          </MenuItem>
          <MenuItem setActive={setActive} active={active} item="Analytics">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/reports">Reports</HoveredLink>
              <HoveredLink href="/warranty-expiry">Warranty Expiry</HoveredLink>
            </div>
          </MenuItem>
          <MenuItem setActive={setActive} active={active} item="Account">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/settings">Settings</HoveredLink>
              <button onClick={logout} className="text-left text-neutral-600 hover:text-neutral-800 transition-colors">
                Logout
              </button>
            </div>
          </MenuItem>
        </Menu>
      </div>

      <LogoButton />

      <h1 className="text-3xl font-bold mb-6 mt-16 text-gray-200">
        🛡️ Proactive Maintenance
      </h1>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center gap-3 text-gray-400 mt-20">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
          </svg>
          Loading maintenance data…
        </div>
      )}
      {error && (
        <div className="bg-red-900/60 border border-red-700 rounded-xl p-4 text-red-300 mt-8 max-w-xl text-center">
          {error}
        </div>
      )}

      {data && !loading && (
        <div className="w-full max-w-7xl space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Active Devices", value: data.summary.total_devices, color: "bg-blue-600" },
              { label: "At-Risk Assets", value: data.summary.needs_attention, color: "bg-red-600" },
              { label: "Critical Risk", value: criticalCount, color: "bg-red-800" },
              { label: "Critical Open Issues", value: data.summary.critical_open, color: "bg-purple-600" },
            ].map((card) => (
              <WobbleCard key={card.label} containerClassName={card.color} className="p-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">{card.value}</p>
                  <p className="text-sm text-white/80 mt-1">{card.label}</p>
                </div>
              </WobbleCard>
            ))}
          </div>

          {/* Tab Bar */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: "risk", label: "🔍 At-Risk Assets" },
              { key: "ai", label: "🤖 AI Insights" },
              { key: "alerts", label: "📧 Send Alerts" },
            ] as { key: typeof tab; label: string }[]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key
                    ? "bg-yellow-600 text-white shadow-lg shadow-yellow-600/30"
                    : "bg-neutral-800 text-gray-400 hover:bg-neutral-700 hover:text-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ═══ AT-RISK ASSETS TAB ═══ */}
            {tab === "risk" && (
              <motion.div key="risk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <Section title="At-Risk Assets (Health Score ≤ 75)">
                  <p className="text-gray-400 text-sm mb-4">
                    These devices have open issues, recent problems, or warranty concerns. Includes critical, high, and medium risk assets.
                  </p>
                  {data.high_risk_assets.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-2xl mb-2">✅</p>
                      <p className="text-green-400 font-semibold">All assets are healthy!</p>
                      <p className="text-gray-500 text-sm mt-1">No devices currently require urgent attention.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data.high_risk_assets.map((dev) => (
                        <motion.div
                          key={dev.device_id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`rounded-xl border p-4 transition-all ${RISK_BG[dev.risk_level] || RISK_BG.medium}`}
                        >
                          <div className="flex flex-wrap justify-between items-start gap-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-white font-semibold">
                                  {dev.type_name} — {dev.brand} {dev.model}
                                </span>
                                {riskBadge(dev.risk_level)}
                                {warrantyBadge(dev.warranty_status)}
                              </div>
                              <p className="text-xs text-gray-400">
                                {dev.asset_code && <span className="mr-3">ID: {dev.asset_code}</span>}
                                {dev.assigned_code && <span className="mr-3">Code: {dev.assigned_code}</span>}
                                {dev.lab_name && <span className="mr-3">Lab: {dev.lab_name}</span>}
                                {dev.vendor_name && <span>Vendor: {dev.vendor_name}</span>}
                              </p>
                            </div>
                            <div className="flex gap-4 text-center items-center">
                              <div>
                                <p className="text-xs text-gray-500 uppercase mb-1">Health</p>
                                {healthBar(dev.health_score)}
                              </div>
                              <div>
                                <p className="text-xl font-bold text-white">{dev.issue_count}</p>
                                <p className="text-[10px] text-gray-500 uppercase">Issues</p>
                              </div>
                              <div>
                                <p className="text-xl font-bold text-red-400">{dev.open_issues}</p>
                                <p className="text-[10px] text-gray-500 uppercase">Open</p>
                              </div>
                              <div>
                                <p className="text-xl font-bold text-orange-400">{dev.severe_issues}</p>
                                <p className="text-[10px] text-gray-500 uppercase">Severe</p>
                              </div>
                            </div>
                          </div>
                          {dev.days_until_expiry !== null && (
                            <div className="mt-2 text-xs text-gray-500">
                              {dev.days_until_expiry < 0
                                ? <span className="text-red-400">⚠ Warranty expired {Math.abs(dev.days_until_expiry)} days ago</span>
                                : <span>Warranty expires in {dev.days_until_expiry} days</span>
                              }
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </Section>
              </motion.div>
            )}

            {/* ═══ AI INSIGHTS TAB ═══ */}
            {tab === "ai" && (
              <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <Section title="AI-Powered Maintenance Analysis">
                  <p className="text-gray-400 text-sm mb-4">
                    Get proactive maintenance recommendations from the local AI model by analyzing asset health,
                    warranty status, and issue patterns.
                  </p>

                  {!aiInsights && !aiLoading && (
                    <button
                      onClick={fetchAiInsights}
                      className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 rounded-xl text-white font-semibold transition-all shadow-lg shadow-yellow-600/20"
                    >
                      🤖 Generate Maintenance Insights
                    </button>
                  )}

                  {aiLoading && (
                    <div className="flex items-center gap-3 text-gray-400">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                      </svg>
                      AI is analyzing your maintenance data…
                    </div>
                  )}

                  {aiError && (
                    <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
                      <p className="font-semibold mb-1">Could not load AI insights</p>
                      <p>{aiError}</p>
                      <button onClick={fetchAiInsights} className="mt-3 text-xs underline text-red-400 hover:text-red-300">
                        Retry
                      </button>
                    </div>
                  )}

                  {aiInsights && (
                    <div className="space-y-4">
                      {renderInsights(aiInsights)}
                      <button onClick={fetchAiInsights} className="mt-2 text-xs text-yellow-400 hover:text-yellow-300 underline">
                        🔄 Regenerate insights
                      </button>
                    </div>
                  )}
                </Section>
              </motion.div>
            )}

            {/* ═══ SEND ALERTS TAB ═══ */}
            {tab === "alerts" && (
              <motion.div key="alerts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <Section title="Send Maintenance Alerts">
                  <p className="text-gray-400 text-sm mb-6">
                    Automatically send alerts for all at-risk assets to <strong className="text-white">HOD</strong> and <strong className="text-white">Lab Incharge</strong> users.
                    No manual selection needed — all critical and high-risk assets are included.
                  </p>

                  {/* Recipients preview */}
                  <div className="rounded-xl border border-neutral-700/50 bg-neutral-800/50 p-5 mb-6">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <span>👥</span> Alert Recipients
                    </h3>
                    {recipientsLoading ? (
                      <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                        </svg>
                        Loading recipients…
                      </div>
                    ) : recipients.length === 0 ? (
                      <p className="text-gray-500 text-sm">No HOD or Lab Incharge users found in the system.</p>
                    ) : (
                      <div className="space-y-2">
                        {recipients.map((r) => (
                          <div key={r.id} className="flex items-center gap-3 text-sm">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              r.role === "HOD" ? "bg-blue-500" : "bg-green-500"
                            }`} />
                            <span className="text-white font-medium">{r.name}</span>
                            <span className="text-gray-500">·</span>
                            <span className="text-gray-400">{r.email}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              r.role === "HOD"
                                ? "bg-blue-600/30 text-blue-300 border border-blue-500/30"
                                : "bg-green-600/30 text-green-300 border border-green-500/30"
                            }`}>
                              {r.role}
                            </span>
                            {r.assigned_lab && (
                              <span className="text-xs text-gray-500">({r.assigned_lab})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Alert summary */}
                  <div className="rounded-xl border border-neutral-700/50 bg-neutral-800/50 p-5 mb-6">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <span>📋</span> Alert Contents
                    </h3>
                    {data.high_risk_assets.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-green-400 font-semibold">✅ No at-risk assets to alert about!</p>
                        <p className="text-gray-500 text-sm mt-1">All devices are in good health.</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-400 text-sm mb-3">
                          The alert will include <strong className="text-white">{data.high_risk_assets.length}</strong> at-risk asset{data.high_risk_assets.length !== 1 ? "s" : ""}:
                        </p>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {data.high_risk_assets.filter((a) => a.risk_level === "critical").length > 0 && (
                            <span className="text-xs px-3 py-1 rounded-full bg-red-600/30 text-red-300 border border-red-500/30 font-medium">
                              🔴 {data.high_risk_assets.filter((a) => a.risk_level === "critical").length} Critical
                            </span>
                          )}
                          {data.high_risk_assets.filter((a) => a.risk_level === "high").length > 0 && (
                            <span className="text-xs px-3 py-1 rounded-full bg-orange-600/30 text-orange-300 border border-orange-500/30 font-medium">
                              🟠 {data.high_risk_assets.filter((a) => a.risk_level === "high").length} High Risk
                            </span>
                          )}
                          {data.high_risk_assets.filter((a) => a.risk_level === "medium").length > 0 && (
                            <span className="text-xs px-3 py-1 rounded-full bg-yellow-600/30 text-yellow-300 border border-yellow-500/30 font-medium">
                              🟡 {data.high_risk_assets.filter((a) => a.risk_level === "medium").length} Medium
                            </span>
                          )}
                        </div>
                        <div className="max-h-[200px] overflow-y-auto space-y-1 mt-3">
                          {data.high_risk_assets.slice(0, 10).map((dev) => (
                            <div key={dev.device_id} className="flex items-center gap-2 text-xs text-gray-400">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: RISK_COLORS[dev.risk_level] || "#6b7280" }} />
                              <span className="text-gray-300 font-medium">{dev.asset_code || dev.assigned_code || `#${dev.device_id}`}</span>
                              <span className="text-gray-600">·</span>
                              <span>{dev.type_name}</span>
                              <span className="text-gray-600">·</span>
                              <span>{dev.lab_name}</span>
                              <span className="text-gray-600">·</span>
                              <span>Health: {dev.health_score}</span>
                            </div>
                          ))}
                          {data.high_risk_assets.length > 10 && (
                            <p className="text-xs text-gray-500 mt-1">… and {data.high_risk_assets.length - 10} more</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Send button */}
                  <button
                    onClick={sendAutoAlerts}
                    disabled={alertSending || data.high_risk_assets.length === 0 || recipients.length === 0}
                    className="w-full px-6 py-4 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold transition-all shadow-lg shadow-yellow-600/20 text-base"
                  >
                    {alertSending ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                        </svg>
                        Sending Alerts…
                      </span>
                    ) : (
                      `🚨 Send Alerts to ${recipients.length} HOD & Lab Incharge User${recipients.length !== 1 ? "s" : ""}`
                    )}
                  </button>

                  {/* Result message */}
                  {alertResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`rounded-xl p-5 mt-4 text-sm ${
                        alertResult.success
                          ? "bg-green-900/40 border border-green-700 text-green-300"
                          : "bg-red-900/40 border border-red-700 text-red-300"
                      }`}
                    >
                      <p className="font-semibold mb-2">
                        {alertResult.success ? "✅ " : "❌ "}{alertResult.message}
                      </p>
                      {alertResult.sent_to && alertResult.sent_to.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-400 mb-1">Sent to:</p>
                          <div className="flex flex-wrap gap-1">
                            {alertResult.sent_to.map((email) => (
                              <span key={email} className="text-xs px-2 py-0.5 rounded-full bg-green-800/40 text-green-300">
                                {email}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {alertResult.failed && alertResult.failed.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-red-400 mb-1">Failed:</p>
                          {alertResult.failed.map((f) => (
                            <p key={f.email} className="text-xs text-red-400">{f.email}: {f.error}</p>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </Section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
