import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { AlertTriangle, CheckCircle, ScanLine, Info, Clock } from 'lucide-react';

export default function Verify() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    if (scanResult) return;

    let scanner: Html5QrcodeScanner | null = null;
    const timer = setTimeout(() => {
      const el = document.getElementById('reader');
      if (!el) return;
      scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render(
        (text) => {
          setScanResult(text);
          scanner?.clear().catch(() => {});
        },
        () => {}
      );
    }, 100);

    return () => {
      clearTimeout(timer);
      scanner?.clear().catch(() => {});
    };
  }, [scanResult]);

  useEffect(() => {
    if (scanResult) verifyCode(scanResult);
  }, [scanResult]);

  const verifyCode = async (code: string) => {
    setLoading(true);
    setError('');
    try {
      let location = 'Unknown';
      try {
        if (navigator.geolocation) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          location = `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`;
        }
      } catch {}

      const response = await fetch('/api/scans/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ qrCode: code, location }),
      });

      const data = await response.json();
      setVerificationResult(data);
    } catch {
      setError(t('verify.networkError'));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setScanResult(null);
    setVerificationResult(null);
    setError('');
  };

  const m = verificationResult?.medicine;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">{t('verify.title')}</h1>
        <p className="text-slate-600">{t('verify.subtitle')}</p>
      </div>

      {!scanResult && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div id="reader" className="w-full rounded-xl overflow-hidden border-2 border-dashed border-slate-300" />
          <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-sm">
            <ScanLine className="h-4 w-4" />
            <span>{t('verify.pointCamera')}</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4" />
          <p className="text-slate-600 font-medium">{t('verify.verifying')}</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-center">
          <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-rose-900 mb-2">{t('verify.errorTitle')}</h3>
          <p className="text-rose-700 mb-6">{error}</p>
          <button onClick={reset} className="bg-rose-600 text-white px-6 py-2 rounded-lg hover:bg-rose-700 font-medium">
            {t('verify.tryAgain')}
          </button>
        </div>
      )}

      {verificationResult && !loading && (
        <div className={`p-8 rounded-2xl shadow-sm border ${verificationResult.valid ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className="text-center mb-6">
            {verificationResult.valid
              ? <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              : <AlertTriangle className="h-16 w-16 text-rose-500 mx-auto mb-4" />
            }
            <h2 className={`text-2xl font-bold ${verificationResult.valid ? 'text-emerald-900' : 'text-rose-900'}`}>
              {verificationResult.valid ? t('verify.authentic') : t('verify.suspicious')}
            </h2>
            <p className={`mt-2 font-medium ${verificationResult.valid ? 'text-emerald-700' : 'text-rose-700'}`}>
              {verificationResult.message}
            </p>
          </div>

          {m && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-2">{t('verify.medicineDetails')}</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('verify.labelName')}</dt>
                  <dd className="mt-1 text-base text-slate-900 font-semibold">{m.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('verify.labelManufacturer')}</dt>
                  <dd className="mt-1 text-base text-slate-900">{m.manufacturer}</dd>
                </div>
                {m.dosage && (
                  <div>
                    <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('verify.labelDosage')}</dt>
                    <dd className="mt-1 text-base text-slate-900">{m.dosage}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('verify.labelBatchNumber')}</dt>
                  <dd className="mt-1 text-slate-900"><code className="bg-slate-100 px-2 py-1 rounded text-sm">{m.batchNumber}</code></dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {t('verify.labelExpiration')}
                  </dt>
                  <dd className={`mt-1 text-base font-medium ${m.isExpired ? 'text-rose-600' : 'text-slate-900'}`}>
                    {new Date(m.expirationDate).toLocaleDateString()}
                    {m.isExpired && <span className="ml-2 text-sm font-semibold bg-rose-100 text-rose-700 px-2 py-0.5 rounded">{t('verify.expired')}</span>}
                  </dd>
                </div>
                {m.description && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('verify.labelDescription')}</dt>
                    <dd className="mt-1 text-sm text-slate-700">{m.description}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <div className="flex justify-center">
            <button
              onClick={reset}
              className={`px-8 py-3 rounded-xl font-medium text-white transition-colors shadow-sm ${verificationResult.valid ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
            >
              {t('verify.scanAnother')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 bg-blue-50 rounded-xl p-4 flex items-start gap-3 border border-blue-100">
        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800" dangerouslySetInnerHTML={{ __html: t('verify.howItWorks') }} />
      </div>
    </div>
  );
}
