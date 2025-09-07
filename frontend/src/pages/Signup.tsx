import React, { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { motion } from "motion/react";
import { LampContainer } from "@/components/ui/lamp";

type Role = "HOD" | "Lab Assistant" | "Lab Incharge";

const LAB_OPTIONS = [
  "Physics Lab",
  "Chemistry Lab",
  "Computer Lab",
  "Electronics Lab",
  "Mechanical Lab",
];

export default function Signup() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [lab, setLab] = useState<string>("");

  const requiresLabSelection = useMemo(() => role === "Lab Incharge", [role]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = {
      firstName,
      lastName,
      email,
      password,
      role,
      accessScope: role === "Lab Incharge" ? { type: "single", lab } : { type: "all" },
    };
    console.log("Signup submit", payload);
    // TODO: integrate API when available
  };

  return (
    <LampContainer>
        <motion.h1
          initial={{ opacity: 0.5, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
          className="mt-6 text-center text-3xl font-semibold tracking-tight md:text-5xl"
        >
          <motion.span
            className="inline-block bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #22d3ee, #7b61ff, #ffc414)",
              backgroundSize: "200% 100%",
            }}
            animate={{
              backgroundPosition: ["0% 0%", "100% 0%", "0% 0%"],
            }}
            transition={{ duration: 6, repeat: Infinity }}
          >
            Create your account
          </motion.span>
        </motion.h1>

        <div className="mt-4 flex items-start justify-center">
          <BackgroundGradient containerClassName="w-full max-w-sm" className="rounded-2xl">
            <div className="shadow-input w-full rounded-2xl bg-neutral-900/70 backdrop-blur-md border border-white/15 p-5 md:p-8">

              <form className="mt-6" onSubmit={handleSubmit}>
            <div className="mb-4 flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2">
              <LabelInputContainer>
                <Label htmlFor="firstname" className="text-white">First name</Label>
                <Input id="firstname" placeholder="John" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-gray-900/50 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-white placeholder-gray-400" />
              </LabelInputContainer>
              <LabelInputContainer>
                <Label htmlFor="lastname" className="text-white">Last name</Label>
                <Input id="lastname" placeholder="Doe" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-gray-900/50 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-white placeholder-gray-400" />
              </LabelInputContainer>
            </div>

            <LabelInputContainer className="mb-4">
              <Label htmlFor="email" className="text-white">Email Address (use institutional email)</Label>
              <Input id="email" placeholder="you@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-gray-900/50 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-white placeholder-gray-400" />
            </LabelInputContainer>

            <LabelInputContainer className="mb-4">
              <Label htmlFor="password" className="text-white">Password</Label>
              <Input id="password" placeholder="••••••••" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-gray-900/50 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-white placeholder-gray-400" />
            </LabelInputContainer>

            <LabelInputContainer className="mb-4">
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
                <option value="" disabled>
                  Select role
                </option>
                <option value="HOD">HOD</option>
                <option value="Lab Assistant">Lab Assistant</option>
                <option value="Lab Incharge">Lab Incharge</option>
              </select>
            </LabelInputContainer>

            {requiresLabSelection && (
              <LabelInputContainer className="mb-6">
                <Label htmlFor="lab" className="text-white">Assigned Lab</Label>
                <select
                  id="lab"
                  className="h-10 w-full rounded-md border border-gray-700 bg-gray-900/50 px-3 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
                  value={lab}
                  onChange={(e) => setLab(e.target.value)}
                  required={requiresLabSelection}
                >
                  <option value="" disabled>
                    Select lab
                  </option>
                  {LAB_OPTIONS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </LabelInputContainer>
            )}

                <button
                  className="group/btn relative block h-10 w-full rounded-md bg-gradient-to-br from-gray-800 to-gray-900 font-medium text-white shadow-[0px_1px_0px_0px_#ffffff20_inset,0px_-1px_0px_0px_#ffffff20_inset] border border-gray-700 hover:from-gray-700 hover:to-gray-800 transition-all duration-200"
                  type="submit"
                >
                  Create Account →
                </button>
              </form>
            </div>
          </BackgroundGradient>
        </div>
      </LampContainer>
  );
}

const LabelInputContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <div className={cn("flex w-full flex-col space-y-2", className)}>{children}</div>;
};


