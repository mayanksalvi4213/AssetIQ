"use client";
import React, { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { motion } from "motion/react";

type Role = "HOD" | "Lab Assistant" | "Lab Incharge";

const LAB_OPTIONS = [
  "Physics Lab",
  "Chemistry Lab",
  "Computer Lab",
  "Electronics Lab",
  "Mechanical Lab",
];

const validatePassword = (password: string) => ({
  length: password.length >= 8,
  uppercase: /[A-Z]/.test(password),
  lowercase: /[a-z]/.test(password),
  number: /[0-9]/.test(password),
  special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
});

export default function Signup() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [lab, setLab] = useState<string>("");
  const [showPasswordValidation, setShowPasswordValidation] = useState(false);

  const requiresLabSelection = useMemo(() => role === "Lab Incharge", [role]);
  const passwordValidations = validatePassword(password);
  const isPasswordValid = Object.values(passwordValidations).every(Boolean);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isPasswordValid) {
      alert("Password does not meet security requirements.");
      return;
    }
    if (!passwordsMatch) {
      alert("Passwords do not match.");
      return;
    }

    // ✅ Correct payload for backend
    const payload = {
      firstName,
      lastName,
      email,
      password,
      role,
      accessScope: role === "Lab Incharge" ? { lab } : {},
    };

    try {
      const response = await fetch("http://127.0.0.1:5000/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Signup successful! Please login.");
        window.location.href = "/login";
      } else {
        alert(data.error || "Signup failed!");
      }
    } catch (error) {
      console.error("Error during signup:", error);
      alert("Something went wrong. Check console.");
    }
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat relative brightness-110"
      style={{ backgroundImage: "url('/bg.jpg')" }}
    >
      {/* Light overlay for better text readability */}
      <div className="absolute inset-0 bg-black/25 z-0"></div>
      
      <div className="flex flex-col items-center justify-center min-h-screen py-8 px-4 relative z-10">
        <motion.h1
          initial={{ opacity: 0.5, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
          className="mb-8 text-center text-3xl font-semibold tracking-tight md:text-5xl drop-shadow-2xl"
        >
          <motion.span
            className="inline-block bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(90deg, #22d3ee, #7b61ff, #ffc414, #f97316)",
              backgroundSize: "200% 100%",
              filter: "brightness(1.2) contrast(1.1)"
            }}
            animate={{ backgroundPosition: ["0% 0%", "100% 0%", "0% 0%"] }}
            transition={{ duration: 6, repeat: Infinity }}
          >
            Create your account
          </motion.span>
        </motion.h1>

        <div className="w-full max-w-sm">
          <BackgroundGradient 
            containerClassName="w-full" 
            className="rounded-2xl shadow-2xl shadow-blue-500/20"
          >
            <div className="w-full rounded-2xl bg-neutral-900/80 backdrop-blur-xl border border-white/20 p-5 md:p-8 
                           shadow-xl shadow-purple-500/10 hover:shadow-blue-500/20 transition-all duration-300">
              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Name fields */}
                <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-2">
                  <LabelInputContainer>
                    <Label htmlFor="firstname" className="text-white">First name</Label>
                    <Input
                      id="firstname"
                      placeholder="John"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="bg-gray-900/50 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-white placeholder-gray-400"
                    />
                  </LabelInputContainer>
                  <LabelInputContainer>
                    <Label htmlFor="lastname" className="text-white">Last name</Label>
                    <Input
                      id="lastname"
                      placeholder="Doe"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="bg-gray-900/50 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-white placeholder-gray-400"
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
                    className="bg-gray-900/50 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-white placeholder-gray-400"
                  />
                </LabelInputContainer>

                {/* Password */}
                <LabelInputContainer>
                  <Label htmlFor="password" className="text-white">Password</Label>
                  <Input
                    id="password"
                    placeholder="••••••••"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setShowPasswordValidation(true)}
                    onBlur={() => setShowPasswordValidation(false)}
                    className="bg-gray-900/50 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-white placeholder-gray-400"
                  />
                  {showPasswordValidation && (
                    <motion.ul
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs mt-2 space-y-1"
                    >
                      <li className={passwordValidations.length ? "text-green-400" : "text-red-400"}>• At least 8 characters</li>
                      <li className={passwordValidations.uppercase ? "text-green-400" : "text-red-400"}>• One uppercase letter</li>
                      <li className={passwordValidations.lowercase ? "text-green-400" : "text-red-400"}>• One lowercase letter</li>
                      <li className={passwordValidations.number ? "text-green-400" : "text-red-400"}>• One number</li>
                      <li className={passwordValidations.special ? "text-green-400" : "text-red-400"}>• One special character</li>
                    </motion.ul>
                  )}
                </LabelInputContainer>

                {/* Confirm Password */}
                <LabelInputContainer>
                  <Label htmlFor="confirmPassword" className="text-white">Retype Password</Label>
                  <Input
                    id="confirmPassword"
                    placeholder="••••••••"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`bg-gray-900/50 border ${passwordsMatch || confirmPassword === "" ? "border-gray-700 focus:border-blue-500" : "border-red-500 focus:border-red-500"} focus:ring-blue-500 text-white placeholder-gray-400`}
                  />
                  {confirmPassword && (
                    <p className={`text-xs mt-1 ${passwordsMatch ? "text-green-400" : "text-red-400"}`}>
                      {passwordsMatch ? "✅ Passwords match" : "❌ Passwords do not match"}
                    </p>
                  )}
                </LabelInputContainer>

                {/* Role */}
                <LabelInputContainer>
                  <Label htmlFor="role" className="text-white">Role</Label>
                  <select
                    id="role"
                    className="h-10 w-full rounded-md border border-gray-700 bg-gray-900/50 px-3 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
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
                {requiresLabSelection && (
                  <LabelInputContainer>
                    <Label htmlFor="lab" className="text-white">Assigned Lab</Label>
                    <select
                      id="lab"
                      className="h-10 w-full rounded-md border border-gray-700 bg-gray-900/50 px-3 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
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

                {/* Submit button */}
                <button
                  className={`group/btn relative block h-10 w-full rounded-md font-medium text-white shadow-[0px_1px_0px_0px_#ffffff20_inset,0px_-1px_0px_0px_#ffffff20_inset] border transition-all duration-200 ${isPasswordValid && passwordsMatch ? "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:from-gray-700 hover:to-gray-800" : "bg-gray-700 cursor-not-allowed opacity-60"}`}
                  type="submit"
                  disabled={!isPasswordValid || !passwordsMatch}
                >
                  Create Account →
                </button>

                <div className="text-center">
                  <p className="text-gray-400 text-sm">
                    Already have an account?{" "}
                    <a href="/login" className="text-blue-400 hover:text-blue-300 transition-colors duration-200 font-medium">
                      Login
                    </a>
                  </p>
                </div>
              </form>
            </div>
          </BackgroundGradient>
        </div>
        </div>
    </div>
  );
}

const LabelInputContainer = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("flex w-full flex-col space-y-2", className)}>{children}</div>
);
