# Build stage for React app
FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the app (API_BASE_URL will be empty for relative URLs)
RUN npm run build

# Copy build files to shared volume
VOLUME ["/app/build"]

# Default command
CMD ["sh", "-c", "echo 'Frontend build complete'"]