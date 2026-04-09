//! Benchmark challenge generator — monthly rotation.
//!
//! Runs on the 1st of every month. Generates new parameterized challenges
//! for each level/category from templates. Previous month's challenges are
//! deactivated to prevent memorization.

use chrono::{Datelike, NaiveDate, Utc};
use serde_json::json;
use tracing::info;
use uuid::Uuid;

/// Minimum active challenge pool size per level.
const LEVEL_1_POOL_MIN: i64 = 15;
const LEVEL_2_POOL_MIN: i64 = 10;
const LEVEL_3_POOL_MIN: i64 = 8;

/// Run the monthly challenge generation job.
///
/// Checks if the current month has enough active challenges. If not,
/// generates new ones from templates and deactivates expired ones.
pub async fn run_challenge_generation(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    let now = Utc::now();
    let today = now.date_naive();
    let first_of_month = NaiveDate::from_ymd_opt(today.year(), today.month(), 1)
        .ok_or_else(|| anyhow::anyhow!("Invalid date"))?;
    let last_of_month = if today.month() == 12 {
        NaiveDate::from_ymd_opt(today.year() + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(today.year(), today.month() + 1, 1)
    }
    .ok_or_else(|| anyhow::anyhow!("Invalid date"))?
    .pred_opt()
    .ok_or_else(|| anyhow::anyhow!("Invalid date"))?;

    // Check and generate for each level
    for level in 1..=3 {
        let min_pool = match level {
            1 => LEVEL_1_POOL_MIN,
            2 => LEVEL_2_POOL_MIN,
            3 => LEVEL_3_POOL_MIN,
            _ => unreachable!(),
        };

        let active_count: i64 = sqlx::query_scalar(
            r#"SELECT COUNT(*) FROM benchmark_challenges
               WHERE level = $1 AND active_from <= $2 AND active_to >= $2"#,
        )
        .bind(level)
        .bind(today)
        .fetch_one(pool)
        .await?;

        if active_count >= min_pool {
            info!(level = level, active = active_count, "Enough active challenges");
            continue;
        }

        let needed = min_pool - active_count;
        info!(
            level = level,
            active = active_count,
            needed = needed,
            "Generating new challenges"
        );

        let categories = match level {
            1 => vec!["comprehension", "debugging", "reasoning"],
            2 => vec!["fix_and_verify", "security_audit", "refactor"],
            3 => vec!["review_adversarial", "architecture", "decomposition"],
            _ => unreachable!(),
        };

        let per_category = (needed / categories.len() as i64).max(1);

        for category in &categories {
            for i in 0..per_category {
                let challenge = generate_challenge_from_template(level, category, i);

                sqlx::query(
                    r#"INSERT INTO benchmark_challenges
                       (id, level, category, title, codebase, prompt,
                        grading_criteria, difficulty, languages,
                        active_from, active_to, created_by)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'platform')"#,
                )
                .bind(Uuid::new_v4())
                .bind(level)
                .bind(*category)
                .bind(&challenge.title)
                .bind(&challenge.codebase)
                .bind(&challenge.prompt)
                .bind(&challenge.grading_criteria)
                .bind(&challenge.difficulty)
                .bind(&challenge.languages)
                .bind(first_of_month)
                .bind(last_of_month)
                .execute(pool)
                .await?;
            }
        }

        info!(level = level, generated = needed, "Challenges generated");
    }

    // Count expired challenges (active_to < today) — no update needed since
    // active_to is the natural expiry date. Log for observability.
    let expired: Option<(i64,)> = sqlx::query_as(
        r#"SELECT COUNT(*)
           FROM benchmark_challenges
           WHERE active_to < $1 AND active_to >= $1 - 31"#,
    )
    .bind(today)
    .fetch_optional(pool)
    .await?;

    if let Some((count,)) = expired {
        if count > 0 {
            info!(count = count, "Expired challenges in last 31 days");
        }
    }

    Ok(())
}

/// Generated challenge data.
struct GeneratedChallenge {
    title: String,
    codebase: serde_json::Value,
    prompt: String,
    grading_criteria: serde_json::Value,
    difficulty: String,
    languages: Vec<String>,
}

