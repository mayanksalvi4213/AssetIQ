"use client";
import React from "react";
import { Link } from "react-router-dom";
import { Boxes } from "@/components/ui/background-boxes";
import { cn } from "@/lib/utils";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-start">
      {/* Hero Section */}
      <div className="h-[28rem] relative w-full overflow-hidden bg-slate-900 flex flex-col items-center justify-center rounded-lg">
        <div className="absolute inset-0 w-full h-full bg-slate-900 z-20 [mask-image:radial-gradient(transparent,white)] pointer-events-none" />
        <Boxes />
        <h1 className={cn("md:text-5xl text-3xl font-bold text-white relative z-20")}>
          AssetIQ
        </h1>
        <p className="text-center mt-4 text-neutral-300 relative z-20 max-w-2xl">
          Comprehensive AI Enabled Framework for Asset Management of Educational Institutes
        </p>

        {/* Hover Buttons */}
        <div className="flex gap-6 mt-6 relative z-20">
          {/* ✅ Get Started -> /get-started */}
          <Link to="/get-started">
            <HoverBorderGradient
              as="button"
              containerClassName="rounded-full"
              className="dark:bg-black bg-white text-black dark:text-white flex items-center space-x-2 transition-colors duration-300 hover:bg-blue-600 hover:text-white"
            >
              Get Started
            </HoverBorderGradient>
          </Link>

          {/* ✅ Login -> /Login */}
          <Link to="/Login">
            <HoverBorderGradient
              as="button"
              containerClassName="rounded-full"
              className="dark:bg-black bg-white text-black dark:text-white flex items-center space-x-2 transition-colors duration-300 hover:bg-green-600 hover:text-white"
            >
              Login
            </HoverBorderGradient>
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-6 py-16 relative z-10">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Why Choose AssetIQ?
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <FeatureCard
            title="Centralized Asset Management"
            description="Track and manage IT assets across labs and facilities from a single dashboard."
            steps={[
              "Monitor lifecycle from procurement to scrapping",
              "Centralized dashboard for all devices",
              "Quick search & filtering",
            ]}
          />
          <FeatureCard
            title="AI-Powered Insights"
            description="Predictive maintenance and warranty tracking to minimize downtime."
            steps={[
              "Smart alerts for expiring warranties",
              "AI-based health predictions",
              "Preventive maintenance schedules",
            ]}
          />
          <FeatureCard
            title="Workflow Automation"
            description="Automated approval processes for asset transfers and lifecycle updates."
            steps={[
              "Streamlined request approvals",
              "Auto updates for asset movement",
              "Reduce manual paperwork",
            ]}
          />
          <FeatureCard
            title="Actionable Analytics"
            description="Data-driven insights and alerts to support smarter decision-making."
            steps={[
              "Interactive analytics dashboard",
              "Custom reports & KPIs",
              "Real-time asset usage trends",
            ]}
          />
        </div>
      </div>
    </div>
  );
};

export default LandingPage;

/* ---------------- Feature Card Component ---------------- */
const FeatureCard = ({
  title,
  description,
  steps,
}: {
  title: string;
  description: string;
  steps: string[];
}) => {
  return (
    <CardSpotlight className="h-auto w-full p-6">
      <h3 className="text-xl font-bold relative z-20 mt-2 text-white">{title}</h3>
      <p className="text-neutral-300 mt-2 relative z-20 text-sm">{description}</p>
      <ul className="list-none mt-4 space-y-2">
        {steps.map((step, index) => (
          <Step key={index} title={step} />
        ))}
      </ul>
    </CardSpotlight>
  );
};

const Step = ({ title }: { title: string }) => (
  <li className="flex gap-2 items-start">
    <CheckIcon />
    <p className="text-white">{title}</p>
  </li>
);

const CheckIcon = () => (
  <svg
    width="66"
    height="65"
    viewBox="0 0 66 65"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-3 w-3 text-black dark:text-white"
  >
    <path
      d="M8 8.05571C8 8.05571 54.9009 18.1782 57.8687 30.062C60.8365 41.9458 9.05432 57.4696 9.05432 57.4696"
      stroke="currentColor"
      strokeWidth="15"
      strokeMiterlimit="3.86874"
      strokeLinecap="round"
    />
  </svg>
);