"use client";
import React, { useEffect, useMemo, useState } from "react";
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
  reportedBy?: string;
}

interface Device {
  deviceId: number;
  id?: string | null; // assigned_code / station id
  assignedCode?: string | null;
  type: string;
  brand?: string;
  model?: string;
  billId?: number;
  invoiceNumber?: string;
  isActive: boolean;
  os?: string[];
  issues: Issue[];
}

interface GridCell {
  id: string | null;
  equipmentType: string;
  os: string[];
  device?: Device | null;
  deviceGroup?: {
    assignedCode: string;
    devices: Device[];
  };
}

interface SeatingArrangement {
  rows: number;
  columns: number;
  grid: GridCell[][];
}

interface Lab {
  labNumber: string;
  labName: string;
  seatingArrangement?: SeatingArrangement;
}

interface LabListItem {
  lab_id: string;
  lab_name: string;
  rows: number;
  columns: number;
}

interface TicketForm {
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  issueKey: string;
}

export default function Issues() {
  const [active, setActive] = useState<string | null>(null);
  const [labs, setLabs] = useState<LabListItem[]>([]);
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showRaiseTicket, setShowRaiseTicket] = useState(false);
  const [loadingLabs, setLoadingLabs] = useState(false);
  const [loadingLabDetail, setLoadingLabDetail] = useState(false);
  const [labError, setLabError] = useState<string | null>(null);
  const [ticketForm, setTicketForm] = useState<TicketForm>({
    title: "",
    description: "",
    severity: "medium",
    issueKey: "no-boot",
  });

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

  const ISSUE_OPTIONS = [
    { key: "no-boot", label: "PC not powering on / no boot", severity: "critical", active: false, description: "PC not powering on" },
    { key: "os-crash", label: "OS not loading / blue screen", severity: "high", active: false, description: "OS not loading / BSOD" },
    { key: "monitor", label: "Monitor not displaying", severity: "high", active: false, description: "Monitor not displaying output" },
    { key: "keyboard", label: "Keyboard/Mouse not working", severity: "medium", active: true, description: "Keyboard or mouse not working" },
    { key: "internet", label: "No Internet / network slow", severity: "low", active: true, description: "Internet / network issue" },
    { key: "slow", label: "Slow performance", severity: "medium", active: true, description: "System running slow" },
    { key: "other", label: "Other (specify)", severity: "medium", active: true, description: "" },
  ] as const;

  const fetchLabs = async () => {
    try {
      setLoadingLabs(true);
      const response = await fetch("http://localhost:5000/get_labs");
      const data = await response.json();
      if (data.success) {
        setLabs(data.labs || []);
      }
    } catch (err) {
      console.error("Error fetching labs", err);
    } finally {
      setLoadingLabs(false);
    }
  };

  const fetchLabDetails = async (labId: string) => {
    try {
      setLoadingLabDetail(true);
      setLabError(null);
      const response = await fetch(`http://localhost:5000/get_lab/${labId}`);
      const data = await response.json();
      if (data.success && data.lab) {
        setSelectedLab(data.lab);
      } else {
        throw new Error(data.error || "Failed to load lab");
      }
    } catch (err) {
      console.error("Error fetching lab detail", err);
      setLabError((err as Error).message || "Error fetching lab detail");
    } finally {
      setLoadingLabDetail(false);
    }
  };

  useEffect(() => {
    fetchLabs();
  }, []);

  const gridWithDevices = useMemo(() => {
    if (!selectedLab?.seatingArrangement) return null;
    return selectedLab.seatingArrangement.grid.map((row) =>
      row.map((cell) => {
        let primary: Device | null = null;
        if ((cell as any).deviceGroup && (cell as any).deviceGroup.devices?.length) {
          const dg = (cell as any).deviceGroup;
          const devices: Device[] = dg.devices;
          primary = devices.find((d) => d.type?.toLowerCase() === "pc") || devices[0];
          if (primary) {
            primary = {
              ...primary,
              id: cell.id,
              assignedCode: dg.assignedCode,
              os: cell.os,
              issues: primary.issues || [],
              isActive: primary.isActive !== false,
            };
          }
        }
        return { ...cell, device: primary } as GridCell;
      })
    );
  }, [selectedLab]);

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

  const selectedIssueOption = useMemo(
    () => ISSUE_OPTIONS.find((o) => o.key === ticketForm.issueKey) || ISSUE_OPTIONS[0],
    [ticketForm.issueKey]
  );

  const handleRaiseTicket = async () => {
    if (!selectedDevice) {
      alert("Please select a device first");
      return;
    }

    if (ticketForm.issueKey === "other" && !ticketForm.description.trim()) {
      alert("Please describe the issue");
      return;
    }

    const finalSeverity =
      ticketForm.issueKey === "other"
        ? ticketForm.severity
        : (selectedIssueOption.severity as TicketForm["severity"]);

    const finalTitle =
      ticketForm.issueKey === "other"
        ? ticketForm.description.substring(0, 40) || "Custom issue"
        : selectedIssueOption.label;

    const detailTail = ticketForm.description?.trim();
    const finalDescription =
      ticketForm.issueKey === "other"
        ? detailTail || "User reported issue"
        : `${selectedIssueOption.description}${detailTail ? ` - ${detailTail}` : ""}`;

    const shouldDeactivate = ["high", "critical"].includes(finalSeverity);

    try {
      const response = await fetch("http://localhost:5000/raise_issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: selectedDevice.deviceId,
          title: finalTitle,
          description: finalDescription,
          severity: finalSeverity,
          deactivate: shouldDeactivate,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to raise issue");
      }

      // Refresh lab to reflect new status/issue
      if (selectedLab?.labNumber) {
        await fetchLabDetails(selectedLab.labNumber);
      }

      // Reset form/modal
      setTicketForm({ title: "", description: "", severity: "medium", issueKey: "no-boot" });
      setShowRaiseTicket(false);
      setSelectedDevice(null);
      alert("Ticket raised and device status updated.");
    } catch (err) {
      console.error("Error raising issue", err);
      alert((err as Error).message || "Error raising issue");
    }
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

        {labError && (
          <div className="mb-4 rounded-lg border border-red-500 bg-red-900/40 text-red-200 px-4 py-3 text-sm">
            {labError}
          </div>
        )}

        {/* Lab Cards List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingLabs && (
            <div className="text-gray-400">Loading labs...</div>
          )}
          {!loadingLabs && labs.map((lab) => (
            <div
              key={lab.lab_id}
              onClick={() => fetchLabDetails(lab.lab_id)}
              className="cursor-pointer"
            >
              <WobbleCard containerClassName="bg-neutral-800 p-6 rounded-xl h-40">
                <h2 className="text-2xl font-semibold mb-2">{lab.lab_name}</h2>
                <p className="text-gray-400 mb-1">Lab ID: {lab.lab_id}</p>
                <p className="text-gray-400">Grid: {lab.rows} × {lab.columns}</p>
                <p className="text-xs text-blue-400 mt-2">
                  {loadingLabDetail ? "Loading..." : "Click to view devices and raise tickets"}
                </p>
              </WobbleCard>
            </div>
          ))}
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
                  {selectedLab.labName || selectedLab.labNumber} - Device Issues
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
                    {(gridWithDevices || selectedLab.seatingArrangement.grid).map((row, rowIdx) => (
                      <div key={rowIdx} className="flex gap-2 mb-2">
                        {row.map((cell, colIdx) => {
                          const deviceGroup = (cell as any).deviceGroup;
                          const devices: Device[] = deviceGroup?.devices || [];
                          const primaryDevice = devices.find((d) => d.type?.toLowerCase() === "pc") || devices[0];
                          const hasDevices = devices.length > 0;
                          const isActive = primaryDevice ? primaryDevice.isActive : false;
                          const background = hasDevices
                            ? isActive
                              ? "bg-green-600 border-green-400 hover:bg-green-700"
                              : "bg-red-600 border-red-400 hover:bg-red-700"
                            : "bg-neutral-800 border-gray-600";

                          const emoji = (() => {
                            if (!hasDevices) return "";
                            const hasLaptop = devices.some((d) => (d.type || "").toLowerCase() === "laptop");
                            const hasMonitor = devices.some((d) => (d.type || "").toLowerCase() === "monitor");
                            const hasPc = devices.some((d) => (d.type || "").toLowerCase() === "pc");
                            if (hasLaptop) return "💻";
                            if (hasPc && hasMonitor) return "🖥️";
                            if (hasPc) return "⚙️";
                            if (hasMonitor) return "🖥️";
                            return "🔧";
                          })();

                          return (
                            <div
                              key={colIdx}
                              onClick={() => primaryDevice && setSelectedDevice(primaryDevice)}
                              className={`
                                w-24 h-24 rounded-lg border-2 flex flex-col items-center justify-center transition relative
                                ${hasDevices ? "cursor-pointer" : ""}
                                ${background}
                              `}
                            >
                              {hasDevices ? (
                                <>
                                  {primaryDevice?.issues?.length > 0 && (
                                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                      {primaryDevice.issues.length}
                                    </div>
                                  )}
                                  <div className="text-white font-bold text-sm">
                                    {cell.id || primaryDevice?.assignedCode}
                                  </div>
                                  <div className="text-white text-2xl">{emoji}</div>
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
                  {(gridWithDevices || [])
                    .flat()
                    .filter((c) => c.device)
                    .map((cell, idx) => {
                      const device = cell.device as Device;
                      return (
                        <div
                          key={device.deviceId || idx}
                          className={`rounded-lg p-4 text-center shadow-lg cursor-pointer transition relative ${
                            device.isActive
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
                          <p className="text-xs text-gray-200">{device.assignedCode || device.id}</p>
                        </div>
                      );
                    })}
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
                    {selectedDevice.type} - {selectedDevice.assignedCode || selectedDevice.id}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {selectedDevice.brand || ""} {selectedDevice.model || ""}
                  </p>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    selectedDevice.isActive
                      ? "bg-green-600 text-white"
                      : "bg-red-600 text-white"
                  }`}
                >
                  {selectedDevice.isActive
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
                    <span className="font-semibold">Assigned Code:</span>{" "}
                    {selectedDevice.assignedCode || selectedDevice.id || "N/A"}
                  </div>
                  {selectedDevice.billId && (
                    <div>
                      <span className="font-semibold">Bill ID:</span>{" "}
                      {selectedDevice.billId}
                    </div>
                  )}
                  {selectedDevice.invoiceNumber && (
                    <div>
                      <span className="font-semibold">Invoice:</span>{" "}
                      {selectedDevice.invoiceNumber}
                    </div>
                  )}
                  {selectedDevice.os && (
                    <div>
                      <span className="font-semibold">OS:</span>{" "}
                      {selectedDevice.os.join(", ")}
                    </div>
                  )}
                  <div>
                    <span className="font-semibold">Active:</span>{" "}
                    {selectedDevice.isActive ? "Yes" : "No"}
                  </div>
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
                    Issue Type *
                  </label>
                  <select
                    className="w-full px-4 py-2 bg-neutral-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    value={ticketForm.issueKey}
                    onChange={(e) =>
                      setTicketForm({
                        ...ticketForm,
                        issueKey: e.target.value,
                        severity:
                          e.target.value === "other"
                            ? "medium"
                            : (ISSUE_OPTIONS.find((o) => o.key === e.target.value)?.severity as TicketForm["severity"]) || "medium",
                        title: e.target.value === "other" ? "" : "",
                        description: "",
                      })
                    }
                  >
                    {ISSUE_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 mb-2 font-semibold">
                    Description / Notes {ticketForm.issueKey === "other" ? "*" : "(optional)"}
                  </label>
                  <textarea
                    className="w-full px-4 py-2 bg-neutral-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    rows={3}
                    placeholder={
                      ticketForm.issueKey === "other"
                        ? "Describe the issue"
                        : "Additional notes (optional)"
                    }
                    value={ticketForm.description}
                    onChange={(e) =>
                      setTicketForm({
                        ...ticketForm,
                        description: e.target.value,
                      })
                    }
                  />
                </div>

                {ticketForm.issueKey === "other" && (
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
                          severity: e.target.value as TicketForm["severity"],
                        })
                      }
                    >
                      <option value="low">Low - Minor inconvenience</option>
                      <option value="medium">Medium - Affects functionality</option>
                      <option value="high">High - Significant impact</option>
                      <option value="critical">Critical - System unusable</option>
                    </select>
                  </div>
                )}

                {ticketForm.issueKey !== "other" && (
                  <div className="text-sm text-gray-300">
                    <span className="font-semibold">Auto severity:</span>{" "}
                    <span className={`px-2 py-1 rounded text-white ${getSeverityColor(selectedIssueOption.severity)}`}>
                      {selectedIssueOption.severity.toUpperCase()} ({selectedIssueOption.active ? "Device remains active" : "Device marked inactive"})
                    </span>
                  </div>
                )}
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
