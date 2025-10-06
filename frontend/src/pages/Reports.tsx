"use client";
import React, { useState } from "react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { CometCard } from "@/components/ui/comet-card";
import { LogoButton } from "@/components/ui/logo-button";

const Reports: React.FC = () => {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div
      className="relative min-h-screen flex flex-col items-center py-12 px-4"
      style={{ 
        backgroundColor: "#1c1c1c",
        backgroundImage: 'url(/bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
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

      {/* Heading */}
      <h1 className="text-3xl font-bold mb-12 relative z-20 mt-16 text-gray-200">
        Asset Reports
      </h1>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl relative z-20">
        <LogoButton />
        {/* Warranty Expiry */}
        <CometCard>
          <div className="p-6 text-white bg-neutral-800/95 rounded-2xl backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-2">Warranty Expiry</h2>
            <p className="text-gray-300 text-sm mb-4">
              Track which asset batches are nearing warranty expiry.
            </p>
            <button className="px-4 py-2 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors">
              View Report
            </button>
          </div>
        </CometCard>

        {/* Issue Trends */}
        <CometCard>
          <div className="p-6 text-white bg-neutral-800/95 rounded-2xl backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-2">Issue Trends</h2>
            <p className="text-gray-300 text-sm mb-4">
              Find which batches had the most reported issues.
            </p>
            <button className="px-4 py-2 bg-red-600 rounded-lg text-white font-semibold hover:bg-red-700 transition-colors">
              View Report
            </button>
          </div>
        </CometCard>

        {/* Budget & Purchase Planning */}
        <CometCard>
          <div className="p-6 text-white bg-neutral-800/95 rounded-2xl backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-2">Budget & Purchase</h2>
            <p className="text-gray-300 text-sm mb-4">
              Plan purchases and allocate budgets effectively.
            </p>
            <button className="px-4 py-2 bg-green-600 rounded-lg text-white font-semibold hover:bg-green-700 transition-colors">
              View Report
            </button>
          </div>
        </CometCard>

        {/* Proactive Maintenance */}
        <CometCard>
          <div className="p-6 text-white bg-neutral-800/95 rounded-2xl backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-2">Proactive Maintenance</h2>
            <p className="text-gray-300 text-sm mb-4">
              Identify assets that require preventive maintenance.
            </p>
            <button className="px-4 py-2 bg-yellow-600 rounded-lg text-white font-semibold hover:bg-yellow-700 transition-colors">
              View Report
            </button>
          </div>
        </CometCard>

        {/* Asset Transfer/Scrap */}
        <CometCard>
          <div className="p-6 text-white bg-neutral-800/95 rounded-2xl backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-2">Asset Transfer / Scrap</h2>
            <p className="text-gray-300 text-sm mb-4">
              Track asset transfers and scrapped devices.
            </p>
            <button className="px-4 py-2 bg-purple-600 rounded-lg text-white font-semibold hover:bg-purple-700 transition-colors">
              View Report
            </button>
          </div>
        </CometCard>
      </div>
    </div>
  );
};

export default Reports;
