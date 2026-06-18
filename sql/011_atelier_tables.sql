-- ============================================================
-- Ginkoyes V2 — Tables Atelier (SAV) + Clients
-- 5 tables miroir de Ginkoia (Firebird)
-- ============================================================

USE ginkoyes;

-- ============================================================
-- Clients
-- ============================================================

CREATE TABLE IF NOT EXISTS CLTCLIENT (
  CLT_ID           INT          NOT NULL PRIMARY KEY,
  CLT_NOM          VARCHAR(200) DEFAULT NULL,
  CLT_PRENOM       VARCHAR(200) DEFAULT NULL,
  CLT_NUMERO       VARCHAR(50)  DEFAULT NULL,
  CLT_TELEPHONE    VARCHAR(50)  DEFAULT NULL,
  CLT_TELPORTABLE  VARCHAR(50)  DEFAULT NULL,
  CLT_EMAIL        VARCHAR(200) DEFAULT NULL,
  CLT_COMMENT      TEXT         DEFAULT NULL
) ENGINE=InnoDB;

-- ============================================================
-- Matériel (vélos, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS SAVMAT (
  MAT_ID           INT          NOT NULL PRIMARY KEY,
  MAT_CLTID        INT          DEFAULT NULL,
  MAT_NOM          VARCHAR(200) DEFAULT NULL,
  MAT_SERIE        VARCHAR(100) DEFAULT NULL,
  MAT_COULEUR      VARCHAR(100) DEFAULT NULL,
  MAT_COMMENT      TEXT         DEFAULT NULL,
  MAT_DATEACHAT    DATE         DEFAULT NULL,
  MAT_CHRONO       VARCHAR(50)  DEFAULT NULL,
  MAT_NUMMARQUAGE  VARCHAR(100) DEFAULT NULL
) ENGINE=InnoDB;

-- ============================================================
-- Fiche atelier — entête
-- ============================================================

CREATE TABLE IF NOT EXISTS SAVFICHEE (
  SAV_ID                INT          NOT NULL PRIMARY KEY,
  SAV_CLTID             INT          DEFAULT NULL,
  SAV_MATID             INT          DEFAULT NULL,
  SAV_CHRONO            VARCHAR(50)  DEFAULT NULL,
  SAV_DTCREATION        DATETIME     DEFAULT NULL,
  SAV_DEBUT             DATETIME     DEFAULT NULL,
  SAV_FIN               DATETIME     DEFAULT NULL,
  SAV_ETAT              INT          DEFAULT NULL,
  SAV_IDENT             VARCHAR(100) DEFAULT NULL,
  SAV_COMMENT           TEXT         DEFAULT NULL,
  SAV_DATEPRISEENCHARGE DATETIME     DEFAULT NULL,
  SAV_DATEPLANNING      DATETIME     DEFAULT NULL,
  SAV_DATEREPRISE       DATETIME     DEFAULT NULL,
  SAV_PLACE             VARCHAR(100) DEFAULT NULL,
  SAV_KILOMETRAGEVAE    INT          DEFAULT NULL,
  SAV_NEUF              SMALLINT     DEFAULT NULL,
  SAV_REMMO             DECIMAL(15,4) DEFAULT NULL,
  SAV_REMART            DECIMAL(15,4) DEFAULT NULL,
  SAV_REM               DECIMAL(15,4) DEFAULT NULL
) ENGINE=InnoDB;

-- ============================================================
-- Fiche atelier — lignes de travaux
-- ============================================================

CREATE TABLE IF NOT EXISTS SAVFICHEL (
  SAL_ID           INT            NOT NULL PRIMARY KEY,
  SAL_SAVID        INT            DEFAULT NULL,
  SAL_NOM          VARCHAR(200)   DEFAULT NULL,
  SAL_COMMENT      TEXT           DEFAULT NULL,
  SAL_DUREE        DECIMAL(10,2)  DEFAULT NULL,
  SAL_PXBRUT       DECIMAL(15,4)  DEFAULT NULL,
  SAL_PXTOT        DECIMAL(15,4)  DEFAULT NULL,
  SAL_REMISE       DECIMAL(15,4)  DEFAULT NULL,
  SAL_TERMINE      SMALLINT       DEFAULT NULL,
  SAL_DATEDEBUT    DATETIME       DEFAULT NULL,
  SAL_DATEFIN      DATETIME       DEFAULT NULL
) ENGINE=InnoDB;

-- ============================================================
-- Fiche atelier — articles utilisés
-- ============================================================

CREATE TABLE IF NOT EXISTS SAVFICHEART (
  SAA_ID           INT            NOT NULL PRIMARY KEY,
  SAA_SAVID        INT            DEFAULT NULL,
  SAA_SALID        INT            DEFAULT NULL,
  SAA_ARTID        INT            DEFAULT NULL,
  SAA_QTE          DECIMAL(15,4)  DEFAULT NULL,
  SAA_PU           DECIMAL(15,4)  DEFAULT NULL,
  SAA_PXTOT        DECIMAL(15,4)  DEFAULT NULL,
  SAA_REMISE       DECIMAL(15,4)  DEFAULT NULL
) ENGINE=InnoDB;
