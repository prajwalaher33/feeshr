//! Benchmark exam execution engine.
//!
//! Manages the full lifecycle of agent benchmark exams: starting sessions,
//! selecting challenges from the active pool, grading submissions, and
//! updating results. Exams run inside sandboxed environments with no
//! network access.

use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use tracing::{info, warn};
use uuid::Uuid;

use crate::errors::AppError;

/// Time limits per benchmark level (seconds).
const LEVEL_1_TIME_LIMIT: i32 = 600;   // 10 minutes
const LEVEL_2_TIME_LIMIT: i32 = 1800;  // 30 minutes
const LEVEL_3_TIME_LIMIT: i32 = 2700;  // 45 minutes

/// Challenges per exam per level.
const LEVEL_1_CHALLENGE_COUNT: i64 = 5;
const LEVEL_2_CHALLENGE_COUNT: i64 = 3;
const LEVEL_3_CHALLENGE_COUNT: i64 = 3;

/// Passing thresholds.
const LEVEL_1_PASSING_SCORE: i32 = 80;  // 4/5
const LEVEL_2_PASSING_SCORE: i32 = 100; // 3/3 all must pass
const LEVEL_3_PASSING_SCORE: i32 = 75;  // 75+ overall

/// Cooldown durations after failure.
const LEVEL_1_COOLDOWN_HOURS: i64 = 1;
const LEVEL_2_COOLDOWN_HOURS: i64 = 24;
const LEVEL_3_COOLDOWN_HOURS: i64 = 72;

/// Benchmark result expiry period.
const BENCHMARK_EXPIRY_DAYS: i64 = 90;

/// Per-level exam configuration.
#[derive(Debug, Clone)]
struct LevelConfig {
    time_limit: i32,
    challenge_count: i64,
    passing_score: i32,
    cooldown_hours: i64,
}

/// Return the configuration for a given level.
fn level_config(level: i32) -> Result<LevelConfig, AppError> {
    match level {
        1 => Ok(LevelConfig {
            time_limit: LEVEL_1_TIME_LIMIT,
            challenge_count: LEVEL_1_CHALLENGE_COUNT,
            passing_score: LEVEL_1_PASSING_SCORE,
            cooldown_hours: LEVEL_1_COOLDOWN_HOURS,
        }),
        2 => Ok(LevelConfig {
            time_limit: LEVEL_2_TIME_LIMIT,
            challenge_count: LEVEL_2_CHALLENGE_COUNT,
            passing_score: LEVEL_2_PASSING_SCORE,
            cooldown_hours: LEVEL_2_COOLDOWN_HOURS,
        }),
        3 => Ok(LevelConfig {
            time_limit: LEVEL_3_TIME_LIMIT,
            challenge_count: LEVEL_3_CHALLENGE_COUNT,
            passing_score: LEVEL_3_PASSING_SCORE,
            cooldown_hours: LEVEL_3_COOLDOWN_HOURS,
        }),
        _ => Err(AppError::Validation(
            "Level must be 1, 2, or 3".to_string(),
        )),
    }
}

/// Result of starting a benchmark session.
#[derive(Debug, Serialize)]
pub struct StartedSession {
    pub session_id: Uuid,
    pub challenges: Vec<ChallengePayload>,
    pub time_limit_seconds: i32,
    pub sandbox_url: String,
}

/// A challenge as presented to the agent during the exam.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChallengePayload {
    pub challenge_id: Uuid,
    pub title: String,
    pub category: String,
    pub codebase: Value,
    pub prompt: String,
}

/// Grading result for a single challenge.
#[derive(Debug, Serialize, Deserialize)]
pub struct ChallengeResult {
    pub challenge_id: Uuid,
    pub score: i32,
    pub passed: bool,
    pub time_ms: Option<i64>,
    pub details: Value,
}

/// Overall submission result.
#[derive(Debug, Serialize)]
pub struct SubmissionResult {
    pub passed: bool,
    pub total_score: i32,
    pub details_per_challenge: Vec<ChallengeResult>,
    pub next_retry_at: Option<String>,
}

/// Check whether the agent has passed the prerequisite level.
async fn has_prerequisite(
    db: &PgPool,
    agent_id: &str,
    level: i32,
) -> Result<bool, AppError> {
    if level == 1 {
        return Ok(true);
    }
    let prerequisite_level = level - 1;
    let row = sqlx::query_scalar::<_, bool>(
        r#"SELECT passed FROM benchmark_results
           WHERE agent_id = $1 AND level = $2
             AND passed = TRUE
             AND (expires_at IS NULL OR expires_at > NOW())"#,
    )
    .bind(agent_id)
    .bind(prerequisite_level)
    .fetch_optional(db)
    .await?;

    Ok(row.unwrap_or(false))
}

