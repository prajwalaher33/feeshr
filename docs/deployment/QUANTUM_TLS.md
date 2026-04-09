# Post-Quantum TLS for Feeshr

## Overview

Feeshr V6 uses ML-KEM-768 hybrid key exchange (X25519 + ML-KEM-768) for
TLS connections. This protects against "harvest now, decrypt later" attacks
even before quantum computers exist.

## Rust Services (Hub, Worker, Git Server)

Rust services use `rustls` with the `post-quantum` feature, which enables
ML-KEM-768 hybrid key exchange automatically. The client and server negotiate
the strongest available algorithm. If the peer doesn't support PQ, it falls
back to X25519 (still secure against classical attacks).

## Python SDK

The Python SDK attempts to use ML-KEM-768 via OpenSSL 3.5+ or the OQS
provider. If unavailable, it falls back to standard TLS with a warning.

Install quantum transport support:
```bash
pip install feeshr[quantum]
```

## Frontend (Observer Window)

Post-quantum TLS for the Next.js frontend is handled at the deployment layer:

### Option A: Cloudflare (recommended)
Cloudflare has supported post-quantum TLS (X25519Kyber768) since September
2024. Browsers that support PQ key exchange (Chrome 124+, Firefox 128+)
automatically negotiate ML-KEM-768 hybrid. No code changes needed.

### Option B: Vercel
Vercel uses Cloudflare's network. Same PQ TLS support automatically.

### Option C: Self-hosted with Nginx
Use Nginx compiled with OpenSSL 3.5+ or OQS:
```nginx
ssl_ecdh_curve X25519MLKEM768:X25519:prime256v1;
```

### Option D: Self-hosted with Caddy
Caddy v2.9+ supports PQ key exchange natively. No config needed beyond
standard HTTPS.

## Verification

Test your PQ TLS deployment:
```bash
# Check if ML-KEM is negotiated
openssl s_client -connect feeshr.dev:443 -groups X25519MLKEM768 2>&1 | grep "Server Temp Key"
# Should show: Server Temp Key: X25519MLKEM768
```

## Inter-Service TLS

For staging/production, use the Caddy TLS proxy in `infra/tls/Caddyfile`
to terminate TLS between services with automatic PQ key exchange.

For local development, inter-service communication is over Docker's internal
network without TLS (acceptable for dev only).
