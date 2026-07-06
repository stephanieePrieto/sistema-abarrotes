// ================= CONFIGURACIÓN DE SUPABASE =================
const SUPABASE_URL = "https://rcglovsyrzrdjecbhgmf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZ2xvdnN5cnpyZGplY2JoZ21mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTk5MjksImV4cCI6MjA5ODkzNTkyOX0.Q2YAqZu2sxNnERXw7LPOzDttnZ8dgStinyWafDK--y4";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables globales para la memoria del sistema
let todosLosProductos = [];
let graficaInstancia = null;

// ================= INICIALIZACIÓN DE LA APLICACIÓN =================
window.addEventListener('DOMContentLoaded', () => {
    console.log("Conexión con Supabase configurada correctamente.");
    inicializarGrafica();
    cargarProductos(); 
    cargarFinanzas(); 
    configurarBuscadores();
    cargarHistorial(); // Trae las bitácoras al abrir el sistema
});

// ================= TRAER PRODUCTOS DESDE BASE DE DATOS =================
async function cargarProductos() {
    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });

    if (error) {
        console.error("Error al cargar productos:", error);
        return;
    }

    todosLosProductos = data;
    renderizarTabla(todosLosProductos);
    actualizarSelectVentas(todosLosProductos);
    actualizarTarjetasReporte(todosLosProductos);
}

// ================= MOSTRAR LOS PRODUCTOS EN LA TABLA =================
function renderizarTabla(listaProductos) {
    const tbody = document.getElementById('tablaProductos');
    tbody.innerHTML = ''; 

    if (listaProductos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">No hay productos registrados</td></tr>`;
        return;
    }

    listaProductos.forEach(prod => {
        const esStockBajo = prod.stock < 3;
        const claseFila = esStockBajo ? 'table-danger text-danger' : '';
        const alertaIcono = esStockBajo ? '<i class="bi bi-exclamation-triangle-fill me-1"></i>' : '';

        tbody.innerHTML += `
            <tr class="${claseFila}">
                <td><b>${prod.nombre}</b></td>
                <td><span class="badge bg-secondary">${prod.categoria}</span></td>
                <td>$${parseFloat(prod.precio_compra).toFixed(2)}</td>
                <td>$${parseFloat(prod.precio_venta).toFixed(2)}</td>
                <td class="${esStockBajo ? 'fw-bold' : ''}">${alertaIcono}${prod.stock} pzas</td>
                <td class="text-center">
                    <button class="btn btn-sm ${esStockBajo ? 'btn-danger' : 'btn-warning text-white'} me-1" onclick="cargarDatosEditar(${prod.id})" title="Editar"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger me-1" onclick="eliminarProducto(${prod.id}, '${prod.nombre}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                    <button class="btn btn-sm btn-info text-white fw-bold" onclick="abrirModalReabastecer(${prod.id})" title="Reabastecer"><i class="bi bi-truck me-1"></i> Reabastecer</button>
                </td>
            </tr>
        `;
    });
}

// ================= GUARDAR / ACTUALIZAR PRODUCTOS =================
async function guardarProducto(event) {
    event.preventDefault(); 

    const id = document.getElementById('productoId').value;
    const nombre = document.getElementById('pNombre').value;
    const categoria = document.getElementById('pCategoria').value;
    const precio_compra = parseFloat(document.getElementById('pCosto').value);
    const precio_venta = parseFloat(document.getElementById('pPrecio').value);
    const stock = parseInt(document.getElementById('pStock').value);

    let resultado;

    if (id) {
        resultado = await supabaseClient
            .from('productos')
            .update({ nombre, categoria, precio_compra, precio_venta, stock })
            .eq('id', id);
    } else {
        resultado = await supabaseClient
            .from('productos')
            .insert([{ nombre, categoria, precio_compra, precio_venta, stock }]);
    }

    if (resultado.error) {
        alert("Hubo un error al guardar el producto.");
    } else {
        alert("¡Producto guardado con éxito!");
        document.getElementById('formAgregar').reset();
        document.getElementById('productoId').value = '';
        document.getElementById('modalAgregarTitle').innerHTML = '<i class="bi bi-plus-circle me-2"></i>Nuevo Producto';
        
        bootstrap.Modal.getInstance(document.getElementById('modalAgregar')).hide();
        cargarProductos();
        cargarFinanzas();
    }
}