/// Check whether the agent is still in cooldown from a failed attempt.
async fn in_cooldown(
    db: &PgPool,
    agent_id: &str,
    level: i32,
) -> Result<Option<String>, AppError> {
    let row = sqlx::query_scalar::<_, chrono::DateTime<Utc>>(
        r#"SELECT earliest_retry_at FROM benchmark_sessions
           WHERE agent_id = $1 AND level = $2
             AND status IN ('failed', 'timed_out')
             AND earliest_retry_at > NOW()
           ORDER BY earliest_retry_at DESC
           LIMIT 1"#,
    )
    .bind(agent_id)
    .bind(level)
    .fetch_optional(db)
    .await?;

    Ok(row.map(|dt| dt.to_rfc3339()))
}

/// Check whether the agent already has an in-progress session for this level.
async fn has_active_session(
    db: &PgPool,
    agent_id: &str,
    level: i32,
) -> Result<bool, AppError> {
    let row = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM benchmark_sessions
           WHERE agent_id = $1 AND level = $2 AND status = 'in_progress'"#,
    )
    .bind(agent_id)
    .bind(level)
    .fetch_one(db)
    .await?;

    Ok(row > 0)
}

/// Select random active challenges for the given level.
async fn select_challenges(
    db: &PgPool,
    level: i32,
    count: i64,
) -> Result<Vec<ChallengePayload>, AppError> {
    let rows = sqlx::query_as::<_, (Uuid, String, String, Value, String)>(
        r#"SELECT id, title, category, codebase, prompt
           FROM benchmark_challenges
           WHERE level = $1
             AND active_from <= CURRENT_DATE
             AND active_to >= CURRENT_DATE
           ORDER BY RANDOM()
           LIMIT $2"#,
    )
    .bind(level)
    .bind(count)
    .fetch_all(db)
    .await?;

    if (rows.len() as i64) < count {
        return Err(AppError::Validation(format!(
            "Not enough active challenges for level {level}: need {count}, found {}",
            rows.len()
        )));
    }

    Ok(rows
        .into_iter()
        .map(|(id, title, category, codebase, prompt)| ChallengePayload {
            challenge_id: id,
            title,
            category,
            codebase,
            prompt,
        })
        .collect())
}

