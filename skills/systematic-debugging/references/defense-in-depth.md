# Defense in Depth After a Root Fix

Add layered validation only after proving the source. Different layers have distinct
jobs:

1. **External entry:** reject malformed/untrusted input with an actionable message.
2. **Domain boundary:** enforce invariants required by the operation.
3. **Dangerous effect:** refuse unsafe filesystem, network, data, or publication
   operations even if an upstream path bypasses validation.
4. **Observability:** retain safe context that makes an unexpected bypass diagnosable.

Map every route by which the bad state can reach the effect. Add the fewest checks
that close materially different routes. Test at least the source fix and the dangerous
boundary. Avoid duplicated business rules, generic catch-all handling, noisy logs,
and checks that make invalid states look successful.

Good layering produces earlier errors and prevents damage. It does not excuse a
source defect or replace regression coverage.
