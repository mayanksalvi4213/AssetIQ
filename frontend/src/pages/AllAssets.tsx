"use client";

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LogoButton } from "@/components/ui/logo-button";

interface Asset {
  id: number;
  name: string;
  type: string;
  quantity: number;
  location?: string;
  condition?: string;
}

export default function AllAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    setAssets([
      { id: 1, name: "Dell Latitude", type: "Laptop", quantity: 25, location: "Lab 309", condition: "Working" },
      { id: 2, name: "HP Monitor", type: "Monitor", quantity: 30, location: "Lab 210", condition: "Working" },
      { id: 3, name: "Epson Projector", type: "Projector", quantity: 5, location: "Auditorium", condition: "Needs Repair" },
      { id: 4, name: "Samsung AC", type: "AC", quantity: 10, location: "Lab 309", condition: "Working" },
      { id: 5, name: "Logitech Mouse", type: "Mouse", quantity: 50, location: "Various Labs", condition: "Working" },
    ]);
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-black text-white" style={{
      backgroundImage: 'url(/bg.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      
      {/* Navbar (centered) */}
      <div className="fixed top-2 inset-x-0 max-w-6xl mx-auto z-50 flex items-center justify-center px-4 py-2">
        <Menu setActive={setActive}>
          <MenuItem setActive={setActive} active={active} item="Asset Management">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/dashboard/assets">All Assets</HoveredLink>
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
              <HoveredLink href="/dashboard/reports">Reports</HoveredLink>
            </div>
          </MenuItem>
        </Menu>
      </div>

      {/* Page content without CardSpotlight */}
      <div className="flex items-center justify-center pt-24 px-4 pb-16 w-full relative z-10">
        <LogoButton />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-6xl bg-black/40 backdrop-blur-md rounded-xl shadow-lg p-8"
        >
          <h1 className="text-3xl font-bold text-center mb-6 text-white">All Assets</h1>

          {assets.length === 0 ? (
            <p className="text-gray-400 text-center">No assets found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-700">
                <thead>
                  <tr className="bg-black/30">
                    <th className="px-4 py-2 text-left text-white">ID</th>
                    <th className="px-4 py-2 text-left text-white">Name</th>
                    <th className="px-4 py-2 text-left text-white">Type</th>
                    <th className="px-4 py-2 text-left text-white">Quantity</th>
                    <th className="px-4 py-2 text-left text-white">Location</th>
                    <th className="px-4 py-2 text-left text-white">Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-700">
                  {assets.map((asset) => (
                    <tr
                      key={asset.id}
                      className="bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-2 text-white">{asset.id}</td>
                      <td className="px-4 py-2 text-white">{asset.name}</td>
                      <td className="px-4 py-2 text-white">{asset.type}</td>
                      <td className="px-4 py-2 text-white">{asset.quantity}</td>
                      <td className="px-4 py-2 text-white">{asset.location || "-"}</td>
                      <td className="px-4 py-2 text-white">{asset.condition || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}