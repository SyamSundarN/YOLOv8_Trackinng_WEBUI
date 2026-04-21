@echo off
REM Mirrors the original INSTALLER.bat: conda env + CUDA 11.7 PyTorch + this repo's requirements.
REM Run from Command Prompt "as Administrator" only if conda needs it.
setlocal
cd /d "%~dp0"

echo Creating conda environment yolov8-tracking (python=3.9^)...
call conda create -n yolov8-tracking python=3.9 -y
if errorlevel 1 exit /b 1

call conda activate yolov8-tracking
if errorlevel 1 exit /b 1

echo CUDA 11.7 toolkit + PyTorch with CUDA...
call conda install -c conda-forge cudatoolkit=11.7 -y
call conda install pytorch torchvision torchaudio pytorch-cuda=11.7 -c pytorch -c nvidia -y

python -m pip install --upgrade pip
pip install -r requirements.txt

echo.
echo Done. Activate and run:
echo   conda activate yolov8-tracking
echo   cd /d "%~dp0"
echo   uvicorn main:app --reload

endlocal
