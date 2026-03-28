"""
Feeshr reputation/trust discrete-event simulation.

Models: agent identity, contributions (PRs), reviewer assignment,
review scoring, delayed evaluation, reputation updates, decay,
collusion detection, and trust multiplier dynamics.

Usage:
    python sim.py                              # run all scenarios
    python sim.py scenarios/sybil_farming.yaml # run one scenario
"""

from __future__ import annotations

import csv
import heapq
import json
import math
import os
import random
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional

import yaml

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

class Tier(Enum):
    APPRENTICE = 0
    CONTRIBUTOR = 1
    SPECIALIST = 2
    MAINTAINER = 3
    ARCHITECT = 4

TIER_THRESHOLDS = [0, 100, 300, 600, 1000]
TIER_NAMES = ["apprentice", "contributor", "specialist", "maintainer", "architect"]


def tier_for_score(score: float) -> Tier:
    for i in range(len(TIER_THRESHOLDS) - 1, -1, -1):
        if score >= TIER_THRESHOLDS[i]:
            return Tier(i)
    return Tier.APPRENTICE


@dataclass
class Agent:
    id: str
    is_honest: bool = True
    is_sybil: bool = False
    colluding_with: list[str] = field(default_factory=list)
    reputation: float = 0.0
    peak_reputation: float = 0.0
    trust_score: float = 1.0
    reviews_given: int = 0
    accurate_reviews: int = 0
    prs_authored: int = 0
    prs_merged: int = 0
    last_active_day: int = 0
    category: str = "general"

    @property
    def tier(self) -> Tier:
        return tier_for_score(self.reputation)

    @property
    def review_weight(self) -> float:
        return max(0.1, min(3.0, self.trust_score * (1.0 + self.tier.value * 0.25)))


@dataclass
class PR:
    id: int
    author_id: str
    is_malicious: bool
    quality: float  # 0.0 - 1.0
    day: int
    reviewers: list[str] = field(default_factory=list)
    reviews: dict[str, str] = field(default_factory=dict)  # reviewer -> verdict
    merged: bool = False
    evaluated: bool = False


@dataclass
class Event:
    day: float
    kind: str
    data: dict = field(default_factory=dict)

    def __lt__(self, other: Event) -> bool:
        return self.day < other.day


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@dataclass
class SimConfig:
    name: str = "default"
    seed: int = 42
    duration_days: int = 180
    # Agents
    honest_agents: int = 20
    adversary_agents: int = 0
    sybil_agents: int = 0
    sybil_target: str = ""
    colluding_pairs: list[list[str]] = field(default_factory=list)
    # Contribution rates
    prs_per_agent_per_day: float = 0.3
    adversary_malicious_rate: float = 0.5
    on_off_cycle_days: int = 14
    # Reputation
    rep_gain_author: float = 15.0
    rep_gain_reviewer: float = 5.0
    rep_penalty_missed_bug: float = -20.0
    rep_penalty_false_reject: float = -10.0
    # Trust
    trust_multiplier_min: float = 0.5
    trust_multiplier_max: float = 2.0
    delayed_eval_window_days: int = 14
    # Decay
    decay_rates: dict[str, float] = field(default_factory=lambda: {
        "apprentice": 0.0,
        "contributor": 0.02,
        "specialist": 0.015,
        "maintainer": 0.01,
        "architect": 0.005,
    })
    inactivity_threshold_days: int = 7
    floor_fraction: float = 0.5
    # Assignment
    assignment_policy: str = "stochastic"  # "top_k" or "stochastic"
    reviewers_per_pr: int = 2
    # Collusion filter
    collusion_filter: str = "pair_exclusion"  # "pair_exclusion" or "graph_cluster"
    collusion_approval_threshold: float = 0.9
    collusion_min_reviews: int = 5

    @classmethod
    def from_yaml(cls, path: str) -> SimConfig:
        with open(path) as f:
            data = yaml.safe_load(f) or {}
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


# ---------------------------------------------------------------------------
# Simulator
# ---------------------------------------------------------------------------

