@echo off
echo.
echo ============================================
echo   Mathiverse Local Renderer
echo ============================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.10+.
    echo https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "venv" (
    echo [INFO] Creating virtual environment...
    python -m venv venv
)

REM Activate venv and install dependencies
call venv\Scripts\activate.bat

echo [INFO] Installing dependencies...
pip install -r requirements.txt -q

echo [INFO] Starting renderer on http://localhost:9876
echo.
python server.py

pause
