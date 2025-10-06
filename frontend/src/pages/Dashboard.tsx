"use client";
import React, { useState } from "react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { WobbleCard } from "@/components/ui/wobble-card";

import { LogoButton } from "@/components/ui/logo-button";



export default function Dashboard() {
  const [active, setActive] = useState<string | null>(null);
  const placeholders = [
    "Search assets by ID...",
    "Search assets by name...",
    "Search labs or locations...",
  ];
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("Search query:", e.target.value);
  };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Search submitted");
  };
  return (
    <div className="relative min-h-screen w-full bg-black text-white" style={{
      backgroundImage: 'url(/bg.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      {" "}
      <LogoButton />
      {/* Radial gradient for the container to give a faded look */}{" "}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>{" "}
      {/* Top Bar (Navbar + Search) */}{" "}
      <div className="fixed top-4 inset-x-0 max-w-7xl mx-auto z-50 flex items-center justify-between px-6">
        {" "}
        <Menu setActive={setActive}>
          {" "}
          <MenuItem
            setActive={setActive}
            active={active}
            item="Asset Management"
          >
            {" "}
            <div className="flex flex-col space-y-2 text-sm p-2">
              {" "}
              <HoveredLink href="/assets">
                All Assets
              </HoveredLink>{" "}
              <HoveredLink href="/ocr">Add Assets</HoveredLink>{" "}
             
            </div>{" "}
          </MenuItem>{" "}
          <MenuItem setActive={setActive} active={active} item="Lab Management">
            {" "}
            <div className="flex flex-col space-y-2 text-sm p-2">
              {" "}
              <HoveredLink href="/lab-plan">Lab Floor Plans</HoveredLink>{" "}
              <HoveredLink href="/lab-configuration">
                Lab Configuration
              </HoveredLink>{" "}
            </div>{" "}
          </MenuItem>{" "}
          <MenuItem setActive={setActive} active={active} item="Operations">
            {" "}
            <div className="flex flex-col space-y-2 text-sm p-2">
              {" "}
              <HoveredLink href="/dashboard/transfers">
                Transfers
              </HoveredLink>{" "}
              <HoveredLink href="/dashboard/issues">Issues</HoveredLink>{" "}
              <HoveredLink href="/dashboard/documents">Documents</HoveredLink>{" "}
            </div>{" "}
          </MenuItem>{" "}
          <MenuItem setActive={setActive} active={active} item="Analytics">
            {" "}
            <div className="flex flex-col space-y-2 text-sm p-2">
              {" "}
              <HoveredLink href="/reports">Reports</HoveredLink>{" "}
            </div>{" "}
          </MenuItem>{" "}
        </Menu>{" "}
        <div className="w-full max-w-sm">
          {" "}
          <PlaceholdersAndVanishInput
            placeholders={placeholders}
            onChange={handleChange}
            onSubmit={onSubmit}
          />{" "}
        </div>{" "}
      </div>{" "}
      {/* Asset Overview */}{" "}
      <section className="pt-32 px-6 max-w-7xl mx-auto relative z-10">
        {" "}
        <h2 className="text-2xl font-bold mb-8 text-white">
          {" "}
          Asset Overview{" "}
        </h2>{" "}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {" "}
          <WobbleCard containerClassName="col-span-1 min-h-[150px] bg-blue-600">
            {" "}
            <div className="flex flex-col items-center justify-center text-white w-full h-full">
              {" "}
              <p className="text-sm font-medium">Total Assets</p>{" "}
              <h3 className="text-3xl font-bold mt-2">4,247</h3>{" "}
            </div>{" "}
          </WobbleCard>{" "}
          <WobbleCard containerClassName="col-span-1 min-h-[150px] bg-green-600">
            {" "}
            <div className="flex flex-col items-center justify-center text-white w-full h-full">
              {" "}
              <p className="text-sm font-medium">Working</p>{" "}
              <h3 className="text-3xl font-bold mt-2">3,842</h3>{" "}
            </div>{" "}
          </WobbleCard>{" "}
          <WobbleCard containerClassName="col-span-1 min-h-[150px] bg-orange-500">
            {" "}
            <div className="flex flex-col items-center justify-center text-white w-full h-full">
              {" "}
              <p className="text-sm font-medium">Maintenance</p>{" "}
              <h3 className="text-3xl font-bold mt-2">285</h3>{" "}
            </div>{" "}
          </WobbleCard>{" "}
          <WobbleCard containerClassName="col-span-1 min-h-[150px] bg-red-600">
            {" "}
            <div className="flex flex-col items-center justify-center text-white w-full h-full">
              {" "}
              <p className="text-sm font-medium">Offline</p>{" "}
              <h3 className="text-3xl font-bold mt-2">120</h3>{" "}
            </div>{" "}
          </WobbleCard>{" "}
        </div>{" "}
      </section>{" "}
    </div>
  );
}
