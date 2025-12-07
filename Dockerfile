# Use a lightweight Node.js image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Initialize project (creates package.json automatically)
RUN npm init -y

# Install WebSocket library
RUN npm install ws

# Copy server code
COPY server.js .

# Expose the port the app runs on
EXPOSE 3000

# Start the server
CMD [ "node", "server.js" ]
