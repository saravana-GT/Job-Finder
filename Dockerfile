# Multi-stage production Dockerfile
# Stage 1: Build & Dependencies installer
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Runtime image runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only production node modules and project structure
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY public ./public
COPY incoming ./incoming

EXPOSE 3000
CMD ["node", "src/app.js"]
