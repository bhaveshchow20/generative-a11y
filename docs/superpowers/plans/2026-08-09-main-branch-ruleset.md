# Main Branch Ruleset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and verify the approved active `Protect main` GitHub repository
ruleset.

**Architecture:** Apply one repository-level branch ruleset through GitHub's
REST API, targeting `~DEFAULT_BRANCH`. Keep the request payload in standard
input so no generated configuration file becomes repository state, then read the
created resource back and verify both its complete parameters and GitHub's
protected-branch view.

**Tech Stack:** GitHub REST API 2022-11-28, GitHub CLI (`gh`), `jq`, zsh

---

## File Structure

- No product or workflow files are created or modified.
- The live configuration is a GitHub repository ruleset named `Protect main`.
- This plan and its approved design note remain the repository documentation for
  the external configuration.

### Task 1: Preflight the Live Repository

**Files:**

- Reference: `docs/superpowers/specs/2026-08-09-main-branch-ruleset-design.md`
- Modify: none

- [ ] **Step 1: Confirm the authenticated repository and permission**

Run:

```bash
gh repo view bhaveshchow20/generative-a11y \
  --json nameWithOwner,defaultBranchRef,viewerPermission \
  --jq '{nameWithOwner, defaultBranch: .defaultBranchRef.name, viewerPermission}'
```

Expected: `nameWithOwner` is `bhaveshchow20/generative-a11y`, `defaultBranch` is
`main`, and `viewerPermission` is `ADMIN`.

- [ ] **Step 2: Confirm that no competing ruleset was added after design
      approval**

Run:

```bash
gh api --method GET repos/bhaveshchow20/generative-a11y/rulesets \
  --jq 'map({id, name, target, enforcement})'
```

Expected: `[]`. If a ruleset now targets the default branch, stop and reconcile
it instead of layering a duplicate rule.

- [ ] **Step 3: Confirm all required contexts recently came from GitHub
      Actions**

Run:

```bash
gh api repos/bhaveshchow20/generative-a11y/commits/08d38bb5d20e8221fd360aa90fc1bf8576f70365/check-runs \
  --jq '[.check_runs[] | select(.name == "Quality" or .name == "Node 22" or .name == "Node 24" or .name == "Analyze JavaScript and TypeScript" or .name == "Dependency review" or .name == "Conventional title") | {name, app_id: .app.id}] | unique_by(.name) | sort_by(.name)'
```

Expected: six unique contexts, each with `app_id` `15368`.

### Task 2: Create the Active Ruleset

**Files:**

- Modify: none

- [ ] **Step 1: Submit the exact approved ruleset**

Run:

```bash
gh api --method POST repos/bhaveshchow20/generative-a11y/rulesets \
  --input - \
  --jq '{id, name, target, enforcement, url: ._links.html.href}' <<'JSON'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [
    {
      "actor_id": 5,
      "actor_type": "RepositoryRole",
      "bypass_mode": "pull_request"
    }
  ],
  "conditions": {
    "ref_name": {
      "include": ["~DEFAULT_BRANCH"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["merge", "squash", "rebase"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          {"context": "Quality", "integration_id": 15368},
          {"context": "Node 22", "integration_id": 15368},
          {"context": "Node 24", "integration_id": 15368},
          {"context": "Analyze JavaScript and TypeScript", "integration_id": 15368},
          {"context": "Dependency review", "integration_id": 15368},
          {"context": "Conventional title", "integration_id": 15368}
        ]
      }
    }
  ]
}
JSON
```

Expected: HTTP success and a JSON object whose `name` is `Protect main`,
`target` is `branch`, and `enforcement` is `active`. Record the returned numeric
`id`; it is the recovery target if verification fails.

- [ ] **Step 2: Stop safely if GitHub rejects the request**

Do not retry with reduced protections. Read the API validation response, correct
only a schema mismatch while preserving every approved semantic requirement, and
resubmit once. If the API created a resource despite a client interruption,
discover it by name before retrying:

```bash
gh api repos/bhaveshchow20/generative-a11y/rulesets \
  --jq '.[] | select(.name == "Protect main") | {id, name, enforcement}'
```

Expected after a successful creation: exactly one matching active ruleset.

### Task 3: Verify the Effective Protection

**Files:**

- Modify: none

- [ ] **Step 1: Read the complete ruleset back**

Run:

```bash
ruleset_id="$(gh api repos/bhaveshchow20/generative-a11y/rulesets --jq '.[] | select(.name == "Protect main") | .id')"
test -n "$ruleset_id"
protect_main_ruleset="$(gh api "repos/bhaveshchow20/generative-a11y/rulesets/$ruleset_id")"
jq '{name, target, enforcement, bypass_actors, conditions, rules}' <<<"$protect_main_ruleset"
```

Expected: the response exactly reflects the target, PR-only
repository-administrator bypass, and four rules from Task 2.

- [ ] **Step 2: Assert the critical rules mechanically**

Run:

```bash
jq -e '
  .name == "Protect main" and
  .target == "branch" and
  .enforcement == "active" and
  (.conditions.ref_name == {include: ["~DEFAULT_BRANCH"], exclude: []}) and
  (.bypass_actors == [{actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "pull_request"}]) and
  ((.rules | map(.type) | sort) == (["deletion", "non_fast_forward", "pull_request", "required_status_checks"] | sort)) and
  (.rules | any(
    .type == "pull_request" and
    .parameters.required_approving_review_count == 1 and
    .parameters.dismiss_stale_reviews_on_push == true and
    .parameters.required_review_thread_resolution == true and
    .parameters.require_code_owner_review == false and
    .parameters.require_last_push_approval == false and
    ((.parameters.allowed_merge_methods | sort) == (["merge", "squash", "rebase"] | sort))
  )) and
  (.rules | any(
    .type == "required_status_checks" and
    .parameters.strict_required_status_checks_policy == true and
    .parameters.do_not_enforce_on_create == false and
    ((.parameters.required_status_checks | map(.context) | sort) == (["Quality", "Node 22", "Node 24", "Analyze JavaScript and TypeScript", "Dependency review", "Conventional title"] | sort)) and
    (.parameters.required_status_checks | all(.integration_id == 15368))
  ))
' <<<"$protect_main_ruleset"
```

Expected: exit status `0` and output `true`.

- [ ] **Step 3: Confirm GitHub reports the default branch as protected**

Run:

```bash
gh api repos/bhaveshchow20/generative-a11y/branches/main \
  --jq '{name, protected, protection_url}'
```

Expected: `name` is `main` and `protected` is `true`.

- [ ] **Step 4: Confirm the public rule is discoverable**

Run:

```bash
gh api repos/bhaveshchow20/generative-a11y/rules/branches/main \
  --jq 'map(.type)'
```

Expected: the effective rule types include `deletion`, `non_fast_forward`,
`pull_request`, and `required_status_checks`.

- [ ] **Step 5: Handle a verification mismatch without weakening protection**

If any assertion fails, preserve the response in the terminal transcript and
disable the new ruleset while diagnosing rather than deleting it:

```bash
gh api --method PUT \
  "repos/bhaveshchow20/generative-a11y/rulesets/$ruleset_id" \
  -f enforcement=disabled \
  --jq '{id, name, enforcement}'
```

Expected recovery output: the same ruleset ID and name with `enforcement` equal
to `disabled`. Do not run this recovery command when all verification steps
pass.

- [ ] **Step 6: Report the result**

Report the ruleset ID, public rules URL, enforced checks, bypass scope, and
verification outcomes. Explicitly state that no destructive force-push or
deletion test was performed.
