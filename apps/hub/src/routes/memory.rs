//! Project memory routes: shared context for teams.
//!
//! Memory entries store decisions, failed approaches, architecture notes,
//! constraints, and warnings scoped to a project or repo.

use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::errors::AppError;
use crate::state::AppState;

/// Valid entry types for project memory.
const VALID_ENTRY_TYPES: &[&str] = &[
    "decision",
    "failed_approach",
    "architecture",
    "dependency",
    "constraint",
    "context",
    "api_contract",
    "todo",
    "warning",
];

#[derive(Deserialize)]
pub struct CreateMemoryRequest {
    pub scope_type: String,
    pub scope_id: String,
    pub key: String,
    pub value: Value,
    pub entry_type: String,
    pub contributed_by: String,
}

#[derive(Deserialize)]
pub struct ListMemoryQuery {
    pub scope_type: String,
    pub scope_id: String,
    pub entry_type: Option<String>,
}

#[derive(Deserialize)]
pub struct SearchMemoryQuery {
    pub scope_type: String,
    pub scope_id: String,
    pub q: String,
}

#[derive(Deserialize)]
pub struct DeprecateMemoryRequest {
    pub agent_id: String,
    pub reason: String,
}

/// Validate scope_type is 'project' or 'repo'.
fn validate_scope(scope_type: &str) -> Result<(), AppError> {
    if !["project", "repo"].contains(&scope_type) {
        return Err(AppError::Validation(
            "scope_type must be 'project' or 'repo'".into(),
        ));
    }
    Ok(())
}

/// Create a new memory entry, superseding any existing active entry with the same key.
///
/// POST /api/v1/memory
pub async fn create_memory(
    State(state): State<AppState>,
    Json(req): Json<CreateMemoryRequest>,
) -> Result<Json<Value>, AppError> {
    validate_scope(&req.scope_type)?;

    if !VALID_ENTRY_TYPES.contains(&req.entry_type.as_str()) {
        return Err(AppError::Validation(format!(
            "Invalid entry_type: {}. Must be one of: {}",
            req.entry_type,
            VALID_ENTRY_TYPES.join(", ")
        )));
    }
    if req.key.is_empty() || req.key.len() > 200 {
        return Err(AppError::Validation("key must be 1-200 characters".into()));
    }

    let scope_uuid = req
        .scope_id
        .parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid scope_id".into()))?;

    // Deprecate existing active entry with this key in this scope
    let old_id: Option<(Uuid,)> = sqlx::query_as(
        r#"SELECT id FROM project_memory
           WHERE scope_type = $1 AND scope_id = $2 AND key = $3 AND is_active = TRUE"#,
    )
    .bind(&req.scope_type)
    .bind(scope_uuid)
    .bind(&req.key)
    .fetch_optional(&state.db)
    .await?;

    if let Some((old,)) = old_id {
        sqlx::query(
            r#"UPDATE project_memory
               SET is_active = FALSE, deprecated_at = NOW(),
                   deprecated_by = $1, deprecated_reason = 'Superseded by new entry'
               WHERE id = $2"#,
        )
        .bind(&req.contributed_by)
        .bind(old)
        .execute(&state.db)
        .await?;
    }

    let entry_id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO project_memory
           (id, scope_type, scope_id, key, value, entry_type, contributed_by, supersedes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(entry_id)
    .bind(&req.scope_type)
    .bind(scope_uuid)
    .bind(&req.key)
    .bind(&req.value)
    .bind(&req.entry_type)
    .bind(&req.contributed_by)
    .bind(old_id.map(|(id,)| id))
    .execute(&state.db)
    .await?;

    tracing::info!(
        entry_id = %entry_id,
        scope_type = %req.scope_type,
        entry_type = %req.entry_type,
        key = %req.key,
        "memory_entry_created"
    );

    Ok(Json(serde_json::json!({
        "id": entry_id.to_string(),
        "key": req.key,
        "entry_type": req.entry_type,
        "message": "Memory entry created"
    })))
}

/// List active memory entries for a scope, optionally filtered by entry_type.
///
/// GET /api/v1/memory?scope_type=repo&scope_id=:id
pub async fn list_memory(
    Query(params): Query<ListMemoryQuery>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    validate_scope(&params.scope_type)?;
    let scope_uuid = params
        .scope_id
        .parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid scope_id".into()))?;

    let entries: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(m) FROM (
               SELECT id, scope_type, scope_id, key, value, entry_type,
                      contributed_by, created_at
               FROM project_memory
               WHERE scope_type = $1 AND scope_id = $2 AND is_active = TRUE
                 AND ($3::text IS NULL OR entry_type = $3)
               ORDER BY entry_type, created_at DESC
           ) m"#,
    )
    .bind(&params.scope_type)
    .bind(scope_uuid)
    .bind(&params.entry_type)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        serde_json::json!({ "entries": entries, "total": entries.len() }),
    ))
}

/// Semantic search over project memory entries.
///
/// GET /api/v1/memory/search?scope_type=repo&scope_id=:id&q=error+handling
pub async fn search_memory(
    Query(params): Query<SearchMemoryQuery>,
    State(state): State<AppState>,
) -> Result<Json<Value>, AppError> {
    validate_scope(&params.scope_type)?;
    let scope_uuid = params
        .scope_id
        .parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid scope_id".into()))?;

    // Full-text search fallback (Qdrant integration is Phase 2)
    let entries: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(m) FROM (
               SELECT id, key, value, entry_type, contributed_by, created_at
               FROM project_memory
               WHERE scope_type = $1 AND scope_id = $2 AND is_active = TRUE
                 AND (key ILIKE '%' || $3 || '%'
                      OR value::text ILIKE '%' || $3 || '%')
               ORDER BY created_at DESC
               LIMIT 20
           ) m"#,
    )
    .bind(&params.scope_type)
    .bind(scope_uuid)
    .bind(&params.q)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        serde_json::json!({ "entries": entries, "total": entries.len() }),
    ))
}

/// Deprecate a memory entry.
///
/// DELETE /api/v1/memory/:id
pub async fn deprecate_memory(
    Path(entry_id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<DeprecateMemoryRequest>,
) -> Result<Json<Value>, AppError> {
    let entry_uuid = entry_id
        .parse::<Uuid>()
        .map_err(|_| AppError::Validation("Invalid entry_id".into()))?;

    // Verify entry exists and is active
    let row: Option<(bool, String)> =
        sqlx::query_as("SELECT is_active, contributed_by FROM project_memory WHERE id = $1")
            .bind(entry_uuid)
            .fetch_optional(&state.db)
            .await?;

    let (is_active, _contributed_by) =
        row.ok_or_else(|| AppError::NotFound(format!("Memory entry not found: {entry_id}")))?;

    if !is_active {
        return Err(AppError::Validation("Entry is already deprecated".into()));
    }

    sqlx::query(
        r#"UPDATE project_memory
           SET is_active = FALSE, deprecated_at = NOW(),
               deprecated_by = $1, deprecated_reason = $2
           WHERE id = $3"#,
    )
    .bind(&req.agent_id)
    .bind(&req.reason)
    .bind(entry_uuid)
    .execute(&state.db)
    .await?;

    tracing::info!(entry_id = %entry_id, "memory_entry_deprecated");

    Ok(Json(serde_json::json!({
        "id": entry_id,
        "status": "deprecated",
        "message": "Memory entry deprecated"
    })))
}
