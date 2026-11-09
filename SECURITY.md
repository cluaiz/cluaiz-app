# Security Policy

## Supported versions

The App is in development and has no release yet. Security fixes go to `main`.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** Report it privately:

1. Use GitHub's **Report a vulnerability** button on the
   [Security tab](https://github.com/cluaiz/cluaiz-app/security).
2. Say which commit you built and on which OS, and give the steps to reproduce it.
3. Describe the impact, for example a token leaking, an extension escaping its workspace, or an action running
   without approval.

We will confirm that we received it, work on a fix with you, and agree on when it is made public. Problems in the
Engine belong to the [Engine's security policy](https://github.com/cluaiz/cluaiz/blob/main/SECURITY.md), and
problems in a tool to [Cluaiz Tools](https://github.com/cluaiz/cluaiz-tools/blob/main/SECURITY.md).

## How the App protects you

- **The Engine decides.** The App is a client of the Engine. Permissions, approvals, the filesystem jail and the
  audit log are enforced by the Engine, so the App cannot do more than any other authenticated client.
- **Authenticated connection.** Every request carries the Engine's session token, over a per-request named pipe or
  Unix socket on the desktop, or over HTTP. The App reports the Engine as ready only after an authenticated health
  reply.
- **Approvals come from the Engine.** When the Engine asks for approval of a tool call, the App shows the request,
  and the call runs only after your answer.
- **Extensions are isolated and opt-in.** Local UI packages run in an isolated workspace, only after you review and
  approve their identity and permissions. They are unsigned: a hash detects changes to a package, but it does not
  prove who published it, so install packages only from people you trust.
