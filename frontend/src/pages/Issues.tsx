"use client";
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import AppNavbar from "@/components/AppNavbar";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { CometCard } from "@/components/ui/comet-card";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { useAuth } from "@/contexts/AuthContext";

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
  incharge_name?: string;
}

interface TicketForm {
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  issueKey: string;
}

export default function Issues() {
  const { user } = useAuth();
  const [labs, setLabs] = useState<LabListItem[]>([]);
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [selectedStation, setSelectedStation] = useState<Device[] | null>(null); // All devices at station
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null); // Specific device for ticket
  const [showRaiseTicket, setShowRaiseTicket] = useState(false);
  const [loadingLabs, setLoadingLabs] = useState(false);
  const [, setLoadingLabDetail] = useState(false);
  const [labError, setLabError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightQuery, setHighlightQuery] = useState("");
  const [ticketForm, setTicketForm] = useState<TicketForm>({
    title: "",
    description: "",
    severity: "medium",
    issueKey: "not-working",
  });

  // Search bar placeholders
  const placeholders = [
    "Search labs...",
    "Search by device ID...",
    "Search by issue...",
  ];
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);
  const normalizedHighlight = useMemo(() => highlightQuery.trim().toLowerCase(), [highlightQuery]);

  // Device-specific issue options
  const getIssueOptionsForDevice = (deviceType: string) => {
    const type = deviceType?.toLowerCase() || "";
    
    // PC and Laptop issues
    if (type === "pc" || type === "laptop") {
      return [
        { key: "no-boot", label: "Not powering on / no boot", severity: "critical", active: false, description: `${deviceType} not powering on` },
        { key: "os-crash", label: "OS not loading / blue screen", severity: "high", active: false, description: "OS not loading / BSOD" },
        { key: "slow", label: "Slow performance", severity: "medium", active: true, description: "System running slow" },
        { key: "internet", label: "No Internet / network issue", severity: "low", active: true, description: "Internet / network issue" },
        { key: "overheating", label: "Overheating issues", severity: "medium", active: true, description: "Device overheating" },
        { key: "other", label: "Other (specify)", severity: "medium", active: true, description: "" },
      ];
    }
    
    // Monitor issues
    if (type === "monitor") {
      return [
        { key: "no-display", label: "Not displaying / black screen", severity: "high", active: false, description: "Monitor not displaying output" },
        { key: "flickering", label: "Screen flickering", severity: "medium", active: true, description: "Screen flickering issue" },
        { key: "dead-pixels", label: "Dead pixels / lines", severity: "low", active: true, description: "Dead pixels or lines on screen" },
        { key: "brightness", label: "Brightness issues", severity: "low", active: true, description: "Brightness too low or high" },
        { key: "color", label: "Color display problems", severity: "medium", active: true, description: "Color distortion or issues" },
        { key: "other", label: "Other (specify)", severity: "medium", active: true, description: "" },
      ];
    }
    
    // Keyboard issues
    if (type === "keyboard") {
      return [
        { key: "not-working", label: "Not detected / not working", severity: "high", active: false, description: "Keyboard not detected or working" },
        { key: "keys-stuck", label: "Keys stuck or not responding", severity: "medium", active: true, description: "Some keys stuck or not responding" },
        { key: "wireless", label: "Wireless connectivity issue", severity: "medium", active: true, description: "Wireless keyboard connection issue" },
        { key: "typing", label: "Typing errors / double input", severity: "low", active: true, description: "Keys producing wrong or double input" },
        { key: "other", label: "Other (specify)", severity: "medium", active: true, description: "" },
      ];
    }
    
    // Mouse issues
    if (type === "mouse") {
      return [
        { key: "not-working", label: "Not detected / not working", severity: "high", active: false, description: "Mouse not detected or working" },
        { key: "cursor", label: "Cursor not moving smoothly", severity: "medium", active: true, description: "Cursor movement issues" },
        { key: "buttons", label: "Buttons not responding", severity: "medium", active: true, description: "Mouse buttons not responding" },
        { key: "wireless", label: "Wireless connectivity issue", severity: "medium", active: true, description: "Wireless mouse connection issue" },
        { key: "other", label: "Other (specify)", severity: "medium", active: true, description: "" },
      ];
    }
    
    // AC issues
    if (type === "ac") {
      return [
        { key: "not-cooling", label: "Not cooling properly", severity: "high", active: false, description: "AC not cooling" },
        { key: "noise", label: "Making unusual noise", severity: "medium", active: true, description: "AC making loud or unusual noise" },
        { key: "leaking", label: "Water leaking", severity: "high", active: false, description: "AC leaking water" },
        { key: "no-power", label: "Not turning on", severity: "critical", active: false, description: "AC not powering on" },
        { key: "smell", label: "Bad smell / burning odor", severity: "high", active: false, description: "AC emitting bad smell" },
        { key: "other", label: "Other (specify)", severity: "medium", active: true, description: "" },
      ];
    }
    
    // Smart Board and Projector issues
    if (type === "smart board" || type === "projector") {
      return [
        { key: "no-display", label: "Not displaying", severity: "high", active: false, description: `${deviceType} not displaying` },
        { key: "touch", label: "Touch not working", severity: "high", active: false, description: "Touch functionality not working" },
        { key: "connection", label: "Connection issues", severity: "medium", active: true, description: "Connection with computer issues" },
        { key: "image-quality", label: "Poor image quality", severity: "medium", active: true, description: "Blurry or poor image quality" },
        { key: "calibration", label: "Calibration needed", severity: "low", active: true, description: "Touch calibration issues" },
        { key: "other", label: "Other (specify)", severity: "medium", active: true, description: "" },
      ];
    }
    
    // Printer and Scanner issues
    if (type === "printer" || type === "scanner") {
      return [
        { key: "paper-jam", label: "Paper jam", severity: "medium", active: true, description: "Paper jammed inside" },
        { key: "not-working", label: "Not printing/scanning", severity: "high", active: false, description: `${deviceType} not functioning` },
        { key: "quality", label: "Print/Scan quality issues", severity: "medium", active: true, description: "Poor print or scan quality" },
        { key: "connection", label: "Connection issues", severity: "medium", active: true, description: "Connection problems" },
        { key: "cartridge", label: "Ink/Toner issues", severity: "low", active: true, description: "Ink or toner related issues" },
        { key: "other", label: "Other (specify)", severity: "medium", active: true, description: "" },
      ];
    }
    
    // UPS issues
    if (type === "ups") {
      return [
        { key: "not-charging", label: "Not charging", severity: "high", active: false, description: "UPS battery not charging" },
        { key: "backup-low", label: "Low backup time", severity: "medium", active: true, description: "UPS backup time very low" },
        { key: "beeping", label: "Beeping continuously", severity: "medium", active: true, description: "UPS beeping continuously" },
        { key: "not-switching", label: "Not switching to battery", severity: "high", active: false, description: "Not switching to battery mode" },
        { key: "other", label: "Other (specify)", severity: "medium", active: true, description: "" },
      ];
    }
    
    // Router and Switch issues
    if (type === "router" || type === "switch") {
      return [
        { key: "no-internet", label: "No Internet connection", severity: "critical", active: false, description: "No Internet connectivity" },
        { key: "slow", label: "Slow connection", severity: "medium", active: true, description: "Very slow network connection" },
        { key: "no-power", label: "Not powering on", severity: "critical", active: false, description: `${deviceType} not powering on` },
        { key: "ports", label: "Ports not working", severity: "high", active: false, description: "One or more ports not working" },
        { key: "dropping", label: "Connection dropping", severity: "medium", active: true, description: "Frequent connection drops" },
        { key: "other", label: "Other (specify)", severity: "medium", active: true, description: "" },
      ];
    }
    
    // Server issues
    if (type === "server") {
      return [
        { key: "not-booting", label: "Not booting", severity: "critical", active: false, description: "Server not booting up" },
        { key: "slow", label: "Slow performance", severity: "high", active: false, description: "Server running very slow" },
        { key: "service-down", label: "Service down", severity: "critical", active: false, description: "Server service not responding" },
        { key: "connection", label: "Connection issues", severity: "high", active: false, description: "Cannot connect to server" },
        { key: "storage", label: "Storage full", severity: "medium", active: true, description: "Server storage full" },
        { key: "other", label: "Other (specify)", severity: "medium", active: true, description: "" },
      ];
    }
    
    // Webcam and Headset issues
    if (type === "webcam" || type === "headset") {
      return [
        { key: "not-detected", label: "Not detected", severity: "high", active: false, description: `${deviceType} not detected by system` },
        { key: "audio-video", label: "Audio/Video not working", severity: "high", active: false, description: "Audio or video functionality not working" },
        { key: "quality", label: "Poor quality", severity: "medium", active: true, description: "Poor audio or video quality" },
        { key: "connection", label: "Connection issues", severity: "medium", active: true, description: "Connection keeps dropping" },
        { key: "other", label: "Other (specify)", severity: "medium", active: true, description: "" },
      ];
    }
    
    // Default/Other device types
    return [
      { key: "not-working", label: "Not working", severity: "high", active: false, description: `${deviceType} not working properly` },
      { key: "performance", label: "Performance issues", severity: "medium", active: true, description: "Device performance issues" },
      { key: "connection", label: "Connection issues", severity: "medium", active: true, description: "Connection problems" },
      { key: "physical-damage", label: "Physical damage", severity: "high", active: false, description: "Physical damage to device" },
      { key: "other", label: "Other (specify)", severity: "medium", active: true, description: "" },
    ];
  };

  const fetchLabs = async () => {
    try {
      setLoadingLabs(true);
      const response = await fetch("/api/get_labs");
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
      const response = await fetch(`/api/get_lab/${labId}`);
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
    const params = new URLSearchParams(window.location.search);
    const labParam = params.get("lab");
    const searchParam = params.get("search");
    const stationParam = params.get("station");
    const deviceParam = params.get("device");
    if (searchParam) {
      setSearchQuery(searchParam);
    }
    if (stationParam) {
      setHighlightQuery(stationParam);
    } else if (deviceParam) {
      setHighlightQuery(deviceParam);
    } else if (searchParam) {
      setHighlightQuery(searchParam);
    }
    if (labParam) {
      fetchLabDetails(labParam);
    }
  }, []);

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!highlightQuery) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-highlight-match="true"]')) return;
    setHighlightQuery("");
  };

  const filteredLabs = useMemo(() => {
    if (!normalizedQuery) return labs;
    return labs.filter((lab) => {
      const haystack = [lab.lab_name, lab.lab_id, lab.incharge_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [labs, normalizedQuery]);

  const matchesIssueSearch = (issue: Issue) => {
    if (!normalizedQuery) return true;
    const haystack = [
      issue.id,
      issue.title,
      issue.description,
      issue.status,
      issue.severity,
      issue.reportedBy,
      issue.reportedDate,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  };

  const matchesDeviceSearch = (device: Device) => {
    if (!normalizedQuery) return true;
    const baseTokens = [
      device.deviceId,
      device.id,
      device.assignedCode,
      device.type,
      device.brand,
      device.model,
      device.invoiceNumber,
      device.billId,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const issueMatch = (device.issues || []).some(matchesIssueSearch);
    return baseTokens.includes(normalizedQuery) || issueMatch;
  };

  const filteredStationDevices = useMemo(() => {
    if (!selectedStation) return null;
    if (!normalizedQuery) return selectedStation;
    return selectedStation.filter(matchesDeviceSearch);
  }, [selectedStation, normalizedQuery]);

  const filteredIssues = useMemo(() => {
    if (!selectedDevice) return [] as Issue[];
    if (!normalizedQuery) return selectedDevice.issues || [];
    return (selectedDevice.issues || []).filter(matchesIssueSearch);
  }, [selectedDevice, normalizedQuery]);

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

  const deviceIssueOptions = useMemo(
    () => selectedDevice ? getIssueOptionsForDevice(selectedDevice.type) : [],
    [selectedDevice]
  );

  const selectedIssueOption = useMemo(
    () => deviceIssueOptions.find((o) => o.key === ticketForm.issueKey) || deviceIssueOptions[0],
    [ticketForm.issueKey, deviceIssueOptions]
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
      const response = await fetch("/api/raise_issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: selectedDevice.deviceId,
          title: finalTitle,
          description: finalDescription,
          severity: finalSeverity,
          deactivate: shouldDeactivate,
          reportedBy: user ? `${user.firstName} ${user.lastName}` : 'System',
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
      const defaultIssue = deviceIssueOptions[0]?.key || "not-working";
      setTicketForm({ title: "", description: "", severity: "medium", issueKey: defaultIssue });
      setShowRaiseTicket(false);
      setSelectedDevice(null);
      setSelectedStation(null);
      alert("Ticket raised and device status updated.");
    } catch (err) {
      console.error("Error raising issue", err);
      alert((err as Error).message || "Error raising issue");
    }
  };

  const handleUpdateIssueStatus = async (issueId: string, newStatus: "open" | "in-progress" | "resolved") => {
    if (!selectedDevice) return;

    try {
      const response = await fetch("/api/update_issue_status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueId: issueId,
          status: newStatus,
          changedBy: user ? `${user.firstName} ${user.lastName}` : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update issue status");
      }

      // If issue is resolved, reactivate the device
      if (newStatus === "resolved") {
        await fetch("/api/reactivate_device", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: selectedDevice.deviceId,
          }),
        });
      }

      // Refresh lab to reflect updated status
      if (selectedLab?.labNumber) {
        await fetchLabDetails(selectedLab.labNumber);
      }

      alert(`Issue marked as ${newStatus}`);
      setSelectedDevice(null);
      setSelectedStation(null);
    } catch (err) {
      console.error("Error updating issue status", err);
      alert((err as Error).message || "Error updating issue status");
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
      onClick={handlePageClick}
    >
      <AppNavbar
        rightContent={
          <PlaceholdersAndVanishInput
            placeholders={placeholders}
            onChange={handleChange}
            onSubmit={onSubmit}
          />
        }
      />

      {/* Page Content */}
      <div className="pt-32 px-6 max-w-7xl mx-auto">
        <h1 
          className="text-3xl font-bold mb-8 px-5 py-2 rounded-xl inline-block"
          style={{
            background: "linear-gradient(135deg, rgba(10, 14, 25, 0.75) 0%,rgba(15, 23, 42, 0.80) 25%,rgba(8, 10, 15, 0.88) 50%,rgba(15, 23, 42, 0.80) 75%, rgba(20, 18, 16, 0.75) 100%)",
            color: "white",
            boxShadow: "0 4px 15px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
          }}
        >
          Lab Issues & Support Tickets
        </h1>

        {loadingLabs && (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading labs...</p>
          </div>
        )}

        {labError && (
          <div className="text-center py-12">
            <p className="text-red-500">{labError}</p>
          </div>
        )}

        {/* Lab Cards List */}
        {!loadingLabs && !labError && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLabs.map((lab) => (
            <div
              key={lab.lab_id}
              onClick={() => fetchLabDetails(lab.lab_id)}
              className="cursor-pointer"
            >
              <CometCard>
                <div className="p-6 text-white bg-neutral-800/95 rounded-2xl backdrop-blur-sm h-full flex flex-col justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold mb-2">{lab.lab_name}</h2>
                    <p className="text-gray-400 text-xs">Lab ID: {lab.lab_id}</p>
                    <p className="text-gray-400 text-[14px] mt-1">
                      Incharge: {lab.incharge_name ? lab.incharge_name : "Unassigned"}
                    </p>
                  </div>
                  <button className="mt-4 px-4 py-2 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors">
                    View Issues
                  </button>
                </div>
              </CometCard>
            </div>
            ))}
          </div>
        )}

        {!loadingLabs && !labError && filteredLabs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">
              {normalizedQuery ? "No labs match your search." : "No labs found. Create a lab in Lab Configuration first."}
            </p>
          </div>
        )}

        {/* Selected Lab Floor Plan */}
        {selectedLab && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-12"
          >
            <div 
              className="p-8 rounded-xl shadow-xl"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 8px 32px rgba(0, 0, 0, 0.2)"
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">
                    {selectedLab.labName || selectedLab.labNumber} - Device Issues
                  </h2>
                  <p className="text-gray-400 text-xs">
                    Lab ID: {selectedLab.labNumber} | Grid: {selectedLab.seatingArrangement?.rows ?? 0}×{selectedLab.seatingArrangement?.columns ?? 0}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLab(null)}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg transition"
                >
                  Close
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
                          const stationId = deviceGroup?.assignedCode || cell.id || primaryDevice?.assignedCode;
                          const hasDevices = devices.length > 0;
                          const stationTokens = [stationId, cell.id, deviceGroup?.assignedCode]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();
                          const stationMatchesSearch = !normalizedQuery
                            || stationTokens.includes(normalizedQuery)
                            || devices.some(matchesDeviceSearch);
                          const isSearchFilteredOut = normalizedQuery && !stationMatchesSearch;
                          const hasActiveHighlight = Boolean(normalizedHighlight);
                          const isHighlightMatch = normalizedHighlight
                            ? (
                              (stationId || "").toLowerCase().includes(normalizedHighlight)
                              || devices.some((d) => {
                                const deviceHaystack = [
                                  d.assignedCode,
                                  d.id,
                                  d.deviceId,
                                  d.invoiceNumber,
                                ]
                                  .filter(Boolean)
                                  .join(" ")
                                  .toLowerCase();
                                return deviceHaystack.includes(normalizedHighlight);
                              })
                            )
                            : false;
                          
                          // Check if ANY device at this station has issues or is inactive
                          const allIssues = devices.flatMap(d => d.issues || []);
                          const openIssuesCount = allIssues.filter(issue => issue.status !== "resolved").length;
                          const hasAnyIssue = openIssuesCount > 0;
                          const hasAnyInactive = devices.some(d => d.isActive === false);
                          
                          const isActive = !hasAnyInactive && !hasAnyIssue;
                          const deviceCount = devices.length;
                          const background = hasDevices
                            ? isActive
                              ? "bg-green-900/60 border-green-500 hover:bg-green-900/80"
                              : "bg-red-900/60 border-red-500 hover:bg-red-900/80"
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
                              data-highlight-match={isHighlightMatch ? "true" : "false"}
                              onClick={() => {
                                if (hasDevices && devices.length > 0 && !isSearchFilteredOut && (!hasActiveHighlight || isHighlightMatch)) {
                                  // Show all devices at this station
                                  const allDevices = devices.map((d) => ({
                                    ...d,
                                    id: stationId,
                                    assignedCode: deviceGroup?.assignedCode,
                                    os: cell.os,
                                    issues: d.issues || [],
                                    isActive: d.isActive !== false
                                  }));
                                  setSelectedStation(allDevices);
                                }
                              }}
                              className={`
                                w-28 rounded-lg border-2 flex flex-col items-center justify-center transition relative p-1
                                ${hasDevices ? "cursor-pointer" : ""}
                                ${background}
                                ${isSearchFilteredOut ? "opacity-30" : ""}
                                ${hasActiveHighlight && !isHighlightMatch ? "opacity-30" : ""}
                                ${isHighlightMatch ? "ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.6)]" : ""}
                              `}
                              style={{ minHeight: hasDevices ? `${Math.max(96, 60 + deviceCount * 14)}px` : "96px" }}
                            >
                              {hasDevices ? (
                                <>
                                  {openIssuesCount > 0 && (
                                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                      {openIssuesCount}
                                    </div>
                                  )}
                                  <div className="text-white font-bold text-[12px] truncate w-full text-center">
                                    {stationId || "—"}
                                  </div>
                                  <div className="text-white text-lg leading-none">{emoji}</div>
                                  <div className="text-center w-full space-y-0.5 mt-0.5">
                                    {devices.map((d, di) => (
                                      <div
                                        key={di}
                                        className="text-green-300 text-[12px] font-mono leading-tight truncate"
                                        title={d.assignedCode || ""}
                                      >
                                        {d.assignedCode || d.type}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex gap-1 mt-0.5 flex-wrap justify-center">
                                    {cell.os.includes("Windows") && (
                                      <div className="text-[12px] px-1 bg-blue-800 text-white rounded">Win</div>
                                    )}
                                    {cell.os.includes("Linux") && (
                                      <div className="text-[12px] px-1 bg-orange-600 text-white rounded">Linux</div>
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
                      <span className="text-xs text-gray-300">No Issues</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-600 rounded"></div>
                      <span className="text-xs text-gray-300">Has Issues</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-neutral-800 border border-gray-600 rounded"></div>
                      <span className="text-xs text-gray-300">Empty</span>
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
            </div>
          </motion.div>
        )}

        {/* Station Devices Modal - Show all devices at selected station */}
        {selectedStation && !selectedDevice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto"
            onClick={() => setSelectedStation(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-neutral-900 p-6 rounded-xl shadow-lg w-full max-w-4xl m-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-4">
                <div>
                  <h3 className="text-xl font-bold">
                    Station: {selectedStation[0]?.assignedCode || selectedStation[0]?.id}
                  </h3>
                  <p className="text-gray-400 text-xs">
                    {(filteredStationDevices || []).length} device(s) at this station
                  </p>
                </div>
                <button
                  onClick={() => setSelectedStation(null)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {(filteredStationDevices || []).length === 0 ? (
                  <div className="text-xs text-gray-400">No devices match your search.</div>
                ) : (
                  (filteredStationDevices || []).map((device) => {
                  const totalIssues = device.issues?.length || 0;
                  const openIssues = device.issues?.filter(i => i.status !== "resolved").length || 0;
                  
                  return (
                    <div
                      key={device.deviceId}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                        device.isActive
                          ? "bg-neutral-800 border-green-600 hover:bg-neutral-750"
                          : "bg-neutral-800 border-red-600 hover:bg-neutral-750"
                      }`}
                      onClick={() => setSelectedDevice(device)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="text-lg font-semibold">
                              {device.type} {device.brand && `- ${device.brand}`} {device.model && `${device.model}`}
                            </h4>
                            {openIssues > 0 && (
                              <div className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-1">
                                {openIssues} Active Issue{openIssues > 1 ? "s" : ""}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Device ID: {device.deviceId}
                            {device.invoiceNumber && ` • Invoice: ${device.invoiceNumber}`}
                          </div>
                        </div>
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            device.isActive
                              ? "bg-green-600 text-white"
                              : "bg-red-600 text-white"
                          }`}
                        >
                          {device.isActive ? "✓ Active" : "⚠ Inactive"}
                        </div>
                      </div>
                      
                      {totalIssues > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          Total issues: {totalIssues} ({openIssues} open, {totalIssues - openIssues} resolved)
                        </div>
                      )}
                    </div>
                  );
                })
                )}
              </div>

              <div className="mt-6 text-center text-xs text-gray-400">
                Click on a device to view details and raise tickets
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Device Issues Modal - Show specific device details */}
        {selectedDevice && !showRaiseTicket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto"
            onClick={() => {
              setSelectedDevice(null);
              if (selectedStation) {
                // Keep station modal open when closing device modal
              } else {
                setSelectedStation(null);
              }
            }}
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
                  <p className="text-gray-400 text-xs">
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
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
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
                {filteredIssues.length > 0 ? (
                  <div className="space-y-3">
                    {filteredIssues.map((issue) => (
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
                            <p className="text-gray-400 text-xs mb-2">
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

                        {/* Lab Incharge Controls */}
                        {user?.role === "Lab Incharge" && issue.status !== "resolved" && (
                          <div className="mt-3 pt-3 border-t border-neutral-700 flex gap-2">
                            {issue.status === "open" && (
                              <button
                                onClick={() => handleUpdateIssueStatus(issue.id, "in-progress")}
                                className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded-lg transition"
                              >
                                ⚙️ Mark In Progress
                              </button>
                            )}
                            <button
                              onClick={() => handleUpdateIssueStatus(issue.id, "resolved")}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition"
                            >
                              ✓ Mark Resolved
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-green-900/20 border border-green-600 p-4 rounded-lg text-center">
                    <p className="text-green-400">
                      ✓ {normalizedQuery ? "No issues match your search" : "No issues reported for this device"}
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
                {selectedStation && (
                  <button
                    className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-full transition text-white"
                    onClick={() => {
                      setSelectedDevice(null);
                      // Return to station view
                    }}
                  >
                    ← Back to Station
                  </button>
                )}
                <button
                  className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-full transition text-white"
                  onClick={() => {
                    setSelectedDevice(null);
                    setSelectedStation(null);
                  }}
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
              <p className="text-gray-400 text-xs mb-2">
                Station: <span className="text-white font-semibold">{selectedDevice.assignedCode || selectedDevice.id}</span>
              </p>
              <p className="text-gray-400 text-xs mb-6">
                Device: <span className="text-white font-semibold">{selectedDevice.type} {selectedDevice.brand && `- ${selectedDevice.brand}`} {selectedDevice.model && `${selectedDevice.model}`}</span> (ID: {selectedDevice.deviceId})
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
                            : (deviceIssueOptions.find((o) => o.key === e.target.value)?.severity as TicketForm["severity"]) || "medium",
                        title: e.target.value === "other" ? "" : "",
                        description: "",
                      })
                    }
                  >
                    {deviceIssueOptions.map((opt) => (
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
                  <div className="text-xs text-gray-300">
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


