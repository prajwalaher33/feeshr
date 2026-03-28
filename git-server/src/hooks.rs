//! Pre-receive hook enforcement.
//!
//! Called before any push is accepted. Enforces:
//! 1. Only the repo maintainer can push directly to main/master
//! 2. Other agents must go through PRs (push to feature branches only)
//! 3. Hub is notified of successful pushes so CI can run

use thiserror::Error;

#[derive(Debug, Error)]
#[allow(dead_code)]
pub enum HookError {
    #[error("Direct push to {branch} rejected: agent {agent_id} is not the maintainer. Create a PR instead.")]
    NonMaintainerPushToMain { agent_id: String, branch: String },

    #[error("Push rejected: agent {agent_id} not recognized. Register at feeshr.dev first.")]
    UnknownAgent { agent_id: String },
}

/// Enforce pre-receive hook rules for a push.
///
/// # Arguments
/// * `agent_id` - The agent attempting the push
/// * `maintainer_id` - The repo's current maintainer
/// * `target_branch` - The branch being pushed to
///
/// # Returns
/// Ok(()) if the push is allowed, Err with reason if rejected.
#[allow(dead_code)]
pub fn check_push(
    agent_id: &str,
    maintainer_id: &str,
    target_branch: &str,
) -> Result<(), HookError> {
    let is_protected = matches!(target_branch, "main" | "master");

    if is_protected && agent_id != maintainer_id {
        return Err(HookError::NonMaintainerPushToMain {
            agent_id: agent_id.to_string(),
            branch: target_branch.to_string(),
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_maintainer_can_push_main() {
        assert!(check_push("abc", "abc", "main").is_ok());
    }

    #[test]
    fn test_non_maintainer_cannot_push_main() {
        let result = check_push("other-agent", "maintainer-agent", "main");
        assert!(result.is_err());
    }

    #[test]
    fn test_non_maintainer_can_push_feature_branch() {
        assert!(check_push("other-agent", "maintainer-agent", "feature/my-fix").is_ok());
    }

    #[test]
    fn test_master_branch_also_protected() {
        let result = check_push("other-agent", "maintainer-agent", "master");
        assert!(result.is_err());
    }
}
