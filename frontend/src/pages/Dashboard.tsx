"use client";
import React, { useState, useEffect, useMemo } from "react";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { WobbleCard } from "@/components/ui/wobble-card";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import AppNavbar from "@/components/AppNavbar";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardStats {
  totalAssets: number;
  workingAssets: number;
  maintenanceAssets: number;
  offlineAssets: number;
  totalLabs: number;
  openIssues: number;
  pendingTransfers: number;
  warrantyExpiring30Days: number;
  warrantyExpiring90Days: number;
  expiredWarranty: number;
}

interface RecentActivity {
  type: string;
  message: string;
  timestamp: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalAssets: 0,
    workingAssets: 0,
    maintenanceAssets: 0,
    offlineAssets: 0,
    totalLabs: 0,
    openIssues: 0,
    pendingTransfers: 0,
    warrantyExpiring30Days: 0,
    warrantyExpiring90Days: 0,
    expiredWarranty: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const placeholders = [
    "Search assets by ID...",
    "Search assets by name...",
    "Search labs or locations...",
  ];
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);
  const matchingLabs = useMemo(() => {
    if (!normalizedQuery) return [];
    return labs.filter((lab: any) => {
      const haystack = [lab.lab_name, lab.lab_id, lab.incharge_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [labs, normalizedQuery]);
  const matchingDevices = useMemo(() => {
    if (!normalizedQuery) return [];
    return devices.filter((device: any) => {
      const haystack = [
        device.asset_id,
        device.assigned_code,
        device.device_id,
        device.type_name,
        device.brand,
        device.model,
        device.invoice_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [devices, normalizedQuery]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all devices for stats
      const devicesResponse = await fetch("/api/get_all_devices?include_inactive=1");
      const devicesData = await devicesResponse.json();
      if (devicesData.success) {
        setDevices(devicesData.devices || []);
      }
      
      // Fetch labs count
      const labsResponse = await fetch("/api/get_labs");
      const labsData = await labsResponse.json();
      if (labsData.success) {
        setLabs(labsData.labs || []);
      }

      if (devicesData.success) {
        const devices = devicesData.devices || [];
        const totalAssets = devices.length;
        const workingAssets = devices.filter((d: any) => d.is_active).length;
        
        // Calculate warranty statistics
        const today = new Date();
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        const ninetyDaysFromNow = new Date(today);
        ninetyDaysFromNow.setDate(today.getDate() + 90);

        let expiring30 = 0;
        let expiring90 = 0;
        let expired = 0;

        devices.forEach((device: any) => {
          if (device.warranty_expiry) {
            const expiryDate = new Date(device.warranty_expiry);
            if (expiryDate < today) {
              expired++;
            } else if (expiryDate <= thirtyDaysFromNow) {
              expiring30++;
            } else if (expiryDate <= ninetyDaysFromNow) {
              expiring90++;
            }
          }
        });

        setStats({
          totalAssets,
          workingAssets,
          maintenanceAssets: 0, // Will be updated from open issues endpoint
          offlineAssets: 0, // Will be updated from inactive devices endpoint
          totalLabs: labsData.success ? labsData.labs.length : 0,
          openIssues: 0, // Will be updated from open issues endpoint
          pendingTransfers: 0, // Will be updated from transfers endpoint
          warrantyExpiring30Days: expiring30,
          warrantyExpiring90Days: expiring90,
          expiredWarranty: expired,
        });
      }

      // Fetch open issues count for both maintenanceAssets and openIssues
      try {
        const issuesResponse = await fetch("/api/get_open_issues_count");
        const issuesData = await issuesResponse.json();
        if (issuesData.success) {
          const openIssuesCount = issuesData.count;
          setStats(prev => ({ 
            ...prev, 
            maintenanceAssets: openIssuesCount,
            openIssues: openIssuesCount 
          }));
        }
      } catch (err) {
        console.error("Error fetching open issues:", err);
      }

      // Fetch inactive devices count (excluding devices with only resolved issues)
      try {
        const inactiveResponse = await fetch("/api/get_inactive_devices_count");
        const inactiveData = await inactiveResponse.json();
        if (inactiveData.success) {
          setStats(prev => ({ ...prev, offlineAssets: inactiveData.count }));
        }
      } catch (err) {
        console.error("Error fetching inactive devices:", err);
      }

      // Fetch pending transfers count
      try {
        const transfersResponse = await fetch("/api/get_pending_transfers");
        const transfersData = await transfersResponse.json();
        if (transfersData.success) {
          const pendingTransfers = transfersData.transfers.length;
          setStats(prev => ({ ...prev, pendingTransfers }));
        }
      } catch (err) {
        console.error("Error fetching transfers:", err);
      }

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="relative min-h-screen w-full bg-black text-white pb-20" style={{
      backgroundImage: 'url(/bg.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed'
    }}>
      {" "}
      <AppNavbar
        rightContent={
          <PlaceholdersAndVanishInput
            placeholders={placeholders}
            onChange={handleChange}
            onSubmit={onSubmit}
          />
        }
      />
      {/* Radial gradient for the container to give a faded look */}{" "}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>{" "}
      {/* Asset Overview */}{" "}
      <section className="pt-32 px-6 max-w-7xl mx-auto relative z-10">
        {" "}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">
            {" "}
            Welcome back, {user?.firstName || 'User'}!{" "}
          </h2>
          <p className="text-gray-400 text-xs">Role: {user?.role}</p>
        </div>
        {user?.role === "Lab Incharge" && (
          <div className="mb-8 rounded-2xl border border-cyan-500/50 bg-cyan-900/30 p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-300 text-xs font-semibold">Assigned Lab</p>
                <p className="text-white text-xl font-bold">
                  {user?.assignedLab || "Not assigned yet"}
                </p>
              </div>
              <div className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-200 text-xs font-semibold">
                Lab Incharge
              </div>
            </div>
            <p className="text-cyan-100/70 text-xs mt-2">
              Your assigned lab appears here for quick reference.
            </p>
          </div>
        )}

        <h3 className="text-xl font-semibold mb-6 text-white">Asset Overview</h3>
        {normalizedQuery && (
          <div className="mb-8 bg-neutral-900/80 backdrop-blur-sm rounded-2xl p-6 border border-neutral-800">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-white">Search Results</h4>
              <span className="text-xs text-gray-400">
                {matchingLabs.length + matchingDevices.length} match(es)
              </span>
            </div>
            {matchingLabs.length === 0 && matchingDevices.length === 0 ? (
              <p className="text-gray-400 text-xs">No matches found. Try a different keyword.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-neutral-800/60 rounded-lg p-4 border border-neutral-700">
                  <p className="text-xs text-gray-400 mb-3">Labs</p>
                  {matchingLabs.length === 0 ? (
                    <p className="text-xs text-gray-500">No lab matches.</p>
                  ) : (
                    <ul className="space-y-2">
                      {matchingLabs.slice(0, 5).map((lab: any) => (
                        <li key={lab.lab_id} className="text-xs">
                          <a
                            href={`/lab-plan?lab=${encodeURIComponent(lab.lab_id || "")}`}
                            className="text-gray-200 hover:text-white transition-colors"
                          >
                            <span className="font-semibold">{lab.lab_name}</span> (ID: {lab.lab_id})
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="bg-neutral-800/60 rounded-lg p-4 border border-neutral-700">
                  <p className="text-xs text-gray-400 mb-3">Assets</p>
                  {matchingDevices.length === 0 ? (
                    <p className="text-xs text-gray-500">No asset matches.</p>
                  ) : (
                    <ul className="space-y-2">
                      {matchingDevices.slice(0, 5).map((device: any, idx: number) => (
                        <li key={device.device_id || device.asset_id || idx} className="text-xs text-gray-200">
                          <p className="font-semibold">
                            {device.type_name || device.type || "Device"}
                            {device.asset_id ? ` - ${device.asset_id}` : ""}
                            {device.assigned_code ? ` (${device.assigned_code})` : ""}
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-xs">
                            <a
                              href={`/lab-plan?lab=${encodeURIComponent(device.lab_id || "")}&station=${encodeURIComponent(device.assigned_code || "")}&device=${encodeURIComponent(device.asset_id || device.assigned_code || device.device_id || "")}`}
                              className="text-cyan-300 hover:text-cyan-200 transition-colors"
                            >
                              Open in Labplan
                            </a>
                            <a
                              href={`/dashboard/issues?lab=${encodeURIComponent(device.lab_id || "")}&station=${encodeURIComponent(device.assigned_code || "")}&device=${encodeURIComponent(device.asset_id || device.assigned_code || device.device_id || "")}`}
                              className="text-orange-300 hover:text-orange-200 transition-colors"
                            >
                              Open in Issues
                            </a>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-400">Loading dashboard data...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {" "}
              <WobbleCard containerClassName="col-span-1 min-h-[150px] bg-blue-600">
                {" "}
                <div className="flex flex-col items-center justify-center text-white w-full h-full">
                  {" "}
                  <p className="text-xs font-medium">Total Assets</p>{" "}
                  <h3 className="text-3xl font-bold mt-2">{stats.totalAssets.toLocaleString()}</h3>{" "}
                </div>{" "}
              </WobbleCard>{" "}
              <WobbleCard containerClassName="col-span-1 min-h-[150px] bg-green-600">
                {" "}
                <div className="flex flex-col items-center justify-center text-white w-full h-full">
                  {" "}
                  <p className="text-xs font-medium">Active Devices</p>{" "}
                  <h3 className="text-3xl font-bold mt-2">{stats.workingAssets.toLocaleString()}</h3>{" "}
                  <p className="text-xs mt-1 opacity-80">{((stats.workingAssets / stats.totalAssets) * 100).toFixed(1)}% operational</p>
                </div>{" "}
              </WobbleCard>{" "}
              <WobbleCard containerClassName="col-span-1 min-h-[150px] bg-orange-500">
                {" "}
                <div className="flex flex-col items-center justify-center text-white w-full h-full">
                  {" "}
                  <p className="text-xs font-medium">Under Maintenance</p>{" "}
                  <h3 className="text-3xl font-bold mt-2">{stats.maintenanceAssets.toLocaleString()}</h3>{" "}
                  <p className="text-xs mt-1 opacity-80">Active issues</p>
                </div>{" "}
              </WobbleCard>{" "}
              <WobbleCard containerClassName="col-span-1 min-h-[150px] bg-red-600">
                {" "}
                <div className="flex flex-col items-center justify-center text-white w-full h-full">
                  {" "}
                  <p className="text-xs font-medium">Inactive Devices</p>{" "}
                  <h3 className="text-3xl font-bold mt-2">{stats.offlineAssets.toLocaleString()}</h3>{" "}
                  <p className="text-xs mt-1 opacity-80">Needs attention</p>
                </div>{" "}
              </WobbleCard>{" "}
            </div>

            {/* Warranty & System Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
              {/* Warranty Overview */}
              <div className="bg-neutral-900/80 backdrop-blur-sm rounded-2xl p-6 border border-neutral-800">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white">Warranty Status</h3>
                  <a href="/warranty-expiry" className="text-blue-400 hover:text-blue-300 text-xs">View All →</a>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-red-600/20 rounded-lg border border-red-600/50">
                    <div>
                      <p className="text-red-400 font-semibold">Expired Warranty</p>
                      <p className="text-xs text-gray-400 mt-1">Action required</p>
                    </div>
                    <div className="text-3xl font-bold text-red-400">{stats.expiredWarranty}</div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-orange-600/20 rounded-lg border border-orange-600/50">
                    <div>
                      <p className="text-orange-400 font-semibold">Expiring in 30 Days</p>
                      <p className="text-xs text-gray-400 mt-1">Plan renewals soon</p>
                    </div>
                    <div className="text-3xl font-bold text-orange-400">{stats.warrantyExpiring30Days}</div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-yellow-600/20 rounded-lg border border-yellow-600/50">
                    <div>
                      <p className="text-yellow-400 font-semibold">Expiring in 90 Days</p>
                      <p className="text-xs text-gray-400 mt-1">Monitor closely</p>
                    </div>
                    <div className="text-3xl font-bold text-yellow-400">{stats.warrantyExpiring90Days}</div>
                  </div>
                </div>
              </div>

              {/* System Status */}
              <div className="bg-neutral-900/80 backdrop-blur-sm rounded-2xl p-6 border border-neutral-800">
                <h3 className="text-xl font-semibold text-white mb-6">System Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-lg border border-neutral-700">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-semibold">Total Labs</p>
                        <p className="text-xs text-gray-400">Active facilities</p>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-white">{stats.totalLabs}</div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-lg border border-neutral-700">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-semibold">Open Issues</p>
                        <p className="text-xs text-gray-400">Pending resolution</p>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-white">{stats.openIssues}</div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-lg border border-neutral-700">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-semibold">Pending Transfers</p>
                        <p className="text-xs text-gray-400">Awaiting approval</p>
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-white">{stats.pendingTransfers}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-neutral-900/80 backdrop-blur-sm rounded-2xl p-6 border border-neutral-800 mb-12">
              <h3 className="text-xl font-semibold text-white mb-6">Quick Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <a href="/ocr" className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all group">
                  <svg className="w-8 h-8 text-white mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-white font-semibold text-xs text-center">Add Assets</span>
                </a>

                <a href="/lab-configuration" className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all group">
                  <svg className="w-8 h-8 text-white mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-white font-semibold text-xs text-center">Configure Lab</span>
                </a>

                <a href="/dashboard/issues" className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all group">
                  <svg className="w-8 h-8 text-white mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-white font-semibold text-xs text-center">Report Issue</span>
                </a>

                <a href="/reports" className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-green-600 to-green-700 rounded-xl hover:from-green-700 hover:to-green-800 transition-all group">
                  <svg className="w-8 h-8 text-white mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-white font-semibold text-xs text-center">View Reports</span>
                </a>
              </div>
            </div>

            <footer className="border-t border-neutral-800 pt-8 pb-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between rounded-2xl border border-neutral-800 bg-neutral-950/70 px-5 py-4 backdrop-blur-sm">
                <div>
                  <p className="text-base text-gray-100 font-semibold">AssetIQ </p>
                  <p className="text-sm text-gray-200 mt-2">
                    Makers: Mayank Salvi, Aniruddha Sangle, Gandhar Rane, Pawan Walke
                  </p>
                  <p className="text-sm text-gray-200">Project Guide: Dr. Vishal Badgujar</p>
                </div>
                <HoverBorderGradient as="a" href="/project-credits">
                  Know More
                </HoverBorderGradient>
              </div>
            </footer>
          </>
        )}
        {" "}
      </section>{" "}
    </div>
  );
}


