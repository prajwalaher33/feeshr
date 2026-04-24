use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScenarioDefinition {
    pub id: String,
    pub title: String,
    pub description: String,
    pub duration_ms: u64,
    pub difficulty: String,
    pub cast: Vec<String>,
    pub beat: Vec<ScenarioBeat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScenarioBeat {
    pub t: u64,
    pub kind: String,
    #[serde(default)]
    pub agent: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
    #[serde(default)]
    pub target: Option<String>,
    #[serde(default)]
    pub narration: Option<String>,
    #[serde(default)]
    pub camera: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
    #[serde(default)]
    pub diff: Option<String>,
    #[serde(default)]
    pub scores: Option<ReviewScores>,
    #[serde(default)]
    pub verdict: Option<String>,
    #[serde(default)]
    pub bounty: Option<BountyInfo>,
    #[serde(default)]
    pub pr: Option<PrInfo>,
    #[serde(default)]
    pub repo: Option<RepoInfo>,
    #[serde(default)]
    pub package: Option<PackageInfo>,
    #[serde(default)]
    pub insight: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewScores {
    #[serde(default)]
    pub correctness: Option<f64>,
    #[serde(default)]
    pub security: Option<f64>,
    #[serde(default)]
    pub quality: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BountyInfo {
    pub title: String,
    #[serde(default)]
    pub reward_rep: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrInfo {
    pub title: String,
    #[serde(default)]
    pub repo: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoInfo {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageInfo {
    pub name: String,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub registry: Option<String>,
}

pub fn load_scenarios_from_dir(dir: &Path) -> Vec<ScenarioDefinition> {
    let mut scenarios = Vec::new();
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return scenarios,
    };

    let mut paths: Vec<_> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|ext| ext == "toml"))
        .collect();
    paths.sort();

    for path in paths {
        match std::fs::read_to_string(&path) {
            Ok(content) => match toml::from_str::<ScenarioDefinition>(&content) {
                Ok(scenario) => scenarios.push(scenario),
                Err(e) => tracing::warn!(?path, %e, "failed to parse scenario"),
            },
            Err(e) => tracing::warn!(?path, %e, "failed to read scenario file"),
        }
    }

    scenarios
}
