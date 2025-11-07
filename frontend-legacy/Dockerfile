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

# Default command - copy build to shared volume
CMD ["sh", "-c", "cp -r /app/build/* /shared/ && echo 'Frontend built successfully'"]