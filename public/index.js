// --- State & Constants ---
const state = {
  currentTab: 'overview',
  profile: {},
  jobs: [],
  applications: [],
  analytics: {},
  resumes: [],
  selectedResume: null,
  calendarEvents: [],
  calendarReminders: [],
  notificationHistory: [],
  googleConfig: { isConnected: false, url: '#' },
  currentDate: new Date()
};

// Kanban Stages Mapping
const stages = [
  { id: 'Discovered', key: 'discovered' },
  { id: 'Interested', key: 'interested' },
  { id: 'Applied', key: 'applied' },
  { id: 'Assessment Scheduled', key: 'assessment' },
  { id: 'Interview Scheduled', key: 'interview' },
  { id: 'Offer Received', key: 'offer' },
  { id: 'Rejected', key: 'rejected' },
  { id: 'Expired', key: 'expired' }
];

// Active Chart Instances
let charts = {};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  setupRouting();
  setupEventListeners();
  loadAllData();
});

// --- Tab Routing ---
function setupRouting() {
  const handleRoute = () => {
    const hash = window.location.hash.replace('#', '') || 'overview';
    switchTab(hash);
  };
  window.addEventListener('hashchange', handleRoute);
  // Initial route
  handleRoute();
}

function switchTab(tabId) {
  state.currentTab = tabId;
  
  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById(`nav-${tabId}`);
  if (activeNav) activeNav.classList.add('active');

  // Show corresponding panel
  document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('active'));
  const activePanel = document.getElementById(`panel-${tabId}`);
  if (activePanel) activePanel.classList.add('active');

  // Update Page Title
  const titles = {
    overview: { main: 'Dashboard Overview', sub: 'Track placement pipeline performance analytics.' },
    jobs: { main: 'Jobs Catalog', sub: 'Explore discovered openings, filter matching recommendations, and start applications.' },
    kanban: { main: 'ATS Tracker Board', sub: 'Drag and drop application cards to transition pipeline stages.' },
    analytics: { main: 'Analytics Insights', sub: 'Visualize conversion funnels, platforms distribution, and score density.' },
    resumes: { main: 'Resume Intelligence', sub: 'Manage multiple profiles, optimize keywords, and get job-specific suggestions.' },
    calendar: { main: 'Google Calendar Sync', sub: 'View interview events schedule, alarm alarms, and double-booking blocks.' },
    notifications: { main: 'Notification Dispatch Queue', sub: 'View instant or digest delivery status log histories.' },
    settings: { main: 'System Preferences', sub: 'Manage target preferences, minimum AI thresholds, and integrations auth.' }
  };

  const titleInfo = titles[tabId] || titles.overview;
  document.getElementById('page-title').textContent = titleInfo.main;
  document.getElementById('page-subtitle').textContent = titleInfo.sub;

  // Perform view-specific initializations
  if (tabId === 'analytics') {
    renderAllCharts();
  } else if (tabId === 'calendar') {
    renderCalendar();
  }
}

// --- API Communications ---
async function fetchApi(endpoint, options = {}) {
  try {
    const res = await fetch(`/api${endpoint}`, options);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const body = await res.json();
    return body.data;
  } catch (err) {
    console.error(`API Fetch Error [${endpoint}]:`, err);
    return null;
  }
}

async function loadAllData() {
  showLoader();
  
  // Run concurrent loads
  const [profile, jobs, applications, analytics, resumes, events, reminders, history, googleUrl] = await Promise.all([
    fetchApi('/profile'),
    fetchApi('/jobs'),
    fetchApi('/applications'),
    fetchApi('/analytics'),
    fetchApi('/resumes'),
    fetchApi('/calendar/events'),
    fetchApi('/calendar/reminders'),
    fetchApi('/notifications/history'),
    fetchApi('/google/auth-url')
  ]);

  if (profile) {
    state.profile = profile;
    document.getElementById('badge-username').textContent = profile.name || 'Candidate';
  }
  if (jobs) state.jobs = jobs;
  if (applications) state.applications = applications;
  if (analytics) state.analytics = analytics;
  if (resumes) {
    state.resumes = resumes;
    populateResumesList();
  }
  if (events) state.calendarEvents = events;
  if (reminders) state.calendarReminders = reminders;
  if (history) state.notificationHistory = history;
  if (googleUrl) {
    state.googleConfig.url = googleUrl.url;
    state.googleConfig.isConnected = googleUrl.is_connected || false;
    updateGoogleStatus();
  }

  populateOverviewStats();
  populateJobsCatalog();
  populateKanbanBoard();
  populateNotificationsHistory();
  populateSettingsForms();

  hideLoader();
}

function showLoader() {
  document.body.classList.add('loading');
}

function hideLoader() {
  document.body.classList.remove('loading');
}

