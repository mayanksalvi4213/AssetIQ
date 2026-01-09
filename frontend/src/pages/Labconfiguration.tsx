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
  brand?: string;
  model?: string;
  specification?: string;
  unitPrice?: number;
  purchaseDate?: string;
  invoiceNumber?: string;
  billId?: number;
}

interface GridCell {
  id: string | null; // e.g., "C001" or null for empty
  equipmentType: string; // "PC", "Empty", "Passage"
  os: string[]; // ["Windows", "Linux"]
  deviceGroup?: {
    assignedCode: string; // e.g., "apsit/it/309/1"
    devices: {
      type: string;
      brand?: string;
      model?: string;
      billId?: number;
      invoiceNumber?: string;
    }[];
  };
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
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [labNumber, setLabNumber] = useState("");
  const [labName, setLabName] = useState("");
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [equipmentDropdown, setEquipmentDropdown] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Equipment[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedQuantities, setSelectedQuantities] = useState<{ [key: number]: number }>({});
  
  // Equipment types matching database device_types table
  const commonEquipmentTypes = [
    { id: 1, name: "Laptop" },
    { id: 2, name: "PC" },
    { id: 3, name: "AC" },
    { id: 4, name: "Smart Board" },
    { id: 5, name: "Projector" },
    { id: 6, name: "Printer" },
    { id: 7, name: "Scanner" },
    { id: 8, name: "UPS" },
    { id: 9, name: "Router" },
    { id: 10, name: "Switch" },
    { id: 11, name: "Server" },
    { id: 12, name: "Monitor" },
    { id: 13, name: "Keyboard" },
    { id: 14, name: "Mouse" },
    { id: 15, name: "Webcam" },
    { id: 16, name: "Headset" },
    { id: 17, name: "Other" },
  ];
  
  // Seating arrangement states
  const [seatingArrangement, setSeatingArrangement] = useState<SeatingArrangement>({
    rows: 6,
    columns: 6,
    grid: [],
  });
  const [showSeatingEditor, setShowSeatingEditor] = useState(false);
  const [nextComputerId, setNextComputerId] = useState(1);
  const [assignedCodePrefix, setAssignedCodePrefix] = useState("");
  const [availableDevicesForSeating, setAvailableDevicesForSeating] = useState<Equipment[]>([]);
  const [selectedDeviceForPlacement, setSelectedDeviceForPlacement] = useState<Equipment | null>(null);
  const [selectedDeviceMode, setSelectedDeviceMode] = useState<'linked' | 'standby' | 'standalone' | null>(null);
  const [selectedLinkedGroupIndex, setSelectedLinkedGroupIndex] = useState<number | null>(null);
  const [linkedDeviceGroups, setLinkedDeviceGroups] = useState<Equipment[][]>([]);
  const [currentLinkingGroup, setCurrentLinkingGroup] = useState<Equipment[]>([]);
  const [showLinkingModal, setShowLinkingModal] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ row: number; col: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ row: number; col: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [bulkOSWindows, setBulkOSWindows] = useState(false);
  const [bulkOSLinux, setBulkOSLinux] = useState(false);
  const [bulkOSOther, setBulkOSOther] = useState(false);

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

  // Fetch existing labs from database
  useEffect(() => {
    fetchLabs();
  }, []);

