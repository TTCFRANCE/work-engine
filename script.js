// Récupérer tous les boutons
const btnsMore = document.querySelectorAll('.btn-more');
const popups = document.querySelectorAll('.popup');
const closeBtns = document.querySelectorAll('.close-btn');

// Fonction pour afficher la pop-up
btnsMore.forEach(btn => {
  btn.addEventListener('click', function() {
    const popupId = this.getAttribute('data-popup'); // Récupère l'id de la pop-up à afficher
    const popup = document.getElementById('popup-' + popupId);
    popup.style.display = 'flex';
  });
});

// Fonction pour fermer les pop-ups
closeBtns.forEach(closeBtn => {
  closeBtn.addEventListener('click', function() {
    const popup = this.closest('.popup');
    popup.style.display = 'none';
  });
});

// Fermer la pop-up si on clique en dehors de celle-ci
window.addEventListener('click', function(event) {
  if (event.target.classList.contains('popup')) {
    event.target.style.display = 'none';
  }
});
