# Multiplayer Piano

A real-time multiplayer piano web application where multiple users can play piano together.

## Features
- Real-time multiplayer piano playing
- WebSocket-based communication
- Full 88-key piano support
- Chat functionality
- Room system

## Prerequisites
- Node.js >= 14.0.0
- npm (comes with Node.js)

## Local Development
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Visit `http://localhost:3000` in your browser

## Deployment

### Option 1: Deploy to Render (Recommended for beginners)

1. Create a [Render](https://render.com/) account
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Fill in the following settings:
   - Name: your-app-name
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Click "Create Web Service"

### Option 2: Deploy to a VPS (DigitalOcean, Linode, etc.)

1. SSH into your server:
   ```bash
   ssh user@your-server-ip
   ```

2. Install Node.js and npm:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. Clone your repository:
   ```bash
   git clone https://github.com/your-username/your-repo.git
   cd your-repo
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Install PM2 (process manager):
   ```bash
   sudo npm install -g pm2
   ```

6. Start the application:
   ```bash
   pm2 start server.js
   ```

7. Set up Nginx as a reverse proxy:
   ```bash
   sudo apt-get install nginx
   ```

8. Configure Nginx (`/etc/nginx/sites-available/default`):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

9. Restart Nginx:
   ```bash
   sudo service nginx restart
   ```

## Environment Variables
- `PORT`: The port the server will run on (default: 3000)

## License
ISC 