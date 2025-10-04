// AWS Service Layer for LoomLance Dashboard
// This file contains all AWS service integrations

import AWS from 'aws-sdk'
import { AWS_CONFIG, getCurrentConfig, FEATURE_FLAGS } from '../config/aws'

// Configure AWS SDK
AWS.config.update({
  region: AWS_CONFIG.region,
  ...(FEATURE_FLAGS.useAWSCognito && {
    credentials: new AWS.CognitoIdentityCredentials({
      IdentityPoolId: process.env.REACT_APP_COGNITO_IDENTITY_POOL_ID
    })
  })
})

// Initialize AWS Services
const dynamodb = FEATURE_FLAGS.useDynamoDB ? new AWS.DynamoDB.DocumentClient() : null
const s3 = FEATURE_FLAGS.useS3Storage ? new AWS.S3() : null
const cognito = FEATURE_FLAGS.useAWSCognito ? new AWS.CognitoIdentityServiceProvider() : null

// Data Service for AWS DynamoDB
export class AWSDataService {
  constructor() {
    this.tableName = AWS_CONFIG.services.dynamodb.tableName
  }

  // Generic CRUD operations
  async createItem(item, type) {
    if (!dynamodb) {
      console.warn('DynamoDB not configured, falling back to localStorage')
      return this.fallbackToLocalStorage('create', type, item)
    }

    try {
      const params = {
        TableName: this.tableName,
        Item: {
          ...item,
          type,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }

      await dynamodb.put(params).promise()
      return item
    } catch (error) {
      console.error('Error creating item in DynamoDB:', error)
      throw error
    }
  }

  async getItems(type) {
    if (!dynamodb) {
      return this.fallbackToLocalStorage('read', type)
    }

    try {
      const params = {
        TableName: this.tableName,
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: {
          '#type': 'type'
        },
        ExpressionAttributeValues: {
          ':type': type
        }
      }

      const result = await dynamodb.scan(params).promise()
      return result.Items || []
    } catch (error) {
      console.error('Error getting items from DynamoDB:', error)
      return this.fallbackToLocalStorage('read', type)
    }
  }

  async updateItem(id, updates, type) {
    if (!dynamodb) {
      return this.fallbackToLocalStorage('update', type, { id, ...updates })
    }

    try {
      const params = {
        TableName: this.tableName,
        Key: { id, type },
        UpdateExpression: 'SET ' + Object.keys(updates).map(key => `#${key} = :${key}`).join(', ') + ', updatedAt = :updatedAt',
        ExpressionAttributeNames: Object.keys(updates).reduce((acc, key) => {
          acc[`#${key}`] = key
          return acc
        }, {}),
        ExpressionAttributeValues: {
          ...Object.keys(updates).reduce((acc, key) => {
            acc[`:${key}`] = updates[key]
            return acc
          }, {}),
          ':updatedAt': new Date().toISOString()
        }
      }

      await dynamodb.update(params).promise()
      return { id, ...updates }
    } catch (error) {
      console.error('Error updating item in DynamoDB:', error)
      throw error
    }
  }

  async deleteItem(id, type) {
    if (!dynamodb) {
      return this.fallbackToLocalStorage('delete', type, { id })
    }

    try {
      const params = {
        TableName: this.tableName,
        Key: { id, type }
      }

      await dynamodb.delete(params).promise()
      return { id }
    } catch (error) {
      console.error('Error deleting item from DynamoDB:', error)
      throw error
    }
  }

  // Fallback to localStorage when AWS services are not available
  fallbackToLocalStorage(operation, type, data = null) {
    const storageKey = `loomlance-${type}`
    let items = JSON.parse(localStorage.getItem(storageKey) || '[]')

    switch (operation) {
      case 'create':
        items.push(data)
        break
      case 'read':
        return items
      case 'update':
        const updateIndex = items.findIndex(item => item.id === data.id)
        if (updateIndex !== -1) {
          items[updateIndex] = { ...items[updateIndex], ...data }
        }
        break
      case 'delete':
        items = items.filter(item => item.id !== data.id)
        break
    }

    localStorage.setItem(storageKey, JSON.stringify(items))
    return data
  }
}

// File Storage Service for AWS S3
export class AWSFileService {
  constructor() {
    this.bucketName = AWS_CONFIG.services.s3.bucketName
  }

