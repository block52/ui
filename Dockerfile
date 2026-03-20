# Frontend UI Dockerfile
# Build stage
FROM node:22.12-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile && yarn cache clean

# Copy source code and build
COPY . .
RUN yarn build

# Production stage
FROM node:22.12-alpine

RUN npm install -g serve

WORKDIR /app

# Copy built assets from build stage
COPY --from=build /app/build ./build

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5173/ || exit 1

CMD ["serve", "-s", "build", "-l", "5173"]
