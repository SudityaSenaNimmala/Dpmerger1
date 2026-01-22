const state = { currentView: 'main', data: null, charts: {}, filters: { jobStatus: 'ALL', jobDatabase: '', wsStatus: 'ALL', wsDatabase: '' }, currentWorkspace: null, loading: false };
const STATUS_COLORS = { 'COMPLETED': '#84BB4C', 'PROCESSED': '#84BB4C', 'IN_PROGRESS': '#F9CF48', 'PARTIALLY_COMPLETED': '#A989C5', 'PROCESSED_WITH_SOME_CONFLICTS': '#A989C5', 'NOT_PROCESSED': '#949AAB', 'CONFLICT': '#ED6E6E', 'PAUSE': '#FF9800' };
const elements = {};

document.addEventListener('DOMContentLoaded', () => { cacheElements(); setupEventListeners(); loadDashboardData(); });

function cacheElements() {
    elements.loadingState = document.getElementById('loading-state');
    elements.errorState = document.getElementById('error-state');
    elements.errorMessage = document.getElementById('error-message');
    elements.mainView = document.getElementById('main-view');
    elements.jobsView = document.getElementById('jobs-view');
    elements.workspacesView = document.getElementById('workspaces-view');
    elements.workspaceDetailView = document.getElementById('workspace-detail-view');
    elements.filesView = document.getElementById('files-view');
    elements.hyperlinksView = document.getElementById('hyperlinks-view');
    elements.permissionsView = document.getElementById('permissions-view');
    elements.breadcrumb = document.getElementById('breadcrumb');
    elements.connectionStatus = document.getElementById('connection-status');
    elements.lastUpdated = document.getElementById('last-updated');
    elements.databaseNav = document.getElementById('database-nav');
    elements.databaseGrid = document.getElementById('database-grid');
    elements.totalJobs = document.getElementById('total-jobs');
    elements.completedJobs = document.getElementById('completed-jobs');
    elements.inProgressJobs = document.getElementById('in-progress-jobs');
    elements.partialJobs = document.getElementById('partial-jobs');
    elements.completedPercent = document.getElementById('completed-percent');
    elements.inProgressPercent = document.getElementById('in-progress-percent');
    elements.partialPercent = document.getElementById('partial-percent');
    elements.jobsStatusFilter = document.getElementById('jobs-status-filter');
    elements.jobsDbFilter = document.getElementById('jobs-db-filter');
    elements.wsStatusFilter = document.getElementById('ws-status-filter');
    elements.wsDbFilter = document.getElementById('ws-db-filter');
    elements.jobsTbody = document.getElementById('jobs-tbody');
    elements.wsTbody = document.getElementById('ws-tbody');
    elements.jobsCount = document.getElementById('jobs-count');
    elements.wsCount = document.getElementById('ws-count');
}

function setupEventListeners() {
    document.getElementById('refresh-btn').addEventListener('click', () => loadDashboardData(true));
    document.getElementById('menu-toggle').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
    document.querySelectorAll('.summary-card[data-action="jobs"]').forEach(card => card.addEventListener('click', () => navigateToJobs(card.dataset.status)));
    if (elements.jobsStatusFilter) elements.jobsStatusFilter.addEventListener('change', () => { state.filters.jobStatus = elements.jobsStatusFilter.value; loadJobs(); });
    if (elements.jobsDbFilter) elements.jobsDbFilter.addEventListener('change', () => { state.filters.jobDatabase = elements.jobsDbFilter.value; loadJobs(); });
    if (elements.wsStatusFilter) elements.wsStatusFilter.addEventListener('change', () => { state.filters.wsStatus = elements.wsStatusFilter.value; loadWorkspaces(); });
    if (elements.wsDbFilter) elements.wsDbFilter.addEventListener('change', () => { state.filters.wsDatabase = elements.wsDbFilter.value; loadWorkspaces(); });
}

