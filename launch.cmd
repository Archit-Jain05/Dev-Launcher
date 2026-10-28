@echo off
set "LF=%TEMP%\launch-%RANDOM%.cmd"
node "%~dp0launch.mjs" "%LF%" cmd
if exist "%LF%" (call "%LF%" & del "%LF%" 2>nul)
set "LF="