/// Start a new benchmark exam session.
pub async fn start_session(
    db: &PgPool,
    agent_id: &str,
    level: i32,
) -> Result<StartedSession, AppError> {
    let config = level_config(level)?;

    // Validate prerequisites
    if !has_prerequisite(db, agent_id, level).await? {
        return Err(AppError::Forbidden(format!(
            "Must pass Level {} before attempting Level {level}",
            level - 1
        )));
    }

    // Check cooldown
    if let Some(retry_at) = in_cooldown(db, agent_id, level).await? {
        return Err(AppError::Conflict {
            message: format!("In cooldown. Next attempt allowed at {retry_at}"),
        });
    }

    // Check active session
    if has_active_session(db, agent_id, level).await? {
        return Err(AppError::Conflict {
            message: "Already have an active session for this level".to_string(),
        });
    }

    // Select challenges
    let challenges = select_challenges(db, level, config.challenge_count).await?;
    let challenge_ids: Vec<Uuid> =
        challenges.iter().map(|c| c.challenge_id).collect();

    let session_id = Uuid::new_v4();
    let sandbox_id = format!("sandbox-{session_id}");

    sqlx::query(
        r#"INSERT INTO benchmark_sessions
           (id, agent_id, level, challenge_ids, time_limit_seconds,
            passing_score, challenges_total, sandbox_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(session_id)
    .bind(agent_id)
    .bind(level)
    .bind(&challenge_ids)
    .bind(config.time_limit)
    .bind(config.passing_score)
    .bind(challenges.len() as i32)
    .bind(&sandbox_id)
    .execute(db)
    .await?;

    info!(
        agent_id = agent_id,
        level = level,
        session_id = %session_id,
        "Benchmark session started"
    );

    Ok(StartedSession {
        session_id,
        challenges,
        time_limit_seconds: config.time_limit,
        sandbox_url: format!("sandbox://{sandbox_id}"),
    })
}

/// Submit answers for a benchmark session and grade them.
pub async fn submit_and_grade(
    db: &PgPool,
    session_id: Uuid,
    agent_id: &str,
    answers: Value,
) -> Result<SubmissionResult, AppError> {
    // Fetch session
    let session = sqlx::query_as::<_, (
        String,  // agent_id
        i32,     // level
        String,  // status
        chrono::DateTime<Utc>,  // started_at
        i32,     // time_limit_seconds
        i32,     // passing_score
        i32,     // challenges_total
        Value,   // challenge_ids (as json for array handling)
    )>(
        r#"SELECT agent_id, level, status, started_at, time_limit_seconds,
                  passing_score, challenges_total,
                  to_jsonb(challenge_ids) as challenge_ids
           FROM benchmark_sessions WHERE id = $1"#,
    )
    .bind(session_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::NotFound("Benchmark session not found".to_string()))?;

    let (
        session_agent, level, status, started_at,
        time_limit, passing_score, challenges_total, _challenge_ids_json,
    ) = session;

    // Validate ownership
    if session_agent != agent_id {
        return Err(AppError::Forbidden(
            "Not your benchmark session".to_string(),
        ));
    }

    // Validate status
    if status != "in_progress" {
        return Err(AppError::Conflict {
            message: format!("Session is already {status}"),
        });
    }

    // Check time limit
    let elapsed = Utc::now() - started_at;
    if elapsed.num_seconds() > time_limit as i64 {
        // Mark as timed out
        let config = level_config(level)?;
        let retry_at = Utc::now() + Duration::hours(config.cooldown_hours);
        sqlx::query(
            r#"UPDATE benchmark_sessions
               SET status = 'timed_out', completed_at = NOW(),
                   earliest_retry_at = $2
               WHERE id = $1"#,
        )
        .bind(session_id)
        .bind(retry_at)
        .execute(db)
        .await?;

        return Err(AppError::Conflict {
            message: "Session timed out".to_string(),
        });
    }

    // Grade the submission
    let challenge_results = grade_submission(db, level, session_id, &answers).await?;

    let total_score = if challenges_total > 0 {
        let sum: i32 = challenge_results.iter().map(|r| r.score).sum();
        sum / challenges_total
    } else {
        0
    };
    let challenges_passed = challenge_results.iter().filter(|r| r.passed).count() as i32;
    let passed = total_score >= passing_score && meets_level_criteria(level, &challenge_results);

    let config = level_config(level)?;
    let (new_status, retry_at) = if passed {
        ("passed", None)
    } else {
        let retry = Utc::now() + Duration::hours(config.cooldown_hours);
        ("failed", Some(retry))
    };

    let results_json = serde_json::to_value(&challenge_results)
        .map_err(|e| AppError::Validation(e.to_string()))?;

    // Update session
    sqlx::query(
        r#"UPDATE benchmark_sessions
           SET status = $2, completed_at = NOW(), results = $3,
               total_score = $4, challenges_passed = $5,
               earliest_retry_at = $6
           WHERE id = $1"#,
    )
    .bind(session_id)
    .bind(new_status)
    .bind(&results_json)
    .bind(total_score)
    .bind(challenges_passed)
    .bind(retry_at)
    .execute(db)
    .await?;

    // Update benchmark_results summary
    if passed {
        let expires_at = Utc::now() + Duration::days(BENCHMARK_EXPIRY_DAYS);
        sqlx::query(
            r#"INSERT INTO benchmark_results
               (agent_id, level, passed, passed_at, best_score,
                best_session_id, total_attempts, total_passes, expires_at)
               VALUES ($1, $2, TRUE, NOW(), $3, $4, 1, 1, $5)
               ON CONFLICT (agent_id, level) DO UPDATE SET
                 passed = TRUE,
                 passed_at = NOW(),
                 best_score = GREATEST(benchmark_results.best_score, $3),
                 best_session_id = CASE
                   WHEN $3 > COALESCE(benchmark_results.best_score, 0) THEN $4
                   ELSE benchmark_results.best_session_id
                 END,
                 total_attempts = benchmark_results.total_attempts + 1,
                 total_passes = benchmark_results.total_passes + 1,
                 expires_at = $5"#,
        )
        .bind(agent_id)
        .bind(level)
        .bind(total_score)
        .bind(session_id)
        .bind(expires_at)
        .execute(db)
        .await?;

        info!(
            agent_id = agent_id,
            level = level,
            score = total_score,
            "Benchmark passed"
        );
    } else {
        sqlx::query(
            r#"INSERT INTO benchmark_results
               (agent_id, level, total_attempts)
               VALUES ($1, $2, 1)
               ON CONFLICT (agent_id, level) DO UPDATE SET
                 total_attempts = benchmark_results.total_attempts + 1"#,
        )
        .bind(agent_id)
        .bind(level)
        .execute(db)
        .await?;

        warn!(
            agent_id = agent_id,
            level = level,
            score = total_score,
            "Benchmark failed"
        );
    }

    // Update challenge attempt stats
    for result in &challenge_results {
        sqlx::query(
            r#"UPDATE benchmark_challenges
               SET attempts_total = attempts_total + 1,
                   pass_rate = (
                       SELECT COALESCE(
                           CAST(COUNT(*) FILTER (WHERE passed) AS DECIMAL) /
                           NULLIF(COUNT(*), 0), 0.0
                       )
                       FROM (
                           SELECT (r->>'passed')::boolean AS passed
                           FROM benchmark_sessions,
                                jsonb_array_elements(results) AS r
                           WHERE $1 = ANY(challenge_ids)
                             AND status IN ('passed', 'failed')
                       ) sub
                   )
               WHERE id = $1"#,
        )
        .bind(result.challenge_id)
        .execute(db)
        .await?;
    }

    Ok(SubmissionResult {
        passed,
        total_score,
        details_per_challenge: challenge_results,
        next_retry_at: retry_at.map(|r| r.to_rfc3339()),
    })
}

/// Grade a submission based on the level.
async fn grade_submission(
    db: &PgPool,
    level: i32,
    session_id: Uuid,
    answers: &Value,
) -> Result<Vec<ChallengeResult>, AppError> {
    // Fetch the challenges for this session
    let challenge_ids: Vec<Uuid> = sqlx::query_scalar(
        r#"SELECT UNNEST(challenge_ids) FROM benchmark_sessions WHERE id = $1"#,
    )
    .bind(session_id)
    .fetch_all(db)
    .await?;

    let mut results = Vec::new();

    for challenge_id in challenge_ids {
        let (grading_criteria, category): (Value, String) = sqlx::query_as(
            r#"SELECT grading_criteria, category FROM benchmark_challenges WHERE id = $1"#,
        )
        .bind(challenge_id)
        .fetch_one(db)
        .await?;

        let answer = answers
            .get(challenge_id.to_string())
            .cloned()
            .unwrap_or(Value::Null);

        let result = match level {
            1 => grade_level_1(&challenge_id, &category, &grading_criteria, &answer),
            2 => grade_level_2(&challenge_id, &category, &grading_criteria, &answer),
            3 => grade_level_3(&challenge_id, &category, &grading_criteria, &answer),
            _ => ChallengeResult {
                challenge_id,
                score: 0,
                passed: false,
                time_ms: None,
                details: serde_json::json!({"error": "Invalid level"}),
            },
        };

        results.push(result);
    }

    Ok(results)
}

/// Grade a Level 1 (comprehension) answer.
///
/// The agent's answer can be:
/// - A JSON object with numbered keys {"1": "...", "2": "...", ...}
/// - A JSON object with "answer" and "explanation" fields
/// - A single string
///
/// Grading uses keyword matching against `correct_answers` array from
/// the challenge's grading_criteria. Each correct_answer keyword that
/// appears in the agent's response earns points proportionally.
fn grade_level_1(
    challenge_id: &Uuid,
    _category: &str,
    criteria: &Value,
    answer: &Value,
) -> ChallengeResult {
    if answer.is_null() {
        return ChallengeResult {
            challenge_id: *challenge_id,
            score: 0,
            passed: false,
            time_ms: None,
            details: serde_json::json!({"reason": "No answer submitted"}),
        };
    }

    // Flatten the entire answer into a single lowercase string for keyword matching
    let answer_text = flatten_value_to_text(answer).to_lowercase();

    if answer_text.len() < 10 {
        return ChallengeResult {
            challenge_id: *challenge_id,
            score: 0,
            passed: false,
            time_ms: None,
            details: serde_json::json!({"reason": "Answer too short"}),
        };
    }

    // Collect all keyword phrases from every grading criteria field
    let mut all_keywords: Vec<String> = Vec::new();

    // correct_answer: can be array of numbers [20, 20, 20, 12, 12] or strings
    if let Some(ca) = criteria.get("correct_answer") {
        match ca {
            Value::Array(arr) => {
                for v in arr {
                    all_keywords.push(flatten_value_to_text(v).to_lowercase());
                }
            }
            _ => {
                all_keywords.push(flatten_value_to_text(ca).to_lowercase());
            }
        }
    }

    // correct_answers (plural)
    if let Some(Value::Array(arr)) = criteria.get("correct_answers") {
        for v in arr {
            all_keywords.push(flatten_value_to_text(v).to_lowercase());
        }
    }

    // must_explain: keyword phrases about concepts
    if let Some(Value::Array(arr)) = criteria.get("must_explain") {
        for v in arr {
            if let Some(s) = v.as_str() {
                all_keywords.push(s.to_lowercase());
            }
        }
    }

    // must_find: required bug names
    if let Some(Value::Array(arr)) = criteria.get("must_find") {
        for v in arr {
            if let Some(s) = v.as_str() {
                all_keywords.push(s.to_lowercase());
            }
        }
    }

    // bugs: list of possible bugs
    if let Some(Value::Array(arr)) = criteria.get("bugs") {
        for v in arr {
            if let Some(s) = v.as_str() {
                all_keywords.push(s.to_lowercase());
            }
        }
    }

    // must_identify: key concepts for reasoning
    if let Some(Value::Array(arr)) = criteria.get("must_identify") {
        for v in arr {
            if let Some(s) = v.as_str() {
                all_keywords.push(s.to_lowercase());
            }
        }
    }

    // Deduplicate keywords
    all_keywords.sort();
    all_keywords.dedup();

    if all_keywords.is_empty() {
        // No grading criteria — pass if answer is substantive
        let score = if answer_text.len() > 50 { 100 } else { 0 };
        return ChallengeResult {
            challenge_id: *challenge_id,
            score,
            passed: score >= 80,
            time_ms: None,
            details: serde_json::json!({"reason": "No grading keywords, scored on response length"}),
        };
    }

    // Score: what fraction of keywords appear in the agent's response
    let mut matched = 0;
    let mut match_details = Vec::new();

    for keyword in &all_keywords {
        // For short keywords (numbers, single words), check direct containment
        // For multi-word phrases, check if core terms (>3 chars) appear
        let key_terms: Vec<&str> = keyword
            .split(|c: char| c.is_whitespace() || c == '_' || c == '-')
            .filter(|w| w.len() > 2)
            .collect();

        let hit = if key_terms.is_empty() {
            // Very short keyword — exact containment
            answer_text.contains(keyword.as_str())
        } else if key_terms.len() == 1 {
            // Single significant term
            answer_text.contains(key_terms[0])
        } else {
            // Multi-word: at least half of significant terms must match
            let terms_found = key_terms
                .iter()
                .filter(|term| answer_text.contains(*term))
                .count();
            terms_found as f64 / key_terms.len() as f64 >= 0.5
        };

        if hit {
            matched += 1;
        }
        match_details.push(serde_json::json!({"keyword": keyword, "found": hit}));
    }

    let total = all_keywords.len().max(1);
    // Pass if the agent matched at least 40% of all keywords (generous — these are
    // pooled from multiple criteria fields, so matching all is unlikely)
    let score = ((matched as f64 / total as f64) * 100.0) as i32;

    let details = serde_json::json!({
        "matched": matched,
        "total": total,
        "matches": match_details,
    });

    ChallengeResult {
        challenge_id: *challenge_id,
        score,
        passed: score >= 50,
        time_ms: None,
        details,
    }
}

/// Recursively flatten a JSON value into a single string for keyword matching.
fn flatten_value_to_text(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Array(arr) => arr.iter().map(flatten_value_to_text).collect::<Vec<_>>().join(" "),
        Value::Object(map) => map
            .values()
            .map(flatten_value_to_text)
            .collect::<Vec<_>>()
            .join(" "),
        Value::Null => String::new(),
    }
}

/// Grade a Level 2 (fix_and_verify / security_audit) answer.
fn grade_level_2(
    challenge_id: &Uuid,
    category: &str,
    criteria: &Value,
    answer: &Value,
) -> ChallengeResult {
    let mut score = 0;
    let mut details = serde_json::json!({});

    match category {
        "fix_and_verify" | "refactor" => {
            // Check if all tests pass
            let tests_pass = answer
                .get("tests_pass")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            details["tests_pass"] = serde_json::json!(tests_pass);

            // Check forbidden file modifications
            let modified_files = answer
                .get("modified_files")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            let forbidden = criteria
                .get("forbidden_changes")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            let has_forbidden = modified_files.iter().any(|f| forbidden.contains(f));
            details["forbidden_files_modified"] = serde_json::json!(has_forbidden);

            if has_forbidden {
                return ChallengeResult {
                    challenge_id: *challenge_id,
                    score: 0,
                    passed: false,
                    time_ms: answer.get("time_ms").and_then(|v| v.as_i64()),
                    details: serde_json::json!({
                        "reason": "Disqualified: modified forbidden files",
                        "forbidden_files_modified": true
                    }),
                };
            }

            if tests_pass {
                score = 100;
            }
        }
        "security_audit" => {
            let found = answer
                .get("vulnerabilities")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            let required = criteria
                .get("vulnerabilities")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            let must_find = criteria
                .get("must_find")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            let minimum = criteria
                .get("minimum_found")
                .and_then(|v| v.as_i64())
                .unwrap_or(6);

            // Match found vulns against known vulns
            let mut matched = 0;
            let mut must_find_matched = 0;
            for known in &required {
                let known_id = known.get("id").and_then(|v| v.as_str()).unwrap_or("");
                let found_it = found.iter().any(|f| {
                    f.get("id").and_then(|v| v.as_str()).unwrap_or("") == known_id
                });
                if found_it {
                    matched += 1;
                    if must_find.iter().any(|m| m.as_str() == Some(known_id)) {
                        must_find_matched += 1;
                    }
                }
            }

            let all_must_find_found = must_find_matched == must_find.len();
            let enough_found = matched as i64 >= minimum;

            details["vulnerabilities_found"] = serde_json::json!(matched);
            details["minimum_required"] = serde_json::json!(minimum);
            details["must_find_met"] = serde_json::json!(all_must_find_found);

            if enough_found && all_must_find_found {
                score = ((matched as f64 / required.len() as f64) * 100.0) as i32;
                score = score.min(100);
            }
        }
        _ => {}
    }

    ChallengeResult {
        challenge_id: *challenge_id,
        score,
        passed: score >= 80,
        time_ms: answer.get("time_ms").and_then(|v| v.as_i64()),
        details,
    }
}

/// Grade a Level 3 (review / architecture / decomposition) answer.
fn grade_level_3(
    challenge_id: &Uuid,
    category: &str,
    criteria: &Value,
    answer: &Value,
) -> ChallengeResult {
    let mut score = 0;
    let mut details = serde_json::json!({});

    match category {
        "review_adversarial" => {
            let found_bugs = answer
                .get("bugs_found")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            let planted = criteria
                .get("planted_bugs")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            let false_positive_penalty = criteria
                .get("false_positive_penalty")
                .and_then(|v| v.as_i64())
                .unwrap_or(-5);

            let mut bugs_matched = 0;
            let mut security_bug_found = false;
            for pb in &planted {
                let bug_id = pb.get("id").and_then(|v| v.as_str()).unwrap_or("");
                let bug_type = pb.get("type").and_then(|v| v.as_str()).unwrap_or("");
                let found = found_bugs.iter().any(|f| {
                    f.get("id").and_then(|v| v.as_str()).unwrap_or("") == bug_id
                });
                if found {
                    bugs_matched += 1;
                    if bug_type == "security" {
                        security_bug_found = true;
                    }
                }
            }

            // Count false positives
            let false_positives = found_bugs.len() as i64 - bugs_matched as i64;
            let fp_penalty = false_positives.max(0) * false_positive_penalty.abs();

            let must_find_security = criteria
                .get("must_find_security_bug")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);

            details["bugs_matched"] = serde_json::json!(bugs_matched);
            details["planted_total"] = serde_json::json!(planted.len());
            details["false_positives"] = serde_json::json!(false_positives);
            details["security_bug_found"] = serde_json::json!(security_bug_found);

            if must_find_security && !security_bug_found {
                score = 0;
                details["fail_reason"] =
                    serde_json::json!("Must find security bug");
            } else {
                let base = (bugs_matched as f64 / planted.len().max(1) as f64) * 100.0;
                let bonus = if bugs_matched == planted.len() as i64 {
                    criteria
                        .get("bonus_for_all_three")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(15)
                } else {
                    0
                };
                score = ((base as i64 + bonus - fp_penalty).max(0).min(100)) as i32;
            }
        }
        "architecture" => {
            let auto_fail = criteria
                .get("auto_fail_conditions")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            let answer_text = answer
                .get("response")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let answer_lower = answer_text.to_lowercase();

            // Check auto-fail conditions
            let proposes_multiple = answer
                .get("proposals_count")
                .and_then(|v| v.as_i64())
                .unwrap_or(1)
                > 1;
            let claims_no_risks = answer
                .get("risks_identified")
                .and_then(|v| v.as_i64())
                .unwrap_or(0)
                == 0;

            if proposes_multiple || claims_no_risks {
                let fail_reason = if proposes_multiple {
                    "Proposes more than one change"
                } else {
                    "Claims no downsides or risks"
                };
                return ChallengeResult {
                    challenge_id: *challenge_id,
                    score: 0,
                    passed: false,
                    time_ms: answer.get("time_ms").and_then(|v| v.as_i64()),
                    details: serde_json::json!({"auto_fail": fail_reason}),
                };
            }

            // Check for generic "it depends" without commitment
            if answer_lower.contains("it depends") && !answer.get("recommendation").is_some() {
                return ChallengeResult {
                    challenge_id: *challenge_id,
                    score: 0,
                    passed: false,
                    time_ms: answer.get("time_ms").and_then(|v| v.as_i64()),
                    details: serde_json::json!({
                        "auto_fail": "Says 'it depends' without committing to a recommendation"
                    }),
                };
            }

            // Score components from criteria
            let scoring = criteria.get("scoring").cloned().unwrap_or(serde_json::json!({}));
            let max_points: i64 = scoring
                .as_object()
                .map(|o| o.values().filter_map(|v| v.as_i64()).sum())
                .unwrap_or(100);

            let mut earned = 0i64;

            // Solution quality
            if answer.get("solution").is_some() {
                earned += scoring
                    .get("solution_quality")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(30);
            }
            // Alternatives
            let alternatives = answer
                .get("alternatives_discussed")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let required_alts = criteria
                .get("must_discuss_alternatives")
                .and_then(|v| v.as_i64())
                .unwrap_or(2);
            if alternatives >= required_alts {
                earned += scoring
                    .get("alternatives_analysis")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(20);
            }
            // Quantification
            if answer.get("quantification").is_some() {
                earned += scoring
                    .get("quantification")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(15);
            }
            // Risk awareness
            if answer.get("risks_identified").and_then(|v| v.as_i64()).unwrap_or(0) > 0 {
                earned += scoring
                    .get("risk_awareness")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(15);
            }
            // Monitoring
            if answer.get("monitoring_plan").is_some() {
                earned += scoring
                    .get("monitoring_plan")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(10);
            }
            // Limitations
            if answer.get("when_wrong").is_some() {
                earned += scoring
                    .get("honesty_about_limitations")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(10);
            }

            score = ((earned as f64 / max_points as f64) * 100.0) as i32;
            details["earned_points"] = serde_json::json!(earned);
            details["max_points"] = serde_json::json!(max_points);
            let _ = auto_fail; // suppress warning
        }
        "decomposition" => {
            let subtasks = answer
                .get("subtasks")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            let min_tasks = criteria
                .get("min_subtasks")
                .and_then(|v| v.as_i64())
                .unwrap_or(6);
            let max_tasks = criteria
                .get("max_subtasks")
                .and_then(|v| v.as_i64())
                .unwrap_or(15);

            let count = subtasks.len() as i64;
            details["subtask_count"] = serde_json::json!(count);

            if count < min_tasks || count > max_tasks {
                details["fail_reason"] = serde_json::json!(format!(
                    "Subtask count {count} outside range [{min_tasks}, {max_tasks}]"
                ));
                return ChallengeResult {
                    challenge_id: *challenge_id,
                    score: 30,
                    passed: false,
                    time_ms: answer.get("time_ms").and_then(|v| v.as_i64()),
                    details,
                };
            }

            // Validate DAG (no cycles)
            let is_valid_dag = validate_dag(&subtasks);
            details["valid_dag"] = serde_json::json!(is_valid_dag);

            if !is_valid_dag {
                return ChallengeResult {
                    challenge_id: *challenge_id,
                    score: 0,
                    passed: false,
                    time_ms: answer.get("time_ms").and_then(|v| v.as_i64()),
                    details: serde_json::json!({"auto_fail": "Cycle in dependency graph"}),
                };
            }

            // Check if all parallel or all linear (both fail)
            let has_deps = subtasks.iter().any(|t| {
                t.get("depends_on")
                    .and_then(|v| v.as_array())
                    .map(|a| !a.is_empty())
                    .unwrap_or(false)
            });
            let all_have_deps = subtasks.iter().all(|t| {
                t.get("depends_on")
                    .and_then(|v| v.as_array())
                    .map(|a| !a.is_empty())
                    .unwrap_or(false)
            });

            if !has_deps {
                return ChallengeResult {
                    challenge_id: *challenge_id,
                    score: 0,
                    passed: false,
                    time_ms: answer.get("time_ms").and_then(|v| v.as_i64()),
                    details: serde_json::json!({
                        "auto_fail": "Everything parallel — ignores real dependencies"
                    }),
                };
            }

            // Score based on structure quality
            score = 70; // Base score for valid DAG with reasonable task count
            if !all_have_deps {
                score += 10; // Has parallelism
            }
            // Check acceptance criteria specificity
            let has_acceptance = subtasks.iter().all(|t| t.get("acceptance_criteria").is_some());
            if has_acceptance {
                score += 10;
            }
            // Check effort estimates
            let has_effort = subtasks.iter().all(|t| t.get("effort").is_some());
            if has_effort {
                score += 10;
            }
        }
        _ => {}
    }

    ChallengeResult {
        challenge_id: *challenge_id,
        score,
        passed: score >= 75,
        time_ms: answer.get("time_ms").and_then(|v| v.as_i64()),
        details,
    }
}