  const fetchLabs = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("http://127.0.0.1:5000/get_labs", {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch labs");
      }

      const data = await response.json();
      if (data.success && data.labs) {
        // Convert database labs to frontend format
        const formattedLabs = data.labs.map((lab: any) => ({
          id: lab.lab_id,
          name: `${lab.lab_id} - ${lab.lab_name}`,
          equipment: [],
          seatingArrangement: {
            rows: lab.rows,
            columns: lab.columns,
            grid: []
          }
        }));
        setLabs(formattedLabs);
      }
    } catch (error) {
      console.error("Error fetching labs:", error);
    }
  };

  const searchEquipment = async () => {
    if (!equipmentDropdown) {
      alert("Please select an equipment type to search");
      return;
    }

    setIsSearching(true);
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`http://127.0.0.1:5000/search_devices?type_id=${equipmentDropdown}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to search devices");
      }

      const data = await response.json();
      
      // Filter out devices that are already in the equipment list
      const filteredResults = (data.devices || []).map((device: Equipment) => {
        // Find if this device is already in equipment list
        const alreadyAdded = equipment.find(
          eq => eq.type === device.type && 
                eq.brand === device.brand && 
                eq.model === device.model && 
                eq.billId === device.billId &&
                eq.invoiceNumber === device.invoiceNumber
        );
        
        if (alreadyAdded) {
          // Reduce available quantity by the amount already added
          return {
            ...device,
            quantity: device.quantity! - alreadyAdded.quantity
          };
        }
        
        return device;
      }).filter((device: Equipment) => device.quantity! > 0); // Remove devices with 0 quantity
      
      setSearchResults(filteredResults);
      
      // Initialize selected quantities to 1 for each result
      const initialQuantities: { [key: number]: number } = {};
      filteredResults.forEach((_: any, idx: number) => {
        initialQuantities[idx] = 1;
      });
      setSelectedQuantities(initialQuantities);
      
      setIsSearching(false);
    } catch (error) {
      console.error("Error searching devices:", error);
      alert((error as Error).message || "Error searching devices");
      setIsSearching(false);
    }
  };

  const addEquipmentFromSearch = (equipmentItem: Equipment, idx: number) => {
    const quantityToAdd = selectedQuantities[idx] || 1;
    
    // Validate quantity
    if (quantityToAdd > equipmentItem.quantity!) {
      alert(`Cannot add more than ${equipmentItem.quantity} items available`);
      return;
    }
    
    if (quantityToAdd <= 0) {
      alert("Please select a valid quantity");
      return;
    }
    
    // Check if this device already exists in equipment list
    const existingIndex = equipment.findIndex(
      eq => eq.type === equipmentItem.type && 
            eq.brand === equipmentItem.brand && 
            eq.model === equipmentItem.model && 
            eq.billId === equipmentItem.billId &&
            eq.invoiceNumber === equipmentItem.invoiceNumber
    );
    
    if (existingIndex !== -1) {
      // Device already exists, update quantity
      setEquipment(prev => 
        prev.map((eq, i) => 
          i === existingIndex 
            ? { ...eq, quantity: eq.quantity + quantityToAdd }
            : eq
        )
      );
      
      // Update available devices for seating
      setAvailableDevicesForSeating(prev =>
        prev.map(eq =>
          eq.type === equipmentItem.type && 
          eq.brand === equipmentItem.brand && 
          eq.model === equipmentItem.model && 
          eq.billId === equipmentItem.billId &&
          eq.invoiceNumber === equipmentItem.invoiceNumber
            ? { ...eq, quantity: eq.quantity + quantityToAdd }
            : eq
        )
      );
    } else {
      // New device, add to lists
      const newEquipment = { ...equipmentItem, quantity: quantityToAdd };
      setEquipment(prev => [...prev, newEquipment]);
      setAvailableDevicesForSeating(prev => [...prev, newEquipment]);
    }
    
    // Update search results to reduce available quantity
    setSearchResults(prevResults => 
      prevResults.map((item, i) => 
        i === idx 
          ? { ...item, quantity: item.quantity! - quantityToAdd }
          : item
      ).filter(item => item.quantity! > 0) // Remove items with 0 quantity
    );
    
    // Reset quantity selector for this item
    setSelectedQuantities(prev => ({
      ...prev,
      [idx]: 1
    }));
  };

  const handleEquipmentDropdownChange = (value: string) => {
    setEquipmentDropdown(value);
  };

  const saveLab = async () => {
    const payload = { labNumber, labName, equipment, seatingArrangement };
    console.log("Saving Lab Config:", payload);

    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("http://127.0.0.1:5000/save_lab", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save lab configuration");
      }

      const data = await response.json();
      alert(`✅ ${data.message}\n${data.devices_assigned} devices assigned to the lab`);

      // Refresh labs list
      await fetchLabs();

      setSelectedLabId(null);
      setLabNumber("");
      setLabName("");
      setEquipment([]);
      setAvailableDevicesForSeating([]);
      setSelectedDeviceForPlacement(null);
      const emptyGrid: GridCell[][] = Array.from({ length: 6 }, () =>
        Array.from({ length: 6 }, () => ({
          id: null,
          equipmentType: "Empty",
          os: [],
        }))
      );
      setSeatingArrangement({ rows: 6, columns: 6, grid: emptyGrid });
      setShowSeatingEditor(false);
    } catch (error) {
      console.error("Error saving lab:", error);
      alert((error as Error).message || "Error saving lab configuration");
    }
  };

  const loadLab = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`http://127.0.0.1:5000/get_lab/${id}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to load lab configuration");
      }

      const data = await response.json();
      console.log("📥 Loaded lab data from API:", data);
      
      if (data.success && data.lab) {
        const labData = data.lab;
        console.log("📋 Lab configuration:", labData);
        console.log("🔧 Equipment from DB:", labData.equipment);
        console.log("🗺️ Seating arrangement:", labData.seatingArrangement);
        console.log("🔖 Assigned code prefix:", labData.assignedCodePrefix);
        
        setSelectedLabId(id);
        setLabNumber(labData.labNumber);
        setLabName(labData.labName);
        setEquipment(labData.equipment || []);
        
        // Set assigned code prefix if available
        if (labData.assignedCodePrefix) {
          setAssignedCodePrefix(labData.assignedCodePrefix);
        }
        
        // Calculate which devices are already placed on the grid
        const placedDevices: { type: string; brand?: string; model?: string; billId?: number; count: number }[] = [];
        const linkedGroupsFromGrid: Equipment[][] = [];
        const linkedGroupMap = new Map<number, Equipment[]>(); // linked_group_id -> devices
        
        if (labData.seatingArrangement?.grid) {
          labData.seatingArrangement.grid.forEach((row: any) => {
            row.forEach((cell: any) => {
              if (cell.deviceGroup && cell.deviceGroup.devices) {
                cell.deviceGroup.devices.forEach((dev: any) => {
                  const existing = placedDevices.find(
                    pd => pd.type === dev.type && pd.brand === dev.brand && 
                          pd.model === dev.model && pd.billId === dev.billId
                  );
                  if (existing) {
                    existing.count++;
                  } else {
                    placedDevices.push({
                      type: dev.type,
                      brand: dev.brand,
                      model: dev.model,
                      billId: dev.billId,
                      count: 1
                    });
                  }
                });
                
                // Reconstruct linked groups (devices with more than 1 type in same station)
                if (cell.deviceGroup.devices.length > 1) {
                  // Check if we've already added this linked group
                  const groupKey = cell.deviceGroup.devices
                    .map((d: any) => `${d.type}-${d.brand}-${d.model}-${d.billId}`)
                    .sort()
                    .join('|');
                  
                  const alreadyExists = linkedGroupsFromGrid.some(group => {
                    const existingKey = group
                      .map(d => `${d.type}-${d.brand}-${d.model}-${d.billId}`)
                      .sort()
                      .join('|');
                    return existingKey === groupKey;
                  });
                  
                  if (!alreadyExists) {
                    const groupDevices = cell.deviceGroup.devices.map((dev: any) => {
                      const fullEquipment = labData.equipment.find(
                        (eq: any) => eq.type === dev.type && eq.brand === dev.brand && 
                                    eq.model === dev.model && eq.billId === dev.billId
                      );
                      return {
                        type: dev.type,
                        brand: dev.brand,
                        model: dev.model,
                        billId: dev.billId,
                        invoiceNumber: dev.invoiceNumber,
                        quantity: 1,
                        specification: fullEquipment?.specification,
                        unitPrice: fullEquipment?.unitPrice,
                        purchaseDate: fullEquipment?.purchaseDate,
                      };
                    });
                    linkedGroupsFromGrid.push(groupDevices);
                  }
                }
              }
            });
          });
        }
        
        // Set linked device groups
        setLinkedDeviceGroups(linkedGroupsFromGrid);
        console.log("🔗 Reconstructed linked groups:", linkedGroupsFromGrid);
        
        // Calculate available devices (total equipment - placed devices)
        console.log("📊 Placed devices count:", placedDevices);
        const availableDevices = (labData.equipment || []).map((eq: Equipment) => {
          const placed = placedDevices.find(
            pd => pd.type === eq.type && pd.brand === eq.brand && 
                  pd.model === eq.model && pd.billId === eq.billId
          );
          const placedCount = placed ? placed.count : 0;
          const availableCount = eq.quantity - placedCount;
          
          console.log(`  ${eq.type} ${eq.brand} ${eq.model}: Total=${eq.quantity}, Placed=${placedCount}, Available=${availableCount}`);
          
          return {
            ...eq,
            quantity: availableCount
          };
        }).filter((eq: Equipment) => eq.quantity > 0); // Only include devices with available quantity
        
        console.log("✅ Available devices for placement:", availableDevices);
        setAvailableDevicesForSeating(availableDevices);
        
        if (labData.seatingArrangement) {
          setSeatingArrangement(labData.seatingArrangement);
        }
        
        // Show seating editor if there's a configured layout
        if (labData.seatingArrangement?.grid?.some((row: any) => 
          row.some((cell: any) => cell.deviceGroup)
        )) {
          setShowSeatingEditor(true);
        }
      }
    } catch (error) {
      console.error("Error loading lab:", error);
      alert((error as Error).message || "Error loading lab configuration");
    }
  };

  const handleMouseDown = (rowIdx: number, colIdx: number) => {
    const cell = seatingArrangement.grid[rowIdx][colIdx];
    
    // If clicking on an occupied cell, remove it
    if (cell.equipmentType !== "Empty") {
      removeCellDevice(rowIdx, colIdx);
      return;
    }
    
    // If no device selected for placement, show alert
    if (!selectedDeviceForPlacement) {
      alert("Please select a device to place on the grid");
      return;
    }
    
    // Start drag selection
    setIsSelecting(true);
    setSelectionStart({ row: rowIdx, col: colIdx });
    setSelectionEnd({ row: rowIdx, col: colIdx });
  };

  const handleMouseEnter = (rowIdx: number, colIdx: number) => {
    if (isSelecting && selectionStart) {
      setSelectionEnd({ row: rowIdx, col: colIdx });
    }
  };

  const isInSelectionArea = (rowIdx: number, colIdx: number, start: { row: number; col: number }, end: { row: number; col: number } | null) => {
    if (!end) return false;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    return rowIdx >= minRow && rowIdx <= maxRow && colIdx >= minCol && colIdx <= maxCol;
  };

  const handleMouseUp = (rowIdx: number, colIdx: number) => {
    if (!isSelecting || !selectionStart) return;
    
    setIsSelecting(false);
    
    // Determine if it's a single click or drag
    if (selectionStart.row === rowIdx && selectionStart.col === colIdx) {
      // Single click - place one device
      placeDeviceOnGrid(rowIdx, colIdx);
    } else {
      // Drag - fill rectangle area
      fillRectangle(selectionStart.row, selectionStart.col, rowIdx, colIdx);
    }
    
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const removeCellDevice = (rowIdx: number, colIdx: number) => {
    const cell = seatingArrangement.grid[rowIdx][colIdx];
    
    if (cell.deviceGroup) {
      // Return devices to available pool
      const devicesToReturn = cell.deviceGroup.devices;
      
      setAvailableDevicesForSeating(prev => {
        const newAvailable = [...prev];
        
        devicesToReturn.forEach(dev => {
          // Find existing device entry
          const existingIndex = newAvailable.findIndex(
            eq => eq.type === dev.type && eq.brand === dev.brand && eq.model === dev.model && eq.billId === dev.billId
          );
          
          if (existingIndex !== -1) {
            // Device already exists, increment quantity
            newAvailable[existingIndex] = {
              ...newAvailable[existingIndex],
              quantity: newAvailable[existingIndex].quantity + 1
            };
          } else {
            // Device doesn't exist, find from original equipment list or linked groups to get full metadata
            const originalEquipment = equipment.find(
              eq => eq.type === dev.type && eq.brand === dev.brand && eq.model === dev.model && eq.billId === dev.billId
            );
            
            // Add device back with full metadata
            newAvailable.push({
              type: dev.type,
              quantity: 1,
              brand: dev.brand,
              model: dev.model,
              billId: dev.billId,
              invoiceNumber: dev.invoiceNumber,
              specification: originalEquipment?.specification,
              unitPrice: originalEquipment?.unitPrice,
              purchaseDate: originalEquipment?.purchaseDate,
            });
          }
        });
        
        return newAvailable;
      });
      
      // Clear the cell and renumber all cells
      const newGrid = seatingArrangement.grid.map(row => [...row]);
      newGrid[rowIdx][colIdx] = {
        id: null,
        equipmentType: "Empty",
        os: [],
      };
      
      // Renumber all remaining cells horizontally
      renumberGrid(newGrid);
    }
  };

  const fillRectangle = (startRow: number, startCol: number, endRow: number, endCol: number) => {
    if (!selectedDeviceForPlacement) return;
    
    const newGrid = seatingArrangement.grid.map(row => [...row]);
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    let placedCount = 0;
    
    // Only use linked group if mode is 'linked'
    let devicesToPlace: Equipment[];
    if (selectedDeviceMode === 'linked' && selectedLinkedGroupIndex !== null) {
      devicesToPlace = linkedDeviceGroups[selectedLinkedGroupIndex];
    } else {
      devicesToPlace = [selectedDeviceForPlacement];
    }
    
    // Calculate how many we can actually place
    const availableQuantities = devicesToPlace.map(device => {
      const available = availableDevicesForSeating.find(
        eq => eq.type === device.type && eq.brand === device.brand && eq.model === device.model && eq.billId === device.billId
      );
      return available?.quantity || 0;
    });
    
    const maxPlaceable = Math.min(...availableQuantities);
    
    // Collect all devices to reduce from available pool
    const devicesToReduce: { type: string; brand?: string; model?: string; billId?: number }[] = [];
    
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (newGrid[row][col].equipmentType === "Empty" && placedCount < maxPlaceable) {
          // Create device group
          const deviceGroup = {
            assignedCode: '',
            devices: devicesToPlace.map(eq => ({
              type: eq.type,
              brand: eq.brand,
              model: eq.model,
              billId: eq.billId,
              invoiceNumber: eq.invoiceNumber,
            }))
          };
          
          newGrid[row][col] = {
            id: null,
            equipmentType: selectedDeviceForPlacement.type,
            os: ["Windows"],
            deviceGroup
          };
          
          // Add to list of devices to reduce
          devicesToPlace.forEach(dev => {
            devicesToReduce.push({
              type: dev.type,
              brand: dev.brand,
              model: dev.model,
              billId: dev.billId
            });
          });
          
          placedCount++;
        }
      }
    }
    
    if (placedCount < (maxRow - minRow + 1) * (maxCol - minCol + 1)) {
      alert(`Only ${placedCount} devices placed out of ${(maxRow - minRow + 1) * (maxCol - minCol + 1)} cells selected.`);
    }
    
    // Batch update available devices in a single state update
    setAvailableDevicesForSeating(prev => {
      const newAvailable = [...prev];
      
      devicesToReduce.forEach(dev => {
        const existingIndex = newAvailable.findIndex(
          eq => eq.type === dev.type && eq.brand === dev.brand && eq.model === dev.model && eq.billId === dev.billId
        );
        
        if (existingIndex !== -1) {
          newAvailable[existingIndex] = {
            ...newAvailable[existingIndex],
            quantity: newAvailable[existingIndex].quantity - 1
          };
        }
      });
      
      return newAvailable.filter(eq => eq.quantity > 0);
    });
    
    // Renumber all cells horizontally
    renumberGrid(newGrid);
  };

  const renumberGrid = (grid: GridCell[][]) => {
    let sequenceNumber = 1;
    
    // Go through grid horizontally (row by row, left to right)
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const cell = grid[row][col];
        if (cell.deviceGroup) {
          const assignedCode = `${assignedCodePrefix}/${sequenceNumber}`;
          cell.deviceGroup.assignedCode = assignedCode;
          cell.id = `C${String(sequenceNumber).padStart(3, "0")}`;
          sequenceNumber++;
        }
      }
    }
    
    setSeatingArrangement({ ...seatingArrangement, grid });
    setNextComputerId(sequenceNumber);
  };

  const canPlaceDevice = (): boolean => {
    if (!selectedDeviceForPlacement) return false;
    
    // Determine which devices to check based on selection mode
    let devicesToCheck: Equipment[];
    if (selectedDeviceMode === 'linked' && selectedLinkedGroupIndex !== null) {
      devicesToCheck = linkedDeviceGroups[selectedLinkedGroupIndex];
    } else {
      devicesToCheck = [selectedDeviceForPlacement];
    }
    
    // Check if ALL devices in the selection have at least 1 quantity
    return devicesToCheck.every(device => {
      const available = availableDevicesForSeating.find(
        eq => eq.type === device.type && eq.brand === device.brand && eq.model === device.model && eq.billId === device.billId
      );
      return available && available.quantity > 0;
    });
  };

  const placeDeviceAtPosition = (grid: GridCell[][], rowIdx: number, colIdx: number) => {
    if (!selectedDeviceForPlacement) return;
    
    const linkedGroup = linkedDeviceGroups.find(group =>
      group.some(eq => 
        eq.type === selectedDeviceForPlacement.type && 
        eq.brand === selectedDeviceForPlacement.brand && 
        eq.model === selectedDeviceForPlacement.model &&
        eq.billId === selectedDeviceForPlacement.billId
      )
    );
    
    const devicesToPlace = linkedGroup || [selectedDeviceForPlacement];
    
    // Placeholder - will be renumbered
    const deviceGroup = {
      assignedCode: '',
      devices: devicesToPlace.map(eq => ({
        type: eq.type,
        brand: eq.brand,
        model: eq.model,
        billId: eq.billId,
        invoiceNumber: eq.invoiceNumber,
      }))
    };
    
    grid[rowIdx][colIdx] = {
      id: null,
      equipmentType: selectedDeviceForPlacement.type,
      os: ["Windows"],
      deviceGroup
    };
    
    // Reduce available devices
    setAvailableDevicesForSeating(prev => 
      prev.map(eq => {
        const isInGroup = devicesToPlace.some(
          d => d.type === eq.type && d.brand === eq.brand && d.model === eq.model && d.billId === eq.billId
        );
        return isInGroup ? { ...eq, quantity: eq.quantity - 1 } : eq;
      }).filter(eq => eq.quantity > 0)
    );
  };

  const placeDeviceOnGrid = (rowIdx: number, colIdx: number) => {
    if (!selectedDeviceForPlacement) return;
    
    // Check if we have devices available
    if (!canPlaceDevice()) {
      alert("No more devices available to place. All devices from this group have been used.");
      return;
    }
    
    const newGrid = seatingArrangement.grid.map(row => [...row]);
    
    // Only use linked group if mode is 'linked'
    let devicesToPlace: Equipment[];
    if (selectedDeviceMode === 'linked' && selectedLinkedGroupIndex !== null) {
      devicesToPlace = linkedDeviceGroups[selectedLinkedGroupIndex];
    } else {
      devicesToPlace = [selectedDeviceForPlacement];
    }
    
    // Create device group (will be renumbered)
    const deviceGroup = {
      assignedCode: '',
      devices: devicesToPlace.map(eq => ({
        type: eq.type,
        brand: eq.brand,
        model: eq.model,
        billId: eq.billId,
        invoiceNumber: eq.invoiceNumber,
      }))
    };
    
    newGrid[rowIdx][colIdx] = {
      id: null,
      equipmentType: selectedDeviceForPlacement.type,
      os: ["Windows"],
      deviceGroup
    };
    
    // Reduce available devices for all devices in the group
    setAvailableDevicesForSeating(prev => 
      prev.map(eq => {
        const isInGroup = devicesToPlace.some(
          d => d.type === eq.type && d.brand === eq.brand && d.model === eq.model && d.billId === eq.billId
        );
        return isInGroup ? { ...eq, quantity: eq.quantity - 1 } : eq;
      }).filter(eq => eq.quantity > 0)
    );
    
    // Renumber all cells horizontally
    renumberGrid(newGrid);
  };

  const addToLinkingGroup = (device: Equipment) => {
    // Check if device is already in current linking group
    const alreadyExists = currentLinkingGroup.some(
      eq => eq.type === device.type && eq.brand === device.brand && eq.model === device.model && eq.billId === device.billId
    );
    
    if (alreadyExists) {
      alert("This device is already in the linking group");
      return;
    }
    
    setCurrentLinkingGroup(prev => [...prev, device]);
  };

  const removeFromLinkingGroup = (index: number) => {
    setCurrentLinkingGroup(prev => prev.filter((_, i) => i !== index));
  };

  const saveLinkingGroup = () => {
    if (currentLinkingGroup.length === 0) {
      alert("Please add at least one device to the linking group");
      return;
    }
    
    setLinkedDeviceGroups(prev => [...prev, currentLinkingGroup]);
    setCurrentLinkingGroup([]);
    setShowLinkingModal(false);
    alert(`✅ Linked ${currentLinkingGroup.length} device types together`);
  };

  const removeLinkedGroup = (groupIndex: number) => {
    setLinkedDeviceGroups(prev => prev.filter((_, i) => i !== groupIndex));
  };

  const clearAllGrid = () => {
    // Collect all devices from the grid before clearing
    const currentGrid = seatingArrangement.grid.flat();
    const devicesToReturn: { type: string; brand?: string; model?: string; billId?: number; invoiceNumber?: string }[] = [];
    
    currentGrid.forEach(cell => {
      if (cell.deviceGroup) {
        cell.deviceGroup.devices.forEach(dev => {
          devicesToReturn.push(dev);
        });
      }
    });
    
    // Return all devices to available pool in a single state update
    setAvailableDevicesForSeating(prev => {
      const newAvailable = [...prev];
      
      devicesToReturn.forEach(dev => {
        const existingIndex = newAvailable.findIndex(
          eq => eq.type === dev.type && eq.brand === dev.brand && eq.model === dev.model && eq.billId === dev.billId
        );
        
        if (existingIndex !== -1) {
          newAvailable[existingIndex] = {
            ...newAvailable[existingIndex],
            quantity: newAvailable[existingIndex].quantity + 1
          };
        } else {
          // Find from original equipment list to get full metadata
          const originalEquipment = equipment.find(
            eq => eq.type === dev.type && eq.brand === dev.brand && eq.model === dev.model && eq.billId === dev.billId
          );
          
          newAvailable.push({
            type: dev.type,
            quantity: 1,
            brand: dev.brand,
            model: dev.model,
            billId: dev.billId,
            invoiceNumber: dev.invoiceNumber,
            specification: originalEquipment?.specification,
            unitPrice: originalEquipment?.unitPrice,
            purchaseDate: originalEquipment?.purchaseDate,
          });
        }
      });
      
      return newAvailable;
    });
    
    // Clear the grid
    const emptyGrid: GridCell[][] = Array.from({ length: seatingArrangement.rows }, () =>
      Array.from({ length: seatingArrangement.columns }, () => ({
        id: null,
        equipmentType: "Empty",
        os: [],
      }))
    );
    setSeatingArrangement({ ...seatingArrangement, grid: emptyGrid });
    setNextComputerId(1);
  };

  const applyBulkOS = (osType: string, shouldAdd: boolean) => {
    const newGrid = seatingArrangement.grid.map(row => 
      row.map(cell => {
        if (cell.deviceGroup) {
          const updatedCell = { ...cell };
          if (shouldAdd) {
            if (!updatedCell.os.includes(osType)) {
              updatedCell.os = [...updatedCell.os, osType];
            }
          } else {
            updatedCell.os = updatedCell.os.filter(os => os !== osType);
          }
          return updatedCell;
        }
        return cell;
      })
    );
    setSeatingArrangement({ ...seatingArrangement, grid: newGrid });
  };

  const toggleOS = (rowIdx: number, colIdx: number, os: string) => {
    const newGrid = [...seatingArrangement.grid];
    const cell = newGrid[rowIdx][colIdx];
    if (cell.equipmentType === "PC" || cell.deviceGroup) {
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
    // Count cells with deviceGroup (each cell represents one seat/station, even if it has multiple linked devices)
    return seatingArrangement.grid.flat().filter(cell => cell.deviceGroup).length;
  };

  const removeDeviceFromAvailable = (device: Equipment) => {
    // Remove from available devices for seating
    setAvailableDevicesForSeating(prev => 
      prev.filter(eq => !(eq.type === device.type && eq.brand === device.brand && eq.model === device.model && eq.billId === device.billId))
    );
    
    // Remove from equipment list
    setEquipment(prev => 
      prev.filter(eq => !(eq.type === device.type && eq.brand === device.brand && eq.model === device.model && eq.billId === device.billId))
    );
    
    // Clear selection if this device was selected
    if (selectedDeviceForPlacement?.type === device.type && 
        selectedDeviceForPlacement?.brand === device.brand && 
        selectedDeviceForPlacement?.model === device.model && 
        selectedDeviceForPlacement?.billId === device.billId) {
      setSelectedDeviceForPlacement(null);
      setSelectedDeviceMode(null);
      setSelectedLinkedGroupIndex(null);
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
      <div className="flex items-center justify-center pt-24 px-4">
        <BackgroundGradient className="w-full max-w-7xl p-8 rounded-xl shadow-xl">
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
                onChange={(e) => {
                  if (e.target.value) {
                    loadLab(e.target.value);
                  } else {
                    setSelectedLabId(null);
                    setLabNumber("");
                    setLabName("");
                    setEquipment([]);
                    setAvailableDevicesForSeating([]);
                    setSelectedDeviceForPlacement(null);
                    const emptyGrid: GridCell[][] = Array.from({ length: 6 }, () =>
                      Array.from({ length: 6 }, () => ({
                        id: null,
                        equipmentType: "Empty",
                        os: [],
                      }))
                    );
                    setSeatingArrangement({ rows: 6, columns: 6, grid: emptyGrid });
                    setShowSeatingEditor(false);
                  }
                }}
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

            {/* Lab Number and Name */}
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="labNumber" className="text-white">
                  Lab Number
                </Label>
                <Input
                  id="labNumber"
                  placeholder="e.g., 309"
                  value={labNumber}
                  onChange={(e) => setLabNumber(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="labName" className="text-white">
                  Lab Name
                </Label>
                <Input
                  id="labName"
                  placeholder="e.g., Computer Lab"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            {/* Search Equipment */}
            <div className="mb-6 space-y-2">
              <Label className="text-white">Search Equipment from Inventory</Label>
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
                      <option key={type.id} value={type.id.toString()}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={searchEquipment}
                  disabled={isSearching}
                  className={`px-6 py-2 rounded-full font-semibold transition ${
                    isSearching
                      ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg"
                  }`}
                >
                  {isSearching ? "Searching..." : "🔍 Search"}
                </button>
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mb-6 bg-neutral-800 p-4 rounded-lg">
                <h3 className="text-white font-semibold mb-3">
                  Available Equipment ({searchResults.length} groups found)
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchResults.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-neutral-700 p-3 rounded-lg flex justify-between items-start gap-3"
                    >
                      <div className="flex-1">
                        <div className="text-white font-semibold mb-1">
                          {item.brand} {item.model} ({item.quantity} available)
                        </div>
                        <div className="text-gray-300 text-sm space-y-1">
                          <p><span className="text-gray-400">Type:</span> {item.type}</p>
                          {item.specification && (
                            <p><span className="text-gray-400">Specs:</span> {item.specification}</p>
                          )}
                          {item.unitPrice && (
                            <p><span className="text-gray-400">Price:</span> ₹{item.unitPrice.toLocaleString()}</p>
                          )}
                          {item.purchaseDate && (
                            <p><span className="text-gray-400">Purchase Date:</span> {item.purchaseDate}</p>
                          )}
                          {item.invoiceNumber && (
                            <p><span className="text-gray-400">Invoice:</span> {item.invoiceNumber}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <div className="flex items-center gap-2">
                          <label className="text-gray-300 text-sm">Qty:</label>
                          <Input
                            type="number"
                            min="1"
                            max={item.quantity}
                            value={Math.min(selectedQuantities[idx] || 1, item.quantity!)}
                            onChange={(e) => {
                              const value = Math.min(Math.max(1, parseInt(e.target.value) || 1), item.quantity!);
                              setSelectedQuantities(prev => ({
                                ...prev,
                                [idx]: value
                              }));
                            }}
                            className="w-20 bg-neutral-600 text-white text-center"
                          />
                        </div>
                        <button
                          onClick={() => addEquipmentFromSearch(item, idx)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition whitespace-nowrap"
                        >
                          Add to Lab
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchResults.length === 0 && equipmentDropdown && !isSearching && (
              <div className="mb-6 bg-neutral-800 p-4 rounded-lg">
                <p className="text-gray-400 text-center">
                  No unassigned equipment found for the selected type
                </p>
              </div>
            )}

            {/* Equipment List */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">
                Lab Equipment
              </h2>
              {equipment.length === 0 ? (
                <p className="text-gray-400">No equipment added yet.</p>
              ) : (
                <ul className="space-y-2">
                  {equipment.map((eq, idx) => (
                    <li
                      key={idx}
                      className="bg-neutral-800 text-white px-4 py-3 rounded-lg"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-semibold mb-1">
                            {eq.brand} {eq.model} - {eq.type} × {eq.quantity}
                          </div>
                          {eq.specification && (
                            <div className="text-gray-400 text-sm">{eq.specification}</div>
                          )}
                          {eq.invoiceNumber && (
                            <div className="text-gray-400 text-sm">Invoice: {eq.invoiceNumber}</div>
                          )}
                        </div>
                        <button
                          className="text-red-400 hover:text-red-600 ml-3"
                          onClick={() => {
                            const deviceToRemove = equipment[idx];
                            
                            // Remove from equipment list
                            setEquipment(equipment.filter((_, i) => i !== idx));
                            
                            // Remove from available devices for seating
                            setAvailableDevicesForSeating(prev => 
                              prev.filter(eq => !(
                                eq.type === deviceToRemove.type && 
                                eq.brand === deviceToRemove.brand && 
                                eq.model === deviceToRemove.model && 
                                eq.billId === deviceToRemove.billId
                              ))
                            );
                            
                            // Clear selection if this device was selected
                            if (selectedDeviceForPlacement?.type === deviceToRemove.type && 
                                selectedDeviceForPlacement?.brand === deviceToRemove.brand && 
                                selectedDeviceForPlacement?.model === deviceToRemove.model && 
                                selectedDeviceForPlacement?.billId === deviceToRemove.billId) {
                              setSelectedDeviceForPlacement(null);
                              setSelectedDeviceMode(null);
                              setSelectedLinkedGroupIndex(null);
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
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
                {!showSeatingEditor && (
                  <button
                    onClick={() => setShowSeatingEditor(!showSeatingEditor)}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-bold text-lg rounded-lg hover:shadow-xl hover:scale-105 transition-all border-2 border-cyan-300"
                  >
                    ⚙️ Configure Layout
                  </button>
                )}
              </div>

              {showSeatingEditor && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-4"
                >
                  {/* Hide Editor Button */}
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => setShowSeatingEditor(false)}
                      className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-lg rounded-lg hover:shadow-xl hover:scale-105 transition-all border-2 border-red-300"
                    >
                      ✖ Hide Editor
                    </button>
                  </div>

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
                  <div className="bg-neutral-800 p-4 rounded-lg space-y-3">
                    <h3 className="text-white font-semibold mb-3">Assigned Code Prefix</h3>
                    <Input
                      type="text"
                      value={assignedCodePrefix}
                      onChange={(e) => setAssignedCodePrefix(e.target.value)}
                      placeholder="e.g., apsit/it/309"
                      className="bg-neutral-700 text-white"
                    />
                    <p className="text-gray-400 text-xs">
                      Devices will be assigned codes like: {assignedCodePrefix}/1, {assignedCodePrefix}/2, etc.
                    </p>
                  </div>

                  {/* Device Linking Section */}
                  <div className="bg-neutral-800 p-4 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-white font-semibold">Device Linking</h3>
                      <button
                        onClick={() => setShowLinkingModal(true)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition"
                      >
                        + Create Link
                      </button>
                    </div>
                    
                    {linkedDeviceGroups.length === 0 ? (
                      <p className="text-gray-400 text-sm">No device groups linked yet. Link devices from different invoices to assign them together.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {linkedDeviceGroups.map((group, groupIdx) => (
                          <div key={groupIdx} className="bg-neutral-700 p-2 rounded">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="text-white font-semibold text-sm mb-1">Group {groupIdx + 1}</div>
                                <div className="text-gray-300 text-xs space-y-1">
                                  {group.map((device, idx) => (
                                    <div key={idx}>• {device.type}: {device.brand} {device.model} (Invoice: {device.invoiceNumber})</div>
                                  ))}
                                </div>
                              </div>
                              <button
                                onClick={() => removeLinkedGroup(groupIdx)}
                                className="text-red-400 hover:text-red-600 text-xs ml-2"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-neutral-800 p-4 rounded-lg">
                    <h3 className="text-white font-semibold mb-3">Select Device to Place</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {availableDevicesForSeating.length === 0 ? (
                        <p className="text-gray-400 text-sm">No devices available. Add equipment from inventory first.</p>
                      ) : (
                        <>
                          {/* Show linked groups first (priority 1) */}
                          {linkedDeviceGroups.map((group, groupIdx) => {
                            // Calculate minimum quantity across all devices in the group
                            const minQuantity = Math.min(...group.map(device => {
                              const available = availableDevicesForSeating.find(
                                eq => eq.type === device.type && eq.brand === device.brand && eq.model === device.model && eq.billId === device.billId
                              );
                              return available?.quantity || 0;
                            }));
                            
                            if (minQuantity === 0) return null;
                            
                            const isSelected = selectedDeviceMode === 'linked' && selectedLinkedGroupIndex === groupIdx;
                            
                            return (
                              <button
                                key={`group-${groupIdx}`}
                                onClick={() => {
                                  setSelectedDeviceForPlacement(group[0]);
                                  setSelectedDeviceMode('linked');
                                  setSelectedLinkedGroupIndex(groupIdx);
                                }}
                                className={`w-full text-left px-3 py-2 rounded transition ${
                                  isSelected
                                    ? "bg-blue-600 text-white"
                                    : "bg-neutral-700 text-gray-300 hover:bg-neutral-600"
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="font-semibold text-purple-400">🔗 Linked Group {groupIdx + 1}</div>
                                    <div className="text-sm mt-1 space-y-0.5">
                                      {group.map((device, idx) => (
                                        <div key={idx}>• {device.type}: {device.brand} {device.model}</div>
                                      ))}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">{minQuantity} sets available</div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                          
                          {/* Show standby devices from linked groups with excess quantity (priority 2) */}
                          {linkedDeviceGroups.map((group, groupIdx) => {
                            // Calculate minimum quantity to determine how many are in standby
                            const minQuantity = Math.min(...group.map(device => {
                              const available = availableDevicesForSeating.find(
                                eq => eq.type === device.type && eq.brand === device.brand && eq.model === device.model && eq.billId === device.billId
                              );
                              return available?.quantity || 0;
                            }));
                            
                            // Show devices that have more quantity than the minimum (excess/standby)
                            return group.map((device, deviceIdx) => {
                              const available = availableDevicesForSeating.find(
                                eq => eq.type === device.type && eq.brand === device.brand && eq.model === device.model && eq.billId === device.billId
                              );
                              
                              const standbyQuantity = (available?.quantity || 0) - minQuantity;
                              
                              if (standbyQuantity <= 0) return null;
                              
                              const isStandbySelected = selectedDeviceMode === 'standby' && 
                                selectedDeviceForPlacement?.type === device.type &&
                                selectedDeviceForPlacement?.brand === device.brand &&
                                selectedDeviceForPlacement?.model === device.model &&
                                selectedDeviceForPlacement?.billId === device.billId &&
                                selectedLinkedGroupIndex === groupIdx;
                              
                              return (
                                <button
                                  key={`standby-${groupIdx}-${deviceIdx}`}
                                  onClick={() => {
                                    setSelectedDeviceForPlacement(device);
                                    setSelectedDeviceMode('standby');
                                    setSelectedLinkedGroupIndex(groupIdx);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded transition ${
                                    isStandbySelected
                                      ? "bg-blue-600 text-white"
                                      : "bg-neutral-700 text-gray-300 hover:bg-neutral-600"
                                  }`}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="font-semibold">{device.brand} {device.model}</div>
                                      <div className="text-sm">{device.type} - {standbyQuantity} standby</div>
                                      <div className="text-xs text-orange-400 mt-1">
                                        ⏸️ Excess from Group {groupIdx + 1}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              );
                            });
                          })}
                          
                          {/* Show completely standalone devices (priority 3) */}
                          {availableDevicesForSeating.map((device, idx) => {
                            // Skip if device is part of any linked group
                            const isInLinkedGroup = linkedDeviceGroups.some(group =>
                              group.some(eq => 
                                eq.type === device.type && 
                                eq.brand === device.brand && 
                                eq.model === device.model &&
                                eq.billId === device.billId
                              )
                            );
                            
                            if (isInLinkedGroup) return null;
                            
                            const isStandaloneSelected = selectedDeviceMode === 'standalone' &&
                              selectedDeviceForPlacement?.type === device.type &&
                              selectedDeviceForPlacement?.brand === device.brand &&
                              selectedDeviceForPlacement?.model === device.model &&
                              selectedDeviceForPlacement?.billId === device.billId;
                            
                            return (
                              <button
                                key={`device-${idx}`}
                                onClick={() => {
                                  setSelectedDeviceForPlacement(device);
                                  setSelectedDeviceMode('standalone');
                                  setSelectedLinkedGroupIndex(null);
                                }}
                                className={`w-full text-left px-3 py-2 rounded transition ${
                                  isStandaloneSelected
                                    ? "bg-blue-600 text-white"
                                    : "bg-neutral-700 text-gray-300 hover:bg-neutral-600"
                                }`}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div className="flex-1">
                                    <div className="font-semibold">{device.brand} {device.model}</div>
                                    <div className="text-sm">{device.type} - {device.quantity} available</div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeDeviceFromAvailable(device);
                                    }}
                                    className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-900/30 transition"
                                    title="Remove this device from lab"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs mt-2">
                      💡 Click to place single device, or click and drag to fill an area
                    </p>
                  </div>

                  <div className="bg-neutral-800 p-4 rounded-lg">
                    <h3 className="text-white font-semibold mb-3">Actions</h3>
                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={clearAllGrid}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                      >
                        🗑️ Clear All
                      </button>
                    </div>
                  </div>

                  {/* Interactive Grid */}
                  <div className="bg-neutral-900 p-4 rounded-lg">
                    <h3 className="text-white font-semibold mb-3">
                      Lab Layout Grid ({getTotalSeats()} Stations Configured)
                    </h3>
                    <div className="flex flex-col items-center select-none">
                      {seatingArrangement.grid.map((row, rowIdx) => (
                        <div key={rowIdx} className="flex gap-1">
                          {row.map((cell, colIdx) => (
                            <div
                              key={colIdx}
                              onMouseDown={() => handleMouseDown(rowIdx, colIdx)}
                              onMouseEnter={() => handleMouseEnter(rowIdx, colIdx)}
                              onMouseUp={() => handleMouseUp(rowIdx, colIdx)}
                              className={`
                                w-32 h-32 rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition p-2 relative
                                ${cell.deviceGroup ? "bg-blue-600 border-blue-400 hover:bg-blue-700" : ""}
                                ${cell.equipmentType === "Empty" ? "bg-neutral-800 border-gray-600 hover:bg-neutral-700" : ""}
                                ${isSelecting && selectionStart && selectionEnd && isInSelectionArea(rowIdx, colIdx, selectionStart, selectionEnd) ? "ring-2 ring-yellow-400" : ""}
                              `}
                              title={cell.deviceGroup ? `${cell.deviceGroup.assignedCode}\n${cell.deviceGroup.devices.map(d => d.type).join(', ')}` : "Empty"}
                            >
                              {cell.deviceGroup && (
                                <>
                                  <div className="text-white font-bold text-sm text-center break-all">
                                    {cell.deviceGroup.assignedCode}
                                  </div>
                                  <div className="text-white text-2xl my-1">
                                    {cell.deviceGroup.devices[0]?.type === "PC" && "🖥️"}
                                    {cell.deviceGroup.devices[0]?.type === "Laptop" && "💻"}
                                    {cell.deviceGroup.devices[0]?.type === "Monitor" && "🖥️"}
                                  </div>
                                  <div className="text-xs text-gray-200 text-center mb-1">
                                    {cell.deviceGroup.devices.length} devices
                                  </div>
                                  <div className="flex gap-1 flex-wrap justify-center">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleOS(rowIdx, colIdx, "Windows");
                                      }}
                                      className={`text-xs px-2 py-1 rounded font-semibold ${
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
                                      className={`text-xs px-2 py-1 rounded font-semibold ${
                                        cell.os.includes("Linux")
                                          ? "bg-orange-600 text-white"
                                          : "bg-gray-600 text-gray-400"
                                      }`}
                                    >
                                      Lin
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleOS(rowIdx, colIdx, "Other");
                                      }}
                                      className={`text-xs px-2 py-1 rounded font-semibold ${
                                        cell.os.includes("Other")
                                          ? "bg-purple-600 text-white"
                                          : "bg-gray-600 text-gray-400"
                                      }`}
                                    >
                                      Oth
                                    </button>
                                  </div>
                                </>
                              )}
                              {cell.equipmentType === "Empty" && (
                                <div className="text-gray-500 text-sm">Empty</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bulk OS Assignment Checkboxes */}
                  <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 p-5 rounded-lg border-2 border-purple-500">
                    <h4 className="text-white font-bold mb-4 text-lg">🔧 Bulk OS Assignment (applies to all stations)</h4>
                    <div className="flex gap-8">
                      <label className="flex items-center gap-3 text-white cursor-pointer hover:text-cyan-400 transition group">
                        <input
                          type="checkbox"
                          checked={bulkOSWindows}
                          onChange={(e) => {
                            setBulkOSWindows(e.target.checked);
                            applyBulkOS("Windows", e.target.checked);
                          }}
                          className="w-6 h-6 cursor-pointer accent-cyan-500"
                        />
                        <span className="text-lg font-semibold group-hover:scale-105 transition">🪟 Windows</span>
                      </label>
                      <label className="flex items-center gap-3 text-white cursor-pointer hover:text-cyan-400 transition group">
                        <input
                          type="checkbox"
                          checked={bulkOSLinux}
                          onChange={(e) => {
                            setBulkOSLinux(e.target.checked);
                            applyBulkOS("Linux", e.target.checked);
                          }}
                          className="w-6 h-6 cursor-pointer accent-cyan-500"
                        />
                        <span className="text-lg font-semibold group-hover:scale-105 transition">🐧 Linux</span>
                      </label>
                      <label className="flex items-center gap-3 text-white cursor-pointer hover:text-cyan-400 transition group">
                        <input
                          type="checkbox"
                          checked={bulkOSOther}
                          onChange={(e) => {
                            setBulkOSOther(e.target.checked);
                            applyBulkOS("Other", e.target.checked);
                          }}
                          className="w-6 h-6 cursor-pointer accent-cyan-500"
                        />
                        <span className="text-lg font-semibold group-hover:scale-105 transition">💻 Other</span>
                      </label>
                    </div>
                    <p className="text-gray-300 text-sm mt-3">💡 You can still remove OS from individual stations using the buttons on each station</p>
                  </div>
                </motion.div>
              )}

              {/* Summary when editor is closed */}
              {!showSeatingEditor && getTotalSeats() > 0 && (
                <div className="bg-neutral-800 p-3 rounded-lg">
                  <p className="text-gray-300 text-sm">
                    {seatingArrangement.rows} × {seatingArrangement.columns} grid with {getTotalSeats()} stations configured
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

      {/* Device Linking Modal */}
      {showLinkingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">Link Devices Together</h2>
            <p className="text-gray-400 text-sm mb-4">
              Select devices from different invoices to link them together. When placed, they will share the same assigned code.
            </p>

            {/* Current Linking Group */}
            <div className="mb-4 bg-neutral-800 p-4 rounded-lg">
              <h3 className="text-white font-semibold mb-2">Current Linking Group ({currentLinkingGroup.length} devices)</h3>
              {currentLinkingGroup.length === 0 ? (
                <p className="text-gray-400 text-sm">No devices added yet. Select devices from the list below.</p>
              ) : (
                <ul className="space-y-2">
                  {currentLinkingGroup.map((device, idx) => (
                    <li key={idx} className="bg-neutral-700 p-2 rounded flex justify-between items-center">
                      <div className="text-white text-sm">
                        <span className="font-semibold">{device.type}</span>: {device.brand} {device.model}
                        <span className="text-gray-400 ml-2">(Invoice: {device.invoiceNumber})</span>
                      </div>
                      <button
                        onClick={() => removeFromLinkingGroup(idx)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Available Devices to Link */}
            <div className="mb-4">
              <h3 className="text-white font-semibold mb-2">Available Devices</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto bg-neutral-800 p-3 rounded-lg">
                {availableDevicesForSeating.length === 0 ? (
                  <p className="text-gray-400 text-sm">No devices available.</p>
                ) : (
                  availableDevicesForSeating.map((device, idx) => (
                    <div
                      key={idx}
                      className="bg-neutral-700 p-3 rounded flex justify-between items-start"
                    >
                      <div className="flex-1">
                        <div className="text-white font-semibold">{device.brand} {device.model}</div>
                        <div className="text-gray-300 text-sm">{device.type} - {device.quantity} available</div>
                        <div className="text-gray-400 text-xs">Invoice: {device.invoiceNumber}</div>
                      </div>
                      <button
                        onClick={() => addToLinkingGroup(device)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition"
                      >
                        Add
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowLinkingModal(false);
                  setCurrentLinkingGroup([]);
                }}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded transition"
              >
                Cancel
              </button>
              <button
                onClick={saveLinkingGroup}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition"
              >
                Save Link Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
