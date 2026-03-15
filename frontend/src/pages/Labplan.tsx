"use client";
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { WobbleCard } from "@/components/ui/wobble-card";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { LogoButton } from "@/components/ui/logo-button";
import { useAuth } from "@/contexts/AuthContext";
import { QRCodeSVG } from "qrcode.react";

interface GridCell {
  id: string | null;
  equipmentType: string;
  os: string[];
  deviceGroup?: {
    assignedCode: string;
    devices: any[];
    stationQrValue?: string;
  };
}

interface SeatingArrangement {
  rows: number;
  columns: number;
  grid: GridCell[][];
}

interface Equipment {
  type: string;
  brand: string;
  model: string;
  specification: string;
  quantity: number;
  invoiceNumber: string;
  billId: number;
  unitPrice?: number;
}

interface Lab {
  labNumber: string;
  labName: string;
  equipment: Equipment[];
  assignedCodePrefix: string;
  seatingArrangement: SeatingArrangement;
}

interface LabListItem {
  lab_id: string;
  lab_name: string;
  rows: number;
  columns: number;
}

export default function Labplan() {
  const [active, setActive] = useState<string | null>(null);
  const { logout } = useAuth();
  const [labs, setLabs] = useState<LabListItem[]>([]);
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);
  const [billDetails, setBillDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [stationList, setStationList] = useState<any[]>([]);
  const [loadingStationList, setLoadingStationList] = useState(false);
  const [showPrintQR, setShowPrintQR] = useState(false);
  const [stationQrModal, setStationQrModal] = useState<{
    stationCode: string;
    qrValue: string;
    devices: { type: string; prefixCode: string; brand: string; model: string }[];
  } | null>(null);
  const [pendingOutgoingDeviceIds, setPendingOutgoingDeviceIds] = useState<Set<number>>(new Set());

  // Fetch all labs on component mount
  useEffect(() => {
    fetchLabs();
  }, []);

  const fetchLabs = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/get_labs");
      const data = await response.json();
      
      if (data.success) {
        setLabs(data.labs);
      } else {
        setError("Failed to fetch labs");
      }
    } catch (err) {
      console.error("Error fetching labs:", err);
      setError("Error fetching labs from server");
    } finally {
      setLoading(false);
    }
  };

  const fetchLabDetails = async (labId: string) => {
    try {
      const response = await fetch(`http://localhost:5000/get_lab/${labId}`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedLab(data.lab);
        // Fetch station list as well
        fetchStationList(labId);
        // Fetch pending transfer info
        fetchPendingTransferInfo(labId);
      } else {
        setError("Failed to fetch lab details");
      }
    } catch (err) {
      console.error("Error fetching lab details:", err);
      setError("Error fetching lab details from server");
    }
  };

  const fetchStationList = async (labId: string) => {
    try {
      setLoadingStationList(true);
      const response = await fetch(`http://localhost:5000/get_lab_station_list/${labId}`);
      const data = await response.json();
      
      if (data.success) {
        setStationList(data.stations);
      } else {
        console.error("Failed to fetch station list:", data.error);
      }
    } catch (err) {
      console.error("Error fetching station list:", err);
    } finally {
      setLoadingStationList(false);
    }
  };

  const handleLabClick = (lab: LabListItem) => {
    fetchLabDetails(lab.lab_id);
  };

  const fetchPendingTransferInfo = async (labId: string) => {
    try {
      const response = await fetch(`http://localhost:5000/get_lab_pending_transfer_info/${labId}`);
      const data = await response.json();
      if (data.success) {
        setPendingOutgoingDeviceIds(new Set((data.outgoing_device_ids || []).map(Number)));
      }
    } catch (err) {
      console.error("Error fetching pending transfer info:", err);
    }
  };

  // Computed stats
  const labStats = useMemo(() => {
    if (!stationList || stationList.length === 0) return null;
    const activeStations = stationList.filter((s: any) => s.devices && s.devices.length > 0);
    const totalDevices = activeStations.reduce((sum: number, s: any) => sum + (s.devices?.length || 0), 0);
    const activeDevices = activeStations.reduce((sum: number, s: any) =>
      sum + (s.devices?.filter((d: any) => d.isActive).length || 0), 0);
    const issueDevices = activeStations.reduce((sum: number, s: any) =>
      sum + (s.devices?.filter((d: any) => d.issues && d.issues.length > 0).length || 0), 0);
    const deviceTypes: Record<string, number> = {};
    activeStations.forEach((s: any) => s.devices?.forEach((d: any) => {
      deviceTypes[d.type] = (deviceTypes[d.type] || 0) + 1;
    }));
    return { activeStations: activeStations.length, emptyStations: stationList.length - activeStations.length, totalDevices, activeDevices, issueDevices, deviceTypes };
  }, [stationList]);

  // Filter only stations with devices for the table
  const activeStationList = useMemo(() => {
    if (!stationList) return [];
    return stationList.filter((s: any) => s.devices && s.devices.length > 0);
  }, [stationList]);

  const exportToExcel = () => {
    if (!activeStationList || activeStationList.length === 0) {
      alert("No station data to export");
      return;
    }

    // Create CSV content with prefix code column
    let csv = "Station Code,Position,Operating System,Device Type,Brand,Model,Specification,Prefix Code,Asset Code,Unit Price,Warranty (Years),Purchase Date,Invoice Number,Status\n";
    
    activeStationList.forEach((station: any) => {
      station.devices.forEach((device: any, idx: number) => {
        const status = device.isActive ? 'Active' : (device.issues?.length > 0 ? 'Has Issues' : 'Inactive');
        if (idx === 0) {
          csv += `"${station.assignedCode}","R${station.row}C${station.column}","${station.os}","${device.type}","${device.brand}","${device.model}","${device.specification || ''}","${device.prefixCode || ''}","${device.assetCode || ''}","${device.unitPrice || 0}","${device.warrantyYears || ''}","${device.purchaseDate || ''}","${device.invoiceNumber || ''}","${status}"\n`;
        } else {
          csv += `"","","","${device.type}","${device.brand}","${device.model}","${device.specification || ''}","${device.prefixCode || ''}","${device.assetCode || ''}","${device.unitPrice || 0}","${device.warrantyYears || ''}","${device.purchaseDate || ''}","${device.invoiceNumber || ''}","${status}"\n`;
        }
      });
    });

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedLab?.labName || 'lab'}_station_list.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchBillDetails = async (billId: number) => {
    try {
      setLoadingBill(true);
      console.log("Fetching bill details for bill ID:", billId);
      const response = await fetch(`http://localhost:5000/get_bill/${billId}`);
      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Bill data received:", data);
      
      if (data.success) {
        setBillDetails(data);
      } else {
        console.error("Failed to fetch bill:", data.error);
        alert(`Failed to fetch bill details: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Error fetching bill details:", err);
      alert(`Error fetching bill details: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoadingBill(false);
    }
  };

  const handleEquipmentClick = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    fetchBillDetails(equipment.billId);
  };

  // search bar demo
  const placeholders = ["Search labs...", "Find equipment...", "Search by batch..."];
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("Search:", e.target.value);
  };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Search submitted");
  };

  const labCost = useMemo(() => {
    if (!selectedLab || !selectedLab.equipment) return 0;
    return selectedLab.equipment.reduce((sum, eq) => {
      const price = eq.unitPrice || 0;
      const qty = eq.quantity || 0;
      return sum + price * qty;
    }, 0);
  }, [selectedLab]);

  // Prepare QR codes for printing — includes both station QR and individual device QRs
  const qrCodesToPrint = useMemo(() => {
    if (!activeStationList || activeStationList.length === 0) return [];
    
    const qrList: any[] = [];
    
    activeStationList.forEach((station: any) => {
      // 1) Station-level QR (shows all devices in station)
      const stationQr = station.stationQrValue || '';
      if (stationQr) {
        qrList.push({
          assignedCode: station.assignedCode,
          type: "Station QR",
          assetCode: station.devices.map((d: any) => d.prefixCode || d.assetCode).filter(Boolean).join(", "),
          qrValue: stationQr,
          displayInfo: station.devices.map((d: any) => `${d.type}: ${d.brand} ${d.model}`).join(' | '),
          isStation: true
        });
      }

      // 2) Individual device QRs
      station.devices.forEach((device: any) => {
        const qrValue = device.qrValue || `Station: ${station.assignedCode}\nDevice: ${device.type}\nBrand: ${device.brand}\nModel: ${device.model}\nPrefix Code: ${device.prefixCode || 'N/A'}\nAsset Code: ${device.assetCode || 'N/A'}\nInvoice: ${device.invoiceNumber || 'N/A'}\nWarranty: ${device.warrantyYears || 'N/A'} years\nPrice: \u20b9${device.unitPrice || 0}`;
        
        qrList.push({
          assignedCode: station.assignedCode,
          type: device.type,
          assetCode: device.assetCode,
          prefixCode: device.prefixCode,
          qrValue: qrValue,
          displayInfo: `${device.brand} ${device.model}${device.specification ? ` - ${device.specification}` : ''}`,
          isStation: false
        });
      });
    });
    
    return qrList;
  }, [activeStationList]);

  const handlePrintQRCodes = () => {
    setShowPrintQR(true);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white" style={{
      backgroundImage: 'url(/bg.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      <LogoButton />
      {/* ✅ Top Navbar with Search */}
      <div className="fixed top-4 inset-x-0 max-w-7xl mx-auto z-50 flex items-center justify-between px-6">
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

        <div className="w-full max-w-sm">
          <PlaceholdersAndVanishInput
            placeholders={placeholders}
            onChange={handleChange}
            onSubmit={onSubmit}
          />
        </div>
      </div>

      {/* ✅ Page Content */}
      <div className="pt-32 px-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Lab Floor Plans</h1>

        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading labs...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {/* ✅ Wobble Cards List */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {labs.map((lab) => (
              <div key={lab.lab_id} onClick={() => handleLabClick(lab)} className="cursor-pointer">
                <WobbleCard containerClassName="bg-neutral-800 p-6 rounded-xl h-40">
                  <h2 className="text-2xl font-semibold">{lab.lab_name}</h2>
                  <p className="text-gray-400">Lab ID: {lab.lab_id}</p>
                  <p className="text-gray-400">{lab.rows} × {lab.columns} grid</p>
                </WobbleCard>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && labs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">No labs found. Create a lab in Lab Configuration first.</p>
          </div>
        )}

        {/* ✅ Selected Lab Floor Plan */}
        {selectedLab && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-12"
          >
            <BackgroundGradient className="p-8 rounded-xl shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{selectedLab.labName} - Floor Plan</h2>
                  <p className="text-gray-400 text-sm">Lab ID: {selectedLab.labNumber} | Grid: {selectedLab.seatingArrangement?.rows ?? 0}×{selectedLab.seatingArrangement?.columns ?? 0}</p>
                </div>
                <div className="flex flex-col items-end text-sm text-gray-300">
                  <span className="font-semibold text-white">Total Lab Cost</span>
                  <span className="text-green-400 text-lg font-bold">₹{labCost.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => setSelectedLab(null)}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition"
                >
                  Close
                </button>
              </div>

              {/* Lab Stats Summary */}
              {labStats && (
                <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-green-900/40 border border-green-700 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-400">{labStats.activeStations}</p>
                    <p className="text-xs text-gray-300">Active Stations</p>
                  </div>
                  <div className="bg-neutral-800 border border-neutral-600 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-400">{labStats.emptyStations}</p>
                    <p className="text-xs text-gray-300">Empty Stations</p>
                  </div>
                  <div className="bg-blue-900/40 border border-blue-700 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-400">{labStats.totalDevices}</p>
                    <p className="text-xs text-gray-300">Total Devices</p>
                  </div>
                  <div className="bg-cyan-900/40 border border-cyan-700 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-cyan-400">{labStats.activeDevices}</p>
                    <p className="text-xs text-gray-300">Active Devices</p>
                  </div>
                  <div className={`border rounded-lg p-3 text-center ${labStats.issueDevices > 0 ? 'bg-red-900/40 border-red-700' : 'bg-neutral-800 border-neutral-600'}`}>
                    <p className={`text-2xl font-bold ${labStats.issueDevices > 0 ? 'text-red-400' : 'text-gray-400'}`}>{labStats.issueDevices}</p>
                    <p className="text-xs text-gray-300">With Issues</p>
                  </div>
                </div>
              )}

              {/* Device Type Breakdown */}
              {labStats && Object.keys(labStats.deviceTypes).length > 0 && (
                <div className="mb-6 flex flex-wrap gap-2">
                  {Object.entries(labStats.deviceTypes).map(([type, count]) => (
                    <span key={type} className="px-3 py-1 bg-neutral-800 border border-neutral-600 rounded-full text-sm">
                      {type}: <span className="text-white font-bold">{count}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Equipment Summary */}
              {selectedLab.equipment && selectedLab.equipment.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Equipment Pool</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedLab.equipment.map((eq, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => handleEquipmentClick(eq)}
                        className="bg-neutral-800 p-3 rounded-lg cursor-pointer hover:bg-neutral-700 transition"
                      >
                        <p className="font-semibold">{eq.type}</p>
                        <p className="text-sm text-gray-400">{eq.brand} {eq.model}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm text-gray-400">Qty: {eq.quantity}</p>
                          {eq.unitPrice && eq.unitPrice > 0 && (
                            <p className="text-sm text-green-400 font-semibold">₹{eq.unitPrice.toFixed(2)}/unit</p>
                          )}
                        </div>
                        <p className="text-xs text-blue-400 mt-1">📄 Invoice: {eq.invoiceNumber}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Render seating arrangement */}
              {selectedLab.seatingArrangement ? (
                <div className="overflow-x-auto">
                  <div className="inline-block">
                    {selectedLab.seatingArrangement.grid.map((row, rowIdx) => (
                      <div key={rowIdx} className="flex gap-2 mb-2">
                        {row.map((cell, colIdx) => {
                          const hasDevices = cell.deviceGroup && cell.deviceGroup.devices.length > 0;
                          const hasWindows = cell.os.includes("Windows");
                          const hasLinux = cell.os.includes("Linux");
                          const deviceCount = cell.deviceGroup?.devices?.length || 0;
                          const hasIssues = cell.deviceGroup?.devices?.some((d: any) => d.issues && d.issues.length > 0);
                          const isStationType = cell.equipmentType !== "Empty";
                          
                          // Determine emoji based on device type or station/equipment type
                          let emoji = "🔧";
                          if (hasDevices && cell.deviceGroup && cell.deviceGroup.devices.length > 0) {
                            const deviceType = cell.deviceGroup.devices[0].type?.toLowerCase() || '';
                            if (deviceType === 'laptop') emoji = "💻";
                            else if (deviceType === 'pc') emoji = "🖥️";
                            else if (deviceType === 'monitor') emoji = "🖥️";
                            else if (deviceType === 'ac') emoji = "❄️";
                            else if (deviceType === 'smart board') emoji = "📺";
                            else if (deviceType === 'projector') emoji = "📽️";
                            else if (deviceType === 'printer') emoji = "🖨️";
                            else if (deviceType === 'scanner') emoji = "📠";
                            else if (deviceType === 'ups') emoji = "🔋";
                            else if (deviceType === 'router') emoji = "📡";
                            else if (deviceType === 'switch') emoji = "🔌";
                            else if (deviceType === 'server') emoji = "🗄️";
                            else if (deviceType === 'keyboard') emoji = "⌨️";
                            else if (deviceType === 'mouse') emoji = "🖱️";
                            else if (deviceType === 'webcam') emoji = "📷";
                            else if (deviceType === 'headset') emoji = "🎧";
                          } else if (isStationType) {
                            // Emoji for station types without devices
                            const eqType = cell.equipmentType?.toLowerCase() || '';
                            if (eqType.includes('cctv') || eqType.includes('camera')) emoji = "📹";
                            else if (eqType.includes('passage') || eqType.includes('walkway')) emoji = "🚶";
                            else if (eqType.includes('door')) emoji = "🚪";
                            else if (eqType.includes('network')) emoji = "🌐";
                            else if (eqType.includes('printer')) emoji = "🖨️";
                            else if (eqType.includes('server')) emoji = "🗄️";
                            else if (eqType.includes('ac') || eqType.includes('air')) emoji = "❄️";
                            else if (eqType.includes('ups') || eqType.includes('power')) emoji = "🔋";
                            else if (eqType.includes('smart board') || eqType.includes('board')) emoji = "📺";
                            else if (eqType.includes('projector')) emoji = "📽️";
                            else if (eqType.includes('window')) emoji = "🪟";
                            else if (eqType.includes('wall')) emoji = "🧱";
                            else emoji = "📍";
                          }
                          
                          // Determine cell styling
                          let cellBg = "bg-neutral-800 border-gray-600";
                          if (hasDevices) {
                            cellBg = hasIssues
                              ? "bg-yellow-900/60 border-yellow-500 hover:bg-yellow-900/80"
                              : "bg-green-900/60 border-green-500 hover:bg-green-900/80";
                          } else if (isStationType) {
                            cellBg = "bg-neutral-800/80 border-cyan-800/60";
                          }
                          
                          return (
                            <div
                              key={colIdx}
                              className={`
                                w-28 rounded-lg border-2 flex flex-col items-center justify-center transition p-1
                                ${hasDevices ? "cursor-pointer" : ""}
                                ${cellBg}
                              `}
                              style={{ minHeight: hasDevices ? `${Math.max(96, 60 + deviceCount * 14)}px` : '96px' }}
                              onClick={() => hasDevices && setSelectedDevice(cell)}
                              title={hasDevices ? cell.deviceGroup!.devices.map((d: any) => `${d.type}: ${d.assignedCode || d.type}`).join('\n') : cell.equipmentType}
                            >
                              {hasDevices ? (
                                <>
                                  <div className="text-white font-bold text-[10px] truncate w-full text-center">
                                    {cell.deviceGroup?.assignedCode || cell.id || "—"}
                                  </div>
                                  <div className="text-white text-lg leading-none">{emoji}</div>
                                  {/* Device prefix codes */}
                                  <div className="text-center w-full space-y-0.5 mt-0.5">
                                    {cell.deviceGroup!.devices.map((d: any, di: number) => (
                                      <div key={di} className="text-green-300 text-[9px] font-mono leading-tight truncate" title={d.assignedCode || ''}>
                                        {d.assignedCode || d.type}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex gap-1 mt-0.5 flex-wrap justify-center">
                                    {hasWindows && <div className="text-[8px] px-1 bg-blue-800 text-white rounded">Win</div>}
                                    {hasLinux && <div className="text-[8px] px-1 bg-orange-600 text-white rounded">Linux</div>}
                                  </div>
                                  {/* Station QR button */}
                                  <button
                                    className="mt-0.5 px-1.5 py-0.5 bg-cyan-600 hover:bg-cyan-700 text-white text-[8px] rounded flex items-center gap-0.5"
                                    title="View Station QR"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const stQr = cell.deviceGroup?.stationQrValue || '';
                                      const codes = cell.deviceGroup!.devices.map((d: any) => d.assignedCode || '').filter(Boolean);
                                      const stationCode = cell.deviceGroup?.assignedCode || cell.id || `R${rowIdx}C${colIdx}`;
                                      const fallbackQr = stQr || `STATION|${stationCode}|${codes.join(',')}`;
                                      setStationQrModal({
                                        stationCode: stationCode,
                                        qrValue: fallbackQr,
                                        devices: cell.deviceGroup!.devices.map((d: any) => ({
                                          type: d.type,
                                          prefixCode: d.assignedCode || '',
                                          brand: d.brand || '',
                                          model: d.model || '',
                                        })),
                                      });
                                    }}
                                  >
                                    📱 QR
                                  </button>
                                  {/* Pending transfer badge */}
                                  {cell.deviceGroup!.devices.some((d: any) => pendingOutgoingDeviceIds.has(d.deviceId)) && (
                                    <div className="text-[8px] px-1.5 py-0.5 rounded bg-orange-600 text-white font-semibold mt-0.5">
                                      ⏳ Transfer Pending
                                    </div>
                                  )}
                                </>
                              ) : isStationType ? (
                                <>
                                  <div className="text-cyan-300 text-xl leading-none mb-1">{emoji}</div>
                                  <div className="text-cyan-200/80 font-medium text-[10px] text-center leading-tight">{cell.equipmentType}</div>
                                  {cell.id && (
                                    <div className="text-gray-500 text-[8px] mt-0.5 font-mono">{cell.id}</div>
                                  )}
                                </>
                              ) : (
                                <div className="text-gray-600 text-xs">Empty</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  
                  {/* Legend */}
                  <div className="mt-6 flex gap-6 items-center flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-900/60 border border-green-500 rounded"></div>
                      <span className="text-sm text-gray-300">Configured Station</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-yellow-900/60 border border-yellow-500 rounded"></div>
                      <span className="text-sm text-gray-300">Has Issues</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-neutral-800/80 border border-cyan-800/60 rounded"></div>
                      <span className="text-sm text-gray-300">Station Type (no devices)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-neutral-800 border border-gray-600 rounded"></div>
                      <span className="text-sm text-gray-300">Empty</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-orange-800 border border-orange-500 rounded"></div>
                      <span className="text-sm text-gray-300">Transfer Pending (outgoing)</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  No seating arrangement configured for this lab.
                </div>
              )}

              {/* ✅ Station List Table (stations with devices only) */}
              {stationList && stationList.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold">Station Details</h3>
                      <p className="text-gray-400 text-sm mt-1">
                        Showing {activeStationList.length} stations with devices (out of {stationList.length} total)
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handlePrintQRCodes}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center gap-2"
                      >
                        🖨️ Print QR Codes
                      </button>
                      <button
                        onClick={exportToExcel}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center gap-2"
                      >
                        📥 Export to Excel
                      </button>
                      <button
                        onClick={() => {
                          if (!selectedLab) return;
                          window.open(`http://localhost:5000/export_lab_station_pdf/${selectedLab.labNumber}`, '_blank');
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center gap-2"
                      >
                        📄 Export to PDF
                      </button>
                    </div>
                  </div>

                  {loadingStationList ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400">Loading station details...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto bg-neutral-900 rounded-lg border border-neutral-700">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-neutral-800 border-b-2 border-neutral-600">
                          <tr>
                            <th className="px-4 py-3 font-bold text-white">Station</th>
                            <th className="px-4 py-3 font-bold text-white">Position</th>
                            <th className="px-4 py-3 font-bold text-white">OS</th>
                            <th className="px-4 py-3 font-bold text-white">Devices</th>
                            <th className="px-4 py-3 font-bold text-white">Prefix Codes</th>
                            <th className="px-4 py-3 font-bold text-white">Station QR</th>
                            <th className="px-4 py-3 font-bold text-white">Device QRs</th>
                            <th className="px-4 py-3 font-bold text-white">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-700">
                          {activeStationList.map((station, idx) => (
                            <tr key={idx} className="hover:bg-neutral-800/70 transition-colors">
                              <td className="px-4 py-3">
                                <span className="font-bold text-white text-base">
                                  {station.assignedCode}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                                R{station.row} C{station.column}
                              </td>
                              <td className="px-4 py-3">
                                {station.os ? (
                                  <div className="flex flex-wrap gap-1">
                                    {station.os.split(',').map((osName: string, osIdx: number) => {
                                      const trimmed = osName.trim();
                                      return (
                                        <span key={osIdx} className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                                          trimmed === 'Windows' ? 'bg-blue-600/80 text-blue-100' :
                                          trimmed === 'Linux' ? 'bg-orange-600/80 text-orange-100' :
                                          trimmed === 'Dual Boot' ? 'bg-purple-600/80 text-purple-100' :
                                          'bg-gray-600/80 text-gray-200'
                                        }`}>
                                          {trimmed}
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-gray-500 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="space-y-3">
                                  {station.devices.map((device: any, deviceIdx: number) => (
                                    <div key={deviceIdx} className="bg-neutral-800 p-3 rounded-lg border border-neutral-600">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-white text-sm">
                                          {device.type}:
                                        </span>
                                        <span className="text-gray-200 font-medium">
                                          {device.brand} {device.model}
                                        </span>
                                      </div>
                                      {device.assetCode && (
                                        <div className="text-blue-400 font-mono text-xs mb-1">
                                          Asset: {device.assetCode}
                                        </div>
                                      )}
                                      {device.specification && (
                                        <div className="text-gray-400 italic text-xs mb-1">
                                          {device.specification}
                                        </div>
                                      )}
                                      <div className="flex gap-4 text-gray-300 mt-2 text-xs flex-wrap">
                                        {device.unitPrice > 0 && (
                                          <span className="font-semibold">₹{device.unitPrice.toFixed(2)}</span>
                                        )}
                                        {device.warrantyYears && (
                                          <span>Warranty: {device.warrantyYears}y</span>
                                        )}
                                        {device.purchaseDate && (
                                          <span>Purchased: {new Date(device.purchaseDate).toLocaleDateString()}</span>
                                        )}
                                        {device.invoiceNumber && (
                                          <span className="text-blue-300">Invoice: {device.invoiceNumber}</span>
                                        )}
                                      </div>
                                      
                                      {/* Display Issues */}
                                      {device.issues && device.issues.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                          {device.issues.map((issue: any, issueIdx: number) => (
                                            <div 
                                              key={issueIdx} 
                                              className={`p-2 rounded border-l-4 ${
                                                issue.severity === 'high' || issue.severity === 'critical' 
                                                  ? 'bg-red-900/30 border-red-500' 
                                                  : issue.severity === 'medium' 
                                                  ? 'bg-yellow-900/30 border-yellow-500'
                                                  : 'bg-blue-900/30 border-blue-500'
                                              }`}
                                            >
                                              <div className="flex items-start justify-between mb-1">
                                                <span className="font-bold text-xs text-white uppercase">
                                                  {issue.severity === 'high' || issue.severity === 'critical' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🔵'} {issue.severity}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                  {issue.reportedAt ? new Date(issue.reportedAt).toLocaleDateString() : ''}
                                                </span>
                                              </div>
                                              <p className="text-white text-xs font-semibold mb-1">{issue.title}</p>
                                              {issue.description && (
                                                <p className="text-gray-300 text-xs">{issue.description}</p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                              {/* Prefix Codes column */}
                              <td className="px-4 py-3">
                                <div className="space-y-1">
                                  {station.devices.map((device: any, dIdx: number) => (
                                    <div key={dIdx} className="flex items-center gap-1">
                                      <span className="text-green-400 font-mono text-xs font-bold">
                                        {device.prefixCode || '—'}
                                      </span>
                                      <span className="text-gray-500 text-[10px]">({device.type})</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                              {/* Station QR column */}
                              <td className="px-4 py-3">
                                {(() => {
                                  const codes = station.devices.map((d: any) => d.prefixCode || d.assetCode || '').filter(Boolean);
                                  const stQr = station.stationQrValue || `STATION|${station.assignedCode}|${codes.join(',')}`;
                                  return (
                                    <div className="flex flex-col items-center">
                                      <div className="bg-white p-2 rounded cursor-pointer hover:shadow-lg transition"
                                        onClick={() => setStationQrModal({
                                          stationCode: station.assignedCode,
                                          qrValue: stQr,
                                          devices: station.devices.map((d: any) => ({
                                            type: d.type,
                                            prefixCode: d.prefixCode || '',
                                            brand: d.brand || '',
                                            model: d.model || '',
                                          })),
                                        })}
                                      >
                                        <QRCodeSVG value={stQr} size={64} />
                                      </div>
                                      <button
                                        className="mt-1 text-cyan-400 hover:text-cyan-300 text-[10px] underline"
                                        onClick={() => setStationQrModal({
                                          stationCode: station.assignedCode,
                                          qrValue: stQr,
                                          devices: station.devices.map((d: any) => ({
                                            type: d.type,
                                            prefixCode: d.prefixCode || '',
                                            brand: d.brand || '',
                                            model: d.model || '',
                                          })),
                                        })}
                                      >
                                        View Full
                                      </button>
                                    </div>
                                  );
                                })()}
                              </td>
                              {/* Individual Device QRs column */}
                              <td className="px-4 py-3">
                                <div className="space-y-2">
                                  {station.devices.map((device: any, qrIdx: number) => {
                                    const qrVal = device.qrValue || `${device.invoiceNumber || ''}|${device.prefixCode || device.assetCode || ''}`;
                                    return (
                                      <div key={qrIdx} className="flex flex-col items-center bg-white p-2 rounded">
                                        <QRCodeSVG value={qrVal} size={60} />
                                        <span className="text-[10px] text-black mt-1 font-mono">{device.prefixCode || device.type}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {station.devices.every((d: any) => d.isActive) ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                                    <span className="text-green-400 text-xs font-medium">Active</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                                    <span className="text-red-400 text-xs font-medium">Issues</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </BackgroundGradient>
          </motion.div>
        )}

        {/* ✅ Device Details Modal */}
        {selectedDevice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            onClick={() => setSelectedDevice(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-neutral-900 p-6 rounded-xl shadow-lg w-96 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Station: {selectedDevice.id}</h3>
                <button
                  className="text-gray-400 hover:text-white"
                  onClick={() => setSelectedDevice(null)}
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-gray-300">Equipment Type:</p>
                  <p className="text-white">{selectedDevice.equipmentType}</p>
                </div>

                {selectedDevice.os && selectedDevice.os.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-300">Operating Systems:</p>
                    <div className="flex gap-2 mt-1">
                      {selectedDevice.os.map((os: string, idx: number) => (
                        <span key={idx} className="px-2 py-1 bg-blue-600 text-white text-sm rounded">
                          {os}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDevice.deviceGroup && selectedDevice.deviceGroup.devices.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-300 mb-2">Assigned Devices:</p>
                    <div className="space-y-3">
                      {selectedDevice.deviceGroup.devices.map((device: any, idx: number) => (
                        <div key={idx} className="bg-neutral-800 p-3 rounded-lg">
                          <p className="font-semibold">{device.type}</p>
                          {device.assignedCode && (
                            <p className="text-sm text-green-400 font-mono font-bold">Prefix: {device.assignedCode}</p>
                          )}
                          {device.brand && (
                            <p className="text-sm text-gray-400">Brand: {device.brand}</p>
                          )}
                          {device.model && (
                            <p className="text-sm text-gray-400">Model: {device.model}</p>
                          )}
                          {device.specification && (
                            <p className="text-sm text-gray-400">Spec: {device.specification}</p>
                          )}
                          {device.assetCode && (
                            <p className="text-sm text-blue-400 font-mono">Asset: {device.assetCode}</p>
                          )}
                          {device.invoiceNumber && (
                            <p className="text-sm text-gray-400">Invoice: {device.invoiceNumber}</p>
                          )}
                          {device.unitPrice > 0 && (
                            <p className="text-sm text-gray-400">Price: ₹{device.unitPrice}</p>
                          )}
                          {device.warrantyYears && (
                            <p className="text-sm text-gray-400">Warranty: {device.warrantyYears} years</p>
                          )}
                          {device.isLinked && (
                            <span className="text-xs px-2 py-1 bg-purple-600 text-white rounded mt-1 inline-block">
                              Linked Group: {device.linkedGroupId}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <button
                className="mt-6 w-full px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition text-white"
                onClick={() => setSelectedDevice(null)}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* ✅ Bill Details Modal */}
        {selectedEquipment && billDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            onClick={() => {
              setSelectedEquipment(null);
              setBillDetails(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-neutral-900 p-6 rounded-xl shadow-lg w-[600px] max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Bill Details</h3>
                <button
                  className="text-gray-400 hover:text-white"
                  onClick={() => {
                    setSelectedEquipment(null);
                    setBillDetails(null);
                  }}
                >
                  ✕
                </button>
              </div>
              
              {loadingBill ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">Loading bill details...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Equipment Info */}
                  <div className="bg-neutral-800 p-4 rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">Selected Equipment</h4>
                    <p className="text-white">{selectedEquipment.type} - {selectedEquipment.brand} {selectedEquipment.model}</p>
                    <p className="text-sm text-gray-400">Quantity: {selectedEquipment.quantity}</p>
                    <p className="text-sm text-gray-400">Specification: {selectedEquipment.specification}</p>
                  </div>

                  {/* Bill Information */}
                  <div className="bg-neutral-800 p-4 rounded-lg">
                    <h4 className="font-semibold text-lg mb-3">Bill Information</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-400">Invoice Number</p>
                        <p className="text-white">{billDetails.bill.invoiceNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Bill Date</p>
                        <p className="text-white">{billDetails.bill.billDate || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Total Amount</p>
                        <p className="text-white">₹{billDetails.bill.totalAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Tax Amount</p>
                        <p className="text-white">₹{billDetails.bill.taxAmount.toFixed(2)}</p>
                      </div>
                      {billDetails.bill.stockEntry && (
                        <div className="col-span-2">
                          <p className="text-xs text-gray-400">Stock Entry</p>
                          <p className="text-white">{billDetails.bill.stockEntry}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vendor Information */}
                  <div className="bg-neutral-800 p-4 rounded-lg">
                    <h4 className="font-semibold text-lg mb-3">Vendor Information</h4>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-400">Vendor Name</p>
                        <p className="text-white">{billDetails.bill.vendorName}</p>
                      </div>
                      {billDetails.bill.vendorGstin && (
                        <div>
                          <p className="text-xs text-gray-400">GSTIN</p>
                          <p className="text-white">{billDetails.bill.vendorGstin}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* All Devices from this Bill */}
                  {billDetails.devices && billDetails.devices.length > 0 && (
                    <div className="bg-neutral-800 p-4 rounded-lg">
                      <h4 className="font-semibold text-lg mb-3">
                        Matching Devices ({billDetails.devices.filter((d: any) => 
                          d.brand === selectedEquipment.brand && 
                          d.model === selectedEquipment.model
                        ).length})
                      </h4>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {billDetails.devices
                          .filter((device: any) => 
                            device.brand === selectedEquipment.brand && 
                            device.model === selectedEquipment.model
                          )
                          .map((device: any, idx: number) => (
                          <div key={idx} className="bg-neutral-700 p-3 rounded">
                            <div className="flex items-start justify-between mb-2">
                              <p className="text-white font-semibold">{device.brand} {device.model}</p>
                              {device.isActive && (
                                <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded">
                                  Active
                                </span>
                              )}
                            </div>
                            
                            {device.assetCode && (
                              <p className="text-blue-400 text-sm font-mono">Asset: {device.assetCode}</p>
                            )}
                            
                            {device.assignedCode ? (
                              <p className="text-gray-400 text-xs">📍 Assigned: {device.assignedCode}</p>
                            ) : (
                              <p className="text-yellow-400 text-xs">⚠️ Not assigned yet</p>
                            )}
                            
                            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                              {device.unitPrice > 0 && (
                                <p className="text-gray-400">Price: ₹{device.unitPrice.toFixed(2)}</p>
                              )}
                              {device.warrantyYears && (
                                <p className="text-gray-400">Warranty: {device.warrantyYears} yrs</p>
                              )}
                              {device.purchaseDate && (
                                <p className="text-gray-400">Purchased: {device.purchaseDate}</p>
                              )}
                              {device.dept && (
                                <p className="text-gray-400">Dept: {device.dept}</p>
                              )}
                            </div>
                            
                            {device.specification && (
                              <p className="text-gray-500 text-xs mt-1 italic">{device.specification}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
              
              <button
                className="mt-6 w-full px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition text-white"
                onClick={() => {
                  setSelectedEquipment(null);
                  setBillDetails(null);
                }}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* ✅ Print QR Codes Modal */}
        {showPrintQR && (
          <>
            {/* Screen View */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 print:hidden"
              onClick={() => setShowPrintQR(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="bg-white p-8 rounded-xl shadow-lg w-[90vw] h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-black">
                      {selectedLab?.labName} - QR Codes
                    </h2>
                    <p className="text-gray-600">Preview before printing</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                    >
                      🖨️ Print
                    </button>
                    <button
                      onClick={() => setShowPrintQR(false)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-6">
                  {qrCodesToPrint.map((qr, idx) => (
                    <div key={idx} className={`border-2 p-4 rounded-lg flex flex-col items-center ${
                      qr.isStation ? 'border-cyan-400 bg-cyan-50' : 'border-gray-300 bg-gray-50'
                    }`}>
                      <QRCodeSVG value={qr.qrValue} size={150} />
                      <div className="mt-3 text-center">
                        <p className="font-bold text-lg text-black">{qr.assignedCode}</p>
                        {qr.isStation ? (
                          <p className="text-sm text-cyan-700 font-semibold">📍 Station QR</p>
                        ) : (
                          <p className="text-sm text-gray-700">{qr.type}</p>
                        )}
                        {qr.prefixCode && (
                          <p className="text-xs text-green-700 font-mono font-bold mt-1">{qr.prefixCode}</p>
                        )}
                        {qr.assetCode && (
                          <p className="text-xs text-gray-600 font-mono mt-1">{qr.assetCode}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* Print View */}
            <div className="hidden print:block">
              <style>
                {`
                  @media print {
                    body * {
                      visibility: hidden;
                    }
                    .print-qr-container, .print-qr-container * {
                      visibility: visible;
                    }
                    .print-qr-container {
                      position: absolute;
                      left: 0;
                      top: 0;
                      width: 100%;
                    }
                    @page {
                      margin: 0.5in;
                    }
                  }
                `}
              </style>
              <div className="print-qr-container p-8 bg-white">
                <h1 className="text-3xl font-bold text-black mb-2">
                  {selectedLab?.labName} - QR Codes
                </h1>
                <p className="text-gray-700 mb-8">Scan these QR codes to identify each station/device</p>
                
                <div className="grid grid-cols-3 gap-6">
                  {qrCodesToPrint.map((qr, idx) => (
                    <div key={idx} className={`border-2 p-4 rounded-lg flex flex-col items-center ${
                      qr.isStation ? 'border-cyan-600' : 'border-black'
                    }`}>
                      <QRCodeSVG value={qr.qrValue} size={150} />
                      <div className="mt-3 text-center">
                        <p className="font-bold text-lg text-black">{qr.assignedCode}</p>
                        {qr.isStation ? (
                          <p className="text-sm text-gray-700 font-semibold">Station QR</p>
                        ) : (
                          <p className="text-sm text-gray-700">{qr.type}</p>
                        )}
                        {qr.prefixCode && (
                          <p className="text-xs text-gray-600 font-mono font-bold mt-1">{qr.prefixCode}</p>
                        )}
                        {qr.assetCode && (
                          <p className="text-xs text-gray-600 font-mono mt-1">{qr.assetCode}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ✅ Station QR Modal */}
        {stationQrModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            onClick={() => setStationQrModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-neutral-900 p-6 rounded-xl shadow-lg w-[420px] max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Station QR: {stationQrModal.stationCode}</h3>
                <button
                  className="text-gray-400 hover:text-white"
                  onClick={() => setStationQrModal(null)}
                >
                  ✕
                </button>
              </div>
              
              <div className="flex flex-col items-center mb-4">
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeSVG value={stationQrModal.qrValue} size={200} />
                </div>
                <p className="text-gray-400 text-xs mt-2 font-mono break-all text-center max-w-[350px]">
                  {stationQrModal.qrValue}
                </p>
              </div>

              <div className="mt-4">
                <h4 className="font-semibold text-gray-300 mb-2">Devices at this station:</h4>
                <div className="space-y-2">
                  {stationQrModal.devices.map((d: any, i: number) => (
                    <div key={i} className="bg-neutral-800 p-2 rounded flex items-center justify-between">
                      <div>
                        <span className="text-white text-sm font-medium">{d.type}</span>
                        {d.brand && <span className="text-gray-400 text-xs ml-2">{d.brand} {d.model}</span>}
                      </div>
                      {d.prefixCode && (
                        <span className="text-green-400 font-mono text-xs font-bold">{d.prefixCode}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                className="mt-6 w-full px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition text-white"
                onClick={() => setStationQrModal(null)}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
