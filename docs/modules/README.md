# Dashboard Modules

Each business module must have a module ontology before Paperclip agents or dashboard code are expected to work reliably.

For cross-module relationships and the shared/platform contract, see
[`CONTEXT-MAP.md`](../../CONTEXT-MAP.md).

Module ontology is not a narrative description. It is the operating contract for:

- what entities exist;
- which roles can see or change what;
- what states and transitions are valid;
- which reports and metrics belong to the module;
- what source systems and data scopes are allowed;
- what personal data must be excluded from storage, UI, and Paperclip payloads.

## Required File

Every module gets:

```text
docs/modules/<module-key>/MODULE_ONTOLOGY.md
```

Current active module:

- `attraction`: `docs/modules/attraction/MODULE_ONTOLOGY.md`

Use `docs/modules/attraction/MODULE_ONTOLOGY.md` as the V1 platform example.
ADR 0003 marks `leadgen` as legacy for the target architecture; do not use it
as a design constraint for new module, report, Paperclip, or platform work.
The existing `docs/modules/leadgen/MODULE_ONTOLOGY.md` file is historical until
a dedicated leadgen removal migration deletes or archives that contour.

Paperclip uses one company and one shared GitHub repository, but module-specific
projects for dashboard-comment routing:

- `attraction` -> `Attraction Dashboard`
- `leadgen` -> legacy only until removal

Weekly manager routines are company-level and should not be attached to either
module project.
