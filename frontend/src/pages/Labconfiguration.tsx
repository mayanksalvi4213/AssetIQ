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

interface GridCell {
  id: string | null; // e.g., "C001" or null for empty
  equipmentType: string; // "PC", "Empty", "Passage"
  os: string[]; // ["Windows", "Linux"]
}

interface SeatingArrangement {
  rows: number;
  columns: number;
  grid: GridCell[][]; // 2D array
}

interface Lab {
  id: number;
  name: string;
  equipment: Equipment[];
  seatingArrangement?: SeatingArrangement;
}

export default function LabConfiguration() {
  
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [labName, setLabName] = useState("");
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [newType, setNewType] = useState("");
  const [newQty, setNewQty] = useState<number>(0);
  const [active, setActive] = useState<string | null>(null);
  const [equipmentDropdown, setEquipmentDropdown] = useState<string>("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  
  // Common equipment types
  const commonEquipmentTypes = [
    "PC",
    "Laptop",
    "AC",
    "Smart Board",
    "Projector",
    "Printer",
    "Scanner",
    "UPS",
    "Router",
    "Switch",
    "Other",
  ];
  
  // Seating arrangement states
  const [seatingArrangement, setSeatingArrangement] = useState<SeatingArrangement>({
    rows: 6,
    columns: 6,
    grid: [],
  });
  const [showSeatingEditor, setShowSeatingEditor] = useState(false);
  const [draggedEquipment, setDraggedEquipment] = useState<string | null>(null);
  const [nextComputerId, setNextComputerId] = useState(1);
  const [selectionStart, setSelectionStart] = useState<{ row: number; col: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ row: number; col: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Initialize empty grid
  useEffect(() => {
    const emptyGrid: GridCell[][] = Array.from({ length: seatingArrangement.rows }, () =>
      Array.from({ length: seatingArrangement.columns }, () => ({
        id: null,
        equipmentType: "Empty",
        os: [],
      }))
    );
    setSeatingArrangement(prev => ({ ...prev, grid: emptyGrid }));
  }, [seatingArrangement.rows, seatingArrangement.columns]);

  // ✅ mock existing labs
  useEffect(() => {
    const mockGrid: GridCell[][] = Array.from({ length: 6 }, () =>
      Array.from({ length: 6 }, () => ({
        id: null,
        equipmentType: "Empty",
        os: [],
      }))
    );
    
    // Add some pre-configured computers
    mockGrid[0][0] = { id: "C001", equipmentType: "PC", os: ["Windows"] };
    mockGrid[0][1] = { id: "C002", equipmentType: "PC", os: ["Windows"] };

    setLabs([
      { 
        id: 1, 
        name: "Lab 309", 
        equipment: [{ type: "PC", quantity: 30 }],
        seatingArrangement: {
          rows: 6,
          columns: 6,
          grid: mockGrid,
        }
      },
      { 
        id: 2, 
        name: "Lab 210", 
        equipment: [{ type: "Projector", quantity: 2 }],
        seatingArrangement: {
          rows: 5,
          columns: 8,
          grid: Array.from({ length: 5 }, () =>
            Array.from({ length: 8 }, () => ({
              id: null,
              equipmentType: "Empty",
              os: [],
            }))
          ),
        }
      },
    ]);
  }, []);

  const addEquipment = () => {
    const equipmentType = equipmentDropdown === "Other" ? newType : equipmentDropdown;
    
    if (equipmentType && newQty > 0) {
      setEquipment([...equipment, { type: equipmentType, quantity: newQty }]);
      setEquipmentDropdown("");
      setNewType("");
      setNewQty(0);
      setShowCustomInput(false);
    }
  };

  const handleEquipmentDropdownChange = (value: string) => {
    setEquipmentDropdown(value);
    setShowCustomInput(value === "Other");
    if (value !== "Other") {
      setNewType(""); // Clear custom input when not "Other"
    }
  };

  const saveLab = () => {
    const payload = { labName, equipment, seatingArrangement };
    console.log("Saving Lab Config:", payload);

    if (selectedLabId) {
      setLabs(
        labs.map((lab) =>
          lab.id === selectedLabId ? { ...lab, name: labName, equipment, seatingArrangement } : lab
        )
      );
    } else {
      const newLab: Lab = {
        id: Date.now(),
        name: labName,
        equipment,
        seatingArrangement,
      };
      setLabs([...labs, newLab]);
    }

    setSelectedLabId(null);
    setLabName("");
    setEquipment([]);
    const emptyGrid: GridCell[][] = Array.from({ length: 6 }, () =>
      Array.from({ length: 6 }, () => ({
        id: null,
        equipmentType: "Empty",
        os: [],
      }))
    );
    setSeatingArrangement({ rows: 6, columns: 6, grid: emptyGrid });
    setShowSeatingEditor(false);
  };

  const loadLab = (id: number) => {
    const lab = labs.find((l) => l.id === id);
    if (lab) {
      setSelectedLabId(lab.id);
      setLabName(lab.name);
      setEquipment(lab.equipment);
      const emptyGrid: GridCell[][] = Array.from({ length: 6 }, () =>
        Array.from({ length: 6 }, () => ({
          id: null,
          equipmentType: "Empty",
          os: [],
        }))
      );
      setSeatingArrangement(lab.seatingArrangement || { rows: 6, columns: 6, grid: emptyGrid });
    }
  };

  const handleCellClick = (rowIdx: number, colIdx: number) => {
    if (draggedEquipment === "PC") {
      const newGrid = [...seatingArrangement.grid];
      const computerId = `C${String(nextComputerId).padStart(3, "0")}`;
      newGrid[rowIdx][colIdx] = {
        id: computerId,
        equipmentType: "PC",
        os: ["Windows"],
      };
      setSeatingArrangement({ ...seatingArrangement, grid: newGrid });
      setNextComputerId(nextComputerId + 1);
    } else if (draggedEquipment === "Empty") {
      const newGrid = [...seatingArrangement.grid];
      newGrid[rowIdx][colIdx] = {
        id: null,
        equipmentType: "Empty",
        os: [],
      };
      setSeatingArrangement({ ...seatingArrangement, grid: newGrid });
    }
  };

  const handleMouseDown = (rowIdx: number, colIdx: number) => {
    if (!draggedEquipment) return; // Only allow dragging if a tool is selected
    setIsSelecting(true);
    setSelectionStart({ row: rowIdx, col: colIdx });
    setSelectionEnd({ row: rowIdx, col: colIdx });
  };

  const handleMouseEnter = (rowIdx: number, colIdx: number) => {
    if (isSelecting && selectionStart && draggedEquipment) {
      setSelectionEnd({ row: rowIdx, col: colIdx });
    }
  };

  const handleMouseUp = () => {
    if (isSelecting && selectionStart && selectionEnd) {
      fillSelection();
    }
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const fillSelection = () => {
    if (!selectionStart || !selectionEnd) return;

    const minRow = Math.min(selectionStart.row, selectionEnd.row);
    const maxRow = Math.max(selectionStart.row, selectionEnd.row);
    const minCol = Math.min(selectionStart.col, selectionEnd.col);
    const maxCol = Math.max(selectionStart.col, selectionEnd.col);

    const newGrid = [...seatingArrangement.grid];
    
    // Get all existing PC IDs and find the next available number
    const existingIds = newGrid.flat()
      .filter(cell => cell.equipmentType === "PC" && cell.id)
      .map(cell => parseInt(cell.id!.substring(1)));
    
    let computerId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (draggedEquipment === "PC") {
          newGrid[row][col] = {
            id: `C${String(computerId).padStart(3, "0")}`,
            equipmentType: "PC",
            os: ["Windows"],
          };
          computerId++;
        }
      }
    }

    setSeatingArrangement({ ...seatingArrangement, grid: newGrid });
    setNextComputerId(computerId);
  };

  const clearAllGrid = () => {
    const emptyGrid: GridCell[][] = Array.from({ length: seatingArrangement.rows }, () =>
      Array.from({ length: seatingArrangement.columns }, () => ({
        id: null,
        equipmentType: "Empty",
        os: [],
      }))
    );
    setSeatingArrangement({ ...seatingArrangement, grid: emptyGrid });
    setNextComputerId(1); // Reset counter to 1
  };

  const isInSelection = (rowIdx: number, colIdx: number): boolean => {
    if (!selectionStart || !selectionEnd) return false;

    const minRow = Math.min(selectionStart.row, selectionEnd.row);
    const maxRow = Math.max(selectionStart.row, selectionEnd.row);
    const minCol = Math.min(selectionStart.col, selectionEnd.col);
    const maxCol = Math.max(selectionStart.col, selectionEnd.col);

    return rowIdx >= minRow && rowIdx <= maxRow && colIdx >= minCol && colIdx <= maxCol;
  };

  const toggleOS = (rowIdx: number, colIdx: number, os: string) => {
    const newGrid = [...seatingArrangement.grid];
    const cell = newGrid[rowIdx][colIdx];
    if (cell.equipmentType === "PC") {
      if (cell.os.includes(os)) {
        cell.os = cell.os.filter((o) => o !== os);
      } else {
        cell.os.push(os);
      }
      setSeatingArrangement({ ...seatingArrangement, grid: newGrid });
    }
  };

  const updateGridSize = (rows: number, columns: number) => {
    const newGrid: GridCell[][] = Array.from({ length: rows }, (_, rowIdx) =>
      Array.from({ length: columns }, (_, colIdx) => {
        if (rowIdx < seatingArrangement.rows && colIdx < seatingArrangement.columns) {
          return seatingArrangement.grid[rowIdx][colIdx];
        }
        return { id: null, equipmentType: "Empty", os: [] };
      })
    );
    setSeatingArrangement({ rows, columns, grid: newGrid });
  };

  const getTotalSeats = () => {
    return seatingArrangement.grid.flat().filter(cell => cell.equipmentType === "PC").length;
  };

  const autoFillComputers = (count: number) => {
    const newGrid = [...seatingArrangement.grid];
    let filled = 0;
    let computerId = nextComputerId;

    for (let row = 0; row < newGrid.length && filled < count; row++) {
      for (let col = 0; col < newGrid[row].length && filled < count; col++) {
        if (newGrid[row][col].equipmentType === "Empty") {
          newGrid[row][col] = {
            id: `C${String(computerId).padStart(3, "0")}`,
            equipmentType: "PC",
            os: ["Windows"],
          };
          computerId++;
          filled++;
        }
      }
    }

    setSeatingArrangement({ ...seatingArrangement, grid: newGrid });
    setNextComputerId(computerId);
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
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label className="text-gray-300 text-sm mb-1">Equipment Type</Label>
                  <select
                    value={equipmentDropdown}
                    onChange={(e) => handleEquipmentDropdownChange(e.target.value)}
                    className="w-full bg-neutral-800 text-white p-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">-- Select Equipment --</option>
                    {commonEquipmentTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {showCustomInput && (
                  <div className="flex-1">
                    <Label className="text-gray-300 text-sm mb-1">Custom Type</Label>
                    <Input
                      placeholder="Enter equipment type"
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      className="bg-neutral-800 text-white"
                    />
                  </div>
                )}

                <div className="w-28">
                  <Label className="text-gray-300 text-sm mb-1">Quantity</Label>
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={newQty || ""}
                    onChange={(e) => setNewQty(Number(e.target.value))}
                    className="bg-neutral-800 text-white"
                  />
                </div>

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

            {/* Seating Arrangement Section */}
            <div className="mb-6 border-t border-gray-700 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">
                  Seating Arrangement
                </h2>
                <button
                  onClick={() => setShowSeatingEditor(!showSeatingEditor)}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  {showSeatingEditor ? "Hide Editor" : "Configure Layout"}
                </button>
              </div>

              {showSeatingEditor && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-4"
                >
                  {/* Grid Size Controls */}
                  <div className="bg-neutral-800 p-4 rounded-lg space-y-3">
                    <h3 className="text-white font-semibold mb-2">Lab Dimensions</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-300 text-sm">Rows</Label>
                        <Input
                          type="number"
                          min="1"
                          max="15"
                          value={seatingArrangement.rows}
                          onChange={(e) => updateGridSize(parseInt(e.target.value) || 1, seatingArrangement.columns)}
                          className="mt-1 bg-neutral-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 text-sm">Columns</Label>
                        <Input
                          type="number"
                          min="1"
                          max="15"
                          value={seatingArrangement.columns}
                          onChange={(e) => updateGridSize(seatingArrangement.rows, parseInt(e.target.value) || 1)}
                          className="mt-1 bg-neutral-700 text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Toolbox for Dragging */}
                  <div className="bg-neutral-800 p-4 rounded-lg">
                    <h3 className="text-white font-semibold mb-3">Tools (Select Tool, then Click & Drag on Grid)</h3>
                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={() => setDraggedEquipment("PC")}
                        className={`px-4 py-2 rounded-lg transition ${
                          draggedEquipment === "PC"
                            ? "bg-blue-600 text-white"
                            : "bg-neutral-700 text-gray-300 hover:bg-neutral-600"
                        }`}
                      >
                        🖥️ Add PCs
                      </button>
                      <button
                        onClick={clearAllGrid}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                      >
                        🗑️ Clear All
                      </button>
                    </div>
                    <p className="text-gray-400 text-xs mt-2">
                      💡 Tip: Click on first cell, drag to last cell, release to fill the rectangle
                    </p>

                    {/* Auto-fill button */}
                    <div className="mt-3 flex gap-2 items-center">
                      <Input
                        type="number"
                        placeholder="30"
                        min="1"
                        id="autoFillCount"
                        className="w-24 bg-neutral-700 text-white"
                      />
                      <button
                        onClick={() => {
                          const count = parseInt((document.getElementById("autoFillCount") as HTMLInputElement)?.value || "0");
                          if (count > 0) autoFillComputers(count);
                        }}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                      >
                        Auto-Fill PCs
                      </button>
                    </div>
                  </div>

                  {/* Interactive Grid */}
                  <div className="bg-neutral-900 p-4 rounded-lg overflow-x-auto">
                    <h3 className="text-white font-semibold mb-3">
                      Lab Layout Grid ({getTotalSeats()} PCs)
                    </h3>
                    <div 
                      className="inline-block select-none"
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                      {seatingArrangement.grid.map((row, rowIdx) => (
                        <div key={rowIdx} className="flex gap-1">
                          {row.map((cell, colIdx) => (
                            <div
                              key={colIdx}
                              onMouseDown={() => handleMouseDown(rowIdx, colIdx)}
                              onMouseEnter={() => handleMouseEnter(rowIdx, colIdx)}
                              className={`
                                w-20 h-20 rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition
                                ${cell.equipmentType === "PC" ? "bg-blue-600 border-blue-400 hover:bg-blue-700" : ""}
                                ${cell.equipmentType === "Empty" ? "bg-neutral-800 border-gray-600 hover:bg-neutral-700" : ""}
                                ${isInSelection(rowIdx, colIdx) ? "ring-4 ring-green-400" : ""}
                              `}
                            >
                              {cell.equipmentType === "PC" && (
                                <>
                                  <div className="text-white font-bold text-sm">{cell.id}</div>
                                  <div className="text-white text-2xl">🖥️</div>
                                  <div className="flex gap-1 mt-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleOS(rowIdx, colIdx, "Windows");
                                      }}
                                      className={`text-xs px-1 py-0.5 rounded ${
                                        cell.os.includes("Windows")
                                          ? "bg-blue-800 text-white"
                                          : "bg-gray-600 text-gray-400"
                                      }`}
                                    >
                                      Win
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleOS(rowIdx, colIdx, "Linux");
                                      }}
                                      className={`text-xs px-1 py-0.5 rounded ${
                                        cell.os.includes("Linux")
                                          ? "bg-orange-600 text-white"
                                          : "bg-gray-600 text-gray-400"
                                      }`}
                                    >
                                      Linux
                                    </button>
                                  </div>
                                </>
                              )}
                              {cell.equipmentType === "Empty" && (
                                <div className="text-gray-500 text-xs">Empty</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Summary when editor is closed */}
              {!showSeatingEditor && getTotalSeats() > 0 && (
                <div className="bg-neutral-800 p-3 rounded-lg">
                  <p className="text-gray-300 text-sm">
                    {seatingArrangement.rows} × {seatingArrangement.columns} grid with {getTotalSeats()} PCs configured
                  </p>
                </div>
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