// --- Populate Overview Pane ---
function populateOverviewStats() {
  const summary = state.analytics || {};
  
  document.getElementById('stat-total-jobs').textContent = state.jobs.length;
  document.getElementById('stat-recommended-jobs').textContent = state.jobs.filter(j => j.ai_score >= (state.profile.notification_threshold || 75)).length;
  document.getElementById('stat-applications').textContent = summary.totalApplications || 0;
  document.getElementById('stat-interviews').textContent = summary.interviewCount || 0;
  document.getElementById('stat-offers').textContent = summary.offerCount || 0;
  document.getElementById('stat-rejections').textContent = Math.round((summary.rejectionRate / 100) * (summary.totalApplications || 0)) || 0;

  // Overview Table: Recommended Jobs
  const tbody = document.querySelector('#table-overview-jobs tbody');
  tbody.innerHTML = '';
  const recommended = state.jobs
    .filter(j => j.ai_score >= (state.profile.notification_threshold || 75))
    .slice(0, 5);

  if (recommended.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="placeholder-row">No recommended jobs matching threshold score found.</td></tr>`;
  } else {
    recommended.forEach(job => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(job.company)}</strong></td>
        <td>${escapeHtml(job.role)}</td>
        <td><span class="badge">${escapeHtml(job.platform)}</span></td>
        <td><span class="badge badge-score ${job.ai_score >= 85 ? 'high' : ''}">${job.ai_score}%</span></td>
        <td><button class="btn btn-secondary btn-sm" onclick="trackApplication(${job.id})">Track</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Populate Mini Calendar Event Listings
  const miniCal = document.getElementById('calendar-mini-list');
  miniCal.innerHTML = '';
  const incoming = state.calendarEvents
    .filter(e => new Date(e.start_time) >= new Date())
    .slice(0, 3);

  if (incoming.length === 0) {
    miniCal.innerHTML = `<div class="placeholder-row">No upcoming interviews or assessments scheduled.</div>`;
  } else {
    incoming.forEach(ev => {
      const div = document.createElement('div');
      div.className = `mini-event-card ${ev.event_type}`;
      div.innerHTML = `
        <div class="mini-event-details">
          <h4>${escapeHtml(ev.title)}</h4>
          <p>📅 ${new Date(ev.start_time).toLocaleString()} | 🔗 ${ev.meeting_link ? `<a href="${ev.meeting_link}" target="_blank">Join Call</a>` : 'No meeting link'}</p>
        </div>
      `;
      miniCal.appendChild(div);
    });
  }

  // Populate Small Boxes Summary
  document.getElementById('overview-resume-stats').innerHTML = `
    <p>Resumes Profile Count: <strong>${state.resumes.length}</strong></p>
    <p>Preferred Job Role: <strong>${state.profile.preferred_roles ? state.profile.preferred_roles.join(', ') : 'Not Configured'}</strong></p>
  `;
  document.getElementById('overview-gmail-stats').innerHTML = `
    <p>Integration status: <strong>${state.googleConfig.isConnected ? 'Connected' : 'Offline / Unauthorized'}</strong></p>
    <p>Last Ingested Sync: <strong>${state.notificationHistory.length > 0 ? new Date().toLocaleDateString() : 'Never'}</strong></p>
  `;
  document.getElementById('overview-notification-stats').innerHTML = `
    <p>Instant Dispatch: <strong>${state.profile.telegram_enabled ? 'Active (Telegram)' : 'Disabled'}</strong></p>
    <p>Digest Mode configuration: <strong>${escapeHtml(state.profile.digest_mode || 'Realtime')}</strong></p>
  `;
}

// --- Track Application Button Handler ---
async function trackApplication(jobId) {
  showLoader();
  const res = await fetchApi('/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, status: 'Interested' })
  });
  if (res) {
    alert('Added job to ATS tracker board!');
    await loadAllData();
  }
  hideLoader();
}

// --- Jobs Catalog Pane ---
function populateJobsCatalog() {
  const tbody = document.querySelector('#table-catalog-jobs tbody');
  tbody.innerHTML = '';

  const searchVal = document.getElementById('filter-search').value.toLowerCase();
  const platformVal = document.getElementById('filter-platform').value;
  const scoreVal = parseInt(document.getElementById('filter-score').value, 10);
  const sortBy = document.getElementById('sort-by').value;

  let filtered = [...state.jobs];

  // Apply Search Query
  if (searchVal) {
    filtered = filtered.filter(j => 
      j.company.toLowerCase().includes(searchVal) ||
      j.role.toLowerCase().includes(searchVal) ||
      (j.skills && j.skills.some(s => s.toLowerCase().includes(searchVal)))
    );
  }

  // Apply Platform Filter
  if (platformVal !== 'all') {
    filtered = filtered.filter(j => j.platform === platformVal);
  }

  // Apply Score Filter
  if (scoreVal > 0) {
    filtered = filtered.filter(j => j.ai_score >= scoreVal);
  }

  // Sorting logic
  if (sortBy === 'score') {
    filtered.sort((a, b) => b.ai_score - a.ai_score);
  } else if (sortBy === 'date') {
    filtered.sort((a, b) => new Date(b.posted_date || b.created_at) - new Date(a.posted_date || a.created_at));
  } else if (sortBy === 'deadline') {
    filtered.sort((a, b) => new Date(a.deadline || '9999-12-31') - new Date(b.deadline || '9999-12-31'));
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="placeholder-row">No jobs match the selected filter configurations.</td></tr>`;
    return;
  }

  filtered.forEach(job => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(job.company)}</strong></td>
      <td>${escapeHtml(job.role)}</td>
      <td><span class="badge">${escapeHtml(job.platform)}</span></td>
      <td>${escapeHtml(job.location || 'Remote')}</td>
      <td><span class="badge badge-score ${job.ai_score >= 85 ? 'high' : ''}">${job.ai_score}%</span></td>
      <td>${escapeHtml(job.salary || 'Competitive')}</td>
      <td>${job.deadline ? new Date(job.deadline).toLocaleDateString() : 'N/A'}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="trackApplication(${job.id})">Track</button>
        <a href="${job.apply_url}" target="_blank" class="btn btn-primary btn-sm">Apply</a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Kanban Tracker Pane ---
function populateKanbanBoard() {
  // Clear lists
  stages.forEach(col => {
    const el = document.getElementById(`cards-${col.key}`);
    if (el) el.innerHTML = '';
    const countEl = document.getElementById(`count-${col.key}`);
    if (countEl) countEl.textContent = '0';
  });

  const columnsCounts = {};
  stages.forEach(col => { columnsCounts[col.id] = 0; });

  state.applications.forEach(app => {
    const matchedCol = stages.find(s => s.id.toLowerCase() === app.status.toLowerCase() || 
      (app.status.toLowerCase() === 'assessment scheduled' && s.id === 'Assessment Scheduled') ||
      (app.status.toLowerCase() === 'interview scheduled' && s.id === 'Interview Scheduled')
    );

    if (matchedCol) {
      columnsCounts[matchedCol.id]++;
      const container = document.getElementById(`cards-${matchedCol.key}`);
      
      const card = document.createElement('div');
      card.className = 'kanban-card';
      card.draggable = true;
      card.id = `card-app-${app.id}`;
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', app.id);
      });

      card.innerHTML = `
        <div class="kanban-card-title">${escapeHtml(app.role)}</div>
        <div class="kanban-card-company">${escapeHtml(app.company)}</div>
        <div class="kanban-card-footer">
          <span class="kanban-card-score">${app.ai_score}% Match</span>
          <span class="badge">${escapeHtml(app.platform)}</span>
        </div>
      `;
      
      container.appendChild(card);
    }
  });

  // Update counts
  stages.forEach(col => {
    const countEl = document.getElementById(`count-${col.key}`);
    if (countEl) countEl.textContent = columnsCounts[col.id] || 0;
  });
}

