// AWS Configuration for LoomLance Dashboard
// This file contains AWS service configurations and environment-specific settings

const isProduction = process.env.NODE_ENV === 'production'
const isStaging = process.env.NODE_ENV === 'staging'

// AWS Service Configuration
export const AWS_CONFIG = {
  region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  services: {
    s3: {
      bucketName: process.env.REACT_APP_S3_BUCKET || 'loomlance-dashboard-static',
      region: process.env.REACT_APP_AWS_REGION || 'us-east-1'
    },
    cloudfront: {
      distributionId: process.env.REACT_APP_CLOUDFRONT_DISTRIBUTION_ID,
      domain: process.env.REACT_APP_CLOUDFRONT_DOMAIN
    },
    apiGateway: {
      endpoint: process.env.REACT_APP_API_ENDPOINT || 'https://api.loomlance.com',
      region: process.env.REACT_APP_AWS_REGION || 'us-east-1'
    },
    cognito: {
      userPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID,
      clientId: process.env.REACT_APP_COGNITO_CLIENT_ID,
      region: process.env.REACT_APP_AWS_REGION || 'us-east-1'
    },
    dynamodb: {
      tableName: process.env.REACT_APP_DYNAMODB_TABLE || 'loomlance-data',
      region: process.env.REACT_APP_AWS_REGION || 'us-east-1'
    }
  }
}

// Environment-specific configurations
export const ENV_CONFIG = {
  development: {
    apiEndpoint: 'http://localhost:3001/api',
    cdnUrl: 'http://localhost:3000',
    domain: 'localhost:3000',
    enableDevTools: true,
    logLevel: 'debug'
  },
  staging: {
    apiEndpoint: process.env.REACT_APP_STAGING_API_ENDPOINT || 'https://staging-api.loomlance.com',
    cdnUrl: process.env.REACT_APP_STAGING_CDN_URL || 'https://staging-cdn.loomlance.com',
    domain: process.env.REACT_APP_STAGING_DOMAIN || 'staging.loomlance.com',
    enableDevTools: true,
    logLevel: 'info'
  },
  production: {
    apiEndpoint: process.env.REACT_APP_API_ENDPOINT || 'https://api.loomlance.com',
    cdnUrl: process.env.REACT_APP_CDN_URL || 'https://cdn.loomlance.com',
    domain: process.env.REACT_APP_DOMAIN || 'loomlance.com',
    enableDevTools: false,
    logLevel: 'error'
  }
}

// Get current environment configuration
export const getCurrentConfig = () => {
  if (isProduction) return ENV_CONFIG.production
  if (isStaging) return ENV_CONFIG.staging
  return ENV_CONFIG.development
}

// AWS SDK Configuration
export const configureAWS = () => {
  // This would be called in the main App component
  // to configure AWS SDK with proper credentials and region
  return {
    region: AWS_CONFIG.region,
    credentials: {
      // In production, these would be handled by IAM roles
      // or environment variables
      accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY
    }
  }
}

// Service endpoints
export const getServiceEndpoint = (service) => {
  const config = getCurrentConfig()
  switch (service) {
    case 'api':
      return config.apiEndpoint
    case 'cdn':
      return config.cdnUrl
    case 'auth':
      return `https://cognito-idp.${AWS_CONFIG.region}.amazonaws.com`
    default:
      return config.apiEndpoint
  }
}

// Feature flags for AWS services
export const FEATURE_FLAGS = {
  useAWSCognito: process.env.REACT_APP_USE_AWS_COGNITO === 'true',
  useDynamoDB: process.env.REACT_APP_USE_DYNAMODB === 'true',
  useS3Storage: process.env.REACT_APP_USE_S3_STORAGE === 'true',
  useCloudFront: process.env.REACT_APP_USE_CLOUDFRONT === 'true',
  enableAnalytics: process.env.REACT_APP_ENABLE_ANALYTICS === 'true'
}

export default AWS_CONFIG

