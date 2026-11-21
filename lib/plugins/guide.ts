export interface PluginGuide {
  id: string
  label: string
  open: string
}

/** Customer steps. Each app opens differently. The rest of the path is the same. */
export const PLUGIN_GUIDES: readonly PluginGuide[] = [
  {
    id: "figma",
    label: "Figma",
    open: "In Figma, open a design file and run the Modern Mail plugin.",
  },
  {
    id: "canva",
    label: "Canva",
    open: "In Canva, open the Modern Mail app.",
  },
  {
    id: "express",
    label: "Adobe Express",
    open: "In Adobe Express, open the Modern Mail add-on.",
  },
  {
    id: "adobe",
    label: "Photoshop and InDesign",
    open: "In Photoshop or InDesign, open the Modern Mail panel.",
  },
]

export const PLUGIN_GUIDE_PATH = "/app/help/plugins"

export function pluginSteps(guide: PluginGuide): string[] {
  return [
    "In Modern Mail, open Settings, then API & AI assistants. Create a token and copy it. You will see it only once.",
    `${guide.open} This plugin is coming soon, so there is nothing to install yet.`,
    "Paste the token once. You do not need to paste it again on this computer.",
    "Choose a 5×8 or a 6×9. Click Create front and back. Design on those pages. They are already the right size.",
    "Click Load my campaigns and pick one, or leave New campaign selected. Type a campaign name and your return address.",
    "Click Check and send.",
    "Open that campaign in Modern Mail. Approve the proof and the price there. Nothing is mailed until you approve.",
  ]
}
