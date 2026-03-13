import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  Activity, Users, Package, AlertTriangle, CheckCircle,
  ShieldCheck, Truck, TrendingUp, Brain, Loader2, RefreshCw
} from 'lucide-react';

function StatCard({ title, value, icon, bg }: { title: string; value: number | string; icon: React.ReactNode; bg: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
      <div className={`${bg} p-4 rounded-xl`}>{icon}</div>
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

function AdminDashboard({ stats }: { stats: any }) {
  const { t } = useTranslation();
  const [insights, setInsights] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');

  const loadInsights = async () => {
    setInsightsLoading(true);
    setInsightsError('');
    try {
      const r = await fetch('/api/admin/ai-insights', { credentials: 'include' });
      const data = await r.json();
      if (r.ok) setInsights(data.insights);
      else setInsightsError(data.error || t('dashboard.admin.insightsErrorFallback'));
    } catch {
      setInsightsError(t('dashboard.admin.insightsErrorFallback'));
    } finally {
      setInsightsLoading(false);
    }
  };

  const resolveAlert = async (alertId: number) => {
    await fetch(`/api/dashboard/alerts/${alertId}/resolve`, { method: 'POST', credentials: 'include' });
    window.location.reload();
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={t('dashboard.admin.registeredPharmacies')} value={stats.totalPharmacies}   icon={<Users className="h-6 w-6 text-blue-600" />}    bg="bg-blue-50" />
        <StatCard title={t('dashboard.admin.registeredMedicines')}  value={stats.totalMedicines}    icon={<Package className="h-6 w-6 text-emerald-600" />} bg="bg-emerald-50" />
        <StatCard title={t('dashboard.admin.totalScans')}           value={stats.totalScans}        icon={<Activity className="h-6 w-6 text-indigo-600" />} bg="bg-indigo-50" />
        <StatCard title={t('dashboard.admin.suspiciousScans')}      value={stats.suspiciousScans}   icon={<AlertTriangle className="h-6 w-6 text-rose-600" />} bg="bg-rose-50" />
        <StatCard title={t('dashboard.admin.distributors')}         value={stats.totalDistributors} icon={<Truck className="h-6 w-6 text-amber-600" />}    bg="bg-amber-50" />
        <StatCard title={t('dashboard.admin.totalBatches')}         value={stats.totalBatches}      icon={<Package className="h-6 w-6 text-violet-600" />}  bg="bg-violet-50" />
        <StatCard title={t('dashboard.admin.qrCodesGenerated')}     value={stats.totalQRCodes}      icon={<TrendingUp className="h-6 w-6 text-teal-600" />} bg="bg-teal-50" />
        <StatCard title={t('dashboard.admin.unresolvedAlerts')}     value={stats.unresolvedAlerts}  icon={<AlertTriangle className="h-6 w-6 text-orange-600" />} bg="bg-orange-50" />
      </div>

      {/* AI Insights */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-indigo-50 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-500" />
            {t('dashboard.admin.aiInsightsTitle')}
          </h2>
          <button
            onClick={loadInsights}
            disabled={insightsLoading}
            className="text-sm text-violet-600 hover:text-violet-800 flex items-center gap-1 font-medium disabled:opacity-50"
          >
            {insightsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {insights ? t('dashboard.admin.refreshInsights') : t('dashboard.admin.generateInsights')}
          </button>
        </div>
        <div className="p-6">
          {!insights && !insightsLoading && !insightsError && (
            <p className="text-slate-500 text-sm">{t('dashboard.admin.insightsPlaceholder')}</p>
          )}
          {insightsLoading && (
            <div className="flex items-center gap-3 text-violet-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{t('dashboard.admin.analysingPatterns')}</span>
            </div>
          )}
          {insightsError && <p className="text-rose-600 text-sm">{insightsError}</p>}
          {insights && (
            <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{insights}</pre>
          )}
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            {t('dashboard.admin.recentAlerts')}
          </h2>
          <Link to="/admin/users" className="text-sm text-emerald-600 hover:underline font-medium">
            {t('dashboard.admin.manageUsers')}
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {stats.recentAlerts?.length > 0 ? (
            stats.recentAlerts.map((alert: any) => (
              <div key={alert.id} className={`p-4 flex items-start gap-4 ${alert.is_resolved ? 'opacity-50' : 'hover:bg-slate-50'}`}>
                <div className={`p-2 rounded-full flex-shrink-0 ${alert.is_resolved ? 'bg-slate-100' : 'bg-rose-100'}`}>
                  <AlertTriangle className={`h-4 w-4 ${alert.is_resolved ? 'text-slate-400' : 'text-rose-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 font-medium text-sm">{alert.message}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                    <span>Code: <code className="bg-slate-100 px-1 rounded">{alert.unique_code?.substring(0, 8)}...</code></span>
                    <span>{new Date(alert.created_at).toLocaleString()}</span>
                  </div>
                </div>
                {!alert.is_resolved && (
                  <button
                    onClick={() => resolveAlert(alert.id)}
                    className="text-xs text-emerald-600 hover:text-emerald-800 font-medium whitespace-nowrap"
                  >
                    {t('dashboard.admin.resolve')}
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500">{t('dashboard.admin.noAlerts')}</div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Distributor Dashboard ────────────────────────────────────────────────────

function DistributorDashboard({ stats }: { stats: any }) {
  const { t } = useTranslation();

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title={t('dashboard.distributor.totalBatches')}      value={stats.totalBatches}   icon={<Package className="h-6 w-6 text-emerald-600" />} bg="bg-emerald-50" />
        <StatCard title={t('dashboard.distributor.totalQRCodes')}       value={stats.totalQRCodes}   icon={<Activity className="h-6 w-6 text-blue-600" />}    bg="bg-blue-50" />
        <StatCard title={t('dashboard.distributor.batchesInTransit')}   value={stats.shippedBatches} icon={<Truck className="h-6 w-6 text-amber-600" />}      bg="bg-amber-50" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-800">{t('dashboard.distributor.recentBatches')}</h2>
          <Link to="/register-medicine" className="text-sm text-emerald-600 hover:underline font-medium">
            {t('dashboard.distributor.newBatch')}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-3">{t('dashboard.distributor.colMedicine')}</th>
                <th className="px-6 py-3">{t('dashboard.distributor.colBatchNumber')}</th>
                <th className="px-6 py-3">{t('dashboard.distributor.colQty')}</th>
                <th className="px-6 py-3">{t('dashboard.distributor.colExpires')}</th>
                <th className="px-6 py-3">{t('dashboard.distributor.colDispensed')}</th>
                <th className="px-6 py-3">{t('dashboard.distributor.colRegistered')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.recentBatches?.map((batch: any) => (
                <tr key={batch.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{batch.name}</td>
                  <td className="px-6 py-4">
                    <Link to={`/batch/${batch.id}/qrcodes`} className="bg-slate-100 px-2 py-1 rounded text-emerald-700 hover:bg-emerald-50 hover:underline">
                      {batch.batch_number}
                    </Link>
                  </td>
                  <td className="px-6 py-4">{batch.quantity}</td>
                  <td className={`px-6 py-4 ${new Date(batch.expiration_date) < new Date() ? 'text-rose-600 font-medium' : ''}`}>
                    {new Date(batch.expiration_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">{batch.dispensed_count}</td>
                  <td className="px-6 py-4">{new Date(batch.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {(!stats.recentBatches || stats.recentBatches.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">{t('dashboard.distributor.noBatches')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Pharmacy Dashboard ───────────────────────────────────────────────────────

function PharmacyDashboard({ stats }: { stats: any }) {
  const { t } = useTranslation();

  const confirmReceive = async (batchId: number) => {
    const r = await fetch(`/api/medicines/batch/${batchId}/receive`, {
      method: 'POST',
      credentials: 'include',
    });
    if (r.ok) window.location.reload();
    else alert(t('dashboard.pharmacy.failedReceipt'));
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <StatCard title={t('dashboard.pharmacy.totalScans')}    value={stats.totalScans}    icon={<Activity className="h-6 w-6 text-indigo-600" />}  bg="bg-indigo-50" />
        <StatCard title={t('dashboard.pharmacy.dispensedToday')} value={stats.dispensedToday} icon={<CheckCircle className="h-6 w-6 text-emerald-600" />} bg="bg-emerald-50" />
      </div>

      {stats.incomingShipments?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-100 bg-amber-50">
            <h2 className="text-lg font-semibold text-amber-800 flex items-center gap-2">
              <Truck className="h-5 w-5 text-amber-600" />
              {t('dashboard.pharmacy.incomingShipments', { count: stats.incomingShipments.length })}
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {stats.incomingShipments.map((s: any) => (
              <div key={s.id} className="p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{s.medicine_name}</p>
                  <p className="text-sm text-slate-500">
                    {t('dashboard.pharmacy.batch')}: {s.batch_number} · {s.quantity} {t('dashboard.pharmacy.units')} · {t('dashboard.pharmacy.from')}: {s.from_name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{t('dashboard.pharmacy.shipped')}: {new Date(s.shipped_at).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => confirmReceive(s.batch_id)}
                  className="bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 font-medium"
                >
                  {t('dashboard.pharmacy.confirmReceipt')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-800">{t('dashboard.pharmacy.recentScans')}</h2>
          <Link to="/verify" className="text-sm text-emerald-600 hover:underline font-medium">
            {t('dashboard.pharmacy.scanMedicine')}
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {stats.recentScans?.length > 0 ? (
            stats.recentScans.map((scan: any, idx: number) => (
              <div key={idx} className="px-6 py-3 flex items-center gap-4 text-sm">
                <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">{scan.medicine_name}</p>
                  <p className="text-slate-500 text-xs truncate">{scan.unique_code} · {scan.location}</p>
                </div>
                <span className="text-slate-400 text-xs whitespace-nowrap">
                  {new Date(scan.scan_time).toLocaleString()}
                </span>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500">{t('dashboard.pharmacy.noScans')}</div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const endpoints: Record<string, string> = {
      admin: '/api/dashboard/stats',
      distributor: '/api/dashboard/distributor-stats',
      pharmacy: '/api/dashboard/pharmacy-stats',
    };
    const endpoint = user?.role ? endpoints[user.role] : null;

    if (!endpoint) { setLoading(false); return; }

    fetch(endpoint, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return (
    <div className="flex justify-center p-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
    </div>
  );

  const roleLabel = user?.role ? (t(`dashboard.roles.${user.role}`, { defaultValue: user.role }) as string) : '';

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.welcome', { name: user?.name })}</h1>
        <p className="text-slate-500">{t('dashboard.roleDashboard', { role: roleLabel })}</p>
      </div>

      {user?.role === 'admin'       && stats && <AdminDashboard stats={stats} />}
      {user?.role === 'distributor' && stats && <DistributorDashboard stats={stats} />}
      {user?.role === 'pharmacy'    && stats && <PharmacyDashboard stats={stats} />}

      {user?.role === 'patient' && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
          <ShieldCheck className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('dashboard.patient.title')}</h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            {t('dashboard.patient.description')}
          </p>
          <Link to="/verify" className="inline-flex items-center justify-center px-6 py-3 rounded-md text-white bg-emerald-600 hover:bg-emerald-700 font-medium">
            {t('dashboard.patient.scanBtn')}
          </Link>
        </div>
      )}
    </div>
  );
}
