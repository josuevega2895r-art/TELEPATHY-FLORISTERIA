import { useEffect, useRef, useState } from 'react';
import { Bell, Printer, Settings } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

async function fnSolicitarApi(path, options = {}) {
  const token = localStorage.getItem('telephaty_token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
  return data;
}

function fnDescargarCsv(nombreArchivo, filas) {
  const escapar = (valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`;
  const contenido = `\uFEFF${filas.map((fila) => fila.map(escapar).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.style.display = 'none';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fnNormalizarBusqueda(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function fnCoincideBusqueda(termino, ...valores) {
  return !termino || fnNormalizarBusqueda(valores.join(' ')).includes(termino);
}

const adminNavItems = ['Dashboard', 'Pedidos', 'Catálogo', 'Inventario', 'Entregas', 'Reportes'];
const clientNavItems = ['Catálogo', 'Mis pedidos'];

const defaultLogin = { correo: 'admin@telephaty.com', contrasena: '12345678' };
const defaultRegister = { nombre: '', apellidos: '', telefono: '', correo: '', direccion: '', contrasena: '' };

function App() {
  const [usuario, setUsuario] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('telephaty_user') || 'null');
      return saved || { nombre: 'Admin', rol: 'administrador' };
    } catch {
      return { nombre: 'Admin', rol: 'administrador' };
    }
  });
  const [activeView, setActiveView] = useState(usuario.rol === 'cliente' ? 'Catálogo' : 'Dashboard');
  const [catalogo, setCatalogo] = useState([]);
  const [login, setLogin] = useState(defaultLogin);
  const [registro, setRegistro] = useState(defaultRegister);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try {
      return Boolean(localStorage.getItem('telephaty_token'));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const cargarCatalogo = async () => {
      try {
        const [respCategorias, respRamos] = await Promise.all([
          fetch(`${API_URL}/categorias`),
          fetch(`${API_URL}/ramos`)
        ]);

        const categoriasData = await respCategorias.json();
        const ramosData = await respRamos.json();
        console.log('cat', categoriasData);
        console.log('ramos', ramosData);
        setCatalogo(ramosData);
      } catch (error) {
        console.error('Error cargando catálogo', error);
      }
    };

    cargarCatalogo();
  }, []);

  const fnIniciarSesion = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(login)
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'No se pudo iniciar sesión.');
        return;
      }

      const usuarioSesion = {
        nombre: [data.usuario.nombre, data.usuario.apellidos].filter(Boolean).join(' '),
        correo: data.usuario.correo,
        rol: data.usuario.rol || 'administrador'
      };
      setUsuario(usuarioSesion);
      setActiveView(usuarioSesion.rol === 'administrador' ? 'Dashboard' : 'Catálogo');
      setIsLoggedIn(true);
      localStorage.setItem('telephaty_token', data.token);
      localStorage.setItem('telephaty_user', JSON.stringify(usuarioSesion));
    } catch (error) {
      setError('Error de conexión con la API.');
    }
  };

  const fnRegistrarCuenta = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const datosFormulario = new FormData(event.currentTarget);
      const codigoPais = datosFormulario.get('codigoPais');
      const telefonoLocal = registro.telefono.replace(/\D/g, '');
      const response = await fetch(`${API_URL}/auth/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...registro, telefono: `${codigoPais}${telefonoLocal}` })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'No se pudo crear la cuenta.');
        return;
      }

      const usuarioSesion = {
        nombre: [data.usuario.nombre, data.usuario.apellidos].filter(Boolean).join(' '),
        correo: data.usuario.correo,
        rol: data.usuario.rol || 'cliente'
      };
      setUsuario(usuarioSesion);
      setActiveView('Catálogo');
      setIsLoggedIn(true);
      localStorage.setItem('telephaty_token', data.token);
      localStorage.setItem('telephaty_user', JSON.stringify(usuarioSesion));
    } catch (error) {
      setError('Error de conexión con la API.');
    }
  };

  const fnCerrarSesion = () => {
    localStorage.removeItem('telephaty_token');
    localStorage.removeItem('telephaty_user');
    setIsLoggedIn(false);
    setUsuario({ nombre: 'Admin', rol: 'administrador' });
    setActiveView('Dashboard');
    setError('');
  };

  if (!isLoggedIn) {
    return (
      <LoginScreen
        login={login}
        setLogin={setLogin}
        registro={registro}
        setRegistro={setRegistro}
        error={error}
        onSubmit={fnIniciarSesion}
        onRegister={fnRegistrarCuenta}
      />
    );
  }

  return (
    <DashboardLayout
      usuario={usuario}
      activeView={activeView}
      setActiveView={setActiveView}
      onLogout={fnCerrarSesion}
      catalogo={catalogo}
      setCatalogo={setCatalogo}
    />
  );
}

function LoginScreen({ login, setLogin, registro, setRegistro, error, onSubmit, onRegister }) {
  const [showRegistration, setShowRegistration] = useState(false);

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/logo-telephaty.svg" alt="Telephaty" className="brand-logo" />
          <div>
            <span className="brand-tag">Floristería</span>
            <h1>Telephaty</h1>
          </div>
        </div>

        <div className="auth-header">
          <p className="mini-label">{showRegistration ? 'Nueva cuenta' : 'Acceso'}</p>
          <h2>{showRegistration ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
        </div>

        {showRegistration ? (
          <form className="login-form" onSubmit={onRegister}>
            <div className="auth-fields-row">
              <label>
                Nombre
                <input required autoComplete="given-name" value={registro.nombre} onChange={(event) => setRegistro((prev) => ({ ...prev, nombre: event.target.value }))} />
              </label>
              <label>
                Apellidos
                <input required autoComplete="family-name" value={registro.apellidos} onChange={(event) => setRegistro((prev) => ({ ...prev, apellidos: event.target.value }))} />
              </label>
            </div>
            <label>
              Teléfono
              <span className="phone-input-row">
                <select name="codigoPais" aria-label="Código de país" defaultValue="+503">
                  <option value="+503">El Salvador +503</option>
                </select>
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  pattern="[0-9]{8}"
                  minLength={8}
                  maxLength={8}
                  placeholder="71234567"
                  value={registro.telefono}
                  onChange={(event) => setRegistro((prev) => ({ ...prev, telefono: event.target.value.replace(/\D/g, '').slice(0, 8) }))}
                />
              </span>
            </label>
            <label>
              Correo
              <input required type="email" autoComplete="email" value={registro.correo} onChange={(event) => setRegistro((prev) => ({ ...prev, correo: event.target.value }))} />
            </label>
            <label>
              Dirección
              <input autoComplete="street-address" value={registro.direccion} onChange={(event) => setRegistro((prev) => ({ ...prev, direccion: event.target.value }))} />
            </label>
            <label>
              Contraseña
              <input required type="password" autoComplete="new-password" minLength={8} value={registro.contrasena} onChange={(event) => setRegistro((prev) => ({ ...prev, contrasena: event.target.value }))} />
            </label>
            {error && <div className="error-box">{error}</div>}
            <button type="submit" className="btn btn-primary btn-block">Crear cuenta</button>
          </form>
        ) : (
          <form className="login-form" onSubmit={onSubmit}>
            <label>
              Correo
              <input
                type="email"
                autoComplete="email"
                value={login.correo}
                onChange={(event) => setLogin((prev) => ({ ...prev, correo: event.target.value }))}
                placeholder="admin@telephaty.com"
              />
            </label>

            <label>
              Contraseña
              <input
                type="password"
                autoComplete="current-password"
                value={login.contrasena}
                onChange={(event) => setLogin((prev) => ({ ...prev, contrasena: event.target.value }))}
                placeholder="••••••••"
              />
            </label>

            {error && <div className="error-box">{error}</div>}
            <button type="submit" className="btn btn-primary btn-block">Ingresar</button>
          </form>
        )}

        <p className="auth-switch">
          {showRegistration ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'}
          <button type="button" onClick={() => setShowRegistration((visible) => !visible)}>
            {showRegistration ? 'Inicia sesión' : 'Crear cuenta'}
          </button>
        </p>
      </div>
    </div>
  );
}

function DashboardLayout({ usuario, activeView, setActiveView, onLogout, catalogo, setCatalogo }) {
  const esAdministrador = usuario.rol === 'administrador';
  const menuItems = esAdministrador ? adminNavItems : clientNavItems;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeUtilityPanel, setActiveUtilityPanel] = useState(null);
  const [utilityPopoverTop, setUtilityPopoverTop] = useState(0);
  const [pedidos, setPedidos] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [search, setSearch] = useState('');
  const searchOriginViewRef = useRef(activeView);
  const [dialog, setDialog] = useState(null);
  const [dialogError, setDialogError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('telephaty_settings') || '{}');
      return { orderNotifications: true, inventoryAlerts: true, ...saved };
    } catch {
      return { orderNotifications: true, inventoryAlerts: true };
    }
  });
  const menuRef = useRef(null);
  const utilitiesRef = useRef(null);

  useEffect(() => {
    if (!esAdministrador && !['Catálogo', 'Pedidos', 'Búsqueda'].includes(activeView)) {
      setActiveView('Catálogo');
    }
  }, [activeView, esAdministrador, setActiveView]);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [pedidosData, inventarioData] = await Promise.all([
          fnSolicitarApi('/pedidos'),
          usuario.rol === 'administrador' ? fnSolicitarApi('/inventario') : Promise.resolve([])
        ]);
        setPedidos(pedidosData);
        setInventario(inventarioData);
      } catch (error) {
        console.error('No se pudieron cargar pedidos o inventario', error);
      }
    };

    cargarDatos();
  }, [usuario.rol]);

  useEffect(() => {
    if (!isMenuOpen && !activeUtilityPanel) return undefined;

    const closeOnOutsideClick = (event) => {
      if (isMenuOpen && !menuRef.current?.contains(event.target)) setIsMenuOpen(false);
      if (activeUtilityPanel && !utilitiesRef.current?.contains(event.target)) setActiveUtilityPanel(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        setActiveUtilityPanel(null);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isMenuOpen, activeUtilityPanel]);

  const fnCambiarPreferencia = (key, value) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    try {
      localStorage.setItem('telephaty_settings', JSON.stringify(updated));
    } catch (error) {
      console.error('No se pudieron guardar las preferencias', error);
    }
  };

  const fnToggleUtilityPanel = (panel, event) => {
    if (activeUtilityPanel === panel) {
      setActiveUtilityPanel(null);
      return;
    }
    setUtilityPopoverTop(event.currentTarget.getBoundingClientRect().bottom + 10);
    setActiveUtilityPanel(panel);
  };

  const pedidosPorAtender = pedidos.filter((pedido) => ['Pendiente', 'P', 'En preparación', 'R'].includes(pedido.estado)).length;
  const alertasDeStock = inventario.filter((flor) => Number(flor.stock) <= Number(flor.stock_minimo)).length;
  const visibleNotifications = [
    { id: 'orders', title: 'Pedidos por atender', detail: `${pedidosPorAtender} pedidos esperan atención.`, view: 'Pedidos', preference: 'orderNotifications', count: pedidosPorAtender },
    { id: 'inventory', title: 'Stock bajo', detail: `${alertasDeStock} productos necesitan reposición.`, view: 'Inventario', preference: 'inventoryAlerts', count: alertasDeStock }
  ].filter((item) => preferences[item.preference] && item.count > 0);

  const fnAbrirPedido = (idRamo = '') => {
    setDialog({ type: 'order', idRamo: String(idRamo) });
    setDialogError('');
  };

  const fnAbrirFactura = (factura) => setDialog({ type: 'invoice', factura });

  const fnCrearPedido = async (pedido) => {
    setIsSaving(true);
    setDialogError('');
    try {
      const resultado = await fnSolicitarApi('/pedidos', {
        method: 'POST',
        body: JSON.stringify({ ...pedido, compradorNombre: usuario.nombre })
      });
      setPedidos((actuales) => [resultado.pedido, ...actuales]);
      setActiveView('Pedidos');
      setDialog({ type: 'invoice', factura: resultado.factura });
    } catch (error) {
      setDialogError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fnSolicitarPersonalizado = async (solicitud) => {
    setIsSaving(true);
    setDialogError('');
    try {
      const resultado = await fnSolicitarApi('/pedidos/personalizados', {
        method: 'POST',
        body: JSON.stringify({ ...solicitud, compradorNombre: usuario.nombre })
      });
      setPedidos((actuales) => [resultado.solicitud, ...actuales]);
      setDialog({ type: 'custom-success', solicitud: resultado.solicitud });
    } catch (error) {
      setDialogError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fnCrearProducto = async (producto) => {
    setIsSaving(true);
    setDialogError('');
    try {
      await fnSolicitarApi('/ramos', { method: 'POST', body: JSON.stringify(producto) });
      setCatalogo(await fnSolicitarApi('/ramos'));
      setDialog(null);
    } catch (error) {
      setDialogError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fnActualizarStock = async (idFlor, stock) => {
    setIsSaving(true);
    setDialogError('');
    try {
      await fnSolicitarApi(`/inventario/${idFlor}`, { method: 'PATCH', body: JSON.stringify({ stock: Number(stock) }) });
      setInventario(await fnSolicitarApi('/inventario'));
      setDialog(null);
    } catch (error) {
      setDialogError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fnCrearFlor = async (flor) => {
    setIsSaving(true);
    setDialogError('');
    try {
      await fnSolicitarApi('/inventario', { method: 'POST', body: JSON.stringify(flor) });
      setInventario(await fnSolicitarApi('/inventario'));
      setDialog(null);
    } catch (error) {
      setDialogError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fnExportarPedidos = () => {
    const filas = [
      ['Pedido', 'Cliente', 'Producto', 'Fecha de entrega', 'Total', 'Estado'],
      ...pedidos.map((pedido) => [pedido.codigo || `PED-${pedido.id_pedido}`, pedido.cliente, pedido.producto, pedido.fecha_entrega, pedido.total, pedido.estado])
    ];
    fnDescargarCsv('telephaty-pedidos.csv', filas);
  };

  const fnRecargarInventario = async () => {
    try {
      setInventario(await fnSolicitarApi('/inventario'));
    } catch (error) {
      console.error('No se pudo actualizar el inventario', error);
    }
  };

  const terminoBusqueda = fnNormalizarBusqueda(search.trim());
  const pedidosFiltrados = pedidos.filter((pedido) => fnCoincideBusqueda(
    terminoBusqueda,
    pedido.codigo,
    pedido.id_pedido,
    pedido.cliente,
    pedido.comprador_correo,
    pedido.producto,
    pedido.descripcion,
    pedido.estado,
    pedido.fecha_entrega,
    pedido.hora_desde,
    pedido.direccion_entrega
  ));
  const catalogoFiltrado = catalogo.filter((producto) => fnCoincideBusqueda(
    terminoBusqueda,
    producto.nombre,
    producto.codigo,
    producto.descripcion,
    producto.categoria_nombre
  ));
  const inventarioFiltrado = inventario.filter((flor) => fnCoincideBusqueda(
    terminoBusqueda,
    flor.nombre,
    flor.unidad,
    flor.stock,
    flor.stock_minimo
  ));

  return (
    <div className="app-shell">
      <main className="main-panel">
        <header className="topbar">
          <div className="menu-anchor" ref={menuRef}>
            <button
              type="button"
              className="icon-button menu-toggle"
              aria-label="Abrir menú de navegación"
              aria-expanded={isMenuOpen}
              aria-controls="navigation-menu"
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <span className="hamburger-icon" aria-hidden="true"><i /><i /><i /></span>
            </button>
            {isMenuOpen && (
              <aside className="menu-popover" id="navigation-menu" aria-label="Menú principal">
                <p className="mini-label">Navegación</p>
                <nav className="side-menu" aria-label="Navegación principal">
                  {menuItems.map((item) => {
                    const targetView = item === 'Mis pedidos' ? 'Pedidos' : item;
                    return (
                      <button
                        key={item}
                        type="button"
                        className={`menu-item ${targetView === activeView ? 'active' : ''}`}
                        onClick={() => {
                          setActiveView(targetView);
                          setIsMenuOpen(false);
                        }}
                      >
                        {item}
                      </button>
                    );
                  })}
                </nav>
                <button
                  type="button"
                  className="btn btn-primary btn-block menu-new-order"
                  onClick={() => {
                    setIsMenuOpen(false);
                    fnAbrirPedido();
                  }}
                >
                  + Nuevo pedido
                </button>
                <div className="menu-user">
                  <div className="user-info">
                    <div className="avatar">{usuario.nombre.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <strong>{usuario.nombre}</strong>
                      <span>{usuario.rol}</span>
                    </div>
                  </div>
                  <button type="button" className="btn btn-secondary btn-block" onClick={onLogout}>Cerrar sesión</button>
                </div>
              </aside>
            )}
          </div>
          <div className="search-box">
            <span>⌕</span>
            <input
              type="search"
              aria-label={esAdministrador ? 'Buscar pedidos, clientes, catálogo e inventario' : 'Buscar pedidos y catálogo'}
              value={search}
              onChange={(event) => {
                const value = event.target.value;
                if (value.trim()) {
                  if (!search.trim()) searchOriginViewRef.current = activeView;
                  setActiveView('Búsqueda');
                } else {
                  setActiveView(searchOriginViewRef.current);
                }
                setSearch(value);
              }}
              placeholder={esAdministrador ? 'Buscar pedidos, clientes, productos o flores' : 'Buscar pedidos o productos'}
            />
          </div>

          <div className="topbar-actions" ref={utilitiesRef}>
            <div className="utility-anchor">
              <button
                type="button"
                className="icon-button utility-toggle"
                aria-label="Abrir notificaciones"
                aria-expanded={activeUtilityPanel === 'notifications'}
                aria-controls="notifications-panel"
                onClick={(event) => fnToggleUtilityPanel('notifications', event)}
              >
                <Bell size={19} strokeWidth={1.8} aria-hidden="true" />
                {visibleNotifications.length > 0 && <span className="notification-badge">{visibleNotifications.length}</span>}
              </button>
              {activeUtilityPanel === 'notifications' && (
                <aside className="utility-popover" id="notifications-panel" aria-label="Notificaciones" style={{ '--utility-popover-top': `${utilityPopoverTop}px` }}>
                  <div className="utility-heading">
                    <div>
                      <p className="mini-label">Centro de avisos</p>
                      <h3>Notificaciones</h3>
                    </div>
                    <span className="notification-count">{visibleNotifications.length}</span>
                  </div>
                  {visibleNotifications.length > 0 ? (
                    <div className="notification-list">
                      {visibleNotifications.map((notification) => (
                        <button
                          type="button"
                          className="notification-item"
                          key={notification.id}
                          onClick={() => {
                            setActiveView(notification.view);
                            setActiveUtilityPanel(null);
                          }}
                        >
                          <span className="notification-dot" />
                          <span>
                            <strong>{notification.title}</strong>
                            <small>{notification.detail}</small>
                          </span>
                          <span className="notification-arrow" aria-hidden="true">›</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-notifications">No hay avisos activos.</p>
                  )}
                </aside>
              )}
            </div>

            <div className="utility-anchor">
              <button
                type="button"
                className="icon-button utility-toggle"
                aria-label="Abrir configuración"
                aria-expanded={activeUtilityPanel === 'settings'}
                aria-controls="settings-panel"
                onClick={(event) => fnToggleUtilityPanel('settings', event)}
              >
                <Settings size={19} strokeWidth={1.8} aria-hidden="true" />
              </button>
              {activeUtilityPanel === 'settings' && (
                <aside className="utility-popover settings-popover" id="settings-panel" aria-label="Configuración" style={{ '--utility-popover-top': `${utilityPopoverTop}px` }}>
                  <div className="utility-heading">
                    <div>
                      <p className="mini-label">Preferencias</p>
                      <h3>Configuración</h3>
                    </div>
                  </div>
                  <label className="setting-row">
                    <span>
                      <strong>Avisos de pedidos</strong>
                      <small>Mostrar pedidos por atender</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={preferences.orderNotifications}
                      onChange={(event) => fnCambiarPreferencia('orderNotifications', event.target.checked)}
                    />
                  </label>
                  <label className="setting-row">
                    <span>
                      <strong>Alertas de inventario</strong>
                      <small>Mostrar avisos de stock bajo</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={preferences.inventoryAlerts}
                      onChange={(event) => fnCambiarPreferencia('inventoryAlerts', event.target.checked)}
                    />
                  </label>
                  <p className="settings-saved">Las preferencias se guardan automáticamente.</p>
                </aside>
              )}
            </div>
          </div>
        </header>

        <section className="page-content">
          <div className="view-transition" key={activeView}>
            {activeView === 'Búsqueda' && <BuscadorView pedidos={pedidosFiltrados} catalogo={catalogoFiltrado} inventario={inventarioFiltrado} isAdmin={esAdministrador} onView={setActiveView} />}
            {activeView === 'Dashboard' && <DashboardView pedidos={pedidosFiltrados} inventario={inventarioFiltrado} catalogoCount={catalogoFiltrado.length} onExport={fnExportarPedidos} onViewOrders={() => setActiveView('Pedidos')} onViewInventory={() => setActiveView('Inventario')} />}
            {activeView === 'Pedidos' && <PedidosView pedidos={pedidosFiltrados} isAdmin={esAdministrador} onCreate={() => fnAbrirPedido()} onExport={fnExportarPedidos} onInvoice={fnAbrirFactura} />}
            {activeView === 'Catálogo' && <CatalogoView catalogo={catalogoFiltrado} isAdmin={esAdministrador} onCreateProduct={() => { setDialog({ type: 'product' }); setDialogError(''); }} onAddToOrder={fnAbrirPedido} onCustomOrder={() => { setDialog({ type: 'custom-order' }); setDialogError(''); }} />}
            {activeView === 'Inventario' && <InventarioView inventario={inventarioFiltrado} onRefresh={fnRecargarInventario} onUpdate={(flor) => { setDialog({ type: 'stock', flor }); setDialogError(''); }} onCreate={() => { setDialog({ type: 'flower' }); setDialogError(''); }} isAdmin={usuario.rol === 'administrador'} />}
            {activeView === 'Entregas' && <EntregasView pedidos={pedidosFiltrados} />}
            {activeView === 'Reportes' && <ReportesView pedidos={pedidosFiltrados} onExport={fnExportarPedidos} />}
          </div>
        </section>

        {dialog?.type === 'order' && <AppDialog title="Crear pedido" onClose={() => setDialog(null)}><PedidoForm catalogo={catalogo} initialProduct={dialog.idRamo} error={dialogError} isSaving={isSaving} onSubmit={fnCrearPedido} /></AppDialog>}
        {dialog?.type === 'custom-order' && <AppDialog title="Pedir ramo personalizado" onClose={() => setDialog(null)}><PersonalizedOrderForm error={dialogError} isSaving={isSaving} onSubmit={fnSolicitarPersonalizado} /></AppDialog>}
        {dialog?.type === 'custom-success' && <AppDialog title="Solicitud enviada" onClose={() => setDialog(null)}><PersonalizedOrderSuccess solicitud={dialog.solicitud} onViewOrders={() => { setDialog(null); setActiveView('Pedidos'); }} /></AppDialog>}
        {dialog?.type === 'invoice' && <AppDialog title={`Factura ${dialog.factura.numeroFactura}`} className="invoice-dialog" onClose={() => setDialog(null)}><FacturaView factura={dialog.factura} onClose={() => setDialog(null)} /></AppDialog>}
        {dialog?.type === 'product' && <AppDialog title="Agregar producto" onClose={() => setDialog(null)}><ProductoForm error={dialogError} isSaving={isSaving} onSubmit={fnCrearProducto} /></AppDialog>}
        {dialog?.type === 'stock' && <AppDialog title={`Ajustar stock: ${dialog.flor.nombre}`} onClose={() => setDialog(null)}><StockForm flor={dialog.flor} error={dialogError} isSaving={isSaving} onSubmit={fnActualizarStock} /></AppDialog>}
        {dialog?.type === 'flower' && <AppDialog title="Agregar al inventario" onClose={() => setDialog(null)}><FlorForm error={dialogError} isSaving={isSaving} onSubmit={fnCrearFlor} /></AppDialog>}
      </main>
    </div>
  );
}

function BuscadorView({ pedidos, catalogo, inventario, isAdmin, onView }) {
  const secciones = [
    {
      titulo: 'Pedidos',
      vista: 'Pedidos',
      resultados: pedidos.map((pedido) => ({
        id: `pedido-${pedido.id_pedido}`,
        titulo: pedido.codigo || `PED-${pedido.id_pedido}`,
        detalle: [pedido.cliente, pedido.producto, pedido.estado, pedido.fecha_entrega].filter(Boolean).join(' · ')
      }))
    },
    {
      titulo: 'Catálogo',
      vista: 'Catálogo',
      resultados: catalogo.map((producto) => ({
        id: `producto-${producto.id_ramo}`,
        titulo: producto.nombre,
        detalle: [producto.codigo, producto.descripcion].filter(Boolean).join(' · ')
      }))
    },
    ...(isAdmin ? [{
      titulo: 'Inventario',
      vista: 'Inventario',
      resultados: inventario.map((flor) => ({
        id: `flor-${flor.id_flor}`,
        titulo: flor.nombre,
        detalle: `${flor.stock} ${flor.unidad} disponibles · mínimo ${flor.stock_minimo}`
      }))
    }] : [])
  ];
  const cantidadResultados = secciones.reduce((total, seccion) => total + seccion.resultados.length, 0);

  return (
    <div className="module-block">
      <div className="heading-row">
        <div>
          <p className="mini-label">Búsqueda global</p>
          <h2>{cantidadResultados ? `${cantidadResultados} resultados` : 'Sin resultados'}</h2>
        </div>
      </div>

      {secciones.map((seccion) => (
        <section className="search-results-section" key={seccion.titulo}>
          <div className="panel-header">
            <h3>{seccion.titulo}</h3>
            <button type="button" className="btn btn-link" onClick={() => onView(seccion.vista)}>Ver sección</button>
          </div>
          {seccion.resultados.length ? (
            <div className="search-results-list">
              {seccion.resultados.map((resultado) => (
                <button
                  type="button"
                  className="search-result panel-card"
                  key={resultado.id}
                  onClick={() => onView(seccion.vista)}
                >
                  <strong>{resultado.titulo}</strong>
                  <span>{resultado.detalle}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-state">No hay coincidencias en esta sección.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function DashboardView({ pedidos, inventario, catalogoCount, onExport, onViewOrders, onViewInventory }) {
  const alertas = inventario.filter((flor) => Number(flor.stock) <= Number(flor.stock_minimo));
  const ventas = pedidos.reduce((total, pedido) => total + Number(pedido.total || 0), 0);
  const resumen = [
    { label: 'Pedidos registrados', value: pedidos.length, trend: 'Total en el sistema' },
    { label: 'Ventas registradas', value: `$${ventas.toFixed(2)}`, trend: 'Pedidos actuales' },
    { label: 'Alertas de stock', value: alertas.length, trend: 'Requieren revisión' },
    { label: 'Productos en catálogo', value: catalogoCount, trend: 'Productos disponibles' }
  ];

  return (
    <>
      <div className="heading-row">
        <div>
          <p className="mini-label">Panel administrativo</p>
          <h2>Resumen del negocio</h2>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onExport}>Exportar reporte</button>
      </div>

      <div className="stats-grid">
        {resumen.map((stat) => (
          <article key={stat.label} className="stat-card panel-card">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.trend}</small>
          </article>
        ))}
      </div>

      <div className="content-grid">
        <section className="panel-card panel-large">
          <div className="panel-header">
            <div>
              <p className="mini-label">Pedidos recientes</p>
              <h3>Últimas entregas</h3>
            </div>
            <button type="button" className="btn btn-link" onClick={onViewOrders}>Ver todo</button>
          </div>

          <div className="table-wrap latest-deliveries-table">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Producto</th>
                  <th>Hora</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.slice(0, 5).map((order) => (
                  <tr key={order.id_pedido}>
                    <td data-label="Pedido">{order.codigo || `PED-${order.id_pedido}`}</td>
                    <td data-label="Cliente">{order.cliente}</td>
                    <td data-label="Producto">{order.producto}</td>
                    <td data-label="Hora">{order.hora_desde || order.fecha_entrega}</td>
                    <td data-label="Estado">
                      <span className={`status-tag ${String(order.estado).toLowerCase().replace(/\s+/g, '-')}`}>
                        {order.estado}
                      </span>
                    </td>
                  </tr>
                ))}
                {pedidos.length === 0 && <tr><td className="empty-cell" colSpan="5">Aún no hay pedidos registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="panel-card panel-side">
          <div className="panel-header">
            <div>
              <p className="mini-label">Inventario</p>
                <h3>Alertas de stock</h3>
                <button type="button" className="btn btn-link" onClick={onViewInventory}>Ver inventario</button>
            </div>
          </div>

          <div className="alert-list">
                {alertas.map((item) => (
                  <div key={item.id_flor} className="alert-item warning">
                <div>
                      <strong>{item.nombre}</strong>
                      <span>{item.stock} {item.unidad} disponibles</span>
                </div>
                <span className="dot" />
              </div>
            ))}
                {alertas.length === 0 && <p className="empty-state">No hay alertas de stock.</p>}
          </div>
        </aside>
      </div>
    </>
  );
}

function PedidosView({ pedidos, isAdmin, onCreate, onExport, onInvoice }) {
  return (
    <div className="module-block">
      <div className="heading-row">
        <div>
          <p className="mini-label">Pedidos</p>
          <h2>{isAdmin ? 'Gestión de pedidos' : 'Mis pedidos'}</h2>
        </div>
        <div className="heading-actions">
          {isAdmin && <button type="button" className="btn btn-secondary" onClick={onExport}>Exportar CSV</button>}
          <button type="button" className="btn btn-primary" onClick={onCreate}>Crear pedido</button>
        </div>
      </div>

      <div className="list-grid">
        {pedidos.map((pedido) => (
          <article key={pedido.id_pedido} className="module-card panel-card">
            <div className="module-card-header">
              <strong>{pedido.codigo || `PED-${pedido.id_pedido}`}</strong>
              <span className={`status-tag ${String(pedido.estado).toLowerCase().replace(/\s+/g, '-')}`}>{pedido.estado}</span>
            </div>
            <h3>{pedido.cliente}</h3>
            <p>{pedido.producto}</p>
            {pedido.tipo === 'personalizado' && <p>{pedido.descripcion}</p>}
            <p>{pedido.fecha_entrega} {pedido.hora_desde || ''}</p>
            <div className="module-card-footer">
              <span>{pedido.tipo === 'personalizado' ? 'Presupuesto' : 'Total'}</span>
              <strong>{pedido.tipo === 'personalizado' ? (pedido.presupuesto ? `$${Number(pedido.presupuesto).toFixed(2)}` : 'Por cotizar') : `$${Number(pedido.total).toFixed(2)}`}</strong>
            </div>
            {!isAdmin && pedido.tipo !== 'personalizado' && pedido.factura && (
              <button type="button" className="btn btn-secondary" onClick={() => onInvoice(pedido.factura)}>Descargar factura en PDF</button>
            )}
          </article>
        ))}
        {pedidos.length === 0 && <p className="empty-state">No hay pedidos que coincidan con la búsqueda.</p>}
      </div>
    </div>
  );
}

function CatalogoView({ catalogo, isAdmin, onCreateProduct, onAddToOrder, onCustomOrder }) {
  return (
    <div className="module-block">
      <div className="heading-row">
        <div>
          <p className="mini-label">Catálogo</p>
          <h2>Ramos destacados</h2>
        </div>
        <div className="heading-actions">
          {isAdmin
            ? <button type="button" className="btn btn-secondary" onClick={onCreateProduct}>Agregar producto</button>
            : <button type="button" className="btn btn-primary" onClick={onCustomOrder}>Pedir ramo personalizado</button>}
        </div>
      </div>

      <div className="catalog-grid">
        {catalogo.map((producto) => {
          return (
            <article key={producto.id_ramo} className="product-card">
              <img src={producto.imagen || 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d'} alt={producto.nombre} />
              <div className="product-body">
                <div className="product-meta">
                  <span>{producto.codigo || 'RAM-001'}</span>
                  <strong>${Number(producto.precio || 32).toFixed(2)}</strong>
                </div>
                <h4>{producto.nombre}</h4>
                <p>{producto.descripcion || 'Arreglo floral premium para cualquier ocasión.'}</p>
                <button type="button" className="btn btn-primary btn-small" onClick={() => onAddToOrder(producto.id_ramo)}>Crear pedido</button>
              </div>
            </article>
          );
        })}
        {catalogo.length === 0 && <p className="empty-state">No hay productos que coincidan con la búsqueda.</p>}
      </div>
    </div>
  );
}

function InventarioView({ inventario, onRefresh, onUpdate, onCreate, isAdmin }) {
  return (
    <div className="module-block">
      <div className="heading-row">
        <div>
          <p className="mini-label">Inventario</p>
          <h2>Control de stock</h2>
        </div>
        <div className="heading-actions">
          <button type="button" className="btn btn-secondary" onClick={onRefresh}>Actualizar inventario</button>
          {isAdmin && <button type="button" className="btn btn-primary" onClick={onCreate}>Agregar flor</button>}
        </div>
      </div>

      <div className="alert-list inventory-list">
        {inventario.map((item) => {
          const bajo = Number(item.stock) <= Number(item.stock_minimo);
          return <div key={item.id_flor} className="alert-item panel-card">
            <div>
              <strong>{item.nombre}</strong>
              <span>{item.stock} {item.unidad} · mínimo {item.stock_minimo}</span>
            </div>
            <div className="inventory-actions">
              <span className={`status-pill ${bajo ? 'warning' : ''}`}>{bajo ? 'Bajo' : 'Disponible'}</span>
              {isAdmin && <button type="button" className="btn btn-link" onClick={() => onUpdate(item)}>Ajustar</button>}
            </div>
          </div>
        })}
        {inventario.length === 0 && <p className="empty-state">No hay productos de inventario que coincidan.</p>}
      </div>
    </div>
  );
}

function EntregasView({ pedidos }) {
  return (
    <div className="module-block">
      <div className="heading-row">
        <div>
          <p className="mini-label">Entregas</p>
          <h2>Ruta y distribución</h2>
        </div>
      </div>

      <div className="list-grid">
        {pedidos.map((entrega) => (
          <article key={entrega.id_pedido} className="module-card panel-card">
            <div className="module-card-header">
              <strong>{entrega.codigo || `PED-${entrega.id_pedido}`}</strong>
              <span className={`status-tag ${String(entrega.estado).toLowerCase().replace(/\s+/g, '-')}`}>{entrega.estado}</span>
            </div>
            <h3>{entrega.cliente}</h3>
            <p>{entrega.direccion_entrega || 'Dirección en el detalle del pedido'}</p>
            <small>{entrega.fecha_entrega} {entrega.hora_desde || ''}</small>
          </article>
        ))}
        {pedidos.length === 0 && <p className="empty-state">No hay entregas asociadas a pedidos.</p>}
      </div>
    </div>
  );
}

function ReportesView({ pedidos, onExport }) {
  const ingresos = pedidos.reduce((total, pedido) => total + Number(pedido.total || 0), 0);
  return (
    <div className="module-block">
      <div className="heading-row">
        <div>
          <p className="mini-label">Reportes</p>
          <h2>Indicadores del negocio</h2>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onExport}>Exportar pedidos CSV</button>
      </div>

      <div className="stats-grid">
        {[
          { title: 'Pedidos', value: pedidos.length },
          { title: 'Ingresos registrados', value: `$${ingresos.toFixed(2)}` },
          { title: 'Ticket promedio', value: `$${pedidos.length ? (ingresos / pedidos.length).toFixed(2) : '0.00'}` }
        ].map((item) => (
          <article key={item.title} className="stat-card panel-card">
            <span>{item.title}</span>
            <strong>{item.value}</strong>
            <small>Según pedidos registrados</small>
          </article>
        ))}
      </div>
    </div>
  );
}

function AppDialog({ title, onClose, children, className = '' }) {
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`action-dialog ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-header">
          <h2>{title}</h2>
          <button type="button" className="dialog-close" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function FacturaView({ factura, onClose }) {
  const fechaEntrega = new Date(`${factura.fechaEntrega}T00:00:00`).toLocaleDateString('es-SV', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const metodosPago = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta' };

  return (
    <>
      <article className="invoice-sheet">
        <div className="invoice-brand-row">
          <div className="invoice-brand">
            <img src="/logo-telephaty.svg" alt="" />
            <div>
              <strong>Telephaty</strong>
              <span>Floristería</span>
            </div>
          </div>
          <div className="invoice-number">
            <span>Factura</span>
            <strong>{factura.numeroFactura}</strong>
          </div>
        </div>

        <div className="invoice-order-code">
          <span>Número de pedido</span>
          <strong>{factura.codigoPedido}</strong>
        </div>

        <div className="invoice-buyer">
          <p className="mini-label">Comprador</p>
          <strong>{factura.compradorNombre}</strong>
          <span>{factura.compradorCorreo}</span>
        </div>

        <div className="invoice-table-wrap">
          <table className="invoice-table">
            <thead>
              <tr><th>Producto</th><th>Código</th><th>Precio</th><th>Cantidad</th><th>Importe</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>{factura.nombreProducto}</td>
                <td>{factura.codigoProducto}</td>
                <td>${Number(factura.precioUnitario).toFixed(2)}</td>
                <td>{factura.cantidad}</td>
                <td>${Number(factura.total).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="invoice-details">
          <div><span>Fecha de entrega</span><strong>{fechaEntrega}</strong></div>
          <div><span>Método de pago</span><strong>{metodosPago[factura.metodoPago] || factura.metodoPago}</strong></div>
          <div className="invoice-total"><span>Total</span><strong>${Number(factura.total).toFixed(2)}</strong></div>
        </div>
      </article>
      <div className="invoice-actions">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Imprimir / Guardar PDF</button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Listo</button>
      </div>
    </>
  );
}

function PedidoForm({ catalogo, initialProduct, error, isSaving, onSubmit }) {
  const fechaMinima = new Date().toISOString().slice(0, 10);

  return (
    <form className="dialog-form" onSubmit={(event) => {
      event.preventDefault();
      const datos = new FormData(event.currentTarget);
      onSubmit({
        idRamo: Number(datos.get('idRamo')),
        cantidad: Number(datos.get('cantidad')),
        fechaEntrega: datos.get('fechaEntrega'),
        horaEntrega: datos.get('horaEntrega'),
        destinatario: datos.get('destinatario'),
        telefono: datos.get('telefono'),
        direccion: datos.get('direccion'),
        dedicatoria: datos.get('dedicatoria'),
        metodoPago: datos.get('metodoPago')
      });
    }}>
      <label>
        Producto
        <select name="idRamo" required defaultValue={initialProduct || ''}>
          <option value="" disabled>Selecciona un ramo</option>
          {catalogo.map((producto) => <option key={producto.id_ramo} value={producto.id_ramo}>{producto.nombre} · ${Number(producto.precio).toFixed(2)}</option>)}
        </select>
      </label>
      <div className="dialog-fields-row">
        <label>Cantidad<input name="cantidad" type="number" min="1" step="1" defaultValue="1" required /></label>
        <label>Fecha de entrega<input name="fechaEntrega" type="date" min={fechaMinima} required /></label>
      </div>
      <div className="dialog-fields-row">
        <label>Hora de entrega<input name="horaEntrega" type="time" required /></label>
        <label>Método de pago<select name="metodoPago" defaultValue="efectivo"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option></select></label>
      </div>
      <label>Nombre del destinatario<input name="destinatario" autoComplete="name" required /></label>
      <label>Teléfono<input name="telefono" type="tel" autoComplete="tel" required /></label>
      <label>Dirección de entrega<input name="direccion" autoComplete="street-address" required /></label>
      <label>Dedicatoria<textarea name="dedicatoria" rows="2" maxLength="300" /></label>
      {error && <div className="error-box">{error}</div>}
      <button type="submit" className="btn btn-primary btn-block" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Confirmar pedido'}</button>
    </form>
  );
}

function ProductoForm({ error, isSaving, onSubmit }) {
  return (
    <form className="dialog-form" onSubmit={(event) => {
      event.preventDefault();
      const datos = new FormData(event.currentTarget);
      onSubmit({
        nombre: datos.get('nombre'),
        codigo: datos.get('codigo'),
        descripcion: datos.get('descripcion'),
        precio: Number(datos.get('precio')),
        costoEmpaque: Number(datos.get('costoEmpaque') || 0),
        imagen: datos.get('imagen'),
        idCategoria: Number(datos.get('idCategoria')) || null
      });
    }}>
      <label>Nombre<input name="nombre" required maxLength="100" /></label>
      <div className="dialog-fields-row">
        <label>Código<input name="codigo" required maxLength="25" /></label>
        <label>Precio<input name="precio" type="number" min="0.01" step="0.01" required /></label>
      </div>
      <label>Categoría (ID, opcional)<input name="idCategoria" type="number" min="1" step="1" /></label>
      <label>Descripción<textarea name="descripcion" rows="3" maxLength="300" /></label>
      <label>Imagen (URL, opcional)<input name="imagen" type="url" /></label>
      <label>Costo de empaque<input name="costoEmpaque" type="number" min="0" step="0.01" defaultValue="0" /></label>
      {error && <div className="error-box">{error}</div>}
      <button type="submit" className="btn btn-primary btn-block" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar producto'}</button>
    </form>
  );
}

function StockForm({ flor, error, isSaving, onSubmit }) {
  return (
    <form className="dialog-form" onSubmit={(event) => {
      event.preventDefault();
      onSubmit(flor.id_flor, new FormData(event.currentTarget).get('stock'));
    }}>
      <p className="stock-current">Existencia actual: <strong>{flor.stock} {flor.unidad}</strong></p>
      <label>Nuevo stock<input name="stock" type="number" min="0" step="1" defaultValue={flor.stock} required /></label>
      {error && <div className="error-box">{error}</div>}
      <button type="submit" className="btn btn-primary btn-block" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar existencias'}</button>
    </form>
  );
}

function FlorForm({ error, isSaving, onSubmit }) {
  return (
    <form className="dialog-form" onSubmit={(event) => {
      event.preventDefault();
      const datos = new FormData(event.currentTarget);
      onSubmit({
        nombre: datos.get('nombre'),
        unidad: datos.get('unidad'),
        stock: Number(datos.get('stock')),
        stock_minimo: Number(datos.get('stock_minimo')),
        costo_unitario: Number(datos.get('costo_unitario'))
      });
    }}>
      <label>Nombre<input name="nombre" required maxLength="80" /></label>
      <label>Unidad<input name="unidad" required maxLength="20" defaultValue="tallos" /></label>
      <div className="dialog-fields-row">
        <label>Existencias iniciales<input name="stock" type="number" min="0" step="1" defaultValue="0" required /></label>
        <label>Stock mínimo<input name="stock_minimo" type="number" min="0" step="1" defaultValue="20" required /></label>
      </div>
      <label>Costo unitario<input name="costo_unitario" type="number" min="0" step="0.01" required /></label>
      {error && <div className="error-box">{error}</div>}
      <button type="submit" className="btn btn-primary btn-block" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Agregar al inventario'}</button>
    </form>
  );
}

function PersonalizedOrderForm({ error, isSaving, onSubmit }) {
  const fechaMinima = new Date().toISOString().slice(0, 10);

  return (
    <form className="dialog-form" onSubmit={(event) => {
      event.preventDefault();
      const datos = new FormData(event.currentTarget);
      onSubmit({
        ocasion: datos.get('ocasion'),
        descripcion: datos.get('descripcion'),
        presupuesto: datos.get('presupuesto'),
        fechaEntrega: datos.get('fechaEntrega'),
        destinatario: datos.get('destinatario')
      });
    }}>
      <label>
        Ocasión
        <select name="ocasion" defaultValue="cumpleanos" required>
          <option value="cumpleanos">Cumpleaños</option>
          <option value="aniversario">Aniversario</option>
          <option value="agradecimiento">Agradecimiento</option>
          <option value="condolencias">Condolencias</option>
          <option value="otra">Otra ocasión</option>
        </select>
      </label>
      <label>
        Flores, colores y estilo que prefieres
        <textarea name="descripcion" rows="4" maxLength="600" placeholder="Cuéntanos cómo imaginas tu ramo..." required />
      </label>
      <div className="dialog-fields-row">
        <label>Presupuesto (opcional)<input name="presupuesto" type="number" min="1" step="0.01" placeholder="$" /></label>
        <label>Fecha de entrega<input name="fechaEntrega" type="date" min={fechaMinima} required /></label>
      </div>
      <label>Nombre del destinatario<input name="destinatario" autoComplete="name" required /></label>
      {error && <div className="error-box">{error}</div>}
      <button type="submit" className="btn btn-primary btn-block" disabled={isSaving}>{isSaving ? 'Enviando...' : 'Enviar solicitud'}</button>
    </form>
  );
}

function PersonalizedOrderSuccess({ solicitud, onViewOrders }) {
  return (
    <div className="request-success">
      <p>Recibimos tu idea y prepararemos una cotización.</p>
      <div><span>Número de solicitud</span><strong>{solicitud.codigo}</strong></div>
      <div><span>Entrega solicitada</span><strong>{solicitud.fecha_entrega}</strong></div>
      <button type="button" className="btn btn-primary btn-block" onClick={onViewOrders}>Ver mis pedidos</button>
    </div>
  );
}

export default App;
