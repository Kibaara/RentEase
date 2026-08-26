import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { 
  LayoutDashboard, Home, Users, CreditCard, Receipt, BarChart3, LogOut, 
  Plus, Search, MoreVertical, TrendingUp, TrendingDown, DollarSign, 
  CheckCircle2, Clock, AlertCircle, Calendar, Download, Wrench, Loader2, Check,
  ChevronLeft, ChevronRight, X, Droplets, Trash2, DoorOpen, Menu, Phone, Mail, FileText,
  Shield, Activity, Globe, Eye, BookOpen, Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import Papa from 'papaparse';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Sector 
} from 'recharts';

export function sortUnitsChronologically(items: any[]) {
  const orderMap: Record<string, number> = {
    'shop': 1,
    'g2': 2,
    'a': 3,
    'b': 4,
    'c': 5,
    'd': 6,
    'penta': 7
  };

  const getPrefix = (u: string) => {
    const l = u.toLowerCase();
    if (l.startsWith('shop')) return 'shop';
    if (l.startsWith('g2')) return 'g2';
    if (l.startsWith('penta')) return 'penta';
    const firstChar = l.charAt(0);
    if (['a', 'b', 'c', 'd'].includes(firstChar)) return firstChar;
    return 'z';
  };

  const getNum = (u: string) => {
    const match = u.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  return [...items].sort((u1, u2) => {
    const val1 = u1.unitNumber || '';
    const val2 = u2.unitNumber || '';
    
    const pref1 = getPrefix(val1);
    const pref2 = getPrefix(val2);
    
    if (orderMap[pref1] !== orderMap[pref2]) {
      return (orderMap[pref1] || 99) - (orderMap[pref2] || 99);
    }
    
    const num1 = getNum(val1);
    const num2 = getNum(val2);
    if (num1 !== num2) {
      return num1 - num2;
    }
    
    return val1.localeCompare(val2);
  });
}

// --- Shared CSV import helpers (used by RecordsTab's four import sections) ---

export function parseCsvNumber(val: any): number {
  if (!val) return 0;
  return parseFloat(val.toString().replace(/,/g, '')) || 0;
}

export function parseCsvPaymentString(val: any): number {
  if (!val || val === 'n/p') return 0;
  const parts = val.toString().split('+');
  return parts.reduce((sum: number, p: string) => sum + parseCsvNumber(p), 0);
}

export function parseCsvDate(dateStr: any, fallbackMonth?: string): string {
  if (!dateStr) {
    if (fallbackMonth) return new Date(`${fallbackMonth}-01`).toISOString();
    return new Date().toISOString();
  }
  const str = dateStr.toString();
  const parts = str.includes('/') ? str.split('/') : str.split('-');
  if (parts.length === 3) {
    let day, month, year;
    if (str.includes('/')) {
      // Assuming DD/MM/YYYY from CSV
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    } else {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    }
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(str).toISOString();
}

// Normalizes a raw Papa.parse row into lowercased, trimmed lookup keys,
// while preserving original-case values for display fields like names.
export function normalizeCsvRow(rawRow: any): any {
  const row: any = {};
  for (const key in rawRow) {
    row[key.toLowerCase().trim()] = typeof rawRow[key] === 'string' ? rawRow[key].trim().toLowerCase() : rawRow[key];
  }
  return row;
}

export interface ImportRowResult {
  row: number;
  label: string;
  status: 'created' | 'updated' | 'error';
  message?: string;
}

export default function LandlordDashboard({ onLogout }: any) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 768);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [waterReadings, setWaterReadings] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ totalDeposits: 0, totalBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = () => setRefreshTrigger(prev => prev + 1);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: any;

    const loadData = async () => {
      try {
        const data = await api.dashboard.summary();
        const readings = await api.waterReadings.list();

        if (isMounted) {
          setUnits(sortUnitsChronologically(data.units));
          setTenants(sortUnitsChronologically(data.users.filter((u: any) => u.role === 'TENANT')));
          setAgents(data.users.filter((u: any) => u.role === 'AGENT'));
          setPayments(data.payments);
          setExpenses(data.expenses);
          setRequests(data.requests);
          setWaterReadings(readings);
          setStats(data.stats || { totalDeposits: 0, totalBalance: 0 });
          setLoading(false);
        }
      } catch (e) {
        console.error("Error fetching data:", e);
        if (isMounted) setLoading(false);
      }
    };

    const poll = async () => {
      await loadData();
      if (isMounted) {
        timeoutId = setTimeout(poll, 10000);
      }
    };

    poll();
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  // Trigger manual refresh
  useEffect(() => {
    if (refreshTrigger > 0) {
      api.dashboard.summary().then((data: any) => {
        setUnits(sortUnitsChronologically(data.units));
        setTenants(sortUnitsChronologically(data.users.filter((u: any) => u.role === 'TENANT')));
        setAgents(data.users.filter((u: any) => u.role === 'AGENT'));
        setPayments(data.payments);
        setExpenses(data.expenses);
        setRequests(data.requests);
        api.waterReadings.list().then(setWaterReadings);
        setStats(data.stats || { totalDeposits: 0, totalBalance: 0 });
      }).catch(console.error);
    }
  }, [refreshTrigger]);

  const handleSignOut = async () => {
    try {
      await api.auth.logout();
    } catch (e) {
      console.error(e);
    }
    onLogout();
  };

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-zinc-950 text-zinc-500">Loading Admin Portal...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row font-sans">
      {/* Mobile Top Nav */}
      <div className="md:hidden border-b border-zinc-900 bg-zinc-950 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <div className="bg-zinc-100 p-1.5 rounded text-zinc-950">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <span>LandlordAdmin</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-zinc-400 hover:text-zinc-100 bg-zinc-900 rounded-lg border border-zinc-800"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-b border-zinc-900 bg-zinc-950 overflow-hidden sticky top-[73px] z-40"
          >
            <nav className="p-4 space-y-1">
              {[
                { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
                { id: 'units', label: 'Units', icon: <Home className="h-4 w-4" /> },
                { id: 'tenants', label: 'Tenants', icon: <Users className="h-4 w-4" /> },
                { id: 'agents', label: 'Agents', icon: <Users className="h-4 w-4 opacity-70" /> },
                { id: 'expenses', label: 'Expenses', icon: <Receipt className="h-4 w-4" /> },
                { id: 'invoices', label: 'Invoices', icon: <FileText className="h-4 w-4" /> },
                { id: 'reports', label: 'Reports', icon: <BarChart3 className="h-4 w-4" /> },
                { id: 'audit', label: 'Audit Logs', icon: <Shield className="h-4 w-4 opacity-70" /> },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === item.id ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {item.icon}
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
              <div className="pt-4 mt-4 border-t border-zinc-900">
                <button 
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 hover:bg-rose-500/5 transition-all rounded-lg"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm font-medium">Sign Out</span>
                </button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex ${isCollapsed ? 'w-20' : 'w-64'} border-r border-zinc-900 flex-col p-4 transition-all duration-300 relative`}>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-10 bg-zinc-900 border border-zinc-800 rounded-full p-1 text-zinc-400 hover:text-zinc-100 z-20"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} mb-10 text-xl font-bold tracking-tight`}>
          <div className="bg-zinc-100 p-1.5 rounded text-zinc-950 shrink-0">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          {!isCollapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>LandlordAdmin</motion.span>}
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={<LayoutDashboard />} label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} isCollapsed={isCollapsed} />
          <NavItem icon={<Home />} label="Units" active={activeTab === 'units'} onClick={() => setActiveTab('units')} isCollapsed={isCollapsed} />
          <NavItem icon={<Users />} label="Tenants" active={activeTab === 'tenants'} onClick={() => setActiveTab('tenants')} isCollapsed={isCollapsed} />
          <NavItem icon={<Users className="text-zinc-400" />} label="Agents" active={activeTab === 'agents'} onClick={() => setActiveTab('agents')} isCollapsed={isCollapsed} />
          <NavItem icon={<Receipt />} label="Expenses" active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} isCollapsed={isCollapsed} />
          <NavItem icon={<CreditCard />} label="Payments" active={activeTab === 'payments'} onClick={() => setActiveTab('payments')} isCollapsed={isCollapsed} />
          <NavItem icon={<FileText />} label="Invoices" active={activeTab === 'invoices'} onClick={() => setActiveTab('invoices')} isCollapsed={isCollapsed} />
          <NavItem icon={<BarChart3 />} label="Reports" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} isCollapsed={isCollapsed} />
          <NavItem icon={<Database />} label="Records" active={activeTab === 'records'} onClick={() => setActiveTab('records')} isCollapsed={isCollapsed} />
          <NavItem icon={<Shield className="text-zinc-400" />} label="Audit Logs" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} isCollapsed={isCollapsed} />
        </nav>

        <button 
          onClick={handleSignOut}
          className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2 text-zinc-500 hover:text-rose-500 transition-all rounded-md hover:bg-zinc-900`}
          title={isCollapsed ? "Sign Out" : ""}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-10 min-w-0">
        <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight capitalize">{activeTab}</h2>
            <p className="text-zinc-500 text-sm mt-1">Property performance and administration.</p>
          </div>
          <div className="text-sm text-zinc-500">
            {format(new Date(), 'MMMM yyyy')}
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && <OverviewTab units={units} tenants={tenants} payments={payments} expenses={expenses} serviceRequests={requests} stats={stats} onNavigate={setActiveTab} />}
            {activeTab === 'units' && <UnitsTab units={units} tenants={tenants} payments={payments} onRefresh={refresh} />}
            {activeTab === 'tenants' && <TenantsTab tenants={tenants} units={units} onRefresh={refresh} />}
            {activeTab === 'agents' && <AgentsTab agents={agents} onRefresh={refresh} />}
            {activeTab === 'expenses' && <ExpensesTab expenses={expenses} requests={requests} waterReadings={waterReadings} onRefresh={refresh} />}
            {activeTab === 'payments' && <PaymentsTab payments={payments} tenants={tenants} units={units} onRefresh={refresh} />}
            {activeTab === 'invoices' && <InvoicesTab tenants={tenants} onRefresh={refresh} />}
            {activeTab === 'reports' && <ReportsTab payments={payments} expenses={expenses} tenants={tenants} serviceRequests={requests} units={units} onRefresh={refresh} />}
            {activeTab === 'records' && <RecordsTab units={units} tenants={tenants} expenses={expenses} onRefresh={refresh} />}
            {activeTab === 'audit' && <AuditLogsTab />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, isCollapsed }: any) {
  return (
    <button 
      onClick={onClick}
      title={isCollapsed ? label : ""}
      className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 rounded-md transition-all ${active ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'}`}
    >
      {active ? <div className="text-zinc-100 shrink-0">{icon}</div> : <div className="text-zinc-600 shrink-0">{icon}</div>}
      {!isCollapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium whitespace-nowrap">{label}</motion.span>}
    </button>
  );
}

// --- TABS ---

