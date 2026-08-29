import Link from "next/link";

const stars = Array.from({ length: 75 }, (_, index) => ({
  id: index,
  left: (index * 37) % 100,
  top: (index * 53) % 100,
}));
export default function Home() {
  return (

    <div className="flex flex-col flex-1 items-center justify-center bg-gradient-to-b from-slate-950 via-black to-slate-900 font-sans">
      <main className="relative max-w-4xl text-center px-6">
      <div className="absolute left-1/2 top-1/2 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20 blur-3xl"></div>
      <div className="mb-10 mx-auto flex h-52 w-80 items-center justify-center rounded-lg border border-white bg-white float">
      <div className="w-full h-full p-6 flex flex-col justify-between text-gray-700">
  <div className="text-sm font-semibold tracking-widest">
    MODERN MAIL
  </div>

  <div className="text-2xl font-bold text-center">
    ✉️
  </div>

  <div className="text-right text-xs">
    POSTCARD
   </div>
  </div>
</div>
  <h1 className="text-7xl font-bold">
    Direct Mail, Reimagined.
  </h1>

  <p className="mt-6 text-xl text-gray-400">
    A modern platform for launching, tracking, and optimizing direct mail campaigns.
  </p>
  <Link href="/app/campaigns/new" className="mt-10 rounded-full bg-blue-500 px-8 py-4 text-white font-semibold hover:scale-105 transition hover:bg-blue-400 hover:shadow-2xl">
Get Started
  </Link>
  <div>
  {stars.map((star) => (
    <span
  key={star.id}
  style={{
    position: "absolute",
    left: `${star.left}%`,
    top: `${star.top}%`,
  }}
>
  ✦
</span>
  ))}
</div>
</main>
    </div>
  );
}