// Drag & Drop handlers
window.allowDrop = function(e) {
  e.preventDefault();
};

window.handleDrop = async function(e, targetStatus) {
  e.preventDefault();
  const id = e.dataTransfer.getData('text/plain');
  const appId = parseInt(id, 10);
  if (isNaN(appId)) return;

  // Find target status mapping fields input modal
  const requiresModal = ['Assessment Scheduled', 'Interview Scheduled', 'Offer Received'].includes(targetStatus);
  if (requiresModal) {
    showAtsModal(appId, targetStatus);
  } else {
    // Perform direct update status api call
    showLoader();
    const updated = await fetchApi(`/applications/${appId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetStatus })
    });
    if (updated) {
      await loadAllData();
    }
    hideLoader();
  }
};

// ATS Metadata modal update
function showAtsModal(appId, status) {
  document.getElementById('ats-meta-id').value = appId;
  document.getElementById('ats-meta-status').value = status;
  
  // Hide all modal input groups initially
  document.getElementById('group-recruiter-name').style.display = 'none';
  document.getElementById('group-recruiter-email').style.display = 'none';
  document.getElementById('group-recruiter-phone').style.display = 'none';
  document.getElementById('group-meeting-link').style.display = 'none';
  document.getElementById('group-interview-date').style.display = 'none';
  document.getElementById('group-interview-time').style.display = 'none';
  document.getElementById('group-assessment-date').style.display = 'none';
  document.getElementById('group-offer-deadline').style.display = 'none';
  document.getElementById('group-salary-offered').style.display = 'none';

  // Toggle inputs based on transition status
  if (status === 'Assessment Scheduled') {
    document.getElementById('group-assessment-date').style.display = 'block';
    document.getElementById('group-meeting-link').style.display = 'block';
  } else if (status === 'Interview Scheduled') {
    document.getElementById('group-recruiter-name').style.display = 'block';
    document.getElementById('group-recruiter-email').style.display = 'block';
    document.getElementById('group-meeting-link').style.display = 'block';
    document.getElementById('group-interview-date').style.display = 'block';
    document.getElementById('group-interview-time').style.display = 'block';
  } else if (status === 'Offer Received') {
    document.getElementById('group-offer-deadline').style.display = 'block';
    document.getElementById('group-salary-offered').style.display = 'block';
  }

  document.getElementById('modal-ats-meta').style.display = 'flex';
}

// --- Analytics Charts Pane ---
function renderAllCharts() {
  const data = state.analytics || {};
  if (!data.jobsOverTime) return; // Wait until data loaded

  // Destroy previous instances to avoid rendering memory leaks
  Object.values(charts).forEach(c => c.destroy());
  charts = {};

  // Chart 1: Line trends jobs and applications over time
  const ctxTrends = document.getElementById('chart-trends').getContext('2d');
  charts.trends = new Chart(ctxTrends, {
    type: 'line',
    data: {
      labels: data.jobsOverTime.map(j => j.date),
      datasets: [
        {
          label: 'Ingested Openings',
          data: data.jobsOverTime.map(j => j.count),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'Applied Tracking Cards',
          data: data.applicationsOverTime.map(a => a.count),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9ca3af' } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
      }
    }
  });

  // Chart 2: Doughnut Platform distribution
  const ctxPlatforms = document.getElementById('chart-platforms').getContext('2d');
  charts.platforms = new Chart(ctxPlatforms, {
    type: 'doughnut',
    data: {
      labels: data.platformWise.map(p => p.platform),
      datasets: [{
        data: data.platformWise.map(p => p.count),
        backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444'],
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: '#9ca3af' } } }
    }
  });

  // Chart 3: Horizontal Bar Company engagement
  const ctxCompanies = document.getElementById('chart-companies').getContext('2d');
  charts.companies = new Chart(ctxCompanies, {
    type: 'bar',
    data: {
      labels: data.companyWise.map(c => c.company),
      datasets: [{
        label: 'Applied',
        data: data.companyWise.map(c => c.count),
        backgroundColor: '#06b6d4',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
        y: { grid: { display: false }, ticks: { color: '#9ca3af' } }
      }
    }
  });

  // Chart 4: Polar Area Resume Usage
  const ctxResumes = document.getElementById('chart-resumes').getContext('2d');
  charts.resumes = new Chart(ctxResumes, {
    type: 'polarArea',
    data: {
      labels: data.resumeUsage.map(r => r.resume),
      datasets: [{
        data: data.resumeUsage.map(r => r.count),
        backgroundColor: ['rgba(99, 102, 241, 0.5)', 'rgba(16, 185, 129, 0.5)', 'rgba(245, 158, 11, 0.5)', 'rgba(139, 92, 246, 0.5)'],
        borderColor: 'rgba(255, 255, 255, 0.1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: '#9ca3af' } } },
      scales: {
        r: { grid: { color: 'rgba(255,255,255,0.05)' }, angleLines: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', backdropColor: 'transparent' } }
      }
    }
  });

  // Chart 5: Bar AI Score match distribution density
  const ctxScores = document.getElementById('chart-scores').getContext('2d');
  charts.scores = new Chart(ctxScores, {
    type: 'bar',
    data: {
      labels: data.aiScoreDistribution.map(s => s.range),
      datasets: [{
        label: 'Jobs Count',
        data: data.aiScoreDistribution.map(s => s.count),
        backgroundColor: '#8b5cf6',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
      }
    }
  });

  // Chart 6: Funnel Stage Conversions
  const ctxConversion = document.getElementById('chart-conversion').getContext('2d');
  charts.conversion = new Chart(ctxConversion, {
    type: 'bar',
    data: {
      labels: ['Interview Conversion', 'Offer Conversion'],
      datasets: [{
        data: [data.interviewConversion, data.offerConversion],
        backgroundColor: ['#6366f1', '#10b981'],
        borderRadius: 6,
        barThickness: 50
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
        y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', callback: v => `${v}%` } }
      }
    }
  });
}

// --- Resumes Intelligent Matcher Pane ---
function populateResumesList() {
  const container = document.getElementById('resumes-list-container');
  container.innerHTML = '';

  if (state.resumes.length === 0) {
    container.innerHTML = `<div class="placeholder-row">No resume profiles registered. Upload one to start match evaluations.</div>`;
    return;
  }

  state.resumes.forEach(res => {
    const card = document.createElement('div');
    card.className = `resume-item-card ${state.selectedResume && state.selectedResume.id === res.id ? 'active' : ''}`;
    card.innerHTML = `
      <h4>${escapeHtml(res.name)}</h4>
      <p>Target Role: ${escapeHtml(res.target_role || 'General')}</p>
      <p>Last Update: ${new Date(res.updated_at).toLocaleDateString()}</p>
    `;
    card.addEventListener('click', () => selectResumeProfile(res));
    container.appendChild(card);
  });
}

async function selectResumeProfile(res) {
  state.selectedResume = res;
  populateResumesList(); // re-render to update active styling

  // Load details
  document.getElementById('card-resume-none').style.display = 'none';
  document.getElementById('card-resume-details').style.display = 'block';

  document.getElementById('resume-details-name').textContent = res.name;
  document.getElementById('resume-details-role').textContent = res.target_role || 'General Profile';
  document.getElementById('resume-details-version').textContent = `v${res.version}`;

  // Populate primary/secondary skills tags
  const primaryDiv = document.getElementById('resume-skills-primary');
  const secondaryDiv = document.getElementById('resume-skills-secondary');
  primaryDiv.innerHTML = '';
  secondaryDiv.innerHTML = '';

  if (res.primary_skills) {
    res.primary_skills.forEach(s => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = s;
      primaryDiv.appendChild(span);
    });
  }
  if (res.secondary_skills) {
    res.secondary_skills.forEach(s => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = s;
      secondaryDiv.appendChild(span);
    });
  }

  // Populate versions dropdown list
  const verSelect = document.getElementById('resume-details-version-select');
  verSelect.innerHTML = '';
  
  // Fetch versions
  const versions = await fetchApi(`/resumes/${res.id}/versions`);
  if (versions) {
    versions.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.version;
      opt.textContent = `Version ${v.version} - ${new Date(v.created_at).toLocaleDateString()}`;
      if (v.version === res.version) opt.selected = true;
      verSelect.appendChild(opt);
    });
  }

  // Fetch optimizer details
  const optimizerCircle = document.getElementById('optimizer-score-circle');
  const optimizerText = document.getElementById('optimizer-score-text');
  const missingUl = document.getElementById('optimizer-missing-list');
  const repeatedUl = document.getElementById('optimizer-repeated-list');
  
  missingUl.innerHTML = '';
  repeatedUl.innerHTML = '';

  // Get job-specific recommendations using first active job or placeholder score
  const firstJob = state.jobs[0] || { id: 1 };
  const scoreRes = await fetchApi(`/jobs/${firstJob.id}/resume-recommendation`);
  if (scoreRes && scoreRes.resume_scores && scoreRes.resume_scores.length > 0) {
    const match = scoreRes.resume_scores.find(s => s.resume_id === res.id) || scoreRes.resume_scores[0];
    const score = match.overall_match_score || 80;
    
    // Animate radial svg circle progress
    const dashVal = (score / 100) * 100;
    optimizerCircle.setAttribute('stroke-dasharray', `${dashVal}, 100`);
    optimizerText.textContent = `${score}%`;

    // Populate improvements list items
    const missing = match.missing_skills || [];
    if (missing.length === 0) {
      missingUl.innerHTML = `<li>No missing skills identified! Great density matching.</li>`;
    } else {
      missing.forEach(m => {
        const li = document.createElement('li');
        li.textContent = `Include missing technical skill: "${m}" to improve matcher score by 15%.`;
        missingUl.appendChild(li);
      });
    }

    const repeated = match.missing_keywords || [];
    if (repeated.length === 0) {
      repeatedUl.innerHTML = `<li>No keyword repetition warnings flagged.</li>`;
    } else {
      repeated.forEach(r => {
        const li = document.createElement('li');
        li.textContent = `High density keyword repeating: "${r}". Reduce matching count checks.`;
        repeatedUl.appendChild(li);
      });
    }
  }

  // Populate Recommendations lists
  const tbody = document.querySelector('#table-resume-recommendations tbody');
  tbody.innerHTML = '';

  const activeAppsJobs = state.applications.slice(0, 5);
  if (activeAppsJobs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="placeholder-row">No active jobs tracked. Add some in catalog tab.</td></tr>`;
  } else {
    activeAppsJobs.forEach(app => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(app.company)}</strong></td>
        <td>${escapeHtml(app.role)}</td>
        <td><span class="badge badge-score">${app.ai_score}% Match</span></td>
        <td><span class="badge">${escapeHtml(app.status)}</span></td>
        <td><a href="${app.apply_url}" target="_blank" class="btn btn-secondary btn-sm">Open Job</a></td>
      `;
      tbody.appendChild(tr);
    });
  }
}

window.switchSubTab = function(e, subTabId) {
  // Update class active tags
  const parent = e.target.closest('.card-body');
  parent.querySelectorAll('.tab-sub-btn').forEach(btn => btn.classList.remove('active'));
  e.target.classList.add('active');

  parent.querySelectorAll('.subtab-panel').forEach(panel => panel.classList.remove('active'));
  parent.querySelector(`#${subTabId}`).classList.add('active');
};

// --- Calendar Syncing Pane ---
function renderCalendar() {
  const container = document.getElementById('calendar-days-container');
  container.innerHTML = '';

  const date = state.currentDate;
  const year = date.getFullYear();
  const month = date.getMonth();

  // Set header month name
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  document.getElementById('calendar-month-year').textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const numDays = new Date(year, month + 1, 0).getDate();
  const prevMonthNumDays = new Date(year, month, 0).getDate();

  // Populate trailing prev month cells
  for (let i = firstDay - 1; i >= 0; i--) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell inactive';
    cell.innerHTML = `<span class="day-num">${prevMonthNumDays - i}</span>`;
    container.appendChild(cell);
  }

  // Populate active month cells
  for (let day = 1; day <= numDays; day++) {
    const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Check if events exists on this date
    const dayEvents = state.calendarEvents.filter(e => {
      const eventDate = new Date(e.start_time).toISOString().split('T')[0];
      return eventDate === cellDateStr;
    });

    const cell = document.createElement('div');
    cell.className = 'calendar-cell';
    cell.innerHTML = `<span class="day-num">${day}</span>`;
    
    if (dayEvents.length > 0) {
      const dotsDiv = document.createElement('div');
      dotsDiv.className = 'calendar-cell-dots';
      dayEvents.forEach(ev => {
        const dot = document.createElement('span');
        dot.className = `cell-dot ${ev.event_type}`;
        dotsDiv.appendChild(dot);
      });
      cell.appendChild(dotsDiv);
      
      // Bind click handler list details
      cell.addEventListener('click', () => {
        let msg = `Schedules for ${cellDateStr}:\n`;
        dayEvents.forEach((ev, idx) => {
          msg += `\n${idx+1}. ${ev.title} (${ev.event_type})\nTime: ${new Date(ev.start_time).toLocaleTimeString()}\nMeeting URL: ${ev.meeting_link || 'N/A'}\n`;
        });
        alert(msg);
      });
    }

    container.appendChild(cell);
  }

  // Populate calendar events lists details
  const listEl = document.getElementById('calendar-events-list');
  listEl.innerHTML = '';
  if (state.calendarEvents.length === 0) {
    listEl.innerHTML = `<div class="placeholder-row">No interview bookings in history logs.</div>`;
  } else {
    state.calendarEvents.forEach(ev => {
      const item = document.createElement('div');
      item.className = 'mini-event-card';
      item.innerHTML = `
        <div class="mini-event-details">
          <h4>${escapeHtml(ev.title)}</h4>
          <p>📅 ${new Date(ev.start_time).toLocaleString()} | Type: <strong>${escapeHtml(ev.event_type)}</strong></p>
          <p>${escapeHtml(ev.description || '')}</p>
        </div>
      `;
      listEl.appendChild(item);
    });
  }

  // Populate reminders alarms list details
  const reminderEl = document.getElementById('calendar-reminders-list');
  reminderEl.innerHTML = '';
  if (state.calendarReminders.length === 0) {
    reminderEl.innerHTML = `<div class="placeholder-row">No alarms queued in notification dispatch loops.</div>`;
  } else {
    state.calendarReminders.forEach(r => {
      const item = document.createElement('div');
      item.className = 'mini-event-card';
      item.innerHTML = `
        <div class="mini-event-details">
          <h4>Lead Alarm Offset: ${escapeHtml(r.lead_time)}</h4>
          <p>⏰ Dispatch Date: ${new Date(r.reminder_time).toLocaleString()}</p>
          <p>Delivery Status check: <strong style="color: var(--color-warning);">${escapeHtml(r.status)}</strong></p>
        </div>
      `;
      reminderEl.appendChild(item);
    });
  }
}

// --- Alerts Notification History Pane ---
function populateNotificationsHistory() {
  const tbody = document.querySelector('#table-notification-history tbody');
  tbody.innerHTML = '';

  const summaryEl = document.getElementById('queue-stats-container');
  const totalAlerts = state.notificationHistory.length;
  const pendingCount = state.notificationHistory.filter(n => n.status === 'pending').length;
  const sentCount = state.notificationHistory.filter(n => n.status === 'sent').length;
  const failedCount = state.notificationHistory.filter(n => n.status === 'failed').length;

  summaryEl.innerHTML = `
    <span>Total Alerts: <strong>${totalAlerts}</strong></span>
    <span>Pending: <strong>${pendingCount}</strong></span>
    <span>Delivered: <strong style="color: var(--color-success);">${sentCount}</strong></span>
    <span>Failed: <strong style="color: var(--color-danger);">${failedCount}</strong></span>
  `;

  if (totalAlerts === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="placeholder-row">No alerts logged in history queue.</td></tr>`;
    return;
  }

  state.notificationHistory.forEach(n => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${n.job_id}</td>
      <td><strong>${escapeHtml(n.role || 'Job opening')}</strong></td>
      <td><span class="badge">${escapeHtml(n.channel)}</span></td>
      <td>${n.sent_at ? new Date(n.sent_at).toLocaleString() : 'N/A'}</td>
      <td>${n.retry_count || 0}</td>
      <td><span class="badge" style="background-color: ${n.status === 'sent' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${n.status === 'sent' ? 'var(--color-success)' : 'var(--color-danger)'};">${escapeHtml(n.status)}</span></td>
      <td><small style="font-family: monospace; font-size: 10px;">${escapeHtml(JSON.stringify(n.response || {}).substring(0, 40))}...</small></td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Settings Forms Configuration ---
function populateSettingsForms() {
  const p = state.profile;
  
  // User Profile
  document.getElementById('profile-name').value = p.name || '';
  document.getElementById('profile-roles').value = p.preferred_roles ? p.preferred_roles.join(', ') : '';
  document.getElementById('profile-skills').value = p.skills ? p.skills.join(', ') : '';
  document.getElementById('profile-locations').value = p.preferred_locations ? p.preferred_locations.join(', ') : '';
  document.getElementById('profile-salary').value = p.expected_salary || '';

  // App Settings
  document.getElementById('settings-threshold').value = p.notification_threshold || 75;
  document.getElementById('settings-telegram-enabled').checked = p.telegram_enabled || false;
  document.getElementById('settings-calendar-enabled').checked = p.calendar_enabled || false;
  document.getElementById('settings-gmail-enabled').checked = p.gmail_enabled || false;
  
  const digestSelect = document.getElementById('settings-digest');
  for (let i = 0; i < digestSelect.options.length; i++) {
    if (digestSelect.options[i].value === p.digest_mode) {
      digestSelect.options[i].selected = true;
    }
  }
}

function updateGoogleStatus() {
  const badge = document.getElementById('google-auth-status');
  const btn = document.getElementById('btn-google-login');
  
  if (state.googleConfig.isConnected) {
    badge.className = 'oauth-badge connected';
    badge.textContent = 'Google API Connected (OAuth Authorized)';
    btn.textContent = 'Re-Authorize Google Settings';
  } else {
    badge.className = 'oauth-badge';
    badge.textContent = 'Disconnected / Unauthorized (No Access Tokens)';
    btn.textContent = 'Authorize Google APIs';
  }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Synchronize Ingestion
  document.getElementById('btn-sync-all').addEventListener('click', async () => {
    showLoader();
    const result = await fetchApi('/google/sync', { method: 'POST' });
    if (result) {
      alert('Successfully synchronized email logs and calendar schedules!');
      await loadAllData();
    } else {
      alert('Gmail sync completed. Zero new templates matched or OAuth is pending.');
    }
    hideLoader();
  });

  // Filter Catalog changes
  document.getElementById('filter-search').addEventListener('input', populateJobsCatalog);
  document.getElementById('filter-platform').addEventListener('change', populateJobsCatalog);
  document.getElementById('filter-score').addEventListener('change', populateJobsCatalog);
  document.getElementById('sort-by').addEventListener('change', populateJobsCatalog);

  // Profile Form Submit
  document.getElementById('form-user-profile').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoader();
    
    const payload = {
      name: document.getElementById('profile-name').value,
      preferred_roles: document.getElementById('profile-roles').value.split(',').map(s => s.trim()),
      skills: document.getElementById('profile-skills').value.split(',').map(s => s.trim()),
      preferred_locations: document.getElementById('profile-locations').value.split(',').map(s => s.trim()),
      expected_salary: document.getElementById('profile-salary').value
    };

    const res = await fetchApi('/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res) {
      alert('User profile matching rules updated successfully!');
      await loadAllData();
    }
    hideLoader();
  });

  // Settings Form Submit
  document.getElementById('form-app-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoader();

    const payload = {
      telegram_enabled: document.getElementById('settings-telegram-enabled').checked,
      notification_threshold: parseInt(document.getElementById('settings-threshold').value, 10),
      digest_mode: document.getElementById('settings-digest').value,
      calendar_enabled: document.getElementById('settings-calendar-enabled').checked,
      gmail_enabled: document.getElementById('settings-gmail-enabled').checked
    };

    const res = await fetchApi('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res) {
      alert('Smart Dispatcher notification settings updated!');
      await loadAllData();
    }
    hideLoader();
  });

  // Google Login redirect
  document.getElementById('btn-google-login').addEventListener('click', () => {
    if (state.googleConfig.url && state.googleConfig.url !== '#') {
      window.location.href = state.googleConfig.url;
    } else {
      alert('OAuth credentials are not configured in system environment variables.');
    }
  });

  // Calendar prev/next month
  document.getElementById('btn-prev-month').addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('btn-next-month').addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    renderCalendar();
  });

  // Upload modal show/hide
  document.getElementById('btn-upload-resume-modal').addEventListener('click', () => {
    document.getElementById('modal-upload-resume').style.display = 'flex';
  });
  document.getElementById('btn-close-resume-modal').addEventListener('click', () => {
    document.getElementById('modal-upload-resume').style.display = 'none';
  });

  // ATS Modal close
  document.getElementById('btn-close-ats-modal').addEventListener('click', () => {
    document.getElementById('modal-ats-meta').style.display = 'none';
  });

  // Resume Rollback
  document.getElementById('btn-rollback-resume').addEventListener('click', async () => {
    if (!state.selectedResume) return;
    const version = parseInt(document.getElementById('resume-details-version-select').value, 10);
    showLoader();
    const res = await fetchApi(`/resumes/${state.selectedResume.id}/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version })
    });
    if (res) {
      alert(`Successfully rolled back profile to version: ${version}!`);
      await loadAllData();
      const current = state.resumes.find(r => r.id === state.selectedResume.id);
      if (current) selectResumeProfile(current);
    }
    hideLoader();
  });

  // Upload Resume Form Submit
  document.getElementById('form-upload-resume').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('resume-name-input').value;
    const file = document.getElementById('resume-file-input').files[0];
    if (!file) return;

    showLoader();
    
    // Read file as base64 string
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Content = reader.result.split(',')[1];
      const payload = {
        name,
        targetRole: name.includes('Backend') ? 'Backend Engineer' : 'Software Engineer',
        fileName: file.name,
        fileContent: base64Content
      };

      const res = await fetchApi('/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res) {
        alert('Resume profile created and parsed technical skills successfully!');
        document.getElementById('modal-upload-resume').style.display = 'none';
        await loadAllData();
        const fresh = state.resumes.find(r => r.name === name);
        if (fresh) selectResumeProfile(fresh);
      }
      hideLoader();
    };
    reader.readAsDataURL(file);
  });

  // ATS metadata Form Submit
  document.getElementById('form-ats-meta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const appId = parseInt(document.getElementById('ats-meta-id').value, 10);
    const status = document.getElementById('ats-meta-status').value;

    const payload = {
      status,
      notes: document.getElementById('ats-notes').value,
      recruiterName: document.getElementById('ats-recruiter-name').value || null,
      recruiterEmail: document.getElementById('ats-recruiter-email').value || null,
      recruiterPhone: document.getElementById('ats-recruiter-phone').value || null,
      meetingLink: document.getElementById('ats-meeting-link').value || null,
      salaryOffered: document.getElementById('ats-salary-offered').value ? Number(document.getElementById('ats-salary-offered').value) : null
    };

    const iDate = document.getElementById('ats-interview-date').value;
    if (iDate) payload.interviewDate = iDate;
    const iTime = document.getElementById('ats-interview-time').value;
    if (iTime) payload.interviewTime = `${iTime}:00`;

    const aDate = document.getElementById('ats-assessment-date').value;
    if (aDate) payload.assessmentDate = aDate;

    const oDeadline = document.getElementById('ats-offer-deadline').value;
    if (oDeadline) payload.offerDeadline = oDeadline;

    showLoader();
    const res = await fetchApi(`/applications/${appId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res) {
      document.getElementById('modal-ats-meta').style.display = 'none';
      await loadAllData();
    }
    hideLoader();
  });

  // Exports click triggers
  document.getElementById('export-json').addEventListener('click', (e) => {
    e.preventDefault();
    exportJson();
  });
  document.getElementById('export-csv').addEventListener('click', (e) => {
    e.preventDefault();
    exportCsv();
  });
  document.getElementById('export-pdf').addEventListener('click', (e) => {
    e.preventDefault();
    window.print();
  });
}

// --- Data Exporter Compilations ---
function exportJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
    profile: state.profile,
    jobs: state.jobs,
    applications: state.applications,
    resumes: state.resumes,
    calendar: state.calendarEvents,
    notifications: state.notificationHistory
  }, null, 2));
  
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href",     dataStr     );
  dlAnchor.setAttribute("download", "placement_assistant_export.json");
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

function exportCsv() {
  let csvContent = "data:text/csv;charset=utf-8,";
  
  // Headers
  csvContent += "Job ID,Company,Role,Platform,AI Score,Status,Applied Date,Recruiter Email,Meeting Link\r\n";
  
  // Rows mapping
  state.applications.forEach(app => {
    const row = [
      app.job_id,
      `"${app.company.replace(/"/g, '""')}"`,
      `"${app.role.replace(/"/g, '""')}"`,
      app.platform,
      `${app.ai_score}%`,
      app.status,
      app.applied_at ? new Date(app.applied_at).toLocaleDateString() : 'N/A',
      app.recruiter_email || 'N/A',
      app.meeting_link || 'N/A'
    ];
    csvContent += row.join(",") + "\r\n";
  });
  
  const encodedUri = encodeURI(csvContent);
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", encodedUri);
  dlAnchor.setAttribute("download", "placement_assistant_tracker.csv");
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

// Helper: Escape HTML strings to prevent XSS issues
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
