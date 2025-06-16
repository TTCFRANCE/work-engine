const clientId = '164649';
const redirectUri = 'https://ttcfrance.github.io/work-engine'; // ou votre hébergement

document.getElementById("connect").addEventListener("click", () => {
  window.location.href = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=auto&scope=activity:read_all`;
});

// Après redirection, on extrait le code et appelle votre backend (à coder en Node.js / PHP) pour obtenir un token
