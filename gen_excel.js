const Firebird = require('node-firebird');
const XLSX = require('xlsx');
const opts = {
  host: 'localhost', port: 3050,
  database: '/firebird/data/ginkoia.fdb',
  user: 'SYSDBA', password: 'ginkoia',
  lowercase_keys: false, pageSize: 4096
};
function q(sql, params) {
  return new Promise((resolve, reject) => {
    Firebird.attach(opts, (err, db) => {
      if (err) return reject(err);
      db.query(sql, params, (err, result) => {
        db.detach();
        if (err) return reject(err);
        resolve(result || []);
      });
    });
  });
}

const SQL_DETAIL = `
  SELECT
    v.SOURCE, v.DATE_VENTE, v.NUMERO,
    a.ART_NOM, a.ART_REFMRK,
    gen.GRE_NOM AS GENRE,
    cou.COU_NOM AS COULEUR,
    tgf.TGF_LIBELLE AS TAILLE,
    ray.RAY_NOM AS RAYON, fam.FAM_NOM AS FAMILLE,
    v.QTE, v.PX_BRUT, v.PX_NET_TTC, v.PX_NET_HT
  FROM (
    SELECT 'CAISSE' AS SOURCE, t.TKE_DATE AS DATE_VENTE, t.TKE_NUMERO AS NUMERO,
      l.TKL_ARTID AS ARTID, l.TKL_TGFID AS TGFID, l.TKL_COUID AS COUID,
      l.TKL_QTE AS QTE, l.TKL_PXBRUT AS PX_BRUT, l.TKL_PXNET AS PX_NET_TTC, l.TKL_PXNNHT AS PX_NET_HT
    FROM CSHTICKETL l
    JOIN CSHTICKET t ON t.TKE_ID = l.TKL_TKEID
    WHERE t.TKE_DATE >= ? AND t.TKE_DATE < ?
    UNION ALL
    SELECT 'BL/INTERNET' AS SOURCE, bl.BLE_DATE AS DATE_VENTE, bl.BLE_NUMERO AS NUMERO,
      l.BLL_ARTID, l.BLL_TGFID, l.BLL_COUID,
      l.BLL_QTE, l.BLL_PXBRUT, l.BLL_PXNET, l.BLL_PXNN
    FROM NEGBLL l
    JOIN NEGBL bl ON bl.BLE_ID = l.BLL_BLEID
    WHERE bl.BLE_DATE >= ? AND bl.BLE_DATE < ?
  ) v
  JOIN ARTARTICLE a ON a.ART_ID = v.ARTID
  JOIN ARTMARQUE mrk ON mrk.MRK_ID = a.ART_MRKID
  LEFT JOIN ARTGENRE gen ON gen.GRE_ID = a.ART_GREID
  LEFT JOIN PLXCOULEUR cou ON cou.COU_ID = v.COUID
  LEFT JOIN PLXTAILLESGF tgf ON tgf.TGF_ID = v.TGFID
  LEFT JOIN NKLSSFAMILLE ssf ON ssf.SSF_ID = a.ART_SSFID
  LEFT JOIN NKLFAMILLE fam ON fam.FAM_ID = ssf.SSF_FAMID
  LEFT JOIN NKLRAYON ray ON ray.RAY_ID = fam.FAM_RAYID
  WHERE UPPER(mrk.MRK_NOM) = 'HOKA'
  ORDER BY v.DATE_VENTE, a.ART_NOM, cou.COU_NOM
`;

