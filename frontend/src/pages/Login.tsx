"use client";
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BackgroundGradient } from "@/components/ui/background-gradient";

export function LoginForm() {
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.target as HTMLFormElement;
    const email = (form.querySelector("#email") as HTMLInputElement).value;
    const password = (form.querySelector("#password") as HTMLInputElement).value;

    try {
      const response = await fetch("http://127.0.0.1:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Login successful!", data);
        localStorage.setItem("token", data.token);
        alert("Login successful!");
        navigate("/dashboard"); // redirect to dashboard
      } else {
        alert(data.error || "Login failed!");
      }
    } catch (error) {
      console.error("Error logging in:", error);
      alert("Something went wrong. Check console.");
    }
  };

  return (
    <div 
      className="relative min-h-screen flex items-center justify-center text-white px-4 overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/bg.jpg')" }}
    >
      {/* Background dots */}
      <div
        className={cn(
          "absolute inset-0 -z-20",
          "[background-size:20px_20px]",
          "[background-image:radial-gradient(white_1px,transparent_1px)]"
        )}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/70 to-black/80" />

      {/* Login Card */}
      <BackgroundGradient containerClassName="w-full max-w-md" className="rounded-3xl">
        <div className="shadow-input w-full rounded-3xl bg-neutral-900/70 backdrop-blur-md border border-white/15 p-6 md:p-10">
          <h2 className="text-2xl font-bold">Welcome Back</h2>
          <p className="mt-2 text-sm text-gray-300">Please log in to your account</p>

          <form onSubmit={handleSubmit} className="mt-6">
            <LabelInputContainer className="mb-4">
              <Label htmlFor="email" className="text-white">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                className="bg-gray-900/50 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-white placeholder-gray-400"
              />
            </LabelInputContainer>

            <LabelInputContainer className="mb-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                className="bg-gray-900/50 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-white placeholder-gray-400"
              />
            </LabelInputContainer>

            <div className="flex justify-end mb-6">
              <Link to="/forgot" className="text-sm text-blue-400 hover:underline hover:text-blue-300">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="group/btn relative block h-10 w-full rounded-md bg-gradient-to-br from-gray-800 to-gray-900 font-medium text-white shadow-[0px_1px_0px_0px_#ffffff20_inset,0px_-1px_0px_0px_#ffffff20_inset] border border-gray-700 hover:from-gray-700 hover:to-gray-800 transition-all duration-200"
            >
              Log In →
              <BottomGradient />
            </button>

            <p className="mt-6 text-center text-sm text-gray-400">
              Don&apos;t have an account?{" "}
              <Link to="/signup" className="font-medium text-blue-400 hover:underline hover:text-blue-300">
                Create one
              </Link>
            </p>
          </form>
        </div>
      </BackgroundGradient>
    </div>
  );
}

const BottomGradient = () => (
  <>
    <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
    <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
  </>
);

const LabelInputContainer = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("flex w-full flex-col space-y-2", className)}>{children}</div>
);
