#!/bin/bash

read -p "Enter commit message (leave blank for 'Update code'): " msg

if [ -z "$msg" ]; then
  msg="Update code"
fi

echo ""
echo "Adding changes..."
git add .

echo ""
echo "Committing: '$msg'"
git commit -m "$msg"

echo ""
echo "Pulling latest changes..."
git pull --no-edit

echo ""
echo "Pushing to remote..."
git push

echo ""
echo "Done!"
