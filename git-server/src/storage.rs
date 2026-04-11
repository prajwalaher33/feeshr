//! Manages bare git repositories on disk.
//!
//! All repos are stored as bare repositories at {data_dir}/{repo_id}.git
//! Only bare repos are used — agents never interact with working trees.

use std::path::PathBuf;
use tokio::process::Command;
use thiserror::Error;

#[derive(Debug, Error)]
#[allow(dead_code)]
pub enum StorageError {
    #[error("Repository {repo_id} not found at {path}")]
    RepoNotFound { repo_id: String, path: String },

    #[error("Failed to create repository {repo_id}: {reason}")]
    CreateFailed { repo_id: String, reason: String },

    #[error("Git command failed for {repo_id}: exit={exit_code}, stderr={stderr}")]
    GitCommandFailed { repo_id: String, exit_code: i32, stderr: String },

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Manages bare git repositories on the local filesystem.
pub struct RepoStorage {
    data_dir: PathBuf,
}

impl RepoStorage {
    /// Create a new RepoStorage backed by the given directory.
    ///
    /// # Arguments
    /// * `data_dir` - Directory where bare repos are stored (must exist)
    pub fn new(data_dir: impl Into<PathBuf>) -> Self {
        Self { data_dir: data_dir.into() }
    }

    /// Get the filesystem path for a repo.
    ///
    /// # Arguments
    /// * `repo_id` - The repo's UUID (used as directory name)
    pub fn repo_path(&self, repo_id: &str) -> PathBuf {
        self.data_dir.join(format!("{}.git", repo_id))
    }

    /// Check if a repo exists on disk.
    pub fn repo_exists(&self, repo_id: &str) -> bool {
        self.repo_path(repo_id).exists()
    }

    /// Create a new bare git repository.
    ///
    /// # Arguments
    /// * `repo_id` - UUID for the new repo
    ///
    /// # Errors
    /// Returns `StorageError::CreateFailed` if the git init fails.
    pub async fn create_repo(&self, repo_id: &str) -> Result<PathBuf, StorageError> {
        let path = self.repo_path(repo_id);
        let path_str = path.to_str().unwrap_or_default().to_string();
        let output = Command::new("git")
            .args(["init", "--bare", &path_str])
            .output()
            .await
            .map_err(|e| StorageError::CreateFailed {
                repo_id: repo_id.to_string(),
                reason: e.to_string(),
            })?;

        if !output.status.success() {
            return Err(StorageError::CreateFailed {
                repo_id: repo_id.to_string(),
                reason: String::from_utf8_lossy(&output.stderr).to_string(),
            });
        }
        Ok(path)
    }

    /// Delete a bare git repository from disk.
    ///
    /// # Arguments
    /// * `repo_id` - UUID of the repo to delete
    ///
    /// # Errors
    /// Returns `StorageError::RepoNotFound` if the repo does not exist.
    #[allow(dead_code)]
    pub async fn delete_repo(&self, repo_id: &str) -> Result<(), StorageError> {
        let path = self.repo_path(repo_id);
        if !path.exists() {
            return Err(StorageError::RepoNotFound {
                repo_id: repo_id.to_string(),
                path: path.display().to_string(),
            });
        }
        tokio::fs::remove_dir_all(&path).await.map_err(StorageError::Io)
    }

    /// List files in a repo at a given ref (defaults to HEAD).
    ///
    /// # Arguments
    /// * `repo_id` - UUID of the repo
    /// * `ref_name` - Git ref to list (e.g., "HEAD", "main", commit hash)
    /// * `path` - Subdirectory path within the repo (empty = root)
    ///
    /// # Returns
    /// Vec of filenames in the given directory at the given ref.
    ///
    /// # Errors
    /// Returns an error if the repo or ref does not exist.
    pub async fn list_files(
        &self,
        repo_id: &str,
        ref_name: &str,
        path: &str,
    ) -> Result<Vec<String>, StorageError> {
        let repo_path = self.repo_path(repo_id);
        if !repo_path.exists() {
            return Err(StorageError::RepoNotFound {
                repo_id: repo_id.to_string(),
                path: repo_path.display().to_string(),
            });
        }

        let tree_path = if path.is_empty() {
            format!("{}:", ref_name)
        } else {
            format!("{}:{}", ref_name, path)
        };

        let repo_path_str = repo_path.to_str().unwrap_or_default().to_string();
        let output = Command::new("git")
            .args(["--git-dir", &repo_path_str])
            .args(["ls-tree", "--name-only", &tree_path])
            .output()
            .await
            .map_err(StorageError::Io)?;

        if !output.status.success() {
            let exit_code = output.status.code().unwrap_or(-1);
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(StorageError::GitCommandFailed {
                repo_id: repo_id.to_string(),
                exit_code,
                stderr,
            });
        }

        let files = String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(String::from)
            .collect();
        Ok(files)
    }

    /// Get the contents of a file at a given ref.
    ///
    /// # Arguments
    /// * `repo_id` - UUID of the repo
    /// * `ref_name` - Git ref (e.g., "HEAD", "main")
    /// * `file_path` - Path to the file within the repo
    ///
    /// # Returns
    /// Raw file contents as bytes.
    pub async fn get_file_contents(
        &self,
        repo_id: &str,
        ref_name: &str,
        file_path: &str,
    ) -> Result<Vec<u8>, StorageError> {
        let repo_path = self.repo_path(repo_id);
        let object = format!("{}:{}", ref_name, file_path);
        let repo_path_str = repo_path.to_str().unwrap_or_default().to_string();

        let output = Command::new("git")
            .args(["--git-dir", &repo_path_str])
            .args(["show", &object])
            .output()
            .await
            .map_err(StorageError::Io)?;

        if !output.status.success() {
            let exit_code = output.status.code().unwrap_or(-1);
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(StorageError::GitCommandFailed {
                repo_id: repo_id.to_string(),
                exit_code,
                stderr,
            });
        }
        Ok(output.stdout)
    }

    /// Get recent commit history for a repo.
    ///
    /// # Arguments
    /// * `repo_id` - UUID of the repo
    /// * `limit` - Max commits to return (default: 20)
    ///
    /// # Returns
    /// Vec of commit summaries as JSON-compatible structs.
    pub async fn get_commits(
        &self,
        repo_id: &str,
        limit: usize,
    ) -> Result<Vec<CommitSummary>, StorageError> {
        let repo_path = self.repo_path(repo_id);
        let format = "--pretty=format:%H|%ae|%s|%ci";
        let limit_str = format!("-{}", limit);
        let repo_path_str = repo_path.to_str().unwrap_or_default().to_string();

        let output = Command::new("git")
            .args(["--git-dir", &repo_path_str])
            .args(["log", &limit_str, format])
            .output()
            .await
            .map_err(StorageError::Io)?;

        if !output.status.success() {
            // Empty repo — return empty list
            return Ok(vec![]);
        }

        let commits = String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(4, '|').collect();
                if parts.len() == 4 {
                    Some(CommitSummary {
                        hash: parts[0].to_string(),
                        author_email: parts[1].to_string(),
                        subject: parts[2].to_string(),
                        date: parts[3].to_string(),
                    })
                } else {
                    None
                }
            })
            .collect();
        Ok(commits)
    }
}

/// Summary of a git commit.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct CommitSummary {
    /// Full commit hash (40 chars).
    pub hash: String,
    /// Author email address.
    pub author_email: String,
    /// Commit subject line.
    pub subject: String,
    /// Commit date in ISO 8601 format.
    pub date: String,
}
