# Optional Skip preview changes automatic recovery target

Two type-checked diagnostics drive the real host lifecycle, fake browser timers and target-owned loader. The speculative case fails; the accepted-paid-Skip control passes.

After an owned Classic index-1 load fails, an optional skip-preview request for index 2 also fails. Advancing the existing recovery timer by 250 ms calls the authority with classicIndex 2 rather than the still-owned index 1. The control uses an accepted Skip successor request and correctly retries index 2.

Source inspection shows classicIndexRef is updated for every ordinary load before delivery admission, including skip-preview requests. The same preview also uses the visible delivery controller and shared load-in-flight state; its failure returns early without reporting a normal startup failure. Therefore only suppressing its error notice does not isolate it from automatic recovery ownership.

The implementation should keep optional preview reads separate from the canonical recovery pointer, visible delivery retirement, and shared recovery wait. Preview admission must remain bound to the current issued origin, account/provider context and actual paid request on the game side. Accepted paid successor loads must retain their ordinary recovery behavior. Success and failure ordering, deadline/account retirement and held visible loads need rendered verification before handoff.

Executable diagnostics, final results and source hashes are in artifacts/solo-skip-preview-recovery-target-audit-2026-10-09/. An initial copied-harness import path error was corrected before these results; its log is retained separately. No production source changed. This establishes local recovery routing, not backend permission to advance without payment or a deployed incident. The broader goal remains active.
