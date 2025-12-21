# Use Node.js LTS with build tools for native addons
FROM node:18-bullseye-slim as builder

# Install build dependencies for native addons (node-gyp)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json yarn.lock* package-lock.json* ./

# Copy native addon source files (needed for node-gyp build)
COPY binding.gyp ./
COPY lib/ ./lib/

# Install dependencies (this will also build native addons)
RUN npm install

# Copy the rest of the application
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-bullseye-slim

# Install runtime dependencies for native addons
RUN apt-get update && apt-get install -y \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist.es2015 ./dist.es2015
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/build ./build

# Cloud Run will set the PORT environment variable
ENV PORT=8080
ENV NODE_ENV=production

# Expose the port Cloud Run expects
EXPOSE 8080

# Run as non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --gid 1001 nodeuser
USER nodeuser

# Start the application
CMD ["node", "dist/server.js"]
