import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import theme from '../shared/theme';
import { fnValidarFechaEntrega } from '../shared/validations';

const API_URL = String(Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/**
 * Nombre: fnSolicitarApi
 * Descripcion: Ejecuta una solicitud JSON autenticada al backend común.
 * Funcionamiento: Añade el JWT guardado de forma segura, convierte respuestas y propaga errores HTTP.
 * Retorna: Los datos JSON de la API.
 */
async function fnSolicitarApi(ruta, opciones = {}, token) {
  if (!API_URL) throw new Error('Configura API_URL con la dirección pública de la API Railway.');
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: ['Bearer', token].join(' ') } : {}),
      ...opciones.headers
    }
  });
  const contenido = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(contenido.error || 'No se pudo completar la solicitud.');
  return contenido;
}

/**
 * Nombre: fnFormatoDinero
 * Descripcion: Presenta un importe en dólares estadounidenses.
 * Funcionamiento: Formatea el valor con dos decimales usando la configuración regional salvadoreña.
 * Retorna: El importe formateado.
 */
function fnFormatoDinero(valor) {
  return `$${Number(valor || 0).toFixed(2)}`;
}

/**
 * Nombre: fnBoton
 * Descripcion: Renderiza una acción táctil con el color primario del sistema.
 * Funcionamiento: Muestra estados de presión y permite deshabilitar la acción durante una solicitud.
 * Retorna: Un componente Pressable.
 */
function fnBoton({ titulo, onPress, secundario = false, disabled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [estilos.boton, secundario && estilos.botonSecundario, pressed && estilos.presionado, disabled && estilos.deshabilitado]}
    >
      <Text style={[estilos.textoBoton, secundario && estilos.textoBotonSecundario]}>{titulo}</Text>
    </Pressable>
  );
}

/**
 * Nombre: fnCampo
 * Descripcion: Renderiza un campo nativo accesible con etiqueta visible.
 * Funcionamiento: Reenvía las propiedades del campo y usa la paleta común.
 * Retorna: Un componente View con TextInput.
 */
function fnCampo({ etiqueta, valor, onChangeText, secureTextEntry = false, keyboardType = 'default', placeholder = '', multiline = false, ...props }) {
  const [mostrarTexto, setMostrarTexto] = useState(false);
  return (
    <View style={estilos.campoGrupo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <View style={secureTextEntry ? estilos.campoSecreto : null}>
        <TextInput
          accessibilityLabel={etiqueta}
          value={valor}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !mostrarTexto}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textoSecundario}
          multiline={multiline}
          style={[estilos.campo, secureTextEntry && estilos.campoSecretoEntrada, multiline && estilos.campoMultilinea]}
          {...props}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mostrarTexto ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            accessibilityState={{ selected: mostrarTexto }}
            onPress={() => setMostrarTexto((visible) => !visible)}
            style={estilos.campoSecretoBoton}
          >
            <Text style={estilos.campoSecretoTexto}>{mostrarTexto ? 'Ocultar' : 'Mostrar'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * Nombre: fnMensaje
 * Descripcion: Presenta mensajes de error, carga o estado vacío.
 * Funcionamiento: Mantiene el texto dentro del viewport y utiliza el color de error cuando aplica.
 * Retorna: Un componente de texto o indicador de carga.
 */
function fnMensaje({ texto, error = false, cargando = false }) {
  if (cargando) return <ActivityIndicator color={theme.colors.primario} style={estilos.carga} />;
  if (!texto) return null;
  return <Text accessibilityRole={error ? 'alert' : 'text'} style={[estilos.mensaje, error && estilos.error]}>{texto}</Text>;
}

/**
 * Nombre: fnIniciarAplicacion
 * Descripcion: Muestra autenticación y el área correspondiente al rol.
 * Funcionamiento: Restaura la sesión con SecureStore y distribuye al usuario en la navegación móvil.
 * Retorna: El árbol principal de navegación.
 */
export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activa = true;
    SecureStore.getItemAsync('telephaty_token')
      .then(async (token) => {
        if (!token) return;
        const usuarioGuardado = await SecureStore.getItemAsync('telephaty_user');
        if (activa && usuarioGuardado) setSesion({ token, usuario: JSON.parse(usuarioGuardado) });
      })
      .catch((error) => console.error('No se pudo restaurar la sesión móvil:', error.message))
      .finally(() => { if (activa) setCargando(false); });
    return () => { activa = false; };
  }, []);

  /**
   * Nombre: fnGuardarSesion
   * Descripcion: Persiste el token y perfil devueltos por la autenticación.
   * Funcionamiento: Guarda ambos valores en SecureStore y actualiza la sesión visible.
   * Retorna: Una promesa resuelta al terminar el guardado.
   */
  const fnGuardarSesion = async (resultado) => {
    const usuario = resultado.usuario;
    await SecureStore.setItemAsync('telephaty_token', resultado.token);
    await SecureStore.setItemAsync('telephaty_user', JSON.stringify(usuario));
    setSesion({ token: resultado.token, usuario });
  };

  /**
   * Nombre: fnCerrarSesion
   * Descripcion: Elimina las credenciales guardadas en el dispositivo.
   * Funcionamiento: Borra token y perfil antes de volver a la pantalla de acceso.
   * Retorna: Una promesa resuelta al limpiar el almacenamiento.
   */
  const fnCerrarSesion = async () => {
    await SecureStore.deleteItemAsync('telephaty_token');
    await SecureStore.deleteItemAsync('telephaty_user');
    setSesion(null);
  };

  if (cargando) return <SafeAreaView style={estilos.centrado}><ActivityIndicator color={theme.colors.primario} /></SafeAreaView>;

  return (
    <SafeAreaView style={estilos.contenedor}>
      <StatusBar style="dark" />
      {sesion ? (
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.colors.fondo }, headerTintColor: theme.colors.primario, headerTitleStyle: estilos.tituloNavegacion }}>
            <Stack.Screen name="Inicio" options={{ headerShown: false }}>
              {(props) => <FnPestanas {...props} sesion={sesion} onLogout={fnCerrarSesion} />}
            </Stack.Screen>
            <Stack.Screen name="NuevoPedido" options={{ title: 'Nuevo pedido', presentation: 'modal' }}>
              {(props) => <FnPantallaPedido {...props} sesion={sesion} />}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      ) : <FnPantallaAcceso onSuccess={fnGuardarSesion} />}
    </SafeAreaView>
  );
}

