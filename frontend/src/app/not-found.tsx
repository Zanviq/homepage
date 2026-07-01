import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center px-5 text-center">
      <div>
        <p className="font-mono text-sm uppercase tracking-widest text-tangerine">404</p>
        <h1 className="mt-4 font-display text-6xl font-semibold">Lost in the garden</h1>
        <p className="mt-4 text-ink-soft">이 페이지는 존재하지 않습니다. / This page doesn&apos;t exist.</p>
        <Link
          href="/"
          className="mt-8 inline-block border-2 border-ink bg-ink px-6 py-3 font-mono text-sm uppercase tracking-widest text-paper shadow-[4px_4px_0_0_var(--leaf-deep)] transition-transform hover:-translate-y-0.5"
        >
          ← Home
        </Link>
      </div>
    </div>
  );
}
