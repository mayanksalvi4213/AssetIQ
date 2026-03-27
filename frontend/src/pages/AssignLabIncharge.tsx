"use client";
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LogoButton } from "@/components/ui/logo-button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

interface LabSummary {
  lab_id: string;
  lab_name: string;
}

interface LabIncharge {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  assigned_lab: string | null;
}

export default function AssignLabIncharge() {
  const { logout, user } = useAuth();
  const [active, setActive] = useState<string | null>(null);
  const [labs, setLabs] = useState<LabSummary[]>([]);
  const [incharges, setIncharges] = useState<LabIncharge[]>([]);
  const [selectedLabs, setSelectedLabs] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const authHeaders = (): HeadersInit => {
    const h: HeadersInit = { "Content-Type": "application/json" };
    const token = localStorage.getItem("token");
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  };

  const labOptions = useMemo(() => {
    return labs.map((lab) => ({ value: lab.lab_id, label: `${lab.lab_id} - ${lab.lab_name}` }));
  }, [labs]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [labsRes, inchargesRes] = await Promise.all([
          fetch("http://127.0.0.1:5000/get_labs", { headers: authHeaders() }),
          fetch("http://127.0.0.1:5000/get_lab_incharges", { headers: authHeaders() }),
        ]);

        const labsData = await labsRes.json();
        const inchargesData = await inchargesRes.json();

        if (labsData.success) {
          setLabs(labsData.labs || []);
        } else {
          throw new Error(labsData.error || "Failed to load labs");
        }

        if (inchargesData.success) {
          setIncharges(inchargesData.users || []);
          const initialSelections: Record<number, string> = {};
          (inchargesData.users || []).forEach((u: LabIncharge) => {
            if (u.assigned_lab) initialSelections[u.id] = u.assigned_lab;
          });
          setSelectedLabs(initialSelections);
        } else {
          throw new Error(inchargesData.error || "Failed to load lab incharges");
        }
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const assignLab = async (userId: number) => {
    const labId = selectedLabs[userId];
    if (!labId) {
      alert("Select a lab first");
      return;
    }

    setIsSaving((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch("http://127.0.0.1:5000/assign_lab_incharge", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ userId, labId }),
      });
      const data = await res.json();
      if (data.success) {
        setIncharges((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, assigned_lab: labId } : u))
        );
        alert("✅ Lab assigned successfully");
      } else {
        alert(data.error || "Failed to assign lab");
      }
    } catch (err) {
      console.error(err);
      alert("Error assigning lab");
    } finally {
      setIsSaving((prev) => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <div
      className="min-h-screen bg-neutral-950"
      style={{
        backgroundImage: "url(/bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="fixed top-2 inset-x-0 max-w-6xl mx-auto z-50 flex items-center justify-center px-4 py-2">
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
              <HoveredLink href="/lab-layout">Lab Layout Designer</HoveredLink>
              <HoveredLink href="/lab-configuration">Lab Configuration</HoveredLink>
              {user?.role === "HOD" && (
                <HoveredLink href="/assign-lab-incharge">Assign Lab Incharge</HoveredLink>
              )}
            </div>
          </MenuItem>
          <MenuItem setActive={setActive} active={active} item="Operations">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/transfers">Transfers</HoveredLink>
              <HoveredLink href="/scrap">Scrap</HoveredLink>
              <HoveredLink href="/dashboard/issues">Issues</HoveredLink>
              <HoveredLink href="/dashboard/documents">Documents</HoveredLink>
            </div>
          </MenuItem>
          <MenuItem setActive={setActive} active={active} item="Analytics">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/reports">Reports</HoveredLink>
              <HoveredLink href="/warranty-expiry">Warranty Expiry</HoveredLink>
            </div>
          </MenuItem>
          <MenuItem setActive={setActive} active={active} item="Account">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/settings">Settings</HoveredLink>
              <button
                onClick={logout}
                className="text-left text-neutral-600 hover:text-neutral-800 transition-colors"
              >
                Logout
              </button>
            </div>
          </MenuItem>
        </Menu>
      </div>

      <div className="fixed top-4 left-4 z-50">
        <LogoButton />
      </div>

      <div className="flex items-start justify-center pt-24 px-4 pb-12">
        <div
          className="w-full max-w-5xl p-8 rounded-xl shadow-xl"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            boxShadow:
              "0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 8px 32px rgba(0, 0, 0, 0.2)",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-3xl font-bold text-center mb-6 text-white">
              Assign Lab Incharge
            </h1>

            {isLoading && (
              <div className="text-gray-300 text-center py-10">Loading…</div>
            )}

            {!isLoading && error && (
              <div className="mb-6 bg-red-900/30 border border-red-600 p-4 rounded-lg text-center">
                <p className="text-red-300 font-semibold">{error}</p>
              </div>
            )}

            {!isLoading && !error && incharges.length === 0 && (
              <div className="mb-6 bg-neutral-800 p-4 rounded-lg text-center">
                <p className="text-gray-300">No Lab Incharge users found.</p>
              </div>
            )}

            {!isLoading && !error && incharges.length > 0 && (
              <div className="space-y-3">
                {incharges.map((incharge) => (
                  <div
                    key={incharge.id}
                    className="bg-neutral-900 border border-neutral-700 rounded-lg p-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div>
                        <div className="text-white font-semibold text-lg">
                          {incharge.first_name} {incharge.last_name}
                        </div>
                        <div className="text-gray-400 text-sm">{incharge.email}</div>
                        <div className="text-gray-500 text-xs mt-1">
                          Assigned Lab: {incharge.assigned_lab || "Unassigned"}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                        <div>
                          <Label className="text-gray-300 text-sm">Assign Lab</Label>
                          <select
                            value={selectedLabs[incharge.id] || ""}
                            onChange={(e) =>
                              setSelectedLabs((prev) => ({
                                ...prev,
                                [incharge.id]: e.target.value,
                              }))
                            }
                            className="mt-1 w-64 bg-neutral-800 text-white p-2 rounded-lg border border-gray-600"
                          >
                            <option value="">-- Select Lab --</option>
                            {labOptions.map((lab) => (
                              <option key={lab.value} value={lab.value}>
                                {lab.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => assignLab(incharge.id)}
                          disabled={isSaving[incharge.id] || !selectedLabs[incharge.id]}
                          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition text-sm disabled:opacity-50"
                        >
                          {isSaving[incharge.id] ? "Assigning…" : "Assign Lab"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
