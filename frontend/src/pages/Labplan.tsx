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
  health?: "healthy" | "issue"; // PC health status
  os?: string[]; // Operating systems
}

interface GridCell {
  id: string | null;
  equipmentType: string;
  os: string[];
  device?: Device; // Link to device details
}

interface SeatingArrangement {
  rows: number;
  columns: number;
  grid: GridCell[][];
}

interface Lab {
  name: string;
  devices: Device[];
  seatingArrangement?: SeatingArrangement;
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
        { id: "C001", type: "PC", batch: "Bill #123", warranty: "3 yrs", purchaseDate: "2022-07-01", vendor: "Dell", health: "healthy", os: ["Windows"] },
        { id: "C002", type: "PC", batch: "Bill #123", warranty: "3 yrs", purchaseDate: "2022-07-01", vendor: "Dell", health: "issue", os: ["Windows", "Linux"] },
        { id: "C003", type: "PC", batch: "Bill #777", warranty: "2 yrs", purchaseDate: "2023-01-15", vendor: "HP", health: "healthy", os: ["Windows"] },
        { id: "C004", type: "PC", batch: "Bill #777", warranty: "2 yrs", purchaseDate: "2023-01-15", vendor: "HP", health: "healthy", os: ["Linux"] },
        { id: "C005", type: "PC", batch: "Bill #777", warranty: "2 yrs", purchaseDate: "2023-01-15", vendor: "HP", health: "issue", os: ["Windows"] },
        { id: "C006", type: "PC", batch: "Bill #123", warranty: "3 yrs", purchaseDate: "2022-07-01", vendor: "Dell", health: "healthy", os: ["Windows"] },
      ],
      seatingArrangement: {
        rows: 3,
        columns: 4,
        grid: [
          [
            { id: "C001", equipmentType: "PC", os: ["Windows"], device: { id: "C001", type: "PC", batch: "Bill #123", warranty: "3 yrs", purchaseDate: "2022-07-01", vendor: "Dell", health: "healthy", os: ["Windows"] } },
            { id: "C002", equipmentType: "PC", os: ["Windows", "Linux"], device: { id: "C002", type: "PC", batch: "Bill #123", warranty: "3 yrs", purchaseDate: "2022-07-01", vendor: "Dell", health: "issue", os: ["Windows", "Linux"] } },
            { id: null, equipmentType: "Empty", os: [] },
            { id: "C003", equipmentType: "PC", os: ["Windows"], device: { id: "C003", type: "PC", batch: "Bill #777", warranty: "2 yrs", purchaseDate: "2023-01-15", vendor: "HP", health: "healthy", os: ["Windows"] } },
          ],
          [
            { id: "C004", equipmentType: "PC", os: ["Linux"], device: { id: "C004", type: "PC", batch: "Bill #777", warranty: "2 yrs", purchaseDate: "2023-01-15", vendor: "HP", health: "healthy", os: ["Linux"] } },
            { id: null, equipmentType: "Empty", os: [] },
            { id: null, equipmentType: "Empty", os: [] },
            { id: "C005", equipmentType: "PC", os: ["Windows"], device: { id: "C005", type: "PC", batch: "Bill #777", warranty: "2 yrs", purchaseDate: "2023-01-15", vendor: "HP", health: "issue", os: ["Windows"] } },
          ],
          [
            { id: "C006", equipmentType: "PC", os: ["Windows"], device: { id: "C006", type: "PC", batch: "Bill #123", warranty: "3 yrs", purchaseDate: "2022-07-01", vendor: "Dell", health: "healthy", os: ["Windows"] } },
            { id: null, equipmentType: "Empty", os: [] },
            { id: null, equipmentType: "Empty", os: [] },
            { id: null, equipmentType: "Empty", os: [] },
          ],
        ],
      },
    },
    {
      name: "Lab 310",
      devices: [
        { id: "C001", type: "PC", batch: "Bill #555", warranty: "3 yrs", purchaseDate: "2021-09-10", vendor: "Lenovo", health: "healthy", os: ["Windows"] },
        { id: "C002", type: "PC", batch: "Bill #555", warranty: "3 yrs", purchaseDate: "2021-09-10", vendor: "Lenovo", health: "healthy", os: ["Windows"] },
      ],
      seatingArrangement: {
        rows: 2,
        columns: 3,
        grid: [
          [
            { id: "C001", equipmentType: "PC", os: ["Windows"], device: { id: "C001", type: "PC", batch: "Bill #555", warranty: "3 yrs", purchaseDate: "2021-09-10", vendor: "Lenovo", health: "healthy", os: ["Windows"] } },
            { id: "C002", equipmentType: "PC", os: ["Windows"], device: { id: "C002", type: "PC", batch: "Bill #555", warranty: "3 yrs", purchaseDate: "2021-09-10", vendor: "Lenovo", health: "healthy", os: ["Windows"] } },
            { id: null, equipmentType: "Empty", os: [] },
          ],
          [
            { id: null, equipmentType: "Empty", os: [] },
            { id: null, equipmentType: "Empty", os: [] },
            { id: null, equipmentType: "Empty", os: [] },
          ],
        ],
      },
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

              {/* Render seating arrangement if available */}
              {selectedLab.seatingArrangement ? (
                <div className="overflow-x-auto">
                  <div className="inline-block">
                    {selectedLab.seatingArrangement.grid.map((row, rowIdx) => (
                      <div key={rowIdx} className="flex gap-2 mb-2">
                        {row.map((cell, colIdx) => (
                          <div
                            key={colIdx}
                            onClick={() => cell.device && setSelectedDevice(cell.device)}
                            className={`
                              w-24 h-24 rounded-lg border-2 flex flex-col items-center justify-center transition cursor-pointer
                              ${cell.equipmentType === "PC" && cell.device?.health === "healthy" 
                                ? "bg-green-600 border-green-400 hover:bg-green-700" 
                                : ""}
                              ${cell.equipmentType === "PC" && cell.device?.health === "issue" 
                                ? "bg-red-600 border-red-400 hover:bg-red-700" 
                                : ""}
                              ${cell.equipmentType === "Empty" 
                                ? "bg-neutral-800 border-gray-600" 
                                : ""}
                            `}
                          >
                            {cell.equipmentType === "PC" && cell.device && (
                              <>
                                <div className="text-white font-bold text-sm">{cell.id}</div>
                                <div className="text-white text-2xl">🖥️</div>
                                <div className="flex gap-1 mt-1">
                                  {cell.os.includes("Windows") && (
                                    <div className="text-xs px-1 py-0.5 bg-blue-800 text-white rounded">
                                      Win
                                    </div>
                                  )}
                                  {cell.os.includes("Linux") && (
                                    <div className="text-xs px-1 py-0.5 bg-orange-600 text-white rounded">
                                      Linux
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                            {cell.equipmentType === "Empty" && (
                              <div className="text-gray-500 text-xs">Empty</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  
                  {/* Legend */}
                  <div className="mt-6 flex gap-6 items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-600 rounded"></div>
                      <span className="text-sm text-gray-300">Healthy PC</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-600 rounded"></div>
                      <span className="text-sm text-gray-300">PC with Issues</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-neutral-800 border border-gray-600 rounded"></div>
                      <span className="text-sm text-gray-300">Empty</span>
                    </div>
                  </div>
                </div>
              ) : (
                // Fallback to simple grid if no seating arrangement
                <div className="grid grid-cols-6 gap-4">
                  {selectedLab.devices.map((device) => (
                    <div
                      key={device.id}
                      className={`rounded-lg p-4 text-center shadow-lg cursor-pointer transition ${
                        device.health === "healthy"
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                      onClick={() => setSelectedDevice(device)}
                    >
                      <p className="font-semibold">{device.type}</p>
                      <p className="text-xs text-gray-200">{device.id}</p>
                    </div>
                  ))}
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
              className={`p-6 rounded-xl shadow-lg w-96 ${
                selectedDevice.health === "healthy" ? "bg-green-900" : "bg-red-900"
              }`}
              onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{selectedDevice.type} - {selectedDevice.id}</h3>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  selectedDevice.health === "healthy" 
                    ? "bg-green-600 text-white" 
                    : "bg-red-600 text-white"
                }`}>
                  {selectedDevice.health === "healthy" ? "✓ Healthy" : "⚠ Issue"}
                </div>
              </div>
              
              <div className="space-y-2 text-gray-200">
                <p><span className="font-semibold">Batch:</span> {selectedDevice.batch}</p>
                <p><span className="font-semibold">Warranty:</span> {selectedDevice.warranty}</p>
                <p><span className="font-semibold">Purchase Date:</span> {selectedDevice.purchaseDate}</p>
                <p><span className="font-semibold">Vendor:</span> {selectedDevice.vendor}</p>
                {selectedDevice.os && (
                  <p>
                    <span className="font-semibold">OS:</span>{" "}
                    {selectedDevice.os.join(", ")}
                  </p>
                )}
              </div>
              
              <button
                className="mt-4 w-full px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition text-white"
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
