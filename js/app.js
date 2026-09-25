/**
 * app.js - Lógica Principal do Sistema de Controle de Estoque
 * Santos Manutenções
 */

// Estado Global
const App = {
  produtos: [],
  movimentacoes: [],
  colaboradores: [],
  filtroProduto: '',
  categoriaFiltro: '',
  statusFiltro: '',
  viewMode: 'grid', // 'grid' ou 'table'
  currentTab: 'dashboard',
  selectedEmployeeForExit: null,
  tempPhotoBase64: '',
  tema: 'light' // Padrão claro conforme solicitado
};

// Controle de Tema (Modo Claro / Modo Escuro)
App.carregarTema = () => {
  const salvo = localStorage.getItem('santos_theme') || 'light';
  App.aplicarTema(salvo);
};

App.aplicarTema = (tema) => {
  App.tema = tema;
  localStorage.setItem('santos_theme', tema);
  
  const iconEl = document.getElementById('theme-toggle-icon');
  const textEl = document.getElementById('theme-toggle-text');

  if (tema === 'light') {
    document.body.classList.add('light-theme');
    if (iconEl) iconEl.innerText = '🌙';
    if (textEl) textEl.innerText = 'Modo Escuro';
  } else {
    document.body.classList.remove('light-theme');
    if (iconEl) iconEl.innerText = '☀️';
    if (textEl) textEl.innerText = 'Modo Claro';
  }
};

App.alternarTema = () => {
  const novoTema = App.tema === 'light' ? 'dark' : 'light';
  App.aplicarTema(novoTema);
  App.mostrarToast(novoTema === 'light' ? 'Modo Claro ativado' : 'Modo Escuro ativado', 'info');
};

// Controle de Autenticação e Sessão
App.usuarioLogado = null;

App.verificarSessao = () => {
  const sessaoStr = localStorage.getItem('santos_sessao') || sessionStorage.getItem('santos_sessao');
  const telaLogin = document.getElementById('tela-login');
  const sessionBadge = document.getElementById('user-session-badge');
  const userName = document.getElementById('header-user-name');

  if (sessaoStr) {
    try {
      App.usuarioLogado = JSON.parse(sessaoStr);
      if (telaLogin) telaLogin.style.display = 'none';
      if (sessionBadge) sessionBadge.style.display = 'flex';
      if (userName) userName.innerText = App.usuarioLogado.nome || 'Administrador';
    } catch (e) {
      App.usuarioLogado = null;
      if (telaLogin) telaLogin.style.display = 'flex';
      if (sessionBadge) sessionBadge.style.display = 'none';
    }
  } else {
    App.usuarioLogado = null;
    if (telaLogin) telaLogin.style.display = 'flex';
    if (sessionBadge) sessionBadge.style.display = 'none';
  }
};

App.submeterLogin = (event) => {
  if (event) event.preventDefault();
  const usuarioInput = (document.getElementById('login-usuario')?.value || '').trim();
  const senhaInput = (document.getElementById('login-senha')?.value || '').trim();
  const lembrar = document.getElementById('login-lembrar')?.checked;

  const senhaSalva = localStorage.getItem('santos_admin_senha') || 'santos123';

  // Validação: aceita 'admin' com senha cadastrada, 'santos123' ou 'admin'
  if ((usuarioInput.toLowerCase() === 'admin' || usuarioInput.toLowerCase() === 'almoxarifado') && 
      (senhaInput === senhaSalva || senhaInput === 'admin' || senhaInput === 'santos123')) {
    
    const sessao = {
      usuario: 'admin',
      nome: 'Administrador Almoxarifado',
      perfil: 'ADMIN',
      loginEm: new Date().toISOString()
    };

    if (lembrar) {
      localStorage.setItem('santos_sessao', JSON.stringify(sessao));
    } else {
      sessionStorage.setItem('santos_sessao', JSON.stringify(sessao));
    }

    App.usuarioLogado = sessao;
    const telaLogin = document.getElementById('tela-login');
    const sessionBadge = document.getElementById('user-session-badge');
    const userName = document.getElementById('header-user-name');

    if (telaLogin) telaLogin.style.display = 'none';
    if (sessionBadge) sessionBadge.style.display = 'flex';
    if (userName) userName.innerText = sessao.nome;

    App.mostrarToast('Login realizado com sucesso! Bem-vindo, Administrador.', 'success');
  } else {
    App.mostrarToast('Usuário ou senha incorretos! Verifique os dados digitados.', 'danger');
  }
};

App.realizarLogout = () => {
  if (confirm('Deseja realmente sair do sistema?')) {
    localStorage.removeItem('santos_sessao');
    sessionStorage.removeItem('santos_sessao');
    App.usuarioLogado = null;
    
    const telaLogin = document.getElementById('tela-login');
    const sessionBadge = document.getElementById('user-session-badge');
    const inputSenha = document.getElementById('login-senha');

    if (inputSenha) inputSenha.value = '';
    if (telaLogin) telaLogin.style.display = 'flex';
    if (sessionBadge) sessionBadge.style.display = 'none';

    App.mostrarToast('Sessão encerrada com sucesso.', 'info');
  }
};

App.alternarVisibilidadeSenha = (idInput) => {
  const input = document.getElementById(idInput);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
};

App.salvarNovaSenha = (event) => {
  if (event) event.preventDefault();
  const senhaAtual = document.getElementById('senha-atual')?.value || '';
  const senhaNova = document.getElementById('senha-nova')?.value || '';
  const senhaConfirma = document.getElementById('senha-confirma')?.value || '';

  const senhaSalva = localStorage.getItem('santos_admin_senha') || 'santos123';

  if (senhaAtual !== senhaSalva && senhaAtual !== 'admin' && senhaAtual !== 'santos123') {
    App.mostrarToast('Senha atual informada está incorreta.', 'danger');
    return;
  }

  if (senhaNova.length < 4) {
    App.mostrarToast('A nova senha deve ter no mínimo 4 caracteres.', 'warning');
    return;
  }

  if (senhaNova !== senhaConfirma) {
    App.mostrarToast('A confirmação da nova senha não confere.', 'warning');
    return;
  }

  localStorage.setItem('santos_admin_senha', senhaNova);
  document.getElementById('form-alterar-senha')?.reset();
  App.notificarSalvamento();
  App.mostrarToast('Senha do Administrador atualizada com sucesso!', 'success');
};

App.notificarSalvamento = () => {
  const statusText = document.getElementById('sync-status-text');
  const dot = document.querySelector('.sync-dot');

  if (statusText) statusText.innerText = 'Salvando alterações...';
  if (dot) dot.style.backgroundColor = '#38bdf8';

  setTimeout(() => {
    if (statusText) statusText.innerText = 'Salvo automaticamente';
    if (dot) dot.style.backgroundColor = '#10b981';
  }, 500);
};

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Carrega tema visual, verifica autenticação e inicializa eventos IMEDIATAMENTE
  App.carregarTema();
  App.verificarSessao();
  App.inicializarEventos();

  // 2. Carrega dados do banco local de forma segura
  try {
    await window.db.readyPromise;
    await App.carregarDados();
    App.renderizarTudo();
    if (App.usuarioLogado) {
      App.mostrarToast('Sistema Santos Manutenções carregado com sucesso!', 'success');
    }
  } catch (err) {
    console.error('Erro ao inicializar banco de dados:', err);
    try {
      await App.carregarDados();
      App.renderizarTudo();
    } catch (e2) {
      console.error('Erro secundário no carregamento:', e2);
    }
  }
});

// Carrega todos os dados do banco para a memória
App.carregarDados = async () => {
  App.produtos = await window.db.getAll('produtos');
  App.movimentacoes = await window.db.getAll('movimentacoes');
  App.colaboradores = await window.db.getAll('colaboradores');
  
  // Limpeza solicitada: Remover todas as entradas já lançadas (executado de forma automática e segura)
  if (!localStorage.getItem('santos_limpeza_entradas_v2')) {
    const temEntradas = App.movimentacoes.some(m => m.tipo === 'ENTRADA');
    if (temEntradas) {
      await App.removerTodasEntradas(true);
    }
    localStorage.setItem('santos_limpeza_entradas_v2', 'true');
  }

  // Ordena movimentações por data decrescente
  App.movimentacoes.sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
};

