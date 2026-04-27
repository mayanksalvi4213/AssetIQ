"use client";
import { useEffect, useState } from "react";
import AppNavbar from "@/components/AppNavbar";
import { useAuth } from "@/contexts/AuthContext";

interface PendingStudentComplaint {
  requestId: number;
  labId: string;
  labName: string;
  stationId: number;
  stationCode?: string;
  deviceId: number;
  assetCode?: string;
  deviceAssignedCode?: string;
  studentName: string;
  studentEmail: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  createdAt?: string;
}

export default function StudentComplaintsApproval() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<PendingStudentComplaint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingComplaints = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (user?.role === "Lab Incharge" && user?.assignedLab) {
        params.set("labId", user.assignedLab);
      }
      const response = await fetch(`/api/get_pending_student_complaints${params.toString() ? `?${params.toString()}` : ""}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setComplaints(data.complaints || []);
      } else {
        setComplaints([]);
      }
    } catch {
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingComplaints();
  }, [user?.role, user?.assignedLab]);

  const handleApprove = async (requestId: number) => {
    try {
      const response = await fetch("/api/approve_student_complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          approverName: user ? `${user.firstName} ${user.lastName}` : "Lab Assistant",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to approve complaint");
      }
      await fetchPendingComplaints();
      alert("Complaint approved and issue created.");
    } catch (err) {
      alert((err as Error).message || "Failed to approve complaint");
    }
  };

  const handleReject = async (requestId: number) => {
    const note = prompt("Reason for rejection (optional)", "Rejected by lab assistant") || "Rejected by lab assistant";
    try {
      const response = await fetch("/api/reject_student_complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          note,
          approverName: user ? `${user.firstName} ${user.lastName}` : "Lab Assistant",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to reject complaint");
      }
      await fetchPendingComplaints();
      alert("Complaint rejected.");
    } catch (err) {
      alert((err as Error).message || "Failed to reject complaint");
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
      <AppNavbar />
      <div className="pt-32 px-6 max-w-7xl mx-auto">
        <h1
          className="text-3xl font-bold mb-8 px-5 py-2 rounded-xl inline-block"
          style={{
            background: "linear-gradient(135deg, rgba(10, 14, 25, 0.75) 0%,rgba(15, 23, 42, 0.80) 25%,rgba(8, 10, 15, 0.88) 50%,rgba(15, 23, 42, 0.80) 75%, rgba(20, 18, 16, 0.75) 100%)",
            color: "white",
            boxShadow: "0 4px 15px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
          }}
        >
          Student Complaint Approvals
        </h1>

        <div className="mb-8 bg-neutral-900/80 border border-amber-700/40 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-amber-300">Pending Student Complaints</h2>
            <button className="text-xs px-2 py-1 rounded bg-neutral-700 hover:bg-neutral-600" onClick={fetchPendingComplaints}>
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Loading pending complaints...</p>
          ) : complaints.length === 0 ? (
            <p className="text-sm text-gray-400">No pending student complaints.</p>
          ) : (
            <div className="space-y-3">
              {complaints.map((c) => (
                <div key={c.requestId} className="bg-neutral-800/80 border border-neutral-700 rounded-lg p-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">{c.title}</p>
                      <p className="text-xs text-gray-300">
                        {c.labName} ({c.labId}) | Station: {c.stationCode || c.stationId} | Device: {c.deviceAssignedCode || c.assetCode || c.deviceId}
                      </p>
                      <p className="text-xs text-gray-400">By {c.studentName} ({c.studentEmail})</p>
                      {c.description && <p className="text-sm text-gray-200 mt-1">{c.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 text-xs font-semibold"
                        onClick={() => handleApprove(c.requestId)}
                      >
                        Approve
                      </button>
                      <button
                        className="px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 text-xs font-semibold"
                        onClick={() => handleReject(c.requestId)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

