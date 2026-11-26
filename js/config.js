const API_PRODUCAO = 'https://backendecomerce-production-33f14266.up.railway.app';

window.API_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:3000'
  : API_PRODUCAO.replace(/\/+$/, '');