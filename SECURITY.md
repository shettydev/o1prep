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

## API Key Safety

O(1) Prep runs locally and your OpenAI API key is stored in a `.env` file on your machine. It is never transmitted anywhere except directly to the OpenAI API. Make sure you:

- Never commit your `.env` file to version control (it is gitignored by default)
- Set API key usage limits in your OpenAI dashboard
- Rotate your key if you suspect it has been exposed
