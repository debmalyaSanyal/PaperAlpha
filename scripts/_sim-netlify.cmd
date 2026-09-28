@echo off
set NODE_ENV=production
set NETLIFY=true
set AWS_LAMBDA_FUNCTION_NAME=paperalpha
set DATABASE_URL=file:./dev.db
set ALLOW_ANONYMOUS_DEV_USER=true
set AUTH_SECRET=prod-test-secret-0123456789abcdef
set PORT=3111
call npm start
