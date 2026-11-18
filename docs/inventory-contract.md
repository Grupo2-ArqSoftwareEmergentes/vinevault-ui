# Inventory and movements

Collector and Business share the same inventory resources and endpoints. The domain uses `name`; the REST reader falls back to `name ?? wine_name`. Nullable detail fields and decimal strings are mapped in `wine-details.transform.ts`. Vintage is never inferred from legacy age.

The form schema controls which detail groups are visible for the space purpose. Hidden fields are retained in the initial item and excluded from submission. Editing compares normalized values and sends only changes with PATCH; explicit null clears an optional field. `0`, `false` and `[]` are not null. Creation always includes name and quantity. Aroma tags are individual strings, not CSV. Ratings are points (1–100), tasting scales are 0–5, dates are ISO calendar dates and decimals use up to two decimal places without converting to floats in the payload.

## Full-page editor

`/inventory/new` and `/inventory/edit/:id` share `WineEditorPageComponent` and `WineInventoryFormModel`. The alternate `/inventory/:id/edit` URL redirects to the canonical edit route. Links include `spaceId` and `wineCellarId`, so refreshing an edit URL reloads the item from its cellar's inventory without depending on navigation state.

Four connected folder tabs share one form: Identificación (five identity/stock fields), Costo y origen (three Collector or five Business fields), Ficha enológica, and Cata. Hidden tab panels retain controls and draft values; optional-data dots count only visible fields, including zero/false. Panels use natural height without an internal scroll region; on short screens the page scrolls and the action footer is sticky. Invalid submission selects and focuses the first invalid field's tab, prioritizing required identification fields. Labels are Spanish; inline × explicitly clears a field to null.

Cata uses optional `tastingNotes` → `tasting_notes` (Notas de cata, max 4000 characters), `companyNotes` (Notas internas, max 4000) and nullable `wouldBuyAgain` in both purposes. `occasionNotes` is independent: it remains Notas previas for Collector / Argumento de venta rápido for Business; old notes are never copied to the new field. Legacy rating, body/acidity/tannin sliders and aroma tags remain REST-compatible and retained in the model, but are hidden, not validated and never automatically submitted or cleared by this editor. Omitted PATCH fields preserve server values; explicit null clears, while false remains a boolean false.

Consumption year bounds serialize into the existing `consumption_window` string (`2026 – 2030`); legacy free text remains unchanged until edited. Legacy age remains readable but is not edited or used to infer vintage.

Creation follows the active Topbar context and preserves the draft across purpose changes. Editing binds the original space/cellar and blocks saves in a different context until the user returns. Context changes cancel in-flight loads/saves; an interrupted save cannot be repeated blindly. Submit and return/cancel are locked during saving. Success routes back to the contextual `/inventory`, mounting a new inventory panel and fetching its current list.

Movements use a single non-retried POST, with no author field and no secondary quantity update. The returned `stock_after` updates the row, including zero-stock rows. The dialog locks submission and dismissal while pending and does not permit blindly resubmitting a failed/uncertain POST. Use history (GET, limit 100) and Refresh stock to reconcile before deliberately recording another exit. A cancelled HTTP mutation may already have committed server-side; cancellation does not imply rollback.

OWNER, SOMMELIER and INVENTORY_CLERK can record movements; WAITER can only read history. Permissions are rechecked on submit against the current space. The backend remains authoritative. Delete confirmations for items, cellars and spaces warn about permanent loss of movement history.

## Quotas

`/user/context` supplies global `account_quota` and each space's `quotas`/`extra_cellars_allowance`. Account creation capabilities are purpose-specific booleans, not inferred from remaining space count or from the selected membership. Only FREE/PRO are subscription plans; BUSINESS is a purpose.

Cellar creation requires CONFIGURE permission and available cellar quota; the automatic principal cellar consumes a slot. Collector stock projections use the server's whole-space bottle total minus the original item quantity plus the edited quantity. Business SKU projections add one for a new record even if stock is zero or its name duplicates another record; editing adds zero. Null limits are unlimited. Optional/missing quota metadata is left unknown for compatibility, never guessed from a visible table or hard-coded plan limits; the server still validates all writes.

Successful inventory create/PATCH/delete, Excel import and stock movement responses trigger a context refresh in `inventoryQuotaRefreshInterceptor`. Space/cellar mutation orchestrators already refresh their context. 403 responses carrying SPACE_LIMIT_REACHED, CELLAR_LIMIT_REACHED or ITEM_LIMIT_REACHED show the server message, preserve credentials/selection/drafts, and refresh counters without retries. Other 403/401 authorization handling is unchanged.