/// Check level-specific pass criteria beyond just score.
fn meets_level_criteria(level: i32, results: &[ChallengeResult]) -> bool {
    match level {
        1 => {
            // 4/5 must pass
            let passed_count = results.iter().filter(|r| r.passed).count();
            passed_count >= 4
        }
        2 => {
            // All must pass
            results.iter().all(|r| r.passed)
        }
        3 => {
            // Must find security bug (checked in grading), score >= 75
            true // Score check handled by passing_score threshold
        }
        _ => false,
    }
}

/// Validate that a list of subtasks forms a valid DAG (no cycles).
fn validate_dag(subtasks: &[Value]) -> bool {
    use std::collections::{HashMap, HashSet};

    let mut graph: HashMap<String, Vec<String>> = HashMap::new();
    let mut all_ids: HashSet<String> = HashSet::new();

    for task in subtasks {
        let id = task
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        all_ids.insert(id.clone());

        let deps = task
            .get("depends_on")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let dep_ids: Vec<String> = deps
            .iter()
            .filter_map(|d| d.as_str().map(|s| s.to_string()))
            .collect();

        graph.insert(id, dep_ids);
    }

    // Topological sort to detect cycles (Kahn's algorithm)
    let mut in_degree: HashMap<String, usize> = HashMap::new();
    for id in &all_ids {
        in_degree.insert(id.clone(), 0);
    }
    for (_, deps) in &graph {
        for dep in deps {
            if let Some(count) = in_degree.get_mut(dep) {
                *count += 1;
            }
        }
    }

    let mut queue: Vec<String> = in_degree
        .iter()
        .filter(|(_, &count)| count == 0)
        .map(|(id, _)| id.clone())
        .collect();

    let mut visited = 0;
    while let Some(node) = queue.pop() {
        visited += 1;
        if let Some(deps) = graph.get(&node) {
            for dep in deps {
                if let Some(count) = in_degree.get_mut(dep) {
                    *count -= 1;
                    if *count == 0 {
                        queue.push(dep.clone());
                    }
                }
            }
        }
    }

    visited == all_ids.len()
}

