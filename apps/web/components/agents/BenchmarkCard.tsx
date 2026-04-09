import type { BenchmarkResult, PoCCStats } from "@/lib/types/agents";

const LEVEL_NAMES: Record<number, string> = {
  1: "Comprehension",
  2: "Contribution",
  3: "Review & Architecture",
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export function BenchmarkCard({
  benchmarks,
  poccStats,
}: {
  benchmarks: BenchmarkResult[];
  poccStats: PoCCStats | null;
}) {
  return (
    <section className="mb-10">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-light tracking-tight text-primary mb-4">
        Benchmark Certification
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((level) => {
          const result = benchmarks.find((b) => b.level === level);
          const passed = result?.passed ?? false;
          const attempted = (result?.total_attempts ?? 0) > 0;
          const expiresIn = result?.expires_at ? daysUntil(result.expires_at) : null;

          return (
            <div key={level} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-primary">
                  Level {level}
                </span>
                {passed ? (
                  <span className="text-xs font-medium text-green-400 bg-green-400/10 rounded-full px-2 py-0.5">
                    Passed
                  </span>
                ) : attempted ? (
                  <span className="text-xs font-medium text-amber-400 bg-amber-400/10 rounded-full px-2 py-0.5">
                    Not passed
                  </span>
                ) : (
                  <span className="text-xs text-muted">Not attempted</span>
                )}
              </div>
              <p className="text-xs text-secondary mb-2">
                {LEVEL_NAMES[level]}
              </p>
              {result && (
                <div className="space-y-1">
                  {result.best_score != null && (
                    <p className="text-xs text-muted">
                      Best score:{" "}
                      <span className="text-cyan font-medium">
                        {result.best_score}
                      </span>
                    </p>
                  )}
                  <p className="text-xs text-muted">
                    Attempts: {result.total_attempts} ({result.total_passes} passed)
                  </p>
                  {expiresIn != null && passed && (
                    <p
                      className={`text-xs ${
                        expiresIn <= 14 ? "text-amber-400" : "text-muted"
                      }`}
                    >
                      {expiresIn > 0
                        ? `Expires in ${expiresIn} day${expiresIn !== 1 ? "s" : ""}`
                        : "Expired"}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {poccStats && poccStats.total_chains > 0 && (
        <>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-light tracking-tight text-primary mb-3">
            Proof of Command Correctness
          </h3>
          <div className="card p-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-secondary">Total chains</p>
                <p className="text-lg font-[family-name:var(--font-display)] font-semibold text-primary">
                  {poccStats.total_chains}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary">Verified</p>
                <p className="text-lg font-[family-name:var(--font-display)] font-semibold text-cyan">
                  {poccStats.verified_chains}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary">Consistency rate</p>
                <p className="text-lg font-[family-name:var(--font-display)] font-semibold text-cyan">
                  {(poccStats.consistency_rate * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary">Avg steps/chain</p>
                <p className="text-lg font-[family-name:var(--font-display)] font-semibold text-primary">
                  {poccStats.avg_steps_per_chain.toFixed(1)}
                </p>
              </div>
            </div>
            {Object.keys(poccStats.work_types).length > 0 && (
              <div className="border-t border-border pt-3 mt-3 flex flex-wrap gap-2">
                {Object.entries(poccStats.work_types).map(([type, count]) => (
                  <span
                    key={type}
                    className="text-xs rounded-full border border-border px-2 py-0.5 text-secondary"
                  >
                    {type.replace(/_/g, " ")}: {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
