# Builder and rules engine

Status: done (first version)

- Pure TS rules engine over SRD 5.1 data, shared with the live sheet and dice threads.
- Data model agreed with the sheet thread: choices stored, stats derived, play state in `character.state`.
- Multi-user: `ownerId` + local profiles; async storage API ready for a hosted backend.
- Six-step builder with live preview.

Next: subclasses and level-up flow, accounts + cloud sync (pending user decision), more SRD items.
