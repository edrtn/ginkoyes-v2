-- ============================================================
-- Ginkoyes V2 — Données de démonstration
-- Pour tester l'interface localement
-- ============================================================

USE ginkoyes;

-- Rayons
INSERT INTO NKLRAYON (RAY_ID, RAY_NOM) VALUES
(1, 'CHAUSSURES'),
(2, 'TEXTILE'),
(3, 'ACCESSOIRES'),
(4, 'SKI'),
(5, 'RUNNING');

-- Familles
INSERT INTO NKLFAMILLE (FAM_ID, FAM_NOM, FAM_RAYID) VALUES
(1, 'CHAUSSURES RUNNING', 1),
(2, 'CHAUSSURES TRAIL', 1),
(3, 'T-SHIRTS', 2),
(4, 'VESTES', 2),
(5, 'SACS', 3),
(6, 'BONNETS', 3),
(7, 'SKIS ALPINS', 4),
(8, 'SHORTS', 2),
(9, 'CHAUSSURES ROAD', 5),
(10, 'LEGGINGS', 2);

-- Sous-familles
INSERT INTO NKLSSFAMILLE (SSF_ID, SSF_NOM, SSF_FAMID) VALUES
(1, 'HOMME', 1),
(2, 'FEMME', 1),
(3, 'HOMME', 2),
(4, 'FEMME', 2),
(5, 'HOMME', 3),
(6, 'FEMME', 3),
(7, 'HOMME', 4),
(8, 'FEMME', 4),
(9, 'MIXTE', 5),
(10, 'MIXTE', 6),
(11, 'ADULTE', 7),
(12, 'HOMME', 8),
(13, 'FEMME', 8),
(14, 'HOMME', 9),
(15, 'FEMME', 10);

-- Marques
INSERT INTO ARTMARQUE (MRK_ID, MRK_NOM) VALUES
(1, 'NIKE'),
(2, 'ADIDAS'),
(3, 'SALOMON'),
(4, 'THE NORTH FACE'),
(5, 'ASICS'),
(6, 'NEW BALANCE'),
(7, 'PUMA'),
(8, 'ROSSIGNOL'),
(9, 'HOKA'),
(10, 'PATAGONIA');

-- Genres
INSERT INTO ARTGENRE (GRE_ID, GRE_NOM) VALUES
(1, 'HOMME'),
(2, 'FEMME'),
(3, 'ENFANT'),
(4, 'MIXTE');

-- Classements
INSERT INTO ARTCLASSEMENT (CLA_ID, CLA_NOM) VALUES
(1, 'A'),
(2, 'B'),
(3, 'C');

-- Fournisseurs
INSERT INTO ARTFOURN (FOU_ID, FOU_NOM) VALUES
(1, 'NIKE FRANCE'),
(2, 'ADIDAS FRANCE'),
(3, 'AMER SPORTS (SALOMON)'),
(4, 'THE NORTH FACE EUROPE'),
(5, 'ASICS FRANCE');

-- Tailles
INSERT INTO PLXTAILLESGF (TGF_ID, TGF_NOM, TGF_CORRES) VALUES
(1, 'S', 'S'),
(2, 'M', 'M'),
(3, 'L', 'L'),
(4, 'XL', 'XL'),
(5, '38', '38'),
(6, '39', '39'),
(7, '40', '40'),
(8, '41', '41'),
(9, '42', '42'),
(10, '43', '43'),
(11, '44', '44'),
(12, '45', '45'),
(13, 'XS', 'XS'),
(14, '36', '36'),
(15, '37', '37');

-- Couleurs
INSERT INTO PLXCOULEUR (COU_ID, COU_NOM, COU_CODE, COU_ARTID) VALUES
(1, 'NOIR', 'BLK', NULL),
(2, 'BLANC', 'WHT', NULL),
(3, 'BLEU', 'BLU', NULL),
(4, 'ROUGE', 'RED', NULL),
(5, 'VERT', 'GRN', NULL),
(6, 'GRIS', 'GRY', NULL),
(7, 'ORANGE', 'ORG', NULL),
(8, 'JAUNE', 'YLW', NULL),
(9, 'ROSE', 'PNK', NULL),
(10, 'MARINE', 'NVY', NULL);

-- Collections
INSERT INTO ARTCOLLECTION (COL_ID, COL_NOM) VALUES
(1, 'AUTOMNE HIVER 2025'),
(2, 'PRINTEMPS ETE 2026'),
(3, 'AUTOMNE HIVER 2024'),
(4, 'PRINTEMPS ETE 2025');

