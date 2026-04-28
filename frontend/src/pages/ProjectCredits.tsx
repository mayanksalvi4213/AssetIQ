"use client";
import React from "react";
import AppNavbar from "@/components/AppNavbar";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";

const contributors = [
  {
    name: "Mayank Salvi",
    email: "salvimayank40@gmail.com",
    linkedin: "https://www.linkedin.com/in/mayank-salvi-1357a433a",
    github: "https://github.com/mayanksalvi4213",
  },
  {
    name: "Aniruddha Sangle",
    email: "aniruddhasangle13@gmail.com",
    linkedin: "https://www.linkedin.com/in/aniruddha-sangle-04540535b/",
    github: "https://github.com/NOTanirudh",
  },
  {
    name: "Gandhar Rane",
    email: "gandharrane303@gmail.com",
    linkedin: "https://www.linkedin.com/in/gandhar-rane-339707288",
    github: "https://github.com/Gandhar-Rane",
  },
  {
    name: "Pawan Walke",
    email: "pawanwalke6@gmail.com",
    linkedin: "https://www.linkedin.com/in/pawan-walke-a6845b306/",
    github: "https://github.com/Pawan22104168",
  },
];

const guide = {
  name: "Dr. Vishal Badgujar",
  role: "Project Guide",
  email: "vishalbadgujar4@gmail.com",
  linkedin: "https://www.linkedin.com/in/vishalbadgujar/",
  github: "",
};

export default function ProjectCredits() {
  return (
    <div className="relative min-h-screen w-full bg-black text-white pb-20">
      <AppNavbar />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#1f2937,transparent_55%)]" />

      <section className="pt-32 px-6 max-w-6xl mx-auto relative z-10">
        <BackgroundGradient containerClassName="rounded-3xl mb-10">
          <div className="rounded-3xl border border-neutral-800 bg-neutral-950/90 p-8 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                  Final Year Project
                </p>
                <h1 className="text-3xl md:text-4xl font-bold mt-2">
                  Project Credits
                </h1>
                <p className="text-sm text-gray-400 mt-3 max-w-2xl">
                  Built with care by a focused team and guided by a dedicated mentor.
                  Here are the people behind AssetIQ along with their contact details.
                </p>
              </div>
              <HoverBorderGradient as="a" href="/dashboard">
                Back to Dashboard
              </HoverBorderGradient>
            </div>
          </div>
        </BackgroundGradient>

        <div className="mb-10">
          <h2 className="text-xl font-semibold">Makers</h2>
          <p className="text-sm text-gray-400 mt-2">
            The team behind AssetIQ with their contact details.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {contributors.map((person) => (
            <CardSpotlight key={person.email} className="bg-neutral-950/80 border-neutral-800">
              <div className="relative z-10">
                <h3 className="text-2xl font-semibold mt-2">{person.name}</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <a
                    className="text-cyan-300 hover:text-cyan-200 transition-colors"
                    href={`mailto:${person.email}`}
                  >
                    {person.email}
                  </a>
                  <div className="flex flex-wrap gap-4">
                    <a
                      className="text-blue-300 hover:text-blue-200 transition-colors"
                      href={person.linkedin}
                      target="_blank"
                      rel="noreferrer"
                    >
                      LinkedIn
                    </a>
                    <a
                      className="text-emerald-300 hover:text-emerald-200 transition-colors"
                      href={person.github}
                      target="_blank"
                      rel="noreferrer"
                    >
                      GitHub
                    </a>
                  </div>
                </div>
              </div>
            </CardSpotlight>
          ))}
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold">Project Guide</h2>
          <p className="text-sm text-gray-400 mt-2">
            Academic guidance and mentorship that shaped the project.
          </p>
        </div>

        <CardSpotlight className="bg-neutral-950/80 border-neutral-800">
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-widest text-gray-400">{guide.role}</p>
            <h3 className="text-2xl font-semibold mt-2">{guide.name}</h3>
            <div className="mt-4 space-y-2 text-sm">
              <a
                className="text-cyan-300 hover:text-cyan-200 transition-colors"
                href={`mailto:${guide.email}`}
              >
                {guide.email}
              </a>
              <div className="flex flex-wrap gap-4">
                <a
                  className="text-blue-300 hover:text-blue-200 transition-colors"
                  href={guide.linkedin}
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn
                </a>
              </div>
            </div>
          </div>
        </CardSpotlight>
      </section>
    </div>
  );
}
