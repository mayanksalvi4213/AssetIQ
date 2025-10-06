"use client";
import React, { useState } from "react";
import { motion } from "motion/react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { WobbleCard } from "@/components/ui/wobble-card";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { LogoButton } from "@/components/ui/logo-button";

interface Device {
  id: string;
  type: string;
  batch: string;
  warranty: string;
  purchaseDate: string;
  vendor: string;
}

interface Lab {
  name: string;
  devices: Device[];
}

export default function Labplan() {
  const [active, setActive] = useState<string | null>(null);
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Sample data with multiple batches
  const labs: Lab[] = [
    {
      name: "Lab 309",
      devices: [
        { id: "pc-1", type: "PC", batch: "Bill #123", warranty: "3 yrs", purchaseDate: "2022-07-01", vendor: "Dell" },
        { id: "pc-2", type: "PC", batch: "Bill #123", warranty: "3 yrs", purchaseDate: "2022-07-01", vendor: "Dell" },
        { id: "pc-3", type: "PC", batch: "Bill #777", warranty: "2 yrs", purchaseDate: "2023-01-15", vendor: "HP" },
        { id: "ac-1", type: "AC", batch: "Bill #321", warranty: "5 yrs", purchaseDate: "2021-03-20", vendor: "Voltas" },
        { id: "proj-1", type: "Projector", batch: "Bill #421", warranty: "2 yrs", purchaseDate: "2023-06-11", vendor: "Epson" },
      ],
    },
    {
      name: "Lab 310",
      devices: [
        { id: "pc-1", type: "PC", batch: "Bill #555", warranty: "3 yrs", purchaseDate: "2021-09-10", vendor: "Lenovo" },
        { id: "pc-2", type: "PC", batch: "Bill #555", warranty: "3 yrs", purchaseDate: "2021-09-10", vendor: "Lenovo" },
        { id: "ac-1", type: "AC", batch: "Bill #777", warranty: "5 yrs", purchaseDate: "2022-01-05", vendor: "LG" },
      ],
    },
  ];

  // search bar demo
  const placeholders = ["Search labs...", "Find equipment...", "Search by batch..."];
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("Search:", e.target.value);
  };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Search submitted");
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

        {/* ✅ Wobble Cards List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {labs.map((lab, idx) => (
            <div key={idx} onClick={() => setSelectedLab(lab)} className="cursor-pointer">
              <WobbleCard containerClassName="bg-neutral-800 p-6 rounded-xl h-40">
                <h2 className="text-2xl font-semibold">{lab.name}</h2>
                <p className="text-gray-400">{lab.devices.length} devices</p>
              </WobbleCard>
            </div>
          ))}
        </div>

        {/* ✅ Selected Lab Floor Plan */}
        {selectedLab && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-12"
          >
            <BackgroundGradient className="p-8 rounded-xl shadow-xl">
              <h2 className="text-2xl font-bold mb-6">{selectedLab.name} - Floor Plan</h2>

              {/* Render devices as clickable tiles */}
              <div className="grid grid-cols-6 gap-4">
                {selectedLab.devices.map((device) => (
                  <div
                    key={device.id}
                    className="bg-neutral-800 rounded-lg p-4 text-center shadow-lg cursor-pointer hover:bg-neutral-700 transition"
                    onClick={() => setSelectedDevice(device)}
                  >
                    <p className="font-semibold">{device.type}</p>
                    <p className="text-xs text-gray-400">{device.batch}</p>
                  </div>
                ))}
              </div>
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
              className="bg-neutral-900 p-6 rounded-xl shadow-lg w-96"
              onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
            >
              <h3 className="text-xl font-bold mb-4">{selectedDevice.type} Details</h3>
              <p><span className="font-semibold">Batch:</span> {selectedDevice.batch}</p>
              <p><span className="font-semibold">Warranty:</span> {selectedDevice.warranty}</p>
              <p><span className="font-semibold">Purchase Date:</span> {selectedDevice.purchaseDate}</p>
              <p><span className="font-semibold">Vendor:</span> {selectedDevice.vendor}</p>
              <button
                className="mt-4 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700"
                onClick={() => setSelectedDevice(null)}
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