async function loadDashboardData() {
    try {
        showLoading(true);
        const health = await (await fetch('/api/health')).json();
        if (health.status === 'connected') updateConnectionStatus('connected', 'Connected as ' + health.user);
        else throw new Error(health.error);
        state.data = await (await fetch('/api/combined-data')).json();
        renderMainDashboard();
        showView('main');
        updateLastUpdated();
    } catch (e) { showError(e.message); updateConnectionStatus('error', 'Failed'); }
    finally { showLoading(false); }
}

function renderMainDashboard() {
    if (!state.data) return;
    const { totals, metrics, aggregatedStatus, aggregatedFileSize, dashboardNames } = state.data;
    elements.totalJobs.textContent = formatNumber(totals.totalJobs);
    elements.completedJobs.textContent = formatNumber(totals.completedJobs);
    elements.inProgressJobs.textContent = formatNumber(totals.inProgressJobs);
    elements.partialJobs.textContent = formatNumber(totals.partiallyCompletedJobs);
    const t = totals.totalJobs || 1;
    elements.completedPercent.textContent = Math.round((totals.completedJobs/t)*100) + '%';
    elements.inProgressPercent.textContent = Math.round((totals.inProgressJobs/t)*100) + '%';
    elements.partialPercent.textContent = Math.round((totals.partiallyCompletedJobs/t)*100) + '%';
    renderWorkspaceStatusChart(aggregatedStatus);
    renderFileSizeChart(aggregatedFileSize);
    renderDatabaseBreakdown(metrics);
    renderDatabaseNav(dashboardNames);
}

function renderWorkspaceStatusChart(data) {
    const ctx = document.getElementById('workspace-status-chart');
    if (!ctx) return;
    if (state.charts.workspaceStatus) state.charts.workspaceStatus.destroy();
    const labels = data.map(d => d.status || 'Unknown');
    const values = data.map(d => d.count);
    const colors = labels.map(l => STATUS_COLORS[l] || '#949AAB');
    state.charts.workspaceStatus = new Chart(ctx, {
        type: 'doughnut', data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '60%',
            plugins: { legend: { position: 'right', labels: { padding: 16, usePointStyle: true, font: { size: 12 } } } },
            onClick: (e, el) => { if (el.length) navigateToWorkspaces(data[el[0].index].status); }
        }
    });
}

function renderFileSizeChart(data) {
    const ctx = document.getElementById('file-size-chart');
    if (!ctx) return;
    if (state.charts.fileSize) state.charts.fileSize.destroy();
    const labels = data.map(d => d.status || 'Unknown');
    const values = data.map(d => d.size / (1024*1024*1024));
    const colors = labels.map(l => STATUS_COLORS[l] || '#949AAB');
    state.charts.fileSize = new Chart(ctx, {
        type: 'bar', data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 4, barThickness: 40 }] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false }, ticks: { callback: v => v.toFixed(0) + ' GB' } }, y: { grid: { display: false } } },
            onClick: (e, el) => { if (el.length) navigateToWorkspaces(data[el[0].index].status); }
        }
    });
}

