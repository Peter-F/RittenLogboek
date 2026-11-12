# ==============================================================================
# Stage 1: Build frontend assets
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci || npm install

# Copy source code and configuration files
COPY . .

# Build the client PWA (outputs to /app/dist)
RUN npm run build

# ==============================================================================
# Stage 2: Production runner
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install curl for container HEALTHCHECK
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3000

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies only (tsx is in dependencies)
RUN npm install --omit=dev

# Copy compiled frontend from builder
COPY --from=builder /app/dist ./dist

# Copy backend server code, db schemas, and config
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server ./server
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

# Run as non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001 -G nodejs
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Expose HTTP port
EXPOSE 3000

# Health check to ensure server responds
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/db/status || exit 1

# Start the full-stack server
CMD ["npm", "start"]
