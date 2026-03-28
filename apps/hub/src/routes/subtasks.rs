//! Subtask routes: create, list, claim, complete.
//!
//! Subtasks are units of work attached to a parent (bounty, issue, project).
//! They support dependency graphs and skill-based agent assignment.

use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;
use chrono::Utc;
use crate::errors::AppError;
use crate::state::AppState;

/// Valid parent types for a subtask.
const VALID_PARENT_TYPES: &[&str] = &["bounty", "issue", "project"];

#[derive(Deserialize)]
pub struct CreateSubtaskRequest {
    pub parent_type: String,
    pub parent_id: String,
    pub title: String,
    pub description: String,
    pub required_skills: Vec<String>,
    #[serde(default)]
    pub depends_on: Vec<String>,
    pub estimated_effort: Option<String>,
    pub created_by: String,
}

#[derive(Deserialize)]
pub struct ListSubtasksQuery {
    pub parent_type: String,
    pub parent_id: String,
}

#[derive(Deserialize)]
pub struct ClaimSubtaskRequest {
    pub agent_id: String,
}

#[derive(Deserialize)]
pub struct CompleteSubtaskRequest {
    pub agent_id: String,
    pub output_ref: String,
}

/// Validate common fields on the create request.
fn validate_create_request(req: &CreateSubtaskRequest) -> Result<(), AppError> {
    if !VALID_PARENT_TYPES.contains(&req.parent_type.as_str()) {
        return Err(AppError::Validation(
            "parent_type must be one of: bounty, issue, project".to_string(),
        ));
    }
    if req.title.len() < 5 || req.title.len() > 200 {
        return Err(AppError::Validation(
            "title must be 5–200 characters".to_string(),
        ));
    }
    if req.description.len() < 10 {
        return Err(AppError::Validation(
            "description must be at least 10 characters".to_string(),
        ));
    }
    Ok(())
}

/// Parse a list of UUID strings into typed Uuids.
fn parse_dependency_ids(raw: &[String]) -> Result<Vec<Uuid>, AppError> {
    raw.iter()
        .map(|s| {
            s.parse::<Uuid>()
                .map_err(|_| AppError::Validation(format!("Invalid dependency UUID: {s}")))
        })
        .collect()
}

/// Check that all dependency IDs exist and return whether any are non-complete.
async fn resolve_dependencies(
    db: &sqlx::PgPool,
    dep_ids: &[Uuid],
) -> Result<bool, AppError> {
    if dep_ids.is_empty() {
        return Ok(false);
    }

    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT status FROM subtasks WHERE id = ANY($1)",
    )
    .bind(dep_ids)
    .fetch_all(db)
    .await?;

    if rows.len() != dep_ids.len() {
        return Err(AppError::Validation(
            "One or more dependency subtask IDs do not exist".to_string(),
        ));
    }

    let has_incomplete = rows.iter().any(|(s,)| s != "complete");
    Ok(has_incomplete)
}

/// Insert the subtask row and its dependency edges.
async fn insert_subtask(
    db: &sqlx::PgPool,
    id: Uuid,
    req: &CreateSubtaskRequest,
    parent_uuid: Uuid,
    status: &str,
    dep_ids: &[Uuid],
) -> Result<Value, AppError> {
    let now = Utc::now();

    sqlx::query(
        r#"INSERT INTO subtasks
           (id, parent_type, parent_id, title, description,
            required_skills, estimated_effort, status, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"#,
    )
    .bind(id)
    .bind(&req.parent_type)
    .bind(parent_uuid)
    .bind(&req.title)
    .bind(&req.description)
    .bind(&req.required_skills)
    .bind(&req.estimated_effort)
    .bind(status)
    .bind(&req.created_by)
    .bind(now)
    .execute(db)
    .await?;

    // Update depends_on array on the subtask
    if !dep_ids.is_empty() {
        sqlx::query(
            "UPDATE subtasks SET depends_on = $1 WHERE id = $2",
        )
        .bind(dep_ids)
        .bind(id)
        .execute(db)
        .await?;
    }

    let row: Value = sqlx::query_scalar(
        r#"SELECT row_to_json(s) FROM (
               SELECT * FROM subtasks WHERE id = $1
           ) s"#,
    )
    .bind(id)
    .fetch_one(db)
    .await?;

    Ok(row)
}

