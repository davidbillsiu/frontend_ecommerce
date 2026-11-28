/* ===== Utilidades compartilhadas: API, sessão, carrinho (localStorage), cabeçalho, CPF/CEP ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');
const STATUS = { aguardando_pagamento: 'Aguardando pagamento', pago: 'Pago', em_separacao: 'Em separação', em_transito: 'Em trânsito', entregue: 'Entregue', cancelado: 'Cancelado' };
const MONTAGEM_VALOR = 120;

/* ---- sessão ---- */
const Sessao = {
  token: () => localStorage.getItem('token'),
  usuario: () => { try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; } },
  salvar: (token, usuario) => { localStorage.setItem('token', token); localStorage.setItem('usuario', JSON.stringify(usuario)); },
  sair: () => { localStorage.removeItem('token'); localStorage.removeItem('usuario'); location.href = 'index.html'; },
  logado: () => !!localStorage.getItem('token'),
};
// Controle de rotas privadas no frontend
function exigirLogin(perfis) {
  const u = Sessao.usuario();
  if (!Sessao.logado() || !u) { location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search); return false; }
  if (perfis && !perfis.includes(u.tipo_perfil)) { alert('Acesso restrito.'); location.href = 'index.html'; return false; }
  return true;
}

/* ---- API ---- */
async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = Sessao.token();
  if (t && (auth || path.startsWith('/'))) headers.Authorization = 'Bearer ' + t;
  let res;
  try { res = await fetch(window.API_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('Não foi possível conectar ao servidor. Tente novamente.'); }
  let data = null; try { data = await res.json(); } catch { /* sem corpo */ }
  if (res.status === 401 && auth) { // token inválido/expirado
    localStorage.removeItem('token'); localStorage.removeItem('usuario');
    location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop());
    throw new Error('Sessão expirada.');
  }
  if (!res.ok) throw new Error((data && data.erro) || 'Erro ' + res.status);
  return data;
}

