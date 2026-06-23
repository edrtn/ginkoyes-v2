-- ============================
-- Auto-détection prudente des doublons articles
-- ============================
-- Critères :
-- 1. Même marque (ART_MRKID)
-- 2. Ref normalisée identique (sans espaces, tirets, points, underscores, slashs)
-- 3. Filtre anti-faux-positifs : exclut les paires junior/adulte ou homme/femme
--
-- L'article canonical = celui avec le plus grand ART_ID (le plus récent)

-- Vider les doublons auto existants (conserver les manuels)
DELETE FROM _article_duplicates WHERE match_method = 'auto';

-- Étape 1 : Créer une table temporaire des groupes candidats
DROP TEMPORARY TABLE IF EXISTS _tmp_dup_groups;
CREATE TEMPORARY TABLE _tmp_dup_groups (
  group_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  art_mrkid INT NOT NULL,
  norm_ref VARCHAR(100) NOT NULL,
  INDEX idx_key (art_mrkid, norm_ref)
);

INSERT INTO _tmp_dup_groups (art_mrkid, norm_ref)
SELECT ART_MRKID,
       UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ART_REFMRK, ' ', ''), '-', ''), '_', ''), '/', ''), '.', '')) as norm_ref
FROM ARTARTICLE
WHERE ART_REFMRK IS NOT NULL AND ART_REFMRK != ''
  AND ART_MRKID IS NOT NULL AND ART_MRKID != 0
GROUP BY ART_MRKID, norm_ref
HAVING COUNT(*) > 1;

-- Étape 2 : Créer une table temporaire avec tous les articles des groupes
DROP TEMPORARY TABLE IF EXISTS _tmp_dup_members;
CREATE TEMPORARY TABLE _tmp_dup_members (
  group_id INT NOT NULL,
  art_id INT NOT NULL,
  art_nom VARCHAR(255),
  INDEX idx_group (group_id),
  INDEX idx_art (art_id)
);

INSERT INTO _tmp_dup_members (group_id, art_id, art_nom)
SELECT g.group_id, a.ART_ID, UPPER(a.ART_NOM)
FROM _tmp_dup_groups g
JOIN ARTARTICLE a ON a.ART_MRKID = g.art_mrkid
  AND UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(a.ART_REFMRK, ' ', ''), '-', ''), '_', ''), '/', ''), '.', '')) = g.norm_ref;

-- Étape 3 : Identifier les groupes à exclure (faux positifs)
-- Un groupe est exclu si au sein du groupe, un article contient un mot-clé
-- "jeune" et un autre ne le contient pas (ou vice versa pour homme/femme)
DROP TEMPORARY TABLE IF EXISTS _tmp_excluded_groups;
CREATE TEMPORARY TABLE _tmp_excluded_groups (
  group_id INT NOT NULL PRIMARY KEY
);

-- 3a. Exclure les groupes avec mélange junior/adulte
-- Un groupe est exclu si certains articles matchent un mot-clé junior et d'autres non
INSERT IGNORE INTO _tmp_excluded_groups (group_id)
SELECT DISTINCT m1.group_id
FROM _tmp_dup_members m1
JOIN _tmp_dup_members m2 ON m1.group_id = m2.group_id AND m1.art_id != m2.art_id
WHERE (
  -- m1 a un mot-clé junior
  m1.art_nom REGEXP '(JUNIOR|\\bJR\\b|ENFANT|\\bKIDS\\b|\\bKID\\b|BABY|INFANTS|\\bINF\\b|BEBE|\\bGS\\b|\\bPS\\b|\\bTD\\b)'
  -- et m2 n'en a pas
  AND NOT m2.art_nom REGEXP '(JUNIOR|\\bJR\\b|ENFANT|\\bKIDS\\b|\\bKID\\b|BABY|INFANTS|\\bINF\\b|BEBE|\\bGS\\b|\\bPS\\b|\\bTD\\b)'
);

-- 3b. Exclure les groupes avec mélange homme/femme
INSERT IGNORE INTO _tmp_excluded_groups (group_id)
SELECT DISTINCT m1.group_id
FROM _tmp_dup_members m1
JOIN _tmp_dup_members m2 ON m1.group_id = m2.group_id AND m1.art_id != m2.art_id
WHERE (
  -- m1 est féminin
  m1.art_nom REGEXP '(FEMME|WOMEN|WOMAN|\\bWMNS\\b|FILLE|\\bGIRL\\b|\\bFILLE\\b)'
  -- m2 est masculin
  AND m2.art_nom REGEXP '(HOMME|\\bMEN\\b|\\bMAN\\b|GARCON|\\bBOY\\b)'
);

-- Offset pour group_id : utiliser MAX existant dans _article_duplicates
SET @max_group = (SELECT COALESCE(MAX(group_id), 0) FROM _article_duplicates);

-- Étape 4 : Insérer les groupes valides dans _article_duplicates
INSERT INTO _article_duplicates (group_id, art_id, is_canonical, match_method, normalized_ref)
SELECT
  g.group_id + @max_group,
  m.art_id,
  CASE WHEN m.art_id = grp_max.max_art_id THEN 1 ELSE 0 END as is_canonical,
  'auto',
  g.norm_ref
FROM _tmp_dup_groups g
JOIN _tmp_dup_members m ON m.group_id = g.group_id
JOIN (
  -- Max ART_ID par groupe (= canonical)
  SELECT group_id, MAX(art_id) as max_art_id
  FROM _tmp_dup_members
  GROUP BY group_id
) grp_max ON grp_max.group_id = g.group_id
WHERE g.group_id NOT IN (SELECT group_id FROM _tmp_excluded_groups)
  -- Exclure les articles déjà dans un groupe manuel
  AND m.art_id NOT IN (SELECT art_id FROM _article_duplicates WHERE match_method = 'manual')
ORDER BY g.group_id, m.art_id;

-- Nettoyage
DROP TEMPORARY TABLE IF EXISTS _tmp_dup_groups;
DROP TEMPORARY TABLE IF EXISTS _tmp_dup_members;
DROP TEMPORARY TABLE IF EXISTS _tmp_excluded_groups;