/// Create a new subtask attached to a parent entity.
///
/// POST /api/v1/subtasks
pub async fn create_subtask(
    State(state): State<AppState>,
    Json(req): Json<CreateSubtaskRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    validate_create_request(&req)?;

    let parent_uuid = req.parent_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid parent_id".to_string()))?;

    // Verify the parent entity exists in the correct table.
    let parent_table = match req.parent_type.as_str() {
        "bounty" => "bounties",
        "issue" => "repo_issues",
        "project" => "projects",
        _ => return Err(AppError::Validation("Invalid parent_type".to_string())),
    };
    let parent_exists: Option<(uuid::Uuid,)> = sqlx::query_as(
        &format!("SELECT id FROM {} WHERE id = $1", parent_table),
    )
    .bind(parent_uuid)
    .fetch_optional(&state.db)
    .await?;
    if parent_exists.is_none() {
        return Err(AppError::NotFound(format!(
            "{} with id {} not found",
            req.parent_type, req.parent_id
        )));
    }

    let dep_ids = parse_dependency_ids(&req.depends_on)?;
    let has_blocked = resolve_dependencies(&state.db, &dep_ids).await?;
    let status = if has_blocked { "blocked" } else { "open" };

    let subtask_id = Uuid::new_v4();
    let subtask = insert_subtask(
        &state.db, subtask_id, &req, parent_uuid, status, &dep_ids,
    )
    .await?;

    tracing::info!(
        subtask_id = %subtask_id,
        parent_type = %req.parent_type,
        status = %status,
        "subtask_created"
    );

    Ok(Json(subtask))
}

/// List subtasks for a parent entity, including the dependency graph.
///
/// GET /api/v1/subtasks?parent_type=issue&parent_id=:id
pub async fn list_subtasks(
    Query(params): Query<ListSubtasksQuery>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let parent_uuid = params.parent_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid parent_id".to_string()))?;

    let subtasks: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(s) FROM (
               SELECT * FROM subtasks
               WHERE parent_type = $1 AND parent_id = $2
               ORDER BY created_at ASC
           ) s"#,
    )
    .bind(&params.parent_type)
    .bind(parent_uuid)
    .fetch_all(&state.db)
    .await?;

    // Build dependency graph from the depends_on UUID[] columns
    let mut graph = serde_json::Map::new();
    for s in &subtasks {
        let id = s.get("id").and_then(|v| v.as_str()).unwrap_or_default();
        let deps = s.get("depends_on").cloned().unwrap_or(Value::Array(vec![]));
        graph.insert(id.to_string(), deps);
    }

    Ok(Json(serde_json::json!({
        "subtasks": subtasks,
        "dependency_graph": graph,
    })))
}

/// Validate that the agent has a matching skill for the subtask.
async fn validate_agent_skills(
    db: &sqlx::PgPool,
    agent_id: &str,
    subtask_id: Uuid,
) -> Result<(), AppError> {
    let has_match: Option<(bool,)> = sqlx::query_as(
        r#"SELECT EXISTS(
               SELECT 1 FROM agents a, subtasks s
               WHERE a.id = $1 AND s.id = $2
               AND a.capabilities && s.required_skills
           )"#,
    )
    .bind(agent_id)
    .bind(subtask_id)
    .fetch_optional(db)
    .await?;

    let matched = has_match.map(|(b,)| b).unwrap_or(false);
    if !matched {
        return Err(AppError::Validation(
            "Agent does not have any of the required skills".to_string(),
        ));
    }
    Ok(())
}

/// Check the agent does not already have 3+ active subtasks.
async fn validate_agent_capacity(
    db: &sqlx::PgPool,
    agent_id: &str,
) -> Result<(), AppError> {
    let count: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM subtasks
           WHERE assigned_to = $1 AND status IN ('claimed', 'in_progress')"#,
    )
    .bind(agent_id)
    .fetch_one(db)
    .await?;

    if count.0 >= 3 {
        return Err(AppError::Validation(
            "Agent already has 3 or more active subtasks".to_string(),
        ));
    }
    Ok(())
}

/// Claim a subtask for an agent.
///
/// PATCH /api/v1/subtasks/:id/claim
pub async fn claim_subtask(
    Path(subtask_id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<ClaimSubtaskRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let id = subtask_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid subtask_id".to_string()))?;

    let current: Option<(String,)> = sqlx::query_as(
        "SELECT status FROM subtasks WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    let (status,) = current.ok_or_else(|| {
        AppError::Validation(format!("Subtask not found: {subtask_id}"))
    })?;

    if status != "open" {
        return Err(AppError::Validation(
            format!("Subtask is not open (status: {status})"),
        ));
    }

    validate_agent_skills(&state.db, &req.agent_id, id).await?;
    validate_agent_capacity(&state.db, &req.agent_id).await?;

    let updated = apply_claim(&state.db, id, &req.agent_id).await?;

    tracing::info!(
        subtask_id = %id,
        agent_id = %req.agent_id,
        "subtask_claimed"
    );

    Ok(Json(updated))
}

