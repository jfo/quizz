#!/bin/bash

set -e  # Exit on error

echo "🚀 Starting deployment to gh-pages..."

# Configuration
BUILD_DIR="dist"
DEPLOY_DIR=".gh-pages-deploy"
BRANCH="gh-pages"

# Step 1: Build the project
echo "📦 Building the project..."
echo "URL: $VITE_SUPABASE_URL"
npm run build

# Check if build was successful
if [ ! -d "$BUILD_DIR" ]; then
  echo "❌ Build failed: $BUILD_DIR directory not found"
  exit 1
fi

echo "✅ Build completed successfully"

# Step 2: Setup worktree
echo "🌳 Setting up git worktree..."

# Remove existing worktree if it exists
if [ -d "$DEPLOY_DIR" ]; then
  echo "Removing existing worktree..."
  rm -rf "$DEPLOY_DIR"
fi

# Check if gh-pages branch exists
if git show-ref --verify --quiet refs/heads/$BRANCH; then
  echo "Branch $BRANCH exists, using it..."
  git worktree add "$DEPLOY_DIR" "$BRANCH"
else
  echo "Branch $BRANCH doesn't exist, creating it..."
  git worktree add -b "$BRANCH" --orphan "$DEPLOY_DIR"
fi

# Step 3: Copy build files
echo "📋 Copying build files..."

# Clear the worktree (except .git)
cd "$DEPLOY_DIR"
git rm -rf . 2>/dev/null || true
cd ..

# Copy all files from build directory
cp -r "$BUILD_DIR"/* "$DEPLOY_DIR/"

# Add .nojekyll to prevent GitHub from processing with Jekyll
touch "$DEPLOY_DIR/.nojekyll"

# Step 4: Commit and push
echo "💾 Committing changes..."
cd "$DEPLOY_DIR"

git add -A

if git diff --staged --quiet; then
  echo "⚠️  No changes to deploy"
  cd ..
  git worktree remove "$DEPLOY_DIR"
  echo "✅ Deployment completed (no changes)"
  exit 0
fi

COMMIT_MSG="Deploy to GitHub Pages - $(date '+%Y-%m-%d %H:%M:%S')"
git commit -m "$COMMIT_MSG"

echo "⬆️  Pushing to $BRANCH branch..."
git push -uf origin "$BRANCH"

cd ..

# Step 5: Cleanup
echo "🧹 Cleaning up worktree..."
git worktree remove "$DEPLOY_DIR"

echo "✅ Deployment completed successfully!"
echo "🌐 Your site should be available at: https://jfo.github.io/quizz/"
