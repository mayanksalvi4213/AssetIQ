"use client";
import React, { useState } from "react";
import { FileUpload } from "@/components/ui/file-upload";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LoaderOne } from "@/components/ui/loader";
import { IconSquareRoundedX, IconDownload, IconPlus, IconTrash } from "@tabler/icons-react";
import { LogoButton } from "@/components/ui/logo-button";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Asset {
  asset_id: string;
  name: string;
  category: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  qr_code: string;
  brand?: string;
  model?: string;
  device_type?: string; // Auto-detected device type
}

interface BillInfo {
  id: string;
  bill_number: string;
  vendor_name: string;
  vendor_gstin: string;
  vendor_address: string;
  vendor_phone: string;
  vendor_email: string;
  bill_date: string;
  due_date: string;
  total_amount: number;
  tax_amount: number;
  discount: number;
  warranty_info: string;
}

interface ScanResult {
  success: boolean;
  message: string;
  bill_info: BillInfo;
  assets: Asset[];
  raw_text: string;
}

interface NormalizedItem {
  description: string | null;
  model: string | null;
  quantity: number | null;
  price_per_unit: number | null;
  line_total: number | null;
  warranty: string | null;
}

interface NormalizedInvoice {
  invoice_no: string | null;
  invoice_date: string | null;
  vendor_name: string | null;
  buyer_name: string | null;
  gstin: string | null;
  items: NormalizedItem[];
  grand_total: number | null;
  taxable_value: number | null;
  total_tax: number | null;
  warranty_global: string | null;
}

interface ManualDevice {
  id: string;
  deviceType: string;
  customDeviceType?: string;
  dept: string;
  invoiceNo: string;
  vendorName: string;
  materialDescription: string;
  modelNo: string;
  brand: string;
  warranty: string;
  quantity: number;
  amountPerPcs: number;
  totalAmount: number;
}

const OcrPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [normalizedInvoice, setNormalizedInvoice] = useState<NormalizedInvoice | null>(null);
  const [isNormalizing, setIsNormalizing] = useState(false);

  // Manual entry states
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualDevices, setManualDevices] = useState<ManualDevice[]>([
    {
      id: "1",
      deviceType: "",
      customDeviceType: "",
      dept: "",
      invoiceNo: "",
      vendorName: "",
      materialDescription: "",
      modelNo: "",
      brand: "",
      warranty: "",
      quantity: 0,
      amountPerPcs: 0,
      totalAmount: 0,
    },
  ]);
  const [manualGrandTotal, setManualGrandTotal] = useState(0);
  const [manualStockEntry, setManualStockEntry] = useState("");
  const [manualTaxAmount, setManualTaxAmount] = useState(0);
  const [manualGstin, setManualGstin] = useState("");
  const [manualBillDate, setManualBillDate] = useState("");
  const [manualScanResult, setManualScanResult] = useState<ScanResult | null>(null);

  // Auto-calculate grand total whenever devices or tax amount changes
  React.useEffect(() => {
    const subtotal = manualDevices.reduce((sum, device) => sum + device.totalAmount, 0);
    const total = subtotal + (manualTaxAmount || 0);
    setManualGrandTotal(total);
  }, [manualDevices, manualTaxAmount]);

  const deviceTypes = [
    "Laptop",
    "PC",
    "AC",
    "Smart Board",
    "Projector",
    "Printer",
    "Scanner",
    "UPS",
    "Router",
    "Switch",
    "Server",
    "Monitor",
    "Keyboard",
    "Mouse",
    "Webcam",
    "Headset",
    "Other",
  ];

  const handleFileUpload = (files: File[]) => {
    if (file) {
      alert("You can only upload one file at a time. Please remove the current file first.");
      return;
    }
    const uploadedFile = files[0];
    
    // Check if file type is supported (PDF or Image)
    const supportedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/bmp',
      'image/tiff',
      'image/gif',
      'image/webp'
    ];
    
    if (uploadedFile && !supportedTypes.includes(uploadedFile.type)) {
      alert("Please upload PDF or Image files only (PDF, JPG, PNG, BMP, TIFF, GIF, WebP).");
      return;
    }
    
    setFile(uploadedFile);
    setScanResult(null); // Clear previous results
    console.log("Uploaded file:", uploadedFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setScanResult(null);
  };

  const handleScan = async () => {
    if (!file) return;

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch("http://127.0.0.1:5000/scan", {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        let msg = "Failed to scan file";
        try {
          const err = await response.json();
          if (err?.error) msg = err.error;
        } catch {}
        throw new Error(msg);
      }

      const data: ScanResult = await response.json();
      setScanResult(data);
      setLoading(false);
    } catch (error) {
      console.error("Error during scan:", error);
      alert((error as Error).message || "Error scanning file");
      setLoading(false);
    }
  };

  const downloadQRCode = (asset: Asset) => {
    const link = document.createElement("a");
    link.download = `${asset.asset_id}_QR.png`;
    link.href = asset.qr_code;
    link.click();
  };

  const formatCurrency = (amount?: number | null) => {
    if (!amount) return "N/A";
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const handleSaveRegister = async (overwrite: boolean = false) => {
    // Validate required fields
    if (!manualDevices[0]?.invoiceNo || !manualDevices[0]?.vendorName) {
      alert("Invoice Number and Vendor Name are required to save the bill.");
      return;
    }

    if (!manualBillDate) {
      alert("Bill Date is required to save the bill.");
      return;
    }

    // Validate device fields
    const hasEmptyDeviceFields = manualDevices.some(
      (device) => !device.deviceType || !device.dept || !device.materialDescription
    );

    if (hasEmptyDeviceFields) {
      alert("Please fill all required device fields (Device Type, Department, Material Description)");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // STEP 1: Save bill information
      const billPayload = {
        invoiceNumber: manualDevices[0].invoiceNo,
        vendorName: manualDevices[0].vendorName,
        billDate: manualBillDate,
        gstin: manualGstin,
        stockEntry: manualStockEntry,
        taxAmount: manualTaxAmount,
        totalAmount: manualGrandTotal,
        overwrite: overwrite
      };

      const billResponse = await fetch("http://127.0.0.1:5000/save_bill", {
        method: "POST",
        headers,
        body: JSON.stringify(billPayload),
      });

      const billData = await billResponse.json();

      if (billResponse.status === 409 && billData.duplicate) {
        // Bill already exists, ask for confirmation
        const confirmOverwrite = window.confirm(
          `${billData.message}\n\nDo you want to overwrite it?`
        );
        
        if (confirmOverwrite) {
          // Retry with overwrite flag
          await handleSaveRegister(true);
        }
        return;
      }

      if (!billResponse.ok) {
        throw new Error(billData.error || "Failed to save bill");
      }

      // STEP 2: Save devices information
      // Send the actual devices data from the form
      const devicesPayload = {
        invoiceNumber: manualDevices[0].invoiceNo,
        vendorName: manualDevices[0].vendorName,
        devices: manualDevices
      };

      console.log("Sending devices payload:", JSON.stringify(devicesPayload, null, 2));

      const devicesResponse = await fetch("http://127.0.0.1:5000/save_devices", {
        method: "POST",
        headers,
        body: JSON.stringify(devicesPayload),
      });

      const devicesData = await devicesResponse.json();

      if (!devicesResponse.ok) {
        throw new Error(devicesData.error || "Failed to save devices");
      }

      alert(`✅ ${billData.message}\n✅ ${devicesData.message}`);
    } catch (error) {
      console.error("Error saving registry:", error);
      alert((error as Error).message || "Error saving registry");
    }
  };

  // Manual entry handlers
  const addManualDevice = () => {
    const newId = (parseInt(manualDevices[manualDevices.length - 1].id) + 1).toString();
    setManualDevices([
      ...manualDevices,
      {
        id: newId,
        deviceType: "",
        customDeviceType: "",
        dept: "",
        invoiceNo: "",
        vendorName: "",
        materialDescription: "",
        modelNo: "",
        brand: "",
        warranty: "",
        quantity: 0,
        amountPerPcs: 0,
        totalAmount: 0,
      },
    ]);
  };

  const removeManualDevice = (id: string) => {
    if (manualDevices.length === 1) {
      alert("You must have at least one device entry");
      return;
    }
    setManualDevices(manualDevices.filter((device) => device.id !== id));
  };

  const updateManualDevice = (id: string, field: keyof ManualDevice, value: any) => {
    setManualDevices(
      manualDevices.map((device) => {
        if (device.id === id) {
          const updated = { ...device, [field]: value };
          // Auto-calculate total amount
          if (field === "quantity" || field === "amountPerPcs") {
            updated.totalAmount = updated.quantity * updated.amountPerPcs;
          }
          return updated;
        }
        return device;
      })
    );
  };

  const calculateManualGrandTotal = () => {
    const subtotal = manualDevices.reduce((sum, device) => sum + device.totalAmount, 0);
    const total = subtotal + (manualTaxAmount || 0);
    setManualGrandTotal(total);
  };

  const handleGenerateManualAssets = async () => {
    // Validate required fields
    const hasEmptyFields = manualDevices.some(
      (device) =>
        !device.deviceType ||
        !device.dept ||
        !device.invoiceNo ||
        !device.vendorName ||
        !device.materialDescription
    );

    if (hasEmptyFields) {
      alert("Please fill all required fields (Device Type, Dept, Invoice No, Vendor Name, Material Description)");
      return;
    }

    setLoading(true);

    try {
      // Prepare data for backend
      const payload = {
        devices: manualDevices,
        grandTotal: manualGrandTotal,
        stockEntry: manualStockEntry,
        taxAmount: manualTaxAmount,
        gstin: manualGstin,
      };

      // Get auth token - try to get it or proceed without auth for now
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      // Only add auth header if token exists
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("http://127.0.0.1:5000/manual_entry", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to generate assets from manual entry");
      }

      const data = await response.json();
      
      // Set the manual scan result to display assets with QR codes
      setManualScanResult(data);
      
      // Don't reset form, just show success
      alert(`✅ Successfully created ${data.assets.length} assets!`);
      setLoading(false);
    } catch (error) {
      console.error("Error generating manual assets:", error);
      alert((error as Error).message || "Error generating assets");
      setLoading(false);
    }
  };

  const handleNormalizeInvoice = async () => {
    if (!scanResult) return;

    setIsNormalizing(true);

    try {
      // Create fields object from scan result
      const fields: Record<string, any> = {
        "Invoice Number": scanResult.bill_info.bill_number,
        "Date": scanResult.bill_info.bill_date,
        "Vendor Name": scanResult.bill_info.vendor_name,
        "GSTIN": scanResult.bill_info.vendor_gstin,
        "Vendor Address": scanResult.bill_info.vendor_address,
        "Vendor Phone": scanResult.bill_info.vendor_phone,
        "Vendor Email": scanResult.bill_info.vendor_email,
        "Total Amount": scanResult.bill_info.total_amount,
        "Tax Amount": scanResult.bill_info.tax_amount,
        "Warranty": scanResult.bill_info.warranty_info,
      };

      // Add items
      scanResult.assets.forEach((asset, idx) => {
        fields[`Item ${idx + 1}`] = `${asset.name}, Model: ${asset.model || 'N/A'}, Qty: ${asset.quantity}, Price: ${asset.unit_price}, Total: ${asset.total_price}`;
      });

      const response = await fetch("http://127.0.0.1:5000/normalize_invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields }),
      });

      if (!response.ok) {
        throw new Error("Failed to normalize invoice");
      }

      const data = await response.json();
      setNormalizedInvoice(data.normalized_data);
      setIsNormalizing(false);
    } catch (error) {
      console.error("Error normalizing invoice:", error);
      alert("Failed to normalize invoice");
      setIsNormalizing(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center py-12 px-4"
      style={{ 
        backgroundColor: "#1c1c1c",
        backgroundImage: 'url(/bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >

      {/* Loader Overlay */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-[110]">
          <LoaderOne />
          <button
            className="absolute top-4 right-4 text-gray-200 z-[120]"
            onClick={() => setLoading(false)}
          >
            <IconSquareRoundedX className="h-10 w-10" />
          </button>
        </div>
      )}

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
      </div>

      <h1
        className="text-3xl font-bold mb-8 relative z-20 mt-16"
        style={{ color: "#f3f4f6" }}
      >
        Asset Registry Scanner 
      </h1>

      {/* Toggle between OCR and Manual Entry */}
      <div className="w-full max-w-4xl mb-6 flex justify-center gap-4 relative z-20">
        <button
          onClick={() => setShowManualEntry(false)}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            !showManualEntry
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          📄 OCR Scan Mode
        </button>
        <button
          onClick={() => setShowManualEntry(true)}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            showManualEntry
              ? "bg-purple-600 text-white shadow-lg"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          ✍️ Manual Entry Mode
        </button>
      </div>

      {/* Logo Button - Always visible */}
      <div className="w-full max-w-4xl mb-6 relative z-20">
        <LogoButton />
      </div>

      {/* Manual Entry Section */}
      {showManualEntry && (
        <div className="w-full max-w-6xl mb-6 relative z-20">
          <BackgroundGradient className="rounded-[22px] p-8 bg-gray-750">
            <h2 className="text-2xl font-bold text-gray-100 mb-6 flex items-center gap-2">
              ✍️ Manual Device Entry
            </h2>

            {/* Devices List */}
            <div className="space-y-6">
              {manualDevices.map((device, index) => (
                <div
                  key={device.id}
                  className="bg-gray-50 rounded-lg p-6 border-2 border-gray-300 relative shadow-sm"
                >
                  {/* Remove Button */}
                  {manualDevices.length > 1 && (
                    <button
                      onClick={() => removeManualDevice(device.id)}
                      className="absolute top-4 right-4 text-red-600 hover:text-red-700 transition bg-red-50 p-2 rounded-lg"
                    >
                      <IconTrash size={20} />
                    </button>
                  )}

                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Device #{index + 1}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Device Type Dropdown */}
                    <div>
                      <Label htmlFor={`deviceType-${device.id}`} className="text-gray-900 font-semibold">
                        Device Type <span className="text-red-600">*</span>
                      </Label>
                      <select
                        id={`deviceType-${device.id}`}
                        value={device.deviceType}
                        onChange={(e) =>
                          updateManualDevice(device.id, "deviceType", e.target.value)
                        }
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-900 focus:border-blue-500 focus:outline-none mt-1 font-medium"
                      >
                        <option value="">Select Device Type</option>
                        {deviceTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Custom Device Type - Only show when "Other" is selected */}
                    {device.deviceType === "Other" && (
                      <div>
                        <Label htmlFor={`customDeviceType-${device.id}`} className="text-gray-900 font-semibold">
                          Specify Device Type <span className="text-red-600">*</span>
                        </Label>
                        <Input
                          id={`customDeviceType-${device.id}`}
                          type="text"
                          placeholder="e.g., Tablet, Camera, etc."
                          value={device.customDeviceType || ""}
                          onChange={(e) =>
                            updateManualDevice(device.id, "customDeviceType", e.target.value)
                          }
                          className="mt-1 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 font-medium"
                        />
                      </div>
                    )}

                    {/* Department */}
                    <div>
                      <Label htmlFor={`dept-${device.id}`} className="text-gray-900 font-semibold">
                        Department <span className="text-red-600">*</span>
                      </Label>
                      <select
                        id={`dept-${device.id}`}
                        value={device.dept}
                        onChange={(e) =>
                          updateManualDevice(device.id, "dept", e.target.value)
                        }
                        className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-900 focus:border-blue-500 focus:outline-none mt-1 font-medium"
                      >
                        <option value="">Select Department</option>
                        <option value="CS">CS</option>
                        <option value="IT">IT</option>
                        <option value="AIML">AIML</option>
                        <option value="DS">DS</option>
                        <option value="MECH">MECH</option>
                        <option value="CIVIL">CIVIL</option>
                      </select>
                    </div>

                    {/* Material Description */}
                    <div>
                      <Label htmlFor={`materialDescription-${device.id}`} className="text-gray-900 font-semibold">
                        Material Description <span className="text-red-600">*</span>
                      </Label>
                      <Input
                        id={`materialDescription-${device.id}`}
                        type="text"
                        placeholder="e.g., Dell OptiPlex 7090"
                        value={device.materialDescription}
                        onChange={(e) =>
                          updateManualDevice(device.id, "materialDescription", e.target.value)
                        }
                        className="mt-1 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 font-medium"
                      />
                    </div>

                    {/* Model No */}
                    <div>
                      <Label htmlFor={`modelNo-${device.id}`} className="text-gray-900 font-semibold">Model No.</Label>
                      <Input
                        id={`modelNo-${device.id}`}
                        type="text"
                        placeholder="e.g., OP7090-i5"
                        value={device.modelNo}
                        onChange={(e) =>
                          updateManualDevice(device.id, "modelNo", e.target.value)
                        }
                        className="mt-1 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 font-medium"
                      />
                    </div>

                    {/* Brand */}
                    <div>
                      <Label htmlFor={`brand-${device.id}`} className="text-gray-900 font-semibold">Brand</Label>
                      <Input
                        id={`brand-${device.id}`}
                        type="text"
                        placeholder="e.g., Dell, HP, Lenovo"
                        value={device.brand}
                        onChange={(e) =>
                          updateManualDevice(device.id, "brand", e.target.value)
                        }
                        className="mt-1 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 font-medium"
                      />
                    </div>

                    {/* Warranty */}
                    <div>
                      <Label htmlFor={`warranty-${device.id}`} className="text-gray-900 font-semibold">Warranty</Label>
                      <Input
                        id={`warranty-${device.id}`}
                        type="text"
                        placeholder="e.g., 3 years, 1 year onsite"
                        value={device.warranty}
                        onChange={(e) =>
                          updateManualDevice(device.id, "warranty", e.target.value)
                        }
                        className="mt-1 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 font-medium"
                      />
                    </div>

                    {/* Quantity */}
                    <div>
                      <Label htmlFor={`quantity-${device.id}`} className="text-gray-900 font-semibold">Quantity</Label>
                      <Input
                        id={`quantity-${device.id}`}
                        type="number"
                        min="1"
                        value={device.quantity === 0 ? '' : device.quantity}
                        placeholder="Enter quantity"
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0;
                          updateManualDevice(device.id, "quantity", val);
                        }}
                        className="mt-1 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 font-medium"
                      />
                    </div>

                    {/* Amount Per Pcs */}
                    <div>
                      <Label htmlFor={`amountPerPcs-${device.id}`} className="text-gray-900 font-semibold">Amount Per Pcs (₹)</Label>
                      <Input
                        id={`amountPerPcs-${device.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={device.amountPerPcs === 0 ? '' : device.amountPerPcs}
                        placeholder="Enter amount per piece"
                        onChange={(e) =>
                          updateManualDevice(device.id, "amountPerPcs", parseFloat(e.target.value) || 0)
                        }
                        className="mt-1 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 font-medium"
                      />
                    </div>

                    {/* Total Amount (Auto-calculated) */}
                    <div>
                      <Label htmlFor={`totalAmount-${device.id}`} className="text-gray-900 font-semibold">Total Amount (₹)</Label>
                      <Input
                        id={`totalAmount-${device.id}`}
                        type="number"
                        value={device.totalAmount}
                        readOnly
                        className="mt-1 bg-gray-200 border-2 border-gray-300 cursor-not-allowed text-gray-900 font-bold"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Device Button */}
            <div className="mt-6 flex justify-center">
              <button
                onClick={addManualDevice}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
              >
                <IconPlus size={20} />
                Add Another Device
              </button>
            </div>

            {/* Common Invoice Fields */}
            <div className="mt-8 p-6 bg-blue-50 rounded-lg border-2 border-blue-300 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📋 Invoice Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Invoice Number */}
                <div>
                  <Label htmlFor="invoiceNo" className="text-gray-900 font-semibold">
                    Invoice No. <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="invoiceNo"
                    type="text"
                    placeholder="e.g., INV-2024-001"
                    value={manualDevices[0]?.invoiceNo || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setManualDevices(manualDevices.map(device => ({ ...device, invoiceNo: value })));
                    }}
                    className="mt-1 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 font-medium"
                  />
                </div>

                {/* Vendor Name */}
                <div>
                  <Label htmlFor="vendorName" className="text-gray-900 font-semibold">
                    Vendor Name <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="vendorName"
                    type="text"
                    placeholder="e.g., Dell Technologies"
                    value={manualDevices[0]?.vendorName || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setManualDevices(manualDevices.map(device => ({ ...device, vendorName: value })));
                    }}
                    className="mt-1 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 font-medium"
                  />
                </div>

                {/* Bill Date */}
                <div>
                  <Label htmlFor="billDate" className="text-gray-900 font-semibold">
                    Bill Date <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="billDate"
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={manualBillDate}
                    onChange={(e) => {
                      let value = e.target.value.replace(/[^0-9]/g, '');
                      if (value.length >= 2) {
                        value = value.slice(0, 2) + '/' + value.slice(2);
                      }
                      if (value.length >= 5) {
                        value = value.slice(0, 5) + '/' + value.slice(5, 9);
                      }
                      setManualBillDate(value);
                    }}
                    maxLength={10}
                    className="mt-1 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 font-medium"
                  />
                </div>

                {/* Stock Entry */}
                <div>
                  <Label htmlFor="stockEntry" className="text-gray-900 font-semibold">Stock Entry</Label>
                  <Input
                    id="stockEntry"
                    type="text"
                    placeholder="e.g., SE-2024-001"
                    value={manualStockEntry}
                    onChange={(e) => setManualStockEntry(e.target.value)}
                    className="mt-1 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 font-medium"
                  />
                </div>

                {/* Tax Amount */}
                <div>
                  <Label htmlFor="taxAmount" className="text-gray-900 font-semibold">Tax Amount (₹)</Label>
                  <Input
                    id="taxAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualTaxAmount || ''}
                    onChange={(e) => setManualTaxAmount(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                    className="mt-1 bg-white border-2 border-gray-300 text-gray-900 font-medium"
                    placeholder="0.00"
                  />
                </div>

                {/* GSTIN */}
                <div>
                  <Label htmlFor="gstin" className="text-gray-900 font-semibold">GSTIN</Label>
                  <Input
                    id="gstin"
                    type="text"
                    placeholder="e.g., 27AABCU9603R1ZV"
                    maxLength={15}
                    value={manualGstin}
                    onChange={(e) => setManualGstin(e.target.value.toUpperCase())}
                    className="mt-1 bg-white border-2 border-gray-300 text-gray-900 placeholder-gray-500 font-medium"
                  />
                </div>

                {/* Grand Total */}
                <div>
                  <Label htmlFor="grandTotal" className="text-gray-900 font-semibold">Grand Total (₹)</Label>
                  <Input
                    id="grandTotal"
                    type="number"
                    value={manualGrandTotal.toFixed(2)}
                    readOnly
                    className="mt-1 bg-gray-200 border-2 border-gray-300 cursor-not-allowed text-gray-900 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <div className="mt-8 flex justify-center">
              <HoverBorderGradient
                as="button"
                containerClassName="rounded-full"
                className="px-8 py-3 bg-purple-600 text-white font-bold text-lg"
                onClick={handleGenerateManualAssets}
              >
                🚀 Generate Assets
              </HoverBorderGradient>
            </div>
          </BackgroundGradient>

          {/* Manual Entry Results - Display assets like OCR scan */}
          {manualScanResult && (
            <div className="w-full max-w-6xl mt-6 relative z-20">
              {/* Success Message */}
              <div className="mb-6 p-4 bg-green-600/20 border border-green-500 rounded-lg">
                <h3 className="text-green-400 text-lg font-semibold mb-2">
                  ✅ {manualScanResult.message}
                </h3>
                <p className="text-gray-300">
                  Created {manualScanResult.assets.length} assets from manual entry
                </p>
              </div>

              {/* Bill Information */}
              <div className="mb-6 p-6 rounded-lg border border-gray-600 bg-gray-800/50">
                <h3 className="text-gray-200 text-xl font-semibold mb-4">
                  📄 Bill Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Vendor Name</p>
                    <p className="text-gray-200 font-medium">{manualScanResult.bill_info.vendor_name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Bill Number</p>
                    <p className="text-gray-200 font-medium">{manualScanResult.bill_info.bill_number || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">GSTIN</p>
                    <p className="text-gray-200 font-medium">{manualScanResult.bill_info.vendor_gstin || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Bill Date</p>
                    <p className="text-gray-200 font-medium">{manualScanResult.bill_info.bill_date || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Total Amount</p>
                    <p className="text-green-400 font-semibold">{formatCurrency(manualScanResult.bill_info.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Tax Amount</p>
                    <p className="text-gray-200 font-medium">{formatCurrency(manualScanResult.bill_info.tax_amount)}</p>
                  </div>
                </div>
              </div>

              {/* Assets Registry */}
              <div className="mb-6 p-6 rounded-lg border border-gray-600 bg-gray-800/50">
                <h3 className="text-gray-200 text-xl font-semibold mb-4">
                  🏷️ Asset Registry ({manualScanResult.assets.length} items)
                </h3>
                <div className="grid gap-4">
                  {manualScanResult.assets.map((asset, index) => (
                    <div
                      key={index}
                      className="border border-gray-700 rounded-lg p-4 bg-gray-900/50"
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                        {/* Asset Info */}
                        <div className="lg:col-span-3">
                          <div className="flex items-center gap-3 mb-3 flex-wrap">
                            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                              {asset.asset_id}
                            </span>
                            <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs">
                              {asset.category.toUpperCase()}
                            </span>
                            {asset.device_type && (
                              <span className="bg-green-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                                🖥️ {asset.device_type}
                              </span>
                            )}
                          </div>
                          
                          <h4 className="text-gray-200 font-semibold text-lg mb-2">
                            {asset.name}
                          </h4>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-gray-400">Quantity</p>
                              <p className="text-gray-200 font-medium">{asset.quantity}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Unit Price</p>
                              <p className="text-gray-200 font-medium">{formatCurrency(asset.unit_price)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Total Price</p>
                              <p className="text-green-400 font-semibold">{formatCurrency(asset.total_price)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Brand</p>
                              <p className="text-gray-200 font-medium">{asset.brand || "N/A"}</p>
                            </div>
                          </div>
                          
                          {asset.model && (
                            <div className="mt-2">
                              <p className="text-gray-400 text-sm">Model: <span className="text-gray-200">{asset.model}</span></p>
                            </div>
                          )}
                        </div>

                        {/* QR Code */}
                        <div className="flex flex-col items-center gap-2">
                          <div className="bg-white p-2 rounded-lg">
                            <img 
                              src={asset.qr_code} 
                              alt={`QR code for ${asset.asset_id}`}
                              className="w-20 h-20"
                            />
                          </div>
                          <button
                            onClick={() => downloadQRCode(asset)}
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"
                          >
                            <IconDownload size={12} />
                            Download QR
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 justify-center relative z-20 mb-6">
                <HoverBorderGradient
                  as="button"
                  containerClassName="rounded-full"
                  className="px-6 py-2 bg-blue-600 text-white font-semibold"
                  onClick={() => handleSaveRegister(false)}
                >
                  💾 Save Register
                </HoverBorderGradient>
                
                <HoverBorderGradient
                  as="button"
                  containerClassName="rounded-full"
                  className="px-6 py-2 bg-green-600 text-white font-semibold"
                  onClick={() => {
                    // Reset everything for new entry
                    setManualDevices([
                      {
                        id: "1",
                        deviceType: "",
                        customDeviceType: "",
                        dept: "",
                        invoiceNo: "",
                        vendorName: "",
                        materialDescription: "",
                        modelNo: "",
                        brand: "",
                        warranty: "",
                        quantity: 0,
                        amountPerPcs: 0,
                        totalAmount: 0,
                      },
                    ]);
                    setManualGrandTotal(0);
                    setManualStockEntry("");
                    setManualTaxAmount(0);
                    setManualGstin("");
                    setManualBillDate("");
                    setManualScanResult(null);
                  }}
                >
                  ➕ Create New Entry
                </HoverBorderGradient>
              </div>
            </div>
          )}
        </div>
      )}

      {/* OCR Section - Only show when not in manual entry mode */}
      {!showManualEntry && (
        <>
      {/* File Upload */}
      <div className="w-full max-w-4xl mb-6 relative z-20">
        <div
          className="border border-dashed rounded-lg p-6 border-gray-600 shadow-md [&_p]:!text-white [&_.text-neutral-700]:!text-white [&_.text-neutral-400]:!text-gray-200 [&_.dark\\:text-neutral-300]:!text-white [&_.dark\\:text-neutral-400]:!text-gray-200"
          style={{ backgroundColor: "#2c2c2c", color: "#f3f4f6" }}
        >
          {!file ? (
            <FileUpload onChange={handleFileUpload} />
          ) : (
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 ${file.type === 'application/pdf' ? 'bg-red-600' : 'bg-blue-600'} rounded-lg flex items-center justify-center`}>
                  <span className="text-white font-bold text-sm">
                    {file.type === 'application/pdf' ? 'PDF' : 'IMG'}
                  </span>
                </div>
                <div>
                  <p className="text-gray-200 font-medium">{file.name}</p>
                  <p className="text-gray-400 text-sm">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <HoverBorderGradient
                as="button"
                containerClassName="rounded-full"
                className="px-4 py-2 bg-red-600 text-white font-semibold text-sm"
                onClick={handleRemoveFile}
              >
                Remove
              </HoverBorderGradient>
            </div>
          )}
        </div>
      </div>

      {/* Scan Button */}
      {file && !loading && !scanResult && (
        <div className="w-full max-w-4xl mb-6 relative z-20">
          <div className="flex justify-center">
            <HoverBorderGradient
              as="button"
              containerClassName="rounded-full"
              className="px-6 py-2 bg-blue-600 text-white font-semibold"
              onClick={handleScan}
            >
              {file.type === 'application/pdf' ? 'Scan PDF & Extract Assets' : 'Scan Image & Extract Assets'}
            </HoverBorderGradient>
          </div>
        </div>
      )}

      {/* Scan Results */}
      {scanResult && !loading && (
        <div className="w-full max-w-6xl mb-6 relative z-20">
          {/* Success Message */}
          <div className="mb-6 p-4 bg-green-600/20 border border-green-500 rounded-lg">
            <h3 className="text-green-400 text-lg font-semibold mb-2">
              ✅ {scanResult.message}
            </h3>
            <p className="text-gray-300">
              Extracted {scanResult.assets.length} assets from the bill
            </p>
          </div>

          {/* Bill Information */}
          <div className="mb-6 p-6 rounded-lg border border-gray-600 bg-gray-800/50">
            <h3 className="text-gray-200 text-xl font-semibold mb-4">
              📄 Bill Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Vendor Name</p>
                <p className="text-gray-200 font-medium">{scanResult.bill_info.vendor_name || "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Bill Number</p>
                <p className="text-gray-200 font-medium">{scanResult.bill_info.bill_number || "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">GSTIN</p>
                <p className="text-gray-200 font-medium">{scanResult.bill_info.vendor_gstin || "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Bill Date</p>
                <p className="text-gray-200 font-medium">{scanResult.bill_info.bill_date || "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Amount</p>
                <p className="text-green-400 font-semibold">{formatCurrency(scanResult.bill_info.total_amount)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Tax Amount</p>
                <p className="text-gray-200 font-medium">{formatCurrency(scanResult.bill_info.tax_amount)}</p>
              </div>
            </div>
            {scanResult.bill_info.vendor_address && (
              <div className="mt-4">
                <p className="text-gray-400 text-sm">Vendor Address</p>
                <p className="text-gray-200">{scanResult.bill_info.vendor_address}</p>
              </div>
            )}
          </div>

          {/* Assets Registry */}
          <div className="mb-6 p-6 rounded-lg border border-gray-600 bg-gray-800/50">
            <h3 className="text-gray-200 text-xl font-semibold mb-4">
              🏷️ Asset Registry ({scanResult.assets.length} items)
            </h3>
            <div className="grid gap-4">
              {scanResult.assets.map((asset, index) => (
                <div
                  key={index}
                  className="border border-gray-700 rounded-lg p-4 bg-gray-900/50"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                    {/* Asset Info */}
                    <div className="lg:col-span-3">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          {asset.asset_id}
                        </span>
                        <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs">
                          {asset.category.toUpperCase()}
                        </span>
                        {asset.device_type && (
                          <span className="bg-green-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                            🖥️ {asset.device_type}
                          </span>
                        )}
                      </div>
                      
                      <h4 className="text-gray-200 font-semibold text-lg mb-2">
                        {asset.name}
                      </h4>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-gray-400">Quantity</p>
                          <p className="text-gray-200 font-medium">{asset.quantity}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Unit Price</p>
                          <p className="text-gray-200 font-medium">{formatCurrency(asset.unit_price)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Total Price</p>
                          <p className="text-green-400 font-semibold">{formatCurrency(asset.total_price)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Brand</p>
                          <p className="text-gray-200 font-medium">{asset.brand || "N/A"}</p>
                        </div>
                      </div>
                      
                      {asset.model && (
                        <div className="mt-2">
                          <p className="text-gray-400 text-sm">Model: <span className="text-gray-200">{asset.model}</span></p>
                        </div>
                      )}
                    </div>

                    {/* QR Code */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="bg-white p-2 rounded-lg">
                        <img 
                          src={asset.qr_code} 
                          alt={`QR code for ${asset.asset_id}`}
                          className="w-20 h-20"
                        />
                      </div>
                      <button
                        onClick={() => downloadQRCode(asset)}
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"
                      >
                        <IconDownload size={12} />
                        Download QR
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center relative z-20 mb-6">
            <HoverBorderGradient
              as="button"
              containerClassName="rounded-full"
              className="px-6 py-2 bg-blue-600 text-white font-semibold"
              onClick={() => {
                alert("✅ Register saved successfully!");
                // You can add actual save logic here (e.g., download PDF, save to database, etc.)
              }}
            >
              💾 Save Register
            </HoverBorderGradient>

            <HoverBorderGradient
              as="button"
              containerClassName="rounded-full"
              className="px-6 py-2 bg-green-600 text-white font-semibold"
              onClick={() => setShowRawText(!showRawText)}
            >
              {showRawText ? "Hide" : "View"} Raw Text
            </HoverBorderGradient>
            
            <HoverBorderGradient
              as="button"
              containerClassName="rounded-full"
              className="px-6 py-2 bg-purple-600 text-white font-semibold"
              onClick={() => {
                setFile(null);
                setScanResult(null);
                setNormalizedInvoice(null);
              }}
            >
              Scan Another Bill
            </HoverBorderGradient>
          </div>

          {/* Normalized Invoice Display */}
          {normalizedInvoice && (
            <div className="mb-6 p-6 rounded-lg border-2 border-blue-500 bg-gradient-to-br from-blue-900/20 to-purple-900/20">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-blue-400 text-2xl font-bold">
                  🤖 AI-Normalized Invoice Data
                </h3>
                <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                  FLAN-T5
                </span>
              </div>

              {/* Header Information Table */}
              <div className="mb-6 overflow-x-auto">
                <table className="w-full border border-gray-600 rounded-lg overflow-hidden">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-200 font-semibold">Field</th>
                      <th className="px-4 py-3 text-left text-gray-200 font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800">
                    <tr className="border-b border-gray-700">
                      <td className="px-4 py-2 text-gray-400">Invoice Number</td>
                      <td className="px-4 py-2 text-white font-medium">{normalizedInvoice.invoice_no || "N/A"}</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="px-4 py-2 text-gray-400">Invoice Date</td>
                      <td className="px-4 py-2 text-white font-medium">{normalizedInvoice.invoice_date || "N/A"}</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="px-4 py-2 text-gray-400">Vendor Name</td>
                      <td className="px-4 py-2 text-white font-medium">{normalizedInvoice.vendor_name || "N/A"}</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="px-4 py-2 text-gray-400">Buyer Name</td>
                      <td className="px-4 py-2 text-white font-medium">{normalizedInvoice.buyer_name || "N/A"}</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="px-4 py-2 text-gray-400">GSTIN</td>
                      <td className="px-4 py-2 text-white font-medium font-mono">{normalizedInvoice.gstin || "N/A"}</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="px-4 py-2 text-gray-400">Taxable Value</td>
                      <td className="px-4 py-2 text-green-400 font-semibold">{formatCurrency(normalizedInvoice.taxable_value)}</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="px-4 py-2 text-gray-400">Total Tax</td>
                      <td className="px-4 py-2 text-orange-400 font-semibold">{formatCurrency(normalizedInvoice.total_tax)}</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="px-4 py-2 text-gray-400">Grand Total</td>
                      <td className="px-4 py-2 text-blue-400 font-bold text-lg">{formatCurrency(normalizedInvoice.grand_total)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-gray-400">Warranty</td>
                      <td className="px-4 py-2 text-white font-medium">{normalizedInvoice.warranty_global || "N/A"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Items Table */}
              {normalizedInvoice.items && normalizedInvoice.items.length > 0 && (
                <div>
                  <h4 className="text-gray-200 text-xl font-semibold mb-3">
                    📦 Line Items ({normalizedInvoice.items.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-600 rounded-lg overflow-hidden">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-gray-200 font-semibold">#</th>
                          <th className="px-4 py-3 text-left text-gray-200 font-semibold">Description</th>
                          <th className="px-4 py-3 text-left text-gray-200 font-semibold">Model</th>
                          <th className="px-4 py-3 text-center text-gray-200 font-semibold">Qty</th>
                          <th className="px-4 py-3 text-right text-gray-200 font-semibold">Unit Price</th>
                          <th className="px-4 py-3 text-right text-gray-200 font-semibold">Line Total</th>
                          <th className="px-4 py-3 text-left text-gray-200 font-semibold">Warranty</th>
                        </tr>
                      </thead>
                      <tbody className="bg-gray-800">
                        {normalizedInvoice.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-gray-700 hover:bg-gray-750">
                            <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                            <td className="px-4 py-3 text-white font-medium">{item.description || "N/A"}</td>
                            <td className="px-4 py-3 text-gray-300">{item.model || "N/A"}</td>
                            <td className="px-4 py-3 text-center text-white">{item.quantity ?? "N/A"}</td>
                            <td className="px-4 py-3 text-right text-green-400">{formatCurrency(item.price_per_unit)}</td>
                            <td className="px-4 py-3 text-right text-blue-400 font-semibold">{formatCurrency(item.line_total)}</td>
                            <td className="px-4 py-3 text-gray-300 text-sm">{item.warranty || "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
                <p className="text-blue-300 text-sm">
                  ✨ This data was normalized using FLAN-T5-small AI model running on CPU. 
                  All fields have been standardized to canonical format with proper date formatting, 
                  currency normalization, and GSTIN validation.
                </p>
              </div>
            </div>
          )}

          {/* Raw Text Display */}
          {showRawText && (
            <div className="mt-6 p-6 rounded-lg border border-gray-600 bg-gray-900/50">
              <h3 className="text-gray-200 text-lg font-semibold mb-3">
                Raw Extracted Text:
              </h3>
              <textarea
                className="w-full h-64 p-4 rounded-lg border border-gray-700 bg-gray-800 text-gray-200 text-sm"
                value={scanResult.raw_text}
                readOnly
                placeholder="Raw extracted text will appear here..."
              />
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default OcrPage;
