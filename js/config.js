// URL do backend. Em produção troque pela URL pública do Railway (sem barra no final).
// Ex.: window.API_URL = "https://moveis-api-production.up.railway.app";
window.API_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000'
  : 'backendecomerce-production-33f14266.up.railway.app';
