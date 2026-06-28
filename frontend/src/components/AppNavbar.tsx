"use client";

import React, { useState } from "react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LogoButton } from "@/components/ui/logo-button";
import { useAuth } from "@/contexts/AuthContext";

type AppNavbarProps = {
  rightContent?: React.ReactNode;
  className?: string;
};

const AppNavbar: React.FC<AppNavbarProps> = ({ rightContent, className }) => {
  const [active, setActive] = useState<string | null>(null);
  const { logout, user } = useAuth();

  return (
    <>
      <LogoButton />
      <div
        className={`fixed top-4 inset-x-0 max-w-7xl mx-auto z-50 flex items-center px-6 ${
          rightContent ? "justify-between" : "justify-center"
        } ${className ?? ""}`}
      >
        <Menu setActive={setActive}>
          <MenuItem setActive={setActive} active={active} item="Asset Management">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/all-assets">All Assets</HoveredLink>
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

        {rightContent ? <div className="w-full max-w-sm">{rightContent}</div> : null}
      </div>
    </>
  );
};

export default AppNavbar;
