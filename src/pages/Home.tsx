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

  // Función Calcular ABC
  const calculateABC = () => {
    const salesByProduct: Record<string, number> = {};
    ventas.forEach(sale => {
      salesByProduct[sale.productId] = (salesByProduct[sale.productId] || 0) + sale.qtySold;
    });

    let totalGlobalValue = 0;
    const productsWithValue = inventario.map(prod => {
      const sold = salesByProduct[prod.id] || 0;
      const usageValue = sold * prod.valor;
      totalGlobalValue += usageValue;
      return { ...prod, sold, usageValue } as AbcItem; 
    });

    // Ordenar de mayor a menor valor de uso
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

        <div className="max-w-6xl mx-auto px-3 md:px-4 py-6 md:py-8 font-sans pb-8">
          
          {/* Header & Menú Capsula Universal */}
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
                <form onSubmit={guardarMercancia} className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Nombre del Producto</label>
                    <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800 text-base" placeholder="Ej. Tarimas de madera" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Cantidad</label>
                    <input type="number" required min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800 text-base" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Valor Unit.</label>
                    <input type="number" step="0.01" required min="0" value={valor} onChange={e => setValor(e.target.value)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800 text-base" placeholder="$0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Fecha</label>
                    <input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-inner text-slate-800 text-base" />
                  </div>
                  <div className="md:col-span-5 flex justify-end mt-1 md:mt-4">
                    <button type="submit" className="w-full md:w-auto flex items-center justify-center px-6 py-3.5 md:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl md:rounded-2xl active:scale-95 md:hover:scale-[1.02] transition-all shadow-lg font-bold tracking-wide text-base">
                      <Plus size={18} className="mr-2" /> Agregar
                    </button>
                  </div>
                </form>
              </div>

              {/* TABLA RESPONSIVA DE INVENTARIO */}
              <div className="bg-white/80 md:bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8">
                <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-4 ml-1">Inventario Actual</h3>
                
                <div className="w-full">
                  <table className="w-full text-left border-collapse">
                    <thead className="hidden md:table-header-group">
                      <tr className="bg-slate-200/50 text-slate-600 text-sm font-bold uppercase tracking-wider rounded-t-2xl">
                        <th className="px-6 py-4 rounded-tl-2xl">Producto</th>
                        <th className="px-6 py-4">Cantidad</th>
                        <th className="px-6 py-4">Valor</th>
                        <th className="px-6 py-4 rounded-tr-2xl">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="flex flex-col gap-4 md:table-row-group md:gap-0">
                      {inventario.length === 0 ? (
                        <tr className="block md:table-row bg-white/50 md:bg-transparent rounded-2xl md:rounded-none"><td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-medium text-sm">Sin inventario registrado</td></tr>
                      ) : (
                        inventario.map(item => (
                          <tr key={item.id} className="block md:table-row bg-white/70 md:bg-white/40 md:hover:bg-white/60 transition-colors rounded-[1.5rem] md:rounded-none p-4 md:p-0 shadow-sm md:shadow-none border border-white md:border-b md:border-slate-100">
                            <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 font-semibold text-slate-800 text-sm md:text-base border-b border-slate-200/60 md:border-none">
                              <span className="md:hidden text-xs text-slate-500 font-bold uppercase tracking-wider">Producto</span>
                              <span className="text-right md:text-left">{item.nombre}</span>
                            </td>
                            <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 text-slate-600 text-sm md:text-base border-b border-slate-200/60 md:border-none">
                              <span className="md:hidden text-xs text-slate-500 font-bold uppercase tracking-wider">Cantidad</span>
                              <span className="text-right md:text-left">{item.cantidad.toLocaleString()}</span>
                            </td>
                            <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 text-emerald-600 font-bold text-sm md:text-base border-b border-slate-200/60 md:border-none">
                              <span className="md:hidden text-xs text-slate-500 font-bold uppercase tracking-wider">Valor Unit.</span>
                              <span className="text-right md:text-left">${item.valor?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                            </td>
                            <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 text-slate-500 text-xs md:text-sm">
                              <span className="md:hidden text-xs text-slate-500 font-bold uppercase tracking-wider">Fecha</span>
                              <span className="text-right md:text-left">{item.fechaLlegada}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VISTA 2: SALIDAS */}
          {activeTab === 'salidas' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-5 md:space-y-6">
              <div className="bg-white/80 md:bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-5 flex items-center">
                  <span className="bg-emerald-100 text-emerald-600 p-2 rounded-xl md:rounded-2xl mr-3"><ArrowUpFromLine size={20} className="md:w-6 md:h-6" /></span>
                  Registro de Salidas
                </h2>
                
                <form onSubmit={guardarSalida} className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Seleccionar Producto</label>
                    <select required value={ventaProductId} onChange={e => setVentaProductId(e.target.value)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all shadow-inner text-slate-800 font-medium text-base">
                      <option value="">Selecciona del inventario...</option>
                      {inventario.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Cantidad Movida</label>
                    <input type="number" required min="1" value={ventaQty} onChange={e => setVentaQty(e.target.value)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all shadow-inner text-slate-800 text-base" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Fecha de Salida</label>
                    <input type="date" required value={ventaFecha} onChange={e => setVentaFecha(e.target.value)} className="w-full px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/70 border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all shadow-inner text-slate-800 text-base" />
                  </div>
                  <div className="md:col-span-4 flex justify-end mt-1 md:mt-4">
                    <button type="submit" className="w-full md:w-auto flex items-center justify-center px-6 py-3.5 md:py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl md:rounded-2xl active:scale-95 md:hover:scale-[1.02] transition-all shadow-lg font-bold tracking-wide text-base">
                      <Plus size={18} className="mr-2" /> Registrar Rotación
                    </button>
                  </div>
                </form>
              </div>

              {/* TABLA RESPONSIVA DE SALIDAS */}
              <div className="bg-white/80 md:bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8">
                <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-4 ml-1">Historial de Rotación</h3>
                
                <div className="w-full">
                  <table className="w-full text-left border-collapse">
                    <thead className="hidden md:table-header-group">
                      <tr className="bg-slate-200/50 text-slate-600 text-sm font-bold uppercase tracking-wider rounded-t-2xl">
                        <th className="px-6 py-4 rounded-tl-2xl">Fecha</th>
                        <th className="px-6 py-4">Producto</th>
                        <th className="px-6 py-4 rounded-tr-2xl">Volumen</th>
                      </tr>
                    </thead>
                    <tbody className="flex flex-col gap-4 md:table-row-group md:gap-0">
                      {ventas.length === 0 ? (
                        <tr className="block md:table-row bg-white/50 md:bg-transparent rounded-2xl md:rounded-none"><td colSpan={3} className="px-4 py-8 text-center text-slate-400 font-medium text-sm">Sin movimientos</td></tr>
                      ) : (
                        ventas.map(sale => {
                          const prod = inventario.find(p => p.id === sale.productId);
                          return (
                            <tr key={sale.id} className="block md:table-row bg-white/70 md:bg-white/40 md:hover:bg-white/60 transition-colors rounded-[1.5rem] md:rounded-none p-4 md:p-0 shadow-sm md:shadow-none border border-white md:border-b md:border-slate-100">
                              <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 text-slate-500 text-xs md:text-sm border-b border-slate-200/60 md:border-none">
                                <span className="md:hidden text-xs text-slate-500 font-bold uppercase tracking-wider">Fecha</span>
                                <span className="text-right md:text-left">{sale.date}</span>
                              </td>
                              <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 font-semibold text-slate-800 text-sm md:text-base border-b border-slate-200/60 md:border-none">
                                <span className="md:hidden text-xs text-slate-500 font-bold uppercase tracking-wider">Producto</span>
                                <span className="text-right md:text-left">{prod ? prod.nombre : 'Desconocido'}</span>
                              </td>
                              <td className="flex justify-between items-center md:table-cell px-2 md:px-6 py-2.5 md:py-4 text-emerald-600 font-bold text-sm md:text-base">
                                <span className="md:hidden text-xs text-slate-500 font-bold uppercase tracking-wider">Volumen</span>
                                <span className="text-right md:text-left">-{sale.qtySold.toLocaleString()}</span>
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
                <button onClick={calculateABC} className="flex items-center justify-center px-6 py-3.5 md:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl md:rounded-2xl active:scale-95 md:hover:scale-[1.02] transition-all shadow-lg font-bold tracking-wide w-full md:w-auto text-base">
                  <Play size={18} className="mr-2 fill-current" /> Procesar Datos
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
                        /* APLICANDO EXACTAMENTE EL .slice(0, 5) */
                        abcResult.A.slice(0, 5).map(p => (
                          <div key={p.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                            <div className="overflow-hidden mr-2">
                              <p className="font-bold text-slate-800 text-sm truncate">{p.nombre}</p>
                              <p className="text-xs text-slate-500 mt-0.5">Uso: ${(p as any).usageValue?.toLocaleString('es-MX')}</p>
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
                        /* APLICANDO EXACTAMENTE EL .slice(0, 5) */
                        abcResult.B.slice(0, 5).map(p => (
                          <div key={p.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                            <div className="overflow-hidden mr-2">
                              <p className="font-bold text-slate-800 text-sm truncate">{p.nombre}</p>
                              <p className="text-xs text-slate-500 mt-0.5">Uso: ${(p as any).usageValue?.toLocaleString('es-MX')}</p>
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
                        /* APLICANDO EXACTAMENTE EL .slice(0, 5) */
                        abcResult.C.slice(0, 5).map(p => (
                          <div key={p.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                            <div className="overflow-hidden mr-2">
                              <p className="font-bold text-slate-800 text-sm truncate">{p.nombre}</p>
                              <p className="text-xs text-slate-500 mt-0.5">Uso: ${(p as any).usageValue?.toLocaleString('es-MX')}</p>
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

          {/* VISTA 4: TEMPORADA */}
          {activeTab === 'temporada' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-5 md:space-y-6">
              <div className="bg-white/80 md:bg-white/70 backdrop-blur-xl rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-white/50 p-5 md:p-8">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-5 flex items-center">
                  <span className="bg-purple-100 text-purple-600 p-2 rounded-xl mr-3"><Filter size={20} /></span>
                  Explorador
                </h2>
                
                <div className="flex flex-col md:flex-row gap-4 mb-8 bg-white/60 md:bg-white/50 p-5 md:p-6 rounded-[1.5rem] border border-white shadow-inner">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Fecha</label>
                    <input type="date" value={seasonDate} onChange={e => setSeasonDate(e.target.value)} className="w-full px-4 py-3.5 rounded-xl bg-white border border-slate-200 focus:ring-4 focus:ring-purple-100 outline-none text-base" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5 ml-1">Filtro</label>
                    <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)} className="w-full px-4 py-3.5 rounded-xl bg-white border border-slate-200 focus:ring-4 focus:ring-purple-100 outline-none text-base font-medium">
                      <option value="dia">Día exacto</option>
                      <option value="semana">Esa semana</option>
                      <option value="mes">Ese mes</option>
                      <option value="ano">Ese año</option>
                    </select>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-700 mb-4 ml-1 flex items-center">
                    <Search size={18} className="mr-2 text-purple-500" /> Resultados
                  </h3>
                  
                  {seasonalData.length === 0 ? (
                    <div className="text-center py-10 bg-white/50 rounded-[1.5rem] border border-dashed border-slate-300">
                      <AlertCircle className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                      <p className="text-slate-500 text-sm">No hay ventas registradas.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {seasonalData.map((item, index) => (
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

// Componente: Botón de navegación responsivo (Menos padding y texto de 10px en móvil, regular en escritorio)
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