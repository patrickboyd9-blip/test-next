import { AddressBook } from "@/components/address-book/AddressBook"
import { CockpitFrame, Eyebrow } from "@/components/cockpit/ui"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { listAddressLists, readAddressEntries } from "@/lib/address-book/store"
import { getSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export default async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>
}) {
  const session = await getSession()
  const { list } = await searchParams
  const lists = session ? await listAddressLists(session.userId) : []
  const selected = lists.find((item) => item.id === list) ?? lists[0] ?? null
  const entries = session && selected ? await readAddressEntries(session.userId, selected.id) : []

  return (
    <CockpitFrame>
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-[#e7f2fb]" />
          <Eyebrow>Lists</Eyebrow>
        </div>
        <div>
          <h1 className="text-3xl font-semibold">Who are you mailing?</h1>
          <p className="mt-2 text-sm text-[#b7c9d8]">
            Save the people you already do business with. Use a list again on the next mailer. Nothing is mailed from here.
          </p>
        </div>
        {session ? (
          <AddressBook tone="cockpit" lists={lists} selectedId={selected?.id ?? null} entries={entries} />
        ) : (
          <p className="text-sm text-[#b7c9d8]">Sign in to see the addresses on this account.</p>
        )}
      </div>
    </CockpitFrame>
  )
}
