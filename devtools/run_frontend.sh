#!/bin/bash

# Frontend Server Startup Script
# Creates virtual environment and runs HTTP server for MTG NLP Frontend

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
DEFAULT_PORT=8080

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1  # Port is in use
    else
        return 0  # Port is available
    fi
}

# Function to find available port
find_available_port() {
    local port=$DEFAULT_PORT
    while ! check_port $port; do
        print_warning "Port $port is in use, trying $((port + 1))"
        port=$((port + 1))
        if [ $port -gt 9000 ]; then
            print_error "Could not find available port between $DEFAULT_PORT and 9000"
            exit 1
        fi
    done
    echo $port
}

# Parse command line arguments
PORT=$DEFAULT_PORT
BACKGROUND=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -b|--background)
            BACKGROUND=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -p, --port PORT     Port to run server on (default: 8080)"
            echo "  -b, --background    Run server in background"
            echo "  -h, --help          Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                  # Run on port 8080"
            echo "  $0 -p 3000          # Run on port 3000"
            echo "  $0 -b               # Run in background"
            echo "  $0 -p 3000 -b       # Run on port 3000 in background"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

print_status "🚀 Starting MTG NLP Frontend Server..."
print_status "📁 Working directory: $SCRIPT_DIR"

# Change to script directory
cd "$SCRIPT_DIR"

# Check if virtual environment exists
if [ ! -d "$VENV_DIR" ]; then
    print_status "📦 Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
    print_success "Virtual environment created at $VENV_DIR"
else
    print_status "📦 Using existing virtual environment at $VENV_DIR"
fi

# Activate virtual environment
print_status "🔧 Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Upgrade pip (optional but recommended)
print_status "⬆️  Upgrading pip..."
pip install --upgrade pip --quiet

# Check if requested port is available
if ! check_port $PORT; then
    if [ "$PORT" = "$DEFAULT_PORT" ]; then
        # Auto-find available port for default port
        AVAILABLE_PORT=$(find_available_port)
        print_warning "Port $PORT is in use, using port $AVAILABLE_PORT instead"
        PORT=$AVAILABLE_PORT
    else
        # For custom port, show error and suggest alternatives
        print_error "Port $PORT is already in use!"
        print_status "Checking for processes using port $PORT:"
        lsof -i :$PORT || true
        
        # Suggest available port
        AVAILABLE_PORT=$(find_available_port)
        print_status "Suggested available port: $AVAILABLE_PORT"
        print_status "Run with: $0 -p $AVAILABLE_PORT"
        exit 1
    fi
fi

# Kill any existing servers on the same port (cleanup)
print_status "🧹 Cleaning up any existing servers on port $PORT..."
pkill -f "http.server $PORT" 2>/dev/null || true

# Start the server
print_success "🌐 Starting HTTP server on port $PORT..."
print_status "📂 Serving files from: $SCRIPT_DIR"
print_status "🔗 Access the frontend at: http://localhost:$PORT"
print_status "⏹️  Press Ctrl+C to stop the server"

if [ "$BACKGROUND" = true ]; then
    print_status "🔄 Running server in background..."
    nohup python3 -m http.server $PORT > server.log 2>&1 &
    SERVER_PID=$!
    print_success "Server started in background with PID: $SERVER_PID"
    print_status "📝 Server logs: $SCRIPT_DIR/server.log"
    print_status "🛑 To stop: kill $SERVER_PID"
    
    # Save PID for easy cleanup
    echo $SERVER_PID > .server.pid
    print_status "💾 PID saved to .server.pid"
else
    # Run in foreground
    python3 -m http.server $PORT
fi