  async uploadFile(file, key) {
    if (!s3) {
      console.warn('S3 not configured, file upload not available')
      return null
    }

    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: file.type,
        ACL: 'public-read'
      }

      const result = await s3.upload(params).promise()
      return result.Location
    } catch (error) {
      console.error('Error uploading file to S3:', error)
      throw error
    }
  }

  async deleteFile(key) {
    if (!s3) {
      console.warn('S3 not configured, file deletion not available')
      return false
    }

    try {
      const params = {
        Bucket: this.bucketName,
        Key: key
      }

      await s3.deleteObject(params).promise()
      return true
    } catch (error) {
      console.error('Error deleting file from S3:', error)
      return false
    }
  }

  getFileUrl(key) {
    if (!s3) return null
    return `https://${this.bucketName}.s3.${AWS_CONFIG.region}.amazonaws.com/${key}`
  }
}

// Authentication Service for AWS Cognito
export class AWSAuthService {
  constructor() {
    this.userPoolId = AWS_CONFIG.services.cognito.userPoolId
    this.clientId = AWS_CONFIG.services.cognito.clientId
  }

  async signUp(email, password, userAttributes = {}) {
    if (!cognito) {
      console.warn('Cognito not configured, authentication not available')
      return null
    }

    try {
      const params = {
        ClientId: this.clientId,
        Username: email,
        Password: password,
        UserAttributes: Object.keys(userAttributes).map(key => ({
          Name: key,
          Value: userAttributes[key]
        }))
      }

      const result = await cognito.signUp(params).promise()
      return result
    } catch (error) {
      console.error('Error signing up user:', error)
      throw error
    }
  }

  async signIn(email, password) {
    if (!cognito) {
      console.warn('Cognito not configured, authentication not available')
      return null
    }

    try {
      const params = {
        ClientId: this.clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      }

      const result = await cognito.initiateAuth(params).promise()
      return result
    } catch (error) {
      console.error('Error signing in user:', error)
      throw error
    }
  }

  async signOut() {
    // Implementation for signing out
    localStorage.removeItem('aws-token')
    localStorage.removeItem('aws-refresh-token')
  }
}

// Analytics Service for AWS CloudWatch
export class AWSAnalyticsService {
  constructor() {
    this.enabled = FEATURE_FLAGS.enableAnalytics
  }

  trackEvent(eventName, properties = {}) {
    if (!this.enabled) return

    try {
      // In a real implementation, this would send data to CloudWatch
      console.log('Analytics Event:', eventName, properties)
      
      // Example: Send to CloudWatch Logs
      const logData = {
        timestamp: new Date().toISOString(),
        event: eventName,
        properties,
        userId: localStorage.getItem('user-id'),
        sessionId: localStorage.getItem('session-id')
      }

      // This would be implemented with CloudWatch Logs API
      console.log('CloudWatch Log:', logData)
    } catch (error) {
      console.error('Error tracking analytics event:', error)
    }
  }

  trackPageView(pageName, properties = {}) {
    this.trackEvent('page_view', {
      page: pageName,
      ...properties
    })
  }

  trackUserAction(action, properties = {}) {
    this.trackEvent('user_action', {
      action,
      ...properties
    })
  }
}

// Export service instances
export const dataService = new AWSDataService()
export const fileService = new AWSFileService()
export const authService = new AWSAuthService()
export const analyticsService = new AWSAnalyticsService()

// Utility function to check if AWS services are available
export const isAWSAvailable = () => {
  return {
    dynamodb: !!dynamodb,
    s3: !!s3,
    cognito: !!cognito,
    analytics: FEATURE_FLAGS.enableAnalytics
  }
}

export default {
  dataService,
  fileService,
  authService,
  analyticsService,
  isAWSAvailable
}
