---
name: review-and-commit
description: >-
  Reviews uncommitted and staged project changes for quality, safety, and scope,
  then creates git commits when the user approves. Use when the user asks to
  review the project, review before commit, prepare or write a commit, commit
  changes, or run a review-and-commit workflow.
---

# Review and Commit

End-to-end workflow: inspect the repo, report findings, then commit only after explicit approval.

## Hard rules

- **Review first, commit second.** Never commit until the user approves the review summary (or explicitly says to skip review and commit now).
- **No commit without a request.** If the user only asked to review, stop after the review. Commit only when they ask to commit or approve committing.
- **Never** update git config, use destructive git commands (`reset --hard`, `clean -fdx`, force-push to `main`/`master`), or skip hooks (`--no-verify`) unless the user explicitly requests it.
- **Never** commit `.env`, credentials, keys, or other secret-bearing files. Warn if they are staged or would be included.
- **No `git add .` / `git add -A`** unless the user explicitly requests staging everything.
- **Do not push** unless the user explicitly asks.

## Phase 1: Gather state

Run in **parallel**:

```bash
git status
git diff
git diff --staged
git log -5 --oneline
```

If the branch tracks a remote, also check whether it is ahead/behind. For larger changes, use `git diff [default-branch]...HEAD` when helpful.

If there are no changes to commit (clean tree, nothing untracked that matters), say so and stop.

## Phase 2: Review

Evaluate **all** changes that would be committed (staged + unstaged the user intends to include). Check:

| Area | Look for |
|------|----------|
| **Scope** | Changes match stated intent; no unrelated drive-by edits |
| **Correctness** | Obvious bugs, broken imports, dead code, wrong types |
| **Security** | Secrets in diff, unsafe defaults, missing auth on new routes |
| **Data / infra** | Migrations applied or documented; schema and client in sync |
| **Dependencies** | New packages justified; lockfile updated if needed |
| **Tests** | Meaningful coverage for behavior changes (run tests if the project has them) |
| **Style** | Matches existing project conventions |

Match commit message tone to recent `git log` on this repo.

### Review output format

```markdown
## Review summary

**Scope:** [1 sentence — what this change set does]

### Findings
- 🔴 **Blocker:** … (must fix before commit)
- 🟡 **Suggestion:** …
- 🟢 **Note:** …

### Proposed commit
- **Files to stage:** [list paths, or "already staged"]
- **Message:**
  ```
  subject line

  optional body — why, not a file list
  ```

**Ready to commit?** [yes / no — and why]
```

If there are 🔴 blockers, fix them (with user approval for code changes) or ask how to proceed before committing.

## Phase 3: Commit

Proceed only when:
1. User approved the review (or asked to commit with no blockers), and
2. There are changes to commit.

**Sequential steps:**

1. Stage only the agreed paths: `git add <path> …`
2. Commit with a HEREDOC (1–2 sentences, focus on **why**):

```bash
git commit -m "$(cat <<'EOF'
Short subject summarizing the change.

Optional body explaining intent or context.
EOF
)"
```

3. Verify: `git status`

### Amend rules

Use `git commit --amend` only when **all** are true:
- User explicitly requested amend, **or** a hook auto-modified files after a successful commit you just made
- HEAD was created in this conversation (`git log -1 --format='%an %ae'`)
- Commit has **not** been pushed (branch not ahead of remote only because of unpushed commits)

If a commit **failed** or was **rejected by a hook**, fix the issue and make a **new** commit — never amend.

## Phase 4: After commit

Report:
- Commit hash and subject (`git log -1 --oneline`)
- Remaining unstaged/untracked files, if any
- Whether push was **not** done (unless user asked to push)

## Quick examples

**User:** "Review my changes"
→ Phases 1–2 only; end with approval question.

**User:** "Review and commit"
→ Phases 1–2, then Phase 3 if no blockers and user confirms (or they already said commit in the same message).

**User:** "Commit with message X"
→ Still run Phase 1; skip lengthy review only if the tree is trivial; never skip secret/staging checks.
