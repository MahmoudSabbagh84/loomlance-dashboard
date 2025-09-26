@echo off
REM LoomLance Dashboard Deployment Script for Windows
REM This script builds and deploys the application to AWS

echo 🚀 Starting LoomLance Dashboard deployment...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo ✅ Dependencies check completed

REM Install dependencies
echo 📦 Installing dependencies...
call npm ci
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed

REM Build the application
echo 🔨 Building application...
set NODE_ENV=production
call npm run build:prod
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

REM Verify build output
if not exist "dist" (
    echo ❌ Build failed - dist directory not found
    pause
    exit /b 1
)

echo ✅ Build completed successfully

REM Check if AWS CLI is available
aws --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  AWS CLI is not installed. S3 deployment will be skipped.
    echo    Install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
    goto :end
)

REM Deploy to S3
echo ☁️  Deploying to S3...
set BUCKET_NAME=loomlance-dashboard-prod

REM Check if bucket exists
aws s3 ls s3://%BUCKET_NAME% >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 Creating S3 bucket: %BUCKET_NAME%
    aws s3 mb s3://%BUCKET_NAME%
    if %errorlevel% neq 0 (
        echo ❌ Failed to create S3 bucket
        pause
        exit /b 1
    )
)

REM Sync files to S3
aws s3 sync dist/ s3://%BUCKET_NAME% --delete
if %errorlevel% neq 0 (
    echo ❌ Failed to sync files to S3
    pause
    exit /b 1
)

REM Configure for static website hosting
aws s3 website s3://%BUCKET_NAME% --index-document index.html --error-document index.html
if %errorlevel% neq 0 (
    echo ❌ Failed to configure S3 website hosting
    pause
    exit /b 1
)

echo ✅ Deployment to S3 completed
echo 🌐 Your app is available at: http://%BUCKET_NAME%.s3-website-us-east-1.amazonaws.com

:end
echo.
echo 🎉 Deployment completed successfully!
echo.
echo 📋 Next steps:
echo    1. Configure CloudFront for better performance
echo    2. Set up custom domain
echo    3. Configure SSL certificate
echo    4. Set up monitoring and alerts
echo.
echo 📚 For detailed instructions, see deploy-aws.md
echo.
pause
