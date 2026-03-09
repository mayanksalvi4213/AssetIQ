"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LogoButton } from "@/components/ui/logo-button";
import { useAuth } from "@/contexts/AuthContext";
import { WobbleCard } from "@/components/ui/wobble-card";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────
interface TimelinePoint {
  month: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface SeverityItem { severity: string; count: number }
interface StatusItem { status: string; count: number }

interface BatchItem {
  bill_id: number;
  invoice_number: string;
  vendor_name: string;
  bill_date: string | null;
  issue_count: number;
  affected_devices: number;
  total_devices_in_bill: number;
  severe_issues: number;
}

interface RepeatOffender {
  device_id: number;
  asset_id: string;
  type_name: string;
  brand: string;
  model: string;
  lab_name: string;
  assigned_code: string;
  is_active: boolean;
  issue_count: number;
  open_issues: number;
  severe_issues: number;
  first_issue: string;
  last_issue: string;
}

interface LabIssue {
  lab_name: string;
  issue_count: number;
  open_issues: number;
  severe_issues: number;
}

interface TypeIssue {
  type_name: string;
  issue_count: number;
  affected_devices: number;
  open_issues: number;
}

interface CommonIssue {
  issue_title: string;
  count: number;
  avg_severity_score: number;
}

interface ResolutionTime {
  type_name: string;
  avg_hours: number;
}

interface Summary {
  total_issues: number;
  open_issues: number;
  in_progress: number;
  resolved: number;
  affected_devices: number;
}

interface TrendsData {
  timeline: TimelinePoint[];
  severity_breakdown: SeverityItem[];
  status_breakdown: StatusItem[];
  problematic_batches: BatchItem[];
  repeat_offenders: RepeatOffender[];
  issues_by_lab: LabIssue[];
  issues_by_type: TypeIssue[];
  common_issues: CommonIssue[];
  avg_resolution: ResolutionTime[];
  summary: Summary;
}

// ─── Color palette ───────────────────────────────────────────
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  unknown: "#6b7280",
};
const STATUS_COLORS: Record<string, string> = {
  open: "#ef4444",
  "in-progress": "#f59e0b",
  resolved: "#22c55e",
};