function renderDatabaseBreakdown(metrics) {
    if (!elements.databaseGrid) return;
    const dbs = ['WP1','WP2','WP3','WP4','WP5'];
    const names = ['Washington Post 1','Washington Post 2','Washington Post 3','Washington Post 4','Washington Post 5'];
    let html = '';
    dbs.forEach((db,i) => {
        const total = metrics.totalJobs.find(m => m.dbIndex === i)?.value || 0;
        const comp = metrics.completedJobs.find(m => m.dbIndex === i)?.value || 0;
        const prog = metrics.inProgressJobs.find(m => m.dbIndex === i)?.value || 0;
        const part = metrics.partiallyCompletedJobs.find(m => m.dbIndex === i)?.value || 0;
        html += '<div class="database-card" onclick="navigateToJobs(\'ALL\',\''+db+'\')"><div class="database-card-header"><div class="db-icon">'+db+'</div><div class="db-info"><h4>'+names[i]+'</h4><span>Dashboard '+(i+1)+'</span></div></div><div class="database-card-body"><div class="db-stats"><div class="db-stat total" onclick="event.stopPropagation();navigateToJobs(\'ALL\',\''+db+'\')"><span class="db-stat-value">'+formatNumber(total)+'</span><span class="db-stat-label">Total</span></div><div class="db-stat completed" onclick="event.stopPropagation();navigateToJobs(\'COMPLETED\',\''+db+'\')"><span class="db-stat-value">'+formatNumber(comp)+'</span><span class="db-stat-label">Done</span></div><div class="db-stat in-progress" onclick="event.stopPropagation();navigateToJobs(\'IN_PROGRESS\',\''+db+'\')"><span class="db-stat-value">'+formatNumber(prog)+'</span><span class="db-stat-label">Progress</span></div><div class="db-stat partial" onclick="event.stopPropagation();navigateToJobs(\'PARTIALLY_COMPLETED\',\''+db+'\')"><span class="db-stat-value">'+formatNumber(part)+'</span><span class="db-stat-label">Partial</span></div></div></div></div>';
    });
    elements.databaseGrid.innerHTML = html;
}

function renderDatabaseNav(names) {
    if (!elements.databaseNav) return;
    const dbs = ['WP1','WP2','WP3','WP4','WP5'];
    let html = '';
    dbs.forEach((db,i) => { html += '<a href="#" class="nav-item" onclick="navigateToJobs(\'ALL\',\''+db+'\');return false;">'+(names[i]||'DB '+(i+1)).replace(' Dashboard','')+'</a>'; });
    elements.databaseNav.innerHTML = html;
}

async function navigateToJobs(status='ALL', database='') {
    state.filters.jobStatus = status; state.filters.jobDatabase = database;
    if (elements.jobsStatusFilter) elements.jobsStatusFilter.value = status;
    if (elements.jobsDbFilter) elements.jobsDbFilter.value = database;
    let title = 'Job Details'; if (status !== 'ALL') title += ' - ' + formatStatus(status); if (database) title += ' (' + database + ')';
    navigateTo('jobs', title); await loadJobs();
}

async function navigateToWorkspaces(status='ALL', database='') {
    state.filters.wsStatus = status; state.filters.wsDatabase = database;
    if (elements.wsStatusFilter) elements.wsStatusFilter.value = status;
    if (elements.wsDbFilter) elements.wsDbFilter.value = database;
    let title = 'MoveWorkspaces'; if (status !== 'ALL') title += ' - ' + formatStatus(status); if (database) title += ' (' + database + ')';
    navigateTo('workspaces', title); await loadWorkspaces();
}

async function loadJobs() {
    elements.jobsTbody.innerHTML = '<tr><td colspan="3" class="loading-cell">Loading...</td></tr>';
    const params = new URLSearchParams();
    if (state.filters.jobStatus !== 'ALL') params.append('status', state.filters.jobStatus);
    if (state.filters.jobDatabase) params.append('database', state.filters.jobDatabase);
    try {
        const data = await (await fetch('/api/jobs?' + params)).json();
        if (data.jobs?.length) { renderJobsTable(data.jobs); elements.jobsCount.textContent = formatNumber(data.total) + ' jobs'; }
        else { elements.jobsTbody.innerHTML = '<tr><td colspan="3" class="empty-cell">No jobs found</td></tr>'; elements.jobsCount.textContent = '0 jobs'; }
    } catch(e) { elements.jobsTbody.innerHTML = '<tr><td colspan="3" class="error-cell">Error loading</td></tr>'; }
}

function renderJobsTable(jobs) {
    let html = '';
    jobs.forEach(j => {
        const sc = (j.jobStatus||'').toLowerCase().replace(/_/g,'-');
        const dc = (j.database||'').toLowerCase();
        html += '<tr><td><span class="db-badge '+dc+'">'+(j.database||'?')+'</span></td><td>'+(j.jobName||'Unnamed')+'</td><td><span class="status-badge '+sc+'">'+formatStatus(j.jobStatus)+'</span></td></tr>';
    });
    elements.jobsTbody.innerHTML = html;
}

