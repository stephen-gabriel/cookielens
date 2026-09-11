import { BakeForm } from "@/components/bake/BakeForm";

export default function BakePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="mb-8 text-center text-3xl font-bold">Bake a Token</h1>
      <BakeForm />
    </main>
  );
}