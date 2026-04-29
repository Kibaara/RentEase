import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { 
  LayoutDashboard, Home, Users, CreditCard, Receipt, BarChart3, LogOut, 
  Plus, Search, MoreVertical, TrendingUp, TrendingDown, DollarSign, 
  CheckCircle2, Clock, AlertCircle, Calendar, Download, Wrench, Loader2, Check,
  ChevronLeft, ChevronRight, X, Droplets, Trash2, DoorOpen, Menu, Phone, Mail, FileText,
  Shield, Activity, Globe, Eye, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Sector 
} from 'recharts';

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
          setUnits(data.units);
          setTenants(data.users.filter((u: any) => u.role === 'TENANT'));
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
        setUnits(data.units);
        setTenants(data.users.filter((u: any) => u.role === 'TENANT'));
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
          <NavItem icon={<FileText />} label="Invoices" active={activeTab === 'invoices'} onClick={() => setActiveTab('invoices')} isCollapsed={isCollapsed} />
          <NavItem icon={<BarChart3 />} label="Reports" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} isCollapsed={isCollapsed} />
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
            {activeTab === 'tenants' && <TenantsTab tenants={tenants} payments={payments} onRefresh={refresh} />}
            {activeTab === 'agents' && <AgentsTab agents={agents} onRefresh={refresh} />}
            {activeTab === 'expenses' && <ExpensesTab expenses={expenses} requests={requests} waterReadings={waterReadings} onRefresh={refresh} />}
            {activeTab === 'invoices' && <InvoicesTab tenants={tenants} onRefresh={refresh} />}
            {activeTab === 'reports' && <ReportsTab payments={payments} expenses={expenses} tenants={tenants} serviceRequests={requests} units={units} onRefresh={refresh} />}
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
          const tenant = tenants.find((t: any) => t.id === p.tenantId);
          const rentPortion = tenant ? tenant.rentAmount : (p.amount / 2);
          return sum + rentPortion;
        }
        return sum + p.amount;
      }, 0);

    const totalDeposits = serverStats?.totalDeposits || 0;
    const totalOutstanding = serverStats?.totalBalance || 0;

    const monthlyExpenses = expenses
      .filter((e: any) => isWithinInterval(parseISO(e.createdAt), { start: currentMonth, end: endOfCurrentMonth }))
      .reduce((sum: number, e: any) => sum + e.amount, 0);

    const occupiedUnits = units.filter((u: any) => u.status === 'OCCUPIED').length;
    const vacantUnits = units.filter((u: any) => u.status === 'VACANT').length;
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
          <div className="h-80 w-full relative min-h-[320px]">
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
      u.unitNumber.toLowerCase().includes(searchTerm.toLowerCase())
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
          const tenant = tenants.find((t: any) => t.unitNumber === u.unitNumber && t.status === 'ACTIVE') || 
                         tenants.find((t: any) => t.unitNumber === u.unitNumber);
          return (
            <Card key={u.id} className="p-5 hover:border-zinc-700 transition-all cursor-pointer group relative" onClick={() => setSelectedUnit(u)}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-2xl font-bold">{u.unitNumber}</div>
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
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.status === 'OCCUPIED' ? 'bg-green-500/10 text-green-500' : 'bg-zinc-800 text-zinc-400'}`}>
                    {u.status}
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

function TenantsTab({ tenants, onRefresh }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  
  const activeTenants = useMemo(() => {
    return tenants.filter((t: any) => 
      t.status === 'ACTIVE' && 
      (t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.unitNumber?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [tenants, searchTerm]);

  const movedOutTenants = useMemo(() => {
    return tenants.filter((t: any) => 
      t.status === 'INACTIVE' && 
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
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
  const communalReadings = waterReadings.filter((r: any) => r.type === 'COMMUNAL');
  const tenantReadings = waterReadings.filter((r: any) => r.type === 'TENANT');
  const [selectedCommission, setSelectedCommission] = useState<any>(null);

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
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-zinc-400" /> General Expense History
          </h3>
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

        <section className="space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Droplets className="h-5 w-5 text-cyan-500" /> Communal Water Logs
          </h3>
          <div className="bg-zinc-900 border border-zinc-900 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-zinc-900/80 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-6 py-4">Period</th>
                    <th className="px-6 py-4">Readings (Prev → Pres)</th>
                    <th className="px-6 py-4">Consumption</th>
                    <th className="px-6 py-4 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {communalReadings.map((r: any) => (
                    <tr key={r.id} className="hover:bg-zinc-900/30 transition-all">
                      <td className="px-6 py-4 font-medium text-zinc-400">{format(new Date(r.createdAt), 'MMMM yyyy')}</td>
                      <td className="px-6 py-4 font-mono text-xs text-zinc-500">{r.previousReading} → {r.presentReading}</td>
                      <td className="px-6 py-4 text-zinc-300">{r.consumption} units</td>
                      <td className="px-6 py-4 text-right font-bold text-cyan-400/80 font-mono">KSH {r.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  {communalReadings.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-zinc-600 text-sm">No special water logs found.</td>
                    </tr>
                  )}
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
    </div>
  );
}

function ReportsTab({ payments, expenses, tenants, serviceRequests, units, onRefresh }: any) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

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
      const tenant = tenants.find((t: any) => t.id === request.tenantId);
      if (!tenant) return;

      // 1. Record Repair Cost as Expense
      if (request.repairCosts > 0) {
        await api.expenses.create({
          type: 'REPAIR',
          description: `Move-out repairs for Unit ${tenant.unitNumber} (${tenant.name})`,
          amount: request.repairCosts,
          unitNumber: tenant.unitNumber,
          requestId: request.id
        });
      }

      // 2. Record Refund as a "payment" (excluded from revenue)
      await api.payments.create({
        tenantId: tenant.id,
        amount: request.refundAmount,
        paymentType: 'REFUND',
        status: 'APPROVED',
        referenceCode: `REF-${request.id.slice(0, 5)}`,
        notes: `Deposit refund for ${tenant.name}`
      });

      // 3. Record Repair Deduction as Revenue (to offset the expense)
      if (request.repairCosts > 0) {
        await api.payments.create({
          tenantId: tenant.id,
          amount: request.repairCosts,
          paymentType: 'REPAIR_DEDUCTION',
          status: 'APPROVED',
          referenceCode: `DED-${request.id.slice(0, 5)}`,
          notes: `Repair deduction from deposit for ${tenant.name}`
        });
      }

      // 4. Update Request to RESOLVED
      await api.serviceRequests.update(request.id, { 
        status: 'RESOLVED',
        landlordApprovedAt: new Date().toISOString()
      });

      // 4. Update Tenant to INACTIVE and clear balances/deposits
      await api.users.update(tenant.id, { 
        status: 'INACTIVE', 
        unitNumber: null,
        totalBalance: 0,
        moveOutDate: new Date().toISOString(),
        finalRefundAmount: request.refundAmount,
        finalRepairCosts: request.repairCosts
      });

      // 5. Update Unit to VACANT
      const unit = units.find(u => u.unitNumber === tenant.unitNumber);
      if (unit) {
        await api.units.update(unit.id, { 
          status: 'VACANT', 
          currentTenantId: null 
        });
      }

      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  };
  
  const approvedPayments = payments.filter((p: any) => p.status === 'APPROVED');
  const totalRevenue = approvedPayments.reduce((sum: number, p: any) => {
    if (p.paymentType === 'MOVE_IN') {
      return sum + (p.amount / 2);
    }
    return sum + (['DEPOSIT', 'REFUND'].includes(p.paymentType) ? 0 : p.amount);
  }, 0);
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  const revenueByType = [
    { name: 'Rent', value: approvedPayments.filter((p: any) => p.paymentType === 'RENT' || p.paymentType === 'ALL' || p.paymentType === 'MOVE_IN').reduce((sum: number, p: any) => {
      if (p.paymentType === 'MOVE_IN') return sum + (p.amount / 2);
      return sum + (p.paymentType === 'RENT' || p.paymentType === 'ALL' ? p.amount : 0);
    }, 0) },
    { name: 'Water', value: approvedPayments.filter((p: any) => p.paymentType === 'WATER').reduce((sum: number, p: any) => sum + p.amount, 0) },
    { name: 'Garbage', value: approvedPayments.filter((p: any) => p.paymentType === 'GARBAGE').reduce((sum: number, p: any) => sum + p.amount, 0) },
    { name: 'Deductions', value: approvedPayments.filter((p: any) => p.paymentType === 'REPAIR_DEDUCTION').reduce((sum: number, p: any) => sum + p.amount, 0) },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Monthly Financial Report - {currentMonth}</h3>
        <button className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-all">
          <Download className="h-4 w-4" /> Export PDF
        </button>
      </div>

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
          <div className="h-72 w-full relative min-h-[288px]">
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
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {revenueByType.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{item.name}</span>
                <span className="text-[10px] text-zinc-500 ml-auto">KSH {item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 flex flex-col">
          <h4 className="text-sm font-bold text-zinc-500 uppercase mb-6 tracking-widest">Expense Categories</h4>
          <div className="h-64 w-full relative min-h-[256px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={[
                  { name: 'Cleaning', value: expenses.filter((e: any) => e.type === 'CLEANING').reduce((sum: number, e: any) => sum + e.amount, 0), color: '#3b82f6' },
                  { name: 'Electricity', value: expenses.filter((e: any) => e.type === 'ELECTRICITY').reduce((sum: number, e: any) => sum + e.amount, 0), color: '#eab308' },
                  { name: 'Water', value: expenses.filter((e: any) => e.type === 'WATER').reduce((sum: number, e: any) => sum + e.amount, 0), color: '#06b6d4' },
                  { name: 'Maintenance', value: expenses.filter((e: any) => e.type === 'MAINTENANCE').reduce((sum: number, e: any) => sum + e.amount, 0), color: '#f97316' },
                  { name: 'Commission', value: expenses.filter((e: any) => e.type === 'COMMISSION').reduce((sum: number, e: any) => sum + e.amount, 0), color: '#10b981' },
                  { name: 'Other', value: expenses.filter((e: any) => e.type === 'OTHER').reduce((sum: number, e: any) => sum + e.amount, 0), color: '#a855f7' },
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Property Agents</h3>
        <button 
          onClick={() => setShowRegister(true)}
          className="bg-zinc-100 text-zinc-950 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-zinc-200 transition-all"
        >
          <Plus className="h-4 w-4" /> Register Agent
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent: any) => (
          <Card key={agent.id} className="p-5">
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
            No agents registered yet.
          </div>
        )}
      </div>

      {showRegister && <RegisterAgentModal onRefresh={onRefresh} onClose={() => setShowRegister(false)} />}
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

function AddUnitModal({ onClose, onRefresh }: any) {
  const [unitNumber, setUnitNumber] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [waterReading, setWaterReading] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.units.create({
        unitNumber,
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
  const [loading, setLoading] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.units.update(unit.id, {
        unitNumber,
        rentAmount: parseFloat(rentAmount),
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
            <label className="text-xs font-bold text-zinc-500 uppercase">Monthly Rent (KSH)</label>
            <input required type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" />
          </div>
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
  const unitTenant = tenants.find((t: any) => t.unitNumber === unit.unitNumber);
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
    return invoices.filter((i: any) => 
      i.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      i.unitNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [invoices, searchTerm]);

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
            <h4 className="font-bold text-amber-500">Automated Billing Rules</h4>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-2xl">
              Monthly invoices are automatically generated on the 1st of every month at midnight. 
              Each invoice includes the base Rent, Garbage Fee, and any accrued Water Bills. 
              The system automatically updates the tenant's total balance and resets the monthly water bill counter upon generation.
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
