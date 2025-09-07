"use client";
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BackgroundGradient } from "@/components/ui/background-gradient";

export function LoginForm() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Login submitted");
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black text-white px-4 overflow-hidden">
      {/* White Dot Background */}
      <div
        className={cn(
          "absolute inset-0 -z-20",
          "[background-size:20px_20px]",
          "[background-image:radial-gradient(white_1px,transparent_1px)]"
        )}
      />

      {/* Subtle radial fade */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/40 via-black/70 to-black" />

      {/* Login Card */}
      <BackgroundGradient containerClassName="w-full max-w-md" className="rounded-3xl">
        <div className="shadow-input w-full rounded-3xl bg-neutral-900/70 backdrop-blur-md border border-white/15 p-6 md:p-10">
          <h2 className="text-2xl font-bold">Welcome Back</h2>
          <p className="mt-2 text-sm text-gray-300">
            Please log in to your account
          </p>

          <form onSubmit={handleSubmit} className="mt-6">
            <LabelInputContainer className="mb-4">
              <Label htmlFor="email" className="text-white">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                className="bg-gray-900/50 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-white placeholder-gray-400"
              />
            </LabelInputContainer>

            <LabelInputContainer className="mb-2">
              <Label htmlFor="password" className="text-white">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                className="bg-gray-900/50 border-gray-700 focus:border-blue-500 focus:ring-blue-500 text-white placeholder-gray-400"
              />
            </LabelInputContainer>

            <div className="flex justify-end mb-6">
              <a
                href="#"
                className="text-sm text-blue-400 hover:underline hover:text-blue-300"
              >
                Forgot password?
              </a>
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
              <a
                href="#"
                className="font-medium text-blue-400 hover:underline hover:text-blue-300"
              >
                Create one
              </a>
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

const LabelInputContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={cn("flex w-full flex-col space-y-2", className)}>{children}</div>;
