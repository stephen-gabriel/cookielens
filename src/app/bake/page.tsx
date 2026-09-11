import Link from "next/link";

export default function BakePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">Bake a Token</h1>
      <p className="mt-3 text-text-secondary">
        Token creation form coming in Phase 3. Check back soon.
      </p>
      <Link href="/" className="mt-6 inline-block text-primary underline">
        Back to Explore
      </Link>
    </main>
  );
}