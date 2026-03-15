"use client";

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";

export function ScrapHoverButton() {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show the button if we're already on the scrap page or landing page
  if (location.pathname === "/scrap" || location.pathname === "/") {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-8 right-8 z-[60] cursor-pointer"
      onClick={() => navigate("/scrap")}
    >
      <div className="group relative flex items-center justify-center">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-red-600 rounded-full blur-md opacity-40 group-hover:opacity-60 transition-opacity"></div>
        
        {/* Button body */}
        <div className="relative h-14 w-14 bg-gradient-to-br from-red-600 to-red-800 rounded-full flex items-center justify-center border border-red-500/50 shadow-2xl backdrop-blur-sm">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-7 w-7 text-white" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
            />
          </svg>
        </div>
        
        {/* Label on hover */}
        <span className="absolute right-16 scale-0 group-hover:scale-100 transition-all origin-right bg-neutral-900 text-white text-xs font-bold py-2 px-3 rounded-lg border border-neutral-700 whitespace-nowrap shadow-xl">
          Quick Scrap
        </span>
      </div>
    </motion.div>
  );
}
