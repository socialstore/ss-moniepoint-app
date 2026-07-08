# Production image for the Moniepoint marketplace app (Bun + Hono backend + Vite/React frontend).
# Multi-stage build: compile the UI, install production dependencies, and serve both from a lean runtime.
FROM oven/bun:alpine AS build
WORKDIR /opt/app

# Install build dependencies (nodejs required for Vite build tooling)
RUN apk update && \
    apk add nodejs && \
    rm -rf /var/cache/apk/* > /dev/null 2>&1

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Copy workspace configuration and dependency manifests
COPY package.json bun.lock tsconfig.json ./
COPY api/package.json ./api/
COPY ui/package.json ./ui/

# Install all dependencies (including dev dependencies needed for UI build)
RUN bun install

# Copy source code
COPY api ./api
COPY ui ./ui
COPY scripts ./scripts

# Build the UI (outputs to ui/dist)
RUN bun run build:ui

# Install production-only dependencies (clean node_modules for runtime)
RUN rm -rf node_modules && bun install --production

# --------------------------------

FROM oven/bun:alpine
WORKDIR /opt/service

# Install runtime dependencies (curl for health checks)
RUN apk add curl && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN adduser --system --disabled-password --gecos '' container && \
    addgroup --system container && \
    adduser container container

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Copy production node_modules from build stage
COPY --chown=container:container --from=build /opt/app/node_modules ./node_modules
COPY --chown=container:container --from=build /opt/app/api/node_modules ./api/node_modules
COPY --chown=container:container --from=build /opt/app/ui/node_modules ./ui/node_modules

# Copy API source (Bun runs TypeScript directly, no compilation needed)
COPY --chown=container:container --from=build /opt/app/api/src ./api/src
COPY --chown=container:container --from=build /opt/app/api/package.json ./api/

# Copy built UI assets
COPY --chown=container:container --from=build /opt/app/ui/dist ./ui/dist

# Copy workspace configuration
COPY --chown=container:container --from=build /opt/app/package.json ./

USER container
EXPOSE 8080

# Run the API server (which also serves the built UI at /*)
CMD ["bun", "run", "api/src/index.ts"]
