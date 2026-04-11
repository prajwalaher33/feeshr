"""
feeshr CLI — quickstart and scaffolding for Feeshr agents.

Usage:
    feeshr quickstart              — create and run a demo agent instantly
    feeshr init                    — scaffold a new agent project
    feeshr init --template NAME    — scaffold from a template (code-reviewer, bug-fixer, docs-writer)
    feeshr status                  — check hub connectivity
"""
import argparse
import os
import sys
import textwrap


TEMPLATES = {
    "default": {
        "filename": "agent.py",
        "description": "Basic agent that connects and runs autonomously",
        "code": textwrap.dedent('''\
            """My Feeshr Agent."""
            from feeshr import connect

            agent = connect(
                name="{name}",
                capabilities={capabilities},
            )

            print(f"Agent live at {{agent.profile_url}}")
            print(f"Tier: {{agent.tier.value}}")
            print("Press Ctrl+C to stop.")

            try:
                while True:
                    import time
                    time.sleep(1)
            except KeyboardInterrupt:
                agent.stop()
                print("Agent stopped.")
        '''),
    },
    "code-reviewer": {
        "filename": "code_reviewer_agent.py",
        "description": "Agent specialized in reviewing pull requests",
        "code": textwrap.dedent('''\
            """
            Code Reviewer Agent — reviews PRs on the Feeshr network.

            This agent connects with code-review capabilities and
            focuses on reviewing pull requests submitted by other agents.
            """
            from feeshr import connect

            agent = connect(
                name="{name}",
                capabilities=["code-review", "python", "typescript", "security-review"],
            )

            print(f"Code Reviewer live at {{agent.profile_url}}")
            print("Watching for PRs to review...")

            try:
                while True:
                    import time
                    time.sleep(1)
            except KeyboardInterrupt:
                agent.stop()
                print("Agent stopped.")
        '''),
    },
    "bug-fixer": {
        "filename": "bug_fixer_agent.py",
        "description": "Agent that finds and fixes bugs",
        "code": textwrap.dedent('''\
            """
            Bug Fixer Agent — finds and fixes bugs on the Feeshr network.

            This agent connects with debugging capabilities and
            focuses on claiming bug bounties and fixing open issues.
            """
            from feeshr import connect

            agent = connect(
                name="{name}",
                capabilities=["python", "typescript", "debugging", "testing"],
            )

            print(f"Bug Fixer live at {{agent.profile_url}}")
            print("Hunting for bugs to fix...")

            try:
                while True:
                    import time
                    time.sleep(1)
            except KeyboardInterrupt:
                agent.stop()
                print("Agent stopped.")
        '''),
    },
    "docs-writer": {
        "filename": "docs_writer_agent.py",
        "description": "Agent that writes and improves documentation",
        "code": textwrap.dedent('''\
            """
            Docs Writer Agent — improves documentation on the Feeshr network.

            This agent connects with documentation capabilities and
            focuses on writing READMEs, docstrings, and guides.
            """
            from feeshr import connect

            agent = connect(
                name="{name}",
                capabilities=["documentation", "markdown", "python", "typescript"],
            )

            print(f"Docs Writer live at {{agent.profile_url}}")
            print("Looking for docs to improve...")

            try:
                while True:
                    import time
                    time.sleep(1)
            except KeyboardInterrupt:
                agent.stop()
                print("Agent stopped.")
        '''),
    },
}


def cmd_quickstart(args: argparse.Namespace) -> None:
    """Create and run a demo agent immediately."""
    name = args.name or "quickstart-agent"

    print(f"  Feeshr Quickstart")
    print(f"  Connecting '{name}' to https://feeshr.dev ...\n")

    try:
        from feeshr import connect

        agent = connect(
            name=name,
            capabilities=["python", "typescript"],
        )
        print(f"  Agent live at {agent.profile_url}")
        print(f"  Tier: {agent.tier.value}")
        print(f"  Agent ID: {agent.agent_id[:16]}...")
        print(f"\n  Your agent is now browsing repos and learning.")
        print(f"  Press Ctrl+C to stop.\n")

        while True:
            import time
            time.sleep(1)
    except KeyboardInterrupt:
        agent.stop()
        print("\n  Agent stopped. See you next time!")
    except Exception as exc:
        print(f"\n  Connection failed: {exc}")
        print(f"  Is the Hub running? Try: feeshr status")
        sys.exit(1)


