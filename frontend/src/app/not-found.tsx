import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="font-display glow-strong text-5xl text-amber">404</div>
      <div className="w-full max-w-md border border-line bg-bg-raised p-5 text-left">
        <pre className="text-[13px] leading-relaxed text-text-dim">
{`$ cd ./requested-route
  bash: no such file or directory`}
          <span className="cursor" />
        </pre>
      </div>
      <Link href="/" className="tbtn tbtn-amber">
        ← back to problems
      </Link>
    </main>
  );
}
