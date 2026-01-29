"use client";
import React, { useState, useEffect } from "react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LogoButton } from "@/components/ui/logo-button";

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
}

interface DeadStockEntry {
  srNo: string;
  labName: string;
  stationCode: string;
  itemDescription: string;
  deviceCount: number;
  devices: Array<{
    type: string;
    brand: string;
    model: string;
    specification: string;
    assetCode: string;
    unitPrice: number;
  }>;
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
  remark: string;
  signOfLabInCharge: string;
  warrantyYears: number;
}

const Documents: React.FC = () => {
  const [active, setActive] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"bills" | "deadstock">("bills");
  const [bills, setBills] = useState<Bill[]>([]);
  const [deadStockData, setDeadStockData] = useState<DeadStockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="w-full max-w-7xl relative z-20">
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
                <h2 className="text-2xl font-semibold mb-6 text-white">Bills</h2>
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
                              <button className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 transition-colors text-sm">
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
              <div className="p-6 bg-neutral-800/95 rounded-2xl backdrop-blur-sm">
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-white">Dead Stock Register</h2>
                  <p className="text-sm text-gray-400 mt-1">A. P. SHAH INSTITUTE OF TECHNOLOGY</p>
                  <p className="text-xs text-gray-500">Survey No. 12, Opp. Hypercity Mall, Kasarvadavali, Ghodbunder Road, Thane (W)-400 615.</p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-white text-sm border border-gray-600">
                    <thead className="bg-neutral-700/80">
                      <tr>
                        <th className="px-2 py-2 border border-gray-600">Sr. No.</th>
                        <th className="px-2 py-2 border border-gray-600">Lab</th>
                        <th className="px-2 py-2 border border-gray-600">Station</th>
                        <th className="px-2 py-2 border border-gray-600">Linked Devices</th>
                        <th className="px-2 py-2 border border-gray-600">Name & Add. of Supplier</th>
                        <th className="px-2 py-2 border border-gray-600">Order No.</th>
                        <th className="px-2 py-2 border border-gray-600">Bill No. & Date</th>
                        <th className="px-2 py-2 border border-gray-600">Central Store No.</th>
                        <th className="px-2 py-2 border border-gray-600">Qty</th>
                        <th className="px-2 py-2 border border-gray-600">Rate / Unit</th>
                        <th className="px-2 py-2 border border-gray-600">Cost</th>
                        <th className="px-2 py-2 border border-gray-600">Date of Delivery</th>
                        <th className="px-2 py-2 border border-gray-600">Identity No.</th>
                        <th className="px-2 py-2 border border-gray-600">Warranty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deadStockData.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="px-4 py-8 text-center text-gray-400">
                            No dead stock entries found. Configure labs first.
                          </td>
                        </tr>
                      ) : (
                        deadStockData.map((item, index) => (
                          <tr
                            key={index}
                            className="border-b border-gray-700 hover:bg-neutral-700/30"
                          >
                            <td className="px-2 py-3 border border-gray-600 font-semibold">{item.srNo}</td>
                            <td className="px-2 py-3 border border-gray-600 font-semibold text-blue-400">{item.labName}</td>
                            <td className="px-2 py-3 border border-gray-600 font-bold text-green-400">{item.stationCode}</td>
                            <td className="px-3 py-3 border border-gray-600">
                              <div className="space-y-2">
                                {item.devices && item.devices.map((device, idx) => (
                                  <div key={idx} className="bg-neutral-800/50 p-2 rounded border border-neutral-600">
                                    <div className="font-semibold text-white text-xs">
                                      {device.type}: {device.brand} {device.model}
                                    </div>
                                    {device.specification && (
                                      <div className="text-gray-400 text-xs italic">{device.specification}</div>
                                    )}
                                    {device.assetCode && (
                                      <div className="text-blue-400 text-xs font-mono">{device.assetCode}</div>
                                    )}
                                    <div className="text-green-400 text-xs">₹{device.unitPrice.toFixed(2)}</div>
                                  </div>
                                ))}
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
                            <td className="px-2 py-3 border border-gray-600 text-center">{item.warrantyYears}y</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 text-xs text-gray-400">
                  <p>* Dead Stock Register is a comprehensive record of all non-consumable items purchased by the institute.</p>
                  <p className="mt-1">Total Entries: {deadStockData.length}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Documents;
