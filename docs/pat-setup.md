# Personal Access Token (PAT) Setup

This guide walks through creating a GitHub Personal Access Token (classic) and authorizing it for your organization's SSO-protected resources.

## Required Scopes

The dashboards need the following token scopes depending on the data you collect:

| Scope | When needed |
|---|---|
| `copilot` | Always — required for Copilot metrics |
| `read:org` | Organization-level queries |
| `read:enterprise` | Enterprise-level queries |

## Step 1 — Create the Token

1. Click your **profile photo** → **Settings**.
2. In the left sidebar, click **Developer settings**.
3. Click **Personal access tokens** → **Tokens (classic)**.
4. Click **Generate new token** → **Generate new token (classic)**.
5. Give the token a descriptive name (e.g., `BVE dashboard queries`).
6. Set an expiration that fits your security policy.
7. Select the scopes listed above (`copilot`, `read:org`, and optionally `read:enterprise`).
8. Click **Generate token** and copy it immediately — you won't see it again.

## Step 2 — Authorize the Token for Your Organization (SSO)

If your organization enforces SAML single sign-on (SSO), the token must be explicitly authorized for that org before it can access org resources.

1. Go to **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**.
2. Find your token in the list and click its name.
3. Next to **Configure SSO**, click **Authorize** next to the organization you need access to.
4. Complete any SSO prompts your identity provider requires.

After authorization, the button changes to **Revoke** and the token can access that organization's data.

> **Tip:** If you belong to multiple organizations, authorize the token for each org you intend to query.

![PAT SSO authorization screenshot](https://github.com/user-attachments/assets/7b4a9a26-6d40-445c-8f1c-916f1d0399ec)

## Step 3 — Use the Token

### With environment variable

```bash
export GITHUB_TOKEN="ghp_your_token_here"
./run-query.sh ai-assisted-efficiency
```

### With `gh` CLI

```bash
gh auth login --with-token <<< "ghp_your_token_here"
./run-query.sh ai-assisted-efficiency
```

### As a repository secret (CI)

1. Go to your repository **Settings** → **Secrets and variables** → **Actions**.
2. Create a secret named `DASHBOARD_GH_TOKEN` with the token value.
3. The nightly workflow uses this secret automatically.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `401 Unauthorized` | Token expired or missing | Regenerate and export again |
| `403 Forbidden` on org data | SSO not authorized | Authorize the token for the org (Step 2) |
| `404 Not Found` on enterprise endpoints | Missing `read:enterprise` scope | Edit the token and add the scope |
| Empty Copilot metrics | Missing `copilot` scope | Edit the token and add the scope |

## Further Reading

- [GitHub docs — Creating a personal access token (classic)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic)
- [GitHub docs — Authorizing a PAT for SAML SSO](https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on)
- [Data collection guide](data-collection.md)
- [Getting started](getting-started.md)
