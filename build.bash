#!/bin/bash

echo "========================================"
echo "   SupaScrapeR macOS App Builder"
echo "========================================"
echo

echo "Reading version from SupaScrapeR.py..."
VERSION=$(grep "#SupaScrapeR v" SupaScrapeR.py | sed 's/#SupaScrapeR v//' | tr -d ' ')

if [ -z "$VERSION" ]; then
    echo "ERROR: Could not find version in SupaScrapeR.py"
    read -p "Press any key to continue..."
    exit 1
fi

echo "Found version: $VERSION"
echo

DIST_DIR="dist/v$VERSION"
STANDARD_DIR="$DIST_DIR/standard"
ENHANCED_DIR="$DIST_DIR/enhanced"

echo "Creating directories..."
mkdir -p "$STANDARD_DIR"
mkdir -p "$ENHANCED_DIR"
echo

echo "========================================"
echo "Building Standard Version (without spaCy)"
echo "========================================"
echo "Checking if venv exists..."
if [ ! -f "venv/bin/activate" ]; then
    echo "ERROR: venv/bin/activate not found"
    echo "Please make sure you have a virtual environment set up in the 'venv' folder"
    read -p "Press any key to continue..."
    exit 1
fi

echo "Activating venv..."
source venv/bin/activate
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to activate venv"
    read -p "Press any key to continue..."
    exit 1
fi

echo "Checking if PyInstaller is available..."
pyinstaller --version
if [ $? -ne 0 ]; then
    echo "ERROR: PyInstaller not found in venv"
    echo "Please install PyInstaller: pip install pyinstaller"
    read -p "Press any key to continue..."
    exit 1
fi

echo "Building executable..."
if [ -d "assets" ]; then
    echo "Assets folder found, including in build..."
    if [ -f "assets/supascraper-icon.icns" ]; then
        pyinstaller --onefile --windowed --name="SupaScrapeR" --add-data="$(pwd)/assets:assets" --icon="$(pwd)/assets/supascraper-icon.icns" --distpath="$STANDARD_DIR" --workpath="build/standard" --specpath="build/standard" SupaScrapeR.py
    else
        echo "No .icns file found, building without icon..."
        pyinstaller --onefile --windowed --name="SupaScrapeR" --add-data="$(pwd)/assets:assets" --distpath="$STANDARD_DIR" --workpath="build/standard" --specpath="build/standard" SupaScrapeR.py
    fi
else
    echo "No assets folder found, building without assets..."
    pyinstaller --onefile --windowed --name="SupaScrapeR" --distpath="$STANDARD_DIR" --workpath="build/standard" --specpath="build/standard" SupaScrapeR.py
fi

if [ $? -ne 0 ]; then
    echo "ERROR: PyInstaller failed for standard version"
    read -p "Press any key to continue..."
    exit 1
fi

echo "Deactivating venv..."
deactivate 2>/dev/null || echo "Venv deactivated"
echo "Standard version built successfully!"
echo
echo "DEBUG: About to start enhanced version..."

echo "========================================"
echo "Building Enhanced Version (with spaCy)"
echo "========================================"
echo "Checking if venv_plus exists..."
if [ ! -f "venv_plus/bin/activate" ]; then
    echo "ERROR: venv_plus/bin/activate not found"
    echo "Please make sure you have a virtual environment set up in the 'venv_plus' folder"
    read -p "Press any key to continue..."
    exit 1
fi

echo "Activating venv_plus..."
source venv_plus/bin/activate
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to activate venv_plus"
    read -p "Press any key to continue..."
    exit 1
fi

echo "Checking if PyInstaller is available..."
pyinstaller --version
if [ $? -ne 0 ]; then
    echo "ERROR: PyInstaller not found in venv_plus"
    echo "Please install PyInstaller: pip install pyinstaller"
    read -p "Press any key to continue..."
    exit 1
fi

