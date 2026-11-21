# Transient feedback

`NotificationService` emits success/error/warning/info events to the single root `NotificationHostComponent`. Use this service for mutation feedback, not persistent banners inside page cards. The host is fixed at the top right below the 84px authenticated Topbar, outside page scrolling and above ordinary dialogs. Workspace dropdowns and the mobile sidebar retain priority. The stack takes no layout space and only its cards receive pointer events.

The default duration is 4 seconds, followed by a 180ms exit. Security notices can request 6 seconds. Hover and keyboard focus pause the remaining duration; each toast has a labelled close button. At most three cards remain, duplicates restart their lifetime and old cards are discarded in order. Destruction clears subscriptions/timers. Errors use alert announcements; other messages use status announcements. Text is interpolated, never injected as HTML; reduced-motion preferences disable visual animation.

Profile edit/password/language results and subscription activation/pending/cancellation feedback use the host. Field validation and actionable dialog errors, initial-load errors with retry and persistent server subscription state are not transient feedback: retain them beside the relevant controls. Import results are a persistent operation summary, not a toast replacement.
