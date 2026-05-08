//! Manages bare git repositories on disk.
//!
//! All repos are stored as bare repositories at {data_dir}/{repo_id}.git
//! Only bare repos are used — agents never interact with working trees.

use std::path::PathBuf;
use thiserror::Error;
use tokio::process::Command;

#[derive(Debug, Error)]
#[allow(dead_code)]
pub enum StorageError {
    #[error("Repository {repo_id} not found at {path}")]
    RepoNotFound { repo_id: String, path: String },

    #[error("Failed to create repository {repo_id}: {reason}")]
    CreateFailed { repo_id: String, reason: String },

    #[error("Git command failed for {repo_id}: exit={exit_code}, stderr={stderr}")]
    GitCommandFailed {
        repo_id: String,
        exit_code: i32,
        stderr: String,
    },

    #[error("Invalid repo id {repo_id:?}: {reason}")]
    InvalidRepoId { repo_id: String, reason: String },

    #[error("Invalid git ref {name:?}")]
    InvalidRef { name: String },

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// 5 MB cap on a single diff response. A focused PR is well under this;
/// a 100-file refactor still fits. Past this we mark the response truncated
/// and the UI offers a "view raw" link instead of trying to render.
pub const MAX_DIFF_BYTES: usize = 5 * 1024 * 1024;

/// Validate a git ref name we're about to feed to `git diff`. Refs come from
/// PR records or query strings and must not start with `-` (would be parsed
/// as a flag) or contain shell/command-injection-shaped characters. Git's own
/// ref naming rules are stricter than this; we just block the dangerous shapes.
pub fn validate_ref(name: &str) -> Result<(), StorageError> {
    let bad_chars = [
        ' ', '\t', '\n', '\r', '\0', '~', '^', ':', '?', '*', '[', '\\',
    ];
    let ok = !name.is_empty()
        && name.len() <= 256
        && !name.starts_with('-')
        && !name.contains("..")
        && !name.contains("@{")
        && !name
            .chars()
            .any(|c| bad_chars.contains(&c) || c.is_control());
    if ok {
        Ok(())
    } else {
        Err(StorageError::InvalidRef {
            name: name.to_string(),
        })
    }
}

/// Allowed character class for repo IDs: ASCII letters, digits, dash,
/// underscore. Path separators, dots, slashes, NUL — explicitly out.
fn is_safe_repo_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Validate a repo id and return a typed error on rejection. Used at every
/// entry point that takes a repo_id from a request body or URL parameter
/// so a malicious caller can't request `../etc/passwd` as a "repo".
pub fn validate_repo_id(repo_id: &str) -> Result<(), StorageError> {
    if is_safe_repo_id(repo_id) {
        Ok(())
    } else {
        Err(StorageError::InvalidRepoId {
            repo_id: repo_id.to_string(),
            reason: "must be 1-128 chars of [A-Za-z0-9_-]".to_string(),
        })
    }
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
        Self {
            data_dir: data_dir.into(),
        }
    }

    /// Get the filesystem path for a repo. Returns an empty path for invalid
    /// IDs so callers can't accidentally land outside `data_dir`.
    ///
    /// # Arguments
    /// * `repo_id` - The repo's UUID (used as directory name)
    pub fn repo_path(&self, repo_id: &str) -> PathBuf {
        if !is_safe_repo_id(repo_id) {
            return PathBuf::new();
        }
        self.data_dir.join(format!("{}.git", repo_id))
    }

    /// Check if a repo exists on disk. Invalid IDs are reported as
    /// non-existent rather than triggering filesystem traversal.
    pub fn repo_exists(&self, repo_id: &str) -> bool {
        if !is_safe_repo_id(repo_id) {
            return false;
        }
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
        validate_repo_id(repo_id)?;
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
        validate_repo_id(repo_id)?;
        let path = self.repo_path(repo_id);
        if !path.exists() {
            return Err(StorageError::RepoNotFound {
                repo_id: repo_id.to_string(),
                path: path.display().to_string(),
            });
        }
        tokio::fs::remove_dir_all(&path)
            .await
            .map_err(StorageError::Io)
    }

