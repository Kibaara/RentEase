import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { 
  Users, CreditCard, Wrench, Receipt, Settings, LogOut, 
  Plus, Check, X, Droplets, Zap, Brush, MoreVertical, Search,
  ChevronLeft, ChevronRight, Loader2, History, Calculator, DoorOpen, Menu, Phone, Mail, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

export default function AgentDashboard({ onLogout }: any) {
  const [activeTab, setActiveTab] = useState('tenants');
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 768);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({ garbageFee: 0, waterRate: 0 });
  const [billingStatus, setBillingStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { currentMonthRentPaid, commissionBreakdown } = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    
    let total = 0;
    const breakdown: any[] = [];

    payments
      .filter((p: any) => p.status === 'APPROVED' && isWithinInterval(parseISO(p.createdAt), { start, end }))
      .forEach((p: any) => {
        let rentPart = 0;
        const tenant = tenants.find((t: any) => t.id === p.tenantId);
        
        if (p.paymentType === 'RENT') rentPart = p.amount;
        if (p.paymentType === 'ALL') rentPart = Math.min(tenant?.rentAmount || 0, p.amount);
        if (p.paymentType === 'MOVE_IN') rentPart = p.amount / 2;

        if (rentPart > 0) {
          total += rentPart;
          breakdown.push({
            paymentId: p.id,
            tenantName: tenant?.name,
            unitNumber: tenant?.unitNumber,
            rentPortion: rentPart,
            commission: rentPart * 0.06,
            date: p.createdAt
          });
        }
      });
      
    return { currentMonthRentPaid: total, commissionBreakdown: breakdown };
  }, [payments, tenants]);

  const currentMonthCommission = currentMonthRentPaid * 0.06;

  const currentMonthStr = format(new Date(), 'MMMM yyyy');
  const hasRequestedCommission = useMemo(() => {
    return expenses.some(e => e.type === 'COMMISSION' && e.description.includes(currentMonthStr));
  }, [expenses, currentMonthStr]);

  const [requestingCommission, setRequestingCommission] = useState(false);
  const [showCommissionConfirm, setShowCommissionConfirm] = useState(false);
  const [commissionMessage, setCommissionMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  const handleRequestCommission = async () => {
    setRequestingCommission(true);
    setCommissionMessage(null);
    try {
      await api.expenses.create({
        type: 'COMMISSION',
        description: `Agent Commission for ${currentMonthStr}`,
        amount: currentMonthCommission,
        status: 'PENDING',
        metadata: { month: currentMonthStr, breakdown: commissionBreakdown }
      });
      refresh();
      setCommissionMessage({ type: 'success', text: 'Commission request sent to Landlord!' });
    } catch (err: any) {
      setCommissionMessage({ type: 'error', text: err.message || 'Failed to request commission' });
    } finally {
      setRequestingCommission(false);
      setShowCommissionConfirm(false);
    }
  };

  const refresh = () => setRefreshTrigger(prev => prev + 1);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: any;

    const loadData = async () => {
      try {
        const data = await api.dashboard.summary();
        if (isMounted) {
          setTenants(data.users.filter((u: any) => u.role === 'TENANT'));
          setUnits(data.units);
          setPayments(data.payments);
          setRequests(data.requests);
          setExpenses(data.expenses);
          setConfig(data.config);
          setBillingStatus(data.billingStatus);
          setLoading(false);
        }
      } catch (e: any) {
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
      api.dashboard.summary().then(data => {
        setTenants(data.users.filter((u: any) => u.role === 'TENANT'));
        setUnits(data.units);
        setPayments(data.payments);
        setRequests(data.requests);
        setExpenses(data.expenses);
        setConfig(data.config);
        setBillingStatus(data.billingStatus);
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row font-sans">
      {/* Mobile Top Nav */}
      <div className="md:hidden border-b border-zinc-900 bg-zinc-950 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <div className="bg-zinc-100 p-1.5 rounded text-zinc-950">
            <Users className="h-5 w-5" />
          </div>
          <span>AgentPanel</span>
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
                { id: 'tenants', label: 'Tenants', icon: <Users className="h-4 w-4" /> },
                { id: 'payments', label: 'Payments', icon: <CreditCard className="h-4 w-4" /> },
                { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="h-4 w-4" /> },
                { id: 'moveouts', label: 'Move Outs', icon: <DoorOpen className="h-4 w-4" /> },
                { id: 'expenses', label: 'Expenses', icon: <Receipt className="h-4 w-4" /> },
                { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
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
            <Users className="h-5 w-5" />
          </div>
          {!isCollapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>AgentPanel</motion.span>}
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={<Users />} label="Tenants" active={activeTab === 'tenants'} onClick={() => setActiveTab('tenants')} isCollapsed={isCollapsed} />
          <NavItem icon={<CreditCard />} label="Payments" active={activeTab === 'payments'} onClick={() => setActiveTab('payments')} isCollapsed={isCollapsed} />
          <NavItem icon={<Wrench />} label="Maintenance" active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} isCollapsed={isCollapsed} />
          <NavItem icon={<DoorOpen />} label="Move Outs" active={activeTab === 'moveouts'} onClick={() => setActiveTab('moveouts')} isCollapsed={isCollapsed} />
          <NavItem icon={<Receipt />} label="Expenses" active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} isCollapsed={isCollapsed} />
          <NavItem icon={<Settings />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} isCollapsed={isCollapsed} />
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
      <main className="flex-1 overflow-y-auto p-4 md:p-10">
        <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight capitalize">{activeTab}</h2>
            <p className="text-zinc-500 text-sm mt-1">Manage property operations and data entry.</p>
          </div>
          <div className="text-sm text-zinc-500">
            {format(new Date(), 'EEEE, MMMM do')}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card className="p-6">
            <div className="text-zinc-500 text-sm font-semibold mb-2 uppercase tracking-tight">Rent Collected This Month</div>
            <div className="text-3xl font-bold tracking-tighter">KSH {currentMonthRentPaid.toLocaleString()}</div>
          </Card>
          <Card className="p-6 relative">
            <div className="text-zinc-500 text-sm font-semibold mb-2 uppercase tracking-tight">Agent Commission (6%) / {currentMonthStr}</div>
            <div className="text-3xl font-bold tracking-tighter text-emerald-400 mb-4">KSH {currentMonthCommission.toLocaleString()}</div>
            
            {hasRequestedCommission ? (
              <div className="text-sm font-bold text-emerald-500 flex items-center gap-2">
                <Check className="h-4 w-4" /> Commission Request Logged
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {commissionMessage && (
                  <div className={`text-sm font-bold flex items-center justify-between gap-2 px-3 py-2 rounded-lg ${commissionMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    <div className="flex items-center gap-2">
                      {commissionMessage.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />} {commissionMessage.text}
                    </div>
                    {commissionMessage.type === 'error' && (
                      <button onClick={() => setCommissionMessage(null)} className="hover:opacity-70"><X className="h-4 w-4" /></button>
                    )}
                  </div>
                )}
                {commissionMessage?.type !== 'success' && (
                  showCommissionConfirm ? (
                    <div className="flex flex-col gap-3">
                      <p className="text-xs text-zinc-400">Request KSH {currentMonthCommission.toLocaleString()} from Landlord?</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={handleRequestCommission}
                          disabled={requestingCommission}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-900 disabled:text-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          {requestingCommission ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Confirm
                        </button>
                        <button 
                          onClick={() => setShowCommissionConfirm(false)}
                          disabled={requestingCommission}
                          className="flex-1 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        if (billingStatus?.missingReadings > 0) {
                          setCommissionMessage({ type: 'error', text: `Please record all water meter readings (${billingStatus.missingReadings} pending) first.` });
                        } else {
                          setShowCommissionConfirm(true);
                        }
                      }}
                      disabled={currentMonthCommission === 0}
                      className="bg-emerald-500 w-fit hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      Request Commission Approval
                    </button>
                  )
                )}
              </div>
            )}
          </Card>
        </div>

        {billingStatus && billingStatus.missingReadings > 0 && (
          <div className="mb-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-4">
            <div className="bg-blue-500/20 p-2 rounded-lg shrink-0">
              <Droplets className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-blue-400 font-bold flex items-center gap-2">
                Monthly Meter Readings Required
                <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">Action Required</span>
              </h3>
              <p className="text-blue-400/80 text-sm mt-1">
                It's the turn of the month. There are <strong className="text-blue-300">{billingStatus.missingReadings} active tenants</strong> missing water meter readings for {format(new Date(), 'MMMM yyyy')}. 
                Monthly invoices will be generated automatically once all readings are submitted.
              </p>
            </div>
          </div>
        )}
        
        {billingStatus && billingStatus.missingReadings === 0 && !billingStatus.isInvoiced && tenants.filter((t: any) => t.status === 'ACTIVE').length > 0 && (
          <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-4">
            <div className="bg-emerald-500/20 p-2 rounded-lg shrink-0">
              <Check className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-emerald-400 font-bold">All Readings Submitted</h3>
              <p className="text-emerald-400/80 text-sm mt-1">
                All tenant meter readings for {format(new Date(), 'MMMM yyyy')} have been recorded. Monthly invoices are being generated.
              </p>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'tenants' && <TenantsTab tenants={tenants} units={units} config={config} onRefresh={refresh} />}
            {activeTab === 'payments' && <PaymentsTab payments={payments} tenants={tenants} onRefresh={refresh} />}
            {activeTab === 'maintenance' && <MaintenanceTab requests={requests.filter((r: any) => r.type === 'REPAIR')} tenants={tenants} units={units} onRefresh={refresh} />}
            {activeTab === 'moveouts' && <MoveOutsTab requests={requests.filter((r: any) => r.type === 'MOVE_OUT')} tenants={tenants} units={units} onRefresh={refresh} />}
            {activeTab === 'expenses' && <ExpensesTab expenses={expenses} onRefresh={refresh} />}
            {activeTab === 'settings' && <SettingsTab config={config} onRefresh={refresh} />}
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

function TenantsTab({ tenants, units, onRefresh }: any) {
  const [showAdd, setShowAdd] = useState(false);
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
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-zinc-100 text-zinc-950 px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all"
        >
          <Plus className="h-4 w-4" /> Register Tenant
        </button>
      </div>

      {/* Residing Tenants Section */}
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
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-zinc-900/80 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Tenant</th>
                  <th className="px-6 py-4">Unit</th>
                  <th className="px-6 py-4">Water Reading</th>
                  <th className="px-6 py-4">Deposit</th>
                  <th className="px-6 py-4">Balance</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {activeTenants.map((t: any) => (
                  <TenantRow key={t.id} tenant={t} onRefresh={onRefresh} onViewDetails={() => setSelectedTenant(t)} />
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

      {/* Moved Out Section */}
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
            <table className="w-full text-left border-collapse min-w-[600px]">
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
                    <td className="px-6 py-4 text-sm text-red-500/70 font-medium font-mono">- KSH {t.finalRepairCosts?.toLocaleString() || 0}</td>
                    <td className="px-6 py-4 text-sm text-emerald-500/80 font-bold font-mono">KSH {t.finalRefundAmount?.toLocaleString() || 0}</td>
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

      {showAdd && <AddTenantModal units={units} onRefresh={onRefresh} onClose={() => setShowAdd(false)} />}
      {selectedTenant && <TenantDetailsModal tenant={selectedTenant} onClose={() => setSelectedTenant(null)} />}
    </div>
  );
}

function TenantRow({ tenant, onRefresh, onViewDetails }: any) {
  const [showReadingModal, setShowReadingModal] = useState(false);

  return (
    <tr className="hover:bg-zinc-900/30 transition-all group">
      <td className="px-6 py-4">
        <div className="font-medium">{tenant.name}</div>
        <div className="text-xs text-zinc-500">{tenant.email}</div>
      </td>
      <td className="px-6 py-4">
        <span className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-[10px] font-bold">
          {tenant.unitNumber || 'UNASSIGNED'}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="text-sm font-mono text-zinc-400">{tenant.waterReading || 0}</div>
          <button 
            onClick={() => setShowReadingModal(true)}
            className="p-1 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 rounded text-[10px] flex gap-1 items-center transition-all"
          >
            <Plus className="h-3 w-3" /> New Reading
          </button>
        </div>
      </td>
      <td className="px-6 py-4 text-sm font-medium text-emerald-500/80">
        KSH {tenant.depositAmount?.toLocaleString() || 0}
      </td>
      <td className="px-6 py-4">
        <div className={`text-sm font-semibold ${tenant.totalBalance > 0 ? 'text-red-400' : 'text-green-400'}`}>
          KSH {tenant.totalBalance?.toLocaleString()}
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <button 
          onClick={onViewDetails}
          className="text-[10px] font-bold uppercase tracking-tighter text-zinc-500 hover:text-zinc-100 transition-colors"
        >
          View Details
        </button>
        {showReadingModal && (
          <WaterReadingModal 
            target={tenant} 
            type="TENANT" 
            onClose={() => setShowReadingModal(false)} 
            onRefresh={onRefresh} 
          />
        )}
      </td>
    </tr>
  );
}

function PaymentsTab({ payments, tenants, onRefresh }: any) {
  const getTenantName = (id: string) => tenants.find((t: any) => t.id === id)?.name || 'Unknown';

  const sortedPayments = useMemo(() => {
    return [...payments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [payments]);

  const updateStatus = async (payment: any, status: string) => {
    try {
      await api.payments.update(payment.id, { status });
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-900 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-zinc-900/80 text-zinc-500 text-[10px] uppercase tracking-widest font-bold">
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Tenant</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {sortedPayments.map((p: any) => (
              <tr key={p.id} className="hover:bg-zinc-900/30 transition-all">
                <td className="px-6 py-4 text-xs text-zinc-500">
                  {format(new Date(p.createdAt), 'MMM d, h:mm a')}
                </td>
                <td className="px-6 py-4 font-medium">{getTenantName(p.tenantId)}</td>
                <td className="px-6 py-4 text-xs text-zinc-400 uppercase tracking-tighter">
                  {p.paymentType.replace(/_/g, ' ')}
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold underline decoration-zinc-800 underline-offset-4">KSH {p.amount.toLocaleString()}</div>
                  <div className="text-[9px] font-mono text-zinc-600 mt-1 uppercase">{p.referenceCode}</div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      p.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' :
                      p.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' :
                      'bg-rose-500/10 text-rose-500'
                    }`}>
                      {p.status}
                    </span>
                    
                    {p.status === 'PENDING' && (
                      <div className="flex gap-1">
                        <button onClick={() => updateStatus(p, 'APPROVED')} className="p-1.5 hover:bg-emerald-500/20 text-emerald-500 rounded-md transition-all border border-transparent hover:border-emerald-500/30">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => updateStatus(p, 'REJECTED')} className="p-1.5 hover:bg-rose-500/20 text-rose-500 rounded-md transition-all border border-transparent hover:border-rose-500/30">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MaintenanceTab({ requests, tenants, onRefresh }: any) {
  const getTenantName = (id: string) => tenants.find((t: any) => t.id === id)?.name || 'Unknown';

  const resolve = async (request: any) => {
    try {
      await api.serviceRequests.update(request.id, { status: 'RESOLVED' });
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {requests.length === 0 && (
        <div className="text-center py-20 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800 text-zinc-600">
          No pending repair requests.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {requests.map((r: any) => (
          <Card key={r.id} className="bg-zinc-900/50 border-zinc-900">
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Repair Needed</div>
                  <div className="font-semibold mt-1">{getTenantName(r.tenantId)}</div>
                </div>
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                  r.status === 'PENDING' ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'
                }`}>
                  {r.status}
                </span>
              </div>
              <p className="text-sm text-zinc-400 line-clamp-3">{r.description}</p>
              <div className="flex justify-between items-center pt-2">
                <div className="text-[10px] text-zinc-600">{format(new Date(r.createdAt), 'MMM d, h:mm a')}</div>
                {r.status === 'PENDING' && (
                  <button onClick={() => resolve(r)} className="text-xs font-semibold text-zinc-100 hover:underline">
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MoveOutsTab({ requests, tenants, units, onRefresh }: any) {
  const [resolvingMoveOut, setResolvingMoveOut] = useState<any>(null);

  const getTenantName = (id: string) => tenants.find((t: any) => t.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      {requests.length === 0 && (
        <div className="text-center py-20 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800 text-zinc-600">
          No pending move-out notices.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {requests.map((r: any) => (
          <Card key={r.id} className="bg-zinc-900/50 border-zinc-900">
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Notice to Vacate</div>
                  <div className="font-semibold mt-1">{getTenantName(r.tenantId)}</div>
                </div>
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                  r.status === 'PENDING' ? 'bg-orange-500/10 text-orange-500' : 
                  r.status === 'AWAITING_LANDLORD_APPROVAL' ? 'bg-blue-500/10 text-blue-500' :
                  'bg-green-500/10 text-green-500'
                }`}>
                  {r.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-sm text-zinc-400 line-clamp-3">{r.description}</p>
              <div className="flex justify-between items-center pt-2">
                <div className="text-[10px] text-zinc-600">{format(new Date(r.createdAt), 'MMM d, h:mm a')}</div>
                {r.status === 'PENDING' && (
                  <button onClick={() => setResolvingMoveOut(r)} className="text-xs font-semibold text-zinc-100 hover:underline">
                    Assess Move-out
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {resolvingMoveOut && (
        <MoveOutResolutionModal 
          request={resolvingMoveOut} 
          tenant={tenants.find((t: any) => t.id === resolvingMoveOut.tenantId)}
          units={units}
          onRefresh={onRefresh}
          onClose={() => setResolvingMoveOut(null)} 
        />
      )}
    </div>
  );
}

function MoveOutResolutionModal({ request, tenant, units, onRefresh, onClose }: any) {
  const [repairCosts, setRepairCosts] = useState(0);
  const [loading, setLoading] = useState(false);

  const deposit = tenant?.depositAmount || 0;
  const balance = tenant?.totalBalance || 0;
  const refundAmount = Math.max(0, deposit - balance - repairCosts);

  const handleResolve = async () => {
    setLoading(true);
    try {
      // 1. Update the service request
      await api.serviceRequests.update(request.id, {
        status: 'AWAITING_LANDLORD_APPROVAL',
        repairCosts,
        refundAmount,
        agentResolvedAt: new Date().toISOString()
      });

      // 2. Update the tenant record so they see the status change
      await api.users.update(tenant.id, {
        moveOutStatus: 'AWAITING_LANDLORD_APPROVAL',
        pendingRepairCosts: repairCosts,
        pendingRefundAmount: refundAmount
      });

      onRefresh();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-white">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-lg font-bold">Move-out Assessment</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100 transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500 uppercase font-bold">Security Deposit</span>
              <span className="text-zinc-300 font-mono font-bold">KSH {deposit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500 uppercase font-bold">Outstanding Balance</span>
              <span className="text-red-400 font-mono font-bold">KSH {balance.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Repair Costs Deductions</label>
            <input 
              type="number" 
              value={repairCosts} 
              onChange={e => setRepairCosts(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-zinc-700 outline-none text-white"
              placeholder="0.00"
            />
          </div>

          <div className="pt-6 border-t border-zinc-800 flex justify-between items-center">
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Final Refund Amount</div>
              <div className={`text-2xl font-bold ${refundAmount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                KSH {refundAmount.toLocaleString()}
              </div>
            </div>
            <button 
              onClick={handleResolve}
              disabled={loading}
              className="bg-zinc-100 text-zinc-950 px-6 py-2.5 rounded-lg font-bold hover:bg-zinc-200 transition-all flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Assessment
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function WaterReadingModal({ target, type, onClose, onRefresh }: any) {
  const [presentReading, setPresentReading] = useState(0);
  const [previousReading, setPreviousReading] = useState(type === 'TENANT' ? (target?.waterReading || 0) : 0);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    api.config.get().then(setConfig);
    if (type === 'COMMUNAL') {
      api.waterReadings.list({ type: 'COMMUNAL' }).then(readings => {
        if (readings && readings.length > 0) {
          setPreviousReading(readings[0].presentReading);
          setPresentReading(readings[0].presentReading);
        }
      });
    } else {
      setPresentReading(target?.waterReading || 0);
    }
  }, [type, target]);

  const rate = config?.waterRate || 100;
  const consumption = Math.max(0, presentReading - previousReading);
  const totalAmount = consumption * rate;

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (presentReading < previousReading) {
      alert("Present reading cannot be less than previous reading.");
      return;
    }
    setLoading(true);
    try {
      await api.waterReadings.create({
        tenantId: type === 'TENANT' ? target.id : null,
        unitNumber: type === 'TENANT' ? target.unitNumber : 'COMMUNAL',
        type,
        previousReading,
        presentReading,
        consumption,
        rate,
        amount: totalAmount
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-sm space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Calculator className="h-5 w-5 text-cyan-400" />
            {type === 'TENANT' ? 'Tenant Reading' : 'Communal Reading'}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 space-y-2">
          {type === 'TENANT' && (
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Tenant</span>
              <span className="font-bold text-zinc-300">{target?.name} ({target?.unitNumber})</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Previous Reading</span>
            <span className="font-mono text-zinc-300">{previousReading}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-zinc-500">Rate</span>
            <span className="font-mono text-zinc-300">KSH {rate} / unit</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Present Reading</label>
            <input 
              required
              type="number"
              step="0.01"
              value={presentReading}
              onChange={e => setPresentReading(parseFloat(e.target.value) || 0)}
              className="w-full bg-zinc-800 border-none rounded-lg px-4 py-3 text-lg font-mono focus:ring-1 focus:ring-cyan-500/50 outline-none"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
              <div className="text-[10px] font-bold text-zinc-600 uppercase">Consumption</div>
              <div className="text-lg font-bold text-zinc-300">{consumption} <span className="text-[10px] text-zinc-500 font-normal underline decoration-zinc-700">units</span></div>
            </div>
            <div className="p-3 bg-cyan-500/5 rounded-lg border border-cyan-500/10">
              <div className="text-[10px] font-bold text-cyan-700 uppercase">Total Bill</div>
              <div className="text-lg font-bold text-cyan-400">KSH {totalAmount.toLocaleString()}</div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-sm font-semibold text-zinc-500 hover:text-zinc-300">Cancel</button>
            <button 
              type="submit" 
              disabled={loading || presentReading < previousReading}
              className="flex-1 bg-zinc-100 text-zinc-950 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Reading
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ExpensesTab({ expenses, onRefresh }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [showWaterReading, setShowWaterReading] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-3">
        <button 
          onClick={() => setShowWaterReading(true)}
          className="bg-zinc-900 border border-zinc-800 text-zinc-100 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-all"
        >
          <Droplets className="h-4 w-4 text-cyan-400" /> Communal Water Reading
        </button>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-zinc-100 text-zinc-950 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-zinc-200 transition-all"
        >
          <Plus className="h-4 w-4" /> Log Expense
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {expenses.map((e: any) => (
          <Card key={e.id} className="bg-zinc-900/50 border-zinc-900">
            <div className="p-5 space-y-3">
              <div className="flex justify-between items-center">
                <div className="p-2 bg-zinc-800 rounded">
                  {e.type === 'CLEANING' && <Brush className="h-4 w-4 text-blue-400" />}
                  {e.type === 'ELECTRICITY' && <Zap className="h-4 w-4 text-yellow-400" />}
                  {e.type === 'WATER' && <Droplets className="h-4 w-4 text-cyan-400" />}
                  {e.type === 'OTHER' && <Receipt className="h-4 w-4 text-zinc-400" />}
                </div>
                <div className="text-lg font-bold">KSH {e.amount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-500 uppercase">{e.type}</div>
                <div className="text-sm text-zinc-300 mt-1">{e.description || 'No description'}</div>
              </div>
              {e.type === 'ELECTRICITY' && e.tokens && (
                <div className="text-[10px] text-zinc-500">Tokens: {e.tokens}</div>
              )}
              <div className="text-[10px] text-zinc-600 pt-2">{format(new Date(e.createdAt), 'MMM d, yyyy')}</div>
            </div>
          </Card>
        ))}
      </div>

      {showWaterReading && (
        <WaterReadingModal 
          type="COMMUNAL" 
          onClose={() => setShowWaterReading(false)} 
          onRefresh={onRefresh} 
        />
      )}
      {showAdd && <AddExpenseModal onRefresh={onRefresh} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function SettingsTab({ config, onRefresh }: any) {
  const [garbageFee, setGarbageFee] = useState(config.garbageFee || 0);
  const [waterRate, setWaterRate] = useState(config.waterRate || 0);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.config.update({ garbageFee, waterRate });
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md space-y-6">
      <Card className="bg-zinc-900/50 border-zinc-900 p-6 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Common Garbage Fee (KSH)</label>
            <input 
              type="number" 
              value={garbageFee}
              onChange={(e) => setGarbageFee(parseFloat(e.target.value))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Water Rate (KSH per unit)</label>
            <input 
              type="number" 
              value={waterRate}
              onChange={(e) => setWaterRate(parseFloat(e.target.value))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </div>
        </div>
        <button 
          onClick={save}
          disabled={saving}
          className="w-full bg-zinc-100 text-zinc-950 font-semibold py-2 rounded-lg hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Configuration
        </button>
      </Card>
    </div>
  );
}

// --- MODALS ---

function AddTenantModal({ units, onClose, onRefresh }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [unit, setUnit] = useState('');
  const [rent, setRent] = useState(0);
  const [loading, setLoading] = useState(false);

  const vacantUnits = units.filter((u: any) => u.status === 'VACANT');

  const handleUnitChange = (unitNo: string) => {
    setUnit(unitNo);
    const selectedUnit = units.find((u: any) => u.unitNumber === unitNo);
    if (selectedUnit) {
      setRent(selectedUnit.rentAmount);
    }
  };

  const submit = async (e: any) => {
    e.preventDefault();
    if (!unit) return;
    setLoading(true);
    try {
      const selectedUnit = units.find((u: any) => u.unitNumber === unit);
      const tenantData = {
        name, email: email.toLowerCase(), phone, role: 'TENANT', unitNumber: unit, rentAmount: rent,
        totalBalance: rent * 2, // 1 month rent + 1 month deposit
        waterReading: selectedUnit?.waterReading || 0, waterBill: 0, garbageFee: 0,
        depositAmount: 0,
        isMovedIn: false,
        status: 'ACTIVE'
      };
      
      const tenant = await api.auth.register(tenantData);
      
      if (selectedUnit) {
        await api.units.update(selectedUnit.id, { 
          status: 'OCCUPIED',
          currentTenantId: tenant.id
        });
      }
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
        <h3 className="text-xl font-bold">Register New Tenant</h3>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Full Name</label>
            <input required value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Email</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Mobile Number</label>
              <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" placeholder="07..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Select Unit</label>
              <select 
                required 
                value={unit} 
                onChange={e => handleUnitChange(e.target.value)} 
                className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm"
              >
                <option value="">Select Unit</option>
                {vacantUnits.map((u: any) => (
                  <option key={u.id} value={u.unitNumber}>{u.unitNumber}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Monthly Rent</label>
              <input 
                readOnly 
                type="number" 
                value={rent} 
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-lg px-4 py-2 text-sm cursor-not-allowed" 
                placeholder="Select a unit..."
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-300">Cancel</button>
            <button type="submit" disabled={loading || !unit} className="flex-1 bg-zinc-100 text-zinc-950 py-2 rounded-lg text-sm font-bold">
              {loading ? 'Registering...' : 'Register'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function AddExpenseModal({ onClose, onRefresh }: any) {
  const [type, setType] = useState('CLEANING');
  const [amount, setAmount] = useState(0);
  const [desc, setDesc] = useState('');
  const [tokens, setTokens] = useState(0);
  const [loading, setLoading] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.expenses.create({
        type, amount, description: desc, tokens: type === 'ELECTRICITY' ? tokens : null
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
        <h3 className="text-xl font-bold">Log Maintenance Expense</h3>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Expense Type</label>
            <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm">
              <option value="CLEANING">Cleaning</option>
              <option value="ELECTRICITY">Electricity</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Amount (KSH)</label>
            <input required type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" />
          </div>
          {type === 'ELECTRICITY' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Tokens Purchased</label>
              <input required type="number" value={tokens} onChange={e => setTokens(parseFloat(e.target.value))} className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm" />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-zinc-800 border-none rounded-lg px-4 py-2 text-sm min-h-[80px]" />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-300">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-zinc-100 text-zinc-950 py-2 rounded-lg text-sm font-bold">
              {loading ? 'Logging...' : 'Log Expense'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// --- HELPERS ---

function Card({ children, className }: any) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-xl ${className}`}>
      {children}
    </div>
  );
}

function TenantDetailsModal({ tenant, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 w-full max-w-lg space-y-8 relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-zinc-500 hover:text-zinc-100 transition-colors">
          <X className="h-6 w-6" />
        </button>
        
        <div>
          <h3 className="text-2xl font-bold tracking-tight">Tenant Details</h3>
          <p className="text-zinc-500 text-sm mt-1">Full registration information for this resident.</p>
        </div>

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
                    <div className="text-sm font-semibold">{tenant.email}</div>
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
      </motion.div>
    </div>
  );
}


