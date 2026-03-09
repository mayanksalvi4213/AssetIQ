"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LogoButton } from "@/components/ui/logo-button";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ────────────────────────────────────────────────────────────
interface StationType {
  station_type_id: number;
  name: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  allowed_device_types: string[];
}

interface LayoutCell {
  cellId: number | null;
  stationTypeId: number | null;
  stationTypeName: string;
  stationTypeLabel: string;
  icon: string;
  color: string;
  stationLabel: string | null;
  os: string[];
  notes: string | null;
}

interface LabSummary {
  lab_id: string;
  lab_name: string;
  rows: number;
  columns: number;
  station_count: number;
}

// ── Helpers ──────────────────────────────────────────────────────────
const emptyCell = (): LayoutCell => ({
  cellId: null,
  stationTypeId: null,
  stationTypeName: "empty",
  stationTypeLabel: "Empty",
  icon: "⬜",
  color: "#6b7280",
  stationLabel: null,
  os: [],
  notes: null,
});

const buildEmptyGrid = (rows: number, cols: number): LayoutCell[][] =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, emptyCell));

// ── Component ────────────────────────────────────────────────────────
export default function LabLayout() {
  const { logout } = useAuth();
  const [active, setActive] = useState<string | null>(null);

  // Saved labs
  const [labs, setLabs] = useState<LabSummary[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);

  // Station types from backend
  const [stationTypes, setStationTypes] = useState<StationType[]>([]);
  const [selectedStationType, setSelectedStationType] = useState<StationType | null>(null);

  // Current lab being edited
  const [labNumber, setLabNumber] = useState("");
  const [labName, setLabName] = useState("");
  const [rows, setRows] = useState(6);
  const [columns, setColumns] = useState(6);
  const [grid, setGrid] = useState<LayoutCell[][]>(buildEmptyGrid(6, 6));

  // Drag-select state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ row: number; col: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ row: number; col: number } | null>(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // (Auto-numbering is handled by renumberGrid — no counters needed)

  // ── Auth helpers ─────────────────────────────────────────────────
  const authHeaders = (): HeadersInit => {
    const h: HeadersInit = { "Content-Type": "application/json" };
    const token = localStorage.getItem("token");
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  };

  // ── Fetch station types ──────────────────────────────────────────
  const fetchStationTypes = useCallback(async () => {
    try {
      const res = await fetch("http://127.0.0.1:5000/get_station_types", { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setStationTypes(data.stationTypes);
    } catch (err) {
      console.error("Error fetching station types:", err);
    }
  }, []);

  // ── Fetch existing labs ──────────────────────────────────────────
  const fetchLabs = useCallback(async () => {
    try {
      const res = await fetch("http://127.0.0.1:5000/get_labs_for_layout", { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setLabs(data.labs);
    } catch (err) {
      console.error("Error fetching labs:", err);
    }
  }, []);

  useEffect(() => {
    fetchStationTypes();
    fetchLabs();
  }, [fetchStationTypes, fetchLabs]);

  // ── Load lab layout ──────────────────────────────────────────────
  const loadLabLayout = async (labId: string) => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/get_lab_layout/${labId}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.layout) {
        const l = data.layout;
        setSelectedLabId(l.labId);
        setLabNumber(l.labId);
        setLabName(l.labName);
        setRows(l.rows);
        setColumns(l.columns);
        setGrid(l.grid);
      }
    } catch (err) {
      console.error("Error loading lab layout:", err);
      alert("Error loading lab layout");
    }
  };

  // ── Save lab layout ──────────────────────────────────────────────
  const saveLabLayout = async () => {
    if (!labNumber.trim()) { alert("Please enter a lab number"); return; }
    if (!labName.trim()) { alert("Please enter a lab name"); return; }
    setIsSaving(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/save_lab_layout", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ labNumber, labName, rows, columns, grid }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${data.message} (${data.stationCount} stations)`);
        setSelectedLabId(data.labId);
        fetchLabs();
      } else {
        alert(data.error || "Failed to save layout");
      }
    } catch (err) {
      console.error("Error saving layout:", err);
      alert("Error saving layout");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete layout ────────────────────────────────────────────────
  const deleteLabLayout = async (labId: string) => {
    if (!confirm("Clear the layout for this lab? (The lab itself will not be deleted)")) return;
    try {
      const res = await fetch(`http://127.0.0.1:5000/delete_lab_layout/${labId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        alert("Layout cleared");
        if (selectedLabId === labId) resetForm();
        fetchLabs();
      } else {
        alert(data.error || "Failed to clear layout");
      }
    } catch (err) {
      console.error(err);
      alert("Error clearing layout");
    }
  };

  // ── Reset form ───────────────────────────────────────────────────
  const resetForm = () => {
    setSelectedLabId(null);
    setLabNumber("");
    setLabName("");
    setRows(6);
    setColumns(6);
    setGrid(buildEmptyGrid(6, 6));
    setSelectedStationType(null);
  };

  // ── Grid size change ─────────────────────────────────────────────
  const updateGridSize = (newRows: number, newCols: number) => {
    const newGrid: LayoutCell[][] = Array.from({ length: newRows }, (_, r) =>
      Array.from({ length: newCols }, (_, c) => {
        if (r < rows && c < columns) return grid[r][c];
        return emptyCell();
      })
    );
    setRows(newRows);
    setColumns(newCols);
    setGrid(newGrid);
  };

  // ── Place station at cell ────────────────────────────────────────
  const placeStation = (rowIdx: number, colIdx: number) => {
    if (!selectedStationType) return;
    const st = selectedStationType;
    const existing = grid[rowIdx][colIdx];

    // Toggle off: clicking a cell that already has the same station type erases it
    if (existing.stationTypeId === st.station_type_id) {
      const newGrid = grid.map((r) => r.map((c) => ({ ...c })));
      newGrid[rowIdx][colIdx] = emptyCell();
      setGrid(newGrid);
      return;
    }

    const newGrid = grid.map((r) => r.map((c) => ({ ...c })));
    newGrid[rowIdx][colIdx] = {
      cellId: null, stationTypeId: st.station_type_id,
      stationTypeName: st.name, stationTypeLabel: st.label,
      icon: st.icon, color: st.color,
      stationLabel: null,
      os: [],
      notes: null,
    };
    setGrid(newGrid);
  };

  // ── Fill rectangle ───────────────────────────────────────────────
  const fillRectangle = (startRow: number, startCol: number, endRow: number, endCol: number) => {
    if (!selectedStationType) return;
    const minR = Math.min(startRow, endRow);
    const maxR = Math.max(startRow, endRow);
    const minC = Math.min(startCol, endCol);
    const maxC = Math.max(startCol, endCol);
    const newGrid = grid.map((r) => r.map((c) => ({ ...c })));
    const st = selectedStationType;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        newGrid[r][c] = {
          cellId: null, stationTypeId: st.station_type_id,
          stationTypeName: st.name, stationTypeLabel: st.label,
          icon: st.icon, color: st.color,
          stationLabel: null,
          os: [],
          notes: null,
        };
      }
    }
    setGrid(newGrid);
  };

  // ── Mouse handlers ───────────────────────────────────────────────
  const handleMouseDown = (rowIdx: number, colIdx: number) => {
    const cell = grid[rowIdx][colIdx];
    // No brush → click occupied cell to erase
    if (!selectedStationType && cell.stationTypeId !== null) {
      const newGrid = grid.map((r) => r.map((c) => ({ ...c })));
      newGrid[rowIdx][colIdx] = emptyCell();
      setGrid(newGrid);
      return;
    }
    setIsSelecting(true);
    setSelectionStart({ row: rowIdx, col: colIdx });
    setSelectionEnd({ row: rowIdx, col: colIdx });
  };

  const handleMouseEnter = (rowIdx: number, colIdx: number) => {
    if (isSelecting && selectionStart) setSelectionEnd({ row: rowIdx, col: colIdx });
  };

  const handleMouseUp = (rowIdx: number, colIdx: number) => {
    if (!isSelecting || !selectionStart) return;
    setIsSelecting(false);
    if (selectionStart.row === rowIdx && selectionStart.col === colIdx) {
      placeStation(rowIdx, colIdx);
    } else {
      fillRectangle(selectionStart.row, selectionStart.col, rowIdx, colIdx);
    }
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const isInSelectionArea = (r: number, c: number) => {
    if (!selectionStart || !selectionEnd) return false;
    const minR = Math.min(selectionStart.row, selectionEnd.row);
    const maxR = Math.max(selectionStart.row, selectionEnd.row);
    const minC = Math.min(selectionStart.col, selectionEnd.col);
    const maxC = Math.max(selectionStart.col, selectionEnd.col);
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  };

  // ── Toggle OS on a cell ──────────────────────────────────────────
  // (removed — OS tracking no longer used)

  // ── Clear entire grid ────────────────────────────────────────────
  const clearGrid = () => {
    setGrid(buildEmptyGrid(rows, columns));
  };

  // ── Stats ────────────────────────────────────────────────────────
  const getStats = () => {
    const counts: Record<string, number> = {};
    for (const row of grid) {
      for (const cell of row) {
        if (cell.stationTypeId !== null) {
          counts[cell.stationTypeLabel] = (counts[cell.stationTypeLabel] || 0) + 1;
        }
      }
    }
    return counts;
  };
  const totalStations = Object.values(getStats()).reduce((a, b) => a + b, 0);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-neutral-950"
      style={{ backgroundImage: "url(/bg.jpg)", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}
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
              <button onClick={logout} className="text-left text-neutral-600 hover:text-neutral-800 transition-colors">
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
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h1 className="text-3xl font-bold text-center mb-6 text-white">
              {selectedLabId ? "Edit Lab Layout" : "Design New Lab Layout"}
            </h1>

            {/* ── Select Existing Lab ──────────────────────────────── */}
            <div className="mb-6">
              <Label className="text-white">Edit Existing Lab Layout</Label>
              <div className="flex gap-3 mt-2">
                <select
                  value={selectedLabId ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) loadLabLayout(val);
                    else resetForm();
                  }}
                  className="flex-1 bg-neutral-800 text-white p-2 rounded-lg border border-gray-600"
                >
                  <option value="">-- New Lab --</option>
                  {labs.map((l) => (
                    <option key={l.lab_id} value={l.lab_id}>
                      {l.lab_id} - {l.lab_name} ({l.rows}×{l.columns}, {l.station_count} stations)
                    </option>
                  ))}
                </select>
                {selectedLabId && (
                  <button
                    onClick={() => deleteLabLayout(selectedLabId)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm"
                  >
                    🗑️ Clear Layout
                  </button>
                )}
              </div>
            </div>

            {/* ── Lab Number & Name ─────────────────────────────────── */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="labNumber" className="text-white">Lab Number</Label>
                <Input
                  id="labNumber"
                  placeholder="e.g., 309"
                  value={labNumber}
                  onChange={(e) => setLabNumber(e.target.value)}
                  className="mt-2"
                  disabled={!!selectedLabId}
                />
                {selectedLabId && (
                  <p className="text-gray-500 text-xs mt-1">Lab number cannot be changed after creation</p>
                )}
              </div>
              <div>
                <Label htmlFor="labName" className="text-white">Lab Name</Label>
                <Input
                  id="labName"
                  placeholder="e.g., Computer Lab"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            {/* ── Grid Dimensions ────────────────────────────────────── */}
            <div className="mb-6 bg-neutral-800 p-4 rounded-lg">
              <h3 className="text-white font-semibold mb-3">Grid Dimensions</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300 text-sm">Rows</Label>
                  <input
                    type="number" min="1" max="30" value={rows}
                    onChange={(e) => updateGridSize(Math.max(1, Math.min(30, Number(e.target.value))), columns)}
                    className="w-full bg-neutral-700 text-white p-2 rounded-lg mt-1 border border-gray-600"
                  />
                </div>
                <div>
                  <Label className="text-gray-300 text-sm">Columns</Label>
                  <input
                    type="number" min="1" max="30" value={columns}
                    onChange={(e) => updateGridSize(rows, Math.max(1, Math.min(30, Number(e.target.value))))}
                    className="w-full bg-neutral-700 text-white p-2 rounded-lg mt-1 border border-gray-600"
                  />
                </div>
              </div>
            </div>

            {/* ── Station Type Palette ───────────────────────────────── */}
            <div className="mb-6 bg-neutral-800 p-4 rounded-lg">
              <h3 className="text-white font-semibold mb-3">Select Station Type</h3>
              <p className="text-gray-400 text-xs mb-3">
                Pick a station type, then click or drag on the grid to paint. Click an occupied cell without a brush to erase it.
              </p>

              {stationTypes.length === 0 ? (
                <p className="text-yellow-400 text-sm">
                  ⚠️ No station types found. Make sure the <code className="bg-neutral-700 px-1 rounded">station_types</code> table exists and has seed data.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {stationTypes.map((st) => {
                    const isSelected = selectedStationType?.station_type_id === st.station_type_id;
                    return (
                      <button
                        key={st.station_type_id}
                        onClick={() => setSelectedStationType(isSelected ? null : st)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition text-left text-sm ${
                          isSelected ? "border-white" : "border-transparent hover:border-gray-500"
                        }`}
                        style={{
                          backgroundColor: isSelected ? st.color + "40" : undefined,
                          borderColor: isSelected ? st.color : undefined,
                        }}
                      >
                        <span className="text-xl">{st.icon}</span>
                        <div>
                          <div className="text-white font-medium">{st.name}</div>
                          <div className="text-gray-400 text-xs truncate max-w-[140px]">{st.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedStationType && (
                <div className="mt-3 p-2 rounded-lg flex items-center gap-2" style={{ backgroundColor: selectedStationType.color + "20" }}>
                  <span className="text-lg">{selectedStationType.icon}</span>
                  <span className="text-white text-sm font-medium">
                    Brush: <strong>{selectedStationType.name}</strong>
                  </span>
                  <button onClick={() => setSelectedStationType(null)} className="ml-auto text-gray-400 hover:text-white text-xs">
                    ✕ Clear
                  </button>
                </div>
              )}
            </div>

            {/* ── Actions Bar ────────────────────────────────────────── */}
            <div className="mb-4 flex gap-3 flex-wrap">
              <button onClick={clearGrid} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm">
                🗑️ Clear Grid
              </button>
              <button onClick={resetForm} className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition text-sm">
                📄 New Lab
              </button>
            </div>

            {/* ── Interactive Grid ───────────────────────────────────── */}
            <div className="mb-6 bg-neutral-900 p-4 rounded-lg overflow-x-auto">
              <h3 className="text-white font-semibold mb-3">
                Lab Layout Grid ({rows}×{columns}) — {totalStations} stations
              </h3>
              <div className="flex flex-col items-center select-none" onMouseLeave={() => setIsSelecting(false)}>
                {grid.map((row, rowIdx) => (
                  <div key={rowIdx} className="flex gap-1 mb-1">
                    {row.map((cell, colIdx) => {
                      const isStation = cell.stationTypeId !== null;

                      return (
                        <div
                          key={colIdx}
                          onMouseDown={() => handleMouseDown(rowIdx, colIdx)}
                          onMouseEnter={() => handleMouseEnter(rowIdx, colIdx)}
                          onMouseUp={() => handleMouseUp(rowIdx, colIdx)}
                          className={`
                            w-28 h-28 rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition p-1 relative
                            ${!isStation ? "bg-neutral-800 border-gray-600 hover:bg-neutral-700" : "hover:brightness-110"}
                            ${isSelecting && isInSelectionArea(rowIdx, colIdx) ? "ring-2 ring-yellow-400" : ""}
                          `}
                          style={isStation ? { backgroundColor: cell.color + "30", borderColor: cell.color } : undefined}
                          title={isStation ? `${cell.stationTypeLabel}: ${cell.stationLabel || ""}` : "Empty"}
                        >
                          {isStation ? (
                            <>
                              <span className="text-2xl leading-none">{cell.icon}</span>
                              {cell.stationLabel && (
                                <div className="text-white text-[10px] font-bold mt-0.5 text-center break-all leading-tight">
                                  {cell.stationLabel}
                                </div>
                              )}
                              <div className="text-gray-300 text-[9px] text-center leading-tight">
                                {cell.stationTypeLabel}
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-500 text-xs"></span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Stats Summary ──────────────────────────────────────── */}
            {totalStations > 0 && (
              <div className="mb-6 bg-neutral-800 p-4 rounded-lg">
                <h3 className="text-white font-semibold mb-3">Layout Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {Object.entries(getStats()).map(([label, count]) => {
                    const st = stationTypes.find((s) => s.name === label || s.label === label);
                    return (
                      <div key={label} className="rounded-lg p-3 text-center" style={{ backgroundColor: (st?.color || "#6b7280") + "20" }}>
                        <div className="text-2xl">{st?.icon || "📦"}</div>
                        <div className="text-white font-bold text-lg">{count}</div>
                        <div className="text-gray-300 text-xs">{label}</div>
                      </div>
                    );
                  })}
                  <div className="rounded-lg p-3 text-center bg-green-900/30">
                    <div className="text-2xl">📊</div>
                    <div className="text-white font-bold text-lg">{totalStations}</div>
                    <div className="text-gray-300 text-xs">Total Stations</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Save Button ───────────────────────────────────────── */}
            <div className="flex justify-center">
              <HoverBorderGradient onClick={saveLabLayout}>
                {isSaving ? "Saving…" : selectedLabId ? "Update Lab Layout" : "Save Lab Layout"}
              </HoverBorderGradient>
            </div>
          </motion.div>
        </BackgroundGradient>
      </div>
    </div>
  );
}