/* ---- toast ---- */
function toast(msg, tipo = '') {
  let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast ' + tipo; t.textContent = msg; box.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

/* ---- carrinho (LocalStorage) ---- */
const Carrinho = {
  itens: () => { try { return JSON.parse(localStorage.getItem('carrinho')) || []; } catch { return []; } },
  salvar(l) { localStorage.setItem('carrinho', JSON.stringify(l)); atualizarContador(); },
  limpar() { this.salvar([]); },
  qtd: () => Carrinho.itens().reduce((a, i) => a + i.quantidade, 0),
  // Regra de estoque: bloqueia se zerado ou se exceder o disponível
  adicionar(item, q = 1) {
    if (item.estoque <= 0) { alert('Produto sem estoque. Não é possível adicioná-lo ao carrinho.'); return false; }
    const l = this.itens(); const ex = l.find((i) => i.variacao_sku_id === item.variacao_sku_id);
    const novo = (ex ? ex.quantidade : 0) + q;
    if (novo > item.estoque) { alert(`Estoque insuficiente. Disponível: ${item.estoque} un.`); return false; }
    if (ex) { ex.quantidade = novo; ex.estoque = item.estoque; if (item.montagem) ex.montagem = true; } else l.push({ ...item, quantidade: q });
    this.salvar(l); toast('Adicionado ao carrinho', 'ok'); return true;
  },
  remover(id) { this.salvar(this.itens().filter((i) => i.variacao_sku_id !== id)); },
};
function atualizarContador() { const b = $('#cart-count'); if (b) b.textContent = Carrinho.qtd(); }

/* ---- cabeçalho comum ---- */
function renderHeader(ativo) {
  const u = Sessao.usuario(); const logado = Sessao.logado() && u;
  const staff = logado && ['admin', 'logistica'].includes(u.tipo_perfil);
  const li = (href, txt, key) => `<li><a href="${href}" class="${ativo === key ? 'active' : ''}">${txt}</a></li>`;
  const html = `
  <div class="topbar">Frete grátis acima de R$ 5.000 · 5% OFF no Pix · Use o cupom BEMVINDO10</div>
  <header class="site"><div class="container nav">
    <a class="logo" href="index.html">Casa<span>Nobre</span> Móveis</a>
    <button class="burger" aria-label="Menu" onclick="$('#menu').classList.toggle('open')">☰</button>
    <ul id="menu">
      ${li('index.html', 'Loja', 'loja')}
      ${staff ? li('admin.html#vendas', 'Movimentação de Vendas', 'vendas') + li('admin.html#produtos', 'Cadastro de Produtos', 'produtos') : ''}
      ${logado && !staff ? li('pedidos.html', 'Meus pedidos', 'pedidos') : ''}
      ${logado ? li('perfil.html', 'Olá, ' + esc(u.nome_completo.split(' ')[0]), 'perfil') + '<li><button class="linklike" onclick="Sessao.sair()">Sair</button></li>'
               : li('login.html', 'Entrar', 'login') + li('cadastro.html', 'Cadastrar', 'cadastro')}
      <li><a class="cart-pill ${ativo === 'carrinho' ? 'active' : ''}" href="carrinho.html">🛒 Carrinho <b id="cart-count">0</b></a></li>
    </ul></div></header>`;
  document.body.insertAdjacentHTML('afterbegin', html);
  atualizarContador();
  window.addEventListener('hashchange', () => $$('#menu a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === 'admin.html' + location.hash)));
}
const renderFooter = () => document.body.insertAdjacentHTML('beforeend', '<footer><div class="container">© 2026 CasaNobre Móveis · Projeto acadêmico de e-commerce</div></footer>');

/* ---- CPF (validação matemática) e máscaras ---- */
function validarCPF(valor) {
  const c = String(valor || '').replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += +c[i] * (t + 1 - i); if (((s * 10) % 11) % 10 !== +c[t]) return false; }
  return true;
}
const maskCPF = (v) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const maskCEP = (v) => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
const maskTel = (v) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
function aplicarMascara(el, fn) { el.addEventListener('input', () => { el.value = fn(el.value); }); }

/* ---- ViaCEP: autocompleta rua, bairro e cidade ---- */
async function buscarCEP(cep, { logradouro, bairro, cidade, estado, numero }) {
  const c = cep.replace(/\D/g, '');
  if (c.length !== 8) return false;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${c}/json/`); const d = await r.json();
    if (d.erro) { toast('CEP não encontrado.', 'err'); return false; }
    logradouro.value = d.logradouro || ''; bairro.value = d.bairro || ''; cidade.value = d.localidade || ''; estado.value = d.uf || '';
    (d.logradouro ? numero : logradouro).focus();
    return true;
  } catch { toast('Falha ao consultar o ViaCEP.', 'err'); return false; }
}

/* ---- fotos: usa .jpg local; se não existir tenta png, webp, jpeg e por fim a ilustração .svg ---- */
const EXTS = ['jpg', 'png', 'webp', 'jpeg', 'svg'];
const ehLocal = (u) => u && !/^(https?:)?\/\//.test(u) && !u.startsWith('data:');
function imgSrc(url) { // caminho salvo no banco -> tenta primeiro a foto .jpg de mesmo nome
  if (!url) return '';
  return ehLocal(url) ? url.replace(/\.(png|jpe?g|webp|svg)(\?.*)?$/i, '') + '.jpg' : url;
}
function imgErro(el) {
  const src = el.getAttribute('src') || '';
  if (!ehLocal(src)) { el.style.visibility = 'hidden'; return; }
  const base = src.replace(/\.(png|jpe?g|webp|svg)(\?.*)?$/i, '');
  const tentadas = (el.dataset.tentadas || src.split('.').pop().toLowerCase()).split(',');
  const prox = EXTS.find((e) => !tentadas.includes(e));
  if (!prox) { el.style.visibility = 'hidden'; return; }
  el.dataset.tentadas = [...tentadas, prox].join(',');
  el.src = `${base}.${prox}`;
}

/* ---- card de produto ---- */
function cardProduto(p) {
  const esgotado = p.estoque_total <= 0;
  const desc = p.preco_de_ref && Number(p.preco_de_ref) > p.preco_min ? Math.round((1 - p.preco_min / p.preco_de_ref) * 100) : 0;
  const unica = p.variacoes.length === 1;
  return `<article class="pcard">
    <a class="img" href="produto.html?id=${p.id}">
      <img loading="lazy" src="${esc(imgSrc(p.imagem_principal))}" alt="${esc(p.nome)}" onerror="imgErro(this)">
      ${esgotado ? '<span class="badge">Esgotado</span>' : desc ? `<span class="badge off">-${desc}%</span>` : ''}
    </a>
    <div class="body">
      <span class="cat">${esc(p.categoria?.nome)}</span>
      <h3>${esc(p.nome)}</h3>
      <div class="price">${p.variacoes.length > 1 ? '<small style="font-weight:400;font-size:.75rem">a partir de </small>' : ''}${brl(p.preco_min)}${desc ? `<span class="old">${brl(p.preco_de_ref)}</span>` : ''}</div>
      <div class="actions">
        <a class="btn sec sm" href="produto.html?id=${p.id}">Detalhes</a>
        <button class="btn sm" ${esgotado ? 'disabled' : ''} onclick="${unica ? `adicionarRapido(${p.id})` : `location.href='produto.html?id=${p.id}'`}">${esgotado ? 'Sem estoque' : unica ? 'Comprar' : 'Escolher'}</button>
      </div>
    </div></article>`;
}
function itemDeCarrinho(p, v, montagem = false) {
  const img = (p.imagens || []).find((i) => i.variacao_sku_id === v.id) || (p.imagens || [])[0];
  return { variacao_sku_id: v.id, produto_id: p.id, nome: p.nome, cor: v.cor_acabamento, preco: Number(v.preco_por), imagem: img?.url_imagem || '', estoque: v.estoque_atual, requer_montagem: p.requer_montagem, montagem };
}
