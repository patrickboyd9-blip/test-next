export interface XmlElement {
  name: string
  text: string
  children: XmlElement[]
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (all, token: string) => {
    if (token.startsWith("#x") || token.startsWith("#X")) {
      const code = Number.parseInt(token.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : all
    }
    if (token.startsWith("#")) {
      const code = Number.parseInt(token.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : all
    }
    return ENTITIES[token] ?? all
  })
}

export function parseXml(source: string): XmlElement {
  const input = source.replace(/^\uFEFF/, "")
  let index = 0

  const skipWhitespace = () => {
    while (index < input.length && /\s/.test(input[index] ?? "")) index += 1
  }

  const parseName = (): string => {
    const start = index
    if (!/[A-Za-z_:]/.test(input[index] ?? "")) {
      throw new Error("Click2Mail returned XML that could not be read.")
    }
    index += 1
    while (index < input.length && /[A-Za-z0-9_.:-]/.test(input[index] ?? "")) index += 1
    return input.slice(start, index)
  }

  const skipAttributes = (): boolean => {
    while (index < input.length) {
      const char = input[index] ?? ""
      if (/\s/.test(char)) {
        index += 1
        continue
      }
      if (input.startsWith("/>", index)) {
        index += 2
        return true
      }
      if (char === ">") {
        index += 1
        return false
      }
      parseName()
      skipWhitespace()
      if (input[index] !== "=") throw new Error("Click2Mail returned XML that could not be read.")
      index += 1
      skipWhitespace()
      const quote = input[index]
      if (quote !== '"' && quote !== "'") {
        throw new Error("Click2Mail returned XML that could not be read.")
      }
      index += 1
      const end = input.indexOf(quote, index)
      if (end < 0) throw new Error("Click2Mail returned XML that could not be read.")
      index = end + 1
    }
    throw new Error("Click2Mail returned XML that could not be read.")
  }

  const parseElement = (): XmlElement => {
    if (input[index] !== "<") throw new Error("Click2Mail returned XML that could not be read.")
    index += 1
    const name = parseName()
    const selfClosing = skipAttributes()
    const children: XmlElement[] = []
    let text = ""
    if (!selfClosing) {
      while (index < input.length) {
        if (input.startsWith("</", index)) {
          index += 2
          const close = parseName()
          if (close !== name) throw new Error("Click2Mail returned XML that could not be read.")
          skipWhitespace()
          if (input[index] !== ">") throw new Error("Click2Mail returned XML that could not be read.")
          index += 1
          break
        }
        if (input.startsWith("<!--", index)) {
          const end = input.indexOf("-->", index)
          if (end < 0) throw new Error("Click2Mail returned XML that could not be read.")
          index = end + 3
          continue
        }
        if (input.startsWith("<![CDATA[", index)) {
          const end = input.indexOf("]]>", index)
          if (end < 0) throw new Error("Click2Mail returned XML that could not be read.")
          text += input.slice(index + 9, end)
          index = end + 3
          continue
        }
        if (input[index] === "<") {
          children.push(parseElement())
          continue
        }
        const next = input.indexOf("<", index)
        const chunk = next < 0 ? input.slice(index) : input.slice(index, next)
        text += decodeXml(chunk)
        index = next < 0 ? input.length : next
      }
    }
    return { name, text: text.trim(), children }
  }

  while (index < input.length) {
    skipWhitespace()
    if (input.startsWith("<?", index)) {
      const end = input.indexOf("?>", index)
      if (end < 0) throw new Error("Click2Mail returned XML that could not be read.")
      index = end + 2
      continue
    }
    if (input.startsWith("<!--", index)) {
      const end = input.indexOf("-->", index)
      if (end < 0) throw new Error("Click2Mail returned XML that could not be read.")
      index = end + 3
      continue
    }
    if (input.startsWith("<!", index)) {
      const end = input.indexOf(">", index)
      if (end < 0) throw new Error("Click2Mail returned XML that could not be read.")
      index = end + 1
      continue
    }
    break
  }

  skipWhitespace()
  if (input[index] !== "<") throw new Error("Click2Mail returned XML that could not be read.")
  return parseElement()
}

export function findChild(element: XmlElement, name: string): XmlElement | undefined {
  const wanted = name.toLowerCase()
  return element.children.find((child) => child.name.toLowerCase() === wanted)
}

export function childrenNamed(element: XmlElement, name: string): XmlElement[] {
  const wanted = name.toLowerCase()
  return element.children.filter((child) => child.name.toLowerCase() === wanted)
}

export function childText(element: XmlElement, name: string): string | undefined {
  const child = findChild(element, name)
  if (!child) return undefined
  return child.text
}

/** First non-empty direct child among the given names. */
export function firstText(element: XmlElement, names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = childText(element, name)?.trim()
    if (value) return value
  }
  return undefined
}

export function xmlTag(name: string, value: string): string {
  return `<${name}>${escapeXml(value)}</${name}>`
}