function OverviewTab({ units, tenants, payments, expenses, serviceRequests, stats: serverStats, onNavigate }: any) {
  const stats = useMemo(() => {
    const currentMonth = startOfMonth(new Date());
    const endOfCurrentMonth = endOfMonth(new Date());

    const monthlyRevenue = payments
      .filter((p: any) => p.status === 'APPROVED' && !['DEPOSIT', 'REFUND'].includes(p.paymentType) && isWithinInterval(parseISO(p.createdAt), { start: currentMonth, end: endOfCurrentMonth }))
      .reduce((sum: number, p: any) => {
        if (p.paymentType === 'MOVE_IN') {
          return sum + (p.amount / 2);
        }
        return sum + p.amount;
      }, 0);

    const totalDeposits = serverStats?.totalDeposits || 0;
    const totalOutstanding = serverStats?.totalBalance || 0;

    const monthlyExpenses = expenses
      .filter((e: any) => isWithinInterval(parseISO(e.createdAt), { start: currentMonth, end: endOfCurrentMonth }))
      .reduce((sum: number, e: any) => sum + e.amount, 0);

    const activeUnits = units.filter((u: any) => u.isActive !== 0);
    const occupiedUnits = activeUnits.filter((u: any) => u.status === 'OCCUPIED').length;
    const vacantUnits = activeUnits.filter((u: any) => u.status === 'VACANT').length;
    const pendingRefunds = serviceRequests.filter((r: any) => r.type === 'MOVE_OUT' && r.status === 'AWAITING_LANDLORD_APPROVAL');
    const pendingCommissions = expenses.filter((e: any) => e.type === 'COMMISSION' && e.status === 'PENDING');
    const chartData = generateChartData(payments, expenses);

    return { monthlyRevenue, totalDeposits, totalOutstanding, monthlyExpenses, occupiedUnits, vacantUnits, pendingRefunds, pendingCommissions, chartData };
  }, [units, tenants, payments, expenses, serviceRequests, serverStats]);

  const { monthlyRevenue, totalDeposits, totalOutstanding, monthlyExpenses, occupiedUnits, vacantUnits, pendingRefunds, pendingCommissions, chartData } = stats;

  return (
    <div className="space-y-8">
      {pendingCommissions.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-2 rounded-lg">
              <Receipt className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-500">Agent Commission Request</div>
              <div className="text-xs text-emerald-500/70">{pendingCommissions.length} commission request(s) awaiting your approval.</div>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('expenses')}
            className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-600 transition-all shrink-0"
          >
            Review <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {pendingRefunds.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <LogOut className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-blue-500">Pending Move-out Approvals</div>
              <div className="text-xs text-blue-500/70">{pendingRefunds.length} tenants have move-out assessments awaiting your final approval.</div>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('reports')}
            className="text-xs font-bold bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-all"
          >
            Review Assessments
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={<Home className="text-blue-400" />} label="Unit Occupancy" value={`${occupiedUnits} / ${units.length}`} sub={`${vacantUnits} Vacant Units`} />
        <StatCard icon={<TrendingUp className="text-emerald-400" />} label="Monthly Revenue" value={`KSH ${monthlyRevenue.toLocaleString()}`} />
        <StatCard icon={<AlertCircle className="text-amber-400" />} label="Outstanding Debt" value={`KSH ${totalOutstanding.toLocaleString()}`} sub="Action required" />
        <StatCard icon={<DollarSign className="text-purple-400" />} label="Total Deposits" value={`KSH ${totalDeposits.toLocaleString()}`} sub="Refundable" />
        <StatCard icon={<TrendingDown className="text-red-400" />} label="Monthly Expenses" value={`KSH ${monthlyExpenses.toLocaleString()}`} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Revenue vs Expenses (Last 6 Months)</h3>
          <div className="h-80 w-full relative min-h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#52525b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                />
                <YAxis 
                  stroke="#52525b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `KSH ${value >= 1000 ? (value / 1000) + 'k' : value}`}
                />
                <Tooltip 
                  cursor={{ fill: '#27272a', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px', padding: '12px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: '600' }}
                  labelStyle={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Bar 
                  dataKey="revenue" 
                  name="Revenue"
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]} 
                  barSize={18}
                />
                <Bar 
                  dataKey="deposits" 
                  name="Deposits"
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]} 
                  barSize={18}
                />
                <Bar 
                  dataKey="expenses" 
                  name="Expenses"
                  fill="#f43f5e" 
                  radius={[4, 4, 0, 0]} 
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Deposits</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-rose-500" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Expenses</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-6">Occupancy Status</h3>
          <div className="h-80 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Occupied', value: occupiedUnits },
                    { name: 'Vacant', value: vacantUnits },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#374151" />
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function UnitsTab({ units, tenants, payments, onRefresh }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUnits = useMemo(() => {
    return units.filter((u: any) => 
      (u.unitNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [units, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <input 
            placeholder="Search units..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-700"
          />
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-zinc-100 text-zinc-950 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-zinc-200 transition-all"
        >
          <Plus className="h-4 w-4" /> Add Unit
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredUnits.map((u: any) => {
          let tenant = null;
          if (u.currentTenantId) {
            tenant = tenants.find((t: any) => t.id === u.currentTenantId);
          }
          if (!tenant) {
            tenant = tenants.find((t: any) => t.unitId === u.id && t.status === 'ACTIVE') || 
                     tenants.find((t: any) => (t.unitNumber || '').toLowerCase() === (u.unitNumber || '').toLowerCase() && t.status === 'ACTIVE') || 
                     tenants.find((t: any) => (t.unitNumber || '').toLowerCase() === (u.unitNumber || '').toLowerCase());
          }
          return (
            <Card key={u.id} className="p-5 hover:border-zinc-700 transition-all cursor-pointer group relative" onClick={() => setSelectedUnit(u)}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold">{u.unitNumber}</div>
                    <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{u.type || '1 Bedroom'}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">Rent: KSH {u.rentAmount?.toLocaleString()}</div>
                  <div className="text-xs text-blue-500/80 mt-1">Meter: {u.waterReading || 0} units</div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingUnit(u);
                    }}
                    className="p-1.5 bg-zinc-800 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-700"
                  >
                    <Wrench className="h-3 w-3 text-zinc-400" />
                  </button>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.isActive === 0 ? 'bg-red-500/10 text-red-500' : u.status === 'OCCUPIED' ? 'bg-green-500/10 text-green-500' : 'bg-zinc-800 text-zinc-400'}`}>
                    {u.isActive === 0 ? 'INACTIVE' : u.status}
                  </span>
                </div>
              </div>
              <div className="pt-4 border-t border-zinc-800">
                <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Current Tenant</div>
                <div className="text-sm font-medium mt-1">{tenant ? tenant.name : 'VACANT'}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {showAdd && <AddUnitModal onRefresh={onRefresh} onClose={() => setShowAdd(false)} />}
      {editingUnit && <EditUnitModal unit={editingUnit} onRefresh={onRefresh} onClose={() => setEditingUnit(null)} />}
      {selectedUnit && <UnitDetailsModal unit={selectedUnit} tenants={tenants} payments={payments} onClose={() => setSelectedUnit(null)} />}
    </div>
  );
}

function TenantsTab({ tenants, units, onRefresh }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  
  const activeTenants = useMemo(() => {
    return tenants.filter((t: any) => 
      t.status === 'ACTIVE' && 
      ((t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (t.unitNumber || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [tenants, searchTerm]);

  const movedOutTenants = useMemo(() => {
    return tenants.filter((t: any) => 
      t.status === 'INACTIVE' && 
      (t.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tenants, searchTerm]);

  return (
    <div className="space-y-12">
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <input 
            placeholder="Search all tenants..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-700"
          />
        </div>
      </div>

      {/* Active Tenants Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-500" />
          <h3 className="text-lg font-bold">Currently Residing</h3>
          <span className="bg-emerald-500/10 text-emerald-500 text-[10px] px-2 py-0.5 rounded-full font-bold">
            {activeTenants.length}
          </span>
        </div>
        
        <div className="bg-zinc-900/50 border border-zinc-900 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-zinc-900/80 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Tenant</th>
                  <th className="px-6 py-4">Unit</th>
                  <th className="px-6 py-4">Rent</th>
                  <th className="px-6 py-4">Deposit</th>
                  <th className="px-6 py-4">Balance</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {activeTenants.map((t: any) => (
                  <tr key={t.id} className="hover:bg-zinc-900/30 transition-all">
                    <td className="px-6 py-4">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-zinc-500">{t.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-[10px] font-bold">
                        {t.unitNumber || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-300">KSH {t.rentAmount?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm font-medium text-emerald-500/80">KSH {t.depositAmount?.toLocaleString() || 0}</td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-semibold ${t.totalBalance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        KSH {t.totalBalance?.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedTenant(t)}
                        className="text-[10px] font-bold uppercase tracking-tighter text-zinc-500 hover:text-zinc-100 transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
                {activeTenants.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-zinc-600 text-sm">No active tenants found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Moved Out Tenants Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <LogOut className="h-5 w-5 text-zinc-500" />
          <h3 className="text-lg font-bold">Moved Out Tenants</h3>
          <span className="bg-zinc-800 text-zinc-500 text-[10px] px-2 py-0.5 rounded-full font-bold">
            {movedOutTenants.length}
          </span>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-900 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-zinc-900/80 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Tenant</th>
                  <th className="px-6 py-4">Move-out Date</th>
                  <th className="px-6 py-4">Repairs Deducted</th>
                  <th className="px-6 py-4">Amount Refunded</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {movedOutTenants.map((t: any) => (
                  <tr key={t.id} className="hover:bg-zinc-900/30 transition-all">
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-400">{t.name}</div>
                      <div className="text-xs text-zinc-600">{t.email}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-500">
                      {t.moveOutDate ? format(new Date(t.moveOutDate), 'MMM d, yyyy') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-500/70 font-medium">- KSH {t.finalRepairCosts?.toLocaleString() || 0}</td>
                    <td className="px-6 py-4 text-sm text-emerald-500/80 font-bold">KSH {t.finalRefundAmount?.toLocaleString() || 0}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedTenant(t)}
                        className="text-[10px] font-bold uppercase tracking-tighter text-zinc-500 hover:text-zinc-100 transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
                {movedOutTenants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-zinc-600 text-sm">No historical records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selectedTenant && <TenantDetailsModal tenant={selectedTenant} onClose={() => setSelectedTenant(null)} onRefresh={onRefresh} />}
    </div>
  );
}

function ExpensesTab({ expenses, requests, waterReadings, onRefresh }: any) {
  const tenantReadings = waterReadings.filter((r: any) => r.type === 'TENANT');
  const [selectedCommission, setSelectedCommission] = useState<any>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);

  const handleApproveCommission = async (id: string) => {
    try {
      await api.expenses.update(id, { status: 'APPROVED' });
      onRefresh();
      setSelectedCommission(null);
    } catch (e: any) {
      alert("Error approving: " + e.message);
    }
  };

  return (
    <div className="grid gap-12 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-12">
        <section className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-zinc-400" /> General Expense History
            </h3>
            <button
              onClick={() => setShowAddExpense(true)}
              className="bg-zinc-100 text-zinc-950 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-zinc-200 transition-all"
            >
              <Plus className="h-4 w-4" /> Add Expense
            </button>
          </div>
          <div className="bg-zinc-900 border border-zinc-900 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-zinc-900/80 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {[...expenses].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((e: any) => (
                    <tr key={e.id} className="hover:bg-zinc-900/30 transition-all">
                      <td className="px-6 py-4 text-xs text-zinc-500">{format(new Date(e.createdAt), 'MMM d, yyyy')}</td>
                      <td className="px-6 py-4">
                        <span className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-[10px] font-bold uppercase">{e.type}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-400">{e.description}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${e.status === 'PENDING' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                          {e.status || 'APPROVED'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold">KSH {e.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        {e.type === 'COMMISSION' && e.status === 'PENDING' && (
                          <button 
                            onClick={() => setSelectedCommission(e)}
                            className="bg-emerald-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-emerald-600 transition"
                          >
                            Review
                          </button>
                        )}
                        {e.type === 'COMMISSION' && e.status === 'APPROVED' && e.metadata && (
                           <button 
                             onClick={() => setSelectedCommission(e)}
                             className="text-zinc-500 hover:text-zinc-300 text-xs font-bold"
                           >
                             View Breakdown
                           </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>


      </div>

      <div className="space-y-12 shrink-0 lg:w-80">
        <section className="space-y-6">
          <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <Wrench className="h-4 w-4" /> Pending Repairs
          </h3>
          <div className="space-y-4">
            {requests.filter((r: any) => r.status === 'PENDING' && r.type === 'REPAIR').map((r: any) => (
              <Card key={r.id} className="p-4 bg-zinc-900/50 border-zinc-900">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-[10px] text-zinc-600">{format(new Date(r.createdAt), 'MMM d')}</div>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">{r.description}</p>
              </Card>
            ))}
            {requests.filter((r: any) => r.status === 'PENDING' && r.type === 'REPAIR').length === 0 && (
              <div className="text-[10px] text-zinc-700 italic">No pending repairs.</div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <DoorOpen className="h-4 w-4" /> Vacate Notices
          </h3>
          <div className="space-y-4">
            {requests.filter((r: any) => r.status === 'PENDING' && r.type === 'MOVE_OUT').map((r: any) => (
              <Card key={r.id} className="p-4 bg-orange-500/5 border-orange-500/10">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-[10px] text-orange-500/60">{format(new Date(r.createdAt), 'MMM d')}</div>
                </div>
                <p className="text-xs text-orange-200/60 line-clamp-3 leading-relaxed italic">"{r.description}"</p>
              </Card>
            ))}
            {requests.filter((r: any) => r.status === 'PENDING' && r.type === 'MOVE_OUT').length === 0 && (
              <div className="text-[10px] text-zinc-700 italic">No vacate notices.</div>
            )}
          </div>
        </section>
      </div>
      {selectedCommission && (
        <CommissionReviewModal 
          expense={selectedCommission} 
          onClose={() => setSelectedCommission(null)} 
          onApprove={() => handleApproveCommission(selectedCommission.id)} 
        />
      )}
      {showAddExpense && (
        <AddExpenseModal onClose={() => setShowAddExpense(false)} onRefresh={onRefresh} />
      )}
    </div>
  );
}

const MANUAL_EXPENSE_TYPES = ['CLEANING', 'ELECTRICITY', 'WATER', 'MAINTENANCE', 'REPAIR', 'OTHER'];

function AddExpenseModal({ onClose, onRefresh }: any) {
  const [type, setType] = useState('CLEANING');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.expenses.create({
        type,
        description: description || `${type.charAt(0)}${type.slice(1).toLowerCase()} expense`,
        amount: parsedAmount,
        unitNumber: unitNumber || undefined,
        status: 'APPROVED',
      });
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add expense');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Add Expense</h3>
            <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X className="h-5 w-5" /></button>
          </div>

          {error && <div className="p-3 bg-red-500/10 text-red-500 rounded border border-red-500/20 text-sm font-semibold">{error}</div>}

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Type</label>
            <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100">
              {MANUAL_EXPENSE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Common area cleaning" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-600" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Amount (KSH)</label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Unit (optional)</label>
            <input value={unitNumber} onChange={e => setUnitNumber(e.target.value)} placeholder="If this expense relates to a specific unit" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-600" />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-zinc-100 text-zinc-950 py-3 rounded-lg text-sm font-bold hover:bg-zinc-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Add Expense
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function ReportsTab({ payments, expenses, tenants, serviceRequests, units, onRefresh }: any) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('ALL');
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));

  const filteredPayments = useMemo(() => {
    const filtered = payments.filter((p: any) => {
      const tenant = tenants.find((t: any) => t.id === p.tenantId);
      const tenantName = (tenant?.name || '').toLowerCase();
      const unitNumber = (tenant?.unitNumber || '').toLowerCase();
      const refCode = (p.referenceCode || '').toLowerCase();
      const searchMatch = !searchTerm || tenantName.includes(searchTerm.toLowerCase()) || 
                          unitNumber.includes(searchTerm.toLowerCase()) || 
                          refCode.includes(searchTerm.toLowerCase());
      
      const typeMatch = paymentTypeFilter === 'ALL' || p.paymentType === paymentTypeFilter;
      
      let dateMatch = true;
      if (reportMonth) {
        const itemMonth = format(new Date(p.createdAt), 'yyyy-MM');
        dateMatch = itemMonth === reportMonth;
      }

      return searchMatch && typeMatch && dateMatch;
    });

    // Sort chronologically by unit number
    const paymentsWithUnits = filtered.map((p: any) => ({
      ...p,
      unitNumber: tenants.find((t: any) => t.id === p.tenantId)?.unitNumber || ''
    }));
    
    return sortUnitsChronologically(paymentsWithUnits);
  }, [payments, tenants, searchTerm, paymentTypeFilter, reportMonth]);

  const filteredExpenses = useMemo(() => {
    const filtered = expenses.filter((e: any) => {
      // Match revenue's treatment of only-approved payments: a PENDING
      // expense (e.g. a commission request awaiting landlord approval)
      // isn't a realized cost yet and shouldn't count against profit.
      const isApproved = (e.status || 'APPROVED') === 'APPROVED';
      if (!isApproved) return false;

      const unitNumber = (e.unitNumber || '').toLowerCase();
      const searchMatch = !searchTerm || unitNumber.includes(searchTerm.toLowerCase()) || 
                          (e.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (e.type || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      let dateMatch = true;
      if (reportMonth) {
        const itemMonth = format(new Date(e.createdAt), 'yyyy-MM');
        dateMatch = itemMonth === reportMonth;
      }

      return searchMatch && dateMatch;
    });

    return sortUnitsChronologically(filtered);
  }, [expenses, searchTerm, reportMonth]);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const renderActiveShape = (props: any) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
      <g>
        <text x={cx} y={cy} dy={8} textAnchor="middle" fill="#f4f4f5" className="text-[10px] font-bold">
          {payload.name}
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          cornerRadius={6}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 6}
          outerRadius={outerRadius + 10}
          fill={fill}
        />
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
        <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
        <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#f4f4f5" className="text-[10px] font-bold">{`KSH ${value.toLocaleString()}`}</text>
        <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={14} textAnchor={textAnchor} fill="#71717a" className="text-[8px]">
          {`(${(percent * 100).toFixed(1)}%)`}
        </text>
      </g>
    );
  };

  const COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b'];

  const currentMonth = format(new Date(), 'MMMM yyyy');

  const finalizeMoveOut = async (request: any) => {
    setProcessingId(request.id);
    try {
      // The server now performs the expense/payment/tenant/unit updates
      // atomically in one transaction, so a failure partway through can't
      // leave the tenant marked active with a refund already recorded.
      await api.serviceRequests.finalizeMoveOut(request.id);
      onRefresh();
    } catch (e: any) {
      console.error(e);
      alert(`Failed to finalize move-out: ${e.message || 'Unknown error'}`);
    } finally {
      setProcessingId(null);
    }
  };
  
  const approvedPayments = filteredPayments.filter((p: any) => p.status === 'APPROVED');
  const totalRevenue = approvedPayments.reduce((sum: number, p: any) => {
    if (p.paymentType === 'MOVE_IN') {
      return sum + (p.amount / 2);
    }
    return sum + (['DEPOSIT', 'REFUND'].includes(p.paymentType) ? 0 : p.amount);
  }, 0);
  const totalExpenses = filteredExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  let rentRevenue = 0;
  let waterRevenue = 0;
  let garbageRevenue = 0;
  let deductionRevenue = 0;

  approvedPayments.forEach((p: any) => {
    if (['DEPOSIT', 'REFUND'].includes(p.paymentType)) return;
    
    if (p.paymentType === 'WATER') waterRevenue += p.amount;
    else if (p.paymentType === 'GARBAGE') garbageRevenue += p.amount;
    else if (p.paymentType === 'REPAIR_DEDUCTION') deductionRevenue += p.amount;
    else if (p.paymentType === 'MOVE_IN') rentRevenue += p.amount / 2;
    else if (p.paymentType === 'RENT') rentRevenue += p.amount;
    else {
      // Treat ALL, GENERAL, or any other type as a lumpsum
      const tenant = tenants.find((t: any) => t.id === p.tenantId);
      // We assume standard utilities for this tenant (or default to 0 if not set)
      const tWater = tenant?.waterBill || 0;
      const tGarbage = tenant?.garbageFee || 0;
      const calcRent = Math.max(0, p.amount - tWater - tGarbage);
      
      rentRevenue += calcRent;
      // The rest of the payment covers the utilities
      const rem = p.amount - calcRent;
      if (rem > 0) {
        // Distribute proportionally or just try to cover water then garbage
        if (rem >= tWater) {
          waterRevenue += tWater;
          garbageRevenue += rem - tWater;
        } else {
          waterRevenue += rem;
        }
      }
    }
  });

  const revenueByTypeRaw = [
    { name: 'Rent', value: rentRevenue },
    { name: 'Water', value: waterRevenue },
    { name: 'Garbage', value: garbageRevenue },
    { name: 'Deductions', value: deductionRevenue },
  ];
  
  const revenueByType = revenueByTypeRaw.filter(item => item.value > 0);

  const handleExportPdf = () => {
    const monthLabel = format(new Date(`${reportMonth}-01`), 'MMMM yyyy');
    const expenseRows = filteredExpenses.map((e: any) =>
      `<tr><td>${format(new Date(e.createdAt), 'dd MMM yyyy')}</td><td>${e.type}</td><td>${e.description || ''}</td><td>${e.unitNumber || '-'}</td><td style="text-align:right">KSH ${e.amount.toLocaleString()}</td></tr>`
    ).join('');
    const paymentRows = filteredPayments.map((p: any) =>
      `<tr><td>${format(new Date(p.createdAt), 'dd MMM yyyy')}</td><td>${p.unitNumber || '-'}</td><td>${p.paymentType}</td><td style="text-align:right">KSH ${p.amount.toLocaleString()}</td></tr>`
    ).join('');

    const html = `
      <html>
        <head>
          <title>Financial Report - ${monthLabel}</title>
          <style>
            body { font-family: -apple-system, Arial, sans-serif; color: #18181b; padding: 32px; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            .subtitle { color: #71717a; font-size: 13px; margin-bottom: 24px; }
            .summary { display: flex; gap: 24px; margin-bottom: 32px; }
            .summary div { border: 1px solid #e4e4e7; border-radius: 8px; padding: 12px 16px; flex: 1; }
            .summary .label { font-size: 10px; text-transform: uppercase; color: #71717a; letter-spacing: 0.05em; }
            .summary .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
            h2 { font-size: 14px; margin-top: 32px; margin-bottom: 8px; border-bottom: 1px solid #e4e4e7; padding-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { text-align: left; color: #71717a; font-weight: 600; padding: 6px 4px; border-bottom: 1px solid #e4e4e7; }
            td { padding: 6px 4px; border-bottom: 1px solid #f4f4f5; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Financial Report</h1>
          <div class="subtitle">${monthLabel}</div>
          <div class="summary">
            <div><div class="label">Revenue</div><div class="value">KSH ${totalRevenue.toLocaleString()}</div></div>
            <div><div class="label">Expenses</div><div class="value">KSH ${totalExpenses.toLocaleString()}</div></div>
            <div><div class="label">Net Profit</div><div class="value">KSH ${netProfit.toLocaleString()}</div></div>
          </div>
          <h2>Payments (${filteredPayments.length})</h2>
          <table>
            <thead><tr><th>Date</th><th>Unit</th><th>Type</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${paymentRows || '<tr><td colspan="4">No payments this period.</td></tr>'}</tbody>
          </table>
          <h2>Expenses (${filteredExpenses.length})</h2>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Unit</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${expenseRows || '<tr><td colspan="5">No expenses this period.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to export the report.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Financial Reports</h3>
        <button onClick={handleExportPdf} className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-all">
          <Download className="h-4 w-4" /> Export PDF
        </button>
      </div>

      <Card className="p-4 bg-zinc-900 border-zinc-800">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase">Search by Tenant, Unit or Ref</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input 
                placeholder="Search..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-100"
              />
            </div>
          </div>
          
          <div className="w-full md:w-48 space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase">Type Filter</label>
            <select 
              value={paymentTypeFilter}
              onChange={e => setPaymentTypeFilter(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100"
            >
              <option value="ALL">All Types</option>
              <option value="RENT">Rent</option>
              <option value="DEPOSIT">Deposit</option>
              <option value="WATER">Water</option>
              <option value="GARBAGE">Garbage</option>
              <option value="MOVE_IN">Move In (Total)</option>
              <option value="REFUND">Refund</option>
              <option value="REPAIR_DEDUCTION">Repair Deduction</option>
              <option value="GENERAL">General / Lumpsum</option>
            </select>
          </div>

          <div className="w-full md:w-48 space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase">Report Month</label>
            <input 
              type="month"
              value={reportMonth}
              onChange={e => setReportMonth(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder-zinc-700 [color-scheme:dark]" 
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 bg-emerald-500/10 border-emerald-500/20">
          <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Total Revenue</div>
          <div className="text-3xl font-bold mt-2 text-emerald-400">KSH {totalRevenue.toLocaleString()}</div>
        </Card>
        <Card className="p-6 bg-red-500/10 border-red-500/20">
          <div className="text-xs font-bold text-red-500 uppercase tracking-wider">Total Expenses</div>
          <div className="text-3xl font-bold mt-2 text-red-400">KSH {totalExpenses.toLocaleString()}</div>
        </Card>
        <Card className="p-6 bg-blue-500/10 border-blue-500/20">
          <div className="text-xs font-bold text-blue-500 uppercase tracking-wider">Net Profit</div>
          <div className="text-3xl font-bold mt-2 text-blue-400">KSH {netProfit.toLocaleString()}</div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6 overflow-visible flex flex-col">
          <h4 className="text-sm font-bold text-zinc-500 uppercase mb-6">Revenue Breakdown</h4>
          <div className="h-72 w-full relative min-h-72">
            {revenueByType.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    data={revenueByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    dataKey="value"
                    onMouseEnter={onPieEnter}
                    stroke="none"
                  >
                    {revenueByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
                No revenue data for this month
              </div>
            )}
          </div>
          {revenueByType.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {revenueByType.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{item.name}</span>
                  <span className="text-[10px] text-zinc-500 ml-auto">KSH {item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 flex flex-col">
          <h4 className="text-sm font-bold text-zinc-500 uppercase mb-6 tracking-widest">Expense Categories</h4>
          <div className="h-64 w-full relative min-h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={[
                  { name: 'Cleaning', value: filteredExpenses.filter((e: any) => e.type === 'CLEANING').reduce((sum: number, e: any) => sum + e.amount, 0), color: '#3b82f6' },
                  { name: 'Electricity', value: filteredExpenses.filter((e: any) => e.type === 'ELECTRICITY').reduce((sum: number, e: any) => sum + e.amount, 0), color: '#eab308' },
                  { name: 'Water', value: filteredExpenses.filter((e: any) => e.type === 'WATER').reduce((sum: number, e: any) => sum + e.amount, 0), color: '#06b6d4' },
                  { name: 'Maintenance', value: filteredExpenses.filter((e: any) => e.type === 'MAINTENANCE').reduce((sum: number, e: any) => sum + e.amount, 0), color: '#f97316' },
                  { name: 'Repairs', value: filteredExpenses.filter((e: any) => e.type === 'REPAIR').reduce((sum: number, e: any) => sum + e.amount, 0), color: '#ef4444' },
                  { name: 'Commission', value: filteredExpenses.filter((e: any) => e.type === 'COMMISSION').reduce((sum: number, e: any) => sum + e.amount, 0), color: '#10b981' },
                  { name: 'Other', value: filteredExpenses.filter((e: any) => e.type === 'OTHER').reduce((sum: number, e: any) => sum + e.amount, 0), color: '#a855f7' },
                ]}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 60, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="#52525b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  cursor={{ fill: '#27272a', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                  labelStyle={{ display: 'none' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {[
                    { name: 'Cleaning', color: '#3b82f6' },
                    { name: 'Electricity', color: '#eab308' },
                    { name: 'Water', color: '#06b6d4' },
                    { name: 'Maintenance', color: '#f97316' },
                    { name: 'Repairs', color: '#ef4444' },
                    { name: 'Commission', color: '#10b981' },
                    { name: 'Other', color: '#a855f7' },
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Move-out Settlements */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-zinc-500 uppercase flex items-center gap-2">
          <LogOut className="h-4 w-4" /> Move-out Settlements
        </h4>
        <div className="bg-zinc-900/50 border border-zinc-900 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-zinc-900/80 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Tenant</th>
                  <th className="px-6 py-4">Unit</th>
                  <th className="px-6 py-4">Assessment Date</th>
                  <th className="px-6 py-4">Repair Costs</th>
                  <th className="px-6 py-4">Excess Paid</th>
                  <th className="px-6 py-4">Total Refund</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {serviceRequests
                  .filter((r: any) => r.type === 'MOVE_OUT' && (r.status === 'RESOLVED' || r.status === 'AWAITING_LANDLORD_APPROVAL'))
                  .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))
                  .map((r: any) => {
                    const tenant = tenants.find((t: any) => t.id === r.tenantId);
                    const isPending = r.status === 'AWAITING_LANDLORD_APPROVAL';
                    return (
                      <tr key={r.id} className="hover:bg-zinc-900/30 transition-all">
                        <td className="px-6 py-4 font-medium">{tenant?.name || 'Unknown'}</td>
                        <td className="px-6 py-4 text-xs text-zinc-400">{tenant?.unitNumber || 'N/A'}</td>
                        <td className="px-6 py-4 text-xs text-zinc-500">{format(new Date(r.agentResolvedAt || r.createdAt), 'MMM d, yyyy')}</td>
                        <td className="px-6 py-4 text-sm text-red-400">KSH {r.repairCosts?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-blue-400">KSH {r.excessPayment?.toLocaleString() || 0}</td>
                        <td className="px-6 py-4 text-sm font-bold text-emerald-400">KSH {r.refundAmount?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          {isPending ? (
                            <button 
                              onClick={() => finalizeMoveOut(r)}
                              disabled={processingId === r.id}
                              className="bg-emerald-500 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase hover:bg-emerald-600 transition-all flex items-center gap-2 ml-auto"
                            >
                              {processingId === r.id && <Loader2 className="h-3 w-3 animate-spin" />}
                              Approve & Finalize
                            </button>
                          ) : (
                            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded text-[10px] font-bold uppercase">Processed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                {serviceRequests.filter((r: any) => r.type === 'MOVE_OUT' && (r.status === 'RESOLVED' || r.status === 'AWAITING_LANDLORD_APPROVAL')).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-zinc-600 text-sm italic">No move-out settlements processed yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MODALS ---

function AgentsTab({ agents, onRefresh }: any) {
  const [showRegister, setShowRegister] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const hasAgent = agents.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Property Agent</h3>
        <button 
          onClick={() => setShowRegister(true)}
          disabled={hasAgent}
          title={hasAgent ? "Only one agent account is supported. Remove the existing agent to register a new one." : undefined}
          className="bg-zinc-100 text-zinc-950 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-100"
        >
          <Plus className="h-4 w-4" /> Register Agent
        </button>
      </div>

      {hasAgent && (
        <div className="text-xs text-zinc-500 -mt-4">
          Only one agent account is supported at a time. Remove the current agent below before registering a replacement.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent: any) => (
          <Card key={agent.id} className="p-5 hover:border-zinc-700 transition-all cursor-pointer" onClick={() => setEditingAgent(agent)}>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-lg">
                {agent.name.charAt(0)}
              </div>
              <div>
                <div className="font-bold">{agent.name}</div>
                <div className="text-xs text-zinc-500">{agent.email}</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase text-zinc-500">Status</span>
              <span className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded text-[10px] font-bold uppercase">Active</span>
            </div>
          </Card>
        ))}
        {agents.length === 0 && (
          <div className="col-span-full py-12 text-center text-zinc-500 italic">
            No agent registered yet.
          </div>
        )}
      </div>

      {showRegister && !hasAgent && <RegisterAgentModal onRefresh={onRefresh} onClose={() => setShowRegister(false)} />}
      {editingAgent && <EditAgentModal agent={editingAgent} onRefresh={onRefresh} onClose={() => setEditingAgent(null)} />}
    </div>
  );
}

function EditAgentModal({ agent, onClose, onRefresh }: any) {
  const [name, setName] = useState(agent.name);
  const [email, setEmail] = useState(agent.email);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.users.update(agent.id, { name, email });
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to remove this agent?")) return;
    
    setLoading(true);
    try {
      await api.users.delete(agent.id);
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-md space-y-6"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold">Edit Agent</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-400">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Full Name</label>
            <input 
              required 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Email Address</label>
            <input 
              required 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" 
            />
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 bg-rose-500/10 text-rose-500 py-3 rounded-lg text-sm font-semibold hover:bg-rose-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="h-4 w-4" /> Remove
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-[2] bg-emerald-500 text-black py-3 rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function RegisterAgentModal({ onClose, onRefresh }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.auth.register({ name, email, password, role: 'AGENT' });
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-md space-y-6"
      >
        <h3 className="text-xl font-bold">Register New Agent</h3>
        <p className="text-zinc-500 text-sm">Create an account for your property agent. They will use these credentials to sign in.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Full Name</label>
            <input 
              required 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" 
              placeholder="Agent Name" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Email Address</label>
            <input 
              required 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" 
              placeholder="agent@example.com" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Set Password</label>
            <input 
              required 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" 
              placeholder="••••••••" 
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-300">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-zinc-100 text-zinc-950 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Register Agent
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ImportResultsSummary({ results }: { results: ImportRowResult[] }) {
  const created = results.filter(r => r.status === 'created').length;
  const updated = results.filter(r => r.status === 'updated').length;
  const errors = results.filter(r => r.status === 'error');

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm">
        <span className="text-emerald-500 font-semibold">{created} created</span>
        <span className="text-blue-400 font-semibold">{updated} updated</span>
        <span className={errors.length > 0 ? "text-red-500 font-semibold" : "text-zinc-600"}>{errors.length} failed</span>
      </div>
      {errors.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-1 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
          {errors.map((r, i) => (
            <div key={i} className="text-xs text-red-400">
              Row {r.row} ({r.label}): {r.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecordsTab({ units, tenants, expenses, onRefresh }: any) {
  const [section, setSection] = useState<'tenants' | 'water' | 'expenses' | 'payments' | 'danger'>('tenants');

  const sections = [
    { id: 'tenants', label: 'Tenants & Units' },
    { id: 'water', label: 'Water Readings' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'payments', label: 'Payments' },
    { id: 'danger', label: 'Danger Zone' },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold">Bulk Import & Records</h3>
        <p className="text-sm text-zinc-500">Upload CSV files to bulk-create or update records.</p>
      </div>

      <div className="flex gap-2 border-b border-zinc-800 pb-px overflow-x-auto">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-t-lg transition-colors ${
              section === s.id
                ? (s.id === 'danger' ? 'text-red-500 border-b-2 border-red-500' : 'text-zinc-100 border-b-2 border-zinc-100')
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'tenants' && <TenantImportSection units={units} tenants={tenants} onRefresh={onRefresh} />}
      {section === 'water' && <WaterReadingsImportSection units={units} tenants={tenants} onRefresh={onRefresh} />}
      {section === 'expenses' && <ExpensesImportSection onRefresh={onRefresh} />}
      {section === 'payments' && <PaymentsImportSection tenants={tenants} expenses={expenses} onRefresh={onRefresh} />}
      {section === 'danger' && <DangerZoneSection />}
    </div>
  );
}

function TenantImportSection({ units, tenants, onRefresh }: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [defaultMonth, setDefaultMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [preview, setPreview] = useState<any[] | null>(null);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);

  const parseRow = (rawRow: any, index: number) => {
    const row = normalizeCsvRow(rawRow);

    const unitNumber = row['unitnumber'] || row['unit no.'] || row['unit no'] || row['unit'];
    const nameObj = rawRow['name'] || rawRow['Tenant Name'] || row['tenant name'] || row['name'];
    const name = nameObj ? nameObj.toString().toUpperCase() : '';
    const email = row['email'] || row['email address'];
    const phone = row['phone'] || row['phone number'];
    const moveInDate = row['moveindate'] || row['date of occupation'];
    const rentAmountObj = row['rentamount'] || row['rent amount'] || row['rent'];
    const depositAmount = row['depositamount'] || row['deposit amount'];
    const pastPayments = row['pastpaymentsamount'] || row['payments'];
    const totalBalance = row['totalbalance'] || row['balance'];
    const entryDate = row['pastpaymentdate'] || row['entry date'];

    if (!unitNumber) {
      return { index, valid: false, reason: 'Missing unit number', unitNumber, name };
    }

    const existingUnit = units.find((u: any) => (u.unitNumber || '').toLowerCase() === unitNumber.toString().toLowerCase());
    const hasRealEmail = !!email;
    const generatedEmail = hasRealEmail ? email.toString().toLowerCase() : `${(name || 'tenant').replace(/\s+/g, '').toLowerCase()}@tenant.com`;

    const existingTenant = hasRealEmail
      ? tenants.find((t: any) => (t.email || '').toLowerCase() === generatedEmail)
      : tenants.find((t: any) => t.status === 'ACTIVE' && ((existingUnit && t.unitId === existingUnit.id) || (t.unitNumber || '').toLowerCase() === unitNumber.toString().toLowerCase()));

    return {
      index,
      valid: true,
      unitNumber: unitNumber.toString(),
      unitAction: existingUnit ? 'use existing' : 'create',
      name,
      tenantAction: name ? (existingTenant ? 'update' : 'create') : 'skip (no name)',
      generatedEmail,
      hasRealEmail,
      phone,
      moveInDate,
      rentAmountObj,
      depositAmount,
      pastPayments,
      totalBalance,
      entryDate,
      existingTenantId: existingTenant?.id,
    };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setResults(null);
    setLoading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parseResults) => {
        try {
          const rows = (parseResults.data as any[]).map((r, i) => parseRow(r, i));
          setPreview(rows);
        } catch (err: any) {
          setError(err.message || 'Failed to parse CSV file');
        } finally {
          setLoading(false);
        }
      },
      error: (err) => {
        setError(err.message);
        setLoading(false);
      }
    });
  };

  const confirmImport = async () => {
    if (!preview) return;
    setLoading(true);
    const rowResults: ImportRowResult[] = [];
    let currentTenants = [...tenants];
    let currentUnits = [...units];

    for (const row of preview) {
      const label = row.name || row.unitNumber || `row ${row.index + 1}`;
      if (!row.valid) {
        rowResults.push({ row: row.index + 1, label, status: 'error', message: row.reason });
        continue;
      }
      try {
        let unit = currentUnits.find((u: any) => (u.unitNumber || '').toLowerCase() === row.unitNumber.toLowerCase());
        let rentEst = 10000;
        if (row.rentAmountObj) rentEst = parseCsvNumber(row.rentAmountObj);
        else if (row.depositAmount) rentEst = parseCsvNumber(row.depositAmount);

        if (!unit) {
          const newUnitData = { unitNumber: row.unitNumber, type: '1 Bedroom', rentAmount: rentEst, waterReading: 0, status: 'VACANT', isActive: 1 };
          const createRes = await api.units.create(newUnitData);
          unit = { ...newUnitData, id: createRes.id };
          currentUnits.push(unit);
        } else if (row.rentAmountObj && parseCsvNumber(row.rentAmountObj) !== unit.rentAmount) {
          await api.units.update(unit.id, { rentAmount: rentEst });
          unit.rentAmount = rentEst;
        }

        if (!row.name) {
          rowResults.push({ row: row.index + 1, label, status: 'created', message: 'Unit only (no tenant name given)' });
          continue;
        }

        const moveInDateParsed = parseCsvDate(row.moveInDate, defaultMonth);
        const isMovedIn = new Date(moveInDateParsed) <= new Date();

        const tenantData = {
          name: row.name,
          email: row.generatedEmail,
          phone: row.phone ? row.phone.toString() : '',
          role: 'TENANT',
          unitNumber: unit.unitNumber,
          unitId: unit.id,
          rentAmount: unit.rentAmount,
          totalBalance: parseCsvNumber(row.totalBalance),
          depositAmount: parseCsvNumber(row.depositAmount),
          waterReading: unit.waterReading || 0,
          waterBill: 0,
          garbageFee: 0,
          isMovedIn,
          moveInDate: moveInDateParsed,
          status: 'ACTIVE'
        };

        let tenant = row.existingTenantId ? currentTenants.find((t: any) => t.id === row.existingTenantId) : null;
        let wasUpdate = !!tenant;
        if (tenant) {
          await api.users.update(tenant.id, tenantData);
        } else {
          tenant = await api.auth.register(tenantData);
          currentTenants.push(tenant);
        }

        await api.units.update(unit.id, { status: 'OCCUPIED', currentTenantId: tenant.id });

        const paymentAmount = parseCsvPaymentString(row.pastPayments);
        if (paymentAmount > 0) {
          await api.payments.create({
            tenantId: tenant.id,
            amount: paymentAmount,
            paymentType: 'GENERAL',
            paymentMethod: 'SYSTEM',
            referenceCode: `IMPORTED_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            status: 'APPROVED',
            notes: `Imported past payment for ${defaultMonth}`,
            createdAt: parseCsvDate(row.entryDate, defaultMonth)
          });
        }

        rowResults.push({ row: row.index + 1, label, status: wasUpdate ? 'updated' : 'created' });
      } catch (rowErr: any) {
        // Isolated per row — one bad row doesn't abort the rest of the batch.
        rowResults.push({ row: row.index + 1, label, status: 'error', message: rowErr.message || 'Unknown error' });
      }
    }

    setResults(rowResults);
    setPreview(null);
    setLoading(false);
    onRefresh();
  };

  const downloadTemplate = () => {
    const template = 'name,email,phone,unitNumber,rentAmount,depositAmount,totalBalance,moveInDate,pastPaymentsAmount,pastPaymentDate\nLUCY JUDE,namujude@gmail.com,725441751,SHOP,16000,30000,0,01/12/2024,16000,12/04/2026';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tenants_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const validCount = preview?.filter(r => r.valid).length || 0;
  const invalidCount = (preview?.length || 0) - validCount;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-3xl space-y-6">
      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">
        <p className="font-semibold mb-1">How it works:</p>
        <ul className="list-disc pl-4 space-y-1 text-xs text-emerald-500/80">
          <li>If a <strong>Unit no.</strong> doesn't exist, it will be automatically created.</li>
          <li>If a <strong>Tenant Name</strong> is provided, they will be assigned.</li>
          <li>Past payments are automatically parsed.</li>
          <li>Dates in the CSV like <strong>DD/MM/YYYY</strong> are supported.</li>
          <li>You'll see a preview before anything is written — nothing is imported until you confirm.</li>
        </ul>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-zinc-400 uppercase block">Default Month / Context</label>
        <input
          type="month"
          value={defaultMonth}
          onChange={(e) => setDefaultMonth(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-700"
        />
        <p className="text-xs text-zinc-500">This month is used if specific payment dates are missing from the CSV.</p>
      </div>

      <button
        type="button"
        onClick={downloadTemplate}
        className="w-full bg-zinc-800 text-zinc-300 border border-zinc-700 py-3 rounded-lg text-sm font-semibold hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
      >
        <Download className="h-4 w-4" /> Download Example CSV Template
      </button>

      {error && <div className="p-3 bg-red-500/10 text-red-500 rounded border border-red-500/20 text-sm font-semibold">{error}</div>}

      {!preview && !results && (
        <div className="space-y-2 mt-4">
          <label className="text-sm font-bold text-zinc-400 uppercase block">Upload CSV File</label>
          <label className="flex flex-col items-center justify-center w-full h-40 px-4 transition bg-zinc-950 border-2 border-zinc-800 border-dashed rounded-xl appearance-none cursor-pointer hover:border-zinc-600 focus:outline-none">
            <span className="flex flex-col items-center space-y-2">
              <Database className="w-8 h-8 text-zinc-600" />
              <span className="font-medium text-zinc-500">{loading ? 'Parsing...' : 'Click to Browse or Drag & Drop'}</span>
              <span className="text-xs text-zinc-600">.csv files only</span>
            </span>
            <input type="file" accept=".csv" className="hidden" disabled={loading} onChange={handleFileSelect} />
          </label>
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="text-zinc-300 font-semibold">{preview.length} rows parsed</span>
              {invalidCount > 0 && <span className="text-red-500 ml-2">({invalidCount} will fail — missing unit number)</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreview(null)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Cancel</button>
              <button onClick={confirmImport} disabled={loading || validCount === 0} className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Confirm Import ({validCount} rows)
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto border border-zinc-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-950">
                <tr className="text-zinc-500 uppercase tracking-widest">
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {preview.map((r) => (
                  <tr key={r.index} className={!r.valid ? 'text-red-500' : 'text-zinc-300'}>
                    <td className="px-3 py-2">{r.index + 1}</td>
                    <td className="px-3 py-2">{r.unitNumber || '—'}</td>
                    <td className="px-3 py-2">{r.name || '—'}</td>
                    <td className="px-3 py-2">
                      {!r.valid ? r.reason : `${r.unitAction} unit, ${r.tenantAction} tenant`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results && (
        <div className="space-y-4">
          <ImportResultsSummary results={results} />
          <button onClick={() => setResults(null)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Import Another File</button>
        </div>
      )}
    </div>
  );
}

function WaterReadingsImportSection({ units, tenants, onRefresh }: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<any>(null);
  const [importMonth, setImportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [preview, setPreview] = useState<any[] | null>(null);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);

  useEffect(() => { api.config.get().then(setConfig).catch(() => {}); }, []);

  const parseRow = (rawRow: any, index: number) => {
    const row = normalizeCsvRow(rawRow);
    const unitNumber = row['unitnumber'] || row['unit'] || row['unit no'];
    const presentReadingRaw = row['presentreading'] || row['present reading'] || row['reading'];
    const rateRaw = row['rate'];
    const readingDate = row['readingdate'] || row['date'];

    if (!unitNumber) return { index, valid: false, reason: 'Missing unit number' };
    if (presentReadingRaw === undefined || presentReadingRaw === '') return { index, valid: false, reason: 'Missing present reading', unitNumber };

    const unit = units.find((u: any) => (u.unitNumber || '').toLowerCase() === unitNumber.toString().toLowerCase());
    if (!unit) return { index, valid: false, reason: `Unit "${unitNumber}" not found`, unitNumber };

    const tenant = tenants.find((t: any) => t.status === 'ACTIVE' && (t.unitId === unit.id || t.unitNumber === unit.unitNumber));
    const previousReading = unit.waterReading || 0;
    const presentReading = parseCsvNumber(presentReadingRaw);
    const rate = rateRaw ? parseCsvNumber(rateRaw) : (config?.waterRate || 100);
    const consumption = Math.max(0, presentReading - previousReading);
    const amount = consumption * rate;

    if (presentReading < previousReading) {
      return { index, valid: false, reason: `Present (${presentReading}) is less than previous (${previousReading})`, unitNumber };
    }

    return {
      index, valid: true, unitNumber: unit.unitNumber, unitId: unit.id,
      tenantId: tenant?.id, tenantName: tenant?.name || '(no active tenant)',
      previousReading, presentReading, rate, consumption, amount,
      // A per-row date column always wins; otherwise every row in this
      // batch falls back to the selected Import Month rather than "now" —
      // essential for backfilling a past month's readings.
      readingDate: parseCsvDate(readingDate, importMonth),
    };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setResults(null); setLoading(true);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (parseResults) => {
        try {
          setPreview((parseResults.data as any[]).map((r, i) => parseRow(r, i)));
        } catch (err: any) {
          setError(err.message || 'Failed to parse CSV file');
        } finally { setLoading(false); }
      },
      error: (err) => { setError(err.message); setLoading(false); }
    });
  };

  const confirmImport = async () => {
    if (!preview) return;
    setLoading(true);
    const validRows = preview.filter(r => r.valid);
    try {
      const { results: apiResults } = await api.waterReadings.bulkImport(validRows.map((r: any) => ({
        tenantId: r.tenantId, unitNumber: r.unitNumber, type: 'TENANT',
        previousReading: r.previousReading, presentReading: r.presentReading,
        consumption: r.consumption, rate: r.rate, amount: r.amount, createdAt: r.readingDate,
      })));

      const rowResults: ImportRowResult[] = preview.map((r) => {
        if (!r.valid) return { row: r.index + 1, label: r.unitNumber || `row ${r.index + 1}`, status: 'error', message: r.reason };
        const idx = validRows.indexOf(r);
        const apiResult = apiResults[idx];
        return apiResult?.success
          ? { row: r.index + 1, label: r.unitNumber, status: 'created' }
          : { row: r.index + 1, label: r.unitNumber, status: 'error', message: apiResult?.error || 'Unknown error' };
      });

      setResults(rowResults);
      setPreview(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Bulk import failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = 'unitNumber,presentReading,rate,readingDate\nA1,145,100,01/08/2026';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'water_readings_import_template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const validCount = preview?.filter(r => r.valid).length || 0;
  const invalidCount = (preview?.length || 0) - validCount;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-3xl space-y-6">
      <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-sm text-cyan-400">
        <p className="font-semibold mb-1">How it works:</p>
        <ul className="list-disc pl-4 space-y-1 text-xs text-cyan-500/80">
          <li>Previous reading is looked up automatically from each unit's current reading.</li>
          <li>Rate defaults to the property's configured water rate if not given in the CSV.</li>
          <li>Rows without a readingDate column use the Import Month below — set it to the past month you're backfilling.</li>
          <li>This does NOT auto-generate invoices — use "Generate Invoices" once you're ready, since these readings may be backfilled for a past period.</li>
        </ul>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-zinc-400 uppercase block">Import Month</label>
        <input
          type="month"
          value={importMonth}
          onChange={(e) => setImportMonth(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-700"
        />
        <p className="text-xs text-zinc-500">Used for any row that doesn't specify its own readingDate — set this to the month you're backfilling.</p>
      </div>

      <button type="button" onClick={downloadTemplate} className="w-full bg-zinc-800 text-zinc-300 border border-zinc-700 py-3 rounded-lg text-sm font-semibold hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
        <Download className="h-4 w-4" /> Download Example CSV Template
      </button>

      {error && <div className="p-3 bg-red-500/10 text-red-500 rounded border border-red-500/20 text-sm font-semibold">{error}</div>}

      {!preview && !results && (
        <div className="space-y-2 mt-4">
          <label className="flex flex-col items-center justify-center w-full h-40 px-4 transition bg-zinc-950 border-2 border-zinc-800 border-dashed rounded-xl appearance-none cursor-pointer hover:border-zinc-600 focus:outline-none">
            <span className="flex flex-col items-center space-y-2">
              <Droplets className="w-8 h-8 text-zinc-600" />
              <span className="font-medium text-zinc-500">{loading ? 'Parsing...' : 'Click to Browse or Drag & Drop'}</span>
              <span className="text-xs text-zinc-600">.csv files only</span>
            </span>
            <input type="file" accept=".csv" className="hidden" disabled={loading} onChange={handleFileSelect} />
          </label>
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="text-zinc-300 font-semibold">{preview.length} rows parsed</span>
              {invalidCount > 0 && <span className="text-red-500 ml-2">({invalidCount} will be skipped)</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreview(null)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Cancel</button>
              <button onClick={confirmImport} disabled={loading || validCount === 0} className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Confirm Import ({validCount} rows)
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto border border-zinc-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-950">
                <tr className="text-zinc-500 uppercase tracking-widest">
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">Prev → Present</th>
                  <th className="px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {preview.map((r) => (
                  <tr key={r.index} className={!r.valid ? 'text-red-500' : 'text-zinc-300'}>
                    <td className="px-3 py-2">{r.index + 1}</td>
                    <td className="px-3 py-2">{r.unitNumber || '—'}</td>
                    <td className="px-3 py-2">{r.valid ? r.tenantName : (r.reason)}</td>
                    <td className="px-3 py-2">{r.valid ? `${r.previousReading} → ${r.presentReading}` : '—'}</td>
                    <td className="px-3 py-2">{r.valid ? `KSH ${r.amount.toLocaleString()}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results && (
        <div className="space-y-4">
          <ImportResultsSummary results={results} />
          <button onClick={() => setResults(null)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Import Another File</button>
        </div>
      )}
    </div>
  );
}

const EXPENSE_IMPORT_TYPES = ['CLEANING', 'ELECTRICITY', 'WATER', 'MAINTENANCE', 'REPAIR', 'OTHER'];

function ExpensesImportSection({ onRefresh }: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importMonth, setImportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [preview, setPreview] = useState<any[] | null>(null);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);

  const parseRow = (rawRow: any, index: number) => {
    const row = normalizeCsvRow(rawRow);
    const date = row['date'];
    const typeRaw = (row['type'] || '').toString().toUpperCase();
    const description = rawRow['description'] || rawRow['Description'] || row['description'] || '';
    const amountRaw = row['amount'];
    const unitNumber = row['unitnumber'] || row['unit'];

    if (!EXPENSE_IMPORT_TYPES.includes(typeRaw)) {
      return { index, valid: false, reason: `Unrecognized type "${typeRaw || '(blank)'}" — must be one of ${EXPENSE_IMPORT_TYPES.join(', ')}` };
    }
    const amount = parseCsvNumber(amountRaw);
    if (amount <= 0) return { index, valid: false, reason: 'Amount must be greater than 0', type: typeRaw };

    return {
      index, valid: true, type: typeRaw, description: description.toString(),
      amount, unitNumber: unitNumber ? unitNumber.toString() : undefined,
      // A per-row date column always wins; otherwise every row in this
      // batch falls back to the selected Import Month rather than "now".
      date: parseCsvDate(date, importMonth),
    };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setResults(null); setLoading(true);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (parseResults) => {
        try {
          setPreview((parseResults.data as any[]).map((r, i) => parseRow(r, i)));
        } catch (err: any) {
          setError(err.message || 'Failed to parse CSV file');
        } finally { setLoading(false); }
      },
      error: (err) => { setError(err.message); setLoading(false); }
    });
  };

  const confirmImport = async () => {
    if (!preview) return;
    setLoading(true);
    const rowResults: ImportRowResult[] = [];
    for (const row of preview) {
      const label = row.type ? `${row.type} - ${row.description || ''}`.trim() : `row ${row.index + 1}`;
      if (!row.valid) {
        rowResults.push({ row: row.index + 1, label, status: 'error', message: row.reason });
        continue;
      }
      try {
        await api.expenses.create({
          type: row.type,
          description: row.description || `Imported ${row.type.toLowerCase()} expense`,
          amount: row.amount,
          unitNumber: row.unitNumber,
          status: 'APPROVED',
          createdAt: row.date,
        });
        rowResults.push({ row: row.index + 1, label, status: 'created' });
      } catch (rowErr: any) {
        rowResults.push({ row: row.index + 1, label, status: 'error', message: rowErr.message || 'Unknown error' });
      }
    }
    setResults(rowResults);
    setPreview(null);
    setLoading(false);
    onRefresh();
  };

  const downloadTemplate = () => {
    const template = 'date,type,description,amount,unitNumber\n01/08/2026,CLEANING,Common area cleaning,3000,';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'expenses_import_template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const validCount = preview?.filter(r => r.valid).length || 0;
  const invalidCount = (preview?.length || 0) - validCount;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-3xl space-y-6">
      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-400">
        <p className="font-semibold mb-1">How it works:</p>
        <ul className="list-disc pl-4 space-y-1 text-xs text-amber-500/80">
          <li>Type must be one of: {EXPENSE_IMPORT_TYPES.join(', ')}.</li>
          <li>Rows without a date column use the Import Month below — set it to the past month you're backfilling.</li>
          <li>Imported expenses are marked Approved — this is for your own historical records, not requests awaiting review.</li>
          <li>Commission expenses can't be bulk-imported — those must go through the agent's request flow.</li>
        </ul>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-zinc-400 uppercase block">Import Month</label>
        <input
          type="month"
          value={importMonth}
          onChange={(e) => setImportMonth(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-700"
        />
        <p className="text-xs text-zinc-500">Used for any row that doesn't specify its own date — set this to the month you're backfilling.</p>
      </div>

      <button type="button" onClick={downloadTemplate} className="w-full bg-zinc-800 text-zinc-300 border border-zinc-700 py-3 rounded-lg text-sm font-semibold hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
        <Download className="h-4 w-4" /> Download Example CSV Template
      </button>

      {error && <div className="p-3 bg-red-500/10 text-red-500 rounded border border-red-500/20 text-sm font-semibold">{error}</div>}

      {!preview && !results && (
        <div className="space-y-2 mt-4">
          <label className="flex flex-col items-center justify-center w-full h-40 px-4 transition bg-zinc-950 border-2 border-zinc-800 border-dashed rounded-xl appearance-none cursor-pointer hover:border-zinc-600 focus:outline-none">
            <span className="flex flex-col items-center space-y-2">
              <Receipt className="w-8 h-8 text-zinc-600" />
              <span className="font-medium text-zinc-500">{loading ? 'Parsing...' : 'Click to Browse or Drag & Drop'}</span>
              <span className="text-xs text-zinc-600">.csv files only</span>
            </span>
            <input type="file" accept=".csv" className="hidden" disabled={loading} onChange={handleFileSelect} />
          </label>
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="text-zinc-300 font-semibold">{preview.length} rows parsed</span>
              {invalidCount > 0 && <span className="text-red-500 ml-2">({invalidCount} will fail)</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreview(null)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Cancel</button>
              <button onClick={confirmImport} disabled={loading || validCount === 0} className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Confirm Import ({validCount} rows)
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto border border-zinc-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-950">
                <tr className="text-zinc-500 uppercase tracking-widest">
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {preview.map((r) => (
                  <tr key={r.index} className={!r.valid ? 'text-red-500' : 'text-zinc-300'}>
                    <td className="px-3 py-2">{r.index + 1}</td>
                    <td className="px-3 py-2">{r.type || '—'}</td>
                    <td className="px-3 py-2">{r.valid ? (r.description || '—') : r.reason}</td>
                    <td className="px-3 py-2">{r.valid ? `KSH ${r.amount.toLocaleString()}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results && (
        <div className="space-y-4">
          <ImportResultsSummary results={results} />
          <button onClick={() => setResults(null)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Import Another File</button>
        </div>
      )}
    </div>
  );
}

const PAYMENT_IMPORT_TYPES = ['RENT', 'WATER', 'GARBAGE', 'DEPOSIT', 'MOVE_IN', 'GENERAL'];

function PaymentsImportSection({ tenants, expenses, onRefresh }: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importMonth, setImportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [preview, setPreview] = useState<any[] | null>(null);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);

  // Months that already have a commission request on file — importing a
  // payment dated into one of these will change that period's commission
  // total the next time it's viewed, since commission is computed live.
  const commissionPeriods = useMemo(() => {
    const periods = new Set<string>();
    (expenses || []).filter((e: any) => e.type === 'COMMISSION').forEach((e: any) => {
      try {
        const meta = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata;
        if (meta?.month && meta?.year) periods.add(`${meta.year}-${String(meta.month).padStart(2, '0')}`);
      } catch {}
    });
    return periods;
  }, [expenses]);

  const parseRow = (rawRow: any, index: number) => {
    const row = normalizeCsvRow(rawRow);
    const unitNumber = row['unitnumber'] || row['unit'];
    const email = row['email'];
    const amountRaw = row['amount'];
    const typeRaw = (row['paymenttype'] || row['type'] || '').toString().toUpperCase();
    const paymentMethod = (row['paymentmethod'] || row['method'] || 'SYSTEM').toString().toUpperCase();
    const referenceCode = row['referencecode'] || row['reference'];
    const date = row['date'];
    const notes = rawRow['notes'] || rawRow['Notes'] || row['notes'];

    if (!unitNumber && !email) return { index, valid: false, reason: 'Missing unit number or email' };
    if (!PAYMENT_IMPORT_TYPES.includes(typeRaw)) {
      return { index, valid: false, reason: `Unrecognized type "${typeRaw || '(blank)'}" — must be one of ${PAYMENT_IMPORT_TYPES.join(', ')}` };
    }
    const amount = parseCsvNumber(amountRaw);
    if (amount <= 0) return { index, valid: false, reason: 'Amount must be greater than 0' };

    const tenant = email
      ? tenants.find((t: any) => (t.email || '').toLowerCase() === email.toString().toLowerCase())
      : tenants.find((t: any) => (t.unitNumber || '').toLowerCase() === unitNumber.toString().toLowerCase());

    if (!tenant) return { index, valid: false, reason: `No tenant found for ${email || unitNumber}` };

    // A per-row date column always wins; otherwise every row in this batch
    // falls back to the selected Import Month rather than "now" — this also
    // matters for the commission-period check right below, which would
    // otherwise always compare against today's date for undated rows.
    const parsedDate = parseCsvDate(date, importMonth);
    const period = format(new Date(parsedDate), 'yyyy-MM');
    const commissionWarning = commissionPeriods.has(period)
      ? `Commission for ${format(new Date(parsedDate), 'MMMM yyyy')} has already been requested — this payment will change that total.`
      : undefined;

    return {
      index, valid: true, tenantId: tenant.id, tenantName: tenant.name, unitNumber: tenant.unitNumber,
      amount, paymentType: typeRaw, paymentMethod, referenceCode, notes: notes ? notes.toString() : undefined,
      date: parsedDate, commissionWarning,
    };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setResults(null); setLoading(true);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (parseResults) => {
        try {
          setPreview((parseResults.data as any[]).map((r, i) => parseRow(r, i)));
        } catch (err: any) {
          setError(err.message || 'Failed to parse CSV file');
        } finally { setLoading(false); }
      },
      error: (err) => { setError(err.message); setLoading(false); }
    });
  };

  const confirmImport = async () => {
    if (!preview) return;
    setLoading(true);
    const rowResults: ImportRowResult[] = [];
    for (const row of preview) {
      const label = row.tenantName || row.unitNumber || `row ${row.index + 1}`;
      if (!row.valid) {
        rowResults.push({ row: row.index + 1, label, status: 'error', message: row.reason });
        continue;
      }
      try {
        await api.payments.create({
          tenantId: row.tenantId,
          amount: row.amount,
          paymentType: row.paymentType,
          paymentMethod: row.paymentMethod,
          referenceCode: row.referenceCode || `IMPORTED_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          status: 'APPROVED',
          notes: row.notes || `Imported payment`,
          createdAt: row.date,
        });
        rowResults.push({ row: row.index + 1, label, status: 'created' });
      } catch (rowErr: any) {
        rowResults.push({ row: row.index + 1, label, status: 'error', message: rowErr.message || 'Unknown error' });
      }
    }
    setResults(rowResults);
    setPreview(null);
    setLoading(false);
    onRefresh();
  };

  const downloadTemplate = () => {
    const template = 'unitNumber,email,amount,paymentType,paymentMethod,referenceCode,date,notes\nA1,,15000,RENT,M-PESA,,01/08/2026,';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'payments_import_template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const validCount = preview?.filter(r => r.valid).length || 0;
  const invalidCount = (preview?.length || 0) - validCount;
  const warningCount = preview?.filter(r => r.valid && r.commissionWarning).length || 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-3xl space-y-6">
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-400">
        <p className="font-semibold mb-1">How it works:</p>
        <ul className="list-disc pl-4 space-y-1 text-xs text-blue-500/80">
          <li>Match a tenant by <strong>unitNumber</strong> or <strong>email</strong> — the tenant must already exist.</li>
          <li>Type must be one of: {PAYMENT_IMPORT_TYPES.join(', ')}.</li>
          <li>Rows without a date column use the Import Month below — set it to the past month you're backfilling.</li>
          <li>Imported payments are marked Approved.</li>
          <li>Rows dated into a month whose commission has already been requested will be flagged — importing will change that total.</li>
        </ul>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-zinc-400 uppercase block">Import Month</label>
        <input
          type="month"
          value={importMonth}
          onChange={(e) => setImportMonth(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-zinc-700"
        />
        <p className="text-xs text-zinc-500">Used for any row that doesn't specify its own date — set this to the month you're backfilling.</p>
      </div>

      <button type="button" onClick={downloadTemplate} className="w-full bg-zinc-800 text-zinc-300 border border-zinc-700 py-3 rounded-lg text-sm font-semibold hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2">
        <Download className="h-4 w-4" /> Download Example CSV Template
      </button>

      {error && <div className="p-3 bg-red-500/10 text-red-500 rounded border border-red-500/20 text-sm font-semibold">{error}</div>}

      {!preview && !results && (
        <div className="space-y-2 mt-4">
          <label className="flex flex-col items-center justify-center w-full h-40 px-4 transition bg-zinc-950 border-2 border-zinc-800 border-dashed rounded-xl appearance-none cursor-pointer hover:border-zinc-600 focus:outline-none">
            <span className="flex flex-col items-center space-y-2">
              <CreditCard className="w-8 h-8 text-zinc-600" />
              <span className="font-medium text-zinc-500">{loading ? 'Parsing...' : 'Click to Browse or Drag & Drop'}</span>
              <span className="text-xs text-zinc-600">.csv files only</span>
            </span>
            <input type="file" accept=".csv" className="hidden" disabled={loading} onChange={handleFileSelect} />
          </label>
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="text-zinc-300 font-semibold">{preview.length} rows parsed</span>
              {invalidCount > 0 && <span className="text-red-500 ml-2">({invalidCount} will fail)</span>}
              {warningCount > 0 && <span className="text-amber-500 ml-2">({warningCount} affect an already-requested commission period)</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreview(null)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Cancel</button>
              <button onClick={confirmImport} disabled={loading || validCount === 0} className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Confirm Import ({validCount} rows)
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto border border-zinc-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-950">
                <tr className="text-zinc-500 uppercase tracking-widest">
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {preview.map((r) => (
                  <tr key={r.index} className={!r.valid ? 'text-red-500' : 'text-zinc-300'}>
                    <td className="px-3 py-2">{r.index + 1}</td>
                    <td className="px-3 py-2">{r.valid ? r.tenantName : '—'}</td>
                    <td className="px-3 py-2">{r.paymentType || '—'}</td>
                    <td className="px-3 py-2">{r.valid ? `KSH ${r.amount.toLocaleString()}` : '—'}</td>
                    <td className="px-3 py-2 text-amber-500">{r.valid ? (r.commissionWarning || '') : r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results && (
        <div className="space-y-4">
          <ImportResultsSummary results={results} />
          <button onClick={() => setResults(null)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Import Another File</button>
        </div>
      )}
    </div>
  );
}

function DangerZoneSection() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  return (
    <div className="bg-red-950/10 border border-red-900/50 rounded-xl p-8 w-full max-w-2xl space-y-6">
      <div className="space-y-4">
        <div>
          <h4 className="text-lg font-bold text-red-500 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Danger Zone
          </h4>
          <p className="text-sm text-zinc-400 mt-1">
            Resetting the system will permanently delete all units, tenants, payments, service requests, expenses, and logs. This action cannot be undone. Only your landlord account will remain.
          </p>
        </div>
        {error && <div className="p-3 bg-red-500/10 text-red-500 rounded border border-red-500/20 text-sm font-semibold">{error}</div>}
        {success && <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded border border-emerald-500/20 text-sm font-semibold">{success}</div>}
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={loading}
            className="w-full sm:w-auto bg-red-500/10 text-red-500 border border-red-500/50 px-6 py-3 rounded-lg text-sm font-semibold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Reset Entire System
          </button>
        ) : (
          <div className="space-y-4 p-4 rounded-lg border border-red-500/30 bg-red-500/5">
            <p className="text-sm font-bold text-red-500">Are you ABSOLUTELY sure? ALL data will be lost!</p>
            <div className="flex gap-4">
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    await api.admin.resetSystem();
                    setSuccess("System successfully reset.");
                    setShowResetConfirm(false);
                    setTimeout(() => window.location.reload(), 1500);
                  } catch (e: any) {
                    setError(e.message || "Failed to reset system");
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
              >
                {loading ? 'Resetting...' : 'Yes, Delete Everything'}
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={loading}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddUnitModal({ onClose, onRefresh }: any) {
  const [unitNumber, setUnitNumber] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [waterReading, setWaterReading] = useState('');
  const [type, setType] = useState('1 Bedroom');
  const [loading, setLoading] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.units.create({
        unitNumber,
        type,
        rentAmount: parseFloat(rentAmount),
        waterReading: parseFloat(waterReading) || 0,
        status: 'VACANT'
      });
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-md space-y-6">
        <h3 className="text-xl font-bold">Add New Unit</h3>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Unit Number</label>
            <input required value={unitNumber} onChange={e => setUnitNumber(e.target.value)} className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" placeholder="e.g. A101" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Unit Type</label>
            <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm text-zinc-100">
              <option value="Shop">Shop</option>
              <option value="1 Bedroom">1 Bedroom</option>
              <option value="2 Bedroom">2 Bedroom</option>
              <option value="Bedsitter">Bedsitter</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Monthly Rent (KSH)</label>
            <input required type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" placeholder="e.g. 25000" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Initial Water Meter Reading</label>
            <input required type="number" step="0.01" value={waterReading} onChange={e => setWaterReading(e.target.value)} className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" placeholder="e.g. 100.5" />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-300">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-zinc-100 text-zinc-950 py-2 rounded-lg text-sm font-bold">
              {loading ? 'Adding...' : 'Add Unit'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function EditUnitModal({ unit, onClose, onRefresh }: any) {
  const [unitNumber, setUnitNumber] = useState(unit.unitNumber);
  const [rentAmount, setRentAmount] = useState(unit.rentAmount.toString());
  const [type, setType] = useState(unit.type || '1 Bedroom');
  const [isActive, setIsActive] = useState(unit.isActive !== 0);
  const [loading, setLoading] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.units.update(unit.id, {
        unitNumber,
        type,
        rentAmount: parseFloat(rentAmount),
        isActive: isActive ? 1 : 0
      });
      onRefresh();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-md space-y-6">
        <h3 className="text-xl font-bold">Edit Unit {unit.unitNumber}</h3>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Unit Number</label>
            <input required value={unitNumber} onChange={e => setUnitNumber(e.target.value)} className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Unit Type</label>
            <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm text-zinc-100">
              <option value="Shop">Shop</option>
              <option value="1 Bedroom">1 Bedroom</option>
              <option value="2 Bedroom">2 Bedroom</option>
              <option value="Bedsitter">Bedsitter</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Monthly Rent (KSH)</label>
            <input required type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 mt-4">
            <input 
              type="checkbox" 
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-sm">Unit is Active</span>
          </label>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-300">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-zinc-100 text-zinc-950 py-2 rounded-lg text-sm font-bold">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function UnitDetailsModal({ unit, tenants, payments, onClose }: any) {
  const unitTenant = tenants.find((t: any) => t.unitId === unit.id || t.unitNumber === unit.unitNumber);
  const unitPayments = payments.filter((p: any) => p.tenantId === unitTenant?.id);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-2xl font-bold">Unit {unit.unitNumber}</h3>
            <p className="text-zinc-500 text-sm mt-1">Rent: KSH {unit.rentAmount?.toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-4">
            <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Current Tenant</h4>
            {unitTenant ? (
              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                <div className="font-semibold">{unitTenant.name}</div>
                <div className="text-xs text-zinc-500">{unitTenant.email}</div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400">Security Deposit</span>
                    <span className="font-bold text-emerald-400">
                      KSH {unitTenant.depositAmount?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400">Current Balance</span>
                    <span className={`font-bold ${unitTenant.totalBalance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      KSH {unitTenant.totalBalance?.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-500 text-sm italic">
                Unit is currently vacant.
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Payment History</h4>
            <div className="space-y-2">
              {unitPayments.slice(0, 5).map((p: any) => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs">
                  <div>
                    <div className="font-medium">{p.paymentType}</div>
                    <div className="text-zinc-600">{format(new Date(p.createdAt), 'MMM d, yyyy')}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">KSH {p.amount.toLocaleString()}</div>
                    <div className={`font-bold uppercase text-[8px] ${p.status === 'APPROVED' ? 'text-green-500' : 'text-yellow-500'}`}>{p.status}</div>
                  </div>
                </div>
              ))}
              {unitPayments.length === 0 && <div className="text-zinc-600 text-xs italic">No payments recorded.</div>}
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}

// --- HELPERS ---

function StatCard({ icon, label, value, sub }: any) {
  return (
    <Card className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-zinc-800 rounded-lg">{icon}</div>
      </div>
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {sub && <div className="text-[10px] mt-1 text-zinc-600 font-medium">{sub}</div>}
      </div>
    </Card>
  );
}

function Card({ children, className, onClick }: any) {
  return (
    <div onClick={onClick} className={`bg-zinc-900 border border-zinc-800 rounded-xl ${className}`}>
      {children}
    </div>
  );
}

function TenantDetailsModal({ tenant, onClose, onRefresh }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: tenant.name,
    phone: tenant.phone || '',
    totalBalance: tenant.totalBalance || 0,
    depositAmount: tenant.depositAmount || 0,
    waterReading: tenant.waterReading || 0,
    status: tenant.status,
    isMovedIn: tenant.isMovedIn
  });

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.users.update(tenant.id, formData);
      onRefresh();
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert('Failed to update tenant details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-lg space-y-8 relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-zinc-500 hover:text-zinc-100 transition-colors">
          <X className="h-6 w-6" />
        </button>
        
        <div>
          <h3 className="text-2xl font-bold tracking-tight">Tenant Details</h3>
          <p className="text-zinc-500 text-sm mt-1">
            {isEditing ? 'Update resident information and financial records.' : 'Full registration information for this resident.'}
          </p>
        </div>

        {isEditing ? (
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Full Name</label>
                <input 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Phone</label>
                <input 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Balance (Debt)</label>
                <input 
                  type="number"
                  value={formData.totalBalance}
                  onChange={e => setFormData({...formData, totalBalance: parseFloat(e.target.value)})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:ring-1 focus:ring-red-500/50"
                  step="0.01"
                />
                <p className="text-[10px] text-zinc-600 leading-relaxed">
                  Editing this mid-month will also change this tenant's contribution to the agent's
                  commission for the current period, since commission is calculated from this balance.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Security Deposit</label>
                <input 
                  type="number"
                  value={formData.depositAmount}
                  onChange={e => setFormData({...formData, depositAmount: parseFloat(e.target.value)})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:ring-1 focus:ring-emerald-500/50"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Water Reading</label>
                <input 
                  type="number"
                  value={formData.waterReading}
                  onChange={e => setFormData({...formData, waterReading: parseFloat(e.target.value)})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:ring-1 focus:ring-emerald-500/50"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Occupancy Status</label>
                <select 
                  value={formData.status}
                  onChange={e => {
                    const newStatus = e.target.value;
                    const updates: any = { status: newStatus };
                    if (newStatus === 'INACTIVE') {
                      updates.isMovedIn = false;
                    }
                    setFormData({...formData, ...updates});
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">MOVED OUT / INACTIVE</option>
                  <option value="EVICTED">EVICTED</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Move-in Status</label>
                <div className="flex items-center gap-2 mt-2">
                  <input 
                    type="checkbox"
                    disabled={formData.status === 'INACTIVE'}
                    checked={formData.isMovedIn}
                    onChange={e => setFormData({...formData, isMovedIn: e.target.checked})}
                    className="h-4 w-4 rounded border-zinc-800 bg-zinc-950 text-zinc-100 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span className={`text-sm font-medium ${formData.status === 'INACTIVE' ? 'text-zinc-600' : 'text-zinc-300'}`}>
                    Tenant has moved in
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={loading}
                className="flex-1 bg-zinc-100 text-zinc-950 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-8">
          <div className="space-y-6">
            <section className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Personal Info</label>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-800 rounded-lg"><Users className="h-4 w-4 text-zinc-400" /></div>
                  <div>
                    <div className="text-sm font-semibold">{tenant.name}</div>
                    <div className="text-[10px] text-zinc-500 uppercase">Full Name</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-800 rounded-lg"><Mail className="h-4 w-4 text-zinc-400" /></div>
                  <div>
                    <div className="text-sm font-semibold text-wrap break-all">{tenant.email}</div>
                    <div className="text-[10px] text-zinc-500 uppercase">Email Address</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-800 rounded-lg"><Phone className="h-4 w-4 text-zinc-400" /></div>
                  <div>
                    <div className="text-sm font-semibold">{tenant.phone || 'Not Provided'}</div>
                    <div className="text-[10px] text-zinc-500 uppercase">Mobile Number</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Lease Status</label>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${tenant.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-400'}`}>
                  {tenant.status}
                </span>
                {tenant.status === 'ACTIVE' && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${tenant.isMovedIn ? 'bg-blue-500/10 text-blue-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                    {tenant.isMovedIn ? 'MOVED IN' : 'PENDING MOVE-IN'}
                  </span>
                )}
                {tenant.status === 'INACTIVE' && (
                  <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 rounded text-[10px] font-bold uppercase">
                    LEASE ENDED
                  </span>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Financial Summary</label>
              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-4">
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase font-bold">Monthly Rent</div>
                  <div className="text-lg font-bold text-zinc-100">KSH {tenant.rentAmount?.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase font-bold">Security Deposit</div>
                  <div className="text-lg font-bold text-emerald-500">KSH {tenant.depositAmount?.toLocaleString() || 0}</div>
                </div>
                <div className="pt-2 border-t border-zinc-900">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold">Current Balance</div>
                  <div className={`text-xl font-black ${tenant.totalBalance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    KSH {tenant.totalBalance?.toLocaleString()}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Property Location</div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <DoorOpen className="h-4 w-4 text-zinc-500" />
                Unit {tenant.unitNumber || 'N/A'}
              </div>
            </section>
          </div>
        </div>

        <div className="text-[10px] text-zinc-600 text-center pt-4 border-t border-zinc-800">
          Registered on {format(new Date(tenant.createdAt || Date.now()), 'MMMM do, yyyy')}
        </div>

        <div className="flex gap-3 pt-4">
          <button 
            onClick={() => setIsEditing(true)}
            className="flex-1 bg-zinc-800 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-zinc-700 transition-all"
          >
            <Wrench className="h-4 w-4" /> Edit Details
          </button>
        </div>
      </>
    )}
  </motion.div>
</div>
);
}

function CommissionReviewModal({ expense, onClose, onApprove }: any) {
  let meta: any = {};
  if (expense.metadata) {
    try {
      meta = typeof expense.metadata === 'string' ? JSON.parse(expense.metadata) : expense.metadata;
    } catch(e) {}
  }

  const breakdown = meta.breakdown || [];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold">Review Commission Request</h3>
            <p className="text-zinc-500 text-sm mt-1">{expense.description}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6 p-4 bg-zinc-900 rounded-xl flex justify-between items-center border border-zinc-800">
            <div className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Total Requested</div>
            <div className="text-3xl font-bold text-emerald-400 tracking-tighter">KSH {expense.amount.toLocaleString()}</div>
          </div>
          <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 px-1">Included verified rent payments</h4>
          {breakdown.length === 0 ? (
            <p className="text-zinc-500 italic text-sm">No details provided.</p>
          ) : (
            <div className="space-y-3">
              {breakdown.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-4 bg-zinc-900/50 rounded-lg border border-zinc-800/50 hover:bg-zinc-800/50 transition-colors">
                  <div>
                    <div className="font-bold text-zinc-200">{item.tenantName || 'Unknown Tenant'} <span className="text-xs text-zinc-500 font-normal ml-2 bg-zinc-800 px-2 py-0.5 rounded">Unit {item.unitNumber}</span></div>
                    <div className="text-xs text-zinc-500 mt-2 font-mono">{format(new Date(item.date), 'MMM d, yyyy h:mm a')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-400 font-medium">Rent Portion: KSH {item.rentPortion?.toLocaleString()}</div>
                    <div className="text-sm font-bold text-emerald-400 mt-1">Comm: KSH {item.commission?.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex gap-4 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 text-zinc-400 font-bold hover:text-white transition bg-zinc-800 hover:bg-zinc-700 rounded-xl">
            Close
          </button>
          {expense.status === 'PENDING' && (
            <button 
              onClick={onApprove}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl py-3 transition flex justify-center items-center gap-2"
            >
              <Check className="h-5 w-5" /> Approve Commission
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function XCircle({ className }: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>;
}

function generateChartData(payments: any[], expenses: any[]) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const last6Months = [];
  const now = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = months[d.getMonth()];
    const start = startOfMonth(d);
    const end = endOfMonth(d);

    const approvedPayments = payments.filter((p: any) => p.status === 'APPROVED' && isWithinInterval(parseISO(p.createdAt), { start, end }));
    
    const revenue = approvedPayments
      .filter((p: any) => !['DEPOSIT', 'REFUND'].includes(p.paymentType))
      .reduce((sum: number, p: any) => {
        if (p.paymentType === 'MOVE_IN') return sum + (p.amount / 2);
        return sum + p.amount;
      }, 0);

    const deposits = approvedPayments
      .filter((p: any) => p.paymentType === 'DEPOSIT' || p.paymentType === 'MOVE_IN')
      .reduce((sum: number, p: any) => {
        if (p.paymentType === 'MOVE_IN') return sum + (p.amount / 2);
        return sum + p.amount;
      }, 0);

    const monthlyEx = expenses
      .filter((e: any) => isWithinInterval(parseISO(e.createdAt), { start, end }))
      .reduce((sum: number, e: any) => sum + e.amount, 0);

    last6Months.push({ name: monthName, revenue, deposits, expenses: monthlyEx });
  }
  
  return last6Months;
}

function PaymentsTab({ payments, tenants, units, onRefresh }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const filteredPayments = useMemo(() => {
    const filtered = payments.filter((p: any) => {
      const tenant = tenants.find((t: any) => t.id === p.tenantId);
      const tenantName = (tenant?.name || '').toLowerCase();
      const unitNumber = (tenant?.unitNumber || '').toLowerCase();
      const refCode = (p.referenceCode || '').toLowerCase();
      const searchMatch = tenantName.includes(searchTerm.toLowerCase()) || 
                          unitNumber.includes(searchTerm.toLowerCase()) || 
                          refCode.includes(searchTerm.toLowerCase());
      
      const typeMatch = paymentTypeFilter === 'ALL' || 
        (paymentTypeFilter === 'RENT_OR_DEPOSIT' ? ['RENT', 'DEPOSIT'].includes(p.paymentType) : p.paymentType === paymentTypeFilter);

      let dateMatch = true;
      if (dateRange.start) {
        dateMatch = dateMatch && new Date(p.createdAt) >= new Date(dateRange.start);
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setDate(endDate.getDate() + 1);
        dateMatch = dateMatch && new Date(p.createdAt) < endDate;
      }

      return searchMatch && typeMatch && dateMatch;
    });
    
    // Sort chronologically by unit number instead of date
    const paymentsWithUnits = filtered.map((p: any) => ({
      ...p,
      unitNumber: tenants.find((t: any) => t.id === p.tenantId)?.unitNumber || ''
    }));
    
    return sortUnitsChronologically(paymentsWithUnits);
  }, [payments, tenants, searchTerm, paymentTypeFilter, dateRange]);

  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [editForm, setEditForm] = useState({ paymentType: '', paymentMethod: '' });

  const handleEditInit = (payment: any) => {
    setEditingPayment(payment.id);
    setEditForm({ paymentType: payment.paymentType, paymentMethod: payment.paymentMethod || 'M-PESA' });
  };

  const handleEditSave = async (id: string) => {
    try {
      await api.payments.update(id, editForm);
      setEditingPayment(null);
      onRefresh();
    } catch (e: any) {
      alert("Error saving: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payments</h2>
          <p className="text-sm text-zinc-500">View and filter all transaction records</p>
        </div>
      </div>

      <Card className="p-4 bg-zinc-900 border-zinc-800">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase">Search by Tenant, Unit or Ref</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input 
                placeholder="Search..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-100"
              />
            </div>
          </div>
          
          <div className="w-full md:w-48 space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase">Payment Type</label>
            <select 
              value={paymentTypeFilter}
              onChange={e => setPaymentTypeFilter(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100"
            >
              <option value="ALL">All Types</option>
              <option value="RENT">Rent</option>
              <option value="RENT_OR_DEPOSIT">Rent & Deposit</option>
              <option value="DEPOSIT">Deposit</option>
              <option value="WATER">Water</option>
              <option value="GARBAGE">Garbage</option>
              <option value="MOVE_IN">Move In (Total)</option>
              <option value="REFUND">Refund</option>
              <option value="REPAIR_DEDUCTION">Repair Deduction</option>
              <option value="GENERAL">General / Lumpsum</option>
            </select>
          </div>
          
          <div className="w-full md:w-36 space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase">Start Date</label>
            <input 
              type="date"
              value={dateRange.start}
              onChange={e => setDateRange({...dateRange, start: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder-zinc-700 [color-scheme:dark]" 
            />
          </div>

          <div className="w-full md:w-36 space-y-1">
            <label className="text-xs font-bold text-zinc-500 uppercase">End Date</label>
            <input 
              type="date"
              value={dateRange.end}
              onChange={e => setDateRange({...dateRange, end: e.target.value})}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder-zinc-700 [color-scheme:dark]" 
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-900 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tenant</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Method</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Ref Code</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredPayments.map((payment: any) => {
                const tenant = tenants.find((t: any) => t.id === payment.tenantId);
                const isEditing = editingPayment === payment.id;
                return (
                  <tr key={payment.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                      {format(new Date(payment.createdAt), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {tenant ? (
                        <div>
                          <div className="text-sm font-medium text-white">{tenant.name}</div>
                          <div className="text-xs text-zinc-500">Unit: {tenant.unitNumber || 'N/A'}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500 italic">Unknown Tenant</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isEditing ? (
                        <select
                          value={editForm.paymentType}
                          onChange={(e) => setEditForm({ ...editForm, paymentType: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100"
                        >
                          <option value="GENERAL">General / Lumpsum</option>
                          <option value="RENT">Rent Only</option>
                          <option value="WATER">Water</option>
                          <option value="GARBAGE">Garbage</option>
                          <option value="MOVE_IN">Move In</option>
                          <option value="DEPOSIT">Security Deposit</option>
                        </select>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-widest bg-zinc-800 text-zinc-300">
                          {payment.paymentType.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isEditing ? (
                        <select
                          value={editForm.paymentMethod}
                          onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100"
                        >
                          <option value="M-PESA">M-PESA</option>
                          <option value="BANK">BANK</option>
                          <option value="CASH">CASH</option>
                        </select>
                      ) : (
                        <span className="text-zinc-400 font-bold text-xs uppercase">{payment.paymentMethod || 'M-PESA'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-zinc-400">
                      {payment.referenceCode || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-400 text-right">
                      Kes {payment.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest ${
                        payment.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' :
                        payment.status === 'REJECTED' ? 'bg-red-500/10 text-red-500' :
                        'bg-amber-500/10 text-amber-500'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingPayment(null)} className="text-zinc-500 hover:text-zinc-300">
                            X
                          </button>
                          <button onClick={() => handleEditSave(payment.id)} className="text-emerald-500 hover:text-emerald-300">
                            Save
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handleEditInit(payment)} className="text-zinc-500 hover:text-zinc-300 transition-colors text-xs font-bold uppercase">
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-500 text-sm">
                    No payments found matching the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function InvoicesTab({ tenants, onRefresh }: any) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchInvoices = async () => {
    try {
      const data = await api.invoices.list();
      setInvoices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const [showConfirm, setShowConfirm] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateMessage(null);
    try {
      const result = await api.invoices.generate();
      setGenerateMessage({ type: 'success', text: `Success! Created ${result.createdCount} new invoices.` });
      fetchInvoices();
      onRefresh();
    } catch (e: any) {
      setGenerateMessage({ type: 'error', text: e.message });
    } finally {
      setGenerating(false);
      setShowConfirm(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    return sortUnitsChronologically(invoices.map((i: any) => ({
      ...i,
      tenantName: tenants.find((t: any) => t.id === i.tenantId)?.name || 'Unknown Tenant',
      unitNumber: tenants.find((t: any) => t.id === i.tenantId)?.unitNumber || i.unitNumber
    }))).filter((i: any) => 
      (i.tenantName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (i.unitNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [invoices, searchTerm, tenants]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <input 
            placeholder="Search by tenant or unit..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-700"
          />
        </div>
        <div className="flex flex-col items-end gap-2">
          {generateMessage ? (
            <div className={`text-sm font-bold flex items-center gap-2 ${generateMessage.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
              {generateMessage.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />} {generateMessage.text}
            </div>
          ) : showConfirm ? (
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <span className="text-xs text-zinc-400">Generate unpaid invoices?</span>
              <button 
                onClick={handleGenerate}
                disabled={generating}
                className="bg-zinc-100 text-zinc-950 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Yes
              </button>
              <button 
                onClick={() => setShowConfirm(false)}
                disabled={generating}
                className="bg-zinc-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-zinc-700 transition-all"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowConfirm(true)}
              className="w-full sm:w-auto bg-zinc-100 text-zinc-950 px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all"
            >
              <Plus className="h-4 w-4" />
              Generate Monthly Invoices
            </button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 font-bold uppercase text-[10px] tracking-widest">
                <th className="px-6 py-4">Tenant / Unit</th>
                <th className="px-6 py-4">Period</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-zinc-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading invoices...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-zinc-500">
                    No invoices found. Generate monthly invoices to get started.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((i: any) => (
                  <tr key={i.id} className="hover:bg-zinc-800/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold whitespace-nowrap">{i.tenantName}</div>
                      <div className="text-[10px] text-zinc-500 uppercase flex items-center gap-1 mt-0.5">
                        <Home className="h-3 w-3" /> {i.unitNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-zinc-300 font-medium">
                        {format(new Date(i.year, i.month - 1), 'MMMM yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-zinc-100">
                      KSH {i.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-zinc-500 font-medium">
                      {i.dueDate ? format(new Date(i.dueDate), 'MMM do, yyyy') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-2 py-1 rounded-[4px] text-[10px] font-black uppercase tracking-tighter ${
                        i.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : 
                        i.status === 'PARTIAL' ? 'bg-amber-500/10 text-amber-500' : 
                        'bg-rose-500/10 text-rose-500'
                      }`}>
                        {i.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
            <AlertCircle className="h-6 w-6 text-amber-500" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-amber-500">Billing Rules</h4>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-2xl">
              Invoices are generated automatically once the last active tenant's water meter reading is
              submitted for the month — not on a fixed calendar schedule. Each invoice includes the base
              Rent, Garbage Fee, and any accrued Water Bills. The system automatically updates the tenant's
              total balance and resets the monthly water bill counter upon generation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuditLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await api.admin.auditLogs();
        setLogs(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return 'text-emerald-400';
    if (action.includes('UPDATE')) return 'text-blue-400';
    if (action.includes('DELETE')) return 'text-rose-400';
    if (action.includes('LOGIN')) return 'text-purple-400';
    return 'text-zinc-400';
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 font-bold uppercase text-[10px] tracking-widest">
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Entity</th>
                <th className="px-6 py-4">Details</th>
                <th className="px-6 py-4 text-right">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-zinc-500 italic">
                    No audit logs recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-zinc-500 font-mono text-[10px]">
                      {log.createdAt ? format(new Date(log.createdAt), 'MMM d, HH:mm:ss') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-200">{log.userEmail || 'System'}</div>
                      <div className="text-[10px] text-zinc-600">ID: {log.userId || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold uppercase text-[10px] tracking-tight ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {log.entityType && (
                        <div className="flex flex-col">
                          <span className="text-xs text-zinc-400">{log.entityType}</span>
                          <span className="text-[9px] text-zinc-600 font-mono">{log.entityId}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="text-[10px] text-zinc-500 line-clamp-2 hover:line-clamp-none transition-all cursor-help break-all">
                        {log.details ? log.details : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-[10px] text-zinc-600">
                      {log.ipAddress || 'Unknown'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}