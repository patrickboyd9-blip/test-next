import { eddmDisplayName, eddmKeepOuts, eddmTrim, type EddmSize } from "@/lib/eddm/geometry"

/**
 * Shows where Click2Mail prints the Every Door address block.
 * The print file leaves this rectangle blank. The box matches the
 * measured 4 in × 2 in template keep-out.
 */
export function EddmAddressBlockPreview({ size }: { size: EddmSize }) {
  const trim = eddmTrim(size)
  const block = eddmKeepOuts(trim)[0]
  const width = block ? (block.widthInches / trim.widthInches) * 100 : 0
  const height = block ? (block.heightInches / trim.heightInches) * 100 : 0

  return (
    <figure className="flex flex-col gap-2" data-eddm-card={size}>
      <div
        className="relative overflow-hidden rounded-lg border bg-white"
        style={{ aspectRatio: `${trim.widthInches} / ${trim.heightInches}` }}
      >
        <div className="absolute inset-0 p-3 pr-[46%] text-sm text-muted-foreground">
          Neighborhood offer. No first name.
        </div>
        <div
          data-eddm-address-block
          className="absolute flex flex-col items-center justify-center gap-0.5 border border-neutral-800 bg-neutral-50 px-1 text-center"
          style={{ width: `${width}%`, height: `${height}%`, right: 0, bottom: 0 }}
        >
          <span className="text-[10px] font-medium uppercase tracking-wide">Local</span>
          <span className="text-xs font-semibold tracking-wide">POSTAL CUSTOMER</span>
          <span className="text-[10px] leading-tight tracking-wide">
            ECRWSS
            <br />
            EDDM
          </span>
          <span className="mt-1 text-[10px] text-muted-foreground">Click2Mail prints this</span>
        </div>
      </div>
      <figcaption className="text-sm text-muted-foreground">
        The address block sits at the bottom-right of the {eddmDisplayName(size)} card. It is 4 inches wide and 2 inches tall. Click2Mail prints Postal Customer and the indicia there. Our file leaves that box blank. The offer speaks to the neighborhood, with no first name.
      </figcaption>
    </figure>
  )
}
