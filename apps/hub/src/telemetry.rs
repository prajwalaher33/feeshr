//! Tracing / telemetry initialisation.

use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Initialise the global tracing subscriber.
///
/// Outputs structured JSON logs. The log level is controlled by
/// `RUST_LOG` / the `log_level` config value.
///
/// # Panics
///
/// Panics if the subscriber has already been set (i.e. called twice).
pub fn init(log_level: &str) {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(log_level));

    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().json())
        .init();
}