async function loadWorkspaces() {
    elements.wsTbody.innerHTML = '<tr><td colspan="4" class="loading-cell">Loading...</td></tr>';
    const params = new URLSearchParams();
    if (state.filters.wsStatus !== 'ALL') params.append('status', state.filters.wsStatus);
    if (state.filters.wsDatabase) params.append('database', state.filters.wsDatabase);
    try {
        const data = await (await fetch('/api/workspaces?' + params)).json();
        if (data.workspaces?.length) { renderWorkspacesTable(data.workspaces); elements.wsCount.textContent = formatNumber(data.total) + ' workspaces'; }
        else { elements.wsTbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No workspaces found</td></tr>'; elements.wsCount.textContent = '0 workspaces'; }
    } catch(e) { elements.wsTbody.innerHTML = '<tr><td colspan="4" class="error-cell">Error loading</td></tr>'; }
}

function renderWorkspacesTable(ws) {
    let html = '';
    ws.forEach(w => {
        const sc = (w.processStatus||'').toLowerCase().replace(/_/g,'-');
        const dc = (w.database||'').toLowerCase();
        const id = w._id || w.id;
        html += '<tr onclick="viewWorkspaceDetails(\''+id+'\',\''+w.database+'\')"><td><span class="db-badge '+dc+'">'+(w.database||'?')+'</span></td><td>'+(w.fromMailId||'N/A')+'</td><td>'+(w.toMailId||'N/A')+'</td><td><span class="status-badge '+sc+'">'+formatStatus(w.processStatus)+'</span></td></tr>';
    });
    elements.wsTbody.innerHTML = html;
}

async function viewWorkspaceDetails(id, db) {
    state.currentWorkspace = { id, database: db };
    document.getElementById('workspace-detail-title').textContent = 'Workspace Details';
    document.getElementById('workspace-detail-subtitle').textContent = 'ID: ' + id + ' | Database: ' + db;
    navigateTo('workspace-detail', 'Workspace - ' + db);
    try {
        const data = await (await fetch('/api/workspace/' + id + '/details?database=' + db)).json();
        renderSmallPieChart('files-status-chart', data.fileFolderStatus, 'filesStatus');
        renderSmallPieChart('hyperlinks-status-chart', data.hyperlinksStatus, 'hyperlinksStatus');
        renderSmallPieChart('permissions-status-chart', data.permissionsStatus, 'permissionsStatus');
        renderTotalFileSizeChart(data.totalFileSize);
        document.getElementById('files-chart-card').onclick = () => viewFilesDetails(id, db);
        document.getElementById('hyperlinks-chart-card').onclick = () => viewHyperlinksDetails(id, db);
        document.getElementById('permissions-chart-card').onclick = () => viewPermissionsDetails(id, db);
    } catch(e) { console.error(e); }
}

function renderSmallPieChart(canvasId, data, key) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (state.charts[key]) state.charts[key].destroy();
    if (!data?.length) { ctx.parentElement.innerHTML = '<div class="empty-state"><p>No data</p></div>'; return; }
    const labels = data.map(d => d.processStatus || d.status || '?');
    const values = data.map(d => d.totalCount || d.count || 0);
    const colors = labels.map(l => STATUS_COLORS[l] || '#949AAB');
    state.charts[key] = new Chart(ctx, {
        type: 'pie', data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 10, usePointStyle: true, font: { size: 10 } } } } }
    });
}

