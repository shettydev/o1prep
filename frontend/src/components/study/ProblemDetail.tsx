import type { FullProblem } from "@/lib/types";
import { problemCode } from "@/lib/constants";
import { DifficultyBadge } from "@/components/ui";
import { Markdown } from "@/components/interview/Markdown";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-4">
      <div className="label mb-2">{title}</div>
      {children}
    </div>
  );
}

function MarkdownList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((c, i) => (
        <li key={i} className="flex gap-2 text-[13px] text-text-dim">
          <span className="text-amber-dim">▪</span>
          <span className="min-w-0">
            <Markdown>{c}</Markdown>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ProblemDetail({ problem }: { problem: FullProblem }) {
  return (
    <div className="space-y-5 p-5">
      <div>
        <div className="mb-2 flex items-center gap-2.5">
          <span className="text-[10px] tracking-wider text-text-faint">
            {problemCode(problem.id)}
          </span>
          <DifficultyBadge difficulty={problem.difficulty} />
        </div>
        <h1 className="font-display glow text-3xl text-amber">{problem.title}</h1>
      </div>

      {problem.scenario && (
        <Section title="Scenario">
          <Markdown>{problem.scenario}</Markdown>
        </Section>
      )}

      {problem.description && (
        <Section title="Problem">
          <Markdown>{problem.description}</Markdown>
        </Section>
      )}

      {problem.constraints && problem.constraints.length > 0 && (
        <Section title="Constraints">
          <MarkdownList items={problem.constraints} />
        </Section>
      )}

      {problem.examples && problem.examples.length > 0 && (
        <Section title="Examples">
          <div className="space-y-3">
            {problem.examples.map((ex, i) => (
              <div key={i} className="border border-line bg-bg-inset">
                <div className="label px-3 pt-2">input · example {i + 1}</div>
                <pre className="overflow-x-auto px-3 pb-2 text-[12px] text-text">
                  {(ex.input ?? "").trim()}
                </pre>
                <div className="label border-t border-line px-3 pt-2">output</div>
                <pre className="overflow-x-auto px-3 pb-2 text-[12px] text-green">
                  {(ex.output ?? "").trim()}
                </pre>
              </div>
            ))}
          </div>
        </Section>
      )}

      {problem.key_skills && problem.key_skills.length > 0 && (
        <Section title="Key Concepts">
          <div className="flex flex-wrap gap-1.5">
            {problem.key_skills.map((s) => (
              <span
                key={s}
                className="border border-line px-2 py-0.5 text-[11px] text-text-dim"
              >
                {s}
              </span>
            ))}
          </div>
        </Section>
      )}

      {problem.explanation && (
        <Section title="Explanation">
          <Markdown>{problem.explanation}</Markdown>
        </Section>
      )}

      {problem.references && problem.references.length > 0 && (
        <Section title="Learning Material">
          <MarkdownList items={problem.references} />
        </Section>
      )}

      {problem.follow_ups && problem.follow_ups.length > 0 && (
        <Section title="Follow-up Challenges">
          <MarkdownList items={problem.follow_ups} />
        </Section>
      )}
    </div>
  );
}
