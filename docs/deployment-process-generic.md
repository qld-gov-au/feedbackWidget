# 3.2 Deployment process

This section describes a generic CI/CD deployment approach for a new project using GitHub Actions.

## Purpose

The deployment pipeline should:
- Build the application for the correct environment
- Run automated checks before release
- Publish only deployable artifacts
- Keep environment releases isolated and traceable

## Recommended branch model

- Feature branch: developer integration and quick validation
- Development branch: shared integration target
- UAT branch: pre-production verification
- Main branch: production promotion

Optional release branches for published artifacts:
- release-dev
- release-uat
- release-production

## Trigger strategy

Use branch-based triggers and path filters to reduce unnecessary runs.

- Push trigger:
  - Use for fast feedback on feature or integration branches
- Pull request trigger:
  - Use for controlled promotion into development, UAT, and production target branches
- Path filters:
  - Limit workflow runs to source code, tests, build scripts, and workflow files

## Deployment flow

1. Checkout source
- Pull full git history if release branch publishing is required.

2. Resolve target environment
- Map the branch context to:
  - Build mode (for example: dev or prod)
  - Release target (for example: release-dev, release-uat, release-production)

3. Set up runtime and dependencies
- Install required runtime versions (Node, Python, Java, and so on).
- Restore dependency cache.
- Install project dependencies.

4. Inject configuration and secrets
- Write environment-specific values from CI secrets.
- Never store real secrets in source control.

5. Build
- Run environment-specific build command.
- Generate immutable deployment artifacts.

6. Validate quality gates
- Run smoke tests at minimum.
- Optionally run lint, unit, integration, and security scans.
- Stop pipeline immediately on failures.

7. Publish artifacts
- Push only build output to the release target.
- Skip commit/publish when output is unchanged.

8. Record traceability
- Include source branch and commit SHA in release commit message or metadata.

## Failure and rollback guidance

Failure handling:
- If build or tests fail, do not publish artifacts.
- Surface clear logs and failure reason in CI output.

Rollback options:
- Redeploy previous successful artifact
- Repoint deployment to previous release commit
- Revert merge and rerun pipeline

## Generic GitHub Actions example

The example below is intentionally generic and should be adapted for your stack.

    name: Build and distribute

    on:
      push:
        branches:
          - feature-test
        paths:
          - src/**
          - tests/**
          - package.json
          - package-lock.json
          - .github/workflows/build.yml
      pull_request:
        branches:
          - development
          - uat
          - main
        paths:
          - src/**
          - tests/**
          - .github/workflows/build.yml

    jobs:
      build:
        runs-on: ubuntu-latest
        permissions:
          contents: write

        steps:
          - name: Checkout
            uses: actions/checkout@v4
            with:
              fetch-depth: 0

          - name: Setup runtime
            uses: actions/setup-node@v4
            with:
              node-version: "24"
              cache: npm

          - name: Resolve environment
            id: config
            run: |
              REF="${{ github.base_ref || github.ref_name }}"
              case "$REF" in
                main)
                  echo "build_env=prod" >> "$GITHUB_OUTPUT"
                  echo "release_branch=release-production" >> "$GITHUB_OUTPUT"
                  ;;
                uat)
                  echo "build_env=dev" >> "$GITHUB_OUTPUT"
                  echo "release_branch=release-uat" >> "$GITHUB_OUTPUT"
                  ;;
                *)
                  echo "build_env=dev" >> "$GITHUB_OUTPUT"
                  echo "release_branch=release-dev" >> "$GITHUB_OUTPUT"
                  ;;
              esac

          - name: Install dependencies
            run: npm install

          - name: Create env file from secrets
            run: |
              echo "APP_ENV=${{ steps.config.outputs.build_env }}" > .env
              echo "API_KEY=${{ secrets.API_KEY }}" >> .env

          - name: Build
            run: npm run build:${{ steps.config.outputs.build_env }}

          - name: Run tests
            run: npm test

          - name: Publish artifacts
            run: |
              git config user.name "github-actions[bot]"
              git config user.email "github-actions[bot]@users.noreply.github.com"

              RELEASE_BRANCH="${{ steps.config.outputs.release_branch }}"

              if git ls-remote --exit-code --heads origin "$RELEASE_BRANCH" > /dev/null 2>&1; then
                git fetch origin "$RELEASE_BRANCH"
                git worktree add /tmp/release "$RELEASE_BRANCH"
              else
                git worktree add --orphan -b "$RELEASE_BRANCH" /tmp/release
              fi

              rm -rf /tmp/release/*
              cp -r dist/. /tmp/release/

              cd /tmp/release
              git add --all

              if git diff --cached --quiet; then
                echo "No artifact changes. Skipping publish."
                exit 0
              fi

              git commit -m "release(${GITHUB_REF_NAME}): ${GITHUB_SHA}"
              git push origin "$RELEASE_BRANCH"

## Adaptation checklist for a new project

- Replace branch names with your delivery model.
- Replace runtime setup action for your stack.
- Replace build and test commands.
- Replace artifact folder path.
- Replace required secrets.
- Confirm least-privilege permissions.
- Add approval gates for UAT and production if needed.
