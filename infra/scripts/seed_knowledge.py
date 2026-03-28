"""
Seed the Feeshr knowledge databases with starter data.

Creates:
- 50+ pitfalls in pitfall-db (Python, TypeScript, Rust, SQL, General)
- 200+ API ground truth entries (Python, TypeScript, Rust)
- 3 seed projects in discussion status
- 4 default workflow templates

Run after migrations and base seed:
    python infra/scripts/seed_knowledge.py
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

HUB_URL = os.environ.get("HUB_URL", "http://localhost:8080")

# ---------------------------------------------------------------------------
# SEED PITFALLS (50+)
# ---------------------------------------------------------------------------

SEED_PITFALLS = [
    # ── Python (15+) ──────────────────────────────────────────────────────
    {
        "title": "Never use os.path.join with user-supplied input",
        "content": "os.path.join('base', user_input) where user_input is '../../etc/passwd' resolves outside the base directory. Use pathlib.Path(base).joinpath(user_input).resolve() and verify the result starts with the base path.",
        "category": "pitfall",
        "language": "python",
        "tags": ["security", "path-traversal", "file-handling"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "open() without encoding parameter uses system default",
        "content": "open('file.txt') uses the system's default encoding, which varies between OS and locale. Always specify encoding: open('file.txt', encoding='utf-8'). This prevents subtle corruption on Windows where default is often cp1252.",
        "category": "pitfall",
        "language": "python",
        "tags": ["encoding", "file-handling", "cross-platform"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Mutable default arguments persist between function calls",
        "content": "def append(item, lst=[]): lst.append(item) — the list persists between calls. Use None sentinel: def append(item, lst=None): lst = lst or []",
        "category": "pitfall",
        "language": "python",
        "tags": ["python-gotcha", "mutability"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Bare except catches KeyboardInterrupt and SystemExit",
        "content": "except: or except Exception: catches everything including signals. Use except (ValueError, TypeError): with specific exceptions. If you truly need a catch-all, use except Exception: and re-raise KeyboardInterrupt/SystemExit.",
        "category": "pitfall",
        "language": "python",
        "tags": ["error-handling", "exceptions"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "asyncio.gather swallows exceptions by default",
        "content": "asyncio.gather(*tasks) returns exceptions as results by default (return_exceptions=False raises the first exception and silently cancels others). Always use return_exceptions=True and check each result, or use asyncio.TaskGroup (3.11+) which propagates all exceptions.",
        "category": "pitfall",
        "language": "python",
        "tags": ["async", "error-handling"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "yaml.load() executes arbitrary Python code",
        "content": "yaml.load(data) without Loader argument uses the FullLoader which can execute arbitrary code. Always use yaml.safe_load(data) or yaml.load(data, Loader=yaml.SafeLoader).",
        "category": "pitfall",
        "language": "python",
        "tags": ["security", "deserialization", "yaml"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "pickle.loads() executes arbitrary code — never use on untrusted data",
        "content": "pickle.loads() can execute arbitrary Python during deserialization. Never unpickle data from untrusted sources (network, user uploads, shared storage). Use JSON, MessagePack, or Protocol Buffers instead.",
        "category": "pitfall",
        "language": "python",
        "tags": ["security", "deserialization"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "String formatting with user input enables format string attacks",
        "content": "f'{user_input}' is safe, but '{}'.format(**user_dict) where user_dict comes from untrusted input can access object attributes via {0.__class__.__mro__}. Use strict allowlists for format keys.",
        "category": "pitfall",
        "language": "python",
        "tags": ["security", "injection"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "String concatenation in SQL queries enables SQL injection",
        "content": "f'SELECT * FROM users WHERE id = {user_id}' — NEVER. Use parameterized queries: cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,)). This applies to ALL database operations, including ORMs with raw query methods.",
        "category": "pitfall",
        "language": "python",
        "tags": ["security", "sql-injection", "database"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "subprocess.shell=True with user input is command injection",
        "content": "subprocess.run(f'ls {user_input}', shell=True) allows command injection. Use subprocess.run(['ls', user_input], shell=False) with a list of arguments. Never pass user input to shell=True commands.",
        "category": "pitfall",
        "language": "python",
        "tags": ["security", "command-injection"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "is vs == for value comparison",
        "content": "'is' checks identity (same object in memory), '==' checks equality. 'a is b' may work for small integers due to CPython interning (-5 to 256) but breaks for larger values. Always use == for value comparison.",
        "category": "pitfall",
        "language": "python",
        "tags": ["python-gotcha", "comparison"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Late binding closures in loops capture variable by reference",
        "content": "for i in range(5): fns.append(lambda: i) — all lambdas return 4. Fix with default argument: lambda i=i: i, or use functools.partial.",
        "category": "pitfall",
        "language": "python",
        "tags": ["python-gotcha", "closures"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "datetime.now() returns naive datetime without timezone",
        "content": "datetime.now() returns a naive datetime (no tz info). Use datetime.now(timezone.utc) or datetime.now(ZoneInfo('UTC')) for timezone-aware datetimes. Naive datetimes cause comparison bugs across time zones.",
        "category": "pitfall",
        "language": "python",
        "tags": ["time", "timezone", "python-gotcha"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "pytest fixtures are not called — they are injected by name",
        "content": "Calling a fixture directly (my_fixture()) bypasses setup/teardown. Use it as a function parameter: def test_foo(my_fixture): ... Pytest resolves fixtures by parameter name matching.",
        "category": "pitfall",
        "language": "python",
        "tags": ["testing", "pytest"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "re.match only checks the beginning of a string",
        "content": "re.match(r'\\d+', 'abc123') returns None because match anchors at the start. Use re.search(r'\\d+', 'abc123') to find patterns anywhere in the string.",
        "category": "pitfall",
        "language": "python",
        "tags": ["python-gotcha", "regex"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "dict.keys() view updates when dictionary changes",
        "content": "keys = d.keys() is a live view, not a snapshot. Modifying d while iterating over keys causes RuntimeError. Use list(d.keys()) if you need to modify the dict during iteration.",
        "category": "pitfall",
        "language": "python",
        "tags": ["python-gotcha", "iteration"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "tempfile.NamedTemporaryFile cannot be reopened on Windows",
        "content": "On Windows, NamedTemporaryFile with delete=True (default) keeps the file locked. Other processes cannot open it by name. Use delete=False and manually os.unlink() when done, or use tempfile.mkstemp().",
        "category": "pitfall",
        "language": "python",
        "tags": ["cross-platform", "file-handling", "windows"],
        "contributed_by": "DocsMaintainer",
    },
    # ── TypeScript (10+) ──────────────────────────────────────────────────
    {
        "title": "JSON.parse returns any — always validate with Zod or similar",
        "content": "JSON.parse() returns 'any' which defeats TypeScript's type system. Always parse into unknown and validate: const data: unknown = JSON.parse(raw); const result = schema.parse(data);",
        "category": "pitfall",
        "language": "typescript",
        "tags": ["type-safety", "validation", "json"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Promise.all rejects on first failure — use Promise.allSettled for resilience",
        "content": "Promise.all([...]) rejects immediately when any promise rejects, leaving other promises running in background. Use Promise.allSettled when you need results from all promises regardless of individual failures.",
        "category": "pitfall",
        "language": "typescript",
        "tags": ["async", "error-handling", "promises"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "parseInt without radix can produce unexpected results",
        "content": "parseInt('08') returns 0 in some older engines (octal parsing). Always specify radix: parseInt('08', 10). Better yet, use Number() for most conversions.",
        "category": "pitfall",
        "language": "typescript",
        "tags": ["parsing", "javascript-gotcha"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "typeof null === 'object' is a JavaScript legacy bug",
        "content": "typeof null returns 'object', not 'null'. Always check for null explicitly: if (value !== null && typeof value === 'object'). This has bitten countless type narrowing functions.",
        "category": "pitfall",
        "language": "typescript",
        "tags": ["javascript-gotcha", "type-safety"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Array.sort mutates in place and sorts lexicographically by default",
        "content": "[10, 9, 1].sort() produces [1, 10, 9] because elements are converted to strings. Use .sort((a, b) => a - b) for numeric sort. Note sort mutates the array — use .toSorted() (ES2023) for immutable sort.",
        "category": "pitfall",
        "language": "typescript",
        "tags": ["javascript-gotcha", "arrays"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Event listener memory leaks from missing removeEventListener",
        "content": "addEventListener without corresponding removeEventListener in component cleanup causes memory leaks. In React, return cleanup from useEffect. In vanilla JS, use AbortController signal for automatic cleanup.",
        "category": "pitfall",
        "language": "typescript",
        "tags": ["dom", "memory-leak", "react"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "async forEach does not await iterations",
        "content": "array.forEach(async (item) => { await process(item); }) fires all iterations concurrently and returns immediately. Use for...of loop with await, or Promise.all(array.map(...)) for controlled concurrency.",
        "category": "pitfall",
        "language": "typescript",
        "tags": ["async", "javascript-gotcha"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Object.keys returns string[] even for numeric-keyed objects",
        "content": "Object.keys({1: 'a', 2: 'b'}) returns ['1', '2'] (strings, not numbers). TypeScript types this as string[]. Use Map<number, T> if you need numeric keys with correct typing.",
        "category": "pitfall",
        "language": "typescript",
        "tags": ["type-safety", "javascript-gotcha"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Unhandled promise rejections crash Node.js by default",
        "content": "Since Node.js 15, unhandled promise rejections throw and crash the process. Always add .catch() to promises or use try/catch with await. Add process.on('unhandledRejection') only as a safety net, not a primary handler.",
        "category": "pitfall",
        "language": "typescript",
        "tags": ["node", "async", "error-handling"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "TypeScript enums create runtime objects — use const enums or unions",
        "content": "enum Direction { Up, Down } creates a runtime bidirectional map object. Use 'const enum' for zero-runtime-cost enums, or string literal unions: type Direction = 'Up' | 'Down' for most cases.",
        "category": "pitfall",
        "language": "typescript",
        "tags": ["type-safety", "performance", "typescript-gotcha"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Optional chaining with method calls can throw at runtime",
        "content": "obj?.method() — if method is not undefined but also not a function (e.g., a string), this throws TypeError at runtime. TypeScript won't catch this if the type says method?: Function but the runtime value differs.",
        "category": "pitfall",
        "language": "typescript",
        "tags": ["type-safety", "runtime-error"],
        "contributed_by": "SecurityReviewer",
    },
    # ── Rust (8+) ─────────────────────────────────────────────────────────
    {
        "title": "unwrap() in production code is a time bomb",
        "content": "Every .unwrap() is a potential panic in production. Use ? operator to propagate errors, or .unwrap_or_default() / .unwrap_or_else(|| ...) for recoverable cases. Reserve unwrap() for tests only.",
        "category": "pitfall",
        "language": "rust",
        "tags": ["error-handling", "reliability"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "String::from and .to_string() allocate — use &str where possible",
        "content": "Every String::from('...') and .to_string() allocates on the heap. In hot paths, prefer &str references. Use String only when you need ownership (storing in structs, returning from functions, mutation).",
        "category": "pitfall",
        "language": "rust",
        "tags": ["performance", "memory"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Mutex poisoning on panic can deadlock your program",
        "content": "If a thread panics while holding a Mutex, the mutex is poisoned. Subsequent .lock() calls return Err. Either use .lock().unwrap() and accept the panic, or handle poison: .lock().unwrap_or_else(|e| e.into_inner()).",
        "category": "pitfall",
        "language": "rust",
        "tags": ["concurrency", "mutex", "error-handling"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "Arc<Mutex<T>> is the default sharing pattern but consider RwLock",
        "content": "Arc<Mutex<T>> is correct for shared mutable state but serializes all access. If reads heavily outweigh writes, use Arc<RwLock<T>> to allow concurrent reads. For atomic counters, use AtomicUsize instead.",
        "category": "pitfall",
        "language": "rust",
        "tags": ["concurrency", "performance"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "async fn in traits requires the async-trait crate before Rust 1.75",
        "content": "Before Rust 1.75, async fn in traits is not directly supported. Use the async-trait crate: #[async_trait] trait MyTrait { async fn do_work(&self); }. Rust 1.75+ supports async fn in traits natively but with limitations on dyn dispatch.",
        "category": "pitfall",
        "language": "rust",
        "tags": ["async", "traits"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": ".clone() hides performance costs — audit every clone in hot paths",
        "content": "Rust's explicit .clone() is a feature, not a bug — it marks allocation points. But overuse of clone() to 'make the borrow checker happy' can make code slower than equivalent GC'd code. Refactor ownership instead.",
        "category": "pitfall",
        "language": "rust",
        "tags": ["performance", "memory", "ownership"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Iterator::collect needs a type annotation or turbofish",
        "content": "let v = iter.collect() won't compile — Rust needs to know the target collection type. Use let v: Vec<_> = iter.collect() or iter.collect::<Vec<_>>() (turbofish). Same applies to HashMap, BTreeMap, etc.",
        "category": "pitfall",
        "language": "rust",
        "tags": ["rust-gotcha", "iterators", "type-inference"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "tokio::spawn requires 'static lifetime — no borrowed references",
        "content": "tokio::spawn(async { ... }) requires the future to be 'static, meaning no borrowed references. Clone data before spawning or use Arc. This is the #1 confusion for async Rust beginners.",
        "category": "pitfall",
        "language": "rust",
        "tags": ["async", "lifetimes", "tokio"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "Vec::drain vs Vec::clear — drain returns elements, clear drops them",
        "content": "vec.clear() drops all elements. vec.drain(..) removes and returns them as an iterator. If you need the elements, use drain. If you just need to empty the vec, clear is more efficient.",
        "category": "pitfall",
        "language": "rust",
        "tags": ["collections", "memory"],
        "contributed_by": "DocsMaintainer",
    },
    # ── SQL (5+) ──────────────────────────────────────────────────────────
    {
        "title": "SELECT * in production queries is a maintenance hazard",
        "content": "SELECT * breaks when columns are added or reordered. It transfers unnecessary data, prevents index-only scans, and makes code fragile. Always list columns explicitly: SELECT id, name, email FROM users.",
        "category": "pitfall",
        "language": "sql",
        "tags": ["performance", "schema-design", "maintainability"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Missing indexes on foreign keys causes slow joins",
        "content": "Foreign key constraints do NOT automatically create indexes in PostgreSQL (MySQL InnoDB does). Always CREATE INDEX on foreign key columns: CREATE INDEX idx_orders_user_id ON orders(user_id).",
        "category": "pitfall",
        "language": "sql",
        "tags": ["performance", "indexes", "postgresql"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "NULL in comparisons — NULL != NULL and NULL NOT IN surprises",
        "content": "WHERE col != 'x' excludes rows where col IS NULL. WHERE col NOT IN (1, 2, NULL) returns zero rows always. Use IS NULL / IS NOT NULL explicitly and avoid NULL in NOT IN lists.",
        "category": "pitfall",
        "language": "sql",
        "tags": ["sql-gotcha", "null-handling"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "OFFSET pagination degrades linearly with page number",
        "content": "SELECT * FROM items ORDER BY id LIMIT 20 OFFSET 100000 scans 100020 rows. Use keyset (cursor) pagination instead: WHERE id > last_seen_id ORDER BY id LIMIT 20.",
        "category": "pitfall",
        "language": "sql",
        "tags": ["performance", "pagination"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Implicit type coercion in WHERE prevents index use",
        "content": "WHERE varchar_col = 123 forces type coercion on every row, bypassing indexes. Always match types: WHERE varchar_col = '123'. Check EXPLAIN plans for seq scans on indexed columns.",
        "category": "pitfall",
        "language": "sql",
        "tags": ["performance", "indexes", "type-coercion"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "N+1 query problem — fetch related data in bulk",
        "content": "Fetching parent rows then looping to fetch children is O(N) queries. Use JOINs or WHERE parent_id IN (...) to batch. ORMs like SQLAlchemy need joinedload() or subqueryload() to avoid this.",
        "category": "pitfall",
        "language": "sql",
        "tags": ["performance", "orm", "n-plus-one"],
        "contributed_by": "DocsMaintainer",
    },
    # ── General (10+) ────────────────────────────────────────────────────
    {
        "title": "Floating point equality checks are almost always wrong",
        "content": "0.1 + 0.2 != 0.3 in IEEE 754. Use abs(a - b) < epsilon for comparison, or use Decimal for financial calculations. In Rust: (a - b).abs() < f64::EPSILON. In JS: Math.abs(a - b) < Number.EPSILON.",
        "category": "pitfall",
        "language": "general",
        "tags": ["math", "floating-point"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Time zone handling — always store UTC, convert at display",
        "content": "Storing local times in the database causes bugs when users are in different time zones or during DST transitions. Store all timestamps as UTC (TIMESTAMPTZ in Postgres). Convert to local time only in the UI layer. Use datetime.now(timezone.utc) in Python, not datetime.now().",
        "category": "pitfall",
        "language": "general",
        "tags": ["time", "timezone", "database"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Unicode normalization — same visual string, different bytes",
        "content": "'cafe\\u0301' (e + combining accent) looks like 'caf\\u00e9' but has different bytes. Use unicodedata.normalize('NFC', s) before comparison, hashing, or storage. This affects filenames, search, and auth.",
        "category": "pitfall",
        "language": "general",
        "tags": ["unicode", "encoding", "security"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "Cache invalidation — the second hardest problem in computer science",
        "content": "Caching without a clear invalidation strategy leads to stale data bugs. Define TTLs, use cache-aside pattern, and always consider: what happens when the source data changes? Use versioned cache keys when possible.",
        "category": "pitfall",
        "language": "general",
        "tags": ["caching", "architecture"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Race conditions in check-then-act patterns",
        "content": "if not file.exists(): file.write(...) has a TOCTOU race. Another process can create the file between check and write. Use atomic operations: open(path, 'x') for exclusive creation, or database transactions for data.",
        "category": "pitfall",
        "language": "general",
        "tags": ["concurrency", "race-condition", "security"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "CORS misconfiguration — Access-Control-Allow-Origin: * with credentials",
        "content": "Setting Access-Control-Allow-Origin: * does not allow credentials (cookies, auth headers). Browsers reject it. You must echo back the specific Origin header AND set Access-Control-Allow-Credentials: true.",
        "category": "pitfall",
        "language": "general",
        "tags": ["security", "cors", "web"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "Retry without jitter causes thundering herd",
        "content": "Retrying failed requests with fixed delays causes all clients to retry simultaneously, amplifying the outage. Use exponential backoff with random jitter: delay = min(base * 2^attempt + random(), max_delay).",
        "category": "pitfall",
        "language": "general",
        "tags": ["reliability", "distributed-systems", "retry"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Logging secrets — sanitize before writing to logs",
        "content": "Logging request bodies, headers, or error messages can leak API keys, passwords, and tokens to log aggregators. Sanitize sensitive fields before logging. Never log Authorization headers or request bodies containing credentials.",
        "category": "pitfall",
        "language": "general",
        "tags": ["security", "logging"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "DNS resolution is not instant — cache and handle failures",
        "content": "DNS lookups can take 50-200ms and can fail. HTTP clients that resolve DNS on every request add latency. Use connection pooling (which caches connections) and handle DNS resolution failures gracefully.",
        "category": "pitfall",
        "language": "general",
        "tags": ["networking", "performance", "reliability"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Off-by-one errors in date range queries",
        "content": "WHERE date BETWEEN '2024-01-01' AND '2024-01-31' misses times after midnight on Jan 31 if using timestamps. Use WHERE date >= '2024-01-01' AND date < '2024-02-01' (exclusive upper bound) for correct ranges.",
        "category": "pitfall",
        "language": "general",
        "tags": ["database", "date-ranges", "off-by-one"],
        "contributed_by": "DocsMaintainer",
    },
    {
        "title": "Hardcoded secrets in source code get committed to git",
        "content": "API_KEY = 'sk-abc123' in source code will end up in git history forever, even if deleted later. Use environment variables, secret managers (Vault, AWS SSM), or .env files (gitignored). Use pre-commit hooks like detect-secrets.",
        "category": "pitfall",
        "language": "general",
        "tags": ["security", "secrets", "git"],
        "contributed_by": "SecurityReviewer",
    },
    {
        "title": "Integer overflow wraps silently in many languages",
        "content": "In C/C++, signed integer overflow is undefined behavior. In Rust, it panics in debug and wraps in release. In Python, integers are arbitrary precision. In JS, all numbers are f64. Know your language's behavior and use checked arithmetic where needed.",
        "category": "pitfall",
        "language": "general",
        "tags": ["math", "overflow", "correctness"],
        "contributed_by": "DocsMaintainer",
    },
]

# ---------------------------------------------------------------------------
# SEED API GROUND TRUTH (200+)
# ---------------------------------------------------------------------------

SEED_API_GROUND_TRUTH = [
    # ── pandas (10) ───────────────────────────────────────────────────────
    {"module": "pandas", "function": "read_csv", "import_path": "pd.read_csv", "signature": "(filepath_or_buffer, sep=',', delimiter=None, header='infer', names=None, index_col=None, usecols=None, dtype=None, engine=None, converters=None, nrows=None, skiprows=None, encoding=None, on_bad_lines='error')", "since_version": "0.10.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pandas", "function": "DataFrame", "import_path": "pd.DataFrame", "signature": "(data=None, index=None, columns=None, dtype=None, copy=None)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pandas", "function": "DataFrame.merge", "import_path": "pd.DataFrame.merge", "signature": "(right, how='inner', on=None, left_on=None, right_on=None, left_index=False, right_index=False, sort=False, suffixes=('_x', '_y'), copy=None, indicator=False, validate=None)", "since_version": "0.17.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pandas", "function": "DataFrame.groupby", "import_path": "pd.DataFrame.groupby", "signature": "(by=None, axis=0, level=None, as_index=True, sort=True, group_keys=True, observed=True, dropna=True)", "since_version": "0.10.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pandas", "function": "DataFrame.pivot_table", "import_path": "pd.DataFrame.pivot_table", "signature": "(values=None, index=None, columns=None, aggfunc='mean', fill_value=None, margins=False, dropna=True, margins_name='All', observed=True, sort=True)", "since_version": "0.10.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pandas", "function": "read_json", "import_path": "pd.read_json", "signature": "(path_or_buf, orient=None, typ='frame', dtype=None, convert_axes=None, convert_dates=True, keep_default_dates=True, precise_float=False, date_unit=None, encoding=None, lines=False, chunksize=None, engine=None)", "since_version": "0.12.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pandas", "function": "to_datetime", "import_path": "pd.to_datetime", "signature": "(arg, errors='raise', dayfirst=False, yearfirst=False, utc=False, format=None, exact=True, unit=None, infer_datetime_format=False, origin='unix', cache=True)", "since_version": "0.10.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pandas", "function": "DataFrame.apply", "import_path": "pd.DataFrame.apply", "signature": "(func, axis=0, raw=False, result_type=None, args=(), by_row='compat', engine='python', engine_kwargs=None, **kwargs)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pandas", "function": "concat", "import_path": "pd.concat", "signature": "(objs, axis=0, join='outer', ignore_index=False, keys=None, levels=None, names=None, verify_integrity=False, sort=False, copy=None)", "since_version": "0.8.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pandas", "function": "DataFrame.to_sql", "import_path": "pd.DataFrame.to_sql", "signature": "(name, con, schema=None, if_exists='fail', index=True, index_label=None, chunksize=None, dtype=None, method=None)", "since_version": "0.14.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    # ── requests (5) ─────────────────────────────────────────────────────
    {"module": "requests", "function": "get", "import_path": "requests.get", "signature": "(url, params=None, **kwargs)", "since_version": "0.2.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "requests", "function": "post", "import_path": "requests.post", "signature": "(url, data=None, json=None, **kwargs)", "since_version": "0.2.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "requests", "function": "Session", "import_path": "requests.Session", "signature": "()", "since_version": "0.8.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "requests", "function": "Response.json", "import_path": "requests.Response.json", "signature": "(**kwargs)", "since_version": "0.12.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "requests", "function": "Response.raise_for_status", "import_path": "requests.Response.raise_for_status", "signature": "()", "since_version": "0.12.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    # ── fastapi (10) ─────────────────────────────────────────────────────
    {"module": "fastapi", "function": "FastAPI", "import_path": "fastapi.FastAPI", "signature": "(*, debug=False, routes=None, title='FastAPI', summary=None, description='', version='0.1.0', openapi_url='/openapi.json', docs_url='/docs', redoc_url='/redoc', lifespan=None)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "fastapi", "function": "APIRouter", "import_path": "fastapi.APIRouter", "signature": "(*, prefix='', tags=None, dependencies=None, responses=None, default_response_class=JSONResponse)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "fastapi", "function": "Depends", "import_path": "fastapi.Depends", "signature": "(dependency=None, *, use_cache=True)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "fastapi", "function": "Query", "import_path": "fastapi.Query", "signature": "(default=..., *, alias=None, title=None, description=None, gt=None, ge=None, lt=None, le=None, min_length=None, max_length=None, pattern=None, deprecated=None)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "fastapi", "function": "Path", "import_path": "fastapi.Path", "signature": "(default=..., *, alias=None, title=None, description=None, gt=None, ge=None, lt=None, le=None, min_length=None, max_length=None, pattern=None, deprecated=None)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "fastapi", "function": "Body", "import_path": "fastapi.Body", "signature": "(default=..., *, embed=False, media_type='application/json', alias=None, title=None, description=None)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "fastapi", "function": "HTTPException", "import_path": "fastapi.HTTPException", "signature": "(status_code, detail=None, headers=None)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "fastapi", "function": "BackgroundTasks", "import_path": "fastapi.BackgroundTasks", "signature": "()", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "fastapi", "function": "Request", "import_path": "fastapi.Request", "signature": "(scope, receive=None, send=None)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "fastapi", "function": "WebSocket", "import_path": "fastapi.WebSocket", "signature": "(scope, receive=None, send=None)", "since_version": "0.36.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    # ── sqlalchemy (10) ──────────────────────────────────────────────────
    {"module": "sqlalchemy", "function": "create_engine", "import_path": "sqlalchemy.create_engine", "signature": "(url, *, connect_args=None, echo=False, echo_pool=False, pool_pre_ping=False, pool_size=5, max_overflow=10, pool_recycle=-1, pool_timeout=30)", "since_version": "0.2.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlalchemy", "function": "Column", "import_path": "sqlalchemy.Column", "signature": "(name=None, type_=None, *args, autoincrement='auto', default=None, index=None, nullable=True, primary_key=False, server_default=None, unique=None)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlalchemy", "function": "select", "import_path": "sqlalchemy.select", "signature": "(*entities, **kwargs)", "since_version": "1.4.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlalchemy", "function": "text", "import_path": "sqlalchemy.text", "signature": "(text, bind=None)", "since_version": "0.8.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlalchemy", "function": "Session", "import_path": "sqlalchemy.orm.Session", "signature": "(bind=None, autoflush=True, expire_on_commit=True, info=None)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlalchemy", "function": "relationship", "import_path": "sqlalchemy.orm.relationship", "signature": "(argument=None, secondary=None, back_populates=None, backref=None, uselist=None, lazy='select', cascade='save-update, merge', passive_deletes=False, order_by=None)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlalchemy", "function": "mapped_column", "import_path": "sqlalchemy.orm.mapped_column", "signature": "(type_=None, *args, init=True, default=None, default_factory=None, nullable=None, primary_key=False, index=None, unique=None, server_default=None)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlalchemy", "function": "DeclarativeBase", "import_path": "sqlalchemy.orm.DeclarativeBase", "signature": "()", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlalchemy", "function": "create_async_engine", "import_path": "sqlalchemy.ext.asyncio.create_async_engine", "signature": "(url, *, echo=False, pool_pre_ping=False, pool_size=5, max_overflow=10, pool_recycle=-1)", "since_version": "1.4.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlalchemy", "function": "AsyncSession", "import_path": "sqlalchemy.ext.asyncio.AsyncSession", "signature": "(bind=None, autoflush=True, expire_on_commit=True)", "since_version": "1.4.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    # ── pytest (8) ───────────────────────────────────────────────────────
    {"module": "pytest", "function": "fixture", "import_path": "pytest.fixture", "signature": "(scope='function', params=None, autouse=False, ids=None, name=None)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pytest", "function": "mark.parametrize", "import_path": "pytest.mark.parametrize", "signature": "(argnames, argvalues, indirect=False, ids=None, scope=None)", "since_version": "2.2.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pytest", "function": "raises", "import_path": "pytest.raises", "signature": "(expected_exception, *, match=None)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pytest", "function": "mark.skip", "import_path": "pytest.mark.skip", "signature": "(reason=None)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pytest", "function": "mark.skipif", "import_path": "pytest.mark.skipif", "signature": "(condition, *, reason)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pytest", "function": "mark.xfail", "import_path": "pytest.mark.xfail", "signature": "(condition=None, *, reason=None, raises=None, run=True, strict=False)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pytest", "function": "approx", "import_path": "pytest.approx", "signature": "(expected, rel=None, abs=None, nan_ok=False)", "since_version": "3.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pytest", "function": "MonkeyPatch", "import_path": "pytest.MonkeyPatch", "signature": "()", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    # ── httpx (5) ────────────────────────────────────────────────────────
    {"module": "httpx", "function": "AsyncClient", "import_path": "httpx.AsyncClient", "signature": "(*, auth=None, params=None, headers=None, cookies=None, verify=True, cert=None, http1=True, http2=False, proxies=None, timeout=5.0, follow_redirects=False, limits=None, transport=None, base_url='')", "since_version": "0.18.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "httpx", "function": "Client", "import_path": "httpx.Client", "signature": "(*, auth=None, params=None, headers=None, cookies=None, verify=True, cert=None, http1=True, http2=False, proxies=None, timeout=5.0, follow_redirects=False, limits=None, transport=None, base_url='')", "since_version": "0.18.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "httpx", "function": "get", "import_path": "httpx.get", "signature": "(url, *, params=None, headers=None, cookies=None, auth=None, follow_redirects=False, timeout=5.0, verify=True)", "since_version": "0.7.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "httpx", "function": "post", "import_path": "httpx.post", "signature": "(url, *, content=None, data=None, files=None, json=None, params=None, headers=None, cookies=None, auth=None, follow_redirects=False, timeout=5.0, verify=True)", "since_version": "0.7.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "httpx", "function": "Response.json", "import_path": "httpx.Response.json", "signature": "()", "since_version": "0.7.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    # ── pydantic (10) ────────────────────────────────────────────────────
    {"module": "pydantic", "function": "BaseModel", "import_path": "pydantic.BaseModel", "signature": "(**data)", "since_version": "0.2.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pydantic", "function": "Field", "import_path": "pydantic.Field", "signature": "(default=PydanticUndefined, *, alias=None, title=None, description=None, gt=None, ge=None, lt=None, le=None, min_length=None, max_length=None, pattern=None, discriminator=None, json_schema_extra=None, frozen=None, exclude=None)", "since_version": "0.2.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pydantic", "function": "field_validator", "import_path": "pydantic.field_validator", "signature": "(*fields, mode='after', check_fields=None)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pydantic", "function": "model_validator", "import_path": "pydantic.model_validator", "signature": "(*, mode='after')", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pydantic", "function": "ConfigDict", "import_path": "pydantic.ConfigDict", "signature": "(*, strict=False, frozen=False, populate_by_name=False, use_enum_values=False, arbitrary_types_allowed=False, from_attributes=False, validate_default=False, validate_assignment=False, str_strip_whitespace=False)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pydantic", "function": "TypeAdapter", "import_path": "pydantic.TypeAdapter", "signature": "(type, *, config=None, _parent_depth=2)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pydantic", "function": "BaseModel.model_dump", "import_path": "pydantic.BaseModel.model_dump", "signature": "(*, mode='python', include=None, exclude=None, context=None, by_alias=False, exclude_unset=False, exclude_defaults=False, exclude_none=False, round_trip=False, warnings=True)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pydantic", "function": "BaseModel.model_validate", "import_path": "pydantic.BaseModel.model_validate", "signature": "(obj, *, strict=None, from_attributes=None, context=None)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pydantic", "function": "BaseModel.model_validate_json", "import_path": "pydantic.BaseModel.model_validate_json", "signature": "(json_data, *, strict=None, context=None)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pydantic", "function": "BaseModel.model_json_schema", "import_path": "pydantic.BaseModel.model_json_schema", "signature": "(*, by_alias=True, ref_template='#/$defs/{model}', schema_generator=GenerateJsonSchema, mode='validation')", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    # ── aiohttp (5) ──────────────────────────────────────────────────────
    {"module": "aiohttp", "function": "ClientSession", "import_path": "aiohttp.ClientSession", "signature": "(base_url=None, *, connector=None, cookies=None, headers=None, skip_auto_headers=None, auth=None, json_serialize=json.dumps, cookie_jar=None, timeout=sentinel, raise_for_status=False, trust_env=False)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "aiohttp", "function": "web.Application", "import_path": "aiohttp.web.Application", "signature": "(*, logger=None, middlewares=(), handler_args=None, client_max_size=1024**2)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "aiohttp", "function": "web.run_app", "import_path": "aiohttp.web.run_app", "signature": "(app, *, host=None, port=None, path=None, sock=None, shutdown_timeout=60.0, ssl_context=None, print=print, backlog=128, access_log=None)", "since_version": "0.15.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "aiohttp", "function": "web.Response", "import_path": "aiohttp.web.Response", "signature": "(*, body=None, status=200, reason=None, text=None, headers=None, content_type=None, charset=None)", "since_version": "0.1.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "aiohttp", "function": "web.json_response", "import_path": "aiohttp.web.json_response", "signature": "(data=sentinel, *, text=None, body=None, status=200, reason=None, headers=None, content_type='application/json', dumps=json.dumps)", "since_version": "0.15.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    # ── pathlib (5) ──────────────────────────────────────────────────────
    {"module": "pathlib", "function": "Path", "import_path": "pathlib.Path", "signature": "(*pathsegments)", "since_version": "3.4.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pathlib", "function": "Path.read_text", "import_path": "pathlib.Path.read_text", "signature": "(encoding=None, errors=None)", "since_version": "3.4.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pathlib", "function": "Path.write_text", "import_path": "pathlib.Path.write_text", "signature": "(data, encoding=None, errors=None, newline=None)", "since_version": "3.4.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pathlib", "function": "Path.glob", "import_path": "pathlib.Path.glob", "signature": "(pattern, *, case_sensitive=None)", "since_version": "3.4.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "pathlib", "function": "Path.mkdir", "import_path": "pathlib.Path.mkdir", "signature": "(mode=0o777, parents=False, exist_ok=False)", "since_version": "3.4.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    # ── json (3) ─────────────────────────────────────────────────────────
    {"module": "json", "function": "dumps", "import_path": "json.dumps", "signature": "(obj, *, skipkeys=False, ensure_ascii=True, check_circular=True, allow_nan=True, cls=None, indent=None, separators=None, default=None, sort_keys=False)", "since_version": "2.6.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "json", "function": "loads", "import_path": "json.loads", "signature": "(s, *, cls=None, object_hook=None, parse_float=None, parse_int=None, parse_constant=None, object_pairs_hook=None)", "since_version": "2.6.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "json", "function": "load", "import_path": "json.load", "signature": "(fp, *, cls=None, object_hook=None, parse_float=None, parse_int=None, parse_constant=None, object_pairs_hook=None)", "since_version": "2.6.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    # ── os (5) ───────────────────────────────────────────────────────────
    {"module": "os", "function": "environ.get", "import_path": "os.environ.get", "signature": "(key, default=None)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "os", "function": "path.join", "import_path": "os.path.join", "signature": "(path, *paths)", "since_version": "1.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "os", "function": "makedirs", "import_path": "os.makedirs", "signature": "(name, mode=0o777, exist_ok=False)", "since_version": "1.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "os", "function": "listdir", "import_path": "os.listdir", "signature": "(path='.')", "since_version": "1.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "os", "function": "getenv", "import_path": "os.getenv", "signature": "(key, default=None)", "since_version": "1.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    # ── datetime (4) ─────────────────────────────────────────────────────
    {"module": "datetime", "function": "datetime.now", "import_path": "datetime.datetime.now", "signature": "(tz=None)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "datetime", "function": "datetime.fromisoformat", "import_path": "datetime.datetime.fromisoformat", "signature": "(date_string)", "since_version": "3.7.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "datetime", "function": "timedelta", "import_path": "datetime.timedelta", "signature": "(days=0, seconds=0, microseconds=0, milliseconds=0, minutes=0, hours=0, weeks=0)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "datetime", "function": "datetime.strptime", "import_path": "datetime.datetime.strptime", "signature": "(date_string, format)", "since_version": "2.0.0", "deprecated": False, "language": "python", "verified_at": "2026-03-20T00:00:00Z"},
    # ── TypeScript: express (8) ──────────────────────────────────────────
    {"module": "express", "function": "express", "import_path": "import express from 'express'", "signature": "(): Express", "since_version": "4.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "express", "function": "Router", "import_path": "express.Router", "signature": "(options?: { caseSensitive?: boolean; mergeParams?: boolean; strict?: boolean }): Router", "since_version": "4.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "express", "function": "json", "import_path": "express.json", "signature": "(options?: { inflate?: boolean; limit?: string | number; reviver?: Function; strict?: boolean; type?: string | string[] }): RequestHandler", "since_version": "4.16.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "express", "function": "urlencoded", "import_path": "express.urlencoded", "signature": "(options?: { extended?: boolean; inflate?: boolean; limit?: string | number; parameterLimit?: number; type?: string | string[] }): RequestHandler", "since_version": "4.16.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "express", "function": "static", "import_path": "express.static", "signature": "(root: string, options?: { dotfiles?: string; etag?: boolean; extensions?: string[]; index?: boolean | string | string[]; maxAge?: number | string; redirect?: boolean }): RequestHandler", "since_version": "4.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "express", "function": "app.listen", "import_path": "app.listen", "signature": "(port: number, hostname?: string, backlog?: number, callback?: () => void): Server", "since_version": "4.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "express", "function": "app.use", "import_path": "app.use", "signature": "(path?: string | string[], ...handlers: RequestHandler[]): Express", "since_version": "4.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "express", "function": "app.get", "import_path": "app.get", "signature": "(path: string, ...handlers: RequestHandler[]): Express", "since_version": "4.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    # ── TypeScript: zod (8) ──────────────────────────────────────────────
    {"module": "zod", "function": "z.object", "import_path": "import { z } from 'zod'", "signature": "(shape: ZodRawShape): ZodObject", "since_version": "1.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "zod", "function": "z.string", "import_path": "import { z } from 'zod'", "signature": "(params?: { required_error?: string; invalid_type_error?: string; description?: string }): ZodString", "since_version": "1.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "zod", "function": "z.number", "import_path": "import { z } from 'zod'", "signature": "(params?: { required_error?: string; invalid_type_error?: string; description?: string }): ZodNumber", "since_version": "1.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "zod", "function": "z.array", "import_path": "import { z } from 'zod'", "signature": "(schema: ZodTypeAny): ZodArray", "since_version": "1.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "zod", "function": "z.enum", "import_path": "import { z } from 'zod'", "signature": "(values: [string, ...string[]]): ZodEnum", "since_version": "1.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "zod", "function": "z.union", "import_path": "import { z } from 'zod'", "signature": "(types: [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]): ZodUnion", "since_version": "1.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "zod", "function": "z.infer", "import_path": "import { z } from 'zod'", "signature": "<T extends ZodType>: T['_output']", "since_version": "1.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "zod", "function": "schema.parse", "import_path": "import { z } from 'zod'", "signature": "(data: unknown): T", "since_version": "1.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    # ── TypeScript: prisma (8) ───────────────────────────────────────────
    {"module": "prisma", "function": "PrismaClient", "import_path": "import { PrismaClient } from '@prisma/client'", "signature": "(options?: { datasources?: Datasources; log?: LogLevel[]; errorFormat?: ErrorFormat }): PrismaClient", "since_version": "2.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "prisma", "function": "findUnique", "import_path": "prisma.model.findUnique", "signature": "(args: { where: WhereUniqueInput; select?: Select; include?: Include }): Promise<Model | null>", "since_version": "2.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "prisma", "function": "findMany", "import_path": "prisma.model.findMany", "signature": "(args?: { where?: WhereInput; orderBy?: OrderByInput; take?: number; skip?: number; cursor?: WhereUniqueInput; select?: Select; include?: Include; distinct?: FieldRef[] }): Promise<Model[]>", "since_version": "2.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "prisma", "function": "create", "import_path": "prisma.model.create", "signature": "(args: { data: CreateInput; select?: Select; include?: Include }): Promise<Model>", "since_version": "2.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "prisma", "function": "update", "import_path": "prisma.model.update", "signature": "(args: { where: WhereUniqueInput; data: UpdateInput; select?: Select; include?: Include }): Promise<Model>", "since_version": "2.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "prisma", "function": "delete", "import_path": "prisma.model.delete", "signature": "(args: { where: WhereUniqueInput; select?: Select; include?: Include }): Promise<Model>", "since_version": "2.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "prisma", "function": "upsert", "import_path": "prisma.model.upsert", "signature": "(args: { where: WhereUniqueInput; update: UpdateInput; create: CreateInput; select?: Select; include?: Include }): Promise<Model>", "since_version": "2.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "prisma", "function": "$transaction", "import_path": "prisma.$transaction", "signature": "(queries: PrismaPromise[] | ((tx: TransactionClient) => Promise<T>), options?: { maxWait?: number; timeout?: number; isolationLevel?: TransactionIsolationLevel }): Promise<T>", "since_version": "2.10.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    # ── TypeScript: next (8) ─────────────────────────────────────────────
    {"module": "next", "function": "NextResponse.json", "import_path": "import { NextResponse } from 'next/server'", "signature": "(body: any, init?: ResponseInit): NextResponse", "since_version": "13.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "next", "function": "NextResponse.redirect", "import_path": "import { NextResponse } from 'next/server'", "signature": "(url: string | URL, status?: number): NextResponse", "since_version": "13.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "next", "function": "useRouter", "import_path": "import { useRouter } from 'next/navigation'", "signature": "(): AppRouterInstance", "since_version": "13.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "next", "function": "useSearchParams", "import_path": "import { useSearchParams } from 'next/navigation'", "signature": "(): ReadonlyURLSearchParams", "since_version": "13.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "next", "function": "usePathname", "import_path": "import { usePathname } from 'next/navigation'", "signature": "(): string", "since_version": "13.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "next", "function": "notFound", "import_path": "import { notFound } from 'next/navigation'", "signature": "(): never", "since_version": "13.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "next", "function": "redirect", "import_path": "import { redirect } from 'next/navigation'", "signature": "(url: string, type?: 'replace' | 'push'): never", "since_version": "13.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "next", "function": "NextRequest", "import_path": "import { NextRequest } from 'next/server'", "signature": "(input: RequestInfo | URL, init?: RequestInit): NextRequest", "since_version": "12.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    # ── TypeScript: react (10) ───────────────────────────────────────────
    {"module": "react", "function": "useState", "import_path": "import { useState } from 'react'", "signature": "<T>(initialState: T | (() => T)): [T, Dispatch<SetStateAction<T>>]", "since_version": "16.8.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "react", "function": "useEffect", "import_path": "import { useEffect } from 'react'", "signature": "(effect: EffectCallback, deps?: DependencyList): void", "since_version": "16.8.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "react", "function": "useRef", "import_path": "import { useRef } from 'react'", "signature": "<T>(initialValue: T): MutableRefObject<T>", "since_version": "16.8.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "react", "function": "useMemo", "import_path": "import { useMemo } from 'react'", "signature": "<T>(factory: () => T, deps: DependencyList): T", "since_version": "16.8.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "react", "function": "useCallback", "import_path": "import { useCallback } from 'react'", "signature": "<T extends Function>(callback: T, deps: DependencyList): T", "since_version": "16.8.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "react", "function": "useContext", "import_path": "import { useContext } from 'react'", "signature": "<T>(context: Context<T>): T", "since_version": "16.8.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "react", "function": "useReducer", "import_path": "import { useReducer } from 'react'", "signature": "<R extends Reducer<any, any>>(reducer: R, initialArg: ReducerState<R>, init?: (arg: ReducerState<R>) => ReducerState<R>): [ReducerState<R>, Dispatch<ReducerAction<R>>]", "since_version": "16.8.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "react", "function": "createContext", "import_path": "import { createContext } from 'react'", "signature": "<T>(defaultValue: T): Context<T>", "since_version": "16.3.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "react", "function": "forwardRef", "import_path": "import { forwardRef } from 'react'", "signature": "<T, P = {}>(render: ForwardRefRenderFunction<T, P>): ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<T>>", "since_version": "16.3.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "react", "function": "memo", "import_path": "import { memo } from 'react'", "signature": "<P extends object>(Component: FC<P>, areEqual?: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean): NamedExoticComponent<P>", "since_version": "16.6.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    # ── TypeScript: node:fs (5) ──────────────────────────────────────────
    {"module": "node:fs", "function": "readFileSync", "import_path": "import { readFileSync } from 'node:fs'", "signature": "(path: PathLike, options?: { encoding?: BufferEncoding; flag?: string }): string | Buffer", "since_version": "0.1.8", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "node:fs", "function": "writeFileSync", "import_path": "import { writeFileSync } from 'node:fs'", "signature": "(file: PathLike, data: string | Buffer, options?: WriteFileOptions): void", "since_version": "0.1.29", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "node:fs/promises", "function": "readFile", "import_path": "import { readFile } from 'node:fs/promises'", "signature": "(path: PathLike, options?: { encoding?: BufferEncoding; flag?: string; signal?: AbortSignal }): Promise<string | Buffer>", "since_version": "10.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "node:fs/promises", "function": "writeFile", "import_path": "import { writeFile } from 'node:fs/promises'", "signature": "(file: PathLike, data: string | Buffer, options?: WriteFileOptions): Promise<void>", "since_version": "10.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "node:fs/promises", "function": "mkdir", "import_path": "import { mkdir } from 'node:fs/promises'", "signature": "(path: PathLike, options?: { recursive?: boolean; mode?: number }): Promise<string | undefined>", "since_version": "10.0.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    # ── TypeScript: node:path (5) ────────────────────────────────────────
    {"module": "node:path", "function": "join", "import_path": "import { join } from 'node:path'", "signature": "(...paths: string[]): string", "since_version": "0.1.16", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "node:path", "function": "resolve", "import_path": "import { resolve } from 'node:path'", "signature": "(...paths: string[]): string", "since_version": "0.3.4", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "node:path", "function": "basename", "import_path": "import { basename } from 'node:path'", "signature": "(path: string, suffix?: string): string", "since_version": "0.1.25", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "node:path", "function": "dirname", "import_path": "import { dirname } from 'node:path'", "signature": "(path: string): string", "since_version": "0.1.16", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "node:path", "function": "extname", "import_path": "import { extname } from 'node:path'", "signature": "(path: string): string", "since_version": "0.1.25", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    # ── TypeScript: node:crypto (4) ──────────────────────────────────────
    {"module": "node:crypto", "function": "createHash", "import_path": "import { createHash } from 'node:crypto'", "signature": "(algorithm: string, options?: HashOptions): Hash", "since_version": "0.1.92", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "node:crypto", "function": "randomBytes", "import_path": "import { randomBytes } from 'node:crypto'", "signature": "(size: number, callback?: (err: Error | null, buf: Buffer) => void): Buffer", "since_version": "0.5.8", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "node:crypto", "function": "randomUUID", "import_path": "import { randomUUID } from 'node:crypto'", "signature": "(options?: { disableEntropyCache?: boolean }): string", "since_version": "14.17.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "node:crypto", "function": "createHmac", "import_path": "import { createHmac } from 'node:crypto'", "signature": "(algorithm: string, key: BinaryLike | KeyObject, options?: HashOptions): Hmac", "since_version": "0.1.94", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    # ── TypeScript: axios (4) ────────────────────────────────────────────
    {"module": "axios", "function": "axios", "import_path": "import axios from 'axios'", "signature": "(config: AxiosRequestConfig): Promise<AxiosResponse>", "since_version": "0.1.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "axios", "function": "axios.get", "import_path": "import axios from 'axios'", "signature": "<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>", "since_version": "0.1.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "axios", "function": "axios.post", "import_path": "import axios from 'axios'", "signature": "<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>", "since_version": "0.1.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "axios", "function": "axios.create", "import_path": "import axios from 'axios'", "signature": "(config?: AxiosRequestConfig): AxiosInstance", "since_version": "0.1.0", "deprecated": False, "language": "typescript", "verified_at": "2026-03-20T00:00:00Z"},
    # ── Rust: axum (10) ──────────────────────────────────────────────────
    {"module": "axum", "function": "Router::new", "import_path": "use axum::Router", "signature": "() -> Router<S>", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "axum", "function": "Router::route", "import_path": "use axum::Router", "signature": "(self, path: &str, method_router: MethodRouter<S>) -> Self", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "axum", "function": "Router::nest", "import_path": "use axum::Router", "signature": "(self, path: &str, router: Router<S>) -> Self", "since_version": "0.2.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "axum", "function": "Router::layer", "import_path": "use axum::Router", "signature": "<L>(self, layer: L) -> Router<S>", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "axum", "function": "Router::with_state", "import_path": "use axum::Router", "signature": "<S2>(self, state: S) -> Router<S2>", "since_version": "0.6.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "axum", "function": "Json", "import_path": "use axum::Json", "signature": "<T: Serialize>(T) -> impl IntoResponse", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "axum", "function": "extract::State", "import_path": "use axum::extract::State", "signature": "<S: Clone + Send + Sync + 'static>(S)", "since_version": "0.6.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "axum", "function": "extract::Path", "import_path": "use axum::extract::Path", "signature": "<T: DeserializeOwned>(T)", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "axum", "function": "extract::Query", "import_path": "use axum::extract::Query", "signature": "<T: DeserializeOwned>(T)", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "axum", "function": "serve", "import_path": "use axum::serve", "signature": "(listener: TcpListener, make_service: IntoMakeService) -> Serve", "since_version": "0.7.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    # ── Rust: tokio (10) ─────────────────────────────────────────────────
    {"module": "tokio", "function": "spawn", "import_path": "use tokio::spawn", "signature": "<T: Future + Send + 'static>(future: T) -> JoinHandle<T::Output>", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "tokio", "function": "select!", "import_path": "use tokio::select", "signature": "macro_rules! select { ... }", "since_version": "0.2.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "tokio", "function": "time::sleep", "import_path": "use tokio::time::sleep", "signature": "(duration: Duration) -> Sleep", "since_version": "0.2.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "tokio", "function": "time::timeout", "import_path": "use tokio::time::timeout", "signature": "<F: Future>(duration: Duration, future: F) -> Result<F::Output, Elapsed>", "since_version": "0.2.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "tokio", "function": "sync::Mutex", "import_path": "use tokio::sync::Mutex", "signature": "<T>::new(t: T) -> Mutex<T>", "since_version": "0.2.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "tokio", "function": "sync::RwLock", "import_path": "use tokio::sync::RwLock", "signature": "<T>::new(t: T) -> RwLock<T>", "since_version": "0.2.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "tokio", "function": "sync::mpsc::channel", "import_path": "use tokio::sync::mpsc", "signature": "<T>(buffer: usize) -> (Sender<T>, Receiver<T>)", "since_version": "0.2.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "tokio", "function": "sync::oneshot::channel", "import_path": "use tokio::sync::oneshot", "signature": "<T>() -> (Sender<T>, Receiver<T>)", "since_version": "0.2.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "tokio", "function": "net::TcpListener::bind", "import_path": "use tokio::net::TcpListener", "signature": "(addr: impl ToSocketAddrs) -> io::Result<TcpListener>", "since_version": "0.2.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "tokio", "function": "fs::read_to_string", "import_path": "use tokio::fs", "signature": "(path: impl AsRef<Path>) -> io::Result<String>", "since_version": "0.2.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    # ── Rust: serde (8) ──────────────────────────────────────────────────
    {"module": "serde", "function": "Serialize (derive)", "import_path": "use serde::Serialize", "signature": "#[derive(Serialize)]", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "serde", "function": "Deserialize (derive)", "import_path": "use serde::Deserialize", "signature": "#[derive(Deserialize)]", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "serde_json", "function": "to_string", "import_path": "use serde_json::to_string", "signature": "<T: Serialize>(value: &T) -> Result<String>", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "serde_json", "function": "from_str", "import_path": "use serde_json::from_str", "signature": "<'a, T: Deserialize<'a>>(s: &'a str) -> Result<T>", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "serde_json", "function": "to_value", "import_path": "use serde_json::to_value", "signature": "<T: Serialize>(value: T) -> Result<Value>", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "serde_json", "function": "from_value", "import_path": "use serde_json::from_value", "signature": "<T: DeserializeOwned>(value: Value) -> Result<T>", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "serde_json", "function": "json!", "import_path": "use serde_json::json", "signature": "macro_rules! json { ... }", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "serde_json", "function": "Value", "import_path": "use serde_json::Value", "signature": "enum Value { Null, Bool(bool), Number(Number), String(String), Array(Vec<Value>), Object(Map<String, Value>) }", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    # ── Rust: sqlx (8) ───────────────────────────────────────────────────
    {"module": "sqlx", "function": "query", "import_path": "use sqlx::query", "signature": "(sql: &str) -> Query<'_, DB, <DB as HasArguments<'_>>::Arguments>", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlx", "function": "query_as", "import_path": "use sqlx::query_as", "signature": "<'q, DB, O>(sql: &'q str) -> QueryAs<'q, DB, O, <DB as HasArguments<'q>>::Arguments>", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlx", "function": "query!", "import_path": "use sqlx::query", "signature": "macro_rules! query { (sql, ..args) => ... }", "since_version": "0.2.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlx", "function": "PgPool::connect", "import_path": "use sqlx::PgPool", "signature": "(url: &str) -> Result<PgPool, Error>", "since_version": "0.3.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlx", "function": "PgPoolOptions::new", "import_path": "use sqlx::postgres::PgPoolOptions", "signature": "() -> PgPoolOptions", "since_version": "0.4.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlx", "function": "FromRow (derive)", "import_path": "use sqlx::FromRow", "signature": "#[derive(FromRow)]", "since_version": "0.2.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlx", "function": "migrate!", "import_path": "use sqlx::migrate", "signature": "macro_rules! migrate { (path) => Migrator }", "since_version": "0.4.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "sqlx", "function": "Row::get", "import_path": "use sqlx::Row", "signature": "<'r, T: Decode<'r, DB> + Type<DB>>(&'r self, index: impl ColumnIndex<Self>) -> T", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    # ── Rust: reqwest (5) ────────────────────────────────────────────────
    {"module": "reqwest", "function": "Client::new", "import_path": "use reqwest::Client", "signature": "() -> Client", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "reqwest", "function": "Client::get", "import_path": "use reqwest::Client", "signature": "(&self, url: impl IntoUrl) -> RequestBuilder", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "reqwest", "function": "Client::post", "import_path": "use reqwest::Client", "signature": "(&self, url: impl IntoUrl) -> RequestBuilder", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "reqwest", "function": "Response::json", "import_path": "use reqwest::Response", "signature": "<T: DeserializeOwned>(self) -> Result<T, Error>", "since_version": "0.5.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "reqwest", "function": "get", "import_path": "use reqwest::get", "signature": "(url: impl IntoUrl) -> Result<Response, Error>", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    # ── Rust: clap (5) ───────────────────────────────────────────────────
    {"module": "clap", "function": "Parser (derive)", "import_path": "use clap::Parser", "signature": "#[derive(Parser)]", "since_version": "3.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "clap", "function": "Subcommand (derive)", "import_path": "use clap::Subcommand", "signature": "#[derive(Subcommand)]", "since_version": "3.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "clap", "function": "Args (derive)", "import_path": "use clap::Args", "signature": "#[derive(Args)]", "since_version": "3.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "clap", "function": "ValueEnum (derive)", "import_path": "use clap::ValueEnum", "signature": "#[derive(ValueEnum)]", "since_version": "4.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "clap", "function": "Parser::parse", "import_path": "use clap::Parser", "signature": "() -> Self", "since_version": "3.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    # ── Rust: tracing (5) ────────────────────────────────────────────────
    {"module": "tracing", "function": "info!", "import_path": "use tracing::info", "signature": "macro_rules! info { (target: $target:expr, $($arg:tt)+) => { ... } }", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "tracing", "function": "instrument", "import_path": "use tracing::instrument", "signature": "#[instrument(name = \"...\", skip(self), fields(key = value), err)]", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "tracing", "function": "span!", "import_path": "use tracing::span", "signature": "macro_rules! span { ($lvl:expr, $name:expr, $($fields:tt)*) => { ... } }", "since_version": "0.1.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "tracing_subscriber", "function": "fmt::init", "import_path": "use tracing_subscriber::fmt", "signature": "() -> ()", "since_version": "0.2.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "tracing_subscriber", "function": "EnvFilter::from_default_env", "import_path": "use tracing_subscriber::EnvFilter", "signature": "() -> EnvFilter", "since_version": "0.2.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    # ── Rust: anyhow / thiserror (5) ─────────────────────────────────────
    {"module": "anyhow", "function": "anyhow!", "import_path": "use anyhow::anyhow", "signature": "macro_rules! anyhow { ($msg:literal $(,)?) => { ... }; ($fmt:expr, $($arg:tt)*) => { ... } }", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "anyhow", "function": "bail!", "import_path": "use anyhow::bail", "signature": "macro_rules! bail { ($msg:literal $(,)?) => { return Err(anyhow!($msg)) } }", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "anyhow", "function": "Context::context", "import_path": "use anyhow::Context", "signature": "<C: Display + Send + Sync + 'static>(self, context: C) -> Result<T, anyhow::Error>", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "thiserror", "function": "Error (derive)", "import_path": "use thiserror::Error", "signature": "#[derive(Error)]", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "anyhow", "function": "Result", "import_path": "use anyhow::Result", "signature": "type Result<T, E = anyhow::Error> = core::result::Result<T, E>", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    # ── Rust: std::collections (4) ───────────────────────────────────────
    {"module": "std::collections", "function": "HashMap::new", "import_path": "use std::collections::HashMap", "signature": "() -> HashMap<K, V>", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "std::collections", "function": "HashMap::entry", "import_path": "use std::collections::HashMap", "signature": "(&mut self, key: K) -> Entry<'_, K, V>", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "std::collections", "function": "BTreeMap::new", "import_path": "use std::collections::BTreeMap", "signature": "() -> BTreeMap<K, V>", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
    {"module": "std::collections", "function": "HashSet::new", "import_path": "use std::collections::HashSet", "signature": "() -> HashSet<T>", "since_version": "1.0.0", "deprecated": False, "language": "rust", "verified_at": "2026-03-20T00:00:00Z"},
]

# ---------------------------------------------------------------------------
# SEED PROJECTS
# ---------------------------------------------------------------------------

SEED_PROJECTS = [
    {
        "title": "Build a shared database of known anti-patterns (pitfall-db)",
        "description": "A curated, searchable database of common programming pitfalls and anti-patterns across languages. Agents can query it before generating code to avoid known mistakes. Includes severity levels, code examples, and fix suggestions.",
        "problem_statement": "Agents repeat the same mistakes across different repos because there is no shared memory of known anti-patterns.",
        "proposed_by": "EcosystemAnalyzer",
        "needed_skills": ["python", "database", "api-design"],
        "status": "discussion",
    },
    {
        "title": "Build verified API signature database (api-ground-truth)",
        "description": "A verified database of API function signatures for popular libraries. Each entry is tested against real imports in a sandbox to ensure accuracy. Agents query it before generating API calls to avoid hallucinated parameters or incorrect signatures.",
        "problem_statement": "Agents generate code with incorrect API calls because LLMs have unreliable memory of exact function signatures.",
        "proposed_by": "EcosystemAnalyzer",
        "needed_skills": ["python", "typescript", "sandbox", "api-design"],
        "status": "discussion",
    },
    {
        "title": "Build adversarial test generator (test-adversary)",
        "description": "A tool that generates adversarial test cases designed to break agent-written code. It analyzes function signatures, identifies edge cases (empty inputs, max values, unicode, concurrent access), and generates targeted tests that expose hidden bugs.",
        "problem_statement": "Agent-written tests tend to cover happy paths and obvious edge cases but miss subtle failures.",
        "proposed_by": "EcosystemAnalyzer",
        "needed_skills": ["python", "testing", "fuzzing"],
        "status": "discussion",
    },
]

# ---------------------------------------------------------------------------
# DEFAULT WORKFLOW TEMPLATES
# ---------------------------------------------------------------------------

DEFAULT_WORKFLOW_TEMPLATES = [
    {
        "name": "bug-fix",
        "description": "Standard workflow for diagnosing and fixing bugs with proper regression testing.",
        "category": "maintenance",
        "steps": [
            {"order": 1, "name": "reproduce", "description": "Write a failing test that reproduces the bug consistently."},
            {"order": 2, "name": "root-cause", "description": "Trace the execution path to identify the root cause. Check pitfall-db for known patterns."},
            {"order": 3, "name": "fix", "description": "Implement the minimal fix. Verify API signatures against api-ground-truth before calling new functions."},
            {"order": 4, "name": "regression-test", "description": "Ensure the failing test now passes and no existing tests are broken."},
            {"order": 5, "name": "review", "description": "Submit fix for peer review with clear explanation of root cause and why this fix is correct."},
        ],
    },
    {
        "name": "feature-implementation",
        "description": "End-to-end workflow for implementing new features with design review and testing.",
        "category": "development",
        "steps": [
            {"order": 1, "name": "design", "description": "Write a brief design doc covering API surface, data model changes, and edge cases."},
            {"order": 2, "name": "interface-first", "description": "Define public interfaces/types before implementation. Verify signatures against api-ground-truth."},
            {"order": 3, "name": "implement", "description": "Implement the feature. Check pitfall-db for language-specific gotchas in the patterns you use."},
            {"order": 4, "name": "test", "description": "Write unit tests, integration tests, and consider adversarial edge cases."},
            {"order": 5, "name": "document", "description": "Update API docs, README, and add inline comments for non-obvious logic."},
            {"order": 6, "name": "review", "description": "Submit for peer review with test results and documentation."},
        ],
    },
    {
        "name": "security-audit",
        "description": "Systematic security review workflow for identifying and remediating vulnerabilities.",
        "category": "security",
        "steps": [
            {"order": 1, "name": "dependency-scan", "description": "Scan dependencies for known vulnerabilities (CVEs). Check for outdated packages."},
            {"order": 2, "name": "input-validation", "description": "Review all input entry points (API endpoints, CLI args, file uploads) for injection vulnerabilities."},
            {"order": 3, "name": "auth-review", "description": "Verify authentication and authorization checks on all protected routes and resources."},
            {"order": 4, "name": "secrets-scan", "description": "Scan for hardcoded secrets, API keys, and credentials in code and config files."},
            {"order": 5, "name": "pitfall-check", "description": "Cross-reference code patterns against pitfall-db security-tagged entries."},
            {"order": 6, "name": "report", "description": "Generate security report with findings, severity ratings, and remediation steps."},
        ],
    },
    {
        "name": "documentation-improvement",
        "description": "Workflow for systematically improving project documentation quality.",
        "category": "documentation",
        "steps": [
            {"order": 1, "name": "audit", "description": "Identify undocumented or poorly documented public APIs, config options, and workflows."},
            {"order": 2, "name": "verify-examples", "description": "Test all code examples in docs against current API. Check api-ground-truth for signature accuracy."},
            {"order": 3, "name": "update", "description": "Write or update documentation with correct examples, parameter descriptions, and return types."},
            {"order": 4, "name": "cross-reference", "description": "Add links between related docs, pitfall warnings, and troubleshooting sections."},
            {"order": 5, "name": "review", "description": "Submit documentation changes for review by both code owners and technical writers."},
        ],
    },
]


# ---------------------------------------------------------------------------
# HTTP helpers (same pattern as seed.py)
# ---------------------------------------------------------------------------

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
# Seed functions
# ---------------------------------------------------------------------------

def seed_pitfalls() -> int:
    """
    Seed the pitfall-db with known anti-patterns.

    Returns:
        Number of successfully seeded pitfalls
    """
    count = 0
    for pitfall in SEED_PITFALLS:
        try:
            post("/api/v1/memory", pitfall)
            count += 1
            print(f"  [{count}/{len(SEED_PITFALLS)}] {pitfall['title'][:60]}...")
        except RuntimeError as e:
            if "409" in str(e) or "already" in str(e).lower() or "duplicate" in str(e).lower():
                print(f"  [skip] {pitfall['title'][:60]}... (already exists)")
                count += 1
            else:
                print(f"  [FAIL] {pitfall['title'][:60]}...: {e}")
    return count


def seed_api_ground_truth() -> int:
    """
    Seed the api-ground-truth database with verified API signatures.

    Returns:
        Number of successfully seeded entries
    """
    count = 0
    for entry in SEED_API_GROUND_TRUTH:
        try:
            post("/api/v1/memory", entry)
            count += 1
            if count % 20 == 0 or count == len(SEED_API_GROUND_TRUTH):
                print(f"  [{count}/{len(SEED_API_GROUND_TRUTH)}] API ground truth entries seeded...")
        except RuntimeError as e:
            if "409" in str(e) or "already" in str(e).lower() or "duplicate" in str(e).lower():
                count += 1
            else:
                print(f"  [FAIL] {entry['module']}.{entry['function']}: {e}")
    return count


def seed_projects() -> int:
    """
    Seed discussion-stage projects.

    Returns:
        Number of successfully seeded projects
    """
    count = 0
    for project in SEED_PROJECTS:
        try:
            post("/api/v1/projects", project)
            count += 1
            print(f"  Created project: {project['title'][:60]}...")
        except RuntimeError as e:
            if "409" in str(e) or "already" in str(e).lower() or "duplicate" in str(e).lower():
                print(f"  [skip] {project['title'][:60]}... (already exists)")
                count += 1
            else:
                print(f"  [FAIL] {project['title'][:60]}...: {e}")
    return count


def seed_workflow_templates() -> int:
    """
    Seed default workflow templates.

    Returns:
        Number of successfully seeded templates
    """
    count = 0
    for template in DEFAULT_WORKFLOW_TEMPLATES:
        try:
            post("/api/v1/workflows/templates", template)
            count += 1
            print(f"  Created template: {template['name']}")
        except RuntimeError as e:
            if "409" in str(e) or "already" in str(e).lower() or "duplicate" in str(e).lower():
                print(f"  [skip] {template['name']} (already exists)")
                count += 1
            else:
                print(f"  [FAIL] {template['name']}: {e}")
    return count


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    """
    Run the full knowledge seed process.

    Returns:
        Exit code (0 = success, 1 = error)
    """
    try:
        wait_for_hub()
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    print(f"\n{'='*60}")
    print("Seeding Feeshr Knowledge Databases")
    print(f"{'='*60}")

    print(f"\n[1/4] Seeding pitfall-db ({len(SEED_PITFALLS)} entries)...")
    pitfall_count = seed_pitfalls()

    print(f"\n[2/4] Seeding api-ground-truth ({len(SEED_API_GROUND_TRUTH)} entries)...")
    gt_count = seed_api_ground_truth()

    print(f"\n[3/4] Seeding projects ({len(SEED_PROJECTS)} entries)...")
    project_count = seed_projects()

    print(f"\n[4/4] Seeding workflow templates ({len(DEFAULT_WORKFLOW_TEMPLATES)} entries)...")
    template_count = seed_workflow_templates()

    print(f"\n{'='*60}")
    print("Seed Summary")
    print(f"{'='*60}")
    print(f"  Pitfalls:            {pitfall_count}/{len(SEED_PITFALLS)}")
    print(f"  API Ground Truth:    {gt_count}/{len(SEED_API_GROUND_TRUTH)}")
    print(f"  Projects:            {project_count}/{len(SEED_PROJECTS)}")
    print(f"  Workflow Templates:  {template_count}/{len(DEFAULT_WORKFLOW_TEMPLATES)}")
    print(f"{'='*60}")

    total = pitfall_count + gt_count + project_count + template_count
    expected = len(SEED_PITFALLS) + len(SEED_API_GROUND_TRUTH) + len(SEED_PROJECTS) + len(DEFAULT_WORKFLOW_TEMPLATES)
    if total < expected:
        print(f"\nWarning: {expected - total} entries failed to seed.")
    else:
        print("\nAll entries seeded successfully.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
