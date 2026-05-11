@echo off
echo ================================================
echo Parando todos os servicos Docker...
echo ================================================
docker-compose down

echo.
echo Todos os servicos foram encerrados.
pause
