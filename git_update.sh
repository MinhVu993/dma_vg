#!/bin/bash

<<<<<<< HEAD
read -p "Enter commit message (leave blank for 'Update code'): " msg
=======
read -p "Nhập nội dung commit (để trống sẽ mặc định là 'Update code'): " msg
>>>>>>> 9ddc833365ec25979920fb0507156359185cda4c

if [ -z "$msg" ]; then
  msg="Update code"
fi

echo ""
<<<<<<< HEAD
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
=======
echo "Đang thêm các thay đổi..."
git add .

echo ""
echo "Đang commit với nội dung: '$msg'"
git commit -m "$msg"

echo ""
echo "Đang push lên remote..."
git push

echo ""
echo "Đã hoàn tất việc update lên git!"
>>>>>>> 9ddc833365ec25979920fb0507156359185cda4c
