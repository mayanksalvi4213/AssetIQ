"use client";
import React, { useEffect, useId, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LogoButton } from "@/components/ui/logo-button";
import { useAuth } from "@/contexts/AuthContext";
import { WobbleCard } from "@/components/ui/wobble-card";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
interface Device {
  device_id: number;
  asset_id?: string;
  assigned_code?: string;
  lab_id?: number;
  lab_name?: string;
  type_id?: number;
  type_name?: string;
  brand?: string;
  model?: string;
  specification?: string;
  invoice_number?: string;
  bill_id?: number;
  purchase_date?: string | null;
  unit_price?: number;
  is_active?: boolean;
  warranty_expiry?: string | null;
  qr_value?: string;
}

export default function WarrantyExpiry() {
  const [active, setActive] = useState<string | null>(null);
  const { logout } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'expired' | 'urgent' | 'warning' | 'good'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLabs, setExpandedLabs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://localhost:5000/get_all_devices");
      const data = await res.json();
      if (data && data.success) {
        setDevices(data.devices || []);
      } else if (data && data.devices) {
        setDevices(data.devices || []);
      } else {
        setError("Failed to fetch devices");
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  // Compute summary
  const now = new Date();
  let totalDevices = 0;
  let expiring30 = 0;
  let expiring90 = 0;
  let expired = 0;
  let good = 0;

  devices.forEach((d) => {
    totalDevices++;
    const expiry = d.warranty_expiry ? new Date(d.warranty_expiry) : null;
    if (!expiry) return;
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) expired++;
    else if (days <= 30) expiring30++;
    else if (days <= 90) expiring90++;
    else good++;
  });

  // Filter devices based on status
  const getDeviceStatus = (device: Device) => {
    const expiry = device.warranty_expiry ? new Date(device.warranty_expiry) : null;
    if (!expiry) return 'unknown';
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'expired';
    if (days <= 30) return 'urgent';
    if (days <= 90) return 'warning';
    return 'good';
  };

  const filteredDevices = filterStatus === 'all' 
    ? devices 
    : devices.filter(d => getDeviceStatus(d) === filterStatus);

  // Apply search filter
  const searchFilteredDevices = searchTerm.trim() === ''
    ? filteredDevices
    : filteredDevices.filter(d => 
        (d.type_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.brand?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.model?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.asset_id?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.assigned_code?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.lab_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()))
      );

  // Group devices by lab
  const labGroups = searchFilteredDevices.reduce((map: Record<string, Device[]>, d) => {
    const key = d.lab_name || 'Unassigned';
    if (!map[key]) map[key] = [];
    map[key].push(d);
    return map;
  }, {} as Record<string, Device[]>);

  const toggleLab = (labName: string) => {
    const newExpanded = new Set(expandedLabs);
    if (newExpanded.has(labName)) {
      newExpanded.delete(labName);
    } else {
      newExpanded.add(labName);
    }
    setExpandedLabs(newExpanded);
  };

  const expandAll = () => {
    setExpandedLabs(new Set(Object.keys(labGroups)));
  };

  const collapseAll = () => {
    setExpandedLabs(new Set());
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center py-12 px-4" style={{
      backgroundColor: "#1c1c1c",
      backgroundImage: 'url(/bg.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
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

      <h1 className="text-3xl font-bold mb-6 mt-16 text-gray-200">📋 Warranty Management Dashboard</h1>

      {/* Search Bar */}
      <div className="w-full max-w-7xl mb-4">
        <PlaceholdersAndVanishInput
          placeholders={[
            "🔍 Search by device name...",
            "🔍 Search by brand or model...",
            "🔍 Search by asset ID...",
            "🔍 Search by lab name...",
            "🔍 Search by invoice number...",
          ]}
          onChange={(e) => setSearchTerm(e.target.value)}
          onSubmit={(e) => e.preventDefault()}
        />
      </div>

      {/* Enhanced Summary Cards */}
      <div className="w-full max-w-7xl grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div onClick={() => setFilterStatus('all')}>
          <WobbleCard
            containerClassName={`cursor-pointer ${
              filterStatus === 'all' 
                ? 'bg-blue-600 ring-2 ring-blue-400' 
                : 'bg-neutral-800'
            }`}
            className="p-4"
          >
            <div className="w-full text-center">
              <div className="text-4xl mb-2">📊</div>
              <div className="text-xs text-gray-100 uppercase font-semibold">Total Devices</div>
              <div className="text-3xl font-bold text-white">{totalDevices}</div>
            </div>
          </WobbleCard>
        </div>

        <div onClick={() => setFilterStatus('expired')}>
          <WobbleCard
            containerClassName={`cursor-pointer ${
              filterStatus === 'expired' 
                ? 'bg-red-600 ring-2 ring-red-400' 
                : 'bg-neutral-800'
            }`}
            className="p-4"
          >
            <div className="w-full text-center">
              <div className="text-4xl mb-2">❌</div>
              <div className="text-xs text-gray-100 uppercase font-semibold">Expired</div>
              <div className="text-3xl font-bold text-red-300">{expired}</div>
              <div className="text-[10px] text-gray-200 mt-1">Action Required</div>
            </div>
          </WobbleCard>
        </div>

        <div onClick={() => setFilterStatus('urgent')}>
          <WobbleCard
            containerClassName={`cursor-pointer ${
              filterStatus === 'urgent' 
                ? 'bg-orange-600 ring-2 ring-orange-400' 
                : 'bg-neutral-800'
            }`}
            className="p-4"
          >
            <div className="w-full text-center">
              <div className="text-4xl mb-2">🚨</div>
              <div className="text-xs text-gray-100 uppercase font-semibold">Urgent (≤30d)</div>
              <div className="text-3xl font-bold text-orange-300">{expiring30}</div>
              <div className="text-[10px] text-gray-200 mt-1">Renew Soon</div>
            </div>
          </WobbleCard>
        </div>

        <div onClick={() => setFilterStatus('warning')}>
          <WobbleCard
            containerClassName={`cursor-pointer ${
              filterStatus === 'warning' 
                ? 'bg-yellow-600 ring-2 ring-yellow-400' 
                : 'bg-neutral-800'
            }`}
            className="p-4"
          >
            <div className="w-full text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <div className="text-xs text-gray-100 uppercase font-semibold">Warning (≤90d)</div>
              <div className="text-3xl font-bold text-yellow-300">{expiring90}</div>
              <div className="text-[10px] text-gray-200 mt-1">Plan Renewal</div>
            </div>
          </WobbleCard>
        </div>

        <div onClick={() => setFilterStatus('good')}>
          <WobbleCard
            containerClassName={`cursor-pointer ${
              filterStatus === 'good' 
                ? 'bg-green-600 ring-2 ring-green-400' 
                : 'bg-neutral-800'
            }`}
            className="p-4"
          >
            <div className="w-full text-center">
              <div className="text-4xl mb-2">✅</div>
              <div className="text-xs text-gray-100 uppercase font-semibold">Good (&gt;90d)</div>
              <div className="text-3xl font-bold text-green-300">{good}</div>
              <div className="text-[10px] text-gray-200 mt-1">No Action</div>
            </div>
          </WobbleCard>
        </div>
      </div>

      <div className="w-full max-w-7xl">
        {loading ? (
          <div className="text-white">Loading...</div>
        ) : error ? (
          <div className="text-red-400">{error}</div>
        ) : (
          <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-4">
            {Object.keys(labGroups).length === 0 ? (
              <div className="text-gray-400 text-center py-8">
                {searchTerm ? `No devices found matching "${searchTerm}"` : 'No devices found.'}
              </div>
            ) : (
              <>
                {/* Lab count info and controls */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    <span className="font-semibold text-white">{Object.keys(labGroups).length}</span> lab{Object.keys(labGroups).length !== 1 ? 's' : ''} · 
                    <span className="font-semibold text-white ml-1">{searchFilteredDevices.length}</span> device{searchFilteredDevices.length !== 1 ? 's' : ''}
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')}
                        className="text-blue-400 hover:text-blue-300 text-xs ml-3"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={expandAll}
                      className="px-3 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 text-white rounded transition"
                    >
                      Expand All
                    </button>
                    <button
                      onClick={collapseAll}
                      className="px-3 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 text-white rounded transition"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                {/* Lab Groups */}
                {Object.entries(labGroups).map(([labName, deviceList]) => {
                  const isExpanded = expandedLabs.has(labName);
                  const uniqueId = `lab-${labName.replace(/\s+/g, '-')}`;
                  
                  // Compute lab-level stats
                  let labExpired = 0;
                  let labUrgent = 0;
                  let labWarning = 0;
                  let labGood = 0;
                  
                  deviceList.forEach((d) => {
                    const status = getDeviceStatus(d);
                    if (status === 'expired') labExpired++;
                    else if (status === 'urgent') labUrgent++;
                    else if (status === 'warning') labWarning++;
                    else if (status === 'good') labGood++;
                  });

                  return (
                    <motion.div 
                      key={labName}
                      layoutId={uniqueId}
                      className="mb-4 border border-neutral-700 rounded-lg overflow-hidden"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* Lab Header - Clickable */}
                      <motion.button
                        layout
                        onClick={() => toggleLab(labName)}
                        className="w-full px-4 py-3 bg-neutral-800 hover:bg-neutral-750 transition flex items-center justify-between text-left"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{isExpanded ? '📂' : '📁'}</span>
                          <div>
                            <div className="font-semibold text-white text-lg">{labName}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {deviceList.length} device{deviceList.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Mini status badges */}
                          {labExpired > 0 && (
                            <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full font-semibold">
                              ❌ {labExpired}
                            </span>
                          )}
                          {labUrgent > 0 && (
                            <span className="px-2 py-1 bg-orange-600 text-white text-xs rounded-full font-semibold">
                              🚨 {labUrgent}
                            </span>
                          )}
                          {labWarning > 0 && (
                            <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded-full font-semibold">
                              ⚠️ {labWarning}
                            </span>
                          )}
                          {labGood > 0 && (
                            <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full font-semibold">
                              ✅ {labGood}
                            </span>
                          )}
                          
                          <span className="text-gray-400 ml-2">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        </div>
                      </motion.button>

                      {/* Lab Content - Expandable */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 bg-neutral-900">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {deviceList.map((d, idx) => {
                              const expiry = d.warranty_expiry ? new Date(d.warranty_expiry) : null;
                              const days = expiry ? Math.ceil((expiry.getTime() - now.getTime())/(1000*60*60*24)) : null;
                              const status = getDeviceStatus(d);
                              
                              // Define status styles
                              const statusConfig = {
                                expired: { 
                                  bg: 'bg-red-900/40 border-2 border-red-500', 
                                  badge: 'bg-red-600 text-white', 
                                  icon: '❌', 
                                  label: 'EXPIRED',
                                  textColor: 'text-red-400'
                                },
                                urgent: { 
                                  bg: 'bg-orange-900/40 border-2 border-orange-500', 
                                  badge: 'bg-orange-600 text-white', 
                                  icon: '🚨', 
                                  label: 'URGENT',
                                  textColor: 'text-orange-400'
                                },
                                warning: { 
                                  bg: 'bg-yellow-900/40 border-2 border-yellow-500', 
                                  badge: 'bg-yellow-600 text-white', 
                                  icon: '⚠️', 
                                  label: 'WARNING',
                                  textColor: 'text-yellow-400'
                                },
                                good: { 
                                  bg: 'bg-green-900/40 border border-green-700', 
                                  badge: 'bg-green-600 text-white', 
                                  icon: '✅', 
                                  label: 'GOOD',
                                  textColor: 'text-green-400'
                                },
                                unknown: { 
                                  bg: 'bg-neutral-800/60 border border-neutral-700', 
                                  badge: 'bg-gray-600 text-white', 
                                  icon: '❓', 
                                  label: 'NO DATA',
                                  textColor: 'text-gray-400'
                                }
                              };
                              
                              const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.unknown;
                              
                              // Calculate progress bar width (0-100%)
                              const warrantyDays = 365;
                              const progressPercent = days !== null && days >= 0 
                                ? Math.min(100, Math.max(0, (days / warrantyDays) * 100))
                                : 0;

                              return (
                                <motion.div 
                                  key={d.device_id} 
                                  className={`p-4 rounded-lg ${config.bg} relative overflow-hidden transition hover:shadow-lg`}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: idx * 0.05, duration: 0.2 }}
                                  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                                >
                                  {/* Status Badge */}
                                  <div className="absolute top-2 right-2">
                                    <div className={`${config.badge} px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1`}>
                                      <span>{config.icon}</span>
                                      <span>{config.label}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-col gap-3">
                                    {/* Device Info */}
                                    <div className="pr-20">
                                      <div className="font-bold text-white text-lg">{d.type_name || d.type_id}</div>
                                      <div className="text-sm text-gray-300">{d.brand} {d.model}</div>
                                      <div className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                                        <span>🏷️ {d.asset_id || d.assigned_code || 'N/A'}</span>
                                        {d.invoice_number && (
                                          <span className="text-[10px] bg-neutral-700/50 px-1.5 py-0.5 rounded">
                                            📄 {d.invoice_number}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Progress Bar */}
                                    {days !== null && days >= 0 && (
                                      <div className="w-full bg-neutral-700 rounded-full h-2 overflow-hidden">
                                        <div 
                                          className={`h-full transition-all ${
                                            progressPercent > 50 ? 'bg-green-500' : 
                                            progressPercent > 25 ? 'bg-yellow-500' : 
                                            'bg-red-500'
                                          }`}
                                          style={{ width: `${progressPercent}%` }}
                                        />
                                      </div>
                                    )}
                                    
                                    {/* Warranty Info */}
                                    <div className="flex items-center justify-between bg-black/20 rounded p-2">
                                      <div>
                                        <div className="text-[10px] text-gray-400 uppercase">Expiry Date</div>
                                        <div className={`font-semibold ${config.textColor}`}>
                                          {expiry ? expiry.toLocaleDateString() : 'N/A'}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-[10px] text-gray-400 uppercase">Time Left</div>
                                        <div className={`font-bold text-lg ${config.textColor}`}>
                                          {days === null ? 'N/A' : days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Additional Info */}
                                    <div className="flex items-center justify-between text-xs">
                                      {d.specification && (
                                        <div className="text-gray-400 italic truncate flex-1">{d.specification}</div>
                                      )}
                                      <div className="text-green-400 font-semibold ml-2">
                                        ₹{d.unit_price ? Number(d.unit_price).toFixed(2) : '0.00'}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}