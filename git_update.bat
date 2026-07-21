@echo off
set /p msg="Enter commit message (leave blank for 'Update code'): "
if "%msg%"=="" set msg=Update code

echo.
echo Adding changes...
git add .

echo.
echo Committing: %msg%
git commit -m "%msg%"

echo.
echo Pulling latest changes...
git pull --no-edit

echo.
echo Pushing to remote...
git push

echo.
echo Done!
pause