-- Articles (20 articles)
INSERT INTO ARTARTICLE (ART_ID, ART_NOM, ART_REFMRK, ART_CODE, ART_CODEFOURN, ART_MRKID, ART_GREID, ART_SSFID) VALUES
(1,  'NIKE AIR ZOOM PEGASUS 41',     'DV7400-001', 'NK001', 'NK-PEG41',   1, 1, 1),
(2,  'NIKE AIR ZOOM PEGASUS 41 W',   'DV7400-002', 'NK002', 'NK-PEG41W',  1, 2, 2),
(3,  'ADIDAS ULTRABOOST 24',         'GY9150',     'AD001', 'AD-UB24',    2, 1, 1),
(4,  'SALOMON SPEEDCROSS 6',         'L41737800',  'SA001', 'SAL-SC6',    3, 1, 3),
(5,  'SALOMON SPEEDCROSS 6 W',       'L41737900',  'SA002', 'SAL-SC6W',   3, 2, 4),
(6,  'TNF VESTE THERMOBALL ECO',     'NF0A5GLK',   'TN001', 'TNF-TB',     4, 1, 7),
(7,  'TNF VESTE THERMOBALL ECO W',   'NF0A5GLM',   'TN002', 'TNF-TBW',    4, 2, 8),
(8,  'NIKE DRI-FIT T-SHIRT',         'CZ9184-010', 'NK003', 'NK-DFT',     1, 1, 5),
(9,  'ASICS GEL KAYANO 31',          '1011B867',   'AS001', 'ASI-GK31',   5, 1, 1),
(10, 'ASICS GEL KAYANO 31 W',        '1012B670',   'AS002', 'ASI-GK31W',  5, 2, 2),
(11, 'SALOMON SAC TRAIL 10L',        'LC2019800',  'SA003', 'SAL-TR10',   3, 4, 9),
(12, 'NEW BALANCE FRESH FOAM X 1080', 'M1080V14',  'NB001', 'NB-FF1080',  6, 1, 1),
(13, 'PUMA VELOCITY NITRO 3',        '379610-01',  'PU001', 'PU-VN3',     7, 1, 14),
(14, 'ROSSIGNOL SKI HERO ELITE',     'RAJLV01',    'RS001', 'RSG-HE',     8, 1, 11),
(15, 'HOKA CLIFTON 9',               '1127895',    'HK001', 'HK-CL9',     9, 1, 1),
(16, 'HOKA CLIFTON 9 W',             '1127896',    'HK002', 'HK-CL9W',    9, 2, 2),
(17, 'PATAGONIA NANO PUFF',          '84212',      'PT001', 'PAT-NP',     10, 1, 7),
(18, 'NIKE SHORT RUNNING DRI-FIT',   'CZ9069-010', 'NK004', 'NK-SHR',     1, 1, 12),
(19, 'ADIDAS T-SHIRT OWN THE RUN',   'HN1533',     'AD002', 'AD-OTR',     2, 1, 5),
(20, 'TNF BONNET SALTY DOG',         'NF0A7WJQ',   'TN003', 'TNF-SD',     4, 4, 10);

-- Références Ginkoia
INSERT INTO ARTREFERENCE (ARF_ID, ARF_ARTID, ARF_CHRONO, ARF_ICLID1) VALUES
(1,  1,  'GK-00001', 1),
(2,  2,  'GK-00002', 1),
(3,  3,  'GK-00003', 1),
(4,  4,  'GK-00004', 1),
(5,  5,  'GK-00005', 1),
(6,  6,  'GK-00006', 2),
(7,  7,  'GK-00007', 2),
(8,  8,  'GK-00008', 1),
(9,  9,  'GK-00009', 1),
(10, 10, 'GK-00010', 1),
(11, 11, 'GK-00011', 3),
(12, 12, 'GK-00012', 1),
(13, 13, 'GK-00013', 2),
(14, 14, 'GK-00014', 2),
(15, 15, 'GK-00015', 1),
(16, 16, 'GK-00016', 1),
(17, 17, 'GK-00017', 2),
(18, 18, 'GK-00018', 1),
(19, 19, 'GK-00019', 1),
(20, 20, 'GK-00020', 3);

-- Classement items
INSERT INTO ARTCLAITEM (CIT_ICLID, CIT_CLAID) VALUES
(1, 1), (2, 2), (3, 3);

