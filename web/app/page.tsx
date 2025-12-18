import Link from "next/link";
export default function Home() {
  return (
    <div className="grid gap-6">
      <h1 className="text-4xl font-semibold">Free background remover</h1>
      <p className="text-neutral-700 max-w-2xl">
        Upload an image and download a transparent PNG. No watermark.
      </p>
      <Link className="inline-flex w-fit rounded-xl bg-neutral-900 px-5 py-3 text-white" href="/remove-background">
        Open the tool
      </Link>
    </div>
  );
}
