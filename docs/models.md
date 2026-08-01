# Agent model routing

The distribution pins every maintained agent to an explicit GPT-5.6 model and
reasoning effort. Before this audit, all seven definitions omitted both settings, so
they inherited the caller's model; in the audited installation that meant
`openai/gpt-5.6-sol` with the provider default of medium reasoning for every role.

## Decision table

| Agent | Workload | Model | Reasoning effort | Why | Escalation |
| --- | --- | --- | --- | --- | --- |
| Brainstormer | Occasional ambiguous product exploration; medium failure impact | `openai/gpt-5.6-terra` | medium | Needs synthesis and option quality, but makes no publication decision | Use Sol/high for cross-domain strategy where conflicting evidence remains material |
| Task-shaper | Occasional contract synthesis and issue publication; high downstream impact | `openai/gpt-5.6-terra` | medium | Structured evidence, independent review, and explicit approval constrain the task | Use Sol/high for security-sensitive, cross-repository, or repeatedly rejected issues |
| Orchestrator | Frequent default, long-running tool use and Git/GitHub delivery; critical impact | `openai/gpt-5.6-sol` | medium | Highest ambiguity, longest context, and mutation authority justify frontier capability | Raise to high only after material ambiguity, repeated failed recovery, or high-risk architecture/security work |
| Planner | Per-delivery repository analysis and implementation design; high downstream impact | `openai/gpt-5.6-terra` | high | Planning benefits from deeper reasoning while Terra avoids Sol pricing for a bounded read-only result | Use Sol/high when the plan spans unfamiliar systems, data migration, concurrency, or irreversible operations |
| Implementer | Frequent bounded code and test changes; high impact contained by tests and review | `openai/gpt-5.6-terra` | medium | Terra is the cost-balanced coding workhorse; validation and review catch residual defects | Return to the Sol orchestrator for cross-cutting architecture, security, concurrency, or three failed fixes |
| Reviewer | Per-change independent defect search; high failure impact | `openai/gpt-5.6-sol` | medium | Missing one subtle mutation or recovery defect can invalidate the workflow; a local probe favored Sol | Raise to high for security, data loss, migrations, large diffs, or high-risk changes with suspiciously empty findings |
| Researcher | Frequent parallel, bounded, read-only retrieval and citation; low direct impact | `openai/gpt-5.6-luna` | medium | Luna completed the representative repository inventory correctly and is the economical high-volume tier | Use Terra/medium for conflicting multi-source synthesis; use Sol only when unresolved evidence affects a critical decision |

Escalation is exceptional, not an automatic retry ladder. First narrow the task,
improve evidence, and rerun the same model when failure is caused by missing context or
an unavailable tool. Escalate one tier when the role reports material unresolved
ambiguity, repeated reasoning failure, or a listed high-impact condition. Increase
reasoning effort before moving beyond Sol/medium only when the task is quality-first
and added latency is acceptable. Do not use `xhigh`, `max`, pro mode, or Fast mode by
default.

OpenCode does not currently provide a portable per-task model override when one custom
subagent invokes another. A subagent therefore returns the escalation reason to its
Sol orchestrator, which performs or re-delegates the difficult portion. Primary agents
can be rerun explicitly with `--model` and `--variant`; changing a pinned subagent
requires an intentional configuration override rather than an assumed runtime switch.

## Evidence

OpenAI defines Sol as flagship capability, Terra as the intelligence/cost balance,
and Luna as the efficient high-volume tier. All support tool use and reasoning effort
from none through max. OpenAI recommends medium as the balanced starting point and
measuring one lower effort before adopting higher settings. Standard short-context
API prices per million input/output tokens are $5/$30 for Sol, $2/$12 for Terra, and
$0.20/$1.20 for Luna. See the [GPT-5.6 guide](https://developers.openai.com/api/docs/guides/latest-model),
[model-selection guide](https://developers.openai.com/api/docs/guides/model-selection),
and [pricing](https://developers.openai.com/api/docs/pricing).

The local OpenCode 1.18.3 provider exposes all three `openai/` IDs and the selected
reasoning variants. OpenCode documentation confirms that explicit agent models avoid
subagent inheritance and that extra agent fields such as `reasoningEffort` are passed
to the provider. See [OpenCode agents](https://opencode.ai/docs/agents/) and
[models](https://opencode.ai/docs/models/).

Community evidence supports conservative effort settings. Codex reports found Sol at
high efforts serializing independent calls or multiplying tool cycles and tokens;
bounded parallelism reduced usage, but some combined outputs truncated. Other reports
showed temporary Sol-only overload and tool-exposure regressions where Terra worked.
These are harness and rollout limitations, not proof that Sol lacks API tool support.
See [Codex #35050](https://github.com/openai/codex/issues/35050),
[Codex #33592](https://github.com/openai/codex/issues/33592), and
[OpenCode #39653](https://github.com/anomalyco/opencode/issues/39653).

## Local probes

Two small OpenCode probes used medium reasoning on the active `openai` route:

- Luna inspected all seven agent files with parallel reads and returned the exact
  mode/model/effort inventory. It used three model turns, 24,866 uncached input
  tokens, 39,936 cached input tokens, 289 output tokens, and 90 reasoning tokens, and
  completed in 23.8 seconds. The large shared system prompt makes absolute usage
  unrepresentative; the probe supports Luna for bounded retrieval, not deep synthesis.
- Terra and Sol reviewed the same mutation helper. Terra found substring matching and
  a concurrent duplicate-write race in 17.4 seconds. Sol found substring matching and
  the more operationally relevant ambiguous post-write failure/retry defect in 24.5
  seconds. Terra used 297 reasoning and 156 output tokens; Sol used 468 reasoning and
  179 output tokens. Both obeyed the output constraint; the result supports Sol for
  independent review, while remaining too small to claim a general quality ranking.

## Uncertainty and limits

- No common public SWE-bench, Aider, or controlled long-running OpenCode benchmark was
  found for all three tiers. Independent composite scores favor Sol, then Terra, then
  Luna, but do not isolate this repository's agent workloads.
- Reddit HTML and JSON retrieval returned 403/429 during the audit, so unverifiable
  snippets were excluded rather than presented as evidence.
- Direct OpenAI documentation advertises a 1.05M API context and 128K output. Codex
  currently packages a 272K context, while the active OpenCode route reports 500K
  context and 372K maximum input; OpenCode source has also applied a 32K output
  ceiling. Treat effective limits as provider- and client-specific and preserve
  compaction headroom.
- The authenticated local `openai` route reports zero metered cost in OpenCode, so
  direct API prices are a relative cost proxy rather than proof of this installation's
  marginal bill. Subscription quotas and GitHub Copilot pricing can differ.
- Fast variants cost more and long-context requests cross a higher pricing tier. The
  standard model IDs are therefore pinned here; latency-sensitive operators may test
  Fast mode separately without changing the quality baseline.
