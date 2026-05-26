import React, { useState, useEffect } from 'react';
import { IonContent, IonPage, IonToast } from '@ionic/react';
import { 
  Package, ArrowDownToLine, ArrowUpFromLine, BarChart3, 
  CalendarDays, Plus, Play, AlertCircle, Search, Filter, ArrowRight 
} from 'lucide-react';

// Firebase
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Interfaces de TypeScript
interface ItemInventario {
  id: string;
  nombre: string;
  cantidad: number;
  valor: number; // NUEVO CAMPO: Valor del producto
  fechaLlegada: string;
}

interface ItemVenta {
  id: string;
  productId: string;
  qtySold: number;
  date: string;
}

interface AbcItem extends ItemInventario {
  sold: number;
  percentage: string;
  cumulative: string;
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

  // Estados de Formularios
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [valor, setValor] = useState(''); // Estado para el nuevo campo de valor
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  
  const [ventaProductId, setVentaProductId] = useState('');
  const [ventaQty, setVentaQty] = useState('');
  const [ventaFecha, setVentaFecha] = useState(new Date().toISOString().split('T')[0]);

  // Estados de Análisis y Temporada
  const [abcResult, setAbcResult] = useState<AbcResult | null>(null);
  const [seasonFilter, setSeasonFilter] = useState('semana'); 
  const [seasonDate, setSeasonDate] = useState(new Date().toISOString().split('T')[0]);

  // UI
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Efecto: Cargar datos en tiempo real desde Firebase
  useEffect(() => {
    // Escuchar Inventario (Se actualiza inmediatamente sin refrescar)
    const invQ = query(collection(db, 'inventario'), orderBy('createdAt', 'desc'));
    const unsubInv = onSnapshot(invQ, (snapshot) => {
      const items: ItemInventario[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as ItemInventario));
      setInventario(items);
    });

    // Escuchar Ventas/Salidas
    const ventQ = query(collection(db, 'ventas'), orderBy('createdAt', 'desc'));
    const unsubVent = onSnapshot(ventQ, (snapshot) => {
      const items: ItemVenta[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as ItemVenta));
      setVentas(items);
    });

