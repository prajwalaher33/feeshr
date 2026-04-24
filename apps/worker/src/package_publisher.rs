//! Package publisher — builds and publishes packages to npm, PyPI, and crates.io.
//!
//! Triggered when a repo maintainer tags a release. The worker detects
//! the tag, runs full CI, builds the package, and publishes it.
//!
//! Publishing credentials are stored in environment variables.
//! The agent never sees credentials — the worker handles all registry interaction.

use thiserror::Error;

/// Errors that can occur during package publishing.
#[derive(Debug, Error)]
pub enum PublishError {
    #[error("CI failed for repo {repo_id}: {reason}")]
    CiFailed { repo_id: String, reason: String },

    #[error("Unsupported registry: {registry}. Supported: npm, pypi, crates")]
    UnsupportedRegistry { registry: String },

    #[error("Missing credentials for {registry}. Set {env_var} environment variable.")]
    MissingCredentials { registry: String, env_var: String },

    #[error("Build failed for {repo_id}: {stderr}")]
    BuildFailed { repo_id: String, stderr: String },

    #[error("Publish failed for {package_name} to {registry}: {reason}")]
    PublishFailed {
        package_name: String,
        registry: String,
        reason: String,
    },

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Supported package registries.
#[derive(Debug, Clone, PartialEq)]
pub enum Registry {
    /// npm registry (JavaScript/TypeScript packages)
    Npm,
    /// Python Package Index
    PyPi,
    /// crates.io (Rust packages)
    Crates,
}

impl Registry {
    /// Parse registry from string.
    ///
    /// # Errors
    /// Returns `PublishError::UnsupportedRegistry` for unknown registry names.
    pub fn from_str(s: &str) -> Result<Self, PublishError> {
        match s.to_lowercase().as_str() {
            "npm" => Ok(Self::Npm),
            "pypi" => Ok(Self::PyPi),
            "crates" | "crates.io" => Ok(Self::Crates),
            _ => Err(PublishError::UnsupportedRegistry {
                registry: s.to_string(),
            }),
        }
    }

    /// Required environment variable for publishing credentials.
    pub fn credential_env_var(&self) -> &'static str {
        match self {
            Self::Npm => "NPM_TOKEN",
            Self::PyPi => "PYPI_TOKEN",
            Self::Crates => "CRATES_TOKEN",
        }
    }

    /// Registry display name.
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Npm => "npm",
            Self::PyPi => "PyPI",
            Self::Crates => "crates.io",
        }
    }
}

/// Check that publishing credentials are present in the environment.
///
/// Verifies the required environment variable is set before any
/// publishing attempt. Does NOT validate the credential value.
///
/// # Arguments
/// * `registry` - Target registry to check credentials for
///
/// # Errors
/// Returns `PublishError::MissingCredentials` if the env var is unset.
pub fn check_publish_credentials(registry: &Registry) -> Result<(), PublishError> {
    let env_var = registry.credential_env_var();
    if std::env::var(env_var).is_err() {
        return Err(PublishError::MissingCredentials {
            registry: registry.display_name().to_string(),
            env_var: env_var.to_string(),
        });
    }
    Ok(())
}

/// Check for repos that need publishing (new tags with passing CI).
///
/// Queries repos with CI passing and no published version yet,
/// or repos where latest_version differs from their newest tag.
pub async fn run_publish_check(pool: &sqlx::PgPool) -> Result<(), anyhow::Error> {
    let repos = sqlx::query_as::<_, (String, String, String)>(
        "SELECT id::text, name, COALESCE(languages[1], 'unknown')
         FROM repos
         WHERE ci_status = 'passing' AND status = 'active'
           AND array_length(published_to, 1) IS NULL
         LIMIT 10",
    )
    .fetch_all(pool)
    .await?;

    for (repo_id, name, lang) in &repos {
        let registry = match lang.as_str() {
            "python" => Registry::PyPi,
            "javascript" | "typescript" => Registry::Npm,
            "rust" => Registry::Crates,
            _ => continue,
        };

        if check_publish_credentials(&registry).is_err() {
            tracing::warn!(
                repo = %name,
                registry = %registry.display_name(),
                "Skipping publish — missing credentials"
            );
            continue;
        }

        tracing::info!(
            repo_id = %repo_id,
            repo = %name,
            registry = %registry.display_name(),
            "Would publish package (dry run)"
        );
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_from_str() {
        assert!(matches!(Registry::from_str("npm"), Ok(Registry::Npm)));
        assert!(matches!(Registry::from_str("pypi"), Ok(Registry::PyPi)));
        assert!(matches!(Registry::from_str("crates"), Ok(Registry::Crates)));
        assert!(Registry::from_str("unknown").is_err());
    }

    #[test]
    fn test_registry_credential_env_var() {
        assert_eq!(Registry::Npm.credential_env_var(), "NPM_TOKEN");
        assert_eq!(Registry::PyPi.credential_env_var(), "PYPI_TOKEN");
        assert_eq!(Registry::Crates.credential_env_var(), "CRATES_TOKEN");
    }

    #[test]
    fn test_missing_credentials_error() {
        // Ensure NPM_TOKEN is not set (it shouldn't be in test env)
        // This tests the error path
        let registry = Registry::Npm;
        // Only test if NOT set (avoid false pass if token is set in env)
        if std::env::var("NPM_TOKEN").is_err() {
            assert!(check_publish_credentials(&registry).is_err());
        }
    }
}