-- Codes barres
INSERT INTO ARTCODEBARRE (CBI_ID, CBI_CB, CBI_ARFID) VALUES
(1,  '3660154012345', 1),
(2,  '3660154012346', 2),
(3,  '4065432100001', 3),
(4,  '8809876543210', 4),
(5,  '8809876543211', 5),
(6,  '0192964012345', 6),
(7,  '0192964012346', 7),
(8,  '3660154012347', 8),
(9,  '4550456789012', 9),
(10, '4550456789013', 10),
(11, '8809876543212', 11),
(12, '1940057890123', 12),
(13, '4065432100002', 13),
(14, '3607682012345', 14),
(15, '1940057890124', 15),
(16, '1940057890125', 16),
(17, '8809876543213', 17),
(18, '3660154012348', 18),
(19, '4065432100003', 19),
(20, '0192964012347', 20);

-- Article-Collection mapping
INSERT INTO ARTCOLART (CAR_ARTID, CAR_COLID) VALUES
(1, 2), (2, 2), (3, 2), (4, 2), (5, 2),
(6, 1), (7, 1), (8, 2), (9, 2), (10, 2),
(11, 2), (12, 2), (13, 2), (14, 1), (15, 2),
(16, 2), (17, 1), (18, 2), (19, 2), (20, 1),
(1, 4), (3, 4), (6, 3), (7, 3), (14, 3);

-- Stock courant (plusieurs tailles/couleurs par article)
INSERT INTO AGRSTOCKCOUR (STC_ARTID, STC_TGFID, STC_COUID, STC_QTE, STC_PUMP) VALUES
-- Pegasus 41
(1, 8, 1, 3, 54.00), (1, 9, 1, 2, 54.00), (1, 10, 1, 4, 54.00), (1, 11, 1, 1, 54.00),
(1, 9, 3, 2, 54.00), (1, 10, 3, 3, 54.00),
-- Pegasus 41 W
(2, 5, 1, 2, 54.00), (2, 6, 1, 3, 54.00), (2, 7, 1, 1, 54.00), (2, 6, 9, 2, 54.00),
-- Ultraboost
(3, 9, 1, 2, 72.00), (3, 10, 1, 3, 72.00), (3, 11, 2, 1, 72.00),
-- Speedcross 6
(4, 9, 1, 3, 48.00), (4, 10, 1, 2, 48.00), (4, 10, 5, 1, 48.00), (4, 11, 1, 2, 48.00),
-- Speedcross 6 W
(5, 5, 4, 2, 48.00), (5, 6, 4, 3, 48.00), (5, 7, 1, 1, 48.00),
-- Thermoball
(6, 2, 1, 4, 68.00), (6, 3, 1, 3, 68.00), (6, 4, 10, 2, 68.00),
-- Thermoball W
(7, 1, 1, 2, 68.00), (7, 2, 1, 3, 68.00), (7, 2, 9, 1, 68.00),
-- Dri-Fit T-Shirt
(8, 2, 1, 5, 14.00), (8, 3, 1, 4, 14.00), (8, 3, 3, 3, 14.00), (8, 4, 6, 2, 14.00),
-- Kayano 31
(9, 9, 1, 2, 66.00), (9, 10, 1, 3, 66.00), (9, 10, 3, 1, 66.00),
-- Kayano 31 W
(10, 5, 1, 2, 66.00), (10, 6, 1, 1, 66.00), (10, 6, 9, 2, 66.00),
-- Sac Trail
(11, 2, 1, 6, 32.00),
-- Fresh Foam 1080
(12, 9, 2, 2, 62.00), (12, 10, 1, 3, 62.00), (12, 11, 1, 1, 62.00),
-- Velocity Nitro
(13, 9, 1, 2, 42.00), (13, 10, 1, 1, 42.00),
-- Ski Hero
(14, 3, 4, 1, 240.00), (14, 2, 4, 2, 240.00),
-- Clifton 9
(15, 9, 1, 3, 58.00), (15, 10, 1, 2, 58.00), (15, 10, 7, 1, 58.00),
-- Clifton 9 W
(16, 5, 1, 2, 58.00), (16, 6, 1, 3, 58.00), (16, 6, 9, 1, 58.00),
-- Nano Puff
(17, 2, 5, 3, 82.00), (17, 3, 1, 2, 82.00), (17, 3, 10, 1, 82.00),
-- Short Running
(18, 2, 1, 4, 12.00), (18, 3, 1, 3, 12.00), (18, 3, 6, 2, 12.00),
-- T-Shirt OTR
(19, 2, 1, 3, 16.00), (19, 3, 3, 2, 16.00), (19, 4, 1, 1, 16.00),
-- Bonnet Salty Dog
(20, 2, 1, 8, 12.00), (20, 2, 10, 5, 12.00);

