"use client";

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LogoButton } from "@/components/ui/logo-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Device {
  device_id: number;
  type_name: string;
  brand: string;
  model: string;
  specification?: string;
  asset_id?: string;
  assigned_code?: string;
  lab_id?: string;
  lab_name?: string;
  invoice_number: string;
  bill_id: number;
  purchase_date?: string;
  unit_price?: number;
  is_active: boolean;
  warranty_expiry?: string;
}

interface DeviceGroup {
  type: string;
  brand: string;
  model: string;
  specification?: string;
  total: number;
  assigned: number;
  unassigned: number;
  devices: Device[];
}

export default function AllAssets() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [groupedAssets, setGroupedAssets] = useState<DeviceGroup[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<DeviceGroup[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  
  const deviceTypes = [
    "All Types", "Laptop", "PC", "Monitor", "AC", "Smart Board", "Projector",
    "Printer", "Scanner", "UPS", "Router", "Switch", "Server",
    "Keyboard", "Mouse", "Webcam", "Headset", "Other"
  ];

  useEffect(() => {
    fetchAllDevices();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filterType, filterStatus, groupedAssets]);

  const fetchAllDevices = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("http://127.0.0.1:5000/get_all_devices", {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch devices");
      }

      const data = await response.json();
      
      if (data.success) {
        setDevices(data.devices);
        groupDevices(data.devices);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching devices:", error);
      setLoading(false);
    }
  };

  const groupDevices = (deviceList: Device[]) => {
    const groups = new Map<string, DeviceGroup>();
    
    deviceList.forEach(device => {
      const key = `${device.type_name}-${device.brand}-${device.model}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          type: device.type_name,
          brand: device.brand,
          model: device.model,
          specification: device.specification,
          total: 0,
          assigned: 0,
          unassigned: 0,
          devices: []
        });
      }
      
      const group = groups.get(key)!;
      group.devices.push(device);
      group.total++;
      
      if (device.is_active && device.assigned_code) {
        group.assigned++;
      } else {
        group.unassigned++;
      }
    });
    
    const grouped = Array.from(groups.values()).sort((a, b) => 
      a.type.localeCompare(b.type) || a.brand.localeCompare(b.brand)
    );
    
    setGroupedAssets(grouped);
    setFilteredAssets(grouped);
  };

  const applyFilters = () => {
    let filtered = [...groupedAssets];
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(asset => 
        asset.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.specification?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Type filter
    if (filterType !== "all") {
      filtered = filtered.filter(asset => asset.type === filterType);
    }
    
    // Status filter
    if (filterStatus === "assigned") {
      filtered = filtered.filter(asset => asset.assigned > 0);
    } else if (filterStatus === "unassigned") {
      filtered = filtered.filter(asset => asset.unassigned > 0);
    }
    
    setFilteredAssets(filtered);
  };

  const getTotalStats = () => {
    const total = devices.length;
    const assigned = devices.filter(d => d.is_active && d.assigned_code).length;
    const unassigned = total - assigned;
    
    return { total, assigned, unassigned };
  };

  const stats = getTotalStats();

  return (
    <div className="relative min-h-screen w-full bg-black text-white" style={{
      backgroundImage: 'url(/bg.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      
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
              <HoveredLink href="/lab-configuration">Lab Configuration</HoveredLink>
            </div>
          </MenuItem>

          <MenuItem setActive={setActive} active={active} item="Operations">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/transfers">Transfers</HoveredLink>
              <HoveredLink href="/issues">Issues</HoveredLink>
              <HoveredLink href="/documents">Documents</HoveredLink>
            </div>
          </MenuItem>

          <MenuItem setActive={setActive} active={active} item="Analytics">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/reports">Reports</HoveredLink>
            </div>
          </MenuItem>
        </Menu>
      </div>

      {/* Page Content */}
      <div className="flex items-center justify-center pt-24 px-4 pb-16 w-full relative z-10">
        <LogoButton />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-7xl bg-black/40 backdrop-blur-md rounded-xl shadow-lg p-8"
        >
          <h1 className="text-3xl font-bold text-center mb-6 text-white">Asset Inventory</h1>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-lg p-4">
              <div className="text-blue-400 text-sm font-semibold">Total Assets</div>
              <div className="text-3xl font-bold text-white">{stats.total}</div>
            </div>
            <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-lg p-4">
              <div className="text-green-400 text-sm font-semibold">Assigned</div>
              <div className="text-3xl font-bold text-white">{stats.assigned}</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-500/30 rounded-lg p-4">
              <div className="text-yellow-400 text-sm font-semibold">Unassigned</div>
              <div className="text-3xl font-bold text-white">{stats.unassigned}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-neutral-800/50 rounded-lg p-4 mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-white mb-2">Search</Label>
                <Input
                  type="text"
                  placeholder="Search by type, brand, model..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-neutral-700 text-white border-neutral-600"
                />
              </div>
              <div>
                <Label className="text-white mb-2">Device Type</Label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full bg-neutral-700 text-white p-2 rounded-lg border border-neutral-600"
                >
                  <option value="all">All Types</option>
                  {deviceTypes.slice(1).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-white mb-2">Status</Label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-neutral-700 text-white p-2 rounded-lg border border-neutral-600"
                >
                  <option value="all">All Status</option>
                  <option value="assigned">Assigned Only</option>
                  <option value="unassigned">Unassigned Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Assets Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-white text-lg">Loading assets...</div>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No assets found matching your filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAssets.map((asset, idx) => (
                <div key={idx} className="bg-neutral-800/50 rounded-lg overflow-hidden border border-neutral-700">
                  {/* Group Header */}
                  <div 
                    onClick={() => setExpandedGroup(expandedGroup === idx ? null : idx)}
                    className="p-4 cursor-pointer hover:bg-neutral-700/50 transition flex justify-between items-center"
                  >
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-gray-400 text-xs">Type</div>
                        <div className="text-white font-semibold">{asset.type}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs">Brand & Model</div>
                        <div className="text-white font-semibold">{asset.brand} {asset.model}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs">Total Units</div>
                        <div className="text-white font-semibold">{asset.total}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs">Assigned / Unassigned</div>
                        <div className="text-white font-semibold">
                          <span className="text-green-400">{asset.assigned}</span> / <span className="text-yellow-400">{asset.unassigned}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-white ml-4">
                      {expandedGroup === idx ? "▼" : "▶"}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedGroup === idx && (
                    <div className="border-t border-neutral-700 p-4 bg-neutral-900/50">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-neutral-700">
                              <th className="px-3 py-2 text-left text-gray-400">Asset ID</th>
                              <th className="px-3 py-2 text-left text-gray-400">Assigned Code</th>
                              <th className="px-3 py-2 text-left text-gray-400">Location</th>
                              <th className="px-3 py-2 text-left text-gray-400">Invoice</th>
                              <th className="px-3 py-2 text-left text-gray-400">Price</th>
                              <th className="px-3 py-2 text-left text-gray-400">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {asset.devices.map(device => (
                              <tr key={device.device_id} className="border-b border-neutral-800 hover:bg-neutral-800/50">
                                <td className="px-3 py-2 text-white">{device.asset_id || "-"}</td>
                                <td className="px-3 py-2 text-white">{device.assigned_code || "-"}</td>
                                <td className="px-3 py-2 text-white">
                                  {device.lab_name ? `${device.lab_name} (Lab ${device.lab_id})` : "Unassigned"}
                                </td>
                                <td className="px-3 py-2 text-white">{device.invoice_number}</td>
                                <td className="px-3 py-2 text-white">₹{device.unit_price?.toFixed(2) || "N/A"}</td>
                                <td className="px-3 py-2">
                                  {device.is_active && device.assigned_code ? (
                                    <span className="text-green-400 font-semibold">✓ Assigned</span>
                                  ) : (
                                    <span className="text-yellow-400 font-semibold">○ Available</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}