// Formatação monetária BRL (R$ 0,00)
App.formatarMoeda = (valor) => {
  const num = Number(valor) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Formatação de data/hora (DD/MM/YYYY HH:mm)
App.formatarData = (isoStr) => {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// Formatação de data simples (DD/MM/YYYY)
App.formatarDataSimples = (isoStr) => {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString('pt-BR');
};

// Renderização geral
App.renderizarTudo = () => {
  App.atualizarDashboard();
  App.renderizarProdutos();
  App.renderizarMovimentacoes();
  App.renderizarColaboradores();
  App.popularSelects();
};

/* ==========================================================================
   DASHBOARD & ESTATÍSTICAS
   ========================================================================== */
App.atualizarDashboard = () => {
  const totalItens = App.produtos.reduce((acc, p) => acc + (Number(p.estoqueAtual) || 0), 0);
  const valorTotalEstoque = App.produtos.reduce((acc, p) => acc + ((Number(p.estoqueAtual) || 0) * (Number(p.valorUnitario) || 0)), 0);
  
  // Movimentações no mês atual
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();
  
  const movsMes = App.movimentacoes.filter(m => {
    const d = new Date(m.dataHora);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  const totalEntradasMes = movsMes.filter(m => m.tipo === 'ENTRADA').reduce((acc, m) => acc + Number(m.quantidade), 0);
  const totalSaidasMes = movsMes.filter(m => m.tipo === 'SAIDA').reduce((acc, m) => acc + Number(m.quantidade), 0);
  
  // Itens com estoque baixo (estoqueAtual <= estoqueMinimo)
  const itensCriticos = App.produtos.filter(p => Number(p.estoqueAtual) <= Number(p.estoqueMinimo));

  // Atualiza elementos no DOM
  document.getElementById('stat-total-itens').innerText = totalItens.toLocaleString('pt-BR');
  document.getElementById('stat-valor-estoque').innerText = App.formatarMoeda(valorTotalEstoque);
  document.getElementById('stat-entradas-mes').innerText = `+${totalEntradasMes.toLocaleString('pt-BR')} itens`;
  document.getElementById('stat-saidas-mes').innerText = `-${totalSaidasMes.toLocaleString('pt-BR')} itens`;
  document.getElementById('stat-itens-criticos').innerText = itensCriticos.length;

  // Consumo por Unidade
  App.renderizarGraficoConsumoUnidades();
  App.renderizarUltimasMovimentacoesDashboard();
};

App.renderizarGraficoConsumoUnidades = () => {
  const unidades = ['CDA', 'TCS', 'TSA', 'ITAMINAS', 'ADM'];
  const consumoPorUnidade = { 'CDA': 0, 'TCS': 0, 'TSA': 0, 'ITAMINAS': 0, 'ADM': 0, 'OUTROS': 0 };

  App.movimentacoes.filter(m => m.tipo === 'SAIDA').forEach(m => {
    const u = (m.unidadeDestino || 'OUTROS').toUpperCase().trim();
    if (consumoPorUnidade[u] !== undefined) {
      consumoPorUnidade[u] += (Number(m.valorTotal) || 0);
    } else {
      consumoPorUnidade['OUTROS'] += (Number(m.valorTotal) || 0);
    }
  });

  const maxVal = Math.max(...Object.values(consumoPorUnidade), 1);
  const container = document.getElementById('unit-consumption-bars');
  if (!container) return;

  let html = '';
  for (const [uni, val] of Object.entries(consumoPorUnidade)) {
    if (val === 0 && uni === 'OUTROS') continue;
    const pct = Math.round((val / maxVal) * 100);
    html += `
      <div class="unit-bar-item">
        <div class="unit-bar-header">
          <span><strong>${uni}</strong></span>
          <span style="color: #38bdf8;">${App.formatarMoeda(val)}</span>
        </div>
        <div class="unit-bar-track">
          <div class="unit-bar-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  }
  container.innerHTML = html || '<p class="text-muted">Nenhuma saída registrada até o momento.</p>';
};

App.renderizarUltimasMovimentacoesDashboard = () => {
  const container = document.getElementById('dashboard-recent-movs');
  if (!container) return;

  const ultimas = App.movimentacoes.slice(0, 5);
  if (ultimas.length === 0) {
    container.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-dim);">Nenhuma movimentação realizada ainda.</td></tr>';
    return;
  }

  container.innerHTML = ultimas.map(m => {
    const isEntrada = m.tipo === 'ENTRADA';
    const badgeClass = isEntrada ? 'badge-entrada' : 'badge-saida';
    const sinal = isEntrada ? '+' : '-';
    const destinoInfo = isEntrada ? (m.fornecedorOuNF || 'Reposição') : `${m.nomeFuncionario || 'Não inf.'} (${m.unidadeDestino || 'Geral'})`;

    return `
      <tr>
        <td>${App.formatarData(m.dataHora)}</td>
        <td><span class="badge ${badgeClass}">${m.tipo}</span></td>
        <td><strong>${m.produtoNome}</strong> <span style="font-size: 0.75rem; color: #94a3b8;">(${m.produtoCodigo})</span></td>
        <td style="font-weight: 700; color: ${isEntrada ? '#10b981' : '#f43f5e'};">${sinal}${m.quantidade} ${m.produtoUnidade || 'UN'}</td>
        <td>${destinoInfo}</td>
        <td style="font-weight: 600;">${App.formatarMoeda(m.valorTotal)}</td>
      </tr>
    `;
  }).join('');
};

/* ==========================================================================
   PRODUTOS (CATÁLOGO, ADIÇÃO, EDIÇÃO, EXCLUSÃO)
   ========================================================================== */
App.renderizarProdutos = () => {
  const containerGrid = document.getElementById('products-grid-container');
  const containerTable = document.getElementById('products-table-body');
  if (!containerGrid || !containerTable) return;

  // Filtragem
  let filtrados = App.produtos.filter(p => {
    const termo = App.filtroProduto.toLowerCase();
    const matchesTexto = (p.nome || '').toLowerCase().includes(termo) ||
                         (p.codigo || '').toLowerCase().includes(termo) ||
                         (p.descricao || '').toLowerCase().includes(termo) ||
                         (p.localizacao || '').toLowerCase().includes(termo);
    
    const matchesCategoria = !App.categoriaFiltro || p.categoria === App.categoriaFiltro;
    
    let matchesStatus = true;
    if (App.statusFiltro === 'baixo') {
      matchesStatus = Number(p.estoqueAtual) <= Number(p.estoqueMinimo) && Number(p.estoqueAtual) > 0;
    } else if (App.statusFiltro === 'zerado') {
      matchesStatus = Number(p.estoqueAtual) <= 0;
    } else if (App.statusFiltro === 'normal') {
      matchesStatus = Number(p.estoqueAtual) > Number(p.estoqueMinimo);
    }

    return matchesTexto && matchesCategoria && matchesStatus;
  });

  // Atualiza contador
  const countEl = document.getElementById('products-count');
  if (countEl) countEl.innerText = `${filtrados.length} produto(s) encontrado(s)`;

  if (filtrados.length === 0) {
    containerGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <p style="color: var(--text-muted); font-size: 1.1rem; margin-bottom: 1rem;">Nenhum produto encontrado com os filtros atuais.</p>
        <button class="btn btn-primary" onclick="App.abrirModalNovoProduto()">+ Cadastrar Primeiro Produto</button>
      </div>
    `;
    containerTable.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Nenhum produto encontrado.</td></tr>';
    return;
  }

  // Renderiza Grid de Cartões
  containerGrid.innerHTML = filtrados.map(p => {
    const estoqueAtual = Number(p.estoqueAtual) || 0;
    const estoqueMin = Number(p.estoqueMinimo) || 0;
    const valorUnit = Number(p.valorUnitario) || 0;
    const valorTotal = estoqueAtual * valorUnit;

    let statusBadge = '<span class="badge badge-ok">Normal</span>';
    if (estoqueAtual <= 0) {
      statusBadge = '<span class="badge badge-danger">Zerado</span>';
    } else if (estoqueAtual <= estoqueMin) {
      statusBadge = '<span class="badge badge-alert">Estoque Baixo</span>';
    }

    const photoHtml = p.foto
      ? `<img src="${p.foto}" alt="${p.nome}" onclick="App.ampliarFoto('${p.foto}', '${p.nome}')" style="cursor: zoom-in;" />`
      : `<div class="no-photo-placeholder">
           <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
           <span>Sem Foto</span>
         </div>`;

    return `
      <div class="product-card">
        <div class="product-card-img">
          ${photoHtml}
          <div style="position: absolute; top: 10px; right: 10px;">${statusBadge}</div>
        </div>
        <div class="product-card-body">
          <span class="product-code-tag">${p.codigo || 'SEM-CÓD'}</span>
          <h3 class="product-card-title" title="${p.nome}">${p.nome}</h3>
          
          <div class="product-meta-row">
            <span>${p.categoria || 'Geral'}</span>
            <span>Local: <strong>${p.localizacao || 'Almoxarifado'}</strong></span>
          </div>

          <div class="product-stock-display">
            <span class="stock-num">${estoqueAtual}</span>
            <span class="stock-unit">${p.unidade || 'UN'} em estoque</span>
            <span style="font-size: 0.75rem; color: #94a3b8; margin-left: auto;">Mín: ${estoqueMin}</span>
          </div>

          <div class="product-price-box">
            <div>
              <div style="font-size: 0.7rem; color: #94a3b8;">VALOR UNITÁRIO</div>
              <div class="price-unit-val">${App.formatarMoeda(valorUnit)}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.7rem; color: #94a3b8;">VALOR TOTAL</div>
              <div class="price-total-val">${App.formatarMoeda(valorTotal)}</div>
            </div>
          </div>

          <div class="product-card-actions">
            <button class="btn btn-danger btn-sm" onclick="App.abrirModalSaidaComProduto(${p.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Retirar
            </button>
            <button class="btn btn-success btn-sm" onclick="App.abrirModalEntradaComProduto(${p.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Repor
            </button>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid #334155;">
            <button class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 8px;" onclick="App.editarProduto(${p.id})">Editar</button>
            <button class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 8px; color: #f43f5e;" onclick="App.confirmarExclusaoProduto(${p.id})">Excluir</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Renderiza Tabela
  containerTable.innerHTML = filtrados.map(p => {
    const estoqueAtual = Number(p.estoqueAtual) || 0;
    const estoqueMin = Number(p.estoqueMinimo) || 0;
    const valorUnit = Number(p.valorUnitario) || 0;
    const valorTotal = estoqueAtual * valorUnit;

    let statusBadge = '<span class="badge badge-ok">Normal</span>';
    if (estoqueAtual <= 0) {
      statusBadge = '<span class="badge badge-danger">Zerado</span>';
    } else if (estoqueAtual <= estoqueMin) {
      statusBadge = '<span class="badge badge-alert">Baixo</span>';
    }

    const thumbHtml = p.foto
      ? `<div class="table-thumb" onclick="App.ampliarFoto('${p.foto}', '${p.nome}')"><img src="${p.foto}" alt="" /></div>`
      : `<div class="table-thumb"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>`;

    return `
      <tr>
        <td style="width: 50px;">${thumbHtml}</td>
        <td><code>${p.codigo || '-'}</code></td>
        <td><strong>${p.nome}</strong></td>
        <td>${p.categoria || '-'}</td>
        <td style="font-weight: 700; font-size: 1rem;">${estoqueAtual} <span style="font-size: 0.75rem; color: #94a3b8;">${p.unidade}</span></td>
        <td>${App.formatarMoeda(valorUnit)}</td>
        <td style="color: #38bdf8; font-weight: 600;">${App.formatarMoeda(valorTotal)}</td>
        <td>${statusBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-danger btn-sm" title="Registrar Retirada" onclick="App.abrirModalSaidaComProduto(${p.id})">Saída</button>
          <button class="btn btn-success btn-sm" title="Registrar Entrada" onclick="App.abrirModalEntradaComProduto(${p.id})">Entrada</button>
          <button class="btn btn-outline btn-sm" title="Editar" onclick="App.editarProduto(${p.id})">✏️</button>
          <button class="btn btn-outline btn-sm" style="color: #f43f5e;" title="Excluir" onclick="App.confirmarExclusaoProduto(${p.id})">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
};

App.alternarVisualizacaoProdutos = (mode) => {
  App.viewMode = mode;
  const gridEl = document.getElementById('products-grid-container');
  const tableEl = document.getElementById('products-table-container');
  const btnGrid = document.getElementById('btn-view-grid');
  const btnTable = document.getElementById('btn-view-table');

  if (mode === 'grid') {
    gridEl.style.display = 'grid';
    tableEl.style.display = 'none';
    btnGrid.classList.add('active');
    btnTable.classList.remove('active');
  } else {
    gridEl.style.display = 'none';
    tableEl.style.display = 'block';
    btnGrid.classList.remove('active');
    btnTable.classList.add('active');
  }
};

/* ==========================================================================
   CADASTRO E EDIÇÃO DE PRODUTO
   ========================================================================== */
App.abrirModalNovoProduto = () => {
  document.getElementById('form-produto').reset();
  document.getElementById('produto-id').value = '';
  document.getElementById('modal-produto-titulo').innerText = 'Cadastrar Novo Produto';
  App.tempPhotoBase64 = '';
  App.atualizarPreviewFoto('');
  
  // Limpa feedback visual de validação do código
  const inputCod = document.getElementById('prod-codigo');
  inputCod.style.borderColor = '';
  const feedback = document.getElementById('prod-codigo-feedback');
  if (feedback) {
    feedback.style.display = 'none';
    feedback.innerText = '';
  }

  // Sugere um código garantidamente único que não colida com nenhum existente
  let counter = App.produtos.length + 1;
  let suggestedCode = `PRD-${counter.toString().padStart(3, '0')}`;
  while (App.produtos.some(p => p.codigo && p.codigo.trim().toUpperCase() === suggestedCode.toUpperCase())) {
    counter++;
    suggestedCode = `PRD-${counter.toString().padStart(3, '0')}`;
  }
  inputCod.value = suggestedCode;
  
  App.abrirModal('modal-produto');
};

App.editarProduto = async (id) => {
  const p = App.produtos.find(x => x.id === id);
  if (!p) return;

  document.getElementById('produto-id').value = p.id;
  document.getElementById('modal-produto-titulo').innerText = 'Editar Produto';
  
  const inputCod = document.getElementById('prod-codigo');
  inputCod.value = p.codigo || '';
  inputCod.style.borderColor = '';
  
  const feedback = document.getElementById('prod-codigo-feedback');
  if (feedback) {
    feedback.style.display = 'none';
    feedback.innerText = '';
  }

  document.getElementById('prod-nome').value = p.nome || '';
  document.getElementById('prod-categoria').value = p.categoria || 'Geral';
  document.getElementById('prod-unidade').value = p.unidade || 'UN';
  document.getElementById('prod-valor').value = p.valorUnitario || '';
  document.getElementById('prod-estoque-inicial').value = p.estoqueAtual; // Modo de ajuste
  document.getElementById('prod-estoque-minimo').value = p.estoqueMinimo || 5;
  document.getElementById('prod-localizacao').value = p.localizacao || '';
  document.getElementById('prod-descricao').value = p.descricao || '';
  
  App.tempPhotoBase64 = p.foto || '';
  App.atualizarPreviewFoto(p.foto || '');

  App.abrirModal('modal-produto');
};

// Validação em tempo real ao digitar o código do produto
App.validarCodigoProdutoEmTempoReal = () => {
  const input = document.getElementById('prod-codigo');
  const feedback = document.getElementById('prod-codigo-feedback');
  if (!input || !feedback) return;

  const codigo = input.value.trim();
  const id = document.getElementById('produto-id')?.value;

  if (!codigo) {
    input.style.borderColor = '';
    feedback.style.display = 'none';
    feedback.innerText = '';
    return;
  }

  const duplicado = App.produtos.find(p => 
    p.codigo && p.codigo.trim().toUpperCase() === codigo.toUpperCase() &&
    (!id || p.id !== Number(id))
  );

  if (duplicado) {
    input.style.borderColor = '#f43f5e';
    feedback.style.display = 'block';
    feedback.style.color = '#f43f5e';
    feedback.innerText = `⚠️ Código já cadastrado para: "${duplicado.nome}"`;
  } else {
    input.style.borderColor = '#10b981';
    feedback.style.display = 'block';
    feedback.style.color = '#10b981';
    feedback.innerText = '✓ Código disponível para uso';
  }
};

App.salvarProduto = async (e) => {
  e.preventDefault();
  const id = document.getElementById('produto-id').value;
  const codigo = document.getElementById('prod-codigo').value.trim();
  const nome = document.getElementById('prod-nome').value.trim();
  const categoria = document.getElementById('prod-categoria').value;
  const unidade = document.getElementById('prod-unidade').value;
  const valorUnitario = parseFloat(document.getElementById('prod-valor').value) || 0;
  const estoqueInicial = parseFloat(document.getElementById('prod-estoque-inicial').value) || 0;
  const estoqueMinimo = parseFloat(document.getElementById('prod-estoque-minimo').value) || 0;
  const localizacao = document.getElementById('prod-localizacao').value.trim();
  const descricao = document.getElementById('prod-descricao').value.trim();

  // 1. Validação de Código Obrigatório
  if (!codigo) {
    App.mostrarToast('Por favor, informe o Código / SKU do produto.', 'warning');
    const inputCod = document.getElementById('prod-codigo');
    inputCod.focus();
    inputCod.style.borderColor = '#f43f5e';
    return;
  }

  // 2. Não permitir produtos com o mesmo código (duplicados)
  const prodComMesmoCodigo = App.produtos.find(p => 
    p.codigo && p.codigo.trim().toUpperCase() === codigo.toUpperCase() &&
    (!id || p.id !== Number(id))
  );

  if (prodComMesmoCodigo) {
    App.mostrarToast(`Não é permitido cadastrar produtos com o mesmo código! O código "${codigo}" já pertence ao produto "${prodComMesmoCodigo.nome}".`, 'danger');
    const inputCod = document.getElementById('prod-codigo');
    inputCod.focus();
    inputCod.style.borderColor = '#f43f5e';
    const feedback = document.getElementById('prod-codigo-feedback');
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.color = '#f43f5e';
      feedback.innerText = `⚠️ Código já em uso pelo produto: "${prodComMesmoCodigo.nome}"`;
    }
    return;
  }

  // 3. Validação do Nome do Produto
  if (!nome) {
    App.mostrarToast('Por favor, informe a descrição/nome do produto.', 'warning');
    document.getElementById('prod-nome').focus();
    return;
  }

  if (id) {
    // Atualização de produto existente
    const prodExistente = App.produtos.find(x => x.id === Number(id));
    if (prodExistente) {
      prodExistente.codigo = codigo;
      prodExistente.nome = nome;
      prodExistente.categoria = categoria;
      prodExistente.unidade = unidade;
      prodExistente.valorUnitario = valorUnitario;
      prodExistente.estoqueMinimo = estoqueMinimo;
      prodExistente.localizacao = localizacao;
      prodExistente.descricao = descricao;
      prodExistente.foto = App.tempPhotoBase64;
      prodExistente.dataAtualizacao = new Date().toISOString();

      // Se mudou o estoque diretamente pelo formulário de edição
      if (estoqueInicial !== prodExistente.estoqueAtual) {
        const diff = estoqueInicial - prodExistente.estoqueAtual;
        const tipoAjuste = diff > 0 ? 'ENTRADA' : 'SAIDA';
        
        await window.db.add('movimentacoes', {
          tipo: tipoAjuste,
          subtipo: 'AJUSTE_INVENTARIO',
          produtoId: prodExistente.id,
          produtoCodigo: prodExistente.codigo,
          produtoNome: prodExistente.nome,
          produtoUnidade: prodExistente.unidade,
          quantidade: Math.abs(diff),
          valorUnitario: prodExistente.valorUnitario,
          valorTotal: Math.abs(diff) * prodExistente.valorUnitario,
          estoqueAnterior: prodExistente.estoqueAtual,
          estoqueNovo: estoqueInicial,
          dataHora: new Date().toISOString(),
          unidadeDestino: 'ALMOXARIFADO CENTRAL',
          responsavel: 'ALMOXARIFADO',
          motivo: 'Ajuste manual de inventário na edição do produto',
          observacoes: `Saldo alterado de ${prodExistente.estoqueAtual} para ${estoqueInicial}`
        });

        prodExistente.estoqueAtual = estoqueInicial;
      }

      try {
        await window.db.update('produtos', prodExistente);
        App.mostrarToast('Produto atualizado com sucesso!', 'success');
      } catch (err) {
        App.mostrarToast(err.message, 'danger');
        return;
      }
    }
  } else {
    // Novo Produto
    const novoProduto = {
      codigo,
      nome,
      categoria,
      unidade,
      valorUnitario,
      estoqueInicial,
      estoqueAtual: estoqueInicial,
      estoqueMinimo,
      localizacao,
      descricao,
      foto: App.tempPhotoBase64,
      dataCadastro: new Date().toISOString()
    };

    try {
      const newId = await window.db.add('produtos', novoProduto);
      novoProduto.id = newId;
    } catch (err) {
      App.mostrarToast(err.message, 'danger');
      return;
    }

    // Registra movimentação de Estoque Inicial caso > 0
    if (estoqueInicial > 0) {
      await window.db.add('movimentacoes', {
        tipo: 'ENTRADA',
        subtipo: 'ESTOQUE_INICIAL',
        produtoId: newId,
        produtoCodigo: novoProduto.codigo,
        produtoNome: novoProduto.nome,
        produtoUnidade: novoProduto.unidade,
        quantidade: estoqueInicial,
        valorUnitario,
        valorTotal: estoqueInicial * valorUnitario,
        estoqueAnterior: 0,
        estoqueNovo: estoqueInicial,
        dataHora: new Date().toISOString(),
        unidadeDestino: 'ALMOXARIFADO CENTRAL',
        responsavel: 'ALMOXARIFADO',
        motivo: 'Cadastro de Estoque Inicial',
        observacoes: 'Registro inicial de implantação do produto'
      });
    }

    App.mostrarToast(`Produto "${nome}" cadastrado com sucesso!`, 'success');
  }

  App.notificarSalvamento();
  App.fecharModal('modal-produto');
  await App.carregarDados();
  App.renderizarTudo();
};

App.confirmarExclusaoProduto = async (id) => {
  const p = App.produtos.find(x => x.id === id);
  if (!p) return;

  if (confirm(`Tem certeza que deseja excluir o produto "${p.nome}" (Código: ${p.codigo})?\n\nEsta ação apagará o item do cadastro.`)) {
    await window.db.delete('produtos', id);
    App.notificarSalvamento();
    App.mostrarToast('Produto removido com sucesso.', 'info');
    await App.carregarDados();
    App.renderizarTudo();
  }
};

/* ==========================================================================
   FOTOS E UPLOAD
   ========================================================================== */
App.processarUploadFoto = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    App.mostrarToast('Por favor selecione um arquivo de imagem válido.', 'warning');
    return;
  }

  // Redimensionamento e compressão para Base64 leve
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 800; // Limite de 800px para economizar memória e garantir rapidez
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      App.tempPhotoBase64 = compressedDataUrl;
      App.atualizarPreviewFoto(compressedDataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

App.atualizarPreviewFoto = (base64) => {
  const previewContainer = document.getElementById('photo-preview-container');
  const previewImg = document.getElementById('photo-preview-img');
  const uploadArea = document.getElementById('photo-upload-placeholder');

  if (base64) {
    previewImg.src = base64;
    previewContainer.style.display = 'block';
    uploadArea.style.display = 'none';
  } else {
    previewImg.src = '';
    previewContainer.style.display = 'none';
    uploadArea.style.display = 'flex';
  }
};

App.removerFoto = (e) => {
  if (e) e.stopPropagation();
  App.tempPhotoBase64 = '';
  App.atualizarPreviewFoto('');
  document.getElementById('prod-foto-input').value = '';
};

App.ampliarFoto = (src, title) => {
  document.getElementById('modal-zoom-img').src = src;
  document.getElementById('modal-zoom-title').innerText = title || 'Visualização do Produto';
  App.abrirModal('modal-zoom-foto');
};

/* ==========================================================================
   MOVIMENTAÇÕES (ENTRADA & RETIRADA / SAÍDA)
   ========================================================================== */
App.abrirModalEntrada = () => {
  document.getElementById('form-entrada').reset();
  document.getElementById('entrada-data').value = new Date().toISOString().slice(0, 16);
  App.atualizarInfoProdutoEntrada();
  App.abrirModal('modal-entrada');
};

App.abrirModalEntradaComProduto = (prodId) => {
  App.abrirModalEntrada();
  document.getElementById('entrada-produto').value = prodId;
  App.atualizarInfoProdutoEntrada();
};

App.atualizarInfoProdutoEntrada = () => {
  const select = document.getElementById('entrada-produto');
  const prodId = Number(select.value);
  const p = App.produtos.find(x => x.id === prodId);
  const infoBox = document.getElementById('entrada-produto-info');
  const inputValor = document.getElementById('entrada-valor-unitario');

  if (p) {
    infoBox.innerHTML = `
      <div style="font-size: 0.85rem; color: #94a3b8; display: flex; justify-content: space-between;">
        <span>Estoque Atual: <strong style="color: #fff;">${p.estoqueAtual} ${p.unidade}</strong></span>
        <span>Preço Cadastrado: <strong style="color: #38bdf8;">${App.formatarMoeda(p.valorUnitario)}</strong></span>
      </div>
    `;
    inputValor.value = p.valorUnitario || '';
  } else {
    infoBox.innerHTML = '';
    inputValor.value = '';
  }
};

App.salvarEntrada = async (e) => {
  e.preventDefault();
  const prodId = Number(document.getElementById('entrada-produto').value);
  const quantidade = parseFloat(document.getElementById('entrada-qtd').value);
  const valorUnitario = parseFloat(document.getElementById('entrada-valor-unitario').value) || 0;
  const fornecedorOuNF = document.getElementById('entrada-fornecedor').value.trim();
  const motivo = document.getElementById('entrada-motivo').value.trim();
  const dataHora = document.getElementById('entrada-data').value || new Date().toISOString();
  const responsavel = document.getElementById('entrada-responsavel').value.trim() || 'ALMOXARIFADO';

  if (!prodId || isNaN(quantidade) || quantidade <= 0) {
    App.mostrarToast('Selecione um produto e informe uma quantidade positiva válida.', 'warning');
    return;
  }

  const p = App.produtos.find(x => x.id === prodId);
  if (!p) return;

  const estoqueAnterior = Number(p.estoqueAtual) || 0;
  const novoEstoque = estoqueAnterior + quantidade;

  // Atualiza produto
  p.estoqueAtual = novoEstoque;
  if (valorUnitario > 0) {
    p.valorUnitario = valorUnitario; // Atualiza o preço com base na última reposição
  }
  p.dataAtualizacao = new Date().toISOString();
  await window.db.update('produtos', p);

  // Registra movimentação
  await window.db.add('movimentacoes', {
    tipo: 'ENTRADA',
    subtipo: 'COMPRA_REPOSICAO',
    produtoId: p.id,
    produtoCodigo: p.codigo,
    produtoNome: p.nome,
    produtoUnidade: p.unidade,
    quantidade,
    valorUnitario: valorUnitario > 0 ? valorUnitario : p.valorUnitario,
    valorTotal: quantidade * (valorUnitario > 0 ? valorUnitario : p.valorUnitario),
    estoqueAnterior,
    estoqueNovo: novoEstoque,
    dataHora,
    unidadeDestino: 'ALMOXARIFADO CENTRAL',
    fornecedorOuNF,
    responsavel,
    motivo: motivo || 'Entrada / Reposição de Estoque'
  });

  App.notificarSalvamento();
  App.fecharModal('modal-entrada');
  App.mostrarToast(`Entrada de ${quantidade} ${p.unidade} de "${p.nome}" registrada! Novo saldo: ${novoEstoque}`, 'success');
  await App.carregarDados();
  App.renderizarTudo();
};

/* RETIRADA / SAÍDA */
App.abrirModalSaida = () => {
  document.getElementById('form-saida').reset();
  document.getElementById('saida-data').value = new Date().toISOString().slice(0, 16);
  App.selectedEmployeeForExit = null;
  document.getElementById('saida-emp-info').style.display = 'none';
  document.getElementById('saida-unidade').value = '';
  App.atualizarInfoProdutoSaida();
  App.abrirModal('modal-saida');
};

App.abrirModalSaidaComProduto = (prodId) => {
  App.abrirModalSaida();
  document.getElementById('saida-produto').value = prodId;
  App.atualizarInfoProdutoSaida();
};

App.atualizarInfoProdutoSaida = () => {
  const select = document.getElementById('saida-produto');
  const prodId = Number(select.value);
  const p = App.produtos.find(x => x.id === prodId);
  const infoBox = document.getElementById('saida-produto-info');
  const inputQtd = document.getElementById('saida-qtd');

  if (p) {
    const alertColor = p.estoqueAtual <= p.estoqueMinimo ? '#f59e0b' : '#10b981';
    infoBox.innerHTML = `
      <div style="font-size: 0.85rem; background: #0f172a; padding: 0.5rem 0.75rem; border-radius: 4px; border: 1px solid #334155;">
        Saldo Disponível em Estoque: <strong style="color: ${alertColor}; font-size: 1.05rem;">${p.estoqueAtual} ${p.unidade}</strong>
        ${p.estoqueAtual <= 0 ? ' <span style="color: #f43f5e; font-weight: bold;">(PRODUTO ESGOTADO!)</span>' : ''}
      </div>
    `;
    inputQtd.max = p.estoqueAtual;
  } else {
    infoBox.innerHTML = '';
  }
};

// Ao selecionar ou digitar funcionário na retirada, preenche automaticamente o local/unidade!
App.aoSelecionarFuncionarioRetirada = (termo) => {
  const val = (termo || '').trim().toUpperCase();
  const infoBox = document.getElementById('saida-emp-info');
  const inputUnidade = document.getElementById('saida-unidade');

  if (!val) {
    App.selectedEmployeeForExit = null;
    infoBox.style.display = 'none';
    inputUnidade.value = '';
    return;
  }

  // Tenta encontrar por matrícula ou nome exato ou parte
  const emp = App.colaboradores.find(c => 
    c.matricula === val || 
    c.nome.toUpperCase() === val ||
    `${c.matricula} - ${c.nome}`.toUpperCase() === val ||
    val.includes(c.matricula) && val.includes(c.nome.slice(0, 5))
  );

  if (emp) {
    App.selectedEmployeeForExit = emp;
    // Preenchimento automático da Unidade de destino conforme o local de trabalho do colaborador
    inputUnidade.value = emp.local;
    infoBox.innerHTML = `
      <div style="font-size: 0.85rem; color: #cbd5e1;">
        <div>👤 Colaborador: <strong>${emp.nome}</strong> (Matrícula: <strong>${emp.matricula}</strong>)</div>
        <div>💼 Cargo: <strong>${emp.cargo}</strong> | CPF: <code>${emp.cpf}</code></div>
        <div style="margin-top: 4px; color: #38bdf8;">
          🏢 Unidade de Trabalho Vinculada: <span class="emp-badge-local">${emp.local}</span>
        </div>
      </div>
    `;
    infoBox.style.display = 'block';
  } else {
    App.selectedEmployeeForExit = null;
    infoBox.style.display = 'none';
  }
};

App.salvarSaida = async (e) => {
  e.preventDefault();
  const prodId = Number(document.getElementById('saida-produto').value);
  const quantidade = parseFloat(document.getElementById('saida-qtd').value);
  const matriculaOuNome = document.getElementById('saida-funcionario-input').value.trim();
  const unidadeDestino = document.getElementById('saida-unidade').value.trim().toUpperCase();
  const motivo = document.getElementById('saida-motivo').value.trim();
  const dataHora = document.getElementById('saida-data').value || new Date().toISOString();
  const responsavel = document.getElementById('saida-responsavel').value.trim() || 'ALMOXARIFADO';

  if (!prodId) {
    App.mostrarToast('Por favor, selecione o material/produto a retirar.', 'warning');
    return;
  }

  if (isNaN(quantidade) || quantidade <= 0) {
    App.mostrarToast('Informe uma quantidade válida e positiva para retirada.', 'warning');
    return;
  }

  const p = App.produtos.find(x => x.id === prodId);
  if (!p) return;

  // Validação rigorosa de saldo em estoque
  if (quantidade > p.estoqueAtual) {
    App.mostrarToast(`Saldo insuficiente! Estoque disponível de "${p.nome}": apenas ${p.estoqueAtual} ${p.unidade}.`, 'danger');
    return;
  }

  if (!matriculaOuNome) {
    App.mostrarToast('Informe o colaborador responsável pela retirada do material.', 'warning');
    return;
  }

  if (!unidadeDestino) {
    App.mostrarToast('A unidade de destino deve ser preenchida.', 'warning');
    return;
  }

  const emp = App.selectedEmployeeForExit || {
    nome: matriculaOuNome,
    matricula: 'N/A',
    cargo: 'N/A',
    local: unidadeDestino
  };

  const estoqueAnterior = Number(p.estoqueAtual);
  const novoEstoque = estoqueAnterior - quantidade;

  // Atualiza saldo do produto
  p.estoqueAtual = novoEstoque;
  p.dataAtualizacao = new Date().toISOString();
  await window.db.update('produtos', p);

  // Registra movimentação de saída vinculando funcionário e unidade
  const movId = await window.db.add('movimentacoes', {
    tipo: 'SAIDA',
    subtipo: 'RETIRADA_COLABORADOR',
    produtoId: p.id,
    produtoCodigo: p.codigo,
    produtoNome: p.nome,
    produtoUnidade: p.unidade,
    quantidade,
    valorUnitario: p.valorUnitario,
    valorTotal: quantidade * p.valorUnitario,
    estoqueAnterior,
    estoqueNovo: novoEstoque,
    dataHora,
    matriculaFuncionario: emp.matricula,
    nomeFuncionario: emp.nome,
    cargoFuncionario: emp.cargo,
    unidadeDestino,
    motivo: motivo || 'Retirada de Material para Operação / Manutenção',
    responsavel
  });

  App.notificarSalvamento();
  App.fecharModal('modal-saida');
  App.mostrarToast(`Retirada de ${quantidade} ${p.unidade} confirmada para ${emp.nome} (Unidade: ${unidadeDestino})!`, 'success');
  
  await App.carregarDados();
  App.renderizarTudo();

  // Oferece impressão imediata da Cautela de Retirada
  if (confirm(`Deseja imprimir o Comprovante / Cautela de Retirada nº ${movId} agora?`)) {
    App.imprimirCautela(movId);
  }
};

/* ==========================================================================
   EXCLUSÃO E LIMPEZA DE MOVIMENTAÇÕES
   ========================================================================== */
// Remove todas as entradas já lançadas no sistema
App.removerTodasEntradas = async (silencioso = false) => {
  if (!silencioso) {
    const confirmar = confirm(
      'Atenção: Deseja realmente remover TODAS as entradas já lançadas no sistema?\n\n' +
      '• Todas as movimentações do tipo ENTRADA (inclusive saldo inicial) serão excluídas;\n' +
      '• Os saldos em estoque de todos os produtos serão recalculados;\n' +
      '• Todas as alterações serão salvas automaticamente.'
    );
    if (!confirmar) return;
  }

  try {
    const todasMovs = await window.db.getAll('movimentacoes');
    const entradas = todasMovs.filter(m => m.tipo === 'ENTRADA');

    if (entradas.length === 0 && !silencioso) {
      App.mostrarToast('Nenhuma movimentação de entrada encontrada para remover.', 'info');
      return;
    }

    // 1. Remove cada movimentação de ENTRADA do banco de dados
    for (const ent of entradas) {
      await window.db.delete('movimentacoes', ent.id);
    }

    // 2. Movimentações que permanecem (ex: saídas)
    const movsRestantes = todasMovs.filter(m => m.tipo !== 'ENTRADA');

    // 3. Atualiza produtos: zera estoqueInicial e recalcula estoqueAtual
    const prods = await window.db.getAll('produtos');
    for (const p of prods) {
      const entradasProd = movsRestantes.filter(m => m.tipo === 'ENTRADA' && (m.produtoId === p.id || m.produtoCodigo === p.codigo));
      const totalEntradas = entradasProd.reduce((acc, m) => acc + (Number(m.quantidade) || 0), 0);

      const saidasProd = movsRestantes.filter(m => m.tipo === 'SAIDA' && (m.produtoId === p.id || m.produtoCodigo === p.codigo));
      const totalSaidas = saidasProd.reduce((acc, m) => acc + (Number(m.quantidade) || 0), 0);

      p.estoqueInicial = 0;
      p.estoqueAtual = Math.max(0, totalEntradas - totalSaidas);
      p.dataAtualizacao = new Date().toISOString();
      await window.db.update('produtos', p);
    }

    // 4. Sincroniza estado em memória
    App.movimentacoes = movsRestantes;
    App.movimentacoes.sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
    App.produtos = prods;

    // 5. Atualiza interface e notifica salvamento
    App.renderizarTudo();
    App.notificarSalvamento();

    if (!silencioso) {
      App.mostrarToast(`Todas as ${entradas.length} entradas lançadas foram removidas com sucesso!`, 'success');
    }
  } catch (err) {
    console.error('Erro ao remover todas as entradas:', err);
    if (!silencioso) {
      App.mostrarToast('Erro ao remover as entradas.', 'danger');
    }
  }
};

// Exclui uma movimentação individual (seja entrada ou saída) com estorno de estoque
App.excluirMovimentacao = async (movId) => {
  const mov = App.movimentacoes.find(m => m.id === movId);
  if (!mov) {
    App.mostrarToast('Movimentação não encontrada.', 'danger');
    return;
  }

  const isEntrada = mov.tipo === 'ENTRADA';
  const desc = isEntrada
    ? `a ENTRADA de ${mov.quantidade} ${mov.produtoUnidade || 'UN'} do produto "${mov.produtoNome}"`
    : `a RETIRADA de ${mov.quantidade} ${mov.produtoUnidade || 'UN'} para "${mov.nomeFuncionario || 'colaborador'}"`;

  if (!confirm(`Deseja realmente excluir ${desc}?\n\nO saldo do produto será estornado e recalculado automaticamente.`)) {
    return;
  }

  try {
    const prod = App.produtos.find(p => p.id === mov.produtoId || p.codigo === mov.produtoCodigo);
    if (prod) {
      if (isEntrada) {
        // Estorno de entrada: deduz do estoque atual
        prod.estoqueAtual = Math.max(0, (Number(prod.estoqueAtual) || 0) - Number(mov.quantidade));
      } else {
        // Estorno de saída: devolve ao estoque atual
        prod.estoqueAtual = (Number(prod.estoqueAtual) || 0) + Number(mov.quantidade);
      }
      prod.dataAtualizacao = new Date().toISOString();
      await window.db.update('produtos', prod);
    }

    await window.db.delete('movimentacoes', mov.id);

    App.movimentacoes = App.movimentacoes.filter(m => m.id !== movId);
    App.renderizarTudo();
    App.notificarSalvamento();
    App.mostrarToast('Movimentação excluída e saldo atualizado com sucesso!', 'success');
  } catch (err) {
    console.error('Erro ao excluir movimentação:', err);
    App.mostrarToast('Erro ao excluir movimentação.', 'danger');
  }
};

/* ==========================================================================
   HISTÓRICO DE MOVIMENTAÇÕES
   ========================================================================== */
App.renderizarMovimentacoes = () => {
  const container = document.getElementById('movimentacoes-table-body');
  if (!container) return;

  const tipoFiltro = document.getElementById('filtro-mov-tipo')?.value || '';
  const unidadeFiltro = document.getElementById('filtro-mov-unidade')?.value || '';
  const buscaTexto = (document.getElementById('busca-mov-texto')?.value || '').toLowerCase();

  const filtradas = App.movimentacoes.filter(m => {
    const matchTipo = !tipoFiltro || m.tipo === tipoFiltro;
    const matchUnidade = !unidadeFiltro || (m.unidadeDestino || '').toUpperCase() === unidadeFiltro.toUpperCase();
    const matchBusca = !buscaTexto ||
      (m.produtoNome || '').toLowerCase().includes(buscaTexto) ||
      (m.produtoCodigo || '').toLowerCase().includes(buscaTexto) ||
      (m.nomeFuncionario || '').toLowerCase().includes(buscaTexto) ||
      (m.matriculaFuncionario || '').toLowerCase().includes(buscaTexto) ||
      (m.motivo || '').toLowerCase().includes(buscaTexto);

    return matchTipo && matchUnidade && matchBusca;
  });

  if (filtradas.length === 0) {
    container.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-dim);">Nenhuma movimentação encontrada com os filtros selecionados.</td></tr>';
    return;
  }

  container.innerHTML = filtradas.map(m => {
    const isEntrada = m.tipo === 'ENTRADA';
    const badgeClass = isEntrada ? 'badge-entrada' : 'badge-saida';
    const sinal = isEntrada ? '+' : '-';
    const corQtd = isEntrada ? '#10b981' : '#f43f5e';

    let colabHtml = '-';
    if (!isEntrada && m.nomeFuncionario) {
      colabHtml = `
        <strong>${m.nomeFuncionario}</strong>
        <div style="font-size: 0.75rem; color: #94a3b8;">Matrícula: ${m.matriculaFuncionario || 'N/A'}</div>
      `;
    } else if (isEntrada && m.fornecedorOuNF) {
      colabHtml = `<span style="color: #94a3b8;">${m.fornecedorOuNF}</span>`;
    }

    return `
      <tr>
        <td style="font-size: 0.8rem; white-space: nowrap;">${App.formatarData(m.dataHora)}</td>
        <td><span class="badge ${badgeClass}">${m.tipo}</span></td>
        <td>
          <strong>${m.produtoNome}</strong>
          <div style="font-size: 0.75rem; color: #94a3b8;">Cód: ${m.produtoCodigo} | Saldo: ${m.estoqueAnterior} ➔ <strong>${m.estoqueNovo}</strong></div>
        </td>
        <td style="font-weight: 700; color: ${corQtd};">${sinal}${m.quantidade} ${m.produtoUnidade || 'UN'}</td>
        <td style="font-weight: 600;">${App.formatarMoeda(m.valorTotal)}</td>
        <td>${colabHtml}</td>
        <td style="text-align: right; white-space: nowrap;">
          ${!isEntrada ? `<button class="btn btn-outline btn-sm" onclick="App.imprimirCautela(${m.id})" title="Imprimir Comprovante">📄 Cautela</button>` : ''}
          <button class="btn btn-outline-danger btn-sm" onclick="App.excluirMovimentacao(${m.id})" title="Excluir Lançamento">🗑️ Excluir</button>
        </td>
      </tr>
    `;
  }).join('');
};

/* ==========================================================================
   COLABORADORES (BASE DE DADOS FORNECIDA)
   ========================================================================== */
App.renderizarColaboradores = () => {
  const container = document.getElementById('colaboradores-table-body');
  if (!container) return;

  const busca = (document.getElementById('busca-colab-texto')?.value || '').toLowerCase();
  const filtroLocal = document.getElementById('filtro-colab-local')?.value || '';

  const filtrados = App.colaboradores.filter(c => {
    const matchBusca = !busca || 
      (c.nome || '').toLowerCase().includes(busca) ||
      (c.matricula || '').toLowerCase().includes(busca) ||
      (c.cargo || '').toLowerCase().includes(busca) ||
      (c.cpf || '').toLowerCase().includes(busca);

    const matchLocal = !filtroLocal || (c.local || '').toUpperCase() === filtroLocal.toUpperCase();
    return matchBusca && matchLocal;
  });

  const countBadge = document.getElementById('colab-count-badge');
  if (countBadge) countBadge.innerText = `${filtrados.length} colaboradores`;

  if (filtrados.length === 0) {
    container.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Nenhum colaborador encontrado.</td></tr>';
    return;
  }

  container.innerHTML = filtrados.map(c => {
    // Contagem de retiradas feitas por este colaborador
    const totalRetiradas = App.movimentacoes.filter(m => m.tipo === 'SAIDA' && m.matriculaFuncionario === c.matricula).length;

    return `
      <tr>
        <td><strong style="color: #38bdf8; font-family: monospace;">${c.matricula}</strong></td>
        <td><strong>${c.nome}</strong></td>
        <td><code>${c.cpf || '-'}</code></td>
        <td>${c.cargo || '-'}</td>
        <td><span class="badge badge-unit">${c.local}</span></td>
        <td style="text-align: right;">
          <span style="font-size: 0.8rem; color: #94a3b8; margin-right: 0.5rem;">${totalRetiradas} retiradas</span>
          <button class="btn btn-outline btn-sm" onclick="App.abrirHistoricoColaborador('${c.matricula}')">Histórico</button>
        </td>
      </tr>
    `;
  }).join('');
};

App.popularSelects = () => {
  // Selects de produtos
  const selectEntrada = document.getElementById('entrada-produto');
  const selectSaida = document.getElementById('saida-produto');
  const datalistColab = document.getElementById('colaboradores-datalist');

  const prodsOptions = App.produtos.map(p => 
    `<option value="${p.id}">${p.codigo} - ${p.nome} (Saldo: ${p.estoqueAtual} ${p.unidade})</option>`
  ).join('');

  if (selectEntrada) {
    selectEntrada.innerHTML = '<option value="">-- Selecione o Produto --</option>' + prodsOptions;
  }
  if (selectSaida) {
    selectSaida.innerHTML = '<option value="">-- Selecione o Produto --</option>' + prodsOptions;
  }

  // Datalist de Colaboradores para busca rápida
  if (datalistColab) {
    datalistColab.innerHTML = App.colaboradores.map(c => 
      `<option value="${c.matricula} - ${c.nome}">${c.cargo} | Local: ${c.local}</option>`
    ).join('');
  }
};

App.abrirModalNovoColaborador = () => {
  document.getElementById('form-colaborador').reset();
  App.abrirModal('modal-colaborador');
};

App.salvarColaborador = async (e) => {
  e.preventDefault();
  const matricula = document.getElementById('colab-matricula').value.trim();
  const nome = document.getElementById('colab-nome').value.trim().toUpperCase();
  const cpf = document.getElementById('colab-cpf').value.trim();
  const cargo = document.getElementById('colab-cargo').value.trim().toUpperCase();
  const local = document.getElementById('colab-local').value.trim().toUpperCase();

  if (!matricula || !nome || !local) {
    App.mostrarToast('Preencha matrícula, nome e unidade do colaborador.', 'warning');
    return;
  }

  // Verifica se matrícula já existe
  const existe = App.colaboradores.find(c => c.matricula === matricula);
  if (existe) {
    App.mostrarToast(`Já existe um colaborador com a matrícula ${matricula}!`, 'danger');
    return;
  }

  await window.db.add('colaboradores', {
    matricula,
    nome,
    cpf,
    cargo,
    local,
    ativo: true,
    dataCadastro: new Date().toISOString()
  });

  App.notificarSalvamento();
  App.fecharModal('modal-colaborador');
  App.mostrarToast(`Colaborador ${nome} cadastrado com sucesso!`, 'success');
  await App.carregarDados();
  App.renderizarTudo();
};

App.abrirHistoricoColaborador = (matricula) => {
  const c = App.colaboradores.find(x => x.matricula === matricula);
  if (!c) return;

  const retiradas = App.movimentacoes.filter(m => m.tipo === 'SAIDA' && m.matriculaFuncionario === matricula);
  
  let html = `
    <div style="margin-bottom: 1rem; padding: 0.75rem; background: #0f172a; border-radius: var(--radius-sm); border: 1px solid #334155;">
      <h4 style="color: #fff; margin-bottom: 0.25rem;">${c.nome} (Matrícula: ${c.matricula})</h4>
      <div style="font-size: 0.85rem; color: #94a3b8;">Cargo: ${c.cargo} | CPF: ${c.cpf} | Unidade: <strong style="color: #38bdf8;">${c.local}</strong></div>
    </div>
  `;

  if (retiradas.length === 0) {
    html += '<p style="text-align: center; color: var(--text-dim); padding: 1.5rem;">Nenhum material retirado por este colaborador até o momento.</p>';
  } else {
    html += `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Material</th>
              <th>Quantidade</th>
              <th>Valor Total</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${retiradas.map(m => `
              <tr>
                <td>${App.formatarData(m.dataHora)}</td>
                <td><strong>${m.produtoNome}</strong> (${m.produtoCodigo})</td>
                <td style="color: #f43f5e; font-weight: 700;">-${m.quantidade} ${m.produtoUnidade}</td>
                <td>${App.formatarMoeda(m.valorTotal)}</td>
                <td><button class="btn btn-outline btn-sm" onclick="App.imprimirCautela(${m.id})">📄 Cautela</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  document.getElementById('modal-historico-conteudo').innerHTML = html;
  App.abrirModal('modal-historico-colaborador');
};

/* ==========================================================================
   RELATÓRIOS E IMPRESSÃO
   ========================================================================== */
App.gerarRelatorioPosicaoEstoque = () => {
  const printArea = document.getElementById('print-area');
  const agora = new Date().toLocaleString('pt-BR');
  const valorTotalGeral = App.produtos.reduce((acc, p) => acc + (p.estoqueAtual * p.valorUnitario), 0);
  const totalItensGeral = App.produtos.reduce((acc, p) => acc + p.estoqueAtual, 0);

  printArea.innerHTML = `
    <div class="print-page">
      <div class="print-header">
        <img src="logo_santos.jpg" class="print-logo" alt="Santos Manutenções" />
        <div class="print-title-box">
          <div class="print-title">Relatório de Posição de Estoque</div>
          <div class="print-date">Emissão: ${agora} | Santos Manutenções</div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 10pt; background: #f8fafc; padding: 10px; border: 1px solid #ccc;">
        <div>Total de Itens Físicos: <strong>${totalItensGeral}</strong></div>
        <div>Total de Produtos Cadastrados: <strong>${App.produtos.length}</strong></div>
        <div>Valor Patrimonial Total: <strong>${App.formatarMoeda(valorTotalGeral)}</strong></div>
      </div>

      <table class="print-table">
        <thead>
          <tr>
            <th>Cód.</th>
            <th>Descrição do Material</th>
            <th>Categoria</th>
            <th>Local</th>
            <th>Estoque</th>
            <th>Valor Unit.</th>
            <th>Valor Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${App.produtos.map(p => {
            const valTotal = p.estoqueAtual * p.valorUnitario;
            let status = 'Normal';
            if (p.estoqueAtual <= 0) status = 'ZERADO';
            else if (p.estoqueAtual <= p.estoqueMinimo) status = 'BAIXO';

            return `
              <tr>
                <td>${p.codigo}</td>
                <td><strong>${p.nome}</strong></td>
                <td>${p.categoria}</td>
                <td>${p.localizacao || 'Almox.'}</td>
                <td style="font-weight: bold;">${p.estoqueAtual} ${p.unidade}</td>
                <td>${App.formatarMoeda(p.valorUnitario)}</td>
                <td>${App.formatarMoeda(valTotal)}</td>
                <td>${status}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="print-signatures">
        <div class="signature-line">Responsável pelo Almoxarifado<br><span style="font-size: 8pt; color: #555;">Santos Manutenções</span></div>
        <div class="signature-line">Gestão Operacional / Auditoria<br><span style="font-size: 8pt; color: #555;">Visto e Conferência</span></div>
      </div>
    </div>
  `;

  window.print();
};

App.gerarRelatorioMovimentacoes = () => {
  const printArea = document.getElementById('print-area');
  const agora = new Date().toLocaleString('pt-BR');

  const tipoFiltro = document.getElementById('filtro-rel-tipo')?.value || '';
  const unidadeFiltro = document.getElementById('filtro-rel-unidade')?.value || '';
  const dataInicio = document.getElementById('filtro-rel-inicio')?.value;
  const dataFim = document.getElementById('filtro-rel-fim')?.value;

  const filtradas = App.movimentacoes.filter(m => {
    const matchTipo = !tipoFiltro || m.tipo === tipoFiltro;
    const matchUnidade = !unidadeFiltro || (m.unidadeDestino || '').toUpperCase() === unidadeFiltro.toUpperCase();
    
    let matchData = true;
    if (dataInicio) {
      matchData = matchData && new Date(m.dataHora) >= new Date(dataInicio + 'T00:00:00');
    }
    if (dataFim) {
      matchData = matchData && new Date(m.dataHora) <= new Date(dataFim + 'T23:59:59');
    }

    return matchTipo && matchUnidade && matchData;
  });

  const totalValor = filtradas.reduce((acc, m) => acc + (Number(m.valorTotal) || 0), 0);

  printArea.innerHTML = `
    <div class="print-page">
      <div class="print-header">
        <img src="logo_santos.jpg" class="print-logo" alt="Santos Manutenções" />
        <div class="print-title-box">
          <div class="print-title">Relatório de Movimentação de Estoque</div>
          <div class="print-date">Emissão: ${agora} | Registros: ${filtradas.length}</div>
        </div>
      </div>

      <div style="font-size: 9.5pt; margin-bottom: 12px; background: #f8fafc; padding: 8px; border: 1px solid #ccc;">
        Filtros aplicados: Tipo [${tipoFiltro || 'Todos'}] | Unidade [${unidadeFiltro || 'Todas'}] | Período: [${dataInicio || 'Início'} até ${dataFim || 'Hoje'}] | <strong>Total Financeiro Movimentado: ${App.formatarMoeda(totalValor)}</strong>
      </div>

      <table class="print-table">
        <thead>
          <tr>
            <th>Data/Hora</th>
            <th>Tipo</th>
            <th>Material</th>
            <th>Qtd</th>
            <th>Valor Total</th>
            <th>Colaborador / Destino</th>
            <th>Unidade</th>
          </tr>
        </thead>
        <tbody>
          ${filtradas.map(m => `
            <tr>
              <td>${App.formatarData(m.dataHora)}</td>
              <td><strong>${m.tipo}</strong></td>
              <td>${m.produtoNome} (${m.produtoCodigo})</td>
              <td style="font-weight: bold;">${m.quantidade} ${m.produtoUnidade}</td>
              <td>${App.formatarMoeda(m.valorTotal)}</td>
              <td>${m.nomeFuncionario ? `${m.nomeFuncionario} (Mat: ${m.matriculaFuncionario})` : (m.fornecedorOuNF || '-')}</td>
              <td><strong>${m.unidadeDestino || 'GERAL'}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="print-signatures">
        <div class="signature-line">Responsável pela Emissão</div>
        <div class="signature-line">Conferência Almoxarifado Central</div>
      </div>
    </div>
  `;

  window.print();
};

// Emissão e impressão de Cautela / Comprovante de Retirada individual
App.imprimirCautela = (movId) => {
  const m = App.movimentacoes.find(x => x.id === movId);
  if (!m) return;

  const printArea = document.getElementById('print-area');
  const dataFormatada = App.formatarData(m.dataHora);

  printArea.innerHTML = `
    <div class="print-page">
      <div class="print-header">
        <img src="logo_santos.jpg" class="print-logo" alt="Santos Manutenções" />
        <div class="print-title-box">
          <div class="print-title">Cautela de Retirada de Material</div>
          <div class="print-date">Nº Registro: <strong>#${m.id.toString().padStart(5, '0')}</strong></div>
        </div>
      </div>

      <div class="print-voucher-box">
        <div class="voucher-grid">
          <div><strong>Data e Hora:</strong> ${dataFormatada}</div>
          <div><strong>Unidade de Destino:</strong> <span style="font-size: 1.15em; font-weight: bold;">${m.unidadeDestino}</span></div>
          <div><strong>Colaborador:</strong> ${m.nomeFuncionario || 'Não informado'}</div>
          <div><strong>Matrícula:</strong> ${m.matriculaFuncionario || '-'}</div>
          <div><strong>Cargo:</strong> ${m.cargoFuncionario || '-'}</div>
          <div><strong>Responsável Almoxarifado:</strong> ${m.responsavel || 'ALMOXARIFADO'}</div>
        </div>

        <div style="border-top: 1px solid #000; padding-top: 10px; margin-top: 5px;">
          <h4 style="margin-bottom: 8px; text-transform: uppercase;">Material Retirado</h4>
          <table class="print-table" style="margin-top: 0;">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição do Material</th>
                <th>Quantidade</th>
                <th>Valor Unitário</th>
                <th>Valor Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${m.produtoCodigo}</td>
                <td><strong>${m.produtoNome}</strong></td>
                <td style="font-size: 1.1em; font-weight: bold;">${m.quantidade} ${m.produtoUnidade}</td>
                <td>${App.formatarMoeda(m.valorUnitario)}</td>
                <td>${App.formatarMoeda(m.valorTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="margin-top: 15px; font-size: 9.5pt; color: #222;">
          <strong>Finalidade / Aplicação:</strong> ${m.motivo || 'Uso em manutenção ferroviária / operacional.'}
        </div>

        <div style="margin-top: 15px; font-size: 8.5pt; line-height: 1.4; border: 1px dashed #444; padding: 8px; background: #fafafa;">
          <strong>Termo de Responsabilidade:</strong> Declaro ter recebido em perfeito estado o(s) material(is) e/ou equipamento(s) acima discriminados, comprometendo-me a utilizá-los exclusivamente no desempenho de minhas atividades profissionais na Santos Manutenções, zelando pela sua guarda e conservação.
        </div>
      </div>

      <div class="print-signatures" style="margin-top: 60px;">
        <div class="signature-line">
          ${m.nomeFuncionario || 'Colaborador'}<br>
          <span style="font-size: 8pt; color: #555;">Matrícula: ${m.matriculaFuncionario || '-'} | Unidade: ${m.unidadeDestino}</span>
        </div>
        <div class="signature-line">
          ${m.responsavel || 'Almoxarife'}<br>
          <span style="font-size: 8pt; color: #555;">Almoxarifado Central - Santos Manutenções</span>
        </div>
      </div>
    </div>
  `;

  window.print();
};

/* ==========================================================================
   EXPORTAÇÃO CSV / EXCEL
   ========================================================================== */
App.exportarProdutosCSV = () => {
  if (App.produtos.length === 0) {
    App.mostrarToast('Nenhum produto cadastrado para exportar.', 'warning');
    return;
  }

  let csv = 'Codigo;Nome;Categoria;Unidade;EstoqueAtual;EstoqueMinimo;ValorUnitario;ValorTotal;Localizacao\n';
  App.produtos.forEach(p => {
    const valTotal = (p.estoqueAtual * p.valorUnitario).toFixed(2);
    csv += `"${p.codigo}";"${p.nome}";"${p.categoria}";"${p.unidade}";${p.estoqueAtual};${p.estoqueMinimo};${p.valorUnitario.toFixed(2)};${valTotal};"${p.localizacao || ''}"\n`;
  });

  App.baixarArquivo(csv, `estoque_santos_manutencoes_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8;');
};

App.exportarMovimentacoesCSV = () => {
  if (App.movimentacoes.length === 0) {
    App.mostrarToast('Nenhuma movimentação para exportar.', 'warning');
    return;
  }

  let csv = 'DataHora;Tipo;CodigoProduto;Produto;Quantidade;Unidade;ValorUnitario;ValorTotal;MatriculaColaborador;Colaborador;UnidadeDestino;Motivo\n';
  App.movimentacoes.forEach(m => {
    csv += `"${App.formatarData(m.dataHora)}";"${m.tipo}";"${m.produtoCodigo}";"${m.produtoNome}";${m.quantidade};"${m.produtoUnidade}";${m.valorUnitario.toFixed(2)};${m.valorTotal.toFixed(2)};"${m.matriculaFuncionario || ''}";"${m.nomeFuncionario || ''}";"${m.unidadeDestino || ''}";"${m.motivo || ''}"\n`;
  });

  App.baixarArquivo(csv, `movimentacoes_santos_manutencoes_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8;');
};

App.baixarArquivo = (conteudo, nomeArquivo, tipoMime) => {
  const blob = new Blob(['\uFEFF' + conteudo], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  App.mostrarToast(`Arquivo ${nomeArquivo} exportado com sucesso!`, 'success');
};

/* ==========================================================================
   BACKUP E RESTAURAÇÃO TOTAL (JSON)
   ========================================================================== */
App.exportarBackupCompleto = async () => {
  try {
    const backup = await window.db.exportFullBackup();
    const jsonStr = JSON.stringify(backup, null, 2);
    const dataStr = new Date().toISOString().slice(0, 10);
    App.baixarArquivo(jsonStr, `backup_estoque_santos_${dataStr}.json`, 'application/json');
  } catch (err) {
    console.error('Erro ao exportar backup:', err);
    App.mostrarToast('Erro ao gerar arquivo de backup.', 'danger');
  }
};

App.importarBackupCompleto = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (confirm('ATENÇÃO: A importação do backup substituirá os dados atuais pelo arquivo selecionado. Deseja continuar?')) {
        await window.db.importFullBackup(data);
        App.mostrarToast('Backup restaurado com sucesso!', 'success');
        await App.carregarDados();
        App.renderizarTudo();
      }
    } catch (err) {
      console.error('Erro na restauração:', err);
      App.mostrarToast('Arquivo de backup inválido ou corrompido.', 'danger');
    }
  };
  reader.readAsText(file);
};

/* ==========================================================================
   MODAIS E UTILITÁRIOS DE INTERFACE
   ========================================================================== */
App.abrirModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
};

App.fecharModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
};

App.mostrarToast = (mensagem, tipo = 'info') => {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  
  let icone = 'ℹ️';
  if (tipo === 'success') icone = '✅';
  if (tipo === 'danger') icone = '❌';
  if (tipo === 'warning') icone = '⚠️';

  toast.innerHTML = `<span>${icone}</span><span>${mensagem}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// Troca de Abas
App.mudarAba = (tabName) => {
  App.currentTab = tabName;
  
  // Abas nav
  document.querySelectorAll('.nav-tab').forEach(t => {
    if (t.dataset.tab === tabName) t.classList.add('active');
    else t.classList.remove('active');
  });

  // Paineis
  document.querySelectorAll('.tab-pane').forEach(p => {
    if (p.id === `tab-${tabName}`) p.classList.add('active');
    else p.classList.remove('active');
  });

  // Atualiza renderização de relatórios se entrou na aba
  if (tabName === 'relatorios') {
    App.atualizarResumoRelatorios();
  }
};

App.atualizarResumoRelatorios = () => {
  const valTotal = App.produtos.reduce((acc, p) => acc + (p.estoqueAtual * p.valorUnitario), 0);
  const totalItens = App.produtos.reduce((acc, p) => acc + p.estoqueAtual, 0);
  const totalMovs = App.movimentacoes.length;

  document.getElementById('rel-resumo-valor').innerText = App.formatarMoeda(valTotal);
  document.getElementById('rel-resumo-itens').innerText = totalItens.toLocaleString('pt-BR');
  document.getElementById('rel-resumo-movs').innerText = totalMovs.toLocaleString('pt-BR');
};

/* ==========================================================================
   EVENTOS DO SISTEMA
   ========================================================================== */
App.inicializarEventos = () => {
  const safeAddEvent = (id, event, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  };

  // Navegação de abas
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const targetTab = tab.getAttribute('data-tab');
      if (targetTab) App.mudarAba(targetTab);
    });
  });

  // Formulário Produto
  safeAddEvent('form-produto', 'submit', App.salvarProduto);
  safeAddEvent('prod-foto-input', 'change', App.processarUploadFoto);

  // Formulário Entrada
  safeAddEvent('form-entrada', 'submit', App.salvarEntrada);
  safeAddEvent('entrada-produto', 'change', App.atualizarInfoProdutoEntrada);

  // Formulário Saída
  safeAddEvent('form-saida', 'submit', App.salvarSaida);
  safeAddEvent('saida-produto', 'change', App.atualizarInfoProdutoSaida);
  
  const empInput = document.getElementById('saida-funcionario-input');
  if (empInput) {
    empInput.addEventListener('input', (e) => App.aoSelecionarFuncionarioRetirada(e.target.value));
    empInput.addEventListener('change', (e) => App.aoSelecionarFuncionarioRetirada(e.target.value));
  }

  // Formulário Novo Colaborador
  safeAddEvent('form-colaborador', 'submit', App.salvarColaborador);

  // Filtros Produtos
  safeAddEvent('filtro-produto-busca', 'input', (e) => {
    App.filtroProduto = e.target.value;
    App.renderizarProdutos();
  });
  safeAddEvent('filtro-produto-categoria', 'change', (e) => {
    App.categoriaFiltro = e.target.value;
    App.renderizarProdutos();
  });
  safeAddEvent('filtro-produto-status', 'change', (e) => {
    App.statusFiltro = e.target.value;
    App.renderizarProdutos();
  });

  // Filtros Movimentações
  safeAddEvent('filtro-mov-tipo', 'change', App.renderizarMovimentacoes);
  safeAddEvent('filtro-mov-unidade', 'change', App.renderizarMovimentacoes);
  safeAddEvent('busca-mov-texto', 'input', App.renderizarMovimentacoes);

  // Filtros Colaboradores
  safeAddEvent('busca-colab-texto', 'input', App.renderizarColaboradores);
  safeAddEvent('filtro-colab-local', 'change', App.renderizarColaboradores);

  // Backup Input
  safeAddEvent('input-backup-file', 'change', App.importarBackupCompleto);

  // Fechar modal ao clicar fora
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });
};

// Torna o App globalmente acessível
window.App = App;
