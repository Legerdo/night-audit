@echo off
rem 13F: Night Audit - Windows launcher
rem   start.bat          : build if needed, then serve the production build and open the browser
rem   start.bat dev      : run the development server (debug tools: F9)
rem   start.bat rebuild  : force a fresh production build first
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title 13F Night Audit

where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js 가 설치되어 있지 않습니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [1/3] 의존성 설치 중... ^(최초 1회^)
  call npm install --no-fund --no-audit
  if errorlevel 1 goto :fail
)

if /i "%~1"=="dev" (
  echo 개발 서버를 시작합니다: http://localhost:5173  ^(종료: Ctrl+C^)
  call npx vite --port 5173 --strictPort --open
  goto :eof
)

if /i "%~1"=="rebuild" if exist "dist\" rmdir /s /q "dist"

if not exist "dist\index.html" (
  echo [2/3] 게임 빌드 중...
  call npm run build
  if errorlevel 1 goto :fail
)

echo [3/3] 게임을 시작합니다: http://localhost:4173  ^(창을 닫거나 Ctrl+C 로 종료^)
call npx vite preview --port 4173 --strictPort --open
goto :eof

:fail
echo.
echo [오류] 실행에 실패했습니다. 위의 메시지를 확인하세요.
pause
exit /b 1
