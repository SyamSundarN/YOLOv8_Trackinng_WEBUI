#!/usr/bin/env bash
# macOS setup: same conda env name + Python 3.9 as INSTALLER.bat, without CUDA.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_NAME="${CONDA_ENV_NAME:-yolov8-tracking}"

if ! command -v conda >/dev/null 2>&1; then
  echo "conda not found. Install Miniconda/Anaconda first, then re-run this script."
  exit 1
fi

eval "$(conda shell.bash hook 2>/dev/null || conda shell.zsh hook 2>/dev/null)"

if conda env list | awk '{print $1}' | grep -qx "$ENV_NAME"; then
  echo "Using existing conda env: $ENV_NAME"
else
  echo "Creating conda environment: $ENV_NAME (python=3.9) ..."
  conda create -n "$ENV_NAME" python=3.9 -y
fi

conda activate "$ENV_NAME"

python -m pip install --upgrade pip

echo "Installing dependencies (includes PyTorch CPU/MPS wheels for macOS) ..."
pip install -r requirements.txt

echo ""
echo "Done. Activate and run the API:"
echo "  conda activate $ENV_NAME"
echo "  cd \"$SCRIPT_DIR\""
echo "  uvicorn main:app --reload"
