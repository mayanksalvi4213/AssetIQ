"use client";
import React, { useState } from "react";
import { FileUpload } from "@/components/ui/file-upload";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { cn } from "@/lib/utils";

const OcrPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [ocrResult, setOcrResult] = useState<string>("");
  const [active, setActive] = useState<string | null>(null);

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
    console.log("Uploaded file:", uploadedFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setOcrResult("");
  };

  const handleScan = async () => {
    if (!file) {
      alert("Please upload a PDF before scanning!");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:5000/scan", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to scan file");
      const data = await response.json();
      setOcrResult(data.raw_text);
    } catch (error) {
      console.error("Error during scan:", error);
      alert("Error scanning file");
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ocrResult }),
      });
      if (!response.ok) throw new Error("Failed to save result");
      alert("OCR result saved successfully!");
    } catch (error) {
      console.error("Error saving result:", error);
      alert("Error saving result");
    }
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center py-12 px-4"
      style={{ backgroundColor: "#2d2d2d" }} // Dark grey page background
    >
      {/* Dot Background */}
      <div
        className={cn(
          "absolute inset-0",
          "[background-size:20px_20px]",
          "[background-image:radial-gradient(#3f3f3f_1px,transparent_1px)]"
        )}
      />

      {/* Faded radial effect */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{
          backgroundColor: "#2d2d2d",
          maskImage: "radial-gradient(ellipse at center, transparent 20%, black)",
        }}
      ></div>

      {/* ✅ Navbar shifted to top-right */}
      <div className="fixed top-3 right-6 z-50">
        <Menu setActive={setActive}>
          <MenuItem setActive={setActive} active={active} item="Asset Management">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/dashboard/assets">All Assets</HoveredLink>
              <HoveredLink href="/ocr">Add Assets</HoveredLink>
              <HoveredLink href="/dashboard/bulk-import">Bulk Import</HoveredLink>
            </div>
          </MenuItem>

          <MenuItem setActive={setActive} active={active} item="Lab Management">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/dashboard/lab-floor-plans">Lab Floor Plans</HoveredLink>
              <HoveredLink href="/dashboard/lab-configuration">Lab Configuration</HoveredLink>
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
              <HoveredLink href="/dashboard/reports">Reports</HoveredLink>
            </div>
          </MenuItem>
        </Menu>
      </div>

      <h1
        className="text-3xl font-bold mb-8 relative z-20 mt-16"
        style={{ color: "#f3f4f6" }} // Light text on dark background
      >
        OCR Scanner
      </h1>

      {/* File Upload */}
      <div className="w-full max-w-4xl mb-6 relative z-20">
        <div
          className="border border-dashed rounded-lg p-6 border-gray-300 shadow-md"
          style={{ backgroundColor: "#f3f4f6", color: "#111827" }} // Grey upload box
        >
          {!file ? (
            <div>
              <FileUpload onChange={handleFileUpload} />
            </div>
          ) : (
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">PDF</span>
                </div>
                <div>
                  <p className="text-gray-900 font-medium">{file.name}</p>
                  <p className="text-gray-600 text-sm">
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
      {file && (
        <div className="flex gap-4 mb-6 relative z-20">
          <HoverBorderGradient
            as="button"
            containerClassName="rounded-full"
            className="px-6 py-2 bg-blue-600 text-white font-semibold"
            onClick={handleScan}
          >
            Scan PDF
          </HoverBorderGradient>
        </div>
      )}

      {/* OCR Result */}
      {ocrResult && (
        <div className="w-full max-w-4xl mb-6 relative z-20">
          <h3 className="text-white text-lg font-semibold mb-3">OCR Result:</h3>
          <textarea
            className="w-full h-64 p-4 rounded-lg border border-neutral-400"
            style={{ backgroundColor: "#f3f4f6", color: "#111827" }} // Grey textarea
            value={ocrResult}
            onChange={(e) => setOcrResult(e.target.value)}
            placeholder="OCR extracted text will appear here..."
          />
        </div>
      )}

      {/* Save Button */}
      {ocrResult && (
        <div className="flex gap-4 relative z-20">
          <HoverBorderGradient
            as="button"
            containerClassName="rounded-full"
            className="px-6 py-2 bg-green-600 text-white font-semibold"
            onClick={handleSave}
          >
            Save Bill Information
          </HoverBorderGradient>
        </div>
      )}
    </div>
  );
};

export default OcrPage;
