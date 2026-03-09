# Railway Deployment Checklist

Use this checklist to ensure your Railway deployment is configured correctly.

## ✅ Pre-Deployment Checklist

### Code & Configuration
- [x] Dockerfile created
- [x] start.sh script created and executable
- [x] application.yml updated with environment variables
- [x] railway.toml configuration added
- [x] .dockerignore created
- [x] .gitignore updated
- [x] gradlew made executable
- [x] Build tested successfully

### Railway Project Setup
- [ ] Railway account created
- [ ] New Railway project created
- [ ] PostgreSQL database added to project
- [ ] Repository connected to Railway project

### Environment Variables (Set in Railway Dashboard)
- [ ] `JWT_SECRET` - Generate using: `openssl rand -base64 64`
- [ ] `CORS_ALLOWED_ORIGINS` - Set to your frontend URL(s)
- [ ] `STRIPE_SECRET_KEY` (if using Stripe)
- [ ] `STRIPE_WEBHOOK_SECRET` (if using Stripe)

**Note**: `DATABASE_URL`, `PORT`, `DATABASE_USERNAME`, and `DATABASE_PASSWORD` are auto-configured by Railway.

### Git Repository
- [ ] All changes committed
- [ ] Changes pushed to repository
- [ ] Railway connected to correct branch

## 🚀 Deployment Steps

1. **Commit and push your changes:**
   ```bash
   git add .
   git commit -m "Configure Railway deployment with Docker"
   git push
   ```

2. **In Railway Dashboard:**
   - Go to your project
   - Click on "Settings"
   - Scroll to "Environment Variables"
   - Add the required variables listed above
   - Click "Deploy" or wait for auto-deploy

3. **Monitor the deployment:**
   - Watch the build logs
   - Wait for "Build successful" message
   - Wait for "Deployment successful" message

4. **Verify deployment:**
   - [ ] Application URL is accessible
   - [ ] Swagger UI loads: `https://your-app.railway.app/swagger-ui.html`
   - [ ] API endpoints respond correctly
   - [ ] Database connection works

## 🔍 Post-Deployment Verification

### Health Checks
1. **Access the main endpoint:**
   ```bash
   curl https://your-app.railway.app
   ```

2. **Check Swagger UI:**
   - Open `https://your-app.railway.app/swagger-ui.html` in browser
   - Verify all endpoints are listed

3. **Test an API endpoint:**
   - Try a simple GET endpoint from Swagger UI
   - Verify it returns expected response

### Logs Review
- [ ] Check Railway logs for any errors
- [ ] Verify database migrations ran (if applicable)
- [ ] Confirm application started successfully

## ⚠️ Troubleshooting

If something goes wrong, check:

1. **Build fails:**
   - Review build logs in Railway
   - Verify Gradle build works locally
   - Check Dockerfile syntax

2. **Deployment fails:**
   - Verify all environment variables are set
   - Check if database service is running
   - Review application startup logs

3. **App doesn't respond:**
   - Verify PORT environment variable
   - Check if Railway domain is correctly configured
   - Review application logs for runtime errors

4. **Database connection issues:**
   - Verify PostgreSQL service is running in Railway
   - Check DATABASE_URL is properly set
   - Review startup script logs

## 📚 Reference Documents

- `RAILWAY.md` - Detailed Railway deployment guide
- `DEPLOYMENT_FIXES.md` - Summary of all fixes applied
- `README.md` - General project documentation

## 🆘 Quick Commands

### Generate JWT Secret:
```bash
openssl rand -base64 64
```

### Test Docker build locally:
```bash
docker build -t triathlon-backend .
```

### Run Docker container locally:
```bash
docker run -p 8080:8080 \
  -e DATABASE_URL=jdbc:postgresql://localhost:5432/triathlon \
  -e DATABASE_USERNAME=postgres \
  -e DATABASE_PASSWORD=postgres \
  -e JWT_SECRET=test_secret \
  triathlon-backend
```

### Check Railway deployment status:
```bash
railway status
```

## ✨ Success Indicators

You'll know the deployment is successful when:
- ✅ Build completes without errors
- ✅ Application starts and logs show "Started TriathlonTeamBeApplication"
- ✅ Swagger UI is accessible
- ✅ API endpoints return valid responses
- ✅ No error logs in Railway dashboard

---

**Next Steps After Successful Deployment:**
1. Configure custom domain (optional)
2. Set up monitoring and alerts
3. Configure CORS for your actual frontend domain
4. Set up Stripe webhooks (if using payments)
5. Enable HTTPS (Railway does this automatically)
