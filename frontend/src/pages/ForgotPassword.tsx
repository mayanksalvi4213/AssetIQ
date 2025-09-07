"use client";
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Forgot password submit");
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black text-white px-4 overflow-hidden">
      <div
        className={cn(
          "absolute inset-0 -z-20",
          "[background-size:20px_20px]",
          "[background-image:radial-gradient(white_1px,transparent_1px)]"
        )}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/40 via-black/70 to-black" />

      <BackgroundGradient containerClassName="w-full max-w-md" className="rounded-3xl">
        <div className="shadow-input w-full rounded-3xl bg-neutral-900/70 backdrop-blur-md border border-white/15 p-6 md:p-10">
          <h2 className="text-2xl font-bold">Reset Password</h2>
          <p className="mt-2 text-sm text-gray-300">Enter your email to receive reset instructions.</p>

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

            <button
              type="submit"
              className="group/btn relative block h-10 w-full rounded-md bg-gradient-to-br from-gray-800 to-gray-900 font-medium text-white shadow-[0px_1px_0px_0px_#ffffff20_inset,0px_-1px_0px_0px_#ffffff20_inset] border border-gray-700 hover:from-gray-700 hover:to-gray-800 transition-all duration-200"
            >
              Send Reset Link →
            </button>

            <p className="mt-6 text-center text-sm text-gray-400">
              Remembered your password? {""}
              <Link to="/login" className="font-medium text-blue-400 hover:underline hover:text-blue-300">Back to Login</Link>
            </p>
          </form>
        </div>
      </BackgroundGradient>
    </div>
  );
}

const LabelInputContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={cn("flex w-full flex-col space-y-2", className)}>{children}</div>;