// ================= CARGAR DATOS AL MODAL PARA EDITAR =================
function cargarDatosEditar(id) {
    const prod = todosLosProductos.find(p => p.id === id);
    if (!prod) return;

    document.getElementById('productoId').value = prod.id;
    document.getElementById('pNombre').value = prod.nombre;
    document.getElementById('pCategoria').value = prod.categoria;
    document.getElementById('pCosto').value = prod.precio_compra;
    document.getElementById('pPrecio').value = prod.precio_venta;
    document.getElementById('pStock').value = prod.stock;

    document.getElementById('modalAgregarTitle').innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Producto';

    const modal = new bootstrap.Modal(document.getElementById('modalAgregar'));
    modal.show();
}

// ================= ELIMINAR UN PRODUCTO =================
async function eliminarProducto(id, nombre) {
    const confirmar = confirm(`¿Estás seguro de que deseas eliminar "${nombre}"?\nEsta acción no se puede deshacer.`);
    if (!confirmar) return;

    const { error } = await supabaseClient
        .from('productos')
        .delete()
        .eq('id', id);

    if (error) {
        alert("No se pudo eliminar el producto.");
    } else {
        alert("Producto eliminado correctamente.");
        cargarProductos();
        cargarFinanzas();
    }
}

// ================= REABASTECER (AUTOMATIZACIÓN DE EGRESOS) =================
function abrirModalReabastecer(id) {
    document.getElementById('reabastecerProductoId').value = id;
    document.getElementById('cantidadReabastecer').value = '';
    const modal = new bootstrap.Modal(document.getElementById('modalReabastecer'));
    modal.show();
}

async function aplicarReabastecimiento(event) {
    event.preventDefault();
    const id = parseInt(document.getElementById('reabastecerProductoId').value);
    const cantidadNueva = parseInt(document.getElementById('cantidadReabastecer').value);

    const prod = todosLosProductos.find(p => p.id === id);
    if (!prod) return;

    const nuevoStock = prod.stock + cantidadNueva;
    const gastoTotal = cantidadNueva * prod.precio_compra;

    const updateRes = await supabaseClient
        .from('productos')
        .update({ stock: nuevoStock })
        .eq('id', id);

    const egresoRes = await supabaseClient
        .from('egresos')
        .insert([{ 
            producto_id: id, 
            producto_nombre: prod.nombre, 
            cantidad: cantidadNueva, 
            total: gastoTotal 
        }]);

    if (updateRes.error || egresoRes.error) {
        alert("Ocurrió un error al procesar el reabastecimiento.");
    } else {
        alert(`¡Entrada aplicada al inventario!`);
        bootstrap.Modal.getInstance(document.getElementById('modalReabastecer')).hide();
        cargarProductos();
        cargarFinanzas();
        cargarHistorial();
    }
}

