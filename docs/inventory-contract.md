# Inventory and movements

Collector and Business share the same inventory resources and endpoints. The domain uses `name`; the REST reader falls back to `name ?? wine_name`. Nullable detail fields and decimal strings are mapped in `wine-details.transform.ts`. Vintage is never inferred from legacy age.

The form schema controls which detail groups are visible for the space purpose. Hidden fields are retained in the initial item and excluded from submission. Editing compares normalized values and sends only changes with PATCH; explicit null clears an optional field. `0`, `false` and `[]` are not null. Creation always includes name and quantity. Aroma tags are individual strings, not CSV. Ratings are points (1–100), tasting scales are 0–5, dates are ISO calendar dates and decimals use up to two decimal places without converting to floats in the payload.

Movements use a single non-retried POST, with no author field and no secondary quantity update. The returned `stock_after` updates the row, including zero-stock rows. The dialog locks submission and dismissal while pending and does not permit blindly resubmitting a failed/uncertain POST. Use history (GET, limit 100) and Refresh stock to reconcile before deliberately recording another exit. A cancelled HTTP mutation may already have committed server-side; cancellation does not imply rollback.

OWNER, SOMMELIER and INVENTORY_CLERK can record movements; WAITER can only read history. Permissions are rechecked on submit against the current space. The backend remains authoritative. Delete confirmations for items, cellars and spaces warn about permanent loss of movement history.
