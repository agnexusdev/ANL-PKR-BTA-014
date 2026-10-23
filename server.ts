import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  app.post('/api/identify-distress', async (req, res) => {
    const {
      staRange,
      lengthM,
      crackAreaPct,
      crackWidthMm,
      potholeCount,
      ruttingDepthCm,
      drainageCondition,
      heavyVehiclePct,
      imageDataUrl,
    } = req.body || {};

    const buildDeterministicEngineeringAnalysis = () => {
      const findings: string[] = [];
      const recommendations: string[] = [];

      if (Number(crackAreaPct) > 30) {
        findings.push(
          `Retak buaya (alligator cracking) ekstensif mencakup ${crackAreaPct}% luas permukaan segmen dengan lebar rata-rata ${crackWidthMm} mm.`
        );
      } else if (Number(crackAreaPct) >= 10) {
        findings.push(
          `Retak memanjang dan melintang interconnected (${crackAreaPct}% luas segmen, lebar rata-rata ${crackWidthMm} mm).`
        );
      } else if (Number(crackAreaPct) > 0) {
        findings.push(
          `Retak rambut lokal (${crackAreaPct}% luas permukaan, bukaan ${crackWidthMm} mm) pada jalur roda luar.`
        );
      } else {
        findings.push('Permukaan lapis aus aspal relatif utuh tanpa indikasi retak struktural.');
      }

      if (Number(potholeCount) > 0) {
        const norm100 = ((Number(potholeCount) / Math.max(Number(lengthM) || 100, 1)) * 100).toFixed(1);
        findings.push(
          `Teridentifikasi ${potholeCount} titik lubang (setara ${norm100} titik/100m) yang mempercepat infiltrasi air ke lapis pondasi atas.`
        );
      }

      if (Number(ruttingDepthCm) >= 3) {
        findings.push(
          `Deformasi plastis berupa alur roda (rutting) dalam (${ruttingDepthCm} cm) akibat beban sumbu kendaraan berat (${heavyVehiclePct || 15}%).`
        );
      } else if (Number(ruttingDepthCm) >= 1) {
        findings.push(
          `Deformasi alur roda moderat (${ruttingDepthCm} cm) pada lintasan ban kendaraan niaga.`
        );
      }

      if (drainageCondition === 'Buruk') {
        findings.push(
          'Saluran samping mengalami sedimentasi dan genangan bahu jalan yang menurunkan daya dukung subgrade.'
        );
        recommendations.push('Normalisasi saluran drainase tepi dan pembentukan kemiringan melintang bahu jalan.');
      }

      if (Number(potholeCount) > 5 || Number(ruttingDepthCm) > 3 || Number(crackAreaPct) > 30) {
        recommendations.push(
          'Bongkar lapis beraspal yang mengalami disintegrasi (patching struktural / rekonstruksi lokal) dan lapis ulang struktural.'
        );
      } else if (Number(crackAreaPct) >= 10 || Number(potholeCount) > 0) {
        recommendations.push(
          'Penutupan retak (crack sealing), penambalan lubang (patching campuran panas), dan pelapisan berkala (overlay tipis).'
        );
      } else {
        recommendations.push(
          'Pemeliharaan rutin preventif, pembersihan bahu jalan, dan pengisian celah retak dini.'
        );
      }

      return {
        distressTypes: [
          Number(crackAreaPct) > 20 ? 'Retak Buaya (Alligator Cracking)' : Number(crackAreaPct) > 0 ? 'Retak Garis (Linear Cracking)' : 'Permukaan Aus Normal',
          ...(Number(potholeCount) > 0 ? ['Lubang Permukaan (Potholes)'] : []),
          ...(Number(ruttingDepthCm) >= 1 ? ['Alur Roda (Wheel Track Rutting)'] : []),
          ...(drainageCondition === 'Buruk' ? ['Degradasi Drainase Tepi'] : []),
        ],
        severityAssessment:
          Number(potholeCount) > 5 || Number(ruttingDepthCm) > 3
            ? 'Kerusakan Struktural Berat'
            : Number(crackAreaPct) >= 15 || Number(potholeCount) > 2
            ? 'Kerusakan Fungsional & Struktural Menengah'
            : Number(crackAreaPct) > 0 || Number(ruttingDepthCm) > 0
            ? 'Degradasi Permukaan Ringan'
            : 'Kondisi Layanan Optimal',
        technicalNotes: `Segmen ${staRange || 'STA'} (${lengthM || 100}m): ${findings.join(' ')} Tindakan teknis: ${recommendations.join(' ')}`,
      };
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      return res.json(buildDeterministicEngineeringAnalysis());
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const promptText = `Anda adalah Insinyur Ahli Perkerasan Jalan Bina Marga. Analisis data survei segmen jalan berikut dan berikan evaluasi teknis dalam Bahasa Indonesia yang formal dan ringkas:
- Segmen: ${staRange || 'STA'} (Panjang: ${lengthM || 100} m)
- Luas Retak: ${crackAreaPct}%
- Rata-rata Lebar Retak: ${crackWidthMm} mm
- Jumlah Lubang: ${potholeCount} titik
- Kedalaman Alur (Rutting): ${ruttingDepthCm} cm
- Kondisi Drainase: ${drainageCondition || 'Sedang'}
- Proporsi Kendaraan Berat: ${heavyVehiclePct || 12}%`;

      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
        { text: promptText },
      ];

      if (
        typeof imageDataUrl === 'string' &&
        imageDataUrl.startsWith('data:image/') &&
        !imageDataUrl.startsWith('data:image/svg+xml')
      ) {
        const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (match) {
          parts.unshift({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          });
        }
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              distressTypes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Daftar jenis kerusakan jalan yang teridentifikasi',
              },
              severityAssessment: {
                type: Type.STRING,
                description: 'Ringkasan tingkat keparahan kerusakan',
              },
              technicalNotes: {
                type: Type.STRING,
                description: 'Catatan teknis lapangan lengkap beserta rekomendasi penanganan',
              },
            },
            required: ['distressTypes', 'severityAssessment', 'technicalNotes'],
          },
        },
      });

      const rawText = response.text;
      if (rawText) {
        const parsed = JSON.parse(rawText.trim());
        return res.json(parsed);
      }
      return res.json(buildDeterministicEngineeringAnalysis());
    } catch {
      return res.json(buildDeterministicEngineeringAnalysis());
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Jalan Beta server running on http://localhost:${PORT}`);
  });
}

startServer();
