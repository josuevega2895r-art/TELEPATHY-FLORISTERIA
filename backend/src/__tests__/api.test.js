const request = require('supertest');
const app = require('../app');

describe('API de Telephaty', () => {
  test('GET /api/salud responde ok', async () => {
    const response = await request(app).get('/api/salud');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  test('POST /api/auth/login con credenciales válidas responde token', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'admin@telephaty.com', contrasena: '12345678' });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.usuario.rol).toBe('administrador');
  });

  test('POST /api/auth/registro guarda el teléfono con prefijo +503', async () => {
    const response = await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Cliente',
        apellidos: 'Salvadoreño',
        telefono: '+50371234567',
        correo: `cliente-${Date.now()}@telephaty.test`,
        contrasena: 'ClaveSegura123'
      });

    expect(response.status).toBe(201);
    expect(response.body.usuario.rol).toBe('cliente');
  });

  test('POST /api/auth/registro rechaza números sin código +503', async () => {
    const response = await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Cliente',
        apellidos: 'Prueba',
        telefono: '71234567',
        correo: `sin-prefijo-${Date.now()}@telephaty.test`,
        contrasena: 'ClaveSegura123'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('+503');
  });

  test('GET /api/categorias responde lista', async () => {
    const response = await request(app).get('/api/categorias');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('POST /api/pedidos crea un pedido y GET /api/pedidos lo devuelve', async () => {
    const sesion = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'admin@telephaty.com', contrasena: '12345678' });
    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${sesion.body.token}`)
      .send({
        idRamo: 1,
        cantidad: 2,
        compradorNombre: 'Cliente de prueba',
        fechaEntrega: '2030-06-15',
        horaEntrega: '14:00',
        destinatario: 'Cliente de prueba',
        telefono: '55512345',
        direccion: 'Calle de prueba 10',
        metodoPago: 'efectivo'
      });

    expect(response.status).toBe(201);
    expect(response.body.pedido.total).toBe(60.6);
    expect(response.body.factura).toMatchObject({
      numeroFactura: `FAC-${response.body.pedido.id_pedido}`,
      codigoPedido: response.body.pedido.codigo,
      codigoProducto: 'RAM-001',
      nombreProducto: 'Ramo de Amor',
      precioUnitario: 32,
      cantidad: 2,
      fechaEntrega: '2030-06-15',
      metodoPago: 'efectivo',
      compradorNombre: 'Cliente de prueba',
      compradorCorreo: 'admin@telephaty.com',
      total: 60.6
    });

    const lista = await request(app)
      .get('/api/pedidos')
      .set('Authorization', `Bearer ${sesion.body.token}`);
    expect(lista.status).toBe(200);
    const pedidoGuardado = lista.body.find((pedido) => pedido.id_pedido === response.body.pedido.id_pedido);
    expect(pedidoGuardado).toBeTruthy();
    expect(pedidoGuardado.factura).toMatchObject({
      codigoPedido: response.body.pedido.codigo,
      codigoProducto: 'RAM-001',
      compradorCorreo: 'admin@telephaty.com'
    });
  });

  test('POST /api/pedidos/personalizados crea una solicitud visible en Mis pedidos', async () => {
    const correo = `ramo-${Date.now()}@telephaty.test`;
    const registro = await request(app)
      .post('/api/auth/registro')
      .send({ nombre: 'Cliente', apellidos: 'Ramo', telefono: '+50371234567', correo, contrasena: 'ClaveSegura123' });
    const solicitud = await request(app)
      .post('/api/pedidos/personalizados')
      .set('Authorization', `Bearer ${registro.body.token}`)
      .send({
        compradorNombre: 'Cliente Ramo',
        ocasion: 'aniversario',
        descripcion: 'Rosas blancas con follaje verde.',
        presupuesto: 45,
        fechaEntrega: '2030-06-15',
        destinatario: 'Persona Destinataria'
      });

    expect(solicitud.status).toBe(201);
    expect(solicitud.body.solicitud).toMatchObject({
      codigo: expect.stringMatching(/^PER-/),
      producto: 'Ramo personalizado · aniversario',
      descripcion: 'Rosas blancas con follaje verde.',
      fecha_entrega: '2030-06-15',
      presupuesto: 45,
      estado: 'Solicitud recibida',
      tipo: 'personalizado'
    });

    const misPedidos = await request(app)
      .get('/api/pedidos')
      .set('Authorization', `Bearer ${registro.body.token}`);
    expect(misPedidos.status).toBe(200);
    expect(misPedidos.body.some((pedido) => pedido.codigo === solicitud.body.solicitud.codigo)).toBe(true);
  });

  test('PATCH /api/inventario actualiza el stock', async () => {
    const sesion = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'admin@telephaty.com', contrasena: '12345678' });
    const response = await request(app)
      .patch('/api/inventario/1')
      .set('Authorization', `Bearer ${sesion.body.token}`)
      .send({ stock: 18 });

    expect(response.status).toBe(200);
    expect(response.body.flor.stock).toBe(18);
  });

  test('POST /api/ramos crea productos en el catálogo local', async () => {
    const sesion = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'admin@telephaty.com', contrasena: '12345678' });
    const codigo = `TEST-${Date.now()}`;
    const response = await request(app)
      .post('/api/ramos')
      .set('Authorization', `Bearer ${sesion.body.token}`)
      .send({ nombre: 'Producto de prueba', codigo, precio: 25 });

    expect(response.status).toBe(201);
    expect(response.body.ramo.codigo).toBe(codigo);
  });

  test('Las nuevas rutas protegen recursos y acciones administrativas', async () => {
    const cliente = await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Cliente',
        apellidos: 'Permisos',
        telefono: '+50371234567',
        correo: `permisos-${Date.now()}@telephaty.test`,
        contrasena: 'ClaveSegura123'
      });

    const sinSesion = await request(app).get('/api/zonas');
    expect(sinSesion.status).toBe(401);

    const restringido = await request(app)
      .get('/api/flores')
      .set('Authorization', `Bearer ${cliente.body.token}`);
    expect(restringido.status).toBe(403);
  });

  test('POST /api/pedidos rechaza entregas fuera del horario permitido', async () => {
    const sesion = await request(app)
      .post('/api/auth/login')
      .send({ correo: 'admin@telephaty.com', contrasena: '12345678' });
    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${sesion.body.token}`)
      .send({
        idRamo: 1,
        cantidad: 1,
        fechaEntrega: '2030-06-15',
        horaEntrega: '21:00',
        destinatario: 'Cliente',
        telefono: '55512345',
        direccion: 'Calle de prueba',
        metodoPago: 'efectivo'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('08:00 y 20:00');
  });

  test('POST /api/pedidos aplica el máximo de cinco pedidos activos por cliente', async () => {
    const registro = await request(app)
      .post('/api/auth/registro')
      .send({
        nombre: 'Cliente',
        apellidos: 'Pedidos',
        telefono: '+50371234567',
        correo: `limite-${Date.now()}@telephaty.test`,
        contrasena: 'ClaveSegura123'
      });
    const datosPedido = {
      idRamo: 1,
      cantidad: 1,
      fechaEntrega: '2030-06-15',
      horaEntrega: '14:00',
      destinatario: 'Persona Destinataria',
      telefono: '55512345',
      direccion: 'Calle de prueba',
      metodoPago: 'efectivo'
    };

    for (let indice = 0; indice < 5; indice += 1) {
      const pedido = await request(app)
        .post('/api/pedidos')
        .set('Authorization', `Bearer ${registro.body.token}`)
        .send(datosPedido);
      expect(pedido.status).toBe(201);
      if (indice === 0) expect(pedido.body.pedido.descuento).toBe(3.2);
      if (indice > 0) expect(pedido.body.pedido.descuento).toBe(0);
    }

    const sexto = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${registro.body.token}`)
      .send(datosPedido);
    expect(sexto.status).toBe(409);
    expect(sexto.body.error).toContain('5 pedidos activos');
  });
});
