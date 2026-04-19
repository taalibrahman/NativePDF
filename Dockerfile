# Use an official, lightweight Node.js environment
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy the package.json and install dependencies separately to cache the layer
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Expose Vite's default dev server port
EXPOSE 5173

# The CMD is executed when running the container
CMD ["npm", "run", "dev"]