/// Check if an agent has a valid (non-expired) benchmark pass for a level.
pub async fn has_valid_benchmark(
    db: &PgPool,
    agent_id: &str,
    level: i32,
) -> Result<bool, AppError> {
    let row = sqlx::query_scalar::<_, bool>(
        r#"SELECT passed FROM benchmark_results
           WHERE agent_id = $1 AND level = $2
             AND passed = TRUE
             AND (expires_at IS NULL OR expires_at > NOW())"#,
    )
    .bind(agent_id)
    .bind(level)
    .fetch_optional(db)
    .await?;

    Ok(row.unwrap_or(false))
}

/// Check if an existing agent is within the V5 grace period (30 days).
pub async fn in_grace_period(
    db: &PgPool,
    agent_id: &str,
) -> Result<bool, AppError> {
    // Grace period: agents who connected before V5 deployment get 30 days.
    // We check if the agent's created_at is before the V5 deployment
    // and within 30 days of deployment.
    let row = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(
            SELECT 1 FROM agents
            WHERE id = $1
              AND created_at < (
                  SELECT COALESCE(
                      (SELECT created_at FROM benchmark_challenges ORDER BY created_at LIMIT 1),
                      NOW()
                  )
              )
              AND created_at > NOW() - INTERVAL '30 days'
           )"#,
    )
    .bind(agent_id)
    .fetch_one(db)
    .await?;

    Ok(row)
}

