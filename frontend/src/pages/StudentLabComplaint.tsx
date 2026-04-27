import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

interface StudentDevice {
  deviceId: number;
  type?: string;
  brand?: string;
  model?: string;
  specification?: string;
  assetCode?: string;
  prefixCode?: string;
  assignedCode?: string;
  isActive?: boolean;
}

interface StudentStation {
  stationId: number;
  assignedCode: string;
  row?: number | null;
  column?: number | null;
  stationTypeLabel?: string;
  devices: StudentDevice[];
}

interface LabGridCell {
  id?: string | null;
  equipmentType?: string;
  deviceGroup?: {
    assignedCode?: string;
    devices?: StudentDevice[];
  };
}

interface LabData {
  labId: string;
  labName: string;
}

interface IssueOption {
  key: string;
  label: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
}

const getIssueOptionsForDevice = (deviceType: string): IssueOption[] => {
  const type = (deviceType || "").toLowerCase();

  if (type === "pc" || type === "laptop") {
    return [
      { key: "no-boot", label: "Not powering on / no boot", severity: "critical", description: `${deviceType} not powering on` },
      { key: "os-crash", label: "OS not loading / blue screen", severity: "high", description: "OS not loading / BSOD" },
      { key: "slow", label: "Slow performance", severity: "medium", description: "System running slow" },
      { key: "internet", label: "No Internet / network issue", severity: "low", description: "Internet / network issue" },
      { key: "custom", label: "Custom issue", severity: "medium", description: "" },
    ];
  }

  if (type === "monitor") {
    return [
      { key: "no-display", label: "Not displaying / black screen", severity: "high", description: "Monitor not displaying output" },
      { key: "flickering", label: "Screen flickering", severity: "medium", description: "Screen flickering issue" },
      { key: "custom", label: "Custom issue", severity: "medium", description: "" },
    ];
  }

  if (type === "keyboard" || type === "mouse") {
    return [
      { key: "not-working", label: "Not detected / not working", severity: "high", description: `${deviceType} not detected or working` },
      { key: "intermittent", label: "Intermittent response", severity: "medium", description: "Intermittent response issue" },
      { key: "custom", label: "Custom issue", severity: "medium", description: "" },
    ];
  }

  if (type === "router" || type === "switch") {
    return [
      { key: "no-internet", label: "No Internet connection", severity: "critical", description: "No Internet connectivity" },
      { key: "slow", label: "Slow connection", severity: "medium", description: "Very slow network connection" },
      { key: "custom", label: "Custom issue", severity: "medium", description: "" },
    ];
  }

  return [
    { key: "not-working", label: "Not working", severity: "high", description: `${deviceType || "Device"} not working properly` },
    { key: "performance", label: "Performance issue", severity: "medium", description: "Performance issue reported" },
    { key: "custom", label: "Custom issue", severity: "medium", description: "" },
  ];
};

const getStationCategory = (station: StudentStation): "computer" | "ac" | null => {
  const types = station.devices.map((d) => (d.type || "").toLowerCase());
  const stationType = (station.stationTypeLabel || "").toLowerCase();
  const prefixes = station.devices.map((d) => (d.prefixCode || "").toLowerCase());

  if (types.some((t) => t.includes("pc") || t.includes("laptop") || t.includes("computer"))) {
    return "computer";
  }
  if (types.some((t) => t === "ac" || t.includes("air conditioner"))) {
    return "ac";
  }
  if (stationType.includes("ac") || stationType.includes("air conditioner") || stationType.includes("air")) {
    return "ac";
  }
  if (stationType.includes("computer") || stationType.includes("pc") || stationType.includes("laptop")) {
    return "computer";
  }
  if (prefixes.some((p) => p.includes("/ac/"))) {
    return "ac";
  }
  if (prefixes.some((p) => p.includes("/kb/") || p.includes("/pc/") || p.includes("/mon/"))) {
    return "computer";
  }
  return null;
};

const getStationEmoji = (station: StudentStation) => {
  const category = getStationCategory(station);
  if (category === "computer") return "🖥️";
  if (category === "ac") return "❄️";
  return "🔧";
};

