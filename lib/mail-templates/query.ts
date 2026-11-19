import { MAIL_TEMPLATES } from "./catalog"
import { expansionTemplates } from "./gallery-expansion"
import type { MailTemplate, TemplateIndustry } from "./types"

const ALL_TEMPLATES: readonly MailTemplate[] = [...MAIL_TEMPLATES, ...expansionTemplates()]

function copyTemplate(template: MailTemplate): MailTemplate {
  return {
    ...template,
    spec: {
      ...template.spec,
      palette: template.spec.palette?.slice(),
    },
  }
}

/** Every mailer, or the ones in a single industry. Order is the catalog order. */
export function listMailTemplates(industry?: TemplateIndustry): MailTemplate[] {
  const records = industry
    ? ALL_TEMPLATES.filter((template) => template.industry === industry)
    : ALL_TEMPLATES
  return records.map(copyTemplate)
}

export function getMailTemplate(id: string): MailTemplate | null {
  const template = ALL_TEMPLATES.find((record) => record.id === id)
  return template ? copyTemplate(template) : null
}
