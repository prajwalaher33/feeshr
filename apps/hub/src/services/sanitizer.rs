//! Feed event sanitizer — strips forbidden keys before public broadcast.
//!
//! The public feed MUST NEVER expose trace fields, prompts, secrets, or
//! chain-of-thought data.  This module enforces that invariant at the
//! serialization boundary.

use serde_json::Value;
use tracing::warn;

/// Keys that must never appear in a public feed event, at any nesting depth.
const FORBIDDEN_PREFIXES: &[&str] = &["trace_", "cot"];
const FORBIDDEN_EXACT: &[&str] = &[
    "chain_of_thought",
    "prompt",
    "secret",
    "token",
    "reasoning_trace",
    "context_tokens",
    "reasoning_tokens",
    "decision_tokens",
    "total_tokens",
    "api_key",
    "private_key",
    "access_token",
    "refresh_token",
    "password",
    "credential",
];

/// Returns `true` if the key is forbidden in public events.
fn is_forbidden_key(key: &str) -> bool {
    let lower = key.to_ascii_lowercase();
    if FORBIDDEN_EXACT.iter().any(|&k| lower == k) {
        return true;
    }
    if FORBIDDEN_PREFIXES.iter().any(|&p| lower.starts_with(p)) {
        return true;
    }
    false
}

/// Recursively strip forbidden keys from a JSON value.
///
/// Returns the sanitized value and a count of removed keys.
pub fn sanitize_value(value: &mut Value) -> usize {
    let mut removed = 0;
    match value {
        Value::Object(map) => {
            let keys_to_remove: Vec<String> = map
                .keys()
                .filter(|k| is_forbidden_key(k))
                .cloned()
                .collect();
            for key in &keys_to_remove {
                map.remove(key);
                removed += 1;
            }
            for v in map.values_mut() {
                removed += sanitize_value(v);
            }
        }
        Value::Array(arr) => {
            for v in arr.iter_mut() {
                removed += sanitize_value(v);
            }
        }
        _ => {}
    }
    removed
}

/// Sanitize a JSON string. Returns `None` if parsing fails.
///
/// Logs a warning if any forbidden keys were stripped.
pub fn sanitize_json(raw: &str) -> Option<String> {
    let mut value: Value = serde_json::from_str(raw).ok()?;
    let removed = sanitize_value(&mut value);
    if removed > 0 {
        warn!(
            removed_keys = removed,
            "Sanitizer stripped forbidden keys from feed event"
        );
    }
    serde_json::to_string(&value).ok()
}

/// Validate that a JSON value contains no forbidden keys (non-mutating check).
///
/// Returns a list of forbidden keys found.
/// Used in privacy contract tests and the feed endpoint.
#[allow(dead_code)]
pub fn validate_no_forbidden_keys(value: &Value) -> Vec<String> {
    let mut found = Vec::new();
    match value {
        Value::Object(map) => {
            for (key, val) in map {
                if is_forbidden_key(key) {
                    found.push(key.clone());
                }
                found.extend(validate_no_forbidden_keys(val));
            }
        }
        Value::Array(arr) => {
            for v in arr {
                found.extend(validate_no_forbidden_keys(v));
            }
        }
        _ => {}
    }
    found
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_strips_trace_fields() {
        let mut event = json!({
            "type": "agent_connected",
            "agent_name": "test-bot",
            "trace_context": {"some": "private data"},
            "trace_reasoning": "internal thought",
            "timestamp": "2026-03-28T00:00:00Z"
        });
        let removed = sanitize_value(&mut event);
        assert_eq!(removed, 2);
        assert!(event.get("trace_context").is_none());
        assert!(event.get("trace_reasoning").is_none());
        assert!(event.get("type").is_some());
    }

    #[test]
    fn test_strips_prompt_and_secret() {
        let mut event = json!({
            "type": "pr_submitted",
            "prompt": "system prompt here",
            "secret": "abc123",
            "data": {
                "chain_of_thought": "thinking...",
                "title": "Fix auth bug"
            }
        });
        let removed = sanitize_value(&mut event);
        assert_eq!(removed, 3);
        assert!(event.get("prompt").is_none());
        assert!(event.get("secret").is_none());
        assert!(event["data"].get("chain_of_thought").is_none());
        assert_eq!(event["data"]["title"], "Fix auth bug");
    }

    #[test]
    fn test_strips_token_fields() {
        let mut event = json!({
            "type": "review_submitted",
            "token": "secret-token",
            "api_key": "sk-xxx",
            "access_token": "bearer-xxx",
            "reviewer": "bot-1"
        });
        let removed = sanitize_value(&mut event);
        assert_eq!(removed, 3);
        assert!(event.get("token").is_none());
        assert!(event.get("api_key").is_none());
        assert!(event.get("access_token").is_none());
        assert_eq!(event["reviewer"], "bot-1");
    }

    #[test]
    fn test_clean_event_passes_through() {
        let mut event = json!({
            "type": "lock_acquired",
            "agent_id": "abc",
            "target_type": "issue",
            "timestamp": "2026-03-28T00:00:00Z"
        });
        let removed = sanitize_value(&mut event);
        assert_eq!(removed, 0);
    }

    #[test]
    fn test_nested_forbidden_keys() {
        let mut event = json!({
            "type": "ci_completed",
            "data": {
                "results": {
                    "cot": "chain of thought here",
                    "coverage": 85.5
                }
            }
        });
        let removed = sanitize_value(&mut event);
        assert_eq!(removed, 1);
        assert!(event["data"]["results"].get("cot").is_none());
        assert_eq!(event["data"]["results"]["coverage"], 85.5);
    }

    #[test]
    fn test_validate_finds_forbidden_keys() {
        let event = json!({
            "type": "agent_connected",
            "trace_context": "private",
            "data": {"prompt": "hidden"}
        });
        let found = validate_no_forbidden_keys(&event);
        assert_eq!(found.len(), 2);
        assert!(found.contains(&"trace_context".to_string()));
        assert!(found.contains(&"prompt".to_string()));
    }

    #[test]
    fn test_sanitize_json_string() {
        let raw = r#"{"type":"test","secret":"x","agent":"bot"}"#;
        let result = sanitize_json(raw).expect("sanitize JSON");
        let parsed: Value = serde_json::from_str(&result).expect("parse sanitized JSON");
        assert!(parsed.get("secret").is_none());
        assert_eq!(parsed["agent"], "bot");
    }

    #[test]
    fn test_case_insensitive_stripping() {
        let mut event = json!({
            "type": "test",
            "Trace_Context": "private",
            "PROMPT": "hidden",
            "Secret": "key"
        });
        let removed = sanitize_value(&mut event);
        assert_eq!(removed, 3);
    }
}
