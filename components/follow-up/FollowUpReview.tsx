import { approveFollowUpAction, previewFollowUpAction } from "@/lib/follow-up/actions"
import type { Handoff } from "@/lib/follow-up/proposal"
import type { FollowUpProposal } from "@/lib/follow-up/proposal"

export function FollowUpReview(props: {
  campaignId: string
  proposal: FollowUpProposal | null
  handoff: Handoff | null
  notice: string
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Follow-up proposal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Suggested play: unsold estimates you already wrote, mailed only to people on a list you have permission to use.
          Importing and approving send nothing and charge nothing. Automated sending is not on. Neighbor lists and Every Door are not accepted.
        </p>
      </div>
      <form action={previewFollowUpAction.bind(null, props.campaignId)} className="flex flex-col gap-3 text-sm">
        <label className="flex gap-2">
          <input type="checkbox" name="play" value="yes" />
          I am choosing the unsold-estimate follow-up for this campaign. This is not a pilot approval.
        </label>
        <label>
          Cap
          <input name="cap" className="mt-1 w-full rounded-md border px-3 py-2" placeholder="You must enter a number" />
        </label>
        <label>
          Recent-contact window in days
          <input name="recentDays" className="mt-1 w-full rounded-md border px-3 py-2" placeholder="Enter 0 if you are not excluding recent contacts" />
        </label>
        <label>
          Exclude converted jobs
          <select name="excludeConverted" className="mt-1 w-full rounded-md border px-3 py-2" defaultValue="">
            <option value="">Choose</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label>
          Exclude opt-outs
          <select name="excludeOptOut" className="mt-1 w-full rounded-md border px-3 py-2" defaultValue="">
            <option value="">Choose</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="flex gap-2"><input type="checkbox" name="mailPermission" value="yes" /> I have permission to mail this first-party list.</label>
        <label className="flex gap-2"><input type="checkbox" name="photoPermission" value="yes" /> I have permission to use the job photos.</label>
        <label className="flex gap-2"><input type="checkbox" name="storyPermission" value="yes" /> I have permission to mention the customer story, or I will leave stories off.</label>
        <label>
          CSV
          <textarea name="csv" rows={6} className="mt-1 w-full rounded-md border p-3 font-mono" placeholder={"source,event id,status,last contact,permission,first,last,address,apt,city,state,zip"} />
        </label>
        <button type="submit" className="w-fit rounded-md border px-3 py-2">Preview who is included</button>
      </form>
      {props.notice ? <p className="text-sm">{props.notice}</p> : null}
      {props.proposal ? (
        <section className="text-sm">
          <h2 className="font-medium">Preview</h2>
          <p className="mt-1">{props.proposal.frozen.includedCount} included. Addresses are kept for this review and are not copied into history.</p>
          <ul className="mt-2 flex flex-col gap-1">
            {props.proposal.rows.map((row) => (
              <li key={`${row.externalId}-${row.decision}`}>
                {row.externalId}: {row.decision}. {row.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {props.handoff ? (
        <section className="text-sm">
          <h2 className="font-medium">Order review</h2>
          {props.handoff.ready ? (
            <p>The gates that are present are satisfied. Approving still does not send or charge.</p>
          ) : (
            <ul className="mt-1 list-disc pl-5">
              {props.handoff.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          )}
          <form action={approveFollowUpAction.bind(null, props.campaignId)} className="mt-3">
            <button type="submit" className="rounded-md border px-3 py-2" disabled={!props.handoff.ready}>
              Approve for later order review
            </button>
          </form>
        </section>
      ) : null}
      <p className="text-xs text-muted-foreground">
        No retention period is configured. Rows stay on this campaign until you delete the campaign data. They are not sent to a mail vendor from this page.
      </p>
    </div>
  )
}
