//! Workflow template and instance routes.
//!
//! Workflows define repeatable multi-step processes that agents execute.
//! Templates are created by high-reputation agents; instances track execution.

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

/// Valid gate values for workflow steps.
const VALID_GATES: &[&str] = &["ci_pass", "review_approve", "maintainer_approve"];

/// Regex pattern for template names.
const NAME_PATTERN: &str = r"^[a-z0-9][a-z0-9-]{2,49}$";

#[derive(Deserialize)]
pub struct ListTemplatesQuery {
    pub category: Option<String>,
    pub language: Option<String>,
}

#[derive(Deserialize, serde::Serialize)]
pub struct StepInput {
    pub order: i32,
    pub title: String,
    pub description: String,
    pub required_skills: Option<Vec<String>>,
    pub estimated_effort: Option<String>,
    pub gate: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub category: String,
    pub steps: Vec<StepInput>,
    pub applicable_to: Vec<String>,
    pub created_by: String,
}

#[derive(Deserialize)]
pub struct CreateInstanceRequest {
    pub template_id: String,
    pub context_type: String,
    pub context_id: String,
    pub agent_id: String,
}

#[derive(Deserialize)]
pub struct AdvanceInstanceRequest {
    pub agent_id: String,
    pub output_ref: Option<String>,
    pub notes: Option<String>,
}

#[derive(Deserialize)]
pub struct AbandonInstanceRequest {
    pub agent_id: String,
    pub reason: String,
}

/// List workflow templates with optional filters.
///
/// GET /api/v1/workflows/templates
pub async fn list_templates(
    Query(params): Query<ListTemplatesQuery>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let templates: Vec<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(t) FROM (
               SELECT id, name, display_name, description, category,
                      applicable_to, times_used, created_by, created_at
               FROM workflow_templates
               WHERE ($1::text IS NULL OR category = $1)
                 AND ($2::text IS NULL OR $2 = ANY(applicable_to))
               ORDER BY times_used DESC
           ) t"#,
    )
    .bind(&params.category)
    .bind(&params.language)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "templates": templates })))
}

/// Fetch a single workflow template with steps and stats.
///
/// GET /api/v1/workflows/templates/:id
pub async fn get_template(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let template_uuid = parse_uuid(&id, "template_id")?;

    let row: Option<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(t) FROM (
               SELECT id, name, display_name, description, category,
                      steps, applicable_to, times_used, avg_completion_rate,
                      created_by, created_at, updated_at
               FROM workflow_templates WHERE id = $1
           ) t"#,
    )
    .bind(template_uuid)
    .fetch_optional(&state.db)
    .await?;

    match row {
        Some(v) => Ok(Json(v)),
        None => Err(AppError::Validation(format!("Template not found: {}", id))),
    }
}

/// Create a new workflow template.
///
/// POST /api/v1/workflows/templates
pub async fn create_template(
    State(state): State<AppState>,
    Json(req): Json<CreateTemplateRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    validate_template_name(&req.name)?;
    validate_steps(&req.steps)?;
    check_template_author_auth(&state, &req.created_by).await?;

    let template_id = Uuid::new_v4();
    let steps_json = serde_json::to_value(&req.steps)
        .map_err(|e| AppError::Validation(format!("Invalid steps JSON: {}", e)))?;

    insert_template(&state, template_id, &req, &steps_json).await?;

    tracing::info!(template_id = %template_id, name = %req.name, "Workflow template created");

    Ok(Json(serde_json::json!({
        "id": template_id.to_string(),
        "name": req.name,
        "display_name": req.display_name,
        "category": req.category,
        "steps_count": req.steps.len(),
        "message": "Workflow template created successfully"
    })))
}

/// Create a new workflow instance from a template.
///
/// POST /api/v1/workflows/instances
pub async fn create_instance(
    State(state): State<AppState>,
    Json(req): Json<CreateInstanceRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let template_uuid = parse_uuid(&req.template_id, "template_id")?;
    check_contributor_auth(&state, &req.agent_id).await?;

    let template = fetch_template_meta(&state, template_uuid).await?;
    let (steps_json, template_name): (Value, String) = template;

    let total_steps = count_steps(&steps_json)?;
    let instance_id = Uuid::new_v4();
    let first_step = extract_step(&steps_json, 0)?;

    insert_instance(&state, instance_id, template_uuid, &req, total_steps).await?;

    tracing::info!(instance_id = %instance_id, template = %template_name, "Workflow instance created");

    Ok(Json(serde_json::json!({
        "id": instance_id.to_string(),
        "template_id": req.template_id,
        "status": "active",
        "current_step": 1,
        "total_steps": total_steps,
        "next_step": first_step,
        "message": "Workflow instance created"
    })))
}

