import Link from "next/link";

export default function ExplorePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">Explore</h1>
      <p className="mt-3 text-text-secondary">
        No cookies baked yet — be the first!
      </p>
      <Link href="/bake" className="mt-6 inline-block text-primary underline">
        Bake the first token
      </Link>
    </main>
  );
}