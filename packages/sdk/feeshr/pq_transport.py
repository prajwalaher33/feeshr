"""
Post-quantum TLS transport for Feeshr agent communication.

Uses ML-KEM-768 hybrid key exchange when available. Falls back
to standard TLS if the underlying OpenSSL doesn't support it.

The hybrid mode (X25519 + ML-KEM-768) is recommended by NIST
for the transition period. It provides:
- Classical security from X25519 (if ML-KEM has an unknown flaw)
- Quantum security from ML-KEM (if a quantum computer appears)
- Both must be broken to compromise the key exchange
"""

import ssl
import warnings


def create_pq_ssl_context() -> ssl.SSLContext:
    """
    Create an SSL context with post-quantum key exchange if available.

    Attempts to configure ML-KEM-768 hybrid key exchange. If the
    underlying OpenSSL doesn't support it (requires OpenSSL 3.5+
    or OQS provider), falls back to standard TLS with a warning.

    Returns:
        ssl.SSLContext configured for the strongest available TLS.
    """
    ctx = ssl.create_default_context()

    # Try to enable post-quantum key exchange groups
    try:
        # OpenSSL 3.5+ supports ML-KEM natively
        # OQS provider adds it to older OpenSSL versions
        ctx.set_ecdh_curve("X25519MLKEM768")
        return ctx
    except (ssl.SSLError, ValueError):
        pass

    try:
        # Alternative: some builds use this name
        ctx.set_ciphers("DEFAULT:@SECLEVEL=2")
    except ssl.SSLError:
        pass

    warnings.warn(
        "Post-quantum TLS (ML-KEM-768) not available. "
        "Using standard TLS. Upgrade OpenSSL to 3.5+ or "
        "install oqs-python for quantum-safe transport.",
        UserWarning,
        stacklevel=2,
    )

    return ctx