// ================= PROCESAR VENTA (INGRESOS) =================
async function registrarVenta() {
    const id = parseInt(document.getElementById('selectProductoVenta').value);
    const cantidad = parseInt(document.getElementById('cantidadVenta').value);

    if (!id || cantidad <= 0) {
        alert("Por favor, selecciona un producto.");
        return;
    }

    const prod = todosLosProductos.find(p => p.id === id);
    if (!prod) return;

    if (prod.stock < cantidad) {
        alert(`No hay suficiente stock. Solo te quedan ${prod.stock} piezas.`);
        return;
    }

    const nuevoStock = prod.stock - cantidad;
    const totalVenta = cantidad * prod.precio_venta;

    const updateRes = await supabaseClient
        .from('productos')
        .update({ stock: nuevoStock })
        .eq('id', id);

    const ingresoRes = await supabaseClient
        .from('ingresos')
        .insert([{ 
            producto_id: id, 
            producto_nombre: prod.nombre, 
            cantidad: cantidad, 
            total: totalVenta 
        }]);

    if (updateRes.error || ingresoRes.error) {
        alert("Hubo un error al procesar la venta.");
    } else {
        alert(`¡Venta procesada con éxito!\nCobrar: $${totalVenta.toFixed(2)}`);
        document.getElementById('selectProductoVenta').value = '';
        document.getElementById('cantidadVenta').value = '1';
        document.getElementById('buscadorVenta').value = ''; 
        cargarProductos();
        cargarFinanzas();
        cargarHistorial();
    }
}

// ================= CONFIGURAR LOS FILTROS Y EL NUEVO BUSCADOR DE VENTAS =================
function configurarBuscadores() {
    const buscadorInv = document.getElementById('buscador');
    const filtroCat = document.getElementById('filtroCategoria');
    const buscadorVenta = document.getElementById('buscadorVenta');

    // Lógica para el buscador de inventario habitual
    const procesarFiltrosInventario = () => {
        const texto = buscadorInv.value.toLowerCase();
        const catSeleccionada = filtroCat.value;

        const filtered = todosLosProductos.filter(prod => {
            const cumpleNombre = prod.nombre.toLowerCase().includes(texto);
            const cumpleCategoria = catSeleccionada === "" || prod.categoria === catSeleccionada;
            return cumpleNombre && cumpleCategoria;
        });
        renderizarTabla(filtered);
    };

    // NUEVO: Lógica para filtrar el selector de cobro dinámicamente
    const procesarBuscadorVenta = () => {
        const texto = buscadorVenta.value.toLowerCase();
        const filtrados = todosLosProductos.filter(p => p.nombre.toLowerCase().includes(texto));
        actualizarSelectVentas(filtrados);
    };

    buscadorInv.addEventListener('input', procesarFiltrosInventario);
    filtroCat.addEventListener('change', procesarFiltrosInventario);
    buscadorVenta.addEventListener('input', procesarBuscadorVenta);
}

// ================= MOSTRAR HISTORIAL DETALLADO DE MOVIMIENTOS =================
async function cargarHistorial() {
    const tbody = document.getElementById('tablaHistorial');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Cargando movimientos...</td></tr>`;

    // 1. Obtener los últimos 20 ingresos y egresos
    const { data: listaIngresos } = await supabaseClient.from('ingresos').select('*').order('created_at', { ascending: false }).limit(20);
    const { data: listaEgresos } = await supabaseClient.from('egresos').select('*').order('created_at', { ascending: false }).limit(20);

    let movimientosUnificados = [];

    // Formatear ingresos (Ventas)
    if (listaIngresos) {
        listaIngresos.forEach(i => {
            movimientosUnificados.push({
                fechaRaw: new Date(i.created_at),
                fecha: new Date(i.created_at).toLocaleString('es-MX'),
                tipo: '<span class="badge bg-success"><i class="bi bi-arrow-up-right me-1"></i>Venta (Ingreso)</span>',
                producto: i.producto_nombre,
                cantidad: `${i.cantidad} pzas`,
                total: `+$${parseFloat(i.total).toFixed(2)}`
            });
        });
    }

    // Formatear egresos (Compras/Surtido)
    if (listaEgresos) {
        listaEgresos.forEach(e => {
            movimientosUnificados.push({
                fechaRaw: new Date(e.created_at),
                fecha: new Date(e.created_at).toLocaleString('es-MX'),
                tipo: '<span class="badge bg-info text-dark"><i class="bi bi-truck me-1"></i>Surtido (Egreso)</span>',
                producto: e.producto_nombre,
                cantidad: `${e.cantidad} pzas`,
                total: `-$${parseFloat(e.total).toFixed(2)}`
            });
        });
    }

    // Ordenar cronológicamente para ver lo más nuevo primero
    movimientosUnificados.sort((a, b) => b.fechaRaw - a.fechaRaw);

    tbody.innerHTML = '';
    if (movimientosUnificados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No se registran movimientos recientes hoy</td></tr>`;
        return;
    }

    movimientosUnificados.forEach(mov => {
        tbody.innerHTML += `
            <tr>
                <td><small class="text-muted">${mov.fecha}</small></td>
                <td>${mov.tipo}</td>
                <td><b>${mov.producto}</b></td>
                <td>${mov.cantidad}</td>
                <td class="fw-bold">${mov.total}</td>
            </tr>
        `;
    });
}

