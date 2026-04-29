import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Home, Droplets, Trash2, DollarSign, Wrench, LogOut, 
  Send, History, AlertCircle, CheckCircle2, Clock, LayoutDashboard, CreditCard,
  ChevronLeft, ChevronRight, Loader2, Shield, DoorOpen, Menu, X, FileText, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

export default function TenantDashboard({ onLogout }: any) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 768);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [tenantData, setTenantData] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = () => setRefreshTrigger(prev => prev + 1);

  // Form states
  const [payType, setPayType] = useState('ALL');
  const [payAmount, setPayAmount] = useState('');
  const [refCode, setRefCode] = useState('');
  const [reqType, setReqType] = useState('REPAIR');
  const [reqDesc, setReqDesc] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);
  const [submittingReq, setSubmittingReq] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: any;

    const loadData = async () => {
      try {
        const [me, dataPayments, dataRequests, history, inv] = await Promise.all([
          api.auth.me(),
          api.payments.list(),
          api.serviceRequests.list(),
          api.waterReadings.list(),
          api.invoices.list()
        ]);

        if (isMounted) {
          setTenantData(me);
          setPayments(dataPayments);
          setRequests(dataRequests);
          setReadings(history);
          setInvoices(inv);
          setLoading(false);
        }
      } catch (e: any) {
        console.error("Error fetching tenant data:", e);
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

  // Manual refresh trigger
  useEffect(() => {
    if (refreshTrigger > 0) {
      Promise.all([
        api.auth.me(),
        api.payments.list(),
        api.serviceRequests.list(),
        api.waterReadings.list(),
        api.invoices.list()
      ]).then(([me, p, req, read, inv]) => {
        setTenantData(me);
        setPayments(p);
        setRequests(req);
        setReadings(read);
        setInvoices(inv);
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

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPay(true);
    try {
      await api.payments.create({
        amount: parseFloat(payAmount),
        paymentType: !tenantData.isMovedIn ? 'MOVE_IN' : payType,
        referenceCode: refCode,
        status: 'PENDING',
        tenantId: tenantData.id
      });
      setPayAmount('');
      setRefCode('');
      refresh();
      alert('Payment submitted for verification.');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingPay(false);
    }
  };

  const handleRequest = async (e: React.FormEvent, typeOverride?: string) => {
    e.preventDefault();
    setSubmittingReq(true);
    const finalType = typeOverride || reqType;
    try {
      await api.serviceRequests.create({
        type: finalType,
        description: reqDesc,
        status: 'PENDING',
        tenantId: tenantData.id
      });
      
      // If it's a move out notice, update the user's moveOutStatus
      if (finalType === 'MOVE_OUT') {
        await api.users.update(tenantData.id, { moveOutStatus: 'PENDING' });
      }

      setReqDesc('');
      refresh();
      alert('Request submitted successfully.');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReq(false);
    }
  };

  if (loading || !tenantData) {
    return <div className="h-screen flex items-center justify-center bg-zinc-950 text-zinc-500">Loading your portal...</div>;
  }

  if (tenantData.moveOutStatus === 'AWAITING_LANDLORD_APPROVAL') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
            <Clock className="h-8 w-8 text-blue-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Assessment Submitted</h1>
            <p className="text-zinc-500 mt-2">
              The agent has completed your move-out assessment. We are now awaiting final approval from the landlord.
            </p>
          </div>
          
          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-left space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Security Deposit</span>
              <span className="font-medium">KSH {tenantData.depositAmount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Repair Deductions</span>
              <span className="font-medium text-red-400">- KSH {tenantData.pendingRepairCosts?.toLocaleString() || 0}</span>
            </div>
            <div className="pt-3 border-t border-zinc-900 flex justify-between items-center">
              <span className="text-sm font-medium text-zinc-300">Estimated Refund</span>
              <span className="text-lg font-bold text-emerald-400">KSH {tenantData.pendingRefundAmount?.toLocaleString()}</span>
            </div>
          </div>

          <p className="text-xs text-zinc-600 italic">
            Once the landlord approves, your unit will be officially vacated and your refund processed.
          </p>

          <button 
            onClick={handleSignOut}
            className="w-full py-3 text-sm text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-lg transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (tenantData.status === 'INACTIVE') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6 text-center">
          <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Move-out Complete</h1>
            <p className="text-zinc-500 mt-2">
              Your move-out has been processed. Below is your final settlement summary.
            </p>
          </div>
          
          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-left space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Security Deposit</span>
              <span className="font-bold">KSH {tenantData.depositAmount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Repair Deductions</span>
              <span className="font-bold text-red-400">- KSH {tenantData.finalRepairCosts?.toLocaleString() || 0}</span>
            </div>
            <div className="pt-3 border-t border-zinc-900 flex justify-between items-center">
              <span className="text-sm font-medium text-zinc-300">Final Refund</span>
              <span className="text-xl font-bold text-emerald-400">KSH {tenantData.finalRefundAmount?.toLocaleString()}</span>
            </div>
          </div>

          <p className="text-xs text-zinc-600 italic">
            The refund will be sent to your registered M-Pesa number within 48 hours. Thank you for staying with us!
          </p>

          <button 
            onClick={handleSignOut}
            className="w-full py-3 text-sm text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-lg transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!tenantData.isMovedIn) {
    const pendingMoveInPayment = payments.find(p => p.status === 'PENDING');

    if (pendingMoveInPayment) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6 text-center">
            <div className="mx-auto w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center">
              <Clock className="h-8 w-8 text-yellow-500 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Verification Pending</h1>
              <p className="text-zinc-500 mt-2">
                We've received your move-in payment (Ref: <span className="text-zinc-300 font-mono">{pendingMoveInPayment.referenceCode}</span>). 
                An agent is currently verifying the transaction.
              </p>
            </div>
            
            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-left space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Status</span>
                <span className="text-yellow-500 font-bold uppercase text-xs">Awaiting Approval</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Amount Submitted</span>
                <span className="font-bold">KSH {pendingMoveInPayment.amount?.toLocaleString()}</span>
              </div>
            </div>

            <p className="text-xs text-zinc-600 italic">
              This process usually takes less than 24 hours. You will gain full access to the portal once approved.
            </p>

            <button 
              onClick={handleSignOut}
              className="w-full py-3 text-sm text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-lg transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6 text-center">
          <div className="mx-auto w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center">
            <Home className="h-8 w-8 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Move-in Pending</h1>
            <p className="text-zinc-500 mt-2">
              To complete your move-in to Unit {tenantData.unitNumber}, you must pay your first month's rent and a security deposit (KSH {tenantData.rentAmount?.toLocaleString()} each).
            </p>
          </div>
          
          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-left space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">First Month Rent</span>
              <span className="font-bold">KSH {tenantData.rentAmount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Security Deposit</span>
              <span className="font-bold">KSH {tenantData.rentAmount?.toLocaleString()}</span>
            </div>
            <div className="pt-2 border-t border-zinc-800 flex justify-between font-bold text-emerald-400">
              <span>Total Required</span>
              <span>KSH {(tenantData.rentAmount * 2).toLocaleString()}</span>
            </div>
          </div>

          <form onSubmit={handlePayment} className="space-y-4 text-left">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Amount Paid (KSH)</label>
              <input 
                type="number" 
                required 
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-zinc-700 outline-none"
                placeholder={(tenantData.rentAmount * 2).toString()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Reference Code</label>
              <input 
                type="text" 
                required 
                value={refCode}
                onChange={e => setRefCode(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-zinc-700 outline-none"
                placeholder="M-Pesa Reference"
              />
            </div>
            <button 
              type="submit" 
              disabled={submittingPay}
              className="w-full bg-zinc-100 text-zinc-950 font-bold py-3 rounded-lg hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
            >
              {submittingPay && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Move-in Payment
            </button>
          </form>

          <button 
            onClick={handleSignOut}
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row font-sans">
      {/* Mobile Top Nav */}
      <div className="md:hidden border-b border-zinc-900 bg-zinc-950 p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <div className="bg-zinc-100 p-1.5 rounded text-zinc-950">
            <Home className="h-5 w-5" />
          </div>
          <span>TenantPortal</span>
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
                { id: 'payments', label: 'Payments', icon: <CreditCard className="h-4 w-4" /> },
                { id: 'invoices', label: 'Invoices', icon: <FileText className="h-4 w-4" /> },
                { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="h-4 w-4" /> },
                { id: 'moveout', label: 'Move Out', icon: <DoorOpen className="h-4 w-4" /> },
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
      <aside className={`hidden md:flex ${isCollapsed ? 'w-20' : 'w-64'} border-r border-zinc-900 flex-col p-4 transition-all duration-300 relative shrink-0`}>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-10 bg-zinc-900 border border-zinc-800 rounded-full p-1 text-zinc-400 hover:text-zinc-100 z-20"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} mb-10 text-xl font-bold tracking-tight`}>
          <div className="bg-zinc-100 p-1.5 rounded text-zinc-950 shrink-0">
            <Home className="h-5 w-5" />
          </div>
          {!isCollapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>TenantPortal</motion.span>}
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={<LayoutDashboard />} label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} isCollapsed={isCollapsed} />
          <NavItem icon={<CreditCard />} label="Payments" active={activeTab === 'payments'} onClick={() => setActiveTab('payments')} isCollapsed={isCollapsed} />
          <NavItem icon={<FileText />} label="Invoices" active={activeTab === 'invoices'} onClick={() => setActiveTab('invoices')} isCollapsed={isCollapsed} />
          <NavItem icon={<Wrench />} label="Maintenance" active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} isCollapsed={isCollapsed} />
          <NavItem icon={<DoorOpen />} label="Move Out" active={activeTab === 'moveout'} onClick={() => setActiveTab('moveout')} isCollapsed={isCollapsed} />
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
      <main className="flex-1 overflow-y-auto p-4 md:p-12">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* Header */}
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight capitalize">{activeTab}</h1>
              <p className="text-zinc-500 mt-2 text-sm md:text-base">Welcome back, <span className="text-zinc-200">{tenantData.name}</span> • Unit {tenantData.unitNumber || 'N/A'}</p>
            </div>
          </header>

          {activeTab === 'overview' && (
            <div className="space-y-10">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                  icon={<Home className="text-blue-400" />} 
                  label="Rent Due" 
                  value={`KSH ${tenantData.rentAmount?.toLocaleString()}`} 
                  sub={`Due for ${format(new Date(), 'MMMM yyyy')}`}
                  tag={payments.some(p => 
                    p.status === 'APPROVED' && 
                    ['RENT', 'ALL', 'MOVE_IN'].includes(p.paymentType) &&
                    format(new Date(p.createdAt), 'yyyy-MM') === format(new Date(), 'yyyy-MM')
                  ) ? 'Paid' : null}
                />
                <StatCard 
                  icon={<Droplets className="text-cyan-400" />} 
                  label="Current Reading" 
                  value={`${tenantData.waterReading || 0}`} 
                  sub={`Month Bill: KSH ${tenantData.waterBill?.toLocaleString()}`}
                />
                <StatCard icon={<Trash2 className="text-green-400" />} label="Garbage Fee" value={`KSH ${tenantData.garbageFee?.toLocaleString()}`} />
                <StatCard 
                  icon={<Shield className="text-emerald-400" />} 
                  label="Security Deposit" 
                  value={`KSH ${tenantData.depositAmount?.toLocaleString() || 0}`} 
                  sub="Refundable on exit"
                />
                <StatCard 
                  icon={<DollarSign className="text-zinc-950" />} 
                  label="Total Balance" 
                  value={`KSH ${tenantData.totalBalance?.toLocaleString()}`} 
                  highlight 
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Activity */}
                <section className="space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <History className="h-5 w-5 text-zinc-400" /> Recent Activity
                  </h3>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="divide-y divide-zinc-800">
                      {payments.length === 0 && (
                        <div className="p-8 text-center text-zinc-600">No recent payments found.</div>
                      )}
                      {payments.slice(0, 5).map(p => (
                        <div key={p.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/30 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-zinc-800 rounded-full">
                              <CreditCard className="h-4 w-4 text-zinc-400" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">
                                Payment: {p.paymentType.replace(/_/g, ' ')}
                              </div>
                              <div className="text-[10px] text-zinc-500">{format(new Date(p.createdAt), 'MMM d, yyyy')} • {p.referenceCode}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold">KSH {p.amount.toLocaleString()}</div>
                            <div className={`text-[10px] font-bold uppercase ${p.status === 'APPROVED' ? 'text-green-500' : p.status === 'PENDING' ? 'text-yellow-500' : 'text-red-500'}`}>
                              {p.status}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Water Usage History */}
                <section className="space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-cyan-500" /> Water Billing History
                  </h3>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="bg-zinc-950/50 text-[10px] uppercase font-bold text-zinc-500 border-b border-zinc-800">
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Prev → Pres</th>
                            <th className="px-4 py-3">Consumption</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {readings.map(r => (
                            <tr key={r.id} className="hover:bg-zinc-800/20">
                              <td className="px-4 py-3 font-medium text-zinc-400">{format(new Date(r.createdAt), 'MMM yyyy')}</td>
                              <td className="px-4 py-3 text-xs text-zinc-500 font-mono">{r.previousReading} <span className="text-zinc-700 mx-1">→</span> {r.presentReading}</td>
                              <td className="px-4 py-3 text-zinc-300 font-bold">{r.consumption} <span className="text-[10px] text-zinc-600 font-normal underline decoration-zinc-800">units</span></td>
                              <td className="px-4 py-3 text-right font-bold text-cyan-400/80">KSH {r.amount.toLocaleString()}</td>
                            </tr>
                          ))}
                          {readings.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-zinc-600 italic">No meter records found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-zinc-400" /> Make a Payment
                  </h3>
                  <form onSubmit={handlePayment} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Payment Type</label>
                      <select 
                        value={payType} 
                        onChange={e => setPayType(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-zinc-700 outline-none"
                      >
                        <option value="ALL">Whole Balance</option>
                        <option value="RENT">Rent Only</option>
                        <option value="WATER">Water Only</option>
                        <option value="GARBAGE">Garbage Only</option>
                        <option value="DEPOSIT">Security Deposit</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Amount (KSH)</label>
                      <input 
                        type="number" 
                        required 
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        placeholder="e.g. 25000"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-zinc-700 outline-none"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Transaction Reference Code</label>
                      <input 
                        type="text" 
                        required 
                        value={refCode}
                        onChange={e => setRefCode(e.target.value)}
                        placeholder="M-Pesa / Bank Reference Code"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-zinc-700 outline-none"
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={submittingPay}
                      className="md:col-span-2 bg-zinc-100 text-zinc-950 font-bold py-3 rounded-lg hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                    >
                      {submittingPay ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Submit Payment
                    </button>
                  </form>
                </section>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <History className="h-5 w-5 text-zinc-400" /> Payment History
                </h3>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
                  <div className="overflow-x-auto">
                    <div className="min-w-[300px]">
                      {payments.map(p => (
                        <div key={p.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/30 transition-all">
                          <div>
                            <div className="text-sm font-medium">{p.paymentType}</div>
                            <div className="text-[10px] text-zinc-500">{format(new Date(p.createdAt), 'MMM d, yyyy')}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold">KSH {p.amount.toLocaleString()}</div>
                            <div className={`text-[10px] font-bold uppercase ${p.status === 'APPROVED' ? 'text-green-500' : 'text-yellow-500'}`}>{p.status}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="space-y-6">
              <section className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-zinc-400" /> Billing History
                </h3>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-zinc-950/50 text-[10px] uppercase font-bold text-zinc-500 border-b border-zinc-800">
                          <th className="px-6 py-4">Period</th>
                          <th className="px-6 py-4">Amount</th>
                          <th className="px-6 py-4">Due Date</th>
                          <th className="px-6 py-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {invoices.map(i => (
                          <tr key={i.id} className="hover:bg-zinc-800/20 transition-all group">
                            <td className="px-6 py-4">
                              <div className="font-bold text-zinc-200">
                                {format(new Date(i.year, i.month - 1), 'MMMM yyyy')}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-zinc-100">
                              KSH {i.totalAmount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-zinc-500">
                              {i.dueDate ? format(new Date(i.dueDate), 'MMM do, yyyy') : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`px-2 py-1 rounded-[4px] text-[10px] font-black uppercase ${
                                i.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : 
                                i.status === 'PARTIAL' ? 'bg-amber-500/10 text-amber-500' : 
                                'bg-rose-500/10 text-rose-500'
                              }`}>
                                {i.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {invoices.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-10 text-center text-zinc-600 italic">No invoices found for your account.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-zinc-800 rounded-xl">
                    <AlertCircle className="h-6 w-6 text-zinc-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-zinc-200">How billing works</h4>
                    <p className="text-zinc-500 text-sm leading-relaxed max-w-2xl">
                      Invoices are generated on the 1st of every month and include your base rent, garbage fee, and water bill from the previous reading. 
                      Please ensure all balances are cleared by the 5th to avoid late fees or service interruptions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-8">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-zinc-400" /> Maintenance / Repair Request
                  </h3>
                  <form onSubmit={(e) => handleRequest(e, 'REPAIR')} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Issue Description</label>
                      <textarea 
                        required 
                        value={reqDesc}
                        onChange={e => setReqDesc(e.target.value)}
                        placeholder="Describe the issue that needs attention..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-zinc-700 outline-none min-h-[120px]"
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={submittingReq}
                      className="w-full bg-zinc-800 text-white font-bold py-3 rounded-lg hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                    >
                      {submittingReq ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                      Submit Repair Request
                    </button>
                  </form>
                </section>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-zinc-400" /> Request Status
                </h3>
                <div className="space-y-3">
                  {requests.filter(r => r.type === 'REPAIR').map(r => (
                    <div key={r.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-start gap-3">
                      <Clock className="h-4 w-4 text-yellow-500 mt-1" />
                      <div>
                        <p className="text-xs text-zinc-300 mt-1 line-clamp-2">{r.description}</p>
                        <div className="text-[10px] text-zinc-600 mt-2">{format(new Date(r.createdAt), 'MMM d, yyyy')}</div>
                      </div>
                    </div>
                  ))}
                  {requests.filter(r => r.type === 'REPAIR').length === 0 && <div className="text-zinc-600 text-sm italic">No repair requests submitted yet.</div>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'moveout' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-8">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <DoorOpen className="h-5 w-5 text-zinc-400" /> Notice to Move Out
                  </h3>
                  <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                    <p className="text-xs text-orange-400 leading-relaxed">
                      Submission of this notice initiates the move-out process. Your agent will review the request and schedule an assessment. 
                      Ensure you provide your preferred move-out date.
                    </p>
                  </div>
                  <form onSubmit={(e) => handleRequest(e, 'MOVE_OUT')} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Move-out Reason & Preferred Date</label>
                      <textarea 
                        required 
                        value={reqDesc}
                        onChange={e => setReqDesc(e.target.value)}
                        placeholder="Provide details about your move-out date and reason..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-zinc-700 outline-none min-h-[120px]"
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={submittingReq}
                      className="w-full bg-rose-600/10 text-rose-500 border border-rose-600/20 font-bold py-3 rounded-lg hover:bg-rose-600/20 transition-all flex items-center justify-center gap-2"
                    >
                      {submittingReq ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
                      Submit Move Out Notice
                    </button>
                  </form>
                </section>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-zinc-400" /> Move Out Status
                </h3>
                <div className="space-y-3">
                  {requests.filter(r => r.type === 'MOVE_OUT').map(r => (
                    <div key={r.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-start gap-3">
                      {r.status === 'PENDING' ? <Clock className="h-4 w-4 text-yellow-500 mt-1" /> : <CheckCircle2 className="h-4 w-4 text-green-500 mt-1" />}
                      <div>
                        <div className={`text-[10px] font-bold uppercase ${r.status === 'PENDING' ? 'text-yellow-500' : 'text-green-500'}`}>{r.status}</div>
                        <p className="text-xs text-zinc-300 mt-1 line-clamp-2">{r.description}</p>
                        <div className="text-[10px] text-zinc-600 mt-2">{format(new Date(r.createdAt), 'MMM d, yyyy')}</div>
                      </div>
                    </div>
                  ))}
                  {requests.filter(r => r.type === 'MOVE_OUT').length === 0 && <div className="text-zinc-600 text-sm italic">No move-out notices submitted yet.</div>}
                </div>
              </div>
            </div>
          )}
        </div>
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

function StatCard({ icon, label, value, sub, highlight, tag }: any) {
  return (
    <div className={`p-6 rounded-2xl border ${highlight ? 'bg-zinc-100 border-zinc-100 text-zinc-950' : 'bg-zinc-900 border-zinc-800 text-zinc-100'} relative overflow-hidden`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg ${highlight ? 'bg-zinc-950/10' : 'bg-zinc-800'}`}>
          {icon}
        </div>
        {tag && (
          <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            {tag}
          </span>
        )}
      </div>
      <div>
        <div className={`text-xs font-bold uppercase tracking-wider ${highlight ? 'text-zinc-600' : 'text-zinc-500'}`}>{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {sub && <div className="text-[10px] mt-1 opacity-60 font-medium">{sub}</div>}
      </div>
    </div>
  );
}
