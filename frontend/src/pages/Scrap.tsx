"use client";
import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import AppNavbar from "@/components/AppNavbar";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CometCard } from "@/components/ui/comet-card";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LabListItem {
  lab_id: string;
  lab_name: string;
  rows: number;
  columns: number;
}

interface LayoutCell {
  cellId: number | null;
  stationTypeId: number | null;
  stationTypeName: string;
  stationTypeLabel: string;
  stationLabel: string | null;
  icon: string;
  color: string;
  os: string[];
  notes: string | null;
}

interface Station {
  station_id: number;
  assigned_code: string;
  row?: number;
  column?: number;
  station_type_name: string;
  os: string;
  devices: Device[];
}

interface Device {
  device_id: number;
  type_name: string;
  brand: string;
  model: string;
  specification: string;
  asset_id: string;
  assigned_code?: string;
}

interface DeviceType {
  type_name: string;
  devices: Device[];
  count: number;
}

interface ScrapRequest {
  scrap_request_id: number;
  device_ids: number[];
  devices: Array<{
    device_id: number;
    type_name: string;
    brand: string;
    model: string;
    asset_id: string;
    assigned_code?: string;
    bill_id?: number | null;
    invoice_number?: string | null;
    vendor_name?: string | null;
    bill_date?: string | null;
  }>;
  lab_id?: string | null;
  lab_name?: string | null;
  status: "pending" | "approved" | "rejected";
  remark?: string | null;
  requested_by?: string | null;
  requested_by_name?: string | null;
  requested_at?: string | null;
  approved_by?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

const Scrap: React.FC = () => {
  const { user } = useAuth();

  // Labs list
  const [labs, setLabs] = useState<LabListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected lab
  const [selectedLab, setSelectedLab] = useState<LabListItem | null>(null);

  // Visual grid (from get_lab_layout)
  const [layoutGrid, setLayoutGrid] = useState<LayoutCell[][] | null>(null);

  // Seating grid (from get_lab — has device codes per cell)
  const [seatingGrid, setSeatingGrid] = useState<any[][] | null>(null);

  // Station flat list (for grouping by component type)
  const [stationList, setStationList] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);

  // Component detail view
  const [selectedComponentType, setSelectedComponentType] = useState<DeviceType | null>(null);

  // Selection for scrapping
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [scrapping, setScrapping] = useState(false);

  // Scrap register modal
  const [showScrapRegister, setShowScrapRegister] = useState(false);
  const [scrapRegisterLoading, setScrapRegisterLoading] = useState(false);
  const [scrapRegisterError, setScrapRegisterError] = useState<string | null>(null);
  const [scrapRegisterItems, setScrapRegisterItems] = useState<any[]>([]);
  const [scrapRegisterScope, setScrapRegisterScope] = useState<"lab" | "all">("lab");
  const [scrapRegisterYear, setScrapRegisterYear] = useState<string>("");
  const [scrapRegisterType, setScrapRegisterType] = useState<string>("");
  const [scrapRegisterLabId, setScrapRegisterLabId] = useState<string>("");

  // Scrap requests
  const [pendingScrapRequests, setPendingScrapRequests] = useState<ScrapRequest[]>([]);
  const [scrapRequestHistory, setScrapRequestHistory] = useState<ScrapRequest[]>([]);
  const [loadingScrapRequests, setLoadingScrapRequests] = useState(false);
  const [scrapRemark, setScrapRemark] = useState("");

  // Grid click device modal (station-level quick scrap)
  const [showGridDevices, setShowGridDevices] = useState(false);
  const [gridDevicesTitle, setGridDevicesTitle] = useState<string>("");
  const [gridDevices, setGridDevices] = useState<Device[]>([]);

  // ── Auth header ─────────────────────────────────────────────────────────────
  const authHeaders = (): HeadersInit => {
    const h: HeadersInit = { "Content-Type": "application/json" };
    const token = localStorage.getItem("token");
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  };