-- Tickets caisse (ventes)
INSERT INTO CSHTICKET (TKE_ID, TKE_DATE, TKE_NUMERO, TKE_TOTALTTC) VALUES
(1,  '2026-01-15', 'TK-0001', 139.99),
(2,  '2026-01-22', 'TK-0002', 189.99),
(3,  '2026-02-05', 'TK-0003', 329.98),
(4,  '2026-02-14', 'TK-0004', 159.99),
(5,  '2026-03-01', 'TK-0005', 249.98),
(6,  '2026-03-12', 'TK-0006', 89.99),
(7,  '2026-03-20', 'TK-0007', 199.99),
(8,  '2026-04-02', 'TK-0008', 129.99),
(9,  '2026-04-15', 'TK-0009', 349.98),
(10, '2026-04-28', 'TK-0010', 79.99),
(11, '2026-05-05', 'TK-0011', 259.98),
(12, '2026-05-18', 'TK-0012', 169.99),
(13, '2026-05-25', 'TK-0013', 449.97),
(14, '2026-06-01', 'TK-0014', 119.99),
(15, '2026-06-05', 'TK-0015', 289.98),
-- Ventes année précédente
(16, '2025-01-10', 'TK-1001', 129.99),
(17, '2025-02-20', 'TK-1002', 179.99),
(18, '2025-03-15', 'TK-1003', 259.98),
(19, '2025-04-10', 'TK-1004', 149.99),
(20, '2025-05-22', 'TK-1005', 199.99);

-- Lignes de tickets
INSERT INTO CSHTICKETL (TKL_ID, TKL_TKEID, TKL_ARTID, TKL_NOM, TKL_QTE, TKL_PXBRUT, TKL_REMISE, TKL_PXNET, TKL_PXNNHT, TKL_TGFID, TKL_COUID) VALUES
(1,  1,  1,  'NIKE AIR ZOOM PEGASUS 41',     1, 139.99, 0,    139.99, 116.66, 9, 1),
(2,  2,  3,  'ADIDAS ULTRABOOST 24',          1, 189.99, 0,    189.99, 158.33, 10, 1),
(3,  3,  6,  'TNF VESTE THERMOBALL ECO',      1, 229.99, 0,    229.99, 191.66, 3, 1),
(4,  3,  20, 'TNF BONNET SALTY DOG',           1, 39.99,  0,    39.99,  33.33,  2, 10),
(5,  3,  8,  'NIKE DRI-FIT T-SHIRT',           1, 29.99,  0,    29.99,  24.99,  3, 1),
(6,  4,  4,  'SALOMON SPEEDCROSS 6',           1, 159.99, 0,    159.99, 133.33, 10, 1),
(7,  5,  15, 'HOKA CLIFTON 9',                 1, 149.99, 0,    149.99, 124.99, 10, 1),
(8,  5,  18, 'NIKE SHORT RUNNING DRI-FIT',     1, 39.99,  0,    39.99,  33.33,  3, 1),
(9,  5,  19, 'ADIDAS T-SHIRT OWN THE RUN',     1, 34.99,  0,    34.99,  29.16,  3, 3),
(10, 6,  11, 'SALOMON SAC TRAIL 10L',          1, 89.99,  0,    89.99,  74.99,  2, 1),
(11, 7,  17, 'PATAGONIA NANO PUFF',            1, 199.99, 0,    199.99, 166.66, 3, 1),
(12, 8,  12, 'NEW BALANCE FRESH FOAM X 1080',  1, 159.99, 20,   129.99, 108.33, 10, 1),
(13, 9,  9,  'ASICS GEL KAYANO 31',            1, 189.99, 0,    189.99, 158.33, 10, 1),
(14, 9,  1,  'NIKE AIR ZOOM PEGASUS 41',       1, 139.99, 10,   125.99, 104.99, 10, 3),
(15, 10, 8,  'NIKE DRI-FIT T-SHIRT',           2, 29.99,  0,    29.99,  24.99,  2, 1),
(16, 10, 8,  'NIKE DRI-FIT T-SHIRT',           1, 29.99,  0,    29.99,  24.99,  3, 3),
(17, 11, 2,  'NIKE AIR ZOOM PEGASUS 41 W',     1, 139.99, 0,    139.99, 116.66, 6, 1),
(18, 11, 5,  'SALOMON SPEEDCROSS 6 W',         1, 159.99, 20,   129.99, 108.33, 6, 4),
(19, 12, 16, 'HOKA CLIFTON 9 W',               1, 149.99, 10,   134.99, 112.49, 6, 1),
(20, 12, 8,  'NIKE DRI-FIT T-SHIRT',           1, 29.99,  0,    29.99,  24.99,  2, 3),
(21, 13, 14, 'ROSSIGNOL SKI HERO ELITE',       1, 599.99, 20,   479.99, 399.99, 3, 4),
(22, 13, 6,  'TNF VESTE THERMOBALL ECO',       1, 229.99, 30,   160.99, 134.16, 2, 10),
(23, 14, 13, 'PUMA VELOCITY NITRO 3',          1, 119.99, 0,    119.99, 99.99,  10, 1),
(24, 15, 15, 'HOKA CLIFTON 9',                 1, 149.99, 0,    149.99, 124.99, 9, 7),
(25, 15, 1,  'NIKE AIR ZOOM PEGASUS 41',       1, 139.99, 0,    139.99, 116.66, 11, 1),
-- Ventes 2025
(26, 16, 1,  'NIKE AIR ZOOM PEGASUS 41',       1, 129.99, 0,    129.99, 108.33, 9, 1),
(27, 17, 6,  'TNF VESTE THERMOBALL ECO',       1, 199.99, 10,   179.99, 149.99, 3, 1),
(28, 18, 4,  'SALOMON SPEEDCROSS 6',           1, 149.99, 0,    149.99, 124.99, 10, 1),
(29, 18, 8,  'NIKE DRI-FIT T-SHIRT',           2, 29.99,  0,    29.99,  24.99,  2, 1),
(30, 19, 9,  'ASICS GEL KAYANO 31',            1, 179.99, 15,   149.99, 124.99, 10, 1),
(31, 20, 3,  'ADIDAS ULTRABOOST 24',           1, 189.99, 5,    180.49, 150.41, 9, 1);

