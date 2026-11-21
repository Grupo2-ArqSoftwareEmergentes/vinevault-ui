# Space-scoped frontend context

`GET /api/v1/user/context` is the membership directory, including shared spaces. The owner-only legacy listing must not be used to filter this directory. User profiles and JWTs supply identity/authentication only, never the active space's role or subscription.

- Resource fields: `space_type` (`COLLECTOR`/`BUSINESS`), `subscription_plan` (`FREE`/`PRO`/`BUSINESS`), `subscription_status` (`ACTIVE`/`EXPIRED`), and `role`.
- `WorkspaceContextService` maps these into the selected `WorkspaceSpace`; `WorkspaceAccessService` derives all visible permissions and subscription indicators from it. Missing roles deny actions, including legacy partial summaries.
- Both space creation and onboarding consume the included `default_wine_cellar`. No second cellar POST is sent. The first-space onboarding route waits for context before allowing submission and disables duplicate submission.

## Entry flow

Public signup starts at `/onboarding/intent`, then `/register`. Only the purpose and a recovery email marker are kept in sessionStorage, never passwords. Registration automatically signs in, loads membership context, and invokes `/user/onboarding` only when no space exists; the user then goes straight to the selected cellar's inventory. Login can resume a failed setup for the same registered email.

The present `/iam/register` contract creates only a user and does not accept `space_type`. Consequently account registration and space creation are separate backend transactions, despite being a single uninterrupted UX. `/user/onboarding` creates the space and default cellar atomically. An atomic transaction spanning the account as well requires a backend contract change. Manual recovery re-reads context and never repeats a known committed account registration or creates a second cellar.

## Roles

| Permission | OWNER | SOMMELIER | INVENTORY_CLERK | WAITER |
| --- | --- | --- | --- | --- |
| Read | Yes | Yes | Yes | Yes |
| Configure cellars/devices | Yes | Yes | No | No |
| Edit/import inventory, analyze | Yes | Yes | Yes | No |
| Rename/delete space | Yes | No | No | No |

`appCan` controls visibility; action handlers also guard mutations. These are UX restrictions, not a substitute for backend authorization. Plan expiry is displayed without inventing limits or converting an expired plan into Free.

## Lifetimes and errors

`WorkspaceScopeService` invalidates its AbortController when the selected space or its authorization changes. The HTTP interceptor unsubscribes scoped requests, aborting Angular's HTTP transport; the POST/SSE client aborts its fetch. Global context, authentication, and first-space creation requests are excluded. Cancelled mutations are never automatically retried.

Cellar detail cache keys include the space ID. Context/account changes invalidate cached detail; inventory caches are discarded on space changes and logout. Late inventory responses cannot populate a different space's cache.

401 clears credentials, workspace state and caches and routes to login. 403 resets selection and refreshes membership once (never recursively for a forbidden context endpoint). 404/409/422 preserve readable resource/conflict/validation messages.

The subscription page is read-only backend state. No space billing or membership mutation endpoints were provided, so the former user-level payment/delegation simulation is not connected to this page.
