@echo off
chcp 65001 > nul
set "msg="
set /p msg="Nhập nội dung commit (để trống sẽ mặc định là 'Update code'): "
if not defined msg set "msg=Update code"

echo.
echo Đang thêm các thay đổi...
git add .

echo.
echo Đang commit với nội dung: "%msg%"
git commit -m "%msg%"

echo.
echo Đang push lên remote 1 (origin)...
git push origin

echo.
echo Đang push lên remote 2 (dma)...
git push dma

echo.
echo Đã hoàn tất việc update lên git!
pause
