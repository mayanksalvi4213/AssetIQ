"use client";
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { WobbleCard } from "@/components/ui/wobble-card";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { LogoButton } from "@/components/ui/logo-button";

interface GridCell {
  id: string | null;
  equipmentType: string;
  os: string[];
  deviceGroup?: {
    assignedCode: string;
    devices: any[];
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
  const [labs, setLabs] = useState<LabListItem[]>([]);
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);
  const [billDetails, setBillDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingBill, setLoadingBill] = useState(false);

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
      } else {
        setError("Failed to fetch lab details");
      }
    } catch (err) {
      console.error("Error fetching lab details:", err);
      setError("Error fetching lab details from server");
    }
  };

  const handleLabClick = (lab: LabListItem) => {
    fetchLabDetails(lab.lab_id);
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
              <HoveredLink href="/lab-configuration">Lab Configuration</HoveredLink>
            </div>
          </MenuItem>

          <MenuItem setActive={setActive} active={active} item="Operations">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/dashboard/transfers">Transfers</HoveredLink>
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
                <h2 className="text-2xl font-bold">{selectedLab.labName} - Floor Plan</h2>
                <div className="flex flex-col items-end text-sm text-gray-300">
                  <span className="font-semibold text-white">Lab Cost</span>
                  <span className="text-green-400 text-lg font-bold">₹{labCost.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => setSelectedLab(null)}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition"
                >
                  Close
                </button>
              </div>

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
                          
                          // Check what devices are in this station
                          let hasPC = false;
                          let hasMonitor = false;
                          let hasLaptop = false;
                          let hasOther = false;
                          
                          if (hasDevices && cell.deviceGroup) {
                            cell.deviceGroup.devices.forEach((device: any) => {
                              const deviceType = device.type?.toLowerCase() || '';
                              if (deviceType === 'pc') hasPC = true;
                              else if (deviceType === 'monitor') hasMonitor = true;
                              else if (deviceType === 'laptop') hasLaptop = true;
                              else hasOther = true;
                            });
                          }
                          
                          // Determine emoji based on devices
                          let emoji = "";
                          if (hasLaptop) emoji = "💻";
                          else if (hasPC && hasMonitor) emoji = "🖥️";
                          else if (hasPC) emoji = "⚙️";
                          else if (hasMonitor) emoji = "🖥️";
                          else if (hasOther) emoji = "🔧";
                          
                          return (
                            <div
                              key={colIdx}
                              onClick={() => hasDevices && setSelectedDevice(cell)}
                              className={`
                                w-24 h-24 rounded-lg border-2 flex flex-col items-center justify-center transition 
                                ${hasDevices ? "cursor-pointer" : ""}
                                ${hasDevices 
                                  ? "bg-green-600 border-green-400 hover:bg-green-700" 
                                  : ""}
                                ${cell.equipmentType === "Empty" || !hasDevices
                                  ? "bg-neutral-800 border-gray-600" 
                                  : ""}
                              `}
                            >
                              {cell.equipmentType !== "Empty" && hasDevices ? (
                                <>
                                  <div className="text-white font-bold text-xs">{cell.id}</div>
                                  <div className="text-white text-xl">
                                    {emoji}
                                  </div>
                                  <div className="flex gap-1 mt-1 flex-wrap justify-center">
                                    {hasWindows && (
                                      <div className="text-xs px-1 py-0.5 bg-blue-800 text-white rounded">
                                        Win
                                      </div>
                                    )}
                                    {hasLinux && (
                                      <div className="text-xs px-1 py-0.5 bg-orange-600 text-white rounded">
                                        Linux
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <div className="text-gray-500 text-xs">Empty</div>
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
                      <div className="w-4 h-4 bg-green-600 rounded"></div>
                      <span className="text-sm text-gray-300">Configured Station</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-neutral-800 border border-gray-600 rounded"></div>
                      <span className="text-sm text-gray-300">Empty</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  No seating arrangement configured for this lab.
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
                          {device.brand && (
                            <p className="text-sm text-gray-400">Brand: {device.brand}</p>
                          )}
                          {device.model && (
                            <p className="text-sm text-gray-400">Model: {device.model}</p>
                          )}
                          {device.specification && (
                            <p className="text-sm text-gray-400">Spec: {device.specification}</p>
                          )}
                          {device.invoiceNumber && (
                            <p className="text-sm text-gray-400">Invoice: {device.invoiceNumber}</p>
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
      </div>
    </div>
  );
}
