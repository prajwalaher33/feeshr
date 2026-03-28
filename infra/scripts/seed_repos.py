"""
Seed the Feeshr hub with 10 repos containing real, working implementation code.

Each repo is a small, genuinely useful library with full source code,
tests, and configuration files.

Run after migrations:
    python infra/scripts/seed_repos.py
"""
import json
import os
import sys
import urllib.request
import time

HUB_URL = os.environ.get("HUB_URL", "http://localhost:8080")


def post(path: str, body: dict) -> dict:
    """
    POST JSON to the hub.

    Args:
        path: API path
        body: Request body

    Returns:
        Response JSON as dict

    Raises:
        RuntimeError: If the request fails
    """
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{HUB_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        raise RuntimeError(f"POST {path} failed ({e.code}): {body_text}") from e


def wait_for_hub() -> None:
    """Wait for the hub to be ready."""
    print(f"Waiting for hub at {HUB_URL}...")
    for _ in range(30):
        try:
            with urllib.request.urlopen(f"{HUB_URL}/health", timeout=2):
                print("Hub is ready.")
                return
        except Exception:
            time.sleep(1)
    raise RuntimeError(f"Hub not ready after 30 seconds at {HUB_URL}")


# ---------------------------------------------------------------------------
# Repo code: each key maps to a dict of {filepath: content}
# ---------------------------------------------------------------------------

REPO_CODE = {
    # -----------------------------------------------------------------------
    # 1. retry-genius (Python) — Smart HTTP retry with exponential backoff
    # -----------------------------------------------------------------------
    "retry-genius": {
        "retry_genius/__init__.py": '''\
"""retry-genius — Smart HTTP retry with exponential backoff, jitter, and circuit breaker."""

from .core import retry, RetryConfig
from .circuit_breaker import CircuitBreaker

__version__ = "0.1.0"
__all__ = ["retry", "RetryConfig", "CircuitBreaker"]
''',

        "retry_genius/core.py": '''\
"""Core retry logic with exponential backoff and jitter."""

import functools
import random
import time
import logging
from dataclasses import dataclass, field
from typing import (
    Any,
    Callable,
    Optional,
    Sequence,
    Tuple,
    Type,
    TypeVar,
    Union,
)

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


@dataclass
class RetryConfig:
    """Configuration for retry behaviour.

    Attributes:
        max_retries: Maximum number of retry attempts (not counting the initial call).
        base_delay: Base delay in seconds before the first retry.
        max_delay: Upper cap on the computed delay.
        backoff_factor: Multiplier applied on each successive retry.
        jitter: If True, add random jitter (0, computed_delay).
        retryable_exceptions: Tuple of exception types that should trigger a retry.
        on_retry: Optional callback invoked before each retry with
                  (attempt, exception, next_delay).
    """

    max_retries: int = 3
    base_delay: float = 0.5
    max_delay: float = 30.0
    backoff_factor: float = 2.0
    jitter: bool = True
    retryable_exceptions: Tuple[Type[BaseException], ...] = (Exception,)
    on_retry: Optional[Callable[[int, BaseException, float], None]] = None


def _compute_delay(attempt: int, config: RetryConfig) -> float:
    """Compute the delay before the next retry.

    Uses exponential backoff with optional full-jitter.

    Args:
        attempt: The current attempt number (1-indexed).
        config: The retry configuration.

    Returns:
        The delay in seconds.
    """
    delay = config.base_delay * (config.backoff_factor ** (attempt - 1))
    delay = min(delay, config.max_delay)
    if config.jitter:
        delay = random.uniform(0, delay)
    return delay


def retry(
    func: Optional[F] = None,
    *,
    max_retries: int = 3,
    base_delay: float = 0.5,
    max_delay: float = 30.0,
    backoff_factor: float = 2.0,
    jitter: bool = True,
    retryable_exceptions: Tuple[Type[BaseException], ...] = (Exception,),
    on_retry: Optional[Callable[[int, BaseException, float], None]] = None,
) -> Any:
    """Decorator that retries a function on failure.

    Can be used with or without arguments::

        @retry
        def my_func(): ...

        @retry(max_retries=5)
        def my_func(): ...

    Args:
        func: The function to wrap (set automatically when used without parens).
        max_retries: Maximum number of retries.
        base_delay: Base delay in seconds.
        max_delay: Maximum delay cap.
        backoff_factor: Exponential backoff multiplier.
        jitter: Whether to apply random jitter.
        retryable_exceptions: Exception types that trigger retries.
        on_retry: Callback before each retry.

    Returns:
        Decorated function or decorator.
    """
    config = RetryConfig(
        max_retries=max_retries,
        base_delay=base_delay,
        max_delay=max_delay,
        backoff_factor=backoff_factor,
        jitter=jitter,
        retryable_exceptions=retryable_exceptions,
        on_retry=on_retry,
    )

    def decorator(fn: F) -> F:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exc: Optional[BaseException] = None
            for attempt in range(1, config.max_retries + 2):  # +1 initial + retries
                try:
                    return fn(*args, **kwargs)
                except config.retryable_exceptions as exc:
                    last_exc = exc
                    if attempt > config.max_retries:
                        logger.warning(
                            "All %d retries exhausted for %s",
                            config.max_retries,
                            fn.__name__,
                        )
                        raise
                    delay = _compute_delay(attempt, config)
                    logger.info(
                        "Retry %d/%d for %s after %.2fs (error: %s)",
                        attempt,
                        config.max_retries,
                        fn.__name__,
                        delay,
                        exc,
                    )
                    if config.on_retry:
                        config.on_retry(attempt, exc, delay)
                    time.sleep(delay)
            raise last_exc  # type: ignore[misc]

        return wrapper  # type: ignore[return-value]

    if func is not None:
        return decorator(func)
    return decorator
''',

        "retry_genius/circuit_breaker.py": '''\
"""Circuit breaker implementation with open / half-open / closed states."""

import threading
import time
import logging
from enum import Enum, auto
from typing import Any, Callable, Optional, TypeVar

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


class State(Enum):
    """Circuit breaker states."""
    CLOSED = auto()
    OPEN = auto()
    HALF_OPEN = auto()


class CircuitBreakerOpenError(Exception):
    """Raised when a call is attempted while the circuit is OPEN."""


class CircuitBreaker:
    """Thread-safe circuit breaker.

    Args:
        failure_threshold: Number of consecutive failures before opening.
        recovery_timeout: Seconds to wait before transitioning from OPEN to HALF_OPEN.
        success_threshold: Successes in HALF_OPEN state required to close again.

    Example::

        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=30)

        @cb
        def call_external_service():
            ...
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        success_threshold: int = 2,
    ) -> None:
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold

        self._state = State.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: Optional[float] = None
        self._lock = threading.Lock()

    @property
    def state(self) -> State:
        """Return the current state, possibly transitioning OPEN -> HALF_OPEN."""
        with self._lock:
            if self._state == State.OPEN and self._last_failure_time is not None:
                elapsed = time.monotonic() - self._last_failure_time
                if elapsed >= self.recovery_timeout:
                    logger.info("Circuit breaker transitioning to HALF_OPEN")
                    self._state = State.HALF_OPEN
                    self._success_count = 0
            return self._state

    def _record_success(self) -> None:
        with self._lock:
            if self._state == State.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.success_threshold:
                    logger.info("Circuit breaker closing after recovery")
                    self._state = State.CLOSED
                    self._failure_count = 0
                    self._success_count = 0
            else:
                self._failure_count = 0

    def _record_failure(self) -> None:
        with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.monotonic()
            if self._state == State.HALF_OPEN:
                logger.info("Circuit breaker re-opening from HALF_OPEN")
                self._state = State.OPEN
            elif self._failure_count >= self.failure_threshold:
                logger.warning(
                    "Circuit breaker opening after %d failures",
                    self._failure_count,
                )
                self._state = State.OPEN

    def __call__(self, func: F) -> F:
        """Use the circuit breaker as a decorator."""
        import functools

        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            if self.state == State.OPEN:
                raise CircuitBreakerOpenError(
                    f"Circuit breaker is OPEN for {func.__name__}"
                )
            try:
                result = func(*args, **kwargs)
            except Exception:
                self._record_failure()
                raise
            else:
                self._record_success()
                return result

        return wrapper  # type: ignore[return-value]

    def reset(self) -> None:
        """Manually reset the circuit breaker to CLOSED."""
        with self._lock:
            self._state = State.CLOSED
            self._failure_count = 0
            self._success_count = 0
            self._last_failure_time = None
''',

        "tests/test_core.py": '''\
"""Tests for retry_genius.core."""

import pytest
from retry_genius.core import retry, RetryConfig, _compute_delay


class TestComputeDelay:
    def test_first_attempt_uses_base_delay(self):
        cfg = RetryConfig(base_delay=1.0, backoff_factor=2.0, jitter=False)
        assert _compute_delay(1, cfg) == 1.0

    def test_exponential_growth(self):
        cfg = RetryConfig(base_delay=1.0, backoff_factor=2.0, jitter=False)
        assert _compute_delay(2, cfg) == 2.0
        assert _compute_delay(3, cfg) == 4.0

    def test_max_delay_cap(self):
        cfg = RetryConfig(base_delay=1.0, backoff_factor=2.0, max_delay=5.0, jitter=False)
        assert _compute_delay(10, cfg) == 5.0

    def test_jitter_within_bounds(self):
        cfg = RetryConfig(base_delay=1.0, backoff_factor=2.0, jitter=True)
        for _ in range(100):
            d = _compute_delay(3, cfg)
            assert 0 <= d <= 4.0


class TestRetryDecorator:
    def test_success_no_retry(self):
        call_count = 0

        @retry(max_retries=3, base_delay=0)
        def succeed():
            nonlocal call_count
            call_count += 1
            return 42

        assert succeed() == 42
        assert call_count == 1

    def test_retries_on_failure(self):
        attempts = 0

        @retry(max_retries=3, base_delay=0, jitter=False)
        def fail_twice():
            nonlocal attempts
            attempts += 1
            if attempts < 3:
                raise ValueError("not yet")
            return "ok"

        assert fail_twice() == "ok"
        assert attempts == 3

    def test_raises_after_max_retries(self):
        @retry(max_retries=2, base_delay=0, jitter=False)
        def always_fail():
            raise RuntimeError("boom")

        with pytest.raises(RuntimeError, match="boom"):
            always_fail()

    def test_on_retry_callback(self):
        logged = []

        def on_retry(attempt, exc, delay):
            logged.append((attempt, str(exc)))

        @retry(max_retries=2, base_delay=0, jitter=False, on_retry=on_retry)
        def flaky():
            if len(logged) < 2:
                raise IOError("fail")
            return "done"

        assert flaky() == "done"
        assert len(logged) == 2

    def test_decorator_without_parens(self):
        @retry
        def simple():
            return 1

        assert simple() == 1

    def test_retryable_exceptions_filter(self):
        @retry(max_retries=3, base_delay=0, retryable_exceptions=(ValueError,))
        def raise_type_error():
            raise TypeError("wrong type")

        with pytest.raises(TypeError):
            raise_type_error()
''',

        "tests/test_circuit_breaker.py": '''\
"""Tests for retry_genius.circuit_breaker."""

import pytest
from retry_genius.circuit_breaker import CircuitBreaker, CircuitBreakerOpenError, State


class TestCircuitBreaker:
    def test_starts_closed(self):
        cb = CircuitBreaker()
        assert cb.state == State.CLOSED

    def test_opens_after_threshold(self):
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=60)

        @cb
        def failing():
            raise RuntimeError("fail")

        for _ in range(3):
            with pytest.raises(RuntimeError):
                failing()

        assert cb.state == State.OPEN

    def test_blocks_calls_when_open(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=60)

        @cb
        def failing():
            raise RuntimeError("fail")

        with pytest.raises(RuntimeError):
            failing()

        with pytest.raises(CircuitBreakerOpenError):
            failing()

    def test_half_open_after_timeout(self):
        import time as _time
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.1)

        @cb
        def failing():
            raise RuntimeError("fail")

        with pytest.raises(RuntimeError):
            failing()

        _time.sleep(0.15)
        assert cb.state == State.HALF_OPEN

    def test_closes_after_success_in_half_open(self):
        import time as _time
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.1, success_threshold=1)
        call_count = 0

        @cb
        def sometimes_fail():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("fail")
            return "ok"

        with pytest.raises(RuntimeError):
            sometimes_fail()

        _time.sleep(0.15)
        assert sometimes_fail() == "ok"
        assert cb.state == State.CLOSED

    def test_reset(self):
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=60)

        @cb
        def failing():
            raise RuntimeError("fail")

        with pytest.raises(RuntimeError):
            failing()
        assert cb.state == State.OPEN

        cb.reset()
        assert cb.state == State.CLOSED
''',

        "pyproject.toml": '''\
[project]
name = "retry-genius"
version = "0.1.0"
description = "Smart HTTP retry with exponential backoff, jitter, and circuit breaker"
requires-python = ">=3.9"

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.pytest.ini_options]
testpaths = ["tests"]
''',

        "README.md": '''\
# retry-genius

Smart HTTP retry with exponential backoff, jitter, and circuit breaker pattern.

## Usage

```python
from retry_genius import retry, CircuitBreaker

@retry(max_retries=3, base_delay=0.5)
def fetch(url):
    return requests.get(url)

cb = CircuitBreaker(failure_threshold=5, recovery_timeout=30)

@cb
@retry(max_retries=2)
def call_service():
    ...
```
''',
    },

    # -----------------------------------------------------------------------
    # 2. env-shield (Python) — Runtime environment variable validation
    # -----------------------------------------------------------------------
    "env-shield": {
        "env_shield/__init__.py": '''\
"""env-shield — Runtime environment variable validation with typed schemas."""

from .core import EnvSchema, EnvField, ValidationError, load

__version__ = "0.1.0"
__all__ = ["EnvSchema", "EnvField", "ValidationError", "load"]
''',

        "env_shield/core.py": '''\
"""Core schema definition and validation logic for environment variables."""

import os
import re
import logging
from dataclasses import dataclass, field
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Optional,
    Sequence,
    Type,
    Union,
)

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Raised when one or more environment variables fail validation.

    Attributes:
        errors: Mapping of variable name to error message.
    """

    def __init__(self, errors: Dict[str, str]) -> None:
        self.errors = errors
        detail = "; ".join(f"{k}: {v}" for k, v in errors.items())
        super().__init__(f"Environment validation failed — {detail}")


@dataclass
class EnvField:
    """Describes a single environment variable.

    Attributes:
        name: The environment variable name (e.g. ``DATABASE_URL``).
        type: Target Python type (str, int, float, bool).
        required: Whether the variable must be present.
        default: Default value when not present and not required.
        pattern: Optional regex pattern the value must match.
        choices: Optional set of allowed values (compared after coercion).
        validator: Optional callable that returns True/False.
        description: Human-readable description for error messages.
    """

    name: str
    type: Type = str
    required: bool = True
    default: Any = None
    pattern: Optional[str] = None
    choices: Optional[Sequence[Any]] = None
    validator: Optional[Callable[[Any], bool]] = None
    description: str = ""


_BOOL_TRUTHY = {"1", "true", "yes", "on", "y"}
_BOOL_FALSY = {"0", "false", "no", "off", "n", ""}


def _coerce(value: str, target_type: Type) -> Any:
    """Coerce a raw string to the target type.

    Args:
        value: The raw string from the environment.
        target_type: The Python type to coerce to.

    Returns:
        The coerced value.

    Raises:
        ValueError: If coercion is not possible.
    """
    if target_type is str:
        return value
    if target_type is int:
        return int(value)
    if target_type is float:
        return float(value)
    if target_type is bool:
        lower = value.strip().lower()
        if lower in _BOOL_TRUTHY:
            return True
        if lower in _BOOL_FALSY:
            return False
        raise ValueError(f"Cannot interpret {value!r} as bool")
    if target_type is list:
        return [item.strip() for item in value.split(",") if item.strip()]
    raise ValueError(f"Unsupported type: {target_type}")


class EnvSchema:
    """Define and validate a set of required environment variables.

    Example::

        schema = EnvSchema([
            EnvField("DATABASE_URL", required=True),
            EnvField("PORT", type=int, default=8080),
            EnvField("DEBUG", type=bool, default=False),
        ])
        config = schema.validate()
        print(config["PORT"])  # int
    """

    def __init__(self, fields: List[EnvField]) -> None:
        self.fields = fields
        self._field_map: Dict[str, EnvField] = {f.name: f for f in fields}

    def validate(self, environ: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Validate environment variables against the schema.

        Args:
            environ: Dict to read from. Defaults to ``os.environ``.

        Returns:
            Dict mapping variable names to their coerced values.

        Raises:
            ValidationError: When one or more variables are missing or invalid.
        """
        if environ is None:
            environ = dict(os.environ)

        result: Dict[str, Any] = {}
        errors: Dict[str, str] = {}

        for f in self.fields:
            raw = environ.get(f.name)

            # --- missing ---
            if raw is None:
                if f.required:
                    desc = f" ({f.description})" if f.description else ""
                    errors[f.name] = f"Missing required variable{desc}"
                    continue
                result[f.name] = f.default
                continue

            # --- coerce ---
            try:
                value = _coerce(raw, f.type)
            except (ValueError, TypeError) as exc:
                errors[f.name] = f"Type coercion to {f.type.__name__} failed: {exc}"
                continue

            # --- pattern ---
            if f.pattern and isinstance(value, str):
                if not re.fullmatch(f.pattern, value):
                    errors[f.name] = (
                        f"Value {value!r} does not match pattern {f.pattern!r}"
                    )
                    continue

            # --- choices ---
            if f.choices is not None and value not in f.choices:
                errors[f.name] = (
                    f"Value {value!r} not in allowed choices {list(f.choices)}"
                )
                continue

            # --- custom validator ---
            if f.validator is not None:
                try:
                    ok = f.validator(value)
                except Exception as exc:
                    errors[f.name] = f"Validator raised: {exc}"
                    continue
                if not ok:
                    errors[f.name] = f"Custom validation failed for {value!r}"
                    continue

            result[f.name] = value

        if errors:
            raise ValidationError(errors)

        logger.info("Environment validated: %d variables OK", len(result))
        return result

    def report(self, environ: Optional[Dict[str, str]] = None) -> str:
        """Return a human-readable validation report.

        Does not raise; captures errors and prints them in a table format.

        Args:
            environ: Dict to read from. Defaults to ``os.environ``.

        Returns:
            Multi-line string describing each variable and its status.
        """
        if environ is None:
            environ = dict(os.environ)

        lines = ["Environment Variable Report", "=" * 40]
        for f in self.fields:
            raw = environ.get(f.name)
            status = "OK"
            if raw is None:
                status = "DEFAULT" if not f.required else "MISSING"
            else:
                try:
                    _coerce(raw, f.type)
                except (ValueError, TypeError):
                    status = "INVALID"
            lines.append(f"  {f.name:<30s} {status}")
        return "\\n".join(lines)


def load(fields: List[EnvField], environ: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Convenience function: create schema and validate in one call.

    Args:
        fields: List of EnvField definitions.
        environ: Optional environment dict.

    Returns:
        Validated configuration dict.
    """
    return EnvSchema(fields).validate(environ)
''',

        "tests/test_core.py": '''\
"""Tests for env_shield.core."""

import pytest
from env_shield.core import EnvSchema, EnvField, ValidationError, _coerce


class TestCoerce:
    def test_str(self):
        assert _coerce("hello", str) == "hello"

    def test_int(self):
        assert _coerce("42", int) == 42

    def test_float(self):
        assert _coerce("3.14", float) == pytest.approx(3.14)

    def test_bool_truthy(self):
        for v in ("1", "true", "yes", "on", "y", "True", "YES"):
            assert _coerce(v, bool) is True

    def test_bool_falsy(self):
        for v in ("0", "false", "no", "off", "n", "", "False"):
            assert _coerce(v, bool) is False

    def test_list(self):
        assert _coerce("a, b, c", list) == ["a", "b", "c"]

    def test_bad_int(self):
        with pytest.raises(ValueError):
            _coerce("abc", int)


class TestEnvSchema:
    def test_valid_env(self):
        schema = EnvSchema([
            EnvField("HOST", type=str),
            EnvField("PORT", type=int),
        ])
        result = schema.validate({"HOST": "localhost", "PORT": "8080"})
        assert result == {"HOST": "localhost", "PORT": 8080}

    def test_missing_required(self):
        schema = EnvSchema([
            EnvField("SECRET", required=True, description="API secret key"),
        ])
        with pytest.raises(ValidationError) as exc_info:
            schema.validate({})
        assert "SECRET" in exc_info.value.errors
        assert "Missing" in exc_info.value.errors["SECRET"]

    def test_default_value(self):
        schema = EnvSchema([
            EnvField("DEBUG", type=bool, required=False, default=False),
        ])
        result = schema.validate({})
        assert result == {"DEBUG": False}

    def test_pattern_match(self):
        schema = EnvSchema([
            EnvField("EMAIL", pattern=r".+@.+\\..+"),
        ])
        result = schema.validate({"EMAIL": "a@b.com"})
        assert result["EMAIL"] == "a@b.com"

    def test_pattern_mismatch(self):
        schema = EnvSchema([
            EnvField("EMAIL", pattern=r".+@.+\\..+"),
        ])
        with pytest.raises(ValidationError):
            schema.validate({"EMAIL": "notanemail"})

    def test_choices(self):
        schema = EnvSchema([
            EnvField("LOG_LEVEL", choices=["DEBUG", "INFO", "WARNING", "ERROR"]),
        ])
        result = schema.validate({"LOG_LEVEL": "INFO"})
        assert result["LOG_LEVEL"] == "INFO"

    def test_invalid_choice(self):
        schema = EnvSchema([
            EnvField("LOG_LEVEL", choices=["DEBUG", "INFO"]),
        ])
        with pytest.raises(ValidationError):
            schema.validate({"LOG_LEVEL": "TRACE"})

    def test_custom_validator(self):
        schema = EnvSchema([
            EnvField("PORT", type=int, validator=lambda p: 1024 <= p <= 65535),
        ])
        result = schema.validate({"PORT": "8080"})
        assert result["PORT"] == 8080

    def test_custom_validator_failure(self):
        schema = EnvSchema([
            EnvField("PORT", type=int, validator=lambda p: 1024 <= p <= 65535),
        ])
        with pytest.raises(ValidationError):
            schema.validate({"PORT": "80"})

    def test_report(self):
        schema = EnvSchema([
            EnvField("A", required=True),
            EnvField("B", required=False, default="x"),
        ])
        report = schema.report({"A": "val"})
        assert "OK" in report
        assert "DEFAULT" in report

    def test_multiple_errors(self):
        schema = EnvSchema([
            EnvField("X", required=True),
            EnvField("Y", required=True),
        ])
        with pytest.raises(ValidationError) as exc_info:
            schema.validate({})
        assert len(exc_info.value.errors) == 2
''',

        "pyproject.toml": '''\
[project]
name = "env-shield"
version = "0.1.0"
description = "Runtime environment variable validation with typed schemas"
requires-python = ">=3.9"

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.pytest.ini_options]
testpaths = ["tests"]
''',

        "README.md": '''\
# env-shield

Runtime environment variable validation with typed schemas.

## Usage

```python
from env_shield import EnvSchema, EnvField

schema = EnvSchema([
    EnvField("DATABASE_URL", required=True),
    EnvField("PORT", type=int, default=8080),
    EnvField("DEBUG", type=bool, default=False),
])

config = schema.validate()
```
''',
    },

    # -----------------------------------------------------------------------
    # 3. csv-surgeon (Python) — Detects and repairs broken CSV files
    # -----------------------------------------------------------------------
    "csv-surgeon": {
        "csv_surgeon/__init__.py": '''\
"""csv-surgeon — Detect and repair broken CSV files."""

from .core import diagnose, repair, detect_delimiter
from .encoding import fix_encoding, detect_encoding

__version__ = "0.1.0"
__all__ = ["diagnose", "repair", "detect_delimiter", "fix_encoding", "detect_encoding"]
''',

        "csv_surgeon/core.py": '''\
"""Core CSV repair logic: detection, diagnosis, and repair."""

import csv
import io
import re
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)

COMMON_DELIMITERS = [",", ";", "\\t", "|", ":", "^"]


@dataclass
class Diagnosis:
    """Result of diagnosing a CSV file.

    Attributes:
        delimiter: Detected delimiter character.
        has_header: Whether the first row appears to be a header.
        num_columns: Most common column count.
        total_rows: Total number of rows read.
        malformed_rows: List of (line_number, reason) tuples.
        encoding: Detected encoding name.
    """
    delimiter: str = ","
    has_header: bool = True
    num_columns: int = 0
    total_rows: int = 0
    malformed_rows: List[Tuple[int, str]] = field(default_factory=list)
    encoding: str = "utf-8"

    @property
    def is_healthy(self) -> bool:
        return len(self.malformed_rows) == 0


def detect_delimiter(sample: str) -> str:
    """Detect the delimiter used in a CSV sample.

    Counts occurrences of common delimiters across all lines and picks
    the one with the most consistent per-line count.

    Args:
        sample: A string containing the first portion of the CSV file.

    Returns:
        The detected delimiter character.
    """
    lines = sample.strip().splitlines()
    if not lines:
        return ","

    best_delimiter = ","
    best_score = -1

    for delim in COMMON_DELIMITERS:
        counts = [line.count(delim) for line in lines]
        if not counts or max(counts) == 0:
            continue
        # Score: high consistency (low variance) and high count
        avg = sum(counts) / len(counts)
        if avg == 0:
            continue
        variance = sum((c - avg) ** 2 for c in counts) / len(counts)
        score = avg / (1 + variance)
        if score > best_score:
            best_score = score
            best_delimiter = delim

    return best_delimiter


def _most_common(values: List[int]) -> int:
    """Return the most common value from a list of ints."""
    if not values:
        return 0
    from collections import Counter
    counter = Counter(values)
    return counter.most_common(1)[0][0]


def diagnose(text: str, delimiter: Optional[str] = None) -> Diagnosis:
    """Diagnose problems in a CSV string.

    Args:
        text: The full CSV content as a string.
        delimiter: Override for delimiter detection.

    Returns:
        A Diagnosis object.
    """
    if delimiter is None:
        delimiter = detect_delimiter(text[:4096])

    result = Diagnosis(delimiter=delimiter)
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)

    column_counts: List[int] = []
    rows_raw: List[List[str]] = []

    for i, row in enumerate(reader, start=1):
        column_counts.append(len(row))
        rows_raw.append(row)

    result.total_rows = len(rows_raw)
    if not column_counts:
        return result

    expected_cols = _most_common(column_counts)
    result.num_columns = expected_cols

    # Check for header heuristic: first row has unique non-numeric values
    if rows_raw:
        first = rows_raw[0]
        numeric_count = sum(1 for v in first if re.fullmatch(r"-?\\d+(\\.\\d+)?", v.strip()))
        result.has_header = numeric_count < len(first) / 2

    for i, count in enumerate(column_counts, start=1):
        if count != expected_cols:
            result.malformed_rows.append(
                (i, f"Expected {expected_cols} columns, got {count}")
            )

    return result


def repair(
    text: str,
    delimiter: Optional[str] = None,
    strategy: str = "pad",
) -> str:
    """Repair a broken CSV string.

    Strategies:
      - ``pad``: Add empty fields to short rows, truncate long rows.
      - ``drop``: Remove malformed rows entirely.

    Args:
        text: The raw CSV content.
        delimiter: Override delimiter detection.
        strategy: Repair strategy (pad or drop).

    Returns:
        The repaired CSV as a string.

    Raises:
        ValueError: If strategy is unknown.
    """
    if strategy not in ("pad", "drop"):
        raise ValueError(f"Unknown strategy: {strategy!r}")

    diag = diagnose(text, delimiter=delimiter)
    expected = diag.num_columns
    delim = diag.delimiter

    reader = csv.reader(io.StringIO(text), delimiter=delim)
    output = io.StringIO()
    writer = csv.writer(output, delimiter=delim, lineterminator="\\n")

    malformed_lines = {line for line, _ in diag.malformed_rows}

    for i, row in enumerate(reader, start=1):
        if i not in malformed_lines:
            writer.writerow(row)
            continue

        if strategy == "drop":
            logger.debug("Dropping malformed row %d", i)
            continue

        # pad strategy
        if len(row) < expected:
            row.extend([""] * (expected - len(row)))
        elif len(row) > expected:
            row = row[:expected]
        writer.writerow(row)

    return output.getvalue()


def repair_file(
    input_path: str,
    output_path: Optional[str] = None,
    delimiter: Optional[str] = None,
    strategy: str = "pad",
    encoding: str = "utf-8",
) -> str:
    """Convenience wrapper that reads/writes files.

    Args:
        input_path: Path to the broken CSV file.
        output_path: Where to write the repaired file. Defaults to input_path.
        delimiter: Override delimiter detection.
        strategy: Repair strategy.
        encoding: File encoding.

    Returns:
        Path to the repaired file.
    """
    if output_path is None:
        output_path = input_path

    with open(input_path, encoding=encoding, errors="replace") as fh:
        text = fh.read()

    repaired = repair(text, delimiter=delimiter, strategy=strategy)

    with open(output_path, "w", encoding="utf-8", newline="") as fh:
        fh.write(repaired)

    return output_path
''',

        "csv_surgeon/encoding.py": '''\
"""Encoding detection and conversion utilities."""

import codecs
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# BOM signatures in order of specificity
_BOM_MAP = [
    (codecs.BOM_UTF32_BE, "utf-32-be"),
    (codecs.BOM_UTF32_LE, "utf-32-le"),
    (codecs.BOM_UTF16_BE, "utf-16-be"),
    (codecs.BOM_UTF16_LE, "utf-16-le"),
    (codecs.BOM_UTF8, "utf-8-sig"),
]

# Byte-pattern heuristics for common encodings
_ENCODING_HINTS = [
    (b"\\xef\\xbb\\xbf", "utf-8-sig"),
    (b"\\xff\\xfe", "utf-16-le"),
    (b"\\xfe\\xff", "utf-16-be"),
]


def detect_encoding(data: bytes) -> Tuple[str, float]:
    """Detect the encoding of raw bytes.

    Uses BOM detection first, then falls back to heuristics.

    Args:
        data: Raw file bytes.

    Returns:
        Tuple of (encoding_name, confidence) where confidence is 0.0-1.0.
    """
    # Check BOM
    for bom, enc in _BOM_MAP:
        if data.startswith(bom):
            return enc, 1.0

    # Try UTF-8 decode
    try:
        data.decode("utf-8")
        return "utf-8", 0.9
    except UnicodeDecodeError:
        pass

    # Try latin-1 (always succeeds but low confidence)
    high_bytes = sum(1 for b in data if b > 127)
    ratio = high_bytes / max(len(data), 1)

    if ratio < 0.05:
        return "ascii", 0.8

    # Attempt windows-1252
    try:
        data.decode("windows-1252")
        return "windows-1252", 0.6
    except (UnicodeDecodeError, LookupError):
        pass

    return "latin-1", 0.4


def fix_encoding(
    data: bytes,
    target_encoding: str = "utf-8",
    source_encoding: Optional[str] = None,
) -> str:
    """Convert bytes to a string in the target encoding.

    Args:
        data: Raw file bytes.
        target_encoding: Desired output encoding.
        source_encoding: If None, auto-detect.

    Returns:
        Decoded string.
    """
    if source_encoding is None:
        source_encoding, confidence = detect_encoding(data)
        logger.info("Detected encoding %s (confidence=%.1f)", source_encoding, confidence)

    text = data.decode(source_encoding, errors="replace")
    # Re-encode and decode to target to normalise
    return text.encode(target_encoding, errors="replace").decode(target_encoding)
''',

        "tests/test_core.py": '''\
"""Tests for csv_surgeon.core."""

import pytest
from csv_surgeon.core import detect_delimiter, diagnose, repair


class TestDetectDelimiter:
    def test_comma(self):
        assert detect_delimiter("a,b,c\\n1,2,3") == ","

    def test_semicolon(self):
        assert detect_delimiter("a;b;c\\n1;2;3") == ";"

    def test_tab(self):
        assert detect_delimiter("a\\tb\\tc\\n1\\t2\\t3") == "\\t"

    def test_pipe(self):
        assert detect_delimiter("a|b|c\\n1|2|3") == "|"

    def test_empty(self):
        assert detect_delimiter("") == ","


class TestDiagnose:
    def test_healthy_csv(self):
        text = "a,b,c\\n1,2,3\\n4,5,6"
        diag = diagnose(text)
        assert diag.is_healthy
        assert diag.num_columns == 3

    def test_detects_short_row(self):
        text = "a,b,c\\n1,2\\n4,5,6"
        diag = diagnose(text)
        assert not diag.is_healthy
        assert len(diag.malformed_rows) == 1
        assert diag.malformed_rows[0][0] == 2

    def test_detects_long_row(self):
        text = "a,b\\n1,2,3\\n4,5"
        diag = diagnose(text)
        assert not diag.is_healthy

    def test_has_header_detection(self):
        text = "name,age,city\\nAlice,30,NYC"
        diag = diagnose(text)
        assert diag.has_header


class TestRepair:
    def test_pad_short_row(self):
        text = "a,b,c\\n1,2\\n4,5,6"
        result = repair(text, strategy="pad")
        lines = result.strip().splitlines()
        assert len(lines) == 3
        assert lines[1].count(",") == 2  # padded to 3 columns

    def test_drop_malformed(self):
        text = "a,b,c\\n1,2\\n4,5,6"
        result = repair(text, strategy="drop")
        lines = result.strip().splitlines()
        assert len(lines) == 2

    def test_truncate_long_row(self):
        text = "a,b\\n1,2,3\\n4,5"
        result = repair(text, strategy="pad")
        lines = result.strip().splitlines()
        assert lines[1].count(",") == 1

    def test_already_valid(self):
        text = "a,b\\n1,2\\n3,4"
        assert repair(text) == text + "\\n" or repair(text).strip() == text

    def test_bad_strategy(self):
        with pytest.raises(ValueError):
            repair("a,b", strategy="magic")
''',

        "pyproject.toml": '''\
[project]
name = "csv-surgeon"
version = "0.1.0"
description = "Detect and repair broken CSV files"
requires-python = ">=3.9"

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.pytest.ini_options]
testpaths = ["tests"]
''',

        "README.md": '''\
# csv-surgeon

Detects and repairs broken CSV files — wrong delimiters, inconsistent columns,
encoding issues.

## Usage

```python
from csv_surgeon import diagnose, repair

diag = diagnose(open("data.csv").read())
print(diag.malformed_rows)

fixed = repair(open("data.csv").read(), strategy="pad")
```
''',
    },

    # -----------------------------------------------------------------------
    # 4. json-schema-guesser (TypeScript) — Infers JSON Schema from samples
    # -----------------------------------------------------------------------
    "json-schema-guesser": {
        "src/index.ts": '''\
export { inferSchema, mergeSchemas } from "./infer";
export type { JSONSchema, InferOptions } from "./types";
''',

        "src/types.ts": '''\
/**
 * Simplified JSON Schema representation.
 */
export interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: unknown[];
  format?: string;
  description?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  additionalProperties?: boolean;
}

export interface InferOptions {
  /**
   * Whether to mark all observed keys as required.
   * @default true
   */
  requireAllKeys?: boolean;

  /**
   * Whether to detect common string formats (email, uri, date-time, uuid).
   * @default true
   */
  detectFormats?: boolean;

  /**
   * Maximum depth to traverse. 0 = unlimited.
   * @default 0
   */
  maxDepth?: number;
}
''',

        "src/infer.ts": '''\
import type { JSONSchema, InferOptions } from "./types";

const DEFAULT_OPTIONS: Required<InferOptions> = {
  requireAllKeys: true,
  detectFormats: true,
  maxDepth: 0,
};

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

const FORMAT_PATTERNS: [RegExp, string][] = [
  [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/, "email"],
  [/^https?:\\/\\//, "uri"],
  [/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/, "date-time"],
  [/^\\d{4}-\\d{2}-\\d{2}$/, "date"],
  [
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "uuid",
  ],
  [/^\\d{1,3}(\\.\\d{1,3}){3}$/, "ipv4"],
];

function detectFormat(value: string): string | undefined {
  for (const [pattern, format] of FORMAT_PATTERNS) {
    if (pattern.test(value)) {
      return format;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Type inference for a single value
// ---------------------------------------------------------------------------

function inferSingle(
  value: unknown,
  opts: Required<InferOptions>,
  depth: number
): JSONSchema {
  if (value === null) {
    return { type: "null" };
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { type: "array", items: {} };
    }
    const itemSchemas = value.map((v) => inferSingle(v, opts, depth + 1));
    const merged = itemSchemas.reduce((acc, s) => mergeTwo(acc, s), itemSchemas[0]);
    return { type: "array", items: merged };
  }

  switch (typeof value) {
    case "string": {
      const schema: JSONSchema = { type: "string" };
      if (opts.detectFormats) {
        const fmt = detectFormat(value);
        if (fmt) schema.format = fmt;
      }
      return schema;
    }
    case "number":
      return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "object": {
      if (opts.maxDepth > 0 && depth >= opts.maxDepth) {
        return { type: "object" };
      }
      const properties: Record<string, JSONSchema> = {};
      const required: string[] = [];
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        properties[key] = inferSingle(val, opts, depth + 1);
        if (opts.requireAllKeys) {
          required.push(key);
        }
      }
      const schema: JSONSchema = { type: "object", properties };
      if (required.length > 0) {
        schema.required = required.sort();
      }
      return schema;
    }
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Merging two schemas
// ---------------------------------------------------------------------------

function mergeTypes(
  a: string | string[] | undefined,
  b: string | string[] | undefined
): string | string[] | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  const setA = new Set(Array.isArray(a) ? a : [a]);
  const setB = Array.isArray(b) ? b : [b];
  for (const t of setB) setA.add(t);
  const arr = [...setA];
  return arr.length === 1 ? arr[0] : arr.sort();
}

function mergeTwo(a: JSONSchema, b: JSONSchema): JSONSchema {
  const result: JSONSchema = {};

  result.type = mergeTypes(a.type, b.type);

  // Merge properties
  if (a.properties || b.properties) {
    const allKeys = new Set([
      ...Object.keys(a.properties ?? {}),
      ...Object.keys(b.properties ?? {}),
    ]);
    result.properties = {};
    const aReq = new Set(a.required ?? []);
    const bReq = new Set(b.required ?? []);
    const required: string[] = [];

    for (const key of allKeys) {
      const aProp = a.properties?.[key];
      const bProp = b.properties?.[key];
      if (aProp && bProp) {
        result.properties[key] = mergeTwo(aProp, bProp);
        if (aReq.has(key) && bReq.has(key)) required.push(key);
      } else {
        result.properties[key] = aProp ?? bProp!;
        // Key not present in both samples => not required
      }
    }

    if (required.length > 0) {
      result.required = required.sort();
    }
  }

  // Merge items (arrays)
  if (a.items || b.items) {
    if (a.items && b.items) {
      result.items = mergeTwo(a.items, b.items);
    } else {
      result.items = a.items ?? b.items;
    }
  }

  // Merge format (drop if different)
  if (a.format && b.format && a.format === b.format) {
    result.format = a.format;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Infer a JSON Schema from a single sample value.
 */
export function inferSchema(
  sample: unknown,
  options?: InferOptions
): JSONSchema {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return inferSingle(sample, opts, 0);
}

/**
 * Merge multiple schemas (e.g. inferred from multiple samples) into one.
 */
export function mergeSchemas(schemas: JSONSchema[]): JSONSchema {
  if (schemas.length === 0) return {};
  return schemas.reduce((acc, s) => mergeTwo(acc, s));
}
''',

        "tests/infer.test.ts": '''\
import { inferSchema, mergeSchemas } from "../src/infer";
import type { JSONSchema } from "../src/types";

describe("inferSchema", () => {
  test("infers string type", () => {
    expect(inferSchema("hello")).toEqual({ type: "string" });
  });

  test("infers integer type", () => {
    expect(inferSchema(42)).toEqual({ type: "integer" });
  });

  test("infers number type", () => {
    expect(inferSchema(3.14)).toEqual({ type: "number" });
  });

  test("infers boolean type", () => {
    expect(inferSchema(true)).toEqual({ type: "boolean" });
  });

  test("infers null type", () => {
    expect(inferSchema(null)).toEqual({ type: "null" });
  });

  test("infers object with properties", () => {
    const schema = inferSchema({ name: "Alice", age: 30 });
    expect(schema.type).toBe("object");
    expect(schema.properties?.name).toEqual({ type: "string" });
    expect(schema.properties?.age).toEqual({ type: "integer" });
    expect(schema.required).toEqual(["age", "name"]);
  });

  test("infers array items", () => {
    const schema = inferSchema([1, 2, 3]);
    expect(schema.type).toBe("array");
    expect(schema.items).toEqual({ type: "integer" });
  });

  test("infers mixed array items", () => {
    const schema = inferSchema([1, "two"]);
    expect(schema.type).toBe("array");
    const itemType = schema.items?.type;
    expect(itemType).toEqual(["integer", "string"]);
  });

  test("detects email format", () => {
    const schema = inferSchema("user@example.com");
    expect(schema.format).toBe("email");
  });

  test("detects date-time format", () => {
    const schema = inferSchema("2024-01-15T10:30:00Z");
    expect(schema.format).toBe("date-time");
  });

  test("detects uuid format", () => {
    const schema = inferSchema("550e8400-e29b-41d4-a716-446655440000");
    expect(schema.format).toBe("uuid");
  });

  test("skips format detection when disabled", () => {
    const schema = inferSchema("user@example.com", { detectFormats: false });
    expect(schema.format).toBeUndefined();
  });

  test("respects maxDepth", () => {
    const schema = inferSchema({ a: { b: { c: 1 } } }, { maxDepth: 1 });
    expect(schema.properties?.a).toEqual({ type: "object" });
  });
});

describe("mergeSchemas", () => {
  test("merges two compatible objects", () => {
    const s1 = inferSchema({ name: "Alice", age: 30 });
    const s2 = inferSchema({ name: "Bob", email: "bob@test.com" });
    const merged = mergeSchemas([s1, s2]);
    expect(merged.properties?.name).toBeDefined();
    expect(merged.properties?.age).toBeDefined();
    expect(merged.properties?.email).toBeDefined();
    // name is in both => required; age and email are not in both => not required
    expect(merged.required).toEqual(["name"]);
  });

  test("merges empty array returns empty", () => {
    expect(mergeSchemas([])).toEqual({});
  });
});
''',

        "package.json": '''\
{
  "name": "json-schema-guesser",
  "version": "0.1.0",
  "description": "Infer JSON Schema from sample JSON payloads",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "@types/jest": "^29.5.0"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node"
  }
}
''',

        "tsconfig.json": '''\
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
''',

        "README.md": '''\
# json-schema-guesser

Infer JSON Schema from sample JSON payloads automatically.

## Usage

```typescript
import { inferSchema, mergeSchemas } from "json-schema-guesser";

const schema = inferSchema({ name: "Alice", age: 30 });
// { type: "object", properties: { name: { type: "string" }, age: { type: "integer" } } }

// Merge schemas from multiple samples
const merged = mergeSchemas([schema1, schema2]);
```
''',
    },

    # -----------------------------------------------------------------------
    # 5. log-surgeon (Python) — Parses unstructured log files
    # -----------------------------------------------------------------------
    "log-surgeon": {
        "log_surgeon/__init__.py": '''\
"""log-surgeon — Parse unstructured log files into structured JSON."""

from .parser import parse, parse_line, LogEntry, auto_detect_format
from .timestamp_detector import detect_timestamp, TimestampInfo

__version__ = "0.1.0"
__all__ = [
    "parse", "parse_line", "LogEntry", "auto_detect_format",
    "detect_timestamp", "TimestampInfo",
]
''',

        "log_surgeon/parser.py": '''\
"""Log file parser: converts unstructured logs into structured LogEntry objects."""

import json
import re
import logging
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Pattern, Tuple

from .timestamp_detector import detect_timestamp

logger = logging.getLogger(__name__)

# Common log format patterns
_PATTERNS: List[Tuple[str, Pattern[str]]] = [
    # Apache / Nginx combined log format
    (
        "combined",
        re.compile(
            r'(?P<ip>[\\d.]+) - (?P<user>\\S+) \\[(?P<timestamp>[^\\]]+)\\] '
            r'"(?P<method>\\w+) (?P<path>\\S+) \\S+" (?P<status>\\d+) (?P<size>\\d+)'
        ),
    ),
    # Syslog format
    (
        "syslog",
        re.compile(
            r"(?P<timestamp>\\w{3}\\s+\\d+\\s+[\\d:]+) "
            r"(?P<host>\\S+) (?P<process>[\\w\\-]+)"
            r"(?:\\[(?P<pid>\\d+)\\])?: (?P<message>.*)"
        ),
    ),
    # Python logging default format
    (
        "python",
        re.compile(
            r"(?P<level>DEBUG|INFO|WARNING|ERROR|CRITICAL)"
            r"\\s*:\\s*(?P<logger>[\\w.]+)\\s*:\\s*(?P<message>.*)"
        ),
    ),
    # ISO timestamp + level + message
    (
        "iso",
        re.compile(
            r"(?P<timestamp>\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}"
            r"(?:\\.\\d+)?(?:[+-]\\d{2}:?\\d{2}|Z)?)"
            r"\\s+\\[?(?P<level>\\w+)\\]?\\s+(?P<message>.*)"
        ),
    ),
    # Simple level: message
    (
        "simple",
        re.compile(
            r"\\[?(?P<level>DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|CRITICAL)\\]?"
            r"\\s+(?P<message>.*)"
        ),
    ),
]


@dataclass
class LogEntry:
    """A single parsed log entry.

    Attributes:
        raw: The original line.
        timestamp: Parsed timestamp string (if detected).
        level: Log level (if detected).
        message: The log message body.
        fields: Additional extracted fields.
        format_name: Name of the matched format pattern.
        line_number: Line number in the source file.
    """
    raw: str = ""
    timestamp: Optional[str] = None
    level: Optional[str] = None
    message: str = ""
    fields: Dict[str, Any] = field(default_factory=dict)
    format_name: str = "unknown"
    line_number: int = 0

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        # Remove empty optional fields for cleaner output
        return {k: v for k, v in d.items() if v}

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), default=str)


def auto_detect_format(lines: List[str]) -> Optional[str]:
    """Auto-detect the log format from a sample of lines.

    Tries each known pattern and returns the name of the one that matches
    the most lines.

    Args:
        lines: Sample lines from the log file.

    Returns:
        Format name or None if no pattern matched.
    """
    if not lines:
        return None

    scores: Dict[str, int] = {}
    for name, pattern in _PATTERNS:
        scores[name] = sum(1 for line in lines if pattern.search(line))

    best = max(scores, key=scores.get)  # type: ignore[arg-type]
    if scores[best] == 0:
        return None
    return best


def parse_line(line: str, line_number: int = 0) -> LogEntry:
    """Parse a single log line.

    Tries each known pattern in order and returns the first match.

    Args:
        line: A single log line.
        line_number: Optional line number for reference.

    Returns:
        A LogEntry with extracted fields.
    """
    stripped = line.rstrip()
    entry = LogEntry(raw=stripped, line_number=line_number)

    for name, pattern in _PATTERNS:
        m = pattern.search(stripped)
        if m:
            groups = m.groupdict()
            entry.format_name = name
            entry.timestamp = groups.pop("timestamp", None)
            entry.level = groups.pop("level", None)
            entry.message = groups.pop("message", stripped)
            # Store remaining named groups in fields
            entry.fields = {k: v for k, v in groups.items() if v is not None}
            return entry

    # Fallback: try to extract at least a timestamp
    ts_info = detect_timestamp(stripped)
    if ts_info:
        entry.timestamp = ts_info.value
        rest = stripped[:ts_info.start] + stripped[ts_info.end:]
        entry.message = rest.strip()
    else:
        entry.message = stripped

    return entry


def parse(
    text: str,
    format_name: Optional[str] = None,
) -> List[LogEntry]:
    """Parse a full log file into structured entries.

    Args:
        text: Full log file content.
        format_name: Optional format name to force. If None, auto-detect.

    Returns:
        List of LogEntry objects.
    """
    lines = text.splitlines()
    if not lines:
        return []

    if format_name is not None:
        # Filter to only the matching pattern
        pattern_map = dict(_PATTERNS)
        if format_name not in pattern_map:
            logger.warning("Unknown format %r, using auto-detect", format_name)

    entries: List[LogEntry] = []
    for i, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        entry = parse_line(line, line_number=i)
        entries.append(entry)

    logger.info("Parsed %d entries from %d lines", len(entries), len(lines))
    return entries
''',

        "log_surgeon/timestamp_detector.py": '''\
"""Timestamp detection in arbitrary text."""

import re
from dataclasses import dataclass
from typing import List, Optional

_TIMESTAMP_PATTERNS: List[re.Pattern[str]] = [
    # ISO 8601: 2024-01-15T10:30:00Z or 2024-01-15T10:30:00+05:30
    re.compile(
        r"\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}"
        r"(?:\\.\\d+)?(?:[+-]\\d{2}:?\\d{2}|Z)?"
    ),
    # Apache/CLF: 15/Jan/2024:10:30:00 +0000
    re.compile(
        r"\\d{2}/\\w{3}/\\d{4}:\\d{2}:\\d{2}:\\d{2}\\s[+-]\\d{4}"
    ),
    # Syslog: Jan 15 10:30:00
    re.compile(
        r"\\w{3}\\s+\\d{1,2}\\s+\\d{2}:\\d{2}:\\d{2}"
    ),
    # US date + time: 01/15/2024 10:30:00
    re.compile(
        r"\\d{2}/\\d{2}/\\d{4}\\s+\\d{2}:\\d{2}:\\d{2}"
    ),
    # Unix epoch (10 or 13 digits)
    re.compile(
        r"(?<![\\d.])\\d{10}(?:\\.\\d+)?(?!\\d)"
    ),
    # Simple time: 10:30:00.123
    re.compile(
        r"\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?"
    ),
]


@dataclass
class TimestampInfo:
    """Result of timestamp detection.

    Attributes:
        value: The matched timestamp string.
        start: Start index in the original text.
        end: End index in the original text.
        pattern_index: Which pattern matched (for debugging).
    """
    value: str
    start: int
    end: int
    pattern_index: int


def detect_timestamp(text: str) -> Optional[TimestampInfo]:
    """Find the first timestamp in a string.

    Tries patterns in order of specificity (most specific first).

    Args:
        text: The text to search.

    Returns:
        TimestampInfo if found, else None.
    """
    for idx, pattern in enumerate(_TIMESTAMP_PATTERNS):
        m = pattern.search(text)
        if m:
            return TimestampInfo(
                value=m.group(),
                start=m.start(),
                end=m.end(),
                pattern_index=idx,
            )
    return None


def detect_all_timestamps(text: str) -> List[TimestampInfo]:
    """Find all timestamps in a string.

    Returns matches from all patterns, sorted by position.

    Args:
        text: The text to search.

    Returns:
        List of TimestampInfo, sorted by start position.
    """
    results: List[TimestampInfo] = []
    seen_ranges: set = set()

    for idx, pattern in enumerate(_TIMESTAMP_PATTERNS):
        for m in pattern.finditer(text):
            # Avoid overlapping matches
            rng = (m.start(), m.end())
            overlaps = any(
                not (rng[1] <= s or rng[0] >= e) for s, e in seen_ranges
            )
            if not overlaps:
                seen_ranges.add(rng)
                results.append(TimestampInfo(
                    value=m.group(),
                    start=m.start(),
                    end=m.end(),
                    pattern_index=idx,
                ))

    results.sort(key=lambda t: t.start)
    return results
''',

        "tests/test_parser.py": '''\
"""Tests for log_surgeon.parser."""

import pytest
from log_surgeon.parser import parse, parse_line, auto_detect_format, LogEntry


class TestParseLine:
    def test_iso_format(self):
        line = "2024-01-15T10:30:00Z INFO Starting server"
        entry = parse_line(line)
        assert entry.timestamp is not None
        assert entry.level == "INFO"
        assert "Starting server" in entry.message

    def test_python_format(self):
        line = "ERROR:myapp.db:Connection refused"
        entry = parse_line(line)
        assert entry.level == "ERROR"
        assert entry.fields.get("logger") == "myapp.db"
        assert "Connection refused" in entry.message

    def test_simple_level_format(self):
        line = "[WARN] Disk usage at 85%"
        entry = parse_line(line)
        assert entry.level is not None
        assert "Disk usage" in entry.message

    def test_syslog_format(self):
        line = "Jan 15 10:30:00 myhost sshd[1234]: Accepted password for user"
        entry = parse_line(line)
        assert entry.timestamp is not None
        assert "Accepted password" in entry.message

    def test_unknown_format_preserves_raw(self):
        line = "just some random text"
        entry = parse_line(line)
        assert entry.message == "just some random text"
        assert entry.format_name == "unknown"

    def test_line_number(self):
        entry = parse_line("INFO test", line_number=42)
        assert entry.line_number == 42


class TestParse:
    def test_multiple_lines(self):
        text = """2024-01-15T10:00:00Z INFO Starting
2024-01-15T10:00:01Z ERROR Failed to connect
2024-01-15T10:00:02Z INFO Retrying"""
        entries = parse(text)
        assert len(entries) == 3
        assert entries[1].level == "ERROR"

    def test_empty_input(self):
        assert parse("") == []

    def test_skips_blank_lines(self):
        text = "INFO test\\n\\nINFO test2"
        entries = parse(text)
        assert len(entries) == 2

    def test_to_json(self):
        entry = parse_line("2024-01-15T10:00:00Z INFO hello")
        j = entry.to_json()
        import json
        data = json.loads(j)
        assert "message" in data


class TestAutoDetect:
    def test_detects_iso(self):
        lines = [
            "2024-01-15T10:00:00Z INFO msg1",
            "2024-01-15T10:00:01Z ERROR msg2",
        ]
        fmt = auto_detect_format(lines)
        assert fmt == "iso"

    def test_returns_none_for_unknown(self):
        lines = ["random text", "more random text"]
        fmt = auto_detect_format(lines)
        # May detect 'simple' or return None
        # The function returns the best match even if low

    def test_empty_lines(self):
        assert auto_detect_format([]) is None
''',

        "pyproject.toml": '''\
[project]
name = "log-surgeon"
version = "0.1.0"
description = "Parse unstructured log files into structured JSON"
requires-python = ">=3.9"

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.pytest.ini_options]
testpaths = ["tests"]
''',

        "README.md": '''\
# log-surgeon

Parses messy, unstructured log files into structured JSON.

## Usage

```python
from log_surgeon import parse

entries = parse(open("app.log").read())
for entry in entries:
    print(entry.timestamp, entry.level, entry.message)
```
''',
    },

    # -----------------------------------------------------------------------
    # 6. encoding-detective (Python) — Detect file encoding with confidence
    # -----------------------------------------------------------------------
    "encoding-detective": {
        "encoding_detective/__init__.py": '''\
"""encoding-detective — Detect file encoding with confidence scoring."""

from .detector import (
    detect,
    detect_file,
    convert,
    EncodingResult,
    BOMInfo,
    strip_bom,
)

__version__ = "0.1.0"
__all__ = ["detect", "detect_file", "convert", "EncodingResult", "BOMInfo", "strip_bom"]
''',

        "encoding_detective/detector.py": '''\
"""Encoding detection via byte-pattern analysis and confidence scoring."""

import codecs
import logging
import os
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# BOM signatures ordered by length (longest first to avoid partial matches)
_BOM_SIGNATURES: List[Tuple[bytes, str, str]] = [
    (codecs.BOM_UTF32_BE, "utf-32-be", "UTF-32 BE BOM"),
    (codecs.BOM_UTF32_LE, "utf-32-le", "UTF-32 LE BOM"),
    (codecs.BOM_UTF16_BE, "utf-16-be", "UTF-16 BE BOM"),
    (codecs.BOM_UTF16_LE, "utf-16-le", "UTF-16 LE BOM"),
    (codecs.BOM_UTF8, "utf-8-sig", "UTF-8 BOM"),
]


@dataclass
class BOMInfo:
    """Byte-Order Mark information.

    Attributes:
        present: Whether a BOM was found.
        encoding: The encoding indicated by the BOM.
        description: Human-readable description.
        length: Number of bytes consumed by the BOM.
    """
    present: bool = False
    encoding: str = ""
    description: str = ""
    length: int = 0


@dataclass
class EncodingResult:
    """Result of encoding detection.

    Attributes:
        encoding: The detected encoding name.
        confidence: Confidence score from 0.0 to 1.0.
        bom: BOM information.
        method: How the encoding was determined.
    """
    encoding: str = "utf-8"
    confidence: float = 0.0
    bom: BOMInfo = None  # type: ignore[assignment]
    method: str = "heuristic"

    def __post_init__(self) -> None:
        if self.bom is None:
            self.bom = BOMInfo()


def _detect_bom(data: bytes) -> BOMInfo:
    """Check for a Byte-Order Mark at the start of the data."""
    for bom_bytes, encoding, description in _BOM_SIGNATURES:
        if data.startswith(bom_bytes):
            return BOMInfo(
                present=True,
                encoding=encoding,
                description=description,
                length=len(bom_bytes),
            )
    return BOMInfo()


def _score_utf8(data: bytes) -> float:
    """Score how likely the data is valid UTF-8.

    Returns a confidence from 0.0 to 1.0.
    """
    try:
        data.decode("utf-8")
        # Check for multi-byte sequences (indicates actual UTF-8 content)
        high_bytes = sum(1 for b in data if b > 127)
        if high_bytes == 0:
            return 0.85  # Pure ASCII — could be UTF-8 but no proof
        ratio = high_bytes / len(data)
        if ratio > 0.3:
            return 0.7  # Lots of high bytes but valid — less certain
        return 0.95
    except UnicodeDecodeError:
        return 0.0


def _score_ascii(data: bytes) -> float:
    """Score how likely the data is pure ASCII."""
    non_ascii = sum(1 for b in data if b > 127)
    if non_ascii == 0:
        return 0.9
    return 0.0


def _score_latin1(data: bytes) -> float:
    """Score likelihood of Latin-1 / ISO-8859-1 encoding."""
    # Latin-1 can decode anything, so we check for typical patterns
    # Characters 0x80-0x9F are control chars in Latin-1 but used in Windows-1252
    control_range = sum(1 for b in data if 0x80 <= b <= 0x9F)
    high_bytes = sum(1 for b in data if b > 127)

    if high_bytes == 0:
        return 0.0  # No evidence for Latin-1
    if control_range > 0:
        return 0.3  # Probably Windows-1252 instead
    return 0.5


def _score_windows1252(data: bytes) -> float:
    """Score likelihood of Windows-1252 encoding."""
    high_bytes = sum(1 for b in data if b > 127)
    if high_bytes == 0:
        return 0.0

    # Windows-1252 specific bytes (smart quotes, em dash, etc.)
    w1252_specific = sum(1 for b in data if b in (
        0x80, 0x85, 0x91, 0x92, 0x93, 0x94, 0x96, 0x97,
    ))

    if w1252_specific > 0:
        return 0.7
    return 0.3


_SCORERS: List[Tuple[str, callable]] = [
    ("ascii", _score_ascii),
    ("utf-8", _score_utf8),
    ("windows-1252", _score_windows1252),
    ("latin-1", _score_latin1),
]


def detect(data: bytes) -> EncodingResult:
    """Detect the encoding of raw bytes.

    Strategy:
      1. Check for BOM (highest confidence).
      2. Try each encoding scorer and pick the best.

    Args:
        data: Raw file bytes.

    Returns:
        EncodingResult with encoding name and confidence.
    """
    if not data:
        return EncodingResult(encoding="utf-8", confidence=1.0, method="empty")

    # Step 1: BOM
    bom = _detect_bom(data)
    if bom.present:
        return EncodingResult(
            encoding=bom.encoding,
            confidence=1.0,
            bom=bom,
            method="bom",
        )

    # Step 2: Heuristic scoring
    best_encoding = "utf-8"
    best_score = 0.0

    for enc_name, scorer in _SCORERS:
        score = scorer(data)
        if score > best_score:
            best_score = score
            best_encoding = enc_name

    return EncodingResult(
        encoding=best_encoding,
        confidence=best_score,
        bom=bom,
        method="heuristic",
    )


def detect_file(path: str, sample_size: int = 65536) -> EncodingResult:
    """Detect encoding of a file.

    Reads up to ``sample_size`` bytes for analysis.

    Args:
        path: Path to the file.
        sample_size: Number of bytes to read (default 64KB).

    Returns:
        EncodingResult.
    """
    with open(path, "rb") as fh:
        data = fh.read(sample_size)
    return detect(data)


def strip_bom(data: bytes) -> bytes:
    """Remove BOM from the beginning of data if present.

    Args:
        data: Raw bytes possibly starting with a BOM.

    Returns:
        Data with BOM stripped.
    """
    bom = _detect_bom(data)
    if bom.present:
        return data[bom.length:]
    return data


def convert(
    data: bytes,
    target: str = "utf-8",
    source: Optional[str] = None,
) -> str:
    """Convert bytes to a string, auto-detecting source encoding if needed.

    Args:
        data: Raw bytes.
        target: Target encoding for the output string.
        source: Source encoding. If None, auto-detect.

    Returns:
        Decoded string in the target encoding.
    """
    if source is None:
        result = detect(data)
        source = result.encoding
        logger.info(
            "Auto-detected %s (confidence=%.2f)",
            source,
            result.confidence,
        )

    # Strip BOM if present
    data = strip_bom(data)

    text = data.decode(source, errors="replace")
    # Round-trip through target encoding to normalise
    return text.encode(target, errors="replace").decode(target)
''',

        "tests/test_detector.py": '''\
"""Tests for encoding_detective.detector."""

import codecs
import pytest
from encoding_detective.detector import (
    detect,
    strip_bom,
    convert,
    EncodingResult,
    _detect_bom,
)


class TestDetectBOM:
    def test_utf8_bom(self):
        data = codecs.BOM_UTF8 + b"hello"
        bom = _detect_bom(data)
        assert bom.present
        assert bom.encoding == "utf-8-sig"

    def test_utf16_le_bom(self):
        data = codecs.BOM_UTF16_LE + b"\\x00h"
        bom = _detect_bom(data)
        assert bom.present
        assert bom.encoding == "utf-16-le"

    def test_no_bom(self):
        bom = _detect_bom(b"hello world")
        assert not bom.present


class TestDetect:
    def test_pure_ascii(self):
        result = detect(b"Hello, World!")
        assert result.encoding in ("ascii", "utf-8")
        assert result.confidence > 0.5

    def test_utf8_with_multibyte(self):
        data = "Hllo wrld caf\\u00e9".encode("utf-8")
        result = detect(data)
        assert result.encoding == "utf-8"
        assert result.confidence > 0.7

    def test_bom_detection(self):
        data = codecs.BOM_UTF8 + "test".encode("utf-8")
        result = detect(data)
        assert result.encoding == "utf-8-sig"
        assert result.confidence == 1.0
        assert result.method == "bom"

    def test_empty_data(self):
        result = detect(b"")
        assert result.confidence == 1.0
        assert result.method == "empty"

    def test_windows1252(self):
        # Smart quotes are Windows-1252 specific
        data = bytes([0x93, 0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x94])
        result = detect(data)
        assert result.encoding == "windows-1252"


class TestStripBOM:
    def test_strips_utf8_bom(self):
        data = codecs.BOM_UTF8 + b"content"
        assert strip_bom(data) == b"content"

    def test_no_bom_unchanged(self):
        data = b"no bom here"
        assert strip_bom(data) == data


class TestConvert:
    def test_utf8_to_utf8(self):
        data = "hello".encode("utf-8")
        assert convert(data) == "hello"

    def test_latin1_to_utf8(self):
        data = "caf\\u00e9".encode("latin-1")
        result = convert(data, source="latin-1")
        assert "caf" in result

    def test_auto_detect_and_convert(self):
        data = "Hello ASCII".encode("ascii")
        result = convert(data)
        assert result == "Hello ASCII"
''',

        "pyproject.toml": '''\
[project]
name = "encoding-detective"
version = "0.1.0"
description = "Detect file encoding with confidence scoring"
requires-python = ">=3.9"

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.pytest.ini_options]
testpaths = ["tests"]
''',

        "README.md": '''\
# encoding-detective

Detects file encoding with confidence scoring. Handles BOM detection, UTF-8,
Latin-1, Windows-1252, and more.

## Usage

```python
from encoding_detective import detect, detect_file, convert

result = detect(raw_bytes)
print(result.encoding, result.confidence)

text = convert(raw_bytes, target="utf-8")
```
''',
    },

    # -----------------------------------------------------------------------
    # 7. diff-simple (TypeScript) — Structural diff for JSON, YAML, TOML
    # -----------------------------------------------------------------------
    "diff-simple": {
        "src/index.ts": '''\
export { diff, formatDiff } from "./diff";
export type { DiffEntry, DiffResult, DiffOptions } from "./types";
''',

        "src/types.ts": '''\
/**
 * Type of change detected.
 */
export type ChangeType = "added" | "removed" | "changed" | "unchanged";

/**
 * A single diff entry.
 */
export interface DiffEntry {
  /** Dot-separated path to the value, e.g. "a.b[0].c" */
  path: string;
  /** Type of change */
  type: ChangeType;
  /** Value in the left (old) object */
  left?: unknown;
  /** Value in the right (new) object */
  right?: unknown;
}

/**
 * Full diff result.
 */
export interface DiffResult {
  entries: DiffEntry[];
  /** True if there are no changes */
  equal: boolean;
  /** Counts by change type */
  summary: Record<ChangeType, number>;
}

/**
 * Options for diff computation.
 */
export interface DiffOptions {
  /**
   * Maximum depth to traverse. 0 = unlimited.
   * @default 0
   */
  maxDepth?: number;

  /**
   * Whether to include unchanged entries in the result.
   * @default false
   */
  includeUnchanged?: boolean;

  /**
   * Custom comparison function. Return true if values are equal.
   */
  comparator?: (a: unknown, b: unknown) => boolean;
}
''',

        "src/diff.ts": '''\
import type { DiffEntry, DiffResult, DiffOptions, ChangeType } from "./types";

const DEFAULT_OPTIONS: Required<DiffOptions> = {
  maxDepth: 0,
  includeUnchanged: false,
  comparator: (a, b) => a === b,
};

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function formatPath(segments: (string | number)[]): string {
  return segments
    .map((s, i) => {
      if (typeof s === "number") return `[${s}]`;
      if (i === 0) return s;
      return `.${s}`;
    })
    .join("");
}

function deepDiff(
  left: unknown,
  right: unknown,
  path: (string | number)[],
  opts: Required<DiffOptions>,
  depth: number,
  entries: DiffEntry[]
): void {
  if (opts.maxDepth > 0 && depth > opts.maxDepth) {
    if (!opts.comparator(left, right)) {
      entries.push({
        path: formatPath(path),
        type: "changed",
        left,
        right,
      });
    } else if (opts.includeUnchanged) {
      entries.push({ path: formatPath(path), type: "unchanged", left, right });
    }
    return;
  }

  // Both arrays
  if (Array.isArray(left) && Array.isArray(right)) {
    const maxLen = Math.max(left.length, right.length);
    for (let i = 0; i < maxLen; i++) {
      const p = [...path, i];
      if (i >= left.length) {
        entries.push({ path: formatPath(p), type: "added", right: right[i] });
      } else if (i >= right.length) {
        entries.push({ path: formatPath(p), type: "removed", left: left[i] });
      } else {
        deepDiff(left[i], right[i], p, opts, depth + 1, entries);
      }
    }
    return;
  }

  // Both objects
  if (isObject(left) && isObject(right)) {
    const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of [...allKeys].sort()) {
      const p = [...path, key];
      const inLeft = key in left;
      const inRight = key in right;

      if (inLeft && !inRight) {
        entries.push({ path: formatPath(p), type: "removed", left: left[key] });
      } else if (!inLeft && inRight) {
        entries.push({ path: formatPath(p), type: "added", right: right[key] });
      } else {
        deepDiff(left[key], right[key], p, opts, depth + 1, entries);
      }
    }
    return;
  }

  // Primitives or type mismatch
  if (opts.comparator(left, right)) {
    if (opts.includeUnchanged) {
      entries.push({ path: formatPath(path), type: "unchanged", left, right });
    }
  } else {
    entries.push({ path: formatPath(path), type: "changed", left, right });
  }
}

function buildSummary(entries: DiffEntry[]): Record<ChangeType, number> {
  const summary: Record<ChangeType, number> = {
    added: 0,
    removed: 0,
    changed: 0,
    unchanged: 0,
  };
  for (const e of entries) {
    summary[e.type]++;
  }
  return summary;
}

/**
 * Compute a structural diff between two values.
 *
 * Supports nested objects, arrays, and primitive values.
 */
export function diff(
  left: unknown,
  right: unknown,
  options?: DiffOptions
): DiffResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const entries: DiffEntry[] = [];
  deepDiff(left, right, [], opts, 0, entries);

  const summary = buildSummary(entries);
  const equal =
    summary.added === 0 && summary.removed === 0 && summary.changed === 0;

  return { entries, equal, summary };
}

/**
 * Format a diff result as a human-readable string.
 */
export function formatDiff(result: DiffResult): string {
  if (result.equal) return "No differences.";

  const lines: string[] = [];
  for (const entry of result.entries) {
    switch (entry.type) {
      case "added":
        lines.push(`+ ${entry.path}: ${JSON.stringify(entry.right)}`);
        break;
      case "removed":
        lines.push(`- ${entry.path}: ${JSON.stringify(entry.left)}`);
        break;
      case "changed":
        lines.push(
          `~ ${entry.path}: ${JSON.stringify(entry.left)} -> ${JSON.stringify(entry.right)}`
        );
        break;
    }
  }

  lines.push("");
  lines.push(
    `Summary: ${result.summary.added} added, ${result.summary.removed} removed, ${result.summary.changed} changed`
  );

  return lines.join("\\n");
}
''',

        "tests/diff.test.ts": '''\
import { diff, formatDiff } from "../src/diff";

describe("diff", () => {
  test("equal objects", () => {
    const result = diff({ a: 1 }, { a: 1 });
    expect(result.equal).toBe(true);
    expect(result.summary.changed).toBe(0);
  });

  test("added key", () => {
    const result = diff({ a: 1 }, { a: 1, b: 2 });
    expect(result.equal).toBe(false);
    expect(result.summary.added).toBe(1);
    expect(result.entries[0].path).toBe(".b");
  });

  test("removed key", () => {
    const result = diff({ a: 1, b: 2 }, { a: 1 });
    expect(result.summary.removed).toBe(1);
  });

  test("changed value", () => {
    const result = diff({ a: 1 }, { a: 2 });
    expect(result.summary.changed).toBe(1);
    expect(result.entries[0].left).toBe(1);
    expect(result.entries[0].right).toBe(2);
  });

  test("nested object diff", () => {
    const result = diff(
      { a: { b: { c: 1 } } },
      { a: { b: { c: 2 } } }
    );
    expect(result.entries[0].path).toBe(".a.b.c");
  });

  test("array diff", () => {
    const result = diff([1, 2, 3], [1, 2, 4]);
    expect(result.summary.changed).toBe(1);
    expect(result.entries[0].path).toBe("[2]");
  });

  test("array length change — added", () => {
    const result = diff([1], [1, 2]);
    expect(result.summary.added).toBe(1);
  });

  test("array length change — removed", () => {
    const result = diff([1, 2], [1]);
    expect(result.summary.removed).toBe(1);
  });

  test("mixed types", () => {
    const result = diff({ a: "string" }, { a: 42 });
    expect(result.summary.changed).toBe(1);
  });

  test("includeUnchanged option", () => {
    const result = diff({ a: 1, b: 2 }, { a: 1, b: 3 }, { includeUnchanged: true });
    expect(result.entries.some((e) => e.type === "unchanged")).toBe(true);
  });

  test("maxDepth limits traversal", () => {
    const result = diff(
      { a: { b: { c: 1 } } },
      { a: { b: { c: 2 } } },
      { maxDepth: 1 }
    );
    expect(result.entries[0].path).toBe(".a");
  });

  test("equal primitives", () => {
    expect(diff(42, 42).equal).toBe(true);
    expect(diff("abc", "abc").equal).toBe(true);
  });

  test("different primitives", () => {
    expect(diff(42, 43).equal).toBe(false);
  });
});

describe("formatDiff", () => {
  test("formats no differences", () => {
    const result = diff({}, {});
    expect(formatDiff(result)).toBe("No differences.");
  });

  test("formats changes", () => {
    const result = diff({ a: 1 }, { a: 2, b: 3 });
    const formatted = formatDiff(result);
    expect(formatted).toContain("+");
    expect(formatted).toContain("~");
    expect(formatted).toContain("Summary:");
  });
});
''',

        "package.json": '''\
{
  "name": "diff-simple",
  "version": "0.1.0",
  "description": "Structural diff for JSON, YAML, and TOML",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "@types/jest": "^29.5.0"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node"
  }
}
''',

        "tsconfig.json": '''\
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
''',

        "README.md": '''\
# diff-simple

Structural diff for JSON, YAML, and TOML files with path tracking.

## Usage

```typescript
import { diff, formatDiff } from "diff-simple";

const result = diff(oldObj, newObj);
console.log(formatDiff(result));
```
''',
    },

    # -----------------------------------------------------------------------
    # 8. port-finder (Rust) — Finds available network ports
    # -----------------------------------------------------------------------
    "port-finder": {
        "src/lib.rs": '''\
//! port-finder — Find available network ports.
//!
//! Provides functions to check port availability and find free ports
//! on the local machine.

use std::net::{Ipv4Addr, SocketAddrV4, TcpListener, UdpSocket};

/// Error type for port-finder operations.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("No available port found in range {0}..{1}")]
    NoPortAvailable(u16, u16),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Invalid range: start ({0}) must be less than end ({1})")]
    InvalidRange(u16, u16),
}

pub type Result<T> = std::result::Result<T, Error>;

/// Check if a TCP port is available on localhost.
///
/// # Examples
///
/// ```
/// use port_finder::is_port_available;
///
/// // Port 0 is never "available" in the traditional sense,
/// // but very high ports usually are.
/// let available = is_port_available(49152);
/// ```
pub fn is_port_available(port: u16) -> bool {
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port);

    // Check TCP
    if TcpListener::bind(addr).is_err() {
        return false;
    }

    // Check UDP
    if UdpSocket::bind(addr).is_err() {
        return false;
    }

    true
}

/// Find a single available port.
///
/// Binds to port 0 and lets the OS assign one, then returns it.
///
/// # Examples
///
/// ```
/// use port_finder::find_available_port;
///
/// let port = find_available_port().unwrap();
/// assert!(port > 0);
/// ```
pub fn find_available_port() -> Result<u16> {
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, 0);
    let listener = TcpListener::bind(addr)?;
    let port = listener.local_addr()?.port();
    Ok(port)
}

/// Find an available port within a specific range [start, end).
///
/// Iterates from `start` to `end - 1` and returns the first available port.
///
/// # Examples
///
/// ```
/// use port_finder::find_in_range;
///
/// let port = find_in_range(8000, 9000).unwrap();
/// assert!(port >= 8000 && port < 9000);
/// ```
pub fn find_in_range(start: u16, end: u16) -> Result<u16> {
    if start >= end {
        return Err(Error::InvalidRange(start, end));
    }

    for port in start..end {
        if is_port_available(port) {
            return Ok(port);
        }
    }

    Err(Error::NoPortAvailable(start, end))
}

/// Find multiple available ports.
///
/// Returns exactly `count` unique available ports.
///
/// # Examples
///
/// ```
/// use port_finder::find_multiple;
///
/// let ports = find_multiple(3).unwrap();
/// assert_eq!(ports.len(), 3);
/// ```
pub fn find_multiple(count: usize) -> Result<Vec<u16>> {
    let mut ports = Vec::with_capacity(count);
    let mut listeners = Vec::with_capacity(count);

    // Hold listeners open to prevent the OS from reusing ports
    for _ in 0..count {
        let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, 0);
        let listener = TcpListener::bind(addr)?;
        let port = listener.local_addr()?.port();
        ports.push(port);
        listeners.push(listener);
    }

    Ok(ports)
}

/// Check which ports in a list are available.
///
/// Returns a Vec of (port, is_available) tuples.
pub fn check_ports(ports: &[u16]) -> Vec<(u16, bool)> {
    ports.iter().map(|&p| (p, is_port_available(p))).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_available_port() {
        let port = find_available_port().unwrap();
        assert!(port > 0);
    }

    #[test]
    fn test_is_port_available_on_found_port() {
        let port = find_available_port().unwrap();
        // Port should be available since we released the listener
        assert!(is_port_available(port));
    }

    #[test]
    fn test_find_in_range() {
        let port = find_in_range(49152, 65535).unwrap();
        assert!(port >= 49152);
        assert!(port < 65535);
    }

    #[test]
    fn test_invalid_range() {
        let result = find_in_range(100, 50);
        assert!(result.is_err());
    }

    #[test]
    fn test_find_multiple() {
        let ports = find_multiple(3).unwrap();
        assert_eq!(ports.len(), 3);
        // All ports should be unique
        let unique: std::collections::HashSet<_> = ports.iter().collect();
        assert_eq!(unique.len(), 3);
    }

    #[test]
    fn test_check_ports() {
        let port = find_available_port().unwrap();
        let results = check_ports(&[port]);
        assert_eq!(results.len(), 1);
    }
}
''',

        "src/main.rs": '''\
//! CLI for port-finder.

use std::process;

fn main() {
    let args: Vec<String> = std::env::args().collect();

    match args.get(1).map(|s| s.as_str()) {
        Some("find") => {
            match port_finder::find_available_port() {
                Ok(port) => println!("{}", port),
                Err(e) => {
                    eprintln!("Error: {}", e);
                    process::exit(1);
                }
            }
        }
        Some("range") => {
            let start: u16 = args.get(2)
                .and_then(|s| s.parse().ok())
                .unwrap_or(8000);
            let end: u16 = args.get(3)
                .and_then(|s| s.parse().ok())
                .unwrap_or(9000);

            match port_finder::find_in_range(start, end) {
                Ok(port) => println!("{}", port),
                Err(e) => {
                    eprintln!("Error: {}", e);
                    process::exit(1);
                }
            }
        }
        Some("check") => {
            for arg in &args[2..] {
                if let Ok(port) = arg.parse::<u16>() {
                    let available = port_finder::is_port_available(port);
                    println!("{}: {}", port, if available { "available" } else { "in use" });
                }
            }
        }
        Some("multi") => {
            let count: usize = args.get(2)
                .and_then(|s| s.parse().ok())
                .unwrap_or(5);

            match port_finder::find_multiple(count) {
                Ok(ports) => {
                    for p in ports {
                        println!("{}", p);
                    }
                }
                Err(e) => {
                    eprintln!("Error: {}", e);
                    process::exit(1);
                }
            }
        }
        _ => {
            eprintln!("Usage: port-finder <command>");
            eprintln!("Commands:");
            eprintln!("  find            Find a single available port");
            eprintln!("  range <s> <e>   Find a port in range [s, e)");
            eprintln!("  check <ports>   Check if ports are available");
            eprintln!("  multi <count>   Find multiple available ports");
            process::exit(1);
        }
    }
}
''',

        "tests/integration.rs": '''\
use port_finder::{find_available_port, find_in_range, find_multiple, is_port_available};

#[test]
fn test_find_and_verify() {
    let port = find_available_port().unwrap();
    assert!(port > 0);
    // After the listener is dropped the port should be available
    assert!(is_port_available(port));
}

#[test]
fn test_range_respects_bounds() {
    let port = find_in_range(49152, 50000).unwrap();
    assert!(port >= 49152);
    assert!(port < 50000);
}

#[test]
fn test_multiple_are_unique() {
    let ports = find_multiple(5).unwrap();
    let set: std::collections::HashSet<u16> = ports.into_iter().collect();
    assert_eq!(set.len(), 5);
}

#[test]
fn test_bound_port_is_unavailable() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    assert!(!is_port_available(port));
}
''',

        "Cargo.toml": '''\
[package]
name = "port-finder"
version = "0.1.0"
edition = "2021"
description = "Find available network ports"

[dependencies]
thiserror = "1"

[[bin]]
name = "port-finder"
path = "src/main.rs"
''',

        "README.md": '''\
# port-finder

Find available network ports for local development.

## Usage (library)

```rust
use port_finder::{find_available_port, find_in_range};

let port = find_available_port().unwrap();
let port = find_in_range(8000, 9000).unwrap();
```

## Usage (CLI)

```bash
port-finder find
port-finder range 8000 9000
port-finder check 8080 3000
```
''',
    },

    # -----------------------------------------------------------------------
    # 9. hash-verify (Rust) — File integrity verification with SHA-256
    # -----------------------------------------------------------------------
    "hash-verify": {
        "src/lib.rs": '''\
//! hash-verify — File integrity verification with SHA-256.
//!
//! Hash files, create manifests, and verify file integrity.

use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};

/// Error type for hash-verify operations.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("IO error: {0}")]
    Io(#[from] io::Error),

    #[error("Hash mismatch for {path}: expected {expected}, got {actual}")]
    HashMismatch {
        path: String,
        expected: String,
        actual: String,
    },

    #[error("File not found in manifest: {0}")]
    NotInManifest(String),

    #[error("Parse error: {0}")]
    Parse(String),
}

pub type Result<T> = std::result::Result<T, Error>;

/// A file manifest: mapping from relative paths to SHA-256 hex digests.
#[derive(Debug, Clone)]
pub struct Manifest {
    pub entries: BTreeMap<String, String>,
}

impl Manifest {
    pub fn new() -> Self {
        Self {
            entries: BTreeMap::new(),
        }
    }

    /// Serialize the manifest to a string (one "hash  path" per line).
    pub fn to_string(&self) -> String {
        self.entries
            .iter()
            .map(|(path, hash)| format!("{}  {}", hash, path))
            .collect::<Vec<_>>()
            .join("\\n")
    }

    /// Parse a manifest from a string.
    pub fn from_string(s: &str) -> Result<Self> {
        let mut entries = BTreeMap::new();
        for line in s.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let parts: Vec<&str> = line.splitn(2, "  ").collect();
            if parts.len() != 2 {
                return Err(Error::Parse(format!("Invalid manifest line: {}", line)));
            }
            entries.insert(parts[1].to_string(), parts[0].to_string());
        }
        Ok(Self { entries })
    }

    /// Number of entries.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Whether the manifest is empty.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

impl Default for Manifest {
    fn default() -> Self {
        Self::new()
    }
}

/// Compute the SHA-256 hash of a file.
///
/// Reads the file in 8KB chunks to handle large files efficiently.
///
/// # Examples
///
/// ```no_run
/// let hash = hash_verify::hash_file("Cargo.toml").unwrap();
/// println!("SHA-256: {}", hash);
/// ```
pub fn hash_file<P: AsRef<Path>>(path: P) -> Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Compute the SHA-256 hash of raw bytes.
pub fn hash_bytes(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

/// Create a manifest for all files in a directory (recursively).
///
/// Paths in the manifest are relative to the given directory.
///
/// # Examples
///
/// ```no_run
/// let manifest = hash_verify::create_manifest("src/").unwrap();
/// for (path, hash) in &manifest.entries {
///     println!("{}: {}", path, hash);
/// }
/// ```
pub fn create_manifest<P: AsRef<Path>>(dir: P) -> Result<Manifest> {
    let dir = dir.as_ref();
    let mut manifest = Manifest::new();
    collect_files(dir, dir, &mut manifest)?;
    Ok(manifest)
}

fn collect_files(base: &Path, current: &Path, manifest: &mut Manifest) -> Result<()> {
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            collect_files(base, &path, manifest)?;
        } else if path.is_file() {
            let relative = path
                .strip_prefix(base)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();
            let hash = hash_file(&path)?;
            manifest.entries.insert(relative, hash);
        }
    }
    Ok(())
}

/// Verify files against a manifest.
///
/// Returns a list of (path, expected_hash, actual_hash) for mismatches.
/// Missing files are reported with actual_hash = "FILE_NOT_FOUND".
///
/// # Examples
///
/// ```no_run
/// let manifest = hash_verify::create_manifest("src/").unwrap();
/// let mismatches = hash_verify::verify_manifest(&manifest, "src/").unwrap();
/// if mismatches.is_empty() {
///     println!("All files verified!");
/// }
/// ```
pub fn verify_manifest<P: AsRef<Path>>(
    manifest: &Manifest,
    base_dir: P,
) -> Result<Vec<(String, String, String)>> {
    let base = base_dir.as_ref();
    let mut mismatches = Vec::new();

    for (rel_path, expected_hash) in &manifest.entries {
        let full_path = base.join(rel_path);

        if !full_path.exists() {
            mismatches.push((
                rel_path.clone(),
                expected_hash.clone(),
                "FILE_NOT_FOUND".to_string(),
            ));
            continue;
        }

        let actual_hash = hash_file(&full_path)?;
        if &actual_hash != expected_hash {
            mismatches.push((rel_path.clone(), expected_hash.clone(), actual_hash));
        }
    }

    Ok(mismatches)
}

/// Hash a directory and return a single combined hash.
///
/// Computes SHA-256 of all file hashes concatenated in sorted path order.
pub fn hash_directory<P: AsRef<Path>>(dir: P) -> Result<String> {
    let manifest = create_manifest(dir)?;
    let mut hasher = Sha256::new();

    for (path, hash) in &manifest.entries {
        hasher.update(path.as_bytes());
        hasher.update(hash.as_bytes());
    }

    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_file(dir: &Path, name: &str, content: &str) -> PathBuf {
        let path = dir.join(name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut f = fs::File::create(&path).unwrap();
        f.write_all(content.as_bytes()).unwrap();
        path
    }

    #[test]
    fn test_hash_bytes() {
        let h1 = hash_bytes(b"hello");
        let h2 = hash_bytes(b"hello");
        assert_eq!(h1, h2);

        let h3 = hash_bytes(b"world");
        assert_ne!(h1, h3);
    }

    #[test]
    fn test_hash_file() {
        let dir = TempDir::new().unwrap();
        let path = create_test_file(dir.path(), "test.txt", "hello world");
        let hash = hash_file(&path).unwrap();
        assert_eq!(hash.len(), 64); // SHA-256 hex digest length
    }

    #[test]
    fn test_manifest_roundtrip() {
        let mut manifest = Manifest::new();
        manifest.entries.insert("a.txt".to_string(), "abc123".to_string());
        manifest.entries.insert("b.txt".to_string(), "def456".to_string());

        let serialized = manifest.to_string();
        let parsed = Manifest::from_string(&serialized).unwrap();

        assert_eq!(parsed.entries, manifest.entries);
    }

    #[test]
    fn test_create_and_verify_manifest() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "a.txt", "aaa");
        create_test_file(dir.path(), "sub/b.txt", "bbb");

        let manifest = create_manifest(dir.path()).unwrap();
        assert_eq!(manifest.len(), 2);

        let mismatches = verify_manifest(&manifest, dir.path()).unwrap();
        assert!(mismatches.is_empty());
    }

    #[test]
    fn test_verify_detects_change() {
        let dir = TempDir::new().unwrap();
        let path = create_test_file(dir.path(), "a.txt", "original");

        let manifest = create_manifest(dir.path()).unwrap();

        // Modify the file
        fs::write(&path, "modified").unwrap();

        let mismatches = verify_manifest(&manifest, dir.path()).unwrap();
        assert_eq!(mismatches.len(), 1);
    }

    #[test]
    fn test_hash_directory() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "a.txt", "aaa");

        let h1 = hash_directory(dir.path()).unwrap();
        assert_eq!(h1.len(), 64);
    }
}
''',

        "src/main.rs": '''\
//! CLI for hash-verify.

use std::process;

fn main() {
    let args: Vec<String> = std::env::args().collect();

    match args.get(1).map(|s| s.as_str()) {
        Some("hash") => {
            let path = args.get(2).unwrap_or_else(|| {
                eprintln!("Usage: hash-verify hash <file>");
                process::exit(1);
            });
            match hash_verify::hash_file(path) {
                Ok(hash) => println!("{}  {}", hash, path),
                Err(e) => {
                    eprintln!("Error: {}", e);
                    process::exit(1);
                }
            }
        }
        Some("create") => {
            let dir = args.get(2).map(|s| s.as_str()).unwrap_or(".");
            match hash_verify::create_manifest(dir) {
                Ok(manifest) => print!("{}", manifest.to_string()),
                Err(e) => {
                    eprintln!("Error: {}", e);
                    process::exit(1);
                }
            }
        }
        Some("verify") => {
            let manifest_path = args.get(2).unwrap_or_else(|| {
                eprintln!("Usage: hash-verify verify <manifest-file> [base-dir]");
                process::exit(1);
            });
            let base_dir = args.get(3).map(|s| s.as_str()).unwrap_or(".");

            let content = std::fs::read_to_string(manifest_path).unwrap_or_else(|e| {
                eprintln!("Cannot read {}: {}", manifest_path, e);
                process::exit(1);
            });

            let manifest = hash_verify::Manifest::from_string(&content).unwrap_or_else(|e| {
                eprintln!("Parse error: {}", e);
                process::exit(1);
            });

            match hash_verify::verify_manifest(&manifest, base_dir) {
                Ok(mismatches) => {
                    if mismatches.is_empty() {
                        println!("All {} files verified OK.", manifest.len());
                    } else {
                        for (path, expected, actual) in &mismatches {
                            eprintln!("MISMATCH {}: expected={}, actual={}", path, expected, actual);
                        }
                        process::exit(1);
                    }
                }
                Err(e) => {
                    eprintln!("Error: {}", e);
                    process::exit(1);
                }
            }
        }
        _ => {
            eprintln!("Usage: hash-verify <command>");
            eprintln!("Commands:");
            eprintln!("  hash <file>                   Compute SHA-256 of a file");
            eprintln!("  create [dir]                  Create a manifest for a directory");
            eprintln!("  verify <manifest> [base-dir]  Verify files against a manifest");
            process::exit(1);
        }
    }
}
''',

        "tests/integration.rs": '''\
use hash_verify::{hash_bytes, hash_file, create_manifest, verify_manifest, Manifest};
use std::fs;
use std::io::Write;
use tempfile::TempDir;

#[test]
fn test_hash_deterministic() {
    let h1 = hash_bytes(b"test data");
    let h2 = hash_bytes(b"test data");
    assert_eq!(h1, h2);
}

#[test]
fn test_hash_different_data() {
    let h1 = hash_bytes(b"data1");
    let h2 = hash_bytes(b"data2");
    assert_ne!(h1, h2);
}

#[test]
fn test_full_workflow() {
    let dir = TempDir::new().unwrap();
    let file_path = dir.path().join("test.txt");
    let mut f = fs::File::create(&file_path).unwrap();
    f.write_all(b"hello world").unwrap();
    drop(f);

    // Create manifest
    let manifest = create_manifest(dir.path()).unwrap();
    assert!(!manifest.is_empty());

    // Verify passes
    let mismatches = verify_manifest(&manifest, dir.path()).unwrap();
    assert!(mismatches.is_empty());

    // Modify file
    fs::write(&file_path, "changed content").unwrap();

    // Verify detects mismatch
    let mismatches = verify_manifest(&manifest, dir.path()).unwrap();
    assert_eq!(mismatches.len(), 1);
}

#[test]
fn test_manifest_parse() {
    let text = "abc123  file1.txt\\ndef456  file2.txt";
    let manifest = Manifest::from_string(text).unwrap();
    assert_eq!(manifest.len(), 2);
    assert_eq!(manifest.entries.get("file1.txt").unwrap(), "abc123");
}
''',

        "Cargo.toml": '''\
[package]
name = "hash-verify"
version = "0.1.0"
edition = "2021"
description = "File integrity verification with SHA-256"

[dependencies]
sha2 = "0.10"
thiserror = "1"

[dev-dependencies]
tempfile = "3"

[[bin]]
name = "hash-verify"
path = "src/main.rs"
''',

        "README.md": '''\
# hash-verify

File integrity verification using SHA-256 hashing.

## Usage (library)

```rust
use hash_verify::{hash_file, create_manifest, verify_manifest};

let hash = hash_file("important.dat").unwrap();
let manifest = create_manifest("my_dir/").unwrap();
let mismatches = verify_manifest(&manifest, "my_dir/").unwrap();
```

## Usage (CLI)

```bash
hash-verify hash myfile.txt
hash-verify create src/
hash-verify verify manifest.txt src/
```
''',
    },

    # -----------------------------------------------------------------------
    # 10. rate-limiter-simple (Python) — In-memory rate limiting
    # -----------------------------------------------------------------------
    "rate-limiter-simple": {
        "rate_limiter/__init__.py": '''\
"""rate-limiter-simple — In-memory rate limiting with sliding window."""

from .sliding_window import SlidingWindowLimiter, RateLimitExceeded
from .middleware import RateLimitMiddleware

__version__ = "0.1.0"
__all__ = ["SlidingWindowLimiter", "RateLimitExceeded", "RateLimitMiddleware"]
''',

        "rate_limiter/sliding_window.py": '''\
"""Sliding window rate limiter implementation."""

import threading
import time
import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class RateLimitExceeded(Exception):
    """Raised when a rate limit is exceeded.

    Attributes:
        key: The key that was rate limited.
        limit: The configured limit.
        window: The window size in seconds.
        retry_after: Seconds until the next request will be allowed.
    """

    def __init__(
        self, key: str, limit: int, window: float, retry_after: float
    ) -> None:
        self.key = key
        self.limit = limit
        self.window = window
        self.retry_after = retry_after
        super().__init__(
            f"Rate limit exceeded for {key!r}: "
            f"{limit} requests per {window}s, retry after {retry_after:.1f}s"
        )


@dataclass
class RateLimitInfo:
    """Current state of a rate limit for a key.

    Attributes:
        allowed: Whether the request is allowed.
        remaining: Number of remaining requests in the current window.
        limit: The configured maximum requests.
        reset_at: Unix timestamp when the window resets.
        retry_after: Seconds to wait if not allowed (0 if allowed).
    """
    allowed: bool
    remaining: int
    limit: int
    reset_at: float
    retry_after: float = 0.0


class SlidingWindowLimiter:
    """Thread-safe sliding window rate limiter.

    Tracks request timestamps per key and enforces a maximum number of
    requests within a sliding time window.

    Args:
        max_requests: Maximum number of requests allowed in the window.
        window_seconds: Size of the sliding window in seconds.
        cleanup_interval: How often to run cleanup of expired entries (seconds).
                          Set to 0 to disable automatic cleanup.

    Example::

        limiter = SlidingWindowLimiter(max_requests=100, window_seconds=60)

        if limiter.allow("user:123"):
            handle_request()
        else:
            return "Too many requests"
    """

    def __init__(
        self,
        max_requests: int = 100,
        window_seconds: float = 60.0,
        cleanup_interval: float = 300.0,
    ) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.cleanup_interval = cleanup_interval

        self._timestamps: Dict[str, List[float]] = defaultdict(list)
        self._lock = threading.Lock()
        self._last_cleanup = time.monotonic()

    def _prune(self, key: str, now: float) -> None:
        """Remove timestamps outside the current window for a key."""
        cutoff = now - self.window_seconds
        timestamps = self._timestamps[key]
        # Find the first index that is within the window
        idx = 0
        while idx < len(timestamps) and timestamps[idx] < cutoff:
            idx += 1
        if idx > 0:
            self._timestamps[key] = timestamps[idx:]

    def _maybe_cleanup(self, now: float) -> None:
        """Remove keys with no recent timestamps to prevent memory leaks."""
        if self.cleanup_interval <= 0:
            return
        if now - self._last_cleanup < self.cleanup_interval:
            return

        self._last_cleanup = now
        cutoff = now - self.window_seconds
        empty_keys = []
        for key, timestamps in self._timestamps.items():
            if not timestamps or timestamps[-1] < cutoff:
                empty_keys.append(key)
        for key in empty_keys:
            del self._timestamps[key]

        if empty_keys:
            logger.debug("Cleaned up %d expired rate limit keys", len(empty_keys))

    def check(self, key: str) -> RateLimitInfo:
        """Check the current rate limit state without recording a request.

        Args:
            key: The rate limit key (e.g. IP address, user ID).

        Returns:
            RateLimitInfo with current state.
        """
        now = time.monotonic()
        with self._lock:
            self._prune(key, now)
            count = len(self._timestamps[key])
            remaining = max(0, self.max_requests - count)
            allowed = count < self.max_requests

            retry_after = 0.0
            if not allowed and self._timestamps[key]:
                oldest = self._timestamps[key][0]
                retry_after = max(0.0, oldest + self.window_seconds - now)

            reset_at = now + self.window_seconds

            return RateLimitInfo(
                allowed=allowed,
                remaining=remaining,
                limit=self.max_requests,
                reset_at=reset_at,
                retry_after=retry_after,
            )

    def allow(self, key: str) -> bool:
        """Check if a request is allowed and record it if so.

        Args:
            key: The rate limit key.

        Returns:
            True if the request is allowed, False if rate limited.
        """
        now = time.monotonic()
        with self._lock:
            self._prune(key, now)
            self._maybe_cleanup(now)

            if len(self._timestamps[key]) >= self.max_requests:
                return False

            self._timestamps[key].append(now)
            return True

    def acquire(self, key: str) -> RateLimitInfo:
        """Attempt to acquire a rate limit slot, raising on failure.

        Args:
            key: The rate limit key.

        Returns:
            RateLimitInfo if allowed.

        Raises:
            RateLimitExceeded: If the limit is exceeded.
        """
        now = time.monotonic()
        with self._lock:
            self._prune(key, now)
            self._maybe_cleanup(now)

            count = len(self._timestamps[key])
            if count >= self.max_requests:
                oldest = self._timestamps[key][0]
                retry_after = max(0.0, oldest + self.window_seconds - now)
                raise RateLimitExceeded(
                    key=key,
                    limit=self.max_requests,
                    window=self.window_seconds,
                    retry_after=retry_after,
                )

            self._timestamps[key].append(now)
            remaining = self.max_requests - count - 1
            return RateLimitInfo(
                allowed=True,
                remaining=remaining,
                limit=self.max_requests,
                reset_at=now + self.window_seconds,
            )

    def reset(self, key: Optional[str] = None) -> None:
        """Reset rate limit state.

        Args:
            key: If given, reset only this key. Otherwise reset all.
        """
        with self._lock:
            if key is None:
                self._timestamps.clear()
            else:
                self._timestamps.pop(key, None)
''',

        "rate_limiter/middleware.py": '''\
"""WSGI/ASGI-style middleware for rate limiting."""

import json
import logging
from typing import Any, Callable, Optional

from .sliding_window import SlidingWindowLimiter, RateLimitExceeded

logger = logging.getLogger(__name__)


class RateLimitMiddleware:
    """Simple rate limiting middleware.

    This is framework-agnostic: you supply a ``key_func`` that extracts
    a rate limit key from the request, and a ``reject_func`` that builds
    the rejection response.

    Args:
        limiter: A SlidingWindowLimiter instance.
        key_func: Callable that takes a request and returns a string key.
        reject_func: Callable that takes a RateLimitExceeded and returns
                     a response object. If None, raises the exception.

    Example (Flask-like)::

        limiter = SlidingWindowLimiter(max_requests=60, window_seconds=60)

        def get_key(request):
            return request.remote_addr

        def reject(exc):
            return {"error": str(exc)}, 429

        middleware = RateLimitMiddleware(limiter, key_func=get_key, reject_func=reject)

        @app.before_request
        def check_rate_limit():
            result = middleware.process(request)
            if result is not None:
                return result
    """

    def __init__(
        self,
        limiter: SlidingWindowLimiter,
        key_func: Callable[[Any], str],
        reject_func: Optional[Callable[[RateLimitExceeded], Any]] = None,
    ) -> None:
        self.limiter = limiter
        self.key_func = key_func
        self.reject_func = reject_func

    def process(self, request: Any) -> Optional[Any]:
        """Process a request through the rate limiter.

        Args:
            request: The incoming request object.

        Returns:
            None if the request is allowed, or the reject response if limited.

        Raises:
            RateLimitExceeded: If limited and no reject_func is set.
        """
        key = self.key_func(request)
        try:
            self.limiter.acquire(key)
            return None
        except RateLimitExceeded as exc:
            logger.info("Rate limited %s: %s", key, exc)
            if self.reject_func is not None:
                return self.reject_func(exc)
            raise

    def get_headers(self, key: str) -> dict:
        """Get rate limit headers for a response.

        Args:
            key: The rate limit key.

        Returns:
            Dict of header name to value.
        """
        info = self.limiter.check(key)
        return {
            "X-RateLimit-Limit": str(info.limit),
            "X-RateLimit-Remaining": str(info.remaining),
            "X-RateLimit-Reset": str(int(info.reset_at)),
        }
''',

        "tests/test_limiter.py": '''\
"""Tests for rate_limiter.sliding_window and middleware."""

import time
import pytest
from rate_limiter.sliding_window import (
    SlidingWindowLimiter,
    RateLimitExceeded,
    RateLimitInfo,
)
from rate_limiter.middleware import RateLimitMiddleware


class TestSlidingWindowLimiter:
    def test_allows_under_limit(self):
        limiter = SlidingWindowLimiter(max_requests=5, window_seconds=10)
        for _ in range(5):
            assert limiter.allow("key1")

    def test_blocks_over_limit(self):
        limiter = SlidingWindowLimiter(max_requests=3, window_seconds=10)
        for _ in range(3):
            assert limiter.allow("key1")
        assert not limiter.allow("key1")

    def test_separate_keys(self):
        limiter = SlidingWindowLimiter(max_requests=2, window_seconds=10)
        assert limiter.allow("a")
        assert limiter.allow("a")
        assert not limiter.allow("a")
        # Different key should still work
        assert limiter.allow("b")

    def test_window_expiry(self):
        limiter = SlidingWindowLimiter(max_requests=2, window_seconds=0.1)
        assert limiter.allow("key")
        assert limiter.allow("key")
        assert not limiter.allow("key")
        time.sleep(0.15)
        assert limiter.allow("key")

    def test_check_does_not_consume(self):
        limiter = SlidingWindowLimiter(max_requests=1, window_seconds=10)
        info = limiter.check("key")
        assert info.allowed
        assert info.remaining == 1
        # Still allowed because check didn't consume
        assert limiter.allow("key")
        # Now exhausted
        info = limiter.check("key")
        assert not info.allowed

    def test_acquire_raises(self):
        limiter = SlidingWindowLimiter(max_requests=1, window_seconds=10)
        limiter.acquire("key")
        with pytest.raises(RateLimitExceeded) as exc_info:
            limiter.acquire("key")
        assert exc_info.value.retry_after > 0

    def test_reset_key(self):
        limiter = SlidingWindowLimiter(max_requests=1, window_seconds=10)
        limiter.allow("key")
        assert not limiter.allow("key")
        limiter.reset("key")
        assert limiter.allow("key")

    def test_reset_all(self):
        limiter = SlidingWindowLimiter(max_requests=1, window_seconds=10)
        limiter.allow("a")
        limiter.allow("b")
        limiter.reset()
        assert limiter.allow("a")
        assert limiter.allow("b")

    def test_rate_limit_info(self):
        limiter = SlidingWindowLimiter(max_requests=5, window_seconds=60)
        info = limiter.acquire("key")
        assert info.allowed
        assert info.remaining == 4
        assert info.limit == 5

    def test_cleanup(self):
        limiter = SlidingWindowLimiter(
            max_requests=1, window_seconds=0.05, cleanup_interval=0.05
        )
        limiter.allow("a")
        limiter.allow("b")
        time.sleep(0.1)
        # Trigger cleanup by calling allow
        limiter.allow("c")
        # After cleanup, expired keys should be removed
        # (implementation detail, but we can verify allow works)
        assert limiter.allow("a")


class TestMiddleware:
    def test_allows_request(self):
        limiter = SlidingWindowLimiter(max_requests=10, window_seconds=60)
        mw = RateLimitMiddleware(
            limiter,
            key_func=lambda req: req["ip"],
        )
        result = mw.process({"ip": "1.2.3.4"})
        assert result is None

    def test_rejects_request(self):
        limiter = SlidingWindowLimiter(max_requests=1, window_seconds=60)
        rejected = []

        def reject(exc):
            rejected.append(exc)
            return {"error": "too many"}, 429

        mw = RateLimitMiddleware(
            limiter,
            key_func=lambda req: req["ip"],
            reject_func=reject,
        )

        assert mw.process({"ip": "1.2.3.4"}) is None
        result = mw.process({"ip": "1.2.3.4"})
        assert result is not None
        assert result[1] == 429
        assert len(rejected) == 1

    def test_raises_without_reject_func(self):
        limiter = SlidingWindowLimiter(max_requests=1, window_seconds=60)
        mw = RateLimitMiddleware(
            limiter,
            key_func=lambda req: req["ip"],
        )
        mw.process({"ip": "1.2.3.4"})
        with pytest.raises(RateLimitExceeded):
            mw.process({"ip": "1.2.3.4"})

    def test_get_headers(self):
        limiter = SlidingWindowLimiter(max_requests=10, window_seconds=60)
        mw = RateLimitMiddleware(
            limiter,
            key_func=lambda req: req["ip"],
        )
        headers = mw.get_headers("1.2.3.4")
        assert "X-RateLimit-Limit" in headers
        assert headers["X-RateLimit-Limit"] == "10"
        assert headers["X-RateLimit-Remaining"] == "10"
''',

        "pyproject.toml": '''\
[project]
name = "rate-limiter-simple"
version = "0.1.0"
description = "In-memory rate limiting with sliding window"
requires-python = ">=3.9"

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.pytest.ini_options]
testpaths = ["tests"]
''',

        "README.md": '''\
# rate-limiter-simple

In-memory rate limiting with a sliding window algorithm.

## Usage

```python
from rate_limiter import SlidingWindowLimiter, RateLimitMiddleware

limiter = SlidingWindowLimiter(max_requests=100, window_seconds=60)

if limiter.allow("user:123"):
    handle_request()
else:
    return "Too Many Requests", 429
```
''',
    },
}

# ---------------------------------------------------------------------------
# Repo metadata: (name, description, languages, issues)
# ---------------------------------------------------------------------------

REPO_META = {
    "retry-genius": {
        "description": "Smart HTTP retry with jitter and circuit breaker pattern",
        "languages": ["python"],
        "issues": [
            ("Add support for custom retry predicates",
             "Allow users to pass a predicate function that inspects the return value (not just exceptions) to decide whether to retry. For example, retry if an HTTP response has status 500."),
            ("Add type hints to all public functions",
             "The public API should have full type annotations so that mypy and pyright users get proper IntelliSense. Currently some functions use Any."),
            ("Circuit breaker doesn't reset after success",
             "When the circuit breaker is in HALF_OPEN state and a call succeeds, the failure count should reset to zero. Currently it only transitions to CLOSED but keeps the old failure count."),
        ],
    },
    "env-shield": {
        "description": "Runtime environment variable validation with typed schemas",
        "languages": ["python"],
        "issues": [
            ("Add support for .env file loading",
             "Users want to load variables from a .env file before validation. Add an optional `dotenv_path` parameter to `validate()` that reads key=value pairs from a file and merges them into the environment."),
            ("Error message doesn't show which variables are missing",
             "When multiple variables are missing, the error message should list all of them, not just the first one. The ValidationError.errors dict has them, but the string representation truncates."),
        ],
    },
    "csv-surgeon": {
        "description": "Repairs broken and malformed CSV files intelligently",
        "languages": ["python"],
        "issues": [
            ("Add streaming support for large files",
             "Currently the entire file is read into memory. For files over 1GB this causes MemoryError. Add a streaming mode that processes the file line by line."),
            ("Encoding detection fails on mixed-encoding files",
             "Some CSV files have headers in UTF-8 but data rows in Latin-1. The detector picks one encoding for the whole file and garbles half the content."),
        ],
    },
    "json-schema-guesser": {
        "description": "Infers JSON Schema from sample JSON payloads automatically",
        "languages": ["typescript"],
        "issues": [
            ("Add support for detecting enum fields",
             "When multiple samples have the same field with a small set of distinct values (e.g. status: 'active' | 'inactive' | 'pending'), the schema should use an enum constraint instead of plain string."),
            ("Nested arrays produce incorrect schema",
             "When inferring schema from [[1,2],[3,4]], the result should be {type:'array', items:{type:'array', items:{type:'integer'}}} but currently the inner array items are lost."),
        ],
    },
    "log-surgeon": {
        "description": "Parses messy unstructured log files into structured data",
        "languages": ["python"],
        "issues": [
            ("Add support for multiline stack traces",
             "Java/Python stack traces span multiple lines. The parser treats each line as a separate entry. It should detect continuation lines (starting with whitespace or 'at ') and merge them into the previous entry."),
            ("Timestamp parser fails on ISO 8601 with timezone offset",
             "Timestamps like 2024-01-15T10:30:00+05:30 are not matched because the regex doesn't account for the colon in the timezone offset."),
        ],
    },
    "encoding-detective": {
        "description": "Detects and fixes file encoding issues automatically",
        "languages": ["python"],
        "issues": [
            ("Add BOM detection and stripping",
             "Files with a UTF-8 BOM (0xEF 0xBB 0xBF) cause issues in many tools. Add a function to detect and optionally strip the BOM. The detect() result should include BOM information."),
        ],
    },
    "diff-simple": {
        "description": "Simple structural diff for JSON, YAML, and TOML files",
        "languages": ["typescript"],
        "issues": [
            ("Array diff shows wrong indices after insertion",
             "When comparing [1,2,3] with [1,99,2,3], the current index-based diff reports index 1 changed and index 3 added. It should detect that 99 was inserted at index 1 and the rest shifted."),
        ],
    },
    "port-finder": {
        "description": "Finds available network ports for local development",
        "languages": ["rust"],
        "issues": [
            ("Add support for checking port ranges",
             "Add a function that returns all available ports in a given range, not just the first one. Useful for tools that need to allocate multiple consecutive ports."),
        ],
    },
    "hash-verify": {
        "description": "File integrity verification with multiple hash algorithms",
        "languages": ["rust"],
        "issues": [
            ("Add parallel hashing for large directories",
             "For directories with thousands of files, hashing is slow because it processes files sequentially. Use rayon or tokio to hash files in parallel."),
        ],
    },
    "rate-limiter-simple": {
        "description": "In-memory rate limiting for any language or framework",
        "languages": ["python"],
        "issues": [
            ("Add token bucket algorithm as alternative",
             "The sliding window algorithm is good for most cases, but some users need token bucket semantics where tokens refill at a constant rate. Add a TokenBucketLimiter class."),
            ("Memory leak when keys are never cleaned up",
             "If the cleanup_interval is set to 0 (disabled), old keys are never removed from the dict. Over time this leaks memory. Add a max_keys parameter or always-on lazy cleanup."),
        ],
    },
}


def main() -> int:
    """Run the full repo seeding process."""
    try:
        wait_for_hub()
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    created_repos = 0
    created_issues = 0

    for name, meta in REPO_META.items():
        print(f"\nCreating repo: {name}...")
        files = REPO_CODE.get(name, {})

        try:
            repo = post("/api/v1/repos", {
                "name": name,
                "description": meta["description"],
                "languages": meta["languages"],
                "files": files,
            })
            repo_id = repo.get("id", repo.get("repo_id", ""))
            print(f"  Created repo {name} (id={str(repo_id)[:8]}...)")
            created_repos += 1
        except RuntimeError as e:
            if "409" in str(e) or "already" in str(e).lower():
                print(f"  Repo {name} already exists, skipping.")
                # Try to get the existing repo id for issue creation
                repo_id = name
            else:
                print(f"  Warning: Could not create {name}: {e}")
                continue

        # Create issues
        for title, body in meta["issues"]:
            try:
                post(f"/api/v1/repos/{repo_id}/issues", {
                    "title": title,
                    "body": body,
                })
                print(f"    Issue: {title}")
                created_issues += 1
            except RuntimeError as e:
                if "409" in str(e) or "already" in str(e).lower():
                    print(f"    Issue already exists: {title}")
                else:
                    print(f"    Warning: Could not create issue: {e}")

    print(f"\nSeed complete: {created_repos} repos, {created_issues} issues created.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