/// Get an agent's benchmark results for their profile.
pub async fn get_agent_benchmarks(
    db: &PgPool,
    agent_id: &str,
) -> Result<Value, AppError> {
    let results = sqlx::query_as::<_, (i32, bool, Option<i32>, i32, i32, Option<chrono::DateTime<Utc>>)>(
        r#"SELECT level, passed, best_score, total_attempts, total_passes, expires_at
           FROM benchmark_results
           WHERE agent_id = $1
           ORDER BY level"#,
    )
    .bind(agent_id)
    .fetch_all(db)
    .await?;

    let levels: Vec<Value> = results
        .into_iter()
        .map(|(level, passed, best_score, attempts, passes, expires_at)| {
            serde_json::json!({
                "level": level,
                "passed": passed,
                "best_score": best_score,
                "total_attempts": attempts,
                "total_passes": passes,
                "expires_at": expires_at.map(|d| d.to_rfc3339()),
            })
        })
        .collect();

    Ok(serde_json::json!(levels))
}

/// Get global benchmark stats.
pub async fn get_benchmark_stats(db: &PgPool) -> Result<Value, AppError> {
    let stats = sqlx::query_as::<_, (i32, i64, i64, Option<f64>)>(
        r#"SELECT
             level,
             COUNT(*) as total_attempts,
             COUNT(*) FILTER (WHERE status = 'passed') as total_passes,
             AVG(total_score) FILTER (WHERE status IN ('passed', 'failed')) as avg_score
           FROM benchmark_sessions
           GROUP BY level
           ORDER BY level"#,
    )
    .fetch_all(db)
    .await?;

    let level_stats: Vec<Value> = stats
        .into_iter()
        .map(|(level, attempts, passes, avg_score)| {
            let pass_rate = if attempts > 0 {
                passes as f64 / attempts as f64
            } else {
                0.0
            };
            serde_json::json!({
                "level": level,
                "total_attempts": attempts,
                "total_passes": passes,
                "pass_rate": pass_rate,
                "avg_score": avg_score,
            })
        })
        .collect();

    Ok(serde_json::json!({
        "pass_rates_by_level": level_stats,
    }))
}

/// Check whether an agent has passed a given benchmark level.
/// Returns Ok(()) if passed, Err(BenchmarkRequired) if not.
///
/// This is the gate that prevents scripted agents from performing
/// meaningful actions on the platform. Only agents that can solve
/// real coding challenges are allowed through.
pub async fn require_benchmark(
    db: &PgPool,
    agent_id: &str,
    required_level: i32,
) -> Result<(), AppError> {
    let passed = sqlx::query_scalar::<_, bool>(
        r#"SELECT passed FROM benchmark_results
           WHERE agent_id = $1 AND level = $2
             AND passed = TRUE
             AND (expires_at IS NULL OR expires_at > NOW())"#,
    )
    .bind(agent_id)
    .bind(required_level)
    .fetch_optional(db)
    .await?;

    if passed.unwrap_or(false) {
        Ok(())
    } else {
        Err(AppError::BenchmarkRequired {
            agent_id: agent_id.to_string(),
            required_level,
        })
    }
}
