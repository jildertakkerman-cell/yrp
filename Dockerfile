# Multi-stage Dockerfile for YRP Replay Analyzer
# Optimized for Google Cloud Run deployment

# ============================================
# Build Stage - Compile TypeScript & Native Addons
# ============================================
FROM node:18-slim AS builder

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* yarn.lock* ./

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# ============================================
# Production Stage - Minimal runtime image
# ============================================
FROM node:18-slim AS production

# Install runtime dependencies for native modules
RUN apt-get update && apt-get install -y \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* yarn.lock* ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist.es2015 ./dist.es2015
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/lib ./lib

# Cloud Run uses PORT env variable, default to 8080
ENV PORT=8080
ENV NODE_ENV=production

# Expose the port
EXPOSE 8080

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080), (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the server
CMD ["node", "dist/server.js"]
