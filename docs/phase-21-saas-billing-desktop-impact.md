# Phase 21: SaaS Billing Desktop Impact

The hosted web app remains authoritative for entitlement and suspension decisions. Electron does not cache billing authority locally.

When API calls return `402`, the shell emits `access-state-changed` with `restricted-plan-or-suspended-tenant`. The hosted title bar shows subscription-action guidance while the cashier remains on the current POS screen so queued local work and active service state are not discarded.

Desktop rollout requirements:

- Keep offline order queues and hardware queues local until network recovery.
- Do not clear session/cache automatically for past-due or grace-period states.
- Direct billing resolution to the web portal or manager mobile/web account surfaces.
- Include app version, update channel and redacted diagnostics in support bundles.
