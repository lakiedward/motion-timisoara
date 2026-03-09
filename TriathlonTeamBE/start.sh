#!/bin/bash

# Convert Railway's DATABASE_URL to JDBC format if provided
if [ -n "$DATABASE_URL" ]; then
    # Railway provides: postgresql://user:pass@host:port/db
    # Spring needs: jdbc:postgresql://host:port/db

    # Extract components from DATABASE_URL
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASS="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"

        # Set Spring Boot compatible environment variables
        export DATABASE_USERNAME="$DB_USER"
        export DATABASE_PASSWORD="$DB_PASS"
        export DATABASE_URL="jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require"

        echo "Database connection configured for Railway"
    fi
fi

# Explicitly disable server SSL unless a keystore is configured
# This prevents Spring Boot from trying to enable SSL without proper certificates
if [ -z "$SERVER_SSL_KEY_STORE" ] && [ -z "$SERVER_SSL_BUNDLE" ]; then
    export SERVER_SSL_ENABLED=false
    echo "Server SSL disabled (no keystore configured)"
else
    echo "Server SSL configuration detected"
fi

# Start the Spring Boot application
exec java $JAVA_OPTS -jar /app/app.jar "$@"