class Simulator:
    def __init__(self, config: SimConfig):
        self.config = config
        self.rng = random.Random(config.seed)
        self.agents: dict[str, Agent] = {}
        self.prs: list[PR] = []
        self.events: list[Event] = []
        self.event_queue: list[Event] = []
        self.day = 0
        self.pr_counter = 0
        self.flagged_pairs: set[tuple[str, str]] = set()
        self._init_agents()

    def _init_agents(self):
        for i in range(self.config.honest_agents):
            aid = f"honest-{i}"
            self.agents[aid] = Agent(id=aid, is_honest=True)

        for i in range(self.config.adversary_agents):
            aid = f"adversary-{i}"
            self.agents[aid] = Agent(id=aid, is_honest=False)

        for i in range(self.config.sybil_agents):
            aid = f"sybil-{i}"
            self.agents[aid] = Agent(
                id=aid, is_honest=False, is_sybil=True,
            )

        # Set up collusion pairs
        for pair in self.config.colluding_pairs:
            if len(pair) == 2 and pair[0] in self.agents and pair[1] in self.agents:
                self.agents[pair[0]].colluding_with.append(pair[1])
                self.agents[pair[1]].colluding_with.append(pair[0])

    def run(self) -> dict:
        # Schedule daily events
        for day in range(self.config.duration_days):
            heapq.heappush(self.event_queue, Event(day, "daily_tick"))

        while self.event_queue:
            event = heapq.heappop(self.event_queue)
            self.day = int(event.day)
            self._handle_event(event)

        return self._compute_metrics()

    def _handle_event(self, event: Event):
        self.events.append(event)
        if event.kind == "daily_tick":
            self._daily_tick()
        elif event.kind == "evaluate_pr":
            self._evaluate_pr(event.data["pr_id"])
        elif event.kind == "decay":
            self._apply_decay()

    def _daily_tick(self):
        # Generate PRs
        for agent in self.agents.values():
            if self.rng.random() < self.config.prs_per_agent_per_day:
                self._submit_pr(agent)

        # Assign reviews for unreviewed PRs
        for pr in self.prs:
            if not pr.reviews and not pr.merged:
                self._assign_reviewers(pr)

        # Process reviews
        for pr in self.prs:
            if pr.reviewers and not pr.merged and not pr.reviews:
                self._process_reviews(pr)

        # Weekly decay
        if self.day % 7 == 0:
            self._apply_decay()

        # Weekly collusion scan
        if self.day % 7 == 0:
            self._scan_collusion()

    def _submit_pr(self, agent: Agent):
        self.pr_counter += 1
        is_malicious = False
        quality = self.rng.gauss(0.7, 0.15)

        if not agent.is_honest:
            # On/off adversary pattern
            cycle = self.config.on_off_cycle_days
            if cycle > 0:
                phase = (self.day // cycle) % 2
                is_malicious = phase == 1 and self.rng.random() < self.config.adversary_malicious_rate
            else:
                is_malicious = self.rng.random() < self.config.adversary_malicious_rate

            if is_malicious:
                quality = self.rng.uniform(0.0, 0.3)

        quality = max(0.0, min(1.0, quality))
        pr = PR(
            id=self.pr_counter,
            author_id=agent.id,
            is_malicious=is_malicious,
            quality=quality,
            day=self.day,
        )
        self.prs.append(pr)
        agent.prs_authored += 1
        agent.last_active_day = self.day

    def _assign_reviewers(self, pr: PR):
        candidates = [
            a for a in self.agents.values()
            if a.id != pr.author_id and a.tier.value >= Tier.CONTRIBUTOR.value
        ]

        # Collusion filter: exclude flagged pairs
        if self.config.collusion_filter == "pair_exclusion":
            candidates = [
                a for a in candidates
                if (a.id, pr.author_id) not in self.flagged_pairs
                and (pr.author_id, a.id) not in self.flagged_pairs
            ]

        if not candidates:
            # Fallback: any agent except author
            candidates = [a for a in self.agents.values() if a.id != pr.author_id]

        if not candidates:
            return

        n = min(self.config.reviewers_per_pr, len(candidates))

        if self.config.assignment_policy == "top_k":
            candidates.sort(key=lambda a: a.review_weight, reverse=True)
            selected = candidates[:n]
        else:  # stochastic
            weights = [max(0.01, a.review_weight) for a in candidates]
            selected = []
            pool = list(zip(candidates, weights))
            for _ in range(n):
                if not pool:
                    break
                total = sum(w for _, w in pool)
                r = self.rng.uniform(0, total)
                cumulative = 0.0
                for idx, (agent, w) in enumerate(pool):
                    cumulative += w
                    if cumulative >= r:
                        selected.append(agent)
                        pool.pop(idx)
                        break

        pr.reviewers = [a.id for a in selected]

    def _process_reviews(self, pr: PR):
        for reviewer_id in pr.reviewers:
            reviewer = self.agents[reviewer_id]
            reviewer.reviews_given += 1
            reviewer.last_active_day = self.day

            # Determine verdict
            if reviewer.is_honest:
                # Honest reviewers detect bad quality with ~80% probability
                if pr.quality < 0.4:
                    verdict = "reject" if self.rng.random() < 0.8 else "approve"
                else:
                    verdict = "approve" if self.rng.random() < 0.85 else "request_changes"
            else:
                # Colluding with author?
                if pr.author_id in reviewer.colluding_with:
                    verdict = "approve"  # always rubber-stamp
                else:
                    # Adversary reviewers: random
                    verdict = "approve" if self.rng.random() < 0.7 else "reject"

            pr.reviews[reviewer_id] = verdict

        # Merge decision: majority approve
        approvals = sum(1 for v in pr.reviews.values() if v == "approve")
        if approvals > len(pr.reviews) / 2:
            pr.merged = True
            author = self.agents[pr.author_id]
            author.prs_merged += 1
            # Author reputation gain
            author.reputation += self.config.rep_gain_author
            author.peak_reputation = max(author.peak_reputation, author.reputation)
            # Reviewer reputation gain
            for rid in pr.reviewers:
                r = self.agents[rid]
                r.reputation += self.config.rep_gain_reviewer
                r.peak_reputation = max(r.peak_reputation, r.reputation)

        # Schedule delayed evaluation
        eval_day = self.day + self.config.delayed_eval_window_days
        if eval_day < self.config.duration_days:
            heapq.heappush(
                self.event_queue,
                Event(eval_day, "evaluate_pr", {"pr_id": pr.id}),
            )

    def _evaluate_pr(self, pr_id: int):
        pr = next((p for p in self.prs if p.id == pr_id), None)
        if not pr or pr.evaluated:
            return
        pr.evaluated = True

        for reviewer_id, verdict in pr.reviews.items():
            reviewer = self.agents[reviewer_id]

            if pr.is_malicious and verdict == "approve" and pr.merged:
                # Missed bug: reviewer approved malicious PR that merged
                reviewer.trust_score = max(
                    self.config.trust_multiplier_min,
                    reviewer.trust_score - 0.15,
                )
                reviewer.reputation += self.config.rep_penalty_missed_bug
                reviewer.reputation = max(0, reviewer.reputation)
            elif not pr.is_malicious and verdict == "reject":
                # False reject
                reviewer.trust_score = max(
                    self.config.trust_multiplier_min,
                    reviewer.trust_score - 0.05,
                )
                reviewer.reputation += self.config.rep_penalty_false_reject
                reviewer.reputation = max(0, reviewer.reputation)
            elif pr.is_malicious and verdict == "reject":
                # Correctly caught bad PR
                reviewer.accurate_reviews += 1
                reviewer.trust_score = min(
                    self.config.trust_multiplier_max,
                    reviewer.trust_score + 0.1,
                )
            elif not pr.is_malicious and verdict == "approve":
                # Correctly approved good PR
                reviewer.accurate_reviews += 1
                reviewer.trust_score = min(
                    self.config.trust_multiplier_max,
                    reviewer.trust_score + 0.02,
                )

    def _apply_decay(self):
        for agent in self.agents.values():
            inactive_days = self.day - agent.last_active_day
            if inactive_days > self.config.inactivity_threshold_days:
                tier_name = TIER_NAMES[agent.tier.value]
                rate = self.config.decay_rates.get(tier_name, 0.01)
                decay = agent.reputation * rate
                floor = agent.peak_reputation * self.config.floor_fraction
                agent.reputation = max(floor, agent.reputation - decay)

    def _scan_collusion(self):
        # Build review pair stats
        pair_stats: dict[tuple[str, str], dict] = {}
        for pr in self.prs:
            for reviewer_id, verdict in pr.reviews.items():
                pair = (reviewer_id, pr.author_id)
                if pair not in pair_stats:
                    pair_stats[pair] = {"total": 0, "approvals": 0}
                pair_stats[pair]["total"] += 1
                if verdict == "approve":
                    pair_stats[pair]["approvals"] += 1

        for (reviewer, author), stats in pair_stats.items():
            if stats["total"] >= self.config.collusion_min_reviews:
                rate = stats["approvals"] / stats["total"]
                if rate >= self.config.collusion_approval_threshold:
                    self.flagged_pairs.add((reviewer, author))

    def _compute_metrics(self) -> dict:
        honest = [a for a in self.agents.values() if a.is_honest]
        adversaries = [a for a in self.agents.values() if not a.is_honest]

        total_prs = len(self.prs)
        malicious_prs = [p for p in self.prs if p.is_malicious]
        malicious_merged = [p for p in malicious_prs if p.merged]

        honest_rep = [a.reputation for a in honest] if honest else [0]
        adv_rep = [a.reputation for a in adversaries] if adversaries else [0]

        # Gini coefficient
        all_rep = sorted([a.reputation for a in self.agents.values()])
        n = len(all_rep)
        if n > 0 and sum(all_rep) > 0:
            gini = sum(
                sum(abs(all_rep[i] - all_rep[j]) for j in range(n))
                for i in range(n)
            ) / (2 * n * sum(all_rep))
        else:
            gini = 0.0

        trust_scores = [a.trust_score for a in self.agents.values()]

        return {
            "scenario": self.config.name,
            "duration_days": self.config.duration_days,
            "total_agents": len(self.agents),
            "honest_agents": len(honest),
            "adversary_agents": len(adversaries),
            "total_prs": total_prs,
            "malicious_prs": len(malicious_prs),
            "malicious_merged": len(malicious_merged),
            "malicious_merge_rate": (
                len(malicious_merged) / len(malicious_prs)
                if malicious_prs else 0.0
            ),
            "honest_avg_reputation": sum(honest_rep) / len(honest_rep),
            "adversary_avg_reputation": sum(adv_rep) / len(adv_rep),
            "reputation_inflation_factor": (
                (sum(adv_rep) / len(adv_rep)) / (sum(honest_rep) / len(honest_rep))
                if honest_rep and sum(honest_rep) > 0 else 0.0
            ),
            "reputation_gini": round(gini, 4),
            "trust_mean": sum(trust_scores) / len(trust_scores),
            "trust_variance": (
                sum((t - sum(trust_scores) / len(trust_scores)) ** 2 for t in trust_scores)
                / len(trust_scores)
            ),
            "collusion_pairs_flagged": len(self.flagged_pairs),
            "total_reviews": sum(a.reviews_given for a in self.agents.values()),
            "total_merges": sum(1 for p in self.prs if p.merged),
        }


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def write_summary(metrics: dict, output_dir: Path, name: str):
    path = output_dir / f"{name}_summary.json"
    with open(path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"  Summary: {path}")


def write_events_csv(sim: Simulator, output_dir: Path, name: str):
    path = output_dir / f"{name}_events.csv"
    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["day", "kind", "data"])
        for event in sim.events:
            writer.writerow([event.day, event.kind, json.dumps(event.data)])
    print(f"  Events:  {path}")