(async () => {
  const [rows2026, rows2025] = await Promise.all([
    q(SQL_DETAIL, ['2026-01-01', '2026-06-05', '2026-01-01', '2026-06-05']),
    q(SQL_DETAIL, ['2025-01-01', '2025-06-05', '2025-01-01', '2025-06-05']),
  ]);

  function toSheet(rows) {
    return rows.map(r => ({
      'Date': r.DATE_VENTE ? new Date(r.DATE_VENTE).toLocaleDateString('fr-FR') : '',
      'Source': r.SOURCE,
      'N° Pièce': r.NUMERO,
      'Article': r.ART_NOM,
      'Réf Marque': r.ART_REFMRK,
      'Genre': r.GENRE || '',
      'Rayon': r.RAYON || '',
      'Famille': r.FAMILLE || '',
      'Couleur': r.COULEUR || '',
      'Taille': r.TAILLE || '',
      'Qté': r.QTE,
      'PX Brut': r.PX_BRUT,
      'PX Net TTC': r.PX_NET_TTC,
      'PX Net HT': r.PX_NET_HT,
    }));
  }

  const caisseQte2026 = rows2026.filter(r => r.SOURCE === 'CAISSE').reduce((s,r) => s + r.QTE, 0);
  const blQte2026 = rows2026.filter(r => r.SOURCE !== 'CAISSE').reduce((s,r) => s + r.QTE, 0);
  const caisseCa2026 = rows2026.filter(r => r.SOURCE === 'CAISSE').reduce((s,r) => s + r.PX_NET_TTC, 0);
  const blCa2026 = rows2026.filter(r => r.SOURCE !== 'CAISSE').reduce((s,r) => s + r.PX_NET_TTC, 0);

  const caisseQte2025 = rows2025.filter(r => r.SOURCE === 'CAISSE').reduce((s,r) => s + r.QTE, 0);
  const blQte2025 = rows2025.filter(r => r.SOURCE !== 'CAISSE').reduce((s,r) => s + r.QTE, 0);
  const caisseCa2025 = rows2025.filter(r => r.SOURCE === 'CAISSE').reduce((s,r) => s + r.PX_NET_TTC, 0);
  const blCa2025 = rows2025.filter(r => r.SOURCE !== 'CAISSE').reduce((s,r) => s + r.PX_NET_TTC, 0);

  const summary = [
    { '': 'COMPARATIF HOKA — 01/01 au 04/06' },
    {},
    { '': '', '2026': '', '2025': '', 'Écart': '' },
    { '': 'QTE Caisse', '2026': caisseQte2026, '2025': caisseQte2025, 'Écart': caisseQte2026 - caisseQte2025 },
    { '': 'QTE BL/Internet', '2026': blQte2026, '2025': blQte2025, 'Écart': blQte2026 - blQte2025 },
    { '': 'QTE TOTAL', '2026': caisseQte2026 + blQte2026, '2025': caisseQte2025 + blQte2025, 'Écart': (caisseQte2026 + blQte2026) - (caisseQte2025 + blQte2025) },
    {},
    { '': 'CA TTC Caisse', '2026': caisseCa2026, '2025': caisseCa2025, 'Écart': caisseCa2026 - caisseCa2025 },
    { '': 'CA TTC BL/Internet', '2026': blCa2026, '2025': blCa2025, 'Écart': blCa2026 - blCa2025 },
    { '': 'CA TTC TOTAL', '2026': caisseCa2026 + blCa2026, '2025': caisseCa2025 + blCa2025, 'Écart': (caisseCa2026 + blCa2026) - (caisseCa2025 + blCa2025) },
    {},
    { '': 'Nb lignes détail', '2026': rows2026.length, '2025': rows2025.length },
  ];

  const wb = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.json_to_sheet(summary);
  wsSummary['!cols'] = [{wch:22},{wch:12},{wch:12},{wch:12}];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Résumé');

  const ws2026 = XLSX.utils.json_to_sheet(toSheet(rows2026));
  ws2026['!cols'] = [{wch:12},{wch:14},{wch:28},{wch:40},{wch:22},{wch:10},{wch:15},{wch:15},{wch:18},{wch:8},{wch:5},{wch:10},{wch:12},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ws2026, '2026 (' + rows2026.length + ' lignes)');

  const ws2025 = XLSX.utils.json_to_sheet(toSheet(rows2025));
  ws2025['!cols'] = [{wch:12},{wch:14},{wch:28},{wch:40},{wch:22},{wch:10},{wch:15},{wch:15},{wch:18},{wch:8},{wch:5},{wch:10},{wch:12},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ws2025, '2025 (' + rows2025.length + ' lignes)');

  const filePath = '/tmp/HOKA_comparatif_2025_vs_2026.xlsx';
  XLSX.writeFile(wb, filePath);
  console.log('Fichier créé:', filePath);
  console.log('2026:', rows2026.length, 'lignes, QTE total:', caisseQte2026 + blQte2026, '(caisse:', caisseQte2026, '+ BL:', blQte2026 + ')');
  console.log('2025:', rows2025.length, 'lignes, QTE total:', caisseQte2025 + blQte2025, '(caisse:', caisseQte2025, '+ BL:', blQte2025 + ')');
})();
