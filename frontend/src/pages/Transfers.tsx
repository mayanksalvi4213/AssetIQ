"use client";
import React, { useState, useEffect } from "react";
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
}

interface Station {
  stationId: number;
  assignedCode: string;
  row: number;
  column: number;
  os: string;
  devices: Device[];
}

interface Lab {
  lab_id: string;
  lab_name: string;
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
  requested_at?: string;
  approved_by?: string;
  approved_at?: string;
}

const Transfers: React.FC = () => {
  const [active, setActive] = useState<string | null>(null);
  const { logout, user } = useAuth();
  const [view, setView] = useState<'create' | 'pending'>(user?.role === 'HOD' ? 'pending' : 'create');
  
  // Create Transfer Form State
  const [fromLabId, setFromLabId] = useState<string | null>(null);
  const [toLabId, setToLabId] = useState<string | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Device[]>([]);
  const [remark, setRemark] = useState("");
  
  // Data State
  const [labs, setLabs] = useState<Lab[]>([]);
  const [availableStations, setAvailableStations] = useState<Station[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showStationGrid, setShowStationGrid] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);

  useEffect(() => {
    fetchLabs();
    if (user?.role === 'HOD') {
      fetchPendingTransfers();
    }
  }, [user]);

  useEffect(() => {
    if (fromLabId) {
      fetchStationsFromLab(fromLabId);
    }
  }, [fromLabId]);

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

  const fetchStationsFromLab = async (labId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      console.log("Fetching stations for lab_id:", labId);
      const response = await fetch(`http://127.0.0.1:5000/get_lab_station_list/${labId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      console.log("Station fetch response:", data);
      if (data.success) {
        // Map backend response to frontend interface
        const mappedStations = data.stations.map((station: any) => ({
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
            assigned_code: station.assignedCode,
            isLinked: device.isLinked,
            linkedGroupId: device.linkedGroupId
          }))
        }));
        console.log("Setting available stations:", mappedStations.length, "stations");
        setAvailableStations(mappedStations);
        setShowStationGrid(true);
      } else {
        console.error("Failed to fetch stations:", data.error);
        setAvailableStations([]);
      }
    } catch (error) {
      console.error("Error fetching stations:", error);
      setAvailableStations([]);
    } finally {
      setLoading(false);
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

  const handleDeviceToggle = (device: Device) => {
    setSelectedDevices(prev => {
      const exists = prev.find(d => d.device_id === device.device_id);
      
      if (exists) {
        // Simply remove the clicked device
        return prev.filter(d => d.device_id !== device.device_id);
      } else {
        // Simply add the clicked device
        return [...prev, device];
      }
    });
  };

  const handleTransferEntireStation = (station: Station) => {
    // Add all devices from this station
    const newDevices = station.devices.filter(device => 
      !selectedDevices.some(d => d.device_id === device.device_id)
    );
    setSelectedDevices(prev => [...prev, ...newDevices]);
    setSelectedStation(null);
    setShowDeviceSelector(false);
  };

  const handleStationClick = (station: Station) => {
    setSelectedStation(station);
    setShowDeviceSelector(true);
  };

  const handleSubmitTransfer = async () => {
    if (!fromLabId || !toLabId || selectedDevices.length === 0) {
      alert("Please select source lab, destination lab, and at least one device");
      return;
    }

    if (fromLabId === toLabId) {
      alert("Source and destination labs cannot be the same");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:5000/create_transfer_request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          from_lab_id: fromLabId,
          to_lab_id: toLabId,
          device_ids: selectedDevices.map(d => d.device_id),
          remark: remark,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert("Transfer request submitted successfully!");
        setFromLabId(null);
        setToLabId(null);
        setSelectedDevices([]);
        setRemark("");
        setAvailableStations([]);
        setShowStationGrid(false);
      } else {
        alert(data.error || "Failed to submit transfer request");
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

        {/* HOD - Pending Transfers View */}
        {user?.role === 'HOD' ? (
          <div className="bg-neutral-800/95 rounded-2xl backdrop-blur-sm p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">Pending Transfer Requests</h2>
            
            {pendingTransfers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                No pending transfer requests
              </div>
            ) : (
              <div className="space-y-4">
                {pendingTransfers.map((transfer) => (
                  <div key={transfer.transfer_id} className="bg-neutral-700/50 rounded-lg p-5 border border-neutral-600">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-sm text-gray-400">Transfer Request #{transfer.transfer_id}</div>
                        <div className="text-lg font-semibold text-white mt-1">
                          {transfer.from_lab_name} → {transfer.to_lab_name}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          Requested by: {transfer.requested_by} on {new Date(transfer.requested_at!).toLocaleString()}
                        </div>
                      </div>
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
                    </div>

                    <div className="mb-3">
                      <div className="text-sm text-gray-400 mb-2">Devices to Transfer:</div>
                      <div className="bg-neutral-800/50 rounded p-3">
                        {transfer.devices?.map((device, idx) => (
                          <div key={device.device_id} className="text-sm text-white py-1">
                            {idx + 1}. {device.type_name} - {device.brand} {device.model} 
                            {device.asset_id && ` (${device.asset_id})`}
                            {device.assigned_code && ` [${device.assigned_code}]`}
                          </div>
                        ))}
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
        ) : (
          /* Create Transfer Form - For Lab Incharge/Assistant and HOD */
          <div className="bg-neutral-800/95 rounded-2xl backdrop-blur-sm p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white">Create Transfer Request</h2>
              <p className="text-sm text-gray-400 mt-1">
                Select source lab, destination lab, and devices to transfer
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

              {/* Selected Devices Display */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-white font-semibold">
                    Selected Devices ({selectedDevices.length})
                  </label>
                </div>

                {selectedDevices.length > 0 && (
                  <div className="bg-neutral-700/50 rounded-lg p-4 mb-3">
                    {(() => {
                      // Group linked devices that are both selected
                      const processedDeviceIds = new Set<number>();
                      const displayItems: Array<{ type: 'single' | 'linked', devices: Device[] }> = [];
                      
                      selectedDevices.forEach(device => {
                        if (processedDeviceIds.has(device.device_id)) return;
                        
                        // Check if this device is linked and its partner is also selected
                        if (device.isLinked && device.linkedGroupId) {
                          const linkedPartner = selectedDevices.find(
                            d => d.device_id !== device.device_id && 
                                 d.linkedGroupId === device.linkedGroupId
                          );
                          
                          if (linkedPartner) {
                            // Both devices are selected - show as linked group
                            displayItems.push({
                              type: 'linked',
                              devices: [device, linkedPartner]
                            });
                            processedDeviceIds.add(device.device_id);
                            processedDeviceIds.add(linkedPartner.device_id);
                          } else {
                            // Only this device is selected - show individually
                            displayItems.push({
                              type: 'single',
                              devices: [device]
                            });
                            processedDeviceIds.add(device.device_id);
                          }
                        } else {
                          // Not a linked device - show individually
                          displayItems.push({
                            type: 'single',
                            devices: [device]
                          });
                          processedDeviceIds.add(device.device_id);
                        }
                      });
                      
                      return displayItems.map((item, idx) => (
                        <div key={idx} className={`py-2 border-b border-neutral-600 last:border-0 ${
                          item.type === 'linked' ? 'bg-purple-900/20 rounded px-2 my-1' : ''
                        }`}>
                          {item.type === 'linked' ? (
                            // Linked pair display
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <div className="text-purple-400 text-xs font-semibold flex items-center gap-1">
                                  🔗 Linked Pair
                                </div>
                                <button
                                  onClick={() => {
                                    // Remove both devices
                                    item.devices.forEach(d => handleDeviceToggle(d));
                                  }}
                                  className="text-red-400 hover:text-red-300 text-sm"
                                >
                                  Remove Both
                                </button>
                              </div>
                              {item.devices.map((device, devIdx) => (
                                <div key={device.device_id} className="text-white text-sm ml-4">
                                  {devIdx + 1}. {device.type_name} - {device.brand} {device.model}
                                  {device.asset_id && ` (${device.asset_id})`}
                                  {device.assigned_code && ` [${device.assigned_code}]`}
                                </div>
                              ))}
                            </div>
                          ) : (
                            // Individual device display
                            <div className="flex justify-between items-center">
                              <div className="text-white text-sm">
                                {selectedDevices.indexOf(item.devices[0]) + 1}. {item.devices[0].type_name} - {item.devices[0].brand} {item.devices[0].model}
                                {item.devices[0].asset_id && ` (${item.devices[0].asset_id})`}
                                {item.devices[0].assigned_code && ` [${item.devices[0].assigned_code}]`}
                                {item.devices[0].isLinked && (
                                  <span className="ml-2 text-xs bg-purple-600 text-white px-2 py-0.5 rounded">🔗 Linked</span>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeviceToggle(item.devices[0])}
                                className="text-red-400 hover:text-red-300 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {/* Station Grid */}
              {fromLabId && showStationGrid && (
                <div className="bg-neutral-700/50 rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-3">Lab Floor Plan - Click on a Station</h3>
                  {loading ? (
                    <div className="text-center text-gray-400 py-4">Loading lab layout...</div>
                  ) : availableStations.length === 0 ? (
                    <div className="text-center text-gray-400 py-4">No stations found in this lab</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="inline-block">
                        {(() => {
                          // Calculate grid dimensions
                          const maxRow = Math.max(...availableStations.map(s => s.row));
                          const maxCol = Math.max(...availableStations.map(s => s.column));
                          
                          // Create a 2D grid map
                          const gridMap = new Map<string, Station>();
                          availableStations.forEach(station => {
                            gridMap.set(`${station.row}-${station.column}`, station);
                          });
                          
                          // Generate grid rows
                          const rows = [];
                          for (let row = 0; row <= maxRow; row++) {
                            const cells = [];
                            for (let col = 0; col <= maxCol; col++) {
                              const station = gridMap.get(`${row}-${col}`);
                              const hasWindows = station?.os.includes('Win');
                              const hasLinux = station?.os.includes('Linux');
                              
                              cells.push(
                                <div
                                  key={`${row}-${col}`}
                                  onClick={() => station && handleStationClick(station)}
                                  className={`
                                    w-24 h-24 rounded-lg border-2 flex flex-col items-center justify-center transition 
                                    ${station ? "cursor-pointer bg-green-600 border-green-400 hover:bg-green-700" : "bg-neutral-800 border-gray-600"}
                                  `}
                                >
                                  {station ? (
                                    <>
                                      <div className="text-white font-bold text-xs mb-1">{station.assignedCode}</div>
                                      <div className="text-white text-2xl">🖥️</div>
                                      <div className="flex gap-1 mt-1 flex-wrap justify-center">
                                        {hasWindows && (
                                          <div className="text-xs px-1 py-0.5 bg-blue-800 text-white rounded">Win</div>
                                        )}
                                        {hasLinux && (
                                          <div className="text-xs px-1 py-0.5 bg-orange-600 text-white rounded">Linux</div>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-gray-500 text-xs">Empty</div>
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
                        })()}
                      </div>
                    </div>
                  )}
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
                      <h3 className="text-white text-xl font-semibold">Station: {selectedStation.assignedCode}</h3>
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
                      <button
                        onClick={() => handleTransferEntireStation(selectedStation)}
                        className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold"
                      >
                        Transfer Entire Station ({selectedStation.devices.length} devices)
                      </button>
                    </div>

                    <div className="border-t border-neutral-600 pt-4">
                      <h4 className="text-white font-semibold mb-3">Or Select Individual Devices:</h4>
                      <div className="space-y-2">
                        {selectedStation.devices.map((device) => {
                          const isSelected = selectedDevices.some(d => d.device_id === device.device_id);
                          
                          // Find linked partner if exists
                          const linkedPartner = device.isLinked && device.linkedGroupId
                            ? selectedStation.devices.find(
                                d => d.device_id !== device.device_id && 
                                     d.linkedGroupId === device.linkedGroupId
                              )
                            : null;
                          
                          const partnerSelected = linkedPartner 
                            ? selectedDevices.some(d => d.device_id === linkedPartner.device_id)
                            : false;
                          
                          return (
                            <div
                              key={device.device_id}
                              className={`rounded border transition ${
                                isSelected
                                  ? 'bg-green-600/30 border-green-500'
                                  : 'bg-neutral-700/30 hover:bg-neutral-700/50 border-neutral-600'
                              }`}
                            >
                              <div
                                onClick={() => handleDeviceToggle(device)}
                                className="p-3 cursor-pointer"
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <div className="text-white text-sm">
                                      {device.type_name} - {device.brand} {device.model}
                                      {device.asset_id && ` (${device.asset_id})`}
                                      {device.isLinked && (
                                        <span className="ml-2 text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded">🔗 Linked</span>
                                      )}
                                    </div>
                                    {isSelected && (
                                      <span className="text-green-400 text-sm">✓ Selected</span>
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
                                      setSelectedDevices(prev => [...prev, device, linkedPartner]);
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
                  disabled={loading || !fromLabId || !toLabId || selectedDevices.length === 0}
                  className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-neutral-600 disabled:cursor-not-allowed text-white rounded-lg transition font-semibold"
                >
                  {loading ? 'Submitting...' : 'Submit Transfer Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Transfers;
