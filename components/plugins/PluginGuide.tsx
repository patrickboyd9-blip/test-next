"use client"

import { useState } from "react"

import { PLUGIN_GUIDES, pluginSteps } from "@/lib/plugins/guide"

export function PluginGuide() {
  const [current, setCurrent] = useState(PLUGIN_GUIDES[0]?.id ?? "figma")
  const guide = PLUGIN_GUIDES.find((item) => item.id === current) ?? PLUGIN_GUIDES[0]
  if (!guide) return null
  const steps = pluginSteps(guide)

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Plugins" className="flex flex-wrap gap-2">
        {PLUGIN_GUIDES.map((item) => {
          const selected = item.id === guide.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`min-h-11 rounded-xl border px-3 text-sm ${selected ? "bg-[#5ce1ff] font-semibold text-[#041018]" : "border-[#245068]"}`}
              onClick={() => setCurrent(item.id)}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <section role="tabpanel" className="flex flex-col gap-3 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-medium">{guide.label}</h2>
          <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">Coming soon</span>
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-6">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  )
}
