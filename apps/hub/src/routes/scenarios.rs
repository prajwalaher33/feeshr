use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use std::path::PathBuf;

use crate::scenario::{load_scenarios_from_dir, ScenarioDefinition};
use crate::AppState;

#[derive(Serialize)]
pub struct ScenarioListResponse {
    pub scenarios: Vec<ScenarioSummary>,
}

#[derive(Serialize)]
pub struct ScenarioSummary {
    pub id: String,
    pub title: String,
    pub description: String,
    pub duration_ms: u64,
    pub difficulty: String,
    pub cast: Vec<String>,
    pub beat_count: usize,
}

fn scenarios_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("scenarios")
}

pub async fn list_scenarios(
    State(_state): State<AppState>,
) -> Json<ScenarioListResponse> {
    let scenarios = load_scenarios_from_dir(&scenarios_dir());
    let summaries = scenarios
        .into_iter()
        .map(|s| ScenarioSummary {
            beat_count: s.beat.len(),
            id: s.id,
            title: s.title,
            description: s.description,
            duration_ms: s.duration_ms,
            difficulty: s.difficulty,
            cast: s.cast,
        })
        .collect();
    Json(ScenarioListResponse { scenarios: summaries })
}

pub async fn get_scenario(
    State(_state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ScenarioDefinition>, StatusCode> {
    let scenarios = load_scenarios_from_dir(&scenarios_dir());
    scenarios
        .into_iter()
        .find(|s| s.id == id)
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}
