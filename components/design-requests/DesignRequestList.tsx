import type { DesignRequest, DesignRequestUpload, ResponseMethod } from "@/lib/design-requests/types"
import { RESPONSE_METHOD_LABELS } from "@/lib/design-requests/types"

interface DesignRequestListProps {
  requests: DesignRequest[]
}

export function DesignRequestList({ requests }: DesignRequestListProps) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Design requests</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Postcards the team has been asked to design. Uploads stay with the request. Nothing here is emailed.
          </p>
        </div>

        {requests.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground" data-slot="design-request-empty">
            No design requests yet. When a customer asks the team to design a postcard, it shows up here.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {requests.map((request) => (
              <li
                key={request.id}
                data-slot="design-request"
                data-request-id={request.id}
                className="flex flex-col gap-4 rounded-xl border p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-medium">{request.companyName}</h2>
                  <time className="text-xs text-muted-foreground" dateTime={request.createdAt}>
                    {formatRequestDate(request.createdAt)}
                  </time>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <Detail label="Address" value={request.address} />
                  <Detail label="Offer" value={request.offer} />
                  <Detail label="Vibe" value={request.vibe} />
                  <Detail label="Size" value={sizeLabel(request.size)} />
                  <Detail label="Response" value={responseSummary(request)} />
                  {request.notes ? <Detail label="Notes" value={request.notes} /> : null}
                </dl>
                {request.uploads.length > 0 && (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {request.uploads.map((upload) => (
                      <li key={upload.id} className="flex flex-col gap-1">
                        {/* Private blob bytes are streamed by the app. The browser does not open the blob URL. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/design-requests/${request.id}/${upload.key}`}
                          alt={uploadAlt(upload)}
                          className="aspect-[4/3] w-full rounded-lg bg-muted object-contain"
                        />
                        <span className="truncate text-xs text-muted-foreground">
                          {upload.role === "logo" ? "Logo" : "Image"} · {upload.fileName}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="leading-6">{value}</dd>
    </div>
  )
}

export function formatRequestDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso))
}

function sizeLabel(size: DesignRequest["size"]): string {
  if (size === "5x8") return "5×8"
  if (size === "6x9") return "6×9"
  return "No preference"
}

function responseSummary(request: DesignRequest): string {
  return request.responseMethods
    .map((method) => `${RESPONSE_METHOD_LABELS[method]}${detailFor(method, request)}`)
    .join(" · ")
}

function detailFor(method: ResponseMethod, request: DesignRequest): string {
  if (method === "qr" && request.qrUrl) return ` (${request.qrUrl})`
  if (method === "phone" && request.phone) return ` (${request.phone})`
  if (method === "website" && request.websiteUrl) return ` (${request.websiteUrl})`
  if (method === "other" && request.otherResponse) return ` (${request.otherResponse})`
  return ""
}

function uploadAlt(upload: DesignRequestUpload): string {
  return upload.role === "logo" ? `Logo, ${upload.fileName}` : `Image, ${upload.fileName}`
}
