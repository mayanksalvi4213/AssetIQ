"use client";
import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LogoButton } from "@/components/ui/logo-button";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ────────────────────────────────────────────────────────────
interface Equipment {
  type: string;
  quantity: number;
  brand?: string;
  model?: string;
  specification?: string;
  unitPrice?: number;
  purchaseDate?: string;
  invoiceNumber?: string;
  billId?: number;
}

interface LabSummary {
  lab_id: string;
  lab_name: string;
  rows: number;
  columns: number;
  station_count: number;
  layout_id: number | null;
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

// ── Equipment types matching database ────────────────────────────────
const EQUIPMENT_TYPES = [
  { id: 1, name: "Laptop" },
  { id: 2, name: "PC" },
  { id: 3, name: "AC" },
  { id: 4, name: "Smart Board" },
  { id: 5, name: "Projector" },
  { id: 6, name: "Printer" },
  { id: 7, name: "Scanner" },
  { id: 8, name: "UPS" },
  { id: 9, name: "Router" },
  { id: 10, name: "Switch" },
  { id: 11, name: "Server" },
  { id: 12, name: "Monitor" },
  { id: 13, name: "Keyboard" },
  { id: 14, name: "Mouse" },
  { id: 15, name: "Webcam" },
  { id: 16, name: "Headset" },
  { id: 17, name: "Other" },
];

// ── Component ────────────────────────────────────────────────────────
export default function LabConfiguration() {
  const { logout } = useAuth();
  const [active, setActive] = useState<string | null>(null);

  // Lab selection
  const [labs, setLabs] = useState<LabSummary[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [labName, setLabName] = useState("");

  // Layout preview (read-only from blueprint)
  const [layoutGrid, setLayoutGrid] = useState<LayoutCell[][] | null>(null);
  const [layoutRows, setLayoutRows] = useState(0);
  const [layoutCols, setLayoutCols] = useState(0);

  // Seating arrangement (assigned devices per cell from get_lab)
  const [seatingGrid, setSeatingGrid] = useState<any[][] | null>(null);

  // Equipment
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentDropdown, setEquipmentDropdown] = useState("");
  const [rawSearchResults, setRawSearchResults] = useState<Equipment[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<number, number>>({});

  // Derive displayed search results reactively from raw API results minus current equipment
  const searchResults = useMemo(() => {
    return rawSearchResults
      .map((d) => {
        const existing = equipment.find(
          (eq) =>
            eq.type === d.type &&
            eq.brand === d.brand &&
            eq.model === d.model &&
            eq.billId === d.billId &&
            eq.invoiceNumber === d.invoiceNumber
        );
        return existing ? { ...d, quantity: d.quantity - existing.quantity } : d;
      })
      .filter((d) => d.quantity > 0);
  }, [rawSearchResults, equipment]);

  // Device linking
  const [linkedDeviceGroups, setLinkedDeviceGroups] = useState<Equipment[][]>([]);
  const [currentLinkingGroup, setCurrentLinkingGroup] = useState<Equipment[]>([]);
  const [showLinkingModal, setShowLinkingModal] = useState(false);

  // Code prefixes (keyed by device type name)
  const [codePrefixes, setCodePrefixes] = useState<Record<string, string>>({});

  // OS selection per device type (for PC type)
  const [osSelection, setOsSelection] = useState<Record<string, { windows: boolean; linux: boolean; other: boolean }>>({});

  // Compute which device types still have unassigned units
  const unassignedTypes = useMemo(() => {
    if (!seatingGrid || equipment.length === 0) return new Set(equipment.map((eq) => eq.type));
    // Count how many devices of each type are already assigned in the grid
    const assignedCounts: Record<string, number> = {};
    for (const row of seatingGrid) {
      for (const cell of row) {
        const devices = cell?.deviceGroup?.devices || [];
        for (const d of devices) {
          if (d.type) assignedCounts[d.type] = (assignedCounts[d.type] || 0) + 1;
        }
      }
    }
    // Total quantities per type from equipment pool
    const totalByType: Record<string, number> = {};
    for (const eq of equipment) {
      totalByType[eq.type] = (totalByType[eq.type] || 0) + eq.quantity;
    }
    const result = new Set<string>();
    for (const dt of Object.keys(totalByType)) {
      if ((assignedCounts[dt] || 0) < totalByType[dt]) result.add(dt);
    }
    return result;
  }, [seatingGrid, equipment]);

  // Assignment
  const [isAssigning, setIsAssigning] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Auth ─────────────────────────────────────────────────────────
  const authHeaders = (): HeadersInit => {
    const h: HeadersInit = { "Content-Type": "application/json" };
    const token = localStorage.getItem("token");
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  };

  // ── Fetch labs ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("http://127.0.0.1:5000/get_labs_for_layout", { headers: authHeaders() });
        const data = await res.json();
        if (data.success) setLabs(data.labs);
      } catch (err) {
        console.error("Error fetching labs:", err);
      }
    })();
  }, []);

  // ── Load lab ─────────────────────────────────────────────────────
  const loadLab = async (labId: string) => {
    setSelectedLabId(labId);
    setEquipment([]);
    setLinkedDeviceGroups([]);
    setCodePrefixes({});
    setOsSelection({});
    setSeatingGrid(null);
    setRawSearchResults([]);

    // Fetch layout blueprint
    try {
      const res = await fetch(`http://127.0.0.1:5000/get_lab_layout/${labId}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.layout) {
        const l = data.layout;
        setLabName(l.labName);
        setLayoutRows(l.rows);
        setLayoutCols(l.columns);
        setLayoutGrid(l.grid);
      }
    } catch (err) {
      console.error("Error loading layout:", err);
    }

    // Fetch existing equipment pool + reconstruct linked groups + prefixes
    try {
      const res = await fetch(`http://127.0.0.1:5000/get_lab/${labId}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.lab) {
        const labData = data.lab;
        setEquipment(labData.equipment || []);

        // Store seating arrangement grid (has assigned device data)
        if (labData.seatingArrangement?.grid) {
          setSeatingGrid(labData.seatingArrangement.grid);
        }

        // Reconstruct linked groups from grid
        const groups: Equipment[][] = [];
        if (labData.seatingArrangement?.grid) {
          for (const row of labData.seatingArrangement.grid) {
            for (const cell of row) {
              if (cell.deviceGroup?.devices?.length > 1) {
                const groupKey = cell.deviceGroup.devices
                  .map((d: any) => `${d.type}-${d.brand}-${d.model}-${d.billId}`)
                  .sort()
                  .join("|");
                const exists = groups.some((g) => {
                  const k = g
                    .map((d) => `${d.type}-${d.brand}-${d.model}-${d.billId}`)
                    .sort()
                    .join("|");
                  return k === groupKey;
                });
                if (!exists) {
                  groups.push(
                    cell.deviceGroup.devices.map((dev: any) => ({
                      type: dev.type,
                      brand: dev.brand,
                      model: dev.model,
                      billId: dev.billId,
                      invoiceNumber: dev.invoiceNumber,
                      quantity: 1,
                    }))
                  );
                }
              }
            }
          }
        }
        setLinkedDeviceGroups(groups);

        // Extract prefixes
        const prefixes: Record<string, string> = {};
        if (labData.seatingArrangement?.grid) {
          for (const row of labData.seatingArrangement.grid) {
            for (const cell of row) {
              if (cell.deviceGroup?.assignedCode && cell.deviceGroup?.devices) {
                const parts = cell.deviceGroup.assignedCode.split("/");
                if (parts.length > 1) {
                  parts.pop();
                  const prefix = parts.join("/");
                  const devices = cell.deviceGroup.devices;
                  if (devices.length > 1) {
                    const gi = groups.findIndex((g) => {
                      const gt = g.map((d) => d.type).sort().join(",");
                      const ct = devices.map((d: any) => d.type).sort().join(",");
                      return gt === ct;
                    });
                    if (gi !== -1 && !prefixes[`linked_group_${gi}`]) {
                      prefixes[`linked_group_${gi}`] = prefix;
                    }
                  } else if (!prefixes[devices[0].type]) {
                    prefixes[devices[0].type] = prefix;
                  }
                }
              }
            }
          }
        }
        setCodePrefixes(prefixes);

        // Extract OS selections from grid cells
        const osMap: Record<string, { windows: boolean; linux: boolean; other: boolean }> = {};
        if (labData.seatingArrangement?.grid) {
          for (const row of labData.seatingArrangement.grid) {
            for (const cell of row) {
              const eqType = cell.equipmentType;
              if (eqType && cell.os?.length > 0) {
                if (!osMap[eqType]) osMap[eqType] = { windows: false, linux: false, other: false };
                for (const o of cell.os) {
                  if (o === "Windows") osMap[eqType].windows = true;
                  if (o === "Linux") osMap[eqType].linux = true;
                  if (o === "Other") osMap[eqType].other = true;
                }
              }
            }
          }
        }
        setOsSelection(osMap);
      }
    } catch (err) {
      console.error("Error loading lab equipment:", err);
    }


  };

  // ── Reset ────────────────────────────────────────────────────────
  const resetForm = () => {
    setSelectedLabId(null);
    setLabName("");
    setLayoutGrid(null);
    setLayoutRows(0);
    setLayoutCols(0);
    setEquipment([]);
    setCodePrefixes({});
    setOsSelection({});
    setSeatingGrid(null);
    setLinkedDeviceGroups([]);
    setRawSearchResults([]);
    setEquipmentDropdown("");
    setSelectedQuantities({});
  };

  // ── Reset Assignments (backend) ──────────────────────────────────
  const resetAssignments = async () => {
    if (!selectedLabId) return;
    if (!confirm("This will clear ALL device assignments from this lab. The devices will go back to unassigned. Continue?"))
      return;
    setIsResetting(true);
    try {
      const res = await fetch(`http://127.0.0.1:5000/reset_lab_assignments/${selectedLabId}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${data.message}`);
        loadLab(selectedLabId);
      } else {
        alert(data.error || "Failed to reset assignments");
      }
    } catch (err) {
      console.error(err);
      alert("Error resetting assignments");
    } finally {
      setIsResetting(false);
    }
  };

  // ── Save Configuration ───────────────────────────────────────────
  const saveConfiguration = async () => {
    if (!selectedLabId) {
      alert("Select a lab first");
      return;
    }
    if (equipment.length === 0) {
      alert("Add equipment first");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/save_lab_config", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          labNumber: selectedLabId,
          equipment,
          codePrefixes,
          linkedDeviceGroups,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${data.message}`);
      } else {
        alert(data.error || "Failed to save configuration");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving configuration");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Equipment search ─────────────────────────────────────────────

  const addEquipmentFromSearch = (item: Equipment, idx: number) => {
    const qty = selectedQuantities[idx] || 1;
    if (qty > item.quantity) {
      alert(`Max ${item.quantity} available`);
      return;
    }
    const existingIdx = equipment.findIndex(
      (eq) =>
        eq.type === item.type &&
        eq.brand === item.brand &&
        eq.model === item.model &&
        eq.billId === item.billId &&
        eq.invoiceNumber === item.invoiceNumber
    );
    if (existingIdx !== -1) {
      setEquipment((prev) =>
        prev.map((eq, i) => (i === existingIdx ? { ...eq, quantity: eq.quantity + qty } : eq))
      );
    } else {
      setEquipment((prev) => [...prev, { ...item, quantity: qty }]);
    }
    // searchResults is derived via useMemo — no manual update needed
    setSelectedQuantities((prev) => ({ ...prev, [idx]: 1 }));
  };

  // ── Device linking ───────────────────────────────────────────────
  const addToLinkingGroup = (device: Equipment) => {
    if (
      currentLinkingGroup.some(
        (d) =>
          d.type === device.type &&
          d.brand === device.brand &&
          d.model === device.model &&
          d.billId === device.billId
      )
    ) {
      alert("Already in group");
      return;
    }
    setCurrentLinkingGroup((prev) => [...prev, device]);
  };

  const saveLinkingGroup = () => {
    if (currentLinkingGroup.length < 2) {
      alert("Link at least 2 devices");
      return;
    }
    setLinkedDeviceGroups((prev) => [...prev, currentLinkingGroup]);
    setCurrentLinkingGroup([]);
    setShowLinkingModal(false);
  };

  // ── Auto-assign devices ──────────────────────────────────────────
  const assignDevices = async () => {
    if (!selectedLabId) {
      alert("Select a lab first");
      return;
    }
    if (equipment.length === 0) {
      alert("Add equipment first");
      return;
    }
    if (!confirm("This will (re-)assign all devices horizontally based on the layout blueprint. Continue?"))
      return;

    setIsAssigning(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/auto_assign_devices", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          labNumber: selectedLabId,
          equipment,
          codePrefixes,
          linkedDeviceGroups,
          osSelection,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(
          `✅ ${data.message}\n${data.devices_assigned} devices assigned across ${data.stations_created} stations`
        );
        loadLab(selectedLabId);
      } else {
        alert(data.error || "Failed to assign devices");
      }
    } catch (err) {
      console.error(err);
      alert("Error assigning devices");
    } finally {
      setIsAssigning(false);
    }
  };

  // ── Layout stats ─────────────────────────────────────────────────
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

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-neutral-950"
      style={{
        backgroundImage: "url(/bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Navbar */}
      <div className="fixed top-2 inset-x-0 max-w-6xl mx-auto z-50 flex items-center justify-center px-4 py-2">
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
              <HoveredLink href="/dashboard/documents">Documents</HoveredLink>
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

      {/* Page Content */}
      <div className="flex items-start justify-center pt-24 px-4 pb-12">
        <BackgroundGradient className="w-full max-w-7xl p-8 rounded-xl shadow-xl">
          <LogoButton />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-3xl font-bold text-center mb-6 text-white">Lab Configuration</h1>

            {/* ── Select Lab ──────────────────────────────────────── */}
            <div className="mb-6">
              <Label className="text-white">Select Lab</Label>
              <div className="flex gap-3 mt-2">
                <select
                  value={selectedLabId ?? ""}
                  onChange={(e) => {
                    if (e.target.value) loadLab(e.target.value);
                    else resetForm();
                  }}
                  className="flex-1 bg-neutral-800 text-white p-2 rounded-lg border border-gray-600"
                >
                  <option value="">-- Select Lab --</option>
                  {labs.map((l) => (
                    <option key={l.lab_id} value={l.lab_id}>
                      {l.lab_id} - {l.lab_name} ({l.rows}×{l.columns})
                      {l.layout_id ? ` — ${l.station_count} stations` : " — No layout yet"}
                    </option>
                  ))}
                </select>
                {selectedLabId && (
                  <div className="flex gap-2">
                    <button
                      onClick={resetAssignments}
                      disabled={isResetting}
                      className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg transition text-sm disabled:opacity-50"
                    >
                      {isResetting ? "Resetting…" : "Reset Assignments"}
                    </button>
                    <button
                      onClick={resetForm}
                      className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition text-sm"
                    >
                      Deselect Lab
                    </button>
                  </div>
                )}
              </div>
            </div>

            {selectedLabId && (
              <>
                {/* ── No Layout Warning ────────────────────────────── */}
                {!layoutGrid && (
                  <div className="mb-6 bg-yellow-900/30 border border-yellow-600 p-4 rounded-lg text-center">
                    <p className="text-yellow-300 font-semibold mb-2">
                      ⚠️ This lab has no layout designed yet
                    </p>
                    <p className="text-gray-400 text-sm mb-3">
                      You need to design a layout in the Lab Layout Designer first before you can
                      auto-assign devices.
                    </p>
                    <a
                      href="/lab-layout"
                      className="inline-block px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition text-sm"
                    >
                      Go to Lab Layout Designer →
                    </a>
                  </div>
                )}

                {/* ── Layout Blueprint Preview ─────────────────────── */}
                {layoutGrid && (
                  <div className="mb-6 bg-neutral-900 p-4 rounded-lg">
                    <h3 className="text-white font-semibold mb-2">
                      Layout Blueprint — {labName} ({layoutRows}×{layoutCols})
                    </h3>
                    <p className="text-gray-400 text-xs mb-3">
                      Read-only preview. To modify, go to{" "}
                      <a href="/lab-layout" className="text-cyan-400 hover:underline">
                        Lab Layout Designer
                      </a>
                      . Devices will be assigned horizontally (row by row, left to right) to matching
                      station types.
                    </p>
                    <div className="overflow-x-auto">
                      <div className="flex flex-col items-center">
                        {layoutGrid.map((row, ri) => (
                          <div key={ri} className="flex gap-1.5 mb-1.5">
                            {row.map((cell, ci) => {
                              const isStation = cell.stationTypeId !== null;
                              // Look up assigned device data from seating grid
                              const seat = seatingGrid?.[ri]?.[ci];
                              const deviceGroup = seat?.deviceGroup;
                              const devices = deviceGroup?.devices || [];
                              const hasDevices = devices.length > 0;
                              return (
                                <div
                                  key={ci}
                                  className={`w-28 rounded-lg border-2 flex flex-col items-center justify-center p-2 ${
                                    !isStation
                                      ? "bg-neutral-800 border-gray-700 h-24"
                                      : hasDevices
                                        ? "ring-2 ring-green-500/50"
                                        : ""
                                  }`}
                                  style={
                                    isStation
                                      ? {
                                          backgroundColor: hasDevices
                                            ? cell.color + "50"
                                            : cell.color + "20",
                                          borderColor: hasDevices ? "#22c55e" : cell.color,
                                          minHeight: hasDevices ? `${Math.max(96, 48 + devices.length * 18)}px` : "96px",
                                        }
                                      : undefined
                                  }
                                  title={
                                    isStation && hasDevices
                                      ? devices
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
                                      <span className="text-lg leading-none mb-0.5">{cell.icon}</span>
                                      {hasDevices ? (
                                        <div className="text-center w-full space-y-0.5">
                                          {devices.map((d: any, di: number) => (
                                            <div
                                              key={di}
                                              className="text-green-300 text-[10px] font-semibold leading-tight truncate"
                                              title={d.assignedCode || ""}
                                            >
                                              {d.assignedCode || d.type}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-gray-400 text-[10px] text-center leading-tight">
                                          {cell.stationTypeLabel}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-gray-600 text-xs mt-4">Empty</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Station type summary */}
                    <div className="mt-3 flex flex-wrap gap-3">
                      {Object.entries(getLayoutStats()).map(([label, info]) => (
                        <div
                          key={label}
                          className="flex items-center gap-1.5 bg-neutral-800 px-3 py-1.5 rounded-full text-sm"
                        >
                          <span>{info.icon}</span>
                          <span className="text-gray-300">{label}:</span>
                          <span className="text-white font-bold">{info.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Search Equipment ─────────────────────────────── */}
                <div className="mb-6 space-y-2">
                  <Label className="text-white">Search Equipment from Inventory</Label>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Label className="text-gray-300 text-sm mb-1">Equipment Type</Label>
                      <select
                        value={equipmentDropdown}
                        onChange={(e) => {
                          setEquipmentDropdown(e.target.value);
                          if (e.target.value) {
                            setIsSearching(true);
                            fetch(`http://127.0.0.1:5000/search_devices?type_id=${e.target.value}`, {
                              headers: authHeaders(),
                            })
                              .then((r) => r.json())
                              .then((data) => {
                                const results = data.devices || [];
                                setRawSearchResults(results);
                                const initQ: Record<number, number> = {};
                                results.forEach((_: any, i: number) => { initQ[i] = 1; });
                                setSelectedQuantities(initQ);
                              })
                              .catch((err) => {
                                console.error(err);
                                alert("Error searching devices");
                              })
                              .finally(() => setIsSearching(false));
                          } else {
                            setRawSearchResults([]);
                          }
                        }}
                        className="w-full bg-neutral-800 text-white p-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">-- Select Equipment --</option>
                        {EQUIPMENT_TYPES.map((t) => (
                          <option key={t.id} value={t.id.toString()}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {isSearching && (
                      <span className="text-gray-400 text-sm self-end pb-2">Searching…</span>
                    )}
                  </div>
                </div>

                {/* ── Search Results ───────────────────────────────── */}
                {searchResults.length > 0 && (
                  <div className="mb-6 bg-neutral-800 p-4 rounded-lg">
                    <h3 className="text-white font-semibold mb-3">
                      Available Equipment ({searchResults.length} groups found)
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {searchResults.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-neutral-700 p-3 rounded-lg flex justify-between items-start gap-3"
                        >
                          <div className="flex-1">
                            <div className="text-white font-semibold mb-1">
                              {item.brand} {item.model} ({item.quantity} available)
                            </div>
                            <div className="text-gray-300 text-sm space-y-1">
                              <p>
                                <span className="text-gray-400">Type:</span> {item.type}
                              </p>
                              {item.specification && (
                                <p>
                                  <span className="text-gray-400">Specs:</span> {item.specification}
                                </p>
                              )}
                              {item.unitPrice && (
                                <p>
                                  <span className="text-gray-400">Price:</span> ₹
                                  {item.unitPrice.toLocaleString()}
                                </p>
                              )}
                              {item.invoiceNumber && (
                                <p>
                                  <span className="text-gray-400">Invoice:</span> {item.invoiceNumber}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <div className="flex items-center gap-2">
                              <label className="text-gray-300 text-sm">Qty:</label>
                              <Input
                                type="number"
                                min="1"
                                max={item.quantity}
                                value={Math.min(selectedQuantities[idx] || 1, item.quantity)}
                                onChange={(e) =>
                                  setSelectedQuantities((prev) => ({
                                    ...prev,
                                    [idx]: Math.min(
                                      Math.max(1, parseInt(e.target.value) || 1),
                                      item.quantity
                                    ),
                                  }))
                                }
                                className="w-20 bg-neutral-600 text-white text-center"
                              />
                            </div>
                            <button
                              onClick={() => addEquipmentFromSearch(item, idx)}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition whitespace-nowrap"
                            >
                              Add to Lab
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {searchResults.length === 0 && rawSearchResults.length > 0 && !isSearching && (
                  <div className="mb-6 bg-neutral-800 p-4 rounded-lg">
                    <p className="text-gray-400 text-center">
                      All available equipment of this type has been added to the lab
                    </p>
                  </div>
                )}

                {searchResults.length === 0 && rawSearchResults.length === 0 && equipmentDropdown && !isSearching && (
                  <div className="mb-6 bg-neutral-800 p-4 rounded-lg">
                    <p className="text-gray-400 text-center">
                      No unassigned equipment found for the selected type
                    </p>
                  </div>
                )}

                {/* ── Equipment List ───────────────────────────────── */}
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-white mb-2">Lab Equipment</h2>
                  {equipment.length === 0 ? (
                    <p className="text-gray-400">
                      No equipment added yet. Search and add from inventory above.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {equipment.map((eq, idx) => (
                        <li key={idx} className="bg-neutral-800 text-white px-4 py-3 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-semibold mb-1">
                                {eq.brand} {eq.model} - {eq.type} × {eq.quantity}
                              </div>
                              {eq.specification && (
                                <div className="text-gray-400 text-sm">{eq.specification}</div>
                              )}
                              {eq.invoiceNumber && (
                                <div className="text-gray-400 text-sm">Invoice: {eq.invoiceNumber}</div>
                              )}
                            </div>
                            <button
                              onClick={() => setEquipment((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-red-400 hover:text-red-600 ml-3"
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* ── Device Linking ───────────────────────────────── */}
                <div className="mb-6 bg-neutral-800 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-white font-semibold">Device Linking</h3>
                    <button
                      onClick={() => setShowLinkingModal(true)}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition"
                    >
                      + Create Link
                    </button>
                  </div>
                  <p className="text-gray-400 text-xs mb-3">
                    Link devices from different invoices to assign them together at each station. E.g.,
                    link PC + Monitor + Keyboard + Mouse so they go to the same station.
                  </p>
                  {linkedDeviceGroups.length === 0 ? (
                    <p className="text-gray-400 text-sm">No device groups linked yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {linkedDeviceGroups.map((group, gi) => (
                        <div
                          key={gi}
                          className="bg-neutral-700 p-2 rounded flex justify-between items-start"
                        >
                          <div>
                            <div className="text-white font-semibold text-sm">Group {gi + 1}</div>
                            <div className="text-gray-300 text-xs">
                              {group.map((d, i) => (
                                <div key={i}>
                                  • {d.type}: {d.brand} {d.model}
                                </div>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              setLinkedDeviceGroups((prev) => prev.filter((_, i) => i !== gi))
                            }
                            className="text-red-400 hover:text-red-600 text-xs ml-2"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Code Prefixes (per device type) ─────────────── */}
                <div className="mb-6 bg-neutral-800 p-4 rounded-lg">
                  <h3 className="text-white font-semibold mb-3">Device Code Prefixes</h3>
                  <p className="text-gray-400 text-xs mb-3">
                    Each device type gets its own unique code: prefix/number. Numbers are persistent
                    and never reset — even after scrapping devices.
                  </p>

                  {Array.from(new Set(equipment.map((eq) => eq.type)))
                    .filter((dt) => unassignedTypes.has(dt))
                    .map((dt) => {
                    const preview = codePrefixes[dt] || `[${dt}]`;
                    const os = osSelection[dt] || { windows: false, linux: false, other: false };
                    return (
                      <div key={dt} className="bg-neutral-700 p-3 rounded-lg mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-white text-sm font-semibold">{dt}</Label>
                        </div>
                        <Input
                          value={codePrefixes[dt] || ""}
                          onChange={(e) =>
                            setCodePrefixes((prev) => ({ ...prev, [dt]: e.target.value }))
                          }
                          placeholder={`e.g., apsit/it/${selectedLabId}/${dt.toLowerCase()}`}
                          className="bg-neutral-600 text-white mt-1"
                        />
                        <p className="text-gray-400 text-xs mt-1">
                          Preview: {preview}/1, {preview}/2, …
                        </p>
                        {(dt === "PC" || dt === "Laptop") && (
                          <div className="mt-2 flex items-center gap-4">
                            <span className="text-gray-300 text-sm">OS:</span>
                            {(["windows", "linux", "other"] as const).map((osKey) => (
                              <label key={osKey} className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={os[osKey]}
                                  onChange={(e) =>
                                    setOsSelection((prev) => ({
                                      ...prev,
                                      [dt]: { ...prev[dt], windows: prev[dt]?.windows || false, linux: prev[dt]?.linux || false, other: prev[dt]?.other || false, [osKey]: e.target.checked },
                                    }))
                                  }
                                  className="w-4 h-4 rounded border-gray-500 bg-neutral-600 accent-cyan-500"
                                />
                                <span className="text-gray-300 text-sm capitalize">{osKey}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {equipment.length === 0 && (
                    <p className="text-gray-400 text-sm">
                      Add equipment first to configure prefixes.
                    </p>
                  )}
                  {equipment.length > 0 && unassignedTypes.size === 0 && (
                    <p className="text-green-400 text-sm">
                      All devices have been assigned.
                    </p>
                  )}
                </div>

                {/* ── Action Buttons ────────────────────────────── */}
                <div className="flex justify-center gap-4">
                  <HoverBorderGradient onClick={saveConfiguration}>
                    {isSaving ? "Saving…" : "💾 Save Configuration"}
                  </HoverBorderGradient>
                  <HoverBorderGradient onClick={assignDevices}>
                    {isAssigning ? "Assigning…" : "⚡ Auto-Assign Devices"}
                  </HoverBorderGradient>
                </div>
              </>
            )}
          </motion.div>
        </BackgroundGradient>
      </div>

      {/* ── Device Linking Modal ──────────────────────────────────── */}
      {showLinkingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">Link Devices Together</h2>
            <p className="text-gray-400 text-sm mb-4">
              Select devices to link. When assigned, they will share the same station code.
            </p>

            <div className="mb-4 bg-neutral-800 p-4 rounded-lg">
              <h3 className="text-white font-semibold mb-2">
                Linking Group ({currentLinkingGroup.length} devices)
              </h3>
              {currentLinkingGroup.length === 0 ? (
                <p className="text-gray-400 text-sm">Select devices below.</p>
              ) : (
                <ul className="space-y-2">
                  {currentLinkingGroup.map((d, i) => (
                    <li
                      key={i}
                      className="bg-neutral-700 p-2 rounded flex justify-between items-center"
                    >
                      <span className="text-white text-sm">
                        {d.type}: {d.brand} {d.model}
                      </span>
                      <button
                        onClick={() =>
                          setCurrentLinkingGroup((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mb-4">
              <h3 className="text-white font-semibold mb-2">Available Devices</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto bg-neutral-800 p-3 rounded-lg">
                {equipment.length === 0 ? (
                  <p className="text-gray-400 text-sm">No devices available.</p>
                ) : (
                  equipment.map((d, i) => (
                    <div
                      key={i}
                      className="bg-neutral-700 p-3 rounded flex justify-between items-start"
                    >
                      <div>
                        <div className="text-white font-semibold">
                          {d.brand} {d.model}
                        </div>
                        <div className="text-gray-300 text-sm">
                          {d.type} - {d.quantity} units
                        </div>
                      </div>
                      <button
                        onClick={() => addToLinkingGroup(d)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                      >
                        Add
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowLinkingModal(false);
                  setCurrentLinkingGroup([]);
                }}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded transition"
              >
                Cancel
              </button>
              <button
                onClick={saveLinkingGroup}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition"
              >
                Save Link Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
