/**
 * Commit message standard: Conventional Commits with a required, validated scope.
 * Enforced on every commit via the .husky/commit-msg hook.
 *
 *   type(scope): subject
 *   e.g.  feat(frontend): persist study chat width
 *
 * Multi-area commits may list several scopes:  refactor(frontend,backend): ...
 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Allowed types — config-conventional defaults plus the repo's own "polish".
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "refactor",
        "chore",
        "docs",
        "ci",
        "perf",
        "test",
        "build",
        "style",
        "revert",
        "polish",
      ],
    ],
    // Scope is required and must come from this list.
    "scope-empty": [2, "never"],
    "scope-enum": [
      2,
      "always",
      [
        "frontend", // Next.js app
        "backend", // Flask app / API / services
        "problems", // problem content, variants, generators
        "db", // migrations, schema, Postgres
        "ci", // GitHub Actions / pipelines
        "docs", // README, docs/, markdown
        "deps", // dependency bumps
        "repo", // root tooling, monorepo-wide changes
      ],
    ],
    // Practical subject rules: required, no trailing period, no hard length cap.
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [0],
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};
