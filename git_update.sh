#!/bin/bash

read -p "Nhập nội dung commit (để trống sẽ mặc định là 'Update code'): " msg

if [ -z "$msg" ]; then
  msg="Update code"
fi

echo ""
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
