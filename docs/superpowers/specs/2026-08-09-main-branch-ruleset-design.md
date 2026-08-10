# Main Branch Ruleset Design

## Purpose

Protect `main` from destructive or unreviewed changes while keeping contribution
friction appropriate for a small, pre-release open-source project. The policy
must preserve a pull-request and audit trail, including during an emergency
bypass.

## Scope

Create one active repository branch ruleset named `Protect main` in
`bhaveshchow20/generative-a11y`. Target the repository's default branch so the
protection follows a future default-branch rename. Do not create tag or push
rulesets, change workflow definitions, or change the repository's allowed merge
methods.

## Bypass Policy

Grant repository administrators bypass permission for pull requests only. An
administrator must still open a pull request, but may explicitly bypass reviews
or checks for an emergency security fix, a GitHub Actions outage, or recovery
from a misconfigured rule. Direct administrator pushes to `main` remain
prohibited.

Do not grant bypass permission to write or maintain roles, individual users,
Dependabot, or other GitHub Apps.

## Branch Integrity Rules

- Prevent deletion of the targeted branch.
- Block force pushes.
- Do not require linear history; the repository currently uses merge commits.
- Do not require signed commits because that would create avoidable contributor
  and bot friction at this stage.

## Pull Request Rules

Every ordinary update to `main` must use a pull request with:

- one approving review;
- stale approvals dismissed when reviewable commits change;
- all review conversations resolved before merge; and
- no requirement that someone other than the most recent pusher approve.

Code-owner approval is not required because the repository does not currently
have a `CODEOWNERS` file. A merge queue is not required because the project does
not yet have enough concurrent merge volume to justify it.

## Required Status Checks

Require the pull request branch to be up to date with `main`, and require these
existing check runs to pass:

| Check                               | Purpose                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `Quality`                           | Formatting, linting, type checking, coverage tests, build, and package validation         |
| `Node 22`                           | Test and build on the minimum supported Node.js release                                   |
| `Node 24`                           | Test and build on the newer supported Node.js release                                     |
| `Analyze JavaScript and TypeScript` | CodeQL security analysis                                                                  |
| `Dependency review`                 | Reject newly introduced dependencies with moderate-or-higher known vulnerabilities        |
| `Conventional title`                | Enforce the pull-request title convention used for project history and release automation |

Associate each required check with the GitHub Actions application to prevent an
unrelated status context from satisfying the requirement. Do not require the
Dependabot configuration check because it does not validate the proposed source
change and may not run consistently on every pull request.

## Rules Deliberately Omitted

- Deployments: the repository has no deployment environment.
- Merge queue: unnecessary at the current contribution volume.
- Code-owner review: no ownership map exists yet.
- Multiple approvals: a single-maintainer project needs a practical contributor
  path.
- Signed commits: the setup and rebasing cost outweighs the current benefit.
- Linear history: retaining merge commits matches existing project history.

## Rollout and Verification

Create the ruleset as active rather than evaluation-only because both recent
pull requests successfully produced all six required checks. After creation:

1. Read the ruleset back through GitHub's API and compare its target, bypass
   actor, enforcement mode, and rule parameters with this design.
2. Confirm GitHub reports `main` as protected.
3. Confirm the public rules page exposes the active rule.
4. Do not test with a destructive force push or branch deletion.

If a required check is renamed or removed, update the ruleset in the same change
as the workflow modification so pull requests do not become permanently blocked.

## Success Criteria

- Direct pushes, force pushes, and deletion of `main` are blocked for ordinary
  actors.
- Contributor pull requests require one current approval, resolved
  conversations, an up-to-date branch, and all six stable checks.
- Administrators can bypass only from a pull request, leaving a visible audit
  trail.
- Existing merge-commit behavior remains available.
