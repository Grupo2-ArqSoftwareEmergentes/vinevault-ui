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

### Space-wide alerts

Alerts use `GET /api/v1/alerts?space_id={id}&active_only=false`, not a per-device fan-out or the selected cellar. One immediate read and 15-second polling supply both Active (status `ACTIVE`) and History (all incidents, including active). Space/role changes cancel old subscriptions; switching cellars does not narrow the directory. Request failures show an error, retain the last successful snapshot, and recover on a later poll rather than pretending there are no incidents.

Core evaluates configured, enabled thresholds for assignments without requiring a cellar. Incidents are isolated by assignment and space; current device membership must match before listing them. The API enriches rows with current `device_name`, `serial_number`, nullable `cellar_id` and `cellar_name` using a batch cellar lookup. Moving/renaming a cellar updates existing incident labels on the next query. The per-device endpoint remains available and tenant-isolated.

Compact cards show cellar/status pills, device identity, a reason derived from metric/direction/status in the live ES/EN language, inline threshold/reading and timestamps, and Open device with an explicit space link. User-owned names are never translated. Numbers use locale formatting with at most one decimal and `%`/`°C`; API Decimal strings retain precision without redundant trailing zeroes. API messages honor `Accept-Language`; persisted/outbox messages remain canonical English for existing consumers. No schema or Edge topic changes are required.

### Device directory versus cellar binding

Device list/detail/status resources now map Core's optional `is_online` to `isOnline`. Core owns the 5-minute UTC inactivity window and manual-power policy; the UI does not infer online from RSSI, SSID, or a green Wi-Fi icon. Grid/list badges and detail badge/power controls share `device-connection.ts`. Older Core responses fall back to `status`; explicit STANDBY/MAINTENANCE/DECOMMISSIONED remain blocked. Signal-quality color is separate: -88 dBm can be weak while the device is online. Legacy naive Core timestamps are interpreted as UTC, not browser-local time.

The directory GET repeats every 60 seconds without resetting the selected view, hiding the current rows or restarting the telemetry watcher for unchanged device IDs. Detail status refresh remains 10 seconds (2 seconds temporarily after power commands). Transient read failures do not terminate either timer. Space changes and destruction unsubscribe timers and in-flight reads; manual commands are never automatically retried.

The Devices page is the **space device directory**, matching Edit cellar's sensor picker: `GET /api/v1/devices?space_id=...&page=0&size=100`. It includes assigned sensors even when OFFLINE or not linked to any cellar. A Topbar cellar selection must not replace this GET with the cellar's optional `device_id`; that binding is for cellar monitoring/Overview, not device registration. Changing spaces/authorization cancels stale reads; switching cellars within one space does not filter this directory.

Device GET/list and claim responses include nullable `cellar_id`/`cellar_name`, mapped to `cellarId`/`cellarName`. Cards and list rows display that cellar name in the top pill (`Sin cava`/`No cellar` when absent), and the device's current `name` below it. They do not substitute the serial or `factory_name` for the name. Cellar names and device names are user data and remain untranslated.

The cellar pill is now a 44px-minimum native button with a chevron, focus/hover states and a device-specific accessible label. It emits its own event and stops propagation; it never opens device detail. Read-only roles see a disabled pill. The redundant connection badge beside the name is removed from grid/list only: power-icon color, accessible status label and tooltip still use the shared server-evaluated connection state. The detail badge remains unchanged.

Quick assignment opens `DeviceCellarDialogComponent`, fetches the current device association and current-space cellar directory, and saves immediately when choosing an available cellar or `Sin cava`. Occupied foreign-device cellars are disabled, own current cellar stays selectable, and foreign-space options are filtered out. A successful **single PUT** `/api/v1/devices/{id}/cellar` refreshes the list in place (preserving view and trigger focus), clears cellar detail caches via context refresh, and shows a global toast. Cancel/failure never shows success or changes rows; failures stay in the dialog with manual Retry, and no mutation is automatically retried. Scope changes close the dialog and cancel reads/writes. Core performs move/unlink in one transaction, so a conflict cannot clear the old link first.

The hardware modal receives the captured active `spaceId` and fetches its current cellars. Its optional native select defaults to no association; occupied cellars are visible but disabled, and foreign-space responses/IDs are rejected locally. A load error offers Retry without losing the hardware draft; leaving the optional selection empty remains valid. Space/authorization changes close the modal and cancel its reads. `POST /devices/claim` sends `cellar_id` only when selected: Core validates and commits space claim + cellar binding atomically. Only success refreshes the device GET, clears cached cellar details through context refresh, and shows confirmation. No third linking POST or automatic mutation retry is needed. Null/omitted cellar IDs retain the previous space-only contract.

The add-sensor modal pairs hardware (`POST /devices/pair`) then claims it into the captured space (`POST /devices/claim` with `claim_token` and `space_id`). Only confirmed claim success triggers the success toast and a fresh space directory GET. Cancellation, missing tokens and failures do not trigger a successful refresh; errors are handled without automatic mutation retries. The entire flow, including the open modal, stops when the space/authorization changes. Duplicate opens are blocked while the flow is active. Grid and List share the refreshed `devicesPage`; remount/reload fetches the same server-owned association.

Core stores this relationship in `device_assignments.space_id`, not `devices` or the cellar. The claim repository commits before response; the list endpoint reads that same assignment table. `tests/test_device_space_assignment.py` in Core verifies immediate and subsequent GETs with independent DB sessions, absence of a cellar link, OFFLINE visibility, cellar linking, and cross-account isolation in disposable PostgreSQL schemas. No backend schema/endpoint change is needed for the frontend filtering bug.

`WorkspaceScopeService` invalidates its AbortController when the selected space or its authorization changes. The HTTP interceptor unsubscribes scoped requests, aborting Angular's HTTP transport; the POST/SSE client aborts its fetch. Global context, authentication, and first-space creation requests are excluded. Cancelled mutations are never automatically retried.

Cellar detail cache keys include the space ID. Context/account changes invalidate cached detail; inventory caches are discarded on space changes and logout. Late inventory responses cannot populate a different space's cache.

401 clears credentials, workspace state and caches and routes to login. 403 resets selection and refreshes membership once (never recursively for a forbidden context endpoint). 404/409/422 preserve readable resource/conflict/validation messages.

The subscription page is read-only backend state. No space billing or membership mutation endpoints were provided, so the former user-level payment/delegation simulation is not connected to this page.
