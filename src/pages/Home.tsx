import React, { useState, useEffect } from 'react';
import { IonContent, IonPage, IonToast } from '@ionic/react';
import { 
  Package, ArrowDownToLine, ArrowUpFromLine, BarChart3, 
  CalendarDays, Plus, Play, AlertCircle, Search, Filter, TrendingUp, TrendingDown, DollarSign, Tags
} from 'lucide-react';

// Firebase
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Interfaces de TypeScript
interface ItemInventario {
  id: string;
  nombre: string;
  categoria?: string; // NUEVA CATEGORÍA
  cantidad: number;
  valor: number; 
  precioMenudeo?: number; 
  precioMayoreo?: number; 
  fechaLlegada: string;
}

interface ItemVenta {
  id: string;
  productId: string;
  qtySold: number;
  date: string;
  tipoVenta: 'unidad' | 'mayoreo';
  cobroTotal: number; 
}

interface ItemMerma {
  id: string;
  productId: string;
  qtyDefective: number;
  date: string;
}

interface AbcItem extends ItemInventario {
  sold: number;
  percentage: string;
  cumulative: string;
  usageValue: number;
}

interface AbcResult {
  A: AbcItem[];
  B: AbcItem[];
  C: AbcItem[];
  total: number;
}

const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState('recepcion');
  
  // Estados de Bases de Datos
  const [inventario, setInventario] = useState<ItemInventario[]>([]);
  const [ventas, setVentas] = useState<ItemVenta[]>([]);
  const [mermas, setMermas] = useState<ItemMerma[]>([]);

  // Estados de Formularios Recepción
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState(''); // Estado para la categoría
  const [cantidad, setCantidad] = useState('');
  const [precioCompra, setPrecioCompra] = useState(''); 
  const [precioMenudeo, setPrecioMenudeo] = useState(''); 
  const [precioMayoreoInv, setPrecioMayoreoInv] = useState(''); 
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  
  // Estados de Formularios Salidas
  const [motivoSalida, setMotivoSalida] = useState<'venta' | 'merma'>('venta');
  const [ventaCategoriaFiltro, setVentaCategoriaFiltro] = useState(''); // Filtro de Categoría
  const [ventaProductId, setVentaProductId] = useState('');
  const [ventaQty, setVentaQty] = useState('');
  const [ventaFecha, setVentaFecha] = useState(new Date().toISOString().split('T')[0]);
  const [tipoVenta, setTipoVenta] = useState<'unidad' | 'mayoreo'>('unidad'); 

  // Estados de Análisis y Temporada
  const [abcResult, setAbcResult] = useState<AbcResult | null>(null);
  const [seasonFilter, setSeasonFilter] = useState('semana'); 
  const [seasonDate, setSeasonDate] = useState(new Date().toISOString().split('T')[0]);

  // UI
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Efecto: Cargar datos
  useEffect(() => {
    const invQ = query(collection(db, 'inventario'), orderBy('createdAt', 'desc'));
    const unsubInv = onSnapshot(invQ, (snapshot) => {
      const items: ItemInventario[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as ItemInventario));
      setInventario(items);
    });

    const ventQ = query(collection(db, 'ventas'), orderBy('createdAt', 'desc'));
    const unsubVent = onSnapshot(ventQ, (snapshot) => {
      const items: ItemVenta[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as ItemVenta));
      setVentas(items);
    });

    const mermaQ = query(collection(db, 'mermas'), orderBy('createdAt', 'desc'));
    const unsubMerma = onSnapshot(mermaQ, (snapshot) => {
      const items: ItemMerma[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as ItemMerma));
      setMermas(items);
    });

    return () => { unsubInv(); unsubVent(); unsubMerma(); };
  }, []);

  // Función Guardar Mercancía 
  const guardarMercancia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !cantidad || !precioCompra || !precioMenudeo || !precioMayoreoInv || !fecha || !categoria) return;
    try {
      await addDoc(collection(db, 'inventario'), {
        nombre,
        categoria, // Se guarda la categoría
        cantidad: parseInt(cantidad),
        valor: parseFloat(precioCompra), 
        precioMenudeo: parseFloat(precioMenudeo), 
        precioMayoreo: parseFloat(precioMayoreoInv), 
        fechaLlegada: fecha,
        createdAt: serverTimestamp()
      });

      setNombre(''); setCategoria(''); setCantidad(''); setPrecioCompra(''); setPrecioMenudeo(''); setPrecioMayoreoInv(''); setFecha(new Date().toISOString().split('T')[0]);
      setToastMessage("¡Mercancía registrada con éxito!");
      setShowToast(true);
    } catch (error) {
      console.error(error);
    }
  };

  // Función Guardar Salidas
  const guardarSalida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ventaProductId || !ventaQty || !ventaFecha) return;
    
    try {
      if (motivoSalida === 'merma') {
        await addDoc(collection(db, 'mermas'), {
          productId: ventaProductId,
          qtyDefective: parseInt(ventaQty),
          date: ventaFecha,
          createdAt: serverTimestamp()
        });
        setToastMessage("¡Merma registrada (Descontado del stock)!");
      } else {
        let cobroFinal = 0;
        const prodSeleccionado = inventario.find(p => p.id === ventaProductId);
        
        if (tipoVenta === 'unidad') {
          const precioVenta = prodSeleccionado?.precioMenudeo || prodSeleccionado?.valor || 0;
          cobroFinal = parseInt(ventaQty) * precioVenta;
        } else {
          const precioMayoreoBD = prodSeleccionado?.precioMayoreo || prodSeleccionado?.precioMenudeo || prodSeleccionado?.valor || 0;
          cobroFinal = parseInt(ventaQty) * precioMayoreoBD;
        }

        await addDoc(collection(db, 'ventas'), {
          productId: ventaProductId,
          qtySold: parseInt(ventaQty),
          date: ventaFecha,
          tipoVenta: tipoVenta,
          cobroTotal: cobroFinal,
          createdAt: serverTimestamp()
        });
        setToastMessage("¡Venta registrada con éxito!");
      }

      setVentaProductId(''); setVentaQty(''); setVentaFecha(new Date().toISOString().split('T')[0]);
      setTipoVenta('unidad');
      setShowToast(true);
      setAbcResult(null); 
    } catch (error) {
      console.error(error);
    }
  };

  // Lógica Filtrado de Stock para Vistas
  const inventarioConStockVisual = inventario.map(item => {
    const vTotales = ventas.filter(v => v.productId === item.id).reduce((s, v) => s + v.qtySold, 0);
    const mTotales = mermas.filter(m => m.productId === item.id).reduce((s, m) => s + m.qtyDefective, 0);
    return { ...item, stockReal: item.cantidad - vTotales - mTotales };
  });

  // Solo productos que tengan al menos 1 pieza en stock
  const productosDisponibles = inventarioConStockVisual.filter(item => item.stockReal > 0);
  
  // Extraer las categorías únicas que actualmente tienen stock
  const categoriasUnicas = Array.from(new Set(productosDisponibles.map(i => i.categoria || 'General')));

  // Aplicar el filtro seleccionado por el usuario en Salidas
  const productosFiltradosParaSalida = ventaCategoriaFiltro 
    ? productosDisponibles.filter(i => (i.categoria || 'General') === ventaCategoriaFiltro)
    : productosDisponibles;


  // Función Calcular ABC
  const calculateABC = () => {
    const salesByProduct: Record<string, number> = {};
    ventas.forEach(sale => {
      salesByProduct[sale.productId] = (salesByProduct[sale.productId] || 0) + sale.qtySold;
    });

    let totalGlobalValue = 0;
    const productsWithValue = inventario.map(prod => {
      const sold = salesByProduct[prod.id] || 0;
      const precioVenta = prod.precioMenudeo || prod.valor || 0;
      const usageValue = sold * precioVenta; 
      totalGlobalValue += usageValue;
      return { ...prod, sold, usageValue } as AbcItem; 
    });

    productsWithValue.sort((a, b) => b.usageValue - a.usageValue);

    let cumulativeValue = 0;
    const result: AbcResult = { A: [], B: [], C: [], total: totalGlobalValue };

    productsWithValue.forEach(prod => {
      if (totalGlobalValue === 0) { 
        result.C.push({ ...prod, percentage: '0.00', cumulative: '0.00' }); 
        return; 
      }
      
      cumulativeValue += prod.usageValue;
      const cumulativePercentage = (cumulativeValue / totalGlobalValue) * 100;
      const currentItemPercentage = (prod.usageValue / totalGlobalValue) * 100;
      const enrichedProd = { ...prod, percentage: currentItemPercentage.toFixed(2), cumulative: cumulativePercentage.toFixed(2) };

      if (cumulativePercentage <= 80) result.A.push(enrichedProd);
      else if (cumulativePercentage <= 95) result.B.push(enrichedProd);
      else result.C.push(enrichedProd);
    });
    setAbcResult(result);
  };

  // LÓGICA DE TEMPORADA Y GRÁFICAS
  const getSeasonDataAndChart = () => {
    if (!seasonDate) return { groupedData: [], chartLabels: [], chartPoints: [], summary: { ingresos: 0, mermas: 0, costo: 0 } };
    const [tYear, tMonth, tDay] = seasonDate.split('-').map(Number);
    const targetDateObj = new Date(tYear, tMonth - 1, tDay);

    const getWeek = (date: Date) => {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
      return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    };

    const targetWeek = getWeek(targetDateObj);

    const filteredSales = ventas.filter(sale => {
      const [y, m, d] = sale.date.split('-').map(Number);
      const sDate = new Date(y, m - 1, d);
      switch (seasonFilter) {
        case 'dia': return sDate.getFullYear() === tYear && sDate.getMonth() === tMonth - 1 && sDate.getDate() === tDay;
        case 'semana': return sDate.getFullYear() === tYear && getWeek(sDate) === targetWeek;
        case 'mes': return sDate.getFullYear() === tYear && sDate.getMonth() === tMonth - 1;
        case 'ano': return sDate.getFullYear() === tYear;
        default: return true;
      }
    });

    const filteredMermas = mermas.filter(merma => {
      const [y, m, d] = merma.date.split('-').map(Number);
      const mDate = new Date(y, m - 1, d);
      switch (seasonFilter) {
        case 'dia': return mDate.getFullYear() === tYear && mDate.getMonth() === tMonth - 1 && mDate.getDate() === tDay;
        case 'semana': return mDate.getFullYear() === tYear && getWeek(mDate) === targetWeek;
        case 'mes': return mDate.getFullYear() === tYear && mDate.getMonth() === tMonth - 1;
        case 'ano': return mDate.getFullYear() === tYear;
        default: return true;
      }
    });

    const grouped: Record<string, { name: string, total: number }> = {};
    filteredSales.forEach(sale => {
      if (!grouped[sale.productId]) {
        const prod = inventario.find(p => p.id === sale.productId);
        grouped[sale.productId] = { name: prod?.nombre || 'Desconocido', total: 0 };
      }
      grouped[sale.productId].total += sale.qtySold;
    });

    let chartLabels: string[] = [];
    if (seasonFilter === 'ano') chartLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    else if (seasonFilter === 'mes') chartLabels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5'];
    else if (seasonFilter === 'semana') chartLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    else chartLabels = ['Turno 1', 'Turno 2', 'Turno 3', 'Turno 4'];

    const chartPoints = chartLabels.map(label => ({ label, ingresos: 0, perdidas: 0 }));
    let sumIngresos = 0; let sumCostoVentas = 0; let sumMermas = 0;

    filteredSales.forEach(sale => {
      const [y, m, d] = sale.date.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const prod = inventario.find(p => p.id === sale.productId);
      const costoUnitario = prod ? prod.valor : 0;

      let idx = 0;
      if (seasonFilter === 'ano') idx = date.getMonth();
      else if (seasonFilter === 'mes') idx = Math.min(Math.floor((date.getDate() - 1) / 7), 4);
      else if (seasonFilter === 'semana') idx = date.getDay();
      else idx = 1; 

      if (sale.cobroTotal !== undefined) {
        chartPoints[idx].ingresos += sale.cobroTotal;
        sumIngresos += sale.cobroTotal;
        sumCostoVentas += (sale.qtySold * costoUnitario);
      }
    });

    filteredMermas.forEach(merma => {
      const [y, m, d] = merma.date.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const prod = inventario.find(p => p.id === merma.productId);
      const costoMerma = prod ? (prod.valor * merma.qtyDefective) : 0;

      let idx = 0;
      if (seasonFilter === 'ano') idx = date.getMonth();
      else if (seasonFilter === 'mes') idx = Math.min(Math.floor((date.getDate() - 1) / 7), 4);
      else if (seasonFilter === 'semana') idx = date.getDay();
      else idx = 1;

      chartPoints[idx].perdidas += costoMerma;
      sumMermas += costoMerma;
    });

    return { 
      groupedData: Object.values(grouped).sort((a, b) => b.total - a.total),
      chartLabels, chartPoints, 
      summary: { ingresos: sumIngresos, mermas: sumMermas, costo: sumCostoVentas }
    };
  };

  const seasonData = getSeasonDataAndChart();
  const maxChartVal = Math.max(...seasonData.chartPoints.map(p => Math.max(p.ingresos, p.perdidas)), 1);

  const historialUnificado = [
    ...ventas.map(v => ({ ...v, tipoHistorial: 'venta' as const })),
    ...mermas.map(m => ({ ...m, tipoHistorial: 'merma' as const }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const inversionTotal = inventario.reduce((acc, item) => {
    const ventasTotales = ventas.filter(v => v.productId === item.id).reduce((sum, v) => sum + v.qtySold, 0);
    const mermasTotales = mermas.filter(m => m.productId === item.id).reduce((sum, m) => sum + m.qtyDefective, 0);
    const stockReal = item.cantidad - ventasTotales - mermasTotales;
    return acc + (stockReal > 0 ? stockReal * item.valor : 0);
  }, 0);

  // ---------- CÁLCULO DE COORDENADAS PARA GRÁFICA ----------
  const svgWidth = 800;
  const svgHeight = 220;
  const paddingX = 40; 
  const activeW = svgWidth - paddingX * 2;
  const activeH = svgHeight - 20; 

  const pointsIngresosStr = seasonData.chartPoints.map((p, i) => {
    const x = paddingX + (i / Math.max(seasonData.chartPoints.length - 1, 1)) * activeW;
    const y = activeH - (p.ingresos / maxChartVal) * activeH;
    return `${x},${y}`;
  }).join(' ');

  const pointsPerdidasStr = seasonData.chartPoints.map((p, i) => {
    const x = paddingX + (i / Math.max(seasonData.chartPoints.length - 1, 1)) * activeW;
    const y = activeH - (p.perdidas / maxChartVal) * activeH;
    return `${x},${y}`;
  }).join(' ');

  const polyIngresosArea = `${pointsIngresosStr} ${svgWidth - paddingX},${activeH} ${paddingX},${activeH}`;
  const polyPerdidasArea = `${pointsPerdidasStr} ${svgWidth - paddingX},${activeH} ${paddingX},${activeH}`;

  return (
    <IonPage>
      <IonContent fullscreen className="relative bg-[#f0f4fb]">
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-[-20%] left-[20%] w-[30rem] h-[30rem] bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        <div className="max-w-6xl mx-auto px-3 md:px-4 py-6 md:py-8 font-sans pb-8">
          
          <div className="flex flex-col items-center mb-6 md:mb-10 space-y-4 md:space-y-6 w-full">
            <div className="flex items-center space-x-3 bg-white/80 md:bg-white/60 backdrop-blur-xl px-6 py-3 rounded-full border border-white/40 shadow-sm w-fit justify-center">
              <Package className="h-6 w-6 md:h-7 md:w-7 text-blue-600 flex-shrink-0" />
              <span className="font-extrabold text-xl md:text-2xl tracking-tight text-slate-800">
                Make<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">ABC</span>
              </span>
            </div>

            <div className="w-full px-1 sm:px-0">
              <nav className="flex justify-between md:justify-center space-x-1 md:space-x-2 bg-white/60 md:bg-white/40 backdrop-blur-md p-1.5 rounded-full border border-white/50 shadow-lg w-full md:w-fit mx-auto">
                <NavButton active={activeTab === 'recepcion'} onClick={() => setActiveTab('recepcion')} icon={<ArrowDownToLine className="w-3.5 h-3.5 md:w-4 md:h-4" />}>Recepción</NavButton>
                <NavButton active={activeTab === 'salidas'} onClick={() => setActiveTab('salidas')} icon={<ArrowUpFromLine className="w-3.5 h-3.5 md:w-4 md:h-4" />}>Salidas</NavButton>
                <NavButton active={activeTab === 'abc'} onClick={() => setActiveTab('abc')} icon={<BarChart3 className="w-3.5 h-3.5 md:w-4 md:h-4" />}>Análisis</NavButton>
                <NavButton active={activeTab === 'temporada'} onClick={() => setActiveTab('temporada')} icon={<CalendarDays className="w-3.5 h-3.5 md:w-4 md:h-4" />}>Temporada</NavButton>
              </nav>
            </div>
          </div>

          {/* VISTA 1: RECEPCIÓN */}
          {activeTab === 'recepcion' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-5 md:space-y-6">
              <div className="bg-white/80 md:bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-5 md:mb-6 flex items-center">
                  <span className="bg-blue-100 text-blue-600 p-2 rounded-xl md:rounded-2xl mr-3"><ArrowDownToLine size={20} className="md:w-6 md:h-6" /></span>
                  Entrada de Mercancía
                </h2>
                
                <form onSubmit={guardarMercancia} className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-6 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Nombre del Producto</label>
                    <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800 text-base" placeholder="Ej. Base Líquida" />
                  </div>
                  
                  {/* NUEVA CASILLA CATEGORÍA */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1 flex items-center">
                      <Tags size={14} className="mr-1 text-slate-400" /> Categoría
                    </label>
                    <input type="text" required value={categoria} onChange={e => setCategoria(e.target.value)} list="lista-categorias" className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800 text-base" placeholder="Ej. Labiales, Rubor..." />
                    {/* Autocompletar con categorías existentes */}
                    <datalist id="lista-categorias">
                      {Array.from(new Set(inventario.map(i => i.categoria).filter(Boolean))).map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Total de Piezas</label>
                    <input type="number" required min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800 text-base" placeholder="0" />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Precio de Compra</label>
                    <input type="number" step="0.01" required min="0" value={precioCompra} onChange={e => setPrecioCompra(e.target.value)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800 text-base" placeholder="$0.00" />
                  </div>

                  {/* SEGUNDA FILA */}
                  <div className="md:col-span-1">
                    <label className="block text-sm font-semibold text-emerald-600 mb-1.5 ml-1">Precio Unitario</label>
                    <input type="number" step="0.01" required min="0" value={precioMenudeo} onChange={e => setPrecioMenudeo(e.target.value)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-emerald-50 border border-emerald-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all shadow-inner text-emerald-800 font-bold text-base" placeholder="$0.00" />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-sm font-semibold text-purple-600 mb-1.5 ml-1">Precio Mayoreo</label>
                    <input type="number" step="0.01" required min="0" value={precioMayoreoInv} onChange={e => setPrecioMayoreoInv(e.target.value)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-purple-50 border border-purple-200 focus:ring-4 focus:ring-purple-100 focus:border-purple-400 outline-none transition-all shadow-inner text-purple-800 font-bold text-base" placeholder="$0.00" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Fecha de Registro</label>
                    <input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800 text-base" />
                  </div>
                  <div className="md:col-span-2 flex justify-end mt-2">
                    <button type="submit" className="w-full md:w-full flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:scale-105 transition-all shadow-lg hover:shadow-blue-500/30 font-bold tracking-wide text-base">
                      <Plus size={20} className="mr-2" /> Registrar
                    </button>
                  </div>
                </form>
              </div>

              {/* TABLA RESPONSIVA DE INVENTARIO */}
              <div className="bg-white/80 md:bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8 overflow-x-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 ml-1 gap-3 min-w-max">
                  <h3 className="text-lg md:text-xl font-bold text-slate-800">Inventario en Almacén</h3>
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50 text-slate-600 px-4 py-2.5 rounded-xl shadow-sm font-bold flex items-center text-sm md:text-base w-full md:w-auto">
                    💰 Inversión Viva en Stock: 
                    <span className="ml-2 text-indigo-600 text-lg">
                      ${inversionTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                
                <div className="w-full">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="hidden md:table-header-group">
                      <tr className="bg-slate-200/50 text-slate-600 text-sm font-bold uppercase tracking-wider rounded-t-2xl">
                        <th className="px-6 py-4 rounded-tl-2xl">Producto</th>
                        <th className="px-6 py-4">Ingresó</th>
                        <th className="px-6 py-4 text-red-500">Mermas</th>
                        <th className="px-6 py-4 text-indigo-600">Stock Actual</th>
                        <th className="px-6 py-4 text-slate-500">P. Compra</th>
                        <th className="px-6 py-4 text-emerald-600">P. Unitario</th>
                        <th className="px-6 py-4 text-purple-600">P. Mayoreo</th>
                        <th className="px-6 py-4 rounded-tr-2xl">Inversión</th>
                      </tr>
                    </thead>
                    <tbody className="flex flex-col gap-4 md:table-row-group md:gap-0">
                      {inventario.length === 0 ? (
                        <tr className="block md:table-row bg-white/50 md:bg-transparent rounded-2xl md:rounded-none"><td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-medium text-sm">Sin inventario registrado</td></tr>
                      ) : (
                        inventario.map(item => {
                          const ventasItem = ventas.filter(v => v.productId === item.id).reduce((sum, v) => sum + v.qtySold, 0);
                          const mermasItem = mermas.filter(m => m.productId === item.id).reduce((sum, m) => sum + m.qtyDefective, 0);
                          const stockActual = item.cantidad - ventasItem - mermasItem;
                          const inversionItem = stockActual > 0 ? stockActual * item.valor : 0;
                          
                          const pMenudeoVisual = item.precioMenudeo || item.valor;
                          const pMayoreoVisual = item.precioMayoreo || item.precioMenudeo || item.valor;

                          return (
                            <tr key={item.id} className="block md:table-row bg-white/70 md:bg-white/40 md:hover:bg-white/60 transition-colors rounded-[1.5rem] md:rounded-none p-4 md:p-0 shadow-sm md:shadow-none border border-white md:border-b md:border-slate-100">
                              <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 font-semibold text-slate-800 text-sm md:text-base border-b border-slate-200/60 md:border-none">
                                <span className="md:hidden text-xs text-slate-500 font-bold uppercase tracking-wider">Producto</span>
                                <div className="text-right md:text-left flex flex-col md:block">
                                  <span className="truncate max-w-[150px] md:max-w-none">{item.nombre}</span>
                                  {/* Mostrar insignia de la categoría */}
                                  <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-md mt-1 inline-block w-fit font-bold uppercase ml-auto md:ml-0 md:block">{item.categoria || 'General'}</span>
                                </div>
                              </td>
                              <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 text-slate-500 text-sm md:text-base border-b border-slate-200/60 md:border-none">
                                <span className="md:hidden text-xs text-slate-500 font-bold uppercase tracking-wider">Ingresó</span>
                                <span className="text-right md:text-left">{item.cantidad.toLocaleString()}</span>
                              </td>
                              <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 text-red-500 font-bold text-sm md:text-base border-b border-slate-200/60 md:border-none">
                                <span className="md:hidden text-xs text-red-400 font-bold uppercase tracking-wider">Mermas</span>
                                <span className="text-right md:text-left">{mermasItem.toLocaleString()}</span>
                              </td>
                              <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 text-indigo-600 font-black text-sm md:text-lg border-b border-slate-200/60 md:border-none bg-indigo-50/30">
                                <span className="md:hidden text-xs text-indigo-500 font-bold uppercase tracking-wider">Stock</span>
                                <span className="text-right md:text-left">{stockActual.toLocaleString()}</span>
                              </td>
                              <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 text-slate-500 text-sm md:text-base border-b border-slate-200/60 md:border-none">
                                <span className="md:hidden text-xs text-slate-500 font-bold uppercase tracking-wider">P. Compra</span>
                                <span className="text-right md:text-left">${item.valor?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                              </td>
                              <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 text-emerald-600 font-bold text-sm md:text-base border-b border-slate-200/60 md:border-none">
                                <span className="md:hidden text-xs text-emerald-500 font-bold uppercase tracking-wider">P. Unitario</span>
                                <span className="text-right md:text-left">${pMenudeoVisual?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                              </td>
                              <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 text-purple-600 font-bold text-sm md:text-base border-b border-slate-200/60 md:border-none">
                                <span className="md:hidden text-xs text-purple-500 font-bold uppercase tracking-wider">P. Mayoreo</span>
                                <span className="text-right md:text-left">${pMayoreoVisual?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                              </td>
                              <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 text-slate-700 font-bold text-sm md:text-base">
                                <span className="md:hidden text-xs text-slate-500 font-bold uppercase tracking-wider">Inversión Actual</span>
                                <span className="text-right md:text-left">${inversionItem.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VISTA 2: SALIDAS Y MERMAS */}
          {activeTab === 'salidas' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-5 md:space-y-6">
              <div className="bg-white/80 md:bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-5 flex items-center">
                  <span className="bg-emerald-100 text-emerald-600 p-2 rounded-xl md:rounded-2xl mr-3"><ArrowUpFromLine size={20} className="md:w-6 md:h-6" /></span>
                  Control de Salidas
                </h2>
                
                <form onSubmit={guardarSalida} className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6 items-end">
                  
                  <div className="md:col-span-5 bg-slate-100/50 p-4 rounded-2xl border border-slate-200 mb-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">¿Qué tipo de movimiento es?</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" value="venta" checked={motivoSalida === 'venta'} onChange={() => setMotivoSalida('venta')} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300" />
                        <span className="text-slate-800 font-semibold">Venta (Ingreso)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" value="merma" checked={motivoSalida === 'merma'} onChange={() => setMotivoSalida('merma')} className="w-4 h-4 text-red-600 focus:ring-red-500 border-slate-300" />
                        <span className="text-red-600 font-semibold">Merma (Pérdida / Defecto)</span>
                      </label>
                    </div>
                  </div>

                  {/* NUEVO FILTRO DE CATEGORÍA */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Filtrar por Categoría</label>
                    <select value={ventaCategoriaFiltro} onChange={e => { setVentaCategoriaFiltro(e.target.value); setVentaProductId(''); }} className={`w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 outline-none transition-all shadow-inner text-slate-800 font-medium text-base focus:ring-4 ${motivoSalida === 'venta' ? 'focus:ring-emerald-100 focus:border-emerald-400' : 'focus:ring-red-100 focus:border-red-400'}`}>
                      <option value="">Todas las Categorías</option>
                      {categoriasUnicas.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Seleccionar Producto</label>
                    <select required value={ventaProductId} onChange={e => setVentaProductId(e.target.value)} className={`w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 outline-none transition-all shadow-inner text-slate-800 font-medium text-base focus:ring-4 ${motivoSalida === 'venta' ? 'focus:ring-emerald-100 focus:border-emerald-400' : 'focus:ring-red-100 focus:border-red-400'}`}>
                      <option value="">Selecciona del inventario...</option>
                      {/* SOLO MUESTRA LOS FILTRADOS QUE TIENEN STOCK > 0 */}
                      {productosFiltradosParaSalida.map(item => (
                         <option key={item.id} value={item.id}>{item.nombre} (Stock: {item.stockReal})</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="md:col-span-1">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Cantidad</label>
                    <input type="number" required min="1" value={ventaQty} onChange={e => setVentaQty(e.target.value)} className={`w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 outline-none transition-all shadow-inner text-slate-800 text-base focus:ring-4 ${motivoSalida === 'venta' ? 'focus:ring-emerald-100 focus:border-emerald-400' : 'focus:ring-red-100 focus:border-red-400'}`} placeholder="0" />
                  </div>

                  {motivoSalida === 'venta' ? (
                    <>
                      <div className="md:col-span-1">
                        <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Tipo Venta</label>
                        <select value={tipoVenta} onChange={e => setTipoVenta(e.target.value as any)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all shadow-inner text-slate-800 font-medium text-base">
                          <option value="unidad">Unidad</option>
                          <option value="mayoreo">Mayoreo</option>
                        </select>
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1">Ingreso Automático</label>
                        <div className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-slate-100/80 border border-slate-200 text-emerald-700 font-bold text-base h-[54px] md:h-[58px] flex items-center shadow-inner">
                          ${ventaProductId && ventaQty ? (
                            parseInt(ventaQty) * (tipoVenta === 'unidad' 
                              ? (inventario.find(p => p.id === ventaProductId)?.precioMenudeo || inventario.find(p => p.id === ventaProductId)?.valor || 0)
                              : (inventario.find(p => p.id === ventaProductId)?.precioMayoreo || inventario.find(p => p.id === ventaProductId)?.precioMenudeo || inventario.find(p => p.id === ventaProductId)?.valor || 0)
                            )
                          ).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '0.00'}
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Fecha de Salida</label>
                        <input type="date" required value={ventaFecha} onChange={e => setVentaFecha(e.target.value)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all shadow-inner text-slate-800 text-base" />
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-5">
                      <label className="block text-sm font-semibold text-red-600 mb-1.5 ml-1">Fecha de la Baja</label>
                      <input type="date" required value={ventaFecha} onChange={e => setVentaFecha(e.target.value)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-red-50 border border-red-200 focus:ring-4 focus:ring-red-100 focus:border-red-400 outline-none transition-all shadow-inner text-red-800 font-bold text-base" />
                    </div>
                  )}

                  <div className="md:col-span-5 flex justify-end mt-2">
                    <button type="submit" className={`w-full md:w-auto flex items-center justify-center px-8 py-4 text-white rounded-2xl hover:scale-105 transition-all shadow-lg font-bold tracking-wide text-base ${motivoSalida === 'venta' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-emerald-500/30' : 'bg-gradient-to-r from-red-500 to-rose-600 hover:shadow-red-500/30'}`}>
                      <Plus size={20} className="mr-2" /> 
                      {motivoSalida === 'venta' ? 'Registrar Venta' : 'Dar de Baja (Merma)'}
                    </button>
                  </div>
                </form>
              </div>

              {/* TABLA HISTORIAL UNIFICADO */}
              <div className="bg-white/80 md:bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8">
                <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-4 ml-1">Historial de Movimientos</h3>
                
                <div className="w-full">
                  <table className="w-full text-left border-collapse">
                    <thead className="hidden md:table-header-group">
                      <tr className="bg-slate-200/50 text-slate-600 text-sm font-bold uppercase tracking-wider rounded-t-2xl">
                        <th className="px-6 py-4 rounded-tl-2xl">Fecha</th>
                        <th className="px-6 py-4">Producto</th>
                        <th className="px-6 py-4">Movimiento</th>
                        <th className="px-6 py-4 rounded-tr-2xl">Volumen</th>
                      </tr>
                    </thead>
                    <tbody className="flex flex-col gap-4 md:table-row-group md:gap-0">
                      {historialUnificado.length === 0 ? (
                        <tr className="block md:table-row bg-white/50 md:bg-transparent rounded-2xl md:rounded-none"><td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-medium text-sm">Sin movimientos</td></tr>
                      ) : (
                        historialUnificado.map((mov: any) => {
                          const prod = inventario.find(p => p.id === mov.productId);
                          const esMerma = mov.tipoHistorial === 'merma';
                          const cantidad = esMerma ? mov.qtyDefective : mov.qtySold;

                          return (
                            <tr key={mov.id} className={`block md:table-row bg-white/70 md:bg-white/40 md:hover:bg-white/60 transition-colors rounded-[1.5rem] md:rounded-none p-4 md:p-0 shadow-sm md:shadow-none border border-white md:border-b md:border-slate-100 ${esMerma ? 'bg-red-50/30' : ''}`}>
                              <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 text-slate-500 text-xs md:text-sm border-b border-slate-200/60 md:border-none">
                                <span className="md:hidden text-xs text-slate-500 font-bold uppercase tracking-wider">Fecha</span>
                                <span className="text-right md:text-left">{mov.date}</span>
                              </td>
                              <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 font-semibold text-slate-800 text-sm md:text-base border-b border-slate-200/60 md:border-none">
                                <span className="md:hidden text-xs text-slate-500 font-bold uppercase tracking-wider">Producto</span>
                                <span className="text-right md:text-left">{prod ? prod.nombre : 'Desconocido'}</span>
                              </td>
                              
                              <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 text-slate-600 text-sm md:text-base border-b border-slate-200/60 md:border-none">
                                <span className="md:hidden text-xs text-slate-500 font-bold uppercase tracking-wider">Movimiento</span>
                                <div className="text-right md:text-left flex flex-col md:block">
                                  {esMerma ? (
                                    <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-md font-bold">MERMA</span>
                                  ) : mov.tipoVenta === 'mayoreo' ? (
                                    <>
                                      <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-md font-bold mb-1 md:mb-0 md:mr-2">VENTA MAYOREO</span>
                                      {mov.cobroTotal !== undefined && <span className="font-semibold text-emerald-600">+ ${mov.cobroTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>}
                                    </>
                                  ) : (
                                    <>
                                      <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-md font-bold mb-1 md:mb-0 md:mr-2">VENTA UNIDAD</span>
                                      {mov.cobroTotal !== undefined && <span className="font-semibold text-emerald-600">+ ${mov.cobroTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>}
                                    </>
                                  )}
                                </div>
                              </td>

                              <td className={`flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 font-bold text-sm md:text-base ${esMerma ? 'text-red-600' : 'text-emerald-600'}`}>
                                <span className="md:hidden text-xs text-slate-500 font-bold uppercase tracking-wider">Volumen</span>
                                <span className="text-right md:text-left">-{cantidad.toLocaleString()}</span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VISTA 3: ANÁLISIS ABC */}
          {activeTab === 'abc' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-5 md:space-y-6">
              <div className="bg-white/80 md:bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8 flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center">
                    <span className="bg-indigo-100 text-indigo-600 p-2 rounded-xl md:rounded-2xl mr-3"><BarChart3 size={20} className="md:w-6 md:h-6" /></span>
                    Inteligencia ABC
                  </h2>
                  <p className="text-slate-500 mt-1 md:mt-2 font-medium text-sm md:text-base">Basado en volumen x valor unitario.</p>
                </div>
                <button onClick={calculateABC} className="flex items-center justify-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl hover:scale-105 transition-all shadow-lg hover:shadow-indigo-500/30 font-bold tracking-wide w-full md:w-auto text-base">
                  <Play size={20} className="mr-2 fill-current" /> Procesar Datos
                </button>
              </div>

              {!abcResult ? (
                <div className="bg-white/60 md:bg-white/40 backdrop-blur-md rounded-[2rem] border border-dashed border-slate-300 p-10 text-center shadow-sm">
                  <BarChart3 className="mx-auto h-12 w-12 text-indigo-300 mb-4 animate-pulse" />
                  <p className="text-slate-500 font-medium text-sm">Presiona el botón para clasificar.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
                  {/* ZONA A */}
                  <div className="bg-white/90 md:bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white/50 overflow-hidden flex flex-col">
                    <div className="h-2 w-full bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
                    <div className="p-5 pb-2">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-2xl font-black text-slate-800">Zona A</h3>
                        <span className="bg-emerald-100 text-emerald-700 text-xs px-3 py-1 rounded-xl font-bold">~80%</span>
                      </div>
                    </div>
                    <div className="p-5 pt-2 space-y-3">
                      {abcResult.A.length === 0 ? <p className="text-slate-400 text-center text-sm">Vacío</p> : 
                        abcResult.A.slice(0, 5).map(p => (
                          <div key={p.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                            <div className="overflow-hidden mr-2">
                              <p className="font-bold text-slate-800 text-sm truncate">{p.nombre}</p>
                              <p className="text-xs text-slate-500 mt-0.5">Valor Ponderado: ${(p as any).usageValue?.toLocaleString('es-MX')}</p>
                            </div>
                            <span className="text-sm font-black text-emerald-500">{p.percentage}%</span>
                          </div>
                        ))}
                        {abcResult.A.length > 5 && <p className="text-center text-xs text-slate-400 font-bold mt-2">+ {abcResult.A.length - 5} más ocultos</p>}
                    </div>
                  </div>

                  {/* ZONA B */}
                  <div className="bg-white/90 md:bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white/50 overflow-hidden flex flex-col">
                    <div className="h-2 w-full bg-gradient-to-r from-amber-400 to-amber-600"></div>
                    <div className="p-5 pb-2">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-2xl font-black text-slate-800">Zona B</h3>
                        <span className="bg-amber-100 text-amber-700 text-xs px-3 py-1 rounded-xl font-bold">~15%</span>
                      </div>
                    </div>
                    <div className="p-5 pt-2 space-y-3">
                      {abcResult.B.length === 0 ? <p className="text-slate-400 text-center text-sm">Vacío</p> : 
                        abcResult.B.slice(0, 5).map(p => (
                          <div key={p.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                            <div className="overflow-hidden mr-2">
                              <p className="font-bold text-slate-800 text-sm truncate">{p.nombre}</p>
                              <p className="text-xs text-slate-500 mt-0.5">Valor Ponderado: ${(p as any).usageValue?.toLocaleString('es-MX')}</p>
                            </div>
                            <span className="text-sm font-black text-amber-500">{p.percentage}%</span>
                          </div>
                        ))}
                        {abcResult.B.length > 5 && <p className="text-center text-xs text-slate-400 font-bold mt-2">+ {abcResult.B.length - 5} más ocultos</p>}
                    </div>
                  </div>

                  {/* ZONA C */}
                  <div className="bg-white/90 md:bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white/50 overflow-hidden flex flex-col">
                    <div className="h-2 w-full bg-gradient-to-r from-slate-400 to-slate-600"></div>
                    <div className="p-5 pb-2">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-2xl font-black text-slate-800">Zona C</h3>
                        <span className="bg-slate-200 text-slate-700 text-xs px-3 py-1 rounded-xl font-bold">~5%</span>
                      </div>
                    </div>
                    <div className="p-5 pt-2 space-y-3">
                      {abcResult.C.length === 0 ? <p className="text-slate-400 text-center text-sm">Vacío</p> : 
                        abcResult.C.slice(0, 5).map(p => (
                          <div key={p.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                            <div className="overflow-hidden mr-2">
                              <p className="font-bold text-slate-800 text-sm truncate">{p.nombre}</p>
                              <p className="text-xs text-slate-500 mt-0.5">Valor Ponderado: ${(p as any).usageValue?.toLocaleString('es-MX')}</p>
                            </div>
                            <span className="text-sm font-black text-slate-500">{p.percentage}%</span>
                          </div>
                        ))}
                        {abcResult.C.length > 5 && <p className="text-center text-xs text-slate-400 font-bold mt-2">+ {abcResult.C.length - 5} más ocultos</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VISTA 4: TEMPORADA CON GRÁFICAS FINANCIERAS */}
          {activeTab === 'temporada' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-5 md:space-y-6">
              
              <div className="bg-white/80 md:bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-5 flex items-center">
                  <span className="bg-purple-100 text-purple-600 p-2 rounded-xl mr-3"><Filter size={20} /></span>
                  Rendimiento Financiero
                </h2>
                
                {/* FILTROS */}
                <div className="flex flex-col md:flex-row gap-4 mb-8 bg-white/60 md:bg-white/50 p-5 md:p-6 rounded-[1.5rem] border border-white shadow-inner">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Fecha a Analizar</label>
                    <input type="date" value={seasonDate} onChange={e => setSeasonDate(e.target.value)} className="w-full px-4 py-3.5 rounded-xl bg-white border border-slate-200 focus:ring-4 focus:ring-purple-100 outline-none text-base" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Vista de Gráfica</label>
                    <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)} className="w-full px-4 py-3.5 rounded-xl bg-white border border-slate-200 focus:ring-4 focus:ring-purple-100 outline-none text-base font-medium">
                      <option value="dia">Día exacto</option>
                      <option value="semana">Por Semana</option>
                      <option value="mes">Por Mes</option>
                      <option value="ano">Por Año</option>
                    </select>
                  </div>
                </div>

                {/* TARJETAS DE RESUMEN FINANCIERO */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center text-emerald-600 mb-1"><TrendingUp size={16} className="mr-1"/> <span className="font-bold text-sm">Ingresos Brutos</span></div>
                    <p className="text-2xl font-black text-slate-800">${seasonData.summary.ingresos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center text-red-600 mb-1"><TrendingDown size={16} className="mr-1"/> <span className="font-bold text-sm">Pérdidas (Mermas)</span></div>
                    <p className="text-2xl font-black text-slate-800">${seasonData.summary.mermas.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="flex items-center text-indigo-600 mb-1"><DollarSign size={16} className="mr-1"/> <span className="font-bold text-sm">Ganancia Neta</span></div>
                    <p className="text-2xl font-black text-slate-800">
                      ${(seasonData.summary.ingresos - seasonData.summary.costo - seasonData.summary.mermas).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-indigo-500/70 mt-1 font-medium leading-tight">Ingresos - (Costo de venta + Mermas)</p>
                  </div>
                </div>

                {/* GRÁFICA ESTILO INVERSIÓN (SVG LINE/AREA CHART) */}
                <div className="bg-slate-50/50 rounded-3xl border border-slate-200/60 p-4 md:p-6 mb-10 shadow-inner">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-700">Comportamiento del Mercado</h3>
                    <div className="flex gap-4 text-xs font-bold">
                      <span className="flex items-center text-emerald-600"><div className="w-3 h-3 rounded-full bg-emerald-400 mr-1"></div> Ingresos</span>
                      <span className="flex items-center text-red-500"><div className="w-3 h-3 rounded-full bg-red-400 mr-1"></div> Pérdidas</span>
                    </div>
                  </div>
                  
                  {/* Contenedor con Scroll para Móvil */}
                  <div className="w-full overflow-x-auto overflow-y-visible pb-4">
                    <div className="min-w-[650px] relative h-64 mt-4">
                      <svg viewBox="0 0 800 240" className="w-full h-full overflow-visible">
                        <defs>
                          <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id="gradPerdidas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                          </linearGradient>
                          <filter id="glowIngreso" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#10b981" floodOpacity="0.4"/>
                          </filter>
                          <filter id="glowPerdida" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#f43f5e" floodOpacity="0.4"/>
                          </filter>
                        </defs>

                        {/* Líneas Horizontales de Referencia (Grid) */}
                        <line x1="0" y1="50" x2="800" y2="50" stroke="#e2e8f0" strokeDasharray="4" />
                        <line x1="0" y1="100" x2="800" y2="100" stroke="#e2e8f0" strokeDasharray="4" />
                        <line x1="0" y1="150" x2="800" y2="150" stroke="#e2e8f0" strokeDasharray="4" />
                        <line x1="0" y1={activeH} x2="800" y2={activeH} stroke="#cbd5e1" strokeWidth="2" />

                        {/* ÁREA Y LÍNEA DE INGRESOS */}
                        {seasonData.chartPoints.length > 1 && (
                          <>
                            <polygon points={polyIngresosArea} fill="url(#gradIngresos)" />
                            <polyline points={pointsIngresosStr} fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#glowIngreso)" />
                          </>
                        )}
                        
                        {/* PUNTOS INTERACTIVOS INGRESOS */}
                        {seasonData.chartPoints.map((p, i) => {
                          const x = paddingX + (i / Math.max(seasonData.chartPoints.length - 1, 1)) * activeW;
                          const y = activeH - (p.ingresos / maxChartVal) * activeH;
                          return (
                            <g key={`ing-${i}`} className="group cursor-pointer">
                              <line x1={x} y1={y} x2={x} y2={activeH} stroke="#10b981" strokeWidth="1" strokeDasharray="3" className="opacity-0 group-hover:opacity-50 transition-opacity" />
                              <circle cx={x} cy={y} r="5" fill="#fff" stroke="#10b981" strokeWidth="3" className="transition-all duration-300 group-hover:r-[8px] shadow-lg" />
                              <rect x={x - 30} y={y - 35} width="60" height="24" rx="6" fill="#10b981" className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              <text x={x} y={y - 18} textAnchor="middle" fontSize="12" fill="#fff" fontWeight="bold" className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">${p.ingresos}</text>
                            </g>
                          );
                        })}

                        {/* ÁREA Y LÍNEA DE PÉRDIDAS */}
                        {seasonData.chartPoints.length > 1 && (
                          <>
                            <polygon points={polyPerdidasArea} fill="url(#gradPerdidas)" />
                            <polyline points={pointsPerdidasStr} fill="none" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#glowPerdida)" />
                          </>
                        )}
                        
                        {/* PUNTOS INTERACTIVOS PÉRDIDAS */}
                        {seasonData.chartPoints.map((p, i) => {
                          const x = paddingX + (i / Math.max(seasonData.chartPoints.length - 1, 1)) * activeW;
                          const y = activeH - (p.perdidas / maxChartVal) * activeH;
                          return (
                            <g key={`per-${i}`} className="group cursor-pointer">
                              <circle cx={x} cy={y} r="5" fill="#fff" stroke="#f43f5e" strokeWidth="3" className="transition-all duration-300 group-hover:r-[8px] shadow-lg" />
                              <rect x={x - 30} y={y + 15} width="60" height="24" rx="6" fill="#f43f5e" className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              <text x={x} y={y + 32} textAnchor="middle" fontSize="12" fill="#fff" fontWeight="bold" className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">${p.perdidas}</text>
                            </g>
                          );
                        })}

                        {/* ETIQUETAS EJE X (Tiempo) */}
                        {seasonData.chartPoints.map((p, i) => {
                          const x = paddingX + (i / Math.max(seasonData.chartPoints.length - 1, 1)) * activeW;
                          return (
                            <text key={`lbl-${i}`} x={x} y={activeH + 25} textAnchor="middle" fontSize="12" fill="#64748b" fontWeight="bold">{p.label}</text>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                </div>

                {/* PRODUCTOS MÁS MOVIDOS */}
                <div>
                  <h3 className="text-base font-bold text-slate-700 mb-4 ml-1 flex items-center">
                    <Search size={18} className="mr-2 text-purple-500" /> Productos más vendidos
                  </h3>
                  
                  {seasonData.groupedData.length === 0 ? (
                    <div className="text-center py-10 bg-white/50 rounded-[1.5rem] border border-dashed border-slate-300">
                      <AlertCircle className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                      <p className="text-slate-500 text-sm">No hay ventas registradas en esta fecha.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {seasonData.groupedData.map((item, index) => (
                        <div key={index} className="bg-white/90 backdrop-blur-md p-5 rounded-[1.5rem] border border-white shadow-lg flex items-center justify-between">
                          <div className="flex items-center space-x-3 overflow-hidden mr-2">
                            <div className="bg-purple-100 p-2.5 rounded-xl text-purple-600 flex-shrink-0">
                              <Package size={20} />
                            </div>
                            <span className="font-bold text-slate-800 text-base truncate">{item.name}</span>
                          </div>
                          <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 flex-shrink-0">{item.total.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2000}
          className="font-sans font-bold text-sm md:text-base"
          color="dark"
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};

const NavButton = ({ active, onClick, icon, children }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center px-1.5 md:px-5 py-2.5 rounded-full text-[10px] md:text-sm font-bold transition-all flex-1 md:flex-none whitespace-nowrap ${
      active 
        ? 'bg-slate-800 text-white shadow-md scale-[1.02]' 
        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-800'
    }`}
  >
    <span className="mr-1 md:mr-2 flex-shrink-0">{icon}</span>
    <span className="truncate">{children}</span>
  </button>
);

export default Home;