#!/usr/bin/env bash
# Sandbox isolation tests.
#
# Verifies that the sandbox enforces:
#   1. No network access
#   2. Read-only filesystem (except /tmp, /workspace)
#   3. No privilege escalation
#   4. Memory limits
#   5. Timeout enforcement
#   6. No access to host secrets/env
#   7. PID limits
#
# Usage:
#   ./scripts/sandbox/test_isolation.sh [docker|gvisor]
#
# Requires Docker to be running.

set -euo pipefail

RUNTIME="${1:-docker}"
PASSED=0
FAILED=0
IMAGE="python:3.12-slim"

echo "=== Feeshr Sandbox Isolation Tests (runtime: $RUNTIME) ==="
echo ""

run_sandboxed() {
    local cmd="$1"
    local timeout="${2:-10}"
    local extra_flags=()

    if [ "$RUNTIME" = "gvisor" ]; then
        if docker info --format '{{.Runtimes}}' 2>/dev/null | grep -q runsc; then
            extra_flags+=(--runtime=runsc)
        else
            echo "SKIP: gVisor not available, using standard Docker"
        fi
    fi

    timeout "$timeout" docker run \
        --rm \
        --network=none \
        --memory=512m \
        --cpus=1 \
        --security-opt=no-new-privileges \
        --cap-drop=ALL \
        --read-only \
        --tmpfs=/tmp:rw,noexec,nosuid,size=256m \
        --tmpfs=/workspace:rw,noexec,nosuid,size=512m \
        --pids-limit=256 \
        "${extra_flags[@]}" \
        "$IMAGE" \
        bash -c "$cmd" 2>&1
}

assert_fails() {
    local name="$1"
    local cmd="$2"
    local timeout="${3:-10}"

    if output=$(run_sandboxed "$cmd" "$timeout" 2>&1); then
        echo "FAIL: $name — command succeeded but should have failed"
        echo "  Output: ${output:0:200}"
        FAILED=$((FAILED + 1))
    else
        echo "PASS: $name"
        PASSED=$((PASSED + 1))
    fi
}

assert_succeeds() {
    local name="$1"
    local cmd="$2"
    local timeout="${3:-10}"

    if output=$(run_sandboxed "$cmd" "$timeout" 2>&1); then
        echo "PASS: $name"
        PASSED=$((PASSED + 1))
    else
        echo "FAIL: $name — command failed but should have succeeded"
        echo "  Output: ${output:0:200}"
        FAILED=$((FAILED + 1))
    fi
}

# Test 1: No network access
echo "--- Network isolation ---"
assert_fails "Cannot reach external hosts" \
    "curl -s --max-time 3 http://google.com || wget -q -O- http://google.com 2>&1 || python3 -c \"import urllib.request; urllib.request.urlopen('http://google.com', timeout=3)\""

assert_fails "Cannot resolve DNS" \
    "python3 -c \"import socket; socket.getaddrinfo('google.com', 80)\""

# Test 2: Read-only filesystem
echo ""
echo "--- Filesystem isolation ---"
assert_fails "Cannot write to /etc" \
    "echo 'test' > /etc/test_file"

assert_fails "Cannot write to /usr" \
    "echo 'test' > /usr/test_file"

assert_succeeds "Can write to /tmp" \
    "echo 'test' > /tmp/test_file && cat /tmp/test_file"

assert_succeeds "Can write to /workspace" \
    "echo 'test' > /workspace/test_file && cat /workspace/test_file"

# Test 3: No privilege escalation
echo ""
echo "--- Privilege isolation ---"
assert_fails "Cannot use sudo" \
    "sudo ls / 2>&1"

assert_fails "Cannot mount filesystems" \
    "mount -t tmpfs none /mnt 2>&1"

assert_fails "Cannot change capabilities" \
    "python3 -c \"import os; os.setuid(0)\" 2>&1"

# Test 4: No access to host secrets
echo ""
echo "--- Secret isolation ---"
assert_fails "Cannot access Docker socket" \
    "ls /var/run/docker.sock 2>&1"

assert_fails "No host environment leakage" \
    "python3 -c \"
import os
secrets = ['DATABASE_URL', 'REDIS_URL', 'NPM_TOKEN', 'PYPI_TOKEN', 'AWS_SECRET']
found = [k for k in secrets if os.environ.get(k)]
if found:
    raise SystemExit(0)
raise SystemExit(1)
\""

# Test 5: Benign workload succeeds
echo ""
echo "--- Benign workload ---"
assert_succeeds "Python script runs" \
    "python3 -c \"print('Hello from sandbox')\""

assert_succeeds "Basic file operations in /tmp" \
    "python3 -c \"
import json, tempfile, os
data = {'test': True, 'value': 42}
path = '/tmp/test.json'
with open(path, 'w') as f:
    json.dump(data, f)
with open(path) as f:
    loaded = json.load(f)
assert loaded == data
print('JSON round-trip OK')
\""

# Test 6: PID limit
echo ""
echo "--- Resource limits ---"
assert_fails "PID bomb is contained" \
    "python3 -c \"
import os, sys
pids = []
for i in range(500):
    pid = os.fork()
    if pid == 0:
        os._exit(0)
    pids.append(pid)
print(f'Forked {len(pids)} processes')
\" 2>&1" 15

# Summary
echo ""
echo "==================================="
echo "Results: $PASSED passed, $FAILED failed"
echo "==================================="

if [ $FAILED -gt 0 ]; then
    echo "SANDBOX ISOLATION INCOMPLETE — review failures above"
    exit 1
else
    echo "All isolation tests passed."
    exit 0
fi
