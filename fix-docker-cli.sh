#!/bin/bash

# Fix Docker CLI segfault issue
# This script will reinstall the Docker CLI package

echo "🔧 Fixing Docker CLI segmentation fault..."
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  This script needs sudo access to reinstall Docker CLI"
    echo "   Please run with: sudo ./fix-docker-cli.sh"
    exit 1
fi

echo "📦 Current Docker CLI version:"
rpm -q docker-ce-cli

echo ""
echo "🔄 Reinstalling Docker CLI..."
dnf reinstall docker-ce-cli -y

echo ""
echo "✅ Docker CLI reinstalled!"
echo ""
echo "🧪 Testing Docker CLI..."
if docker --version > /dev/null 2>&1; then
    echo "✅ Docker CLI is working!"
    docker --version
else
    echo "❌ Docker CLI still has issues. Trying alternative fix..."
    echo ""
    echo "🔄 Trying to downgrade Docker CLI..."
    dnf downgrade docker-ce-cli -y

    if docker --version > /dev/null 2>&1; then
        echo "✅ Docker CLI is now working!"
        docker --version
    else
        echo "❌ Still having issues. Please report this bug to Docker."
        echo "   Temporary workaround: Use Python subprocess to run docker commands"
        exit 1
    fi
fi

echo ""
echo "🎉 Docker CLI fixed! You can now run ./start-dev.sh"
