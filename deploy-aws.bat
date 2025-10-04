@echo off
REM AWS Deployment Script for LoomLance Dashboard (Windows)
REM This script handles the complete deployment process to AWS

setlocal enabledelayedexpansion

REM Configuration
set PROJECT_NAME=loomlance-dashboard
set AWS_REGION=us-east-1
set S3_BUCKET=loomlance-dashboard-static
set CLOUDFRONT_DISTRIBUTION_ID=
set STACK_NAME=loomlance-stack

REM Environment variables
set ENVIRONMENT=%1
if "%ENVIRONMENT%"=="" set ENVIRONMENT=staging

echo 🚀 Starting AWS deployment for LoomLance Dashboard
echo Environment: %ENVIRONMENT%
echo Region: %AWS_REGION%

REM Check if AWS CLI is installed
aws --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ AWS CLI is not installed. Please install it first.
    exit /b 1
)

REM Check if AWS credentials are configured
aws sts get-caller-identity >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ AWS credentials not configured. Please run 'aws configure' first.
    exit /b 1
)

echo ✅ AWS CLI and credentials verified

REM Build the React application
echo 📦 Building React application...
call npm run build

if %errorlevel% neq 0 (
    echo ❌ Build failed
    exit /b 1
)

echo ✅ Build completed successfully

REM Create S3 bucket if it doesn't exist
echo 🪣 Checking S3 bucket...
aws s3 ls "s3://%S3_BUCKET%" >nul 2>&1
if %errorlevel% neq 0 (
    echo Creating S3 bucket: %S3_BUCKET%
    aws s3 mb "s3://%S3_BUCKET%" --region %AWS_REGION%
    
    REM Configure bucket for static website hosting
    aws s3 website "s3://%S3_BUCKET%" --index-document index.html --error-document index.html
) else (
    echo ✅ S3 bucket already exists
)

REM Upload files to S3
echo 📤 Uploading files to S3...
aws s3 sync dist/ "s3://%S3_BUCKET%" --delete

if %errorlevel% neq 0 (
    echo ❌ Upload failed
    exit /b 1
)

echo ✅ Files uploaded successfully

REM Set proper cache headers
echo ⚙️ Setting cache headers...
aws s3 cp "s3://%S3_BUCKET%" "s3://%S3_BUCKET%" --recursive --metadata-directive REPLACE --cache-control "max-age=31536000" --exclude "*.html"

REM Set HTML files to no-cache
aws s3 cp "s3://%S3_BUCKET%" "s3://%S3_BUCKET%" --recursive --metadata-directive REPLACE --cache-control "no-cache" --include "*.html"

echo ✅ Cache headers set

REM Deploy CloudFormation stack for backend services
echo ☁️ Deploying CloudFormation stack...
if exist "cloudformation-template.yaml" (
    aws cloudformation deploy --template-file cloudformation-template.yaml --stack-name %STACK_NAME% --parameter-overrides Environment=%ENVIRONMENT% --capabilities CAPABILITY_IAM --region %AWS_REGION%
    
    if %errorlevel% equ 0 (
        echo ✅ CloudFormation stack deployed successfully
    ) else (
        echo ⚠️ CloudFormation deployment had issues, but continuing...
    )
) else (
    echo ⚠️ CloudFormation template not found, skipping backend deployment
)

REM Invalidate CloudFront cache if distribution ID is provided
if not "%CLOUDFRONT_DISTRIBUTION_ID%"=="" (
    echo 🔄 Invalidating CloudFront cache...
    aws cloudfront create-invalidation --distribution-id %CLOUDFRONT_DISTRIBUTION_ID% --paths "/*"
    
    echo ✅ CloudFront cache invalidation initiated
)

REM Get the website URL
set WEBSITE_URL=http://%S3_BUCKET%.s3-website-%AWS_REGION%.amazonaws.com

echo 🎉 Deployment completed successfully!
echo Website URL: %WEBSITE_URL%

REM Display next steps
echo 📋 Next Steps:
echo 1. Configure CloudFront distribution for custom domain
echo 2. Set up SSL certificate with AWS Certificate Manager
echo 3. Configure Route 53 for custom domain
echo 4. Set up monitoring with CloudWatch
echo 5. Configure backup and disaster recovery

REM Save deployment info
echo {> deployment-info.json
echo   "deploymentDate": "%date% %time%",>> deployment-info.json
echo   "environment": "%ENVIRONMENT%",>> deployment-info.json
echo   "region": "%AWS_REGION%",>> deployment-info.json
echo   "s3Bucket": "%S3_BUCKET%",>> deployment-info.json
echo   "websiteUrl": "%WEBSITE_URL%",>> deployment-info.json
echo   "cloudfrontDistributionId": "%CLOUDFRONT_DISTRIBUTION_ID%">> deployment-info.json
echo }>> deployment-info.json

echo ✅ Deployment info saved to deployment-info.json