    /// List entries in a repo directory at a given ref.
    ///
    /// # Arguments
    /// * `repo_id` - UUID of the repo
    /// * `ref_name` - Git ref to list (e.g., "HEAD", "main", commit hash)
    /// * `path` - Subdirectory path within the repo (empty = root)
    ///
    /// # Returns
    /// Vec of `TreeEntry` records — name, kind (file/dir/symlink/submodule),
    /// and size in bytes for blobs.
    ///
    /// # Errors
    /// Returns an error if the repo or ref does not exist.
    pub async fn list_files(
        &self,
        repo_id: &str,
        ref_name: &str,
        path: &str,
    ) -> Result<Vec<TreeEntry>, StorageError> {
        validate_repo_id(repo_id)?;
        validate_ref(ref_name)?;
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
        // -l adds size for blobs. Output is `<mode> <type> <object> <size>\t<name>`
        // (size is "-" for trees and submodules).
        let output = Command::new("git")
            .args(["--git-dir", &repo_path_str])
            .args(["ls-tree", "-l", &tree_path])
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

        let entries: Vec<TreeEntry> = String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(parse_ls_tree_line)
            .collect();
        Ok(entries)
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
        validate_repo_id(repo_id)?;
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

    /// Compute the unified diff between two refs (base...head merge-base diff).
    ///
    /// # Arguments
    /// * `repo_id` - UUID of the repo
    /// * `base` - The "from" ref (typically the PR target branch, e.g. "main")
    /// * `head` - The "to" ref (typically the PR source branch)
    ///
    /// # Returns
    /// A `DiffResult` with the unified-diff text and a per-file stat list.
    /// The diff is bounded by `MAX_DIFF_BYTES` to keep one giant PR from
    /// streaming hundreds of MB into the response.
    pub async fn get_diff(
        &self,
        repo_id: &str,
        base: &str,
        head: &str,
    ) -> Result<DiffResult, StorageError> {
        validate_repo_id(repo_id)?;
        validate_ref(base)?;
        validate_ref(head)?;

        let repo_path = self.repo_path(repo_id);
        if !repo_path.exists() {
            return Err(StorageError::RepoNotFound {
                repo_id: repo_id.to_string(),
                path: repo_path.display().to_string(),
            });
        }
        let repo_path_str = repo_path.to_str().unwrap_or_default().to_string();
        let range = format!("{}...{}", base, head);

        // Per-file numstat first — tiny output, drives the file list.
        let stat_output = Command::new("git")
            .args(["--git-dir", &repo_path_str])
            .args(["diff", "--numstat", &range])
            .output()
            .await
            .map_err(StorageError::Io)?;

        if !stat_output.status.success() {
            let exit_code = stat_output.status.code().unwrap_or(-1);
            let stderr = String::from_utf8_lossy(&stat_output.stderr).to_string();
            return Err(StorageError::GitCommandFailed {
                repo_id: repo_id.to_string(),
                exit_code,
                stderr,
            });
        }

        let mut files = Vec::new();
        for line in String::from_utf8_lossy(&stat_output.stdout).lines() {
            // Format: "<additions>\t<deletions>\t<path>"
            // Binary files report "-" instead of a number for both columns.
            let mut parts = line.splitn(3, '\t');
            let add_s = parts.next().unwrap_or("");
            let del_s = parts.next().unwrap_or("");
            let path = parts.next().unwrap_or("").to_string();
            if path.is_empty() {
                continue;
            }
            let additions = add_s.parse::<i32>().ok();
            let deletions = del_s.parse::<i32>().ok();
            files.push(DiffFileStat {
                path,
                additions,
                deletions,
                binary: additions.is_none() || deletions.is_none(),
            });
        }

        // Patch body, capped to keep responses sane.
        let patch_output = Command::new("git")
            .args(["--git-dir", &repo_path_str])
            .args(["diff", "--no-color", &range])
            .output()
            .await
            .map_err(StorageError::Io)?;

        if !patch_output.status.success() {
            let exit_code = patch_output.status.code().unwrap_or(-1);
            let stderr = String::from_utf8_lossy(&patch_output.stderr).to_string();
            return Err(StorageError::GitCommandFailed {
                repo_id: repo_id.to_string(),
                exit_code,
                stderr,
            });
        }

        let raw = patch_output.stdout;
        let truncated = raw.len() > MAX_DIFF_BYTES;
        let diff_bytes = if truncated {
            raw[..MAX_DIFF_BYTES].to_vec()
        } else {
            raw
        };
        let diff = String::from_utf8_lossy(&diff_bytes).to_string();

        Ok(DiffResult {
            base: base.to_string(),
            head: head.to_string(),
            files,
            diff,
            truncated,
        })
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
        validate_repo_id(repo_id)?;
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

/// One entry in a directory listing — file, sub-directory, symlink, or
/// submodule. The web file browser uses `kind` to decide whether to drill
/// in or open a viewer.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct TreeEntry {
    pub name: String,
    /// One of: "file", "dir", "symlink", "submodule".
    pub kind: String,
    /// Size in bytes for blobs; null for trees/submodules.
    pub size: Option<u64>,
}

/// Parse a single line of `git ls-tree -l` output. Returns None for
/// unparseable lines so we silently skip rather than fail the listing.
///
/// Format: `<mode> SP <type> SP <hash> SP* <size>\t<name>`
/// Example: `100644 blob abc123     1234\tREADME.md`
fn parse_ls_tree_line(line: &str) -> Option<TreeEntry> {
    let (meta, name) = line.split_once('\t')?;
    let mut parts = meta.split_whitespace();
    let _mode = parts.next()?;
    let typ = parts.next()?;
    let _hash = parts.next()?;
    let size_str = parts.next().unwrap_or("-");
    let kind = match typ {
        "blob" => {
            // Mode 120000 = symlink. We already consumed mode above so we
            // don't have it; the type alone tells file-vs-dir which is
            // what the UI cares about. Symlinks are rare; treat as file.
            "file"
        }
        "tree" => "dir",
        "commit" => "submodule",
        _ => "file",
    };
    let size = size_str.parse::<u64>().ok();
    Some(TreeEntry {
        name: name.to_string(),
        kind: kind.to_string(),
        size,
    })
}

/// Per-file numstat entry from a diff.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct DiffFileStat {
    pub path: String,
    /// Lines added; `None` means git reported "-" (binary file).
    pub additions: Option<i32>,
    /// Lines deleted; `None` for binary files.
    pub deletions: Option<i32>,
    pub binary: bool,
}

/// Result of computing a unified diff between two refs.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct DiffResult {
    pub base: String,
    pub head: String,
    pub files: Vec<DiffFileStat>,
    /// Unified-diff body. May be truncated at `MAX_DIFF_BYTES`.
    pub diff: String,
    /// True when the body was clipped to `MAX_DIFF_BYTES`.
    pub truncated: bool,
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
