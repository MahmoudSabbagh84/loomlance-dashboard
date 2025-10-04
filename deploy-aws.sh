#!/bin/bash

# AWS Deployment Script for LoomLance Dashboard
# This script handles the complete deployment process to AWS

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="loomlance-dashboard"
AWS_REGION="us-east-1"
S3_BUCKET="loomlance-dashboard-static"
CLOUDFRONT_DISTRIBUTION_ID=""
STACK_NAME="loomlance-stack"

# Environment variables
ENVIRONMENT=${1:-staging}

echo -e "${BLUE}🚀 Starting AWS deployment for LoomLance Dashboard${NC}"
echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}Region: ${AWS_REGION}${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI and credentials verified${NC}"

# Build the React application
echo -e "${BLUE}📦 Building React application...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"

# Create S3 bucket if it doesn't exist
echo -e "${BLUE}🪣 Checking S3 bucket...${NC}"
if ! aws s3 ls "s3://${S3_BUCKET}" 2>&1 | grep -q 'NoSuchBucket'; then
    echo -e "${YELLOW}Creating S3 bucket: ${S3_BUCKET}${NC}"
    aws s3 mb "s3://${S3_BUCKET}" --region ${AWS_REGION}
    
    # Configure bucket for static website hosting
    aws s3 website "s3://${S3_BUCKET}" \
        --index-document index.html \
        --error-document index.html
else
    echo -e "${GREEN}✅ S3 bucket already exists${NC}"
fi

# Upload files to S3
echo -e "${BLUE}📤 Uploading files to S3...${NC}"
aws s3 sync dist/ "s3://${S3_BUCKET}" --delete

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Upload failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Files uploaded successfully${NC}"

# Set proper cache headers
echo -e "${BLUE}⚙️ Setting cache headers...${NC}"
aws s3 cp "s3://${S3_BUCKET}" "s3://${S3_BUCKET}" \
    --recursive \
    --metadata-directive REPLACE \
    --cache-control "max-age=31536000" \
    --exclude "*.html"

# Set HTML files to no-cache
aws s3 cp "s3://${S3_BUCKET}" "s3://${S3_BUCKET}" \
    --recursive \
    --metadata-directive REPLACE \
    --cache-control "no-cache" \
    --include "*.html"

echo -e "${GREEN}✅ Cache headers set${NC}"

# Deploy CloudFormation stack for backend services
echo -e "${BLUE}☁️ Deploying CloudFormation stack...${NC}"
if [ -f "cloudformation-template.yaml" ]; then
    aws cloudformation deploy \
        --template-file cloudformation-template.yaml \
        --stack-name ${STACK_NAME} \
        --parameter-overrides Environment=${ENVIRONMENT} \
        --capabilities CAPABILITY_IAM \
        --region ${AWS_REGION}
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ CloudFormation stack deployed successfully${NC}"
    else
        echo -e "${YELLOW}⚠️ CloudFormation deployment had issues, but continuing...${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ CloudFormation template not found, skipping backend deployment${NC}"
fi

# Invalidate CloudFront cache if distribution ID is provided
if [ ! -z "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo -e "${BLUE}🔄 Invalidating CloudFront cache...${NC}"
    aws cloudfront create-invalidation \
        --distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} \
        --paths "/*"
    
    echo -e "${GREEN}✅ CloudFront cache invalidation initiated${NC}"
fi

# Get the website URL
WEBSITE_URL="http://${S3_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com"

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${BLUE}Website URL: ${WEBSITE_URL}${NC}"

# Display next steps
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo -e "1. Configure CloudFront distribution for custom domain"
echo -e "2. Set up SSL certificate with AWS Certificate Manager"
echo -e "3. Configure Route 53 for custom domain"
echo -e "4. Set up monitoring with CloudWatch"
echo -e "5. Configure backup and disaster recovery"

# Save deployment info
echo "{
  \"deploymentDate\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"environment\": \"${ENVIRONMENT}\",
  \"region\": \"${AWS_REGION}\",
  \"s3Bucket\": \"${S3_BUCKET}\",
  \"websiteUrl\": \"${WEBSITE_URL}\",
  \"cloudfrontDistributionId\": \"${CLOUDFRONT_DISTRIBUTION_ID}\"
}" > deployment-info.json

echo -e "${GREEN}✅ Deployment info saved to deployment-info.json${NC}"

