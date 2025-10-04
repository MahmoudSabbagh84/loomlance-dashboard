# AWS Deployment Guide for LoomLance Dashboard

This guide provides comprehensive instructions for deploying the LoomLance Dashboard to AWS using various AWS services.

## 🏗️ Architecture Overview

The LoomLance Dashboard is designed to be deployed on AWS with the following architecture:

- **Frontend**: React SPA hosted on S3 with CloudFront CDN
- **Backend**: Serverless API using Lambda and API Gateway
- **Database**: DynamoDB for data storage
- **Authentication**: AWS Cognito for user management
- **Monitoring**: CloudWatch for logging and monitoring
- **Infrastructure**: CloudFormation for infrastructure as code

## 📋 Prerequisites

Before deploying, ensure you have:

1. **AWS CLI** installed and configured
   ```bash
   aws --version
   aws configure
   ```

2. **Node.js** (v18 or higher) and npm installed
   ```bash
   node --version
   npm --version
   ```

3. **AWS Account** with appropriate permissions
4. **Domain name** (optional, for custom domain setup)

## 🚀 Quick Deployment

### Option 1: Automated Deployment (Recommended)

1. **Deploy to Staging:**
   ```bash
   npm run deploy:staging
   ```

2. **Deploy to Production:**
   ```bash
   npm run deploy:production
   ```

### Option 2: Manual Deployment

1. **Build the application:**
   ```bash
   npm run build:prod
   ```

2. **Deploy infrastructure:**
   ```bash
   aws cloudformation deploy --template-file cloudformation-template.yaml --stack-name loomlance-stack --capabilities CAPABILITY_IAM
   ```

3. **Upload to S3:**
   ```bash
   aws s3 sync dist/ s3://your-bucket-name --delete
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# AWS Configuration
REACT_APP_AWS_REGION=us-east-1
REACT_APP_S3_BUCKET=loomlance-dashboard-static
REACT_APP_CLOUDFRONT_DISTRIBUTION_ID=your-distribution-id
REACT_APP_API_ENDPOINT=https://api.loomlance.com

# Cognito Configuration
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_ABC123DEF
REACT_APP_COGNITO_CLIENT_ID=your-client-id
REACT_APP_COGNITO_IDENTITY_POOL_ID=us-east-1:your-identity-pool-id

# DynamoDB Configuration
REACT_APP_DYNAMODB_TABLE=loomlance-data

# Feature Flags
REACT_APP_USE_AWS_COGNITO=true
REACT_APP_USE_DYNAMODB=true
REACT_APP_USE_S3_STORAGE=true
REACT_APP_USE_CLOUDFRONT=true
REACT_APP_ENABLE_ANALYTICS=true
```

### AWS Services Configuration

#### 1. S3 Bucket Setup
- Static website hosting enabled
- Public read access for website files
- CORS configuration for API calls
- Lifecycle policies for cost optimization

#### 2. CloudFront Distribution
- Global CDN for fast content delivery
- Custom error pages for SPA routing
- SSL/TLS termination
- Compression enabled

#### 3. DynamoDB Table
- Pay-per-request billing
- Global Secondary Indexes for efficient queries
- Point-in-time recovery enabled
- Streams for real-time updates

#### 4. Lambda Functions
- Node.js 18.x runtime
- Environment variables for configuration
- IAM roles with minimal permissions
- CloudWatch logging enabled

#### 5. API Gateway
- RESTful API endpoints
- CORS enabled
- Request/response validation
- Rate limiting and throttling

#### 6. Cognito User Pool
- Email-based authentication
- Strong password policies
- MFA support (optional)
- User attributes management

## 📊 Monitoring and Logging

### CloudWatch Metrics
- Lambda function invocations and errors
- API Gateway request counts and latency
- DynamoDB read/write capacity
- CloudFront cache hit ratios

### CloudWatch Logs
- Application logs from Lambda functions
- API Gateway access logs
- Custom application metrics

### CloudWatch Alarms
- High error rates
- High latency
- Low cache hit ratios
- Unusual traffic patterns

## 🔒 Security Best Practices

### IAM Policies
- Principle of least privilege
- Separate roles for different services
- Regular access reviews
- MFA for administrative access

### Data Protection
- Encryption at rest (DynamoDB, S3)
- Encryption in transit (HTTPS, TLS)
- VPC endpoints for private communication
- AWS KMS for key management

### Network Security
- CloudFront for DDoS protection
- WAF rules for common attacks
- VPC security groups
- Private subnets for sensitive resources

## 💰 Cost Optimization

### S3 Storage
- Lifecycle policies for old files
- Intelligent tiering for infrequent access
- Compression for static assets

### CloudFront
- Price class optimization
- Cache optimization
- Origin request policies

### DynamoDB
- On-demand billing for variable workloads
- Reserved capacity for predictable workloads
- DynamoDB Accelerator (DAX) for hot data

### Lambda
- Provisioned concurrency for consistent performance
- Dead letter queues for error handling
- Function optimization for memory and timeout

## 🔄 CI/CD Pipeline

### GitHub Actions (Optional)
```yaml
name: Deploy to AWS
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build:prod
      - uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }} --delete
      - run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"
```

## 🚨 Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are installed
   - Check for TypeScript/ESLint errors

2. **Deployment Failures**
   - Verify AWS credentials and permissions
   - Check CloudFormation stack status
   - Review CloudWatch logs for errors

3. **Runtime Errors**
   - Check Lambda function logs
   - Verify DynamoDB table permissions
   - Check API Gateway configuration

4. **Performance Issues**
   - Monitor CloudWatch metrics
   - Check CloudFront cache settings
   - Optimize Lambda function memory

### Debug Commands

```bash
# Check AWS credentials
npm run aws:status

# View CloudFormation stack
aws cloudformation describe-stacks --stack-name loomlance-stack

# Check S3 bucket contents
aws s3 ls s3://your-bucket-name --recursive

# View Lambda logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda

# Test API endpoint
curl https://your-api-gateway-url/contracts
```

## 📈 Scaling Considerations

### Horizontal Scaling
- Lambda functions auto-scale
- DynamoDB on-demand billing
- CloudFront global distribution
- API Gateway automatic scaling

### Vertical Scaling
- Increase Lambda memory allocation
- DynamoDB provisioned capacity
- CloudFront cache TTL optimization
- S3 transfer acceleration

## 🔄 Backup and Disaster Recovery

### Data Backup
- DynamoDB point-in-time recovery
- S3 cross-region replication
- CloudFormation stack backups
- Lambda function code versioning

### Disaster Recovery
- Multi-region deployment
- Cross-region failover
- Data replication strategies
- Recovery time objectives (RTO)

## 📞 Support and Maintenance

### Regular Maintenance
- Security updates and patches
- Dependency updates
- Performance monitoring
- Cost optimization reviews

### Support Channels
- AWS Support (if using paid support)
- CloudWatch alarms and notifications
- Application monitoring dashboards
- Error tracking and alerting

## 📚 Additional Resources

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [AWS Serverless Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [React on AWS](https://aws.amazon.com/quickstart/architecture/react/)
- [AWS CloudFormation Documentation](https://docs.aws.amazon.com/cloudformation/)

---

For questions or issues, please refer to the troubleshooting section or create an issue in the project repository.