// ================= CARGAR FINANZAS Y PROCESAR TARJETAS/GRÁFICAS =================
async function cargarFinanzas() {
    const hoy = new Date().toISOString().split('T')[0];
    const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const { data: ventasHoy } = await supabaseClient.from('ingresos').select('total').eq('fecha', hoy);
    const { data: ventasMes } = await supabaseClient.from('ingresos').select('total, fecha').gte('fecha', primerDiaMes);
    const { data: egresosMes } = await supabaseClient.from('egresos').select('total').gte('fecha', primerDiaMes);

    const totalVentasDia = (ventasHoy || []).reduce((sum, item) => sum + parseFloat(item.total), 0);
    const totalVentasMes = (ventasMes || []).reduce((sum, item) => sum + parseFloat(item.total), 0);
    const totalEgresosMes = (egresosMes || []).reduce((sum, item) => sum + parseFloat(item.total), 0);
    
    const gananciaNetaMes = totalVentasMes - totalEgresosMes;

    document.getElementById('ventasDia').innerText = `$${totalVentasDia.toFixed(2)}`;
    document.getElementById('gananciaMes').innerText = `$${gananciaNetaMes.toFixed(2)}`;

    actualizarGraficaVentasReal(ventasMes || []);
}

function actualizarGraficaVentasReal(ventas) {
    const ventasPorDia = {};
    ventas.forEach(v => {
        ventasPorDia[v.fecha] = (ventasPorDia[v.fecha] || 0) + parseFloat(v.total);
    });

    const fechasOrdenadas = Object.keys(ventasPorDia).sort();
    const montosOrdenados = fechasOrdenadas.map(f => ventasPorDia[f]);

    if (fechasOrdenadas.length === 0) {
        graficaInstancia.data.labels = ['Sin ventas'];
        graficaInstancia.data.datasets[0].data = [0];
    } else {
        const labelsAmigables = fechasOrdenadas.map(f => {
            const parts = f.split('-');
            return `${parts[2]}/${parts[1]}`;
        });
        graficaInstancia.data.labels = labelsAmigables;
        graficaInstancia.data.datasets[0].data = montosOrdenados;
    }
    graficaInstancia.update();
}

function actualizarSelectVentas(listaProductos) {
    const select = document.getElementById('selectProductoVenta');
    select.innerHTML = '<option value="">-- Elige un producto --</option>';
    listaProductos.forEach(prod => {
        select.innerHTML += `<option value="${prod.id}">${prod.nombre} ($${parseFloat(prod.precio_venta).toFixed(2)})</option>`;
    });
}

function actualizarTarjetasReporte(listaProductos) {
    const alertas = listaProductos.filter(prod => prod.stock < 3).length;
    document.getElementById('productosAlerta').innerText = alertas;
}

function inicializarGrafica() {
    const ctx = document.getElementById('graficaVentas').getContext('2d');
    graficaInstancia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Sin datos'],
            datasets: [{
                label: 'Ventas por Día ($)',
                data: [0],
                borderColor: '#0d6efd',
                tension: 0.2,
                fill: true,
                backgroundColor: 'rgba(13, 110, 253, 0.05)'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}