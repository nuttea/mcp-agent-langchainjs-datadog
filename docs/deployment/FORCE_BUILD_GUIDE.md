# Force Build Guide for GitHub Actions

This guide explains how to force the CI/CD pipeline to build all Docker images, even if no code changes were detected.

## Quick Reference

### Method 1: Commit Message Keywords (Easiest)

Add one of these keywords to your commit message:

```bash
# Any of these will trigger a full rebuild
git commit -m "Update dependencies [force build]"
git commit -m "Rebuild all containers [rebuild all]"
git commit -m "Force rebuild [build all]"
```

### Method 2: Manual Workflow Dispatch (UI)

Go to **Actions → Build and Deploy to GKE → Run workflow**

### Method 3: Empty Commit (Quick)

```bash
git commit --allow-empty -m "Force build [force build]"
git push origin main
```

## Detailed Methods

### Method 1: Commit Message Keywords ⭐ Recommended

The workflow automatically detects these keywords (case-insensitive):

| Keyword | Example |
|---------|---------|
| `[force build]` | `git commit -m "Update configs [force build]"` |
| `[rebuild all]` | `git commit -m "Rebuild all [rebuild all]"` |
| `[build all]` | `git commit -m "Build all services [build all]"` |

**How it works:**
1. The workflow checks the commit message
2. If any keyword is found, **all 5 packages** are marked for build:
   - agent-api
   - agent-webapp
   - burger-api
   - burger-mcp
   - burger-webapp
3. Docker images are built and pushed to Artifact Registry
4. Deployment proceeds with new images

**Examples:**

```bash
# Force build with actual changes
git add k8s/base/configmap.yaml
git commit -m "Update ConfigMap [force build]"
git push origin main

# Force build without changes (empty commit)
git commit --allow-empty -m "Rebuild all containers [rebuild all]"
git push origin main

# Force build for dependency updates
git commit -m "Update npm dependencies [build all]"
git push origin main
```

**Benefits:**
- ✅ Simple - just add keyword to commit message
- ✅ Trackable - keyword visible in git history
- ✅ Automated - no manual intervention needed
- ✅ Works with any commit (empty or with changes)

---

### Method 2: Manual Workflow Dispatch

Manually trigger the workflow via GitHub UI:

**Steps:**
1. Go to your repository on GitHub
2. Click **Actions** tab
3. Select **Build and Deploy to GKE** workflow
4. Click **Run workflow** button
5. Select:
   - **Branch**: main or prod
   - **Environment**: dev or prod
   - **Skip build**: Leave unchecked to force build
6. Click **Run workflow**

**When to use:**
- ✅ Need to redeploy specific environment
- ✅ Want to test workflow without pushing code
- ✅ Emergency rebuilds
- ✅ Testing workflow changes

---

### Method 3: Empty Commit

Create an empty commit that triggers the workflow:

```bash
# Empty commit with force build keyword
git commit --allow-empty -m "Force rebuild [force build]"
git push origin main

# Or without keyword (only triggers if workflow paths match)
git commit --allow-empty -m "Trigger CI"
git push origin main
```

**Benefits:**
- ✅ No actual code changes
- ✅ Clean git history
- ✅ Can add descriptive message

---

### Method 4: Touch a Trigger File

Create or update a file that triggers the workflow:

```bash
# Option A: Create/update a trigger file
echo "$(date)" > .github/trigger-build.txt
git add .github/trigger-build.txt
git commit -m "Force build"
git push origin main

# Option B: Update workflow file itself (causes rebuild)
touch .github/workflows/gke-deploy.yaml
git add .github/workflows/gke-deploy.yaml
git commit -m "Trigger rebuild"
git push origin main
```

**Benefits:**
- ✅ Visible in git diff
- ✅ Can track rebuild triggers
- ✅ Alternative to empty commits

---

### Method 5: Modify Package JSON

Update a timestamp or version in root package.json:

```bash
# Update a field in package.json
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "Bump version"
git push origin main
```

**Benefits:**
- ✅ Semantic versioning
- ✅ Trackable in package.json
- ✅ Updates lock file

---

## Force Build Detection in Workflow

The workflow includes this logic:

```yaml
- name: Check for force build keywords
  id: check-keywords
  run: |
    COMMIT_MSG="${{ github.event.head_commit.message }}"
    FORCE_BUILD="false"

    # Check for force build keywords
    if echo "${COMMIT_MSG}" | grep -iE '\[force.build\]|\[rebuild.all\]|\[build.all\]'; then
      FORCE_BUILD="true"
      echo "🔨 Force build detected in commit message!"
    fi

    echo "force_build=${FORCE_BUILD}" >> $GITHUB_OUTPUT

- name: Check if any package changed or force build
  id: check-force
  run: |
    FORCE="${{ steps.check-keywords.outputs.force_build }}"

    if [[ "${FORCE}" == "true" ]]; then
      echo "🔨 FORCE BUILD: Building all packages"
      # Mark all packages as changed
      echo "agent-api=true" >> $GITHUB_OUTPUT
      echo "agent-webapp=true" >> $GITHUB_OUTPUT
      echo "burger-api=true" >> $GITHUB_OUTPUT
      echo "burger-mcp=true" >> $GITHUB_OUTPUT
      echo "burger-webapp=true" >> $GITHUB_OUTPUT
      echo "any-changed=true" >> $GITHUB_OUTPUT
      echo "force-build=true" >> $GITHUB_OUTPUT
    fi
```