export default function StudentLabComplaint() {
  const { labToken } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lab, setLab] = useState<LabData | null>(null);
  const [stations, setStations] = useState<StudentStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<StudentStation | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [issueKey, setIssueKey] = useState("not-working");
  const [details, setDetails] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customSeverity, setCustomSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [submitting, setSubmitting] = useState(false);

  const buildStationsFromGrid = (
    grid: LabGridCell[][],
    stationCodeToId: Map<string, number>
  ): StudentStation[] => {
    const result: StudentStation[] = [];

    grid.forEach((row, rowIdx) => {
      row.forEach((cell, colIdx) => {
        const stationCode = cell.deviceGroup?.assignedCode || cell.id || "";
        if (!stationCode) return;

        const mappedStationId = stationCodeToId.get(stationCode);
        if (!mappedStationId) return;

        result.push({
          stationId: mappedStationId,
          assignedCode: stationCode,
          row: rowIdx + 1,
          column: colIdx + 1,
          stationTypeLabel: cell.equipmentType || "",
          devices: (cell.deviceGroup?.devices || []).map((d) => ({
            deviceId: d.deviceId,
            type: d.type,
            brand: d.brand,
            model: d.model,
            specification: d.specification,
            assetCode: d.assetCode,
            prefixCode: d.prefixCode || d.assignedCode,
            isActive: d.isActive,
          })),
        });
      });
    });

    return result;
  };

  useEffect(() => {
    const load = async () => {
      if (!labToken) {
        setError("Invalid QR link");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const publicRes = await fetch(`/api/public/lab/${labToken}`);
        const publicData = await publicRes.json();
        if (!publicRes.ok || !publicData.success) {
          throw new Error(publicData.error || "Unable to load lab data");
        }

        setLab(publicData.lab);

        const stationCodeToId = new Map<string, number>();
        (publicData.stations || []).forEach((s: any) => {
          if (s.assignedCode && s.stationId) {
            stationCodeToId.set(String(s.assignedCode), Number(s.stationId));
          }
        });

        const layoutRes = await fetch(`/api/get_lab/${publicData.lab.labId}`);
        const layoutData = await layoutRes.json();
        if (!layoutRes.ok || !layoutData.success || !layoutData.lab?.seatingArrangement?.grid) {
          setStations(publicData.stations || []);
        } else {
          const derived = buildStationsFromGrid(layoutData.lab.seatingArrangement.grid as LabGridCell[][], stationCodeToId);
          setStations(derived);
        }
      } catch (e) {
        setError((e as Error).message || "Unable to load lab data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [labToken]);

  const selectedDevices = useMemo(() => {
    if (!selectedStation || selectedDeviceIds.length === 0) return [] as StudentDevice[];
    const idSet = new Set(selectedDeviceIds);
    return selectedStation.devices.filter((d) => idSet.has(d.deviceId));
  }, [selectedStation, selectedDeviceIds]);

  const selectedDeviceType = useMemo(() => {
    if (selectedDevices.length === 0) return "";
    const uniqueTypes = Array.from(new Set(selectedDevices.map((d) => (d.type || "Device").toLowerCase())));
    if (uniqueTypes.length === 1) {
      return selectedDevices[0].type || "Device";
    }
    return "Mixed";
  }, [selectedDevices]);

  const issueOptions = useMemo(() => getIssueOptionsForDevice(selectedDeviceType), [selectedDeviceType]);

  const selectedIssueOption = useMemo(
    () => issueOptions.find((o) => o.key === issueKey) || issueOptions[0],
    [issueOptions, issueKey]
  );

  useEffect(() => {
    if (!issueOptions.find((o) => o.key === issueKey)) {
      setIssueKey(issueOptions[0]?.key || "custom");
    }
  }, [issueOptions, issueKey]);

  const filteredStations = useMemo(
    () => stations.filter((s) => getStationCategory(s) !== null),
    [stations]
  );

  const maxRow = useMemo(() => {
    const rows = stations.map((s) => Number(s.row || 0));
    return rows.length ? Math.max(...rows) : 0;
  }, [stations]);

  const maxColumn = useMemo(() => {
    const cols = stations.map((s) => Number(s.column || 0));
    return cols.length ? Math.max(...cols) : 0;
  }, [stations]);

  const stationPositionMap = useMemo(() => {
    const map = new Map<string, StudentStation>();
    stations.forEach((s) => {
      if (s.row && s.column) {
        map.set(`${s.row}-${s.column}`, s);
      }
    });
    return map;
  }, [stations]);

  const toggleDeviceSelection = (deviceId: number) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId]
    );
  };

  const submitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!labToken || !selectedStation || selectedDeviceIds.length === 0) {
      alert("Please select a station and at least one device.");
      return;
    }
    if (!studentName.trim() || !studentEmail.trim()) {
      alert("Name and email are required.");
      return;
    }
    const isCustomIssue = selectedIssueOption?.key === "custom";
    const finalTitle = isCustomIssue
      ? customTitle.trim()
      : (selectedIssueOption?.label || "Issue reported");
    const finalSeverity = isCustomIssue
      ? customSeverity
      : (selectedIssueOption?.severity || "medium");
    const finalDescription = isCustomIssue
      ? details.trim()
      : `${selectedIssueOption?.description || "Issue reported"}${details.trim() ? ` - ${details.trim()}` : ""}`;

    if (!finalTitle) {
      alert("Please provide issue title.");
      return;
    }

    try {
      setSubmitting(true);
      const failures: string[] = [];

      for (const deviceId of selectedDeviceIds) {
        const res = await fetch("/api/public/student_complaint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            labToken,
            stationId: selectedStation.stationId,
            deviceId,
            studentName,
            studentEmail,
            title: finalTitle,
            description: finalDescription,
            severity: finalSeverity,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          failures.push(`Device ${deviceId}: ${data.error || "Failed"}`);
        }
      }

      if (failures.length > 0) {
        alert(`Some complaints failed:\n${failures.join("\n")}`);
      } else {
        alert("Complaint submitted for selected devices. It will be visible after lab assistant approval.");
      }
      setIssueKey(issueOptions[0]?.key || "custom");
      setDetails("");
      setCustomTitle("");
      setCustomSeverity("medium");
      setSelectedDeviceIds([]);
    } catch (e) {
      alert((e as Error).message || "Failed to submit complaint");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-neutral-950 text-gray-200 p-8">Loading lab details...</div>;
  }

  if (error || !lab) {
    return <div className="min-h-screen bg-neutral-950 text-red-400 p-8">{error || "Lab not found"}</div>;
  }

  return (
    <div
      className="min-h-screen text-white p-4 md:p-8"
      style={{
        backgroundImage: "url(/bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="fixed inset-0 bg-black/55 pointer-events-none" />
      <div className="max-w-7xl mx-auto">
        <h1 className="relative z-10 text-2xl md:text-3xl font-bold mb-2">{lab.labName} Student Complaint Portal</h1>
        <p className="relative z-10 text-sm text-gray-300 mb-4 md:mb-6">Lab ID: {lab.labId}</p>

        <div className="relative z-10 space-y-4 md:space-y-6">
          <div className="bg-neutral-900/85 backdrop-blur border border-cyan-900 rounded-xl shadow p-3 md:p-4">
            <h2 className="text-lg font-semibold mb-3 text-cyan-200">Select Station (Lab Grid View)</h2>
            <p className="text-xs text-gray-300 mb-3">Only Computer and AC stations are shown for students.</p>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${Math.max(maxColumn, 1)}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: Math.max(maxRow, 1) }, (_, r) => r + 1).flatMap((rowNo) =>
                Array.from({ length: Math.max(maxColumn, 1) }, (_, c) => c + 1).map((colNo) => {
                  const station = stationPositionMap.get(`${rowNo}-${colNo}`);
                  const category = station ? getStationCategory(station) : null;

                  if (!station || category === null) {
                    return (
                      <div
                        key={`${rowNo}-${colNo}`}
                        className="rounded-lg border border-cyan-900/50 bg-neutral-900/70 text-gray-500 min-h-[110px] p-2 flex flex-col justify-center items-center"
                      >
                        <div className="text-xs">Empty</div>
                        <div className="text-[10px] text-gray-600 mt-1">R{rowNo}C{colNo}</div>
                      </div>
                    );
                  }

                  const isSelected = selectedStation?.stationId === station.stationId;
                  return (
                    <button
                      key={station.stationId}
                      type="button"
                      className={`text-left rounded-lg border p-2 transition min-h-[110px] ${
                        isSelected
                          ? "border-yellow-400 bg-yellow-900/50"
                          : category === "computer"
                            ? "border-emerald-500 bg-emerald-900/40 hover:bg-emerald-900/55"
                            : "border-cyan-500 bg-cyan-900/35 hover:bg-cyan-900/50"
                      }`}
                      onClick={() => {
                        setSelectedStation(station);
                        setSelectedDeviceIds([]);
                      }}
                    >
                      <div className="text-center text-base leading-none">{getStationEmoji(station)}</div>
                      <div className="font-semibold text-[13px] mt-1 truncate text-white">{station.assignedCode}</div>
                      <div className="text-[11px] text-gray-200">{category === "computer" ? "Computer Station" : "AC Station"}</div>
                      <div className="text-[11px] text-gray-300">{station.devices.length} devices</div>
                      <div className="text-[11px] leading-tight mt-1 text-cyan-100 font-medium">
                        {station.devices
                          .slice(0, 2)
                          .map((d) => d.prefixCode || d.assetCode || `D-${d.deviceId}`)
                          .join(" | ")}
                      </div>
                      {station.devices.length > 2 && (
                        <div className="text-[10px] text-cyan-200">+{station.devices.length - 2} more</div>
                      )}
                      <div className="text-[10px] text-gray-400 mt-1">R{rowNo}C{colNo}</div>
                    </button>
                  );
                })
              )}
            </div>
            {filteredStations.length === 0 && (
              <p className="text-sm text-gray-400 mt-3">No Computer/AC stations found for this lab.</p>
            )}
          </div>

          <div className="bg-neutral-900/85 backdrop-blur border border-cyan-900 rounded-xl shadow p-3 md:p-4">
            <h2 className="text-lg font-semibold mt-5 mb-3 text-cyan-200">Select Devices (Multiple allowed)</h2>
            {!selectedStation ? (
              <p className="text-sm text-gray-400">Pick a station first.</p>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-auto">
                {selectedStation.devices.map((d) => (
                  <label
                    key={d.deviceId}
                    className={`w-full block text-left rounded-lg border p-2 transition cursor-pointer ${selectedDeviceIds.includes(d.deviceId) ? "border-emerald-500 bg-emerald-900/50" : "border-cyan-900 bg-neutral-900 hover:bg-neutral-800"}`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedDeviceIds.includes(d.deviceId)}
                        onChange={() => toggleDeviceSelection(d.deviceId)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-sm text-white">{d.type || "Device"} {d.brand || ""} {d.model || ""}</div>
                        <div className="text-xs text-cyan-200">Prefix: {d.prefixCode || "N/A"} | Asset: {d.assetCode || "N/A"}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="bg-neutral-900/85 backdrop-blur border border-cyan-900 rounded-xl shadow p-3 md:p-4">
            <h2 className="text-lg font-semibold mb-3 text-cyan-200">Raise Complaint</h2>
            <form onSubmit={submitComplaint} className="space-y-3">
              <input
                className="w-full border border-cyan-900 bg-neutral-950 rounded-lg p-2 text-white"
                placeholder="Your full name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
              />
              <input
                className="w-full border border-cyan-900 bg-neutral-950 rounded-lg p-2 text-white"
                type="email"
                placeholder="Your email"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
              />

              <select
                className="w-full border border-cyan-900 bg-neutral-950 rounded-lg p-2 text-white"
                value={issueKey}
                onChange={(e) => setIssueKey(e.target.value)}
              >
                {issueOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>

              {selectedIssueOption?.key === "custom" && (
                <>
                  <input
                    className="w-full border border-cyan-900 bg-neutral-950 rounded-lg p-2 text-white"
                    placeholder="Custom issue title"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                  />
                  <select
                    className="w-full border border-cyan-900 bg-neutral-950 rounded-lg p-2 text-white"
                    value={customSeverity}
                    onChange={(e) => setCustomSeverity(e.target.value as "low" | "medium" | "high" | "critical")}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </>
              )}

              <textarea
                className="w-full border border-cyan-900 bg-neutral-950 rounded-lg p-2 min-h-[100px] text-white"
                placeholder="Additional details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />

              <div className="text-xs text-gray-200 rounded-lg bg-neutral-950 border border-cyan-900 p-2">
                Linked severity: <span className="font-semibold">{selectedIssueOption?.key === "custom" ? customSeverity.toUpperCase() : selectedIssueOption?.severity.toUpperCase()}</span>
              </div>

              <div className="text-sm text-gray-200 rounded-lg bg-neutral-950 border border-cyan-900 p-2">
                Selected: {selectedStation?.assignedCode || "No station"} / {selectedDeviceIds.length} device(s)
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedStation || selectedDeviceIds.length === 0}
                className="w-full bg-cyan-700 text-white rounded-lg p-2 font-semibold hover:bg-cyan-600 disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit Complaint"}
              </button>
              <p className="text-xs text-gray-400">Your complaint will be reviewed by the lab assistant before it appears in Issues.</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

