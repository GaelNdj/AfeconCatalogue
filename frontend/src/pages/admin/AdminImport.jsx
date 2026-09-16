import { useEffect, useState } from 'react';
import { Upload, FileSpreadsheet, Images, CheckCircle2 } from 'lucide-react';
import { api } from '../../api.js';

export default function AdminImport() {
  const [xlsx, setXlsx] = useState(null);
  const [images, setImages] = useState([]);
  const [imagesZip, setImagesZip] = useState(null);
  const [imagesDir, setImagesDir] = useState(
    '/Users/gael/Desktop/catalogue/images_hq'
  );
  const [importMode, setImportMode] = useState('sync');
  const [downloadImageUrls, setDownloadImageUrls] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api.getImportLogs().then(setLogs).catch(console.error);
  }, [result]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!xlsx) {
      alert('Sélectionnez un fichier Excel (.xlsx)');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('xlsx', xlsx);
      for (const file of images) {
        fd.append('images', file);
      }
      if (imagesZip) fd.append('images_zip', imagesZip);
      if (imagesDir.trim()) fd.append('images_dir', imagesDir.trim());
      fd.append('import_mode', importMode);
      if (downloadImageUrls) fd.append('download_image_urls', '1');
      const res = await api.importCatalog(fd);
      setResult(res);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  const dropClass =
    'flex cursor-pointer flex-col items-start gap-2 rounded-xl border-2 border-dashed border-border bg-surface/60 px-5 py-5 transition hover:border-brand/40 hover:bg-brand-soft/30';

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-xl font-bold text-ink">Import catalogue</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Mise à jour par <strong className="text-ink">Code catalogue</strong> (7 chiffres ou réf.
        fournisseur). Colonne optionnelle <strong className="text-ink">Code interne</strong>{' '}
        (ex. AFE-CON-098) pour vos codes AFE affichés sur le site.
        En mode <strong className="text-ink">Sync catalogue</strong>, les prix de vente
        saisis à la main et les codes AFE sont conservés. Nom, description, variantes et Ø
        catalogue sont bien mis à jour.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="card px-5 py-4">
          <div className="text-sm font-semibold text-ink">Mode d’import</div>
          <div className="mt-3 space-y-2 text-sm">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="import_mode"
                value="sync"
                checked={importMode === 'sync'}
                onChange={() => setImportMode('sync')}
                className="mt-1"
              />
              <span>
                <strong>Sync catalogue</strong> (recommandé) — met à jour nom, description,
                variantes, Ø, prix catalogue, images et nouveaux codes. Conserve les prix de
                vente saisis à la main et les codes AFE.
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="import_mode"
                value="full"
                checked={importMode === 'full'}
                onChange={() => setImportMode('full')}
                className="mt-1"
              />
              <span>
                <strong>Import complet</strong> — réécrit toutes les colonnes depuis l’Excel (1er
                import ou réinitialisation).
              </span>
            </label>
          </div>
        </div>
        <label className={dropClass}>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <FileSpreadsheet className="h-5 w-5 text-brand" />
            Fichier Excel (.xlsx)
          </div>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="text-sm"
            onChange={(e) => setXlsx(e.target.files?.[0] || null)}
          />
          {xlsx && <span className="text-xs text-brand">{xlsx.name}</span>}
        </label>

        <label className={dropClass}>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Images className="h-5 w-5 text-brand" />
            Images (multi-sélection)
          </div>
          <input
            type="file"
            accept="image/*"
            multiple
            className="text-sm"
            onChange={(e) => setImages(Array.from(e.target.files || []))}
          />
          {images.length > 0 && (
            <span className="text-xs text-muted">{images.length} fichier(s)</span>
          )}
        </label>

        <label className={dropClass}>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Images className="h-5 w-5 text-brand" />
            Archive ZIP (gros volume)
          </div>
          <input
            type="file"
            accept=".zip"
            className="text-sm"
            onChange={(e) => setImagesZip(e.target.files?.[0] || null)}
          />
          {imagesZip && <span className="text-xs text-brand">{imagesZip.name}</span>}
        </label>

        <label className="card block px-5 py-4">
          <div className="text-sm font-semibold text-ink">Dossier images (chemin serveur)</div>
          <p className="mt-1 text-xs text-muted">
            Recommandé pour ~5 000 images — le serveur lit le dossier directement.
          </p>
          <input
            type="text"
            className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
            value={imagesDir}
            onChange={(e) => setImagesDir(e.target.value)}
            placeholder="/Users/gael/Desktop/catalogue/images_hq"
          />
        </label>

        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-surface/60 px-5 py-4 text-sm">
          <input
            type="checkbox"
            checked={downloadImageUrls}
            onChange={(e) => setDownloadImageUrls(e.target.checked)}
            className="mt-1"
          />
          <span>
            <strong>Télécharger les images depuis les URLs</strong> (export Legrand — colonne
            « Lien vers fiche produit »). Si Legrand bloque le serveur, utilisez le script{' '}
            <code className="text-xs">convert_legrand.py --download-images</code> puis le dossier
            images.
          </span>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {busy ? 'Import en cours…' : 'Lancer l’import'}
        </button>
      </form>

      {result && (
        <div className="card mt-6 border-brand/20 bg-brand-soft/40 p-5">
          <div className="flex items-center gap-2 font-semibold text-brand-dark">
            <CheckCircle2 className="h-5 w-5" />
            Import terminé
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {[
              ['Lignes lues', result.rows],
              ['Mode', result.importMode === 'full' ? 'Complet' : 'Sync'],
              ['Ajoutées', result.added],
              ['Mises à jour', result.updated],
              ['Sync protégées', result.catalogSynced],
              ['Inchangées', result.unchanged],
              ['Erreurs', result.errors],
              ['Images', result.imagesImported],
            ].map(([label, val]) => (
              <li key={label} className="rounded-lg bg-white/70 px-3 py-2">
                <span className="block text-xs text-muted">{label}</span>
                <span className="font-display text-lg font-bold text-ink">{val}</span>
              </li>
            ))}
          </ul>
          {result.imagesImported === 0 && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Aucune image chargée depuis le dossier serveur. Vérifiez le chemin{' '}
              <code className="text-xs">images_hq</code> et que{' '}
              <code className="text-xs">IMAGES_IMPORT_DIR</code> dans{' '}
              <code className="text-xs">backend/.env</code> autorise ce dossier.
            </p>
          )}
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-ink">Historique des imports</h3>
          <div className="card mt-3 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-[11px] font-semibold uppercase text-muted">
                <tr>
                  <th className="px-4 py-2.5">Fichier</th>
                  <th className="px-4 py-2.5">+ / ~ / =</th>
                  <th className="px-4 py-2.5">Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-border/60">
                    <td className="px-4 py-2.5">{l.filename}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {l.added} / {l.updated} / {l.unchanged}
                      {l.errors ? ` · err ${l.errors}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {new Date(l.created_at).toLocaleString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
