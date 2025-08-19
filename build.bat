@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    SupaScrapeR Executable Builder
echo ========================================
echo.

echo Reading version from SupaScrapeR.py...

for /f "usebackq delims=" %%i in (`powershell -command "(Get-Content 'SupaScrapeR.py' | Select-String '#SupaScrapeR v').Line -replace '#SupaScrapeR v', ''"`) do set VERSION=%%i

set VERSION=!VERSION: =!

if "!VERSION!"=="" (
    echo ERROR: Could not find version in SupaScrapeR.py
    pause
    exit /b 1
)

echo Found version: !VERSION!
echo.

set DIST_DIR=dist\v!VERSION!
set STANDARD_DIR=!DIST_DIR!\standard
set ENHANCED_DIR=!DIST_DIR!\enhanced

echo Creating directories...
if not exist "!STANDARD_DIR!" mkdir "!STANDARD_DIR!"
if not exist "!ENHANCED_DIR!" mkdir "!ENHANCED_DIR!"
echo.

echo ========================================
echo Building Standard Version (without spaCy)
echo ========================================
echo Checking if venv exists...
if not exist "venv\Scripts\activate.bat" (
    echo ERROR: venv\Scripts\activate.bat not found
    echo Please make sure you have a virtual environment set up in the 'venv' folder
    pause
    exit /b 1
)

echo Activating venv...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate venv
    pause
    exit /b 1
)

echo Checking if PyInstaller is available...
pyinstaller --version
if errorlevel 1 (
    echo ERROR: PyInstaller not found in venv
    echo Please install PyInstaller: pip install pyinstaller
    pause
    exit /b 1
)

echo Building executable...
if exist "assets" (
    echo Assets folder found, including in build...
    if exist "assets\supascraper-icon.ico" (
        pyinstaller --onefile --windowed --name="SupaScrapeR" --add-data="%CD%\assets;assets" --icon="%CD%\assets\supascraper-icon.ico" --distpath="!STANDARD_DIR!" --workpath="build\standard" --specpath="build\standard" SupaScrapeR.py
    ) else (
        echo No .ico file found, building without icon...
        pyinstaller --onefile --windowed --name="SupaScrapeR" --add-data="%CD%\assets;assets" --distpath="!STANDARD_DIR!" --workpath="build\standard" --specpath="build\standard" SupaScrapeR.py
    )
) else (
    echo No assets folder found, building without assets...
    pyinstaller --onefile --windowed --name="SupaScrapeR" --distpath="!STANDARD_DIR!" --workpath="build\standard" --specpath="build\standard" SupaScrapeR.py
)
if errorlevel 1 (
    echo ERROR: PyInstaller failed for standard version
    pause
    exit /b 1
)

echo Deactivating venv...
call venv\Scripts\deactivate.bat 2>nul || echo Venv deactivated
echo Standard version built successfully!
echo.
echo DEBUG: About to start enhanced version...

echo ========================================
echo Building Enhanced Version (with spaCy)
echo ========================================
echo Checking if venv_plus exists...
if not exist "venv_plus\Scripts\activate.bat" (
    echo ERROR: venv_plus\Scripts\activate.bat not found
    echo Please make sure you have a virtual environment set up in the 'venv_plus' folder
    pause
    exit /b 1
)

echo Activating venv_plus...
call venv_plus\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate venv_plus
    pause
    exit /b 1
)

echo Checking if PyInstaller is available...
pyinstaller --version
if errorlevel 1 (
    echo ERROR: PyInstaller not found in venv_plus
    echo Please install PyInstaller: pip install pyinstaller
    pause
    exit /b 1
)

