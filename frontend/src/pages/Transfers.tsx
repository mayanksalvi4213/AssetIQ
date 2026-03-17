"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LogoButton } from "@/components/ui/logo-button";
import { motion } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";

interface Device {
  device_id: number;
  type_name: string;
  brand: string;
  model: string;
  asset_id?: string;
  assigned_code?: string;
  lab_name?: string;
  lab_id?: string;
  isLinked?: boolean;
  linkedGroupId?: number;
  specification?: string;
  isActive?: boolean;
  station_code?: string;
}

interface Station {
  stationId: number;
  assignedCode: string;
  row: number;
  column: number;
  os: string;
  devices: Device[];
  equipmentType?: string;
}

interface Lab {
  lab_id: string;
  lab_name: string;
  rows?: number;
  columns?: number;
}

interface TransferRequest {
  transfer_id?: number;
  from_lab_id: string;
  from_lab_name?: string;
  to_lab_id: string;
  to_lab_name?: string;
  device_ids: number[];
  devices?: Device[];
  remark: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_by?: string;
  requested_by_name?: string;
  requested_at?: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  transfer_type?: 'individual' | 'station';
  station_ids?: number[];
  device_dest_map?: Record<string, number>;
}

interface TransferItem {
  id: string;
  type: 'station' | 'individual';
  station?: Station;
  devices: Device[];
  stationCode?: string;
}

interface DestCell {
  row: number;
  column: number;
  cellId: number;
  stationTypeId: number;
  stationTypeName: string;
  stationTypeLabel: string;
  icon: string;
  color: string;
  stationLabel: string | null;
  os: string[];
  allowedDeviceTypes: string[];
  currentDevices: { deviceType: string; deviceId: number; brand: string; model: string; prefixCode: string; assetCode: string }[];
  currentDeviceTypes: string[];
  freeForTypes: string[];
}

function getDeviceEmoji(typeName: string): string {
  const t = (typeName || '').toLowerCase();
  if (t === 'laptop') return "💻";
  if (t === 'pc') return "🖥️";
  if (t === 'monitor') return "🖥️";
  if (t === 'ac') return "❄️";
  if (t === 'smart board') return "📺";
  if (t === 'projector') return "📽️";
  if (t === 'printer') return "🖨️";
  if (t === 'scanner') return "📠";
  if (t === 'ups') return "🔋";
  if (t === 'router') return "📡";
  if (t === 'switch') return "🔌";
  if (t === 'server') return "🗄️";
  if (t === 'keyboard') return "⌨️";
  if (t === 'mouse') return "🖱️";
  if (t === 'webcam') return "📷";
  if (t === 'headset') return "🎧";
  if (t.includes('cctv') || t.includes('camera')) return "📹";
  if (t.includes('passage') || t.includes('walkway')) return "🚶";
  if (t.includes('door')) return "🚪";
  if (t.includes('network')) return "🌐";
  if (t.includes('window')) return "🪟";
  if (t.includes('wall')) return "🧱";
  return "🔧";
}

