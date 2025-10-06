"use client";

import React from "react";
import { useNavigate } from "react-router-dom";

export function LogoButton() {
  const navigate = useNavigate();

  return (
    <div
      className="fixed top-4 left-4 z-50 cursor-pointer"
      onClick={() => navigate("/dashboard")}
    >
      <img
        src="/public/logoasset.png" // <-- replace with actual file name from /public
        alt="Institute Logo"
        className="h-17 w-17 object-contain"
      />
    </div>
  );
}
