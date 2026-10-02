# Issue tracker: GitHub

Issues and specs for this repo live in GitHub Issues at `andrey-krasheninnikov/want-wallpapers`. Run `gh` from this checkout.

## Operations

- Create: `gh issue create --title "..." --body-file <file>`.
- Read: `gh issue view <number> --comments`; fetch labels when needed.
- List: `gh issue list --state open --json number,title,body,labels` with suitable filters.
- Comment: `gh issue comment <number> --body-file <file>`.
- Label: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- Close: `gh issue close <number> --comment "..."`.

## Pull requests as a triage surface

**PRs as a request surface: no.** Change this to `yes` only if external pull requests should enter the triage queue.

## Skill conventions

"Publish to the issue tracker" means create a GitHub issue. "Fetch the relevant ticket" means read the GitHub issue and its comments.

## Wayfinding

- Keep each map in one issue labelled `wayfinder:map`; link child issues as sub-issues. If sub-issues are unavailable, use a task list in the map and add `Part of #<map>` to each child.
- Label children `wayfinder:<type>` where type is `research`, `prototype`, `grilling`, or `task`.
- Use GitHub issue dependencies for blockers. If unavailable, put `Blocked by: #<number>` at the top of the child issue.
- A child is ready when it is open, unassigned, and has no open blocker. Claim it with `gh issue edit <number> --add-assignee @me`.
