"use client";
import React, { useState } from "react";
import { CometCard } from "@/components/ui/comet-card";
import AppNavbar from "@/components/AppNavbar";

const Reports: React.FC = () => {
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

      <AppNavbar />

      {/* Heading */}
      <h1 
        className="text-3xl font-bold mb-12 relative z-20 mt-16 px-5 py-2 rounded-xl inline-block"
        style={{
          background: "linear-gradient(135deg, rgba(10, 14, 25, 0.75) 0%,rgba(15, 23, 42, 0.80) 25%,rgba(8, 10, 15, 0.88) 50%,rgba(15, 23, 42, 0.80) 75%, rgba(20, 18, 16, 0.75) 100%)",
          color: "white",
          boxShadow: "0 4px 15px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
        }}
      >
        Asset Reports
      </h1>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-10 max-w-7xl relative z-20">
        {/* Warranty Expiry */}
        <CometCard>
          <div className="p-7 text-white bg-neutral-800/95 rounded-2xl backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-2">Warranty Expiry</h2>
            <p className="text-gray-300 text-xs mb-4">
              Track which asset batches are nearing warranty expiry.
            </p>
            <button
              onClick={() => (window.location.href = "/reports/warranty")}
              className="px-4 py-2 bg-blue-600 rounded-lg text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              View Report
            </button>
          </div>
        </CometCard>

        {/* Issue Trends */}
        <CometCard>
          <div className="p-7 text-white bg-neutral-800/95 rounded-2xl backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-2">Issue Trends</h2>
            <p className="text-gray-300 text-xs mb-4">
              Find which batches had the most reported issues.
            </p>
            <button
              onClick={() => (window.location.href = "/reports/issue-trends")}
              className="px-4 py-2 bg-red-600 rounded-lg text-white font-semibold hover:bg-red-700 transition-colors"
            >
              View Report
            </button>
          </div>
        </CometCard>

        {/* Budget & Purchase removed per request */}

        {/* Proactive Maintenance */}
        <CometCard>
          <div className="p-7 text-white bg-neutral-800/95 rounded-2xl backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-2">Proactive Maintenance</h2>
            <p className="text-gray-300 text-xs mb-4">
              Identify assets that require preventive maintenance.
            </p>
            <button
              onClick={() => (window.location.href = "/reports/proactive-maintenance")}
              className="px-4 py-2 bg-yellow-600 rounded-lg text-white font-semibold hover:bg-yellow-700 transition-colors"
            >
              View Report
            </button>
          </div>
        </CometCard>

        {/* Asset Transfer/Scrap */}
        <CometCard>
          <div className="p-7 text-white bg-neutral-800/95 rounded-2xl backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-2">Asset Transfer / Scrap</h2>
            <p className="text-gray-300 text-xs mb-4">
              Track asset transfers and scrapped devices.
            </p>
            <button className="px-4 py-2 bg-purple-600 rounded-lg text-white font-semibold hover:bg-purple-700 transition-colors">
              View Report
            </button>
          </div>
        </CometCard>
      </div>
    </div>
  );
};

export default Reports;

