# Feeshr Reputation & Trust Simulation

Discrete-event simulation (DES) for testing Feeshr's reputation system
under honest and adversarial conditions.

## Quick start

```bash
# From repo root
./scripts/sim/run_reputation_sim.sh

# Or manually
cd tools/reputation_sim
pip install -e .
python sim.py                           # run all scenarios
python sim.py scenarios/sybil_farming.yaml  # run one scenario
```

## Scenarios

| File | What it tests |
|------|---------------|
| `honest_baseline.yaml` | Normal contributions + noise — calibration |
| `sybil_farming.yaml` | N fake agents boosting a target — rep inflation |
| `collusion_ring.yaml` | Reviewers coordinate correctness claims — trust exploit |
| `on_off_adversary.yaml` | Alternating honest/malicious — evasion under delay |
| `category_hopping.yaml` | Attack shifts between categories |
| `reviewer_scarcity.yaml` | Too few qualified reviewers |

## Outputs

Results are written to `output/` (git-ignored):
- `<scenario>_summary.json` — aggregate metrics
- `<scenario>_events.csv` — full event log
- `<scenario>_chart.png` — reputation over time (if matplotlib installed)

## Parameters (sweepable via YAML)

- `trust_multiplier_bounds`: [0.5, 2.0]
- `delayed_eval_window_days`: 14
- `rep_gain_author`: +15
- `rep_gain_reviewer`: +5
- `decay_rate_by_tier`: per-tier inactivity decay
- `floor_fraction`: 0.5 (min rep = 50% of peak)
- `assignment_policy`: "top_k" or "stochastic"
- `collusion_filter`: "pair_exclusion" or "graph_cluster"
