# 🚀 AWS Deployment Guide for LoomLance Dashboard

This guide will help you deploy your LoomLance dashboard to AWS using AWS Amplify.

## Prerequisites

- AWS Account
- GitHub repository with your LoomLance project
- Domain name (optional, but recommended)

## Method 1: AWS Amplify (Recommended)

### Step 1: Connect to AWS Amplify

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click "New app" → "Host web app"
3. Choose "GitHub" as your source
4. Authorize GitHub and select your repository
5. Select the branch (usually `main` or `master`)

### Step 2: Configure Build Settings

AWS Amplify will automatically detect your build settings from the `amplify.yml` file, but you can verify:

- **Build command**: `npm run build`
- **Output directory**: `dist`
- **Node version**: 18.x (or latest)

### Step 3: Deploy

1. Click "Save and deploy"
2. Wait for the build to complete (usually 2-5 minutes)
3. Your app will be available at the provided Amplify URL

### Step 4: Custom Domain (Optional)

1. In Amplify Console, go to "Domain management"
2. Click "Add domain"
3. Enter your domain name (e.g., `loomlance.com`)
4. Follow the DNS configuration instructions
5. SSL certificate will be automatically provisioned

## Method 2: S3 + CloudFront

### Step 1: Create S3 Bucket

```bash
# Create bucket
aws s3 mb s3://loomlance-dashboard-prod

# Configure for static website hosting
aws s3 website s3://loomlance-dashboard-prod --index-document index.html --error-document index.html
```

### Step 2: Build and Upload

```bash
# Build the project
npm run build:prod

# Upload to S3
aws s3 sync dist/ s3://loomlance-dashboard-prod --delete
```

### Step 3: Configure CloudFront

1. Create CloudFront distribution
2. Set origin to your S3 bucket
3. Configure custom error pages (404 → index.html)
4. Set up SSL certificate

## Method 3: EC2 Deployment

### Step 1: Launch EC2 Instance

1. Launch Ubuntu 20.04 LTS instance
2. Configure security groups (ports 22, 80, 443)
3. Install Node.js and PM2

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt update
sudo apt install nginx
```

### Step 2: Deploy Application

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/loomlance-dashboard.git
cd loomlance-dashboard

# Install dependencies
npm install

# Build application
npm run build

# Start with PM2
pm2 start npm --name "loomlance" -- start
pm2 save
pm2 startup
```

### Step 3: Configure Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Environment Variables

Create a `.env` file for production:

```env
NODE_ENV=production
VITE_API_URL=https://api.loomlance.com
VITE_APP_NAME=LoomLance
```

## Performance Optimization

### Build Optimizations

The `vite.config.js` includes:
- Code splitting
- Tree shaking
- Minification
- Asset optimization

### CDN Configuration

For better performance:
1. Enable CloudFront caching
2. Set appropriate cache headers
3. Use S3 transfer acceleration

## Monitoring and Logs

### AWS Amplify
- Built-in monitoring dashboard
- Automatic deployments on git push
- SSL certificate management

### CloudWatch
- Application logs
- Performance metrics
- Error tracking

## Security Considerations

1. **HTTPS Only**: Force HTTPS redirects
2. **CORS**: Configure appropriate CORS policies
3. **Headers**: Set security headers
4. **WAF**: Consider AWS WAF for DDoS protection

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version (18+)
   - Verify all dependencies are installed
   - Check for TypeScript errors

2. **Routing Issues**
   - Configure SPA routing in CloudFront
   - Set up custom error pages

3. **Performance Issues**
   - Enable gzip compression
   - Optimize images
   - Use CDN caching

### Debug Commands

```bash
# Check build locally
npm run build
npm run preview

# Check Amplify logs
amplify status
amplify logs
```

## Cost Optimization

### AWS Amplify
- Free tier: 1,000 build minutes/month
- Pay per build minute after free tier

### S3 + CloudFront
- S3: ~$0.023/GB/month
- CloudFront: ~$0.085/GB transfer

### EC2
- t3.micro: ~$8.50/month
- Additional costs for data transfer

## Next Steps

1. Set up monitoring and alerts
2. Configure backup strategies
3. Implement CI/CD pipelines
4. Add performance monitoring
5. Set up error tracking (Sentry, etc.)

## Support

For deployment issues:
- Check AWS documentation
- Review Amplify console logs
- Contact AWS support if needed

---

**Ready to deploy?** Choose your preferred method and follow the steps above!
