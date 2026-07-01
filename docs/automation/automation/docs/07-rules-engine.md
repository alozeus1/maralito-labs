# 07 · Rules Engine

Covers required output **(9)**. Realizes capability 7.

---

## 9.1 Purpose
The rules engine externalizes **business decisions** out of workflow code so they can be changed, versioned, tested, and varied per app/tenant **without redeploying workflows**. It answers questions workflows ask at branch points:
- *Is this order high-risk?* (risk rules)
- *What's the price/fee?* (pricing rules)
- *Is an approval required, and from whom?* (compliance/approval rules)
- *Is this customer/tenant eligible for X?* (business/eligibility rules)

## 9.2 Where it sits
```mermaid
graph LR
  WF[Workflow step / branch] -->|evaluate(ruleset, facts)| RE[Rules Engine]
  RE --> RS[(Rule sets - versioned)]
  RE --> FLAGS[Feature flags / config]
  RE -->|decision + matched rules + rationale| WF
  RE -.audit.-> AUD[Audit]
```
The engine is **pure and deterministic**: given the same facts + ruleset version, it returns the same decision (critical for replay and audit). Side effects stay in workflow steps, not in rules.

## 9.3 Rule categories
| Category | Examples |
|----------|----------|
| **Business rules** | Eligibility, order limits, SLA tiers, routing |
| **Risk rules** | Restricted/prohibited goods, value thresholds, sanctioned destinations, customer risk score, KYC level |
| **Pricing rules** | Base price, weight/route multipliers, platform fees, discounts, taxes/duties hints |
| **Compliance rules** | Documentation requirements, approval requirements, prohibited categories, regulatory holds |
| **App-specific rules** | Owned and namespaced by each app |
| **Tenant-specific rules** | Per-org overrides (an enterprise org's custom thresholds) |
| **Feature-flagged rules** | Rules gated by flags for staged rollout / experimentation |

## 9.4 Rule representation
`DECISION:` **Declarative, data-defined rules** (conditions → outcome), versioned, with a typed fact schema — not imperative code embedded in workflows.

```text
RuleSet {
  key: "borderpass.risk.v4"
  version: 4
  scope: { app: "borderpass", org?: "org_..." }   // tenant override optional
  fact_schema: Zod                                  // inputs the engine expects
  strategy: first_match | all_match | weighted_score
  rules: [
    { id, when: <condition over facts>, then: <outcome>, weight?, reason }
  ]
  default: <outcome>
}
```
- **Conditions** are a safe, sandboxed expression form over typed facts (no arbitrary code execution).
- **Strategies**: first-match (priority-ordered), all-match (collect outcomes), or weighted-score (sum to a risk score → band).
- **Outcome** can be a value (price), a classification (risk band), a decision (require approval from role X), or a set of flags.
- Every evaluation returns the **decision + the matched rules + rationale**, which the workflow records to audit (explainability — vital for risk/compliance decisions).

## 9.5 Resolution & precedence
When multiple rule sets could apply (platform default → app → tenant → flagged experiment), precedence is explicit and documented: **tenant override > app rule > platform default**, with feature-flag-gated rules layered per their flag. The engine logs which version/scope produced the decision.

## 9.6 Versioning, testing, governance
- Rule sets are **versioned and immutable once published**; workflows can pin a version or use "latest published."
- **Test harness**: rule sets ship with example fact→expected-outcome cases run in CI; a rule change that breaks a case fails the build.
- **Simulation**: authors can dry-run a rule set against historical facts to see decision deltas before publishing (impact analysis).
- **Change control**: risk/compliance/pricing rule changes are reviewed (these directly affect money and legal exposure); changes are audited.

## 9.7 Relationship to flags & config
- **Feature flags** (platform S12) turn rules/rulesets on/off and target rollouts; **config** holds tunable values (thresholds, fee rates) the rules reference. This separates *whether a rule applies* (flag) from *the rule logic* (ruleset) from *the tunable numbers* (config) — each changeable independently.

## 9.8 Acceptance criteria (rules)
`ACCEPTANCE:`
- Rule evaluation is pure/deterministic and returns decision + matched rules + rationale.
- Risk/pricing/compliance rules are changeable without redeploying workflows.
- Tenant overrides resolve with documented precedence and are logged.
- Every published rule set has passing test cases; risk/compliance/pricing changes are reviewed + audited.
- A rule decision used in a run is reproducible at replay time (version pinned).
