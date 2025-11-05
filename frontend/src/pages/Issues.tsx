"use client";
import React, { useState } from "react";
import { motion } from "motion/react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { WobbleCard } from "@/components/ui/wobble-card";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { LogoButton } from "@/components/ui/logo-button";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";

interface Issue {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in-progress" | "resolved";
  reportedDate: string;
  reportedBy: string;
}

interface Device {
  id: string;
  type: string;
  batch: string;
  warranty: string;
  purchaseDate: string;
  vendor: string;
  health: "healthy" | "issue";
  os?: string[];
  issues: Issue[];
}

interface GridCell {
  id: string | null;
  equipmentType: string;
  os: string[];
  device?: Device;
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

interface TicketForm {
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
}

export default function Issues() {
  const [active, setActive] = useState<string | null>(null);
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showRaiseTicket, setShowRaiseTicket] = useState(false);
  const [ticketForm, setTicketForm] = useState<TicketForm>({
    title: "",
    description: "",
    severity: "medium",
  });

  // Sample data with issues
  const labs: Lab[] = [
    {
      name: "Lab 309",
      devices: [
        {
          id: "C001",
          type: "PC",
          batch: "Bill #123",
          warranty: "3 yrs",
          purchaseDate: "2022-07-01",
          vendor: "Dell",
          health: "healthy",
          os: ["Windows"],
          issues: [],
        },
        {
          id: "C002",
          type: "PC",
          batch: "Bill #123",
          warranty: "3 yrs",
          purchaseDate: "2022-07-01",
          vendor: "Dell",
          health: "issue",
          os: ["Windows", "Linux"],
          issues: [
            {
              id: "ISS-001",
              title: "Monitor Not Working",
              description: "Monitor screen remains black even after restart",
              severity: "high",
              status: "open",
              reportedDate: "2025-11-05",
              reportedBy: "Admin",
            },
            {
              id: "ISS-002",
              title: "Slow Performance",
              description: "System running very slow, taking time to boot",
              severity: "medium",
              status: "in-progress",
              reportedDate: "2025-11-03",
              reportedBy: "Lab Technician",
            },
          ],
        },
        {
          id: "C003",
          type: "PC",
          batch: "Bill #777",
          warranty: "2 yrs",
          purchaseDate: "2023-01-15",
          vendor: "HP",
          health: "healthy",
          os: ["Windows"],
          issues: [],
        },
        {
          id: "C004",
          type: "PC",
          batch: "Bill #777",
          warranty: "2 yrs",
          purchaseDate: "2023-01-15",
          vendor: "HP",
          health: "healthy",
          os: ["Linux"],
          issues: [],
        },
        {
          id: "C005",
          type: "PC",
          batch: "Bill #777",
          warranty: "2 yrs",
          purchaseDate: "2023-01-15",
          vendor: "HP",
          health: "issue",
          os: ["Windows"],
          issues: [
            {
              id: "ISS-003",
              title: "Keyboard Not Responding",
              description: "USB keyboard not detected, tried multiple ports",
              severity: "critical",
              status: "open",
              reportedDate: "2025-11-06",
              reportedBy: "Student",
            },
          ],
        },
        {
          id: "C006",
          type: "PC",
          batch: "Bill #123",
          warranty: "3 yrs",
          purchaseDate: "2022-07-01",
          vendor: "Dell",
          health: "healthy",
          os: ["Windows"],
          issues: [],
        },
      ],
      seatingArrangement: {
        rows: 3,
        columns: 4,
        grid: [
          [
            {
              id: "C001",
              equipmentType: "PC",
              os: ["Windows"],
              device: {
                id: "C001",
                type: "PC",
                batch: "Bill #123",
                warranty: "3 yrs",
                purchaseDate: "2022-07-01",
                vendor: "Dell",
                health: "healthy",
                os: ["Windows"],
                issues: [],
              },
            },
            {
              id: "C002",
              equipmentType: "PC",
              os: ["Windows", "Linux"],
              device: {
                id: "C002",
                type: "PC",
                batch: "Bill #123",
                warranty: "3 yrs",
                purchaseDate: "2022-07-01",
                vendor: "Dell",
                health: "issue",
                os: ["Windows", "Linux"],
                issues: [
                  {
                    id: "ISS-001",
                    title: "Monitor Not Working",
                    description: "Monitor screen remains black even after restart",
                    severity: "high",
                    status: "open",
                    reportedDate: "2025-11-05",
                    reportedBy: "Admin",
                  },
                  {
                    id: "ISS-002",
                    title: "Slow Performance",
                    description: "System running very slow, taking time to boot",
                    severity: "medium",
                    status: "in-progress",
                    reportedDate: "2025-11-03",
                    reportedBy: "Lab Technician",
                  },
                ],
              },
            },
            { id: null, equipmentType: "Empty", os: [] },
            {
              id: "C003",
              equipmentType: "PC",
              os: ["Windows"],
              device: {
                id: "C003",
                type: "PC",
                batch: "Bill #777",
                warranty: "2 yrs",
                purchaseDate: "2023-01-15",
                vendor: "HP",
                health: "healthy",
                os: ["Windows"],
                issues: [],
              },
            },
          ],
          [
            {
              id: "C004",
              equipmentType: "PC",
              os: ["Linux"],
              device: {
                id: "C004",
                type: "PC",
                batch: "Bill #777",
                warranty: "2 yrs",
                purchaseDate: "2023-01-15",
                vendor: "HP",
                health: "healthy",
                os: ["Linux"],
                issues: [],
              },
            },
            { id: null, equipmentType: "Empty", os: [] },
            { id: null, equipmentType: "Empty", os: [] },
            {
              id: "C005",
              equipmentType: "PC",
              os: ["Windows"],
              device: {
                id: "C005",
                type: "PC",
                batch: "Bill #777",
                warranty: "2 yrs",
                purchaseDate: "2023-01-15",
                vendor: "HP",
                health: "issue",
                os: ["Windows"],
                issues: [
                  {
                    id: "ISS-003",
                    title: "Keyboard Not Responding",
                    description: "USB keyboard not detected, tried multiple ports",
                    severity: "critical",
                    status: "open",
                    reportedDate: "2025-11-06",
                    reportedBy: "Student",
                  },
                ],
              },
            },
          ],
          [
            {
              id: "C006",
              equipmentType: "PC",
              os: ["Windows"],
              device: {
                id: "C006",
                type: "PC",
                batch: "Bill #123",
                warranty: "3 yrs",
                purchaseDate: "2022-07-01",
                vendor: "Dell",
                health: "healthy",
                os: ["Windows"],
                issues: [],
              },
            },
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
        {
          id: "C001",
          type: "PC",
          batch: "Bill #555",
          warranty: "3 yrs",
          purchaseDate: "2021-09-10",
          vendor: "Lenovo",
          health: "issue",
          os: ["Windows"],
          issues: [
            {
              id: "ISS-004",
              title: "Hard Disk Failure",
              description: "System showing hard disk error, data backup needed",
              severity: "critical",
              status: "open",
              reportedDate: "2025-11-04",
              reportedBy: "Lab Manager",
            },
          ],
        },
        {
          id: "C002",
          type: "PC",
          batch: "Bill #555",
          warranty: "3 yrs",
          purchaseDate: "2021-09-10",
          vendor: "Lenovo",
          health: "healthy",
          os: ["Windows"],
          issues: [],
        },
      ],
      seatingArrangement: {
        rows: 2,
        columns: 3,
        grid: [
          [
            {
              id: "C001",
              equipmentType: "PC",
              os: ["Windows"],
              device: {
                id: "C001",
                type: "PC",
                batch: "Bill #555",
                warranty: "3 yrs",
                purchaseDate: "2021-09-10",
                vendor: "Lenovo",
                health: "issue",
                os: ["Windows"],
                issues: [
                  {
                    id: "ISS-004",
                    title: "Hard Disk Failure",
                    description: "System showing hard disk error, data backup needed",
                    severity: "critical",
                    status: "open",
                    reportedDate: "2025-11-04",
                    reportedBy: "Lab Manager",
                  },
                ],
              },
            },
            {
              id: "C002",
              equipmentType: "PC",
              os: ["Windows"],
              device: {
                id: "C002",
                type: "PC",
                batch: "Bill #555",
                warranty: "3 yrs",
                purchaseDate: "2021-09-10",
                vendor: "Lenovo",
                health: "healthy",
                os: ["Windows"],
                issues: [],
              },
            },
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

  // Search bar placeholders
  const placeholders = [
    "Search labs...",
    "Search by device ID...",
    "Search by issue...",
  ];
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("Search:", e.target.value);
  };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Search submitted");
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-600";
      case "high":
        return "bg-orange-600";
      case "medium":
        return "bg-yellow-600";
      case "low":
        return "bg-blue-600";
      default:
        return "bg-gray-600";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-red-500";
      case "in-progress":
        return "bg-yellow-500";
      case "resolved":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleRaiseTicket = () => {
    if (!selectedDevice || !ticketForm.title || !ticketForm.description) {
      alert("Please fill in all fields");
      return;
    }

    // Create new issue
    const newIssue: Issue = {
      id: `ISS-${Date.now()}`,
      title: ticketForm.title,
      description: ticketForm.description,
      severity: ticketForm.severity,
      status: "open",
      reportedDate: new Date().toISOString().split("T")[0],
      reportedBy: "Current User",
    };

    console.log("New ticket raised:", newIssue);
    alert(`Ticket raised successfully for ${selectedDevice.id}!`);

    // Reset form
    setTicketForm({
      title: "",
      description: "",
      severity: "medium",
    });
    setShowRaiseTicket(false);
  };

  const getTotalIssuesCount = (lab: Lab) => {
    return lab.devices.reduce((sum, device) => sum + device.issues.length, 0);
  };

  return (
    <div
      className="min-h-screen bg-neutral-950 text-white"
      style={{
        backgroundImage: "url(/bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <LogoButton />
      {/* Top Navbar with Search */}
      <div className="fixed top-4 inset-x-0 max-w-7xl mx-auto z-50 flex items-center justify-between px-6">
        <Menu setActive={setActive}>
          <MenuItem
            setActive={setActive}
            active={active}
            item="Asset Management"
          >
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/assets">All Assets</HoveredLink>
              <HoveredLink href="/ocr">Add Assets</HoveredLink>
            </div>
          </MenuItem>

          <MenuItem setActive={setActive} active={active} item="Lab Management">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/lab-plan">Lab Floor Plans</HoveredLink>
              <HoveredLink href="/lab-configuration">
                Lab Configuration
              </HoveredLink>
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

      {/* Page Content */}
      <div className="pt-32 px-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Lab Issues & Support Tickets</h1>

        {/* Lab Cards List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {labs.map((lab, idx) => {
            const issuesCount = getTotalIssuesCount(lab);
            const devicesWithIssues = lab.devices.filter(
              (d) => d.issues.length > 0
            ).length;

            return (
              <div
                key={idx}
                onClick={() => setSelectedLab(lab)}
                className="cursor-pointer"
              >
                <WobbleCard containerClassName="bg-neutral-800 p-6 rounded-xl h-48">
                  <h2 className="text-2xl font-semibold mb-2">{lab.name}</h2>
                  <p className="text-gray-400 mb-1">
                    {lab.devices.length} total devices
                  </p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          issuesCount > 0 ? "bg-red-500" : "bg-green-500"
                        }`}
                      ></div>
                      <span className="text-sm">
                        {issuesCount > 0
                          ? `${issuesCount} active issue${
                              issuesCount > 1 ? "s" : ""
                            }`
                          : "No issues"}
                      </span>
                    </div>
                    {devicesWithIssues > 0 && (
                      <div className="text-xs text-orange-400">
                        ⚠️ {devicesWithIssues} device{devicesWithIssues > 1 ? "s" : ""}{" "}
                        need attention
                      </div>
                    )}
                  </div>
                </WobbleCard>
              </div>
            );
          })}
        </div>

        {/* Selected Lab Floor Plan */}
        {selectedLab && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-12"
          >
            <BackgroundGradient className="p-8 rounded-xl shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">
                  {selectedLab.name} - Device Issues
                </h2>
                <button
                  onClick={() => setSelectedLab(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕ Close
                </button>
              </div>

              {/* Render seating arrangement if available */}
              {selectedLab.seatingArrangement ? (
                <div className="overflow-x-auto">
                  <div className="inline-block">
                    {selectedLab.seatingArrangement.grid.map((row, rowIdx) => (
                      <div key={rowIdx} className="flex gap-2 mb-2">
                        {row.map((cell, colIdx) => (
                          <div
                            key={colIdx}
                            onClick={() =>
                              cell.device && setSelectedDevice(cell.device)
                            }
                            className={`
                              w-24 h-24 rounded-lg border-2 flex flex-col items-center justify-center transition cursor-pointer relative
                              ${
                                cell.equipmentType === "PC" &&
                                cell.device?.health === "healthy"
                                  ? "bg-green-600 border-green-400 hover:bg-green-700"
                                  : ""
                              }
                              ${
                                cell.equipmentType === "PC" &&
                                cell.device?.health === "issue"
                                  ? "bg-red-600 border-red-400 hover:bg-red-700"
                                  : ""
                              }
                              ${
                                cell.equipmentType === "Empty"
                                  ? "bg-neutral-800 border-gray-600"
                                  : ""
                              }
                            `}
                          >
                            {cell.equipmentType === "PC" && cell.device && (
                              <>
                                {cell.device.issues.length > 0 && (
                                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                    {cell.device.issues.length}
                                  </div>
                                )}
                                <div className="text-white font-bold text-sm">
                                  {cell.id}
                                </div>
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
                      <span className="text-sm text-gray-300">No Issues</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-600 rounded"></div>
                      <span className="text-sm text-gray-300">Has Issues</span>
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
                      className={`rounded-lg p-4 text-center shadow-lg cursor-pointer transition relative ${
                        device.health === "healthy"
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                      onClick={() => setSelectedDevice(device)}
                    >
                      {device.issues.length > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {device.issues.length}
                        </div>
                      )}
                      <p className="font-semibold">{device.type}</p>
                      <p className="text-xs text-gray-200">{device.id}</p>
                    </div>
                  ))}
                </div>
              )}
            </BackgroundGradient>
          </motion.div>
        )}

        {/* Device Issues Modal */}
        {selectedDevice && !showRaiseTicket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto"
            onClick={() => setSelectedDevice(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-neutral-900 p-6 rounded-xl shadow-lg w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Device Header */}
              <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-4">
                <div>
                  <h3 className="text-xl font-bold">
                    {selectedDevice.type} - {selectedDevice.id}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {selectedDevice.vendor} | {selectedDevice.batch}
                  </p>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    selectedDevice.health === "healthy"
                      ? "bg-green-600 text-white"
                      : "bg-red-600 text-white"
                  }`}
                >
                  {selectedDevice.health === "healthy"
                    ? "✓ Healthy"
                    : `⚠ ${selectedDevice.issues.length} Issue${
                        selectedDevice.issues.length > 1 ? "s" : ""
                      }`}
                </div>
              </div>

              {/* Device Details */}
              <div className="mb-6 bg-neutral-800 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 text-gray-300">
                  Device Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm text-gray-400">
                  <div>
                    <span className="font-semibold">Warranty:</span>{" "}
                    {selectedDevice.warranty}
                  </div>
                  <div>
                    <span className="font-semibold">Purchase Date:</span>{" "}
                    {selectedDevice.purchaseDate}
                  </div>
                  {selectedDevice.os && (
                    <div>
                      <span className="font-semibold">OS:</span>{" "}
                      {selectedDevice.os.join(", ")}
                    </div>
                  )}
                </div>
              </div>

              {/* Issues List */}
              <div className="mb-6">
                <h4 className="font-semibold mb-3 text-lg">Active Issues</h4>
                {selectedDevice.issues.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDevice.issues.map((issue) => (
                      <div
                        key={issue.id}
                        className="bg-neutral-800 p-4 rounded-lg border-l-4 border-l-red-500"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-semibold text-white">
                                {issue.title}
                              </h5>
                              <span
                                className={`text-xs px-2 py-0.5 rounded ${getSeverityColor(
                                  issue.severity
                                )} text-white`}
                              >
                                {issue.severity.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-gray-400 text-sm mb-2">
                              {issue.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span
                            className={`px-2 py-1 rounded ${getStatusColor(
                              issue.status
                            )} text-white`}
                          >
                            {issue.status.replace("-", " ").toUpperCase()}
                          </span>
                          <span>ID: {issue.id}</span>
                          <span>Reported: {issue.reportedDate}</span>
                          <span>By: {issue.reportedBy}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-green-900/20 border border-green-600 p-4 rounded-lg text-center">
                    <p className="text-green-400">
                      ✓ No issues reported for this device
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <HoverBorderGradient
                  as="button"
                  containerClassName="rounded-full flex-1"
                  className="px-6 py-2 bg-blue-600 text-white font-semibold w-full"
                  onClick={() => setShowRaiseTicket(true)}
                >
                  🎫 Raise New Ticket
                </HoverBorderGradient>
                <button
                  className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-full transition text-white"
                  onClick={() => setSelectedDevice(null)}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Raise Ticket Modal */}
        {selectedDevice && showRaiseTicket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto"
            onClick={() => setShowRaiseTicket(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-neutral-900 p-6 rounded-xl shadow-lg w-full max-w-2xl m-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">
                🎫 Raise Support Ticket
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                Device: <span className="text-white font-semibold">{selectedDevice.id}</span> (
                {selectedDevice.type})
              </p>

              {/* Ticket Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-2 font-semibold">
                    Issue Title *
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-neutral-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    placeholder="Brief title for the issue"
                    value={ticketForm.title}
                    onChange={(e) =>
                      setTicketForm({ ...ticketForm, title: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2 font-semibold">
                    Description *
                  </label>
                  <textarea
                    className="w-full px-4 py-2 bg-neutral-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    rows={4}
                    placeholder="Detailed description of the issue"
                    value={ticketForm.description}
                    onChange={(e) =>
                      setTicketForm({
                        ...ticketForm,
                        description: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2 font-semibold">
                    Severity *
                  </label>
                  <select
                    className="w-full px-4 py-2 bg-neutral-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    value={ticketForm.severity}
                    onChange={(e) =>
                      setTicketForm({
                        ...ticketForm,
                        severity: e.target.value as
                          | "low"
                          | "medium"
                          | "high"
                          | "critical",
                      })
                    }
                  >
                    <option value="low">Low - Minor inconvenience</option>
                    <option value="medium">Medium - Affects functionality</option>
                    <option value="high">High - Significant impact</option>
                    <option value="critical">Critical - System unusable</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <HoverBorderGradient
                  as="button"
                  containerClassName="rounded-full flex-1"
                  className="px-6 py-2 bg-green-600 text-white font-semibold w-full"
                  onClick={handleRaiseTicket}
                >
                  Submit Ticket
                </HoverBorderGradient>
                <button
                  className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-full transition text-white"
                  onClick={() => setShowRaiseTicket(false)}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
