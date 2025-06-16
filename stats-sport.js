const CLIENT_ID = '164649';
const CLIENT_SECRET = '9870b78a78a75919e6e363ba785a4473ce1a3697';
const REDIRECT_URI = 'https://ttcfrance.github.io/work-engine'; // adapter selon domaine

const runList = document.getElementById('runList');
const recordTable = document.getElementById('recordTable');
const kmChartCtx = document.getElementById('kmChart').getContext('2d');

const detailsModal = document.getElementById('detailsModal');
const closeDetailsBtn = document.getElementById('closeDetails');

let runs = [];
let isAuthenticated = false;
let chart = null;
let map = null;
let mapLayer = null;

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
      await fetchActivities(token);
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
  const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=50', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const activities = await res.json();
  runs = activities
    .filter((act) => act.type === 'Run')
    .map((act) => ({
      id: act.id,
      date: act.start_date_local.split('T')[0],
      distance: act.distance / 1000,
      time: act.elapsed_time / 60,
      pace: (act.elapsed_time / 60 / (act.distance / 1000)).toFixed(2),
      splits_metric: act.splits_metric,
      total_elevation_gain: act.total_elevation_gain,
      calories: act.calories,
      map: act.map,
    }));
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
    div.innerHTML = `<strong>${run.date}</strong><br>
      Distance: ${run.distance.toFixed(2)} km<br>
      Temps: ${run.time.toFixed(2)} min<br>
      Allure: ${run.pace} min/km`;
    div.addEventListener('click', () => showRunDetails(run));
    runList.appendChild(div);
  });
}

function updateRecords() {
  const distances = [1, 2, 3, 4, 5, 10, 21, 42];
  const bests = {};
  const avgs = {};
  const counts = {};
  distances.forEach((d) => {
    bests[d] = Infinity;
    avgs[d] = 0;
    counts[d] = 0;
  });

  runs.forEach((run) => {
    distances.forEach((d) => {
      // On accepte la distance arrondie à l'entier le plus proche pour comparaison
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

function updateChart() {
  const dataByDate = {};
  runs.forEach((run) => {
    if (!dataByDate[run.date]) dataByDate[run.date] = 0;
    dataByDate[run.date] += run.distance;
  });
  const labels = Object.keys(dataByDate).sort();
  const data = labels.map((date) => dataByDate[date]);

  if (chart) chart.destroy();

  chart = new Chart(kmChartCtx, {
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

// --------- Modal détails sortie ---------
function showRunDetails(run) {
  document.getElementById('detailDate').textContent = run.date;
  document.getElementById('detailDistance').textContent = run.distance.toFixed(2);
  document.getElementById('detailTime').textContent = run.time.toFixed(2);
  document.getElementById('detailPace').textContent = run.pace;

  document.getElementById('detailElevation').textContent = run.total_elevation_gain
    ? run.total_elevation_gain.toFixed(0)
    : 'N/A';

  document.getElementById('detailCalories').textContent = run.calories
    ? run.calories.toFixed(0)
    : 'N/A';

  const splitsList = document.getElementById('detailSplits');
  splitsList.innerHTML = '';
  if (run.splits_metric && run.splits_metric.length) {
    run.splits_metric.forEach((split, i) => {
      const li = document.createElement('li');
      const pace = (split.elapsed_time / 60).toFixed(2);
      li.textContent = `Km ${i + 1} : Temps ${pace} min`;
      splitsList.appendChild(li);
    });
  } else {
    splitsList.innerHTML = '<li>Pas de données de splits disponibles</li>';
  }

  // Carte
  if (map) {
    map.remove();
    map = null;
  }

  if (run.map && run.map.summary_polyline) {
    const polyline = decodePolyline(run.map.summary_polyline);

    map = L.map('map').setView([polyline[0][0], polyline[0][1]], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const latlngs = polyline.map(([lat, lng]) => [lat, lng]);
    L.polyline(latlngs, { color: 'green' }).addTo(map);

    map.fitBounds(latlngs);
  } else {
    document.getElementById('map').innerHTML = 'Pas de carte disponible';
  }

  detailsModal.classList.remove('hidden');
}

closeDetailsBtn.addEventListener('click', () => {
  detailsModal.classList.add('hidden');
  if (map) {
    map.remove();
    map = null;
  }
});

// Décodage polyline Google/Strava en tableau lat/lng
// Source adaptation : https://gist.github.com/ismaels/6636986
function decodePolyline(encoded) {
  let index = 0,
    lat = 0,
    lng = 0,
    coordinates = [],
    shift = 0,
    result = 0,
    byte = null,
    latitude_change,
    longitude_change;

  while (index < encoded.length) {
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude_change = (result & 1) ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude_change = (result & 1) ? ~(result >> 1) : result >> 1;

    lat += latitude_change;
    lng += longitude_change;

    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}