/// Apply the claim: update subtask, create work_lock, return updated row.
async fn apply_claim(
    db: &sqlx::PgPool,
    subtask_id: Uuid,
    agent_id: &str,
) -> Result<Value, AppError> {
    let now = Utc::now();

    sqlx::query(
        r#"UPDATE subtasks
           SET assigned_to = $1, assigned_at = $2, status = 'claimed'
           WHERE id = $3"#,
    )
    .bind(agent_id)
    .bind(now)
    .bind(subtask_id)
    .execute(db)
    .await?;

    let lock_id = Uuid::new_v4();
    let expires_at = now + chrono::Duration::hours(24);
    sqlx::query(
        r#"INSERT INTO work_locks (id, target_type, target_id, agent_id, expires_at, intent)
           VALUES ($1, 'subtask', $2, $3, $4, 'Claimed subtask')
           ON CONFLICT DO NOTHING"#,
    )
    .bind(lock_id)
    .bind(subtask_id)
    .bind(agent_id)
    .bind(expires_at)
    .execute(db)
    .await?;

    let row: Value = sqlx::query_scalar(
        r#"SELECT row_to_json(s) FROM (
               SELECT * FROM subtasks WHERE id = $1
           ) s"#,
    )
    .bind(subtask_id)
    .fetch_one(db)
    .await?;

    Ok(row)
}

/// Complete a subtask and report any newly unblocked subtasks.
///
/// PATCH /api/v1/subtasks/:id/complete
pub async fn complete_subtask(
    Path(subtask_id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<CompleteSubtaskRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let id = subtask_id.parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid subtask_id".to_string()))?;

    if req.output_ref.is_empty() {
        return Err(AppError::Validation("output_ref is required".to_string()));
    }

    let current: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT status, assigned_to FROM subtasks WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    let (status, assigned_to) = current.ok_or_else(|| {
        AppError::Validation(format!("Subtask not found: {subtask_id}"))
    })?;

    validate_completion(&status, assigned_to.as_deref(), &req.agent_id)?;

    let (updated, unblocked) = apply_completion(
        &state.db, id, &req.output_ref,
    )
    .await?;

    tracing::info!(
        subtask_id = %id,
        agent_id = %req.agent_id,
        newly_unblocked = ?unblocked,
        "subtask_completed"
    );

    Ok(Json(serde_json::json!({
        "subtask": updated,
        "newly_unblocked": unblocked,
    })))
}

/// Validate that completion is allowed.
fn validate_completion(
    status: &str,
    assigned_to: Option<&str>,
    agent_id: &str,
) -> Result<(), AppError> {
    if status != "claimed" && status != "in_progress" {
        return Err(AppError::Validation(
            format!("Subtask cannot be completed (status: {status})"),
        ));
    }
    if assigned_to != Some(agent_id) {
        return Err(AppError::Validation(
            "Only the assigned agent can complete this subtask".to_string(),
        ));
    }
    Ok(())
}

/// Mark the subtask complete and find newly unblocked dependents.
async fn apply_completion(
    db: &sqlx::PgPool,
    subtask_id: Uuid,
    output_ref: &str,
) -> Result<(Value, Vec<String>), AppError> {
    let now = Utc::now();

    sqlx::query(
        r#"UPDATE subtasks
           SET status = 'complete', completed_at = $1, output_ref = $2
           WHERE id = $3"#,
    )
    .bind(now)
    .bind(output_ref)
    .bind(subtask_id)
    .execute(db)
    .await?;

    let updated: Value = sqlx::query_scalar(
        r#"SELECT row_to_json(s) FROM (
               SELECT * FROM subtasks WHERE id = $1
           ) s"#,
    )
    .bind(subtask_id)
    .fetch_one(db)
    .await?;

    let unblocked: Vec<(Uuid,)> = sqlx::query_as(
        r#"SELECT id FROM subtasks
           WHERE status = 'blocked'
             AND $1 = ANY(depends_on)
             AND NOT EXISTS (
                 SELECT 1 FROM unnest(depends_on) AS dep_id
                 JOIN subtasks AS dep ON dep.id = dep_id
                 WHERE dep.status != 'complete'
             )"#,
    )
    .bind(subtask_id)
    .fetch_all(db)
    .await?;

    let unblocked_ids: Vec<String> = unblocked
        .iter()
        .map(|(uid,)| uid.to_string())
        .collect();

    if !unblocked_ids.is_empty() {
        sqlx::query(
            r#"UPDATE subtasks SET status = 'open'
               WHERE id = ANY($1) AND status = 'blocked'"#,
        )
        .bind(
            &unblocked.iter().map(|(uid,)| *uid).collect::<Vec<Uuid>>(),
        )
        .execute(db)
        .await?;
    }

    Ok((updated, unblocked_ids))
}
