import Link from "next/link";
import { problemCode } from "@/lib/constants";

/**
 * Placeholder for routes not yet rebuilt (study = Phase 5, interview = Phase 3).
 * Styled to match the terminal aesthetic so navigation feels intentional, not broken.
 */
export function ComingSoon({ module, id }: { module: string; id: number }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="font-display glow-strong text-5xl text-amber">O(1)_PREP</div>
      <div className="w-full max-w-md border border-line bg-bg-raised p-6 text-left">
        <div className="label mb-3">module status</div>
        <pre className="text-[13px] leading-relaxed text-text-dim">
{`> mount ${module} --problem ${problemCode(id)}
  ${module}: not yet online
  status: scheduled for an upcoming phase`}
          <span className="cursor" />
        </pre>
      </div>
      <Link href="/" className="tbtn tbtn-amber">
        ← back to problems
      </Link>
    </main>
  );
}
