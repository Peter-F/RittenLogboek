import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Vehicle } from '../types';
import {
  QrCode,
  Download,
  Printer,
  X,
  ExternalLink,
  CheckCircle2,
  Car,
  Copy,
  Check,
} from 'lucide-react';

interface QRCodeModalProps {
  vehicle: Vehicle;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ vehicle, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Generate target URL for this vehicle
  const targetUrl = `${window.location.origin}${window.location.pathname}?vehicleId=${vehicle.id}`;

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(targetUrl, {
      width: 380,
      margin: 2,
      color: {
        dark: '#1c1917', // stone-900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (mounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR code:', err);
      });

    return () => {
      mounted = false;
    };
  }, [targetUrl, vehicle.id]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_${vehicle.licensePlate.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-stone-900 text-white">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">QR-code wagen</h2>
              <p className="text-xs text-stone-500 font-mono font-semibold">
                {vehicle.licensePlate}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-xl transition"
            aria-label="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Printable Sticker Card */}
          <div
            ref={printRef}
            className="bg-white border-2 border-stone-900 rounded-2xl p-5 text-center shadow-xs space-y-3 print:border-black print:m-0"
          >
            {/* Top brand */}
            <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500">
              <Car className="w-4 h-4 text-stone-900" />
              <span>WagenRit • Bedrijfswagen</span>
            </div>

            {/* License plate banner */}
            <div className="inline-block px-4 py-1.5 bg-stone-100 border-2 border-stone-900 rounded-xl">
              <span className="font-mono text-xl sm:text-2xl font-black tracking-wider text-stone-900">
                {vehicle.licensePlate}
              </span>
            </div>

            <div className="text-sm font-bold text-stone-800">
              {vehicle.brand} {vehicle.model}
              {vehicle.nickname && (
                <span className="text-xs text-stone-500 font-normal italic block">
                  “{vehicle.nickname}”
                </span>
              )}
            </div>

            {/* QR image */}
            <div className="flex justify-center p-2 bg-stone-50 rounded-xl border border-stone-200/80">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR code voor ${vehicle.licensePlate}`}
                  className="w-48 h-48 rounded-lg object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-xs text-stone-400 animate-pulse">
                  QR-code genereren...
                </div>
              )}
            </div>

            {/* Call to action instruction */}
            <p className="text-xs font-semibold text-stone-700 leading-snug">
              Scan met smartphone camera om een rit te starten of direct af te sluiten
            </p>
          </div>

          {/* Quick link & Copy */}
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs flex items-center justify-between gap-2">
            <span className="truncate text-stone-600 font-mono text-[11px]">{targetUrl}</span>
            <button
              onClick={handleCopyUrl}
              className="p-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 shrink-0 flex items-center gap-1 font-semibold text-[11px] transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Gekopieerd
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Kopiëren
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-stone-500 leading-relaxed">
            <strong>Gebruikstip:</strong> Print deze QR-code af of download als afbeelding en kleef
            de sticker op het dashboard of aan de binnenkant van de voorruit van de wagen. Wanneer een
            bestuurder de QR-code met zijn telefoon scant, opent direct het scherm om een rit te
            starten of de openstaande rit direct af te sluiten.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-stone-100 bg-stone-50/70 flex gap-2">
          <button
            onClick={handleDownloadPng}
            disabled={!qrDataUrl}
            className="flex-1 py-2.5 px-3 rounded-xl border border-stone-300 hover:bg-stone-100 bg-white text-stone-800 text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Download PNG
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            Afdrukken sticker
          </button>
        </div>
      </div>
    </div>
  );
};
