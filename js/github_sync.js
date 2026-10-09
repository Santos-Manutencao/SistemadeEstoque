/**
 * ============================================================================
 * SANTOS MANUTENÇÕES - MÓDULO DE SINCRONIZAÇÃO EM NUVEM VIA GITHUB API
 * Permite que múltiplos computadores acessem e mantenham os mesmos dados
 * através do repositório GitHub (sem necessidade de servidores externos).
 * ============================================================================
 */

const GitHubSync = {
  OWNER: 'Santos-Manutencao',
  REPO: 'SistemadeEstoque',
  BRANCH: 'main',
  FILE_PATH: 'dados_sistema.json',
  TOKEN_KEY: 'santos_github_token',
  LAST_SYNC_KEY: 'santos_ultimo_sync_ts',
  
  isSyncing: false,
  debounceTimer: null,

  // Utilitários de codificação UTF-8 <-> Base64 seguros para acentos e caracteres especiais
  utf8ToBase64(str) {
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
      return btoa(str);
    }
  },

  base64ToUtf8(str) {
    try {
      return decodeURIComponent(escape(atob(str)));
    } catch (e) {
      return atob(str);
    }
  },

  // Gerenciamento de Token no navegador local
  obterToken() {
    return (localStorage.getItem(this.TOKEN_KEY) || '').trim();
  },

  salvarToken(token) {
    const limpo = (token || '').trim();
    if (limpo) {
      localStorage.setItem(this.TOKEN_KEY, limpo);
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
    }
    this.atualizarIndicadorUI();
  },

  removerToken() {
    localStorage.removeItem(this.TOKEN_KEY);
    this.atualizarIndicadorUI();
  },

  estaConectado() {
    return Boolean(this.obterToken());
  },

  // Atualiza o indicador visual de nuvem no cabeçalho
  atualizarIndicadorUI(estado, mensagem) {
    const badge = document.getElementById('cloud-sync-badge');
    const textEl = document.getElementById('cloud-sync-text');
    const dotEl = document.getElementById('cloud-sync-dot');
    if (!badge || !textEl || !dotEl) return;

    if (estado === 'sincronizando') {
      textEl.innerText = mensagem || 'Sincronizando nuvem...';
      dotEl.style.backgroundColor = '#38bdf8';
      badge.classList.add('syncing');
      return;
    }

    badge.classList.remove('syncing');

    if (this.estaConectado()) {
      const ultimo = localStorage.getItem(this.LAST_SYNC_KEY);
      const horaStr = ultimo ? new Date(Number(ultimo)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
      textEl.innerText = horaStr ? `Nuvem GitHub ativa (${horaStr})` : 'Nuvem GitHub ativa';
      dotEl.style.backgroundColor = '#10b981';
      badge.title = 'Conectado ao repositório GitHub. Alterações são enviadas automaticamente para a nuvem.';
    } else {
      textEl.innerText = 'Nuvem: Conectar GitHub';
      dotEl.style.backgroundColor = '#f59e0b';
      badge.title = 'Clique para conectar o Token do GitHub e sincronizar dados entre computadores.';
    }
  },

  // =========================================================================
  // BAIXAR DADOS DO REPOSITÓRIO GITHUB (PULL)
  // Como o repositório é público, qualquer computador lê sem precisar de token!
  // =========================================================================
  async baixarDadosRemotos() {
    try {
      // 1. Tenta carregar direto do Raw GitHub com cache-buster (mais rápido e sem limite)
      const rawUrl = `https://raw.githubusercontent.com/${this.OWNER}/${this.REPO}/${this.BRANCH}/${this.FILE_PATH}?nocache=${Date.now()}`;
      const res = await fetch(rawUrl);
      if (res.ok) {
        const json = await res.json();
        return json;
      }
    } catch (errRaw) {
      console.warn('Tentando fallback via API do GitHub...', errRaw);
    }

    // 2. Fallback via GitHub Contents API
    try {
      const apiUrl = `https://api.github.com/repos/${this.OWNER}/${this.REPO}/contents/${this.FILE_PATH}`;
      const headers = { 'Accept': 'application/vnd.github.v3+json' };
      const token = this.obterToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const resApi = await fetch(apiUrl, { headers });
      if (resApi.ok) {
        const fileData = await resApi.json();
        if (fileData && fileData.content) {
          const str = this.base64ToUtf8(fileData.content.replace(/\n/g, ''));
          return JSON.parse(str);
        }
      }
    } catch (errApi) {
      console.error('Erro ao buscar dados via API do GitHub:', errApi);
    }

    return null;
  },

  // =========================================================================
  // ENVIAR DADOS LOCAIS PARA O GITHUB (PUSH)
  // Requer token com permissão de escrita no repositório
  // =========================================================================
  async enviarDadosParaGitHub(dadosCompletos, motivoCommit = '') {
    const token = this.obterToken();
    if (!token) {
      throw new Error('Token do GitHub não configurado neste computador.');
    }

    this.atualizarIndicadorUI('sincronizando', 'Gravando no GitHub...');

    // 1. Busca o SHA atual do arquivo no repositório
    let shaAtual = null;
    const apiUrl = `https://api.github.com/repos/${this.OWNER}/${this.REPO}/contents/${this.FILE_PATH}`;
    try {
      const getRes = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getRes.ok) {
        const fileInfo = await getRes.json();
        shaAtual = fileInfo.sha;
      }
    } catch (e) {
      console.warn('Não foi possível obter SHA prévio (arquivo pode ser novo):', e);
    }

    // 2. Prepara o pacote de dados com metadados de sincronização
    const pacote = {
      versao: '1.0',
      ultimaAtualizacao: new Date().toISOString(),
      dispositivoOrigem: window.navigator.userAgent.slice(0, 50),
      usuario: (window.App && window.App.usuarioLogado) ? window.App.usuarioLogado.usuario : 'Admin',
      produtos: dadosCompletos.produtos || [],
      movimentacoes: dadosCompletos.movimentacoes || [],
      colaboradores: dadosCompletos.colaboradores || []
    };

    const jsonFormatado = JSON.stringify(pacote, null, 2);
    const conteudoBase64 = this.utf8ToBase64(jsonFormatado);

    const bodyPayload = {
      message: motivoCommit || `Atualização automática de estoque: ${new Date().toLocaleString('pt-BR')}`,
      content: conteudoBase64,
      branch: this.BRANCH
    };
    if (shaAtual) {
      bodyPayload.sha = shaAtual;
    }

    // 3. Envia o PUT para gravar o commit no repositório
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!putRes.ok) {
      const errJson = await putRes.json().catch(() => ({}));
      const msgErro = errJson.message || `Erro HTTP ${putRes.status}`;
      if (putRes.status === 401) {
        throw new Error('Token do GitHub inválido ou expirado. Verifique o token nas configurações.');
      } else if (putRes.status === 404) {
        throw new Error('Repositório não encontrado ou o token não possui permissão de escrita.');
      } else if (putRes.status === 409) {
        throw new Error('Conflito de versão no GitHub. Tente baixar os dados da nuvem primeiro.');
      }
      throw new Error(`Falha ao gravar no GitHub: ${msgErro}`);
    }

    localStorage.setItem(this.LAST_SYNC_KEY, String(Date.now()));
    this.atualizarIndicadorUI();
    return true;
  },

  // =========================================================================
  // SINCRONIZAÇÃO INTELIGENTE (PULL OU PUSH AUTOMÁTICO)
  // Executa na inicialização do sistema e ao clicar em "Sincronizar"
  // =========================================================================
  async sincronizar(notificar = false) {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.atualizarIndicadorUI('sincronizando');

    try {
      // 1. Busca o que está na nuvem
      const dadosRemotos = await this.baixarDadosRemotos();
      const produtosLocais = await window.db.getAll('produtos');
      const movsLocais = await window.db.getAll('movimentacoes');

      const temRemoto = dadosRemotos && Array.isArray(dadosRemotos.produtos) && dadosRemotos.produtos.length > 0;
      const temLocal = produtosLocais && produtosLocais.length > 0;

      // CENÁRIO A: Nuvem possui produtos e o computador local está vazio ou desatualizado
      if (temRemoto) {
        const tsRemoto = dadosRemotos.ultimaAtualizacao ? new Date(dadosRemotos.ultimaAtualizacao).getTime() : 0;
        const tsUltimoSyncLocal = Number(localStorage.getItem(this.LAST_SYNC_KEY) || 0);

        // Se local não tem produtos ou se o remoto é mais novo que a última sincronização conhecida
        if (!temLocal || tsRemoto > tsUltimoSyncLocal) {
          console.log('🔄 Atualizando dados locais a partir da nuvem GitHub...');
          await this.aplicarDadosNaBaseLocal(dadosRemotos);
          localStorage.setItem(this.LAST_SYNC_KEY, String(Math.max(tsRemoto, Date.now())));
          this.atualizarIndicadorUI();

          if (window.App) {
            await window.App.carregarDados();
            window.App.renderizarTudo();
            if (notificar) {
              window.App.mostrarToast(`Dados da nuvem sincronizados com sucesso! (${dadosRemotos.produtos.length} produtos carregados)`, 'success');
            }
          }
          this.isSyncing = false;
          return;
        }
      }

      // CENÁRIO B: Computador local tem produtos cadastrados, a nuvem está vazia e temos token para gravar
      if (temLocal && !temRemoto && this.estaConectado()) {
        console.log('📤 Nuvem está vazia. Enviando dados deste computador para o GitHub...');
        const colabsLocais = await window.db.getAll('colaboradores');
        await this.enviarDadosParaGitHub({
          produtos: produtosLocais,
          movimentacoes: movsLocais,
          colaboradores: colabsLocais
        }, 'Envio inicial de dados do estoque para o repositório');

        if (window.App && notificar) {
          window.App.mostrarToast('Seus produtos locais foram enviados com sucesso para a nuvem do GitHub!', 'success');
        }
      } else {
        localStorage.setItem(this.LAST_SYNC_KEY, String(Date.now()));
        this.atualizarIndicadorUI();
        if (window.App && notificar) {
          window.App.mostrarToast('Sistema já está atualizado com a nuvem.', 'info');
        }
      }

    } catch (err) {
      console.error('Erro durante processo de sincronização:', err);
      this.atualizarIndicadorUI();
      if (window.App && notificar) {
        window.App.mostrarToast(`Erro ao sincronizar com GitHub: ${err.message}`, 'danger');
      }
    } finally {
      this.isSyncing = false;
    }
  },

  // Aplica dados vindos do GitHub no banco local (IndexedDB + LocalStorage)
  async aplicarDadosNaBaseLocal(dados) {
    if (!dados || !dados.produtos) return;

    // Substitui produtos
    await window.db.clearStore('produtos');
    for (const p of dados.produtos) {
      await window.db.add('produtos', p);
    }

    // Substitui movimentações
    if (Array.isArray(dados.movimentacoes)) {
      await window.db.clearStore('movimentacoes');
      for (const m of dados.movimentacoes) {
        await window.db.add('movimentacoes', m);
      }
    }

    // Mescla colaboradores caso existam novos cadastrados
    if (Array.isArray(dados.colaboradores) && dados.colaboradores.length > 0) {
      const colabsAtuais = await window.db.getAll('colaboradores');
      const matriculasExistentes = new Set(colabsAtuais.map(c => c.matricula));
      for (const c of dados.colaboradores) {
        if (!matriculasExistentes.has(c.matricula)) {
          await window.db.add('colaboradores', c);
        }
      }
    }
  },

  // Agenda envio automático debounced para o GitHub sempre que houver alteração
  agendarEnvioAutomatico() {
    if (!this.estaConectado()) return;

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      try {
        console.log('☁️ Auto-sync: Gravando alterações no repositório GitHub...');
        const prods = await window.db.getAll('produtos');
        const movs = await window.db.getAll('movimentacoes');
        const colabs = await window.db.getAll('colaboradores');

        await this.enviarDadosParaGitHub({
          produtos: prods,
          movimentacoes: movs,
          colaboradores: colabs
        }, `Auto-sync: estoque atualizado (${new Date().toLocaleTimeString('pt-BR')})`);
      } catch (err) {
        console.warn('Auto-sync GitHub em segundo plano não pôde ser concluído:', err.message);
      }
    }, 4000); // 4 segundos de debounce para evitar commits excessivos
  },

  // =========================================================================
  // MODAL E INTERFACE DO USUÁRIO PARA GERENCIAR A NUVEM
  // =========================================================================
  abrirModalConfiguracao() {
    let modal = document.getElementById('modal-cloud-sync');
    if (!modal) {
      this.criarModalNoDOM();
      modal = document.getElementById('modal-cloud-sync');
    }

    const input = document.getElementById('input-github-token');
    const tokenAtual = this.obterToken();
    if (input) input.value = tokenAtual;

    const statusTexto = document.getElementById('cloud-modal-status-text');
    if (statusTexto) {
      if (tokenAtual) {
        statusTexto.innerHTML = '🟢 <strong>Conectado ao repositório:</strong> Qualquer computador que usar este sistema receberá as alterações em nuvem.';
        statusTexto.style.color = '#10b981';
      } else {
        statusTexto.innerHTML = '🟡 <strong>Modo Somente Leitura / Local:</strong> Este computador baixa dados públicos da nuvem. Para enviar novos cadastros e sincronizar alterações com outros computadores, insira um Token do GitHub abaixo.';
        statusTexto.style.color = '#f59e0b';
      }
    }

    if (window.App && window.App.abrirModal) {
      window.App.abrirModal('modal-cloud-sync');
    } else {
      modal.classList.add('active');
    }
  },

  async testarESalvarToken() {
    const input = document.getElementById('input-github-token');
    const token = (input ? input.value : '').trim();

    if (!token) {
      this.removerToken();
      if (window.App) window.App.mostrarToast('Token removido. Modo somente leitura ativado.', 'info');
      this.abrirModalConfiguracao();
      return;
    }

    const btn = document.getElementById('btn-testar-token');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Validando conexão...';
    }

    try {
      // Testa se o token é válido chamando a API de usuário do GitHub
      const res = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Token rejeitado pelo GitHub. Verifique se copiou o código completo.');
      }

      const userData = await res.json();
      this.salvarToken(token);

      if (window.App) {
        window.App.mostrarToast(`Token validado com sucesso! Conectado como: ${userData.login}`, 'success');
      }

      // Dispara sincronização inicial com a nuvem
      await this.sincronizar(true);
      this.abrirModalConfiguracao();

    } catch (err) {
      if (window.App) {
        window.App.mostrarToast(`Erro ao validar token: ${err.message}`, 'danger');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'Validar & Conectar';
      }
    }
  },

  async forcarEnvioLocal() {
    if (!this.estaConectado()) {
      if (window.App) window.App.mostrarToast('Por favor, informe e valide o seu Token do GitHub primeiro.', 'warning');
      return;
    }

    const confirmar = confirm(
      'Deseja enviar TODOS os dados cadastrados neste computador para o repositório GitHub?\n\n' +
      '• Os produtos e movimentações deste computador se tornarão a versão oficial na nuvem.\n' +
      '• Todos os outros computadores que abrirem o sistema verão estes dados.'
    );
    if (!confirmar) return;

    const btn = document.getElementById('btn-forcar-envio');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Enviando dados...';
    }

    try {
      const prods = await window.db.getAll('produtos');
      const movs = await window.db.getAll('movimentacoes');
      const colabs = await window.db.getAll('colaboradores');

      await this.enviarDadosParaGitHub({
        produtos: prods,
        movimentacoes: movs,
        colaboradores: colabs
      }, `Upload manual de sincronização: ${prods.length} produtos enviados`);

      if (window.App) {
        window.App.mostrarToast(`Sucesso! ${prods.length} produto(s) enviados para a nuvem do GitHub!`, 'success');
        window.App.fecharModal('modal-cloud-sync');
      }
    } catch (err) {
      if (window.App) window.App.mostrarToast(`Erro ao enviar dados: ${err.message}`, 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = '📤 Enviar Dados Deste Computador para Nuvem';
      }
    }
  },

  async forcarBaixarNuvem() {
    const confirmar = confirm(
      'Deseja baixar os dados da nuvem do GitHub agora?\n\n' +
      '• O sistema irá puxar os produtos e movimentações mais recentes gravados na nuvem.\n' +
      '• Isto é ideal para carregar neste computador os produtos cadastrados em outro computador.'
    );
    if (!confirmar) return;

    const btn = document.getElementById('btn-forcar-baixar');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Baixando da nuvem...';
    }

    try {
      const remotos = await this.baixarDadosRemotos();
      if (!remotos || !remotos.produtos || remotos.produtos.length === 0) {
        if (window.App) window.App.mostrarToast('A nuvem ainda não possui produtos salvos. Faça o envio a partir do computador onde você realizou os cadastros.', 'info');
        return;
      }

      await this.aplicarDadosNaBaseLocal(remotos);
      localStorage.setItem(this.LAST_SYNC_KEY, String(Date.now()));
      this.atualizarIndicadorUI();

      if (window.App) {
        await window.App.carregarDados();
        window.App.renderizarTudo();
        window.App.mostrarToast(`Sucesso! ${remotos.produtos.length} produto(s) carregados da nuvem!`, 'success');
        window.App.fecharModal('modal-cloud-sync');
      }
    } catch (err) {
      if (window.App) window.App.mostrarToast(`Erro ao baixar da nuvem: ${err.message}`, 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = '📥 Baixar Dados da Nuvem para Este Computador';
      }
    }
  },

  criarModalNoDOM() {
    if (document.getElementById('modal-cloud-sync')) return;

    const modalHtml = `
      <div class="modal-overlay" id="modal-cloud-sync">
        <div class="modal-dialog modal-dialog-lg" style="max-width: 680px;">
          <div class="modal-header">
            <h3 class="modal-title" style="color: #38bdf8; display: flex; align-items: center; gap: 0.5rem;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
              Sincronização em Nuvem Multi-Computadores (GitHub)
            </h3>
            <button class="modal-close" onclick="App.fecharModal('modal-cloud-sync')">✕</button>
          </div>
          <div class="modal-body" style="padding: 1.5rem;">
            <div id="cloud-modal-status-text" style="padding: 0.85rem 1rem; border-radius: var(--radius-sm); background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); font-size: 0.88rem; margin-bottom: 1.25rem;">
            </div>

            <!-- Como funciona -->
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1.25rem;">
              <h4 style="font-size: 0.92rem; margin-bottom: 0.5rem; color: var(--text-main);">Como funciona a sincronização entre computadores:</h4>
              <p style="font-size: 0.84rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 0.5rem;">
                O sistema utiliza o próprio repositório GitHub (<code>Santos-Manutencao/SistemadeEstoque</code>) como banco em nuvem.
              </p>
              <ul style="font-size: 0.84rem; color: var(--text-muted); line-height: 1.6; padding-left: 1.25rem; margin: 0;">
                <li><strong>No computador onde você já cadastrou os produtos:</strong> conecte o Token e clique em <em>"Enviar Dados Deste Computador para Nuvem"</em>.</li>
                <li><strong>Em qualquer outro computador:</strong> ao abrir o sistema, ele já baixa e exibe os produtos automaticamente! Com o Token conectado, qualquer alteração futura também é enviada para a nuvem em tempo real.</li>
              </ul>
            </div>

            <!-- Campo de Token -->
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label" style="font-weight: 700;">
                GitHub Personal Access Token (PAT)
                <span style="font-size: 0.78rem; font-weight: normal; color: var(--text-muted);">(Fica gravado apenas neste computador)</span>
              </label>
              <div class="input-icon-wrapper">
                <input type="password" id="input-github-token" class="form-control" placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" autocomplete="off">
                <button type="button" class="btn-toggle-pwd" onclick="App.alternarVisibilidadeSenha('input-github-token')" title="Mostrar/Ocultar Token">👁️</button>
              </div>
              <div style="display: flex; gap: 0.75rem; margin-top: 0.75rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-primary btn-sm" id="btn-testar-token" onclick="GitHubSync.testarESalvarToken()">
                  Validar & Conectar Token
                </button>
                <a href="https://github.com/settings/tokens/new?scopes=repo&description=SistemadeEstoque_Sincronizacao" target="_blank" class="btn btn-outline btn-sm" style="text-decoration: none;">
                  🔑 Gerar Novo Token no GitHub (1 Clique) ↗
                </a>
                <button type="button" class="btn btn-outline-danger btn-sm" onclick="GitHubSync.removerToken(); GitHubSync.abrirModalConfiguracao();">
                  Desconectar Token
                </button>
              </div>
            </div>

            <!-- Ações Diretas de Transferência -->
            <div style="border-top: 1px solid var(--border-color); padding-top: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
              <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-success" id="btn-forcar-envio" onclick="GitHubSync.forcarEnvioLocal()" style="flex: 1; min-width: 250px;">
                  📤 Enviar Dados Deste Computador para Nuvem
                </button>
                <button type="button" class="btn btn-outline" id="btn-forcar-baixar" onclick="GitHubSync.forcarBaixarNuvem()" style="flex: 1; min-width: 250px;">
                  📥 Baixar Dados da Nuvem para Este Computador
                </button>
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="App.fecharModal('modal-cloud-sync')">Fechar</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }
};

// Torna global para acesso no HTML e em app.js
window.GitHubSync = GitHubSync;