// ─── Helpers ─────────────────────────────────────────────────
const severityBadge = (level: string) => {
  const map: Record<string, string> = {
    critical: "bg-red-600",
    high: "bg-orange-600",
    medium: "bg-yellow-600",
    low: "bg-green-600",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full text-white ${map[level] || "bg-gray-600"}`}>
      {level}
    </span>
  );
};

const formatMonth = (m: string) => {
  const [y, mo] = m.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(mo, 10) - 1]} ${y.slice(2)}`;
};

const SECTION_ICONS: Record<string, string> = {
  "KEY FINDINGS": "🔍",
  "BATCH ALERTS": "📦",
  "DEVICE ALERTS": "🖥️",
  "RECOMMENDATIONS": "💡",
  "PATTERNS": "📊",
};
const SECTION_COLORS: Record<string, string> = {
  "KEY FINDINGS": "border-blue-500/40 bg-blue-950/20",
  "BATCH ALERTS": "border-orange-500/40 bg-orange-950/20",
  "DEVICE ALERTS": "border-red-500/40 bg-red-950/20",
  "RECOMMENDATIONS": "border-green-500/40 bg-green-950/20",
  "PATTERNS": "border-purple-500/40 bg-purple-950/20",
};

const renderInsights = (text: string) => {
  // Split into sections by ### headings
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
              key === "RECOMMENDATIONS" ? "md:col-span-2" : ""
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

// ─── Section wrapper ─────────────────────────────────────────
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

// ─── Main component ──────────────────────────────────────────
export default function IssueTrends() {
  const [active, setActive] = useState<string | null>(null);
  const { logout } = useAuth();

  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [tab, setTab] = useState<"overview" | "batches" | "devices" | "ai">("overview");

  // ── Fetch data ──
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("http://localhost:5000/get_issue_trends");
        const json = await res.json();
        if (json.success) setData(json as TrendsData);
        else setError(json.error || "Failed to load data");
      } catch (e: any) {
        setError(e.message || "Network error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Fetch AI insights ──
  const fetchAiInsights = async () => {
    if (!data) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("http://localhost:5000/get_issue_insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analytics: {
            total_issues: data.summary.total_issues,
            open_issues: data.summary.open_issues,
            in_progress: data.summary.in_progress,
            resolved: data.summary.resolved,
            affected_devices: data.summary.affected_devices,
            problematic_batches: data.problematic_batches.slice(0, 5),
            repeat_offenders: data.repeat_offenders.slice(0, 5),
            issues_by_type: data.issues_by_type,
            common_issues: data.common_issues.slice(0, 5),
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

  // ── Render ──
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
      {/* ── Navbar ── */}
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
              <button
                onClick={logout}
                className="text-left text-neutral-600 hover:text-neutral-800 transition-colors"
              >
                Logout
              </button>
            </div>
          </MenuItem>
        </Menu>
      </div>

      <LogoButton />

      <h1 className="text-3xl font-bold mb-6 mt-16 text-gray-200">
        📊 Issue Trends & Analytics
      </h1>

      {/* ── Loading / Error ── */}
      {loading && (
        <div className="flex items-center gap-3 text-gray-400 mt-20">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
          </svg>
          Loading analytics…
        </div>
      )}
      {error && (
        <div className="bg-red-900/60 border border-red-700 rounded-xl p-4 text-red-300 mt-8 max-w-xl text-center">
          {error}
        </div>
      )}

      {data && !loading && (
        <div className="w-full max-w-7xl space-y-6">
          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total Issues", value: data.summary.total_issues, color: "bg-blue-600" },
              { label: "Open", value: data.summary.open_issues, color: "bg-red-600" },
              { label: "In Progress", value: data.summary.in_progress, color: "bg-yellow-600" },
              { label: "Resolved", value: data.summary.resolved, color: "bg-green-600" },
              { label: "Affected Devices", value: data.summary.affected_devices, color: "bg-purple-600" },
            ].map((card) => (
              <WobbleCard key={card.label} containerClassName={card.color} className="p-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">{card.value}</p>
                  <p className="text-sm text-white/80 mt-1">{card.label}</p>
                </div>
              </WobbleCard>
            ))}
          </div>

          {/* ── Tab bar ── */}
          <div className="flex gap-2 flex-wrap">
            {(
              [
                { key: "overview", label: "📈 Overview" },
                { key: "batches", label: "📦 Batch Analysis" },
                { key: "devices", label: "🔁 Repeat Offenders" },
                { key: "ai", label: "🤖 AI Insights" },
              ] as { key: typeof tab; label: string }[]
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                    : "bg-neutral-800 text-gray-400 hover:bg-neutral-700 hover:text-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ═══ OVERVIEW TAB ═══ */}
          <AnimatePresence mode="wait">
            {tab === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Timeline chart */}
                <Section title="Issue Timeline (Last 12 Months)">
                  {data.timeline.length === 0 ? (
                    <p className="text-gray-500 text-sm">No issue data in the last 12 months.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={data.timeline.map((t) => ({ ...t, month: formatMonth(t.month) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="month" stroke="#888" fontSize={12} />
                        <YAxis stroke="#888" fontSize={12} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#1f1f1f", border: "1px solid #444", borderRadius: 8 }}
                          labelStyle={{ color: "#ccc" }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="total" stroke="#60a5fa" strokeWidth={2} name="Total" dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} name="Critical" />
                        <Line type="monotone" dataKey="high" stroke="#f97316" strokeWidth={2} name="High" />
                        <Line type="monotone" dataKey="medium" stroke="#eab308" strokeWidth={1} name="Medium" strokeDasharray="4 4" />
                        <Line type="monotone" dataKey="low" stroke="#22c55e" strokeWidth={1} name="Low" strokeDasharray="4 4" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </Section>

                {/* Row: Severity + Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Section title="Issues by Severity">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={data.severity_breakdown}
                          dataKey="count"
                          nameKey="severity"
                          cx="50%" cy="50%" outerRadius={90}
                          label={({ name, value }: any) => `${name} (${value})`}
                        >
                          {data.severity_breakdown.map((entry) => (
                            <Cell key={entry.severity} fill={SEVERITY_COLORS[entry.severity] || "#6b7280"} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Section>

                  <Section title="Issues by Status">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={data.status_breakdown}
                          dataKey="count"
                          nameKey="status"
                          cx="50%" cy="50%" outerRadius={90}
                          label={({ name, value }: any) => `${name} (${value})`}
                        >
                          {data.status_breakdown.map((entry) => (
                            <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "#6b7280"} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Section>
                </div>

                {/* Row: Issues by Lab + by Device Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Section title="Issues by Lab">
                    {data.issues_by_lab.length === 0 ? (
                      <p className="text-gray-500 text-sm">No lab data.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data.issues_by_lab} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis type="number" stroke="#888" fontSize={12} />
                          <YAxis dataKey="lab_name" type="category" stroke="#888" fontSize={11} width={120} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#1f1f1f", border: "1px solid #444", borderRadius: 8 }}
                          />
                          <Legend />
                          <Bar dataKey="issue_count" fill="#60a5fa" name="Total Issues" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="open_issues" fill="#ef4444" name="Open" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="severe_issues" fill="#f97316" name="Severe" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Section>

                  <Section title="Issues by Device Type">
                    {data.issues_by_type.length === 0 ? (
                      <p className="text-gray-500 text-sm">No data.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data.issues_by_type}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="type_name" stroke="#888" fontSize={11} angle={-20} textAnchor="end" height={60} />
                          <YAxis stroke="#888" fontSize={12} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#1f1f1f", border: "1px solid #444", borderRadius: 8 }}
                          />
                          <Legend />
                          <Bar dataKey="issue_count" fill="#8b5cf6" name="Total Issues" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="affected_devices" fill="#06b6d4" name="Affected Devices" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Section>
                </div>

                {/* Row: Common Issues + Avg Resolution Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Section title="Most Common Issue Types">
                    {data.common_issues.length === 0 ? (
                      <p className="text-gray-500 text-sm">No issue data.</p>
                    ) : (
                      <div className="space-y-2">
                        {data.common_issues.map((ci, i) => {
                          const maxCount = data.common_issues[0]?.count || 1;
                          const pct = (ci.count / maxCount) * 100;
                          const sevLabel =
                            ci.avg_severity_score >= 3.5 ? "critical" :
                            ci.avg_severity_score >= 2.5 ? "high" :
                            ci.avg_severity_score >= 1.5 ? "medium" : "low";
                          return (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-300 truncate max-w-[60%]">{ci.issue_title}</span>
                                <div className="flex items-center gap-2">
                                  {severityBadge(sevLabel)}
                                  <span className="text-gray-400">{ci.count}×</span>
                                </div>
                              </div>
                              <div className="w-full bg-neutral-700 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: SEVERITY_COLORS[sevLabel],
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Section>

                  <Section title="Avg Resolution Time by Device Type">
                    {data.avg_resolution.length === 0 ? (
                      <p className="text-gray-500 text-sm">No resolved issues with history yet.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={data.avg_resolution}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="type_name" stroke="#888" fontSize={11} angle={-20} textAnchor="end" height={60} />
                          <YAxis stroke="#888" fontSize={12} label={{ value: "Hours", angle: -90, position: "insideLeft", fill: "#888" }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#1f1f1f", border: "1px solid #444", borderRadius: 8 }}
                            formatter={(v: any) => [`${v} hrs`, "Avg Time"]}
                          />
                          <Bar dataKey="avg_hours" fill="#f59e0b" name="Avg Hours" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Section>
                </div>
              </motion.div>
            )}

            {/* ═══ BATCH ANALYSIS TAB ═══ */}
            {tab === "batches" && (
              <motion.div
                key="batches"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <Section title="Problematic Purchase Batches" className="overflow-x-auto">
                  <p className="text-gray-400 text-sm mb-4">
                    Bills whose devices have raised the most issues. A high issue-to-device ratio
                    signals the entire batch may need attention or the vendor may have quality problems.
                  </p>
                  {data.problematic_batches.length === 0 ? (
                    <p className="text-gray-500 text-sm">No batch data found.</p>
                  ) : (
                    <>
                      {/* Visual bar chart */}
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data.problematic_batches.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis
                            dataKey="invoice_number"
                            stroke="#888"
                            fontSize={10}
                            angle={-30}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis stroke="#888" fontSize={12} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#1f1f1f", border: "1px solid #444", borderRadius: 8 }}
                          />
                          <Legend />
                          <Bar dataKey="issue_count" fill="#ef4444" name="Total Issues" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="affected_devices" fill="#f97316" name="Affected Devices" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="severe_issues" fill="#8b5cf6" name="Severe Issues" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>

                      {/* Table */}
                      <div className="mt-6 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead>
                            <tr className="text-gray-400 border-b border-neutral-700">
                              <th className="py-2 px-3">Invoice</th>
                              <th className="py-2 px-3">Vendor</th>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3 text-center">Issues</th>
                              <th className="py-2 px-3 text-center">Affected</th>
                              <th className="py-2 px-3 text-center">Total Devices</th>
                              <th className="py-2 px-3 text-center">Issue Rate</th>
                              <th className="py-2 px-3 text-center">Severe</th>
                              <th className="py-2 px-3">Risk</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.problematic_batches.map((b) => {
                              const rate = b.total_devices_in_bill > 0
                                ? Math.round((b.affected_devices / b.total_devices_in_bill) * 100)
                                : 0;
                              const risk = rate >= 70 || b.severe_issues >= 3
                                ? "critical"
                                : rate >= 40 || b.severe_issues >= 1
                                ? "high"
                                : rate >= 20
                                ? "medium"
                                : "low";
                              return (
                                <tr
                                  key={b.bill_id}
                                  className="border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors"
                                >
                                  <td className="py-2 px-3 text-blue-400 font-mono text-xs">
                                    {b.invoice_number || `Bill #${b.bill_id}`}
                                  </td>
                                  <td className="py-2 px-3 text-gray-300">{b.vendor_name || "—"}</td>
                                  <td className="py-2 px-3 text-gray-400">{b.bill_date || "—"}</td>
                                  <td className="py-2 px-3 text-center text-white font-semibold">{b.issue_count}</td>
                                  <td className="py-2 px-3 text-center text-orange-400">{b.affected_devices}</td>
                                  <td className="py-2 px-3 text-center text-gray-400">{b.total_devices_in_bill}</td>
                                  <td className="py-2 px-3 text-center">
                                    <span className={`font-semibold ${
                                      rate >= 70 ? "text-red-400" : rate >= 40 ? "text-orange-400" : rate >= 20 ? "text-yellow-400" : "text-green-400"
                                    }`}>
                                      {rate}%
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-center text-red-400">{b.severe_issues}</td>
                                  <td className="py-2 px-3">{severityBadge(risk)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </Section>
              </motion.div>
            )}

            {/* ═══ REPEAT OFFENDERS TAB ═══ */}
            {tab === "devices" && (
              <motion.div
                key="devices"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <Section title="Repeat Offender Devices">
                  <p className="text-gray-400 text-sm mb-4">
                    Devices that keep having recurring issues. These may need replacement, deep maintenance,
                    or investigation into root cause.
                  </p>
                  {data.repeat_offenders.length === 0 ? (
                    <p className="text-gray-500 text-sm">No devices with 2+ issues found.</p>
                  ) : (
                    <div className="space-y-3">
                      {data.repeat_offenders.map((dev) => {
                        const riskScore = dev.issue_count * 2 + dev.severe_issues * 3 + dev.open_issues * 2;
                        const risk = riskScore >= 15 ? "critical" : riskScore >= 10 ? "high" : riskScore >= 5 ? "medium" : "low";
                        return (
                          <motion.div
                            key={dev.device_id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`rounded-xl border p-4 transition-all ${
                              risk === "critical"
                                ? "border-red-600/60 bg-red-950/30"
                                : risk === "high"
                                ? "border-orange-600/50 bg-orange-950/20"
                                : "border-neutral-700/50 bg-neutral-800/50"
                            }`}
                          >
                            <div className="flex flex-wrap justify-between items-start gap-2">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-white font-semibold">
                                    {dev.type_name} — {dev.brand} {dev.model}
                                  </span>
                                  {severityBadge(risk)}
                                  {!dev.is_active && (
                                    <span className="text-xs bg-red-800 text-red-200 px-2 py-0.5 rounded-full">
                                      INACTIVE
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400">
                                  {dev.asset_id && <span className="mr-3">ID: {dev.asset_id}</span>}
                                  {dev.assigned_code && <span className="mr-3">Code: {dev.assigned_code}</span>}
                                  {dev.lab_name && <span>Lab: {dev.lab_name}</span>}
                                </p>
                              </div>

                              <div className="flex gap-4 text-center">
                                <div>
                                  <p className="text-xl font-bold text-white">{dev.issue_count}</p>
                                  <p className="text-[10px] text-gray-500 uppercase">Total</p>
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

                            <div className="mt-2 flex gap-4 text-xs text-gray-500">
                              {dev.first_issue && (
                                <span>
                                  First issue: {new Date(dev.first_issue).toLocaleDateString()}
                                </span>
                              )}
                              {dev.last_issue && (
                                <span>
                                  Latest: {new Date(dev.last_issue).toLocaleDateString()}
                                </span>
                              )}
                              {dev.first_issue && dev.last_issue && (
                                <span>
                                  Span:{" "}
                                  {Math.ceil(
                                    (new Date(dev.last_issue).getTime() - new Date(dev.first_issue).getTime()) /
                                      (1000 * 60 * 60 * 24)
                                  )}{" "}
                                  days
                                </span>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </Section>
              </motion.div>
            )}

            {/* ═══ AI INSIGHTS TAB ═══ */}
            {tab === "ai" && (
              <motion.div
                key="ai"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <Section title="AI-Powered Issue Analysis">
                  <p className="text-gray-400 text-sm mb-4">
                    Get actionable insights from the local AI model by analyzing your issue data
                    for patterns, risks, and recommendations.
                  </p>

                  {!aiInsights && !aiLoading && (
                    <button
                      onClick={fetchAiInsights}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl text-white font-semibold transition-all shadow-lg shadow-blue-600/20"
                    >
                      🤖 Generate AI Insights
                    </button>
                  )}

                  {aiLoading && (
                    <div className="flex items-center gap-3 text-gray-400">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                      </svg>
                      AI is analyzing your issue data…
                    </div>
                  )}

                  {aiError && (
                    <div className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
                      <p className="font-semibold mb-1">Could not load AI insights</p>
                      <p>{aiError}</p>
                      <button
                        onClick={fetchAiInsights}
                        className="mt-3 text-xs underline text-red-400 hover:text-red-300"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {aiInsights && (
                    <div className="space-y-4">
                      {renderInsights(aiInsights)}
                      <button
                        onClick={fetchAiInsights}
                        className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                      >
                        🔄 Regenerate insights
                      </button>
                    </div>
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