function renderTotalFileSizeChart(data) {
    const ctx = document.getElementById('total-file-size-chart');
    if (!ctx) return;
    if (state.charts.totalFileSize) state.charts.totalFileSize.destroy();
    if (!data?.length) return;
    const labels = data.map(d => d.processStatus || d.status || '?');
    const values = data.map(d => (d.totalSize || 0) / (1024*1024*1024));
    const colors = labels.map(l => STATUS_COLORS[l] || '#949AAB');
    state.charts.totalFileSize = new Chart(ctx, {
        type: 'pie', data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { padding: 16, usePointStyle: true, font: { size: 12 } } }, tooltip: { callbacks: { label: c => c.label + ': ' + c.raw.toFixed(2) + ' GB' } } } }
    });
}

async function viewFilesDetails(id, db, status='PROCESSED') {
    navigateTo('files', 'Files - ' + db);
    try {
        const data = await (await fetch('/api/workspace/' + id + '/files?database=' + db + '&status=' + status)).json();
        renderConflictsTable(data.conflicts || []);
        renderFilesTable(data.files || []);
        document.getElementById('files-count').textContent = formatNumber((data.files||[]).length) + ' files';
    } catch(e) { console.error(e); }
}

function renderConflictsTable(conflicts) {
    const tbody = document.getElementById('conflicts-tbody');
    if (!tbody) return;
    if (!conflicts.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No conflicts</td></tr>'; return; }
    let html = '';
    conflicts.forEach(c => { html += '<tr><td>'+(c.errorDescription||'N/A')+'</td><td>'+(c.statusCode||'N/A')+'</td><td>'+formatNumber(c.totalFiles||0)+'</td><td class="data-size">'+formatFileSize(c.totalFileSize||0)+'</td></tr>'; });
    tbody.innerHTML = html;
}

function renderFilesTable(files) {
    const tbody = document.getElementById('files-tbody');
    if (!tbody) return;
    if (!files.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">No files</td></tr>'; return; }
    let html = '';
    files.forEach(f => {
        const sc = (f.processStatus||'').toLowerCase().replace(/_/g,'-');
        html += '<tr><td>'+(f.sourceObjectName||'N/A')+'</td><td>'+(f.destObjectName||'N/A')+'</td><td>'+(f.fromCloudName||'N/A')+'</td><td>'+(f.toCloudName||'N/A')+'</td><td class="data-size">'+formatFileSize(f.fileSize||0)+'</td><td><span class="status-badge '+sc+'">'+formatStatus(f.processStatus)+'</span></td></tr>';
    });
    tbody.innerHTML = html;
}

async function viewHyperlinksDetails(id, db) {
    navigateTo('hyperlinks', 'HyperLinks - ' + db);
    try {
        const data = await (await fetch('/api/workspace/' + id + '/hyperlinks?database=' + db)).json();
        const tbody = document.getElementById('hyperlinks-tbody');
        if (!data.hyperlinks?.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No hyperlinks</td></tr>'; }
        else {
            let html = '';
            data.hyperlinks.forEach(h => {
                const sc = (h.processStatus||'').toLowerCase().replace(/_/g,'-');
                html += '<tr><td>'+(h.sourceUrl||h.sourceObjectName||'N/A')+'</td><td>'+(h.destUrl||h.destObjectName||'N/A')+'</td><td class="data-size">'+formatFileSize(h.objectSize||0)+'</td><td><span class="status-badge '+sc+'">'+formatStatus(h.processStatus)+'</span></td></tr>';
            });
            tbody.innerHTML = html;
        }
        document.getElementById('hyperlinks-count').textContent = formatNumber((data.hyperlinks||[]).length) + ' hyperlinks';
    } catch(e) { console.error(e); }
}

async function viewPermissionsDetails(id, db) {
    navigateTo('permissions', 'Permissions - ' + db);
    try {
        const data = await (await fetch('/api/workspace/' + id + '/permissions?database=' + db)).json();
        const tbody = document.getElementById('permissions-tbody');
        if (!data.permissions?.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No permissions</td></tr>'; }
        else {
            let html = '';
            data.permissions.forEach(p => {
                const sc = (p.processStatus||'').toLowerCase().replace(/_/g,'-');
                html += '<tr><td>'+(p.email||p.emailId||'N/A')+'</td><td>'+(p.role||'N/A')+'</td><td>'+(p.type||p.permissionType||'N/A')+'</td><td><span class="status-badge '+sc+'">'+formatStatus(p.processStatus)+'</span></td></tr>';
            });
            tbody.innerHTML = html;
        }
        document.getElementById('permissions-count').textContent = formatNumber((data.permissions||[]).length) + ' permissions';
    } catch(e) { console.error(e); }
}

function navigateTo(view, title) {
    state.currentView = view;
    showView(view);
    updateBreadcrumb(title);
}

function showView(v) {
    ['mainView','jobsView','workspacesView','workspaceDetailView','filesView','hyperlinksView','permissionsView'].forEach(k => elements[k]?.classList.add('hidden'));
    const map = { main: 'mainView', jobs: 'jobsView', workspaces: 'workspacesView', 'workspace-detail': 'workspaceDetailView', files: 'filesView', hyperlinks: 'hyperlinksView', permissions: 'permissionsView' };
    if (map[v] && elements[map[v]]) elements[map[v]].classList.remove('hidden');
}

function updateBreadcrumb(title) {
    if (!elements.breadcrumb) return;
    if (state.currentView === 'main') elements.breadcrumb.innerHTML = '<span class="breadcrumb-item active">Combined Dashboard</span>';
    else if (['workspace-detail','files','hyperlinks','permissions'].includes(state.currentView))
        elements.breadcrumb.innerHTML = '<span class="breadcrumb-item" onclick="navigateTo(\'main\',\'Combined Dashboard\')">Dashboard</span><span class="breadcrumb-separator">â€º</span><span class="breadcrumb-item" onclick="navigateToWorkspaces(\'ALL\')">Workspaces</span><span class="breadcrumb-separator">â€º</span><span class="breadcrumb-item active">'+title+'</span>';
    else elements.breadcrumb.innerHTML = '<span class="breadcrumb-item" onclick="navigateTo(\'main\',\'Combined Dashboard\')">Dashboard</span><span class="breadcrumb-separator">â€º</span><span class="breadcrumb-item active">'+title+'</span>';
}

function showLoading(show) { if (show) { elements.loadingState?.classList.remove('hidden'); elements.errorState?.classList.add('hidden'); elements.mainView?.classList.add('hidden'); } else elements.loadingState?.classList.add('hidden'); }
function showError(msg) { elements.loadingState?.classList.add('hidden'); elements.mainView?.classList.add('hidden'); elements.errorState?.classList.remove('hidden'); if (elements.errorMessage) elements.errorMessage.textContent = msg; }
function updateConnectionStatus(status, text) { if (!elements.connectionStatus) return; elements.connectionStatus.className = 'connection-status ' + status; const st = elements.connectionStatus.querySelector('.status-text'); if (st) st.textContent = text; }
function updateLastUpdated() { if (elements.lastUpdated) elements.lastUpdated.textContent = 'Last updated: ' + new Date().toLocaleTimeString(); }
function formatNumber(n) { return (n == null) ? '0' : n.toLocaleString(); }
function formatFileSize(b) { if (!b) return '0 B'; const u = ['B','KB','MB','GB','TB']; const k = 1024; const i = Math.floor(Math.log(b)/Math.log(k)); return (b/Math.pow(k,i)).toFixed(2) + ' ' + u[i]; }
function formatStatus(s) { return s ? s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : 'Unknown'; }

window.navigateToJobs = navigateToJobs;
window.navigateToWorkspaces = navigateToWorkspaces;
window.navigateTo = navigateTo;
window.viewWorkspaceDetails = viewWorkspaceDetails;
window.viewFilesDetails = viewFilesDetails;
window.viewHyperlinksDetails = viewHyperlinksDetails;
window.viewPermissionsDetails = viewPermissionsDetails;