-- BL (bons de livraison / ventes web)
INSERT INTO NEGBL (BLE_ID, BLE_DATE, BLE_NUMERO, BLE_WEB) VALUES
(1, '2026-02-10', 'BL-0001', 1),
(2, '2026-03-25', 'BL-0002', 0),
(3, '2026-05-10', 'BL-0003', 1),
(4, '2025-03-05', 'BL-1001', 1);

INSERT INTO NEGBLL (BLL_ID, BLL_BLEID, BLL_ARTID, BLL_QTE, BLL_PXBRUT, BLL_PXNET, BLL_PXNN, BLL_TGFID, BLL_COUID) VALUES
(1, 1, 1,  1, 139.99, 139.99, 116.66, 8, 1),
(2, 1, 8,  2, 29.99,  59.98,  49.98,  3, 1),
(3, 2, 15, 1, 149.99, 149.99, 124.99, 10, 1),
(4, 3, 3,  1, 189.99, 189.99, 158.33, 9, 1),
(5, 3, 19, 1, 34.99,  34.99,  29.16,  2, 1),
(6, 4, 1,  1, 129.99, 129.99, 108.33, 9, 1);

-- Commandes fournisseurs
INSERT INTO COMBCDE (CDE_ID, CDE_COLID, CDE_FOUID, CDE_DATE) VALUES
(1, 2, 1, '2025-10-15'),  -- PE 2026 Nike
(2, 2, 3, '2025-10-20'),  -- PE 2026 Salomon
(3, 2, 5, '2025-10-25'),  -- PE 2026 Asics
(4, 1, 4, '2025-06-15'),  -- AH 2025 TNF
(5, 2, 2, '2025-10-28');  -- PE 2026 Adidas

