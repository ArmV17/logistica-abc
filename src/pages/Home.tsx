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
  valor: number;
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
  const [valor, setValor] = useState('');
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

    return () => { unsubInv(); unsubVent(); };
  }, []);

  // Funciones de Guardado
  const guardarMercancia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !cantidad || !valor || !fecha) return;
    try {
      await addDoc(collection(db, 'inventario'), {
        nombre,
        cantidad: parseInt(cantidad),
        valor: parseFloat(valor),
        fechaLlegada: fecha,
        createdAt: serverTimestamp()
      });
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

  // Función Calcular ABC (Basada en Valor x Rotación)
  const calculateABC = () => {
    const salesByProduct: Record<string, number> = {};
    ventas.forEach(sale => {
      salesByProduct[sale.productId] = (salesByProduct[sale.productId] || 0) + sale.qtySold;
    });

    let totalGlobalValue = 0;
    
    // Calculamos el valor de uso (Cantidad vendida * Valor unitario)
    const productsWithValue = inventario.map(prod => {
      const sold = salesByProduct[prod.id] || 0;
      const usageValue = sold * prod.valor;
      totalGlobalValue += usageValue;
      return { ...prod, sold, usageValue }; // Agregamos usageValue al objeto temporal
    });

    // Ordenamos de mayor a menor valor de uso
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
        {/* Animated Background Blobs */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-[-20%] left-[20%] w-[30rem] h-[30rem] bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        {/* Ajuste de padding para móviles y tablets */}
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 font-sans">
          
          {/* Header & Floating Glass Navigation */}
          <div className="flex flex-col items-center mb-8 md:mb-10 space-y-4 md:space-y-6">
            <div className="flex items-center space-x-3 bg-white/60 backdrop-blur-xl px-6 py-3 rounded-full border border-white/40 shadow-sm w-[90%] md:w-auto justify-center">
              <Package className="h-6 w-6 md:h-7 md:w-7 text-blue-600 flex-shrink-0" />
              <span className="font-extrabold text-xl md:text-2xl tracking-tight text-slate-800">
                Make<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">ABC</span>
              </span>
            </div>

            {/* Menú navegable horizontalmente en móviles */}
            <div className="w-full overflow-x-auto pb-2 -mb-2 hide-scrollbar">
              <nav className="flex space-x-2 bg-white/40 backdrop-blur-md p-1.5 rounded-full border border-white/50 shadow-lg min-w-max mx-auto w-fit">
                <NavButton active={activeTab === 'recepcion'} onClick={() => setActiveTab('recepcion')} icon={<ArrowDownToLine size={16} />}>Recepción</NavButton>
                <NavButton active={activeTab === 'salidas'} onClick={() => setActiveTab('salidas')} icon={<ArrowUpFromLine size={16} />}>Salidas</NavButton>
                <NavButton active={activeTab === 'abc'} onClick={() => setActiveTab('abc')} icon={<BarChart3 size={16} />}>Análisis ABC</NavButton>
                <NavButton active={activeTab === 'temporada'} onClick={() => setActiveTab('temporada')} icon={<CalendarDays size={16} />}>Temporada</NavButton>
              </nav>
            </div>
          </div>

          {/* VISTA 1: RECEPCIÓN */}
          {activeTab === 'recepcion' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6">
              {/* Ajuste de padding en móviles (p-5 en lugar de p-8) */}
              <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-6 flex items-center">
                  <span className="bg-blue-100 text-blue-600 p-2 rounded-xl md:rounded-2xl mr-3"><ArrowDownToLine size={20} className="md:w-6 md:h-6" /></span>
                  Entrada de Mercancía
                </h2>
                
                {/* Formulario responsivo: 1 columna en móvil, 5 en escritorio */}
                <form onSubmit={guardarMercancia} className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-1 md:ml-2">Nombre del Producto</label>
                    <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-4 md:px-5 py-3 md:py-4 rounded-xl md:rounded-2xl bg-white/50 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800 text-sm md:text-base" placeholder="Ej. Tarimas de madera" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-1 md:ml-2">Cantidad</label>
                    <input type="number" required min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} className="w-full px-4 md:px-5 py-3 md:py-4 rounded-xl md:rounded-2xl bg-white/50 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800 text-sm md:text-base" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-1 md:ml-2">Valor Unit.</label>
                    <input type="number" step="0.01" required min="0" value={valor} onChange={e => setValor(e.target.value)} className="w-full px-4 md:px-5 py-3 md:py-4 rounded-xl md:rounded-2xl bg-white/50 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800 text-sm md:text-base" placeholder="$0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-1 md:ml-2">Fecha</label>
                    <input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} className="w-full px-4 md:px-5 py-3 md:py-4 rounded-xl md:rounded-2xl bg-white/50 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800 text-sm md:text-base" />
                  </div>
                  <div className="md:col-span-5 flex justify-end mt-2 md:mt-4">
                    <button type="submit" className="w-full md:w-auto flex items-center justify-center px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl md:rounded-2xl hover:scale-[1.02] transition-all shadow-lg hover:shadow-blue-500/30 font-bold tracking-wide text-sm md:text-base">
                      <Plus size={18} className="mr-2" /> Agregar a Firebase
                    </button>
                  </div>
                </form>
              </div>

              {/* Tabla Bento Responsiva */}
              <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8">
                <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-4 md:mb-6 ml-1 md:ml-2">Inventario Actual</h3>
                
                {/* Contenedor desplazable para la tabla */}
                <div className="overflow-x-auto rounded-2xl md:rounded-3xl border border-slate-100 bg-white/40">
                  <table className="w-full text-left min-w-[600px]"> {/* min-w asegura que no se aplaste en móviles */}
                    <thead>
                      <tr className="bg-slate-100/50 text-slate-500 text-xs md:text-sm font-bold uppercase tracking-wider">
                        <th className="px-4 md:px-6 py-3 md:py-4">Producto</th>
                        <th className="px-4 md:px-6 py-3 md:py-4">Cantidad</th>
                        <th className="px-4 md:px-6 py-3 md:py-4">Valor</th>
                        <th className="px-4 md:px-6 py-3 md:py-4">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                      {inventario.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 md:px-6 py-8 md:py-10 text-center text-slate-400 font-medium text-sm">Bóveda de inventario vacía</td></tr>
                      ) : (
                        inventario.map(item => (
                          <tr key={item.id} className="hover:bg-white/60 transition-colors">
                            <td className="px-4 md:px-6 py-3 md:py-4 font-semibold text-slate-800 text-sm md:text-base">{item.nombre}</td>
                            <td className="px-4 md:px-6 py-3 md:py-4 text-slate-600 text-sm md:text-base">{item.cantidad.toLocaleString()}</td>
                            <td className="px-4 md:px-6 py-3 md:py-4 text-emerald-600 font-bold text-sm md:text-base">${item.valor?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</td>
                            <td className="px-4 md:px-6 py-3 md:py-4 text-slate-400 text-xs md:text-sm whitespace-nowrap">{item.fechaLlegada}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                <div className="flex justify-end mt-6 md:mt-8">
                  <button onClick={() => setActiveTab('salidas')} className="flex items-center text-blue-600 font-bold hover:text-blue-800 transition-colors text-sm md:text-base">
                    Siguiente paso <span className="hidden sm:inline">&nbsp;Registrar Salidas</span> <ArrowRight size={18} className="ml-2" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VISTA 2: SALIDAS */}
          {activeTab === 'salidas' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6">
              <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-6 flex items-center">
                  <span className="bg-emerald-100 text-emerald-600 p-2 rounded-xl md:rounded-2xl mr-3"><ArrowUpFromLine size={20} className="md:w-6 md:h-6" /></span>
                  Registro de Salidas
                </h2>
                
                <form onSubmit={guardarSalida} className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-1 md:ml-2">Seleccionar Producto</label>
                    <select required value={ventaProductId} onChange={e => setVentaProductId(e.target.value)} className="w-full px-4 md:px-5 py-3 md:py-4 rounded-xl md:rounded-2xl bg-white/50 border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all shadow-inner text-slate-800 font-medium text-sm md:text-base">
                      <option value="">Selecciona del inventario...</option>
                      {inventario.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-1 md:ml-2">Cantidad Movida</label>
                    <input type="number" required min="1" value={ventaQty} onChange={e => setVentaQty(e.target.value)} className="w-full px-4 md:px-5 py-3 md:py-4 rounded-xl md:rounded-2xl bg-white/50 border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all shadow-inner text-slate-800 text-sm md:text-base" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-1 md:ml-2">Fecha de Salida</label>
                    <input type="date" required value={ventaFecha} onChange={e => setVentaFecha(e.target.value)} className="w-full px-4 md:px-5 py-3 md:py-4 rounded-xl md:rounded-2xl bg-white/50 border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all shadow-inner text-slate-800 text-sm md:text-base" />
                  </div>
                  <div className="md:col-span-4 flex justify-end mt-2 md:mt-4">
                    <button type="submit" className="w-full md:w-auto flex items-center justify-center px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl md:rounded-2xl hover:scale-[1.02] transition-all shadow-lg hover:shadow-emerald-500/30 font-bold tracking-wide text-sm md:text-base">
                      <Plus size={18} className="mr-2" /> Registrar Rotación
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8">
                <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-4 md:mb-6 ml-1 md:ml-2">Historial de Rotación</h3>
                
                <div className="overflow-x-auto rounded-2xl md:rounded-3xl border border-slate-100 bg-white/40">
                  <table className="w-full text-left min-w-[400px]">
                    <thead>
                      <tr className="bg-slate-100/50 text-slate-500 text-xs md:text-sm font-bold uppercase tracking-wider">
                        <th className="px-4 md:px-6 py-3 md:py-4">Fecha</th>
                        <th className="px-4 md:px-6 py-3 md:py-4">Producto</th>
                        <th className="px-4 md:px-6 py-3 md:py-4">Volumen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                      {ventas.length === 0 ? (
                        <tr><td colSpan={3} className="px-4 md:px-6 py-8 md:py-10 text-center text-slate-400 font-medium text-sm">Sin movimientos registrados</td></tr>
                      ) : (
                        ventas.map(sale => {
                          const prod = inventario.find(p => p.id === sale.productId);
                          return (
                            <tr key={sale.id} className="hover:bg-white/60 transition-colors">
                              <td className="px-4 md:px-6 py-3 md:py-4 text-slate-400 text-xs md:text-sm whitespace-nowrap">{sale.date}</td>
                              <td className="px-4 md:px-6 py-3 md:py-4 font-semibold text-slate-800 text-sm md:text-base">{prod ? prod.nombre : 'Desconocido'}</td>
                              <td className="px-4 md:px-6 py-3 md:py-4 text-emerald-600 font-bold text-sm md:text-base">-{sale.qtySold.toLocaleString()}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                
                <div className="flex justify-end mt-6 md:mt-8">
                  <button onClick={() => setActiveTab('abc')} className="flex items-center text-emerald-600 font-bold hover:text-emerald-800 transition-colors text-sm md:text-base">
                    Siguiente paso <span className="hidden sm:inline">&nbsp;Análisis ABC</span> <ArrowRight size={18} className="ml-2" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VISTA 3: ANÁLISIS ABC */}
          {activeTab === 'abc' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6">
              {/* Botón de calcular adaptable */}
              <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center">
                    <span className="bg-indigo-100 text-indigo-600 p-2 rounded-xl md:rounded-2xl mr-3"><BarChart3 size={20} className="md:w-6 md:h-6" /></span>
                    Inteligencia ABC
                  </h2>
                  <p className="text-slate-500 mt-2 font-medium text-sm md:text-base">Clasificación automática basada en el valor de uso (Rotación x Valor Unitario).</p>
                </div>
                <button onClick={calculateABC} className="flex items-center justify-center px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl md:rounded-2xl hover:scale-[1.02] transition-all shadow-lg hover:shadow-indigo-500/30 font-bold tracking-wide w-full md:w-auto text-sm md:text-base mt-2 md:mt-0">
                  <Play size={18} className="mr-2 fill-current" /> Procesar Datos
                </button>
              </div>

              {!abcResult ? (
                <div className="bg-white/40 backdrop-blur-md rounded-[2rem] md:rounded-[2.5rem] border border-dashed border-slate-300 p-10 md:p-16 text-center shadow-sm">
                  <BarChart3 className="mx-auto h-12 w-12 md:h-16 md:w-16 text-indigo-300 mb-4 animate-pulse" />
                  <h3 className="text-lg md:text-xl font-bold text-slate-700">Esperando ejecución</h3>
                  <p className="text-slate-500 font-medium text-sm md:text-base">Presiona el botón para clasificar tu base de datos actual.</p>
                </div>
              ) : (
                /* Grid de 1 columna en móvil, 3 en escritorio */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* ZONA A */}
                  <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 overflow-hidden flex flex-col">
                    <div className="h-3 w-full bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
                    <div className="p-5 md:p-6 pb-2">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-2xl md:text-3xl font-black text-slate-800">Zona A</h3>
                        <span className="bg-emerald-100 text-emerald-700 text-xs px-3 py-1.5 rounded-xl font-bold">~80% Valor</span>
                      </div>
                      <p className="text-xs md:text-sm text-slate-500 font-medium">Artículos críticos de alto valor de uso.</p>
                    </div>
                    <div className="p-5 md:p-6 pt-4 flex-1 space-y-3 md:space-y-4">
                      {abcResult.A.length === 0 ? <p className="text-slate-400 text-center text-sm font-medium">Vacío</p> : 
                        abcResult.A.map(p => (
                          <div key={p.id} className="bg-slate-50/80 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                            <div className="overflow-hidden mr-2">
                              <p className="font-bold text-slate-800 text-sm md:text-base truncate">{p.nombre}</p>
                              <p className="text-xs font-semibold text-slate-500 mt-0.5">Uso: ${(p as any).usageValue?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <span className="text-sm font-black text-emerald-500 flex-shrink-0">{p.percentage}%</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* ZONA B */}
                  <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 overflow-hidden flex flex-col">
                    <div className="h-3 w-full bg-gradient-to-r from-amber-400 to-amber-600"></div>
                    <div className="p-5 md:p-6 pb-2">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-2xl md:text-3xl font-black text-slate-800">Zona B</h3>
                        <span className="bg-amber-100 text-amber-700 text-xs px-3 py-1.5 rounded-xl font-bold">~15% Valor</span>
                      </div>
                      <p className="text-xs md:text-sm text-slate-500 font-medium">Control regular y monitoreo.</p>
                    </div>
                    <div className="p-5 md:p-6 pt-4 flex-1 space-y-3 md:space-y-4">
                      {abcResult.B.length === 0 ? <p className="text-slate-400 text-center text-sm font-medium">Vacío</p> : 
                        abcResult.B.map(p => (
                          <div key={p.id} className="bg-slate-50/80 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                            <div className="overflow-hidden mr-2">
                              <p className="font-bold text-slate-800 text-sm md:text-base truncate">{p.nombre}</p>
                              <p className="text-xs font-semibold text-slate-500 mt-0.5">Uso: ${(p as any).usageValue?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <span className="text-sm font-black text-amber-500 flex-shrink-0">{p.percentage}%</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* ZONA C */}
                  <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 overflow-hidden flex flex-col">
                    <div className="h-3 w-full bg-gradient-to-r from-slate-400 to-slate-600"></div>
                    <div className="p-5 md:p-6 pb-2">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-2xl md:text-3xl font-black text-slate-800">Zona C</h3>
                        <span className="bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl font-bold">~5% Valor</span>
                      </div>
                      <p className="text-xs md:text-sm text-slate-500 font-medium">Bajo impacto, control simplificado.</p>
                    </div>
                    <div className="p-5 md:p-6 pt-4 flex-1 space-y-3 md:space-y-4">
                      {abcResult.C.length === 0 ? <p className="text-slate-400 text-center text-sm font-medium">Vacío</p> : 
                        abcResult.C.map(p => (
                          <div key={p.id} className="bg-slate-50/80 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                            <div className="overflow-hidden mr-2">
                              <p className="font-bold text-slate-800 text-sm md:text-base truncate">{p.nombre}</p>
                              <p className="text-xs font-semibold text-slate-500 mt-0.5">Uso: ${(p as any).usageValue?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <span className="text-sm font-black text-slate-500 flex-shrink-0">{p.percentage}%</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
              
              {abcResult && (
                <div className="flex justify-end mt-6 md:mt-8 pr-2 md:pr-4">
                  <button onClick={() => setActiveTab('temporada')} className="flex items-center text-indigo-600 font-bold hover:text-indigo-800 transition-colors text-sm md:text-base">
                    Siguiente paso <span className="hidden sm:inline">&nbsp;Filtrar Temporadas</span> <ArrowRight size={18} className="ml-2" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VISTA 4: TEMPORADA */}
          {activeTab === 'temporada' && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6">
              <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-6 md:mb-8 flex items-center">
                  <span className="bg-purple-100 text-purple-600 p-2 rounded-xl md:rounded-2xl mr-3"><Filter size={20} className="md:w-6 md:h-6" /></span>
                  Explorador de Temporadas
                </h2>
                
                {/* Apilamiento en móvil para los filtros */}
                <div className="flex flex-col md:flex-row gap-4 md:gap-6 mb-8 md:mb-10 bg-white/50 p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-white shadow-inner">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-1 md:ml-2">Fecha Pivote</label>
                    <input type="date" value={seasonDate} onChange={e => setSeasonDate(e.target.value)} className="w-full px-4 md:px-5 py-3 md:py-4 rounded-xl md:rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-purple-100 focus:border-purple-400 outline-none transition-all shadow-sm text-slate-800 text-sm md:text-base" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-600 mb-2 ml-1 md:ml-2">Agrupación Temporal</label>
                    <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)} className="w-full px-4 md:px-5 py-3 md:py-4 rounded-xl md:rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-purple-100 focus:border-purple-400 outline-none transition-all shadow-sm font-medium text-slate-800 text-sm md:text-base">
                      <option value="dia">Movimientos de ese Día</option>
                      <option value="semana">Movimientos de esa Semana</option>
                      <option value="mes">Movimientos de ese Mes</option>
                      <option value="ano">Movimientos de ese Año</option>
                    </select>
                  </div>
                </div>

                <div>
                  <h3 className="text-base md:text-lg font-bold text-slate-700 mb-4 md:mb-6 flex items-center ml-1 md:ml-2">
                    <Search size={18} className="mr-2 text-purple-500" /> Resultados del Filtro
                  </h3>
                  
                  {seasonalData.length === 0 ? (
                    <div className="text-center py-12 md:py-16 bg-white/40 rounded-[1.5rem] md:rounded-[2rem] border border-dashed border-slate-300">
                      <AlertCircle className="mx-auto h-10 w-10 md:h-12 md:w-12 text-slate-300 mb-3" />
                      <p className="text-slate-500 font-medium text-sm md:text-base">No se detectaron ventas en la temporada especificada.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                      {seasonalData.map((item, index) => (
                        <div key={index} className="bg-white/80 backdrop-blur-md p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-white shadow-lg flex items-center justify-between hover:scale-105 transition-transform cursor-default">
                          <div className="flex items-center space-x-3 md:space-x-4 overflow-hidden mr-3">
                            <div className="bg-gradient-to-br from-purple-100 to-indigo-100 p-2 md:p-3 rounded-xl md:rounded-2xl text-purple-600 shadow-inner flex-shrink-0">
                              <Package size={20} className="md:w-6 md:h-6" />
                            </div>
                            <span className="font-bold text-slate-800 text-base md:text-lg truncate">{item.name}</span>
                          </div>
                          <span className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 flex-shrink-0">{item.total.toLocaleString()}</span>
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
          className="font-sans font-bold text-sm md:text-base"
          color="dark"
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};

// Componente para los botones de navegación tipo Pill
const NavButton = ({ active, onClick, icon, children }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center px-4 md:px-5 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-bold transition-all whitespace-nowrap flex-shrink-0 ${
      active 
        ? 'bg-slate-800 text-white shadow-md scale-[1.02]' 
        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-800'
    }`}
  >
    <span className="mr-1.5 md:mr-2">{icon}</span>
    {children}
  </button>
);

export default Home;