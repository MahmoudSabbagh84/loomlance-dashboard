#!/bin/bash

# LoomLance Dashboard Deployment Script
# This script builds and deploys the application to AWS

set -e  # Exit on any error

echo "🚀 Starting LoomLance Dashboard deployment..."

# Check if required tools are installed
check_dependencies() {
    echo "🔍 Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "❌ npm is not installed. Please install npm first."
        exit 1
    fi
    
    if ! command -v aws &> /dev/null; then
        echo "⚠️  AWS CLI is not installed. S3 deployment will be skipped."
        echo "   Install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    fi
    
    echo "✅ Dependencies check completed"
}

# Install dependencies
install_dependencies() {
    echo "📦 Installing dependencies..."
    npm ci
    echo "✅ Dependencies installed"
}

# Build the application
build_application() {
    echo "🔨 Building application..."
    
    # Set production environment
    export NODE_ENV=production
    
    # Run production build
    npm run build:prod
    
    # Verify build output
    if [ ! -d "dist" ]; then
        echo "❌ Build failed - dist directory not found"
        exit 1
    fi
    
    echo "✅ Build completed successfully"
}

# Deploy to S3 (if AWS CLI is available)
deploy_to_s3() {
    if command -v aws &> /dev/null; then
        echo "☁️  Deploying to S3..."
        
        # Check if bucket exists, create if not
        BUCKET_NAME="loomlance-dashboard-prod"
        
        if ! aws s3 ls "s3://$BUCKET_NAME" 2>&1 | grep -q 'NoSuchBucket'; then
            echo "📦 Creating S3 bucket: $BUCKET_NAME"
            aws s3 mb "s3://$BUCKET_NAME"
        fi
        
        # Sync files to S3
        aws s3 sync dist/ "s3://$BUCKET_NAME" --delete
        
        # Configure for static website hosting
        aws s3 website "s3://$BUCKET_NAME" --index-document index.html --error-document index.html
        
        echo "✅ Deployment to S3 completed"
        echo "🌐 Your app is available at: http://$BUCKET_NAME.s3-website-us-east-1.amazonaws.com"
    else
        echo "⚠️  AWS CLI not found. Skipping S3 deployment."
        echo "   To deploy to S3, install AWS CLI and configure credentials."
    fi
}

# Main deployment function
main() {
    echo "🎯 LoomLance Dashboard Deployment"
    echo "================================"
    
    check_dependencies
    install_dependencies
    build_application
    deploy_to_s3
    
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Configure CloudFront for better performance"
    echo "   2. Set up custom domain"
    echo "   3. Configure SSL certificate"
    echo "   4. Set up monitoring and alerts"
    echo ""
    echo "📚 For detailed instructions, see deploy-aws.md"
}

# Run main function
main "$@"
