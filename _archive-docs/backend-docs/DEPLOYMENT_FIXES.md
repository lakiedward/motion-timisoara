# Railway Deployment Fixes - Summary

## Problem
Railway was unable to run the application because:
1. No Dockerfile or build configuration was provided
2. Railway couldn't find the JAR file (error: `ls: cannot access '*/build/libs/*jar'`)
3. Hardcoded database credentials and other sensitive values in `application.yml`
4. Missing environment variable configuration

## Solutions Implemented

### 1. Created Dockerfile (`Dockerfile`)
A multi-stage Docker build configuration that:
- Uses Gradle 8.5 with JDK 21 for building
- Builds the Spring Boot JAR using `bootJar` task
- Uses Eclipse Temurin JRE 21 for runtime (smaller image)
- Properly copies and executes the application

### 2. Created Startup Script (`start.sh`)
A bash script that:
- Converts Railway's PostgreSQL URL format to Spring Boot's JDBC format
- Extracts database credentials from Railway's `DATABASE_URL`
- Sets appropriate environment variables
- Starts the Spring Boot application with proper configuration

### 3. Updated Application Configuration (`src/main/resources/application.yml`)
Changed from hardcoded values to environment variables:

| Configuration | Environment Variable | Default |
|--------------|---------------------|---------|
| Database URL | `DATABASE_URL` | `jdbc:postgresql://localhost:5432/triathlon` |
| Database Username | `DATABASE_USERNAME` | `postgres` |
| Database Password | `DATABASE_PASSWORD` | `postgres` |
| Server Port | `PORT` | `8080` |
| JWT Secret | `JWT_SECRET` | Local dev value |
| JWT Expiration | `JWT_EXPIRATION_MINUTES` | `120` |
| CORS Origins | `CORS_ALLOWED_ORIGINS` | `http://localhost:4200` |
| Stripe Secret Key | `STRIPE_SECRET_KEY` | Test value |
| Stripe Webhook Secret | `STRIPE_WEBHOOK_SECRET` | Test value |

### 4. Created Railway Configuration (`railway.toml`)
Explicitly tells Railway to:
- Use the Dockerfile for building
- Use the startup script for running
- Configure restart policy for reliability

### 5. Created `.dockerignore`
Optimizes Docker builds by excluding:
- Build outputs (`build/`, `target/`)
- IDE files (`.idea/`, `.vscode/`)
- Git directory
- Temporary files

### 6. Updated Documentation
- Updated `README.md` with:
  - Correct JDK version (21)
  - Deployment instructions
  - Docker build/run commands
- Created `RAILWAY.md` with comprehensive Railway deployment guide
- This summary document

### 7. Updated `.gitignore`
Added `target/` directory to prevent Maven build artifacts from being committed.

## What You Need to Do Now

### 1. Set Environment Variables in Railway

Go to your Railway project settings and add these environment variables:

#### Required:
```bash
JWT_SECRET=<generate-a-strong-random-secret>
CORS_ALLOWED_ORIGINS=<your-frontend-url>
```

#### Optional (if using Stripe):
```bash
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

To generate a strong JWT secret:
```bash
openssl rand -base64 64
```

### 2. Commit and Push Changes

```bash
git add .
git commit -m "Add Railway deployment configuration and fix build issues"
git push
```

### 3. Deploy on Railway

If your Railway project is connected to your Git repository, it will automatically:
1. Detect the Dockerfile
2. Build the Docker image
3. Deploy the application

### 4. Verify Deployment

Once deployed, check:
- Application logs in Railway dashboard
- Access your app at: `https://your-app.railway.app`
- API documentation: `https://your-app.railway.app/swagger-ui.html`

## Files Created/Modified

### Created:
- `Dockerfile` - Multi-stage build configuration
- `start.sh` - Startup script for database URL conversion
- `.dockerignore` - Docker build optimization
- `railway.toml` - Railway deployment configuration
- `RAILWAY.md` - Detailed deployment guide
- `DEPLOYMENT_FIXES.md` - This summary document

### Modified:
- `src/main/resources/application.yml` - Environment variable configuration
- `README.md` - Updated prerequisites and deployment info
- `.gitignore` - Added target/ directory
- `gradlew` - Made executable (chmod +x)

## Technical Details

### Build Process
1. Railway detects `Dockerfile`
2. Docker builds using Gradle wrapper
3. Gradle compiles Kotlin code and creates JAR
4. Runtime image copies JAR and startup script
5. Application starts with environment-specific configuration

### Database Connection Flow
1. Railway provides: `postgresql://user:pass@host:port/db`
2. Startup script converts to: `jdbc:postgresql://host:port/db?sslmode=require`
3. Script sets `DATABASE_USERNAME` and `DATABASE_PASSWORD`
4. Spring Boot connects using these values

### Why This Fixes the Error
The original error "cannot access '*/build/libs/*jar'" occurred because:
- Railway had no instructions on how to build the project
- It tried to run a JAR that didn't exist
- Now with the Dockerfile, Railway:
  1. Builds the JAR during the build phase
  2. Copies it to a known location (`/app/app.jar`)
  3. Runs it using the startup script

## Troubleshooting

If deployment still fails:

1. **Check build logs**: Look for Gradle or Docker errors
2. **Verify environment variables**: Ensure all required vars are set
3. **Check database connection**: Verify PostgreSQL service is running
4. **Review application logs**: Check for startup errors

See `RAILWAY.md` for more detailed troubleshooting steps.

## Notes

- The application now uses port 8080 (configurable via `PORT` env var)
- Database connections require SSL (`sslmode=require`)
- Both Maven (`pom.xml`) and Gradle (`build.gradle.kts`) configs exist, but Gradle is used
- The project requires JDK 21
- Build time is approximately 1-2 minutes on Railway