/**
 * Nombre: fnPestanas
 * Descripcion: Configura la navegación inferior según el rol autenticado.
 * Funcionamiento: Presenta las pestañas de cliente o administrador y un acceso central para nuevo pedido.
 * Retorna: Un navegador de pestañas.
 */
function fnPestanas({ sesion, onLogout }) {
  const administrador = sesion.usuario.rol === 'administrador';
  return (
    <Tab.Navigator screenOptions={{
      headerStyle: { backgroundColor: theme.colors.fondo },
      headerTintColor: theme.colors.primario,
      tabBarActiveTintColor: theme.colors.rosaPetalo,
      tabBarInactiveTintColor: theme.colors.textoSecundario,
      tabBarStyle: estilos.barraPestanas,
      tabBarLabelStyle: estilos.etiquetaPestana
    }}>
      <Tab.Screen name="Inicio" options={{ title: 'Inicio', tabBarLabel: 'Inicio' }}>
        {(props) => <FnPantallaInicio {...props} sesion={sesion} />}
      </Tab.Screen>
      {administrador ? (
        <>
          <Tab.Screen name="Pedidos" options={{ tabBarLabel: 'Pedidos' }}>
            {(props) => <FnPantallaPedidos {...props} sesion={sesion} />}
          </Tab.Screen>
          <Tab.Screen name="Nuevo" options={{ tabBarLabel: 'Nuevo pedido', tabBarButton: (props) => <Pressable {...props} accessibilityRole="button" onPress={() => props.onPress?.()} style={estilos.fab}><Text style={estilos.pestanaNueva}>✿</Text></Pressable> }}>
            {(props) => <FnPantallaPedido {...props} sesion={sesion} />}
          </Tab.Screen>
          <Tab.Screen name="Inventario">
            {(props) => <FnPantallaInventario {...props} sesion={sesion} />}
          </Tab.Screen>
          <Tab.Screen name="Reportes">
            {(props) => <FnPantallaReportes {...props} sesion={sesion} />}
          </Tab.Screen>
        </>
      ) : (
        <>
          <Tab.Screen name="Catálogo">
            {(props) => <FnPantallaCatalogo {...props} sesion={sesion} />}
          </Tab.Screen>
          <Tab.Screen name="NuevoPedido" options={{ title: 'Nuevo pedido', tabBarLabel: 'Pedir' }}>
            {(props) => <FnPantallaPedido {...props} sesion={sesion} />}
          </Tab.Screen>
          <Tab.Screen name="MisPedidos" options={{ title: 'Mis pedidos', tabBarLabel: 'Mis pedidos' }}>
            {(props) => <FnPantallaPedidos {...props} sesion={sesion} />}
          </Tab.Screen>
        </>
      )}
      {!administrador && <Tab.Screen name="Perfil" options={{ tabBarLabel: 'Perfil' }}>
        {(props) => <FnPantallaPerfil {...props} sesion={sesion} onLogout={onLogout} />}
      </Tab.Screen>}
    </Tab.Navigator>
  );
}

/**
 * Nombre: fnPantallaAcceso
 * Descripcion: Permite iniciar sesión o registrar una cuenta cliente.
 * Funcionamiento: Envía credenciales al backend y guarda la sesión recibida.
 * Retorna: La pantalla de autenticación.
 */
