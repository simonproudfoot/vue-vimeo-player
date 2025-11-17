FROM node:18-alpine

# Install yarn using Alpine package manager
RUN apk add --no-cache yarn

# Set working directory
WORKDIR /app

# Copy root package files
COPY package.json yarn.lock ./

# Install root dependencies
RUN yarn install

# Copy test-app package files
COPY test-app/package.json test-app/yarn.lock ./test-app/

# Install test-app dependencies
WORKDIR /app/test-app
RUN yarn install

# Copy all project files
WORKDIR /app
COPY . .

# Expose port for Vite dev server
EXPOSE 3000

# Default command - run dev server
WORKDIR /app/test-app
CMD ["yarn", "dev", "--host", "0.0.0.0"]

