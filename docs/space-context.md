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

### Device directory versus cellar binding

Device list/detail/status resources now map Core's optional `is_online` to `isOnline`. Core owns the 5-minute UTC inactivity window and manual-power policy; the UI does not infer online from RSSI, SSID, or a green Wi-Fi icon. Grid/list badges and detail badge/power controls share `device-connection.ts`. Older Core responses fall back to `status`; explicit STANDBY/MAINTENANCE/DECOMMISSIONED remain blocked. Signal-quality color is separate: -88 dBm can be weak while the device is online. Legacy naive Core timestamps are interpreted as UTC, not browser-local time.

The directory GET repeats every 60 seconds without resetting the selected view, hiding the current rows or restarting the telemetry watcher for unchanged device IDs. Detail status refresh remains 10 seconds (2 seconds temporarily after power commands). Transient read failures do not terminate either timer. Space changes and destruction unsubscribe timers and in-flight reads; manual commands are never automatically retried.

The Devices page is the **space device directory**, matching Edit cellar's sensor picker: `GET /api/v1/devices?space_id=...&page=0&size=100`. It includes assigned sensors even when OFFLINE or not linked to any cellar. A Topbar cellar selection must not replace this GET with the cellar's optional `device_id`; that binding is for cellar monitoring/Overview, not device registration. Changing spaces/authorization cancels stale reads; switching cellars within one space does not filter this directory.

The add-sensor modal pairs hardware (`POST /devices/pair`) then claims it into the captured space (`POST /devices/claim` with `claim_token` and `space_id`). Only confirmed claim success triggers the success toast and a fresh space directory GET. Cancellation, missing tokens and failures do not trigger a successful refresh; errors are handled without automatic mutation retries. The entire flow, including the open modal, stops when the space/authorization changes. Duplicate opens are blocked while the flow is active. Grid and List share the refreshed `devicesPage`; remount/reload fetches the same server-owned association.

Core stores this relationship in `device_assignments.space_id`, not `devices` or the cellar. The claim repository commits before response; the list endpoint reads that same assignment table. `tests/test_device_space_assignment.py` in Core verifies immediate and subsequent GETs with independent DB sessions, absence of a cellar link, OFFLINE visibility, cellar linking, and cross-account isolation in disposable PostgreSQL schemas. No backend schema/endpoint change is needed for the frontend filtering bug.

`WorkspaceScopeService` invalidates its AbortController when the selected space or its authorization changes. The HTTP interceptor unsubscribes scoped requests, aborting Angular's HTTP transport; the POST/SSE client aborts its fetch. Global context, authentication, and first-space creation requests are excluded. Cancelled mutations are never automatically retried.

Cellar detail cache keys include the space ID. Context/account changes invalidate cached detail; inventory caches are discarded on space changes and logout. Late inventory responses cannot populate a different space's cache.

401 clears credentials, workspace state and caches and routes to login. 403 resets selection and refreshes membership once (never recursively for a forbidden context endpoint). 404/409/422 preserve readable resource/conflict/validation messages.

The subscription page is read-only backend state. No space billing or membership mutation endpoints were provided, so the former user-level payment/delegation simulation is not connected to this page.