  // ── Fetch all labs ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchLabs = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/get_labs");
        const data = await res.json();
        if (data.success) setLabs(data.labs);
        else setError("Failed to fetch labs");
      } catch {
        setError("Error fetching labs from server");
      } finally {
        setLoading(false);
      }
    };
    fetchLabs();
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchScrapRequestHistory();
    if (user.role === "HOD") {
      fetchPendingScrapRequests();
    }
  }, [user]);

  // ── Handle lab click — load layout grid + seating + station list ────────────
  const handleLabClick = async (lab: LabListItem) => {
    setSelectedLab(lab);
    setSelectedComponentType(null);
    setLayoutGrid(null);
    setSeatingGrid(null);
    setStationList([]);
    setLoadingStations(true);

    try {
      // 1. Fetch layout blueprint (icons, colours, station types)
      const layoutRes = await fetch(
        `/api/get_lab_layout/${lab.lab_id}`,
        { headers: authHeaders() }
      );
      const layoutData = await layoutRes.json();
      if (layoutData.success && layoutData.layout) {
        const l = layoutData.layout;
        setLayoutGrid(l.grid);
      }

      // 2. Fetch seating arrangement (device codes per cell)
      const labRes = await fetch(
        `/api/get_lab/${lab.lab_id}`,
        { headers: authHeaders() }
      );
      const labData = await labRes.json();
      if (labData.success && labData.lab?.seatingArrangement?.grid) {
        setSeatingGrid(labData.lab.seatingArrangement.grid);
      }

      // 3. Fetch flat station list (for component-type grouping)
      const stationRes = await fetch(
        `/api/get_lab_station_list/${lab.lab_id}`,
        { headers: authHeaders() }
      );
      const stationData = await stationRes.json();
      if (stationData.success) {
        // Normalize backend shape -> frontend Station/Device interfaces
        const normalizedStations: Station[] = (stationData.stations || []).map((s: any) => {
          const devices: Device[] = (s.devices || []).map((d: any) => ({
            device_id: Number(d.deviceId ?? d.device_id ?? d.id ?? 0),
            type_name: String(d.type ?? d.device_type ?? d.type_name ?? "Unknown"),
            brand: String(d.brand ?? "Unknown"),
            model: String(d.model ?? ""),
            specification: String(d.specification ?? ""),
            asset_id: String(d.assetCode ?? d.asset_code ?? d.prefixCode ?? d.asset_id ?? d.deviceId ?? ""),
            assigned_code: String(d.assignedCode ?? d.assigned_code ?? d.prefixCode ?? ""),
          }));

          const rawRow = s.row ?? s.row_number ?? s.rowNumber;
          const rawColumn = s.column ?? s.column_number ?? s.columnNumber;
          const row = rawRow === null || rawRow === undefined ? undefined : Number(rawRow);
          const column = rawColumn === null || rawColumn === undefined ? undefined : Number(rawColumn);

          return {
            station_id: Number(s.stationId ?? s.station_id ?? 0),
            assigned_code: String(s.assignedCode ?? s.assigned_code ?? ""),
            row,
            column,
            station_type_name: String(s.stationTypeName ?? s.station_type_name ?? ""),
            os: String(s.os ?? ""),
            devices,
          };
        });

        // Drop any zero/invalid ids to keep selection + scrapping reliable.
        // (If the backend didn't return a valid deviceId, scrapping can't be performed for that item anyway.)
        const filteredStations = normalizedStations.map((s) => ({
          ...s,
          devices: s.devices.filter((d) => typeof d.device_id === "number" && d.device_id > 0),
        }));

        setStationList(filteredStations);
      }
    } catch (err) {
      console.error("Error loading lab data:", err);
    } finally {
      setLoadingStations(false);
    }
  };

  // ── Handle Scrap ──────────────────────────────────────────────────────────
  const handleScrapDevices = async () => {
    await handleCreateScrapRequest();
  };

  const toggleDeviceSelection = (deviceId: number) => {
    if (typeof deviceId !== "number" || deviceId <= 0) return;
    if (isDevicePending(deviceId)) return;
    setSelectedDeviceIds(prev => 
      prev.includes(deviceId) 
        ? prev.filter(id => id !== deviceId) 
        : [...prev, deviceId]
    );
  };

  const fetchScrapRegister = async (opts?: { scope?: "lab" | "all"; year?: string; type?: string; labId?: string }) => {
    try {
      setScrapRegisterLoading(true);
      setScrapRegisterError(null);

      const scope = opts?.scope ?? scrapRegisterScope;
      const year = opts?.year ?? scrapRegisterYear;
      const type = opts?.type ?? scrapRegisterType;
      const labId = opts?.labId ?? scrapRegisterLabId;

      const params = new URLSearchParams();
      if (scope === "lab") {
        if (selectedLab?.lab_id) params.set("lab_id", selectedLab.lab_id);
      } else if (labId) {
        params.set("lab_id", labId);
      }
      if (year) params.set("year", year);
      if (type) params.set("device_type", type);

      const url = `/api/get_scrapped_devices${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setScrapRegisterItems(data.items || []);
      } else {
        setScrapRegisterError(data.error || "Failed to load scrap register");
      }
    } catch (e) {
      console.error(e);
      setScrapRegisterError("Error connecting to server");
    } finally {
      setScrapRegisterLoading(false);
    }
  };

  const fetchPendingScrapRequests = async () => {
    try {
      setLoadingScrapRequests(true);
      const res = await fetch("/api/get_pending_scrap_requests", {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setPendingScrapRequests(data.requests || []);
      }
    } catch (e) {
      console.error("Error fetching pending scrap requests:", e);
    } finally {
      setLoadingScrapRequests(false);
    }
  };

  const fetchScrapRequestHistory = async () => {
    try {
      const res = await fetch("/api/get_scrap_request_history", {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setScrapRequestHistory(data.requests || []);
      }
    } catch (e) {
      console.error("Error fetching scrap request history:", e);
    }
  };

  const handleCreateScrapRequest = async () => {
    if (selectedDeviceIds.length === 0) return;

    const deviceIds = selectedDeviceIds.filter((id) => typeof id === "number" && id > 0);
    if (deviceIds.length === 0) {
      alert("Selected items don't have valid device IDs to request scrapping.");
      return;
    }

    if (!window.confirm(`Submit scrap request for ${deviceIds.length} device(s)?`)) {
      return;
    }

    try {
      setScrapping(true);
      const res = await fetch("/api/create_scrap_request", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ deviceIds, remark: scrapRemark }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || "Scrap request submitted");
        setSelectedDeviceIds([]);
        setScrapRemark("");
        if (user?.role === "HOD") {
          fetchPendingScrapRequests();
        }
        fetchScrapRequestHistory();
      } else {
        alert(data.error || "Failed to submit scrap request");
      }
    } catch (err) {
      console.error("Error submitting scrap request:", err);
      alert("Error connecting to server");
    } finally {
      setScrapping(false);
    }
  };

  const sortDevicesByAssignedCode = (devices: Device[]) => {
    return [...devices].sort((a, b) => {
      const aKey = (a.assigned_code || a.asset_id || "").toString();
      const bKey = (b.assigned_code || b.asset_id || "").toString();
      return aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: "base" });
    });
  };

  const pendingScrapDeviceIds = React.useMemo(() => {
    const ids = new Set<number>();
    pendingScrapRequests.forEach((req) => {
      if (req.status === "pending") {
        req.device_ids?.forEach((id) => {
          if (typeof id === "number" && id > 0) ids.add(id);
        });
      }
    });
    scrapRequestHistory.forEach((req) => {
      if (req.status === "pending") {
        req.device_ids?.forEach((id) => {
          if (typeof id === "number" && id > 0) ids.add(id);
        });
      }
    });
    return ids;
  }, [pendingScrapRequests, scrapRequestHistory]);

  const isDevicePending = (deviceId: number) => pendingScrapDeviceIds.has(deviceId);

  const getSelectableDeviceIds = (devices: Device[]) =>
    devices
      .map((d) => d.device_id)
      .filter((id) => typeof id === "number" && id > 0 && !isDevicePending(id));

  const toggleSelectAll = (devices: Device[]) => {
    const ids = getSelectableDeviceIds(devices);
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => selectedDeviceIds.includes(id));
    setSelectedDeviceIds((prev) => {
      if (allSelected) {
        return prev.filter((id) => !ids.includes(id));
      }
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const findStationForCell = (rowIndex: number, colIndex: number, assignedCodes: string[]) => {
    const row = rowIndex;
    const col = colIndex;
    const byPos = stationList.find((s) => s.row === row && s.column === col);
    if (byPos) return byPos;

    if (assignedCodes.length > 0) {
      const wanted = assignedCodes.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
      const byCode = stationList.find((s) => wanted.includes(String(s.assigned_code).trim().toLowerCase()));
      if (byCode) return byCode;
    }

    return undefined;
  };

  const handleApproveScrapRequest = async (requestId: number) => {
    if (!window.confirm("Approve and scrap all devices in this request?")) return;
    try {
      const res = await fetch(`/api/approve_scrap_request/${requestId}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || "Scrap request approved");
        fetchPendingScrapRequests();
        fetchScrapRequestHistory();
        if (selectedLab) {
          handleLabClick(selectedLab);
        }
      } else {
        alert(data.error || "Failed to approve scrap request");
      }
    } catch (err) {
      console.error("Error approving scrap request:", err);
      alert("Error connecting to server");
    }
  };

  const handleRejectScrapRequest = async (requestId: number) => {
    if (!window.confirm("Reject this scrap request?")) return;
    try {
      const res = await fetch(`/api/reject_scrap_request/${requestId}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || "Scrap request rejected");
        fetchPendingScrapRequests();
        fetchScrapRequestHistory();
      } else {
        alert(data.error || "Failed to reject scrap request");
      }
    } catch (err) {
      console.error("Error rejecting scrap request:", err);
      alert("Error connecting to server");
    }
  };

  const exportScrapRegisterToCSV = () => {
    const headers = [
      "Sr. No.",
      "Scrap ID",
      "Existing Dead Stock S. Number",
      "Assigned Code",
      "Name of Lab",
      "Item Description",
      "Specification",
      "Cost",
      "Justification for Scrapping",
    ];

    const rows = scrapRegisterItems.map((it, idx) => {
      const itemDescription = `${it.device_type ?? ""} ${it.brand ?? ""} ${it.model ?? ""}`.trim();
      return [
        String(idx + 1),
        it.scrap_id ?? "",
        it.dead_stock_number ?? it.asset_code ?? "",
        it.assigned_code ?? "",
        it.lab_name ?? it.lab_id ?? "",
        itemDescription,
        it.specification ?? "",
        it.cost != null ? String(it.cost) : "",
        it.justification_for_scrapping ?? "",
      ].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `scrap_register_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportScrapRegisterToPDF = async () => {
    try {
      const doc = new jsPDF("l", "mm", "a4");

      const headerImg = new Image();
      headerImg.src = "/header.png";
      await new Promise((resolve, reject) => {
        headerImg.onload = resolve;
        headerImg.onerror = () => reject(new Error("Failed to load header image"));
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 14;
      const headerMaxH = 24;
      const maxHeaderW = pageWidth - marginX * 2;
      const imgW = headerImg.naturalWidth || headerImg.width;
      const imgH = headerImg.naturalHeight || headerImg.height;
      const imgRatio = imgW / imgH;
      let headerW = maxHeaderW;
      let headerH = headerW / imgRatio;
      if (headerH > headerMaxH) {
        headerH = headerMaxH;
        headerW = headerH * imgRatio;
      }
      const headerX = (pageWidth - headerW) / 2;
      doc.addImage(headerImg, "PNG", headerX, 6, headerW, headerH);

      doc.setFontSize(14);
      doc.text("Scrap Register", pageWidth / 2, headerH + 18, { align: "center" });
      doc.setFontSize(9);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, marginX, headerH + 18);

      const tableData = scrapRegisterItems.map((it, idx) => {
        const itemDescription = `${it.device_type ?? ""} ${it.brand ?? ""} ${it.model ?? ""}`.trim();
        const costValue = it.cost != null
          ? Number(it.cost).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : "";
        return [
          String(idx + 1),
          it.scrap_id ?? "",
          it.dead_stock_number ?? it.asset_code ?? "",
          it.assigned_code ?? "",
          it.lab_name ?? it.lab_id ?? "",
          itemDescription,
          it.specification ?? "",
          costValue ? `₹${costValue}` : "",
          it.justification_for_scrapping ?? "",
        ];
      });

      autoTable(doc, {
        head: [[
          "Sr. No.",
          "Scrap ID",
          "Existing Dead Stock S. Number",
          "Assigned Code",
          "Name of Lab",
          "Item Description",
          "Specification",
          "Cost",
          "Justification for Scrapping",
        ]],
        body: tableData,
        startY: headerH + 26,
        theme: "grid",
        margin: { left: marginX, right: marginX, top: headerH + 26, bottom: 10 },
        styles: {
          fontSize: 9,
          fontStyle: "bold",
          cellPadding: 2.5,
          overflow: "linebreak",
          valign: "top",
        },
        headStyles: { fillColor: [75, 85, 99], fontSize: 9.5, fontStyle: "bold", textColor: 255 },
        alternateRowStyles: { fillColor: [243, 244, 246] },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 28 },
          2: { cellWidth: 30 },
          3: { cellWidth: 24 },
          4: { cellWidth: 24 },
          5: { cellWidth: 44 },
          6: { cellWidth: 42 },
          7: { cellWidth: 22, halign: "left", overflow: "visible" },
          8: { cellWidth: 48 },
        },
      });

      doc.save(`scrap_register_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (e) {
      console.error("Error generating PDF:", e);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  // ── Group devices by component type ────────────────────────────────────────
  const groupedComponents = React.useMemo<DeviceType[]>(() => {
    const groups: Record<string, Device[]> = {};
    stationList.forEach((station) => {
      station.devices.forEach((device) => {
        if (!groups[device.type_name]) groups[device.type_name] = [];
        groups[device.type_name].push(device);
      });
    });
    return Object.entries(groups).map(([type_name, devices]) => ({
      type_name,
      devices: sortDevicesByAssignedCode(devices),
      count: devices.length,
    }));
  }, [stationList]);

  const scrapRegisterYears = React.useMemo(() => {
    const years = new Set<string>();
    scrapRegisterItems.forEach((it) => {
      if (it.scrapped_at) {
        const y = new Date(it.scrapped_at).getFullYear();
        if (!Number.isNaN(y)) years.add(String(y));
      }
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [scrapRegisterItems]);

  const scrapRegisterTypes = React.useMemo(() => {
    const types = new Set<string>();
    scrapRegisterItems.forEach((it) => {
      if (it.device_type) types.add(String(it.device_type));
    });
    return Array.from(types).sort();
  }, [scrapRegisterItems]);

  // ── Layout stats pill bar ───────────────────────────────────────────────────
  const getLayoutStats = () => {
    if (!layoutGrid) return {};
    const counts: Record<string, { count: number; icon: string; color: string }> = {};
    for (const row of layoutGrid) {
      for (const cell of row) {
        if (cell.stationTypeId !== null) {
          const key = cell.stationTypeLabel;
          if (!counts[key]) counts[key] = { count: 0, icon: cell.icon, color: cell.color };
          counts[key].count++;
        }
      }
    }
    return counts;
  };

  // ── Emoji helper ───────────────────────────────────────────────────────────
  const getComponentEmoji = (type: string): string => {
    const t = type.toLowerCase();
    if (t === "laptop") return "💻";
    if (t === "pc") return "🖥️";
    if (t === "monitor") return "🖥️";
    if (t === "ac") return "❄️";
    if (t === "smart board") return "📺";
    if (t === "projector") return "📽️";
    if (t === "printer") return "🖨️";
    if (t === "scanner") return "📠";
    if (t === "ups") return "🔋";
    if (t === "router") return "📡";
    if (t === "switch") return "🔌";
    if (t === "server") return "🗄️";
    if (t === "keyboard") return "⌨️";
    if (t === "mouse") return "🖱️";
    if (t === "webcam") return "📷";
    if (t === "headset") return "🎧";
    return "🔧";
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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
      <AppNavbar />

      {/* ── Main content ── */}
      <div className="w-full max-w-7xl relative z-20">

        {/* ══════════════════════════════════════════════════════════
            VIEW 1 — Labs list
        ══════════════════════════════════════════════════════════ */}
        {!selectedLab ? (
          <>
            <h1 
              className="text-4xl font-bold mb-3 text-gray-200 text-center mt-16 px-5 py-2 rounded-xl inline-block"
              style={{
                background: "linear-gradient(135deg, rgba(10, 14, 25, 0.75) 0%,rgba(15, 23, 42, 0.80) 25%,rgba(8, 10, 15, 0.88) 50%,rgba(15, 23, 42, 0.80) 75%, rgba(20, 18, 16, 0.75) 100%)",
                color: "white",
                boxShadow: "0 4px 15px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
              }}
            >
              Scrap Management
            </h1>
            <p className="text-center mb-8">
              <span className="inline-block rounded-full bg-neutral-900/80 px-4 py-2 text-[13px] font-semibold text-cyan-200 border border-cyan-400/40 shadow-[0_0_18px_rgba(34,211,238,0.25)]">
                Select a lab to view its configuration and components
              </span>
            </p>
            <div className="flex justify-center mb-8">
              <button
                onClick={async () => {
                  setShowScrapRegister(true);
                  setScrapRegisterScope("all");
                  setScrapRegisterYear("");
                  setScrapRegisterType("");
                  setScrapRegisterLabId("");
                  await fetchScrapRegister({ scope: "all", year: "", type: "", labId: "" });
                }}
                className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg transition text-white text-[13px]"
              >
                🌐 View All Labs Register
              </button>
            </div>

            {loading && (
              <div className="text-center py-12">
                <p className="text-gray-400">Loading labs…</p>
              </div>
            )}
            {error && (
              <div className="text-center py-12">
                <p className="text-red-500">{error}</p>
              </div>
            )}
            {!loading && !error && labs.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400">
                  No labs found. Create a lab in Lab Configuration first.
                </p>
              </div>
            )}

            {!loading && !error && labs.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {labs.map((lab) => (
                  <div
                    key={lab.lab_id}
                    onClick={() => handleLabClick(lab)}
                    className="cursor-pointer transform transition hover:scale-105"
                  >
                    <CometCard>
                      <div className="p-6 text-white bg-neutral-800/95 rounded-2xl backdrop-blur-sm h-full flex flex-col justify-between">
                        <div>
                          <h2 className="text-2xl font-bold text-white">{lab.lab_name}</h2>
                          <p className="text-[13px] text-gray-400 mt-2">Lab ID: {lab.lab_id}</p>
                        </div>
                        <button className="mt-4 px-4 py-2 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors">
                          View Lab
                        </button>
                      </div>
                    </CometCard>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : !selectedComponentType ? (
          /* ══════════════════════════════════════════════════════════
              VIEW 2 — Lab Configuration (visual grid + component cards)
          ══════════════════════════════════════════════════════════ */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            {/* Header */}
            <div className="mb-6 flex items-center justify-between mt-16">
              <div className="rounded-2xl bg-neutral-900/70 px-5 py-3 backdrop-blur-sm border border-neutral-700/60 shadow-[0_6px_24px_rgba(0,0,0,0.35)]">
                <h1 className="text-4xl font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                  {selectedLab.lab_name}
                </h1>
                <p className="text-gray-300 mt-1">
                  Lab ID: {selectedLab.lab_id} &nbsp;·&nbsp; Grid: {selectedLab.rows} × {selectedLab.columns}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setShowScrapRegister(true);
                    setScrapRegisterScope("lab");
                    setScrapRegisterYear("");
                    setScrapRegisterType("");
                    setScrapRegisterLabId("");
                    await fetchScrapRegister();
                  }}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg transition text-white text-[13px] border border-neutral-700"
                >
                  📒 Scrap Register
                </button>
                <button
                  onClick={async () => {
                    setShowScrapRegister(true);
                    setScrapRegisterScope("all");
                    setScrapRegisterYear("");
                    setScrapRegisterType("");
                    setScrapRegisterLabId("");
                    await fetchScrapRegister({ scope: "all", year: "", type: "", labId: "" });
                  }}
                  className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg transition text-white text-[13px]"
                >
                  🌐 All Labs Register
                </button>
                <button
                  onClick={() => {
                    setSelectedLab(null);
                    setLayoutGrid(null);
                    setSeatingGrid(null);
                    setStationList([]);
                  }}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition text-white text-[13px]"
                >
                  ← Back to Labs
                </button>
              </div>
            </div>

            {loadingStations && (
              <div className="text-center py-12">
                <p className="text-gray-400">Loading lab configuration…</p>
              </div>
            )}

            {!loadingStations && (
              <>
                {/* ── Visual Layout Grid (same as Labconfiguration.tsx) ── */}
                {layoutGrid ? (
                  <div className="bg-neutral-800/95 rounded-2xl backdrop-blur-sm p-6 mb-6">
                    <h2 className="text-xl font-semibold text-white mb-1">
                      Lab Grid
                    </h2>
                    <p className="text-gray-400 text-xs mb-4">
                      Read-only view — showing station layout with assigned device codes
                    </p>

                    <div className="overflow-x-auto">
                      <div className="flex flex-col items-center">
                        {layoutGrid.map((row, ri) => (
                          <div key={ri} className="flex gap-1.5 mb-1.5">
                            {row.map((cell, ci) => {
                              const isStation = cell.stationTypeId !== null;
                              const seat = seatingGrid?.[ri]?.[ci];
                              const deviceGroup = seat?.deviceGroup;
                              const devices: any[] = deviceGroup?.devices || [];
                              const hasDevices = devices.length > 0;
                              const pendingInCell = hasDevices && devices.some((d: any) => {
                                const id = Number(d.deviceId ?? d.device_id ?? d.id ?? 0);
                                return id > 0 && isDevicePending(id);
                              });

                              return (
                                <div
                                  key={ci}
                                  onClick={() => {
                                    if (isStation && hasDevices) {
                                      // Find the full station details from the flat stationList
                                      // using the assigned device code or station ID if possible.
                                      // seatingGrid only has lightweight data, so we map it.
                                      
                                      // Get all assigned codes in this cell
                                      const cellAssignedCodes = devices.map(d => d.assignedCode).filter(Boolean);
                                      
                                      // Find the matching station from row/col or assigned code
                                      const matchingStation = findStationForCell(ri, ci, cellAssignedCodes);
                                      let fullStationDevices: Device[] = matchingStation?.devices || [];
                                      
                                      // Fallback if no matching station found, or if we want to show 
                                      // exactly what's in the seatingGrid but mapped to full details
                                      if (fullStationDevices.length === 0) {
                                         // Create basic representation if full details aren't in stationList
                                         fullStationDevices = devices.map((d, localIdx) => ({
                                          // Prefer real DB id if present; fallback ids are negative to avoid "select all" collisions.
                                          device_id: (d.deviceId ?? d.device_id ?? d.id ?? -((ri + 1) * 1000000 + (ci + 1) * 1000 + (localIdx + 1))),
                                          type_name: d.type,
                                          brand: d.brand || "Unknown",
                                          model: d.model || "",
                                          specification: d.specification || "",
                                            asset_id: d.assignedCode || d.type,
                                            assigned_code: d.assignedCode || "",
                                        }));
                                      }

                                      // Open station device modal so user can select + scrap from grid click
                                      setSelectedDeviceIds([]);
                                      setGridDevicesTitle(
                                        cell.stationTypeLabel +
                                          " (" +
                                          (cellAssignedCodes[0] || "Station") +
                                          ")"
                                      );
                                      // Show all devices; only devices with real DB ids can be scrapped.
                                      setGridDevices(sortDevicesByAssignedCode(fullStationDevices));
                                      setShowGridDevices(true);
                                    }
                                  }}
                                  className={`w-28 rounded-lg border-2 flex flex-col items-center justify-center p-2 transition-all ${
                                    !isStation
                                      ? "bg-neutral-800 border-gray-700 h-24"
                                      : hasDevices
                                        ? pendingInCell
                                          ? "ring-2 ring-orange-500/70 cursor-pointer hover:ring-orange-400 hover:scale-105"
                                          : "ring-2 ring-green-500/50 cursor-pointer hover:ring-green-400 hover:scale-105"
                                        : "opacity-50"
                                  }`}
                                  style={
                                    isStation
                                      ? {
                                          backgroundColor: hasDevices
                                            ? pendingInCell
                                              ? "rgba(249, 115, 22, 0.25)"
                                              : cell.color + "50"
                                            : cell.color + "20",
                                          borderColor: hasDevices
                                            ? pendingInCell
                                              ? "#f97316"
                                              : "#22c55e"
                                            : cell.color,
                                          minHeight: hasDevices
                                            ? `${Math.max(96, 48 + devices.length * 18)}px`
                                            : "96px",
                                        }
                                      : undefined
                                  }
                                  title={
                                    isStation && hasDevices
                                      ? `${pendingInCell ? "Pending scrap request\n\n" : ""}Click to view devices\n\n` + devices
                                          .map(
                                            (d: any) =>
                                              `${d.type}: ${d.assignedCode || "unassigned"}`
                                          )
                                          .join("\n")
                                      : cell.stationTypeLabel || "Empty"
                                  }
                                >
                                  {isStation ? (
                                    <>
                                      <span className="text-lg leading-none mb-0.5">
                                        {cell.icon}
                                      </span>
                                      {hasDevices ? (
                                        <div className="text-center w-full space-y-0.5">
                                          {devices.map((d: any, di: number) => (
                                            <div
                                              key={di}
                                              className={`text-[12px] font-semibold leading-tight truncate ${
                                                pendingInCell ? "text-orange-200" : "text-green-300"
                                              }`}
                                            >
                                              {d.assignedCode || d.type}
                                            </div>
                                          ))}
                                          <p className="text-[12px] text-cyan-400 mt-1 opacity-80">Click to view</p>
                                        </div>
                                      ) : (
                                        <div className="text-gray-400 text-[12px] text-center leading-tight mt-0.5">
                                          {cell.stationTypeLabel}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-gray-600 text-xs">Empty</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Station type legend pills */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {Object.entries(getLayoutStats()).map(([label, info]) => (
                        <div
                          key={label}
                          className="flex items-center gap-1.5 bg-neutral-900 px-3 py-1.5 rounded-full text-xs"
                        >
                          <span>{info.icon}</span>
                          <span className="text-gray-300">{label}:</span>
                          <span className="text-white font-bold">{info.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-neutral-800/95 rounded-2xl p-6 mb-6 text-center">
                    <p className="text-yellow-400 font-semibold">⚠️ No layout designed for this lab yet.</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Go to{" "}
                      <a href="/lab-layout" className="text-cyan-400 hover:underline">
                        Lab Layout Designer
                      </a>{" "}
                      to create one.
                    </p>
                  </div>
                )}

                {/* ── Component type summary cards ── */}
                <div className="bg-neutral-800/95 rounded-2xl backdrop-blur-sm p-6">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Components by Type
                  </h2>

                  {groupedComponents.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400">No components configured in this lab</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupedComponents.map((component, idx) => (
                        <motion.div
                          key={idx}
                          whileHover={{ scale: 1.03 }}
                          onClick={() => setSelectedComponentType(component)}
                          className="cursor-pointer p-4 bg-gradient-to-br from-neutral-700 to-neutral-800 border border-neutral-600 rounded-lg hover:border-neutral-400 transition"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-white">
                                {component.type_name}
                              </h3>
                              <p className="text-[13px] text-gray-400 mt-0.5">
                                Total Units: {component.count}
                              </p>
                            </div>
                            <span className="text-3xl">
                              {getComponentEmoji(component.type_name)}
                            </span>
                          </div>
                          <p className="text-[13px] text-cyan-400 mt-3">
                            Click to view all units →
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        ) : (
          /* ══════════════════════════════════════════════════════════
              VIEW 3 — Component detail (all devices of selected type)
          ══════════════════════════════════════════════════════════ */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <div className="mb-6 flex items-center justify-between mt-16">
              <div>
                <h1 className="text-4xl font-bold text-gray-200">
                  {getComponentEmoji(selectedComponentType.type_name)}{" "}
                  {selectedComponentType.type_name}
                </h1>
                <p className="text-gray-400 mt-1">
                  All {selectedComponentType.type_name} units in{" "}
                  <span className="text-white font-semibold">{selectedLab.lab_name}</span>
                  &nbsp;·&nbsp; {selectedComponentType.count} unit
                  {selectedComponentType.count !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleSelectAll(selectedComponentType.devices)}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg transition text-white text-[13px] border border-neutral-700"
                >
                  Select All
                </button>
                <button
                  onClick={() => {
                    setSelectedComponentType(null);
                    setSelectedDeviceIds([]);
                  }}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition text-white text-[13px]"
                >
                  ← Back to Configuration
                </button>
              </div>
            </div>

            <div className="bg-neutral-800/95 rounded-2xl backdrop-blur-sm p-6">
              {selectedComponentType.devices.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">No devices of this type</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedComponentType.devices.map((device, idx) => (
                      <motion.div
                        key={device.device_id ?? idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        onClick={() => toggleDeviceSelection(device.device_id)}
                        className={`relative border rounded-lg p-4 bg-gradient-to-br from-neutral-900 to-neutral-900/50 cursor-pointer transition-all ${
                          selectedDeviceIds.includes(device.device_id)
                            ? "border-red-500 ring-1 ring-red-500/50 bg-red-500/10"
                            : isDevicePending(device.device_id)
                              ? "border-orange-600/70 bg-orange-900/20 opacity-60 cursor-not-allowed"
                              : "border-neutral-600 hover:border-neutral-500"
                        }`}
                      >
                        {/* Checkbox Overlay */}
                        <div className="absolute top-4 right-4 z-10">
                          <input
                            type="checkbox"
                            checked={selectedDeviceIds.includes(device.device_id)}
                            onChange={() => {}} // Controlled by parent div click
                            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                        </div>

                        <div className="flex items-start justify-between mb-3 pr-8">
                          <h3 className="text-lg font-semibold text-white">{device.brand}</h3>
                          <span className="text-2xl">
                            {getComponentEmoji(selectedComponentType.type_name.split(" (")[0])}
                          </span>
                        </div>
                        <div className="space-y-2 text-[13px]">
                          <div>
                            <p className="text-gray-400 text-[13px]">Model</p>
                            <p className="text-white font-semibold">{device.model}</p>
                          </div>
                          {isDevicePending(device.device_id) && (
                            <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-orange-200 bg-orange-900/40 border border-orange-700 rounded-full px-2 py-0.5">
                              Pending scrap request
                            </div>
                          )}
                          {device.specification && (
                            <div>
                              <p className="text-gray-400 text-[13px]">Specification</p>
                              <p className="text-white text-[13px] leading-snug">
                                {device.specification}
                              </p>
                            </div>
                          )}
                          <div className="border-t border-neutral-700 pt-2 mt-2">
                            <p className="text-gray-400 text-[13px]">Assigned Code</p>
                            <p className="text-cyan-300 font-mono text-[13px]">
                              {device.assigned_code || "-"}
                            </p>
                            <p className="text-gray-400 text-[13px] mt-1">Asset Code</p>
                            <p className="text-blue-400 font-mono text-[13px]">{device.asset_id}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Request Scrap button moved below */}
                  {selectedDeviceIds.length > 0 && (
                    <div className="mt-6 flex flex-col items-center justify-center gap-3">
                      <input
                        value={scrapRemark}
                        onChange={(e) => setScrapRemark(e.target.value)}
                        placeholder="Optional remark for HOD"
                        className="w-full max-w-lg bg-neutral-800 text-white text-[13px] rounded-lg px-3 py-2 border border-neutral-700 focus:outline-none focus:border-neutral-500"
                      />
                      <button
                        onClick={handleScrapDevices}
                        disabled={scrapping}
                        className="px-5 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition text-white text-[13px] font-semibold flex items-center gap-2"
                      >
                        🧾 {scrapping ? "Submitting..." : `Request Scrap (${selectedDeviceIds.length})`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
        {user?.role === "HOD" && (
          <div className="mt-8 bg-neutral-900/90 rounded-2xl border border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Pending Scrap Requests</h2>
              <button
                onClick={fetchPendingScrapRequests}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition text-white text-[13px]"
                disabled={loadingScrapRequests}
              >
                ⟳ Refresh
              </button>
            </div>
            {loadingScrapRequests && <p className="text-gray-400">Loading requests…</p>}
            {!loadingScrapRequests && pendingScrapRequests.length === 0 && (
              <p className="text-gray-400">No pending requests.</p>
            )}
            {!loadingScrapRequests && pendingScrapRequests.length > 0 && (
              <div className="space-y-3">
                {pendingScrapRequests.map((req) => (
                  <div key={req.scrap_request_id} className="bg-neutral-800/80 rounded-lg p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div>
                        <p className="text-white font-semibold">
                          {req.lab_name || req.lab_id || "Unknown Lab"} • {req.devices?.length || 0} device(s)
                        </p>
                        <p className="text-gray-400 text-[13px]">
                          Requested by {req.requested_by_name || req.requested_by || "Unknown"}
                          {req.requested_at ? ` • ${new Date(req.requested_at).toLocaleString()}` : ""}
                        </p>
                        {req.remark && <p className="text-gray-300 text-[13px] mt-1">Remark: {req.remark}</p>}
                        <div className="text-gray-300 text-[13px] mt-2">
                          {req.devices?.slice(0, 4).map((d) => (
                            <span key={d.device_id} className="inline-block mr-2">
                              {d.type_name} {d.brand} {d.model}
                            </span>
                          ))}
                          {req.devices && req.devices.length > 4 && (
                            <span className="text-gray-500">+{req.devices.length - 4} more</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveScrapRequest(req.scrap_request_id)}
                          className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition text-white text-[13px]"
                        >
                          Approve & Scrap
                        </button>
                        <button
                          onClick={() => handleRejectScrapRequest(req.scrap_request_id)}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition text-white text-[13px]"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                    <details className="mt-4 rounded-lg border border-neutral-700 bg-neutral-900/60">
                      <summary className="cursor-pointer px-4 py-2 text-[13px] text-cyan-300 hover:text-cyan-200">
                        View device and bill details
                      </summary>
                      <div className="px-4 pb-4 pt-2 text-[13px] text-gray-200">
                        <div className="mb-3">
                          <span className="text-[13px] uppercase tracking-widest text-gray-500 mr-2">Lab</span>
                          <span className="inline-flex items-center rounded-full bg-cyan-500/15 px-3 py-1 text-[13px] font-semibold text-cyan-200 border border-cyan-400/40">
                            {req.lab_name || req.lab_id || "Unknown"}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[13px]">
                            <thead className="text-gray-400">
                              <tr className="border-b border-neutral-800">
                                <th className="text-left py-2 pr-3">Device Type</th>
                                <th className="text-left py-2 pr-3">Asset Code</th>
                                <th className="text-left py-2 pr-3">Assigned Code</th>
                                <th className="text-left py-2 pr-3">Bill No</th>
                                <th className="text-left py-2 pr-3">Vendor</th>
                                <th className="text-left py-2 pr-3">Bill Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {req.devices?.map((d) => (
                                <tr key={d.device_id} className="border-b border-neutral-800/70">
                                  <td className="py-2 pr-3">{d.type_name || "-"}</td>
                                  <td className="py-2 pr-3 font-mono text-blue-300">{d.asset_id || "-"}</td>
                                  <td className="py-2 pr-3 font-mono text-cyan-300">{d.assigned_code || "-"}</td>
                                  <td className="py-2 pr-3">{d.invoice_number || d.bill_id || "-"}</td>
                                  <td className="py-2 pr-3">{d.vendor_name || "-"}</td>
                                  <td className="py-2 pr-3">
                                    {d.bill_date ? new Date(d.bill_date).toLocaleDateString() : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {scrapRequestHistory.length > 0 && (
          <div className="mt-8 bg-neutral-900/90 rounded-2xl border border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Scrap Requests</h2>
              <button
                onClick={fetchScrapRequestHistory}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition text-white text-[13px]"
              >
                ⟳ Refresh
              </button>
            </div>
            <div className="space-y-3">
              {scrapRequestHistory.map((req) => (
                <div key={req.scrap_request_id} className="bg-neutral-800/80 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold">
                        {req.lab_name || req.lab_id || "Unknown Lab"} • {req.devices?.length || 0} device(s)
                      </p>
                      <p className="text-gray-400 text-[13px]">
                        {req.requested_at ? new Date(req.requested_at).toLocaleString() : ""}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[13px] font-semibold ${
                        req.status === "approved"
                          ? "bg-green-600/20 text-green-300"
                          : req.status === "rejected"
                          ? "bg-red-600/20 text-red-300"
                          : "bg-yellow-600/20 text-yellow-300"
                      }`}
                    >
                      {req.status.toUpperCase()}
                    </span>
                  </div>
                  {req.remark && <p className="text-gray-300 text-[13px] mt-2">Remark: {req.remark}</p>}
                  <details className="mt-4 rounded-lg border border-neutral-700 bg-neutral-900/60">
                    <summary className="cursor-pointer px-4 py-2 text-[13px] text-cyan-300 hover:text-cyan-200">
                      View device and bill details
                    </summary>
                    <div className="px-4 pb-4 pt-2 text-[13px] text-gray-200">
                      <div className="mb-3">
                        <span className="text-[13px] uppercase tracking-widest text-gray-500 mr-2">Lab</span>
                        <span className="inline-flex items-center rounded-full bg-cyan-500/15 px-3 py-1 text-[13px] font-semibold text-cyan-200 border border-cyan-400/40">
                          {req.lab_name || req.lab_id || "Unknown"}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                          <thead className="text-gray-400">
                            <tr className="border-b border-neutral-800">
                              <th className="text-left py-2 pr-3">Device Type</th>
                              <th className="text-left py-2 pr-3">Asset Code</th>
                              <th className="text-left py-2 pr-3">Assigned Code</th>
                              <th className="text-left py-2 pr-3">Bill No</th>
                              <th className="text-left py-2 pr-3">Vendor</th>
                              <th className="text-left py-2 pr-3">Bill Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {req.devices?.map((d) => (
                              <tr key={d.device_id} className="border-b border-neutral-800/70">
                                <td className="py-2 pr-3">{d.type_name || "-"}</td>
                                <td className="py-2 pr-3 font-mono text-blue-300">{d.asset_id || "-"}</td>
                                <td className="py-2 pr-3 font-mono text-cyan-300">{d.assigned_code || "-"}</td>
                                <td className="py-2 pr-3">{d.invoice_number || d.bill_id || "-"}</td>
                                <td className="py-2 pr-3">{d.vendor_name || "-"}</td>
                                <td className="py-2 pr-3">
                                  {d.bill_date ? new Date(d.bill_date).toLocaleDateString() : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grid station devices modal (scrap from grid click) */}
      {showGridDevices && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-5xl bg-neutral-900 border border-neutral-700 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
              <div>
                <h2 className="text-xl font-bold text-white">{gridDevicesTitle}</h2>
                <p className="text-[13px] text-gray-400 mt-0.5">Select equipment/components to scrap</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleSelectAll(gridDevices)}
                  className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg transition text-white text-[13px] border border-neutral-700"
                >
                  Select All
                </button>
                <button
                  onClick={() => {
                    setShowGridDevices(false);
                    setSelectedDeviceIds([]);
                  }}
                  className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition text-white text-[13px]"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[70vh] overflow-auto">
              {gridDevices.length === 0 ? (
                <p className="text-gray-400">No devices found for this station.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gridDevices.map((device, idx) => (
                    <motion.div
                      key={device.device_id ?? idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => toggleDeviceSelection(device.device_id)}
                      className={`relative border rounded-lg p-4 bg-gradient-to-br from-neutral-900 to-neutral-900/50 cursor-pointer transition-all ${
                        selectedDeviceIds.includes(device.device_id)
                          ? "border-red-500 ring-1 ring-red-500/50 bg-red-500/10"
                          : device.device_id > 0 && !isDevicePending(device.device_id)
                            ? "border-neutral-600 hover:border-neutral-500"
                            : "border-neutral-800 opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <div className="absolute top-4 right-4 z-10">
                        <input
                          type="checkbox"
                          checked={selectedDeviceIds.includes(device.device_id)}
                          onChange={() => {}}
                          disabled={!(device.device_id > 0) || isDevicePending(device.device_id)}
                          className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                      </div>

                      <div className="flex items-start justify-between mb-3 pr-8">
                        <h3 className="text-lg font-semibold text-white">{device.brand}</h3>
                        <span className="text-2xl">{getComponentEmoji(device.type_name)}</span>
                      </div>
                      <div className="space-y-2 text-[13px]">
                        <div>
                          <p className="text-gray-400 text-[13px]">Model</p>
                          <p className="text-white font-semibold">{device.model}</p>
                        </div>
                        {isDevicePending(device.device_id) && (
                          <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-orange-200 bg-orange-900/40 border border-orange-700 rounded-full px-2 py-0.5">
                            Pending scrap request
                          </div>
                        )}
                        {device.specification && (
                          <div>
                            <p className="text-gray-400 text-[13px]">Specification</p>
                            <p className="text-white text-[13px] leading-snug">{device.specification}</p>
                          </div>
                        )}
                        <div className="border-t border-neutral-700 pt-2 mt-2">
                          <p className="text-gray-400 text-[13px]">Assigned Code</p>
                          <p className="text-cyan-300 font-mono text-[13px]">
                            {device.assigned_code || "-"}
                          </p>
                          <p className="text-gray-400 text-[13px] mt-1">Asset Code</p>
                          <p className="text-blue-400 font-mono text-[13px]">{device.asset_id}</p>
                        </div>
                        {!(device.device_id > 0) && (
                          <p className="text-[13px] text-yellow-400 mt-2">
                            Not linked to database ID (view-only)
                          </p>
                        )}
                        {device.device_id > 0 && isDevicePending(device.device_id) && (
                          <p className="text-[13px] text-orange-300 mt-2">
                            Pending scrap request exists
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {selectedDeviceIds.filter((id) => id > 0).length > 0 && (
                <div className="mt-6 flex flex-col items-center justify-center gap-3">
                  <input
                    value={scrapRemark}
                    onChange={(e) => setScrapRemark(e.target.value)}
                    placeholder="Optional remark for HOD"
                    className="w-full max-w-lg bg-neutral-800 text-white text-[13px] rounded-lg px-3 py-2 border border-neutral-700 focus:outline-none focus:border-neutral-500"
                  />
                  <button
                    onClick={async () => {
                      await handleScrapDevices();
                      setShowGridDevices(false);
                    }}
                    disabled={scrapping}
                    className="px-5 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition text-white text-[13px] font-semibold flex items-center gap-2"
                  >
                    🧾{" "}
                    {scrapping
                      ? "Submitting..."
                      : `Request Scrap (${selectedDeviceIds.filter((id) => id > 0).length})`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scrap Register Modal */}
      {showScrapRegister && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-5xl bg-neutral-900 border border-neutral-700 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Scrap Register {scrapRegisterScope === "all" ? "— All Labs" : "— This Lab"}
                </h2>
                <p className="text-[14px] text-gray-400 mt-0.5">All scrapped equipment/components and their details</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportScrapRegisterToCSV}
                  disabled={scrapRegisterItems.length === 0}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2 text-[14px]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export as CSV
                </button>
                <button
                  onClick={exportScrapRegisterToPDF}
                  disabled={scrapRegisterItems.length === 0}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2 text-[14px]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export as PDF
                </button>
                <button
                  onClick={() => fetchScrapRegister()}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition text-white text-[14px]"
                  disabled={scrapRegisterLoading}
                >
                  ⟳ Refresh
                </button>
                <button
                  onClick={() => setShowScrapRegister(false)}
                  className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition text-white text-[14px]"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[70vh] overflow-auto">
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[13px] text-gray-300 mb-1">Year</label>
                  <select
                    value={scrapRegisterYear}
                    onChange={async (e) => {
                      const value = e.target.value;
                      setScrapRegisterYear(value);
                      await fetchScrapRegister({ year: value });
                    }}
                    className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white text-[13px] px-3 py-2"
                  >
                    <option value="">All Years</option>
                    {scrapRegisterYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] text-gray-300 mb-1">Device Type</label>
                  <select
                    value={scrapRegisterType}
                    onChange={async (e) => {
                      const value = e.target.value;
                      setScrapRegisterType(value);
                      await fetchScrapRegister({ type: value });
                    }}
                    className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white text-[13px] px-3 py-2"
                  >
                    <option value="">All Types</option>
                    {scrapRegisterTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] text-gray-300 mb-1">Lab</label>
                  <select
                    value={scrapRegisterScope === "lab" ? (selectedLab?.lab_id || "") : scrapRegisterLabId}
                    onChange={async (e) => {
                      const value = e.target.value;
                      setScrapRegisterLabId(value);
                      await fetchScrapRegister({ scope: "all", labId: value });
                    }}
                    disabled={scrapRegisterScope === "lab"}
                    className="w-full rounded-lg bg-neutral-800 border border-neutral-700 text-white text-[13px] px-3 py-2 disabled:opacity-60"
                  >
                    {scrapRegisterScope === "lab" ? (
                      <option value={selectedLab?.lab_id || ""}>{selectedLab?.lab_name || "This Lab"}</option>
                    ) : (
                      <>
                        <option value="">All Labs</option>
                        {labs.map((lab) => (
                          <option key={lab.lab_id} value={lab.lab_id}>{lab.lab_name}</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>
              {scrapRegisterLoading && <p className="text-gray-400">Loading…</p>}
              {scrapRegisterError && <p className="text-red-400">{scrapRegisterError}</p>}
              {!scrapRegisterLoading && !scrapRegisterError && scrapRegisterItems.length === 0 && (
                <p className="text-gray-400">No scrapped items found.</p>
              )}

              {!scrapRegisterLoading && !scrapRegisterError && scrapRegisterItems.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[14px]">
                    <thead className="text-gray-300">
                      <tr className="border-b border-neutral-800">
                        <th className="text-left py-2 pr-3">Sr No</th>
                        <th className="text-left py-2 pr-3">Scrap ID</th>
                        <th className="text-left py-2 pr-3">Existing Dead Stock S. Number</th>
                        <th className="text-left py-2 pr-3">Assigned Code</th>
                        <th className="text-left py-2 pr-3">Name of Lab</th>
                        <th className="text-left py-2 pr-3">Item Description</th>
                        <th className="text-left py-2 pr-3">Specification</th>
                        <th className="text-left py-2 pr-3">Cost</th>
                        <th className="text-left py-2 pr-3">Justification for Scrapping</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-200">
                      {scrapRegisterItems.map((it, i) => {
                        const itemDescription = `${it.device_type ?? ""} ${it.brand ?? ""} ${it.model ?? ""}`.trim();
                        return (
                          <tr key={it.scrap_id ?? i} className="border-b border-neutral-800/70">
                            <td className="py-2 pr-3 whitespace-nowrap">{i + 1}</td>
                            <td className="py-2 pr-3 font-mono text-gray-300">{it.scrap_id ?? "-"}</td>
                            <td className="py-2 pr-3 font-mono text-blue-300">{it.dead_stock_number ?? it.asset_code ?? "-"}</td>
                            <td className="py-2 pr-3 font-mono text-cyan-300">{it.assigned_code ?? "-"}</td>
                            <td className="py-2 pr-3">{it.lab_name ?? it.lab_id ?? "-"}</td>
                            <td className="py-2 pr-3">{itemDescription || "-"}</td>
                            <td className="py-2 pr-3 text-[14px] text-gray-300">{it.specification ?? "-"}</td>
                            <td className="py-2 pr-3">{it.cost != null ? `₹${Number(it.cost).toFixed(2)}` : "-"}</td>
                            <td className="py-2 pr-3">{it.justification_for_scrapping ?? "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scrap;