def write_chart(sim: Simulator, output_dir: Path, name: str):
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        print("  Chart:   skipped (install matplotlib for charts)")
        return

    # Build reputation time series
    honest_ts: dict[int, list[float]] = {}
    adv_ts: dict[int, list[float]] = {}

    # Snapshot every 7 days
    snapshot_days = list(range(0, sim.config.duration_days, 7))
    # Re-run is expensive, approximate from final state + events
    # Simple: just plot final bars
    fig, ax = plt.subplots(1, 1, figsize=(10, 5))
    agents = sorted(sim.agents.values(), key=lambda a: a.reputation, reverse=True)[:20]
    names = [a.id[:15] for a in agents]
    reps = [a.reputation for a in agents]
    colors = ["#2563eb" if a.is_honest else "#dc2626" for a in agents]
    ax.barh(names, reps, color=colors)
    ax.set_xlabel("Reputation")
    ax.set_title(f"Scenario: {name} — Top 20 agents")
    ax.invert_yaxis()
    plt.tight_layout()
    path = output_dir / f"{name}_chart.png"
    fig.savefig(path, dpi=100)
    plt.close(fig)
    print(f"  Chart:   {path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run_scenario(config_path: str, output_dir: Path) -> dict:
    config = SimConfig.from_yaml(config_path)
    print(f"\nRunning scenario: {config.name} ({config_path})")
    sim = Simulator(config)
    metrics = sim.run()
    write_summary(metrics, output_dir, config.name)
    write_events_csv(sim, output_dir, config.name)
    write_chart(sim, output_dir, config.name)
    return metrics


def main():
    script_dir = Path(__file__).parent
    scenarios_dir = script_dir / "scenarios"
    output_dir = script_dir / "output"
    output_dir.mkdir(exist_ok=True)

    if len(sys.argv) > 1:
        paths = sys.argv[1:]
    else:
        paths = sorted(str(p) for p in scenarios_dir.glob("*.yaml"))

    if not paths:
        print("No scenarios found. Add YAML files to tools/reputation_sim/scenarios/")
        sys.exit(1)

    all_metrics = []
    for path in paths:
        metrics = run_scenario(path, output_dir)
        all_metrics.append(metrics)

    # Print comparison table
    print("\n" + "=" * 80)
    print(f"{'Scenario':<25} {'Mal.Merge%':>10} {'RepInflat':>10} {'Gini':>8} {'Flagged':>8}")
    print("-" * 80)
    for m in all_metrics:
        print(
            f"{m['scenario']:<25} "
            f"{m['malicious_merge_rate']*100:>9.1f}% "
            f"{m['reputation_inflation_factor']:>10.2f} "
            f"{m['reputation_gini']:>8.4f} "
            f"{m['collusion_pairs_flagged']:>8}"
        )
    print("=" * 80)


if __name__ == "__main__":
    main()
