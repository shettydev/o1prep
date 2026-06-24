# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please do **not** open a public GitHub issue.

Instead, report it privately by emailing the maintainer via LinkedIn:
https://github.com/shettydev

Please include:

- A description of the vulnerability
- Steps to reproduce it
- Potential impact

You can expect a response within 7 days.

## Secrets & Data

O(1) Prep is a server application backed by PostgreSQL. Configuration lives in a
`.env` file (`DATABASE_URL`, `SECRET_KEY`, `OPENAI_API_KEY`). If you self-host:

- **Never commit `.env`** to version control (it is gitignored by default).
- Set a strong, random `SECRET_KEY` — it signs the login session cookies.
  Generate one with `python -c "import secrets; print(secrets.token_hex(32))"`.
- Use strong PostgreSQL credentials and don't expose the database publicly.
- The OpenAI API key is server-side and used only to call the OpenAI API. Set
  usage limits in your OpenAI dashboard and rotate it if exposed.

User passwords are stored only as salted hashes (`werkzeug.security`). Interview
sessions and history are scoped per account; never share your `SECRET_KEY` or
database, as that would expose all users' data.
