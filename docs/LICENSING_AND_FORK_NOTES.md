# Licensing & Fork Notes

Reference doc for open-sourcing this project, which originated from an upstream
repository that was MIT-licensed at the time it was obtained and has since been
made closed-source by its original authors.

> ⚠️ **Not legal advice.** This is a practical checklist based on how MIT
> licensing works. For commercial or high-stakes use, get a short consult with
> an IP attorney.

---

## TL;DR

- **You can open-source this.** An MIT grant is **perpetual and irrevocable**
  for the code snapshot you obtained. The upstream going closed-source only
  affects *future* commits they release — it does **not** claw back what you
  already received under MIT.
- **The one real obligation: attribution.** You must retain the *original
  authors'* copyright notice + MIT text for the portions derived from their
  code. Removing it is the actual license violation — not the forking.
- **Renaming is good** and sidesteps trademark issues. MIT covers copyright,
  not the project name/logo/branding.

This is a well-established pattern: OpenTofu (← Terraform), Valkey (← Redis),
OpenSearch (← Elasticsearch) all started exactly this way.

---

## How MIT survives an upstream relicense

| Thing | Status for you |
|---|---|
| Code as it existed when you cloned it (MIT era) | ✅ Yours under MIT, forever |
| Your own modifications | ✅ Yours; license them as you like |
| Commits upstream made *after* relicensing | ❌ Not available under MIT |
| The original project's name / logo | ⚠️ Possible trademark — rename |

MIT explicitly grants the right to "use, copy, modify, merge, publish,
distribute, sublicense, and/or sell" — so redistributing your fork is squarely
permitted, **provided the copyright + permission notice travels with it.**

---

## ⚠️ Findings in THIS repo (action required)

1. **`LICENSE` credits only `Prathik Shetty`, not the original author.**
   If this code derives from an upstream MIT project, the original author's
   copyright line must be preserved. Replacing it with your name only does
   **not** satisfy the MIT attribution clause. → See checklist item 1.

2. **Git history starts at a squashed `init` commit (2026-06-05).**
   There is no in-repo record of the upstream provenance or the original MIT
   notice. Keep independent proof that the upstream was MIT at the time you
   obtained it (see checklist item 3).

---

## Pre-publish checklist

- [ ] **1. Restore original attribution in `LICENSE`.**
      Add the original author's copyright line back, then add yours below it:
      ```
      MIT License

      Copyright (c) <year> <Original Author>          ← upstream, restored
      Copyright (c) 2026 Prathik Shetty               ← your additions

      Permission is hereby granted, free of charge, ...
      ```
      (One MIT block can list multiple copyright holders.)

- [ ] **2. Add a `NOTICE` / attribution section to the README.**
      e.g. *"This project is a fork of [original-name] (MIT-licensed), with
      substantial modifications. Original copyright © <year> <author>."*

- [ ] **3. Preserve proof the snapshot was MIT.**
      Keep a copy of the upstream's original `LICENSE` and the commit hash /
      archived page (e.g. a Wayback Machine link) from when it was MIT. This is
      your evidence if provenance is ever questioned.

- [ ] **4. Confirm you pulled NO post-relicense commits.**
      Only MIT-era code is safe to redistribute. If unsure which commits
      predate the relicense, treat anything uncertain as off-limits.

- [ ] **5. Rename the project + strip upstream branding.**
      New name, no original logo, no wording that implies the original authors
      endorse or maintain your fork.

- [ ] **6. Check for embedded credentials before publishing.**
      `.env` exists in this repo — ensure it is gitignored and that no secrets
      are committed in history. (`.env.example` is fine to keep.)

- [ ] **7. Check transitive dependencies' licenses.**
      `requirements.txt` deps have their own licenses — make sure none are
      incompatible with redistribution.

- [ ] **8. Choose your fork's license.**
      MIT (simplest, keeps continuity) is the natural choice. You may license
      your *own additions* differently, but the upstream-derived parts remain
      bound by MIT's attribution terms.

---

## What you are NOT required to do

- ❌ You don't need the original authors' permission — the MIT grant already
  gave it.
- ❌ You don't have to keep their name as the project name.
- ❌ You don't have to open-source under MIT specifically (but the original
  files' MIT notice must stay regardless).

---

## Quick reference: the trademark vs. copyright split

- **Copyright** = the code itself → governed by MIT → you're covered.
- **Trademark** = the name, logo, brand identity → *not* covered by MIT →
  handled by renaming and removing branding.

Keeping these two separate is what makes a fork clean.
