import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-qr-code';
import { Printer, ArrowLeft, Download } from 'lucide-react';

export default function BatchQRCodes() {
  const { batchId } = useParams();
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [batchInfo, setBatchInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    if (!batchId) return;
    fetch(`/api/medicines/batch/${batchId}/qrcodes`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setQrCodes(data.qrCodes);
          setBatchInfo(data.batchInfo);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [batchId]);

  const handleExportCSV = () => {
    window.location.href = `/api/medicines/batch/${batchId}/qrcodes/export`;
  };

  if (loading) return (
    <div className="flex justify-center p-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8 print:hidden">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="h-6 w-6 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('batchQRCodes.title')}</h1>
            {batchInfo && (
              <p className="text-slate-500">
                {t('batchQRCodes.batchInfo', {
                  name: batchInfo.name,
                  batch_number: batchInfo.batch_number,
                  manufacturer: batchInfo.manufacturer,
                })}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 font-medium transition-colors flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {t('batchQRCodes.exportCSV')}
          </button>
          <button
            onClick={() => window.print()}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 font-medium transition-colors flex items-center gap-2"
          >
            <Printer className="h-5 w-5" />
            {t('batchQRCodes.printLabels')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 print:grid-cols-4 print:gap-4">
        {qrCodes.map((qr) => (
          <div key={qr.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center text-center print:shadow-none print:border-slate-300">
            <div className="bg-white p-2 rounded-lg mb-3">
              <QRCode value={qr.unique_code} size={120} level="H" />
            </div>
            <p className="text-xs font-mono text-slate-500 break-all w-full">{qr.unique_code.substring(0, 12)}...</p>
            <p className="text-xs font-bold text-slate-800 mt-1">{batchInfo?.name}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded mt-1 ${
              qr.status === 'dispensed' ? 'bg-emerald-100 text-emerald-700' :
              qr.status === 'received'  ? 'bg-blue-100 text-blue-700' :
              qr.status === 'shipped'   ? 'bg-amber-100 text-amber-700' :
                                         'bg-slate-100 text-slate-600'
            }`}>
              {t(`batchQRCodes.status${qr.status.charAt(0).toUpperCase() + qr.status.slice(1)}` as any, { defaultValue: qr.status })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