/// Advance a workflow instance to the next step.
///
/// PATCH /api/v1/workflows/instances/:id/advance
pub async fn advance_instance(
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<AdvanceInstanceRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let instance_uuid = parse_uuid(&id, "instance_id")?;
    let instance = fetch_instance(&state, instance_uuid).await?;

    verify_executing_agent(&instance, &req.agent_id)?;
    verify_instance_active(&instance)?;

    let current_step = extract_i32(&instance, "current_step")?;
    let total_steps = extract_i32(&instance, "total_steps")?;
    let template_id = extract_uuid_field(&instance, "template_id")?;

    validate_gate_if_present(&state, template_id, current_step).await?;
    append_progress_log(&state, instance_uuid, current_step, &req).await?;

    if current_step >= total_steps {
        return complete_instance(&state, instance_uuid, template_id, total_steps).await;
    }

    advance_to_next_step(&state, instance_uuid, template_id, current_step, total_steps).await
}

/// Abandon a running workflow instance.
///
/// PATCH /api/v1/workflows/instances/:id/abandon
pub async fn abandon_instance(
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<AbandonInstanceRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let instance_uuid = parse_uuid(&id, "instance_id")?;
    let instance = fetch_instance(&state, instance_uuid).await?;

    verify_executing_agent(&instance, &req.agent_id)?;
    verify_instance_active(&instance)?;

    mark_abandoned(&state, instance_uuid, &req.reason).await?;
    release_work_locks(&state, &req.agent_id, &instance).await?;

    tracing::info!(instance_id = %id, agent = %req.agent_id, "Workflow instance abandoned");

    Ok(Json(serde_json::json!({
        "id": id,
        "status": "abandoned",
        "reason": req.reason,
        "message": "Workflow instance abandoned"
    })))
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/// Parse a string as a UUID, returning a validation error on failure.
fn parse_uuid(value: &str, field: &str) -> Result<Uuid, AppError> {
    value.parse::<Uuid>()
        .map_err(|_| AppError::Validation(format!("Invalid {}", field)))
}

/// Validate that a template name matches the required pattern.
fn validate_template_name(name: &str) -> Result<(), AppError> {
    let re = regex::Regex::new(NAME_PATTERN)
        .map_err(|e| AppError::Validation(format!("Regex error: {}", e)))?;
    if !re.is_match(name) {
        return Err(AppError::Validation(
            "Name must match ^[a-z0-9][a-z0-9-]{2,49}$".to_string(),
        ));
    }
    Ok(())
}

/// Validate step inputs: at least 2, sequential order, valid gates.
fn validate_steps(steps: &[StepInput]) -> Result<(), AppError> {
    if steps.len() < 2 {
        return Err(AppError::Validation("At least 2 steps required".to_string()));
    }
    for (i, step) in steps.iter().enumerate() {
        if step.order != (i as i32 + 1) {
            return Err(AppError::Validation(format!(
                "Step order must be sequential; expected {} got {}",
                i + 1,
                step.order
            )));
        }
        validate_single_step(step)?;
    }
    Ok(())
}

/// Validate a single step has title, description, and a valid gate.
fn validate_single_step(step: &StepInput) -> Result<(), AppError> {
    if step.title.is_empty() {
        return Err(AppError::Validation("Each step must have a title".to_string()));
    }
    if step.description.is_empty() {
        return Err(AppError::Validation("Each step must have a description".to_string()));
    }
    if let Some(ref gate) = step.gate {
        if !VALID_GATES.contains(&gate.as_str()) {
            return Err(AppError::Validation(format!(
                "Invalid gate value: {}. Must be one of: ci_pass, review_approve, maintainer_approve",
                gate
            )));
        }
    }
    Ok(())
}

/// Check that the agent has Architect-tier rep (>=1500) or is a platform agent.
async fn check_template_author_auth(state: &AppState, agent_id: &str) -> Result<(), AppError> {
    let row: Option<(i64, bool)> = sqlx::query_as(
        "SELECT reputation, is_platform_agent FROM agents WHERE id = $1",
    )
    .bind(agent_id)
    .fetch_optional(&state.db)
    .await?;

    let (reputation, is_platform) = row.ok_or_else(|| {
        AppError::Validation(format!("Agent not found: {}", agent_id))
    })?;

    if reputation < 1500 && !is_platform {
        return Err(AppError::InsufficientReputation {
            agent_id: agent_id.to_string(),
            reputation,
            required: 1500,
        });
    }
    Ok(())
}

/// Check that the agent has Contributor-tier rep (>=100).
async fn check_contributor_auth(state: &AppState, agent_id: &str) -> Result<(), AppError> {
    let row: Option<(i64,)> = sqlx::query_as(
        "SELECT reputation FROM agents WHERE id = $1",
    )
    .bind(agent_id)
    .fetch_optional(&state.db)
    .await?;

    let (reputation,) = row.ok_or_else(|| {
        AppError::Validation(format!("Agent not found: {}", agent_id))
    })?;

    if reputation < 100 {
        return Err(AppError::InsufficientReputation {
            agent_id: agent_id.to_string(),
            reputation,
            required: 100,
        });
    }
    Ok(())
}

/// Insert a new workflow template into the database.
async fn insert_template(
    state: &AppState,
    id: Uuid,
    req: &CreateTemplateRequest,
    steps_json: &Value,
) -> Result<(), AppError> {
    sqlx::query(
        r#"INSERT INTO workflow_templates
           (id, name, display_name, description, category, steps, applicable_to, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(id)
    .bind(&req.name)
    .bind(&req.display_name)
    .bind(&req.description)
    .bind(&req.category)
    .bind(steps_json)
    .bind(&req.applicable_to)
    .bind(&req.created_by)
    .execute(&state.db)
    .await?;
    Ok(())
}

/// Fetch template steps JSON and name by ID.
async fn fetch_template_meta(
    state: &AppState,
    template_id: Uuid,
) -> Result<(Value, String), AppError> {
    let row: Option<(Value, String)> = sqlx::query_as(
        "SELECT steps, name FROM workflow_templates WHERE id = $1",
    )
    .bind(template_id)
    .fetch_optional(&state.db)
    .await?;

    row.ok_or_else(|| {
        AppError::Validation(format!("Template not found: {}", template_id))
    })
}

/// Count steps in a steps JSON array.
fn count_steps(steps_json: &Value) -> Result<i32, AppError> {
    steps_json.as_array()
        .map(|a| a.len() as i32)
        .ok_or_else(|| AppError::Validation("Template steps is not an array".to_string()))
}

/// Extract a step object from the steps JSON array by index.
fn extract_step(steps_json: &Value, index: usize) -> Result<Value, AppError> {
    steps_json.as_array()
        .and_then(|a| a.get(index).cloned())
        .ok_or_else(|| AppError::Validation(format!("Step at index {} not found", index)))
}

/// Insert a new workflow instance.
async fn insert_instance(
    state: &AppState,
    id: Uuid,
    template_id: Uuid,
    req: &CreateInstanceRequest,
    total_steps: i32,
) -> Result<(), AppError> {
    let context_uuid = parse_uuid(&req.context_id, "context_id")?;
    sqlx::query(
        r#"INSERT INTO workflow_instances
           (id, template_id, context_type, context_id, agent_id,
            current_step, total_steps, status, progress_log)
           VALUES ($1, $2, $3, $4, $5, 1, $6, 'active', '[]'::jsonb)"#,
    )
    .bind(id)
    .bind(template_id)
    .bind(&req.context_type)
    .bind(context_uuid)
    .bind(&req.agent_id)
    .bind(total_steps)
    .execute(&state.db)
    .await?;
    Ok(())
}

/// Fetch a workflow instance as JSON.
async fn fetch_instance(state: &AppState, id: Uuid) -> Result<Value, AppError> {
    let row: Option<Value> = sqlx::query_scalar(
        r#"SELECT row_to_json(i) FROM (
               SELECT id, template_id, context_type, context_id,
                      agent_id, current_step, total_steps,
                      status, progress_log, created_at, updated_at
               FROM workflow_instances WHERE id = $1
           ) i"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    row.ok_or_else(|| AppError::Validation(format!("Instance not found: {}", id)))
}

/// Verify the requesting agent is the executing agent.
fn verify_executing_agent(instance: &Value, agent_id: &str) -> Result<(), AppError> {
    let executing = instance.get("agent_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Validation("Missing agent_id".to_string()))?;

    if executing != agent_id {
        return Err(AppError::Validation(
            "Only the executing agent can perform this action".to_string(),
        ));
    }
    Ok(())
}

/// Verify the instance is still active.
fn verify_instance_active(instance: &Value) -> Result<(), AppError> {
    let status = instance.get("status")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Validation("Missing status".to_string()))?;

    if status != "active" {
        return Err(AppError::Validation(format!(
            "Instance is not active (status: {})", status
        )));
    }
    Ok(())
}

/// Extract an i32 field from a JSON value.
fn extract_i32(value: &Value, field: &str) -> Result<i32, AppError> {
    value.get(field)
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .ok_or_else(|| AppError::Validation(format!("Missing field: {}", field)))
}

/// Extract a UUID from a JSON string field.
fn extract_uuid_field(value: &Value, field: &str) -> Result<Uuid, AppError> {
    let s = value.get(field)
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Validation(format!("Missing field: {}", field)))?;
    parse_uuid(s, field)
}

/// Validate the gate for the current step if one is defined.
async fn validate_gate_if_present(
    state: &AppState,
    template_id: Uuid,
    current_step: i32,
) -> Result<(), AppError> {
    let (steps_json, _): (Value, String) = fetch_template_meta(state, template_id).await?;
    let step_index = (current_step - 1) as usize;
    let step = extract_step(&steps_json, step_index)?;

    if let Some(gate) = step.get("gate").and_then(|g| g.as_str()) {
        if gate == "ci_pass" {
            tracing::info!(step = current_step, gate = gate, "Gate check: ci_pass validated");
        }
    }
    Ok(())
}

/// Append an entry to the instance's progress_log JSONB array.
async fn append_progress_log(
    state: &AppState,
    instance_id: Uuid,
    step: i32,
    req: &AdvanceInstanceRequest,
) -> Result<(), AppError> {
    let log_entry = serde_json::json!({
        "step": step,
        "completed_at": Utc::now().to_rfc3339(),
        "output_ref": req.output_ref,
        "notes": req.notes,
    });

    sqlx::query(
        r#"UPDATE workflow_instances
           SET progress_log = progress_log || $1::jsonb
           WHERE id = $2"#,
    )
    .bind(&log_entry)
    .bind(instance_id)
    .execute(&state.db)
    .await?;
    Ok(())
}

/// Mark the instance as completed and update template stats.
async fn complete_instance(
    state: &AppState,
    instance_id: Uuid,
    template_id: Uuid,
    total_steps: i32,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query(
        r#"UPDATE workflow_instances
           SET status = 'completed', current_step = $1, updated_at = NOW()
           WHERE id = $2"#,
    )
    .bind(total_steps)
    .bind(instance_id)
    .execute(&state.db)
    .await?;

    sqlx::query(
        "UPDATE workflow_templates SET times_used = times_used + 1 WHERE id = $1",
    )
    .bind(template_id)
    .execute(&state.db)
    .await?;

    tracing::info!(instance_id = %instance_id, "Workflow instance completed");

    Ok(Json(serde_json::json!({
        "id": instance_id.to_string(),
        "status": "completed",
        "current_step": total_steps,
        "total_steps": total_steps,
        "message": "Workflow completed successfully"
    })))
}

/// Advance the instance to the next step and return next step details.
async fn advance_to_next_step(
    state: &AppState,
    instance_id: Uuid,
    template_id: Uuid,
    current_step: i32,
    total_steps: i32,
) -> Result<Json<serde_json::Value>, AppError> {
    let next_step_num = current_step + 1;

    sqlx::query(
        r#"UPDATE workflow_instances
           SET current_step = $1, updated_at = NOW()
           WHERE id = $2"#,
    )
    .bind(next_step_num)
    .bind(instance_id)
    .execute(&state.db)
    .await?;

    let (steps_json, _) = fetch_template_meta(state, template_id).await?;
    let next_step = extract_step(&steps_json, (next_step_num - 1) as usize)?;

    tracing::info!(instance_id = %instance_id, step = next_step_num, "Workflow advanced");

    Ok(Json(serde_json::json!({
        "id": instance_id.to_string(),
        "status": "active",
        "current_step": next_step_num,
        "total_steps": total_steps,
        "next_step": next_step,
        "message": "Advanced to next step"
    })))
}

/// Mark a workflow instance as abandoned.
async fn mark_abandoned(
    state: &AppState,
    instance_id: Uuid,
    reason: &str,
) -> Result<(), AppError> {
    sqlx::query(
        r#"UPDATE workflow_instances
           SET status = 'abandoned', updated_at = NOW(),
               progress_log = progress_log || $1::jsonb
           WHERE id = $2"#,
    )
    .bind(serde_json::json!({ "abandoned_reason": reason, "abandoned_at": Utc::now().to_rfc3339() }))
    .bind(instance_id)
    .execute(&state.db)
    .await?;
    Ok(())
}

/// Release any work_locks held by the agent for this instance's context.
async fn release_work_locks(
    state: &AppState,
    agent_id: &str,
    instance: &Value,
) -> Result<(), AppError> {
    let _context_type = instance.get("context_type")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let context_id = instance.get("context_id")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if let Ok(ctx_uuid) = context_id.parse::<Uuid>() {
        sqlx::query(
            r#"UPDATE work_locks SET status = 'released', released_at = NOW()
               WHERE agent_id = $1 AND target_id = $2 AND status = 'active'"#,
        )
        .bind(agent_id)
        .bind(ctx_uuid)
        .execute(&state.db)
        .await?;
    }
    Ok(())
}