## Use Cases

### Use Case 1: Base Image Update

You've updated the Node.js base image but haven't changed application code:

```bash
# Update Dockerfiles with new base image
# Then force rebuild all
git add packages/*/Dockerfile
git commit -m "Update Node.js base image to v20 [force build]"
git push origin main
```

### Use Case 2: Dependency Updates

You've updated npm dependencies but want to ensure fresh builds:

```bash
npm update
git add package-lock.json
git commit -m "Update npm dependencies [rebuild all]"
git push origin main
```

### Use Case 3: Environment Configuration Change

You've updated environment variables or ConfigMaps:

```bash
git add k8s/base/configmap.yaml
git commit -m "Update ConfigMap [force build]"
git push origin main
```

### Use Case 4: Infrastructure Changes

You've made changes to Kubernetes manifests:

```bash
git add k8s/base/*.yaml
git commit -m "Update Kubernetes resources [build all]"
git push origin main
```

### Use Case 5: Security Updates

Force rebuild for security patches:

```bash
git commit --allow-empty -m "Security: Rebuild all images [force build]"
git push origin main
```

## Verification

Check if force build was triggered:

**In GitHub Actions:**
1. Go to Actions tab
2. Click on the workflow run
3. Check **Detect Changed Packages** job
4. Look for: `🔨 Force build detected in commit message!`
5. Verify all 5 packages show as "changed"

**In Logs:**
```
🔨 FORCE BUILD: Building all packages
agent-api=true
agent-webapp=true
burger-api=true
burger-mcp=true
burger-webapp=true
```

## Comparison of Methods

| Method | Speed | Cleanliness | Trackability | Automation |
|--------|-------|-------------|--------------|------------|
| **Commit Keyword** | ⚡⚡⚡ | ✨✨✨ | 📊📊📊 | 🤖🤖🤖 |
| **Manual Dispatch** | ⚡⚡ | ✨✨✨ | 📊 | 🤖 |
| **Empty Commit** | ⚡⚡⚡ | ✨✨ | 📊📊 | 🤖🤖 |
| **Touch File** | ⚡⚡ | ✨ | 📊📊📊 | 🤖🤖 |
| **Version Bump** | ⚡⚡ | ✨✨✨ | 📊📊📊 | 🤖🤖 |

**Legend:**
- ⚡ Speed (how fast to execute)
- ✨ Cleanliness (how clean the git history)
- 📊 Trackability (how easy to track in history)
- 🤖 Automation (how automated the process)

## Best Practices

### ✅ DO:
- Use commit keywords for routine force builds
- Use manual dispatch for testing
- Add descriptive commit messages
- Document why force build was needed

### ❌ DON'T:
- Force build on every commit (defeats intelligent detection)
- Use force build for debugging (use logs instead)
- Forget to add keyword in commit message
- Use force build when only config changed (deploy without build)

## Troubleshooting

### Force build not working

**Check commit message:**
```bash
# View last commit message
git log -1 --pretty=%B

# Should contain one of: [force build], [rebuild all], [build all]
```

**Check workflow logs:**
```
Actions → Select run → Detect Changed Packages
Look for: "🔨 Force build detected"
```

### All packages building but shouldn't

**Check if keyword in commit:**
```bash
# Check recent commits
git log --oneline -10 | grep -iE '\[force.build\]|\[rebuild.all\]|\[build.all\]'
```

### Manual dispatch not building

**Ensure "skip_build" is unchecked:**
- Go to Actions → Run workflow
- Verify "Skip image build" is **not** checked
- If checked, it will skip the build step

## Examples

### Example 1: Regular commit with force build
```bash
$ git add .
$ git commit -m "Update Datadog config [force build]"
[main abc1234] Update Datadog config [force build]
 1 file changed, 2 insertions(+), 1 deletion(-)

$ git push origin main
# Workflow detects [force build] keyword
# All 5 packages are built
```

### Example 2: Empty commit for rebuild
```bash
$ git commit --allow-empty -m "Weekly rebuild [rebuild all]"
[main def5678] Weekly rebuild [rebuild all]

$ git push origin main
# No code changes, but force build triggers
# All images rebuilt with latest base images
```

### Example 3: Manual dispatch
```
1. Go to GitHub Actions
2. Select "Build and Deploy to GKE"
3. Click "Run workflow"
4. Select:
   - Branch: main
   - Environment: dev
   - Skip build: ❌ (unchecked)
5. Click "Run workflow"
# Workflow runs, builds all images
```

## Related Documentation

- [GitHub Actions Setup](GITHUB_ACTIONS_SETUP.md) - Complete CI/CD setup
- [CI/CD Quickstart](CICD_QUICKSTART.md) - Quick setup guide
- [GitHub Secrets vs Variables](GITHUB_SECRETS_VS_VARIABLES.md) - Configuration guide

## Summary

**Easiest method:** Add `[force build]` to any commit message

```bash
# That's it!
git commit -m "Your changes here [force build]"
git push origin main
```

This will:
1. ✅ Build all 5 Docker images
2. ✅ Push to Artifact Registry
3. ✅ Deploy to appropriate environment
4. ✅ Run smoke tests
5. ✅ Show "🔨 Force build detected!" in logs