const Transfers: React.FC = () => {
  const [active, setActive] = useState<string | null>(null);
  const { logout, user } = useAuth();
  const [view, setView] = useState<'create' | 'pending'>(
    (user?.role === 'HOD' || user?.role === 'Lab Incharge' || user?.role === 'Lab Assistant') ? 'pending' : 'create'
  );
  
  // Create Transfer Form State
  const [fromLabId, setFromLabId] = useState<string | null>(null);
  const [toLabId, setToLabId] = useState<string | null>(null);
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [remark, setRemark] = useState("");

  // Derived flat lists for validation / submission
  const allSelectedDevices = useMemo(() => transferItems.flatMap(ti => ti.devices), [transferItems]);
  const allSelectedStationIds = useMemo(() => transferItems.filter(ti => ti.type === 'station' && ti.station).map(ti => ti.station!.stationId), [transferItems]);
  
  // Data State
  const [labs, setLabs] = useState<Lab[]>([]);
  const [availableStations, setAvailableStations] = useState<Station[]>([]);
  const [destLayoutCells, setDestLayoutCells] = useState<DestCell[]>([]);
  const [activeTransferItemId, setActiveTransferItemId] = useState<string | null>(null);
  const [selectedDestByDevice, setSelectedDestByDevice] = useState<Record<number, number>>({});
  const [pendingTransfers, setPendingTransfers] = useState<TransferRequest[]>([]);
  const [transferHistory, setTransferHistory] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showStationGrid, setShowStationGrid] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [pendingOutgoingDeviceIds, setPendingOutgoingDeviceIds] = useState<Set<number>>(new Set());
  const [pendingIncomingCells, setPendingIncomingCells] = useState<Record<string, { device_id: number; device_type: string; transfer_id: number }[]>>({});
  const [pendingDestCellMap, setPendingDestCellMap] = useState<Record<string, Record<number, { row: number; column: number; label: string }>>>({});
  const [historyDestCellMap, setHistoryDestCellMap] = useState<Record<string, Record<number, { row: number; column: number; label: string }>>>({});

  useEffect(() => {
    fetchLabs();
    const rolesWithPending = ['HOD', 'Lab Incharge', 'Lab Assistant'];
    if (user?.role && rolesWithPending.includes(user.role)) {
      fetchPendingTransfers();
    }
    fetchTransferHistory();
  }, [user]);

  useEffect(() => {
    if (fromLabId) {
      fetchStationsFromLab(fromLabId);
      fetchPendingTransferInfo(fromLabId, 'source');
      setTransferItems([]);
    } else {
      setAvailableStations([]);
      setShowStationGrid(false);
      setPendingOutgoingDeviceIds(new Set());
    }
  }, [fromLabId]);

  useEffect(() => {
    if (toLabId) {
      fetchDestLayout(toLabId);
      fetchPendingTransferInfo(toLabId, 'dest');
    } else {
      setDestLayoutCells([]);
      setActiveTransferItemId(null);
      setSelectedDestByDevice({});
      setPendingIncomingCells({});
    }
  }, [toLabId]);

  useEffect(() => {
    const loadPendingDestLayouts = async () => {
      if (view !== 'pending' || pendingTransfers.length === 0) return;
      const token = localStorage.getItem("token");
      const labIds = Array.from(new Set(pendingTransfers.map(t => String(t.to_lab_id)).filter(Boolean)));
      const missing = labIds.filter(labId => !pendingDestCellMap[labId]);
      if (missing.length === 0) return;

      try {
        const results = await Promise.all(
          missing.map(async (labId) => {
            const response = await fetch(`http://127.0.0.1:5000/get_dest_lab_layout/${labId}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await response.json();
            if (!data.success) return { labId, cellMap: {} as Record<number, { row: number; column: number; label: string }> };
            const cellMap: Record<number, { row: number; column: number; label: string }> = {};
            (data.grid || []).forEach((cell: DestCell) => {
              cellMap[cell.cellId] = {
                row: cell.row,
                column: cell.column,
                label: cell.stationTypeLabel || cell.stationTypeName || 'Station',
              };
            });
            return { labId, cellMap };
          })
        );

        setPendingDestCellMap(prev => {
          const next = { ...prev };
          results.forEach(({ labId, cellMap }) => {
            next[labId] = cellMap;
          });
          return next;
        });
      } catch (error) {
        console.error("Error fetching pending destination layouts:", error);
      }
    };

    loadPendingDestLayouts();
  }, [pendingTransfers, view, pendingDestCellMap]);

  useEffect(() => {
    const loadHistoryDestLayouts = async () => {
      if (transferHistory.length === 0) return;
      const token = localStorage.getItem("token");
      const labIds = Array.from(new Set(transferHistory.map(t => String(t.to_lab_id)).filter(Boolean)));
      const missing = labIds.filter(labId => !historyDestCellMap[labId]);
      if (missing.length === 0) return;

      try {
        const results = await Promise.all(
          missing.map(async (labId) => {
            const response = await fetch(`http://127.0.0.1:5000/get_dest_lab_layout/${labId}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await response.json();
            if (!data.success) return { labId, cellMap: {} as Record<number, { row: number; column: number; label: string }> };
            const cellMap: Record<number, { row: number; column: number; label: string }> = {};
            (data.grid || []).forEach((cell: DestCell) => {
              cellMap[cell.cellId] = {
                row: cell.row,
                column: cell.column,
                label: cell.stationTypeLabel || cell.stationTypeName || 'Station',
              };
            });
            return { labId, cellMap };
          })
        );

        setHistoryDestCellMap(prev => {
          const next = { ...prev };
          results.forEach(({ labId, cellMap }) => {
            next[labId] = cellMap;
          });
          return next;
        });
      } catch (error) {
        console.error("Error fetching history destination layouts:", error);
      }
    };

    loadHistoryDestLayouts();
  }, [transferHistory, historyDestCellMap]);

  useEffect(() => {
    setCapacityError(null);
  }, [transferItems, toLabId]);

  useEffect(() => {
    // Keep only mappings for currently selected devices.
    setSelectedDestByDevice(prev => {
      const selectedIds = new Set(allSelectedDevices.map(d => d.device_id));
      const next: Record<number, number> = {};
      Object.entries(prev).forEach(([did, cellId]) => {
        const dnum = Number(did);
        if (selectedIds.has(dnum)) {
          next[dnum] = cellId;
        }
      });
      return next;
    });
  }, [allSelectedDevices]);

  const fetchLabs = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:5000/get_labs", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      if (data.success) {
        setLabs(data.labs);
      }
    } catch (error) {
      console.error("Error fetching labs:", error);
    }
  };

  const mapStationResponse = (data: any): Station[] => {
    return data.stations.map((station: any) => ({
      stationId: station.stationId,
      assignedCode: station.assignedCode,
      row: station.row,
      column: station.column,
      os: station.os,
      devices: station.devices.map((device: any) => ({
        device_id: device.deviceId,
        type_name: device.type,
        brand: device.brand,
        model: device.model,
        asset_id: device.assetCode,
        assigned_code: device.prefixCode || device.assetCode,
        station_code: station.assignedCode,
        specification: device.specification,
        isLinked: device.isLinked,
        linkedGroupId: device.linkedGroupId,
        isActive: device.isActive,
      }))
    }));
  };

  const fetchStationsFromLab = async (labId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`http://127.0.0.1:5000/get_lab_station_list/${labId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      if (data.success) {
        setAvailableStations(mapStationResponse(data));
        setShowStationGrid(true);
      } else {
        setAvailableStations([]);
      }
    } catch (error) {
      console.error("Error fetching stations:", error);
      setAvailableStations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDestLayout = async (labId: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://127.0.0.1:5000/get_dest_lab_layout/${labId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      if (data.success) {
        setDestLayoutCells(data.grid);
      } else {
        setDestLayoutCells([]);
      }
    } catch (error) {
      console.error("Error fetching dest layout:", error);
      setDestLayoutCells([]);
    }
  };

  const fetchPendingTransferInfo = async (labId: string, mode: 'source' | 'dest') => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://127.0.0.1:5000/get_lab_pending_transfer_info/${labId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      if (data.success) {
        if (mode === 'source') {
          setPendingOutgoingDeviceIds(new Set((data.outgoing_device_ids || []).map(Number)));
        } else {
          setPendingIncomingCells(data.incoming_cells || {});
        }
      }
    } catch (error) {
      console.error("Error fetching pending transfer info:", error);
    }
  };

  const fetchPendingTransfers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:5000/get_pending_transfers", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      if (data.success) {
        setPendingTransfers(data.transfers);
      }
    } catch (error) {
      console.error("Error fetching transfers:", error);
    }
  };

  const fetchTransferHistory = async () => {
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:5000/get_transfer_history", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      if (data.success) {
        setTransferHistory(data.transfers || []);
      } else {
        setTransferHistory([]);
      }
    } catch (error) {
      console.error("Error fetching transfer history:", error);
      setTransferHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeviceToggle = (device: Device) => {
    setTransferItems(prev => {
      // Check if device is already in any transfer item
      const existingIdx = prev.findIndex(ti => ti.devices.some(d => d.device_id === device.device_id));
      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        if (existing.type === 'individual') {
          // Remove this individual item
          return prev.filter((_, i) => i !== existingIdx);
        } else {
          // Device is part of a station group — remove just this device;
          // if only one device remains, convert to individual
          const remaining = existing.devices.filter(d => d.device_id !== device.device_id);
          if (remaining.length === 0) {
            return prev.filter((_, i) => i !== existingIdx);
          }
          if (remaining.length === 1) {
            const solo = remaining[0];
            return prev.map((ti, i) => i === existingIdx ? {
              id: `device-${solo.device_id}`,
              type: 'individual' as const,
              devices: [solo],
            } : ti);
          }
          return prev.map((ti, i) => i === existingIdx ? { ...ti, devices: remaining } : ti);
        }
      } else {
        // Add as individual
        return [...prev, {
          id: `device-${device.device_id}`,
          type: 'individual' as const,
          devices: [device],
        }];
      }
    });
  };

  const handleTransferEntireStation = (station: Station) => {
    setTransferItems(prev => {
      // Remove any individual items that belong to devices in this station
      const stationDeviceIds = new Set(station.devices.map(d => d.device_id));
      const filtered = prev.filter(ti => {
        if (ti.type === 'station' && ti.station?.stationId === station.stationId) return false;
        if (ti.type === 'individual' && ti.devices.some(d => stationDeviceIds.has(d.device_id))) return false;
        return true;
      });
      return [...filtered, {
        id: `station-${station.stationId}`,
        type: 'station' as const,
        station: station,
        devices: station.devices,
        stationCode: station.assignedCode,
      }];
    });
    setSelectedStation(null);
    setShowDeviceSelector(false);
  };

  const handleRemoveTransferItem = (itemId: string) => {
    setTransferItems(prev => prev.filter(ti => ti.id !== itemId));
  };

  const handleStationClick = (station: Station) => {
    if (station.devices.length === 0) return;
    setSelectedStation(station);
    setShowDeviceSelector(true);
  };

  const getStationSelectionState = (station: Station) => {
    if (station.devices.length === 0) return 'empty';
    const selectedCount = station.devices.filter(d => 
      allSelectedDevices.some(sd => sd.device_id === d.device_id)
    ).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === station.devices.length) return 'all';
    return 'partial';
  };

  const handleSubmitTransfer = async () => {
    if (!fromLabId || !toLabId || allSelectedDevices.length === 0) {
      alert("Please select source lab, destination lab, and at least one device");
      return;
    }

    if (fromLabId === toLabId) {
      alert("Source and destination labs cannot be the same");
      return;
    }

    if (!assignmentValidation.allOk) {
      alert("Please assign a valid destination station for every selected device");
      return;
    }

    try {
      setLoading(true);
      setCapacityError(null);
      const token = localStorage.getItem("token");
      const isFullStation = allSelectedStationIds.length > 0;

      const response = await fetch("http://127.0.0.1:5000/create_transfer_request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          from_lab_id: fromLabId,
          to_lab_id: toLabId,
          device_ids: allSelectedDevices.map(d => d.device_id),
          remark: remark,
          transfer_type: isFullStation ? 'station' : 'individual',
          station_ids: allSelectedStationIds,
          dest_cell_id: Object.values(selectedDestByDevice)[0] || null,
          device_dest_map: selectedDestByDevice,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert("Transfer request submitted successfully!");
        setFromLabId(null);
        setToLabId(null);
        setTransferItems([]);
        setRemark("");
        setAvailableStations([]);
        setDestLayoutCells([]);
        setActiveTransferItemId(null);
        setSelectedDestByDevice({});
        setShowStationGrid(false);
        setCapacityError(null);
      } else {
        setCapacityError(data.error || "Failed to submit transfer request");
      }
    } catch (error) {
      console.error("Error submitting transfer:", error);
      alert("Failed to submit transfer request");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTransfer = async (transferId: number) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://127.0.0.1:5000/approve_transfer/${transferId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json();
      if (data.success) {
        alert("Transfer approved and devices moved successfully!");
        fetchPendingTransfers();
      } else {
        alert(data.error || "Failed to approve transfer");
      }
    } catch (error) {
      console.error("Error approving transfer:", error);
      alert("Failed to approve transfer");
    }
  };

  const handleRejectTransfer = async (transferId: number) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://127.0.0.1:5000/reject_transfer/${transferId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json();
      if (data.success) {
        alert("Transfer rejected");
        fetchPendingTransfers();
      } else {
        alert(data.error || "Failed to reject transfer");
      }
    } catch (error) {
      console.error("Error rejecting transfer:", error);
      alert("Failed to reject transfer");
    }
  };

  const handleExportHistoryExcel = () => {
    window.open("http://127.0.0.1:5000/export_transfer_history_excel", "_blank");
  };

  const handleExportHistoryPdf = () => {
    window.open("http://127.0.0.1:5000/export_transfer_history_pdf", "_blank");
  };

  // Build grid from station list - Labplan.tsx style
  const renderStationGrid = (
    stations: Station[],
    isSource: boolean,
  ) => {
    if (stations.length === 0) return null;

    const maxRow = Math.max(...stations.map(s => s.row));
    const maxCol = Math.max(...stations.map(s => s.column));

    const gridMap = new Map<string, Station>();
    stations.forEach(station => {
      gridMap.set(`${station.row}-${station.column}`, station);
    });

    const rows = [];
    for (let row = 0; row <= maxRow; row++) {
      const cells = [];
      for (let col = 0; col <= maxCol; col++) {
        const station = gridMap.get(`${row}-${col}`);
        const hasDevices = station && station.devices.length > 0;
        const selectionState = station ? getStationSelectionState(station) : 'empty';
        const pendingCount = station ? station.devices.filter(d => pendingOutgoingDeviceIds.has(d.device_id)).length : 0;
        const allPending = hasDevices && station && pendingCount === station.devices.length;

        let cellBg = "bg-neutral-800 border-gray-600";
        let isClickable = false;

        if (isSource && hasDevices) {
          if (allPending) {
            cellBg = "bg-orange-900/50 border-orange-500";
            isClickable = false; // all devices locked
          } else {
            isClickable = true;
            if (selectionState === 'all') {
              cellBg = "bg-blue-900/60 border-blue-400 hover:bg-blue-900/80 ring-2 ring-blue-400";
            } else if (selectionState === 'partial') {
              cellBg = "bg-yellow-900/60 border-yellow-500 hover:bg-yellow-900/80";
            } else {
              cellBg = "bg-green-900/60 border-green-500 hover:bg-green-900/80";
            }
          }
        } else if (!isSource && hasDevices) {
          cellBg = "bg-green-900/60 border-green-500";
        } else if (!isSource && station && !hasDevices) {
          cellBg = "bg-neutral-800/80 border-cyan-800/60";
        }

        let emoji = "";
        if (hasDevices && station) {
          emoji = getDeviceEmoji(station.devices[0].type_name || '');
        }

        const hasWindows = station?.os?.includes('Win');
        const hasLinux = station?.os?.includes('Linux');
        const deviceCount = station?.devices?.length || 0;

        cells.push(
          <div
            key={`${row}-${col}`}
            onClick={() => isClickable && station && handleStationClick(station)}
            className={`
              w-28 rounded-lg border-2 flex flex-col items-center justify-center transition p-1
              ${isClickable ? "cursor-pointer" : ""}
              ${cellBg}
            `}
            style={{ minHeight: hasDevices ? `${Math.max(96, 60 + deviceCount * 14)}px` : '96px' }}
            title={hasDevices && station ? station.devices.map(d => `${d.type_name}: ${d.assigned_code || d.type_name}`).join('\n') : (station?.assignedCode || 'Empty')}
          >
            {hasDevices && station ? (
              <>
                <div className="text-white font-bold text-[10px] truncate w-full text-center">{station.assignedCode}</div>
                <div className="text-white text-lg leading-none">{emoji}</div>
                <div className="text-center w-full space-y-0.5 mt-0.5">
                  {station.devices.map((d, di) => (
                    <div key={di} className="text-green-300 text-[9px] font-mono leading-tight truncate" title={d.assigned_code || ''}>
                      {d.assigned_code || d.type_name}
                    </div>
                  ))}
                </div>
                <div className="flex gap-1 mt-0.5 flex-wrap justify-center">
                  {hasWindows && <div className="text-[8px] px-1 bg-blue-800 text-white rounded">Win</div>}
                  {hasLinux && <div className="text-[8px] px-1 bg-orange-600 text-white rounded">Linux</div>}
                </div>
                {isSource && selectionState !== 'none' && (
                  <div className={`mt-0.5 text-[8px] px-1.5 py-0.5 rounded font-semibold ${
                    selectionState === 'all' ? 'bg-blue-600 text-white' : 'bg-yellow-600 text-white'
                  }`}>
                    {selectionState === 'all' ? '✓ All Selected' : `${station.devices.filter((d: Device) => allSelectedDevices.some((sd: Device) => sd.device_id === d.device_id)).length}/${deviceCount}`}
                  </div>
                )}
                {isSource && pendingCount > 0 && (
                  <div className="mt-0.5 text-[8px] px-1.5 py-0.5 rounded font-semibold bg-orange-600 text-white">
                    ⏳ {pendingCount}/{deviceCount} Pending
                  </div>
                )}
              </>
            ) : station ? (
              <>
                {!isSource && (
                  <div className="text-cyan-300 text-[9px] font-mono truncate w-full text-center">{station.assignedCode}</div>
                )}
                <div className="text-gray-500 text-xs">{isSource ? 'Empty' : 'Free Slot'}</div>
              </>
            ) : (
              <div className="text-gray-600 text-xs">Empty</div>
            )}
          </div>
        );
      }
      rows.push(
        <div key={row} className="flex gap-2 mb-2">
          {cells}
        </div>
      );
    }
    return rows;
  };

  const assignmentValidation = useMemo(() => {
    const cellById = new Map<number, DestCell>();
    destLayoutCells.forEach(cell => cellById.set(cell.cellId, cell));

    const unassigned: Device[] = [];
    const invalid: { device: Device; reason: string }[] = [];

    // Station can hold one device per type; track existing + planned per cell.
    const occupiedByCell = new Map<number, Set<string>>();
    destLayoutCells.forEach(cell => {
      occupiedByCell.set(cell.cellId, new Set(cell.currentDeviceTypes || []));
    });

    allSelectedDevices.forEach(device => {
      const destCellId = selectedDestByDevice[device.device_id];
      if (!destCellId) {
        unassigned.push(device);
        return;
      }

      const cell = cellById.get(destCellId);
      if (!cell) {
        invalid.push({ device, reason: 'Assigned destination station is no longer available' });
        return;
      }

      const dtype = device.type_name || 'Unknown';
      if (!cell.allowedDeviceTypes.includes(dtype)) {
        invalid.push({ device, reason: `${dtype} is not allowed at ${cell.stationTypeLabel}` });
        return;
      }

      const occ = occupiedByCell.get(cell.cellId) || new Set<string>();
      if (occ.has(dtype)) {
        invalid.push({ device, reason: `${dtype} slot already occupied at ${cell.stationTypeLabel}` });
        return;
      }

      occ.add(dtype);
      occupiedByCell.set(cell.cellId, occ);
    });

    return {
      unassigned,
      invalid,
      allOk: allSelectedDevices.length > 0 && unassigned.length === 0 && invalid.length === 0,
    };
  }, [allSelectedDevices, selectedDestByDevice, destLayoutCells]);



  // Handle click on destination cell — brush-style assignment
  const handleDestCellClick = (cell: DestCell) => {
    const nonSelectable = ['empty', 'passage', 'door', 'wall', 'window', 'walkway'];
    if (nonSelectable.includes(cell.stationTypeName.toLowerCase())) return;
    
    // If there's an active brush, assign that transfer item to this cell
    if (activeTransferItemId) {
      const ti = transferItems.find(t => t.id === activeTransferItemId);
      if (ti) {
        setSelectedDestByDevice(prev => {
          const next = { ...prev };
          ti.devices.forEach(d => { next[d.device_id] = cell.cellId; });
          return next;
        });
        // Auto-advance to next unassigned item
        const nextUnassigned = transferItems.find(t => 
          t.id !== activeTransferItemId && 
          t.devices.some(d => !selectedDestByDevice[d.device_id])
        );
        setActiveTransferItemId(nextUnassigned ? nextUnassigned.id : null);
      }
    }
  };

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
              <HoveredLink href="/scrap">Scrap</HoveredLink>
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-7xl relative z-20 mt-16"
      >
        <h1 className="text-4xl font-bold mb-6 text-center text-gray-200">
          Lab Transfer Management
        </h1>

        {/* View Toggle for HOD / Lab Incharge / Lab Assistant */}
        {(user?.role === 'HOD' || user?.role === 'Lab Incharge' || user?.role === 'Lab Assistant') && (
          <div className="flex gap-3 mb-6 justify-center">
            <button
              onClick={() => setView('pending')}
              className={`px-5 py-2 rounded-lg font-semibold transition ${view === 'pending' ? 'bg-blue-600 text-white' : 'bg-neutral-700 text-gray-300 hover:bg-neutral-600'}`}
            >
              {user?.role === 'HOD' ? 'Pending Approvals' : 'Pending Transfers'}
              {pendingTransfers.length > 0 && (
                <span className="ml-2 text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded-full font-bold">
                  {pendingTransfers.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setView('create')}
              className={`px-5 py-2 rounded-lg font-semibold transition ${view === 'create' ? 'bg-green-600 text-white' : 'bg-neutral-700 text-gray-300 hover:bg-neutral-600'}`}
            >
              Create Transfer
            </button>
          </div>
        )}

        {/* Pending Transfers View */}
        {view === 'pending' && (user?.role === 'HOD' || user?.role === 'Lab Incharge' || user?.role === 'Lab Assistant') && (
          <div className="bg-neutral-800/95 rounded-2xl backdrop-blur-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-white">
                {user?.role === 'HOD' ? 'Pending Transfer Requests' : 'Pending Transfers (Read-Only)'}
              </h2>
              {user?.role !== 'HOD' && (
                <div className="text-xs text-yellow-300 bg-yellow-900/30 border border-yellow-700 px-3 py-1.5 rounded-lg">
                  ⚠️ Check this list before creating a new transfer to avoid duplicates
                </div>
              )}
              <button
                onClick={fetchPendingTransfers}
                className="text-xs px-3 py-1.5 rounded bg-neutral-600 hover:bg-neutral-500 text-white"
              >
                🔄 Refresh
              </button>
            </div>
            
            {pendingTransfers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                No pending transfer requests
              </div>
            ) : (
              <div className="space-y-4">
                {pendingTransfers.map((transfer) => (
                  <div key={transfer.transfer_id} className="bg-neutral-700/50 rounded-lg p-5 border border-neutral-600">
                    {(() => {
                      const destMap = (transfer.device_dest_map || {}) as Record<string, number>;
                      const devicesByDest = new Map<number, Device[]>();
                      const devicesWithoutDest: Device[] = [];

                      (transfer.devices || []).forEach((device) => {
                        const destCellId = destMap[String(device.device_id)];
                        if (destCellId) {
                          const list = devicesByDest.get(destCellId) || [];
                          list.push(device);
                          devicesByDest.set(destCellId, list);
                        } else {
                          devicesWithoutDest.push(device);
                        }
                      });

                      return (
                        <>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-sm text-gray-400">
                          Transfer Request #{transfer.transfer_id}
                          {transfer.transfer_type === 'station' && (
                            <span className="ml-2 text-xs bg-purple-600 text-white px-2 py-0.5 rounded">Entire Station</span>
                          )}
                        </div>
                        <div className="text-lg font-semibold text-white mt-1">
                          {transfer.from_lab_name} → {transfer.to_lab_name}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          Requested by: {transfer.requested_by_name || transfer.requested_by || 'Unknown'} on {new Date(transfer.requested_at!).toLocaleString()}
                        </div>
                      </div>
                      {/* Only HOD can approve/reject */}
                      {user?.role === 'HOD' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveTransfer(transfer.transfer_id!)}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => handleRejectTransfer(transfer.transfer_id!)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                          >
                            ✗ Reject
                          </button>
                        </div>
                      )}
                      {user?.role !== 'HOD' && (
                        <span className="text-xs bg-yellow-700/50 border border-yellow-600 text-yellow-300 px-3 py-1.5 rounded-lg">
                          Pending Approval
                        </span>
                      )}
                    </div>

                    {devicesByDest.size > 0 && (
                      <div className="mb-3">
                        <div className="text-sm text-gray-400 mb-2">Destination Cells:</div>
                        <div className="flex flex-wrap gap-2">
                          {[...devicesByDest.entries()].map(([cellId, devices]) => (
                            (() => {
                              const cellMeta = pendingDestCellMap[String(transfer.to_lab_id)]?.[cellId];
                              const cellLabel = cellMeta ? `R${cellMeta.row},C${cellMeta.column}` : `Cell ${cellId}`;
                              return (
                            <div
                              key={cellId}
                              className="text-xs bg-cyan-900/40 border border-cyan-600 text-cyan-200 px-2 py-1 rounded"
                            >
                              {cellLabel}: {devices.length} device(s)
                            </div>
                              );
                            })()
                          ))}
                          {devicesWithoutDest.length > 0 && (
                            <div className="text-xs bg-yellow-900/40 border border-yellow-600 text-yellow-200 px-2 py-1 rounded">
                              Unassigned: {devicesWithoutDest.length}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mb-3">
                      <div className="text-sm text-gray-400 mb-2">Devices to Transfer:</div>
                      <div className="bg-neutral-800/50 rounded p-3 space-y-1">
                        {transfer.devices?.map((device, idx) => (
                          (() => {
                            const destMap = (transfer.device_dest_map || {}) as Record<string, number>;
                            const destCellId = destMap[String(device.device_id)];
                            const cellMeta = destCellId ? pendingDestCellMap[String(transfer.to_lab_id)]?.[destCellId] : undefined;
                            const cellLabel = destCellId ? (cellMeta ? `R${cellMeta.row},C${cellMeta.column}` : `Cell ${destCellId}`) : undefined;
                            return (
                          <div key={device.device_id} className="text-sm text-white py-1 flex items-center gap-2">
                            <span>{getDeviceEmoji(device.type_name)}</span>
                            <span>{idx + 1}. {device.type_name} - {device.brand} {device.model}</span>
                            {device.asset_id && <span className="text-gray-400">({device.asset_id})</span>}
                            {device.assigned_code && <span className="text-green-300 font-mono text-xs">[{device.assigned_code}]</span>}
                            {device.station_code && <span className="text-cyan-400 text-xs">@ {device.station_code}</span>}
                            {cellLabel && (
                              <span className="text-[10px] bg-cyan-800/60 border border-cyan-500 text-cyan-100 px-1.5 py-0.5 rounded">
                                → {cellLabel}
                              </span>
                            )}
                          </div>
                            );
                          })()
                        ))}
                      </div>
                    </div>

                    {transfer.remark && (
                      <div>
                        <div className="text-sm text-gray-400">Remark:</div>
                        <div className="text-white text-sm mt-1">{transfer.remark}</div>
                      </div>
                    )}
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Transfer Form */}
        {view === 'create' && (
          <div className="bg-neutral-800/95 rounded-2xl backdrop-blur-sm p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white">Create Transfer Request</h2>
              <p className="text-sm text-gray-400 mt-1">
                Select source lab, click stations to pick devices, then choose destination
              </p>
            </div>

            <div className="space-y-6">
              {/* Lab Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-semibold mb-2">From Lab (Source)</label>
                  <select
                    value={fromLabId || ""}
                    onChange={(e) => setFromLabId(e.target.value || null)}
                    className="w-full bg-neutral-700 text-white p-3 rounded-lg border border-neutral-600"
                  >
                    <option value="">Select source lab</option>
                    {labs.map((lab) => (
                      <option key={lab.lab_id} value={lab.lab_id}>
                        {lab.lab_name} (Lab {lab.lab_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2">To Lab (Destination)</label>
                  <select
                    value={toLabId || ""}
                    onChange={(e) => setToLabId(e.target.value || null)}
                    className="w-full bg-neutral-700 text-white p-3 rounded-lg border border-neutral-600"
                  >
                    <option value="">Select destination lab</option>
                    {labs.map((lab) => (
                      <option key={lab.lab_id} value={lab.lab_id}>
                        {lab.lab_name} (Lab {lab.lab_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selected Items — Click to select as brush, then click destination grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-white font-semibold">
                    Selected Items ({transferItems.length} items, {allSelectedDevices.length} devices)
                  </label>
                  {activeTransferItemId && (
                    <button
                      onClick={() => setActiveTransferItemId(null)}
                      className="text-xs px-3 py-1 rounded bg-neutral-600 hover:bg-neutral-500 text-white"
                    >
                      Deselect Brush
                    </button>
                  )}
                </div>

                {transferItems.length > 0 && toLabId && (
                  <div className="text-xs text-cyan-300 mb-2">
                    👆 Click an item below to select it, then click a cell in the Destination Lab grid to assign it.
                  </div>
                )}

                {transferItems.length > 0 && (
                  <div className="bg-neutral-700/50 rounded-lg p-4 mb-3 space-y-2">
                    {transferItems.map((ti) => {
                      const isActiveBrush = activeTransferItemId === ti.id;
                      const firstDevice = ti.devices[0];
                      const mappedCellId = firstDevice ? selectedDestByDevice[firstDevice.device_id] : undefined;
                      const mappedCell = mappedCellId ? destLayoutCells.find(c => c.cellId === mappedCellId) : undefined;
                      const allMapped = ti.devices.every(d => selectedDestByDevice[d.device_id]);

                      return (
                        <div
                          key={ti.id}
                          onClick={() => setActiveTransferItemId(isActiveBrush ? null : ti.id)}
                          className={`py-2 rounded border cursor-pointer transition-all ${
                            isActiveBrush
                              ? 'ring-2 ring-cyan-400 border-cyan-400 bg-cyan-900/30'
                              : ti.type === 'station'
                                ? 'bg-blue-900/20 border-blue-600 hover:border-cyan-500'
                                : 'bg-neutral-800/60 border-neutral-600 hover:border-cyan-500'
                          } px-3`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {isActiveBrush && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-600 text-white font-bold animate-pulse">BRUSH</span>
                              )}
                              {ti.type === 'station' ? (
                                <span className="text-blue-300 text-xs font-semibold">
                                  🖥️ Station: {ti.stationCode} ({ti.devices.length} devices)
                                </span>
                              ) : (
                                <span className="text-white text-sm flex items-center gap-1">
                                  {getDeviceEmoji(ti.devices[0].type_name)} {ti.devices[0].type_name} - {ti.devices[0].brand} {ti.devices[0].model}
                                  {ti.devices[0].assigned_code && <span className="text-green-300 font-mono text-xs">[{ti.devices[0].assigned_code}]</span>}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {mappedCell ? (
                                <span className="text-xs text-cyan-300">→ {mappedCell.stationTypeLabel} [R{mappedCell.row},C{mappedCell.column}]</span>
                              ) : (
                                <span className="text-xs text-yellow-400">No destination</span>
                              )}
                              {allMapped && mappedCellId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDestByDevice(prev => {
                                      const next = { ...prev };
                                      ti.devices.forEach(d => { delete next[d.device_id]; });
                                      return next;
                                    });
                                  }}
                                  className="px-1.5 py-0.5 text-[10px] rounded bg-red-700 hover:bg-red-600 text-white"
                                >
                                  ✕
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveTransferItem(ti.id);
                                }}
                                className="text-red-400 hover:text-red-300 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          {/* Show station sub-devices */}
                          {ti.type === 'station' && (
                            <div className="space-y-0.5 ml-4">
                              {ti.devices.map(d => (
                                <div key={d.device_id} className="text-white text-xs flex items-center gap-1">
                                  {getDeviceEmoji(d.type_name)} {d.type_name} {d.assigned_code ? `(${d.assigned_code})` : ''}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Source Lab Grid */}
              {fromLabId && showStationGrid && (
                <div className="bg-neutral-700/50 rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-3">
                    Source Lab Floor Plan — Click a station to select devices
                  </h3>
                  <div className="flex gap-3 mb-3 text-xs">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600 inline-block border border-green-400"></span> Available</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-700 inline-block border border-blue-400 ring-1 ring-blue-400"></span> All Selected</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-700 inline-block border border-yellow-500"></span> Partial</span>
                  </div>
                  {loading ? (
                    <div className="text-center text-gray-400 py-4">Loading lab layout...</div>
                  ) : availableStations.length === 0 ? (
                    <div className="text-center text-gray-400 py-4">No stations found in this lab</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="inline-block">
                        {renderStationGrid(availableStations, true)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Destination Lab Grid — Select where to place devices */}
              {toLabId && destLayoutCells.length > 0 && (
                <div className="bg-neutral-700/50 rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-3">
                    Destination Lab — {activeTransferItemId ? 'Click a cell to assign the selected item' : 'Select an item above first'}
                  </h3>
                  {activeTransferItemId && (
                    <div className="text-xs text-cyan-300 mb-2 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-600 text-white font-bold animate-pulse">BRUSH</span>
                      Click a destination cell below to assign the active item.
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 mb-3 text-xs">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cyan-700 inline-block border border-cyan-400"></span> Free (selectable)</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-700 inline-block border border-green-400"></span> Occupied</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-800 inline-block border border-blue-400 ring-1 ring-blue-400"></span> Selected</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-neutral-800 inline-block border border-gray-600"></span> Non-selectable</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-800 inline-block border border-orange-500"></span> Incoming Pending</span>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="inline-block">
                      {(() => {
                        const maxRow = Math.max(...destLayoutCells.map(c => c.row), 0);
                        const maxCol = Math.max(...destLayoutCells.map(c => c.column), 0);
                        const cellMap = new Map<string, DestCell>();
                        destLayoutCells.forEach(cell => cellMap.set(`${cell.row}-${cell.column}`, cell));

                        const rows = [];
                        for (let row = 0; row <= maxRow; row++) {
                          const cells = [];
                          for (let col = 0; col <= maxCol; col++) {
                            const cell = cellMap.get(`${row}-${col}`);
                            if (!cell) {
                              cells.push(<div key={`${row}-${col}`} className="w-28 min-h-[96px] rounded-lg border-2 border-gray-700 bg-neutral-900 flex items-center justify-center"><span className="text-gray-600 text-xs">—</span></div>);
                              continue;
                            }

                            const nonSelectable = ['empty', 'passage', 'door', 'wall', 'window', 'walkway'];
                            const isNonSelectable = nonSelectable.includes(cell.stationTypeName.toLowerCase());
                            const isAssignedDest = Object.values(selectedDestByDevice).includes(cell.cellId);
                            const hasDevices = cell.currentDevices.length > 0;
                            const hasFreeSlots = cell.freeForTypes.length > 0;
                            const hasBrush = !!activeTransferItemId;
                            const pendingIncoming = pendingIncomingCells[String(cell.cellId)] || [];

                            let cellBg = "bg-neutral-800 border-gray-600";
                            let clickable = false;

                            if (isAssignedDest) {
                              cellBg = "bg-blue-900/60 border-blue-400 ring-2 ring-blue-400";
                              clickable = hasBrush;
                            } else if (isNonSelectable) {
                              cellBg = "bg-neutral-800/60 border-gray-700";
                            } else if (hasDevices && !hasFreeSlots) {
                              cellBg = "bg-green-900/40 border-green-700";
                            } else if (hasBrush && (hasFreeSlots || !hasDevices)) {
                              cellBg = "bg-cyan-900/30 border-cyan-600 hover:bg-cyan-900/50 cursor-pointer";
                              clickable = true;
                            } else if (hasDevices && hasFreeSlots) {
                              cellBg = "bg-green-900/30 border-cyan-600";
                            } else {
                              cellBg = "bg-cyan-900/30 border-cyan-700";
                            }

                            cells.push(
                              <div
                                key={`${row}-${col}`}
                                onClick={() => clickable && handleDestCellClick(cell)}
                                className={`w-28 rounded-lg border-2 flex flex-col items-center justify-center transition p-1 ${cellBg}`}
                                style={{ minHeight: '96px' }}
                                title={`${cell.stationTypeLabel}\nAllowed: ${cell.allowedDeviceTypes.join(', ') || 'none'}\nFree: ${cell.freeForTypes.join(', ') || 'none'}\nOccupied: ${cell.currentDeviceTypes.join(', ') || 'none'}`}
                              >
                                <div className="text-lg leading-none">{cell.icon || '⬜'}</div>
                                <div className="text-white text-[9px] font-semibold truncate w-full text-center mt-0.5">{cell.stationTypeLabel || cell.stationTypeName}</div>
                                {cell.stationLabel && (
                                  <div className="text-gray-400 text-[8px] truncate w-full text-center">{cell.stationLabel}</div>
                                )}
                                {hasDevices && (
                                  <div className="text-center w-full space-y-0.5 mt-0.5">
                                    {cell.currentDevices.map((d, i) => (
                                      <div key={i} className="text-green-300 text-[8px] font-mono leading-tight truncate">
                                        {getDeviceEmoji(d.deviceType)} {d.prefixCode || d.deviceType}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {!isNonSelectable && hasFreeSlots && !hasDevices && (
                                  <div className="text-cyan-300 text-[8px] mt-0.5">Free</div>
                                )}
                                {isAssignedDest && (() => {
                                  const assignedItem = transferItems.find(ti =>
                                    ti.devices.some(d => selectedDestByDevice[d.device_id] === cell.cellId)
                                  );
                                  if (!assignedItem) return null;
                                  return (
                                    <div className="mt-0.5 w-full text-center space-y-0.5">
                                      {assignedItem.type === 'station' ? (
                                        <>
                                          <div className="text-[8px] px-1 py-0.5 rounded bg-blue-700 text-white font-bold truncate">
                                            ↙ {assignedItem.stationCode}
                                          </div>
                                          {assignedItem.devices.map(d => (
                                            <div key={d.device_id} className="text-[7px] text-cyan-200 font-mono truncate">
                                              {getDeviceEmoji(d.type_name)} {d.assigned_code || d.type_name}
                                            </div>
                                          ))}
                                        </>
                                      ) : (
                                        <div className="text-[8px] px-1 py-0.5 rounded bg-blue-700 text-white font-mono truncate">
                                          ↙ {assignedItem.devices[0].assigned_code || assignedItem.devices[0].type_name}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                                {pendingIncoming.length > 0 && (
                                  <div className="mt-0.5 w-full text-center">
                                    <div className="text-[8px] px-1 py-0.5 rounded bg-orange-700 text-white font-semibold">
                                      ⏳ {pendingIncoming.length} incoming
                                    </div>
                                    {pendingIncoming.slice(0, 3).map((pi, idx) => (
                                      <div key={idx} className="text-[7px] text-orange-200 font-mono truncate">
                                        {pi.device_type || 'device'}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          rows.push(<div key={row} className="flex gap-2 mb-2">{cells}</div>);
                        }
                        return rows;
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Assignment Validation Summary */}
              {allSelectedDevices.length > 0 && (
                <div className="bg-neutral-700/50 rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-3">
                    Destination Assignment Status
                  </h3>
                  {assignmentValidation.allOk ? (
                    <div className="text-sm text-green-300">✓ All selected devices are assigned to valid destination stations.</div>
                  ) : (
                    <div className="space-y-3">
                      {assignmentValidation.unassigned.length > 0 && (
                        <div className="rounded-lg p-3 border bg-yellow-900/30 border-yellow-600">
                          <div className="text-yellow-300 text-sm font-semibold mb-1">Unassigned Devices</div>
                          <div className="text-xs text-yellow-200">
                            {assignmentValidation.unassigned.map(d => `${d.type_name}${d.assigned_code ? ` (${d.assigned_code})` : ''}`).join(', ')}
                          </div>
                        </div>
                      )}
                      {assignmentValidation.invalid.length > 0 && (
                        <div className="rounded-lg p-3 border bg-red-900/30 border-red-600">
                          <div className="text-red-300 text-sm font-semibold mb-1">Invalid Assignments</div>
                          <div className="space-y-1">
                            {assignmentValidation.invalid.map((x, idx) => (
                              <div key={idx} className="text-xs text-red-200">
                                ✗ {x.device.type_name}{x.device.assigned_code ? ` (${x.device.assigned_code})` : ''}: {x.reason}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Capacity Error Banner */}
              {capacityError && (
                <div className="bg-red-900/40 border border-red-500 rounded-lg p-4 text-red-200 text-sm">
                  ⚠️ {capacityError}
                </div>
              )}

              {/* Device Selector Modal */}
              {showDeviceSelector && selectedStation && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => {
                  setShowDeviceSelector(false);
                  setSelectedStation(null);
                }}>
                  <div className="bg-neutral-800 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-white text-xl font-semibold flex items-center gap-2">
                        <span>{getDeviceEmoji(selectedStation.devices[0]?.type_name || '')}</span>
                        Station: {selectedStation.assignedCode}
                      </h3>
                      <button
                        onClick={() => {
                          setShowDeviceSelector(false);
                          setSelectedStation(null);
                        }}
                        className="text-gray-400 hover:text-white text-2xl"
                      >
                        ×
                      </button>
                    </div>

                    <div className="mb-4 p-3 bg-neutral-700/50 rounded">
                      <div className="text-gray-400 text-sm">Position: Row {selectedStation.row}, Column {selectedStation.column}</div>
                      <div className="text-gray-400 text-sm">OS: {selectedStation.os}</div>
                      <div className="text-gray-400 text-sm">Devices: {selectedStation.devices.length}</div>
                    </div>

                    <div className="flex gap-3 mb-4">
                      {(() => {
                        const nonPendingDevices = selectedStation.devices.filter(d => !pendingOutgoingDeviceIds.has(d.device_id));
                        const pendingDevicesCount = selectedStation.devices.length - nonPendingDevices.length;
                        return (
                          <>
                            <button
                              onClick={() => {
                                // Only transfer non-pending devices as entire station
                                const stationWithOnlyAvailable = { ...selectedStation, devices: nonPendingDevices };
                                handleTransferEntireStation(stationWithOnlyAvailable);
                              }}
                              disabled={nonPendingDevices.length === 0}
                              className={`flex-1 px-4 py-3 ${nonPendingDevices.length === 0 ? 'bg-neutral-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg transition font-semibold`}
                            >
                              Transfer Entire Station ({nonPendingDevices.length} devices)
                            </button>
                            {pendingDevicesCount > 0 && (
                              <div className="text-xs text-orange-300 self-center">
                                ⏳ {pendingDevicesCount} device(s) have pending transfers
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    <div className="border-t border-neutral-600 pt-4">
                      <h4 className="text-white font-semibold mb-3">Or Select Individual Devices:</h4>
                      <div className="space-y-2">
                        {selectedStation.devices.map((device) => {
                          const isSelected = allSelectedDevices.some((d: Device) => d.device_id === device.device_id);
                          const isPending = pendingOutgoingDeviceIds.has(device.device_id);
                          
                          // Find linked partner if exists
                          const linkedPartner = device.isLinked && device.linkedGroupId
                            ? selectedStation.devices.find(
                                d => d.device_id !== device.device_id && 
                                     d.linkedGroupId === device.linkedGroupId
                              )
                            : null;
                          
                          const partnerSelected = linkedPartner 
                            ? allSelectedDevices.some((d: Device) => d.device_id === linkedPartner.device_id)
                            : false;
                          
                          return (
                            <div
                              key={device.device_id}
                              className={`rounded border transition ${
                                isPending
                                  ? 'bg-orange-900/20 border-orange-600 opacity-70'
                                  : isSelected
                                    ? 'bg-green-600/30 border-green-500'
                                    : 'bg-neutral-700/30 hover:bg-neutral-700/50 border-neutral-600'
                              }`}
                            >
                              <div
                                onClick={() => !isPending && handleDeviceToggle(device)}
                                className={`p-3 ${isPending ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <div className="text-white text-sm flex items-center gap-2">
                                      <span>{getDeviceEmoji(device.type_name)}</span>
                                      <span>{device.type_name} - {device.brand} {device.model}</span>
                                      {device.assigned_code && <span className="text-green-300 font-mono text-xs">[{device.assigned_code}]</span>}
                                      {device.asset_id && <span className="text-gray-400">({device.asset_id})</span>}
                                      {device.isLinked && (
                                        <span className="ml-1 text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded">🔗 Linked</span>
                                      )}
                                    </div>
                                    {isSelected && (
                                      <span className="text-green-400 text-sm">✓ Selected</span>
                                    )}
                                    {isPending && (
                                      <span className="text-orange-400 text-xs font-semibold">⏳ Pending Transfer</span>
                                    )}
                                  </div>
                                  {device.isLinked && linkedPartner && isSelected !== partnerSelected && (
                                    <div className="text-xs text-yellow-400 mt-1">
                                      ⚠️ This device is linked with {linkedPartner.type_name}. Consider selecting both or neither.
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Quick action to select linked pair */}
                              {device.isLinked && linkedPartner && !isSelected && !partnerSelected && (
                                <div className="px-3 pb-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTransferItems(prev => [...prev, { id: `device-${device.device_id}`, type: 'individual' as const, devices: [device] }, { id: `device-${linkedPartner.device_id}`, type: 'individual' as const, devices: [linkedPartner] }]);
                                    }}
                                    className="w-full text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded transition"
                                  >
                                    🔗 Select Linked Pair ({device.type_name} + {linkedPartner.type_name})
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Remark */}
              <div>
                <label className="block text-white font-semibold mb-2">Remark (Optional)</label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Enter any additional notes or reasons for transfer..."
                  className="w-full bg-neutral-700 text-white p-3 rounded-lg border border-neutral-600 h-24 resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSubmitTransfer}
                  disabled={loading || !fromLabId || !toLabId || allSelectedDevices.length === 0 || !assignmentValidation.allOk}
                  className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-neutral-600 disabled:cursor-not-allowed text-white rounded-lg transition font-semibold"
                >
                  {loading ? 'Submitting...' : 'Submit Transfer Request'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transfer History */}
        <div className="mt-10 bg-neutral-800/95 rounded-2xl backdrop-blur-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">Transfer History</h2>
              <p className="text-sm text-gray-400 mt-1">Approved and rejected transfer records</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchTransferHistory}
                className="text-xs px-3 py-1.5 rounded bg-neutral-600 hover:bg-neutral-500 text-white"
              >
                🔄 Refresh
              </button>
              <button
                onClick={handleExportHistoryExcel}
                className="text-xs px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white"
              >
                📥 Export Excel
              </button>
              <button
                onClick={handleExportHistoryPdf}
                className="text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white"
              >
                📄 Export PDF
              </button>
            </div>
          </div>

          {loadingHistory ? (
            <div className="text-center py-10 text-gray-400">Loading transfer history...</div>
          ) : transferHistory.length === 0 ? (
            <div className="text-center py-10 text-gray-400">No transfer history found</div>
          ) : (
            <div className="space-y-4">
              {transferHistory.map((transfer) => (
                <div
                  key={transfer.transfer_id}
                  className="bg-neutral-700/50 rounded-lg p-5 border border-neutral-600"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-sm text-gray-400">
                        Transfer #{transfer.transfer_id}
                        {transfer.transfer_type === 'station' && (
                          <span className="ml-2 text-xs bg-purple-600 text-white px-2 py-0.5 rounded">Entire Station</span>
                        )}
                      </div>
                      <div className="text-lg font-semibold text-white mt-1">
                        {transfer.from_lab_name} → {transfer.to_lab_name}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        Requested by: {transfer.requested_by_name || transfer.requested_by || 'Unknown'}
                        {transfer.requested_at && ` on ${new Date(transfer.requested_at).toLocaleString()}`}
                      </div>
                      <div className="text-sm text-gray-400">
                        {transfer.approved_by || transfer.approved_by_name
                          ? `Processed by: ${transfer.approved_by_name || transfer.approved_by}`
                          : 'Processed by: —'}
                        {transfer.approved_at && ` on ${new Date(transfer.approved_at).toLocaleString()}`}
                      </div>
                    </div>
                    <span
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${
                        transfer.status === 'approved'
                          ? 'bg-green-700/60 border border-green-500 text-green-200'
                          : 'bg-red-700/60 border border-red-500 text-red-200'
                      }`}
                    >
                      {transfer.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="text-sm text-gray-400 mb-2">Devices:</div>
                    <div className="bg-neutral-800/50 rounded p-3 space-y-1">
                      {(transfer.devices || []).map((device) => {
                        const destMap = (transfer.device_dest_map || {}) as Record<string, number>;
                        const destCellId = destMap[String(device.device_id)];
                        const cellMeta = destCellId ? historyDestCellMap[String(transfer.to_lab_id)]?.[destCellId] : undefined;
                        const cellLabel = destCellId
                          ? (cellMeta ? `R${cellMeta.row},C${cellMeta.column}` : `Cell ${destCellId}`)
                          : '—';

                        return (
                          <div key={device.device_id} className="text-sm text-white py-1 flex items-center gap-2">
                            <span>{getDeviceEmoji(device.type_name)}</span>
                            <span>{device.type_name} - {device.brand} {device.model}</span>
                            {device.asset_id && <span className="text-gray-400">({device.asset_id})</span>}
                            {device.assigned_code && <span className="text-green-300 font-mono text-xs">[{device.assigned_code}]</span>}
                            {device.station_code && <span className="text-cyan-400 text-xs">@ {device.station_code}</span>}
                            <span className="text-[10px] bg-cyan-800/60 border border-cyan-500 text-cyan-100 px-1.5 py-0.5 rounded">
                              → {cellLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {transfer.remark && (
                    <div>
                      <div className="text-sm text-gray-400">Remark:</div>
                      <div className="text-white text-sm mt-1">{transfer.remark}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Transfers;