function fnPantallaAcceso({ onSuccess }) {
  const [registroActivo, setRegistroActivo] = useState(false);
  const [campos, setCampos] = useState({ correo: '', contrasena: '', nombre: '', apellidos: '', telefono: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  /**
   * Nombre: fnEnviarAcceso
   * Descripcion: Envía el formulario de acceso o registro.
   * Funcionamiento: Comprueba campos requeridos, llama al endpoint correspondiente y muestra errores.
   * Retorna: Una promesa resuelta al completar la operación.
   */
  const fnEnviarAcceso = async () => {
    setError('');
    setCargando(true);
    try {
      const datos = registroActivo
        ? { ...campos, telefono: `+503${campos.telefono.replace(/\D/g, '')}` }
        : { correo: campos.correo, contrasena: campos.contrasena };
      const resultado = await fnSolicitarApi(registroActivo ? '/auth/registro' : '/auth/login', {
        method: 'POST',
        body: JSON.stringify(datos)
      });
      await onSuccess(resultado);
    } catch (solicitudError) {
      setError(solicitudError.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={estilos.authScroll} keyboardShouldPersistTaps="handled">
      <View style={estilos.authTarjeta}>
        <Text style={estilos.miniEtiqueta}>FLORISTERÍA</Text>
        <Text style={estilos.titulo}>Telephaty</Text>
        <Text style={estilos.subtitulo}>{registroActivo ? 'Crea tu cuenta para realizar pedidos.' : 'Flores para cada momento especial.'}</Text>
        {registroActivo && <>
          <FnCampo etiqueta="Nombre" valor={campos.nombre} onChangeText={(nombre) => setCampos((actual) => ({ ...actual, nombre }))} />
          <FnCampo etiqueta="Apellidos" valor={campos.apellidos} onChangeText={(apellidos) => setCampos((actual) => ({ ...actual, apellidos }))} />
          <FnCampo etiqueta="Teléfono +503" valor={campos.telefono} onChangeText={(telefono) => setCampos((actual) => ({ ...actual, telefono: telefono.replace(/\D/g, '').slice(0, 8) }))} keyboardType="phone-pad" maxLength={8} />
        </>}
        <FnCampo etiqueta="Correo" valor={campos.correo} onChangeText={(correo) => setCampos((actual) => ({ ...actual, correo }))} keyboardType="email-address" autoCapitalize="none" />
        <FnCampo etiqueta="Contraseña" valor={campos.contrasena} onChangeText={(contrasena) => setCampos((actual) => ({ ...actual, contrasena }))} secureTextEntry />
        <FnMensaje texto={error} error />
        <FnBoton titulo={cargando ? 'Conectando...' : registroActivo ? 'Crear cuenta' : 'Iniciar sesión'} onPress={fnEnviarAcceso} disabled={cargando} />
        <Pressable onPress={() => { setError(''); setRegistroActivo((actual) => !actual); }}>
          <Text style={estilos.enlace}>{registroActivo ? '¿Ya tienes cuenta? Inicia sesión' : 'Crear una cuenta nueva'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/**
 * Nombre: fnPantallaInicio
 * Descripcion: Presenta el resumen de actividad del usuario.
 * Funcionamiento: Carga pedidos y, para administradores, inventario de flores para mostrar métricas principales.
 * Retorna: La pantalla de inicio.
 */
function fnPantallaInicio({ navigation, sesion }) {
  const [pedidos, setPedidos] = useState([]);
  const [flores, setFlores] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const administrador = sesion.usuario.rol === 'administrador';

  useEffect(() => {
    Promise.all([
      fnSolicitarApi('/pedidos', {}, sesion.token),
      administrador ? fnSolicitarApi('/flores', {}, sesion.token) : Promise.resolve([])
    ]).then(([listaPedidos, listaFlores]) => {
      setPedidos(listaPedidos);
      setFlores(listaFlores);
    }).catch((cargaError) => setError(cargaError.message)).finally(() => setCargando(false));
  }, [administrador, sesion.token]);

  const bajoStock = flores.filter((flor) => Number(flor.stock) <= Number(flor.stock_minimo)).length;
  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={estilos.miniEtiqueta}>{administrador ? 'PANEL DE GESTIÓN' : 'BIENVENIDO/A'}</Text>
      <Text style={estilos.titulo}>{administrador ? 'Resumen de hoy' : `Hola, ${sesion.usuario.nombre || 'cliente'}`}</Text>
      <FnMensaje texto={error} error />
      {cargando ? <FnMensaje cargando /> : (
        <View style={estilos.tarjetasMetrica}>
          <View style={estilos.tarjetaMetrica}><Text style={estilos.numeroMetrica}>{pedidos.length}</Text><Text style={estilos.etiqueta}>Pedidos</Text></View>
          {administrador && <View style={estilos.tarjetaMetrica}><Text style={estilos.numeroMetrica}>{bajoStock}</Text><Text style={estilos.etiqueta}>Alertas de stock</Text></View>}
        </View>
      )}
      {fnBoton({ titulo: administrador ? 'Revisar pedidos' : 'Ver mis pedidos', onPress: () => navigation.navigate(administrador ? 'Pedidos' : 'MisPedidos') })}
      {!administrador && fnBoton({ titulo: 'Explorar catálogo', secundario: true, onPress: () => navigation.navigate('Catálogo') })}
      {administrador && fnBoton({ titulo: 'Crear pedido', secundario: true, onPress: () => navigation.getParent()?.navigate('NuevoPedido') })}
    </ScrollView>
  );
}

/**
 * Nombre: fnPantallaCatalogo
 * Descripcion: Muestra el catálogo de ramos con sus precios y disponibilidad.
 * Funcionamiento: Consulta la API, adapta las tarjetas al ancho del dispositivo y permite iniciar un pedido.
 * Retorna: La pantalla del catálogo.
 */
function fnPantallaCatalogo({ navigation, sesion }) {
  const [ramos, setRamos] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const { width } = useWindowDimensions();

  const fnCargarRamos = useCallback(() => {
    setCargando(true);
    fnSolicitarApi('/ramos')
      .then(setRamos)
      .catch((cargaError) => setError(cargaError.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { fnCargarRamos(); }, [fnCargarRamos]);

  return (
    <View style={estilos.flex}>
      <FnMensaje texto={error} error />
      {cargando ? <FnMensaje cargando /> : (
        <FlatList
          data={ramos}
          key={width < 380 ? 'mobile-compact' : 'mobile-wide'}
          numColumns={2}
          keyExtractor={(item) => String(item.id_ramo)}
          contentContainerStyle={estilos.listaCatalogo}
          columnWrapperStyle={estilos.filaCatalogo}
          renderItem={({ item }) => (
            <View style={[estilos.tarjetaRamo, width < 380 && estilos.tarjetaRamoCompacta]}>
              {item.imagen ? <Image source={{ uri: item.imagen }} style={estilos.fotoRamo} /> : <View style={estilos.fotoVacia}><Text>✿</Text></View>}
              <Text style={estilos.nombreRamo} numberOfLines={2}>{item.nombre}</Text>
              <Text style={estilos.precioRamo}>{fnFormatoDinero(item.precio)}</Text>
              {item.disponible === false && <Text style={estilos.aviso}>Agotado temporalmente</Text>}
              {fnBoton({ titulo: 'Pedir', disabled: item.disponible === false, onPress: () => navigation.getParent()?.navigate('NuevoPedido', { idRamo: item.id_ramo }) })}
            </View>
          )}
          ListEmptyComponent={<Text style={estilos.textoVacio}>No hay ramos disponibles.</Text>}
        />
      )}
    </View>
  );
}

/**
 * Nombre: fnPantallaPedidos
 * Descripcion: Lista el historial de pedidos y solicitudes del usuario.
 * Funcionamiento: Consulta los pedidos autenticados y permite refrescar la lista.
 * Retorna: Una pantalla con tarjetas de pedidos.
 */
function fnPantallaPedidos({ sesion }) {
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const fnCargarPedidos = useCallback(() => {
    setCargando(true);
    fnSolicitarApi('/pedidos', {}, sesion.token)
      .then(setPedidos)
      .catch((cargaError) => setError(cargaError.message))
      .finally(() => setCargando(false));
  }, [sesion.token]);

  useEffect(() => { fnCargarPedidos(); }, [fnCargarPedidos]);

  /**
   * Nombre: fnSolicitarCancelacion
   * Descripcion: Confirma con el cliente antes de cancelar un pedido pendiente.
   * Funcionamiento: Muestra una alerta nativa y llama la ruta de cancelación tras confirmar.
   * Retorna: Nada; el resultado se refleja al recargar la lista.
   */
  const fnSolicitarCancelacion = (pedido) => {
    Alert.alert('Cancelar pedido', `¿Deseas cancelar ${pedido.codigo || `PED-${pedido.id_pedido}`}?`, [
      { text: 'Conservar pedido', style: 'cancel' },
      {
        text: 'Cancelar pedido',
        style: 'destructive',
        onPress: async () => {
          try {
            await fnSolicitarApi(`/pedidos/${pedido.id_pedido}/cancelar`, { method: 'PATCH' }, sesion.token);
            fnCargarPedidos();
          } catch (solicitudError) {
            setError(solicitudError.message);
          }
        }
      }
    ]);
  };

  return (
    <FlatList
      data={pedidos}
      onRefresh={fnCargarPedidos}
      refreshing={cargando}
      keyExtractor={(item) => String(item.id_pedido)}
      contentContainerStyle={estilos.contenidoLista}
      ListHeaderComponent={<FnMensaje texto={error} error />}
      ListEmptyComponent={!cargando ? <Text style={estilos.textoVacio}>Aún no tienes pedidos.</Text> : null}
      renderItem={({ item }) => (
        <View style={estilos.tarjetaPedido}>
          <View style={estilos.filaSeparada}>
            <Text style={estilos.nombreRamo}>{item.codigo || `PED-${item.id_pedido}`}</Text>
            <Text style={estilos.estadoPedido}>{item.estado}</Text>
          </View>
          <Text style={estilos.textoSecundario}>{item.producto || item.descripcion || 'Pedido'}</Text>
          <View style={estilos.filaSeparada}>
            <Text style={estilos.textoSecundario}>{item.fecha_entrega}</Text>
            <Text style={estilos.precioRamo}>{fnFormatoDinero(item.total)}</Text>
          </View>
          {sesion.usuario.rol === 'cliente' && ['P', 'Pendiente'].includes(item.estado)
            && <FnBoton titulo="Cancelar pedido" secundario onPress={() => fnSolicitarCancelacion(item)} />}
        </View>
      )}
    />
  );
}

/**
 * Nombre: fnPantallaPedido
 * Descripcion: Registra un pedido de un ramo del catálogo.
 * Funcionamiento: Valida la fecha y hora, envía entrega y pago al backend y presenta la respuesta.
 * Retorna: La pantalla de creación de pedidos.
 */
function fnPantallaPedido({ navigation, route, sesion }) {
  const [campos, setCampos] = useState({
    idRamo: String(route?.params?.idRamo || ''),
    cantidad: '1',
    fechaEntrega: '',
    horaEntrega: '',
    destinatario: '',
    telefono: '',
    direccion: '',
    dedicatoria: '',
    metodoPago: 'efectivo'
  });
  const [tipoEntrega, setTipoEntrega] = useState('domicilio');
  const [idZona, setIdZona] = useState(1);
  const [mensaje, setMensaje] = useState('');
  const [esError, setEsError] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (route?.params?.idRamo) setCampos((actual) => ({ ...actual, idRamo: String(route.params.idRamo) }));
  }, [route?.params?.idRamo]);

  /**
   * Nombre: fnConfirmarPedido
   * Descripcion: Envía el pedido y recibe el código de seguimiento.
   * Funcionamiento: Valida datos requeridos, ejecuta POST /pedidos y muestra el identificador de factura.
   * Retorna: Una promesa que finaliza al recibir la respuesta del backend.
   */
  const fnConfirmarPedido = async () => {
    setMensaje('');
    setEsError(false);
    if (!campos.idRamo || !campos.fechaEntrega || !campos.horaEntrega || !campos.destinatario || !campos.telefono
      || (tipoEntrega === 'domicilio' && !campos.direccion)) {
      setEsError(true);
      setMensaje('Completa ramo, fecha, hora, destinatario y datos de entrega.');
      return;
    }
    if (!fnValidarFechaEntrega(campos.fechaEntrega, campos.horaEntrega)) {
      setEsError(true);
      setMensaje('La entrega debe programarse con al menos 2 horas de anticipación, entre 08:00 y 20:00.');
      return;
    }
    setGuardando(true);
    try {
      const resultado = await fnSolicitarApi('/pedidos', {
        method: 'POST',
        body: JSON.stringify({
          ...campos,
          cantidad: Number(campos.cantidad),
          tipoEntrega,
          idZona: tipoEntrega === 'domicilio' ? idZona : undefined
        })
      }, sesion.token);
      setMensaje(`Pedido ${resultado.pedido.codigo} confirmado. Total: ${fnFormatoDinero(resultado.factura.total)}`);
      setCampos((actual) => ({ ...actual, idRamo: '', cantidad: '1' }));
    } catch (solicitudError) {
      setEsError(true);
      setMensaje(solicitudError.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      <Text style={estilos.titulo}>Detalles del pedido</Text>
      <FnCampo etiqueta="ID del ramo" valor={campos.idRamo} onChangeText={(idRamo) => setCampos((actual) => ({ ...actual, idRamo }))} keyboardType="number-pad" />
      <FnCampo etiqueta="Cantidad" valor={campos.cantidad} onChangeText={(cantidad) => setCampos((actual) => ({ ...actual, cantidad: cantidad.replace(/\D/g, '') }))} keyboardType="number-pad" />
      <FnCampo etiqueta="Fecha de entrega (AAAA-MM-DD)" valor={campos.fechaEntrega} onChangeText={(fechaEntrega) => setCampos((actual) => ({ ...actual, fechaEntrega }))} placeholder="2030-06-15" />
      <FnCampo etiqueta="Hora de entrega (HH:MM)" valor={campos.horaEntrega} onChangeText={(horaEntrega) => setCampos((actual) => ({ ...actual, horaEntrega }))} placeholder="14:00" />
      <FnCampo etiqueta="Destinatario" valor={campos.destinatario} onChangeText={(destinatario) => setCampos((actual) => ({ ...actual, destinatario }))} />
      <FnCampo etiqueta="Teléfono" valor={campos.telefono} onChangeText={(telefono) => setCampos((actual) => ({ ...actual, telefono }))} keyboardType="phone-pad" />
      <Text style={estilos.etiqueta}>Tipo de entrega</Text>
      <View style={estilos.filaOpciones}>
        {['domicilio', 'tienda'].map((tipo) => <Pressable key={tipo} onPress={() => setTipoEntrega(tipo)} style={[estilos.opcion, tipoEntrega === tipo && estilos.opcionActiva]}><Text style={estilos.textoOpcion}>{tipo === 'tienda' ? 'Retiro en tienda' : 'A domicilio'}</Text></Pressable>)}
      </View>
      {tipoEntrega === 'domicilio' && <>
        <Text style={estilos.etiqueta}>Zona: {idZona === 1 ? 'San Salvador ($3)' : 'Área metropolitana ($5)'}</Text>
        <FnBoton titulo="Cambiar zona" secundario onPress={() => setIdZona((actual) => actual === 1 ? 2 : 1)} />
        <FnCampo etiqueta="Dirección" valor={campos.direccion} onChangeText={(direccion) => setCampos((actual) => ({ ...actual, direccion }))} />
      </>}
      <Text style={estilos.etiqueta}>Método de pago</Text>
      <View style={estilos.filaOpciones}>
        {['efectivo', 'transferencia', 'tarjeta'].map((metodo) => <Pressable key={metodo} onPress={() => setCampos((actual) => ({ ...actual, metodoPago: metodo }))} style={[estilos.opcion, campos.metodoPago === metodo && estilos.opcionActiva]}><Text style={estilos.textoOpcion}>{metodo}</Text></Pressable>)}
      </View>
      <FnCampo etiqueta="Dedicatoria (opcional)" valor={campos.dedicatoria} onChangeText={(dedicatoria) => setCampos((actual) => ({ ...actual, dedicatoria }))} multiline />
      <FnMensaje texto={mensaje} error={esError} />
      {fnBoton({ titulo: guardando ? 'Enviando...' : 'Confirmar pedido', disabled: guardando, onPress: fnConfirmarPedido })}
      <Pressable onPress={() => navigation.goBack()}><Text style={estilos.enlace}>Cerrar</Text></Pressable>
    </ScrollView>
  );
}

/**
 * Nombre: fnPantallaInventario
 * Descripcion: Consulta el inventario de flores para la administración.
 * Funcionamiento: Carga el inventario desde el endpoint protegido y permite actualizar existencias.
 * Retorna: Una lista de flores con su nivel de stock.
 */
function fnPantallaInventario({ sesion }) {
  const [flores, setFlores] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const fnCargarFlores = useCallback(() => {
    setCargando(true);
    fnSolicitarApi('/flores', {}, sesion.token)
      .then(setFlores)
      .catch((cargaError) => setError(cargaError.message))
      .finally(() => setCargando(false));
  }, [sesion.token]);

  useEffect(() => { fnCargarFlores(); }, [fnCargarFlores]);
  return (
    <FlatList
      data={flores}
      onRefresh={fnCargarFlores}
      refreshing={cargando}
      keyExtractor={(item) => String(item.id_flor)}
      contentContainerStyle={estilos.contenidoLista}
      ListHeaderComponent={<FnMensaje texto={error} error />}
      renderItem={({ item }) => (
        <View style={estilos.tarjetaPedido}>
          <View style={estilos.filaSeparada}>
            <Text style={estilos.nombreRamo}>{item.nombre}</Text>
            <Text style={Number(item.stock) <= Number(item.stock_minimo) ? estilos.aviso : estilos.estadoPedido}>{item.stock} {item.unidad}</Text>
          </View>
          <Text style={estilos.textoSecundario}>Mínimo: {item.stock_minimo}</Text>
        </View>
      )}
    />
  );
}

/**
 * Nombre: fnPantallaReportes
 * Descripcion: Presenta los ramos más vendidos al administrador.
 * Funcionamiento: Consulta el reporte protegido y lo muestra en tarjetas nativas.
 * Retorna: Una pantalla de reporte resumido.
 */
function fnPantallaReportes({ sesion }) {
  const [ramos, setRamos] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    fnSolicitarApi('/reportes/top-ramos', {}, sesion.token)
      .then(setRamos)
      .catch((cargaError) => setError(cargaError.message));
  }, [sesion.token]);
  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={estilos.titulo}>Ramos más vendidos</Text>
      <FnMensaje texto={error} error />
      {ramos.map((ramo) => <View style={estilos.tarjetaPedido} key={ramo.id_ramo}><Text style={estilos.nombreRamo}>{ramo.nombre}</Text><Text style={estilos.textoSecundario}>{ramo.unidades} vendidos · {fnFormatoDinero(ramo.ventas)}</Text></View>)}
    </ScrollView>
  );
}

/**
 * Nombre: fnPantallaPerfil
 * Descripcion: Muestra la cuenta actual y la acción para cerrar sesión.
 * Funcionamiento: Lee el perfil autenticado y borra la sesión del dispositivo al salir.
 * Retorna: La pantalla de perfil.
 */
function fnPantallaPerfil({ sesion, onLogout }) {
  const [fechas, setFechas] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState('');
  const [diasAviso, setDiasAviso] = useState('7');
  const [error, setError] = useState('');

  const fnCargarPerfil = useCallback(async () => {
    try {
      const listaAvisos = await fnSolicitarApi('/notificaciones', {}, sesion.token);
      setNotificaciones(listaAvisos);
      if (sesion.usuario.rol === 'cliente') {
        setFechas(await fnSolicitarApi('/fechas-especiales', {}, sesion.token));
      }
    } catch (cargaError) {
      setError(cargaError.message);
    }
  }, [sesion.token, sesion.usuario.rol]);

  useEffect(() => { fnCargarPerfil(); }, [fnCargarPerfil]);

  /**
   * Nombre: fnGuardarFechaEspecial
   * Descripcion: Guarda un recordatorio de fecha especial para el cliente.
   * Funcionamiento: Valida los campos mínimos, envía la fecha a la API y actualiza la lista del perfil.
   * Retorna: Una promesa resuelta al finalizar el guardado.
   */
  const fnGuardarFechaEspecial = async () => {
    setError('');
    try {
      await fnSolicitarApi('/fechas-especiales', {
        method: 'POST',
        body: JSON.stringify({ descripcion, fecha, diasAviso: Number(diasAviso) })
      }, sesion.token);
      setDescripcion('');
      setFecha('');
      await fnCargarPerfil();
    } catch (solicitudError) {
      setError(solicitudError.message);
    }
  };

  /**
   * Nombre: fnMarcarAvisoLeido
   * Descripcion: Marca como leída una notificación del usuario.
   * Funcionamiento: Envía la acción autenticada y vuelve a cargar los avisos.
   * Retorna: Una promesa resuelta al actualizar la lista.
   */
  const fnMarcarAvisoLeido = async (id) => {
    try {
      await fnSolicitarApi(`/notificaciones/${id}/leida`, { method: 'PATCH' }, sesion.token);
      await fnCargarPerfil();
    } catch (solicitudError) {
      setError(solicitudError.message);
    }
  };

  /**
   * Nombre: fnEliminarFechaEspecial
   * Descripcion: Elimina un recordatorio propio de fecha especial.
   * Funcionamiento: Ejecuta DELETE con el JWT de la sesión y actualiza la lista.
   * Retorna: Una promesa resuelta al finalizar la eliminación.
   */
  const fnEliminarFechaEspecial = async (id) => {
    try {
      await fnSolicitarApi(`/fechas-especiales/${id}`, { method: 'DELETE' }, sesion.token);
      await fnCargarPerfil();
    } catch (solicitudError) {
      setError(solicitudError.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <Text style={estilos.titulo}>Mi perfil</Text>
      <View style={estilos.tarjetaPedido}>
        <Text style={estilos.nombreRamo}>{sesion.usuario.nombre} {sesion.usuario.apellidos || ''}</Text>
        <Text style={estilos.textoSecundario}>{sesion.usuario.correo}</Text>
        <Text style={estilos.textoSecundario}>{sesion.usuario.rol}</Text>
      </View>
      <FnMensaje texto={error} error />
      {sesion.usuario.rol === 'cliente' && <>
        <Text style={estilos.tituloSeccion}>Fechas especiales</Text>
        <FnCampo etiqueta="Descripción" valor={descripcion} onChangeText={setDescripcion} />
        <FnCampo etiqueta="Fecha (AAAA-MM-DD)" valor={fecha} onChangeText={setFecha} placeholder="2030-06-15" />
        <FnCampo etiqueta="Días de aviso" valor={diasAviso} onChangeText={setDiasAviso} keyboardType="number-pad" />
        {fnBoton({ titulo: 'Guardar fecha', onPress: fnGuardarFechaEspecial })}
        {fechas.map((item) => (
          <View style={estilos.tarjetaPedido} key={item.id_fecha}>
            <View style={estilos.filaSeparada}><Text style={estilos.nombreRamo}>{item.descripcion}</Text><Pressable onPress={() => fnEliminarFechaEspecial(item.id_fecha)}><Text style={estilos.enlace}>Eliminar</Text></Pressable></View>
            <Text style={estilos.textoSecundario}>{String(item.fecha).slice(0, 10)} · avisar {item.dias_aviso} días antes</Text>
          </View>
        ))}
      </>}
      <Text style={estilos.tituloSeccion}>Notificaciones</Text>
      {notificaciones.map((item) => (
        <Pressable key={item.id_notificacion} disabled={Boolean(item.leida)} onPress={() => fnMarcarAvisoLeido(item.id_notificacion)} style={estilos.tarjetaPedido}>
          <Text style={estilos.texto}>{item.mensaje}</Text>
          <Text style={estilos.textoSecundario}>{item.leida ? 'Leída' : 'Toca para marcar como leída'}</Text>
        </Pressable>
      ))}
      {fnBoton({ titulo: 'Cerrar sesión', secundario: true, onPress: onLogout })}
    </ScrollView>
  );
}

const FnPestanas = fnPestanas;
const FnPantallaPedido = fnPantallaPedido;
const FnPantallaAcceso = fnPantallaAcceso;
const FnPantallaInicio = fnPantallaInicio;
const FnPantallaCatalogo = fnPantallaCatalogo;
const FnPantallaPedidos = fnPantallaPedidos;
const FnPantallaInventario = fnPantallaInventario;
const FnPantallaReportes = fnPantallaReportes;
const FnPantallaPerfil = fnPantallaPerfil;
const FnCampo = fnCampo;
const FnMensaje = fnMensaje;
const FnBoton = fnBoton;

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  contenedor: { flex: 1, backgroundColor: theme.colors.fondo },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.fondo },
  authScroll: { flexGrow: 1, justifyContent: 'center', padding: 22, backgroundColor: theme.colors.fondo },
  authTarjeta: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, gap: 8, elevation: 3 },
  contenido: { padding: 20, paddingBottom: 36, gap: 14 },
  contenidoLista: { padding: 16, paddingBottom: 30, gap: 12, flexGrow: 1 },
  listaCatalogo: { padding: 10, paddingBottom: 24 },
  filaCatalogo: { justifyContent: 'space-between' },
  titulo: { fontSize: 26, lineHeight: 32, color: theme.colors.primarioOscuro, fontFamily: 'Georgia', fontWeight: '700' },
  tituloNavegacion: { color: theme.colors.primario, fontFamily: 'Georgia', fontWeight: '700' },
  subtitulo: { fontSize: 15, color: theme.colors.textoSecundario, marginBottom: 12 },
  tituloSeccion: { fontSize: 19, color: theme.colors.primario, fontFamily: 'Georgia', fontWeight: '700', marginTop: 10 },
  miniEtiqueta: { color: theme.colors.rosaPetalo, fontSize: 11, letterSpacing: 1.6, fontWeight: '700' },
  campoGrupo: { gap: 6, marginVertical: 3 },
  etiqueta: { color: theme.colors.texto, fontSize: 13, fontWeight: '700', marginTop: 6 },
  campo: { minHeight: 46, borderColor: '#E8DCD7', borderWidth: 1, borderRadius: 13, backgroundColor: '#FFFFFF', paddingHorizontal: 13, color: theme.colors.texto, fontSize: 15 },
  campoSecreto: { justifyContent: 'center' },
  campoSecretoEntrada: { paddingRight: 82 },
  campoSecretoBoton: { position: 'absolute', right: 8, minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  campoSecretoTexto: { color: theme.colors.primario, fontSize: 12, fontWeight: '700' },
  campoMultilinea: { minHeight: 82, textAlignVertical: 'top', paddingTop: 12 },
  boton: { minHeight: 46, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.colors.primario, alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  botonSecundario: { backgroundColor: theme.colors.fondoSecundario },
  textoBoton: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  textoBotonSecundario: { color: theme.colors.primario },
  presionado: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  deshabilitado: { opacity: 0.55 },
  enlace: { textAlign: 'center', padding: 10, color: theme.colors.primario, fontWeight: '700' },
  mensaje: { color: theme.colors.textoSecundario, paddingVertical: 8 },
  error: { color: theme.colors.error },
  carga: { padding: 28 },
  tarjetasMetrica: { flexDirection: 'row', gap: 12 },
  tarjetaMetrica: { flex: 1, minHeight: 100, borderRadius: 18, backgroundColor: '#FFFFFF', padding: 16, justifyContent: 'center' },
  numeroMetrica: { color: theme.colors.primario, fontSize: 28, fontWeight: '700' },
  etiquetaPestana: { fontSize: 10 },
  barraPestanas: { height: 62, paddingBottom: 5, paddingTop: 5, borderTopColor: '#E8DCD7', backgroundColor: '#FFFFFF' },
  fab: { position: 'relative', top: -16, alignSelf: 'center', width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.rosaPetalo, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  pestanaNueva: { color: '#FFFFFF', fontSize: 27 },
  tarjetaRamo: { flex: 1, maxWidth: '49%', margin: 4, padding: 10, borderRadius: 18, backgroundColor: '#FFFFFF', gap: 6 },
  tarjetaRamoCompacta: { padding: 7 },
  fotoRamo: { width: '100%', aspectRatio: 0.8, borderRadius: 14, backgroundColor: theme.colors.fondoSecundario },
  fotoVacia: { width: '100%', aspectRatio: 0.8, borderRadius: 14, backgroundColor: theme.colors.fondoSecundario, alignItems: 'center', justifyContent: 'center' },
  nombreRamo: { color: theme.colors.texto, fontSize: 15, fontWeight: '700' },
  precioRamo: { color: theme.colors.primario, fontWeight: '700', fontSize: 15 },
  textoSecundario: { color: theme.colors.textoSecundario, fontSize: 13, marginVertical: 3 },
  texto: { color: theme.colors.texto, fontSize: 14 },
  aviso: { color: theme.colors.error, fontSize: 12, fontWeight: '700' },
  textoVacio: { textAlign: 'center', color: theme.colors.textoSecundario, padding: 30 },
  tarjetaPedido: { borderRadius: 18, backgroundColor: '#FFFFFF', padding: 16, gap: 6 },
  filaSeparada: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  estadoPedido: { color: theme.colors.exito, fontWeight: '700', fontSize: 12 },
  filaOpciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  opcion: { borderColor: '#E8DCD7', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  opcionActiva: { borderColor: theme.colors.rosaPetalo, backgroundColor: '#FCEBF0' },
  textoOpcion: { color: theme.colors.texto, fontSize: 12, textTransform: 'capitalize' }
});