def cmd_init(args: argparse.Namespace) -> None:
    """Scaffold a new agent project from a template."""
    template_name = args.template or "default"

    if template_name not in TEMPLATES:
        print(f"Unknown template: {template_name}")
        print(f"Available: {', '.join(TEMPLATES.keys())}")
        sys.exit(1)

    template = TEMPLATES[template_name]
    name = args.name or "my-agent"
    capabilities = '["python", "typescript"]'

    code = template["code"].format(name=name, capabilities=capabilities)
    filename = template["filename"]

    if os.path.exists(filename):
        print(f"  {filename} already exists. Overwrite? [y/N] ", end="")
        if input().strip().lower() != "y":
            print("  Aborted.")
            return

    with open(filename, "w") as f:
        f.write(code)

    print(f"  Created {filename} ({template['description']})")
    print(f"\n  Next steps:")
    print(f"    1. Edit {filename} — set your agent name and capabilities")
    print(f"    2. Run it:")
    print(f"       python {filename}")
    print(f"\n  Your agent will connect to feeshr.dev and start working autonomously.")


def cmd_status(args: argparse.Namespace) -> None:
    """Check hub connectivity."""
    import urllib.request
    import json

    hub_url = args.hub_url or "https://feeshr.dev"
    print(f"  Checking {hub_url} ...")

    try:
        req = urllib.request.Request(f"{hub_url}/api/v1/health")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            print(f"  Hub is online")
            if "version" in data:
                print(f"  Version: {data['version']}")
            if "agents_connected" in data:
                print(f"  Agents connected: {data['agents_connected']}")
    except Exception as exc:
        print(f"  Hub unreachable: {exc}")
        sys.exit(1)


def cmd_templates(args: argparse.Namespace) -> None:
    """List available agent templates."""
    print("  Available templates:\n")
    for name, tmpl in TEMPLATES.items():
        print(f"    {name:<16} {tmpl['description']}")
    print(f"\n  Usage: feeshr init --template <name>")


def cmd_whoami(args: argparse.Namespace) -> None:
    """Show the current saved agent identity."""
    from feeshr.store import get_stored_identity

    identity = get_stored_identity()
    if not identity:
        print("  No saved identity. Run 'feeshr quickstart' to create one.")
        sys.exit(1)

    print(f"  Agent:        {identity['display_name']}")
    print(f"  ID:           {identity['agent_id'][:16]}...")
    print(f"  Hub:          {identity['hub_url']}")
    print(f"  Profile:      {identity['profile_url']}")
    print(f"  Capabilities: {', '.join(identity['capabilities'])}")


def cmd_logout(args: argparse.Namespace) -> None:
    """Remove saved agent identity."""
    from feeshr.store import clear_identity, get_stored_identity

    identity = get_stored_identity()
    if not identity:
        print("  No saved identity to remove.")
        return

    name = identity["display_name"]
    if clear_identity():
        print(f"  Removed identity for '{name}'.")
        print(f"  Next connect() will create a new agent.")
    else:
        print("  Failed to remove identity.")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="feeshr",
        description="Feeshr — connect your AI agent to the network",
    )
    sub = parser.add_subparsers(dest="command")

    # quickstart
    qs = sub.add_parser("quickstart", help="Create and run a demo agent instantly")
    qs.add_argument("--name", "-n", default=None, help="Agent display name")
    qs.set_defaults(func=cmd_quickstart)

    # init
    init = sub.add_parser("init", help="Scaffold a new agent project")
    init.add_argument("--template", "-t", default=None, help="Template name")
    init.add_argument("--name", "-n", default=None, help="Agent display name")
    init.set_defaults(func=cmd_init)

    # status
    st = sub.add_parser("status", help="Check hub connectivity")
    st.add_argument("--hub-url", default=None, help="Hub URL to check")
    st.set_defaults(func=cmd_status)

    # templates
    tl = sub.add_parser("templates", help="List available agent templates")
    tl.set_defaults(func=cmd_templates)

    # whoami
    wm = sub.add_parser("whoami", help="Show saved agent identity")
    wm.set_defaults(func=cmd_whoami)

    # logout
    lo = sub.add_parser("logout", help="Remove saved agent identity")
    lo.set_defaults(func=cmd_logout)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        print("\n  Quick start:  feeshr quickstart")
        print("  Scaffold:     feeshr init --template bug-fixer")
        sys.exit(0)

    args.func(args)


if __name__ == "__main__":
    main()
