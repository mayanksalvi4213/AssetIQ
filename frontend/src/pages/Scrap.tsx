"use client";
import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LogoButton } from "@/components/ui/logo-button";
import { WobbleCard } from "@/components/ui/wobble-card";
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
}

interface DeviceType {
  type_name: string;
  devices: Device[];
  count: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

const Scrap: React.FC = () => {
  useAuth();
  const [active, setActive] = useState<string | null>(null);

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
        const res = await fetch("http://localhost:5000/get_labs");
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
        `http://127.0.0.1:5000/get_lab_layout/${lab.lab_id}`,
        { headers: authHeaders() }
      );
      const layoutData = await layoutRes.json();
      if (layoutData.success && layoutData.layout) {
        const l = layoutData.layout;
        setLayoutGrid(l.grid);
      }

      // 2. Fetch seating arrangement (device codes per cell)
      const labRes = await fetch(
        `http://127.0.0.1:5000/get_lab/${lab.lab_id}`,
        { headers: authHeaders() }
      );
      const labData = await labRes.json();
      if (labData.success && labData.lab?.seatingArrangement?.grid) {
        setSeatingGrid(labData.lab.seatingArrangement.grid);
      }

      // 3. Fetch flat station list (for component-type grouping)
      const stationRes = await fetch(
        `http://localhost:5000/get_lab_station_list/${lab.lab_id}`,
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
          }));

          return {
            station_id: Number(s.stationId ?? s.station_id ?? 0),
            assigned_code: String(s.assignedCode ?? s.assigned_code ?? ""),
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
    if (selectedDeviceIds.length === 0) return;

    const deviceIds = selectedDeviceIds.filter((id) => typeof id === "number" && id > 0);
    if (deviceIds.length === 0) {
      alert("Selected items don't have valid device IDs to scrap.");
      return;
    }
    
    if (!window.confirm(`Are you sure you want to scrap ${deviceIds.length} device(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      setScrapping(true);
      const res = await fetch("http://localhost:5000/scrap_devices", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ deviceIds }),
      });
      const data = await res.json();
      
      if (data.success) {
        alert(data.message || "Devices scrapped successfully");
        setSelectedDeviceIds([]);
        // Refresh lab data
        if (selectedLab) {
          handleLabClick(selectedLab);
        }
      } else {
        alert(data.error || "Failed to scrap devices");
      }
    } catch (err) {
      console.error("Error scrapping devices:", err);
      alert("Error connecting to server");
    } finally {
      setScrapping(false);
    }
  };

  const toggleDeviceSelection = (deviceId: number) => {
    setSelectedDeviceIds(prev => 
      prev.includes(deviceId) 
        ? prev.filter(id => id !== deviceId) 
        : [...prev, deviceId]
    );
  };

  const fetchScrapRegister = async () => {
    try {
      setScrapRegisterLoading(true);
      setScrapRegisterError(null);
      const res = await fetch("http://localhost:5000/get_scrapped_devices", {
        headers: authHeaders(),
      });
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
      devices,
      count: devices.length,
    }));
  }, [stationList]);

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
              <HoveredLink href="/lab-configuration">Lab Configuration</HoveredLink>
            </div>
          </MenuItem>

          <MenuItem setActive={setActive} active={active} item="Operations">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/transfers">Transfers</HoveredLink>
              <HoveredLink href="/scrap">Scrap</HoveredLink>
              <HoveredLink href="/dashboard/issues">Issues</HoveredLink>
              <HoveredLink href="/dashboard/documents">Documents</HoveredLink>
            </div>
          </MenuItem>

          <MenuItem setActive={setActive} active={active} item="Analytics">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/reports">Reports</HoveredLink>
            </div>
          </MenuItem>
        </Menu>
      </div>

      <LogoButton />

      {/* ── Main content ── */}
      <div className="w-full max-w-7xl relative z-20">

        {/* ══════════════════════════════════════════════════════════
            VIEW 1 — Labs list
        ══════════════════════════════════════════════════════════ */}
        {!selectedLab ? (
          <>
            <h1 className="text-4xl font-bold mb-3 text-gray-200 text-center mt-16">
              Scrap Management
            </h1>
            <p className="text-gray-400 text-center mb-8">
              Select a lab to view its configuration and components
            </p>

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
                    <WobbleCard containerClassName="bg-gradient-to-br from-neutral-800 to-neutral-900 p-6 rounded-xl h-48 border border-neutral-700">
                      <div className="h-full flex flex-col justify-between">
                        <div>
                          <h2 className="text-2xl font-bold text-white">{lab.lab_name}</h2>
                          <p className="text-sm text-gray-400 mt-2">Lab ID: {lab.lab_id}</p>
                        </div>
                        <div className="flex items-end justify-between">
                          <div className="text-gray-300">
                            <p className="text-sm">Grid Size</p>
                            <p className="text-lg font-semibold">
                              {lab.rows} × {lab.columns}
                            </p>
                          </div>
                          <div className="text-2xl">📋</div>
                        </div>
                      </div>
                    </WobbleCard>
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
              <div>
                <h1 className="text-4xl font-bold text-gray-200">
                  {selectedLab.lab_name}
                </h1>
                <p className="text-gray-400 mt-1">
                  Lab ID: {selectedLab.lab_id} &nbsp;·&nbsp; Grid: {selectedLab.rows} × {selectedLab.columns}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setShowScrapRegister(true);
                    await fetchScrapRegister();
                  }}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg transition text-white text-sm border border-neutral-700"
                >
                  📒 Scrap Register
                </button>
                <button
                  onClick={() => {
                    setSelectedLab(null);
                    setLayoutGrid(null);
                    setSeatingGrid(null);
                    setStationList([]);
                  }}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition text-white text-sm"
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
                      Lab Configuration Grid
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
                                      
                                      // Find the matching station from our full stationList
                                      let fullStationDevices: Device[] = [];
                                      
                                      if (cellAssignedCodes.length > 0) {
                                        // Match by assigned code (e.g. PC-01)
                                        const matchingStation = stationList.find(
                                          s => cellAssignedCodes.includes(s.assigned_code)
                                        );
                                        if (matchingStation) {
                                          fullStationDevices = matchingStation.devices;
                                        }
                                      }
                                      
                                      // Fallback if no matching station found, or if we want to show 
                                      // exactly what's in the seatingGrid but mapped to full details
                                      if (fullStationDevices.length === 0) {
                                         // Create basic representation if full details aren't in stationList
                                         fullStationDevices = devices.map((d, localIdx) => ({
                                          // Prefer real DB id if present; fallback ids are negative to avoid "select all" collisions.
                                          device_id: (d.device_id ?? d.id ?? -((ri + 1) * 1000000 + (ci + 1) * 1000 + (localIdx + 1))),
                                          type_name: d.type,
                                          brand: d.brand || "Unknown",
                                          model: d.model || "",
                                          specification: d.specification || "",
                                          asset_id: d.assignedCode || d.type,
                                        }));
                                      }

                                      setSelectedComponentType({
                                        type_name: cell.stationTypeLabel + " (" + (cellAssignedCodes[0] || "Station") + ")",
                                        count: fullStationDevices.length,
                                        devices: fullStationDevices
                                      });
                                    }
                                  }}
                                  className={`w-28 rounded-lg border-2 flex flex-col items-center justify-center p-2 transition-all ${
                                    !isStation
                                      ? "bg-neutral-800 border-gray-700 h-24"
                                      : hasDevices
                                        ? "ring-2 ring-green-500/50 cursor-pointer hover:ring-green-400 hover:scale-105"
                                        : "opacity-50"
                                  }`}
                                  style={
                                    isStation
                                      ? {
                                          backgroundColor: hasDevices
                                            ? cell.color + "50"
                                            : cell.color + "20",
                                          borderColor: hasDevices
                                            ? "#22c55e"
                                            : cell.color,
                                          minHeight: hasDevices
                                            ? `${Math.max(96, 48 + devices.length * 18)}px`
                                            : "96px",
                                        }
                                      : undefined
                                  }
                                  title={
                                    isStation && hasDevices
                                      ? "Click to view devices\n\n" + devices
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
                                              className="text-green-300 text-[10px] font-semibold leading-tight truncate"
                                            >
                                              {d.assignedCode || d.type}
                                            </div>
                                          ))}
                                          <p className="text-[8px] text-cyan-400 mt-1 opacity-80">Click to view</p>
                                        </div>
                                      ) : (
                                        <div className="text-gray-400 text-[10px] text-center leading-tight mt-0.5">
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
                          className="flex items-center gap-1.5 bg-neutral-900 px-3 py-1.5 rounded-full text-sm"
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
                    <p className="text-gray-400 text-sm mt-1">
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
                              <p className="text-sm text-gray-400 mt-0.5">
                                Total Units: {component.count}
                              </p>
                            </div>
                            <span className="text-3xl">
                              {getComponentEmoji(component.type_name)}
                            </span>
                          </div>
                          <p className="text-xs text-cyan-400 mt-3">
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
                {selectedDeviceIds.length > 0 && (
                  <button
                    onClick={handleScrapDevices}
                    disabled={scrapping}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition text-white text-sm font-semibold flex items-center gap-2"
                  >
                    🗑️ {scrapping ? "Scrapping..." : `Scrap Selected (${selectedDeviceIds.length})`}
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedComponentType(null);
                    setSelectedDeviceIds([]);
                  }}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition text-white text-sm"
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
                          {getComponentEmoji(selectedComponentType.type_name.split(' (')[0])}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-gray-400 text-xs">Model</p>
                          <p className="text-white font-semibold">{device.model}</p>
                        </div>
                        {device.specification && (
                          <div>
                            <p className="text-gray-400 text-xs">Specification</p>
                            <p className="text-white text-xs leading-snug">
                              {device.specification}
                            </p>
                          </div>
                        )}
                        <div className="border-t border-neutral-700 pt-2 mt-2">
                          <p className="text-gray-400 text-xs">Asset Code</p>
                          <p className="text-blue-400 font-mono text-sm">{device.asset_id}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Scrap Register Modal */}
      {showScrapRegister && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-5xl bg-neutral-900 border border-neutral-700 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
              <div>
                <h2 className="text-xl font-bold text-white">Scrap Register</h2>
                <p className="text-xs text-gray-400 mt-0.5">All scrapped equipment/components and their details</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchScrapRegister}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition text-white text-sm"
                  disabled={scrapRegisterLoading}
                >
                  ⟳ Refresh
                </button>
                <button
                  onClick={() => setShowScrapRegister(false)}
                  className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition text-white text-sm"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[70vh] overflow-auto">
              {scrapRegisterLoading && <p className="text-gray-400">Loading…</p>}
              {scrapRegisterError && <p className="text-red-400">{scrapRegisterError}</p>}
              {!scrapRegisterLoading && !scrapRegisterError && scrapRegisterItems.length === 0 && (
                <p className="text-gray-400">No scrapped items found.</p>
              )}

              {!scrapRegisterLoading && !scrapRegisterError && scrapRegisterItems.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-gray-300">
                      <tr className="border-b border-neutral-800">
                        <th className="text-left py-2 pr-3">Scrapped At</th>
                        <th className="text-left py-2 pr-3">Asset Code</th>
                        <th className="text-left py-2 pr-3">Type</th>
                        <th className="text-left py-2 pr-3">Brand</th>
                        <th className="text-left py-2 pr-3">Model</th>
                        <th className="text-left py-2 pr-3">Specification</th>
                        <th className="text-left py-2 pr-3">Lab</th>
                        <th className="text-left py-2 pr-3">Station</th>
                        <th className="text-left py-2 pr-3">Scrapped By</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-200">
                      {scrapRegisterItems.map((it, i) => (
                        <tr key={it.scrap_id ?? i} className="border-b border-neutral-800/70">
                          <td className="py-2 pr-3 whitespace-nowrap">{it.scrapped_at ?? "-"}</td>
                          <td className="py-2 pr-3 font-mono text-blue-300">{it.asset_code ?? "-"}</td>
                          <td className="py-2 pr-3">{it.device_type ?? "-"}</td>
                          <td className="py-2 pr-3">{it.brand ?? "-"}</td>
                          <td className="py-2 pr-3">{it.model ?? "-"}</td>
                          <td className="py-2 pr-3 text-xs text-gray-300">{it.specification ?? "-"}</td>
                          <td className="py-2 pr-3">{it.lab_id ?? "-"}</td>
                          <td className="py-2 pr-3">{it.station_code ?? "-"}</td>
                          <td className="py-2 pr-3">{it.scrapped_by ?? "-"}</td>
                        </tr>
                      ))}
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