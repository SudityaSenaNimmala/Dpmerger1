const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Metabase configuration
const METABASE_URL = (process.env.METABASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const METABASE_USERNAME = process.env.METABASE_USERNAME;
const METABASE_PASSWORD = process.env.METABASE_PASSWORD;
const METABASE_API_KEY = process.env.METABASE_API_KEY;
const DASHBOARD_IDS = (process.env.DASHBOARD_IDS || '42,43,51,52,81').split(',').map(id => id.trim());

let sessionToken = null;
let sessionExpiry = null;

// Complete Dashboard and Card mapping based on Metabase structure
const DASHBOARD_CONFIG = {
    // Main summary dashboards (42, 43, 51, 52, 81)
    main: DASHBOARD_IDS.map((id, index) => ({
        id: parseInt(id),
        name: `Washington Post ${index + 1}`,
        shortName: `WP${index + 1}`,
        index: index
    })),
    // Job details dashboards
    jobDetails: {
        'WP1': { dashboardId: 29, jobListCardId: 143 },
        'WP2': { dashboardId: 37, jobListCardId: 161 },
        'WP3': { dashboardId: 46, jobListCardId: 176 },
        'WP4': { dashboardId: 55, jobListCardId: 191 },
        'WP5': { dashboardId: 76, jobListCardId: 221 }
    },
    // Workspace details dashboards
    workspaceDetails: {
        'WP1': { 
            dashboardId: 30, 
            workspaceListCardId: 156,
            fileFolderStatusCardId: 137,
            hyperlinksStatusCardId: 140,
            permissionsStatusCardId: 149,
            workspaceDataSizeCardId: 144,
            totalFileSizeCardId: 152
        },
        'WP2': { 
            dashboardId: 38, 
            workspaceListCardId: 164,
            fileFolderStatusCardId: 157,
            hyperlinksStatusCardId: 160,
            permissionsStatusCardId: 167,
            workspaceDataSizeCardId: 162,
            totalFileSizeCardId: 170
        },
        'WP3': { 
            dashboardId: 47, 
            workspaceListCardId: 179,
            fileFolderStatusCardId: 172,
            hyperlinksStatusCardId: 175,
            permissionsStatusCardId: 182,
            workspaceDataSizeCardId: 177,
            totalFileSizeCardId: 185
        },
        'WP4': { 
            dashboardId: 56, 
            workspaceListCardId: 194,
            fileFolderStatusCardId: 187,
            hyperlinksStatusCardId: 190,
            permissionsStatusCardId: 197,
            workspaceDataSizeCardId: 192,
            totalFileSizeCardId: 200
        },
        'WP5': { 
            dashboardId: 77, 
            workspaceListCardId: 224,
            fileFolderStatusCardId: 217,
            hyperlinksStatusCardId: 220,
            permissionsStatusCardId: 227,
            workspaceDataSizeCardId: 222,
            totalFileSizeCardId: 230
        }
    },
    // File/Folder Info dashboards
    fileFolderInfo: {
        'WP1': { dashboardId: 27, conflictsCardId: 136, filesListCardId: 138 },
        'WP2': { dashboardId: 35, conflictsCardId: 154, filesListCardId: 156 },
        'WP3': { dashboardId: 44, conflictsCardId: 169, filesListCardId: 171 },
        'WP4': { dashboardId: 53, conflictsCardId: 184, filesListCardId: 186 },
        'WP5': { dashboardId: 74, conflictsCardId: 214, filesListCardId: 216 }
    },
    // HyperLinks dashboards
    hyperlinks: {
        'WP1': { dashboardId: 28, hyperlinksListCardId: 139 },
        'WP2': { dashboardId: 36, hyperlinksListCardId: 159 },
        'WP3': { dashboardId: 45, hyperlinksListCardId: 174 },
        'WP4': { dashboardId: 54, hyperlinksListCardId: 189 },
        'WP5': { dashboardId: 75, hyperlinksListCardId: 219 }
    },
    // Permissions/Collaboration dashboards
    permissions: {
        'WP1': { dashboardId: 31, permissionsListCardId: 148 },
        'WP2': { dashboardId: 39, permissionsListCardId: 166 },
        'WP3': { dashboardId: 48, permissionsListCardId: 181 },
        'WP4': { dashboardId: 57, permissionsListCardId: 196 },
        'WP5': { dashboardId: 78, permissionsListCardId: 226 }
    }
};

// Get Metabase session token
async function getSessionToken(forceRefresh = false) {
    if (METABASE_API_KEY) {
        return METABASE_API_KEY;
    }
    
    if (sessionToken && sessionExpiry && Date.now() < sessionExpiry && !forceRefresh) {
        return sessionToken;
    }

    try {
        console.log(`Authenticating with Metabase at ${METABASE_URL}...`);
        
        const response = await axios.post(`${METABASE_URL}/api/session`, {
            username: METABASE_USERNAME,
            password: METABASE_PASSWORD
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        
        sessionToken = response.data.id;
        sessionExpiry = Date.now() + (12 * 60 * 60 * 1000);
        console.log('Successfully authenticated with Metabase!');
        return sessionToken;
    } catch (error) {
        console.error('Failed to get Metabase session:', error.response?.data || error.message);
        sessionToken = null;
        sessionExpiry = null;
        throw error;
    }
}

// Get headers for Metabase API requests
async function getHeaders(forceRefresh = false) {
    const token = await getSessionToken(forceRefresh);
    if (METABASE_API_KEY) {
        return { 'X-API-KEY': token };
    }
    return { 'X-Metabase-Session': token };
}

// Make authenticated request with retry on auth failure
async function makeMetabaseRequest(method, endpoint, data = null) {
    try {
        const headers = await getHeaders();
        const config = { 
            method,
            url: `${METABASE_URL}${endpoint}`,
            headers,
            timeout: 60000
        };
        if (data) config.data = data;
        
        const response = await axios(config);
        return response.data;
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('Session expired, refreshing...');
            const headers = await getHeaders(true);
            const config = { 
                method,
                url: `${METABASE_URL}${endpoint}`,
                headers,
                timeout: 60000
            };
            if (data) config.data = data;
            
            const response = await axios(config);
            return response.data;
        }
        throw error;
    }
}

// Query a Metabase card with parameters
async function queryCard(cardId, parameters = {}) {
    try {
        const paramArray = Object.entries(parameters).map(([key, value]) => ({
            type: 'category',
            value: value,
            target: ['variable', ['template-tag', key]]
        }));
        
        const result = await makeMetabaseRequest('POST', `/api/card/${cardId}/query`, {
            parameters: paramArray
        });
        
        return result;
    } catch (error) {
        console.error(`Failed to query card ${cardId}:`, error.message);
        return null;
    }
}

// Parse card result into array of objects
function parseCardResult(result) {
    if (!result || !result.data || !result.data.rows) {
        return [];
    }
    
    const cols = result.data.cols.map(c => c.name);
    return result.data.rows.map(row => {
        const obj = {};
        cols.forEach((col, i) => {
            obj[col] = row[i];
        });
        return obj;
    });
}

// API: Get all dashboards info
app.get('/api/dashboards', async (req, res) => {
    try {
        const dashboards = await Promise.all(
            DASHBOARD_IDS.map(async (id) => {
                try {
                    const data = await makeMetabaseRequest('GET', `/api/dashboard/${id}`);
                    return data;
                } catch (error) {
                    console.error(`Failed to fetch dashboard ${id}:`, error.message);
                    return { id: parseInt(id), name: `Dashboard ${id}`, error: true };
                }
            })
        );
        res.json(dashboards);
    } catch (error) {
        console.error('Failed to fetch dashboards:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// API: Get specific dashboard
app.get('/api/dashboard/:id', async (req, res) => {
    try {
        const data = await makeMetabaseRequest('GET', `/api/dashboard/${req.params.id}`);
        res.json(data);
    } catch (error) {
        console.error(`Failed to fetch dashboard ${req.params.id}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// API: Get card/question data
app.get('/api/card/:id/query', async (req, res) => {
    try {
        const data = await makeMetabaseRequest('POST', `/api/card/${req.params.id}/query`, {});
        res.json(data);
    } catch (error) {
        console.error(`Failed to query card ${req.params.id}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// API: Query card with parameters
app.post('/api/card/:id/query', async (req, res) => {
    try {
        const { parameters } = req.body;
        const data = await makeMetabaseRequest('POST', `/api/card/${req.params.id}/query`, {
            parameters: parameters || []
        });
        res.json(data);
    } catch (error) {
        console.error(`Failed to query card ${req.params.id}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// API: Health check
app.get('/api/health', async (req, res) => {
    try {
        const user = await makeMetabaseRequest('GET', '/api/user/current');
        res.json({ 
            status: 'connected', 
            metabaseUrl: METABASE_URL,
            user: user.common_name || user.email
        });
    } catch (error) {
        console.error('Health check failed:', error.message);
        res.status(500).json({ 
            status: 'disconnected', 
            error: error.response?.data?.message || error.message 
        });
    }
});

// API: Get configuration status
app.get('/api/config', (req, res) => {
    res.json({
        metabaseUrl: METABASE_URL,
        dashboardIds: DASHBOARD_IDS,
        dashboardConfig: DASHBOARD_CONFIG,
        hasCredentials: !!(METABASE_USERNAME && METABASE_PASSWORD) || !!METABASE_API_KEY
    });
});

// API: Get combined data from all dashboards
app.get('/api/combined-data', async (req, res) => {
    try {
        console.log('Fetching combined data from all dashboards...');
        
        // Fetch all main dashboards
        const dashboards = await Promise.all(
            DASHBOARD_IDS.map(async (id) => {
                try {
                    const dashboard = await makeMetabaseRequest('GET', `/api/dashboard/${id}`);
                    return dashboard;
                } catch (error) {
                    console.error(`Failed to fetch dashboard ${id}:`, error.message);
                    return null;
                }
            })
        );

        // Extract card IDs and info from all dashboards
        const allCards = [];
        const dashboardNames = [];
        
        dashboards.forEach((dashboard, index) => {
            if (!dashboard) return;
            
            const dbName = dashboard.name || `Database ${index + 1}`;
            dashboardNames.push(dbName);
            
            const cards = dashboard.dashcards || dashboard.ordered_cards || [];
            cards.forEach(dashcard => {
                if (dashcard.card && dashcard.card.id) {
                    allCards.push({
                        cardId: dashcard.card.id,
                        cardName: dashcard.card.name,
                        displayType: dashcard.card.display,
                        dashboardId: dashboard.id,
                        dashboardName: dbName,
                        dashboardIndex: index,
                        clickBehavior: dashcard.visualization_settings?.click_behavior
                    });
                }
            });
        });

        // Fetch data for each card
        const cardDataPromises = allCards.map(async (card) => {
            try {
                const result = await makeMetabaseRequest('POST', `/api/card/${card.cardId}/query`, {});
                return {
                    ...card,
                    data: result.data,
                    error: null
                };
            } catch (error) {
                console.error(`Failed to query card ${card.cardId}:`, error.message);
                return {
                    ...card,
                    data: null,
                    error: error.message
                };
            }
        });

        const cardResults = await Promise.all(cardDataPromises);

        // Organize data by metric type
        const combinedMetrics = {
            totalJobs: [],
            completedJobs: [],
            inProgressJobs: [],
            partiallyCompletedJobs: [],
            workspaceStatusCount: [],
            workspaceFileSize: []
        };

        cardResults.forEach(card => {
            if (!card.data) return;
            
            const name = (card.cardName || '').toLowerCase();
            const rows = card.data.rows || [];
            const cols = card.data.cols || [];
            
            if (name.includes('total jobs')) {
                let value = 0;
                if (rows.length > 0) {
                    value = rows.reduce((sum, row) => {
                        const countIdx = cols.findIndex(c => c.name === 'totalCount' || c.name === 'count');
                        return sum + (parseInt(row[countIdx >= 0 ? countIdx : cols.length - 1]) || 0);
                    }, 0);
                }
                combinedMetrics.totalJobs.push({
                    database: card.dashboardName,
                    dbIndex: card.dashboardIndex,
                    value: value
                });
            } else if (name.includes('completed jobs') && !name.includes('partially')) {
                const value = rows[0]?.[cols.length - 1] || 0;
                combinedMetrics.completedJobs.push({
                    database: card.dashboardName,
                    dbIndex: card.dashboardIndex,
                    value: typeof value === 'number' ? value : parseInt(value) || 0
                });
            } else if (name.includes('in progress') || name.includes('in_progress')) {
                const value = rows[0]?.[cols.length - 1] || 0;
                combinedMetrics.inProgressJobs.push({
                    database: card.dashboardName,
                    dbIndex: card.dashboardIndex,
                    value: typeof value === 'number' ? value : parseInt(value) || 0
                });
            } else if (name.includes('partially completed')) {
                const value = rows[0]?.[cols.length - 1] || 0;
                combinedMetrics.partiallyCompletedJobs.push({
                    database: card.dashboardName,
                    dbIndex: card.dashboardIndex,
                    value: typeof value === 'number' ? value : parseInt(value) || 0
                });
            } else if (name.includes('status count') && name.includes('workspace')) {
                const statusIdx = cols.findIndex(c => c.name === 'processStatus' || c.name === 'status');
                const countIdx = cols.findIndex(c => c.name === 'totalCount' || c.name === 'count');
                
                const statusData = rows.map(row => ({
                    status: row[statusIdx >= 0 ? statusIdx : 0],
                    count: parseInt(row[countIdx >= 0 ? countIdx : 1]) || 0
                }));
                combinedMetrics.workspaceStatusCount.push({
                    database: card.dashboardName,
                    dbIndex: card.dashboardIndex,
                    data: statusData
                });
            } else if (name.includes('file size') && name.includes('workspace')) {
                const statusIdx = cols.findIndex(c => c.name === 'processStatus' || c.name === 'status');
                const sizeIdx = cols.findIndex(c => c.name === 'totalFileSize' || c.name === 'size' || c.name === 'totalSize');
                
                const sizeData = rows.map(row => ({
                    status: row[statusIdx >= 0 ? statusIdx : 0],
                    size: parseInt(row[sizeIdx >= 0 ? sizeIdx : 1]) || 0
                }));
                combinedMetrics.workspaceFileSize.push({
                    database: card.dashboardName,
                    dbIndex: card.dashboardIndex,
                    data: sizeData
                });
            }
        });

        // Calculate totals
        const totals = {
            totalJobs: combinedMetrics.totalJobs.reduce((sum, item) => sum + item.value, 0),
            completedJobs: combinedMetrics.completedJobs.reduce((sum, item) => sum + item.value, 0),
            inProgressJobs: combinedMetrics.inProgressJobs.reduce((sum, item) => sum + item.value, 0),
            partiallyCompletedJobs: combinedMetrics.partiallyCompletedJobs.reduce((sum, item) => sum + item.value, 0)
        };

        // Aggregate workspace status
        const aggregatedStatus = {};
        combinedMetrics.workspaceStatusCount.forEach(db => {
            db.data.forEach(item => {
                if (!aggregatedStatus[item.status]) {
                    aggregatedStatus[item.status] = 0;
                }
                aggregatedStatus[item.status] += item.count;
            });
        });

        // Aggregate file sizes
        const aggregatedFileSize = {};
        combinedMetrics.workspaceFileSize.forEach(db => {
            db.data.forEach(item => {
                if (!aggregatedFileSize[item.status]) {
                    aggregatedFileSize[item.status] = 0;
                }
                aggregatedFileSize[item.status] += item.size;
            });
        });

        res.json({
            dashboardNames,
            metrics: combinedMetrics,
            totals,
            aggregatedStatus: Object.entries(aggregatedStatus).map(([status, count]) => ({ status, count })),
            aggregatedFileSize: Object.entries(aggregatedFileSize).map(([status, size]) => ({ status, size })),
            dashboardConfig: DASHBOARD_CONFIG,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Failed to fetch combined data:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// API: Get jobs list (replicates Metabase Job Details Dashboard)
app.get('/api/jobs', async (req, res) => {
    try {
        const { status, database } = req.query;
        console.log(`Fetching jobs - status: ${status || 'ALL'}, database: ${database || 'ALL'}`);
        
        const allJobs = [];
        const dbsToQuery = database 
            ? [{ name: database, config: DASHBOARD_CONFIG.jobDetails[database] }]
            : Object.entries(DASHBOARD_CONFIG.jobDetails).map(([name, config]) => ({ name, config }));
        
        for (const db of dbsToQuery) {
            if (!db.config) continue;
            
            try {
                // Query the job list card with status filter
                const result = await queryCard(db.config.jobListCardId, 
                    status && status !== 'ALL' ? { jobStatus: status } : {}
                );
                
                if (result && result.data && result.data.rows) {
                    const cols = result.data.cols.map(c => c.name);
                    
                    result.data.rows.forEach(row => {
                        const job = { database: db.name };
                        cols.forEach((col, i) => {
                            job[col] = row[i];
                        });
                        
                        // Filter by status if needed
                        if (!status || status === 'ALL' || job.jobStatus === status) {
                            allJobs.push(job);
                        }
                    });
                }
            } catch (error) {
                console.error(`Failed to fetch jobs from ${db.name}:`, error.message);
            }
        }
        
        res.json({
            jobs: allJobs,
            total: allJobs.length,
            filter: { status, database }
        });
        
    } catch (error) {
        console.error('Failed to fetch jobs:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// API: Get workspaces list (replicates Metabase Workspace Details Dashboard)
app.get('/api/workspaces', async (req, res) => {
    try {
        const { status, database } = req.query;
        console.log(`Fetching workspaces - status: ${status || 'ALL'}, database: ${database || 'ALL'}`);
        
        const allWorkspaces = [];
        const dbsToQuery = database 
            ? [{ name: database, config: DASHBOARD_CONFIG.workspaceDetails[database] }]
            : Object.entries(DASHBOARD_CONFIG.workspaceDetails).map(([name, config]) => ({ name, config }));
        
        for (const db of dbsToQuery) {
            if (!db.config) continue;
            
            try {
                const result = await queryCard(db.config.workspaceListCardId,
                    status && status !== 'ALL' ? { processStatus: status } : {}
                );
                
                if (result && result.data && result.data.rows) {
                    const cols = result.data.cols.map(c => c.name);
                    
                    result.data.rows.forEach(row => {
                        const ws = { database: db.name };
                        cols.forEach((col, i) => {
                            ws[col] = row[i];
                        });
                        
                        if (!status || status === 'ALL' || ws.processStatus === status) {
                            allWorkspaces.push(ws);
                        }
                    });
                }
            } catch (error) {
                console.error(`Failed to fetch workspaces from ${db.name}:`, error.message);
            }
        }
        
        res.json({
            workspaces: allWorkspaces,
            total: allWorkspaces.length,
            filter: { status, database }
        });
        
    } catch (error) {
        console.error('Failed to fetch workspaces:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// API: Get workspace details (files, hyperlinks, permissions status counts)
// This replicates clicking on a workspace row in Metabase
app.get('/api/workspace/:workspaceId/details', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { database } = req.query;
        console.log(`Fetching workspace details for: ${workspaceId}, database: ${database}`);
        
        if (!database || !DASHBOARD_CONFIG.workspaceDetails[database]) {
            return res.status(400).json({ error: 'Database parameter required' });
        }
        
        const config = DASHBOARD_CONFIG.workspaceDetails[database];
        
        // Fetch all three status counts in parallel (like Metabase shows)
        const [fileFolderResult, hyperlinksResult, permissionsResult, totalFileSizeResult] = await Promise.all([
            queryCard(config.fileFolderStatusCardId, { moveWorkSpaceId: workspaceId }),
            queryCard(config.hyperlinksStatusCardId, { moveWorkSpaceId: workspaceId }),
            queryCard(config.permissionsStatusCardId, { moveWorkSpaceId: workspaceId }),
            queryCard(config.totalFileSizeCardId, { workspaceId: workspaceId })
        ]);
        
        res.json({
            workspaceId,
            database,
            fileFolderStatus: parseCardResult(fileFolderResult),
            hyperlinksStatus: parseCardResult(hyperlinksResult),
            permissionsStatus: parseCardResult(permissionsResult),
            totalFileSize: parseCardResult(totalFileSizeResult)
        });
        
    } catch (error) {
        console.error('Failed to fetch workspace details:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// API: Get files/folders list for a workspace (replicates FileFolderInfo Dashboard)
app.get('/api/workspace/:workspaceId/files', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { database, status } = req.query;
        console.log(`Fetching files for workspace: ${workspaceId}, status: ${status}`);
        
        if (!database || !DASHBOARD_CONFIG.fileFolderInfo[database]) {
            return res.status(400).json({ error: 'Database parameter required' });
        }
        
        const config = DASHBOARD_CONFIG.fileFolderInfo[database];
        
        // Fetch both conflicts breakdown and files list
        const [conflictsResult, filesResult] = await Promise.all([
            queryCard(config.conflictsCardId, { 
                workspaceId: workspaceId,
                processStatus: status || 'CONFLICT'
            }),
            queryCard(config.filesListCardId, { 
                workspaceId: workspaceId,
                processStatus: status || 'PROCESSED'
            })
        ]);
        
        res.json({
            workspaceId,
            database,
            status,
            conflicts: parseCardResult(conflictsResult),
            files: parseCardResult(filesResult)
        });
        
    } catch (error) {
        console.error('Failed to fetch workspace files:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// API: Get hyperlinks list for a workspace (replicates HyperLinks Dashboard)
app.get('/api/workspace/:workspaceId/hyperlinks', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { database, status } = req.query;
        console.log(`Fetching hyperlinks for workspace: ${workspaceId}`);
        
        if (!database || !DASHBOARD_CONFIG.hyperlinks[database]) {
            return res.status(400).json({ error: 'Database parameter required' });
        }
        
        const config = DASHBOARD_CONFIG.hyperlinks[database];
        
        const result = await queryCard(config.hyperlinksListCardId, { 
            moveWorkSpaceId: workspaceId,
            processStatus: status || 'ALL'
        });
        
        res.json({
            workspaceId,
            database,
            hyperlinks: parseCardResult(result)
        });
        
    } catch (error) {
        console.error('Failed to fetch hyperlinks:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// API: Get permissions/collaborations list for a workspace (replicates Permissions Dashboard)
app.get('/api/workspace/:workspaceId/permissions', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { database, status } = req.query;
        console.log(`Fetching permissions for workspace: ${workspaceId}`);
        
        if (!database || !DASHBOARD_CONFIG.permissions[database]) {
            return res.status(400).json({ error: 'Database parameter required' });
        }
        
        const config = DASHBOARD_CONFIG.permissions[database];
        
        const result = await queryCard(config.permissionsListCardId, { 
            moveWorkSpaceId: workspaceId,
            processStatus: status || 'ALL'
        });
        
        res.json({
            workspaceId,
            database,
            permissions: parseCardResult(result)
        });
        
    } catch (error) {
        console.error('Failed to fetch permissions:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     WashPost Combined Dashboard Server                    ║
╠═══════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                 ║
║  Metabase URL: ${METABASE_URL.padEnd(40)}║
║  Main Dashboards: ${DASHBOARD_IDS.join(', ').padEnd(37)}║
╚═══════════════════════════════════════════════════════════╝
    `);
});
