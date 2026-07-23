const stars = Array.from({ length: 75 });
export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-gradient-to-b from-slate-950 via-black to-slate-900 font-sans">
      <main className="relative max-w-4xl text-center px-6">
      <div className="absolute left-1/2 top-1/2 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20 blur-3xl"></div>
  <h1 className="text-7xl font-bold">
    Direct Mail, Reimagined.
  </h1>

  <p className="mt-6 text-xl text-gray-400">
    A modern platform for launching, tracking, and optimizing direct mail campaigns.
  </p>

  <button className="mt-10 rounded-full bg-blue-500 px-8 py-4 text-white font-semibold">
    Get Started
  </button>
  <div>
  {stars.map((star) => (
    <span
  style={{
    position: "absolute",
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
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