INSERT INTO COMBCDEL (CDL_ID, CDL_CDEID, CDL_ARTID, CDL_COUID, CDL_TGFID, CDL_QTE, CDL_PXACHAT, CDL_PXVENTE, CDL_REMISE1, CDL_REMISE2, CDL_REMISE3) VALUES
(1,  1, 1,  1, 9,  4, 54.00, 139.99, 10, 5, 0),
(2,  1, 1,  1, 10, 5, 54.00, 139.99, 10, 5, 0),
(3,  1, 1,  3, 9,  3, 54.00, 139.99, 10, 5, 0),
(4,  1, 2,  1, 6,  4, 54.00, 139.99, 10, 5, 0),
(5,  1, 8,  1, 2,  8, 14.00, 29.99,  10, 0, 0),
(6,  1, 8,  3, 3,  6, 14.00, 29.99,  10, 0, 0),
(7,  1, 18, 1, 2,  5, 12.00, 39.99,  10, 0, 0),
(8,  1, 18, 6, 3,  4, 12.00, 39.99,  10, 0, 0),
(9,  2, 4,  1, 10, 4, 48.00, 159.99, 15, 5, 0),
(10, 2, 4,  5, 10, 2, 48.00, 159.99, 15, 5, 0),
(11, 2, 5,  4, 6,  4, 48.00, 159.99, 15, 5, 0),
(12, 2, 11, 1, 2,  8, 32.00, 89.99,  15, 0, 0),
(13, 3, 9,  1, 10, 4, 66.00, 189.99, 10, 5, 0),
(14, 3, 10, 1, 6,  3, 66.00, 189.99, 10, 5, 0),
(15, 3, 10, 9, 6,  3, 66.00, 189.99, 10, 5, 0),
(16, 4, 6,  1, 2,  5, 68.00, 229.99, 12, 5, 0),
(17, 4, 6,  10,3,  3, 68.00, 229.99, 12, 5, 0),
(18, 4, 7,  1, 2,  4, 68.00, 229.99, 12, 5, 0),
(19, 4, 20, 1, 2,  10,12.00, 39.99,  12, 0, 0),
(20, 4, 20, 10,2,  8, 12.00, 39.99,  12, 0, 0),
(21, 5, 3,  1, 10, 4, 72.00, 189.99, 10, 5, 0),
(22, 5, 19, 1, 2,  5, 16.00, 34.99,  10, 0, 0),
(23, 5, 19, 3, 3,  4, 16.00, 34.99,  10, 0, 0);

-- Réceptions
INSERT INTO RECBR (BRE_ID, BRE_DATE, BRE_NUMERO, BRE_NUMFOURN, BRE_FOUID, BRE_COLID) VALUES
(1, '2026-01-10', 'BR-0001', 'NKF-2026-001', 1, 2),
(2, '2026-01-12', 'BR-0002', 'SAL-2026-001', 3, 2),
(3, '2026-01-15', 'BR-0003', 'ASI-2026-001', 5, 2),
(4, '2025-09-01', 'BR-0004', 'TNF-2025-001', 4, 1),
(5, '2026-01-20', 'BR-0005', 'ADF-2026-001', 2, 2);

INSERT INTO RECBRL (BRL_ID, BRL_BREID, BRL_ARTID, BRL_QTE, BRL_PXACHAT, BRL_PXVENTE, BRL_TGFID, BRL_COUID) VALUES
(1,  1, 1,  4, 54.00, 139.99, 9,  1),
(2,  1, 1,  5, 54.00, 139.99, 10, 1),
(3,  1, 1,  3, 54.00, 139.99, 9,  3),
(4,  1, 2,  4, 54.00, 139.99, 6,  1),
(5,  1, 8,  8, 14.00, 29.99,  2,  1),
(6,  1, 8,  6, 14.00, 29.99,  3,  3),
(7,  2, 4,  4, 48.00, 159.99, 10, 1),
(8,  2, 4,  2, 48.00, 159.99, 10, 5),
(9,  2, 5,  4, 48.00, 159.99, 6,  4),
(10, 2, 11, 8, 32.00, 89.99,  2,  1),
(11, 3, 9,  4, 66.00, 189.99, 10, 1),
(12, 3, 10, 3, 66.00, 189.99, 6,  1),
(13, 3, 10, 3, 66.00, 189.99, 6,  9),
(14, 4, 6,  5, 68.00, 229.99, 2,  1),
(15, 4, 6,  3, 68.00, 229.99, 3,  10),
(16, 4, 7,  4, 68.00, 229.99, 2,  1),
(17, 4, 20, 10,12.00, 39.99,  2,  1),
(18, 4, 20, 8, 12.00, 39.99,  2,  10),
(19, 5, 3,  4, 72.00, 189.99, 10, 1),
(20, 5, 19, 5, 16.00, 34.99,  2,  1),
(21, 5, 19, 4, 16.00, 34.99,  3,  3);
