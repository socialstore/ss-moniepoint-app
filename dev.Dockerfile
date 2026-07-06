# Dev image for the Moniepoint marketplace app (Bun + Hono). The source is bind-mounted and hot-reloaded
# in docker-compose.development.yaml, mirroring the Go services' `air` setup — so this image only needs
# the Bun runtime; dependencies are installed against the mount at start.
FROM oven/bun:1.3.14
WORKDIR /app
EXPOSE 8080
CMD ["sh", "-c", "bun install && bun run --hot api/src/index.ts"]
