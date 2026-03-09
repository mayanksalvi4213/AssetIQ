"use client";
import React, { useEffect, useState } from "react";
import { Menu, MenuItem, HoveredLink } from "@/components/ui/navbar-menu";
import { LogoButton } from "@/components/ui/logo-button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { useAuth } from "@/contexts/AuthContext";

type Role = "HOD" | "Lab Assistant" | "Lab Incharge";

const LAB_OPTIONS = [
  "Physics Lab",
  "Chemistry Lab",
  "Computer Lab",
  "Electronics Lab",
  "Mechanical Lab",
];

export default function Settings() {
  const [active, setActive] = useState<string | null>(null);
  const { user, logout } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [lab, setLab] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load user data from AuthContext
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setEmail(user.email || "");
      setRole(user.role as Role || "");
      setLab(user.assignedLab || "");
      setLoading(false);
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const payload: any = {
        firstName,
        lastName,
        email,
        role,
      };

      if (role === "Lab Incharge") {
        payload.accessScope = { lab };
      }

      if (newPassword) {
        if (newPassword !== confirmPassword) {
          alert("New passwords do not match!");
          return;
        }
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const response = await fetch("http://localhost:5000/user/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Profile updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        alert(data.error || "Update failed!");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Something went wrong. Please try again.");
    }
  };
  return (
    <div className="relative min-h-screen flex flex-col items-center py-12 px-4" style={{
      backgroundColor: "#1c1c1c",
      backgroundImage: 'url(/bg.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
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
              <HoveredLink href="/lab-layout">Lab Layout Designer</HoveredLink>
              <HoveredLink href="/lab-configuration">Lab Configuration</HoveredLink>
            </div>
          </MenuItem>

          <MenuItem setActive={setActive} active={active} item="Operations">
            <div className="flex flex-col space-y-2 text-sm p-2">
              <HoveredLink href="/transfers">Transfers</HoveredLink>
              <HoveredLink href="/dashboard/issues">Issues</HoveredLink>
              <HoveredLink href="/documents">Documents</HoveredLink>
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
      </div>

      <LogoButton />

      <h1 className="text-3xl font-bold mb-6 mt-16 text-gray-200">⚙️ Account Settings</h1>

      <div className="w-full max-w-2xl">
        {loading ? (
          <div className="text-white text-center">Loading...</div>
        ) : (
          <BackgroundGradient 
            containerClassName="w-full" 
            className="rounded-2xl shadow-2xl"
          >
            <div className="w-full rounded-2xl bg-neutral-900/90 backdrop-blur-xl border border-neutral-700 p-6 md:p-8">
              <form className="space-y-5" onSubmit={handleUpdateProfile}>
                {/* Name fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <LabelInputContainer>
                    <Label htmlFor="firstname" className="text-white">First Name</Label>
                    <Input
                      id="firstname"
                      placeholder="John"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="bg-neutral-800/50 border-neutral-600 focus:border-blue-500 text-white"
                      required
                    />
                  </LabelInputContainer>

                  <LabelInputContainer>
                    <Label htmlFor="lastname" className="text-white">Last Name</Label>
                    <Input
                      id="lastname"
                      placeholder="Doe"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="bg-neutral-800/50 border-neutral-600 focus:border-blue-500 text-white"
                      required
                    />
                  </LabelInputContainer>
                </div>

                {/* Email */}
                <LabelInputContainer>
                  <Label htmlFor="email" className="text-white">Email Address</Label>
                  <Input
                    id="email"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-neutral-800/50 border-neutral-600 focus:border-blue-500 text-white"
                    required
                  />
                </LabelInputContainer>

                {/* Role */}
                <LabelInputContainer>
                  <Label htmlFor="role" className="text-white">Role</Label>
                  <select
                    id="role"
                    className="h-10 w-full rounded-md border border-neutral-600 bg-neutral-800/50 px-3 text-sm text-white focus:border-blue-500 focus:ring-blue-500"
                    value={role}
                    onChange={(e) => {
                      const value = e.target.value as Role | "";
                      setRole(value);
                      if (value !== "Lab Incharge") setLab("");
                    }}
                    required
                  >
                    <option value="" disabled>Select role</option>
                    <option value="HOD">HOD</option>
                    <option value="Lab Assistant">Lab Assistant</option>
                    <option value="Lab Incharge">Lab Incharge</option>
                  </select>
                </LabelInputContainer>

                {/* Lab selection */}
                {role === "Lab Incharge" && (
                  <LabelInputContainer>
                    <Label htmlFor="lab" className="text-white">Assigned Lab</Label>
                    <select
                      id="lab"
                      className="h-10 w-full rounded-md border border-neutral-600 bg-neutral-800/50 px-3 text-sm text-white focus:border-blue-500 focus:ring-blue-500"
                      value={lab}
                      onChange={(e) => setLab(e.target.value)}
                      required
                    >
                      <option value="" disabled>Select lab</option>
                      {LAB_OPTIONS.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </LabelInputContainer>
                )}

                {/* Password Change Section */}
                <div className="pt-6 border-t border-neutral-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Change Password (Optional)</h3>
                  
                  <div className="space-y-4">
                    <LabelInputContainer>
                      <Label htmlFor="currentPassword" className="text-white">Current Password</Label>
                      <Input
                        id="currentPassword"
                        placeholder="••••••••"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="bg-neutral-800/50 border-neutral-600 focus:border-blue-500 text-white"
                      />
                    </LabelInputContainer>

                    <LabelInputContainer>
                      <Label htmlFor="newPassword" className="text-white">New Password</Label>
                      <Input
                        id="newPassword"
                        placeholder="••••••••"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="bg-neutral-800/50 border-neutral-600 focus:border-blue-500 text-white"
                      />
                    </LabelInputContainer>

                    <LabelInputContainer>
                      <Label htmlFor="confirmPassword" className="text-white">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        placeholder="••••••••"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`bg-neutral-800/50 border ${newPassword && confirmPassword && newPassword !== confirmPassword ? "border-red-500" : "border-neutral-600"} focus:border-blue-500 text-white`}
                      />
                      {newPassword && confirmPassword && (
                        <p className={`text-xs mt-1 ${newPassword === confirmPassword ? "text-green-400" : "text-red-400"}`}>
                          {newPassword === confirmPassword ? "✅ Passwords match" : "❌ Passwords do not match"}
                        </p>
                      )}
                    </LabelInputContainer>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  className="group/btn relative block h-11 w-full rounded-md font-medium text-white shadow-[0px_1px_0px_0px_#ffffff20_inset,0px_-1px_0px_0px_#ffffff20_inset] bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 border border-blue-500 transition-all duration-200"
                  type="submit"
                >
                  Update Profile
                </button>
              </form>
            </div>
          </BackgroundGradient>
        )}
      </div>
    </div>
  );
}

const LabelInputContainer = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("flex w-full flex-col space-y-2", className)}>{children}</div>
);
