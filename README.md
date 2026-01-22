# Metabase Unified Dashboard

A beautiful, unified dashboard that combines multiple Metabase dashboards into a single view. Perfect for customers who need to see data from multiple databases in one place.

![Dashboard Preview](https://via.placeholder.com/800x400?text=Unified+Analytics+Dashboard)

## Features

- 🎯 **Unified View** - See all your Metabase dashboards in one place
- 🎨 **Modern UI** - Beautiful dark theme with smooth animations
- 📱 **Responsive** - Works on desktop, tablet, and mobile
- 🔄 **Auto-refresh** - Data refreshes automatically every 5 minutes
- 🔐 **Secure** - Connects to Metabase using session authentication or API keys
- ⚡ **Fast** - Lightweight and performant

## Quick Start

### 1. Install Dependencies

```bash
cd Combine
npm install
```

### 2. Configure Environment

Create a `.env` file in the root directory (copy from `env.example.txt`):

```env
# Metabase Configuration
METABASE_URL=https://your-metabase-instance.com
METABASE_USERNAME=your-email@example.com
METABASE_PASSWORD=your-password

# Or use API Key (preferred for production)
# METABASE_API_KEY=your-api-key

# Dashboard IDs (comma-separated)
DASHBOARD_IDS=1,2,3,4,5

# Server Configuration
PORT=3000
```

### 3. Find Your Dashboard IDs

Dashboard IDs can be found in the URL when viewing a dashboard in Metabase:
- `https://your-metabase.com/dashboard/123` → Dashboard ID is `123`

### 4. Start the Server

```bash
npm start
```

### 5. Open the Dashboard

Visit `http://localhost:3000` in your browser.

## Configuration Options

| Variable | Description | Required |
|----------|-------------|----------|
| `METABASE_URL` | Your Metabase instance URL | Yes |
| `METABASE_USERNAME` | Metabase login email | Yes* |
| `METABASE_PASSWORD` | Metabase login password | Yes* |
| `METABASE_API_KEY` | Metabase API key (alternative to username/password) | Yes* |
| `DASHBOARD_IDS` | Comma-separated list of dashboard IDs | Yes |
| `PORT` | Server port (default: 3000) | No |

*Either username/password OR API key is required.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/dashboards` | Get all configured dashboards |
| `GET /api/dashboard/:id` | Get specific dashboard details |
| `GET /api/dashboard/:id/embed` | Get embed URL for a dashboard |
| `GET /api/card/:id/query` | Execute a card/question query |
| `GET /api/health` | Check Metabase connection status |
| `GET /api/config` | Get current configuration status |

## Enabling Public Sharing in Metabase

For the best experience, enable public sharing for your dashboards in Metabase:

1. Go to **Admin** → **Settings** → **Public Sharing**
2. Enable **Enable Public Sharing**
3. For each dashboard, click the **Share** button and enable public link

This allows the unified dashboard to embed dashboards without requiring authentication for each view.

## Project Structure

```
Combine/
├── server.js           # Express backend server
├── package.json        # Node.js dependencies
├── env.example.txt     # Example environment configuration
├── README.md           # This file
└── public/
    ├── index.html      # Main HTML page
    ├── styles.css      # Styles and theme
    └── app.js          # Frontend JavaScript
```

## Troubleshooting

### "Connection Error" on startup

1. Verify your Metabase URL is correct and accessible
2. Check your username/password or API key
3. Ensure Metabase allows API access from your server

### Dashboards not loading

1. Verify the dashboard IDs exist in your Metabase instance
2. Check that the authenticated user has permission to view the dashboards
3. Look at the server console for detailed error messages

### Embedding not working

1. Enable public sharing in Metabase admin settings
2. Or ensure the user has proper permissions for authenticated embedding

## Security Considerations

- Never commit your `.env` file to version control
- Use API keys instead of passwords in production
- Consider using environment variables from your hosting platform
- Implement rate limiting for production deployments

## License

MIT License - Feel free to use and modify for your needs.
