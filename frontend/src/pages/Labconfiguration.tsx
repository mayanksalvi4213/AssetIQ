"use client";
import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu"; // ✅ navbar
import { cn } from "@/lib/utils";
import { LogoButton } from "@/components/ui/logo-button";

interface Equipment {
  type: string;
  quantity: number;
}

interface Lab {
  id: number;
  name: string;
  equipment: Equipment[];
}

export default function LabConfiguration() {
  
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [labName, setLabName] = useState("");
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [newType, setNewType] = useState("");
  const [newQty, setNewQty] = useState<number>(0);
  const [active, setActive] = useState<string | null>(null);

  // ✅ mock existing labs
  useEffect(() => {
    setLabs([
      { id: 1, name: "Lab 309", equipment: [{ type: "PC", quantity: 30 }] },
      { id: 2, name: "Lab 210", equipment: [{ type: "Projector", quantity: 2 }] },
    ]);
  }, []);

  const addEquipment = () => {
    if (newType && newQty > 0) {
      setEquipment([...equipment, { type: newType, quantity: newQty }]);
      setNewType("");
      setNewQty(0);
    }
  };

  const saveLab = () => {
    const payload = { labName, equipment };
    console.log("Saving Lab Config:", payload);

    if (selectedLabId) {
      setLabs(
        labs.map((lab) =>
          lab.id === selectedLabId ? { ...lab, name: labName, equipment } : lab
        )
      );
    } else {
      const newLab: Lab = {
        id: Date.now(),
        name: labName,
        equipment,
      };
      setLabs([...labs, newLab]);
    }

    setSelectedLabId(null);
    setLabName("");
    setEquipment([]);
  };

  const loadLab = (id: number) => {
    const lab = labs.find((l) => l.id === id);
    if (lab) {
      setSelectedLabId(lab.id);
      setLabName(lab.name);
      setEquipment(lab.equipment);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950" style={{
      backgroundImage: 'url(/bg.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      
      {/* ✅ Top Navbar (slimmer) */}
      <div className="fixed top-2 inset-x-0 max-w-6xl mx-auto z-50 flex items-center justify-center px-4 py-2">

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

      {/* ✅ Page content (with padding for navbar) */}
      <div className="flex items-center justify-center pt-24">
        <BackgroundGradient className="w-full max-w-3xl p-8 rounded-xl shadow-xl">
          <LogoButton />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-3xl font-bold text-center mb-6 text-white">
              {selectedLabId ? "Edit Lab" : "Configure New Lab"}
            </h1>

            {/* Select Existing Lab */}
            <div className="mb-6">
              <Label className="text-white">Edit Existing Lab</Label>
              <select
                value={selectedLabId ?? ""}
                onChange={(e) =>
                  e.target.value ? loadLab(Number(e.target.value)) : setSelectedLabId(null)
                }
                className="mt-2 w-full bg-neutral-800 text-white p-2 rounded-lg"
              >
                <option value="">-- Select Lab --</option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Lab Name */}
            <div className="mb-6">
              <Label htmlFor="labName" className="text-white">
                Lab Name / Number
              </Label>
              <Input
                id="labName"
                placeholder="e.g., Lab 309"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                className="mt-2"
              />
            </div>

            {/* Add Equipment */}
            <div className="mb-6 space-y-2">
              <Label className="text-white">Add Equipment</Label>
              <div className="flex gap-3">
                <Input
                  placeholder="Type (e.g., PC, Projector, AC)"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Qty"
                  value={newQty || ""}
                  onChange={(e) => setNewQty(Number(e.target.value))}
                  className="w-24"
                />
                <HoverBorderGradient onClick={addEquipment}>
                  Add
                </HoverBorderGradient>
              </div>
            </div>

            {/* Equipment List */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">
                Equipment
              </h2>
              {equipment.length === 0 ? (
                <p className="text-gray-400">No equipment added yet.</p>
              ) : (
                <ul className="space-y-2">
                  {equipment.map((eq, idx) => (
                    <li
                      key={idx}
                      className="flex justify-between bg-neutral-800 text-white px-4 py-2 rounded-lg"
                    >
                      <span>
                        {eq.type} × {eq.quantity}
                      </span>
                      <button
                        className="text-red-400 hover:text-red-600"
                        onClick={() =>
                          setEquipment(equipment.filter((_, i) => i !== idx))
                        }
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Save Button */}
            <div className="flex justify-center">
              <HoverBorderGradient onClick={saveLab}>
                {selectedLabId ? "Update Lab" : "Save Lab"}
              </HoverBorderGradient>
            </div>
          </motion.div>
        </BackgroundGradient>
      </div>
    </div>
  );
}