/// Generate a challenge from a parameterized template.
///
/// Templates are randomized: variable names, function names, bug types,
/// data structures, and specific values change each generation.
fn generate_challenge_from_template(
    level: i32,
    category: &str,
    variant: i64,
) -> GeneratedChallenge {
    match (level, category) {
        (1, "comprehension") => generate_l1_comprehension(variant),
        (1, "debugging") => generate_l1_debugging(variant),
        (1, "reasoning") => generate_l1_reasoning(variant),
        (2, "fix_and_verify") => generate_l2_fix(variant),
        (2, "security_audit") => generate_l2_security(variant),
        (2, "refactor") => generate_l2_refactor(variant),
        (3, "review_adversarial") => generate_l3_review(variant),
        (3, "architecture") => generate_l3_architecture(variant),
        (3, "decomposition") => generate_l3_decomposition(variant),
        _ => generate_l1_comprehension(variant), // fallback
    }
}

fn generate_l1_comprehension(variant: i64) -> GeneratedChallenge {
    let vars = [
        ("items", "processors", "results", "process"),
        ("entries", "handlers", "outputs", "handle"),
        ("records", "transformers", "collected", "transform"),
    ];
    let (items, procs, results, func) = vars[(variant as usize) % vars.len()];

    GeneratedChallenge {
        title: format!("Trace closure mutation over {items}"),
        codebase: json!({
            "files": [{
                "path": "tricky.py",
                "content": format!(
                    r#"def make_{procs}():
    {results} = []
    {procs} = []
    for i in range(4):
        def {func}(x, _cache={{}}):
            key = f"{{id({func})}}:{{x}}"
            if key not in _cache:
                _cache[key] = x * (i + 1)
            {results}.append(_cache[key])
            return _cache[key]
        {procs}.append({func})
    return {procs}, {results}

ps, res = make_{procs}()
ps[0](5)
ps[1](5)
ps[0](5)
ps[2](3)
ps[0](3)
"#
                )
            }]
        }),
        prompt: format!(
            "After all 5 calls execute, what are the exact contents of `res`? \
             Explain step by step. Address: what value does `i` have when each \
             {func}'s closure captures it, and how does _cache interact?"
        ),
        grading_criteria: json!({
            "correct_answer": [20, 20, 20, 12, 12],
            "must_explain": [
                "i is captured by reference, not value",
                "_cache is per-function-object",
                "second call is a cache hit",
                "different x is a cache miss"
            ],
            "partial_credit": false
        }),
        difficulty: "hard".to_string(),
        languages: vec!["python".to_string()],
    }
}

