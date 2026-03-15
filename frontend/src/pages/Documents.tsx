"use client";
import React, { useState, useEffect } from "react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LogoButton } from "@/components/ui/logo-button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "@/contexts/AuthContext";

interface Bill {
  id: number;
  billNo: string;
  supplier: string;
  date: string;
  amount: number;
  taxAmount: number;
  gstin: string;
  stockEntry: string;
  items: number;
  path?: string | null;
}

interface DeadStockEntry {
  srNo: string;
  labName: string;
  stationCode: string;
  itemDescription: string;
  deviceCount: number;
  supplierInfo: string;
  orderNo: string;
  billNo: string;
  billDate: string;
  centralStore: string;
  quantity: string;
  ratePerUnit: string;
  cost: string;
  dateOfDelivery: string;
  dateOfInstallation: string;
  identityNo: string;
  assignedCode?: string;
  remark: string;
  signOfLabInCharge: string;
  warrantyYears: number;
  deviceType?: string;
  brand?: string;
  model?: string;
  specification?: string;
  assetCode?: string;
  unitPrice?: number;
}

const Documents: React.FC = () => {
  const [active, setActive] = useState<string | null>(null);
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"bills" | "deadstock">("bills");
  const [bills, setBills] = useState<Bill[]>([]);
  const [deadStockData, setDeadStockData] = useState<DeadStockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deadstockLabFilter, setDeadstockLabFilter] = useState<string>("all");
  const [deadstockYearFilter, setDeadstockYearFilter] = useState<string>("all");
  const [deadstockDeviceTypeFilter, setDeadstockDeviceTypeFilter] = useState<string>("all");

  const getYearFromDate = (value: string) => {
    if (!value) return "";
    const trimmed = value.trim();
    const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashMatch) return slashMatch[3];
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return isoMatch[1];
    const yearMatch = trimmed.match(/(\d{4})/);
    return yearMatch ? yearMatch[1] : "";
  };

  const handleViewBill = async (bill: Bill) => {
    if (!bill.path) {
      alert("No bill file is available for this record.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`http://localhost:5000/${bill.path}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch bill file");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      console.error("Error opening bill file:", err);
      alert("Failed to open bill file. Please try again.");
    }
  };

  // Export Bills to CSV
  const exportBillsToCSV = () => {
    const headers = ["Bill No.", "Supplier", "GSTIN", "Date", "Amount", "Tax", "Items"];
    const csvContent = [
      headers.join(","),
      ...bills.map(bill =>
        [
          bill.billNo,
          bill.supplier,
          bill.gstin,
          bill.date,
          bill.amount,
          bill.taxAmount,
          bill.items
        ].join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `bills_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Bills to PDF
  const exportBillsToPDF = async () => {
    try {
      const doc = new jsPDF();
      
      // Load header image asynchronously
      const headerImg = new Image();
      headerImg.src = '/header.png';
      
      // Wait for image to load
      await new Promise((resolve, reject) => {
        headerImg.onload = resolve;
        headerImg.onerror = () => reject(new Error('Failed to load header image'));
      });
      
      // Add header image
      doc.addImage(headerImg, 'PNG', 0, 0, 210, 40);
      
      doc.setFontSize(20);
      doc.text("Bills Report", 14, 48);
      doc.setFontSize(11);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 56);

      const tableData = bills.map(bill => [
        bill.billNo,
        bill.supplier,
        bill.gstin,
        bill.date,
        `₹${bill.amount.toLocaleString()}`,
        `₹${bill.taxAmount.toLocaleString()}`,
        bill.items.toString()
      ]);

      autoTable(doc, {
        head: [["Bill No.", "Supplier", "GSTIN", "Date", "Amount", "Tax", "Items"]],
        body: tableData,
        startY: 63,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246], fontSize: 11, fontStyle: 'bold' }
      });

      doc.save(`bills_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // Export Dead Stock to CSV
  const exportDeadStockToCSV = (data: DeadStockEntry[]) => {
    const formatDeviceDisplay = (item: DeadStockEntry) => {
      const main = `${item.deviceType || "Unknown"}: ${item.brand || ""} ${item.model || ""}`.trim();
      const spec = item.specification ? ` | ${item.specification}` : "";
      const asset = item.assetCode ? ` | ${item.assetCode}` : "";
      const price = typeof item.unitPrice === "number" ? ` | ₹${item.unitPrice.toFixed(2)}` : "";
      return `${main}${spec}${asset}${price}`.trim();
    };

    const headers = [
      "Sr. No.",
      "Lab",
      "Station",
      "Device",
      "Name & Add. of Supplier",
      "Order No.",
      "Bill No. & Date",
      "Central Store No.",
      "Qty",
      "Rate / Unit",
      "Cost",
      "Date of Delivery",
      "Identity No.",
      "Assigned Code",
      "Warranty"
    ];
    
    const rows: string[] = [];
    data.forEach(item => {
      rows.push([
        item.srNo,
        item.labName,
        item.stationCode,
        formatDeviceDisplay(item),
        item.supplierInfo,
        item.orderNo,
        `${item.billNo}${item.billDate ? ` | ${item.billDate}` : ""}`,
        item.centralStore,
        item.quantity,
        item.ratePerUnit,
        item.cost,
        item.dateOfDelivery,
        item.identityNo,
        item.assignedCode || "",
        `${item.warrantyYears}y`
      ].map(val => `"${val}"`).join(","));
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `deadstock_register_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Dead Stock to PDF
  const exportDeadStockToPDF = async (data: DeadStockEntry[]) => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4'); // landscape orientation
      
      // Load header image asynchronously
      const headerImg = new Image();
      headerImg.src = '/header.png';
      
      // Wait for image to load
      await new Promise((resolve, reject) => {
        headerImg.onload = resolve;
        headerImg.onerror = () => reject(new Error('Failed to load header image'));
      });
      
      // Add header image
      doc.addImage(headerImg, 'PNG', 0, 0, 297, 25);
      
      doc.setFontSize(14);
      doc.text("Dead Stock Register", 14, 32);
      doc.setFontSize(10);
      doc.text("A. P. SHAH INSTITUTE OF TECHNOLOGY", 14, 38);
      doc.setFontSize(7);
      doc.text("Survey No. 12, Opp. Hypercity Mall, Kasarvadavali, Ghodbunder Road, Thane (W)-400 615.", 14, 42);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 46);

    const tableData: any[] = [];
    data.forEach(item => {
      const deviceDisplay = `${item.deviceType || "Unknown"}: ${item.brand || ""} ${item.model || ""}`.trim();
      const specLine = item.specification ? `\n${item.specification}` : "";
      const assetLine = item.assetCode ? `\n${item.assetCode}` : "";
      const priceLine = typeof item.unitPrice === "number" ? `\n₹${item.unitPrice.toFixed(2)}` : "";
      tableData.push([
        item.srNo,
        item.labName,
        item.stationCode,
        `${deviceDisplay}${specLine}${assetLine}${priceLine}`.trim(),
        item.supplierInfo,
        item.orderNo,
        `${item.billNo}${item.billDate ? `\n${item.billDate}` : ""}`,
        item.centralStore,
        item.quantity,
        item.ratePerUnit,
        item.cost,
        item.dateOfDelivery,
        item.identityNo,
        item.assignedCode || "",
        `${item.warrantyYears}y`
      ]);
    });

    autoTable(doc, {
      head: [["Sr.", "Lab", "Station", "Device", "Name & Add. of Supplier", "Order No.", "Bill No. & Date", "Central Store No.", "Qty", "Rate / Unit", "Cost", "Date of Delivery", "Identity No.", "Assigned Code", "Warranty"]],
      body: tableData,
      startY: 50,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fillColor: [59, 130, 246], fontSize: 7, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 18 },
        2: { cellWidth: 16 },
        3: { cellWidth: 50 },
        4: { cellWidth: 25 },
        5: { cellWidth: 16 },
        6: { cellWidth: 22 },
        7: { cellWidth: 20 },
        8: { cellWidth: 10 },
        9: { cellWidth: 14 },
        10: { cellWidth: 14 },
        11: { cellWidth: 16 },
        12: { cellWidth: 20 },
        13: { cellWidth: 18 },
        14: { cellWidth: 8 }
      }
    });

      doc.save(`deadstock_register_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // Fetch bills from API
  useEffect(() => {
    const fetchBills = async () => {
      try {
        console.log("Fetching bills...");
        const response = await fetch("http://localhost:5000/get_all_bills");
        console.log("Bills response status:", response.status);
        const data = await response.json();
        console.log("Bills data received:", data);
        if (data.success) {
          console.log("Setting bills:", data.bills.length, "items");
          setBills(data.bills);
        } else {
          console.error("Bills fetch failed:", data.error);
          setError(`Bills error: ${data.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error("Error fetching bills:", error);
        setError(`Failed to fetch bills: ${error instanceof Error ? error.message : 'Network error'}`);
      }
    };

    const fetchDeadStock = async () => {
      try {
        console.log("Fetching deadstock...");
        const response = await fetch("http://localhost:5000/get_deadstock_register");
        console.log("Deadstock response status:", response.status);
        const data = await response.json();
        console.log("Deadstock data received:", data);
        if (data.success) {
          console.log("Setting deadstock:", data.deadstock.length, "items");
          setDeadStockData(data.deadstock);
        } else {
          console.error("Deadstock fetch failed:", data.error);
          setError(`Deadstock error: ${data.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error("Error fetching deadstock:", error);
        setError(`Failed to fetch deadstock: ${error instanceof Error ? error.message : 'Network error'}`);
      }
    };

    Promise.all([fetchBills(), fetchDeadStock()]).finally(() => {
      setLoading(false);
    });
  }, []);

  return (
    <div
      className="relative min-h-screen flex flex-col items-center py-12 px-4"
      style={{
        backgroundColor: "#1c1c1c",
        backgroundImage: "url(/bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
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
              <HoveredLink href="/lab-layout">Lab Layout Designer</HoveredLink>
              <HoveredLink href="/lab-configuration">Lab Configuration</HoveredLink>
            </div>
          </MenuItem>

          <MenuItem setActive={setActive} active={active} item="Operations">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/transfers">Transfers</HoveredLink>
              <HoveredLink href="/dashboard/issues">Issues</HoveredLink>
              <HoveredLink href="/documents">Documents</HoveredLink>
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

      <LogoButton />

      {/* Heading */}
      <h1 className="text-4xl font-bold mb-8 relative z-20 mt-16 text-gray-200">
        Documents
      </h1>

      {/* Tab Navigation */}
      <div className="flex gap-4 mb-8 relative z-20">
        <button
          onClick={() => setActiveTab("bills")}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            activeTab === "bills"
              ? "bg-blue-600 text-white"
              : "bg-neutral-800/80 text-gray-300 hover:bg-neutral-700"
          }`}
        >
          Bills
        </button>
        <button
          onClick={() => setActiveTab("deadstock")}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            activeTab === "deadstock"
              ? "bg-blue-600 text-white"
              : "bg-neutral-800/80 text-gray-300 hover:bg-neutral-700"
          }`}
        >
          Dead Stock Register
        </button>
      </div>

      {/* Content Area */}
      <div className="w-full max-w-[95vw] relative z-20">
        {error && (
          <div className="mb-4 p-4 bg-red-600/20 border border-red-600 rounded-lg text-red-200">
            <p className="font-semibold">Error:</p>
            <p className="text-sm">{error}</p>
            <p className="text-xs mt-2">Make sure the backend server is running on http://localhost:5000</p>
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-white text-xl">Loading...</div>
          </div>
        ) : (
          <>
            {/* Bills Section */}
            {activeTab === "bills" && (
              <div className="p-6 bg-neutral-800/95 rounded-2xl backdrop-blur-sm">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-semibold text-white">Bills</h2>
                  <div className="flex gap-3">
                    <button
                      onClick={exportBillsToCSV}
                      disabled={bills.length === 0}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export CSV
                    </button>
                    <button
                      onClick={exportBillsToPDF}
                      disabled={bills.length === 0}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Export PDF
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-white">
                    <thead className="border-b border-gray-600">
                      <tr>
                        <th className="px-4 py-3">Bill No.</th>
                        <th className="px-4 py-3">Supplier</th>
                        <th className="px-4 py-3">GSTIN</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Tax</th>
                        <th className="px-4 py-3">Items</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                            No bills found
                          </td>
                        </tr>
                      ) : (
                        bills.map((bill) => (
                          <tr
                            key={bill.id}
                            className="border-b border-gray-700 hover:bg-neutral-700/5"
                          >
                            <td className="px-4 py-3">{bill.billNo}</td>
                            <td className="px-4 py-3">{bill.supplier}</td>
                            <td className="px-4 py-3 text-sm">{bill.gstin}</td>
                            <td className="px-4 py-3">{bill.date}</td>
                            <td className="px-4 py-3">₹{bill.amount.toLocaleString()}</td>
                            <td className="px-4 py-3">₹{bill.taxAmount.toLocaleString()}</td>
                            <td className="px-4 py-3">{bill.items}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleViewBill(bill)}
                                className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 transition-colors text-sm"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Dead Stock Register Section */}
            {activeTab === "deadstock" && (
              (() => {
                const labOptions = Array.from(new Set(deadStockData.map(item => item.labName))).filter(Boolean);
                const yearOptions = Array.from(new Set(deadStockData.map(item => getYearFromDate(item.billDate || item.dateOfDelivery || "")))).filter(Boolean);
                const deviceTypeOptions = Array.from(new Set(deadStockData.map(item => item.deviceType).filter(Boolean))).filter(Boolean) as string[];
                const filteredDeadStockData = deadStockData.filter((item) => {
                  const matchesLab = deadstockLabFilter === "all" || item.labName === deadstockLabFilter;
                  const itemYear = getYearFromDate(item.billDate || item.dateOfDelivery || "");
                  const matchesYear = deadstockYearFilter === "all" || itemYear === deadstockYearFilter;
                  const matchesDeviceType = deadstockDeviceTypeFilter === "all" || item.deviceType === deadstockDeviceTypeFilter;
                  return matchesLab && matchesYear && matchesDeviceType;
                });

                return (
              <div className="p-6 bg-neutral-800/95 rounded-2xl backdrop-blur-sm">
                <div className="mb-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-2">
                    <div>
                      <h2 className="text-2xl font-semibold text-white">Dead Stock Register</h2>
                      <p className="text-sm text-gray-400 mt-1">A. P. SHAH INSTITUTE OF TECHNOLOGY</p>
                      <p className="text-xs text-gray-500">Survey No. 12, Opp. Hypercity Mall, Kasarvadavali, Ghodbunder Road, Thane (W)-400 615.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Lab</span>
                        <select
                          value={deadstockLabFilter}
                          onChange={(e) => setDeadstockLabFilter(e.target.value)}
                          className="px-3 py-2 bg-neutral-700 text-white rounded-lg text-sm border border-neutral-600"
                        >
                          <option value="all">All</option>
                          {labOptions.map((lab) => (
                            <option key={lab} value={lab}>{lab}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Year</span>
                        <select
                          value={deadstockYearFilter}
                          onChange={(e) => setDeadstockYearFilter(e.target.value)}
                          className="px-3 py-2 bg-neutral-700 text-white rounded-lg text-sm border border-neutral-600"
                        >
                          <option value="all">All</option>
                          {yearOptions.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Device</span>
                        <select
                          value={deadstockDeviceTypeFilter}
                          onChange={(e) => setDeadstockDeviceTypeFilter(e.target.value)}
                          className="px-3 py-2 bg-neutral-700 text-white rounded-lg text-sm border border-neutral-600"
                        >
                          <option value="all">All</option>
                          {deviceTypeOptions.map((deviceType) => (
                            <option key={deviceType} value={deviceType}>{deviceType}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => exportDeadStockToCSV(filteredDeadStockData)}
                        disabled={filteredDeadStockData.length === 0}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export CSV
                      </button>
                      <button
                        onClick={() => exportDeadStockToPDF(filteredDeadStockData)}
                        disabled={filteredDeadStockData.length === 0}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Export PDF
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1400px] text-left text-white text-sm border border-gray-600">
                    <thead className="bg-neutral-700/80">
                      <tr>
                        <th className="px-2 py-2 border border-gray-600">Sr. No.</th>
                        <th className="px-2 py-2 border border-gray-600">Lab</th>
                        <th className="px-2 py-2 border border-gray-600">Station</th>
                        <th className="px-2 py-2 border border-gray-600">Device</th>
                        <th className="px-2 py-2 border border-gray-600">Name & Add. of Supplier</th>
                        <th className="px-2 py-2 border border-gray-600">Order No.</th>
                        <th className="px-2 py-2 border border-gray-600">Bill No. & Date</th>
                        <th className="px-2 py-2 border border-gray-600">Central Store No.</th>
                        <th className="px-2 py-2 border border-gray-600">Qty</th>
                        <th className="px-2 py-2 border border-gray-600">Rate / Unit</th>
                        <th className="px-2 py-2 border border-gray-600">Cost</th>
                        <th className="px-2 py-2 border border-gray-600">Date of Delivery</th>
                        <th className="px-2 py-2 border border-gray-600">Identity No.</th>
                        <th className="px-2 py-2 border border-gray-600">Assigned Code</th>
                        <th className="px-2 py-2 border border-gray-600">Warranty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeadStockData.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="px-4 py-8 text-center text-gray-400">
                            No dead stock entries found. Configure labs first.
                          </td>
                        </tr>
                      ) : (
                        filteredDeadStockData.map((item, index) => (
                          <tr
                            key={index}
                            className="border-b border-gray-700 hover:bg-neutral-700/30"
                          >
                            <td className="px-2 py-3 border border-gray-600 font-semibold">{item.srNo}</td>
                            <td className="px-2 py-3 border border-gray-600 font-semibold text-blue-400">{item.labName}</td>
                            <td className="px-2 py-3 border border-gray-600 font-bold text-green-400">{item.stationCode}</td>
                            <td className="px-3 py-3 border border-gray-600">
                              <div className="bg-neutral-800/50 p-2 rounded border border-neutral-600">
                                <div className="font-semibold text-white text-xs">
                                  {item.deviceType || "Unknown"}: {item.brand || ""} {item.model || ""}
                                </div>
                                {item.specification && (
                                  <div className="text-gray-400 text-xs italic">{item.specification}</div>
                                )}
                                {item.assetCode && (
                                  <div className="text-blue-400 text-xs font-mono">{item.assetCode}</div>
                                )}
                                {typeof item.unitPrice === "number" && (
                                  <div className="text-green-400 text-xs">₹{item.unitPrice.toFixed(2)}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-3 border border-gray-600">{item.supplierInfo}</td>
                            <td className="px-2 py-3 border border-gray-600 text-xs">{item.orderNo}</td>
                            <td className="px-2 py-3 border border-gray-600">
                              <div className="font-semibold">{item.billNo}</div>
                              {item.billDate && <div className="text-xs text-gray-400">{item.billDate}</div>}
                            </td>
                            <td className="px-2 py-3 border border-gray-600 text-xs">{item.centralStore}</td>
                            <td className="px-2 py-3 border border-gray-600 text-center font-bold">{item.quantity}</td>
                            <td className="px-2 py-3 border border-gray-600 text-xs">{item.ratePerUnit}</td>
                            <td className="px-2 py-3 border border-gray-600 font-semibold text-green-400">{item.cost}</td>
                            <td className="px-2 py-3 border border-gray-600 text-xs">{item.dateOfDelivery}</td>
                            <td className="px-2 py-3 border border-gray-600 text-xs font-mono">{item.identityNo}</td>
                            <td className="px-2 py-3 border border-gray-600 text-xs font-mono">{item.assignedCode || ""}</td>
                            <td className="px-2 py-3 border border-gray-600 text-center">{item.warrantyYears}y</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 text-xs text-gray-400">
                  <p>* Dead Stock Register is a comprehensive record of all non-consumable items purchased by the institute.</p>
                  <p className="mt-1">Total Entries: {filteredDeadStockData.length}</p>
                </div>
              </div>
                );
              })()
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Documents;
