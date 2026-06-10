-- ============================================================
-- Ginkoyes V2 — Index optimisés
-- Basés sur les patterns de requêtes de l'application
-- ============================================================

USE ginkoyes;

-- ============================================================
-- Articles : recherche par nom, ref, marque, genre, sous-famille
-- ============================================================

CREATE INDEX IF NOT EXISTS IDX_ART_NOM      ON ARTARTICLE(ART_NOM);
CREATE INDEX IF NOT EXISTS IDX_ART_REFMRK   ON ARTARTICLE(ART_REFMRK);
CREATE INDEX IF NOT EXISTS IDX_ART_MRKID    ON ARTARTICLE(ART_MRKID);
CREATE INDEX IF NOT EXISTS IDX_ART_GREID    ON ARTARTICLE(ART_GREID);
CREATE INDEX IF NOT EXISTS IDX_ART_SSFID    ON ARTARTICLE(ART_SSFID);

-- ============================================================
-- Références : lookup par article
-- ============================================================

CREATE INDEX IF NOT EXISTS IDX_ARF_ARTID    ON ARTREFERENCE(ARF_ARTID);
CREATE INDEX IF NOT EXISTS IDX_ARF_CHRONO   ON ARTREFERENCE(ARF_CHRONO);

-- ============================================================
-- Codes barres : recherche par code et par référence
-- ============================================================

CREATE INDEX IF NOT EXISTS IDX_CBI_ARFID    ON ARTCODEBARRE(CBI_ARFID);
CREATE INDEX IF NOT EXISTS IDX_CBI_CB       ON ARTCODEBARRE(CBI_CB);

-- ============================================================
-- Stock courant : par article, par article+taille+couleur
-- ============================================================

CREATE INDEX IF NOT EXISTS IDX_STC_ARTID    ON AGRSTOCKCOUR(STC_ARTID);

-- ============================================================
-- Tickets caisse : date (dashboard, stats), FK vers header
-- ============================================================

CREATE INDEX IF NOT EXISTS IDX_TKE_DATE     ON CSHTICKET(TKE_DATE);

CREATE INDEX IF NOT EXISTS IDX_TKL_TKEID    ON CSHTICKETL(TKL_TKEID);
CREATE INDEX IF NOT EXISTS IDX_TKL_ARTID    ON CSHTICKETL(TKL_ARTID);

-- ============================================================
-- BL / Web : date, FK vers header
-- ============================================================

CREATE INDEX IF NOT EXISTS IDX_BLE_DATE     ON NEGBL(BLE_DATE);

CREATE INDEX IF NOT EXISTS IDX_BLL_BLEID    ON NEGBLL(BLL_BLEID);
CREATE INDEX IF NOT EXISTS IDX_BLL_ARTID    ON NEGBLL(BLL_ARTID);

-- ============================================================
-- Commandes : collection, FK vers header
-- ============================================================

CREATE INDEX IF NOT EXISTS IDX_CDE_COLID    ON COMBCDE(CDE_COLID);

CREATE INDEX IF NOT EXISTS IDX_CDL_CDEID    ON COMBCDEL(CDL_CDEID);
CREATE INDEX IF NOT EXISTS IDX_CDL_ARTID    ON COMBCDEL(CDL_ARTID);
CREATE INDEX IF NOT EXISTS IDX_CDL_COUID    ON COMBCDEL(CDL_COUID);

-- ============================================================
-- Réceptions : collection, FK vers header
-- ============================================================

CREATE INDEX IF NOT EXISTS IDX_BRE_COLID    ON RECBR(BRE_COLID);
CREATE INDEX IF NOT EXISTS IDX_BRE_FOUID    ON RECBR(BRE_FOUID);

CREATE INDEX IF NOT EXISTS IDX_BRL_BREID    ON RECBRL(BRL_BREID);
CREATE INDEX IF NOT EXISTS IDX_BRL_ARTID    ON RECBRL(BRL_ARTID);
CREATE INDEX IF NOT EXISTS IDX_BRL_COUID    ON RECBRL(BRL_COUID);

-- ============================================================
-- Collection-Article mapping
-- ============================================================

CREATE INDEX IF NOT EXISTS IDX_CAR_COLID    ON ARTCOLART(CAR_COLID);

-- ============================================================
-- Hiérarchie familles
-- ============================================================

CREATE INDEX IF NOT EXISTS IDX_FAM_RAYID    ON NKLFAMILLE(FAM_RAYID);
CREATE INDEX IF NOT EXISTS IDX_SSF_FAMID    ON NKLSSFAMILLE(SSF_FAMID);

-- ============================================================
-- Marque nom (recherche UPPER)
-- ============================================================

CREATE INDEX IF NOT EXISTS IDX_MRK_NOM      ON ARTMARQUE(MRK_NOM);

-- ============================================================
-- Couleur article (jointure PLXCOULEUR.COU_ARTID)
-- ============================================================

CREATE INDEX IF NOT EXISTS IDX_COU_ARTID    ON PLXCOULEUR(COU_ARTID);
