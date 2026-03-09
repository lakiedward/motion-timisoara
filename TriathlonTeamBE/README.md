# TriathlonTeamBE

This repository hosts the Kotlin/Spring Boot backend for the Triathlon Team application. It exposes the API consumed by the companion Angular frontend located in the `TriathlonTeamFE` project.

## Prerequisites
- JDK 21 or newer
- Gradle wrapper (bundled in this repo)
- PostgreSQL database

## Run the backend locally
```bash
./gradlew bootRun
```
This launches the `TriathlonTeamBeApplication` main class and starts the REST API on port 8081 by default (`server.port: ${PORT:8081}`). Set the `PORT` env var to override.

## Run tests
```bash
./gradlew test
```
Executes the unit tests using JUnit 5.

## Deployment

### Railway
See [../BACKEND_DEPLOYMENT_CHECKLIST.md](../BACKEND_DEPLOYMENT_CHECKLIST.md) for detailed Railway deployment instructions, including:
- Environment variable configuration
- Database setup
- Troubleshooting tips

### Docker
Build and run using Docker:
```bash
docker build -t triathlon-backend .
docker run -p 8080:8080 \
  -e PORT=8080 \
  -e DATABASE_URL=jdbc:postgresql://host:port/db \
  -e JWT_SECRET=your_secret \
  triathlon-backend
```

## API Documentation
Once running, access the Swagger UI at:
- Local: http://localhost:8081/swagger-ui.html
- Production: https://your-domain.com/swagger-ui.html

## Useful links
- Frontend repository: `TriathlonTeamFE`