echo Building executable...
if exist "assets" (
    echo Assets folder found, including in build...
    if exist "assets\supascraper-icon.ico" (
        pyinstaller --onefile --windowed --name="SupaScrapeR" --add-data="%CD%\assets;assets" --icon="%CD%\assets\supascraper-icon.ico" --hidden-import=inflect --collect-all=inflect --hidden-import=spacy --collect-all=spacy --hidden-import=en_core_web_sm --collect-all=en_core_web_sm --hidden-import=spacy.lang.en --copy-metadata=spacy --copy-metadata=en_core_web_sm --noupx --distpath="!ENHANCED_DIR!" --workpath="build\enhanced" --specpath="build\enhanced" SupaScrapeR.py
    ) else (
        echo No .ico file found, building without icon...
        pyinstaller --onefile --windowed --name="SupaScrapeR" --add-data="%CD%\assets;assets" --hidden-import=inflect --collect-all=inflect --hidden-import=spacy --collect-all=spacy --hidden-import=en_core_web_sm --collect-all=en_core_web_sm --hidden-import=spacy.lang.en --copy-metadata=spacy --copy-metadata=en_core_web_sm --noupx --distpath="!ENHANCED_DIR!" --workpath="build\enhanced" --specpath="build\enhanced" SupaScrapeR.py
    )
) else (
    echo No assets folder found, building without assets...
    pyinstaller --onefile --windowed --name="SupaScrapeR" --hidden-import=inflect --collect-all=inflect --hidden-import=spacy --collect-all=spacy --hidden-import=en_core_web_sm --collect-all=en_core_web_sm --hidden-import=spacy.lang.en --copy-metadata=spacy --copy-metadata=en_core_web_sm --noupx --distpath="!ENHANCED_DIR!" --workpath="build\enhanced" --specpath="build\enhanced" SupaScrapeR.py
)
if errorlevel 1 (
    echo ERROR: PyInstaller failed for enhanced version
    pause
    exit /b 1
)

echo Deactivating venv_plus...
call venv_plus\Scripts\deactivate.bat 2>nul || echo Venv_plus deactivated
echo Enhanced version built successfully!
echo.
echo DEBUG: About to create README files...

echo ========================================
echo Creating README files...
echo ========================================

if not exist "dist\README.txt" (
    echo ERROR: dist\README.txt not found
    pause
    exit /b 1
)

echo Creating standard README...
(
    echo SupaScrapeR v!VERSION!
    echo Standard Edition
    more +1 "dist\README.txt"
) > "!STANDARD_DIR!\README.txt"

echo Creating enhanced README...
(
    echo SupaScrapeR v!VERSION!
    echo Enhanced Edition
    more +1 "dist\README.txt"
) > "!ENHANCED_DIR!\README.txt"

echo README files created successfully!
echo.

echo ========================================
echo Creating ZIP packages...
echo ========================================

echo Creating standard ZIP package...
cd "!STANDARD_DIR!"
powershell -command "Compress-Archive -Path 'SupaScrapeR.exe', 'README.txt' -DestinationPath 'SupaScrapeR-standard-windows.zip' -Force"
if errorlevel 1 (
    echo WARNING: Failed to create standard ZIP package
) else (
    echo Standard ZIP created: !STANDARD_DIR!\SupaScrapeR-standard-windows.zip
)
cd ..\..\..

echo Creating enhanced ZIP package...
cd "!ENHANCED_DIR!"
powershell -command "Compress-Archive -Path 'SupaScrapeR.exe', 'README.txt' -DestinationPath 'SupaScrapeR-enhanced-windows.zip' -Force"
if errorlevel 1 (
    echo WARNING: Failed to create enhanced ZIP package
) else (
    echo Enhanced ZIP created: !ENHANCED_DIR!\SupaScrapeR-enhanced-windows.zip
)
cd ..\..\..

echo.
echo ========================================
echo           Build Complete!
echo ========================================
echo.
echo Standard version: !STANDARD_DIR!\SupaScrapeR.exe
echo Enhanced version: !ENHANCED_DIR!\SupaScrapeR.exe
echo.
echo ZIP packages:
echo - !STANDARD_DIR!\SupaScrapeR-standard-windows.zip
echo - !ENHANCED_DIR!\SupaScrapeR-enhanced-windows.zip
echo.
echo Both versions are ready for distribution!
echo.

echo Cleaning up build artifacts...
if exist "build" rmdir /s /q "build"
if exist "SupaScrapeR.spec" del "SupaScrapeR.spec"
echo Build artifacts cleaned up.
echo.

pause