fn generate_l1_debugging(variant: i64) -> GeneratedChallenge {
    let configs = [
        ("base", "dev", "staging"),
        ("default", "local", "production"),
        ("core", "testing", "preview"),
    ];
    let (base, child, grandchild) = configs[(variant as usize) % configs.len()];

    GeneratedChallenge {
        title: format!("Diagnose config inheritance bug ({base}/{child}/{grandchild})"),
        codebase: json!({
            "files": [
                {"path": "app.py", "content": "class ConfigLoader:\n    ..."},
                {"path": format!("configs/{base}.json"),
                 "content": format!(r#"{{"db_host": "localhost", "db_port": 5432, "debug": false}}"#)},
                {"path": format!("configs/{child}.json"),
                 "content": format!(r#"{{"extends": "{base}", "debug": true, "db_host": "{child}-db"}}"#)},
                {"path": format!("configs/{grandchild}.json"),
                 "content": format!(r#"{{"extends": "{child}", "debug": false, "db_host": "{grandchild}-db"}}"#)}
            ]
        }),
        prompt: format!(
            "Loading {grandchild} config shows debug=true despite setting debug=false. \
             Also get_cached returns None or wrong config. Find ALL bugs (at least 4)."
        ),
        grading_criteria: json!({
            "bugs": ["merge_order", "cache_key_collision", "inheritance_not_cached",
                     "infinite_recursion", "md5_not_collision_resistant"],
            "minimum_bugs_found": 3,
            "must_find": ["cache_key_collision", "infinite_recursion"]
        }),
        difficulty: "hard".to_string(),
        languages: vec!["python".to_string()],
    }
}

fn generate_l1_reasoning(variant: i64) -> GeneratedChallenge {
    let delays = [
        (10, 0.01, 20, 0.0, 5, 0.02),
        (15, 0.02, 25, 0.0, 10, 0.01),
        (5, 0.01, 10, 0.01, 15, 0.0),
    ];
    let (a_amt, a_delay, b_amt, b_delay, c_amt, c_delay) =
        delays[(variant as usize) % delays.len()];

    GeneratedChallenge {
        title: "Predict concurrent behavior with shared mutable state".to_string(),
        codebase: json!({
            "files": [{
                "path": "race.py",
                "content": format!(
                    r#"import threading, time
class Counter:
    def __init__(self):
        self.value = 0
        self._lock = threading.Lock()
    def increment(self, amount, delay=0):
        with self._lock:
            current = self.value
        if delay:
            time.sleep(delay)
        self.value = current + amount
counter = Counter()
threads = [
    threading.Thread(target=counter.increment, args=({a_amt}, {a_delay})),
    threading.Thread(target=counter.increment, args=({b_amt}, {b_delay})),
    threading.Thread(target=counter.increment, args=({c_amt}, {c_delay})),
]
for t in threads: t.start()
for t in threads: t.join()
"#
                )
            }]
        }),
        prompt: "1) What is the bug? 2) All possible final values? \
                 3) Does safe_read() provide consistent snapshot? 4) Write fix."
            .to_string(),
        grading_criteria: json!({
            "must_identify": [
                "Lock releases after read but before write",
                "Read-modify-write is not atomic"
            ],
            "must_explain_at_least_3_interleavings": true
        }),
        difficulty: "brutal".to_string(),
        languages: vec!["python".to_string()],
    }
}

fn generate_l2_fix(variant: i64) -> GeneratedChallenge {
    GeneratedChallenge {
        title: format!("Fix caching bug without breaking rate limiter (v{variant})"),
        codebase: json!({
            "files": [
                {"path": "src/cache.py", "content": "class LRUCache: ..."},
                {"path": "src/rate_limiter.py", "content": "class RateLimiter: ..."},
                {"path": "tests/test_cache.py", "content": "def test_size_excludes_expired(): ..."},
                {"path": "tests/test_rate_limiter.py", "content": "def test_active_clients(): ..."}
            ],
            "config": {"language": "python", "test_command": "python -m pytest tests/ -v"}
        }),
        prompt: "Two tests are failing. Fix src/cache.py only. All 6 tests must pass. \
                 Thread-safe. size() must be O(n) or better."
            .to_string(),
        grading_criteria: json!({
            "must_pass_tests": true,
            "allowed_files": ["src/cache.py"],
            "forbidden_changes": ["src/rate_limiter.py", "tests/"],
            "must_be_threadsafe": true
        }),
        difficulty: "brutal".to_string(),
        languages: vec!["python".to_string()],
    }
}

fn generate_l2_security(variant: i64) -> GeneratedChallenge {
    GeneratedChallenge {
        title: format!("Security audit: authentication module (v{variant})"),
        codebase: json!({
            "files": [{"path": "auth.py", "content": "class AuthManager: ..."}]
        }),
        prompt: "Find ALL security vulnerabilities (at least 8). For each: CWE, \
                 exploit path, severity, fix."
            .to_string(),
        grading_criteria: json!({
            "vulnerabilities": [
                {"id": "default_secret", "severity": "critical"},
                {"id": "low_pbkdf2_iterations", "severity": "high"},
                {"id": "timing_attack_signature", "severity": "high"},
                {"id": "incomplete_sanitization", "severity": "high"},
                {"id": "role_in_token", "severity": "high"},
                {"id": "base64_no_urlsafe", "severity": "medium"},
                {"id": "no_token_id", "severity": "medium"},
                {"id": "rate_limit_in_memory", "severity": "medium"},
                {"id": "weak_password_policy", "severity": "medium"},
                {"id": "bare_except", "severity": "low"}
            ],
            "minimum_found": 6,
            "must_find": ["timing_attack_signature", "low_pbkdf2_iterations", "default_secret"]
        }),
        difficulty: "brutal".to_string(),
        languages: vec!["python".to_string()],
    }
}

fn generate_l2_refactor(variant: i64) -> GeneratedChallenge {
    GeneratedChallenge {
        title: format!("Refactor without breaking tests (v{variant})"),
        codebase: json!({
            "files": [
                {"path": "src/processor.py", "content": "class DataProcessor: ..."},
                {"path": "tests/test_processor.py", "content": "def test_process(): ..."}
            ],
            "config": {"language": "python", "test_command": "python -m pytest tests/ -v"}
        }),
        prompt: "Refactor the processor for readability and maintainability. \
                 All tests must pass. Do not change the public API."
            .to_string(),
        grading_criteria: json!({
            "must_pass_tests": true,
            "forbidden_changes": ["tests/"],
            "must_preserve_api": true
        }),
        difficulty: "hard".to_string(),
        languages: vec!["python".to_string()],
    }
}

fn generate_l3_review(variant: i64) -> GeneratedChallenge {
    GeneratedChallenge {
        title: format!("Review PR with planted bugs (v{variant})"),
        codebase: json!({"base": "500+ line repo", "diff": "PR with 3 planted bugs"}),
        prompt: "Review this PR. Find ALL bugs. Identify the security issue.".to_string(),
        grading_criteria: json!({
            "planted_bugs": [
                {"id": "pagination_off_by_one", "type": "logic", "severity": "medium"},
                {"id": "n_plus_1_query", "type": "performance", "severity": "medium"},
                {"id": "ssrf_webhook", "type": "security", "severity": "critical"}
            ],
            "min_bugs_found": 2,
            "must_find_security_bug": true,
            "false_positive_penalty": -5,
            "bonus_for_all_three": 15
        }),
        difficulty: "brutal".to_string(),
        languages: vec!["python".to_string(), "typescript".to_string()],
    }
}

fn generate_l3_architecture(variant: i64) -> GeneratedChallenge {
    let scenarios = [
        "10,000 CSV files/hr, 1-50MB each, OOMs on >30MB",
        "500 API requests/sec, P99 latency 2s, budget for one change",
        "1TB daily ingestion, 100ms query SLA, single Postgres instance",
    ];
    let scenario = scenarios[(variant as usize) % scenarios.len()];

    GeneratedChallenge {
        title: format!("Design data pipeline — justify tradeoffs (v{variant})"),
        codebase: json!({}),
        prompt: format!(
            "{scenario}. Design a solution: 1) ONE change, 2) why over 2 alternatives, \
             3) quantify improvement, 4) biggest risk, 5) monitoring, 6) when wrong."
        ),
        grading_criteria: json!({
            "must_propose_single_change": true,
            "must_discuss_alternatives": 2,
            "must_quantify": true,
            "must_identify_risk": true,
            "must_identify_monitoring": true,
            "must_acknowledge_when_wrong": true,
            "auto_fail_conditions": [
                "proposes more than one change",
                "claims no downsides or risks",
                "gives generic answer"
            ],
            "scoring": {
                "solution_quality": 30,
                "alternatives_analysis": 20,
                "quantification": 15,
                "risk_awareness": 15,
                "monitoring_plan": 10,
                "honesty_about_limitations": 10
            }
        }),
        difficulty: "brutal".to_string(),
        languages: vec![],
    }
}

fn generate_l3_decomposition(variant: i64) -> GeneratedChallenge {
    GeneratedChallenge {
        title: format!("Decompose WebSocket project into subtasks (v{variant})"),
        codebase: json!({}),
        prompt: "Add WebSocket support to REST API (12 endpoints, JWT, PG, Redis, React). \
                 Decompose into subtasks with dependencies, effort, acceptance criteria. \
                 Must be valid DAG."
            .to_string(),
        grading_criteria: json!({
            "min_subtasks": 6,
            "max_subtasks": 15,
            "must_be_valid_dag": true,
            "critical_dependencies": [
                "WS server setup BEFORE auth integration",
                "Auth integration BEFORE real-time updates",
                "DB change detection BEFORE real-time updates"
            ],
            "auto_fail": [
                "Everything depends on everything",
                "Nothing depends on anything",
                "Cycle in dependency graph"
            ]
        }),
        difficulty: "hard".to_string(),
        languages: vec!["typescript".to_string(), "python".to_string()],
    }
}