    return () => { unsubInv(); unsubVent(); };
  }, []);

  // Funciones de Guardado
  const guardarMercancia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !cantidad || !valor || !fecha) return; // Validación incluye el valor
    try {
      await addDoc(collection(db, 'inventario'), {
        nombre,
        cantidad: parseInt(cantidad),
        valor: parseFloat(valor), // Guardamos el valor como número decimal
        fechaLlegada: fecha,
        createdAt: serverTimestamp()
      });
      // Limpiar formulario
      setNombre(''); setCantidad(''); setValor(''); setFecha(new Date().toISOString().split('T')[0]);
      setToastMessage("¡Mercancía registrada con éxito!");
      setShowToast(true);
    } catch (error) {
      console.error(error);
    }
  };

  const guardarSalida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ventaProductId || !ventaQty || !ventaFecha) return;
    try {
      await addDoc(collection(db, 'ventas'), {
        productId: ventaProductId,
        qtySold: parseInt(ventaQty),
        date: ventaFecha,
        createdAt: serverTimestamp()
      });
      setVentaProductId(''); setVentaQty(''); setVentaFecha(new Date().toISOString().split('T')[0]);
      setToastMessage("¡Salida registrada con éxito!");
      setShowToast(true);
      setAbcResult(null); // Limpiar ABC para forzar recálculo
    } catch (error) {
      console.error(error);
    }
  };

  // Función Calcular ABC
  const calculateABC = () => {
    const salesByProduct: Record<string, number> = {};
    ventas.forEach(sale => {
      salesByProduct[sale.productId] = (salesByProduct[sale.productId] || 0) + sale.qtySold;
    });

    let totalGlobalSales = 0;
    const productsWithSales = inventario.map(prod => {
      const sold = salesByProduct[prod.id] || 0;
      totalGlobalSales += sold;
      return { ...prod, sold };
    });

    productsWithSales.sort((a, b) => b.sold - a.sold);

    let cumulativeSales = 0;
    const result: AbcResult = { A: [], B: [], C: [], total: totalGlobalSales };

    productsWithSales.forEach(prod => {
      if (totalGlobalSales === 0) { result.C.push({ ...prod, percentage: '0.00', cumulative: '0.00' }); return; }
      cumulativeSales += prod.sold;
      const cumulativePercentage = (cumulativeSales / totalGlobalSales) * 100;
      const currentItemPercentage = (prod.sold / totalGlobalSales) * 100;
      const enrichedProd = { ...prod, percentage: currentItemPercentage.toFixed(2), cumulative: cumulativePercentage.toFixed(2) };

      if (cumulativePercentage <= 80) result.A.push(enrichedProd);
      else if (cumulativePercentage <= 95) result.B.push(enrichedProd);
      else result.C.push(enrichedProd);
    });
    setAbcResult(result);
  };

  // Función Temporada
  const getFilteredSeasonData = () => {
    if (!seasonDate) return [];
    const targetDate = new Date(seasonDate);
    const tYear = targetDate.getFullYear();
    const tMonth = targetDate.getMonth();

    const getWeek = (date: Date) => {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
      return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    };

    const targetWeek = getWeek(targetDate);

    const filteredSales = ventas.filter(sale => {
      const saleDate = new Date(sale.date);
      saleDate.setMinutes(saleDate.getMinutes() + saleDate.getTimezoneOffset());
      targetDate.setMinutes(targetDate.getMinutes() + targetDate.getTimezoneOffset());

      switch (seasonFilter) {
        case 'dia': return saleDate.getFullYear() === tYear && saleDate.getMonth() === tMonth && saleDate.getDate() === targetDate.getDate();
        case 'semana': return saleDate.getFullYear() === tYear && getWeek(saleDate) === targetWeek;
        case 'mes': return saleDate.getFullYear() === tYear && saleDate.getMonth() === tMonth;
        case 'ano': return saleDate.getFullYear() === tYear;
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
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  };

  const seasonalData = getFilteredSeasonData();

  return (
    <IonPage>
      <IonContent fullscreen className="relative bg-[#f0f4fb]">
        {/* Animated Background Blobs 2026 Style */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-[-20%] left-[20%] w-[30rem] h-[30rem] bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-8 font-sans">
          
          {/* Header & Floating Glass Navigation */}
          <div className="flex flex-col items-center mb-10 space-y-6">
            <div className="flex items-center space-x-3 bg-white/60 backdrop-blur-xl px-6 py-3 rounded-full border border-white/40 shadow-sm">
              <Package className="h-7 w-7 text-blue-600" />
              <span className="font-extrabold text-2xl tracking-tight text-slate-800">
                Make<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">ABC</span>
              </span>
            </div>

            <nav className="flex space-x-2 bg-white/40 backdrop-blur-md p-1.5 rounded-full border border-white/50 shadow-lg overflow-x-auto max-w-full hide-scrollbar">
              <NavButton active={activeTab === 'recepcion'} onClick={() => setActiveTab('recepcion')} icon={<ArrowDownToLine size={16} />}>Recepción</NavButton>
              <NavButton active={activeTab === 'salidas'} onClick={() => setActiveTab('salidas')} icon={<ArrowUpFromLine size={16} />}>Salidas</NavButton>
              <NavButton active={activeTab === 'abc'} onClick={() => setActiveTab('abc')} icon={<BarChart3 size={16} />}>Análisis ABC</NavButton>
              <NavButton active={activeTab === 'temporada'} onClick={() => setActiveTab('temporada')} icon={<CalendarDays size={16} />}>Temporada</NavButton>
            </nav>
          </div>

          {/* VISTA 1: RECEPCIÓN */}
          {activeTab === 'recepcion' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6">
              <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-xl border border-white/50 p-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
                  <span className="bg-blue-100 text-blue-600 p-2 rounded-2xl mr-3"><ArrowDownToLine size={24} /></span>
                  Entrada de Mercancía
                </h2>
                {/* Formulario ajustado a 5 columnas para incluir el Valor */}
                <form onSubmit={guardarMercancia} className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-2">Nombre del Producto</label>
                    <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-white/50 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800" placeholder="Ej. Tarimas de madera" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-2">Cantidad</label>
                    <input type="number" required min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-white/50 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-2">Valor Unitario</label>
                    <input type="number" step="0.01" required min="0" value={valor} onChange={e => setValor(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-white/50 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800" placeholder="$0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-2">Fecha</label>
                    <input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-white/50 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800" />
                  </div>
                  <div className="md:col-span-5 flex justify-end mt-4">
                    <button type="submit" className="flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:scale-105 transition-all shadow-lg hover:shadow-blue-500/30 font-bold tracking-wide">
                      <Plus size={20} className="mr-2" /> Agregar a Firebase
                    </button>
                  </div>
                </form>
              </div>

              {/* Tabla Bento */}
              <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-xl border border-white/50 p-8">
                <h3 className="text-xl font-bold text-slate-800 mb-6 ml-2">Inventario Actual</h3>
                <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white/40">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100/50 text-slate-500 text-sm font-bold uppercase tracking-wider">
                        <th className="px-6 py-4">Producto</th>
                        <th className="px-6 py-4">Cantidad</th>
                        <th className="px-6 py-4">Valor</th> {/* Columna nueva */}
                        <th className="px-6 py-4">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                      {inventario.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-400 font-medium">Bóveda de inventario vacía</td></tr>
                      ) : (
                        inventario.map(item => (
                          <tr key={item.id} className="hover:bg-white/60 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-800">{item.nombre}</td>
                            <td className="px-6 py-4 text-slate-600">{item.cantidad.toLocaleString()}</td>
                            {/* Valor formateado como moneda */}
                            <td className="px-6 py-4 text-emerald-600 font-bold">${item.valor?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</td>
                            <td className="px-6 py-4 text-slate-400 text-sm">{item.fechaLlegada}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Botón Siguiente */}
                <div className="flex justify-end mt-8">
                  <button onClick={() => setActiveTab('salidas')} className="flex items-center text-blue-600 font-bold hover:text-blue-800 transition-colors">
                    Siguiente paso: Registrar Salidas <ArrowRight size={20} className="ml-2" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VISTA 2: SALIDAS */}
          {activeTab === 'salidas' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6">
              <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-xl border border-white/50 p-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
                  <span className="bg-emerald-100 text-emerald-600 p-2 rounded-2xl mr-3"><ArrowUpFromLine size={24} /></span>
                  Registro de Salidas (Ventas)
                </h2>
                <form onSubmit={guardarSalida} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-2">Seleccionar Producto</label>
                    <select required value={ventaProductId} onChange={e => setVentaProductId(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-white/50 border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all shadow-inner text-slate-800 font-medium">
                      <option value="">Selecciona del inventario...</option>
                      {inventario.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-2">Cantidad Movida</label>
                    <input type="number" required min="1" value={ventaQty} onChange={e => setVentaQty(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-white/50 border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all shadow-inner text-slate-800" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-2">Fecha de Salida</label>
                    <input type="date" required value={ventaFecha} onChange={e => setVentaFecha(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-white/50 border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all shadow-inner text-slate-800" />
                  </div>
                  <div className="md:col-span-4 flex justify-end mt-4">
                    <button type="submit" className="flex items-center px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl hover:scale-105 transition-all shadow-lg hover:shadow-emerald-500/30 font-bold tracking-wide">
                      <Plus size={20} className="mr-2" /> Registrar Rotación
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-xl border border-white/50 p-8">
                <h3 className="text-xl font-bold text-slate-800 mb-6 ml-2">Historial de Rotación</h3>
                <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white/40">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100/50 text-slate-500 text-sm font-bold uppercase tracking-wider">
                        <th className="px-6 py-4">Fecha</th>
                        <th className="px-6 py-4">Producto</th>
                        <th className="px-6 py-4">Volumen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                      {ventas.length === 0 ? (
                        <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-400 font-medium">Sin movimientos registrados</td></tr>
                      ) : (
                        ventas.map(sale => {
                          const prod = inventario.find(p => p.id === sale.productId);
                          return (
                            <tr key={sale.id} className="hover:bg-white/60 transition-colors">
                              <td className="px-6 py-4 text-slate-400 text-sm">{sale.date}</td>
                              <td className="px-6 py-4 font-semibold text-slate-800">{prod ? prod.nombre : 'Desconocido'}</td>
                              <td className="px-6 py-4 text-emerald-600 font-bold">-{sale.qtySold.toLocaleString()}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                
                <div className="flex justify-end mt-8">
                  <button onClick={() => setActiveTab('abc')} className="flex items-center text-emerald-600 font-bold hover:text-emerald-800 transition-colors">
                    Siguiente paso: Análisis ABC <ArrowRight size={20} className="ml-2" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VISTA 3: ANÁLISIS ABC */}
          {activeTab === 'abc' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6">
              <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-xl border border-white/50 p-8 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                    <span className="bg-indigo-100 text-indigo-600 p-2 rounded-2xl mr-3"><BarChart3 size={24} /></span>
                    Inteligencia Logística ABC
                  </h2>
                  <p className="text-slate-500 mt-2 font-medium">Clasificación automática basada en el volumen de salida de Firebase.</p>
                </div>
                <button onClick={calculateABC} className="flex items-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl hover:scale-105 transition-all shadow-lg hover:shadow-indigo-500/30 font-bold tracking-wide w-full md:w-auto justify-center">
                  <Play size={20} className="mr-2 fill-current" /> Procesar Datos
                </button>
              </div>

              {!abcResult ? (
                <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] border border-dashed border-slate-300 p-16 text-center shadow-sm">
                  <BarChart3 className="mx-auto h-16 w-16 text-indigo-300 mb-4 animate-pulse" />
                  <h3 className="text-xl font-bold text-slate-700">Esperando ejecución</h3>
                  <p className="text-slate-500 font-medium">Presiona el botón para clasificar tu base de datos actual.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* ZONA A */}
                  <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-xl border border-white/50 overflow-hidden flex flex-col">
                    <div className="h-3 w-full bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
                    <div className="p-6 pb-2">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-3xl font-black text-slate-800">Zona A</h3>
                        <span className="bg-emerald-100 text-emerald-700 text-xs px-3 py-1.5 rounded-xl font-bold">~80% Volumen</span>
                      </div>
                      <p className="text-sm text-slate-500 font-medium">Artículos críticos de alta rotación.</p>
                    </div>
                    <div className="p-6 pt-4 flex-1 space-y-4">
                      {abcResult.A.length === 0 ? <p className="text-slate-400 text-center text-sm font-medium">Vacío</p> : 
                        abcResult.A.map(p => (
                          <div key={p.id} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                            <div>
                              <p className="font-bold text-slate-800">{p.nombre}</p>
                              <p className="text-xs font-semibold text-slate-500 mt-1">Vol: {p.sold}</p>
                            </div>
                            <span className="text-sm font-black text-emerald-500">{p.percentage}%</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* ZONA B */}
                  <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-xl border border-white/50 overflow-hidden flex flex-col">
                    <div className="h-3 w-full bg-gradient-to-r from-amber-400 to-amber-600"></div>
                    <div className="p-6 pb-2">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-3xl font-black text-slate-800">Zona B</h3>
                        <span className="bg-amber-100 text-amber-700 text-xs px-3 py-1.5 rounded-xl font-bold">~15% Volumen</span>
                      </div>
                      <p className="text-sm text-slate-500 font-medium">Rotación moderada, control regular.</p>
                    </div>
                    <div className="p-6 pt-4 flex-1 space-y-4">
                      {abcResult.B.length === 0 ? <p className="text-slate-400 text-center text-sm font-medium">Vacío</p> : 
                        abcResult.B.map(p => (
                          <div key={p.id} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                            <div>
                              <p className="font-bold text-slate-800">{p.nombre}</p>
                              <p className="text-xs font-semibold text-slate-500 mt-1">Vol: {p.sold}</p>
                            </div>
                            <span className="text-sm font-black text-amber-500">{p.percentage}%</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* ZONA C */}
                  <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-xl border border-white/50 overflow-hidden flex flex-col">
                    <div className="h-3 w-full bg-gradient-to-r from-slate-400 to-slate-600"></div>
                    <div className="p-6 pb-2">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-3xl font-black text-slate-800">Zona C</h3>
                        <span className="bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl font-bold">~5% Volumen</span>
                      </div>
                      <p className="text-sm text-slate-500 font-medium">Baja rotación, compras espaciadas.</p>
                    </div>
                    <div className="p-6 pt-4 flex-1 space-y-4">
                      {abcResult.C.length === 0 ? <p className="text-slate-400 text-center text-sm font-medium">Vacío</p> : 
                        abcResult.C.map(p => (
                          <div key={p.id} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                            <div>
                              <p className="font-bold text-slate-800">{p.nombre}</p>
                              <p className="text-xs font-semibold text-slate-500 mt-1">Vol: {p.sold}</p>
                            </div>
                            <span className="text-sm font-black text-slate-500">{p.percentage}%</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
              
              {abcResult && (
                <div className="flex justify-end mt-8 pr-4">
                  <button onClick={() => setActiveTab('temporada')} className="flex items-center text-indigo-600 font-bold hover:text-indigo-800 transition-colors">
                    Siguiente paso: Filtrar por Temporadas <ArrowRight size={20} className="ml-2" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VISTA 4: TEMPORADA */}
          {activeTab === 'temporada' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6">
              <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-xl border border-white/50 p-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-8 flex items-center">
                  <span className="bg-purple-100 text-purple-600 p-2 rounded-2xl mr-3"><Filter size={24} /></span>
                  Explorador de Temporadas
                </h2>
                
                <div className="flex flex-col md:flex-row gap-6 mb-10 bg-white/50 p-6 rounded-[2rem] border border-white shadow-inner">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-2">Fecha Pivote</label>
                    <input type="date" value={seasonDate} onChange={e => setSeasonDate(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-purple-100 focus:border-purple-400 outline-none transition-all shadow-sm text-slate-800" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-2">Agrupación Temporal</label>
                    <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-purple-100 focus:border-purple-400 outline-none transition-all shadow-sm font-medium text-slate-800">
                      <option value="dia">Movimientos de ese Día</option>
                      <option value="semana">Movimientos de esa Semana</option>
                      <option value="mes">Movimientos de ese Mes</option>
                      <option value="ano">Movimientos de ese Año</option>
                    </select>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-700 mb-6 flex items-center ml-2">
                    <Search size={20} className="mr-2 text-purple-500" /> Resultados del Filtro
                  </h3>
                  
                  {seasonalData.length === 0 ? (
                    <div className="text-center py-16 bg-white/40 rounded-[2rem] border border-dashed border-slate-300">
                      <AlertCircle className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                      <p className="text-slate-500 font-medium">No se detectaron ventas en la temporada especificada.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {seasonalData.map((item, index) => (
                        <div key={index} className="bg-white/80 backdrop-blur-md p-6 rounded-[2rem] border border-white shadow-lg flex items-center justify-between hover:scale-105 transition-transform cursor-default">
                          <div className="flex items-center space-x-4">
                            <div className="bg-gradient-to-br from-purple-100 to-indigo-100 p-3 rounded-2xl text-purple-600 shadow-inner">
                              <Package size={24} />
                            </div>
                            <span className="font-bold text-slate-800 text-lg">{item.name}</span>
                          </div>
                          <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">{item.total.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Notificación Toast de Ionic */}
        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2500}
          className="font-sans font-bold"
          color="dark"
        />
      </IonContent>
    </IonPage>
  );
};

// Componente para los botones de navegación tipo Pill
const NavButton = ({ active, onClick, icon, children }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
      active 
        ? 'bg-slate-800 text-white shadow-md scale-105' 
        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-800'
    }`}
  >
    <span className="mr-2">{icon}</span>
    {children}
  </button>
);

export default Home;