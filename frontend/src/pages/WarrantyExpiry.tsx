"use client";
import React, { useEffect, useState } from "react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LogoButton } from "@/components/ui/logo-button";

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
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Group devices by invoice_number (batch)
  const groups = devices.reduce((map: Record<string, Device[]>, d) => {
    const key = d.invoice_number || `BILL_${d.bill_id || 'unknown'}`;
    if (!map[key]) map[key] = [];
    map[key].push(d);
    return map;
  }, {} as Record<string, Device[]>);

  // Compute summary
  const now = new Date();
  let totalDevices = 0;
  let expiring30 = 0;
  let expiring90 = 0;
  let expired = 0;

  devices.forEach((d) => {
    totalDevices++;
    const expiry = d.warranty_expiry ? new Date(d.warranty_expiry) : null;
    if (!expiry) return;
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) expired++;
    else if (days <= 30) expiring30++;
    else if (days <= 90) expiring90++;
  });

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
            </div>
          </MenuItem>
        </Menu>
      </div>

      <LogoButton />

      <h1 className="text-3xl font-bold mb-6 mt-16 text-gray-200">Warranty Expiry</h1>

      <div className="w-full max-w-7xl p-6 bg-neutral-800/90 rounded-2xl mb-6">
        <div className="flex gap-6 items-center">
          <div className="text-white">
            <div className="text-xs text-gray-300">Total devices</div>
            <div className="text-2xl font-bold">{totalDevices}</div>
          </div>
          <div className="text-white">
            <div className="text-xs text-gray-300">Expiring ≤ 30 days</div>
            <div className="text-2xl font-bold text-amber-400">{expiring30}</div>
          </div>
          <div className="text-white">
            <div className="text-xs text-gray-300">Expiring ≤ 90 days</div>
            <div className="text-2xl font-bold text-yellow-300">{expiring90}</div>
          </div>
          <div className="text-white">
            <div className="text-xs text-gray-300">Expired</div>
            <div className="text-2xl font-bold text-red-500">{expired}</div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-7xl">
        {loading ? (
          <div className="text-white">Loading...</div>
        ) : error ? (
          <div className="text-red-400">{error}</div>
        ) : (
          <div className="overflow-x-auto bg-neutral-900 rounded-lg border border-neutral-700 p-4">
            {Object.keys(groups).length === 0 ? (
              <div className="text-gray-400">No devices found.</div>
            ) : (
              Object.entries(groups).map(([batch, list]) => {
                // compute soonest expiry in this batch
                let soonest: Date | null = null;
                list.forEach((d) => {
                  if (!d.warranty_expiry) return;
                  const ex = new Date(d.warranty_expiry);
                  if (!soonest || ex.getTime() < soonest.getTime()) soonest = ex;
                });
                const daysLeft = soonest ? Math.ceil((soonest.getTime() - now.getTime())/(1000*60*60*24)) : null;

                return (
                  <div key={batch} className="mb-6 border-b border-neutral-700 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm text-gray-300">Batch / Invoice</div>
                        <div className="font-semibold text-white">{batch}</div>
                        <div className="text-xs text-gray-400 mt-1">Devices: {list.length}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm ${daysLeft !== null && daysLeft <= 30 ? 'text-amber-400' : daysLeft !== null && daysLeft < 0 ? 'text-red-400' : 'text-gray-300'}`}>
                          {daysLeft === null ? 'No warranty info' : (daysLeft < 0 ? `${Math.abs(daysLeft)} days ago` : `${daysLeft} days`)}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">Soonest expiry</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {list.map((d) => {
                        const expiry = d.warranty_expiry ? new Date(d.warranty_expiry) : null;
                        const days = expiry ? Math.ceil((expiry.getTime() - now.getTime())/(1000*60*60*24)) : null;
                        const highlight = days !== null && (days <= 30 || days < 0);

                        return (
                          <div key={d.device_id} className={`p-3 rounded-lg ${highlight ? 'bg-gradient-to-r from-neutral-800 to-neutral-700 border-2 border-amber-600' : 'bg-neutral-800/60 border border-neutral-700'}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-white">{d.type_name || d.type_id} - {d.brand} {d.model}</div>
                                <div className="text-xs text-gray-400">Asset: {d.asset_id || d.assigned_code || '-'}</div>
                                {d.lab_name && <div className="text-xs text-gray-400">Lab: {d.lab_name}</div>}
                              </div>
                              <div className="text-right">
                                <div className={`font-semibold ${days !== null && days <= 30 ? 'text-amber-400' : days !== null && days < 0 ? 'text-red-400' : 'text-gray-300'}`}>
                                  {expiry ? expiry.toLocaleDateString() : 'N/A'}
                                </div>
                                <div className="text-xs text-gray-400">{days === null ? 'No warranty' : days < 0 ? `${Math.abs(days)}d ago` : `${days}d left`}</div>
                              </div>
                            </div>
                            {d.specification && <div className="text-xs text-gray-400 mt-2 italic">{d.specification}</div>}
                            <div className="text-xs text-green-300 mt-2">Price: ₹{d.unit_price ? Number(d.unit_price).toFixed(2) : '0.00'}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
