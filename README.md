<p align="center">
  <a href="https://www.twenty.com">
    <img src="./packages/twenty-website/public/images/core/logo.svg" width="100px" alt="Twenty logo" />
  </a>
</p>

<h2 align="center" >The #1 Open-Source CRM </h2>

<p align="center"><a href="https://twenty.com">🌐 Website</a> · <a href="https://docs.twenty.com">📚 Documentation</a> · <a href="https://github.com/orgs/twentyhq/projects/1"><img src="./packages/twenty-website/public/images/readme/planner-icon.svg" width="12" height="12"/> Roadmap </a> · <a href="https://discord.gg/cx5n4Jzs57"><img src="./packages/twenty-website/public/images/readme/discord-icon.svg" width="12" height="12"/> Discord</a> · <a href="https://www.figma.com/file/xt8O9mFeLl46C5InWwoMrN/Twenty"><img src="./packages/twenty-website/public/images/readme/figma-icon.png"  width="12" height="12"/>  Figma</a></p>
<br />


<p align="center">
  <a href="https://www.twenty.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/github-cover-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/github-cover-light.png" />
      <img src="./packages/twenty-website/public/images/readme/github-cover-light.png" alt="Cover" />
    </picture>
  </a>
</p>

<br />

# SleepNest CRM (Multi-tenant Fork)

This is a multi-tenant fork of Twenty CRM with Supabase authentication support. The Docker image is published to DigitalOcean Container Registry as `sleepnest-crm`.

## Quick Links

- 📋 [Multi-tenancy Plan](./MULTITENANCY_PLAN.md) - Full implementation details
- 🚀 [Self-hosting](https://docs.twenty.com/developers/self-hosting/docker-compose)
- 🖥️ [Local Setup](https://docs.twenty.com/developers/local-setup)

---

# Deployment to DigitalOcean Container Registry

## Prerequisites

1. **Install Docker** - [Get Docker](https://docs.docker.com/get-docker/)
2. **Install doctl CLI** - [Install doctl](https://docs.digitalocean.com/reference/doctl/how-to/install/)
3. **Create a DigitalOcean Container Registry** - [Create Registry](https://cloud.digitalocean.com/registry)
4. **Generate a DigitalOcean API Token** - [API Tokens](https://cloud.digitalocean.com/account/api/tokens)

## Setup (One-time)

1. Copy the example environment file:
   ```bash
   cp .env.deploy.example .env.deploy
   ```

2. Edit `.env.deploy` with your values:
   ```env
   DIGITALOCEAN_ACCESS_TOKEN=dop_v1_your_token_here
   DIGITALOCEAN_REGISTRY=registry.digitalocean.com/your-registry-name
   DOCKER_IMAGE_NAME=sleepnest-crm
   DOCKER_IMAGE_TAG=latest
   ```

> ⚠️ **Important**: Never commit `.env.deploy` to source control. It's already in `.gitignore`.

## Deploy

### Windows (PowerShell)
```powershell
.\scripts\deploy-to-digitalocean.ps1

# With a specific version tag:
.\scripts\deploy-to-digitalocean.ps1 -Tag "v1.0.0"
```

### Linux/Mac (Bash)
```bash
chmod +x scripts/deploy-to-digitalocean.sh
./scripts/deploy-to-digitalocean.sh

# With a specific version tag:
./scripts/deploy-to-digitalocean.sh v1.0.0
```

## Customer Usage

After deployment, customers can pull and run the image:

```bash
# Pull the image
docker pull registry.digitalocean.com/your-registry/sleepnest-crm:latest

# Run with docker-compose (see packages/twenty-docker/docker-compose.yml)
```

---

# Local Development

# Does the world need another CRM?

We built Twenty for three reasons:

**CRMs are too expensive, and users are trapped.** Companies use locked-in customer data to hike prices. It shouldn't be that way.

**A fresh start is required to build a better experience.** We can learn from past mistakes and craft a cohesive experience inspired by new UX patterns from tools like Notion, Airtable or Linear.

**We believe in Open-source and community.** Hundreds of developers are already building Twenty together. Once we have plugin capabilities, a whole ecosystem will grow around it.

<br />

# What You Can Do With Twenty

Please feel free to flag any specific needs you have by creating an issue.

Below are a few features we have implemented to date:

+ [Personalize layouts with filters, sort, group by, kanban and table views](#personalize-layouts-with-filters-sort-group-by-kanban-and-table-views)
+ [Customize your objects and fields](#customize-your-objects-and-fields)
+ [Create and manage permissions with custom roles](#create-and-manage-permissions-with-custom-roles)
+ [Automate workflow with triggers and actions](#automate-workflow-with-triggers-and-actions)
+ [Emails, calendar events, files, and more](#emails-calendar-events-files-and-more)


## Personalize layouts with filters, sort, group by, kanban and table views

<p align="center">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/views-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/views-light.png" />
      <img src="./packages/twenty-website/public/images/readme/views-light.png" alt="Companies Kanban Views" />
    </picture>
</p>

## Customize your objects and fields

<p align="center">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/data-model-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/data-model-light.png" />
      <img src="./packages/twenty-website/public/images/readme/data-model-light.png" alt="Setting Custom Objects" />
    </picture>
</p>

## Create and manage permissions with custom roles

<p align="center">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/permissions-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/permissions-light.png" />
      <img src="./packages/twenty-website/public/images/readme/permissions-light.png" alt="Permissions" />
    </picture>
</p>

## Automate workflow with triggers and actions

<p align="center">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/workflows-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/workflows-light.png" />
      <img src="./packages/twenty-website/public/images/readme/workflows-light.png" alt="Workflows" />
    </picture>
</p>

## Emails, calendar events, files, and more

<p align="center">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/plus-other-features-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/plus-other-features-light.png" />
      <img src="./packages/twenty-website/public/images/readme/plus-other-features-light.png" alt="Other Features" />
    </picture>
</p>

<br />

# Stack
- [TypeScript](https://www.typescriptlang.org/)
- [Nx](https://nx.dev/)
- [NestJS](https://nestjs.com/), with [BullMQ](https://bullmq.io/), [PostgreSQL](https://www.postgresql.org/), [Redis](https://redis.io/)
- [React](https://reactjs.org/), with [Recoil](https://recoiljs.org/), [Emotion](https://emotion.sh/) and [Lingui](https://lingui.dev/)



# Thanks

<p align="center">
  <a href="https://www.chromatic.com/"><img src="./packages/twenty-website/public/images/readme/chromatic.png" height="30" alt="Chromatic" /></a>
  <a href="https://greptile.com"><img src="./packages/twenty-website/public/images/readme/greptile.png" height="30" alt="Greptile" /></a>
  <a href="https://sentry.io/"><img src="./packages/twenty-website/public/images/readme/sentry.png" height="30" alt="Sentry" /></a>
  <a href="https://crowdin.com/"><img src="./packages/twenty-website/public/images/readme/crowdin.png" height="30" alt="Crowdin" /></a>
</p>

  Thanks to these amazing services that we use and recommend for UI testing (Chromatic), code review (Greptile), catching bugs (Sentry) and translating (Crowdin).


# Join the Community

- Star the repo
- Subscribe to releases (watch -> custom -> releases)
- Follow us on [Twitter](https://twitter.com/twentycrm) or [LinkedIn](https://www.linkedin.com/company/twenty/)
- Join our [Discord](https://discord.gg/cx5n4Jzs57)
- Improve translations on [Crowdin](https://twenty.crowdin.com/twenty)
- [Contributions](https://github.com/twentyhq/twenty/contribute) are, of course, most welcome!
