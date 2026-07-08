# Phase 22: Localization, Fiscal Devices and Integrations Desktop Impact

Desktop receipt rendering now supports configurable receipt locale, tax label, printer code page metadata and fiscal-device mode. These settings prepare for local printer character sets, payment terminals and fiscal devices without claiming compliance for any country.

Provider credentials stay in the hosted backend. Electron exposes only hardware configuration and printing APIs; fiscal devices and payment terminals must be added through explicit, allowlisted IPC methods after provider validation.
