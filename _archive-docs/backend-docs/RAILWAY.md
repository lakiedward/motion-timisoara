# Railway Deployment Guide

This document explains how to deploy the Triathlon Team Backend application to Railway.

## Prerequisites

1. A Railway account (https://railway.app)
2. A Railway project with a PostgreSQL database

## Deployment Steps

1. **Connect your repository** to Railway or deploy via CLI
2. **Add a PostgreSQL database** to your Railway project (if not already added)
3. **Configure environment variables** (see below)
4. **Deploy** - Railway will automatically detect the Dockerfile and build/deploy

## Required Environment Variables

Set these in your Railway project settings:

### Database (Auto-configured)
Railway automatically provides `DATABASE_URL` when you add a PostgreSQL database. The startup script will convert it to the correct format.

### JWT Configuration
- `JWT_SECRET` - Secret key for JWT token signing (use a strong random string)
  - Example: Generate with: `openssl rand -base64 64`
- `JWT_EXPIRATION_MINUTES` - Token expiration time in minutes (default: 120)

### CORS Configuration (REQUIRED)
- `CORS_ALLOWED_ORIGINS` - **REQUIRED** Comma-separated list of allowed frontend origins
  - Example: `https://your-frontend.com,https://www.your-frontend.com`
  - **Important**: Must be set to avoid 403 CORS errors. Wildcard (`*`) is not allowed when using credentials.
  - See `CORS_FIX.md` for detailed troubleshooting

### Stripe Configuration (if using payment features)
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Your Stripe webhook secret

### Optional
- `PORT` - Application port (Railway auto-sets this, default: 8080)
- `FLYWAY_ENABLED` - Enable/disable Flyway migrations (default: false)

## Example Environment Variables

```bash
JWT_SECRET=your_very_long_and_secure_random_string_here
JWT_EXPIRATION_MINUTES=120
CORS_ALLOWED_ORIGINS=https://your-frontend.railway.app
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## Troubleshooting

### Build Failures
- Ensure your Railway project has enough resources
- Check the build logs for Gradle errors
- Verify that all dependencies are correctly specified in `build.gradle.kts`

### Runtime Errors
- Verify database connection: Check that PostgreSQL service is running
- Check environment variables: Ensure all required variables are set
- Review application logs in Railway dashboard

### Database Connection Issues
- The startup script automatically converts Railway's `DATABASE_URL` to Spring Boot's JDBC format
- If issues persist, manually set:
  - `DATABASE_URL=jdbc:postgresql://host:port/dbname?sslmode=require`
  - `DATABASE_USERNAME=your_username`
  - `DATABASE_PASSWORD=your_password`

## Health Check

Once deployed, verify the application is running:
- Main endpoint: `https://your-app.railway.app`
- Swagger UI: `https://your-app.railway.app/swagger-ui.html`
- Health check: `https://your-app.railway.app/actuator/health` (if actuator is enabled)

## Local Development

To run locally with the same configuration:

```bash
export DATABASE_URL=jdbc:postgresql://localhost:5432/triathlon
export DATABASE_USERNAME=postgres
export DATABASE_PASSWORD=your_local_password
export JWT_SECRET=local_dev_secret
export CORS_ALLOWED_ORIGINS=http://localhost:4200

./gradlew bootRun
```

## Notes

- The application uses JDK 21
- The build process uses Gradle 8.5
- PostgreSQL SSL mode is required for Railway connections
- The Docker image uses a multi-stage build for optimization
