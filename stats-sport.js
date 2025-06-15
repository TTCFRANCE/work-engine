// app.js
const CLIENT_ID = '164649';
const CLIENT_SECRET = '9870b78a78a75919e6e363ba785a4473ce1a3697';
const REDIRECT_URI = 'work-engine.talk4fun.net'; // ou ton vrai domaine

const openBtn = document.getElementById('openModal');
const closeBtn = document.getElementById('closeModal');
const modal = document.getElementById('modal');
const runForm = document.getElementById('runForm');
const runList = document.getElementById('runList');
const recordTable = document.getElementById('recordTable');
const kmChart = document.getElementById('kmChart').getContext('2d');

let runs = [];

openBtn.onclick = () => modal.classList.remove('hidden');
closeBtn.onclick = () => modal.classList.add('hidden');

runForm.onsubmit = function (e) {
  e.preventDefault();
  const date = runForm.elements['date'].value;
  const distance = parseFloat(runForm.elements['distance'].value);
  const time = parseFloat(runForm.elements['time'].value);
  const file = runForm.elements['strava'].files[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const gpx = e.target.result;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(gpx, 'application/xml');
      const trkpts = xmlDoc.getElementsByTagName('trkpt');
      const times = xmlDoc.getElementsByTagName('time');

      if (trkpts.length > 1 && times.length > 1) {
        let totalDistance = 0;
        let startTime = new Date(times[0].textContent);
        let endTime = new Date(times[times.length - 1].textContent);

        for (let i = 1; i < trkpts.length; i++) {
          const lat1 = parseFloat(trkpts[i - 1].getAttribute('lat'));
          const lon1 = parseFloat(trkpts[i - 1].getAttribute('lon'));
          const lat2 = parseFloat(trkpts[i].getAttribute('lat'));
          const lon2 = parseFloat(trkpts[i].getAttribute('lon'));
          totalDistance += haversine(lat1, lon1, lat2, lon2);
        }

        const duration = (endTime - startTime) / 60000;
        runs.push({ date: startTime.toISOString().split('T')[0], distance: totalDistance, time: duration, pace: (duration / totalDistance).toFixed(2) });
        updateRuns();
        updateRecords();
        updateChart();
      }
    };
    reader.readAsText(file);
  } else {
    const pace = (time / distance).toFixed(2);
    runs.push({ date, distance, time, pace });
    updateRuns();
    updateRecords();
    updateChart();
  }

  runForm.reset();
  modal.classList.add('hidden');
};

document.getElementById('connectStrava').addEventListener('click', () => {
  const scope = 'activity:read_all';
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&approval_prompt=force&scope=${scope}`;
  window.location.href = authUrl;
});

window.onload = async () => {
  const params = new URLSearchParams(window.location.search);
  if (params.has('code')) {
    const code = params.get('code');
    const token = await exchangeToken(code);
    if (token) {
      fetchActivities(token);
    }
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
      grant_type: 'authorization_code'
    })
  });
  const data = await response.json();
  return data.access_token;
}

async function fetchActivities(token) {
  const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=100', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const activities = await res.json();
  activities.forEach(act => {
    if (act.type === 'Run') {
      const date = act.start_date_local.split('T')[0];
      const distance = act.distance / 1000;
      const time = act.elapsed_time / 60;
      const pace = (time / distance).toFixed(2);
      runs.push({ date, distance, time, pace });
    }
  });
  updateRuns();
  updateRecords();
  updateChart();
}

function updateRuns() {
  runList.innerHTML = '';
  runs.sort((a, b) => new Date(b.date) - new Date(a.date));
  runs.forEach(run => {
    const div = document.createElement('div');
    div.className = 'run-entry';
    div.innerHTML = `<strong>${run.date}</strong><br>Distance: ${run.distance.toFixed(2)} km<br>Temps: ${run.time.toFixed(1)} min<br>Allure: ${run.pace} min/km`;
    runList.appendChild(div);
  });
}

function updateRecords() {
  const distances = [1, 2, 3, 4, 5, 10, 21, 42];
  const bests = {}, avgs = {}, counts = {};
  distances.forEach(d => { bests[d] = Infinity; avgs[d] = 0; counts[d] = 0; });
  runs.forEach(run => {
    distances.forEach(d => {
      if (Math.round(run.distance) === d) {
        if (run.time < bests[d]) bests[d] = run.time;
        avgs[d] += run.time;
        counts[d]++;
      }
    });
  });
  recordTable.innerHTML = distances.map(d => {
    const best = bests[d] === Infinity ? '--' : bests[d].toFixed(2);
    const avg = counts[d] ? (avgs[d] / counts[d]).toFixed(2) : '--';
    return `<tr><td>${d}</td><td>${best}</td><td>${avg}</td></tr>`;
  }).join('');
}

let chart;
function updateChart() {
  const dataByDate = {};
  runs.forEach(run => {
    if (!dataByDate[run.date]) dataByDate[run.date] = 0;
    dataByDate[run.date] += run.distance;
  });
  const labels = Object.keys(dataByDate).sort();
  const data = labels.map(date => dataByDate[date]);
  if (chart) chart.destroy();
  chart = new Chart(kmChart, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'KM par jour', data, backgroundColor: '#02c39a' }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.y.toFixed(2)} km` } }
      }
    }
  });
}

function toggleView() {
  document.getElementById('kmChart').parentElement.classList.toggle('hidden');
  document.getElementById('kmTable').classList.toggle('hidden');
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
