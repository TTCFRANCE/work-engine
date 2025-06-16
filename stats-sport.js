const CLIENT_ID = '164649';
const CLIENT_SECRET = '9870b78a78a75919e6e363ba785a4473ce1a3697';
const REDIRECT_URI = 'https://ttcfrance.github.io/work-engine/'; // ou ton domaine

const runList = document.getElementById('runList');
const recordTable = document.getElementById('recordTable');
const kmChart = document.getElementById('kmChart').getContext('2d');

let runs = [];
let isAuthenticated = false;

function enforceStravaLogin() {
  recordTable.innerHTML = `<tr><td colspan="3">Veuillez vous connecter à Strava pour voir les statistiques</td></tr>`;
  runList.innerHTML = `<div class="run-entry">Connectez-vous à Strava pour voir vos sorties.</div>`;
  document.getElementById('kmChart').classList.add('hidden');
  document.getElementById('kmTable').classList.add('hidden');
}

document.getElementById('connectStrava').addEventListener('click', () => {
  const scope = 'activity:read_all';
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=force&scope=${scope}`;
  window.location.href = authUrl;
});

window.onload = async () => {
  const params = new URLSearchParams(window.location.search);
  if (params.has('code')) {
    isAuthenticated = true;
    const code = params.get('code');
    const token = await exchangeToken(code);
    if (token) {
      fetchActivities(token);
    }
  }
  if (!isAuthenticated) {
    enforceStravaLogin();
  }
};

async function exchangeToken(code) {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });
  const data = await response.json();
  return data.access_token;
}

async function fetchActivities(token) {
  const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=100', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const activities = await res.json();
  runs = activities
    .filter((act) => act.type === 'Run')
    .map((act) => {
      const date = act.start_date_local.split('T')[0];
      const distance = act.distance / 1000;
      const time = act.elapsed_time / 60;
      const pace = (time / distance).toFixed(2);
      return { date, distance, time, pace };
    });
  updateRuns();
  updateRecords();
  updateChart();
}

function updateRuns() {
  runList.innerHTML = '';
  runs.sort((a, b) => new Date(b.date) - new Date(a.date));
  runs.forEach((run) => {
    const div = document.createElement('div');
    div.className = 'run-entry';
    div.innerHTML = `<strong>${run.date}</strong><br>Distance: ${run.distance.toFixed(
      2
    )} km<br>Temps: ${run.time.toFixed(1)} min<br>Allure: ${run.pace} min/km`;
    runList.appendChild(div);
  });
}

function updateRecords() {
  const distances = [1, 2, 3, 4, 5, 10, 21, 42];
  const bests = {},
    avgs = {},
    counts = {};
  distances.forEach((d) => {
    bests[d] = Infinity;
    avgs[d] = 0;
    counts[d] = 0;
  });
  runs.forEach((run) => {
    distances.forEach((d) => {
      if (Math.round(run.distance) === d) {
        if (run.time < bests[d]) bests[d] = run.time;
        avgs[d] += run.time;
        counts[d]++;
      }
    });
  });
  recordTable.innerHTML = distances
    .map((d) => {
      const best = bests[d] === Infinity ? '--' : bests[d].toFixed(2);
      const avg = counts[d] ? (avgs[d] / counts[d]).toFixed(2) : '--';
      return `<tr><td>${d}</td><td>${best}</td><td>${avg}</td></tr>`;
    })
    .join('');
}

let chart;
function updateChart() {
  const dataByDate = {};
  runs.forEach((run) => {
    if (!dataByDate[run.date]) dataByDate[run.date] = 0;
    dataByDate[run.date] += run.distance;
  });
  const labels = Object.keys(dataByDate).sort();
  const data = labels.map((date) => dataByDate[date]);
  if (chart) chart.destroy();
  chart = new Chart(kmChart, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'KM par jour', data, backgroundColor: '#02c39a' }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.y.toFixed(2)} km`,
          },
        },
      },
    },
  });
}

function toggleView() {
  document.getElementById('kmChart').classList.toggle('hidden');
  document.getElementById('kmTable').classList.toggle('hidden');
}
