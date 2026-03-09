# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application with SSR
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Expose port (Railway will provide PORT environment variable)
ENV PORT=4201
EXPOSE 4201

# Start the SSR server
CMD ["node", "dist/TriathlonTeamFE/server/server.mjs"]

