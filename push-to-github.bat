@echo off
echo Cleaning up old git setup...
rd /s /q "C:\Users\sgowe\.git" 2>nul

echo Setting up git in soymates folder...
cd /d "C:\Users\sgowe\OneDrive\Documents\Vitasoy\soymates"

git init
git remote add origin https://github.com/sgowen23-jpg/soymates.git
git add .
git commit -m "Initial Soymates build"
git branch -M main
git push -u origin main

echo Done! Press any key to close.
pause
