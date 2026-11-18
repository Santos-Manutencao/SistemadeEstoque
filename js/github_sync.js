/**
 * ============================================================================
 * SANTOS MANUTENÇÕES - MÓDULO DE SINCRONIZAÇÃO EM NUVEM MULTI-USUÁRIO (GITHUB API)
 * Permite que múltiplos computadores acessem, atualizem e mantenham os mesmos dados
 * em tempo real através do repositório GitHub (sem necessidade de servidores externos).
 * Inclui: Polling automático em segundo plano, Reconciliação sem sobrescrita (Merge),
 * e Invalidação total de cache.
 * ============================================================================
 */

const GitHubSync = {
  OWNER: 'Santos-Manutencao',
  REPO: 'SistemadeEstoque',
  BRANCH: 'main',
  FILE_PATH: 'dados_sistema.json',
  TOKEN_KEY: 'santos_github_token',
  LAST_SYNC_KEY: 'santos_ultimo_sync_ts',
  LAST_SHA_KEY: 'santos_ultimo_sha_aplicado',
  LAST_TS_KEY: 'santos_ultimo_ts_aplicado',
  EXCLUIDAS_KEY: 'santos_movs_excluidas',
  
  isSyncing: false,
  debounceTimer: null,
  pollingTimer: null,
  _eventosEscutados: false,

  // Identificador único da aba/sessão atual para distinguir alterações próprias de alterações de outros computadores
  CLIENT_ID: (() => {
    let id = sessionStorage.getItem('santos_client_session_id');
    if (!id) {
      id = 'cli_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem('santos_client_session_id', id);
    }
    return id;
  })(),

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

  // Gerenciamento de Movimentações Excluídas (Tombstones anti-ressurreição)
  obterMovsExcluidas() {
    try {
      const arr = JSON.parse(localStorage.getItem(this.EXCLUIDAS_KEY) || '[]');
      return new Set((arr || []).map(x => String(x)));
    } catch (e) {
      return new Set();
    }
  },

  registrarMovimentacaoExcluida(idOuKey) {
    if (!idOuKey) return;
    const set = this.obterMovsExcluidas();
    set.add(String(idOuKey));
    localStorage.setItem(this.EXCLUIDAS_KEY, JSON.stringify(Array.from(set)));
  },

  registrarVariasMovimentacoesExcluidas(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const set = this.obterMovsExcluidas();
    ids.forEach(id => {
      if (id) set.add(String(id));
    });
    localStorage.setItem(this.EXCLUIDAS_KEY, JSON.stringify(Array.from(set)));
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
      badge.title = 'Conectado ao repositório GitHub. Sincronização automática em segundo plano ativada.';
    } else {
      textEl.innerText = 'Nuvem: Conectar GitHub';
      dotEl.style.backgroundColor = '#f59e0b';
      badge.title = 'Clique para conectar o Token do GitHub e sincronizar dados entre computadores.';
    }
  },

  // =========================================================================
  // BAIXAR DADOS DO REPOSITÓRIO GITHUB (PULL)
  // Busca em tempo real via API do GitHub (sem cache Fastly)
  // =========================================================================
  async baixarDadosRemotos() {
    const token = this.obterToken();

    // 1. Se possuir Token, consulta diretamente a API oficial do GitHub (tempo real 0s cache)
    if (token) {
      try {
        const apiUrl = `https://api.github.com/repos/${this.OWNER}/${this.REPO}/contents/${this.FILE_PATH}?ref=${this.BRANCH}`;
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        };
        const res = await fetch(apiUrl, { headers });
        if (res.ok) {
          const fileData = await res.json();
          if (fileData && fileData.content) {
            const parsed = JSON.parse(this.base64ToUtf8(fileData.content.replace(/\n/g, '')));
            return {
              dados: parsed,
              sha: fileData.sha
            };
          }
        }
      } catch (errApi) {
        console.warn('Falha na consulta direta via API do GitHub, tentando fallback...', errApi);
      }
    }

    // 2. Fallback público via Raw GitHub com múltiplos cache-busters
    try {
      const rawUrl = `https://raw.githubusercontent.com/${this.OWNER}/${this.REPO}/${this.BRANCH}/${this.FILE_PATH}?t=${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const res = await fetch(rawUrl, { cache: 'no-store' });
      if (res.ok) {
        const parsed = await res.json();
        return {
          dados: parsed,
          sha: null
        };
      }
    } catch (errRaw) {
      console.error('Erro ao baixar dados brutos da nuvem:', errRaw);
    }

    return null;
  },

  // =========================================================================
  // MOTOR DE RECONCILIAÇÃO INTELIGENTE (3-WAY MERGE)
  // Garante que NENHUM dado cadastrado no Computador A seja apagado pelo Computador B!
  // =========================================================================
  reconciliarDados(dadosLocais, dadosRemotos) {
    if (!dadosRemotos) return dadosLocais;
    if (!dadosLocais) return dadosRemotos;

    // 0. RECONCILIAÇÃO DE EXCLUSÕES (Tombstones: impede que movimentações excluídas reapareçam)
    const setExcluidas = this.obterMovsExcluidas();
    if (dadosRemotos && Array.isArray(dadosRemotos.movimentacoesExcluidas)) {
      dadosRemotos.movimentacoesExcluidas.forEach(id => {
        if (id) setExcluidas.add(String(id));
      });
    }
    localStorage.setItem(this.EXCLUIDAS_KEY, JSON.stringify(Array.from(setExcluidas)));

    const movFoiExcluida = (m) => {
      if (!m) return true;
      if (m.id && setExcluidas.has(String(m.id))) return true;
      if (m.transacaoId && setExcluidas.has(String(m.transacaoId))) return true;
      return false;
    };

    // 1. RECONCILIAÇÃO DE COLABORADORES (União de matrículas)
    const colabsMap = new Map();
    (dadosRemotos.colaboradores || []).forEach(c => {
      if (c && c.matricula) colabsMap.set(String(c.matricula), c);
    });
    (dadosLocais.colaboradores || []).forEach(c => {
      if (c && c.matricula && !colabsMap.has(String(c.matricula))) {
        colabsMap.set(String(c.matricula), c);
      }
    });
    const colabsConsolidados = Array.from(colabsMap.values());

    // 2. RECONCILIAÇÃO DE MOVIMENTAÇÕES (União total de histórico respeitando exclusões)
    const movsMap = new Map();
    const gerarChaveMov = (m) => {
      if (m.id) return `id_${m.id}`;
      return `${m.tipo}_${m.transacaoId || ''}_${m.produtoId}_${m.quantidade}_${m.dataHora}`;
    };

    (dadosRemotos.movimentacoes || []).forEach(m => {
      if (m && !movFoiExcluida(m)) movsMap.set(gerarChaveMov(m), m);
    });
    (dadosLocais.movimentacoes || []).forEach(m => {
      if (m && !movFoiExcluida(m)) {
        const k = gerarChaveMov(m);
        if (!movsMap.has(k)) {
          movsMap.set(k, m);
        }
      }
    });
    const movsConsolidadas = Array.from(movsMap.values())
      .filter(m => !movFoiExcluida(m))
      .sort((a, b) => new Date(b.dataHora || 0) - new Date(a.dataHora || 0) || (Number(b.id) || 0) - (Number(a.id) || 0));

    // 3. RECONCILIAÇÃO DE PRODUTOS
    // Atualiza saldos respeitando a modificação mais recente (dataAtualizacao)
    const prodsMap = new Map();
    (dadosRemotos.produtos || []).forEach(p => {
      if (p && p.id) prodsMap.set(Number(p.id), { ...p });
    });

    (dadosLocais.produtos || []).forEach(pLocal => {
      if (!pLocal || !pLocal.id) return;
      const id = Number(pLocal.id);
      const pRemoto = prodsMap.get(id);

      if (!pRemoto) {
        // Novo produto cadastrado neste computador que ainda não estava na nuvem
        prodsMap.set(id, { ...pLocal });
      } else {
        const tsLocal = pLocal.dataAtualizacao ? new Date(pLocal.dataAtualizacao).getTime() : 0;
        const tsRemoto = pRemoto.dataAtualizacao ? new Date(pRemoto.dataAtualizacao).getTime() : 0;

        // Se a alteração local for mais recente (ex: usuário realizou uma saída/entrada agora)
        if (tsLocal > tsRemoto) {
          prodsMap.set(id, { ...pLocal });
        } else {
          // A nuvem tem a versão mais recente deste produto
          prodsMap.set(id, { ...pRemoto });
        }
      }
    });

    const prodsConsolidados = Array.from(prodsMap.values()).sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));

    return {
      produtos: prodsConsolidados,
      movimentacoes: movsConsolidadas,
      movimentacoesExcluidas: Array.from(setExcluidas),
      colaboradores: colabsConsolidados
    };
  },

  // =========================================================================
  // APLICAR DADOS NO BANCO LOCAL (INDEXEDDB)
  // =========================================================================
  async aplicarDadosNaBaseLocal(dadosRemotos, shaRemoto = null) {
    if (!dadosRemotos || !Array.isArray(dadosRemotos.produtos)) return;

    const prodsLocais = await window.db.getAll('produtos');
    const movsLocais = await window.db.getAll('movimentacoes');
    const colabsLocais = await window.db.getAll('colaboradores');

    const reconciliado = this.reconciliarDados({
      produtos: prodsLocais,
      movimentacoes: movsLocais,
      colaboradores: colabsLocais
    }, dadosRemotos);

    // Substitui produtos consolidados
    await window.db.clearStore('produtos');
    for (const p of reconciliado.produtos) {
      await window.db.add('produtos', p);
    }

    // Substitui movimentações consolidadas
    await window.db.clearStore('movimentacoes');
    for (const m of reconciliado.movimentacoes) {
      await window.db.add('movimentacoes', m);
    }

    // Substitui colaboradores consolidados
    await window.db.clearStore('colaboradores');
    for (const c of reconciliado.colaboradores) {
      await window.db.add('colaboradores', c);
    }

    // Atualiza controles de sincronização
    const tsRemoto = dadosRemotos.ultimaAtualizacao ? new Date(dadosRemotos.ultimaAtualizacao).getTime() : Date.now();
    localStorage.setItem(this.LAST_SYNC_KEY, String(Date.now()));
    localStorage.setItem(this.LAST_TS_KEY, String(tsRemoto));
    if (shaRemoto) localStorage.setItem(this.LAST_SHA_KEY, shaRemoto);

    this.atualizarIndicadorUI('ok');
  },

  // =========================================================================
  // POLLING AUTOMÁTICO EM SEGUNDO PLANO (A CADA 8 SEGUNDOS & ON FOCUS)
  // Verifica alterações feitas por outros computadores sem incomodar o usuário
  // =========================================================================
  iniciarPollingAutomatico() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);

    // Checa a cada 8 segundos
    this.pollingTimer = setInterval(() => {
      this.verificarAtualizacoesSilencioso();
    }, 8000);

    // Checa imediatamente ao alternar de aba ou focar na janela
    if (!this._eventosEscutados) {
      this._eventosEscutados = true;
      window.addEventListener('focus', () => {
        this.verificarAtualizacoesSilencioso();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.verificarAtualizacoesSilencioso();
        }
      });
    }
  },

  async verificarAtualizacoesSilencioso() {
    // Não executa polling se estiver no meio de um envio
    if (this.isSyncing) return;

    try {
      const token = this.obterToken();
      let shaRemoto = null;
      let dadosRemotos = null;

      if (token) {
        const apiUrl = `https://api.github.com/repos/${this.OWNER}/${this.REPO}/contents/${this.FILE_PATH}?ref=${this.BRANCH}`;
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        };

        const res = await fetch(apiUrl, { headers });
        if (res.ok) {
          const fileData = await res.json();
          shaRemoto = fileData.sha;
          const ultimoSha = localStorage.getItem(this.LAST_SHA_KEY);

          // Se o SHA é idêntico ao já aplicado localmente, não há novidades na nuvem
          if (shaRemoto && shaRemoto === ultimoSha) {
            return;
          }

          if (fileData.content) {
            dadosRemotos = JSON.parse(this.base64ToUtf8(fileData.content.replace(/\n/g, '')));
          }
        }
      } else {
        const resRemoto = await this.baixarDadosRemotos();
        if (resRemoto) {
          dadosRemotos = resRemoto.dados;
          shaRemoto = resRemoto.sha;
        }
      }

      if (!dadosRemotos) return;

      // Se a última gravação foi originada por esta MESMA aba/sessão, não precisa reprocessar
      if (dadosRemotos.ultimoAutorSessionId === this.CLIENT_ID) {
        if (shaRemoto) localStorage.setItem(this.LAST_SHA_KEY, shaRemoto);
        return;
      }

      const tsRemoto = dadosRemotos.ultimaAtualizacao ? new Date(dadosRemotos.ultimaAtualizacao).getTime() : 0;
      const ultimoTsAplicado = Number(localStorage.getItem(this.LAST_TS_KEY) || 0);
      const ultimoShaAplicado = localStorage.getItem(this.LAST_SHA_KEY);

      // Se há um novo SHA ou timestamp mais recente que o aplicado
      if ((shaRemoto && shaRemoto !== ultimoShaAplicado) || tsRemoto > ultimoTsAplicado) {
        console.log('🔄 [AUTO-SYNC] Atualização detectada de outro computador. Sincronizando automaticamente...');
        await this.aplicarDadosNaBaseLocal(dadosRemotos, shaRemoto);

        if (window.App) {
          await window.App.carregarDados();
          window.App.renderizarTudo();

          // Atualiza visualmente o indicador
          this.atualizarIndicadorUI('ok');
          if (window.App.mostrarToast) {
            window.App.mostrarToast('Dados de estoque sincronizados automaticamente com a nuvem.', 'info');
          }
        }
      }
    } catch (err) {
      console.debug('Background poll skip:', err.message);
    }
  },

  // =========================================================================
  // ENVIAR DADOS LOCAIS PARA O GITHUB (PUSH SEGURO COM MERGE)
  // =========================================================================
  async enviarDadosParaGitHub(dadosCompletos, motivoCommit = '') {
    const token = this.obterToken();
    if (!token) {
      throw new Error('Token do GitHub não configurado neste computador.');
    }

    this.isSyncing = true;
    this.atualizarIndicadorUI('sincronizando', 'Gravando na nuvem...');

    try {
      const apiUrl = `https://api.github.com/repos/${this.OWNER}/${this.REPO}/contents/${this.FILE_PATH}`;

      // 1. Busca os dados atuais do repositório para mesclar e evitar sobrescrita
      let shaAtual = null;
      let dadosRemotos = null;

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
          if (fileInfo.content) {
            dadosRemotos = JSON.parse(this.base64ToUtf8(fileInfo.content.replace(/\n/g, '')));
          }
        }
      } catch (e) {
        console.warn('Não foi possível obter dados prévios da nuvem:', e);
      }

      // 2. Reconcilia os dados locais com os dados remotos
      const reconciliado = this.reconciliarDados(dadosCompletos, dadosRemotos);

      // Atualiza banco local com o estado consolidado
      await window.db.clearStore('produtos');
      for (const p of reconciliado.produtos) await window.db.add('produtos', p);

      await window.db.clearStore('movimentacoes');
      for (const m of reconciliado.movimentacoes) await window.db.add('movimentacoes', m);

      await window.db.clearStore('colaboradores');
      for (const c of reconciliado.colaboradores) await window.db.add('colaboradores', c);

      if (window.App) {
        window.App.produtos = reconciliado.produtos;
        window.App.movimentacoes = reconciliado.movimentacoes;
        window.App.colaboradores = reconciliado.colaboradores;
      }

      // 3. Monta o pacote de dados com o carimbo deste cliente
      const agoraIso = new Date().toISOString();
      const pacote = {
        versao: '1.0',
        ultimaAtualizacao: agoraIso,
        ultimoAutorSessionId: this.CLIENT_ID,
        dispositivoOrigem: (window.navigator.userAgent || '').slice(0, 50),
        usuario: (window.App && window.App.usuarioLogado) ? window.App.usuarioLogado.usuario : 'Admin',
        produtos: reconciliado.produtos,
        movimentacoes: reconciliado.movimentacoes,
        movimentacoesExcluidas: reconciliado.movimentacoesExcluidas || Array.from(this.obterMovsExcluidas()),
        colaboradores: reconciliado.colaboradores
      };

      const jsonFormatado = JSON.stringify(pacote, null, 2);
      const conteudoBase64 = this.utf8ToBase64(jsonFormatado);

      const bodyPayload = {
        message: motivoCommit || `Atualização automática de estoque: ${new Date().toLocaleString('pt-BR')}`,
        content: conteudoBase64,
        branch: this.BRANCH
      };
      if (shaAtual) bodyPayload.sha = shaAtual;

      // 4. Grava no GitHub
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
        if (putRes.status === 409) {
          console.warn('Conflito 409 no GitHub (edição concorrente). Re-sincronizando e reenviando...');
          // Aguarda 1 segundo e re-tenta com os dados atualizados
          await new Promise(r => setTimeout(r, 1000));
          this.isSyncing = false;
          return this.enviarDadosParaGitHub(reconciliado, motivoCommit);
        }
        const errJson = await putRes.json().catch(() => ({}));
        throw new Error(errJson.message || `Erro HTTP ${putRes.status}`);
      }

      const putData = await putRes.json();
      const novoSha = (putData.content && putData.content.sha) || null;
      if (novoSha) localStorage.setItem(this.LAST_SHA_KEY, novoSha);

      const tsEnvio = new Date(agoraIso).getTime();
      localStorage.setItem(this.LAST_TS_KEY, String(tsEnvio));
      localStorage.setItem(this.LAST_SYNC_KEY, String(Date.now()));

      this.atualizarIndicadorUI('ok');
      return true;

    } finally {
      this.isSyncing = false;
    }
  },

  // =========================================================================
  // SINCRONIZAÇÃO INTELIGENTE (PULL OU PUSH MANUAL / INICIAL)
  // =========================================================================
  async sincronizar(notificar = false) {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.atualizarIndicadorUI('sincronizando');

    try {
      const resRemoto = await this.baixarDadosRemotos();
      const dadosRemotos = resRemoto ? resRemoto.dados : null;
      const shaRemoto = resRemoto ? resRemoto.sha : null;

      const produtosLocais = await window.db.getAll('produtos');
      const temRemoto = dadosRemotos && Array.isArray(dadosRemotos.produtos) && dadosRemotos.produtos.length > 0;
      const temLocal = produtosLocais && produtosLocais.length > 0;

      if (temRemoto) {
        await this.aplicarDadosNaBaseLocal(dadosRemotos, shaRemoto);
        if (window.App) {
          await window.App.carregarDados();
          window.App.renderizarTudo();
          if (notificar) {
            window.App.mostrarToast(`Sincronização concluída com sucesso! (${dadosRemotos.produtos.length} produtos carregados)`, 'success');
          }
        }
      } else if (temLocal && !temRemoto && this.estaConectado()) {
        const movsLocais = await window.db.getAll('movimentacoes');
        const colabsLocais = await window.db.getAll('colaboradores');
        await this.enviarDadosParaGitHub({
          produtos: produtosLocais,
          movimentacoes: movsLocais,
          colaboradores: colabsLocais
        }, 'Envio inicial de dados do estoque para o repositório');

        if (window.App && notificar) {
          window.App.mostrarToast('Produtos locais enviados com sucesso para a nuvem do GitHub!', 'success');
        }
      } else {
        localStorage.setItem(this.LAST_SYNC_KEY, String(Date.now()));
        this.atualizarIndicadorUI('ok');
        if (window.App && notificar) {
          window.App.mostrarToast('Sistema já está atualizado com a nuvem.', 'info');
        }
      }

    } catch (err) {
      console.error('Erro durante sincronização:', err);
      this.atualizarIndicadorUI();
      if (window.App && notificar) {
        window.App.mostrarToast(`Erro ao sincronizar com GitHub: ${err.message}`, 'danger');
      }
    } finally {
      this.isSyncing = false;
    }
  },

  // Agenda envio automático debounced para o GitHub sempre que houver alteração local
  agendarEnvioAutomatico() {
    if (!this.estaConectado()) return;

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      try {
        const prods = await window.db.getAll('produtos');
        const movs = await window.db.getAll('movimentacoes');
        const colabs = await window.db.getAll('colaboradores');

        await this.enviarDadosParaGitHub({
          produtos: prods,
          movimentacoes: movs,
          colaboradores: colabs
        }, `Auto-sync: estoque atualizado (${new Date().toLocaleTimeString('pt-BR')})`);
      } catch (err) {
        console.warn('Auto-sync em segundo plano:', err.message);
      }
    }, 2000); // 2 segundos de debounce para resposta rápida entre computadores
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
        statusTexto.innerHTML = '🟢 <strong>Conectado e Ativo em Tempo Real:</strong> As alterações são sincronizadas automaticamente entre computadores em segundo plano a cada poucos segundos.';
        statusTexto.style.color = '#10b981';
      } else {
        statusTexto.innerHTML = '🟡 <strong>Modo Somente Leitura / Local:</strong> Para que este computador envie alterações e receba atualizações em tempo real dos outros usuários, conecte um Token do GitHub abaixo.';
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

      await this.sincronizar(true);
      this.iniciarPollingAutomatico();
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
      'Deseja sincronizar e enviar os dados deste computador para o GitHub?\n\n' +
      '• O sistema irá mesclar os dados locais com a nuvem com segurança.\n' +
      '• Os outros computadores receberão as atualizações automaticamente em segundos.'
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
        window.App.mostrarToast(`Sucesso! Estoque sincronizado com a nuvem do GitHub!`, 'success');
        window.App.fecharModal('modal-cloud-sync');
      }
    } catch (err) {
      if (window.App) window.App.mostrarToast(`Erro ao enviar dados: ${err.message}`, 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = '📤 Enviar / Sincronizar com a Nuvem';
      }
    }
  },

  async forcarBaixarNuvem() {
    const confirmar = confirm(
      'Deseja baixar os dados da nuvem do GitHub agora?\n\n' +
      '• O sistema irá puxar os produtos e movimentações mais recentes gravados na nuvem.\n' +
      '• Suas informações locais serão mescladas com segurança.'
    );
    if (!confirmar) return;

    const btn = document.getElementById('btn-forcar-baixar');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Baixando da nuvem...';
    }

    try {
      await this.sincronizar(true);
      if (window.App) {
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
              <h4 style="font-size: 0.92rem; margin-bottom: 0.5rem; color: var(--text-main);">Como funciona a sincronização automática em tempo real:</h4>
              <p style="font-size: 0.84rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 0.5rem;">
                O sistema utiliza o repositório GitHub como base de dados em nuvem, atualizando automaticamente ambos os computadores:
              </p>
              <ul style="font-size: 0.84rem; color: var(--text-muted); line-height: 1.6; padding-left: 1.25rem; margin: 0;">
                <li><strong>Atualização Automática Contínua:</strong> A cada poucos segundos, o sistema verifica a nuvem em segundo plano. Quando um usuário faz uma retirada, entrada ou cadastro, o outro computador recebe e atualiza a tela automaticamente!</li>
                <li><strong>Reconciliação Segura:</strong> Operações feitas simultaneamente em computadores diferentes são mescladas sem sobrescrever ou apagar dados.</li>
                <li><strong>Token do GitHub:</strong> Mantenha o token conectado em ambos os computadores para que ambos possam enviar e receber dados automaticamente.</li>
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
                  🔑 Gerar Novo Token no GitHub ↗
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
                  📤 Enviar / Sincronizar com a Nuvem
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
