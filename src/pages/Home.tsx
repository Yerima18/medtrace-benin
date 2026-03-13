import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, QrCode, HeartPulse, Activity } from 'lucide-react';

export default function Home() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <div className="max-w-3xl">
        <ShieldCheck className="h-24 w-24 text-emerald-600 mx-auto mb-8" />
        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-6">
          {t('home.headline')} <span className="text-emerald-600">{t('home.headlineAccent')}</span>
        </h1>
        <p className="text-xl text-slate-600 mb-10 leading-relaxed">
          {t('home.description')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link
            to="/verify"
            className="bg-emerald-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-emerald-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <QrCode className="h-6 w-6" />
            {t('home.verifyBtn')}
          </Link>
          <Link
            to="/register"
            className="bg-white text-slate-700 border-2 border-slate-200 px-8 py-4 rounded-xl text-lg font-semibold hover:border-emerald-600 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
          >
            {t('home.joinPharmacyBtn')}
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="bg-emerald-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <QrCode className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{t('home.feature1Title')}</h3>
            <p className="text-slate-600">{t('home.feature1Desc')}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{t('home.feature2Title')}</h3>
            <p className="text-slate-600">{t('home.feature2Desc')}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="bg-rose-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <HeartPulse className="h-6 w-6 text-rose-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{t('home.feature3Title')}</h3>
            <p className="text-slate-600">{t('home.feature3Desc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
