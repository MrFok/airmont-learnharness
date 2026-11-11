# Production interface

The approved visual direction uses a dark neutral canvas, distinct raised and overlay surfaces, and quiet borders. Shared production tokens live in `app/globals.css`; shared controls and styles live under `components/interface` and `components/ui`.

Use Segoe UI for reading, writing and interface labels; Geist Mono for code; and the bundled CMU Serif bold face for session identity. Session headers use 24px/700 with compact leading. Sidebar session titles use Segoe UI at 14px/500. Factory defaults must preserve explicitly saved Appearance customizations.

Buttons and mutually exclusive mode groups are borderless. Mode groups use the shared sliding pill and explicit orientation. Retain editable field boundaries and visible keyboard focus. Keep 44px touch targets, including any clipping wrapper. Use `data-interface-button` for Button styling because Radix `asChild` wrappers can replace `data-slot`.

Thinking headers use a brain icon and “Your thinking”; actual thought text is upright at 15px/500. Shared loading and assessment-writing feedback uses the circular dot loader and thinking text highlight. Aborted work has a distinct stopped state rather than a failure treatment.

Question options use neutral letter badges on hover. Multiple selections use closely spaced filled rows, amber selected badges and independent toggles. Answer status aligns to the trailing edge of the header. Avoid redundant nested learning surfaces and decorative borders.

Square copy affordances stay icon-only. Use the shared quiet fade and drawn-check feedback with accessible status announcements. Preserve reduced motion on initial load and when the preference changes while a component is mounted.

Provider and model choices use muted monochrome source marks from `public/provider-marks` and readable catalog names without changing stored model IDs. Menus have full-width rows, explicit trailing spacing, viewport clamping, keyboard navigation and predictable Escape behavior.

Preserve generated figure and demo content. Their shared paper wrapper uses a subdued logo in the bottom-right corner. Semantic diagram color is allowed when labels, markers or line styles retain meaning without color.

The development inventory, competitor references, comparisons and capture-toolbar experiment remain local and are not application routes in this branch. Regression tests exercise production components directly.