echo "Building executable..."
if [ -d "assets" ]; then
    echo "Assets folder found, including in build..."
    if [ -f "assets/supascraper-icon.icns" ]; then
        pyinstaller --onefile --windowed --name="SupaScrapeR" --add-data="$(pwd)/assets:assets" --icon="$(pwd)/assets/supascraper-icon.icns" --hidden-import=inflect --collect-all=inflect --hidden-import=spacy --collect-all=spacy --hidden-import=en_core_web_sm --collect-all=en_core_web_sm --hidden-import=spacy.lang.en --copy-metadata=spacy --copy-metadata=en_core_web_sm --noupx --distpath="$ENHANCED_DIR" --workpath="build/enhanced" --specpath="build/enhanced" SupaScrapeR.py
    else
        echo "No .icns file found, building without icon..."
        pyinstaller --onefile --windowed --name="SupaScrapeR" --add-data="$(pwd)/assets:assets" --hidden-import=inflect --collect-all=inflect --hidden-import=spacy --collect-all=spacy --hidden-import=en_core_web_sm --collect-all=en_core_web_sm --hidden-import=spacy.lang.en --copy-metadata=spacy --copy-metadata=en_core_web_sm --noupx --distpath="$ENHANCED_DIR" --workpath="build/enhanced" --specpath="build/enhanced" SupaScrapeR.py
    fi
else
    echo "No assets folder found, building without assets..."
    pyinstaller --onefile --windowed --name="SupaScrapeR" --hidden-import=inflect --collect-all=inflect --hidden-import=spacy --collect-all=spacy --hidden-import=en_core_web_sm --collect-all=en_core_web_sm --hidden-import=spacy.lang.en --copy-metadata=spacy --copy-metadata=en_core_web_sm --noupx --distpath="$ENHANCED_DIR" --workpath="build/enhanced" --specpath="build/enhanced" SupaScrapeR.py
fi

if [ $? -ne 0 ]; then
    echo "ERROR: PyInstaller failed for enhanced version"
    read -p "Press any key to continue..."
    exit 1
fi

echo "Deactivating venv_plus..."
deactivate 2>/dev/null || echo "Venv_plus deactivated"
echo "Enhanced version built successfully!"
echo
echo "DEBUG: About to create README files..."

echo "========================================"
echo "Creating README files..."
echo "========================================"

if [ ! -f "dist/README.txt" ]; then
    echo "ERROR: dist/README.txt not found"
    read -p "Press any key to continue..."
    exit 1
fi

echo "Creating standard README..."
{
    echo "SupaScrapeR v$VERSION"
    echo "Standard Edition"
    tail -n +2 "dist/README.txt"
} > "$STANDARD_DIR/README.txt"

echo "Creating enhanced README..."
{
    echo "SupaScrapeR v$VERSION"
    echo "Enhanced Edition"  
    tail -n +2 "dist/README.txt"
} > "$ENHANCED_DIR/README.txt"

echo "README files created successfully!"
echo

echo "========================================"
echo "Creating ZIP packages..."
echo "========================================"

echo "Creating standard ZIP package..."
cd "$STANDARD_DIR"
zip -r "SupaScrapeR-standard-macos.zip" "SupaScrapeR" "README.txt"
if [ $? -ne 0 ]; then
    echo "WARNING: Failed to create standard ZIP package"
else
    echo "Standard ZIP created: $STANDARD_DIR/SupaScrapeR-standard-macos.zip"
fi
cd - > /dev/null

echo "Creating enhanced ZIP package..."
cd "$ENHANCED_DIR"
zip -r "SupaScrapeR-enhanced-macos.zip" "SupaScrapeR" "README.txt"
if [ $? -ne 0 ]; then
    echo "WARNING: Failed to create enhanced ZIP package"
else
    echo "Enhanced ZIP created: $ENHANCED_DIR/SupaScrapeR-enhanced-macos.zip"
fi
cd - > /dev/null

echo
echo "========================================"
echo "           Build Complete!"
echo "========================================"
echo
echo "Standard version: $STANDARD_DIR/SupaScrapeR"
echo "Enhanced version: $ENHANCED_DIR/SupaScrapeR"
echo
echo "ZIP packages:"
echo "- $STANDARD_DIR/SupaScrapeR-standard-macos.zip"
echo "- $ENHANCED_DIR/SupaScrapeR-enhanced-macos.zip"
echo
echo "Both versions are ready for distribution!"
echo

echo "Cleaning up build artifacts..."
if [ -d "build" ]; then
    rm -rf "build"
fi
if [ -f "SupaScrapeR.spec" ]; then
    rm "SupaScrapeR.spec"
fi
echo "Build artifacts cleaned up."
echo

read -p "Press any key to continue..."