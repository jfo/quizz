#!/bin/bash

# Deploy script for GitHub Pages
# This script builds the frontend and pushes it to the gh-pages branch

set -e  # Exit on error

echo "🏗️  Building frontend..."
cd frontend
npm run build

echo "📦 Preparing deployment..."
cd ..

# Store the current branch
CURRENT_BRANCH=$(git branch --show-current)

# Create a temporary directory for the build
TEMP_DIR=$(mktemp -d)
cp -r frontend/dist/* "$TEMP_DIR/"

# Switch to gh-pages branch (create if it doesn't exist)
if git show-ref --verify --quiet refs/heads/gh-pages; then
  echo "📌 Checking out existing gh-pages branch..."
  git checkout gh-pages
else
  echo "🌱 Creating new gh-pages branch..."
  git checkout --orphan gh-pages
  git rm -rf .
fi

# Clear the branch and copy the build
echo "🧹 Clearing old files..."
git rm -rf . 2>/dev/null || true
rm -rf * .gitignore 2>/dev/null || true

echo "📋 Copying new build..."
cp -r "$TEMP_DIR/"* .

# Create .nojekyll file (tells GitHub Pages not to process with Jekyll)
touch .nojekyll

# Add and commit
echo "💾 Committing changes..."
git add -A
git commit -m "Deploy to GitHub Pages - $(date +'%Y-%m-%d %H:%M:%S')" || {
  echo "ℹ️  No changes to commit"
  git checkout "$CURRENT_BRANCH"
  rm -rf "$TEMP_DIR"
  exit 0
}

# Push to GitHub
echo "🚀 Pushing to gh-pages..."
git push origin gh-pages --force

# Switch back to the original branch
echo "🔄 Switching back to $CURRENT_BRANCH..."
git checkout "$CURRENT_BRANCH"

# Clean up
rm -rf "$TEMP_DIR"

echo "✅ Deployment complete!"
echo "🌐 Your site will be available at: https://jfo.github.io/quizz/"
