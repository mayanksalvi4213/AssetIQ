"use client";
import React, { useState } from "react";
import { FileUpload } from "@/components/ui/file-upload";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LoaderOne } from "@/components/ui/loader";
import { IconSquareRoundedX, IconDownload } from "@tabler/icons-react";
import { LogoButton } from "@/components/ui/logo-button";

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

const OcrPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRawText, setShowRawText] = useState(false);

  const handleFileUpload = (files: File[]) => {
    if (file) {
      alert("You can only upload one PDF at a time. Please remove the current file first.");
      return;
    }
    const uploadedFile = files[0];
    if (uploadedFile && uploadedFile.type !== "application/pdf") {
      alert("Please upload only PDF files.");
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

  const formatCurrency = (amount?: number) => {
    if (!amount) return "N/A";
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
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

      {/* File Upload */}
      <div className="w-full max-w-4xl mb-6 relative z-20">
        <LogoButton />
        <div
          className="border border-dashed rounded-lg p-6 border-gray-600 shadow-md [&_p]:!text-white [&_.text-neutral-700]:!text-white [&_.text-neutral-400]:!text-gray-200 [&_.dark\\:text-neutral-300]:!text-white [&_.dark\\:text-neutral-400]:!text-gray-200"
          style={{ backgroundColor: "#2c2c2c", color: "#f3f4f6" }}
        >
          {!file ? (
            <FileUpload onChange={handleFileUpload} />
          ) : (
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">PDF</span>
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
        <div className="flex gap-4 mb-6 relative z-20">
          <HoverBorderGradient
            as="button"
            containerClassName="rounded-full"
            className="px-6 py-2 bg-blue-600 text-white font-semibold"
            onClick={handleScan}
          >
            Scan PDF & Extract Assets
          </HoverBorderGradient>
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
                      <div className="flex items-center gap-3 mb-3">
                        <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          {asset.asset_id}
                        </span>
                        <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs">
                          {asset.category.toUpperCase()}
                        </span>
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
          <div className="flex gap-4 justify-center relative z-20">
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
              }}
            >
              Scan Another Bill
            </HoverBorderGradient>
          </div>

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
    </div>
  );
};

export default OcrPage;
